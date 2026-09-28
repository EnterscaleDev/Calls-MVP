// Research Ops Platform — seed data
// Resolves an asset through the offline bundle when there is one, otherwise the project path.
const RES = (id, path) => (window.__resources && window.__resources[id]) || path;

const CLIENTS = [
  { id: "c1", name: "Hexia Health", sector: "Medtech", contact: "Dr. Ifeoma Aluko", senderIds: ["s1"] },
  { id: "c2", name: "Kola Foods", sector: "FMCG", contact: "Bade Onasanya", senderIds: ["s2"] },
  { id: "c3", name: "Ravel Pay", sector: "Fintech", contact: "Zainab Sule", senderIds: ["s3", "s4"] },
];

const SENDER_IDS = [
  { id: "s1", client: "c1", text: "HEXIA", status: "Active", requested: "12 Jun 2026", approved: "19 Jun 2026" },
  { id: "s2", client: "c2", text: "KOLA", status: "Active", requested: "03 Mar 2026", approved: "11 Mar 2026" },
  { id: "s3", client: "c3", text: "RAVELPAY", status: "Active", requested: "22 Jan 2026", approved: "02 Feb 2026" },
  { id: "s4", client: "c3", text: "RAVEL-RX", status: "Pending approval", requested: "28 Aug 2026", approved: null },
];

const AGENTS = [
  { id: "a1", person: "p1", name: "Amaka Obi", initials: "AO", status: "Active", target: 12, campaigns: ["k1", "k2"], today: { done: 9, due: 4, late: 1 }, week: 47, avg: "11:20", completion: 0.72 },
  { id: "a2", person: "p2", name: "Tunde Bello", initials: "TB", status: "Active", target: 12, campaigns: ["k1"], today: { done: 6, due: 7, late: 2 }, week: 38, avg: "9:05", completion: 0.64 },
  { id: "a3", person: "p4", name: "Grace Nwafor", initials: "GN", status: "Active", target: 10, campaigns: ["k1", "k3"], today: { done: 11, due: 2, late: 0 }, week: 52, avg: "13:40", completion: 0.81 },
  { id: "a4", person: "p5", name: "Segun Ade", initials: "SA", status: "Active", target: 10, campaigns: ["k2"], today: { done: 4, due: 6, late: 0 }, week: 29, avg: "8:15", completion: 0.58 },
  { id: "a5", person: "p8", name: "Rita Umeh", initials: "RU", status: "Deactivated", target: 10, campaigns: [], today: { done: 0, due: 0, late: 0 }, week: 0, avg: "—", completion: 0 },
];

const INVITE_EXPIRY_DAYS = 7;
const AGENT_INVITES = [
  { id: "inv1", name: "Segun Adebayo", email: "segun.ade@enterscale.com", campaigns: ["k1"], dailyTarget: 8, status: "Pending", invitedAt: "05 Sep, 16:55", expiresAt: "12 Sep 2026", invitedBy: "Toni Dada" },
  { id: "inv2", name: "Funke Alabi", email: "funke.alabi@enterscale.com", campaigns: [], dailyTarget: null, status: "Pending", invitedAt: "Yesterday, 10:20", expiresAt: "17 Sep 2026", invitedBy: "Toni Dada" },
  { id: "inv3", name: "Chidi Nnamdi", email: "chidi.nnamdi@enterscale.com", campaigns: ["k2"], dailyTarget: 10, status: "Expired", invitedAt: "28 Aug, 09:00", expiresAt: "04 Sep 2026", invitedBy: "Toni Dada" },
  { id: "inv4", name: "David Okon", email: "david.okon@enterscale.com", campaigns: ["k1"], dailyTarget: 8, status: "Revoked", invitedAt: "20 Aug, 09:00", expiresAt: "27 Aug 2026", invitedBy: "Toni Dada" },
];

