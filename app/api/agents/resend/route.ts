import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/** Admin-only: bumps the invitation's expiry and re-sends a real email.
 *
 * CORRECTED: the comment this replaced claimed re-inviting an email Supabase
 * already has an unconfirmed user for "issues a fresh link" — verified live
 * against a real pending invite and that's false. `inviteUserByEmail` creates
 * the auth.users row on the *first* call; every call after that for the same
 * email fails outright with "A user with this email address has already
 * been registered" (HTTP 422/502), which is exactly what every real resend
 * hits, since the whole point of resending is the user already exists from
 * the original invite.
 *
 * Fix: try inviteUserByEmail first (covers the edge case where the auth user
 * was somehow removed), and on that specific "already registered" error,
 * fall back to resetPasswordForEmail — it works for any existing user
 * regardless of confirmation status, and really does send a fresh real
 * email via Supabase's built-in template. It lands the agent on the same
 * /invite/accept page (Supabase's recovery links authenticate the browser
 * the same way invite links do), where they still set their display name
 * and password exactly as on a first-time invite. */
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

  if (!authError && authData?.user) {
    if (authData.user.id !== row.auth_user_id) {
      await supabase.rpc("admin_link_invitation_auth_user", {
        p_invitation_id: body.invitationId,
        p_auth_user_id: authData.user.id,
      });
    }
    return NextResponse.json({ ok: true, expiresAt: row.expires_at });
  }

  const alreadyRegistered = /already.*registered/i.test(authError?.message ?? "");
  if (!alreadyRegistered) {
    return NextResponse.json(
      { ok: false, errorReason: authError?.message ?? "We couldn't send the invitation email." },
      { status: 502 }
    );
  }

  // Expected path for a genuine resend — the auth user already exists from
  // the original invite, so fall back to a real password-reset email
  // instead (see the top-of-file comment for why).
  const { error: resetError } = await service.auth.resetPasswordForEmail(row.email, {
    redirectTo: `${appUrl}/invite/accept`,
  });
  if (resetError) {
    return NextResponse.json(
      { ok: false, errorReason: resetError.message },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, expiresAt: row.expires_at });
}
