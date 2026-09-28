// Research Ops Platform — shell
const { useState: sS, useEffect: sE } = React;

const ADMIN_NAV = [
  { g: "Operate" },
  { id: "overview", l: "Overview", i: "home" },
  { id: "campaigns", l: "Campaigns", i: "layers" },
  { id: "contacts", l: "Contacts", i: "users" },
  { id: "scheduling", l: "Consent & scheduling", i: "cal", badge: 6 },
  { id: "activity", l: "Call activity", i: "phone" },
  { id: "dialer", l: "Dialer calls", i: "mic", live: true },
  { g: "Insight" },
  { id: "reports", l: "Reports", i: "grid" },
  { id: "recordings", l: "Recordings", i: "mic" },
  { id: "incentives", l: "Incentives", i: "gift" },
  { g: "People" },
  { id: "people", l: "People", i: "user" },
  { id: "agents", l: "Agents", i: "phone" },
  { id: "teams", l: "Teams", i: "users" },
  { id: "targets", l: "Targets", i: "bolt" },
  { g: "Set up" },
  { id: "senders", l: "Sender IDs", i: "hash", badge: 1, q: true },
  { id: "credits", l: "Credits", i: "card", badge: 1 },
  { id: "audit", l: "Settings & audit", i: "shield" },
];
// The staff nav is the same four items whatever mix of roles the person holds — only the labels
// and counts change, so someone who is an agent here and a moderator there has one workspace.
const staffNav = () => {
  const { agent, session } = meCaps();
  const both = agent && session;
  return [
    { id: "home", l: both ? "Your day" : agent ? "Today's queue" : session ? "My sessions" : "Your day", i: "home", live: true },
    { id: "upcoming", l: "Upcoming", i: "cal" },
    { id: "history", l: both || !agent && !session ? "History" : agent ? "Call history" : "Session history", i: "doc" },
    { id: "profile", l: "Profile", i: "user" },
  ];
};

const TITLES = {
  overview: ["Overview", ""],
  campaigns: ["Campaigns", "All clients"],
  scheduling: ["Consent & scheduling", "Operate"],
  activity: ["Call activity", "Operate"],
  dialer: ["Dialer calls", "Operate · Audit"],
  contacts: ["Contacts", "Operate"],
  reports: ["Reports", "Insight"],
  recordings: ["Recordings", "Insight"],
  incentives: ["Incentives", "Insight"],
  people: ["People", "Agency team"],
  agents: ["Agents", "People"],
  teams: ["Teams", "People"],
  targets: ["Targets & leader board", "People"],
  senders: ["Sender IDs", "Set up"],
  credits: ["Credits & billing", "Set up"],
  audit: ["Settings & audit", "Set up"],
  "new-campaign": ["New campaign", "Campaigns"],
  upcoming: ["Upcoming", "Scheduled ahead"],
  profile: ["Profile", "Your account"],
  call: ["Call workspace", "Live interview"],
  session: ["Session workspace", "Focus group"],
};

