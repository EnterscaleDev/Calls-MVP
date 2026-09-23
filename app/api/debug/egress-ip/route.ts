import { NextResponse } from "next/server";

/** Temporary diagnostic — reports this deployment's outbound IPv4 address,
 *  to compare against SMSala's Voice Connection IP allowlist. Delete once
 *  the allowlist question is resolved. */
export async function GET() {
  const res = await fetch("https://api.ipify.org?format=json");
  const data = await res.json();
  return NextResponse.json(data);
}
