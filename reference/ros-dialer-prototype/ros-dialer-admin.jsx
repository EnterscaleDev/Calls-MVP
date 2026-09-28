// Admin — dialer calls, live monitor, access log, export
const { useState: xS, useEffect: xE } = React;

const recTone = { Recorded: "g", "Not reached": "q" };

function CallDetail({ call, close, toast }) {
  const [playing, setPlaying] = xS(false);
  const [shown, setShown] = xS(false);
  xE(() => { setPlaying(false); setShown(false); }, [call && call.id]);
  if (!call) return null;
  const acc = ACCESS_LOG.filter(a => a.call === call.id);
  return (
    <Modal open wide close={close} title={"Call " + call.id.toUpperCase() + " · " + agentOf(call.agent).name}
      foot={<><Btn onClick={close}>Close</Btn>{call.recording === "Recorded" && <Btn icon="dl" onClick={() => { logAccess("Toni Dada", "Admin", "Download requested", call.id); audit("Toni Dada", "Admin", "Recording download requested", call.id.toUpperCase(), call.campaign, "a"); toast("Download request logged"); }}>Request download</Btn>}</>}>
      <div className="grid g2" style={{ gap: 20, alignItems: "start" }}>
        <div>
          <dl className="kv">
            <dt>Number</dt><dd className="mono">{shown ? fmtNum(call.number) : maskNum(call.number)} {!shown && <button className="dk-link" onClick={() => { setShown(true); logAccess("Toni Dada", "Admin", "Number revealed", call.id); audit("Toni Dada", "Admin", "Dialled number revealed", call.id.toUpperCase(), call.campaign, "a"); }}>Reveal</button>}</dd>
            <dt>Agent</dt><dd>{agentOf(call.agent).name}</dd>
            <dt>Campaign</dt><dd>{campaignOf(call.campaign).name}</dd>
            <dt>Reason</dt><dd>{call.reason}</dd>
            <dt>Started</dt><dd>{call.started}</dd>
            <dt>Duration</dt><dd className="mono">{call.duration}</dd>
            <dt>Outcome</dt><dd><Chip>{call.outcome}</Chip></dd>
            <dt>Recording</dt><dd><Chip tone={recTone[call.recording]}>{call.recording}</Chip></dd>
            {call.transfer && <><dt>Transferred to</dt><dd>{call.transfer}</dd></>}
          </dl>
          {call.flag && <div style={{ marginTop: 12 }}><Note tone="w" head={"Flagged · " + call.flag.reason}>{call.flag.note || "No note added."}</Note></div>}
          {call.notes && <><div className="rule" /><div className="field-l">Agent notes</div><div className="sm">{call.notes}</div></>}
          {call.recording === "Recorded" && <>
            <div className="rule" />
            <div style={{ background: "var(--navy)", borderRadius: 6, padding: 14, color: "#fff" }}>
              <div className="row"><Btn k="p" sm icon={playing ? "pause" : "play"} onClick={() => { if (!playing) { logAccess("Toni Dada", "Admin", "Recording played", call.id); audit("Toni Dada", "Admin", "Recording accessed", call.id.toUpperCase(), call.campaign, "a"); } setPlaying(!playing); }}>{playing ? "Pause" : "Play"}</Btn><div style={{ flex: 1, height: 4, background: "rgba(255,255,255,.3)", borderRadius: 2 }}><div style={{ width: playing ? "18%" : "0%", height: "100%", background: "var(--o)", borderRadius: 2, transition: "width .6s" }} /></div><span className="mono" style={{ fontSize: 12 }}>0:00 / {call.duration}</span></div>
            </div>
            <div className="xs" style={{ marginTop: 6 }}>Signed link, expires in five minutes. Each play is written to the access log.</div>
          </>}
        </div>
        <div>
          <div className="field-l">Event timeline</div>
          <div className="tl">{call.events.map((e, i) => <div key={i} className={"tl-i" + (/Flag|cap|failed/i.test(e.e) ? " w" : /Recording started|Connected/.test(e.e) ? " g" : "")}><span className="mono xs">{e.t}</span><div className="sm">{e.e}</div></div>)}</div>
          <div className="field-l" style={{ marginTop: 14 }}>Who has accessed this call</div>
          {acc.length ? acc.map((a, i) => <div key={i} className="spread sm" style={{ padding: "5px 0", borderBottom: "1px solid var(--line-2)" }}><span>{a.who} <span className="xs">· {a.role}</span></span><span className="xs">{a.action} · {a.when}</span></div>) : <div className="xs">Nobody yet.</div>}
        </div>
      </div>
    </Modal>
  );
}

