"use client";

import { useState } from "react";
import type { AdminData } from "@/lib/hooks/useAdminData";
import { Modal, Btn, Field, Note } from "@/components/ros/ros-ui";

export function InviteAgentModal({
  open,
  close,
  db,
  toast,
}: {
  open: boolean;
  close: () => void;
  db: AdminData;
  toast: (m: string) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [camps, setCamps] = useState<string[]>([]);
  const [target, setTarget] = useState("8");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const toggle = (k: string) => setCamps((c) => (c.includes(k) ? c.filter((x) => x !== k) : [...c, k]));
  const reset = () => {
    setName("");
    setEmail("");
    setPhone("");
    setCamps([]);
    setTarget("8");
    setError("");
  };

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const dup =
    email && db.agents.some((a) => a.email.toLowerCase() === email.toLowerCase() && a.status === "active")
      ? "already an Agent"
      : email && db.agentInvitations.some((i) => i.email.toLowerCase() === email.toLowerCase() && i.status === "pending")
        ? "pending"
        : null;
  // Agents are called on this number first, so it has to be a real
  // international number — spaces/dashes are fine, they're stripped.
  const phoneClean = phone.replace(/[\s()-]/g, "");
  const phoneOk = /^\+\d{10,15}$/.test(phoneClean);
  const canSend = name.trim() && emailOk && phoneOk && !dup;

  async function send() {
    setSending(true);
    setError("");
    const response = await fetch("/api/agents/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        email: email.trim(),
        phone: phoneClean,
        campaignIds: camps,
        dailyTarget: camps.length ? Number(target) || 0 : 8,
      }),
    });
    const result = (await response.json().catch(() => ({ ok: false, errorReason: "Unexpected response." }))) as
      | { ok: true }
      | { ok: false; errorReason: string };
    setSending(false);
    if (!result.ok) {
      setError(result.errorReason);
      return;
    }
    toast("Invitation sent to " + email.trim());
    reset();
    close();
  }

  const first = name.trim().split(" ")[0];

  return (
    <Modal
      open={open}
      close={() => {
        reset();
        close();
      }}
      title="Invite Agent"
      foot={
        <>
          <Btn
            onClick={() => {
              reset();
              close();
            }}
          >
            Cancel
          </Btn>
          <Btn k="p" disabled={!canSend || sending} onClick={send}>
            {sending ? "Sending..." : "Send Invitation"}
          </Btn>
        </>
      }
    >
      {error ? (
        <div style={{ marginBottom: 12 }}>
          <Note tone="r">{error}</Note>
        </div>
      ) : null}
      <Field l="Full name">
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ada Okafor" />
      </Field>
      <Field l="Email address">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ada@example.com" />
      </Field>
      <Field l="Phone number" hint="The number we ring first when this Agent starts a call. Include the country code, e.g. +2348012345678.">
        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+2348012345678" />
      </Field>
      {dup ? (
        <div style={{ marginBottom: 12 }}>
          <Note tone="i">{dup === "already an Agent" ? (first || "This person") + " is already an Agent." : "An invitation is already pending for this email."}</Note>
        </div>
      ) : null}
      <Field l="Assign to campaigns" hint="Optional. Without one, the Agent can still accept and joins an empty workspace.">
        <div className="stack-s">
          {db.campaigns.map((c) => (
            <label key={c.id} className="row" style={{ fontSize: 12.5, cursor: "pointer" }}>
              <input
                type="checkbox"
                style={{ width: "auto", accentColor: "var(--o)" }}
                checked={camps.includes(c.id)}
                onChange={() => toggle(c.id)}
              />
              {c.name}
            </label>
          ))}
        </div>
      </Field>
      {!!camps.length && (
        <Field l="Daily call target" hint="Interviews expected per day.">
          <input type="number" value={target} onChange={(e) => setTarget(e.target.value)} />
        </Field>
      )}
      <div className="rule" />
      <div className="field-l" style={{ marginBottom: 6 }}>
        Summary
      </div>
      <div style={{ background: "#FBFAF9", border: "1px solid var(--line)", borderRadius: 6, padding: "10px 12px", fontSize: 12.5 }}>
        <div>
          Inviting: <b>{name || "—"}</b>
        </div>
        <div className="dim">{email || "—"}</div>
        <div className="dim">{phoneClean || "—"}</div>
        <div style={{ marginTop: 6 }}>
          Campaigns: {camps.length ? camps.map((k) => db.campaigns.find((c) => c.id === k)?.name).join(", ") : "None yet"}
        </div>
        {!!camps.length && <div>Daily target: {target || 0} interviews</div>}
      </div>
    </Modal>
  );
}
