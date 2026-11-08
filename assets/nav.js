import { EVENTS } from "/assets/events.js";

const btn = document.getElementById("events-btn");
const menu = document.getElementById("events-menu");
if (btn && menu){
  // Build the menu from the events list so new events appear automatically.
  menu.replaceChildren();
  Object.values(EVENTS).forEach(ev => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = "/" + ev.id + "/";
    a.textContent = ev.name;
    li.append(a); menu.append(li);
  });
  const close = () => { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); };
  btn.addEventListener("click", e => {
    e.stopPropagation();
    const open = menu.hidden;
    menu.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("click", close);
  document.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
}
