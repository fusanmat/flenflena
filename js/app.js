/* Flenflena · demo del prototipo. HTML + JS sin dependencias salvo Leaflet. */
(function () {
  "use strict";
  var CFG = window.FF_CONFIG, I18N = window.FF_I18N;
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- Contexto: idioma, variante A/B y fuente de tráfico (por URL, sin cookies) ---------- */
  var qs = new URLSearchParams(location.search);
  var vKey = (qs.get("v") || "").toUpperCase();
  if (!CFG.VARIANTS[vKey]) vKey = CFG.DEFAULT_VARIANT;
  var variant = CFG.VARIANTS[vKey];
  var srcRaw = (qs.get("src") || "").toLowerCase();
  var src = !srcRaw ? "direct" : (/^[a-z0-9_-]{1,24}$/.test(srcRaw) ? srcRaw : "other");
  var lang = (qs.get("lang") || "").toLowerCase() === "en" ? "en" : "es";
  window.FF_CTX = { variant: vKey, hero: variant.hero, price: variant.price, src: src, lang: lang };

  function t(key, vars) {
    var s = (I18N[lang] && I18N[lang][key]) || I18N.es[key] || key;
    var all = Object.assign({ contact: CFG.CONTACT, deletion: CFG.DELETION_DATE }, vars || {});
    return s.replace(/\{(\w+)\}/g, function (m, k) { return all[k] != null ? all[k] : m; });
  }
  function money(n) { var s = n.toFixed(2); return lang === "es" ? s.replace(".", ",") : s; }
  function num1(n) { var s = n.toFixed(1); return lang === "es" ? s.replace(".", ",") : s; }

  var PRICE_RANGES = [["lt0.50", null, 0.5], ["0.50_1", 0.5, 1], ["1_1.50", 1, 1.5], ["1.50_2", 1.5, 2], ["2_3", 2, 3], ["gt3", 3, null]];
  function priceLabel(r) {
    var e = function (x) { return lang === "es" ? money(x) + " €" : "€" + money(x); };
    if (r[1] == null) return (lang === "es" ? "Menos de " : "Under ") + e(r[2]);
    if (r[2] == null) return (lang === "es" ? "Más de " : "Over ") + e(r[1]);
    return lang === "es" ? money(r[1]) + "–" + money(r[2]) + " €" : "€" + money(r[1]) + "–" + money(r[2]);
  }

  function applyLang() {
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-i18n]").forEach(function (el) { el.textContent = t(el.getAttribute("data-i18n")); });
    document.querySelectorAll("[data-i18n-ph]").forEach(function (el) { el.placeholder = t(el.getAttribute("data-i18n-ph")); });
    $("langBtn").setAttribute("aria-label", t("lang_label"));
    $("heroSub").textContent = t(variant.hero === "community" ? "hero_sub_community" : "hero_sub_savings");
    document.querySelectorAll(".pricesel").forEach(function (sel) {
      var v = sel.value;
      sel.innerHTML = "";
      sel.appendChild(new Option(t("any"), ""));
      PRICE_RANGES.forEach(function (r) { sel.appendChild(new Option(priceLabel(r), r[0])); });
      sel.value = v;
    });
    if (state.trip) renderFare();
    if (state.driver) renderDriver();
  }

  $("langBtn").addEventListener("click", function () {
    lang = lang === "es" ? "en" : "es";
    window.FF_CTX.lang = lang;
    applyLang();
    track("lang_switch", { to: lang });
  });

  /* ---------- Estado ---------- */
  var state = { origin: null, dest: null, trip: null, driver: null, driverTrip: null, driverDirect: null, routing: null, started: false };
  var DATA = { drivers: [], campuses: {}, zones: null };

  function demoStart(how) {
    if (state.started) return;
    state.started = true;
    track("demo_start", { via: how });
  }

  /* ---------- Geometría y zonas ---------- */
  function hav(a, b) {
    var R = 6371, toR = Math.PI / 180;
    var dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  // Reduce un punto a una zona (campus, barrio o municipio). Solo esto se registra.
  function zoneOf(p) {
    var Z = DATA.zones; if (!Z) return "unknown";
    var inC = Z.campuses.filter(function (c) { var b = c.bbox; return p.lng >= b[0] && p.lng <= b[2] && p.lat >= b[1] && p.lat <= b[3]; });
    if (inC.length) {
      inC.sort(function (a, b) { return hav(p, { lat: a.c[0], lng: a.c[1] }) - hav(p, { lat: b.c[0], lng: b.c[1] }); });
      return inC[0].id;
    }
    var best = null, bd = Infinity;
    Z.areas.forEach(function (a) { var d = hav(p, { lat: a.c[0], lng: a.c[1] }); if (d < bd) { bd = d; best = a; } });
    return best && bd <= Z.maxAreaKm ? best.id : "outside_area";
  }
  function kmBucket(km) { return km < 2 ? "lt2" : km < 5 ? "2_5" : km < 10 ? "5_10" : km < 20 ? "10_20" : "gt20"; }
  function fareBucket(x) { var lo = Math.floor(x * 4) / 4; return lo.toFixed(2) + "_" + (lo + 0.25).toFixed(2); }

  /* ---------- Mapa ---------- */
  var map = L.map("map", { zoomControl: true, scrollWheelZoom: false }).setView([39.478, -0.38], 12);
  if (window.ResizeObserver) { new ResizeObserver(function () { map.invalidateSize(); }).observe(document.getElementById("map")); }
  L.tileLayer(CFG.TILE_URL, { attribution: CFG.TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map);
  var routeLayer = L.layerGroup().addTo(map);
  var pointLayer = L.layerGroup().addTo(map);
  function dot(color, r) { return { radius: r || 8, color: "#fff", weight: 3, fillColor: color, fillOpacity: 1 }; }

  function drawPoints() {
    pointLayer.clearLayers();
    if (state.origin) L.circleMarker([state.origin.lat, state.origin.lng], dot("#2463FF")).bindTooltip(t("marker_origin")).addTo(pointLayer);
    if (state.dest) L.circleMarker([state.dest.lat, state.dest.lng], dot("#0D1B3E")).bindTooltip(t("marker_dest")).addTo(pointLayer);
  }

  map.on("click", function (e) {
    demoStart("map");
    var mode = document.querySelector('input[name="clickmode"]:checked').value;
    var p = { lat: e.latlng.lat, lng: e.latlng.lng, label: (lang === "es" ? "Punto del mapa" : "Map point") + " (" + e.latlng.lat.toFixed(4) + ", " + e.latlng.lng.toFixed(4) + ")" };
    setPlace(mode === "origin" ? "origin" : "dest", p);
    if (mode === "origin") document.querySelector('input[name="clickmode"][value="dest"]').checked = true;
  });

  function setPlace(which, p) {
    state[which] = p;
    $(which === "origin" ? "originInput" : "destInput").value = p.label;
    hideList(which === "origin" ? "originList" : "destList");
    drawPoints();
    if (state.origin && state.dest) runSearch();
  }

  /* ---------- Búsqueda de lugares (Photon, limitada a València) ---------- */
  var timers = {}, lastResults = { origin: [], dest: [] };
  function hideList(id) { var ul = $(id); ul.hidden = true; ul.innerHTML = ""; }
  function photonLabel(pr) {
    var parts = [pr.name, pr.street && pr.housenumber ? pr.street + " " + pr.housenumber : pr.street, pr.district || pr.locality, pr.city];
    return parts.filter(function (x, i, a) { return x && a.indexOf(x) === i; }).join(", ");
  }
  function photon(q) {
    var b = CFG.VALENCIA_BBOX;
    var url = CFG.PHOTON_URL + "?q=" + encodeURIComponent(q) + "&limit=5&lat=39.47&lon=-0.37&bbox=" + b.join(",");
    return fetch(url).then(function (r) { if (!r.ok) throw new Error("photon " + r.status); return r.json(); }).then(function (d) {
      return (d.features || []).map(function (f) { return { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0], label: photonLabel(f.properties) }; });
    });
  }
  function bindSearch(which, inputId, listId) {
    var input = $(inputId), ul = $(listId);
    input.addEventListener("input", function () {
      state[which] = null;
      clearTimeout(timers[which]);
      var q = input.value.trim();
      if (q.length < 3) { hideList(listId); return; }
      timers[which] = setTimeout(function () {
        demoStart("search");
        photon(q).then(function (res) {
          lastResults[which] = res;
          ul.innerHTML = "";
          res.forEach(function (p) {
            var li = document.createElement("li");
            li.setAttribute("role", "option"); li.tabIndex = 0; li.textContent = p.label;
            var pick = function () { setPlace(which, p); };
            li.addEventListener("mousedown", function (e) { e.preventDefault(); pick(); });
            li.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); pick(); } });
            ul.appendChild(li);
          });
          ul.hidden = !res.length;
        }).catch(function () { status(t("status_search_error")); });
      }, 350);
    });
    input.addEventListener("blur", function () { setTimeout(function () { hideList(listId); }, 150); });
    input.addEventListener("focus", function () {
      document.querySelector('input[name="clickmode"][value="' + (which === "origin" ? "origin" : "dest") + '"]').checked = true;
    });
  }
  bindSearch("origin", "originInput", "originList");
  bindSearch("dest", "destInput", "destList");

  document.querySelectorAll(".chip").forEach(function (b) {
    b.addEventListener("click", function () {
      demoStart("chip");
      var c = DATA.campuses[b.getAttribute("data-campus")];
      if (c) setPlace("dest", { lat: c.lat, lng: c.lng, label: c.name });
    });
  });

  $("geoBtn").addEventListener("click", function () {
    demoStart("geo");
    if (!navigator.geolocation) { status(t("status_geo_error")); return; }
    navigator.geolocation.getCurrentPosition(function (pos) {
      // La posición se usa solo en memoria para dibujar la ruta; nunca se envía a la analítica.
      setPlace("origin", { lat: pos.coords.latitude, lng: pos.coords.longitude, label: lang === "es" ? "Mi ubicación" : "My location" });
    }, function () { status(t("status_geo_error")); }, { timeout: 8000, maximumAge: 60000 });
  });

  function status(msg) { $("status").textContent = msg || ""; }

  /* ---------- Rutas (OSRM, con plan B en línea recta × 1,3) ---------- */
  function osrm(points) {
    var coords = points.map(function (p) { return p.lng.toFixed(5) + "," + p.lat.toFixed(5); }).join(";");
    var ctrl = new AbortController();
    var to = setTimeout(function () { ctrl.abort(); }, CFG.OSRM_TIMEOUT_MS);
    return fetch(CFG.OSRM_URL + coords + "?overview=full&geometries=geojson", { signal: ctrl.signal })
      .then(function (r) { if (!r.ok) throw new Error("osrm " + r.status); return r.json(); })
      .then(function (d) {
        clearTimeout(to);
        if (d.code !== "Ok" || !d.routes || !d.routes.length) throw new Error("osrm no route");
        var r = d.routes[0];
        return { km: r.distance / 1000, min: r.duration / 60, line: r.geometry.coordinates.map(function (c) { return [c[1], c[0]]; }), mode: "osrm" };
      })
      .catch(function () { clearTimeout(to); return straight(points); });
  }
  function straight(points) {
    var km = 0;
    for (var i = 1; i < points.length; i++) km += hav(points[i - 1], points[i]);
    km *= CFG.STRAIGHT_LINE_FACTOR;
    return { km: km, min: km / 30 * 60, line: points.map(function (p) { return [p.lat, p.lng]; }), mode: "fallback" };
  }

  // Conductor simulado con el menor desvío (estimado en línea recta)
  function matchDriver(o, d) {
    var best = null, bd = Infinity;
    DATA.drivers.forEach(function (dr) {
      var c = DATA.campuses[dr.to]; if (!c) return;
      var s = { lat: dr.lat, lng: dr.lng };
      var detour = hav(s, o) + hav(o, d) + hav(d, c) - hav(s, c);
      if (detour < bd) { bd = detour; best = dr; }
    });
    return best;
  }

  var searchSeq = 0;
  function runSearch() {
    if (!state.origin || !state.dest) { status(t("status_need_both")); return; }
    if (hav(state.origin, state.dest) < 0.2) { status(t("status_same")); return; }
    var seq = ++searchSeq;
    status(t("status_routing"));
    $("searchBtn").disabled = true;
    var o = state.origin, d = state.dest;
    var dr = matchDriver(o, d), c = DATA.campuses[dr.to], s = { lat: dr.lat, lng: dr.lng };
    Promise.all([osrm([o, d]), osrm([s, o, d, c]), osrm([s, c])]).then(function (r) {
      if (seq !== searchSeq) return;
      $("searchBtn").disabled = false;
      state.trip = r[0]; state.driverTrip = r[1]; state.driverDirect = r[2]; state.driver = dr;
      state.routing = (r[0].mode === "osrm" && r[1].mode === "osrm" && r[2].mode === "osrm") ? "osrm" : "fallback";
      status(state.routing === "fallback" ? t("status_fallback") : "");
      drawRoutes();
      renderDriver();
      renderFare();
      $("result").hidden = false;
      track("route_shown", { o_zone: zoneOf(o), d_zone: zoneOf(d), slot: $("slotSel").value, km_bucket: kmBucket(state.trip.km), routing: state.routing, driver: dr.id });
      fareEvent("search");
    });
  }

  function drawRoutes() {
    routeLayer.clearLayers();
    var dl = L.polyline(state.driverTrip.line, { color: "#0EBE76", weight: 5, opacity: 0.9, dashArray: "8 8" }).addTo(routeLayer);
    L.polyline(state.trip.line, { color: "#2463FF", weight: 6, opacity: 0.95 }).addTo(routeLayer);
    L.circleMarker([state.driver.lat, state.driver.lng], dot("#0EBE76", 7)).bindTooltip(t("marker_driver")).addTo(routeLayer);
    drawPoints();
    map.fitBounds(dl.getBounds().pad(0.15));
  }

  function renderDriver() {
    var dr = state.driver, c = DATA.campuses[dr.to];
    var detKm = Math.max(0, state.driverTrip.km - state.driverDirect.km);
    var detMin = Math.max(1, Math.round(state.driverTrip.min - state.driverDirect.min));
    $("driverLine").textContent = t("driver_line", { from: dr.from, time: dr.depart, campus: c.name });
    $("detourLine").textContent = t("detour_line", { km: num1(detKm), min: detMin });
    $("tripLine").textContent = t("trip_line", { km: num1(state.trip.km), min: Math.max(1, Math.round(state.trip.min)) });
  }

  /* ---------- Tarifa ---------- */
  function slotMult(slotId) {
    var sl = CFG.SLOTS.filter(function (s) { return s.id === slotId; })[0];
    return CFG.FARE.congestion[sl ? sl.mult : "offpeak"];
  }
  // por pasajero = (km × coste/km × congestión) ÷ (pasajeros + conductor) + comisión 0,25 €;
  // si no llega a la tarifa mínima se suma un ajuste; tope absoluto 0,26 €/km (lo absorbe primero la comisión).
  function r2(x) { return Math.round(x * 100) / 100; }
  function calcFare(km, car, slotId, pax) {
    var F = CFG.FARE, cpk = F.costPerKm[car], mult = slotMult(slotId), seats = pax + 1;
    var share = r2(km * cpk * mult / seats), comm = F.commission, adj = 0, capped = false;
    if (share + comm < F.minFare) adj = r2(F.minFare - share - comm);
    var cap = Math.floor(km * F.maxPerKm * 100) / 100;
    if (share + comm + adj > cap) {
      capped = true; adj = 0;
      share = Math.min(share, cap);
      comm = r2(Math.max(0, cap - share));
    }
    var total = r2(share + comm + adj);
    return { km: km, cpk: cpk, mult: mult, seats: seats, share: share, comm: comm, adj: adj, total: total, capped: capped, minApplied: adj > 0, perKm: total / km };
  }
  function currentFare() { return calcFare(state.trip.km, $("carSel").value, $("slotSel").value, parseInt($("paxSel").value, 10)); }

  function renderFare() {
    var f = currentFare();
    $("farePrice").textContent = variant.price === "included" ? t("fare_included", { total: money(f.total) }) : t(f.adj > 0 ? "fare_separate_adj" : "fare_separate", { share: money(f.share), comm: money(f.comm), adj: money(f.adj) });
    var formulaKey = $("carSel").value === "ev" ? "fare_formula_ev" : "fare_formula";
    $("fareFormula").textContent = t(formulaKey, { km: num1(f.km), cpk: (lang === "es" ? f.cpk.toFixed(3).replace(".", ",") : f.cpk.toFixed(3)), mult: (lang === "es" ? f.mult.toFixed(2).replace(".", ",") : f.mult.toFixed(2)), seats: f.seats });
    var note = t("fare_cap");
    if (f.capped) note = t("fare_capped");
    else if (f.minApplied) note = t("fare_min", { min: money(CFG.FARE.minFare), adj: money(f.adj) }) + " " + note;
    $("fareNote").textContent = note;
    $("reserveBtn").textContent = t("reserve_btn", { total: money(f.total) });
    $("reserveBtn").dataset.total = f.total.toFixed(2);
    return f;
  }
  function fareEvent(trigger) {
    var f = currentFare();
    track("fare_shown", { trigger: trigger, car: $("carSel").value, slot: $("slotSel").value, pax: f.seats - 1, fare_bucket: fareBucket(f.total), capped: f.capped, km_bucket: kmBucket(f.km) });
  }
  ["carSel", "slotSel", "paxSel"].forEach(function (id) {
    $(id).addEventListener("change", function () { if (state.trip) { renderFare(); fareEvent(id.replace("Sel", "")); } });
  });

  $("demoForm").addEventListener("submit", function (e) {
    e.preventDefault();
    demoStart("button");
    var need = [];
    if (!state.origin && $("originInput").value.trim().length >= 3) need.push("origin");
    if (!state.dest && $("destInput").value.trim().length >= 3) need.push("dest");
    if (!need.length) { runSearch(); return; }
    Promise.all(need.map(function (w) {
      return photon($(w === "origin" ? "originInput" : "destInput").value.trim()).then(function (res) {
        if (!res.length) throw new Error("nf");
        state[w] = res[0]; $(w === "origin" ? "originInput" : "destInput").value = res[0].label;
      });
    })).then(function () { drawPoints(); runSearch(); }).catch(function () { status(t("status_not_found")); });
  });

  /* ---------- Puerta falsa (disposición a pagar) ---------- */
  var door = $("door"), fromDoor = false;
  $("reserveBtn").addEventListener("click", function () {
    var total = parseFloat($("reserveBtn").dataset.total || "0");
    track("reserve_click", { fare_bucket: fareBucket(total), car: $("carSel").value, slot: $("slotSel").value });
    if (door.showModal) door.showModal(); else door.setAttribute("open", "");
  });
  function closeDoor() { if (door.close) door.close(); else door.removeAttribute("open"); }
  $("doorYes").addEventListener("click", function () {
    fromDoor = true; track("door_yes"); closeDoor();
    $("join").scrollIntoView({ behavior: "smooth" });
    setTimeout(function () { $("fName").focus({ preventScroll: true }); }, 400);
  });
  $("doorNo").addEventListener("click", function () { track("door_no"); closeDoor(); });

  /* ---------- Registro simulado: se valida y se descarta ---------- */
  var form = $("joinForm"), formStarted = false;
  form.addEventListener("focusin", function () { if (!formStarted) { formStarted = true; track("form_start"); } });
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var ok = true;
    var name = $("fName").value.trim(), email = $("fEmail").value.trim();
    $("eName").textContent = name.length >= 2 ? "" : (ok = false, t("err_name"));
    $("eEmail").textContent = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? "" : (ok = false, t("err_email"));
    $("eAdult").textContent = $("fAdult").checked ? "" : (ok = false, t("err_adult"));
    if (!ok) return;
    // Nombre y correo: válidos, pero NO se envían ni se guardan. Se descartan aquí mismo.
    name = email = null;
    track("form_submit", { role: $("fRole").value || "none", sex: $("fSex").value || "none", adult: true, from_door: fromDoor });
    var survey = { mode: $("qMode").value, days: $("qDays").value, spend: $("qSpend").value, pay: $("qPay").value, cheap: $("qCheap").value, expensive: $("qExp").value };
    var answered = Object.keys(survey).filter(function (k) { return survey[k]; });
    if (answered.length) {
      var props = {}; answered.forEach(function (k) { props[k] = survey[k]; });
      track("survey_submit", props);
    }
    form.reset();
    form.hidden = true;
    $("thanks").hidden = false;
    $("thanks").focus();
  });

  /* ---------- Arranque ---------- */
  (function defaultSlot() {
    var h = new Date().getHours();
    var sl = CFG.SLOTS.filter(function (s) { return s.from < s.to ? (h >= s.from && h < s.to) : (h >= s.from || h < s.to); })[0];
    if (sl) $("slotSel").value = sl.id;
  })();

  applyLang();
  fetch("data/drivers.json").then(function (r) { return r.json(); }).then(function (d) {
    DATA.drivers = d.drivers; DATA.campuses = d.campuses;
    Object.keys(d.campuses).forEach(function (k) {
      var c = d.campuses[k];
      L.circleMarker([c.lat, c.lng], { radius: 6, color: "#0D1B3E", weight: 2, fillColor: "#F6F8FC", fillOpacity: 1 }).bindTooltip(c.name).addTo(map);
    });
  });
  fetch("data/zones.json").then(function (r) { return r.json(); }).then(function (z) { DATA.zones = z; });

  track("view", { referrer_type: document.referrer ? "external" : "none" });
  window.FF_DEBUG = { calcFare: calcFare, zoneOf: zoneOf, map: map };
})();
