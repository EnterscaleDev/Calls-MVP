import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSmsalaBalance } from "@/lib/adapters/voice-smsala";

/** Admin-only: fetches SMSala's real voice account balance server-side,
 *  since SMSALA_ACCOUNT_TOKEN must never reach the browser. */
export async function GET() {
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

  const result = await getSmsalaBalance();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