const CAMPAIGNS = [
  {
    id: "k1", name: "Hexia Post-Consultation Study", client: "c1", sender: "s1", status: "Live", type: "interview",
    objective: "Understand why patients who booked a first consultation did not return for follow-up care, and what would bring them back.",
    description: "Telephone interviews with patients who completed one consultation in the last 90 days and have not rebooked.",
    start: "24 Aug 2026", end: "26 Sep 2026", target: 120, daily: 25, attemptCap: 3,
    incentive: "Free doctor's appointment (Hexia app voucher)", incentiveProvider: "Hexia", recording: "On — announced in script",
    privacy: "First name + reference", agents: ["a1", "a2", "a3"],
    stats: { contacts: 1840, sent: 1840, delivered: 1731, failed: 109, optIn: 412, optOut: 63, scheduled: 268, completed: 87, attempted: 214, issued: 74 },
  },
  {
    id: "k2", name: "Kola Foods Trial Drop-off", client: "c2", sender: "s2", status: "Live", type: "interview",
    objective: "Find out what stops trial-pack buyers from moving to a full-size purchase.",
    description: "Short validation interviews with shoppers who bought a trial pack once and did not repeat within 60 days.",
    start: "01 Sep 2026", end: "30 Sep 2026", target: 60, daily: 15, attemptCap: 2,
    incentive: "₦5,000 airtime voucher", incentiveProvider: "Manual voucher", recording: "On — announced in script",
    privacy: "Reference only", agents: ["a1", "a4"],
    stats: { contacts: 920, sent: 920, delivered: 878, failed: 42, optIn: 164, optOut: 21, scheduled: 96, completed: 22, attempted: 51, issued: 19 },
  },
  {
    id: "k3", name: "Ravel Pay Merchant Discovery", client: "c3", sender: "s3", status: "Draft", type: "interview",
    objective: "Map how small merchants decide between payment providers when they switch.",
    description: "Discovery interviews with merchants who churned to a competitor in the last quarter.",
    start: "14 Sep 2026", end: "18 Oct 2026", target: 40, daily: 10, attemptCap: 3,
    incentive: "₦10,000 settlement credit", incentiveProvider: "Manual voucher", recording: "Off — client policy",
    privacy: "Reference only", agents: ["a3"],
    stats: { contacts: 0, sent: 0, delivered: 0, failed: 0, optIn: 0, optOut: 0, scheduled: 0, completed: 0, attempted: 0, issued: 0 },
  },
  {
    id: "k4", name: "Hexia Pharmacy Pilot Feedback", client: "c1", sender: "s1", status: "Completed", type: "interview",
    objective: "Assess pharmacy partners' experience of the six-week fulfilment pilot.",
    description: "Wrap-up interviews with all participating pharmacy managers.",
    start: "02 Jun 2026", end: "18 Jul 2026", target: 30, daily: 8, attemptCap: 3,
    incentive: "None", incentiveProvider: "—", recording: "On — announced in script",
    privacy: "First name + reference", agents: ["a3"],
    stats: { contacts: 210, sent: 210, delivered: 203, failed: 7, optIn: 71, optOut: 4, scheduled: 44, completed: 31, attempted: 68, issued: 0 },
  },
  {
    id: "k6", name: "Diabetes Patient Experience", client: "c1", sender: "s1", status: "Live", type: "focus",
    objective: "Understand how people managing diabetes actually get care between appointments, and where Hexia fits or fails to.",
    description: "Five moderated group sessions across Lagos and online, segmented by how long people have lived with the condition.",
    start: "25 Aug 2026", end: "20 Sep 2026", target: 40, daily: 0, attemptCap: 0,
    incentive: "₦15,000 transport stipend + free doctor's appointment", incentiveProvider: "Hexia", recording: "Audio and video — per-participant consent",
    privacy: "First name only, shown to the moderator during the session", agents: [], mods: ["m1", "m2"], eligibility: "Attended, or left early after 45 minutes",
    stats: { contacts: 640, sent: 640, delivered: 611, failed: 29, optIn: 148, optOut: 22, interested: 148, registered: 33, waitlisted: 8, scheduled: 33, completed: 7, attempted: 0, issued: 7, started: 0, partial: 0 },
  },
  {
    id: "k5", name: "Hexia App Experience Pulse", client: "c1", sender: "s1", status: "Live", type: "survey",
    objective: "Measure how the app is experienced at scale, and find which friction points sit behind the drop in repeat bookings.",
    description: "Online survey sent by SMS to everyone who opened the app in the last 60 days. No interview, no call.",
    start: "29 Aug 2026", end: "30 Sep 2026", target: 400, daily: 0, attemptCap: 0,
    incentive: "₦2,000 Hexia app credit", incentiveProvider: "Hexia", recording: "Not applicable",
    privacy: "Responses are stored against a reference, not a name", agents: [], reminders: 2, medianTime: "3:12",
    stats: { contacts: 3200, sent: 3200, delivered: 3040, failed: 160, optIn: 786, optOut: 96, screened: 961, screenOut: 175, started: 786, partial: 274, scheduled: 0, completed: 512, attempted: 0, issued: 480 },
  },
];

const SCRIPT = [
  { id: 1, title: "Introduction and consent", say: "Good [morning/afternoon], am I speaking with [participant]? My name is [agent], I'm calling on behalf of Hexia Health about the short research interview you signed up for.", cues: ["Confirm you are speaking to the right person before saying anything else.", "Say the call is recorded. If they object, stop the recording and note it."], mins: 2 },
  { id: 2, title: "Their last consultation", say: "I'd like to start with the consultation you had on the app. Can you walk me through what led you to book that appointment?", cues: ["Let them tell the story. Do not lead.", "Listen for: symptom urgency, referral source, prior provider."], mins: 4 },
  { id: 3, title: "What happened afterwards", say: "After that appointment, what happened next in terms of your care?", cues: ["Probe on any follow-up they were told to book.", "If they went elsewhere, ask where and why."], mins: 5 },
  { id: 4, title: "The decision not to return", say: "You haven't booked again through Hexia. What went into that?", cues: ["This is the core question. Give them room.", "Do not defend Hexia or explain features."], mins: 6 },
  { id: 5, title: "What would change it", say: "If there were one thing Hexia could change that would make you book again, what would it be?", cues: ["Push for something specific and concrete."], mins: 3 },
  { id: 6, title: "Close and incentive", say: "That's everything I needed. Thank you. Your free appointment voucher will arrive by SMS within 24 hours.", cues: ["Confirm the number to receive the voucher is the one they were called on.", "Do not promise a timeframe shorter than 24 hours."], mins: 2 },
];

const OUTCOMES = ["Completed", "No answer", "Busy", "Reschedule requested", "Participant declined", "Wrong number", "Ineligible", "Follow-up required", "Technical failure"];
const OUTCOME_TONE = { Completed: "g", "No answer": "q", Busy: "q", "Reschedule requested": "a", "Participant declined": "r", "Wrong number": "r", Ineligible: "q", "Follow-up required": "w", "Technical failure": "r" };

