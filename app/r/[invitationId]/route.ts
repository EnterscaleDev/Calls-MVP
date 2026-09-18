import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Self-hosted click-tracking redirect — what {{campaign_link}} actually
 * points to now. Dotgo's own track_url/link-wrapping never fired (confirmed
 * against a real send/click), so this replaces it: log the first click
 * against the invitation row, then bounce straight to the real participant
 * link. No auth — same trust boundary as the participant flow itself, since
 * anyone with the link is meant to be able to open it.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ invitationId: string }> }
) {
  const { invitationId } = await params;
  const token = new URL(request.url).searchParams.get("t");
  const destination = new URL(token ? `/participate/${token}` : "/", request.url);

  const supabase = createServiceClient();
  await supabase
    .from("campaign_invitations")
    .update({ clicked_at: new Date().toISOString() })
    .eq("id", invitationId)
    .is("clicked_at", null);

  return NextResponse.redirect(destination);
}
