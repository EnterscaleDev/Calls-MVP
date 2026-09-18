import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/** Admin-only: permanently deletes an Agent record — only ever succeeds
 *  server-side when admin_delete_agent's own eligibility check passes (no
 *  research history, never accepted). Any unconfirmed Supabase Auth user
 *  left over from a never-accepted invitation is cleaned up too. */
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

  const body = (await request.json().catch(() => null)) as { agentId?: string } | null;
  if (!body?.agentId) {
    return NextResponse.json({ ok: false, errorReason: "Missing agentId." }, { status: 400 });
  }

  const { data: rows, error: rpcError } = await supabase.rpc("admin_delete_agent", { p_agent_id: body.agentId });
  if (rpcError) {
    return NextResponse.json({ ok: false, errorReason: rpcError.message }, { status: 400 });
  }

  const service = createServiceClient();
  for (const row of rows ?? []) {
    if (row.auth_user_id) {
      await service.auth.admin.deleteUser(row.auth_user_id).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true });
}
