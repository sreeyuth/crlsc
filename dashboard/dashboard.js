import { getBackend } from "/assets/data.js";
import { EVENTS } from "/assets/events.js";

const be = await getBackend();
const $ = id => document.getElementById(id);
const fmt = ms => ms ? new Date(ms).toLocaleDateString("en-CA") : "-";
let regs = [], subs = [];
let eventId = Object.keys(EVENTS)[0];
let fails = 0, lockedUntil = 0;

function td(text){ const c = document.createElement("td"); c.textContent = text; return c; }
function mark(sel, good){ sel.classList.toggle("sel-good", sel.value === good); }
function btn(text, fn, cls){ const b = document.createElement("button"); b.className = cls || "btn-s"; b.textContent = text; b.addEventListener("click", fn); return b; }

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
  const word = document.createElement("strong");
  word.textContent = open ? "open" : "closed";
  word.className = open ? "state-open" : "state-closed";
  $("open-label").replaceChildren("Registration is ", word);
  $("toggle-open").textContent = open ? "Close registration" : "Open registration";
  $("toggle-open").className = open ? "btn-close" : "btn-open";
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
  const ev = EVENTS[eventId];
  const rows = regs.filter(r => r.eventId === eventId).sort((a,b) => b.createdAt - a.createdAt);
  const sum = k => rows.reduce((n, r) => n + (Number(r[k]) || 0), 0);
  const headcount = rows.reduce((n, r) => n + ev.headcount(r), 0);
  const stats = $("stats"); stats.replaceChildren();
  const pickedUp = rows.filter(r => r.ticketStatus === "Picked up").length;
  const cards = [["Registrations", rows.length], ["Total attendees", headcount]]
    .concat(ev.counts.map(c => [c.label, sum(c.key)]))
    .concat([["Tickets picked up", pickedUp + " of " + rows.length]])
    .concat([["Total ticket sales", "$" + sum("total").toFixed(2)]]);
  cards.forEach(([l, v]) => {
    const c = document.createElement("div"); c.className = "card";
    const n = document.createElement("div"); n.className = "num"; n.textContent = v;
    const t = document.createElement("div"); t.className = "updated"; t.textContent = l;
    c.append(n, t); stats.append(c);
  });
  const heads = ["Name", "Email"].concat(ev.counts.map(c => c.label), ev.extras.map(x => x.label), ["Total", "Payment", "Tickets", "Registered", "Auto-deletes", ""]);
  const tr0 = document.createElement("tr");
  heads.forEach(t => { const th = document.createElement("th"); th.textContent = t; tr0.append(th); });
  $("regs-head").replaceChildren(tr0);
  const body = $("regs-body"); body.replaceChildren();
  if (!rows.length){ const tr = document.createElement("tr"); const c = td("No registrations."); c.colSpan = heads.length; tr.append(c); body.append(tr); return; }
  rows.forEach(r => {
    const tr = document.createElement("tr");
    const sel = document.createElement("select");
    ["Not paid", "Paid"].forEach(o => { const op = document.createElement("option"); op.textContent = o; if (r.status === o) op.selected = true; sel.append(op); });
    mark(sel, "Paid");
    sel.addEventListener("change", async () => { try { await be.updateStatus(r.id, sel.value); r.status = sel.value; } catch (e){ sel.value = r.status; } mark(sel, "Paid"); });
    const sc = document.createElement("td"); sc.append(sel);
    const tsel = document.createElement("select");
    ["Not picked up", "Picked up"].forEach(o => { const op = document.createElement("option"); op.textContent = o; if ((r.ticketStatus || "Not picked up") === o) op.selected = true; tsel.append(op); });
    mark(tsel, "Picked up");
    tsel.addEventListener("change", async () => {
      const prev = r.ticketStatus || "Not picked up";
      try { await be.updateTicketStatus(r.id, tsel.value); r.ticketStatus = tsel.value; renderRegs(); } catch (e){ tsel.value = prev; }
    });
    const tc = document.createElement("td"); tc.append(tsel);
    const dc = document.createElement("td");
    dc.append(btn("Delete", async () => {
      if (!confirm("Delete this registration permanently?")) return;
      await be.deleteRegistration(r.id); refresh();
    }, "btn-danger"));
    tr.append(td(r.name), td(r.email));
    ev.counts.forEach(c => tr.append(td(r[c.key] == null ? "" : r[c.key])));
    ev.extras.forEach(x => tr.append(td(r[x.key] || "-")));
    tr.append(td("$" + Number(r.total).toFixed(2)), sc, tc, td(fmt(r.createdAt)), td(fmt(r.deleteAt)), dc);
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
    }, "btn-danger"));
    tr.append(td(s.email), td(fmt(s.consentAt)), td(EVENTS[s.source] ? EVENTS[s.source].name : (s.source === "manual" ? "Added manually" : (s.source === "subscribe" ? "Subscribe page" : s.source))), dc);
    body.append(tr);
  });
}

