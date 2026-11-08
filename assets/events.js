// Add future events here. Registration data for an event is deleted RETENTION_DAYS after its date.
// "counts" are the ticket columns, "extras" are extra text columns, "headcount" is people attending.
export const RETENTION_DAYS = 30;
export const EVENTS = {
  kidsxmas: {
    id: "kidsxmas", name: "CNL Kids Christmas Party", date: "2026-11-29",
    price: 10,
    counts: [{ key: "adults", label: "Adults" }, { key: "children", label: "Children" }],
    extras: [],
    headcount: r => (r.adults || 0) + (r.children || 0)
  },
  gala: {
    id: "gala", name: "CNL Christmas Gala", date: "2026-12-12",
    ticketPrice: 50, tablePrice: 500, tableSize: 10,
    counts: [{ key: "individual", label: "Individual" }, { key: "tables", label: "Tables of 10" }],
    extras: [{ key: "dietary", label: "Dietary" }, { key: "pickup", label: "Pickup" }],
    headcount: r => (r.individual || 0) + (r.tables || 0) * 10
  }
};
