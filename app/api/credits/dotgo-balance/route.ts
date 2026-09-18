import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDotgoBalance } from "@/lib/adapters/sms-dotgo";

/** Admin-only: fetches Dotgo's real account balance server-side, since
 *  DOTGO_API_TOKEN must never reach the browser. */
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

  const result = await getDotgoBalance();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
