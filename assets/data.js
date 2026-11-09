import CONFIG from "/assets/firebase-config.js";
import { EVENTS, RETENTION_DAYS } from "/assets/events.js";

const SDK = "https://www.gstatic.com/firebasejs/10.12.2/";
const DAY = 86400000;
const DEMO_HASH = "73a2af8864fc500fa49048bf3003776c19938f360e56bd03663866fb3087884a";

function deleteAtFor(eventId){
  const ev = EVENTS[eventId];
  return new Date(ev.date + "T23:59:59").getTime() + RETENTION_DAYS * DAY;
}
function buildRegistration(eventId, r){
  const ev = EVENTS[eventId];
  const base = { eventId, name: r.name.trim(), email: r.email.trim(), status: "Not paid" };
  if (eventId === "gala"){
    return Object.assign(base, {
      individual: r.individual,
      tables: r.tables,
      dietary: (r.dietary || "").trim().slice(0, 200),
      pickup: r.pickup,
      total: r.individual * ev.ticketPrice + r.tables * ev.tablePrice
    });
  }
  return Object.assign(base, {
    adults: r.adults,
    children: r.children,
    total: (r.adults + r.children) * ev.price
  });
}
const cleanEmail = e => e.trim().toLowerCase();

/* ===================== DEMO backend (no network) ===================== */
function makeDemo(){
  const KEY = "crlsc-demo";
  let mem = null, signedIn = false, listener = null;
  function seed(){
    const now = Date.now();
    return {
      regs: [
        { id:"s1", eventId:"kidsxmas", name:"Sample Person A", email:"sample.a@example.com", adults:2, children:2, total:40, status:"Paid", ticketStatus:"Picked up", createdAt:now-3*DAY, deleteAt:deleteAtFor("kidsxmas") },
        { id:"s2", eventId:"kidsxmas", name:"Sample Person B", email:"sample.b@example.com", adults:1, children:1, total:20, status:"Not paid", createdAt:now-DAY, deleteAt:deleteAtFor("kidsxmas") },
        { id:"s3", eventId:"gala", name:"Sample Person C", email:"sample.c@example.com", individual:2, tables:1, dietary:"Vegetarian", pickup:"On site", total:600, status:"Not paid", createdAt:now-2*DAY, deleteAt:deleteAtFor("gala") }
      ],
      subs: [ { email:"sample.a@example.com", consentAt:now-3*DAY, source:"kidsxmas" } ],
      open: {}
    };
  }
  function state(){
    let d = mem;
    try { const s = sessionStorage.getItem(KEY); if (s) d = JSON.parse(s); } catch(e){}
    if (!d) d = seed();
    return d;
  }
  function save(d){ mem = d; try { sessionStorage.setItem(KEY, JSON.stringify(d)); } catch(e){} }
  async function sha(s){
    const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
    return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2,"0")).join("");
  }
  return {
    isLive: false,
    async registrationOpen(id){ return state().open[id] !== false; },
    async setRegistrationOpen(id, open){ const d = state(); d.open[id] = open; save(d); },
    async addRegistration(eventId, r){
      const d = state();
      d.regs.push(Object.assign({ id: "r" + Date.now() + Math.random().toString(36).slice(2,6), createdAt: Date.now(), deleteAt: deleteAtFor(eventId) }, buildRegistration(eventId, r)));
      save(d);
    },
    async addSubscriber(email, eventId){
      const e = cleanEmail(email), d = state();
      if (!d.subs.some(s => s.email === e)) d.subs.push({ email: e, consentAt: Date.now(), source: eventId });
      save(d);
    },
    async addSubscriberManual(email){
      const e = cleanEmail(email), d = state();
      if (d.subs.some(s => s.email === e)) return false;
      d.subs.push({ email: e, consentAt: Date.now(), source: "manual" }); save(d); return true;
    },
    async signIn(_email, pass){
      if (await sha(pass) !== DEMO_HASH) throw new Error("bad");
      signedIn = true; if (listener) listener({ email: "demo" });
    },
    async signOut(){ signedIn = false; if (listener) listener(null); },
    onAuth(cb){ listener = cb; cb(signedIn ? { email: "demo" } : null); },
    async listRegistrations(){ return state().regs.slice(); },
    async updateStatus(id, status){ const d = state(); const r = d.regs.find(x => x.id === id); if (r) r.status = status; save(d); },
    async updateTicketStatus(id, v){ const d = state(); const r = d.regs.find(x => x.id === id); if (r) r.ticketStatus = v; save(d); },
    async deleteRegistration(id){ const d = state(); d.regs = d.regs.filter(x => x.id !== id); save(d); },
    async listSubscribers(){ return state().subs.slice(); },
    async removeSubscriber(email){ const d = state(); d.subs = d.subs.filter(s => s.email !== email); save(d); }
  };
}

