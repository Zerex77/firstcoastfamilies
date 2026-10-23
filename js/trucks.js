// Food truck tracker: map + list. Loaded after the main page script, which
// provides state, AREAS, TOWNS, areaOf, withDistance, parse, iso, today,
// addDays, windowFor, esc, safeUrl, $, sb and slug.
(function () {
  const DOW = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const T = { spots: [], stops: [], loaded: false, updated: null };
  let map = null, layer = null, youLayer = null, win = "7";
  const markers = {};

  /* ---------- data ---------- */
  async function load() {
    try {
      const r = await fetch("data/trucks.json?" + Math.floor(Date.now() / 36e5), { cache: "no-store" });
      if (r.ok) { const j = await r.json(); T.spots = j.spots || []; T.stops = j.stops || []; T.updated = j.updated || null; }
    } catch (e) { /* show what we have */ }
    if (sb) {
      const { data } = await sb.from("truck_stops").select("*").gte("date", iso(today())).limit(500);
      if (data) T.stops = T.stops.concat(data.map(r => ({
        id: "o-" + r.id, title: r.truck, cuisine: r.cuisine, date: r.date, time: r.time_text,
        venue: r.venue || r.address, area: r.area, lat: r.lat, lng: r.lng, url: r.url, desc: r.description, owner: true
      })));
    }
    T.loaded = true;
    if (state.view === "trucks") renderTrucks();
  }

  /* ---------- schedule helpers ---------- */
  function spotOn(s, d) {
    const k = iso(d);
    if (s.from && k < s.from) return false;
    if (s.until && k > s.until) return false;
    const sc = s.schedule || {}, dn = DOW[d.getDay()];
    if (sc.daily) return true;
    if (sc.days) return sc.days.includes(dn);
    if (sc.nth && sc.day === dn) return Math.ceil(d.getDate() / 7) === sc.nth;
    return false;
  }
  const spotHours = (s, d) => (s.hoursByDay && s.hoursByDay[DOW[d.getDay()]]) || s.hours || "";
  function range() {
    const t = today();
    if (win === "today") return [t, t];
    if (win === "weekend") return windowFor("weekend");
    return [t, addDays(t, 6)];
  }
  function startMin(t) {
    const m = /(\d{1,2})(?::(\d\d))?\s*(am|pm)?/i.exec(t || "");
    if (!m) return 9999;
    let h = +m[1] % 12; const ampm = (m[3] || (/pm/i.test(t) ? "pm" : "am")).toLowerCase();
    if (ampm === "pm") h += 12;
    return h * 60 + (+m[2] || 0);
  }
  const inArea = x => !state.areas.size || state.areas.has(areaOf(x));
  const dayLabel = d => {
    const t = today(), diff = Math.round((d - t) / 864e5);
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };
  const directions = x => typeof x.lat === "number"
    ? "https://www.google.com/maps/dir/?api=1&destination=" + x.lat + "," + x.lng
    : "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(x.venue || "");

  function collect() {
    const [a, b] = range();
    const stops = withDistance(T.stops.filter(s => { const d = parse(s.date); return d && d >= a && d <= b && inArea(s); }))
      .map(s => ({ ...s, d: parse(s.date) }))
      .sort((p, q) => p.d - q.d || startMin(p.time) - startMin(q.time));
    const spots = [];
    for (const s of withDistance(T.spots.filter(inArea))) {
      const days = [];
      for (let d = new Date(a); d <= b; d = addDays(d, 1)) if (spotOn(s, d)) days.push(new Date(d));
      if (days.length) spots.push({ ...s, days });
    }
    spots.sort((p, q) => p.days[0] - q.days[0] || (p.mi ?? 999) - (q.mi ?? 999));
    return { stops, spots };
  }

  /* ---------- icons ---------- */
  const COLORS = { today: "#FF9F80", later: "#4FA3DB", spot: "#4CC38A" };
  function truckSvg(fill) {
    return `<svg width="40" height="32" viewBox="0 0 40 32" aria-hidden="true">
      <ellipse cx="20" cy="29.5" rx="15" ry="2.2" fill="rgba(27,46,75,.18)"/>
      <rect x="2.5" y="7" width="23" height="16" rx="3" fill="${fill}" stroke="#1B2E4B" stroke-width="1.6"/>
      <path d="M5.5 7 h17 v2.6 a2.1 2.1 0 0 1-4.25 0 a2.1 2.1 0 0 1-4.25 0 a2.1 2.1 0 0 1-4.25 0 a2.1 2.1 0 0 1-4.25 0z" fill="#FFFFFF" stroke="#1B2E4B" stroke-width="1.2" stroke-linejoin="round"/>
      <rect x="7" y="12" width="14" height="6" rx="1.2" fill="#FFF6D6" stroke="#1B2E4B" stroke-width="1.2"/>
      <path d="M25.5 11.5 h6.2 l4.8 5.4 v6.1 h-11z" fill="${fill}" stroke="#1B2E4B" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M27.4 13.4 h3.5 l3 3.4 h-6.5z" fill="#D6ECFB"/>
      <circle cx="10" cy="24" r="3.4" fill="#1B2E4B" stroke="#FFFFFF" stroke-width="1.2"/>
      <circle cx="30" cy="24" r="3.4" fill="#1B2E4B" stroke="#FFFFFF" stroke-width="1.2"/>
    </svg>`;
  }
  function icon(kind, count, label) {
    return L.divIcon({
      className: "truck-pin" + (kind === "today" ? " is-today" : ""),
      html: `<span class="tp-body" role="img" aria-label="${esc(label)}">${truckSvg(COLORS[kind])}${count > 1 ? `<b class="tp-count">${count}</b>` : ""}</span>`,
      iconSize: [40, 32], iconAnchor: [20, 30], popupAnchor: [0, -26]
    });
  }

  /* ---------- map ---------- */
  function ensureMap() {
    if (map || !window.L) return;
    map = L.map("truckMap", { zoomControl: true, scrollWheelZoom: false, tap: true }).setView([30.15, -81.5], 9);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    layer = L.layerGroup().addTo(map);
    youLayer = L.layerGroup().addTo(map);
  }
  function popupHTML(x, whenText) {
    const url = safeUrl(x.url);
    return `<div class="tpop"><b>${esc(x.title || x.name)}</b><span>${esc(whenText)}</span><span class="v">${esc(x.venue || "")}</span>
      <span class="l"><a href="${esc(directions(x))}" target="_blank" rel="noopener">Directions</a>${url ? ` · <a href="${esc(url)}" target="_blank" rel="noopener">Details</a>` : ""}</span></div>`;
  }
  function drawMap(stops, spots) {
    ensureMap();
    if (!map) { $("#truckMap").innerHTML = `<div class="empty"><p>The map couldn't load. The list below has every stop.</p></div>`; return; }
    layer.clearLayers(); youLayer.clearLayers();
    for (const k in markers) delete markers[k];
    const pts = [];
    const groups = {};
    for (const s of stops) {
      if (typeof s.lat !== "number") continue;
      const key = s.lat.toFixed(4) + "," + s.lng.toFixed(4);
      (groups[key] = groups[key] || []).push(s);
    }
    const t = iso(today());
    for (const key in groups) {
      const g = groups[key], first = g[0], isToday = g.some(s => s.date === t);
      const html = g.map(s => popupHTML(s, dayLabel(s.d) + (s.time ? " · " + s.time : ""))).join("<hr>");
      const m = L.marker([first.lat, first.lng], { icon: icon(isToday ? "today" : "later", g.length, first.title || first.name), keyboard: true, title: first.title || "" })
        .bindPopup(html, { maxWidth: 260 }).addTo(layer);
      g.forEach(s => { markers[s.id] = m; });
      pts.push([first.lat, first.lng]);
    }
    for (const s of spots) {
      if (typeof s.lat !== "number") continue;
      const when = s.scheduleText + (s.hours ? " · " + s.hours : "");
      const m = L.marker([s.lat, s.lng], { icon: icon(s.days.some(d => iso(d) === t) ? "today" : "spot", 1, s.name), keyboard: true, title: s.name })
        .bindPopup(popupHTML(s, when), { maxWidth: 260 }).addTo(layer);
      markers[s.id] = m;
      pts.push([s.lat, s.lng]);
    }
    if (state.origin !== "any" && TOWNS[state.origin]) {
      const c = TOWNS[state.origin].c;
      L.circleMarker(c, { radius: 8, color: "#1E4F86", weight: 3, fillColor: "#FFFFFF", fillOpacity: 1 }).bindTooltip(TOWNS[state.origin].n).addTo(youLayer);
      pts.push(c);
    }
    setTimeout(() => {
      map.invalidateSize();
      if (pts.length > 1) map.fitBounds(pts, { padding: [36, 36], maxZoom: 13 });
      else if (pts.length === 1) map.setView(pts[0], 12);
      else map.setView([30.15, -81.5], 9);
    }, 30);
  }

  /* ---------- list ---------- */
  function stopCard(s) {
    const url = safeUrl(s.url), t = iso(today());
    return `<article class="card sticker tcard" data-id="${esc(s.id)}">
      <div class="ctop"><span class="tday${s.date === t ? " is-today" : ""}">${esc(dayLabel(s.d))}</span><span class="carea">${esc(AREAS[areaOf(s)].n)}</span>${s.owner ? `<span class="tag">Posted by the truck</span>` : ""}</div>
      <h3>${esc(s.title)}</h3>
      ${s.time ? `<div class="when">${esc(s.time)}</div>` : ""}
      <div class="venue">${esc(s.venue || "")}</div>
      <div class="meta">${s.cuisine ? `<span class="tag">${esc(s.cuisine)}</span>` : ""}${s.trucksText ? `<span class="tag">${esc(s.trucksText)}</span>` : ""}</div>
      ${s.desc ? `<p>${esc(s.desc)}</p>` : ""}
      <div class="cfoot"><span class="dist">${s.mi == null ? "" : s.mi.toFixed(1) + " mi"}</span>
        <span class="linky"><button type="button" class="linkbtn" data-showmap="${esc(s.id)}">Show on map</button><a href="${esc(directions(s))}" target="_blank" rel="noopener">Directions</a>${url ? `<a href="${esc(url)}" target="_blank" rel="noopener">Details</a>` : ""}</span></div>
    </article>`;
  }
  function spotCard(s) {
    const url = safeUrl(s.url), t = iso(today());
    const next = s.days[0], openToday = iso(next) === t;
    const hours = spotHours(s, next);
    return `<article class="card sticker tcard spot" data-id="${esc(s.id)}">
      <div class="ctop"><span class="tday spot${openToday ? " is-today" : ""}">${openToday ? "Open today" : "Next: " + esc(dayLabel(next))}</span><span class="carea">${esc(AREAS[areaOf(s)].n)}</span></div>
      <h3>${esc(s.name)}</h3>
      <div class="when">${esc(s.scheduleText)}${hours ? " · " + esc(hours) : ""}</div>
      <div class="venue">${esc(s.venue)}</div>
      <div class="meta">${s.trucksText ? `<span class="tag">${esc(s.trucksText)}</span>` : ""}</div>
      <p>${esc(s.desc || "")}</p>
      ${s.tips ? `<details class="kbyg"><summary>Know before you go</summary><dl><dt>Tip</dt><dd>${esc(s.tips)}</dd></dl></details>` : ""}
      <div class="cfoot"><span class="dist">${s.mi == null ? "" : s.mi.toFixed(1) + " mi"}</span>
        <span class="linky"><button type="button" class="linkbtn" data-showmap="${esc(s.id)}">Show on map</button><a href="${esc(directions(s))}" target="_blank" rel="noopener">Directions</a>${url ? `<a href="${esc(url)}" target="_blank" rel="noopener">Details</a>` : ""}</span></div>
    </article>`;
  }

  window.renderTrucks = function () {
    document.querySelectorAll("#truckWin button").forEach(b => b.setAttribute("aria-pressed", b.dataset.w === win));
    if (!T.loaded) { $("#truckCount").textContent = "Finding food trucks…"; return; }
    const { stops, spots } = collect();
    const where = state.origin !== "any" && TOWNS[state.origin] ? " within " + state.dist + " mi of " + TOWNS[state.origin].n : (state.areas.size ? " in " + [...state.areas].map(a => AREAS[a].n).join(", ") : "");
    const label = { today: "today", weekend: "this weekend", "7": "this week" }[win];
    $("#truckCount").textContent = `${stops.length} scheduled ${stops.length === 1 ? "stop" : "stops"} and ${spots.length} regular ${spots.length === 1 ? "spot" : "spots"} ${label}${where}`;
    $("#truckUpdated").textContent = T.updated ? "Schedules checked " + parse(T.updated).toLocaleDateString("en-US", { month: "short", day: "numeric" }) + ". Trucks change plans, so check their page before you drive over." : "";
    drawMap(stops, spots);
    let html;
    if (stops.length) {
      const byDay = [];
      for (const s of stops) {
        const k = iso(s.d); let g = byDay[byDay.length - 1];
        if (!g || g.k !== k) { g = { k, d: s.d, items: [] }; byDay.push(g); }
        g.items.push(s);
      }
      html = byDay.map(g => `<h3 class="tdayhead">${esc(dayLabel(g.d))}</h3><div class="grid">${g.items.map(stopCard).join("")}</div>`).join("");
    } else {
      html = `<div class="empty"><h3>No scheduled stops ${esc(label)}</h3><p>${win === "7" ? "The regular spots below are a safe bet." : "Try This week, or see the regular spots below."}</p></div>`;
    }
    $("#truckStops").innerHTML = html;
    $("#truckSpots").innerHTML = spots.length ? spots.map(spotCard).join("") : `<div class="empty"><p>No regular spots match these filters.</p></div>`;
  };

  /* ---------- events ---------- */
  document.getElementById("truckWin").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return; win = b.dataset.w;
    try { localStorage.setItem("fcf-truckwin", win); } catch (err) {}
    renderTrucks();
  });
  try { const w = localStorage.getItem("fcf-truckwin"); if (["today", "weekend", "7"].includes(w)) win = w; } catch (e) {}
  document.getElementById("trucksView").addEventListener("click", e => {
    const b = e.target.closest("[data-showmap]"); if (!b) return;
    const m = markers[b.dataset.showmap]; if (!m || !map) return;
    document.getElementById("truckMap").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    map.setView(m.getLatLng(), Math.max(map.getZoom(), 13)); m.openPopup();
  });

  /* ---------- owner form ---------- */
  const tForm = document.getElementById("truckForm");
  if (tForm) {
    document.getElementById("tf_town").innerHTML = Object.entries(TOWNS).map(([k, t]) => `<option value="${k}">${t.n}</option>`).join("");
    tForm.addEventListener("submit", async e => {
      e.preventDefault();
      const msg = $("#tfMsg"), btn = tForm.querySelector('button[type="submit"]');
      const truck = $("#tf_truck").value.trim(), date = $("#tf_date").value, time = $("#tf_time").value.trim(),
        venue = $("#tf_venue").value.trim(), address = $("#tf_address").value.trim();
      if (!truck || !date || !time || !venue || !address) { msg.className = "err"; msg.textContent = "Add your truck name, the date, your hours, the spot's name and its address."; return; }
      if (date < iso(today())) { msg.className = "err"; msg.textContent = "That date has already passed. Pick today or a later date."; return; }
      if (!sb) { msg.className = "err"; msg.textContent = "Truck schedules aren't connected yet. Please try again soon."; return; }
      const town = TOWNS[$("#tf_town").value];
      const url = $("#tf_url").value.trim();
      const item = {
        kind: "truck", id: slug(truck + "-" + date), name: truck, truck, cuisine: $("#tf_cuisine").value.trim(), date, time,
        venue, address, county: town.co, area: town.a, lat: town.c[0], lng: town.c[1],
        url: /^https?:\/\//i.test(url) ? url : "", contact: $("#tf_contact").value.trim(),
        note: "Map pin is placed from the address when you approve."
      };
      btn.disabled = true;
      const { error } = await sb.from("submissions").insert({ source: "venue", item });
      btn.disabled = false;
      if (error) { msg.className = "err"; msg.textContent = "That didn't go through. Check your connection and try again."; return; }
      msg.className = "ok"; msg.textContent = "Thanks! Your stop will show on the map once it's approved, usually the same day.";
      tForm.reset();
    });
  }

  load();
})();
