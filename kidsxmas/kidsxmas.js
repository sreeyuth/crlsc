import { getBackend } from "/assets/data.js";
import { EVENTS } from "/assets/events.js";

const EVENT_ID = "kidsxmas";
const backend = await getBackend();
const TICKET_PRICE = EVENTS[EVENT_ID].price;
if (backend.isLive){ const b = document.getElementById("demo-banner"); if (b) b.remove(); }
  /* ---------- Registration form logic ---------- */
  const nameInput = document.getElementById("reg-name");
  const emailInput = document.getElementById("reg-email");
  const adultsSelect = document.getElementById("reg-adults");
  const childrenSelect = document.getElementById("reg-children");
  const totalAmountEl = document.getElementById("total-amount");
  const etransferAmountEl = document.getElementById("etransfer-amount");
  const confirmToggleBtn = document.getElementById("etransfer-confirm-btn");
  const submitBtn = document.getElementById("submit-btn");
  const helperText = document.getElementById("helper-text");
  const form = document.getElementById("reg-form");
  const formView = document.getElementById("form-view");
  const confirmView = document.getElementById("confirm-view");
  const consentEmails = document.getElementById("consent-emails");

  let etransferConfirmed = false;

  function populateCountSelect(selectEl, max, defaultValue){
    for (let i = 0; i <= max; i++){
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = String(i);
      if (i === defaultValue) opt.selected = true;
      selectEl.appendChild(opt);
    }
  }
  populateCountSelect(adultsSelect, 10, 0);
  populateCountSelect(childrenSelect, 10, 0);

  function ticketCounts(){
    return {
      adults: parseInt(adultsSelect.value, 10) || 0,
      children: parseInt(childrenSelect.value, 10) || 0
    };
  }
  function currentPartySize(){ const c = ticketCounts(); return c.adults + c.children; }
  function currentTotal(){ return currentPartySize() * TICKET_PRICE; }

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
    const paymentOk = etransferConfirmed === true;
    const ready = nameOk && emailOk && partyOk && paymentOk;
    submitBtn.disabled = !ready;
    submitBtn.classList.toggle("enabled", ready);
    if (!nameOk){
      helperText.textContent = "Add your name to finish reserving your spot.";
    } else if (!emailOk){
      helperText.textContent = "Add a valid email so we can reach you.";
    } else if (!partyOk){
      helperText.textContent = "Select at least one ticket.";
    } else if (!paymentOk){
      helperText.textContent = "Confirm you've sent the e-transfer above to activate submission.";
    } else {
      helperText.textContent = "You're all set — confirm below.";
    }
  }

  [adultsSelect, childrenSelect].forEach(sel => sel.addEventListener("change", refreshTotals));
  nameInput.addEventListener("input", updateSubmitState);
  emailInput.addEventListener("input", updateSubmitState);

  confirmToggleBtn.addEventListener("click", () => {
    etransferConfirmed = !etransferConfirmed;
    confirmToggleBtn.classList.toggle("selected", etransferConfirmed);
    confirmToggleBtn.setAttribute("aria-pressed", String(etransferConfirmed));
    updateSubmitState();
  });

  const copyEmailBtn = document.getElementById("copy-email-btn");
  if (copyEmailBtn){
    copyEmailBtn.addEventListener("click", async () => {
      const email = "crsocclb@cnl.ca";
      try{
        await navigator.clipboard.writeText(email);
      }catch(err){
        const temp = document.createElement("textarea");
        temp.value = email;
        temp.style.position = "fixed";
        temp.style.opacity = "0";
        document.body.appendChild(temp);
        temp.select();
        try{ document.execCommand("copy"); }catch(e2){ console.error("Copy fallback failed:", e2); }
        document.body.removeChild(temp);
      }
      const original = copyEmailBtn.textContent;
      copyEmailBtn.textContent = "Copied!";
      copyEmailBtn.classList.add("copied");
      setTimeout(() => {
        copyEmailBtn.textContent = original;
        copyEmailBtn.classList.remove("copied");
      }, 1800);
    });
  }

  refreshTotals();

  /* ---------- Registration open/closed ---------- */
  if (!(await backend.registrationOpen(EVENT_ID))){
    formView.hidden = true;
    document.getElementById("closed-view").hidden = false;
  }

  /* ---------- Submit ---------- */
  form.addEventListener("submit", async function(e){
    e.preventDefault();
    if (submitBtn.disabled) return;
    submitBtn.disabled = true;
    submitBtn.textContent = "Saving...";
    const counts = ticketCounts();
    try {
      await backend.addRegistration(EVENT_ID, {
        name: nameInput.value, email: emailInput.value,
        adults: counts.adults, children: counts.children
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

  document.getElementById("register-another").addEventListener("click", function(){
    form.reset();
    adultsSelect.value = "0";
    childrenSelect.value = "0";
    etransferConfirmed = false;
    confirmToggleBtn.classList.remove("selected");
    confirmToggleBtn.setAttribute("aria-pressed", "false");
    refreshTotals();
    confirmView.hidden = true;
    formView.hidden = false;
  });
