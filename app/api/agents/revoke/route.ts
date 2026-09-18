import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/** Admin-only: marks the invitation revoked and deletes the still-unconfirmed
 *  Supabase Auth user behind it, if one exists — that's what actually makes
 *  the old emailed link fail, not just our own status flag. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, errorReason: "Not signed in." }, { status: 401 });
  }
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") {
    return NextResponse.json({ ok: false, errorReason: "Admin access required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { invitationId?: string } | null;
  if (!body?.invitationId) {
    return NextResponse.json({ ok: false, errorReason: "Missing invitationId." }, { status: 400 });
  }

  const { data: rows, error: rpcError } = await supabase.rpc("admin_revoke_invitation", {
    p_invitation_id: body.invitationId,
  });
  if (rpcError || !rows?.[0]) {
    return NextResponse.json({ ok: false, errorReason: rpcError?.message ?? "Couldn't revoke this invitation." }, { status: 400 });
  }
  const row = rows[0];

  if (row.auth_user_id) {
    const service = createServiceClient();
    // Never delete a user who already completed setup — an accepted
    // invitation's auth_user_id belongs to a real, active Agent account.
    await service.auth.admin.deleteUser(row.auth_user_id).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
