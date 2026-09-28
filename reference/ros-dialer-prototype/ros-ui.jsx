// Research Ops Platform — UI primitives
const { useState, useEffect, useMemo, useRef } = React;

const IC = {
  home: "M2.5 6.8L8 2.4l5.5 4.4v6.4a.8.8 0 01-.8.8H3.3a.8.8 0 01-.8-.8z",
  layers: "M8 1.8l6 3.1-6 3.1-6-3.1zM2 8.6l6 3.1 6-3.1M2 11.6l6 3.1 6-3.1",
  users: "M6 7.8a2.7 2.7 0 100-5.4 2.7 2.7 0 000 5.4zM1.6 14c0-2.5 2-3.9 4.4-3.9s4.4 1.4 4.4 3.9M11 3.1a2.5 2.5 0 010 4.7M12.4 10.6c1.3.5 2 1.6 2 3.4",
  user: "M8 8.6a3.1 3.1 0 100-6.2 3.1 3.1 0 000 6.2zM2.4 14.2c0-2.8 2.5-4.4 5.6-4.4s5.6 1.6 5.6 4.4",
  msg: "M2.2 3.4h11.6v7.6H8l-3.4 3v-3H2.2z",
  cal: "M2.4 3.6h11.2v10H2.4zM2.4 6.6h11.2M5.4 1.9v2.4M10.6 1.9v2.4",
  phone: "M3 2.6h2.6l1.2 3-1.5 1.1a8.4 8.4 0 004 4l1.1-1.5 3 1.2V13a1.2 1.2 0 01-1.3 1.2A11.4 11.4 0 012 3.9 1.2 1.2 0 013.2 2.6z",
  mic: "M8 2.2a1.9 1.9 0 011.9 1.9v4a1.9 1.9 0 11-3.8 0v-4A1.9 1.9 0 018 2.2zM3.6 7.6a4.4 4.4 0 008.8 0M8 12v2.2",
  gift: "M2.4 6.6h11.2v7.2H2.4zM1.6 4.2h12.8v2.4H1.6zM8 4.2v9.6M8 4.2S6.9 1.8 5.3 1.8a1.6 1.6 0 000 3.2M8 4.2s1.1-2.4 2.7-2.4a1.6 1.6 0 010 3.2",
  card: "M1.8 3.8h12.4v8.4H1.8zM1.8 6.6h12.4",
  hash: "M5.6 2.2L4.4 13.8M11.6 2.2l-1.2 11.6M2.6 5.6h11M2 10.4h11",
  shield: "M8 1.8l5 2v4.3c0 3-2.1 5.2-5 6.1-2.9-.9-5-3.1-5-6.1V3.8z",
  grid: "M2.2 2.2h5v5h-5zM8.8 2.2h5v5h-5zM2.2 8.8h5v5h-5zM8.8 8.8h5v5h-5z",
  clock: "M8 4.2v4l2.6 1.6M8 1.6a6.4 6.4 0 100 12.8 6.4 6.4 0 000-12.8z",
  doc: "M3.4 1.8h6l3.2 3.2v9.2H3.4zM9.2 1.8V5h3.4M5.6 8.4h5M5.6 11h3.4",
  search: "M7.2 12.4a5.2 5.2 0 100-10.4 5.2 5.2 0 000 10.4zM11 11l3 3",
  plus: "M8 3v10M3 8h10",
  chev: "M6 3.5L10.5 8 6 12.5",
  back: "M10 3.5L5.5 8 10 12.5",
  up: "M8 12.5V3.5M4 7.5L8 3.5l4 4",
  check: "M2.6 8.4l3.4 3.2 7.4-7.4",
  alert: "M8 2L14.4 13.6H1.6zM8 6.2v3.4M8 11.4v.9",
  lock: "M3.6 7h8.8v6.4H3.6zM5.4 7V4.9a2.6 2.6 0 015.2 0V7",
  x: "M3.6 3.6l8.8 8.8M12.4 3.6l-8.8 8.8",
  play: "M4.4 2.6l8.4 5.4-8.4 5.4z",
  dl: "M8 2.4v7.8M4.6 7l3.4 3.4L11.4 7M2.6 13.4h10.8",
  up2: "M8 13.4V3.6M4.4 7.2L8 3.6l3.6 3.6M2.6 13.4h10.8",
  refresh: "M13.4 8a5.4 5.4 0 11-1.6-3.8M13.4 2.2v3.2h-3.2",
  bolt: "M9 1.8L3.4 9.2h4L7 14.2l5.6-7.4h-4z",
  bell: "M8 1.9a4 4 0 00-4 4c0 4-1.4 5-1.4 5h10.8s-1.4-1-1.4-5a4 4 0 00-4-4zM9.2 13.2a1.4 1.4 0 01-2.4 0",
  list: "M2.4 4h1.6M2.4 8h1.6M2.4 12h1.6M6.4 4h7.2M6.4 8h7.2M6.4 12h4.8",
  spark: "M8 1.8v3.4M8 10.8v3.4M1.8 8h3.4M10.8 8h3.4M3.6 3.6l2.4 2.4M10 10l2.4 2.4M12.4 3.6L10 6M6 10l-2.4 2.4",
  star: "M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z",
  filter: "M1.8 2.8h12.4L9.5 8.2v5.2l-3-1.8V8.2z",
  split: "M3.4 13.6V6.4a2 2 0 012-2h7.4M10.6 2.2l2.4 2.2-2.4 2.2",
};
const Icon = ({ n, size = 15, style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: "none", ...style }}><path d={IC[n] || IC.clock} /></svg>
);

