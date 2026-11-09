import { getBackend } from "/assets/data.js";

const cards = document.querySelectorAll(".event[data-event]");
try {
  const be = await getBackend();
  await Promise.all(Array.from(cards).map(async card => {
    const reg = card.querySelector(".reg");
    const label = card.querySelector(".reglabel");
    try {
      const open = await be.registrationOpen(card.dataset.event);
      reg.dataset.state = open ? "open" : "closed";
      label.textContent = open ? "Registration open" : "Registration closed";
    } catch (e){ reg.hidden = true; }
  }));
} catch (e){
  cards.forEach(c => { const r = c.querySelector(".reg"); if (r) r.hidden = true; });
}
