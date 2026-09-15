import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Public webhook for Dotgo's URL-click tracking — a distinct feature from
 * the delivery-status callback (app/api/sms/dotgo-callback/route.ts),
 * turned on by sending `track_url` on the original Messages POST (see
 * lib/adapters/sms-dotgo.ts). Dotgo is meant to auto-wrap any link in the
 * message body with a Dotgo-hosted short link and call this URL when a
 * recipient taps it.
 *
 * Their public docs don't give a full parameter table for this specific
 * callback the way they do for the delivery-status one — the one thing
 * confirmed from their sample payload is that it echoes back the caller's
 * own request `id`. Everything else here (`to` fallback, field names) is
 * a best-effort guess pending a real click to observe the actual shape —
 * this handler stays deliberately permissive (any recognizable identifying
 * field is enough) and always acks 200 so a shape mismatch doesn't cause
 * Dotgo to retry indefinitely.
 */

function normalizeDigits(phone: string): string {
  return phone.replace(/[^0-9]/g, "");
}

interface DotgoClickPayload {
  id?: string;
  ref_id?: string;
  to?: string;
  url?: string;
  timestamp?: string;
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as DotgoClickPayload | null;
  if (!payload) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const supabase = createServiceClient();
  const now = new Date().toISOString();

  let invitationId: string | null = payload.id ?? null;

  if (!invitationId && payload.to) {
    const targetDigits = normalizeDigits(payload.to);
    const { data: contacts } = await supabase.from("contacts").select("id, phone");
    const matchingContactIds = (contacts ?? [])
      .filter((c) => normalizeDigits(c.phone) === targetDigits)
      .map((c) => c.id);

    if (matchingContactIds.length > 0) {
      const { data: participants } = await supabase
        .from("campaign_participants")
        .select("id")
        .in("contact_id", matchingContactIds);
      const participantIds = (participants ?? []).map((p) => p.id);

      if (participantIds.length > 0) {
        const { data: invitations } = await supabase
          .from("campaign_invitations")
          .select("id")
          .in("participant_id", participantIds)
          .not("sent_at", "is", null)
          .order("sent_at", { ascending: false })
          .limit(1);
        invitationId = invitations?.[0]?.id ?? null;
      }
    }
  }

  if (!invitationId) {
    return NextResponse.json({ ok: true });
  }

  // Only record the first click — later taps of the same link shouldn't
  // move the "time to click" metric.
  await supabase
    .from("campaign_invitations")
    .update({ clicked_at: now })
    .eq("id", invitationId)
    .is("clicked_at", null);

  return NextResponse.json({ ok: true });
}
