import { getBackend } from "/assets/data.js";
import { EVENTS } from "/assets/events.js";

const be = await getBackend();
const $ = id => document.getElementById(id);
const fmt = ms => ms ? new Date(ms).toLocaleDateString("en-CA") : "-";
let regs = [], subs = [];
let eventId = Object.keys(EVENTS)[0];
let fails = 0, lockedUntil = 0;

function td(text){ const c = document.createElement("td"); c.textContent = text; return c; }
function btn(text, fn){ const b = document.createElement("button"); b.className = "btn-s"; b.textContent = text; b.addEventListener("click", fn); return b; }

/* ---------- Sign-in ---------- */
if (!be.isLive){
  $("email").hidden = true;
  $("pw").placeholder = "Demo passcode";
  $("gate-msg").textContent = "Demo mode. Enter the demo passcode.";
  $("mode-note").hidden = false;
}
async function signIn(){
  const err = $("err");
  if (Date.now() < lockedUntil){ err.textContent = "Too many attempts. Wait a moment."; return; }
  try { await be.signIn($("email").value.trim(), $("pw").value); err.textContent = ""; }
  catch (e){
    fails++;
    err.textContent = "Sign-in failed.";
    if (fails >= 3){ lockedUntil = Date.now() + 30000; fails = 0; err.textContent = "Locked for 30 seconds."; }
  }
  $("pw").value = "";
}
$("go").addEventListener("click", signIn);
$("pw").addEventListener("keydown", e => { if (e.key === "Enter") signIn(); });
$("signout").addEventListener("click", () => be.signOut());
be.onAuth(user => {
  $("gate").hidden = !!user;
  $("content").hidden = !user;
  if (user){ $("who").textContent = user.email; refresh(); }
  else { regs = []; subs = []; renderAll(); }
});

/* ---------- Data ---------- */
async function refresh(){
  try {
    regs = await be.listRegistrations();
    subs = await be.listSubscribers();
    $("denied").hidden = true;
  } catch (e){
    regs = []; subs = [];
    $("denied").hidden = false;
  }
  renderAll();
  updateOpen();
}
async function updateOpen(){
  const open = await be.registrationOpen(eventId);
  $("open-label").textContent = "Registration is " + (open ? "open" : "closed");
  $("toggle-open").textContent = open ? "Close registration" : "Open registration";
  $("toggle-open").dataset.open = String(open);
}
$("toggle-open").addEventListener("click", async () => {
  const open = $("toggle-open").dataset.open === "true";
  if (!confirm(open ? "Close registration for this event?" : "Re-open registration for this event?")) return;
  await be.setRegistrationOpen(eventId, !open);
  updateOpen();
});
$("refresh").addEventListener("click", refresh);

/* ---------- Render ---------- */
function renderAll(){ renderRegs(); renderSubs(); }
function renderRegs(){
  const rows = regs.filter(r => r.eventId === eventId).sort((a,b) => b.createdAt - a.createdAt);
  const sum = k => rows.reduce((n, r) => n + (r[k] || 0), 0);
  const stats = $("stats"); stats.replaceChildren();
  [["Registrations", rows.length], ["Adults", sum("adults")], ["Children", sum("children")], ["Total ticket sales", "$" + sum("total").toFixed(2)]].forEach(([l, v]) => {
    const c = document.createElement("div"); c.className = "card";
    const n = document.createElement("div"); n.className = "num"; n.textContent = v;
    const t = document.createElement("div"); t.className = "updated"; t.textContent = l;
    c.append(n, t); stats.append(c);
  });
  const body = $("regs-body"); body.replaceChildren();
  if (!rows.length){ const tr = document.createElement("tr"); const c = td("No registrations."); c.colSpan = 9; tr.append(c); body.append(tr); return; }
  rows.forEach(r => {
    const tr = document.createElement("tr");
    const sel = document.createElement("select");
    ["Not paid", "Paid"].forEach(o => { const op = document.createElement("option"); op.textContent = o; if (r.status === o) op.selected = true; sel.append(op); });
    sel.addEventListener("change", async () => { try { await be.updateStatus(r.id, sel.value); r.status = sel.value; } catch (e){ sel.value = r.status; } });
    const sc = document.createElement("td"); sc.append(sel);
    const dc = document.createElement("td");
    dc.append(btn("Delete", async () => {
      if (!confirm("Delete this registration permanently?")) return;
      await be.deleteRegistration(r.id); refresh();
    }));
    tr.append(td(r.name), td(r.email), td(r.adults), td(r.children), td("$" + Number(r.total).toFixed(2)), sc, td(fmt(r.createdAt)), td(fmt(r.deleteAt)), dc);
    body.append(tr);
  });
}
function renderSubs(){
  const rows = subs.slice().sort((a,b) => a.email.localeCompare(b.email));
  $("subs-count").textContent = rows.length + (rows.length === 1 ? " subscriber" : " subscribers");
  const body = $("subs-body"); body.replaceChildren();
  if (!rows.length){ const tr = document.createElement("tr"); const c = td("No subscribers yet."); c.colSpan = 4; tr.append(c); body.append(tr); return; }
  rows.forEach(s => {
    const tr = document.createElement("tr");
    const dc = document.createElement("td");
    dc.append(btn("Remove", async () => {
      if (!confirm("Remove " + s.email + " from the email list?")) return;
      await be.removeSubscriber(s.email); refresh();
    }));
    tr.append(td(s.email), td(fmt(s.consentAt)), td(EVENTS[s.source] ? EVENTS[s.source].name : s.source), dc);
    body.append(tr);
  });
}

/* ---------- Tabs, event select ---------- */
document.querySelectorAll(".tab2").forEach(b => b.addEventListener("click", () => {
  document.querySelectorAll(".tab2").forEach(x => x.classList.toggle("active", x === b));
  $("tab-regs").hidden = b.dataset.tab !== "regs";
  $("tab-subs").hidden = b.dataset.tab !== "subs";
}));
Object.values(EVENTS).forEach(ev => { const o = document.createElement("option"); o.value = ev.id; o.textContent = ev.name; $("event-select").append(o); });
$("event-select").addEventListener("change", e => { eventId = e.target.value; renderRegs(); updateOpen(); });

/* ---------- CSV / clipboard ---------- */
function csvCell(v){
  let s = String(v == null ? "" : v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;   // block spreadsheet formula injection
  return '"' + s.replace(/"/g, '""') + '"';
}
function download(name, rows){
  const csv = rows.map(r => r.map(csvCell).join(",")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = name; document.body.append(a); a.click(); a.remove();
}
$("export-regs").addEventListener("click", () => {
  const rows = regs.filter(r => r.eventId === eventId);
  download(eventId + "-registrations.csv", [["Name","Email","Adults","Children","Total","Status","Registered","Auto-deletes"]].concat(
    rows.map(r => [r.name, r.email, r.adults, r.children, r.total, r.status, fmt(r.createdAt), fmt(r.deleteAt)])));
});
$("export-subs").addEventListener("click", () => {
  download("email-list.csv", [["Email","Consent given","Source"]].concat(subs.map(s => [s.email, fmt(s.consentAt), s.source])));
});
$("copy-subs").addEventListener("click", async () => {
  const text = subs.map(s => s.email).join(", ");
  try { await navigator.clipboard.writeText(text); $("copy-subs").textContent = "Copied!"; }
  catch (e){ $("copy-subs").textContent = "Copy failed"; }
  setTimeout(() => { $("copy-subs").textContent = "Copy all emails"; }, 1800);
});
