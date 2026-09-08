"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Clock, Phone, Calendar, Mic, Lock, Shield, XCircle, Gift } from "lucide-react";
import { useParticipantToken } from "@/lib/participant-context";
import { Button, ButtonLink } from "@/components/ui/Button";
import { InlineBanner } from "@/components/ui/States";
import { cn } from "@/lib/cn";

/** Small translucent-white pill used in the hero card (duration / format / scheduling). */
function HeroPill({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white">
      {icon}
      {children}
    </span>
  );
}

/** One row in the "Good to know" list — icon-in-circle, bold title, one-line description. */
function GoodToKnowRow({
  icon,
  tone,
  title,
  description,
}: {
  icon: ReactNode;
  tone: "primary" | "navy";
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 py-3.5">
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
          tone === "primary" ? "bg-primary-soft text-primary" : "bg-navy-soft text-navy"
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 text-sm text-foreground-muted">{description}</p>
      </div>
    </div>
  );
}

export default function ParticipantLandingPage() {
  const router = useRouter();
  const { token, campaign, firstName, booking, hasAgreedParticipation, hasDeclined } =
    useParticipantToken();
  const [reconsidering, setReconsidering] = useState(false);

  const alreadyAgreedWithBooking = hasAgreedParticipation && !!booking;

  useEffect(() => {
    if (alreadyAgreedWithBooking) {
      router.push(`/participate/${token}/confirmation`);
    }
  }, [alreadyAgreedWithBooking, router, token]);

  if (alreadyAgreedWithBooking) {
    return null;
  }

  if (hasDeclined && !hasAgreedParticipation && !reconsidering) {
    return (
      <div className="flex flex-col gap-4">
        <InlineBanner kind="info">
          Hi {firstName}, our records show you previously declined to take part in this study.
          You won&apos;t be contacted further about it.
        </InlineBanner>
        <p className="text-sm text-foreground-muted">
          Changed your mind? You can still take part if you&apos;d like to.
        </p>
        <Button variant="secondary" onClick={() => setReconsidering(true)}>
          I&apos;d like to reconsider
        </Button>
      </div>
    );
  }

  const continueHref = hasAgreedParticipation
    ? `/participate/${token}/schedule`
    : `/participate/${token}/consent`;

  const about = (campaign.researchObjective || campaign.description).trim().replace(/[.\s]+$/, "");

  return (
    <div className="flex flex-col gap-5">
      {/* Hero */}
      <div className="rounded-[8px] bg-navy px-5 py-6 text-white">
        <p className="label-caps text-white/70">{campaign.clientName.toUpperCase()}</p>
        <h1 className="mt-2 text-2xl font-bold leading-tight text-white">
          We&apos;d like {campaign.estimatedDurationMinutes} minutes to hear about your
          experience.
        </h1>
        <p className="mt-2 text-sm text-white/85">
          Hi {firstName} — {campaign.clientName} asked us to speak with people like you
          {about ? ` about ${about}` : ""}.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <HeroPill icon={<Clock className="h-3.5 w-3.5" />}>
            {campaign.estimatedDurationMinutes} minutes
          </HeroPill>
          <HeroPill icon={<Phone className="h-3.5 w-3.5" />}>Phone call</HeroPill>
          <HeroPill icon={<Calendar className="h-3.5 w-3.5" />}>You pick the time</HeroPill>
        </div>
      </div>

      {/* Incentive callout */}
      {campaign.incentiveTitle ? (
        <div className="flex items-start gap-3 rounded-[6px] border border-primary-soft-border bg-primary-soft px-4 py-3.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-white">
            <Gift className="h-[18px] w-[18px]" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground">{campaign.incentiveTitle}</p>
            {campaign.incentiveDescription ? (
              <p className="mt-0.5 text-sm text-foreground-muted">
                {campaign.incentiveDescription}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Good to know */}
      <div>
        <p className="label-caps text-foreground-muted">Good to know</p>
        <div className="mt-1 divide-y divide-border">
          {campaign.recordingEnabled ? (
            <GoodToKnowRow
              icon={<Mic className="h-[18px] w-[18px]" />}
              tone="primary"
              title="The call is recorded"
              description="So we don't have to take notes while you talk. You can ask us to stop at any time."
            />
          ) : null}
          <GoodToKnowRow
            icon={<Lock className="h-[18px] w-[18px]" />}
            tone="navy"
            title="Your number stays private"
            description="The interviewer never sees it — the platform connects the call for you."
          />
          <GoodToKnowRow
            icon={<Shield className="h-[18px] w-[18px]" />}
            tone="navy"
            title="The interviewer doesn't see your name"
            description={`Only a reference alias is shown during the call — your contact details stay with ${campaign.clientName}.`}
          />
          <GoodToKnowRow
            icon={<XCircle className="h-[18px] w-[18px]" />}
            tone="primary"
            title="Stop whenever you like"
            description="During the call or before it, no reason needed."
          />
        </div>
      </div>

      <ButtonLink href={continueHref} className="w-full justify-center">
        Continue
      </ButtonLink>
    </div>
  );
}
