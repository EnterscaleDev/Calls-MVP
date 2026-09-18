import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/** Admin-only: bumps the invitation's expiry and re-sends the real Supabase
 *  invite email. Re-inviting an email Supabase already has an unconfirmed
 *  user for issues a fresh link and implicitly invalidates the old one. */
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

  const { data: rows, error: rpcError } = await supabase.rpc("admin_resend_invitation", {
    p_invitation_id: body.invitationId,
  });
  if (rpcError || !rows?.[0]) {
    return NextResponse.json({ ok: false, errorReason: rpcError?.message ?? "Couldn't resend this invitation." }, { status: 400 });
  }
  const row = rows[0];

  const appUrl = process.env.APP_PUBLIC_URL;
  if (!appUrl) {
    return NextResponse.json(
      { ok: false, errorReason: "APP_PUBLIC_URL isn't set — invite emails need a redirect URL." },
      { status: 500 }
    );
  }

  const service = createServiceClient();
  const { data: authData, error: authError } = await service.auth.admin.inviteUserByEmail(row.email, {
    redirectTo: `${appUrl}/invite/accept`,
  });
  if (authError || !authData?.user) {
    return NextResponse.json(
      { ok: false, errorReason: authError?.message ?? "We couldn't send the invitation email." },
      { status: 502 }
    );
  }

  if (authData.user.id !== row.auth_user_id) {
    await supabase.rpc("admin_link_invitation_auth_user", {
      p_invitation_id: body.invitationId,
      p_auth_user_id: authData.user.id,
    });
  }

  return NextResponse.json({ ok: true, expiresAt: row.expires_at });
}
