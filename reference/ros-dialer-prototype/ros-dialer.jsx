// Dialer dock — persistent on every agent page
const { useState: dS, useEffect: dE } = React;
Object.assign(IC, {
  micoff: "M8 2.2a1.9 1.9 0 011.9 1.9v4a1.9 1.9 0 11-3.8 0v-4A1.9 1.9 0 018 2.2zM3.6 7.6a4.4 4.4 0 008.8 0M8 12v2.2M2.4 2.4l11.2 11.2",
  pause: "M5.4 3v10M10.6 3v10",
  keys: "M3.2 3.2h1.6v1.6H3.2zM7.2 3.2h1.6v1.6H7.2zM11.2 3.2h1.6v1.6h-1.6zM3.2 7.2h1.6v1.6H3.2zM7.2 7.2h1.6v1.6H7.2zM11.2 7.2h1.6v1.6h-1.6zM3.2 11.2h1.6v1.6H3.2zM7.2 11.2h1.6v1.6H7.2zM11.2 11.2h1.6v1.6h-1.6z",
  flag: "M3.4 14.2V2.2M3.4 2.8h8.8l-2 3.1 2 3.1H3.4",
  del: "M5.6 3.4h8v9.2h-8L2 8zM8.2 6.2l3.2 3.6M11.4 6.2L8.2 9.8",
  min: "M3.5 8h9",
  eye: "M1.6 8S4 3.6 8 3.6 14.4 8 14.4 8 12 12.4 8 12.4 1.6 8 1.6 8zM8 10a2 2 0 100-4 2 2 0 000 4z",
  hang: "M1.8 9.6c3.6-3.2 8.8-3.2 12.4 0l-1.6 2-2.6-1V8.8a7.6 7.6 0 00-4 0v1.8l-2.6 1z",
});

const KEYS = [["1", ""], ["2", "ABC"], ["3", "DEF"], ["4", "GHI"], ["5", "JKL"], ["6", "MNO"], ["7", "PQRS"], ["8", "TUV"], ["9", "WXYZ"], ["*", ""], ["0", "+"], ["#", ""]];
const Net = ({ q = 3, dark }) => <span className={"dk-net" + (dark ? " dark" : "")} title={["", "Poor", "Fair", "Good", "Excellent"][q] + " connection"}>{[1, 2, 3, 4].map(i => <i key={i} className={i <= q ? "on" : ""} style={{ height: 3 + i * 2.5 }} />)}</span>;
const RecPill = ({ rec, hold }) => rec === "Recorded"
  ? <span className={"dk-rec" + (hold ? " paused" : "")}><span className="rd" />{hold ? "Recording paused" : "Recording"}</span>
  : <span className="dk-rec off">Not recording</span>;