/* ===================== LIVE backend (Firebase) ===================== */
async function makeLive(){
  const [appM, fs, au] = await Promise.all([
    import(SDK + "firebase-app.js"),
    import(SDK + "firebase-firestore.js"),
    import(SDK + "firebase-auth.js")
  ]);
  const app = appM.initializeApp(CONFIG);
  const db = fs.getFirestore(app);
  const auth = au.getAuth(app);
  const ms = t => (t && t.toMillis) ? t.toMillis() : (t || 0);
  const normReg = (id, d) => Object.assign({}, d, { id, createdAt: ms(d.createdAt), deleteAt: ms(d.deleteAt) });
  return {
    isLive: true,
    async registrationOpen(id){
      try { const s = await fs.getDoc(fs.doc(db, "settings", id)); return s.exists() ? s.data().open !== false : true; }
      catch(e){ return true; }
    },
    setRegistrationOpen: (id, open) => fs.setDoc(fs.doc(db, "settings", id), { open }),
    async addRegistration(eventId, r){
      await fs.addDoc(fs.collection(db, "registrations"), Object.assign(buildRegistration(eventId, r), {
        createdAt: fs.Timestamp.now(),
        deleteAt: fs.Timestamp.fromMillis(deleteAtFor(eventId))
      }));
    },
    async addSubscriber(email, eventId){
      const e = cleanEmail(email);
      try { await fs.setDoc(fs.doc(db, "subscribers", e), { email: e, consentAt: fs.Timestamp.now(), source: eventId }); }
      catch(err){ /* already on the list: rules only allow create, so a repeat is refused. That is fine. */ }
    },
    async addSubscriberManual(email){
      const e = cleanEmail(email);
      const ref = fs.doc(db, "subscribers", e);
      if ((await fs.getDoc(ref)).exists()) return false;
      await fs.setDoc(ref, { email: e, consentAt: fs.Timestamp.now(), source: "manual" });
      return true;
    },
    signIn: (email, pass) => au.signInWithEmailAndPassword(auth, email, pass),
    signOut: () => au.signOut(auth),
    onAuth(cb){ au.onAuthStateChanged(auth, u => cb(u ? { email: u.email } : null)); },
    async listRegistrations(){ const q = await fs.getDocs(fs.collection(db, "registrations")); return q.docs.map(d => normReg(d.id, d.data())); },
    updateStatus: (id, status) => fs.updateDoc(fs.doc(db, "registrations", id), { status }),
    updateTicketStatus: (id, ticketStatus) => fs.updateDoc(fs.doc(db, "registrations", id), { ticketStatus }),
    deleteRegistration: id => fs.deleteDoc(fs.doc(db, "registrations", id)),
    async listSubscribers(){ const q = await fs.getDocs(fs.collection(db, "subscribers")); return q.docs.map(d => { const x = d.data(); return { email: x.email, consentAt: ms(x.consentAt), source: x.source }; }); },
    removeSubscriber: email => fs.deleteDoc(fs.doc(db, "subscribers", email))
  };
}

export async function getBackend(){ return CONFIG ? makeLive() : makeDemo(); }
