import { getBackend } from "/assets/data.js";
const form = document.getElementById("sub-form"), email = document.getElementById("sub-email"),
  consent = document.getElementById("sub-consent"), msg = document.getElementById("sub-msg"),
  btn = document.getElementById("sub-btn");
const backend = await getBackend();
form.addEventListener("submit", async e => {
  e.preventDefault();
  const v = email.value.trim().toLowerCase();
  if (v.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)){ msg.textContent = "Please enter a valid email address."; email.focus(); return; }
  if (!consent.checked){ msg.textContent = "Please tick the box to agree before subscribing."; return; }
  btn.disabled = true; btn.textContent = "Saving...";
  try {
    await backend.addSubscriber(v, "subscribe");
    form.hidden = true; document.getElementById("sub-done").hidden = false;
  } catch (err){
    msg.textContent = "Something went wrong. Please try again."; btn.disabled = false; btn.textContent = "Subscribe";
  }
});