const FIRST = ["Amaka", "Chidi", "Ngozi", "Yusuf", "Blessing", "Emeka", "Halima", "Tobi", "Funmi", "Ibrahim", "Chioma", "Sadiq", "Uche", "Aisha", "Bola", "Kelechi", "Zainab", "Femi", "Adaeze", "Musa"];
const LAST = ["Okafor", "Bello", "Adeyemi", "Ibrahim", "Eze", "Lawal", "Nwachukwu", "Danjuma", "Ojo", "Balogun"];
const SEGMENTS = ["Lagos · 25-34", "Lagos · 35-44", "Abuja · 25-34", "Port Harcourt · 35-44", "Ibadan · 45+"];
const rnd = (n) => Math.floor(n);
const mk = (i) => {
  const f = FIRST[i % FIRST.length], l = LAST[(i * 3) % LAST.length];
  const ref = 1001 + i;
  return { ref, id: "p" + ref, first: f, last: l, name: f + " " + l, phone: "+2348" + String(30000000 + i * 137911).slice(0, 9), email: (f + "." + l).toLowerCase() + "@mail.com", segment: SEGMENTS[i % SEGMENTS.length], custId: "HX-" + (48210 + i * 7) };
};
const PEOPLE = Array.from({ length: 60 }, (_, i) => mk(i));

const STATE_SEQ = ["Scheduled", "Due today", "Overdue", "Completed", "Cancelled", "Unscheduled"];
const HOURS = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00"];
const INTERVIEWS = PEOPLE.map((p, i) => {
  const st = i < 6 ? "Overdue" : i < 20 ? "Due today" : i < 36 ? "Scheduled" : i < 50 ? "Completed" : i < 55 ? "Cancelled" : "Unscheduled";
  const ag = AGENTS[i % 4];
  return {
    id: "iv" + p.ref, ref: p.ref, person: p, campaign: i % 5 === 4 ? "k2" : "k1", state: st,
    agent: st === "Unscheduled" ? null : ag.id, time: st === "Unscheduled" ? null : HOURS[i % HOURS.length],
    day: st === "Overdue" ? "Yesterday" : st === "Due today" ? "Today" : st === "Scheduled" ? ["Tomorrow", "Wed 9 Sep", "Thu 10 Sep"][i % 3] : "Last week",
    attempts: st === "Completed" ? 1 + (i % 2) : st === "Overdue" ? 1 + (i % 3) : 0,
    consent: st === "Cancelled" ? "Opted out" : "Opted in",
    consentAt: "0" + (1 + (i % 5)) + " Sep 2026, " + HOURS[i % HOURS.length],
    incentive: st === "Completed" ? ["Issued", "Issued", "Pending", "Redeemed", "Failed"][i % 5] : st === "Cancelled" ? "Not eligible" : "Eligible",
    duration: st === "Completed" ? (8 + (i % 9)) + ":" + String(10 + (i % 49)).padStart(2, "0") : null,
    outcome: st === "Completed" ? "Completed" : st === "Overdue" ? OUTCOMES[1 + (i % 3)] : null,
    recording: st === "Completed" && i % 7 !== 3,
  };
});

const ATTEMPTS = INTERVIEWS.filter(iv => iv.attempts > 0).flatMap((iv, n) =>
  Array.from({ length: iv.attempts }, (_, k) => ({
    id: iv.id + "-" + k, iv: iv.id, ref: iv.ref, campaign: iv.campaign, agent: iv.agent,
    when: ["Today, 11:24", "Today, 10:02", "Today, 09:15", "Yesterday, 16:40", "Yesterday, 14:12"][(n + k) % 5],
    outcome: k === iv.attempts - 1 ? (iv.outcome || "No answer") : ["No answer", "Busy"][(n + k) % 2],
    duration: k === iv.attempts - 1 && iv.duration ? iv.duration : "0:0" + (4 + (k % 5)),
    recording: k === iv.attempts - 1 && iv.recording,
    notes: k === iv.attempts - 1 && iv.outcome === "Completed"
      ? ["Went elsewhere because the follow-up slot was three weeks out. Would return if same-week booking existed.", "Confused the consultation fee with the subscription. Thought she had already paid for follow-up.", "Happy with the doctor, put off by having to re-enter symptoms from scratch each time.", "Moved cities. Did not know Hexia covered her new location."][(n + k) % 4]
      : "",
  }))
);

const SMS_TEMPLATES = [
  { id: "t1", name: "Hexia — interview invitation", body: "Hi {{first_name}}, Hexia Health would like to hear about your recent consultation. Take part in a 15-minute phone interview and receive a free doctor's appointment. Choose a time: {{opt_in_link}}. Reply STOP to opt out." },
  { id: "t2", name: "Hexia — reminder", body: "Hi {{first_name}}, your Hexia research call is booked for {{slot_time}} tomorrow. Reply RESCHEDULE or use {{opt_in_link}} to change it." },
  { id: "t3", name: "Kola — trial feedback invite", body: "Hi {{first_name}}, Kola Foods wants 10 minutes of your time on the trial pack you tried. Get ₦5,000 airtime. Pick a slot: {{opt_in_link}}. Reply STOP to opt out." },
  { id: "t4", name: "Hexia — survey invitation", body: "Hi {{first_name}}, Hexia Health would like 3 minutes of your time. Answer 9 quick questions about the app and get ₦2,000 app credit: {{opt_in_link}}. Reply STOP to opt out." },
  { id: "t5", name: "Hexia — survey reminder", body: "Hi {{first_name}}, you started the Hexia survey but didn't finish. Pick up where you left off — it takes 2 minutes: {{opt_in_link}}" },
];

const CREDITS = { balance: 486200, currency: "₦", smsRate: 4.2, callRate: 18, lowAt: 150000 };

