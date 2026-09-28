// Dialer — seed data and audit helpers
const DIAL = { phase: "locked", verifiedAt: null, device: null, fails: 0, open: false, call: null, monitored: null };
const SUPERVISORS = [
  { id: "sv1", name: "Toni Dada", role: "Agency admin", avail: true },
  { id: "sv2", name: "Kemi Adeyemi", role: "Team lead", avail: true },
  { id: "sv3", name: "Obinna Eze", role: "Team lead", avail: false },
];
const DIAL_REASONS = ["Scheduled interview", "Callback", "Screening follow-up", "Incentive query", "Other (explain in notes)"];
const FLAG_REASONS = ["Participant distressed", "Abusive caller", "Consent unclear", "Quality review", "Technical issue"];
const DEFAULT_CAP = 3;

const normNum = (raw) => { const d = (raw || "").replace(/[^\d+]/g, ""); if (d.startsWith("+")) return d; if (d.startsWith("0")) return "+234" + d.slice(1); if (d.startsWith("234")) return "+" + d; return d; };
const fmtNum = (n) => { const d = normNum(n); if (!d.startsWith("+234")) return d; const r = d.slice(4); return ["+234", r.slice(0, 3), r.slice(3, 6), r.slice(6)].filter(Boolean).join(" "); };
const maskNum = (n) => { const d = normNum(n); return d.startsWith("+234") ? "+234 " + d.slice(4, 7) + " ••• " + d.slice(-4) : "••• " + d.slice(-4); };
const validNum = (n) => /^\+\d{11,14}$/.test(normNum(n));
const hms = () => new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const hm = () => new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
const mmss = (s) => Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");

const tAdd = (t, s) => { const [h, m, x] = t.split(":").map(Number); const v = h * 3600 + m * 60 + (x || 0) + s; return [Math.floor(v / 3600), Math.floor(v / 60) % 60, v % 60].map(n => String(n).padStart(2, "0")).join(":"); };
const seedEvents = (t, secs, rec, extra = []) => {
  const ev = [{ t, e: "Dialled" }];
  if (rec === "Not reached") return [...ev, { t: tAdd(t, 28), e: "No answer — call ended" }];
  ev.push({ t: tAdd(t, 9), e: "Connected" });
  ev.push({ t: tAdd(t, 9), e: "Recording started — consent on file from booking" });
  extra.forEach(x => ev.push({ t: tAdd(t, x[0]), e: x[1] }));
  ev.push({ t: tAdd(t, secs + 9), e: "Call ended by agent" }, { t: tAdd(t, secs + 70), e: "Outcome saved" });
  return ev;
};
const dc = (id, agent, number, campaign, reason, day, t, secs, rec, outcome, o = {}) => ({
  id, agent, number, campaign, reason, started: day + ", " + t.slice(0, 5), duration: rec === "Not reached" ? "0:00" : mmss(secs), recording: rec, outcome,
  flag: o.flag || null, transfer: o.transfer || null, notes: o.notes || "", events: seedEvents(t, secs, rec, o.extra || []),
});
const DIAL_CALLS = [
  dc("dc101", "a1", "+2348034471190", "k1", "Callback", "Today", "09:14:05", 0, "Not reached", "No answer"),
  dc("dc102", "a1", "+2348034471190", "k1", "Callback", "Today", "10:02:40", 0, "Not reached", "No answer"),
  dc("dc103", "a1", "+2348034471190", "k1", "Callback", "Today", "11:20:11", 0, "Not reached", "Busy"),
  dc("dc104", "a1", "+2348121093344", "k1", "Scheduled interview", "Today", "09:31:22", 742, "Recorded", "Completed", { notes: "Went elsewhere after a three-week wait for follow-up." }),
  dc("dc105", "a2", "+2349055128870", "k1", "Scheduled interview", "Today", "10:12:09", 615, "Recorded", "Completed", { extra: [[204, "Placed on hold — recording paused"], [262, "Resumed — recording resumed"]] }),
  dc("dc106", "a4", "+2347069921045", "k2", "Screening follow-up", "Today", "10:48:51", 188, "Recorded", "Participant declined"),
  dc("dc107", "a2", "+2348167734410", "k1", "Scheduled interview", "Today", "11:05:30", 402, "Recorded", "Follow-up required", { flag: { reason: "Participant distressed", note: "Became upset describing the misdiagnosis. Offered to stop; she wanted to continue.", by: "Tunde Bello" }, extra: [[330, "Flagged for review — Participant distressed"]] }),
  dc("dc108", "a1", "+2348023318876", "k2", "Incentive query", "Today", "11:44:02", 256, "Recorded", "Completed", { transfer: "Kemi Adeyemi", extra: [[180, "Warm transfer started — Kemi Adeyemi"], [236, "Transfer completed — Kemi Adeyemi"]] }),
  dc("dc109", "a3", "+2348091124567", "k4", "Scheduled interview", "Yesterday", "15:20:44", 933, "Recorded", "Completed"),
  dc("dc110", "a4", "+2348135567721", "k2", "Callback", "Yesterday", "16:02:18", 97, "Recorded", "Wrong number", { flag: { reason: "Consent unclear", note: "Person answering was not the participant.", by: "Grace Nwosu" }, extra: [[80, "Flagged for review — Consent unclear"]] }),
];
const ACCESS_LOG = [
  { when: "Today, 11:52", who: "Toni Dada", role: "Admin", action: "Recording played", call: "dc105" },
  { when: "Today, 11:31", who: "Amaka Obi", role: "Agent · own call", action: "Recording played", call: "dc104" },
  { when: "Today, 11:10", who: "Kemi Adeyemi", role: "Team lead", action: "Listened live", call: "dc107" },
  { when: "Today, 10:40", who: "Toni Dada", role: "Admin", action: "Number revealed", call: "dc106" },
  { when: "Yesterday, 17:05", who: "Toni Dada", role: "Admin", action: "Download requested", call: "dc109" },
];
const LIVE_SEED = [
  { id: "lv1", agent: "a2", number: "+2349033301287", campaign: "k1", reason: "Scheduled interview", rec: "Recorded", secs: 262, hold: false },
  { id: "lv2", agent: "a4", number: "+2347061189032", campaign: "k2", reason: "Callback", rec: "Recorded", secs: 38, hold: false },
];
const LIVE_T0 = Date.now();

