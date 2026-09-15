import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendDotgoSms } from "@/lib/adapters/sms-dotgo";

/**
 * Server-side-only send step: the Invitations page (browser) calls this
 * route instead of talking to Dotgo directly, so DOTGO_API_TOKEN never
 * reaches client code. Everything else about the send (token minting,
 * campaign_invitations bookkeeping) stays client-side as before — this
 * route's only job is the one part that needs a secret.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, errorReason: "Not signed in." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") {
    return NextResponse.json({ ok: false, errorReason: "Admin access required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    to?: string;
    body?: string;
    requestId?: string;
    senderMask?: string;
  } | null;
  if (!body?.to || !body.body || !body.requestId) {
    return NextResponse.json({ ok: false, errorReason: "Missing to/body/requestId." }, { status: 400 });
  }

  const appUrl = process.env.APP_PUBLIC_URL;
  const callbackUrl = appUrl ? `${appUrl}/api/sms/dotgo-callback` : undefined;
  const trackUrl = appUrl ? `${appUrl}/api/sms/dotgo-click-callback` : undefined;

  const result = await sendDotgoSms({
    to: body.to,
    body: body.body,
    requestId: body.requestId,
    senderMask: body.senderMask,
    callbackUrl,
    trackUrl,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