// Messaging and voice are bought from different providers and top up separately.
const ACCOUNTS = [
  { id: "sms", label: "SMS credit", provider: "Messaging provider", providerState: "Sandbox adapter — no vendor selected", balance: 486200, rate: 4.2, unit: "per message part", buys: "message parts", lowAt: 150000, autoTopUp: false, spentMonth: 11592, icon: "msg" },
  { id: "voice", label: "Voice credit", provider: "Voice / telephony provider", providerState: "Sandbox adapter — masked calling not yet contracted", balance: 96400, rate: 18, unit: "per call minute", buys: "call minutes", lowAt: 120000, autoTopUp: true, spentMonth: 47286, icon: "phone" },
];
const accountOf = (id) => ACCOUNTS.find(a => a.id === id) || {};

const LEDGER = [
  { id: "l1", acct: "sms", when: "06 Sep 2026, 09:12", type: "Top-up", detail: "Card ending 4412", campaign: "—", amount: 500000 },
  { id: "l2", acct: "sms", when: "06 Sep 2026, 10:40", type: "SMS send", detail: "920 messages · Kola Foods Trial Drop-off", campaign: "k2", amount: -3864 },
  { id: "l3", acct: "voice", when: "05 Sep 2026, 15:22", type: "Call minutes", detail: "214 minutes · Hexia Post-Consultation", campaign: "k1", amount: -3852 },
  { id: "l6", acct: "voice", when: "05 Sep 2026, 08:00", type: "Top-up", detail: "Auto top-up triggered at ₦120,000", campaign: "—", amount: 150000 },
  { id: "l4", acct: "sms", when: "04 Sep 2026, 08:05", type: "SMS send", detail: "1,840 messages · Hexia Post-Consultation", campaign: "k1", amount: -7728 },
  { id: "l5", acct: "voice", when: "01 Sep 2026, 11:30", type: "Top-up", detail: "Bank transfer", campaign: "—", amount: 250000 },
];

const AUDIT = [
  { when: "Today, 11:26", actor: "Amaka Obi", role: "Agent", action: "Call attempt logged", entity: "Interview #1042", campaign: "k1", tone: "q" },
  { when: "Today, 11:04", actor: "Toni Dada", role: "Admin", action: "Recording accessed", entity: "Attempt #1039-1", campaign: "k1", tone: "a" },
  { when: "Today, 10:48", actor: "Toni Dada", role: "Admin", action: "Incentive issued", entity: "12 participants", campaign: "k1", tone: "q" },
  { when: "Today, 09:31", actor: "System", role: "System", action: "Consent recorded — opt-in", entity: "Participant #1058", campaign: "k1", tone: "q" },
  { when: "Today, 09:02", actor: "Toni Dada", role: "Admin", action: "Participants reassigned", entity: "6 interviews · Tunde Bello → Grace Nwafor", campaign: "k1", tone: "q" },
  { when: "Yesterday, 17:20", actor: "System", role: "System", action: "Consent recorded — opt-out", entity: "Participant #1051", campaign: "k1", tone: "q" },
  { when: "Yesterday, 16:02", actor: "Toni Dada", role: "Admin", action: "Data export", entity: "Call activity · 214 rows", campaign: "k1", tone: "r" },
  { when: "Yesterday, 14:15", actor: "Toni Dada", role: "Admin", action: "Bulk SMS sent", entity: "920 recipients", campaign: "k2", tone: "q" },
  { when: "Yesterday, 11:40", actor: "Toni Dada", role: "Admin", action: "Contact import", entity: "920 rows · 878 accepted, 42 rejected", campaign: "k2", tone: "q" },
  { when: "05 Sep, 16:55", actor: "Toni Dada", role: "Admin", action: "Agent invited", entity: "segun.ade@enterscale.com", campaign: "—", tone: "q" },
  { when: "05 Sep, 09:10", actor: "Toni Dada", role: "Admin", action: "Campaign status changed", entity: "Draft → Live", campaign: "k2", tone: "q" },
];

const IMPORT_ERRORS = [
  { row: 14, field: "phone", value: "0803-XXX-4412", issue: "Malformed number — cannot normalise to E.164" },
  { row: 27, field: "phone", value: "+2348034471190", issue: "Duplicate of row 9" },
  { row: 58, field: "phone", value: "701224", issue: "Too short" },
  { row: 96, field: "phone", value: "+2348034471190", issue: "Duplicate of row 9" },
  { row: 131, field: "name", value: "", issue: "Missing — participant will show as reference only" },
];

const TEAMS = [
  { id: "t1", name: "Medtech interviewers", cascade: "In order", members: ["a1", "a3", "a2"], campaigns: ["k1", "k4"], note: "Trained on clinical language and consent wording." },
  { id: "t2", name: "General consumer", cascade: "Round robin", members: ["a2", "a4"], campaigns: ["k2"], note: "Shorter interviews, higher volume." },
  { id: "t3", name: "Overflow", cascade: "Simultaneous", members: ["a1", "a2", "a3", "a4"], campaigns: [], note: "Picks up anything unassigned after 30 minutes overdue." },
];
const CASCADES = {
  "In order": "Work is offered to the first member, then the next, in the order listed.",
  "Round robin": "Each new participant goes to whoever has waited longest since their last assignment.",
  "Simultaneous": "Everyone in the team sees the pool and takes the next one available.",
};

