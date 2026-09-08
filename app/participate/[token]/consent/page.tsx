"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Target, Clock3, Gift, ShieldCheck } from "lucide-react";
import { useParticipantToken } from "@/lib/participant-context";
import { useStore } from "@/lib/store";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Form";
import { InlineBanner } from "@/components/ui/States";
import { cn } from "@/lib/cn";

/** Icon-in-circle info row, reused from the landing page's "Good to know" treatment. */
function InfoRow({
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

export default function ConsentPage() {
  const router = useRouter();
  const { token, campaign, participant, firstName, hasAgreedParticipation, hasDeclined, booking } =
    useParticipantToken();
  const { actions } = useStore();

  const [participationChecked, setParticipationChecked] = useState(false);
  const [recordingChoice, setRecordingChoice] = useState<"agree" | "decline" | null>(null);
  const [justDeclined, setJustDeclined] = useState(false);

  // Guard: nothing to reconsider — if they already agreed, this screen is redundant.
  useEffect(() => {
    if (hasAgreedParticipation) {
      router.push(booking ? `/participate/${token}/confirmation` : `/participate/${token}/schedule`);
    }
  }, [hasAgreedParticipation, booking, router, token]);

  if (hasAgreedParticipation) return null;

  if (justDeclined) {
    return (
      <InlineBanner kind="info">
        Thanks for letting us know, {firstName}. You won&apos;t be contacted further for this study.
      </InlineBanner>
    );
  }

  const needsRecordingChoice = campaign.recordingEnabled;
  const canContinue = participationChecked && (!needsRecordingChoice || recordingChoice !== null);
  const about = campaign.researchObjective || campaign.description;

  function handleAgree() {
    if (!canContinue) return;
    const recordingAgreed = needsRecordingChoice ? recordingChoice === "agree" : undefined;
    actions.recordConsent(participant.id, true, recordingAgreed);
    router.push(`/participate/${token}/schedule`);
  }

  function handleDecline() {
    actions.recordConsent(participant.id, false);
    setJustDeclined(true);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-[8px] bg-navy px-5 py-6 text-white">
        <p className="label-caps text-white/70">{campaign.clientName.toUpperCase()}</p>
        <h1 className="mt-2 text-2xl font-bold leading-tight text-white">
          Before we get started, {firstName}
        </h1>
        <p className="mt-2 text-sm text-white/85">
          Please read the following and let us know if you&apos;re happy to take part.
        </p>
      </div>

      <div>
        <p className="label-caps text-foreground-muted">What&apos;s involved</p>
        <div className="mt-1 divide-y divide-border">
          <InfoRow
            icon={<Target className="h-[18px] w-[18px]" />}
            tone="navy"
            title="Purpose of this research"
            description={about}
          />
          <InfoRow
            icon={<Clock3 className="h-[18px] w-[18px]" />}
            tone="primary"
            title="What to expect"
            description={`A researcher will call you at a time you choose. It takes about ${campaign.estimatedDurationMinutes} minutes.`}
          />
          {campaign.incentiveTitle ? (
            <InfoRow
              icon={<Gift className="h-[18px] w-[18px]" />}
              tone="navy"
              title={campaign.incentiveTitle}
              description={campaign.incentiveDescription || "Our way of saying thanks for your time."}
            />
          ) : null}
          <InfoRow
            icon={<ShieldCheck className="h-[18px] w-[18px]" />}
            tone="primary"
            title="Your privacy"
            description="Your responses are used only for this research study and handled confidentially. You can withdraw at any time by letting the researcher know, with no effect on any other services you use."
          />
        </div>
      </div>

      <Card>
        <CardBody className="flex flex-col gap-4">
          <Checkbox
            checked={participationChecked}
            onChange={(e) => setParticipationChecked(e.target.checked)}
            label="I agree to participate in this research."
          />

          {needsRecordingChoice ? (
            <div className="border-t border-border pt-4">
              <p className="text-sm font-medium text-foreground">
                This call may be recorded for quality and analysis purposes.
              </p>
              <div className="mt-2 flex flex-col gap-2">
                <Checkbox
                  checked={recordingChoice === "agree"}
                  onChange={() => setRecordingChoice("agree")}
                  label="Yes, I agree to the call being recorded."
                />
                <Checkbox
                  checked={recordingChoice === "decline"}
                  onChange={() => setRecordingChoice("decline")}
                  label="No, please don't record the call."
                />
              </div>
            </div>
          ) : null}
        </CardBody>
      </Card>

      <div className="flex flex-col gap-2">
        <Button className="w-full justify-center" disabled={!canContinue} onClick={handleAgree}>
          I Agree — Choose a Time
        </Button>
        <Button variant="ghost" className="w-full justify-center" onClick={handleDecline}>
          Decline
        </Button>
      </div>

      {hasDeclined ? (
        <p className="text-center text-xs text-foreground-subtle">
          You previously declined — submitting above will update your response.
        </p>
      ) : null}
    </div>
  );
}