/* ---------- Add subscriber manually ---------- */
const addForm = $("add-sub-form"), addInput = $("add-sub-email"), addMsg = $("add-sub-msg");
$("add-sub-btn").addEventListener("click", () => { addForm.hidden = false; addMsg.textContent = ""; addInput.value = ""; addInput.focus(); });
$("add-sub-cancel").addEventListener("click", () => { addForm.hidden = true; });
addForm.addEventListener("submit", async ev => {
  ev.preventDefault();
  const parts = [...new Set(addInput.value.split(/[;\n,]+/).map(x => x.trim().toLowerCase()).filter(Boolean))];
  if (!parts.length){ addMsg.textContent = "Please enter at least one email address."; return; }
  const ok = /^[^@\s]+@[^@\s]+\.[^@\s]+$/, bad = [];
  let added = 0, dup = 0, failed = 0;
  for (const e of parts){
    if (e.length > 254 || !ok.test(e)){ bad.push(e); continue; }
    try { (await be.addSubscriberManual(e)) ? added++ : dup++; } catch (err){ failed++; bad.push(e); }
  }
  const msg = [];
  if (added) msg.push(added + " added");
  if (dup) msg.push(dup + " already on the list");
  if (bad.length) msg.push(bad.length + " not added" + (failed ? "" : " (invalid)") + ": " + bad.join("; "));
  addMsg.textContent = msg.join(". ") + ".";
  addInput.value = bad.join("; ");
  if (added) await refresh();
});

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
  const ev = EVENTS[eventId];
  const rows = regs.filter(r => r.eventId === eventId);
  const head = ["Name", "Email"].concat(ev.counts.map(c => c.label), ev.extras.map(x => x.label), ["Total", "Payment", "Tickets", "Registered", "Auto-deletes"]);
  download(eventId + "-registrations.csv", [head].concat(rows.map(r =>
    [r.name, r.email].concat(ev.counts.map(c => r[c.key]), ev.extras.map(x => r[x.key] || ""), [r.total, r.status, r.ticketStatus || "Not picked up", fmt(r.createdAt), fmt(r.deleteAt)]))));
});
$("export-pdf").addEventListener("click", () => {
  const ev = EVENTS[eventId];
  const rows = regs.filter(r => r.eventId === eventId).sort((a, b) => a.name.localeCompare(b.name));
  if (!window.jspdf){ alert("PDF export is not available."); return; }
  const head = ["Name"].concat(ev.counts.map(c => c.label), ev.extras.map(x => x.label), ["Total", "Payment", "Tickets", "Attended"]);
  const attendedCol = head.length - 1;
  const doc = new window.jspdf.jsPDF({ unit: "pt", format: "letter", orientation: head.length > 7 ? "landscape" : "portrait" });
  doc.setFontSize(16); doc.text(ev.name + " - Registration roster", 40, 44);
  doc.setFontSize(10);
  const people = rows.reduce((n, r) => n + ev.headcount(r), 0);
  const total = rows.reduce((n, r) => n + (r.total || 0), 0);
  doc.text(ev.date + "  |  " + rows.length + " registrations  |  " + people + " attendees  |  $" + total.toFixed(2), 40, 62);
  doc.autoTable({
    startY: 76,
    head: [head],
    body: rows.map(r => [r.name].concat(ev.counts.map(c => r[c.key]), ev.extras.map(x => r[x.key] || "-"), ["$" + Number(r.total).toFixed(2), r.status, r.ticketStatus || "Not picked up", ""])),
    styles: { fontSize: 10, cellPadding: 5, minCellHeight: 22 },
    headStyles: { fillColor: [11, 90, 140] },
    columnStyles: { [attendedCol]: { cellWidth: 60 } },
    didDrawCell: d => {
      if (d.section === "body" && d.column.index === attendedCol){
        const s = 11;
        doc.setDrawColor(60); doc.rect(d.cell.x + (d.cell.width - s) / 2, d.cell.y + (d.cell.height - s) / 2, s, s);
      }
    }
  });
  doc.save(eventId + "-roster.pdf");
});
$("export-subs").addEventListener("click", () => {
  download("email-list.csv", [["Email","Consent given","Source"]].concat(subs.map(s => [s.email, fmt(s.consentAt), s.source])));
});
$("copy-subs").addEventListener("click", async () => {
  const text = subs.map(s => s.email).join("; ");
  try { await navigator.clipboard.writeText(text); $("copy-subs").textContent = "Copied!"; }
  catch (e){ $("copy-subs").textContent = "Copy failed"; }
  setTimeout(() => { $("copy-subs").textContent = "Copy all emails"; }, 1800);
});