const TARGET_METRICS = ["Completed interviews", "Calls attempted", "Talk time (minutes)", "Survey completions", "Connect rate (%)"];
const TARGETS = [
  { id: "tg1", user: "a1", metric: "Completed interviews", value: 60, achieved: 47, start: "24 Aug 2026", end: "26 Sep 2026", campaign: "k1" },
  { id: "tg2", user: "a2", metric: "Completed interviews", value: 60, achieved: 31, start: "24 Aug 2026", end: "26 Sep 2026", campaign: "k1" },
  { id: "tg3", user: "a3", metric: "Completed interviews", value: 50, achieved: 52, start: "24 Aug 2026", end: "26 Sep 2026", campaign: "k1" },
  { id: "tg4", user: "a4", metric: "Calls attempted", value: 220, achieved: 138, start: "01 Sep 2026", end: "30 Sep 2026", campaign: "k2" },
  { id: "tg5", user: "a1", metric: "Talk time (minutes)", value: 600, achieved: 528, start: "01 Sep 2026", end: "30 Sep 2026", campaign: "" },
  { id: "tg6", user: "a3", metric: "Connect rate (%)", value: 45, achieved: 51, start: "01 Sep 2026", end: "30 Sep 2026", campaign: "" },
];

const MISSED = [
  { id: "m1", when: "Today, 12:04", ref: 1019, campaign: "k1", reason: "Participant called the research line", assigned: "a1", back: true, backBy: "a1", backAt: "Today, 12:31" },
  { id: "m2", when: "Today, 10:47", ref: 1033, campaign: "k1", reason: "Participant called the research line", assigned: "a1", back: false, backBy: null, backAt: null },
  { id: "m3", when: "Yesterday, 16:52", ref: 1008, campaign: "k2", reason: "Returned a missed interview call", assigned: "a4", back: true, backBy: "a4", backAt: "Yesterday, 17:10" },
  { id: "m4", when: "Yesterday, 15:20", ref: 1044, campaign: "k1", reason: "Called outside the calling window", assigned: "a3", back: false, backBy: null, backAt: null },
  { id: "m5", when: "05 Sep, 09:12", ref: 1052, campaign: "k1", reason: "Participant called the research line", assigned: null, back: true, backBy: "a1", backAt: "05 Sep, 09:40" },
];

const QTYPES = {
  single: "Single choice", multi: "Multiple choice", scale: "Rating scale", likert: "Likert scale", nps: "NPS 0–10",
  yesno: "Yes / No", short: "Short text", long: "Long text", number: "Number", date: "Date",
};
const LIKERT = ["Strongly disagree", "Disagree", "Neither", "Agree", "Strongly agree"];
const SECTIONS = [
  { id: "s1", name: "Your use of the app", intro: "First, a couple of questions about when you last used Hexia." },
  { id: "s2", name: "How it went", intro: "Now the part that matters most — how the app actually worked for you." },
  { id: "s3", name: "What would change it", intro: "" },
  { id: "s4", name: "Follow-up", intro: "" },
];
const SCREEN_REASONS = { market: "Outside market", age: "Under 18", industry: "Industry connection", recent: "Recently researched", quota: "Age quota full" };
const SCREENERS = [
  { id: "sc1", type: "single", q: "Do you currently live in Nigeria?", opts: ["Yes", "No"], reject: ["No"], reason: "market" },
  {
    id: "sc2", type: "single", q: "Which age group are you in?", opts: ["Under 18", "18–24", "25–34", "35–44", "45–54", "55 or over"],
    reject: ["Under 18"], reason: "age",
    quota: [{ v: "18–24", cap: 80, got: 80 }, { v: "25–34", cap: 140, got: 132 }, { v: "35–44", cap: 100, got: 74 }, { v: "45–54", cap: 50, got: 31 }, { v: "55 or over", cap: 30, got: 12 }],
  },
  { id: "sc3", type: "single", q: "Have you or anyone in your household worked for a health insurer, hospital or health app in the last 12 months?", opts: ["Yes", "No"], reject: ["Yes"], reason: "industry" },
  { id: "sc4", type: "single", q: "Have you taken part in a Hexia research study in the last 3 months?", opts: ["Yes", "No"], reject: ["Yes"], reason: "recent" },
];
const SCREEN_OUTS = [["Age quota full", 63], ["Recently researched", 41], ["Outside market", 34], ["Industry connection", 26], ["Under 18", 11]];
const SURVEY = [
  {
    id: "q1", sec: "s1", type: "single", q: "When did you last use the Hexia app?", req: true, opts: ["This week", "In the last month", "1–3 months ago", "More than 3 months ago", "I've never used it"],
    logic: [{ when: "I've never used it", go: "q9" }],
  },
  { id: "q2", sec: "s1", type: "single", q: "What did you use it for most recently?", req: true, opts: ["Booking a consultation", "Repeat prescription", "Test results", "Browsing only", "Something else"] },
  { id: "q3", sec: "s2", type: "nps", q: "How likely are you to recommend Hexia to a friend or family member?", req: true },
  {
    id: "q4", sec: "s2", type: "multi", q: "Which of these got in your way? Pick all that apply.", req: false, opts: ["Appointment times didn't suit me", "Cost was unclear", "Too many steps to book", "Couldn't find the right doctor", "App was slow or crashed", "Nothing got in my way"],
    logic: [{ when: "Nothing got in my way", go: "q7" }],
  },
  { id: "q5", sec: "s2", type: "scale", q: "How easy was it to book an appointment?", req: true, low: "Very hard", high: "Very easy" },
  { id: "q6", sec: "s2", type: "yesno", q: "Did you go on to see a doctor somewhere else instead?", req: true },
  { id: "q7", sec: "s3", type: "long", q: "What one change would make you use Hexia again?", req: false, ph: "In your own words" },
  { id: "q8", sec: "s3", type: "number", q: "Roughly how many times have you booked through Hexia in total?", req: false },
  { id: "q9", sec: "s4", type: "single", q: "Would you be willing to speak with us on the phone for 10 minutes?", req: true, opts: ["Yes, happy to", "No thanks"], note: "A yes here moves the participant into the interview queue for this client." },
];
const SURVEY_AGG = {
  q1: [["This week", 118], ["In the last month", 164], ["1–3 months ago", 141], ["More than 3 months ago", 79], ["I've never used it", 10]],
  q2: [["Booking a consultation", 261], ["Repeat prescription", 92], ["Test results", 61], ["Browsing only", 74], ["Something else", 24]],
  q3: { promoters: 148, passives: 191, detractors: 173, score: -5 },
  q4: [["Appointment times didn't suit me", 244], ["Cost was unclear", 187], ["Too many steps to book", 131], ["Couldn't find the right doctor", 96], ["App was slow or crashed", 71], ["Nothing got in my way", 88]],
  q5: [["1", 41], ["2", 78], ["3", 152], ["4", 141], ["5", 100]],
  q6: [["Yes", 298], ["No", 214]],
  q8: { median: 2, mean: 2.8 },
  q9: [["Yes, happy to", 137], ["No thanks", 375]],
};
const OPEN_ENDS = [
  "Let me see the actual price before I commit to the appointment.",
  "Same-week appointments. Three weeks out is no use when you're unwell.",
  "Stop making me type my symptoms again every single time.",
  "A way to go back to the same doctor rather than starting over.",
  "Clearer on what is covered by my employer plan and what isn't.",
  "Nothing. It worked fine, I just haven't needed it again.",
];
const RESPONSES = Array.from({ length: 14 }, (_, i) => ({
  id: "r" + i, ref: 1101 + i, state: i < 10 ? "Completed" : i < 13 ? "Partial" : "Started",
  at: ["Today, 11:42", "Today, 10:18", "Today, 09:05", "Yesterday, 19:30", "Yesterday, 16:11"][i % 5],
  took: i < 10 ? "2:" + String(20 + i * 3).padStart(2, "0") : "—",
  answered: i < 10 ? 9 : 3 + (i % 4), device: ["Android", "iPhone", "Android", "Android", "iPhone"][i % 5],
  nps: i < 10 ? [9, 3, 7, 10, 2, 8, 6, 4, 9, 5][i] : null,
  incentive: i < 10 ? ["Issued", "Issued", "Redeemed", "Issued", "Pending", "Issued", "Redeemed", "Issued", "Failed", "Issued"][i] : "Not eligible",
}));