function ListenModal({ l, close, toast }) {
  const [on, setOn] = xS(false);
  const [, t] = xS(0);
  xE(() => { const i = setInterval(() => t(n => n + 1), 1000); return () => clearInterval(i); }, []);
  if (!l) return null;
  const stop = () => { if (on) { if (l.local) commit(DIAL, { monitored: null }); audit("Toni Dada", "Admin", "Stopped listening", agentOf(l.agent).name, l.campaign); } close(); };
  return (
    <Modal open close={stop} title={"Live · " + agentOf(l.agent).name}
      foot={<><Btn onClick={stop}>{on ? "Stop listening" : "Close"}</Btn>{!on && <Btn k="p" icon="eye" onClick={() => { setOn(true); if (l.local) commit(DIAL, { monitored: "Toni Dada" }); logAccess("Toni Dada", "Admin", "Listened live", l.id); audit("Toni Dada", "Admin", "Listened to live call", agentOf(l.agent).name, l.campaign, "a"); toast("Listening · logged"); }}>Start listening</Btn>}</>}>
      <div style={{ background: "var(--navy)", borderRadius: 6, padding: 16, color: "#fff" }}>
        <div className="spread"><span className="row" style={{ gap: 7 }}><span className="dot live" /><span className="dk-state">{l.hold ? "On hold" : "On call"}</span></span><Net q={3} dark /></div>
        <div className="dk-who mono" style={{ marginTop: 8 }}>{maskNum(l.number)}</div>
        <div className="dk-s">{campaignOf(l.campaign).name} · {l.reason}</div>
        <div className="spread" style={{ marginTop: 10, alignItems: "flex-end" }}><div className="timer" style={{ fontSize: 28 }}>{mmss(l.secs())}</div><RecPill rec={l.rec} hold={l.hold} /></div>
        {on && <div className="dk-meter dark" style={{ marginTop: 12 }}><i style={{ width: (25 + Math.random() * 60) + "%" }} /></div>}
      </div>
      <div style={{ height: 12 }} />
      <Note tone="i" head="Listen-only">You cannot be heard by either side. The agent sees that you are listening, and this session is written to the access log.</Note>
    </Modal>
  );
}