const audit = (actor, role, action, entity, campaign, tone = "q") => { AUDIT.unshift({ when: "Today, " + hm(), actor, role, action, entity, campaign: campaign || "—", tone }); bump(); };
const logAccess = (who, role, action, call) => { ACCESS_LOG.unshift({ when: "Today, " + hm(), who, role, action, call }); bump(); };
const callEv = (e) => { if (DIAL.call) { DIAL.call.events.push({ t: hms(), e }); bump(); } };
const callSecs = (c) => c && c.t0 ? Math.floor(((c.t1 || Date.now()) - c.t0) / 1000) : 0;
const startDialCall = (o) => { commit(DIAL, { phase: "dialling", open: true, call: { id: nid("dc"), agent: o.agent, number: normNum(o.number), campaign: o.campaign, reason: o.reason, iv: o.iv || null, label: o.label || null, t0: null, rec: "Not started", muted: false, hold: false, flag: null, transfer: null, events: [] } }); callEv("Dialled" + (o.iv ? " from call workspace" : "")); };
const endDialCall = (msg) => { if (!DIAL.call) return; commit(DIAL.call, { t1: Date.now() }); callEv(msg || "Call ended by agent"); commit(DIAL, { phase: "wrap" }); };
const noAnswerDialCall = () => { if (!DIAL.call) return; commit(DIAL.call, { rec: "Not reached" }); callEv("No answer — call ended"); commit(DIAL, { phase: "wrap" }); };
const saveDialCall = (outcome, notes, actor) => {
  const c = DIAL.call; if (!c) return;
  const rec = c.rec === "Recorded" ? "Recorded" : "Not reached";
  callEv("Outcome saved — " + outcome);
  DIAL_CALLS.unshift({ id: c.id, agent: c.agent, number: c.number, campaign: c.campaign, reason: c.reason, iv: c.iv, label: c.label, started: "Today, " + c.events[0].t.slice(0, 5), duration: mmss(callSecs(c)), recording: rec, outcome, flag: c.flag, transfer: c.transfer, notes, events: c.events });
  audit(actor, "Agent", "Dialer call logged" + (rec === "Recorded" ? " · recorded" : ""), c.label || maskNum(c.number), c.campaign);
  commit(DIAL, { phase: "idle", call: null, monitored: null });
};
const callById = (id) => DIAL_CALLS.find(c => c.id === id);
const attemptsToday = (n) => DIAL_CALLS.filter(c => c.number === normNum(n) && c.started.startsWith("Today")).length;

Object.assign(window, { DIAL, SUPERVISORS, DIAL_REASONS, FLAG_REASONS, DEFAULT_CAP, DIAL_CALLS, ACCESS_LOG, LIVE_SEED, LIVE_T0, normNum, fmtNum, maskNum, validNum, hms, hm, mmss, audit, logAccess, callEv, callById, attemptsToday, callSecs, startDialCall, endDialCall, noAnswerDialCall, saveDialCall });