const MODS = [
  { id: "m1", person: "p3", name: "Chidi Umeh", initials: "CU", status: "Active", role: "Moderator", campaigns: ["k6"], sessions: ["fs1", "fs3", "fs5"], ran: 11, avgAttend: 0.78 },
  { id: "m2", person: "p6", name: "Halima Sani", initials: "HS", status: "Active", role: "Moderator", campaigns: ["k6"], sessions: ["fs2", "fs4"], ran: 6, avgAttend: 0.71 },
  { id: "m3", person: "p7", name: "Peter Okoro", initials: "PO", status: "Active", role: "Note taker", campaigns: ["k6"], sessions: ["fs1", "fs2"], ran: 0, avgAttend: 0 },
  { id: "m4", person: "p1", name: "Amaka Obi", initials: "AO", status: "Active", role: "Moderator", campaigns: ["k6"], sessions: ["fs4", "fs6"], ran: 3, avgAttend: 0.74 },
];
const modOf = (id) => MODS.find(m => m.id === id) || { id: null, name: "Unassigned", initials: "—", role: "Moderator", status: "Active", campaigns: [], sessions: [], ran: 0, avgAttend: 0 };

const SESSIONS = [
  { id: "fs1", camp: "k6", title: "Group A — recently diagnosed", day: "Today", time: "10:00", dur: 90, format: "Online", where: "Google Meet", url: "meet.google.com/hxa-diab-01", cap: 8, min: 5, mod: "m1", note: "m3", status: "Confirmed", brief: "Join five minutes early. Camera optional, microphone required." },
  { id: "fs2", camp: "k6", title: "Group B — five years or more", day: "Wed 9 Sep", time: "14:00", dur: 120, format: "In-person", where: "Enterscale, 14 Adeola Odeku, Victoria Island, Lagos", url: "", cap: 10, min: 6, mod: "m2", note: "m3", status: "Open for registration", brief: "Ask for the research suite on the second floor. Refreshments provided." },
  { id: "fs3", camp: "k6", title: "Group C — carers and family", day: "Thu 10 Sep", time: "18:00", dur: 90, format: "Online", where: "Google Meet", url: "meet.google.com/hxa-diab-03", cap: 8, min: 5, mod: "m1", note: null, status: "Full", brief: "Join five minutes early. Camera optional, microphone required." },
  { id: "fs4", camp: "k6", title: "Group D — lapsed app users", day: "Today", time: "16:00", dur: 90, format: "Online", where: "Google Meet", url: "meet.google.com/hxa-diab-04", cap: 8, min: 5, mod: "m4", note: null, status: "Confirmed", brief: "Join five minutes early. You are calling Hexia participants until 15:30 — leave yourself the gap." },
  { id: "fs6", camp: "k6", title: "Group E — newly prescribed", day: "Thu 10 Sep", time: "09:30", dur: 90, format: "Online", where: "Google Meet", url: "meet.google.com/hxa-diab-06", cap: 8, min: 5, mod: "m4", note: "m3", status: "Open for registration", brief: "Join five minutes early. Camera optional, microphone required." },
  { id: "fs5", camp: "k6", title: "Pilot group — Abuja", day: "Thu 3 Sep", time: "15:00", dur: 120, format: "In-person", where: "Transcorp Hilton, Abuja", url: "", cap: 10, min: 6, mod: "m1", note: null, status: "Completed", brief: "Meeting room 2." },
];
const sessionOf = (id) => SESSIONS.find(s => s.id === id) || {};
const REG_STATES = ["Invited", "Interested", "Registered", "Confirmed", "Waitlisted", "Cancelled", "Attended", "No-show", "Left early", "Declined"];
const SEAT_TAKING = ["Registered", "Confirmed", "Attended", "Left early"];

