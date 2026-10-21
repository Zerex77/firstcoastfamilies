// Shared helpers: database client and row <-> listing mapping.
(function () {
  const C = window.FCF_CONFIG || {};
  const ready = !!(C.url && C.anonKey && !C.url.includes("YOUR-") && !C.anonKey.includes("YOUR-") && window.supabase);

  function client() {
    return ready ? window.supabase.createClient(C.url, C.anonKey) : null;
  }

  const num = (v) => (v === null || v === undefined || v === "" ? undefined : Number(v));
  const str = (v) => (v === null || v === undefined ? undefined : v);

  // Database row -> the shape the pages use.
  function fromRow(r) {
    return {
      id: r.id, kind: r.kind, name: r.name, county: str(r.county), area: str(r.area), venue: str(r.venue),
      lat: num(r.lat), lng: num(r.lng), price: num(r.price), priceNote: str(r.price_note), priceDetail: str(r.price_detail),
      hours: str(r.hours), ageNote: str(r.age_note), tips: str(r.tips), ages: r.ages || [], io: str(r.io),
      start: str(r.start_date), end: str(r.end_date), time: str(r.time_text), desc: str(r.description),
      tags: r.tags || [], url: str(r.url), sponsored: !!r.sponsored, source: str(r.source)
    };
  }

  // A listing (from the sweep file or a venue form) -> a database row.
  function toRow(x, id) {
    const n = (v) => (v === "" || v === undefined ? null : v);
    const areas = ["jax", "beaches", "pv", "wgv", "sa", "amelia", "clay"];
    return {
      id: id || x.id, kind: ["event", "concert", "place"].includes(x.kind) ? x.kind : "event", name: x.name,
      county: n(x.county), area: areas.includes(x.area) ? x.area : null, venue: n(x.venue),
      lat: typeof x.lat === "number" ? x.lat : null, lng: typeof x.lng === "number" ? x.lng : null,
      price: typeof x.price === "number" ? x.price : null, price_note: n(x.priceNote), price_detail: n(x.priceDetail),
      hours: n(x.hours), age_note: n(x.ageNote), tips: n(x.tips), ages: Array.isArray(x.ages) ? x.ages : [],
      io: x.io === "in" || x.io === "out" ? x.io : null, start_date: n(x.start), end_date: n(x.end), time_text: n(x.time),
      description: n(x.desc), tags: Array.isArray(x.tags) ? x.tags.slice(0, 4) : [], url: /^https?:\/\//i.test(x.url || "") ? x.url : null,
      sponsored: !!x.sponsored, source: n(x.source)
    };
  }

  function slug(s) {
    return (String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "item") + "-" + Math.random().toString(36).slice(2, 6);
  }

  window.FCF = { ready, client, fromRow, toRow };
  window.slug = slug;
})();