function AdminDialer({ toast }) {
  useStore();
  const [tab, setTab] = xS("Call log");
  const [ag, setAg] = xS(""); const [camp, setCamp] = xS(""); const [rec, setRec] = xS(""); const [q, setQ] = xS("");
  const [open, setOpen] = xS(null); const [listen, setListen] = xS(null);
  const [, t] = xS(0);
  xE(() => { const i = setInterval(() => t(n => n + 1), 1000); return () => clearInterval(i); }, []);

  const live = [
    ...(DIAL.call && DIAL.phase === "live" ? [{ ...DIAL.call, id: DIAL.call.id, local: true, rec: DIAL.call.rec, secs: () => Math.floor((Date.now() - DIAL.call.t0) / 1000) }] : []),
    ...LIVE_SEED.map(l => ({ ...l, secs: () => l.secs + Math.floor((Date.now() - LIVE_T0) / 1000) })),
  ];
  const flagged = DIAL_CALLS.filter(c => c.flag);
  const rows = (tab === "Flagged" ? flagged : DIAL_CALLS).filter(c => (!ag || c.agent === ag) && (!camp || c.campaign === camp) && (!rec || c.recording === rec) && (!q || c.number.includes(q.replace(/\D/g, "").slice(-4)) || c.id.includes(q.toLowerCase())));
  const today = DIAL_CALLS.filter(c => c.started.startsWith("Today"));
  const connected = today.filter(c => c.recording !== "Not reached");

  const exportCsv = () => {
    const head = ["call_id", "agent", "number_masked", "campaign", "reason", "started", "duration", "recording", "outcome", "flag", "transferred_to", "event_time", "event"];
    const lines = [head.join(",")];
    rows.forEach(c => c.events.forEach(e => lines.push([c.id, agentOf(c.agent).name, maskNum(c.number), campaignOf(c.campaign).name, c.reason, c.started, c.duration, c.recording, c.outcome, c.flag ? c.flag.reason : "", c.transfer || "", e.t, e.e].map(v => '"' + String(v).replace(/"/g, '""') + '"').join(","))));
    ACCESS_LOG.forEach(a => lines.push(['"' + a.call + '"', '"' + a.who + '"', "", "", "", '"' + a.when + '"', "", "", "", "", "", "", '"ACCESS: ' + a.action + " (" + a.role + ')"'].join(",")));
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "dialer-audit-trail.csv"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    audit("Toni Dada", "Admin", "Dialer audit trail exported", rows.length + " calls", null, "a"); toast("Export downloaded · logged");
  };

  return (
    <div className="page">
      <div className="grid g4 sec">
        <Kpi hero l="Live now" v={live.length} d={live.length ? "Open the Live tab to listen in" : "No calls in progress"} />
        <Kpi l="Calls today" v={today.length} d={connected.length + " connected"} />
        <Kpi l="Recorded" v={connected.length ? Math.round(connected.filter(c => c.recording === "Recorded").length / connected.length * 100) : 0} unit="%" d="Of connected calls" />
        <Kpi l="Flagged" v={flagged.length} d={flagged.length ? "Waiting for review" : "Nothing flagged"} />
      </div>
      <Tabs items={[{ id: "Live", n: live.length }, { id: "Call log", n: DIAL_CALLS.length }, { id: "Flagged", n: flagged.length }, { id: "Access log", n: ACCESS_LOG.length }]} on={tab} set={setTab} />

      {tab === "Live" && (live.length ? <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))" }}>{live.map(l => (
        <Card key={l.id} pad>
          <div className="spread"><span className="row" style={{ gap: 8 }}><Av t={agentOf(l.agent).initials} size={28} /><b className="sm">{agentOf(l.agent).name}</b></span><span className="row" style={{ gap: 6 }}><span className="dot live" /><span className="mono sm">{mmss(l.secs())}</span></span></div>
          <div className="mono" style={{ marginTop: 10, fontWeight: 600, whiteSpace: "nowrap" }}>{maskNum(l.number)}</div>
          <div className="xs">{campaignOf(l.campaign).name} · {l.reason}</div>
          <div className="spread wrap" style={{ marginTop: 12 }}><Chip tone="g">{l.rec}</Chip><Btn sm icon="eye" onClick={() => setListen(l)}>Listen in</Btn></div>
        </Card>
      ))}</div> : <Card><Empty head="No calls in progress">Live calls appear here the moment they connect.</Empty></Card>)}

      {(tab === "Call log" || tab === "Flagged") && <>
        <div className="filters">
          <Search v={q} set={setQ} ph="Last 4 digits or call ID" />
          <Sel v={ag} set={setAg} opts={AGENTS.map(a => ({ v: a.id, l: a.name }))} all="All agents" />
          <Sel v={camp} set={setCamp} opts={CAMPAIGNS.filter(c => c.type === "interview").map(c => ({ v: c.id, l: c.name }))} all="All campaigns" />
          <Sel v={rec} set={setRec} opts={["Recorded", "Not reached"]} all="Any recording state" />
          <div style={{ marginLeft: "auto" }}><Btn sm icon="dl" disabled={!rows.length} onClick={exportCsv}>Export audit trail ({rows.length})</Btn></div>
        </div>
        <Table scroll head={["Started", "Agent", "Number", "Campaign", "Reason", { l: "Duration", num: true }, "Recording", "Outcome", ""]}>
          {rows.map(c => (
            <tr key={c.id} className="tap" onClick={() => setOpen(c)}>
              <td className="dim" style={{ whiteSpace: "nowrap" }}>{c.started}</td>
              <td className="prim" style={{ whiteSpace: "nowrap" }}>{agentOf(c.agent).name}</td>
              <td className="mono" style={{ whiteSpace: "nowrap" }}>{maskNum(c.number)}</td>
              <td className="dim">{campaignOf(c.campaign).name}</td>
              <td className="dim">{c.reason}</td>
              <td className="num mono">{c.duration}</td>
              <td><Chip tone={recTone[c.recording]}>{c.recording}</Chip></td>
              <td><span className="row" style={{ gap: 6 }}><Chip>{c.outcome}</Chip>{c.flag && <Chip tone="w">Flagged</Chip>}</span></td>
              <td className="act"><Btn sm onClick={e => { e.stopPropagation(); setOpen(c); }}>Open</Btn></td>
            </tr>
          ))}
        </Table>
        {!rows.length && <Card style={{ marginTop: 14 }}><Empty head="No calls match">Try a different filter.</Empty></Card>}
        <div style={{ height: 14 }} />
        <Note tone="i">Numbers are masked everywhere by default. Revealing one, playing a recording or listening live is logged against your account.</Note>
      </>}

      {tab === "Access log" && <>
        <div className="filters"><span className="xs">Every recording play, download request, number reveal and live listen. Entries cannot be edited or deleted.</span><div style={{ marginLeft: "auto" }}><Btn sm icon="dl" onClick={exportCsv}>Export audit trail</Btn></div></div>
        <Table scroll head={["When", "Who", "Role", "Action", "Call", "Agent on call"]}>
          {ACCESS_LOG.map((a, i) => { const c = callById(a.call); return (
            <tr key={i}>
              <td className="dim" style={{ whiteSpace: "nowrap" }}>{a.when}</td>
              <td className="prim" style={{ whiteSpace: "nowrap" }}>{a.who}</td>
              <td className="dim">{a.role}</td>
              <td><Chip tone={a.action === "Recording played" ? "i" : a.action === "Listened live" ? "a" : "w"}>{a.action}</Chip></td>
              <td>{c ? <button className="dk-link mono" onClick={() => setOpen(c)}>{a.call.toUpperCase()}</button> : <span className="mono xs">{a.call.toUpperCase()}</span>}</td>
              <td className="dim">{c ? agentOf(c.agent).name : "Live call"}</td>
            </tr>); })}
        </Table>
      </>}

      <CallDetail call={open} close={() => setOpen(null)} toast={toast} />
      {listen && <ListenModal l={listen} close={() => setListen(null)} toast={toast} />}
    </div>
  );
}

Object.assign(window, { AdminDialer });
