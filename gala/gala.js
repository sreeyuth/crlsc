import { getBackend } from "/assets/data.js";
import { EVENTS } from "/assets/events.js";

const EVENT_ID = "gala";
const EV = EVENTS[EVENT_ID];
const backend = await getBackend();
if (backend.isLive){ const b = document.getElementById("demo-banner"); if (b) b.remove(); }

const nameInput = document.getElementById("reg-name");
const emailInput = document.getElementById("reg-email");
const individualSelect = document.getElementById("reg-individual");
const tableSelect = document.getElementById("reg-table");
const dietaryInput = document.getElementById("reg-dietary");
const pickupSelect = document.getElementById("reg-pickup");
const totalAmountEl = document.getElementById("total-amount");
const etransferAmountEl = document.getElementById("etransfer-amount");
const confirmToggleBtn = document.getElementById("etransfer-confirm-btn");
const submitBtn = document.getElementById("submit-btn");
const helperText = document.getElementById("helper-text");
const form = document.getElementById("reg-form");
const formView = document.getElementById("form-view");
const confirmView = document.getElementById("confirm-view");
const consentEmails = document.getElementById("consent-emails");
const consentPrivacy = document.getElementById("consent-privacy");

let etransferConfirmed = false;

function populateCountSelect(selectEl, max){
  for (let i = 0; i <= max; i++){
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = String(i);
    selectEl.appendChild(opt);
  }
}
populateCountSelect(individualSelect, 20);
populateCountSelect(tableSelect, 5);

function ticketCounts(){
  return {
    individual: parseInt(individualSelect.value, 10) || 0,
    tables: parseInt(tableSelect.value, 10) || 0
  };
}
function currentPartySize(){ const c = ticketCounts(); return c.individual + c.tables * EV.tableSize; }
function currentTotal(){ const c = ticketCounts(); return c.individual * EV.ticketPrice + c.tables * EV.tablePrice; }

function refreshTotals(){
  const formatted = "$" + currentTotal().toFixed(2);
  totalAmountEl.textContent = formatted;
  etransferAmountEl.textContent = formatted;
  updateSubmitState();
}

function updateSubmitState(){
  const nameOk = nameInput.value.trim().length > 0;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value.trim());
  const partyOk = currentPartySize() >= 1;
  const consentOk = consentPrivacy.checked;
  const ready = nameOk && emailOk && partyOk && etransferConfirmed && consentOk;
  submitBtn.disabled = !ready;
  submitBtn.classList.toggle("enabled", ready);
  if (!etransferConfirmed){
    helperText.textContent = "Confirm you've sent the e-transfer above to activate submission.";
  } else if (!nameOk){
    helperText.textContent = "Add your name to finish reserving your seat.";
  } else if (!emailOk){
    helperText.textContent = "Add a valid email so we can reach you.";
  } else if (!partyOk){
    helperText.textContent = "Select at least one ticket or table.";
  } else if (!consentOk){
    helperText.textContent = "Tick the privacy consent box above to continue.";
  } else {
    helperText.textContent = "You're all set — confirm below.";
  }
}

[individualSelect, tableSelect].forEach(sel => sel.addEventListener("change", refreshTotals));
nameInput.addEventListener("input", updateSubmitState);
emailInput.addEventListener("input", updateSubmitState);
consentPrivacy.addEventListener("change", updateSubmitState);

confirmToggleBtn.addEventListener("click", () => {
  etransferConfirmed = !etransferConfirmed;
  confirmToggleBtn.classList.toggle("selected", etransferConfirmed);
  confirmToggleBtn.setAttribute("aria-pressed", String(etransferConfirmed));
  updateSubmitState();
});

const copyEmailBtn = document.getElementById("copy-email-btn");
copyEmailBtn.addEventListener("click", async () => {
  const email = "crsocclb@cnl.ca";
  try {
    await navigator.clipboard.writeText(email);
  } catch (err){
    const temp = document.createElement("textarea");
    temp.value = email;
    temp.style.position = "fixed";
    temp.style.opacity = "0";
    document.body.appendChild(temp);
    temp.select();
    try { document.execCommand("copy"); } catch (e2){}
    document.body.removeChild(temp);
  }
  const original = copyEmailBtn.textContent;
  copyEmailBtn.textContent = "Copied!";
  copyEmailBtn.classList.add("copied");
  setTimeout(() => { copyEmailBtn.textContent = original; copyEmailBtn.classList.remove("copied"); }, 1800);
});

refreshTotals();

/* ---------- Registration open/closed ---------- */
if (!(await backend.registrationOpen(EVENT_ID))){
  formView.hidden = true;
  document.getElementById("closed-view").hidden = false;
}

/* ---------- Submit ---------- */
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (submitBtn.disabled) return;
  submitBtn.disabled = true;
  submitBtn.textContent = "Saving...";
  const counts = ticketCounts();
  try {
    await backend.addRegistration(EVENT_ID, {
      name: nameInput.value, email: emailInput.value,
      individual: counts.individual, tables: counts.tables,
      dietary: dietaryInput.value, pickup: pickupSelect.value
    });
    if (consentEmails.checked) await backend.addSubscriber(emailInput.value, EVENT_ID);
    submitBtn.textContent = "Complete Registration";
    formView.hidden = true;
    confirmView.hidden = false;
  } catch (err){
    submitBtn.textContent = "Complete Registration";
    submitBtn.disabled = false;
    helperText.textContent = "Something went wrong saving your registration. Please try again.";
  }
});

document.getElementById("register-another").addEventListener("click", () => {
  form.reset();
  etransferConfirmed = false;
  confirmToggleBtn.classList.remove("selected");
  confirmToggleBtn.setAttribute("aria-pressed", "false");
  individualSelect.value = "0";
  tableSelect.value = "0";
  pickupSelect.value = "On site";
  refreshTotals();
  confirmView.hidden = true;
  formView.hidden = false;
});
