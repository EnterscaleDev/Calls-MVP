import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { resolveParticipantPhone } from "@/lib/server/participant-lookup";
import { bridgeCall } from "@/lib/adapters/voice-smsala";

/**
 * Server-side-only call-initiation step: the call workspace (browser) hits
 * this instead of talking to SMSala directly, so SMSALA_AUTH_TOKEN and both
 * real phone numbers (agent's own, participant's) never reach client code —
 * this is the "real telephony integration" lib/server/participant-lookup.ts
 * was written for but never had a caller until now.
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
    .select("role, agent_id")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "agent" || !profile.agent_id) {
    return NextResponse.json({ ok: false, errorReason: "Agent access required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    assignmentId?: string;
    clientUniqueId?: string;
  } | null;
  if (!body?.assignmentId || !body.clientUniqueId) {
    return NextResponse.json({ ok: false, errorReason: "Missing assignmentId/clientUniqueId." }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: assignment } = await service
    .from("call_assignments")
    .select("agent_id")
    .eq("id", body.assignmentId)
    .maybeSingle();
  if (!assignment || assignment.agent_id !== profile.agent_id) {
    return NextResponse.json({ ok: false, errorReason: "That call isn't assigned to you." }, { status: 403 });
  }

  const { data: agentRow } = await service
    .from("agent_profiles")
    .select("phone")
    .eq("id", profile.agent_id)
    .maybeSingle();
  if (!agentRow?.phone) {
    return NextResponse.json(
      { ok: false, errorReason: "No phone number on file for your agent profile — ask an admin to add one." },
      { status: 400 }
    );
  }

  let participantPhone: string;
  try {
    participantPhone = await resolveParticipantPhone(body.assignmentId);
  } catch (error) {
    return NextResponse.json(
      { ok: false, errorReason: error instanceof Error ? error.message : "Couldn't resolve participant phone." },
      { status: 500 }
    );
  }

  const appUrl = process.env.APP_PUBLIC_URL;
  if (!appUrl) {
    return NextResponse.json(
      { ok: false, errorReason: "APP_PUBLIC_URL isn't set — SMSala requires a callback URL." },
      { status: 500 }
    );
  }
  const callbackUrl = `${appUrl}/api/voice/smsala-callback`;

  const result = await bridgeCall({
    callerNumber: agentRow.phone,
    calledNumber: participantPhone,
    clientUniqueId: body.clientUniqueId,
    callbackUrl,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