const TONE = {
  Live: "g", Draft: "q", Completed: "i", Paused: "w", Archived: "q",
  Active: "g", Deactivated: "q", "Pending approval": "w", Rejected: "r", Requested: "w",
  Delivered: "g", Sent: "i", Queued: "q", Failed: "r",
  "Opted in": "g", "Opted out": "r", "No response": "q",
  Scheduled: "i", "Due today": "a", Overdue: "r", Cancelled: "q", Unscheduled: "w", Unreachable: "r",
  Issued: "g", Redeemed: "g", Pending: "w", Eligible: "a", "Not eligible": "q",
  Completed_: "g",
};
const Chip = ({ children, tone, dot }) => (
  <span className={"ch ch-" + (tone || TONE[children] || window.OUTCOME_TONE?.[children] || "q") + (dot ? " ch-dot" : "")}>{children}</span>
);

const Btn = ({ children, k, sm, lg, onClick, disabled, icon, style }) => (
  <button className={"btn" + (k ? " btn-" + k : "") + (sm ? " btn-s" : "") + (lg ? " btn-lg" : "")} onClick={onClick} disabled={disabled} style={style}>
    {icon && <Icon n={icon} size={sm ? 12 : 14} />}{children}
  </button>
);

const Av = ({ t, tone, size = 26 }) => <span className={"av" + (tone ? " " + tone : "")} style={{ width: size, height: size, fontSize: size * 0.4 }}>{t}</span>;

const Kpi = ({ l, v, unit, d, hero, trend }) => (
  <div className={"kpi" + (hero ? " hero" : "")}>
    <div className="kpi-l">{l}</div>
    <div className="kpi-v">{v}{unit && <small>{unit}</small>}</div>
    {(d || trend) && <div className="kpi-d">{trend && <span className={"trend" + (trend[0] === "−" ? " dn" : "")}>{trend} </span>}{d}</div>}
  </div>
);

const Bar = ({ pct, tone }) => <div className="bar"><i className={tone || ""} style={{ width: Math.min(100, pct) + "%" }} /></div>;

const SecH = ({ children, right, note }) => (
  <div className="sec-h"><div><div className="h2">{children}</div>{note && <div className="xs" style={{ marginTop: 2 }}>{note}</div>}</div>{right}</div>
);

const Card = ({ children, pad, className = "", style }) => <div className={"card" + (pad ? " card-p" : "") + (className ? " " + className : "")} style={style}>{children}</div>;