const REGS = (() => {
  const plan = [["fs1", 8, 1], ["fs2", 6, 3], ["fs3", 8, 4], ["fs4", 6, 0], ["fs5", 9, 0], ["fs6", 4, 0]];
  let n = 0; const out = [];
  for (const [sid, seats, wait] of plan) {
    const s = SESSIONS.find(x => x.id === sid);
    for (let i = 0; i < seats + wait; i++) {
      const p = PEOPLE[(n * 3 + 7) % PEOPLE.length]; n++;
      const waitl = i >= seats;
      const done = s.status === "Completed";
      const st = waitl ? "Waitlisted" : done ? (i % 7 === 3 ? "No-show" : i % 9 === 5 ? "Left early" : "Attended") : s.status === "Confirmed" ? (i % 6 === 4 ? "Registered" : "Confirmed") : "Registered";
      out.push({
        id: sid + "-r" + i, session: sid, camp: s.camp, ref: 2200 + n, person: p, state: st,
        at: ["02 Sep, 09:14", "02 Sep, 17:40", "03 Sep, 08:22", "04 Sep, 12:05", "05 Sep, 19:31"][n % 5],
        wait: waitl ? i - seats + 1 : null,
        consent: { participate: true, audio: true, video: i % 5 !== 2, quotes: i % 3 !== 1 },
        incentive: st === "Attended" ? ["Issued", "Issued", "Redeemed", "Pending"][i % 4] : st === "Left early" ? "Eligible" : "Not eligible",
        note: st === "Left early" ? "Had to collect a child at 16:20." : st === "No-show" ? "No contact on the day." : "",
      });
    }
  }
  return out;
})();

const GUIDE = [
  { id: "g1", title: "Welcome and ground rules", mins: 10, body: "Thank everyone for coming. Explain who Enterscale is and that we are working on behalf of Hexia Health. There are no wrong answers and we want disagreement as much as agreement.", prompts: ["Confirm everyone is happy to be recorded. Check the consent column before starting.", "One person at a time — we cannot hear two voices on a recording."] },
  { id: "g2", title: "Warm-up — living with it day to day", mins: 15, body: "Go round the group. Ask each person to describe a typical week managing their condition, in their own words.", prompts: ["Let the quiet ones go second or third, never last.", "Listen for routines, not opinions."] },
  { id: "g3", title: "Theme 1 — getting care when you need it", mins: 25, body: "Move into how people get seen when something changes. What do they do first?", prompts: ["Probe on waiting, cost and travel separately — they get conflated.", "Watch for the person who has given up entirely."] },
  { id: "g4", title: "Theme 2 — the app in their life", mins: 25, body: "Introduce the Hexia app explicitly for the first time. Ask what they use it for and what they gave up on.", prompts: ["Do not defend the product or explain features.", "If nobody uses it, that is the finding — do not push."] },
  { id: "g5", title: "Theme 3 — what would change things", mins: 20, body: "Ask the group to build the thing they wish existed. Encourage them to argue with each other.", prompts: ["Force specificity. “Better” is not an answer."] },
  { id: "g6", title: "Close and incentive", mins: 10, body: "Summarise back what you heard and check you have it right. Explain the voucher and when it arrives.", prompts: ["Confirm attendance out loud so nobody is surprised by a missing incentive."] },
];

const SESSION_NOTES = [
  { session: "fs5", by: "m1", at: "03 Sep, 17:40", themes: ["Cost opacity dominated — six of nine raised it unprompted", "Nobody distinguished the app from the clinic; they think of it as one service", "Two participants had switched to a pharmacy-first route entirely"], obs: "The group turned on the question of follow-up cost and stayed there for almost twenty minutes. I let it run because the energy was real. Worth building the next guide around it rather than treating it as one theme of three.", issues: "Room booked for two hours, we needed two and a half. Two people left at the two-hour mark and their contributions to the final theme are missing.", follow: "Recruit two more carers for group C — that perspective was thin here." },
];

const clientOf = (id) => CLIENTS.find(c => c.id === id) || {};
const campaignOf = (id) => CAMPAIGNS.find(c => c.id === id) || {};
const agentOf = (id) => AGENTS.find(a => a.id === id) || {};
const senderOf = (id) => SENDER_IDS.find(s => s.id === id) || {};
const money = (n) => "₦" + Math.abs(n).toLocaleString();
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

