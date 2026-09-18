import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Admin-only: creates the app-level invitation record (via admin_invite_agent,
 * running as the caller's own session so fn_is_admin() gates it), then sends
 * the real email via Supabase Auth's own invite mechanism — the only email
 * delivery available without a separate provider. That call needs the
 * service-role client (auth.admin is privileged), so it can't happen from
 * the browser.
 */
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

  const body = (await request.json().catch(() => null)) as {
    name?: string;
    email?: string;
    phone?: string;
    campaignIds?: string[];
    dailyTarget?: number;
  } | null;
  if (!body?.name?.trim() || !body.email?.trim()) {
    return NextResponse.json({ ok: false, errorReason: "Name and email are required." }, { status: 400 });
  }

  const { data: inviteRows, error: rpcError } = await supabase.rpc("admin_invite_agent", {
    p_name: body.name.trim(),
    p_email: body.email.trim(),
    p_campaign_ids: body.campaignIds ?? [],
    p_daily_target: body.dailyTarget ?? 8,
    p_phone: body.phone?.trim() ?? "",
  });
  if (rpcError || !inviteRows?.[0]) {
    return NextResponse.json({ ok: false, errorReason: rpcError?.message ?? "Couldn't create the invitation." }, { status: 400 });
  }
  const invitation = inviteRows[0];

  const appUrl = process.env.APP_PUBLIC_URL;
  if (!appUrl) {
    return NextResponse.json(
      { ok: false, errorReason: "APP_PUBLIC_URL isn't set — invite emails need a redirect URL." },
      { status: 500 }
    );
  }

  const service = createServiceClient();
  const { data: authData, error: authError } = await service.auth.admin.inviteUserByEmail(body.email.trim(), {
    redirectTo: `${appUrl}/invite/accept`,
  });
  if (authError || !authData?.user) {
    // The app-level invitation row still exists — Resend can retry the
    // email send without recreating it. Don't claim success here.
    return NextResponse.json(
      { ok: false, errorReason: authError?.message ?? "We couldn't send the invitation email." },
      { status: 502 }
    );
  }

  await supabase.rpc("admin_link_invitation_auth_user", {
    p_invitation_id: invitation.invitation_id,
    p_auth_user_id: authData.user.id,
  });

  return NextResponse.json({ ok: true, invitationId: invitation.invitation_id, expiresAt: invitation.expires_at });
}