function DialerDock({ toast, go }) {
  useStore();
  const me = meAgent();
  const [tab, setTab] = dS("Keypad");
  const [pin, setPin] = dS(""); const [err, setErr] = dS("");
  const [lvl, setLvl] = dS(0); const [heard, setHeard] = dS(false); const [tone, setTone] = dS(false);
  const [num, setNum] = dS(""); const [camp, setCamp] = dS(""); const [why, setWhy] = dS("");
  const [ok, setOk] = dS(false);
  const [pad, setPad] = dS(false); const [dtmf, setDtmf] = dS("");
  const [xfer, setXfer] = dS(null); const [flagOpen, setFlagOpen] = dS(false); const [fr, setFr] = dS(""); const [fn, setFn] = dS("");
  const [outcome, setOutcome] = dS(""); const [notes, setNotes] = dS("");
  const [playing, setPlaying] = dS(null);
  const [, tick] = dS(0);
  const c = DIAL.call, ph = DIAL.phase;
  const counting = c && c.t0 && (ph === "consent" || ph === "live");

  dE(() => { if (!counting) return; const t = setInterval(() => tick(n => n + 1), 1000); return () => clearInterval(t); }, [counting]);
  dE(() => { if (ph !== "check") return; const t = setInterval(() => setLvl(18 + Math.random() * 70), 140); return () => clearInterval(t); }, [ph]);
  dE(() => { if (ph !== "dialling") return; const t = setTimeout(() => { commit(DIAL.call, { t0: Date.now(), rec: "Recorded" }); callEv("Connected"); callEv("Recording started — consent on file from booking"); commit(DIAL, { phase: "live" }); }, 2600); return () => clearTimeout(t); }, [ph]);

  if (!me) return null;
  const secs = callSecs(c);
  const open = (v) => commit(DIAL, { open: v });
  const cap = camp ? (campaignOf(camp).attemptCap || DEFAULT_CAP) : DEFAULT_CAP;
  const tries = validNum(num) ? attemptsToday(num) : 0;
  const capped = tries >= cap;
  const voiceOut = ACCOUNTS[1].balance <= 0;
  const canDial = validNum(num) && camp && why && !capped && !voiceOut;
  const mine = DIAL_CALLS.filter(x => x.agent === me.id);

  const verify = () => {
    if (pin === "0000") { const f = DIAL.fails + 1; commit(DIAL, { fails: f }); setErr(f >= 5 ? "Dialer locked. An admin has been alerted." : "That code did not match. " + (5 - f) + " attempts left."); audit(me.name, "Agent", "Dialer verification failed", "Shift PIN", null, "r"); setPin(""); return; }
    commit(DIAL, { phase: "check", verifiedAt: hm(), fails: 0 }); setErr(""); setPin("");
    audit(me.name, "Agent", "Shift verified — dialer unlocked", "Shift PIN", null);
  };
  const passCheck = () => { commit(DIAL, { phase: "idle", device: "USB headset · mic and speaker passed" }); audit(me.name, "Agent", "Device check passed", "USB headset", null); };
  const endShift = () => { commit(DIAL, { phase: "locked", verifiedAt: null, device: null }); setHeard(false); audit(me.name, "Agent", "Shift ended — dialer locked", "—", null); toast("Shift ended · dialer locked"); };
  const dial = () => {
    startDialCall({ agent: me.id, number: num, campaign: camp, reason: why }); setOutcome(""); setNotes(""); setTab("Keypad");
  };
  const toggle = (k, on, off) => { const v = !c[k]; commit(c, { [k]: v }); callEv(v ? on : off); };
  const hold = () => { const v = !c.hold; commit(c, { hold: v }); callEv(v ? "Placed on hold" + (c.rec === "Recorded" ? " — recording paused" : "") : "Resumed" + (c.rec === "Recorded" ? " — recording resumed" : "")); };
  const end = (why2) => { endDialCall(why2); setPad(false); setXfer(null); setFlagOpen(false); };
  const noAnswer = () => { noAnswerDialCall(); setOutcome("No answer"); };
  const save = () => {
    saveDialCall(outcome, notes, me.name); setNum(""); toast("Call logged · " + outcome);
  };
  const play = (x) => { setPlaying(playing === x.id ? null : x.id); if (playing !== x.id) { logAccess(me.name, "Agent · own call", "Recording played", x.id); toast("Playback logged against your account"); } };

  // minimised
  if (!DIAL.open) {
    const live = ph === "consent" || ph === "live";
    return (
      <button className={"dk-pill" + (live ? " live" : ph === "wrap" ? " warn" : "")} onClick={() => open(true)}>
        {live ? <><span className="dot live" /><span className="mono">{mmss(secs)}</span><span className="dk-sep" />{c.hold ? "On hold" : c.rec === "Recorded" ? "Recording" : "Not recording"}</>
          : ph === "dialling" ? <><span className="dot" />Calling {c.label || maskNum(c.number)}</>
            : ph === "wrap" ? <><Icon n="alert" size={13} />Outcome needed</>
              : ph === "locked" ? <><Icon n="lock" size={13} />Dialer · start shift</>
                : ph === "check" ? <><Icon n="mic" size={13} />Dialer · device check</>
                  : <><Icon n="phone" size={13} />Dialer</>}
      </button>
    );
  }

  const Head = ({ children }) => (
    <div className="dk-h">
      <div style={{ minWidth: 0 }}>{children}</div>
      <button className="dk-x" onClick={() => open(false)} aria-label="Minimise dialer"><Icon n="min" size={14} /></button>
    </div>
  );

  let body;
  if (ph === "locked") body = <>
    <Head><div className="dk-t">Dialer</div><div className="dk-s">Locked until you verify this shift</div></Head>
    <div className="dk-b">
      <div className="h2">Confirm it's you</div>
      <p className="sm mut" style={{ margin: "4px 0 12px" }}>Enter your 4-digit shift PIN. The dialer locks again when you end your shift.</p>
      <input className="dk-pin" inputMode="numeric" autoComplete="one-time-code" maxLength={4} value={pin} placeholder="••••" disabled={DIAL.fails >= 5} onChange={e => setPin(e.target.value.replace(/\D/g, ""))} onKeyDown={e => e.key === "Enter" && pin.length === 4 && verify()} />
      {err && <div style={{ marginTop: 10 }}><Note tone="r">{err}</Note></div>}
      <Btn k="p" lg disabled={pin.length < 4 || DIAL.fails >= 5} style={{ width: "100%", justifyContent: "center", marginTop: 12 }} onClick={verify}>Verify and continue</Btn>
      <div className="xs" style={{ marginTop: 10 }}>Every attempt is logged. Five failed attempts lock the dialer and alert an admin.</div>
    </div>
  </>;
  else if (ph === "check") body = <>
    <Head><div className="dk-t">Device check</div><div className="dk-s">Shift verified at {DIAL.verifiedAt}</div></Head>
    <div className="dk-b stack" style={{ gap: 14 }}>
      <div><div className="spread"><span className="field-l">Microphone</span><span className="xs">USB headset</span></div><div className="dk-meter"><i style={{ width: lvl + "%" }} /></div><div className="xs" style={{ marginTop: 4 }}>Say something. The bar should move.</div></div>
      <div><div className="spread"><span className="field-l">Speaker</span>{heard && <Chip tone="g">Passed</Chip>}</div>
        <div className="btns" style={{ marginTop: 4 }}><Btn sm icon="play" onClick={() => { setTone(true); setTimeout(() => setTone(false), 1200); }}>{tone ? "Playing…" : "Play test sound"}</Btn><Btn sm k={heard ? "d" : ""} icon="check" onClick={() => setHeard(true)}>I heard it</Btn></div></div>
      <div className="spread"><span className="field-l" style={{ margin: 0 }}>Connection</span><span className="row" style={{ gap: 8 }}><span className="xs">Good · 42 ms</span><Net q={3} /></span></div>
      <Btn k="p" lg disabled={!heard} style={{ width: "100%", justifyContent: "center" }} onClick={passCheck}>Start dialling</Btn>
    </div>
  </>;
  else if (ph === "idle") body = <>
    <Head><div className="dk-t">Dialer</div><div className="dk-s">Verified {DIAL.verifiedAt} · <button className="dk-link" onClick={endShift}>End shift</button></div></Head>
    <div className="dk-tabs">{["Keypad", "Recent"].map(t => <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{t}{t === "Recent" && <span className="n">{mine.length}</span>}</button>)}</div>
    {tab === "Keypad" ? <div className="dk-b">
      <div className="dk-num">
        <input type="tel" value={fmtNum(num)} placeholder="Enter a number" onChange={e => setNum(e.target.value.replace(/[^\d+]/g, ""))} onKeyDown={e => e.key === "Enter" && canDial && dial()} aria-label="Number to dial" />
        {num && <button className="dk-x ink" onClick={() => setNum(num.slice(0, -1))} aria-label="Delete digit"><Icon n="del" size={16} /></button>}
      </div>
      <div className="dk-pad">{KEYS.map(([k, s]) => <button key={k} className="dk-key" onClick={() => setNum(n => (n + k).slice(0, 16))}>{k}<small>{s || "\u00a0"}</small></button>)}</div>
      <div className="stack" style={{ gap: 8, marginTop: 12 }}>
        <Sel v={camp} set={setCamp} opts={me.campaigns.map(k => ({ v: k, l: campaignOf(k).name }))} all="Campaign (required)" />
        <Sel v={why} set={setWhy} opts={DIAL_REASONS} all="Reason for call (required)" />
      </div>
      {validNum(num) && <div className="spread" style={{ marginTop: 10 }}><span className="xs">Attempts to this number today</span><span className={"xs mono" + (capped ? " dk-bad" : "")}>{tries} of {cap}</span></div>}
      {capped && <div style={{ marginTop: 8 }}><Note tone="r" head="Attempt cap reached">This number has been tried {tries} times today. Ask an admin if another attempt is needed.</Note></div>}
      <Btn k="p" lg icon="phone" disabled={!canDial} style={{ width: "100%", justifyContent: "center", marginTop: 12 }} onClick={dial}>{voiceOut ? "No voice credit" : "Call"}</Btn>
      <div className="dk-foot"><Icon n="shield" size={12} />Logged with your name, the number, time and reason</div>
    </div> : <div className="dk-b" style={{ padding: 0 }}>
      {mine.map(x => (
        <div key={x.id} className="dk-rc">
          <div className="spread"><span className="mono" style={{ fontWeight: 600, fontSize: 12.5 }}>{x.label || maskNum(x.number)}</span><span className="xs">{x.started}</span></div>
          <div className="spread" style={{ marginTop: 4 }}>
            <span className="row" style={{ gap: 6 }}><Chip>{x.outcome}</Chip><span className="xs mono">{x.duration}</span></span>
            <span className="row" style={{ gap: 6 }}>
              {x.recording === "Recorded" && <Btn sm icon={playing === x.id ? "pause" : "play"} onClick={() => play(x)}>{playing === x.id ? "Stop" : "Play"}</Btn>}
              {!x.iv && <Btn sm icon="phone" onClick={() => { setNum(x.number); setCamp(x.campaign); setWhy(x.reason); setTab("Keypad"); }}>Redial</Btn>}
            </span>
          </div>
          {playing === x.id && <div className="dk-player"><div className="bar"><i style={{ width: "12%" }} /></div><span className="xs mono">0:{String(Math.min(59, 8)).padStart(2, "0")} / {x.duration}</span></div>}
        </div>
      ))}
      <div className="dk-foot" style={{ padding: "10px 16px" }}><Icon n="lock" size={12} />You can replay your own recordings. Each play is logged. Downloads are not available.</div>
    </div>}
  </>;
  else {
    const live = ph === "live";
    body = <>
      <div className="dk-live">
        <div className="spread">
          <span className="row" style={{ gap: 7 }}><span className={"dot" + (ph === "consent" || live ? " live" : "")} /><span className="dk-state">{ph === "dialling" ? "Calling…" : ph === "wrap" ? "Call ended" : c.hold ? "On hold" : "On call"}</span></span>
          <span className="row" style={{ gap: 10 }}>{ph !== "wrap" && ph !== "dialling" && <Net q={3} dark />}<button className="dk-x" onClick={() => open(false)} aria-label="Minimise dialer"><Icon n="min" size={14} /></button></span>
        </div>
        <div className="dk-who mono">{c.label || fmtNum(c.number)}</div>
        {c.label && <div className="dk-s row" style={{ gap: 6 }}><Icon n="lock" size={11} />Number hidden · connected by the platform</div>}
        <div className="dk-s">{campaignOf(c.campaign).name} · {c.reason}</div>
        <div className="spread" style={{ marginTop: 12, alignItems: "flex-end" }}>
          <div className="timer" style={{ fontSize: 30 }}>{mmss(secs)}</div>
          {ph !== "dialling" && <RecPill rec={c.rec} hold={c.hold} />}
        </div>
        {DIAL.monitored && ph !== "wrap" && <div className="dk-mon"><Icon n="eye" size={12} />{DIAL.monitored} is listening</div>}
      </div>

      {ph === "dialling" && <div className="dk-b"><div className="btns"><Btn style={{ flex: 1, justifyContent: "center" }} onClick={() => { callEv("Cancelled before connect"); commit(DIAL, { phase: "idle", call: null }); }}>Cancel</Btn><Btn k="d" style={{ flex: 1, justifyContent: "center" }} onClick={noAnswer}>No answer</Btn></div></div>}

      {live && !xfer && !flagOpen && <div className="dk-b">
        {pad ? <>
          <div className="spread"><span className="field-l" style={{ margin: 0 }}>Keypad tones</span><button className="dk-link" onClick={() => setPad(false)}>Hide</button></div>
          <div className="dk-dtmf mono">{dtmf || "\u00a0"}</div>
          <div className="dk-pad">{KEYS.map(([k, s]) => <button key={k} className="dk-key" onClick={() => { setDtmf(d => (d + k).slice(-14)); callEv("Keypad tone sent (digit not stored)"); }}>{k}<small>{s || "\u00a0"}</small></button>)}</div>
        </> : <div className="dk-ctl">
          <button className={c.muted ? "on" : ""} onClick={() => toggle("muted", "Agent muted", "Agent unmuted")}><Icon n={c.muted ? "micoff" : "mic"} size={17} />{c.muted ? "Unmute" : "Mute"}</button>
          <button className={c.hold ? "on" : ""} onClick={hold}><Icon n="pause" size={17} />{c.hold ? "Resume" : "Hold"}</button>
          <button onClick={() => { setDtmf(""); setPad(true); }}><Icon n="keys" size={17} />Keypad</button>
          <button onClick={() => setXfer("pick")}><Icon n="split" size={17} />Transfer</button>
          <button className={c.flag ? "flagged" : ""} onClick={() => { setFr(c.flag ? c.flag.reason : ""); setFn(c.flag ? c.flag.note : ""); setFlagOpen(true); }}><Icon n="flag" size={17} />{c.flag ? "Flagged" : "Flag"}</button>
          <button className="end" onClick={() => end()}><Icon n="hang" size={17} />End</button>
        </div>}
        {c.flag && !pad && <div className="xs" style={{ marginTop: 10 }}>Flagged: {c.flag.reason}. An admin will review the recording.</div>}
      </div>}

      {live && xfer === "pick" && <div className="dk-b">
        <div className="h2">Warm transfer</div>
        <p className="xs" style={{ margin: "3px 0 10px" }}>The participant goes on hold while you brief the supervisor.</p>
        <div className="stack" style={{ gap: 6 }}>{SUPERVISORS.map(s => (
          <button key={s.id} className="dk-sv" disabled={!s.avail} onClick={() => { if (!c.hold) hold(); callEv("Warm transfer started — " + s.name); setXfer(s); }}>
            <Av t={s.name.split(" ").map(w => w[0]).join("")} size={26} tone={s.avail ? "" : "g"} /><span style={{ flex: 1, textAlign: "left" }}><b>{s.name}</b><span className="xs" style={{ display: "block" }}>{s.role}</span></span><Chip tone={s.avail ? "g" : "q"}>{s.avail ? "Available" : "On a call"}</Chip>
          </button>))}</div>
        <Btn style={{ width: "100%", justifyContent: "center", marginTop: 10 }} onClick={() => setXfer(null)}>Back to call</Btn>
      </div>}
      {live && xfer && xfer.id && <div className="dk-b">
        <Note tone="i" head={"Speaking to " + xfer.name}>The participant is on hold and cannot hear you. Brief {xfer.name.split(" ")[0]}, then complete the transfer.</Note>
        <div className="btns" style={{ marginTop: 12 }}>
          <Btn style={{ flex: 1, justifyContent: "center" }} onClick={() => { callEv("Transfer cancelled — back to participant"); hold(); setXfer(null); }}>Back to participant</Btn>
          <Btn k="p" style={{ flex: 1, justifyContent: "center" }} onClick={() => { commit(c, { transfer: xfer.name, hold: false }); end("Transfer completed — " + xfer.name + " took the call"); }}>Complete transfer</Btn>
        </div>
      </div>}
      {live && flagOpen && <div className="dk-b">
        <div className="h2">Flag for review</div>
        <p className="xs" style={{ margin: "3px 0 10px" }}>The call carries on. Admins see the flag on the call record.</p>
        <div className="row wrap" style={{ gap: 6 }}>{FLAG_REASONS.map(r => <button key={r} className={"btn btn-s" + (fr === r ? " btn-d" : "")} onClick={() => setFr(r)}>{r}</button>)}</div>
        <textarea rows="2" style={{ marginTop: 10 }} placeholder="What happened (optional)" value={fn} onChange={e => setFn(e.target.value)} />
        <div className="btns" style={{ marginTop: 10 }}><Btn style={{ flex: 1, justifyContent: "center" }} onClick={() => setFlagOpen(false)}>Cancel</Btn><Btn k="d" style={{ flex: 1, justifyContent: "center" }} disabled={!fr} onClick={() => { commit(c, { flag: { reason: fr, note: fn } }); callEv("Flagged for review — " + fr); setFlagOpen(false); toast("Call flagged for review"); }}>Save flag</Btn></div>
      </div>}

      {ph === "wrap" && c.iv && <div className="dk-b">
        <Note tone="i" head="Save the outcome in the call workspace">This was a scheduled interview. The outcome, notes and script progress are saved together on the workspace.</Note>
        {go && <Btn k="p" lg style={{ width: "100%", justifyContent: "center", marginTop: 12 }} onClick={() => { go("call", c.iv); open(false); }}>Open call workspace</Btn>}
      </div>}
      {ph === "wrap" && !c.iv && <div className="dk-b">
        <div className="field-l">Outcome</div>
        <Sel v={outcome} set={setOutcome} opts={OUTCOMES} all="Choose an outcome" />
        <div className="field-l" style={{ marginTop: 10 }}>Notes</div>
        <textarea rows="3" placeholder="What they said, in their words where you can." value={notes} onChange={e => setNotes(e.target.value)} />
        {/\d{7,}/.test(notes.replace(/\s/g, "")) && <div style={{ marginTop: 8 }}><Note tone="r" head="That looks like a phone number">Do not put contact details in notes.</Note></div>}
        <dl className="kv" style={{ marginTop: 10 }}><dt>Recording</dt><dd>{c.rec === "Recorded" ? "Saved" : "None"}</dd>{c.transfer && <><dt>Transferred</dt><dd>{c.transfer}</dd></>}{c.flag && <><dt>Flag</dt><dd>{c.flag.reason}</dd></>}</dl>
        <Btn k="p" lg disabled={!outcome} style={{ width: "100%", justifyContent: "center", marginTop: 12 }} onClick={save}>Save and close call</Btn>
        <div className="xs" style={{ marginTop: 8 }}>You need to save an outcome before your next call.</div>
      </div>}
    </>;
  }
  return <div className="dk" role="dialog" aria-label="Dialer">{body}</div>;
}

Object.assign(window, { DialerDock, Net, RecPill });