function App() {
  useStore();
  const [role, setRole] = sS(() => { const r = localStorage.getItem("ros.role") || "admin"; return r === "agent" || r === "moderator" ? "staff" : r; });
  const [view, setView] = sS(() => localStorage.getItem("ros.view") || "overview");
  const [arg, setArg] = sS(() => localStorage.getItem("ros.arg") || null);
  const [toastMsg, toast] = useToast();

  sE(() => { localStorage.setItem("ros.role", role); localStorage.setItem("ros.view", view); if (arg) localStorage.setItem("ros.arg", arg); }, [role, view, arg]);

  const go = (v, a) => { setView(v); setArg(a || null); window.scrollTo(0, 0); };
  const switchRole = (r) => { setRole(r); setView(r === "admin" ? "overview" : r === "participant" ? "public" : "home"); setArg(null); window.scrollTo(0, 0); };
  sE(() => { if (role === "staff" && !rolesOf(SESSION_USER.person).length) { SESSION_USER.person = "p1"; bump(); } }, [role]);

  if (role === "participant") return <><Participant toast={toast} switcher={<RoleSwitch role={role} set={switchRole} />} /><Toast msg={toastMsg} /></>;
  if (role === "invite") return <><AgentInviteFlow toast={toast} switcher={<RoleSwitch role={role} set={switchRole} />} onDone={() => switchRole("staff")} /><Toast msg={toastMsg} /></>;

  const staff = role === "staff";
  const caps = meCaps();
  const person = mePerson();
  const nav = role === "admin" ? ADMIN_NAV : staffNav();
  const todo = staff ? workToday().length : 0;
  const liveN = LIVE_SEED.length + (DIAL.call && (DIAL.phase === "consent" || DIAL.phase === "live") ? 1 : 0);
  const camp = view === "campaign" ? campaignOf(arg) : null;
  const roleLine = staff ? rolesOf(person.id).join(" · ") || "No campaigns assigned" : "";
  const [title, crumb] = camp ? [camp.name, clientOf(camp.client).name + " · Campaign"]
    : staff && view === "home" ? [caps.agent && caps.session ? "Your day" : caps.agent ? "Today's queue" : caps.session ? "My sessions" : "Your day", person.name + " · " + roleLine]
      : staff && view === "history" ? ["History", roleLine]
        : (TITLES[view] || ["", ""]);

  return (
    <div className="app">
      <aside className="sb">
        <div className="sb-top">
          <div className="sb-wm"><img src={RES("logoWhite", "assets/enterscale-white.png")} alt="Enterscale" /></div>
          <div className="sb-sub"></div>
        </div>
        <nav className="sb-nav">
          {nav.map((n, i) => n.g
            ? <div key={"g" + i} className="sb-grp">{n.g}</div>
            : <button key={n.id} className={"nv" + (view === n.id || (n.id === "campaigns" && view === "campaign") ? " on" : "")} onClick={() => go(n.id)}>
              <Icon n={n.i} size={15} /><span className="lbl">{n.l}</span>
              {(n.id === "dialer" ? liveN : n.live ? todo : n.badge) ? <span className={"nv-badge" + (n.q ? " q" : "")}>{n.id === "dialer" ? liveN : n.live ? todo : n.badge}</span> : null}
            </button>)}
        </nav>
        <div className="sb-foot">
          <div className="who">
            <Av t={staff ? person.initials : "TD"} size={30} tone={staff ? (caps.agent && caps.session ? "o" : caps.session ? "t" : "") : "o"} />
            <div><div className="who-n">{staff ? person.name : "Toni Dada"}</div><div className="who-r">{staff ? roleLine : "Agency admin"}</div></div>
          </div>
          {staff && <StaffPicker />}
          <RoleSwitch role={role} set={switchRole} />
        </div>
      </aside>

      <div className="main">
        <header className="top">
          {(view === "campaign" || view === "call" || view === "session" || view === "new-campaign") && (
            <button className="x" onClick={() => go(view === "call" || view === "session" ? "home" : "campaigns")} aria-label="Back"><Icon n="back" size={15} /></button>
          )}
          <div className="top-title">
            <div className="crumb">{crumb}</div>
            <h1>{title}</h1>
          </div>
          <div className="top-r">
            {camp && <><span className={"ctype" + (camp.type === "survey" ? " s" : camp.type === "focus" ? " f" : "")}><Icon n={camp.type === "survey" ? "doc" : camp.type === "focus" ? "users" : "phone"} size={11} />{camp.type === "survey" ? "Survey" : camp.type === "focus" ? "Focus group" : "Interview"}</span><Chip dot>{camp.status}</Chip><Btn sm icon="bolt" onClick={() => toast("Campaign paused")}>Pause</Btn></>}
            {role === "admin" && !camp && <span className="lockup"><Icon n="msg" size={11} />{money(ACCOUNTS[0].balance)}</span>}
            {role === "admin" && !camp && <span className="lockup" style={ACCOUNTS[1].balance < ACCOUNTS[1].lowAt ? { borderColor: "#EED9D5", background: "var(--red-soft)", color: "var(--red)" } : null}><Icon n="phone" size={11} />{money(ACCOUNTS[1].balance)}</span>}
            {role === "agent" && <span className="lockup"><Icon n="lock" size={11} />Numbers hidden</span>}
            {role === "moderator" && <span className="lockup"><Icon n="lock" size={11} />Aliases only</span>}
            <NotifBell role={role} go={go} />
          </div>
        </header>

        {role === "admin" ? <>
          {view === "overview" && <AdminOverview go={go} toast={toast} />}
          {view === "campaigns" && <AdminCampaigns go={go} />}
          {view === "campaign" && <CampaignDetail id={arg} go={go} toast={toast} />}
          {view === "new-campaign" && <NewCampaign go={go} toast={toast} />}
          {view === "scheduling" && <AdminScheduling go={go} toast={toast} />}
          {view === "contacts" && <AdminContacts go={go} toast={toast} />}
          {view === "activity" && <AdminActivity go={go} toast={toast} />}
          {view === "dialer" && <AdminDialer toast={toast} />}
          {view === "recordings" && <AdminRecordings toast={toast} />}
          {view === "incentives" && <AdminIncentives toast={toast} />}
          {view === "agents" && <AdminAgents go={go} toast={toast} />}
          {view === "people" && <AdminPeople go={go} toast={toast} open={arg} />}
          {view === "teams" && <AdminTeams toast={toast} />}
          {view === "targets" && <AdminTargets toast={toast} />}
          {view === "reports" && <AdminReports toast={toast} />}
          {view === "senders" && <AdminSenders toast={toast} />}
          {view === "credits" && <AdminCredits toast={toast} />}
          {view === "audit" && <AdminAudit toast={toast} go={go} />}
        </> : <>
          {view === "home" && <StaffHome go={go} toast={toast} />}
          {view === "upcoming" && <StaffUpcoming go={go} />}
          {view === "call" && <CallWorkspace2 id={arg} go={go} toast={toast} />}
          {view === "session" && <ModWorkspace id={arg} go={go} toast={toast} />}
          {view === "history" && <StaffHistory go={go} />}
          {view === "profile" && <StaffProfile toast={toast} />}
        </>}
      </div>
      {staff && <DialerDock toast={toast} go={go} />}
      <Toast msg={toastMsg} />
    </div>
  );
}

const RoleSwitch = ({ role, set }) => (
  <div className="rsw">
    {[["admin", "Admin"], ["staff", "Staff"], ["participant", "Participant"], ["invite", "Invite"]].map(([k, l]) => (
      <button key={k} className={role === k ? "on" : ""} onClick={() => set(k)}>{l}</button>
    ))}
  </div>
);

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
