"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Btn, Field, Note, Icon, Chip, Kpi, Empty } from "@/components/ros/ros-ui";

type Phase =
  | "loading"
  | "invalid_link"
  | "expired"
  | "revoked"
  | "already_accepted"
  | "setup"
  | "ob1"
  | "ob2"
  | "ob3";

interface InvitationInfo {
  agentName: string;
  organisationName: string;
  campaignNames: string[];
  dailyTarget: number | null;
}

/**
 * Single page driving the whole post-click Agent invitation flow, reskinned
 * to match ros-invite.jsx's AgentInviteFlow exactly (".pub-*" classes,
 * copy, step order). There's no {token} route param here — the real,
 * single-use security token lives inside the magic link Supabase's own
 * inviteUserByEmail() sent (see app/api/agents/invite/route.ts); by the
 * time this page's client code runs, supabase-js has already turned a
 * valid link into a real session. What this page adds on top is everything
 * Supabase's own flow doesn't know about: whose invitation this is, which
 * campaigns, and the short account-setup + onboarding steps before landing
 * in the Agent workspace.
 */
export default function InviteAcceptPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [info, setInfo] = useState<InvitationInfo | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;

      if (!user) {
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const query = new URLSearchParams(window.location.search);
        const errorCode = hash.get("error_code") || query.get("error_code");
        setPhase(errorCode === "otp_expired" ? "expired" : "invalid_link");
        return;
      }

      const { data: rows, error } = await supabase.rpc("agent_lookup_own_invitation");
      if (cancelled) return;
      const row = rows?.[0];
      if (error || !row) {
        setPhase("invalid_link");
        return;
      }

      if (row.status === "revoked") {
        setPhase("revoked");
        return;
      }
      if (row.status === "accepted") {
        setPhase("already_accepted");
        return;
      }
      if (row.status === "expired" || new Date(row.expires_at).getTime() < Date.now()) {
        setPhase("expired");
        return;
      }

      setInfo({
        agentName: row.agent_name,
        organisationName: row.organisation_name,
        campaignNames: row.campaign_names ?? [],
        // agent_lookup_own_invitation() doesn't expose the per-campaign
        // daily target; the ob3 Kpi below falls back to the platform
        // default (8) rather than showing a made-up real number.
        dailyTarget: null,
      });
      setName(row.agent_name);
      setPhase("setup");
    }
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSetupSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setFormError("Enter your name.");
      return;
    }
    if (password.length < 8) {
      setFormError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setFormError("Passwords don't match.");
      return;
    }
    setFormError("");
    setSubmitting(true);
    const supabase = createClient();
    const { error: passwordError } = await supabase.auth.updateUser({ password });
    if (passwordError) {
      setSubmitting(false);
      setFormError(passwordError.message);
      return;
    }
    const { error: acceptError } = await supabase.rpc("agent_accept_invitation", { p_display_name: name.trim() });
    setSubmitting(false);
    if (acceptError) {
      setFormError(
        acceptError.message.includes("expired")
          ? "This invitation expired while you were setting up. Ask your administrator to send a new one."
          : acceptError.message
      );
      if (acceptError.message.includes("expired")) setPhase("expired");
      return;
    }
    setPhase("ob1");
  }

  function goToWorkspace() {
    router.push("/agent");
    router.refresh();
  }

  const fn = name.trim().split(" ")[0] || "there";

  return (
    <div className="ros-root pub">
      <div className="pub-bar">
        <div className="pub-bar-in">
          <span className="dsp" style={{ fontSize: 14 }}>
            Calls — Research Operations
          </span>
        </div>
      </div>

      {phase === "loading" && <p className="mut" style={{ marginTop: 40 }}>Opening your invitation…</p>}

      {phase === "invalid_link" && (
        <div className="pub-card">
          <div className="pub-body" style={{ paddingTop: 26 }}>
            <h3 style={{ fontSize: 19, marginBottom: 8 }}>This invitation link isn&apos;t valid</h3>
            <p style={{ marginBottom: 0 }}>Double-check the link from your email, or ask your administrator to send a new invitation.</p>
          </div>
        </div>
      )}

      {phase === "expired" && (
        <div className="pub-card">
          <div className="pub-body" style={{ paddingTop: 26 }}>
            <h3 style={{ fontSize: 19, marginBottom: 8 }}>This invitation has expired</h3>
            <p style={{ marginBottom: 0 }}>Ask your administrator to send a new invitation.</p>
          </div>
        </div>
      )}

      {phase === "revoked" && (
        <div className="pub-card">
          <div className="pub-body" style={{ paddingTop: 26 }}>
            <h3 style={{ fontSize: 19, marginBottom: 8 }}>This invitation is no longer active</h3>
            <p style={{ marginBottom: 0 }}>Ask whoever invited you to send a new one.</p>
          </div>
        </div>
      )}

      {phase === "already_accepted" && (
        <div className="pub-card">
          <div className="pub-body" style={{ paddingTop: 26 }}>
            <h3 style={{ fontSize: 19, marginBottom: 8 }}>This invitation has already been accepted</h3>
            <p>You&apos;ve already set up your account.</p>
            <div className="rule" />
            <Btn k="p" onClick={() => router.push("/agent/login")}>
              Sign in
            </Btn>
          </div>
        </div>
      )}

      {phase === "setup" && info && (
        <div className="pub-card">
          <div className="pub-hero">
            <div className="eyebrow" style={{ color: "rgba(255,255,255,.82)" }}>
              {info.organisationName}
            </div>
            <h2 style={{ marginTop: 6 }}>You&apos;ve been invited</h2>
            <div className="lede">{info.organisationName} has invited you to join as a Call Agent.</div>
          </div>
          <div className="pub-body">
            {info.campaignNames.length ? (
              <>
                <div className="pub-sec" style={{ marginTop: 0 }}>
                  You&apos;ll be working on
                </div>
                {info.campaignNames.map((n) => (
                  <div key={n} className="gk">
                    <span className="gk-i">
                      <Icon n="phone" size={15} />
                    </span>
                    <div>
                      <b>{n}</b>
                      <em>Interview campaign</em>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <Note tone="i">No campaign assigned yet — you&apos;ll see this once your administrator adds you to one.</Note>
            )}
            <div className="pub-sec">What you&apos;ll do</div>
            <div className="gk">
              <span className="gk-i">
                <Icon n="doc" size={15} />
              </span>
              <div>
                <b>View your assigned interviews</b>
                <em>They land in one queue, in the order participants chose.</em>
              </div>
            </div>
            <div className="gk">
              <span className="gk-i">
                <Icon n="phone" size={15} />
              </span>
              <div>
                <b>Start calls from the platform</b>
                <em>The platform connects the call — no dialling required.</em>
              </div>
            </div>
            <div className="gk">
              <span className="gk-i n">
                <Icon n="lock" size={15} />
              </span>
              <div>
                <b>Submit an outcome and notes when finished</b>
                <em>Participant phone numbers stay private and are never shown to you.</em>
              </div>
            </div>
            <div className="rule" style={{ margin: "20px 0 14px" }} />
            {formError ? (
              <div style={{ marginBottom: 12 }}>
                <Note tone="r">{formError}</Note>
              </div>
            ) : null}
            <form onSubmit={handleSetupSubmit}>
              <Field l="Full name">
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </Field>
              <Field l="Password" hint="At least 8 characters.">
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
              </Field>
              <Field l="Confirm password">
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </Field>
              <Btn k="p" lg type="submit" disabled={submitting} style={{ width: "100%", justifyContent: "center", marginTop: 6 }}>
                {submitting ? "Setting up..." : "Create account & continue"}
              </Btn>
            </form>
          </div>
        </div>
      )}

      {phase === "ob1" && info && (
        <div className="pub-card">
          <div className="pub-hero" style={{ background: "var(--navy)" }}>
            <div className="eyebrow" style={{ color: "rgba(255,255,255,.82)" }}>
              Step 1 of 3
            </div>
            <h2 style={{ marginTop: 6 }}>Welcome, {fn}</h2>
          </div>
          <div className="pub-body" style={{ paddingTop: 26 }}>
            <p>You&apos;ve joined {info.organisationName} as a Call Agent.</p>
            {!!info.campaignNames.length && (
              <div className="row wrap" style={{ gap: 6, marginBottom: 14 }}>
                {info.campaignNames.map((n) => (
                  <Chip key={n} tone="i">
                    {n}
                  </Chip>
                ))}
              </div>
            )}
            <Btn k="p" lg style={{ width: "100%", justifyContent: "center" }} onClick={() => setPhase("ob2")}>
              Continue
            </Btn>
          </div>
        </div>
      )}

      {phase === "ob2" && (
        <div className="pub-card">
          <div className="pub-hero" style={{ background: "var(--navy)" }}>
            <div className="eyebrow" style={{ color: "rgba(255,255,255,.82)" }}>
              Step 2 of 3
            </div>
            <h2 style={{ marginTop: 6 }}>How your calls work</h2>
          </div>
          <div className="pub-body" style={{ paddingTop: 26 }}>
            <div className="gk">
              <span className="gk-i">1</span>
              <div>
                <b>Open an assigned interview.</b>
              </div>
            </div>
            <div className="gk">
              <span className="gk-i">2</span>
              <div>
                <b>Start the call from the platform.</b>
              </div>
            </div>
            <div className="gk">
              <span className="gk-i">3</span>
              <div>
                <b>Submit an outcome and notes when finished.</b>
              </div>
            </div>
            <div style={{ marginTop: 4 }}>
              <Note tone="i">Participant phone numbers remain private and are not displayed to Agents.</Note>
            </div>
            <Btn k="p" lg style={{ width: "100%", justifyContent: "center", marginTop: 16 }} onClick={() => setPhase("ob3")}>
              Continue
            </Btn>
          </div>
        </div>
      )}

      {phase === "ob3" && info && (
        <div className="pub-card">
          <div className="pub-body" style={{ paddingTop: 26 }}>
            <div className="row" style={{ gap: 13, marginBottom: 18 }}>
              <span className="tick">
                <Icon n="check" size={20} />
              </span>
              <div>
                <h3 style={{ fontSize: 19 }}>You&apos;re ready</h3>
              </div>
            </div>
            {info.campaignNames.length ? (
              <div className="grid g2 sec" style={{ gap: 10 }}>
                <Kpi l="Assigned campaigns" v={info.campaignNames.length} />
                <Kpi l="Daily target" v={info.dailyTarget || 8} />
              </div>
            ) : (
              <Empty head="No calls assigned yet">You&apos;re all set. Your administrator hasn&apos;t assigned any interviews to you yet.</Empty>
            )}
            <Btn k="p" lg style={{ width: "100%", justifyContent: "center", marginTop: 6 }} onClick={goToWorkspace}>
              {info.campaignNames.length ? "Go to today's calls" : "Go to Agent Home"}
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}
