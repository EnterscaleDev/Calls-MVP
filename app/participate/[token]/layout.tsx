"use client";

import { use } from "react";
import { ParticipantTokenProvider } from "@/lib/participant-context";
import { LoadingScreen, ErrorState } from "@/components/ui/States";

export default function ParticipateLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface px-4 py-3 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Research Invitation</p>
      </header>
      <div className="mx-auto w-full max-w-md px-4 py-6">
        <ParticipantTokenProvider
          token={token}
          fallback={(state) => {
            if (state === "loading") return <LoadingScreen label="Opening your invitation..." />;
            if (state === "expired")
              return (
                <ErrorState
                  title="This invitation has expired"
                  description="Invitation links are only valid for a limited time. Contact the research team if you'd still like to take part."
                />
              );
            if (state === "revoked")
              return (
                <ErrorState
                  title="This invitation is no longer active"
                  description="This link has been revoked. Contact the research team if you think this is a mistake."
                />
              );
            return (
              <ErrorState
                title="We couldn't find that invitation"
                description="Double-check the link from your text message — it should be copied exactly as sent."
              />
            );
          }}
        >
          {children}
        </ParticipantTokenProvider>
      </div>
    </div>
  );
}
