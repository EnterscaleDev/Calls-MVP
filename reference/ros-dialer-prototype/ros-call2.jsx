// Call workspace v2 — calls hand off to the dialer dock
const { useState: cS2 } = React;
function CallWorkspace2({ id, go, toast }) {
  const iv = INTERVIEWS.find(x => x.id === id) || myIvs()[0];
  const cb = MISSED.find(m => m.ref === iv.ref && !m.back);
  const c = campaignOf(iv.campaign);
  useStore();
  const mine = !!(DIAL.call && DIAL.call.iv === iv.id);
  const [attempted, setAttempted] = React.useState(mine);
  const state = mine ? (DIAL.phase === "wrap" ? "wrap" : DIAL.phase === "dialling" ? "dialling" : "live") : attempted ? "wrap" : "ready";
  const [, tickN] = React.useState(0);
  const sec = mine ? callSecs(DIAL.call) : 0;
  const dockLocked = DIAL.phase === "locked" || DIAL.phase === "check";
  const busy = !!DIAL.call && !mine;
  const [step, setStep] = React.useState(0);
  const [notes, setNotes] = React.useState("");
  const [outcome, setOutcome] = React.useState("");
  const [reTime, setReTime] = React.useState("");
  const [reDay, setReDay] = React.useState("Tomorrow");
  const [done, setDone] = React.useState([]);
  const [tries, setTries] = React.useState(iv.attempts || 0);
  React.useEffect(() => { if (state !== "live") return; const t = setInterval(() => tickN(n => n + 1), 1000); return () => clearInterval(t); }, [state]);
  React.useEffect(() => { if (mine && DIAL.phase === "wrap" && DIAL.call.rec === "Not reached" && !outcome) setOutcome("No answer"); }, [mine, DIAL.phase]);
  const start = () => { startDialCall({ agent: ME().id, number: iv.person.phone, campaign: iv.campaign, reason: cb ? "Callback" : "Scheduled interview", iv: iv.id, label: label(iv) }); setAttempted(true); setTries(t => t + 1); };
  const retry = () => { if (mine) saveDialCall(outcome || "No answer", notes, ME().name); setOutcome(""); start(); };
  const save = () => { if (mine) saveDialCall(outcome, notes, ME().name); toast("Outcome saved · " + outcome + (cb ? " · callback closed" : "")); go("home"); };

  const s = SCRIPT[step];
  const needsTime = outcome === "Reschedule requested";
  const canSubmit = (state === "wrap" || state === "live") && outcome && (!needsTime || reTime);
  const capped = tries >= c.attemptCap;
  const voiceOut = ACCOUNTS[1].balance <= 0;

  const go2 = (n) => { setDone(d => [...new Set([...d, step])]); setStep(n); };

  return (
    <div className="page">
      <div className="ws">
        <div className="stack">
          <div className="ws-live">
            <div className="row" style={{ marginBottom: 12 }}>
              <span className={"dot" + (state === "live" ? " live" : "")} />
              <span style={{ fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", fontWeight: 700, color: "rgba(255,255,255,.85)" }}>
                {state === "ready" ? "Ready to call" : state === "dialling" ? "Connecting…" : state === "live" ? (DIAL.call.hold ? "On hold" : "On call") : "Call ended"}
              </span>
              {state === "live" && <span style={{ marginLeft: "auto" }}><RecPill rec={DIAL.call.rec} hold={DIAL.call.hold} /></span>}
            </div>
            <div className="pid">{label(iv)}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.84)", marginTop: 3 }}>{c.name}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.84)" }}>Slot {iv.day} {iv.time} WAT</div>
            <div className="rule" style={{ background: "rgba(255,255,255,.14)", margin: "14px 0" }} />
            <div className="timer">{fmt(sec)}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,.8)", marginTop: 3, marginBottom: 14 }}>
              {state === "ready" ? "Calls run through your dialer" : state === "dialling" ? "Bridging both legs" : state === "live" ? "Mute, hold, transfer and flag are in the dialer" : "Duration logged"}
            </div>
            {state === "ready" && (dockLocked
              ? <Btn k="p" lg icon="lock" style={{ width: "100%", justifyContent: "center" }} onClick={() => commit(DIAL, { open: true })}>Unlock dialer to call</Btn>
              : <Btn k="p" lg icon="phone" disabled={capped || voiceOut || busy} style={{ width: "100%", justifyContent: "center" }} onClick={start}>{capped ? "Attempt cap reached" : voiceOut ? "No voice credit" : busy ? "Finish your current call" : "Start call"}</Btn>)}
            {state === "dialling" && <div className="btns"><Btn onClick={() => commit(DIAL, { open: true })}>Show dialer</Btn><Btn k="p" onClick={() => { noAnswerDialCall(); setOutcome("No answer"); }}>No answer</Btn></div>}
            {state === "live" && <div className="btns"><Btn k="p" icon="hang" onClick={() => endDialCall()}>End call</Btn><Btn onClick={() => commit(DIAL, { open: true })}>Dialer controls</Btn></div>}
            {state === "wrap" && <div className="btns"><Btn onClick={retry} disabled={capped}>Try again</Btn><span className="sm" style={{ color: "rgba(255,255,255,.86)", alignSelf: "center" }}>Attempt {tries} of {c.attemptCap}</span></div>}
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,.14)", display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: "rgba(255,255,255,.82)" }}>
              <Icon n="lock" size={12} />Number hidden — connected by the platform
            </div>
          </div>

          <Card pad>
            <div className="h2" style={{ marginBottom: 8 }}>Context</div>
            <dl className="kv">
              <dt>Reference</dt><dd className="mono">#{iv.ref}</dd>
              <dt>Segment</dt><dd>{iv.person.segment}</dd>
              <dt>Consented</dt><dd>{iv.consentAt}</dd>
              <dt>Previous attempts</dt><dd>{iv.attempts || "None"}</dd>
              <dt>Incentive</dt><dd>{c.incentive}</dd>
            </dl>
          </Card>

          <Card pad>
            <div className="spread"><span className="xs">Today</span><span className="xs mono">{ME().today.done}/{ME().target}</span></div>
            <div style={{ marginTop: 6 }}><Bar pct={pct(ME().today.done, ME().target)} tone="t" /></div>
          </Card>
        </div>

        <div className="stack">
          {cb && <Note tone="w" head={"Returning a call · they rang at " + cb.when.toLowerCase()}>{cb.reason}. Open with the callback line in the script, not the standard introduction — they made contact first. Saving an outcome here closes the callback.</Note>}
          <div className="scriptbox">
            <div className="sc-nav">
              {SCRIPT.map((x, i) => <button key={x.id} className={"sc-pip" + (i === step ? " on" : done.includes(i) ? " done" : "")} onClick={() => go2(i)} aria-label={x.title} />)}
              <span className="xs" style={{ marginLeft: "auto", whiteSpace: "nowrap" }}>Section {step + 1} of {SCRIPT.length} · {c.name.split(" ")[0]} script v3</span>
            </div>
            <div className="sc-body">
              <div className="eyebrow">{s.mins} minutes</div>
              <h3 style={{ marginTop: 4 }}>{s.title}</h3>
              <div className="sc-say">{s.say}</div>
              {s.cues.map((cu, i) => <div key={i} className="cue">{cu}</div>)}
            </div>
            <div className="row" style={{ padding: "12px 20px", borderTop: "1px solid var(--line-2)" }}>
              <Btn onClick={() => go2(Math.max(0, step - 1))} disabled={!step} icon="back">Previous</Btn>
              <span className="xs" style={{ marginLeft: "auto", marginRight: "auto" }}>Move at the participant's pace — sections do not have to be used in order</span>
              <Btn k="d" onClick={() => go2(Math.min(SCRIPT.length - 1, step + 1))} disabled={step === SCRIPT.length - 1}>Next section</Btn>
            </div>
          </div>

          <Card>
            <div className="card-h"><div className="h2">Notes</div><span className="xs" style={{ marginLeft: "auto" }}>Saved with the attempt, visible to admins</span></div>
            <div className="card-p">
              <textarea rows="4" value={notes} placeholder="What they said, in their words where you can." onChange={e => setNotes(e.target.value)} />
              {/\d{7,}/.test(notes.replace(/\s/g, "")) && <div style={{ marginTop: 8 }}><Note tone="r" head="That looks like a phone number">Do not record contact details in notes. The platform already holds them securely.</Note></div>}
            </div>
          </Card>

          <Card>
            <div className="card-h"><div className="h2">Call outcome</div><span className="xs" style={{ marginLeft: "auto" }}>{state === "ready" ? "Available once you have tried the call" : "Required before the next participant"}</span></div>
            <div className="card-p" style={state === "ready" ? { opacity: .5, pointerEvents: "none" } : null}>
              <div className="row wrap" style={{ gap: 7 }}>
                {OUTCOMES.map(o => (
                  <button key={o} className={"btn btn-s" + (outcome === o ? " btn-d" : "")} onClick={() => setOutcome(o)}>{o}</button>
                ))}
              </div>
              {needsTime && (
                <div style={{ marginTop: 14 }}>
                  <div className="field-l">New call time</div>
                  <div className="field-h">A reschedule cannot be saved without one.</div>
                  <div className="row wrap" style={{ gap: 8, marginTop: 6 }}>
                    <Sel v={reDay} set={setReDay} opts={["Tomorrow", "Wed 9 Sep", "Thu 10 Sep", "Fri 11 Sep"]} />
                    <Sel v={reTime} set={setReTime} opts={HOURS} all="Choose a time" />
                  </div>
                </div>
              )}
              <div className="rule" />
              {capped && <div style={{ marginBottom: 12 }}><Note tone="r" head="Attempt cap reached">This was attempt {tries} of {c.attemptCap}. Saving anything other than a completed or rescheduled outcome closes the interview as unreachable.</Note></div>}
              <div className="row">
                <span className="xs">{iv.attempts ? iv.attempts + " earlier attempt" + (iv.attempts > 1 ? "s are" : " is") + " kept — this adds to the history" : "This will be the first attempt on record"}</span>
                <div style={{ marginLeft: "auto" }} className="btns">
                  <Btn onClick={() => go("home")}>Back to queue</Btn>
                  <Btn k="p" disabled={!canSubmit} onClick={() => { if (state === "live") endDialCall(); save(); }}>Save and take next</Btn>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}


Object.assign(window, { CallWorkspace2 });