const STAFF = [
  { id: "p1", name: "Amaka Obi", initials: "AO", email: "amaka.obi@enterscale.com", status: "Active", joined: "12 Mar 2026", tone: "" },
  { id: "p2", name: "Tunde Bello", initials: "TB", email: "tunde.bello@enterscale.com", status: "Active", joined: "04 May 2026", tone: "" },
  { id: "p3", name: "Chidi Umeh", initials: "CU", email: "chidi.umeh@enterscale.com", status: "Active", joined: "22 Jan 2026", tone: "t" },
  { id: "p4", name: "Grace Nwafor", initials: "GN", email: "grace.nwafor@enterscale.com", status: "Active", joined: "19 Feb 2026", tone: "" },
  { id: "p5", name: "Segun Ade", initials: "SA", email: "segun.ade@enterscale.com", status: "Active", joined: "01 Jun 2026", tone: "" },
  { id: "p6", name: "Halima Sani", initials: "HS", email: "halima.sani@enterscale.com", status: "Active", joined: "08 Apr 2026", tone: "t" },
  { id: "p7", name: "Peter Okoro", initials: "PO", email: "peter.okoro@enterscale.com", status: "Active", joined: "15 May 2026", tone: "t" },
  { id: "p8", name: "Rita Umeh", initials: "RU", email: "rita.umeh@enterscale.com", status: "Deactivated", joined: "30 Nov 2025", tone: "" },
  { id: "p9", name: "Bola Adeyemi", initials: "BA", email: "bola.adeyemi@enterscale.com", status: "Invited", joined: "—", tone: "t", invitedRoles: ["Moderator"], invitedAt: "Yesterday, 16:20" },
];
const staffOf = (id) => STAFF.find(p => p.id === id) || STAFF[0];
// A person holds a capability per campaign, not one role for the whole product: the agent record
// carries the call campaigns, the moderator record carries the session campaigns, and one person
// can hold both at once.
// A session capability is held as moderator OR note taker, and the two carry different powers in
// the session workspace, so they are kept apart rather than collapsed into one "mod" flag.
const sessionsFor = (rec) => rec ? SESSIONS.filter(s => s.mod === rec.id || s.note === rec.id) : [];
const roleOnSession = (rec, s) => !rec ? null : s.mod === rec.id ? "Moderator" : s.note === rec.id ? "Note taker" : null;
const capsOf = (pid) => {
  const rec = MODS.find(m => m.person === pid && m.status === "Active" && sessionsFor(m).length) || null;
  return {
    agent: AGENTS.find(a => a.person === pid && a.status === "Active" && a.campaigns.length) || null,
    session: rec,
    mod: rec && rec.role === "Moderator" ? rec : null,
    note: rec && rec.role === "Note taker" ? rec : null,
  };
};
const rolesOf = (pid) => { const { agent, session } = capsOf(pid); const r = []; if (agent) r.push("Call agent"); if (session) r.push(session.role); return r; };
const assignmentsOf = (pid) => {
  const { agent, session } = capsOf(pid); const out = [];
  if (agent) agent.campaigns.forEach(k => out.push({ campaign: k, role: "Call agent", detail: INTERVIEWS.filter(i => i.agent === agent.id && i.campaign === k && i.state !== "Cancelled").length + " interviews assigned" }));
  if (session) {
    const mine = sessionsFor(session);
    [...new Set(mine.map(s => s.camp))].forEach(k => {
      const on = mine.filter(s => s.camp === k);
      const asMod = on.filter(s => s.mod === session.id).length;
      const asNote = on.length - asMod;
      const detail = [asMod ? asMod + " session" + (asMod === 1 ? "" : "s") + " to moderate" : null, asNote ? asNote + " session" + (asNote === 1 ? "" : "s") + " taking notes" : null].filter(Boolean).join(" · ");
      out.push({ campaign: k, role: asMod && asNote ? "Moderator + note taker" : asMod ? "Moderator" : "Note taker", detail });
    });
  }
  return out;
};
const SESSION_USER = { person: "p1" };
const mePerson = () => staffOf(SESSION_USER.person);
const meCaps = () => capsOf(SESSION_USER.person);
const meAgent = () => meCaps().agent;
const meMod = () => meCaps().session;
const meSessionRole = () => { const c = meCaps(); return c.session ? c.session.role : null; };

// Mutable prototype store. The seed objects above are the single source of truth; actions mutate
// them in place and bump() re-renders the app, so a state change made on one screen is visible on
// every other screen that reads the same record.
const _subs = new Set();
const bump = () => _subs.forEach(f => f());
const commit = (obj, d) => { Object.assign(obj, d); bump(); };
const pushTo = (arr, item) => { arr.push(item); bump(); return item; };
const removeFrom = (arr, item) => { const i = arr.indexOf(item); if (i > -1) arr.splice(i, 1); bump(); };
const nid = (p) => p + Math.random().toString(36).slice(2, 8);
const useStore = () => {
  const [, set] = React.useState(0);
  React.useEffect(() => { const f = () => set(n => n + 1); _subs.add(f); return () => { _subs.delete(f); }; }, []);
};

Object.assign(window, { RES, CLIENTS, SENDER_IDS, AGENTS, AGENT_INVITES, INVITE_EXPIRY_DAYS, removeFrom, CAMPAIGNS, SCRIPT, OUTCOMES, OUTCOME_TONE, PEOPLE, INTERVIEWS, ATTEMPTS, SMS_TEMPLATES, CREDITS, ACCOUNTS, accountOf, LEDGER, AUDIT, IMPORT_ERRORS, HOURS, TEAMS, CASCADES, TARGETS, TARGET_METRICS, MISSED, QTYPES, LIKERT, SURVEY, SURVEY_AGG, SECTIONS, SCREENERS, SCREEN_OUTS, SCREEN_REASONS, OPEN_ENDS, RESPONSES, MODS, modOf, SESSIONS, sessionOf, REGS, REG_STATES, SEAT_TAKING, GUIDE, SESSION_NOTES, clientOf, campaignOf, agentOf, senderOf, money, pct, bump, commit, pushTo, useStore, nid, STAFF, staffOf, capsOf, rolesOf, assignmentsOf, SESSION_USER, mePerson, meCaps, meAgent, meMod, meSessionRole, sessionsFor, roleOnSession });