const Tabs = ({ items, on, set }) => (
  <div className="tabs">{items.map(t => {
    const id = typeof t === "string" ? t : t.id;
    const n = typeof t === "string" ? null : t.n;
    return <button key={id} className={"tab" + (on === id ? " on" : "")} onClick={() => set(id)}>{id}{n != null && <span className="n">{n}</span>}</button>;
  })}</div>
);

const Seg = ({ items, on, set }) => (
  <div className="seg">{items.map(i => <button key={i} className={on === i ? "on" : ""} onClick={() => set(i)}>{i}</button>)}</div>
);

const Search = ({ v, set, ph = "Search" }) => (
  <div className="search"><Icon n="search" size={13} /><input type="text" value={v} placeholder={ph} onChange={e => set(e.target.value)} /></div>
);

const Sel = ({ v, set, opts, all }) => (
  <select className="inline-sel" value={v} onChange={e => set(e.target.value)}>
    {all && <option value="">{all}</option>}
    {opts.map(o => typeof o === "string" ? <option key={o} value={o}>{o}</option> : <option key={o.v} value={o.v}>{o.l}</option>)}
  </select>
);

const Field = ({ l, hint, children }) => (
  <label className="field"><span className="field-l">{l}</span>{hint && <span className="field-h">{hint}</span>}{children}</label>
);

const Note = ({ children, tone, head }) => (
  <div className={"note" + (tone ? " " + tone : "")}>{head && <b>{head}</b>}{children}</div>
);

const Empty = ({ head, children, action }) => (
  <div className="empty"><b>{head}</b><div className="sm">{children}</div>{action && <div style={{ marginTop: 12 }}>{action}</div>}</div>
);

const Modal = ({ open, close, title, children, foot, wide }) => {
  useEffect(() => {
    if (!open) return;
    const k = e => e.key === "Escape" && close();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, close]);
  if (!open) return null;
  return (
    <div className="scrim" onClick={close}>
      <div className={"modal" + (wide ? " wide" : "")} onClick={e => e.stopPropagation()}>
        <div className="modal-h"><h3>{title}</h3><button className="x" onClick={close} aria-label="Close"><Icon n="x" size={13} /></button></div>
        <div className="modal-b">{children}</div>
        {foot && <div className="modal-f">{foot}</div>}
      </div>
    </div>
  );
};

const Menu = ({ items, label = "\u2022\u2022\u2022" }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => { if (!open) return; const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, [open]);
  return (
    <div className="menu-wrap" ref={ref}>
      <button className="btn btn-s" onClick={() => setOpen(o => !o)} aria-haspopup="true" aria-expanded={open}>{label}</button>
      {open && <div className="menu-pop">{items.filter(Boolean).map((it, i) => it.sep ? <div key={i} className="menu-sep" /> : (
        <button key={i} className={"menu-item" + (it.tone === "r" ? " r" : "")} onClick={() => { setOpen(false); it.onClick(); }}>{it.label}</button>
      ))}</div>}
    </div>
  );
};

const Toast = ({ msg }) => msg ? <div className="toast">{msg}</div> : null;

const useToast = () => {
  const [msg, setMsg] = useState("");
  const t = useRef();
  return [msg, (m) => { setMsg(m); clearTimeout(t.current); t.current = setTimeout(() => setMsg(""), 2600); }];
};

// Masked phone — what an agent's session can ever hold
const Masked = () => <span className="masked">•••• ••• ••••</span>;

const Lock = ({ children }) => <span className="lockup"><Icon n="lock" size={11} />{children}</span>;

const Table = ({ head, children, scroll }) => (
  <div className={"tbl-w" + (scroll ? " scroll" : "")}>
    <table className="t"><thead><tr>{head.map((h, i) => <th key={i} className={h && h.num ? "num" : ""} style={h && h.w ? { width: h.w } : null}>{typeof h === "string" ? h : h.l}</th>)}</tr></thead>
      <tbody>{children}</tbody></table>
  </div>
);

Object.assign(window, { Icon, IC, Chip, Btn, Av, Kpi, Bar, SecH, Card, Tabs, Seg, Search, Sel, Field, Note, Empty, Modal, Menu, Toast, useToast, Masked, Lock, Table, TONE });
