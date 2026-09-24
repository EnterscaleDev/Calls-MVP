import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendDotgoSms } from "@/lib/adapters/sms-dotgo";
import { estimateSegments } from "@/lib/adapters/sms";
import { generateSecureToken, sha256Hex } from "@/lib/supabase/tokens";
import { SMS_CREDIT_COST_PER_SEGMENT } from "@/app/admin/(dashboard)/_lib/credits";

export const maxDuration = 300;

const SEND_CONCURRENCY = 8;

/**
 * Admin-only: replaces the old client-side sequential send loop (one fetch
 * per participant, awaited one at a time in the browser — ~294 recipients
 * took over 10 minutes and looked stuck the whole time). Responds as soon
 * as eligibility/credit checks pass and the batch is ready, then keeps
 * sending after the response via Next's `after()` — the browser doesn't
 * have to stay blocked on one giant request, and SEND_CONCURRENCY lets
 * several Dotgo calls run in parallel instead of strictly one-by-one.
 * Progress is read back by the client polling campaign_invitations
 * directly (created_at >= batchStartedAt), not pushed from here.
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
    campaignId?: string;
    sendMode?: "new" | "failed";
    senderId?: string;
    messageBody?: string;
    incentiveText?: string;
  } | null;
  if (!body?.campaignId || !body.sendMode || !body.senderId || !body.messageBody) {
    return NextResponse.json({ ok: false, errorReason: "Missing required fields." }, { status: 400 });
  }
  const { campaignId, sendMode, senderId, messageBody, incentiveText } = body;

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("organisation_id, status")
    .eq("id", campaignId)
    .maybeSingle();
  if (!campaign) {
    return NextResponse.json({ ok: false, errorReason: "Campaign not found." }, { status: 404 });
  }
  if (campaign.status !== "active") {
    return NextResponse.json({ ok: false, errorReason: "This campaign isn't active — new invitations can't be sent." }, { status: 400 });
  }

  const { data: participants, error: participantsError } = await supabase
    .from("campaign_participants")
    .select("id, contact_id")
    .eq("campaign_id", campaignId)
    .eq("participation_status", sendMode === "new" ? "imported" : "invite_failed");
  if (participantsError) {
    return NextResponse.json({ ok: false, errorReason: participantsError.message }, { status: 400 });
  }
  const eligible = participants ?? [];
  if (eligible.length === 0) {
    return NextResponse.json({ ok: false, errorReason: "No eligible participants to send to." }, { status: 400 });
  }

  const fullBody = incentiveText ? `${messageBody}\n\n${incentiveText}` : messageBody;
  const segments = estimateSegments(fullBody);

  const { data: orgCredits } = await supabase.from("org_credits").select("sms").single();
  const projectedCost = eligible.length * segments * SMS_CREDIT_COST_PER_SEGMENT;
  if (!orgCredits || projectedCost > orgCredits.sms) {
    return NextResponse.json(
      { ok: false, errorReason: `Not enough SMS credit for this send — needs ${projectedCost}, ${orgCredits?.sms ?? 0} available.` },
      { status: 400 }
    );
  }

  const contactIds = eligible.map((p) => p.contact_id);
  const { data: revealed, error: revealError } = await supabase.rpc("contacts_reveal", {
    p_contact_ids: contactIds,
    p_campaign_id: campaignId,
  });
  if (revealError) {
    return NextResponse.json({ ok: false, errorReason: revealError.message }, { status: 400 });
  }
  const phoneByContactId = new Map((revealed ?? []).map((r) => [r.id, r.phone]));

  const { data: contacts } = await supabase.from("contacts").select("id, name").in("id", contactIds);
  const nameByContactId = new Map((contacts ?? []).map((c) => [c.id, c.name]));

  const batchStartedAt = new Date().toISOString();
  const appUrl = process.env.APP_PUBLIC_URL;
  const origin = appUrl ?? new URL(request.url).origin;
  const organisationId = campaign.organisation_id;

  after(async () => {
    let index = 0;
    let sentCount = 0;

    async function sendOne(participant: { id: string; contact_id: string }) {
      const phone = phoneByContactId.get(participant.contact_id);
      if (!phone) return;

      const token = generateSecureToken();
      const tokenHash = await sha256Hex(token);
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await supabase
        .from("campaign_participants")
        .update({ invite_token_hash: tokenHash, token_expires_at: expiresAt })
        .eq("id", participant.id);

      const { data: invitationRow, error: insertError } = await supabase
        .from("campaign_invitations")
        .insert({ campaign_id: campaignId, participant_id: participant.id, provider_message_id: "", status: "queued" })
        .select("id")
        .single();
      if (insertError || !invitationRow) return;

      const firstName = (nameByContactId.get(participant.contact_id) ?? "").trim().split(/\s+/)[0] || "there";
      const campaignLink = `${origin}/r/${invitationRow.id}?t=${token}`;
      const personalizedBody = fullBody
        .replaceAll("{{first_name}}", firstName)
        .replaceAll("{{campaign_link}}", campaignLink);

      const sendResult = await sendDotgoSms({
        to: phone,
        body: personalizedBody,
        requestId: invitationRow.id,
        senderMask: senderId,
        callbackUrl: appUrl ? `${appUrl}/api/sms/dotgo-callback` : undefined,
      });
      const now = new Date().toISOString();

      await supabase
        .from("campaign_invitations")
        .update({
          status: sendResult.ok ? "sent" : "failed",
          sent_at: sendResult.ok ? now : null,
          failed_at: sendResult.ok ? null : now,
          failure_reason: sendResult.ok ? null : sendResult.errorReason,
        })
        .eq("id", invitationRow.id);

      await supabase
        .from("campaign_participants")
        .update({ participation_status: sendResult.ok ? "invited" : "invite_failed" })
        .eq("id", participant.id);

      await supabase.from("audit_events").insert({
        organisation_id: organisationId,
        campaign_id: campaignId,
        actor_type: "system",
        actor_name: "Dotgo",
        action: "invitation_sent",
        entity_type: "campaign_participant",
        entity_id: participant.id,
        metadata: { status: sendResult.ok ? "sent" : "failed" },
      });

      if (sendResult.ok) sentCount += 1;
    }

    async function worker() {
      while (index < eligible.length) {
        const participant = eligible[index++];
        await sendOne(participant);
      }
    }

    await Promise.all(Array.from({ length: Math.min(SEND_CONCURRENCY, eligible.length) }, worker));

    await supabase.rpc("log_sms_batch_sent", { p_campaign_id: campaignId, p_recipient_count: eligible.length });
    if (sentCount > 0) {
      await supabase.rpc("record_sms_send_cost", {
        p_campaign_id: campaignId,
        p_amount: sentCount * segments * SMS_CREDIT_COST_PER_SEGMENT,
        p_recipient_count: sentCount,
      });
    }
  });

  return NextResponse.json({ ok: true, totalEligible: eligible.length, batchStartedAt });
}
