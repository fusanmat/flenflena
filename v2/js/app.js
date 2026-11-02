/* Flenflena v2 · lógica de la web (sin compilación). */
(function () {
  "use strict";
  var CFG = window.FF_CONFIG, I18N = window.FF_I18N, F = window.FFFare;
  var $ = function (id) { return document.getElementById(id); };
  var qsa = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var CARS = ["petrol", "diesel", "hybrid", "ev", "suv"];
  var UNI = { upv: "UPV", uv: "UV", ceu: "CEU-UCH" };
  var UNI_COLOR = { upv: "#1E5EEB", uv: "#16A866", ceu: "#F26B1D" };

  /* ---------- Contexto (variante, origen, idioma) ---------- */
  var qs = new URLSearchParams(location.search);
  var vKey = (qs.get("v") || "").toUpperCase(); if (!CFG.VARIANTS[vKey]) vKey = CFG.DEFAULT_VARIANT;
  var variant = CFG.VARIANTS[vKey];
  var srcRaw = (qs.get("src") || "").toLowerCase();
  var src = !srcRaw ? "direct" : (/^[a-z0-9_-]{1,24}$/.test(srcRaw) ? srcRaw : "other");
  var lang = (qs.get("lang") || "").toLowerCase() === "en" ? "en" : "es";
  window.FF_CTX = { variant: vKey, src: src, lang: lang };

  var DEF = JSON.parse(JSON.stringify(CFG.FARE));
  var P = JSON.parse(JSON.stringify(CFG.FARE));

  /* ---------- Formatos e i18n ---------- */
  function loc() { return lang === "en" ? "en-GB" : "es-ES"; }
  function nf(x, d) { return new Intl.NumberFormat(loc(), { minimumFractionDigits: d, maximumFractionDigits: d }).format(x); }
  function eur(x) { return new Intl.NumberFormat(loc(), { style: "currency", currency: "EUR" }).format(x); }
  function pct(x) { return nf(x * 100, Math.round(x * 100) === x * 100 ? 0 : 1) + (lang === "en" ? "%" : " %"); }
  function capStr() { return eur(P.maxPerKm) + "/km"; }
  function km1(x) { return nf(x, 1); }
  function meters(k) { return k < 1 ? Math.round(k * 1000 / 10) * 10 + " m" : km1(k) + " km"; }
  function globals() { return { comm: pct(P.commission), min: eur(P.minFare), cap: capStr(), contact: CFG.CONTACT, deletion: CFG.DELETION_DATE }; }
  function t(k, v) {
    var s = (I18N[lang] && I18N[lang][k] != null) ? I18N[lang][k] : (I18N.es[k] != null ? I18N.es[k] : k);
    var vars = Object.assign(globals(), v || {});
    return String(s).replace(/\{(\w+)\}/g, function (m, n) { return vars[n] != null ? vars[n] : m; });
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function hm(min) { min = ((Math.round(min) % 1440) + 1440) % 1440; return ("0" + Math.floor(min / 60)).slice(-2) + ":" + ("0" + (min % 60)).slice(-2); }
  function toMin(s) { var m = /^(\d{1,2}):(\d{2})/.exec(s || ""); return m ? (+m[1]) * 60 + (+m[2]) : NaN; }
  function hav(a, b) {
    var R = 6371, r = Math.PI / 180, dLa = (b.lat - a.lat) * r, dLo = (b.lng - a.lng) * r;
    var x = Math.sin(dLa / 2) * Math.sin(dLa / 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLo / 2) * Math.sin(dLo / 2);
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  function sum(a) { return a.reduce(function (x, y) { return x + y; }, 0); }
  function shortLabel(s) { s = String(s || ""); return s.length > 28 ? s.slice(0, 27) + "…" : s; }

  /* ---------- Franjas, coches ---------- */
  function slotOfTime(s) {
    var m = toMin(s); if (isNaN(m)) return "am_peak";
    var h = m / 60;
    for (var i = 0; i < CFG.SLOTS.length; i++) {
      var sl = CFG.SLOTS[i];
      if (sl.from < sl.to ? (h >= sl.from && h < sl.to) : (h >= sl.from || h < sl.to)) return sl.id;
    }
    return CFG.SLOTS[CFG.SLOTS.length - 1].id;
  }
  function multOf(slot) { return F.slotMult(P, CFG.SLOTS, slot); }
  function fillCarSel(sel) {
    var v = sel.value, h = "";
    if (sel.dataset.each) h += '<option value="each">' + esc(t("car_each")) + "</option>";
    CARS.forEach(function (c) { h += '<option value="' + c + '">' + esc(t("car_" + c)) + "</option>"; });
    sel.innerHTML = h; if (v) sel.value = v;
    if (!sel.value) sel.selectedIndex = 0;
  }
  function fillSlotSel(sel, autoSlot) {
    var v = sel.value, h = "";
    if (sel.dataset.auto) h += '<option value="auto">' + esc(t("slot_auto", { slot: t("slot_" + autoSlot) })) + "</option>";
    CFG.SLOTS.forEach(function (s) { h += '<option value="' + s.id + '">' + esc(t("slot_" + s.id)) + "</option>"; });
    sel.innerHTML = h; if (v) sel.value = v;
    if (!sel.value) sel.selectedIndex = 0;
  }

  /* ---------- Datos ---------- */
  var DATA = {}, PL = {}, TRIPS = [], EXTRA = [];
  function getJSON(u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error(u); return r.json(); }); }
  function placePt(id) { var p = PL[id]; return { lat: p.lat, lng: p.lng, label: p.n, pid: p.id }; }

  function zoneOf(p) {
    var Z = DATA.zones; if (!Z || !p) return "unknown";
    var inC = Z.campuses.filter(function (c) { var b = c.bbox; return p.lng >= b[0] && p.lng <= b[2] && p.lat >= b[1] && p.lat <= b[3]; });
    if (inC.length) {
      inC.sort(function (a, b) { return hav(p, { lat: a.c[0], lng: a.c[1] }) - hav(p, { lat: b.c[0], lng: b.c[1] }); });
      return inC[0].id;
    }
    var best = null, bd = Infinity;
    Z.areas.forEach(function (a) { var d = hav(p, { lat: a.c[0], lng: a.c[1] }); if (d < bd) { bd = d; best = a; } });
    return best && bd <= Z.maxAreaKm ? best.id : "outside_area";
  }
  function inBBox(p) { var b = CFG.VALENCIA_BBOX; return p.lng >= b[0] && p.lng <= b[2] && p.lat >= b[1] && p.lat <= b[3]; }

  function fillQuick(sel, withBlank) {
    var v = sel.value, h = withBlank ? '<option value="">' + esc(t("quick_pick")) + "</option>" : "";
    [["campus", "grp_campus"], ["city", "grp_city"], ["metro", "grp_metro"]].forEach(function (g) {
      h += '<optgroup label="' + esc(t(g[1])) + '">';
      DATA.places.filter(function (p) { return p.g === g[0]; }).forEach(function (p) { h += '<option value="' + p.id + '">' + esc(p.n) + "</option>"; });
      h += "</optgroup>";
    });
    sel.innerHTML = h; sel.value = v;
  }

  /* ---------- Rutas: OSRM con plan B (línea recta × 1,3) ---------- */
  var RC = {}, active = 0, rq = [];
  function pump() { while (active < 2 && rq.length) rq.shift()(); }
  function limited(fn) {
    return new Promise(function (res) {
      rq.push(function () { active++; fn().then(function (v) { active--; res(v); pump(); }); });
      pump();
    });
  }
  function straight(pts) {
    var legs = [];
    for (var i = 1; i < pts.length; i++) legs.push(hav(pts[i - 1], pts[i]) * CFG.STRAIGHT_LINE_FACTOR);
    var ll = pts.map(function (p) { return [p.lat, p.lng]; });
    return { legs: legs, line: ll, wp: ll, mode: "fallback" };
  }
  function fetchOsrm(pts) {
    var coords = pts.map(function (p) { return p.lng.toFixed(5) + "," + p.lat.toFixed(5); }).join(";");
    var ctrl = new AbortController(), to = setTimeout(function () { ctrl.abort(); }, CFG.OSRM_TIMEOUT_MS);
    return fetch(CFG.OSRM_URL + coords + "?overview=full&geometries=geojson&steps=false", { signal: ctrl.signal })
      .then(function (r) { if (!r.ok) throw new Error("osrm " + r.status); return r.json(); })
      .then(function (d) {
        clearTimeout(to);
        if (d.code !== "Ok" || !d.routes || !d.routes.length) throw new Error("osrm");
        var r = d.routes[0];
        return {
          legs: r.legs.map(function (l) { return l.distance / 1000; }),
          line: r.geometry.coordinates.map(function (c) { return [c[1], c[0]]; }),
          wp: d.waypoints.map(function (w) { return [w.location[1], w.location[0]]; }),
          mode: "osrm"
        };
      })
      .catch(function () { clearTimeout(to); return straight(pts); });
  }
  function route(pts) {
    var key = pts.map(function (p) { return p.lat.toFixed(5) + "," + p.lng.toFixed(5); }).join(";");
    if (!RC[key]) {
      RC[key] = limited(function () { return fetchOsrm(pts); });
      RC[key].then(function (r) { if (r.mode !== "osrm") delete RC[key]; });
    }
    return RC[key];
  }
  // Trozos de geometría por tramo (vértice más cercano a cada parada)
  function legLines(r) {
    var line = r.line, idx = [0], from = 0;
    for (var k = 1; k < r.wp.length - 1; k++) {
      var w = { lat: r.wp[k][0], lng: r.wp[k][1] }, bi = from, bd = Infinity;
      for (var i = from; i < line.length; i++) { var d = hav(w, { lat: line[i][0], lng: line[i][1] }); if (d < bd) { bd = d; bi = i; } }
      idx.push(bi); from = bi;
    }
    idx.push(line.length - 1);
    var out = [];
    for (var j = 0; j < idx.length - 1; j++) out.push(line.slice(idx[j], Math.max(idx[j + 1], idx[j]) + 1));
    return out;
  }

  /* ---------- Mapas ---------- */
  var coarse = !!(window.matchMedia && matchMedia("(pointer:coarse)").matches);
  function makeMap(id) {
    var m = L.map(id, { scrollWheelZoom: true, zoomControl: true }).setView([39.48, -0.38], 11);
    L.tileLayer(CFG.TILE_URL, { attribution: CFG.TILE_ATTRIBUTION, maxZoom: 19 }).addTo(m);
    var el = m.getContainer();
    // La rueda del ratón solo hace zoom en el mapa: nunca desplaza la página.
    L.DomEvent.disableScrollPropagation(el);
    el.addEventListener("wheel", function (e) { e.preventDefault(); }, { passive: false });
    // Móvil: un dedo desplaza la página; dos dedos mueven y amplían el mapa.
    if (coarse) {
      m.dragging.disable();
      var hint = document.createElement("div"); hint.className = "maphint"; el.appendChild(hint);
      var ht = null;
      el.addEventListener("touchmove", function (e) {
        if (e.touches.length === 1) {
          hint.textContent = t("map_hint"); hint.classList.add("on");
          clearTimeout(ht); ht = setTimeout(function () { hint.classList.remove("on"); }, 1200);
        } else hint.classList.remove("on");
      }, { passive: true });
    }
    var w0 = 0;
    if (window.ResizeObserver) new ResizeObserver(function () {
      var w = el.offsetWidth; m.invalidateSize();
      if (!w0 && w && m._ffB) m.fitBounds(m._ffB, { maxZoom: 15 });
      w0 = w;
    }).observe(el);
    return m;
  }
  function fitTo(m, latlngs) {
    if (!latlngs.length) return;
    m._ffB = L.latLngBounds(latlngs).pad(0.12);
    if (m.getContainer().offsetWidth) m.fitBounds(m._ffB, { maxZoom: 15 });
  }
  function pinAt(color, txt, p, title) {
    var mk = L.marker([p.lat, p.lng], { icon: L.divIcon({ className: "", html: '<div class="pin" style="background:' + color + '">' + esc(txt || "") + "</div>", iconSize: [22, 22], iconAnchor: [11, 11] }), keyboard: false });
    if (title) mk.bindTooltip(esc(title));
    return mk;
  }

  /* ---------- Buscador de direcciones (Photon, área de València) ---------- */
  function photonLabel(pr) {
    var parts = [pr.name, pr.street && pr.housenumber ? pr.street + " " + pr.housenumber : pr.street, pr.district || pr.locality, pr.city];
    return parts.filter(function (x, i, a) { return x && a.indexOf(x) === i; }).join(", ");
  }
  function photon(q) {
    var b = CFG.VALENCIA_BBOX;
    var url = CFG.PHOTON_URL + "?q=" + encodeURIComponent(q) + "&limit=6&lat=39.47&lon=-0.37&bbox=" + b.join(",");
    return fetch(url).then(function (r) { if (!r.ok) throw new Error("photon"); return r.json(); }).then(function (d) {
      return (d.features || []).map(function (f) { return { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0], label: photonLabel(f.properties || {}) }; })
        .filter(function (p) { return p.label && inBBox(p); });
    });
  }
  function addrField(input, sel, onPick, onFocus) {
    var ul = document.createElement("ul"); ul.className = "sugg"; ul.hidden = true; ul.setAttribute("role", "listbox");
    input.parentNode.appendChild(ul);
    input.setAttribute("aria-autocomplete", "list");
    var timer = null, items = [], act = -1, seq = 0;
    function hide() { ul.hidden = true; ul.innerHTML = ""; items = []; act = -1; input.setAttribute("aria-expanded", "false"); }
    function pick(p) { input.value = p.label; sel.value = p.pid || ""; hide(); onPick(p); }
    function render(list, msg) {
      ul.innerHTML = ""; items = list; act = -1;
      if (msg) { var li0 = document.createElement("li"); li0.className = "msg"; li0.textContent = msg; ul.appendChild(li0); }
      list.forEach(function (p) {
        var li = document.createElement("li"); li.setAttribute("role", "option"); li.textContent = p.label;
        li.addEventListener("mousedown", function (e) { e.preventDefault(); pick(p); });
        ul.appendChild(li);
      });
      ul.hidden = false; input.setAttribute("aria-expanded", "true");
    }
    input.addEventListener("input", function () {
      clearTimeout(timer);
      var q = input.value.trim();
      if (q.length < 3) { hide(); return; }
      var my = ++seq;
      timer = setTimeout(function () {
        photon(q).then(function (res) { if (my !== seq) return; if (res.length) render(res); else render([], t("st_no_res")); })
          .catch(function () { if (my === seq) render([], t("st_search_err")); });
      }, 350);
    });
    input.addEventListener("keydown", function (e) {
      if (ul.hidden || !items.length) return;
      var lis = qsa("li[role=option]", ul);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault(); act = (act + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
        lis.forEach(function (l, i) { l.classList.toggle("act", i === act); });
      } else if (e.key === "Enter") { e.preventDefault(); pick(items[Math.max(0, act)]); }
      else if (e.key === "Escape") hide();
    });
    input.addEventListener("blur", function () { setTimeout(hide, 150); });
    if (onFocus) input.addEventListener("focus", onFocus);
    sel.addEventListener("change", function () { if (sel.value) pick(placePt(sel.value)); });
    return { set: function (p) { input.value = p ? p.label : ""; sel.value = (p && p.pid) || ""; } };
  }
  function mapPoint(ll) { return { lat: ll.lat, lng: ll.lng, label: t("map_point") + " (" + ll.lat.toFixed(4) + ", " + ll.lng.toFixed(4) + ")" }; }

  /* ---------- Modal ---------- */
  var lastFocus = null;
  function modal(html, onReady) {
    lastFocus = document.activeElement;
    $("modal-body").innerHTML = html; $("modal").classList.add("on");
    var f = $("modal-body").querySelector("button,a"); if (f) f.focus();
    if (onReady) onReady($("modal-body"));
  }
  function closeModal() { $("modal").classList.remove("on"); if (lastFocus && lastFocus.focus) lastFocus.focus(); }
  $("modal").addEventListener("click", function (e) { if (e.target === $("modal")) closeModal(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && $("modal").classList.contains("on")) closeModal(); });

  // Pantalla de revelación, en ES y EN a la vez
  function revealBlocks(hKey, pKeys) {
    function block(L2, cls) {
      var s = I18N[L2];
      return '<div class="' + cls + '"><h3' + (cls === "rv-main" ? ' id="modal-h"' : "") + ">" + esc(s[hKey]) + "</h3>" +
        pKeys.map(function (k) { return "<p>" + esc(s[k]) + "</p>"; }).join("") + "</div>";
    }
    return block(lang, "rv-main") + block(lang === "es" ? "en" : "es", "rv-other");
  }
  function reveal(extraTop, buttons, hKey, pKeys) {
    return (extraTop || "") + revealBlocks(hKey || "rv_h", pKeys || ["rv_p1", "rv_p2"]) +
      '<p><a href="#encuesta" data-act="survey">' + esc(t("rv_survey")) + "</a></p>" +
      '<div class="acts">' + buttons + "</div>";
  }

  /* ======================================================================
     BUSCAR VIAJE
     ====================================================================== */
  var S = { from: null, to: null, res: [], sel: -1, seq: 0, started: false, genN: 0, time: "08:00", seats: 1, slotSel: "auto", carSel: "each" };
  var sMap, sLayer, pMap, pLayer, fromF, toF;

  function sStatus(msg, warn) { var el = $("s-status"); el.textContent = msg || ""; el.classList.toggle("warn", !!warn); }
  function demoStart() { if (S.started) return; S.started = true; track("demo_start", { zone_from: zoneOf(S.from), zone_to: zoneOf(S.to) }); }
  function detourLimit(baseKm) { return Math.max(3, 0.3 * baseKm); }

  // Inserta al pasajero en un trayecto: sube/baja en una parada cercana (andando) o el conductor se desvía.
  function matchTrip(tr, from, to, seats) {
    var R = tr.route, n = R.length, WALK = 0.9, best = null, i;
    var baseLen = 0; for (i = 1; i < n; i++) baseLen += hav(R[i - 1], R[i]);
    var pu = [], dn = [];
    for (i = 0; i < n - 1; i++) { var w = hav(from, R[i]); if (w <= WALK) pu.push({ pos: i, at: i, walk: w }); }
    for (i = 1; i < n; i++) pu.push({ pos: i - 0.6, ins: true, walk: 0 });
    for (i = 1; i < n; i++) { var w2 = hav(to, R[i]); if (w2 <= WALK) dn.push({ pos: i, at: i, walk: w2 }); }
    for (i = 1; i < n; i++) dn.push({ pos: i - 0.4, ins: true, walk: 0 });
    var tDes = toMin(S.time);
    pu.forEach(function (a) {
      dn.forEach(function (b) {
        if (b.pos <= a.pos) return;
        var items = R.map(function (p, k) { return { p: p, pos: k, old: k }; });
        if (a.ins) items.push({ p: from, pos: a.pos });
        if (b.ins) items.push({ p: to, pos: b.pos });
        items.sort(function (x, y) { return x.pos - y.pos; });
        var newIdx = {}, up = -1, down = -1;
        items.forEach(function (it, k) { if (it.old != null) newIdx[it.old] = k; if (it.pos === a.pos) up = k; if (it.pos === b.pos) down = k; });
        var pax = tr.pax.map(function (p) { return { name: p.name, up: newIdx[p.up], down: newIdx[p.down], seats: 1 }; });
        for (var L1 = up; L1 < down; L1++) {
          var on = 0; pax.forEach(function (p) { if (p.up <= L1 && p.down > L1) on++; });
          if (on + seats > tr.cap) return;
        }
        var len = 0, kmTo = [0];
        for (var k = 1; k < items.length; k++) { len += hav(items[k - 1].p, items[k].p); kmTo.push(len); }
        var detour = (len - baseLen) * CFG.STRAIGHT_LINE_FACTOR;
        if (detour > detourLimit(baseLen * CFG.STRAIGHT_LINE_FACTOR)) return;
        var walk = a.walk + b.walk;
        var arr = toMin(tr.time) + kmTo[down] * CFG.STRAIGHT_LINE_FACTOR / CFG.SPEED_KM_MIN;
        var diff = arr - tDes;
        if (diff > 30 || diff < -90) return;
        var score = detour + walk * 2 + (diff > 0 ? diff : -diff * 0.3) / 8;
        if (!best || score < best.score) best = { trip: tr, route: items.map(function (it) { return it.p; }), up: up, down: down, pax: pax, walkUp: a.walk, walkDown: b.walk, puAt: a.ins ? null : a.at, doAt: b.ins ? null : b.at, score: score };
      });
    });
    return best;
  }

  // Si hay pocos trayectos publicados que encajen, se completan con conductores de la lista "extra"
  function genTrips(need, exclude) {
    var from = S.from, to = S.to, dFT = hav(from, to), out = [];
    var camp = DATA.places.filter(function (p) { return p.g === "campus"; }).sort(function (a, b) { return hav(a, to) - hav(b, to); })[0];
    var dest = camp && hav(camp, to) <= 1.5 ? placePt(camp.id) : { lat: to.lat, lng: to.lng, label: to.label };
    var cands = DATA.places.filter(function (p) {
      var dF = hav(p, from);
      return p.g !== "campus" && exclude.indexOf(p.id) < 0 && dF >= 1.5 && dF <= 12 && hav(p, dest) > 1;
    }).map(function (p) {
      var base = hav(p, dest), via = hav(p, from) + dFT + hav(to, dest);
      return { p: p, det: (via - base) * CFG.STRAIGHT_LINE_FACTOR, base: base * CFG.STRAIGHT_LINE_FACTOR };
    }).filter(function (c) { return c.det <= detourLimit(c.base) * 0.8; })
      .sort(function (a, b) { return a.det - b.det; });
    for (var k = 0; k < need && k < cands.length; k++) {
      var st = placePt(cands[k].p.id), x = EXTRA[(S.genN++) % EXTRA.length];
      var len = (hav(st, from) + dFT + hav(to, dest)) * CFG.STRAIGHT_LINE_FACTOR;
      var dep = toMin(S.time) - len / CFG.SPEED_KM_MIN - 4 - 6 * k;
      out.push({ id: "g" + S.genN, name: x.name, role: x.role, uni: x.uni, model: x.model, type: x.type, time: hm(dep), cap: 3, route: [st, dest], pax: [], gen: true });
    }
    return out;
  }

  function sRead() {
    S.time = $("s-time").value || "08:00";
    S.seats = +$("s-seats").value || 1;
    fillSlotSel($("s-slot"), slotOfTime(S.time));
    S.slotSel = $("s-slot").value || "auto";
    S.carSel = $("s-car").value || "each";
  }

  function runSearch(opts) {
    opts = opts || {};
    sRead();
    if (!S.from || !S.to) { sStatus(t("st_need_both"), true); return; }
    if (hav(S.from, S.to) < 0.3) { sStatus(t("st_same"), true); return; }
    if (!opts.auto) demoStart();
    var seq = ++S.seq;
    sStatus(t("st_routing"));
    $("s-go").disabled = true;
    TRIPS = TRIPS.filter(function (x) { return !x.gen; });
    var ms = TRIPS.map(function (tr) { return matchTrip(tr, S.from, S.to, S.seats); }).filter(Boolean)
      .sort(function (a, b) { return a.score - b.score; }).slice(0, 4);
    if (ms.length < 3) {
      var g = genTrips(3 - ms.length, ms.map(function (m) { return m.trip.route[0].pid; }));
      g.forEach(function (tr) { TRIPS.push(tr); var m = matchTrip(tr, S.from, S.to, S.seats); if (m) ms.push(m); });
    }
    Promise.all(ms.map(function (m) {
      return Promise.all([route(m.route), route(m.trip.route)]).then(function (r) { m.r = r[0]; m.base = r[1]; return m; });
    })).then(function (list) {
      if (seq !== S.seq) return;
      $("s-go").disabled = false;
      list.forEach(function (m) { m.detour = Math.max(0, sum(m.r.legs) - sum(m.base.legs)); });
      list.sort(function (a, b) { return a.score - b.score; });
      list.forEach(function (m, i) { m.rank = i + 1; priceRes(m); });
      S.res = list;
      S.routing = list.every(function (m) { return m.r.mode === "osrm"; }) ? "osrm" : "fallback";
      sStatus(!list.length ? t("st_none") : (S.routing === "fallback" ? t("st_fallback") : ""), S.routing === "fallback" || !list.length);
      S.sel = list.length ? 0 : -1;
      renderResults(); sDrawRoutes(true); renderBreak();
      if (!opts.auto && list.length) {
        var m0 = list[0], z = { zone_from: zoneOf(S.from), zone_to: zoneOf(S.to), slot: m0.slot, passengers: S.seats };
        track("route_shown", Object.assign({ option_rank: list.length }, z));
        track("fare_shown", Object.assign({ vehicle: m0.car, option_rank: 1, price: m0.me.price }, z));
      }
    });
  }

  function priceRes(m) {
    m.car = S.carSel === "each" ? m.trip.type : S.carSel;
    m.slot = S.slotSel === "auto" ? slotOfTime(S.time) : S.slotSel;
    m.mult = multOf(m.slot);
    var pax = m.pax.map(function (p) { return { name: p.name, up: p.up, down: p.down, seats: 1 }; });
    pax.push({ name: t("b_you"), up: m.up, down: m.down, seats: S.seats, me: true });
    m.allPax = pax;
    m.calc = F.calcTrip(m.r.legs, pax, P, m.car, m.mult);
    m.me = m.calc.pax[m.calc.pax.length - 1];
    m.save = 0;
    if (m.trip.pax.length) {
      var before = F.calcTrip(m.base.legs, m.trip.pax.map(function (p) { return { up: p.up, down: p.down, seats: 1 }; }), P, m.car, m.mult);
      var b = sum(before.pax.map(function (p) { return p.price; }));
      var a = sum(m.calc.pax.slice(0, -1).map(function (p) { return p.price; }));
      m.save = Math.max(0, b - a);
    }
    var dep = toMin(m.trip.time);
    m.tPick = hm(dep + sum(m.r.legs.slice(0, m.up)) / CFG.SPEED_KM_MIN);
    m.tArr = hm(dep + sum(m.r.legs.slice(0, m.down)) / CFG.SPEED_KM_MIN);
    var maxOn = 0;
    for (var L1 = m.up; L1 < m.down; L1++) { var on = 0; m.pax.forEach(function (p) { if (p.up <= L1 && p.down > L1) on++; }); maxOn = Math.max(maxOn, on); }
    m.free = m.trip.cap - maxOn;
  }

  function seatsTxt(n) { return n === 1 ? t("c_seat1") : t("c_seatn", { n: n }); }

  function renderResults() {
    var box = $("results");
    if (!S.res.length) { box.innerHTML = '<div class="card pad empty">' + esc(t("st_none")) + "</div>"; $("s-summary").textContent = ""; return; }
    $("s-summary").textContent = t("summary", { n: S.res.length });
    box.innerHTML = S.res.map(function (m, i) {
      priceRes(m);
      var tr = m.trip;
      var puLabel = m.puAt != null ? tr.route[m.puAt].label : S.from.label;
      var walk = m.puAt != null && m.walkUp > 0.02 ? t("c_walk", { m: meters(m.walkUp) }) : t("c_walk0");
      var role = tr.role ? (tr.role[lang] || tr.role.es) : t("you_driver");
      return '<article class="card trip' + (i === S.sel ? " sel" : "") + '" data-i="' + i + '" tabindex="0" aria-label="' + esc(t("rank", { n: m.rank }) + " · " + tr.name) + '">' +
        '<div class="top1"><div class="avatar" style="background:' + (UNI_COLOR[tr.uni] || "#0F1B3D") + '">' + esc(tr.name.charAt(0)) + "</div>" +
        '<div class="who"><span class="tiny muted">' + esc(t("rank", { n: m.rank })) + "</span><b>" + esc(tr.name) + "</b>" +
        '<span class="small muted">' + esc(role) + (UNI[tr.uni] ? " · " + UNI[tr.uni] : "") + (tr.published ? "" : " · " + esc(t("verified"))) + "</span>" +
        '<span class="small">' + esc(t("car_" + tr.type)) + (tr.model ? " · " + esc(tr.model) : "") + "</span></div>" +
        '<div class="pricebox"><div class="price">' + eur(m.me.price) + '</div><div class="tiny muted">' + esc(t("c_price_sub", { seats: seatsTxt(S.seats) })) + "</div></div></div>" +
        '<div class="mid"><span><b>' + esc(t("c_pickup", { label: shortLabel(puLabel) })) + "</b> · " + esc(walk) + "</span>" +
        "<span>" + esc(t("c_depart", { t: tr.time, p: m.tPick, a: m.tArr })) + "</span>" +
        "<span>" + esc(t("c_seats", { n: m.free })) + "</span>" +
        "<span>" + esc(m.detour > 0.05 ? t("c_detour", { km: km1(m.detour) }) : t("c_detour0")) + "</span>" +
        (m.save > 0.004 ? "<span>" + esc(t("c_others_save", { x: eur(m.save) })) + "</span>" : "") +
        (tr.published ? '<span class="chip">' + esc(t("pub_note")) + "</span>" : "") + "</div>" +
        '<div class="routeline">' + m.route.map(function (p, k) {
          var cls = k === m.up || k === m.down ? " me" : (k === m.route.length - 1 ? " end" : "");
          return '<span class="st' + cls + '">' + esc(shortLabel(p.label)) + "</span>";
        }).join("<span>→</span>") + "</div>" +
        '<div class="acts"><button class="btn ghost sm" type="button" data-act="break">' + esc(t("btn_break")) + "</button>" +
        '<button class="btn sm" type="button" data-act="reserve">' + esc(t("btn_reserve", { x: eur(m.me.price) })) + "</button></div></article>";
    }).join("");
  }

  function selectRes(i) {
    if (i < 0 || i >= S.res.length) return;
    var changed = i !== S.sel;
    S.sel = i;
    qsa("#results .trip").forEach(function (el) { el.classList.toggle("sel", +el.dataset.i === i); });
    if (changed) { sDrawRoutes(false); renderBreak(); }
    var m = S.res[i];
    track("driver_select", { option_rank: m.rank, vehicle: m.car, slot: m.slot, passengers: S.seats, price: m.me.price });
  }

  $("results").addEventListener("click", function (e) {
    var card = e.target.closest(".trip"); if (!card) return;
    var i = +card.dataset.i, b = e.target.closest("button");
    if (b && b.dataset.act === "reserve") { if (i !== S.sel) selectRes(i); door(i); return; }
    selectRes(i);
    if (b && b.dataset.act === "break") $("s-break").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  $("results").addEventListener("keydown", function (e) {
    var card = e.target.closest(".trip");
    if (card && e.target === card && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); selectRes(+card.dataset.i); }
  });

  function sDrawPoints() {
    sLayer.clearLayers();
    var pts = [];
    if (S.from) { pinAt("#F26B1D", "", S.from, t("lg_you")).addTo(sLayer); pts.push([S.from.lat, S.from.lng]); }
    if (S.to) { pinAt("#1E5EEB", "", S.to, t("lg_dest")).addTo(sLayer); pts.push([S.to.lat, S.to.lng]); }
    return pts;
  }
  function sDrawRoutes(fit) {
    var pts = sDrawPoints(), all = [];
    // Primero las rutas no elegidas (atenuadas) y la elegida encima
    var order = S.res.map(function (m, i) { return i; }).filter(function (i) { return i !== S.sel; });
    if (S.sel >= 0) order.push(S.sel);
    order.forEach(function (i) {
      var m = S.res[i], on = i === S.sel;
      var pl = L.polyline(m.r.line, on ? { color: "#0F1B3D", weight: 6, opacity: 0.9, bubblingMouseEvents: false, className: "rt-sel" }
                                       : { color: "#8A94A6", weight: 5, opacity: 0.4, bubblingMouseEvents: false, className: "rt-faded" });
      pl.on("click", function (e) { L.DomEvent.stop(e); selectRes(i); });
      pl.bindTooltip(esc(t("rank", { n: m.rank }) + " · " + m.trip.name + " · " + eur(m.me.price)), { sticky: true });
      pl.addTo(sLayer);
      all = all.concat(m.r.line);
      if (!on) return;
      var segs = legLines(m.r), mine = [];
      for (var L1 = m.up; L1 < m.down; L1++) mine = mine.concat(segs[L1] || []);
      if (mine.length > 1) L.polyline(mine, { color: "#F26B1D", weight: 7, opacity: 0.95, interactive: false, className: "rt-me" }).addTo(sLayer);
      m.route.forEach(function (p, k) {
        var last = k === m.route.length - 1;
        var c = k === m.up || k === m.down ? "#F26B1D" : k === 0 ? "#0F1B3D" : last ? "#1E5EEB" : "#16A866";
        pinAt(c, k === 0 ? "S" : last ? "D" : String(k), p, p.label).addTo(sLayer);
      });
      if (m.puAt != null && m.walkUp > 0.02) L.polyline([[S.from.lat, S.from.lng], [m.route[m.up].lat, m.route[m.up].lng]], { color: "#F26B1D", weight: 3, dashArray: "2 6", interactive: false }).addTo(sLayer);
      if (m.doAt != null && m.walkDown > 0.02) L.polyline([[m.route[m.down].lat, m.route[m.down].lng], [S.to.lat, S.to.lng]], { color: "#F26B1D", weight: 3, dashArray: "2 6", interactive: false }).addTo(sLayer);
    });
    if (fit) fitTo(sMap, all.length ? all : pts);
    var m0 = S.res[S.sel];
    $("s-routing").textContent = m0 ? (m0.r.mode === "osrm" ? t("st_osrm") : t("st_fallback")) : "";
  }

  /* ---------- Desglose ---------- */
  function kpi(v, l, cls) { return '<div class="kpi ' + (cls || "") + '"><div class="v">' + v + '</div><div class="l">' + esc(l) + "</div></div>"; }
  function splitHTML(drv, comm) {
    var tot = (drv + comm) || 1;
    return '<div class="split" role="img" aria-label="' + esc(t("split_drv") + " " + eur(drv) + " · " + t("split_ff") + " " + eur(comm)) + '"><div style="width:' + (drv / tot * 100).toFixed(1) + '%;background:var(--green)"></div><div style="width:' + (comm / tot * 100).toFixed(1) + '%;background:var(--blue)"></div></div>' +
      '<div class="legend"><span><i class="dot" style="background:var(--green)"></i>' + esc(t("split_drv")) + " " + eur(drv) + '</span><span><i class="dot" style="background:var(--blue)"></i>' + esc(t("split_ff")) + " " + eur(comm) + "</span></div>";
  }
  function reparto(c, pax) {
    var h = '<h3 style="margin-top:18px">' + esc(t("b_reparto")) + "</h3>";
    h += '<div class="scroll"><table><thead><tr><th>' + esc(t("b_pax")) + "</th><th>" + esc(t("b_legs")) + '</th><th class="r">' + esc(t("b_pays")) + '</th><th class="r">' + esc(t("b_ff")) + '</th><th class="r">' + esc(t("b_drv")) + "</th></tr></thead><tbody>";
    c.pax.forEach(function (r, i) {
      var p = pax[i];
      h += "<tr" + (p.me ? ' class="me"' : "") + "><td>" + esc(p.me ? t("b_you") : p.name) + (r.adjR > 0.004 ? ' <span class="tiny muted">(+' + eur(r.adjR) + ")</span>" : "") + "</td><td>" + (p.up + 1) + "→" + (p.down + 1) + '</td><td class="r">' + eur(r.price) + '</td><td class="r">' + eur(r.comm) + '</td><td class="r">' + eur(r.driver) + "</td></tr>";
    });
    h += '<tr class="tot"><td colspan="2">' + esc(t("b_totals")) + '</td><td class="r">' + eur(c.tot.paid) + '</td><td class="r">' + eur(c.tot.comm) + '</td><td class="r">' + eur(c.tot.driver) + "</td></tr></tbody></table></div>";
    h += '<div class="kpis" style="margin-top:12px">' + kpi(km1(c.tot.km) + " km", t("k_dist"), "") + kpi(eur(c.tot.carCost), t("k_carcost"), "o") +
      kpi(eur(c.tot.driver), t("k_drv"), "gg") + kpi(eur(c.tot.comm), t("k_ff"), "b") + "</div>";
    h += '<p class="calcline">' + esc(t("b_cap", { perkm: eur(c.tot.perKm), cap: capStr() })) + "</p>";
    if (c.capped) h += '<p class="calcline warn">' + esc(t("b_capped", { cap: capStr() })) + "</p>";
    return h;
  }
  function formulaLine(c, car, slot) { return '<p class="calcline">' + esc(t("b_formula", { cpk: nf(c.cpk, 3), car: t("car_" + car), mult: nf(c.mult, 2), slot: t("slot_" + slot) })) + "</p>"; }

  function renderBreak() {
    var box = $("s-break"), m = S.res[S.sel];
    if (!m) { box.innerHTML = "<h3>" + esc(t("b_title")) + '</h3><p class="small muted">' + esc(t("b_none")) + "</p>"; return; }
    var c = m.calc, me = m.me;
    var h = "<h3>" + esc(t("b_title")) + " · " + esc(m.trip.name) + "</h3>";
    h += '<div class="price" style="font-size:30px">' + eur(me.price) + '</div><div class="tiny muted">' + esc(t("c_price_sub", { seats: seatsTxt(S.seats) })) + "</div>";
    h += formulaLine(c, m.car, m.slot);
    h += '<div class="scroll"><table><thead><tr><th>' + esc(t("b_leg")) + '</th><th class="r">' + esc(t("b_km")) + '</th><th class="r">' + esc(t("b_cost")) + '</th><th class="r">' + esc(t("b_people")) + '</th><th class="r">' + esc(t("b_share")) + "</th></tr></thead><tbody>";
    for (var i = m.up; i < m.down; i++) {
      var lg = c.legs[i];
      h += "<tr><td>" + esc(t("leg_line", { a: shortLabel(m.route[i].label), b: shortLabel(m.route[i + 1].label) })) + '</td><td class="r">' + km1(lg.km) + '</td><td class="r">' + eur(lg.cost) + '</td><td class="r">' + lg.occ + '</td><td class="r">' + eur(lg.share * me.seats) + "</td></tr>";
    }
    h += '<tr><td colspan="4">' + esc(t("b_sum")) + (me.seats > 1 ? " (" + esc(seatsTxt(me.seats)) + ")" : "") + '</td><td class="r">' + eur(me.baseR) + "</td></tr>";
    if (me.adjR > 0.004) h += '<tr class="adj"><td colspan="4">' + esc(t("b_adj")) + '</td><td class="r">' + eur(me.adjR) + "</td></tr>";
    h += '<tr class="tot"><td colspan="4">' + esc(t("b_total")) + '</td><td class="r">' + eur(me.price) + "</td></tr></tbody></table></div>";
    h += splitHTML(me.driver, me.comm);
    h += '<p class="small" style="margin:4px 0 0">' + esc(t("b_split", { drv: eur(me.driver), comm: eur(me.comm), pct: pct(P.commission) })) + "</p>";
    h += reparto(c, m.allPax);
    var occ = null, same = S.seats === 1;
    for (i = m.up; i < m.down; i++) { var o = c.legs[i].onboard; if (occ == null) occ = o; else if (o !== occ) same = false; }
    if (same && occ >= 1 && occ <= 4) h += '<p style="margin:12px 0 0"><a href="#tarifario" data-check="1">' + esc(t("b_check")) + "</a></p>";
    box.innerHTML = h;
  }
  $("s-break").addEventListener("click", function (e) {
    var a = e.target.closest("a[data-check]"); if (!a) return;
    e.preventDefault();
    var m = S.res[S.sel]; if (!m) return;
    C.km = Math.round(m.me.km * 10) / 10; C.n = m.calc.legs[m.up].onboard; C.car = m.car; C.slot = m.slot;
    $("c-car").value = C.car; $("c-slot").value = C.slot;
    location.hash = "#tarifario"; renderTarifario();
  });

  // Puerta falsa: "Reservar por X €" → pantalla de revelación
  function door(i) {
    var m = S.res[i];
    track("reserve_click", { zone_from: zoneOf(S.from), zone_to: zoneOf(S.to), slot: m.slot, vehicle: m.car, passengers: S.seats, option_rank: m.rank, price: m.me.price });
    var top = '<p class="small muted" style="margin:0 0 8px">' + esc(t("rv_price", { x: eur(m.me.price) })) + "</p>";
    modal(reveal(top, '<button class="btn" type="button" data-act="yes">' + esc(t("rv_join")) + '</button><button class="btn ghost" type="button" data-act="no">' + esc(t("close")) + "</button>"), function (b) {
      b.querySelector('[data-act="yes"]').onclick = function () { track("door_yes", { option_rank: m.rank, vehicle: m.car }); closeModal(); goTo("join"); };
      b.querySelector('[data-act="no"]').onclick = function () { track("door_no", { option_rank: m.rank, vehicle: m.car }); closeModal(); };
      b.querySelector('[data-act="survey"]').onclick = function (e) { e.preventDefault(); track("door_yes", { option_rank: m.rank, vehicle: m.car }); closeModal(); goTo("encuesta"); };
    });
  }
  function goTo(id) {
    if (location.hash !== "#inicio") location.hash = "#inicio";
    setTimeout(function () { $(id).scrollIntoView({ behavior: "smooth", block: "start" }); if (id === "join") $("f-name").focus({ preventScroll: true }); }, 80);
  }

  /* ======================================================================
     PUBLICAR TRAYECTO
     ====================================================================== */
  var PB = { stops: [], pax: [], started: false, calc: null, r: null, seq: 0 };
  function pbStart() { if (PB.started) return; PB.started = true; track("publish_start", {}); }
  function stopName(i) { return i === 0 ? t("stop_o") : (i === PB.stops.length - 1 ? t("stop_d") : t("stop_n", { n: i })); }
  function stopShort(i) { var p = PB.stops[i]; return p ? shortLabel(p.label) : stopName(i); }

  function renderStops() {
    var box = $("p-stops"); box.innerHTML = "";
    PB.stops.forEach(function (p, i) {
      var row = document.createElement("div"); row.className = "stoprow";
      var last = i === PB.stops.length - 1;
      row.innerHTML = '<span class="badge' + (i === 0 || last ? "" : " o") + '">' + (i === 0 ? "S" : last ? "D" : i) + "</span>" +
        '<div class="field addr" style="margin:0"><label class="sr" for="p-stop-' + i + '">' + esc(stopName(i)) + "</label>" +
        '<input type="text" id="p-stop-' + i + '" autocomplete="off" placeholder="' + esc(stopName(i)) + '">' +
        '<select aria-label="' + esc(stopName(i) + " · " + t("quick_pick")) + '"></select></div>' +
        '<button class="x" type="button" aria-label="' + esc(t("stop_remove")) + '"' + (i === 0 || last ? " disabled" : "") + ">✕</button>";
      box.appendChild(row);
      var input = row.querySelector("input"), sel = row.querySelector("select");
      fillQuick(sel, true);
      var f = addrField(input, sel, function (pt) { PB.stops[i] = pt; pbStart(); renderPaxLabels(); pbRecalc(); }, function () { $("p-click").value = String(i); });
      f.set(p);
      row.querySelector(".x").onclick = function () { pbStart(); removeStop(i); };
    });
    var ps = $("p-click"), v = ps.value;
    ps.innerHTML = PB.stops.map(function (p, i) { return '<option value="' + i + '">' + esc(stopName(i)) + "</option>"; }).join("");
    ps.value = v !== "" && +v < PB.stops.length ? v : String(PB.stops.length - 1);
    var firstEmpty = PB.stops.findIndex(function (s) { return !s; }); if (firstEmpty >= 0) ps.value = String(firstEmpty);
    $("p-addstop").disabled = PB.stops.length >= 7;
  }
  function removeStop(k) {
    PB.stops.splice(k, 1);
    var n = PB.stops.length;
    PB.pax.forEach(function (p) {
      if (p.up > k) p.up--;
      if (p.down >= k) p.down = Math.max(p.down - 1, 1);
      if (p.up > n - 2) p.up = n - 2;
      if (p.down <= p.up) p.down = Math.min(p.up + 1, n - 1);
    });
    renderStops(); renderPax(); pbRecalc();
  }
  $("p-addstop").onclick = function () {
    pbStart();
    var d = PB.stops.length - 1;
    PB.stops.splice(d, 0, null);
    PB.pax.forEach(function (p) { if (p.down >= d) p.down++; if (p.up >= d) p.up++; });
    renderStops(); renderPax(); $("p-click").value = String(d); pbRecalc();
    var inp = $("p-stop-" + d); if (inp) inp.focus();
  };
  function renderPax() {
    var box = $("p-pax"), n = PB.stops.length; box.innerHTML = "";
    PB.pax.forEach(function (p, i) {
      var row = document.createElement("div"); row.className = "paxrow";
      var up = "", dn = "", k;
      for (k = 0; k < n - 1; k++) up += '<option value="' + k + '"' + (k === p.up ? " selected" : "") + ">" + esc((k + 1) + " · " + stopShort(k)) + "</option>";
      for (k = 1; k < n; k++) dn += '<option value="' + k + '"' + (k === p.down ? " selected" : "") + ">" + esc((k + 1) + " · " + stopShort(k)) + "</option>";
      row.innerHTML = '<input type="text" maxlength="30" aria-label="' + esc(t("p_name")) + '" value="' + esc(p.name) + '">' +
        '<select aria-label="' + esc(t("p_up")) + '">' + up + "</select>" +
        '<select aria-label="' + esc(t("p_down")) + '">' + dn + "</select>" +
        '<button class="x" type="button" aria-label="' + esc(t("pax_remove")) + '">✕</button>';
      var els = row.querySelectorAll("input,select");
      els[0].oninput = function () { pbStart(); p.name = els[0].value; els[0].classList.remove("bad"); pbRender(false); };
      els[1].onchange = function () { pbStart(); p.up = +els[1].value; if (p.down <= p.up) { p.down = Math.min(p.up + 1, n - 1); els[2].value = p.down; } pbRender(false); };
      els[2].onchange = function () { pbStart(); p.down = +els[2].value; if (p.down <= p.up) { p.up = Math.max(p.down - 1, 0); els[1].value = p.up; } pbRender(false); };
      row.querySelector(".x").onclick = function () { pbStart(); PB.pax.splice(i, 1); renderPax(); pbRender(false); };
      box.appendChild(row);
    });
    $("p-addpax").disabled = PB.pax.length >= 8;
  }
  $("p-addpax").onclick = function () {
    pbStart();
    var names = ["Nuria", "Marc", "Sara", "Iván", "Clara", "Hugo", "Eva", "Raúl"];
    PB.pax.push({ name: names[PB.pax.length % names.length], up: 0, down: PB.stops.length - 1 });
    renderPax(); pbRender(false);
  };
  ["p-time", "p-cap", "p-car", "p-slot"].forEach(function (id) {
    $(id).addEventListener("change", function () { pbStart(); if (id === "p-time") fillSlotSel($("p-slot"), slotOfTime($("p-time").value)); pbRender(false); });
  });
  function renderPaxLabels() {
    qsa("#p-pax .paxrow select option").forEach(function (o) { o.textContent = (+o.value + 1) + " · " + stopShort(+o.value); });
  }
  function pbRecalc() {
    if (PB.stops.some(function (p) { return !p; })) { PB.r = null; PB.seq++; pbRender(true); return; }
    var seq = ++PB.seq;
    $("p-status").textContent = t("st_routing"); $("p-status").classList.remove("warn");
    route(PB.stops).then(function (r) {
      if (seq !== PB.seq) return;
      PB.r = r; $("p-status").textContent = r.mode === "osrm" ? "" : t("st_fallback");
      pbRender(true);
    });
  }
  function pbParams() {
    var slotSel = $("p-slot").value || "auto";
    var slot = slotSel === "auto" ? slotOfTime($("p-time").value) : slotSel;
    return { car: $("p-car").value || "petrol", slot: slot, mult: multOf(slot), cap: +$("p-cap").value || 3 };
  }
  function pbRender(fit) {
    var pp = pbParams(), legsBox = $("p-legs"), brk = $("p-break"), pts = [];
    pLayer.clearLayers();
    PB.stops.forEach(function (p, i) {
      if (!p) return; pts.push([p.lat, p.lng]);
      var last = i === PB.stops.length - 1;
      pinAt(i === 0 ? "#0F1B3D" : last ? "#1E5EEB" : "#16A866", i === 0 ? "S" : last ? "D" : String(i), p, p.label).addTo(pLayer);
    });
    if (!PB.r) {
      legsBox.innerHTML = '<p class="small muted">' + esc(t("p_need_stops")) + "</p>";
      brk.innerHTML = "<h3>" + esc(t("p_br_title")) + '</h3><p class="small muted">' + esc(t("p_need_stops")) + "</p>";
      $("p-warn").innerHTML = ""; PB.calc = null; $("p-routing").textContent = "";
      if (fit) fitTo(pMap, pts);
      return;
    }
    L.polyline(PB.r.line, { color: "#0F1B3D", weight: 6, opacity: 0.85, interactive: false }).addTo(pLayer);
    if (fit) fitTo(pMap, PB.r.line);
    $("p-routing").textContent = PB.r.mode === "osrm" ? t("st_osrm") : t("st_fallback");
    var pax = PB.pax.map(function (p) { return { name: p.name, up: p.up, down: p.down, seats: 1 }; });
    var c = F.calcTrip(PB.r.legs, pax, P, pp.car, pp.mult), over = null;
    PB.calc = c;
    legsBox.innerHTML = c.legs.map(function (lg, i) {
      var seats = '<span class="seat dr" title="' + esc(t("seat_driver")) + '"></span>';
      for (var k = 0; k < Math.max(pp.cap, lg.onboard); k++) {
        var cls = k < lg.onboard ? (k >= pp.cap ? "seat over" : "seat p") : "seat";
        seats += '<span class="' + cls + '" title="' + esc(k < lg.onboard ? t("seat_taken") : t("seat_free")) + '"></span>';
      }
      if (lg.onboard > pp.cap && !over) over = { leg: i + 1, n: lg.onboard };
      return '<div class="leg"><span>' + esc(t("leg_line", { a: stopShort(i), b: stopShort(i + 1) })) + ' · <span class="muted">' + km1(lg.km) + ' km</span></span><span class="seats">' + seats + '</span><span class="r">' + eur(lg.cost) + "</span></div>";
    }).join("");
    $("p-warn").innerHTML = over ? '<p class="status warn">' + esc(t("p_over", { leg: over.leg, n: over.n, cap: pp.cap })) + "</p>" : "";
    var h = "<h3>" + esc(t("p_br_title")) + "</h3>" + formulaLine(c, pp.car, pp.slot);
    h += PB.pax.length ? reparto(c, pax.map(function (p) { return { name: p.name || "—", up: p.up, down: p.down }; })) : '<p class="small muted">' + esc(t("p_err_nopax")) + "</p>";
    brk.innerHTML = h;
  }

  $("p-publish").onclick = function () {
    pbStart();
    var errs = [], pp = pbParams();
    if (isNaN(toMin($("p-time").value))) errs.push(t("p_err_time"));
    if (PB.stops.some(function (p) { return !p; })) errs.push(t("p_need_stops"));
    for (var i = 1; i < PB.stops.length; i++) if (PB.stops[i] && PB.stops[i - 1] && hav(PB.stops[i], PB.stops[i - 1]) < 0.05) { errs.push(t("p_err_same")); break; }
    if (!PB.pax.length) errs.push(t("p_err_nopax"));
    var nameRe = /^[\p{L}][\p{L} '.\-]{0,29}$/u, badName = false;
    qsa("#p-pax .paxrow input").forEach(function (inp, k) { var ok = nameRe.test((PB.pax[k].name || "").trim()); inp.classList.toggle("bad", !ok); if (!ok) badName = true; });
    if (badName) errs.push(t("p_err_name"));
    if (PB.calc && PB.calc.legs.some(function (l) { return l.onboard > pp.cap; })) errs.push(t("p_err_cap", { cap: pp.cap }));
    if (!PB.r && !errs.length) errs.push(t("st_routing"));
    if (errs.length) { $("p-status").innerHTML = errs.map(esc).join("<br>"); $("p-status").classList.add("warn"); return; }
    $("p-status").textContent = ""; $("p-status").classList.remove("warn");
    TRIPS.push({
      id: "pub" + (TRIPS.length + 1), name: t("you_driver"), role: null, uni: "", model: "", type: pp.car,
      time: hm(toMin($("p-time").value)), cap: pp.cap, route: PB.stops.slice(),
      pax: PB.pax.map(function (p) { return { name: p.name.trim(), up: p.up, down: p.down }; }), published: true
    });
    track("publish_done", { zone_from: zoneOf(PB.stops[0]), zone_to: zoneOf(PB.stops[PB.stops.length - 1]), slot: pp.slot, vehicle: pp.car, passengers: PB.pax.length, price: PB.calc ? PB.calc.tot.paid : null });
    modal(reveal("", '<button class="btn" type="button" data-act="go">' + esc(t("p_done_go")) + '</button><button class="btn ghost" type="button" data-act="no">' + esc(t("close")) + "</button>", "p_done_h", ["p_done_p"]), function (b) {
      b.querySelector('[data-act="go"]').onclick = function () { closeModal(); location.hash = "#buscar"; };
      b.querySelector('[data-act="no"]').onclick = closeModal;
      b.querySelector('[data-act="survey"]').onclick = function (e) { e.preventDefault(); closeModal(); goTo("encuesta"); };
    });
  };

  /* ======================================================================
     TARIFARIO
     ====================================================================== */
  var C = { km: 15, n: 2, car: "petrol", slot: "am_peak" };
  function renderTarifario() {
    $("c-km").value = Math.min(60, Math.max(1, C.km)); $("c-kmn").value = C.km;
    qsa("#c-pax button").forEach(function (b) { var on = +b.dataset.n === C.n; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); });
    var mult = multOf(C.slot), c = F.simple(C.km, C.n, P, C.car, mult), p0 = c.pax[0], lg = c.legs[0];
    $("c-out").innerHTML = kpi(eur(p0.price), t("o_price"), "b") + kpi(eur(c.tot.carCost), t("o_carcost"), "o") + kpi(eur(c.tot.driver), t("o_drv"), "gg") + kpi(eur(c.tot.comm), t("o_ff"), "");
    var d = '<p class="calcline">' + esc(t("d_line", { km: km1(C.km), cpk: nf(c.cpk, 3), mult: nf(mult, 2), cost: eur(lg.cost), occ: lg.occ, share: eur(lg.share) })) + "</p>";
    if (p0.adjR > 0.004) d += '<p class="calcline" style="color:var(--orange)">' + esc(t("d_adj", { adj: eur(p0.adjR) })) + "</p>";
    d += '<p class="calcline">' + esc(t("d_comm", { comm: eur(p0.comm), pct: pct(P.commission) })) + "</p>";
    d += '<p class="calcline">' + esc(t("b_cap", { perkm: eur(c.tot.perKm), cap: capStr() })) + "</p>";
    if (c.capped) d += '<p class="calcline warn">' + esc(t("b_capped", { cap: capStr() })) + "</p>";
    $("c-detail").innerHTML = d;
    $("c-split").innerHTML = splitHTML(p0.driver, p0.comm) + '<p class="small muted">' + esc(t("b_split", { drv: eur(p0.driver), comm: eur(p0.comm), pct: pct(P.commission) })) + "</p>";
    $("ref-sub").textContent = t("ref_sub", { car: t("car_" + C.car), slot: t("slot_" + C.slot) });
    var h = "<thead><tr><th>" + esc(t("ref_route")) + "</th>", n;
    for (n = 1; n <= 4; n++) h += '<th class="r">' + esc(t("ref_n", { n: n })) + "</th>";
    h += "</tr></thead><tbody>";
    DATA.routes.forEach(function (r) {
      h += "<tr><td>" + esc(PL[r.from].n) + " → " + esc(PL[r.to].n) + ' <span class="muted">· ' + km1(r.km) + " km</span></td>";
      for (var k = 1; k <= 4; k++) { var x = F.simple(r.km, k, P, C.car, mult); h += '<td class="r"><span class="pp">' + eur(x.pax[0].price) + '</span><span class="dr">' + esc(t("ref_drv", { x: eur(x.tot.driver) })) + "</span></td>"; }
      h += "</tr>";
    });
    $("t-routes").innerHTML = h + "</tbody>";
  }
  function setKm(v) { v = parseFloat(String(v).replace(",", ".")); if (!isFinite(v) || v <= 0) return; C.km = Math.min(200, Math.round(v * 10) / 10); renderTarifario(); }
  $("c-km").addEventListener("input", function () { setKm($("c-km").value); });
  $("c-kmn").addEventListener("change", function () { setKm($("c-kmn").value); });
  qsa("#c-pax button").forEach(function (b) { b.onclick = function () { C.n = +b.dataset.n; renderTarifario(); }; });
  $("c-car").addEventListener("change", function () { C.car = $("c-car").value; renderTarifario(); });
  $("c-slot").addEventListener("change", function () { C.slot = $("c-slot").value; renderTarifario(); });

  var PARAMS = [];
  CARS.forEach(function (c) { PARAMS.push({ k: "cpk_" + c, get: function () { return P.costPerKm[c]; }, set: function (v) { P.costPerKm[c] = v; }, lbl: function () { return t("pp_cpk", { car: t("car_" + c) }); }, step: 0.001, min: 0, max: 2 }); });
  ["offpeak", "am_peak", "pm_peak"].forEach(function (f) { PARAMS.push({ k: "f_" + f, get: function () { return P.factor[f]; }, set: function (v) { P.factor[f] = v; }, lbl: function () { return t("pp_f_" + f); }, step: 0.01, min: 0.5, max: 3 }); });
  PARAMS.push({ k: "comm", get: function () { return Math.round(P.commission * 1000) / 10; }, set: function (v) { P.commission = v / 100; }, lbl: function () { return t("pp_comm"); }, step: 0.5, min: 0, max: 50 });
  PARAMS.push({ k: "min", get: function () { return P.minFare; }, set: function (v) { P.minFare = v; }, lbl: function () { return t("pp_min"); }, step: 0.05, min: 0, max: 5 });
  PARAMS.push({ k: "cap", get: function () { return P.maxPerKm; }, set: function (v) { P.maxPerKm = v; }, lbl: function () { return t("pp_cap"); }, step: 0.01, min: 0.01, max: 2 });
  function renderParams() {
    $("params").innerHTML = PARAMS.map(function (p) {
      return '<div class="field"><label for="pp-' + p.k + '">' + esc(p.lbl()) + '</label><input type="number" inputmode="decimal" id="pp-' + p.k + '" step="' + p.step + '" min="' + p.min + '" max="' + p.max + '" value="' + p.get() + '"></div>';
    }).join("");
    PARAMS.forEach(function (p) {
      var el = $("pp-" + p.k);
      el.addEventListener("input", function () {
        var v = parseFloat(el.value.replace(",", "."));
        var ok = isFinite(v) && v >= p.min && v <= p.max;
        el.classList.toggle("bad", !ok);
        if (ok) { p.set(v); recalcAll(); }
      });
    });
  }
  $("pp-reset").onclick = function () { P = JSON.parse(JSON.stringify(DEF)); renderParams(); recalcAll(); };
  function recalcAll() {
    applyValues(); renderTarifario();
    if (S.res.length) { renderResults(); sDrawRoutes(false); renderBreak(); }
    pbRender(false); heroLead();
  }

  /* ======================================================================
     INICIO Y FORMULARIOS
     ====================================================================== */
  function heroLead() {
    var el = $("heroLead");
    if (variant.hero === "savings") {
      var r = DATA.routes.filter(function (x) { return x.from === "puig" && x.to === "upv"; })[0], km = r ? r.km : 16.1;
      var x = F.simple(km, 1, P, "petrol", multOf("am_peak"));
      el.textContent = t("hero_lead_savings", { km: km1(km), price: eur(x.pax[0].price) });
    } else el.textContent = t("hero_lead_community");
  }
  $("h-go").onclick = function () {
    S.from = placePt($("h-from").value); S.to = placePt($("h-to").value);
    fromF.set(S.from); toF.set(S.to);
    $("s-time").value = $("h-time").value || "08:00"; $("s-seats").value = $("h-seats").value;
    autoRan = true;
    location.hash = "#buscar";
    setTimeout(function () { runSearch(); }, 30);
  };

  var formStarted = false;
  $("joinForm").addEventListener("input", function () { if (!formStarted) { formStarted = true; track("form_start", {}); } });
  $("joinForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var name = $("f-name").value.trim(), email = $("f-email").value.trim();
    var nOk = /^[\p{L}][\p{L} '.\-]{1,79}$/u.test(name), eOk = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/.test(email), aOk = $("f-adult").checked;
    $("e-name").textContent = nOk ? "" : t("err_name"); $("f-name").classList.toggle("bad", !nOk); $("f-name").setAttribute("aria-invalid", !nOk);
    $("e-email").textContent = eOk ? "" : t("err_email"); $("f-email").classList.toggle("bad", !eOk); $("f-email").setAttribute("aria-invalid", !eOk);
    $("e-adult").textContent = aOk ? "" : t("err_adult");
    if (!(nOk && eOk && aOk)) { (!nOk ? $("f-name") : !eOk ? $("f-email") : $("f-adult")).focus(); return; }
    // Solo se cuenta el envío; nombre, correo y el resto del formulario se descartan aquí mismo.
    track("form_submit", {});
    $("joinForm").reset(); formStarted = false;
    modal(reveal("", '<button class="btn ghost" type="button" data-act="no">' + esc(t("close")) + "</button>"), function (b) {
      b.querySelector('[data-act="no"]').onclick = closeModal;
      b.querySelector('[data-act="survey"]').onclick = function (ev) { ev.preventDefault(); closeModal(); goTo("encuesta"); };
    });
  });
  $("surveyForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var parts = [["mode", "q-mode"], ["days", "q-days"], ["spend", "q-spend"], ["cheap", "q-cheap"], ["exp", "q-exp"], ["pay", "q-pay"]]
      .map(function (p) { var el = $(p[1]), v = el ? el.value : ""; return v && /^[a-z0-9_]{1,16}$/i.test(v) ? p[0] + "=" + v : ""; }).filter(Boolean);
    track("survey_submit", { survey: parts.join(";") });
    $("surveyForm").reset();
    $("s-thanks").hidden = false;
  });
  function fillPriceSels() {
    qsa(".pricesel").forEach(function (sel) {
      var v = sel.value, h = '<option value="">' + esc(t("any")) + "</option>";
      for (var i = 1; i <= 12; i++) { var x = i * 0.25; h += '<option value="' + x.toFixed(2).replace(".", "_") + '">' + eur(x) + "</option>"; }
      h += '<option value="dk">' + esc(t("dk")) + "</option>";
      sel.innerHTML = h; sel.value = v;
    });
  }

  /* ---------- Textos ---------- */
  function applyValues() {
    qsa(".v-comm").forEach(function (e) { e.textContent = pct(P.commission); });
    qsa(".v-cap").forEach(function (e) { e.textContent = capStr(); });
    qsa(".v-min").forEach(function (e) { e.textContent = eur(P.minFare); });
    qsa("[data-i18n]").forEach(function (e) { e.textContent = t(e.dataset.i18n); });
    qsa("[data-i18n-html]").forEach(function (e) { e.innerHTML = t(e.dataset.i18nHtml); });
    qsa(".v-comm").forEach(function (e) { e.textContent = pct(P.commission); });
    qsa(".v-cap").forEach(function (e) { e.textContent = capStr(); });
    qsa(".v-min").forEach(function (e) { e.textContent = eur(P.minFare); });
  }
  function applyStatic() {
    document.documentElement.lang = lang;
    $("langBtn").textContent = t("lang_btn"); $("langBtn").setAttribute("aria-label", t("lang_label")); $("langBtn").title = t("lang_label");
    qsa("[data-i18n-ph]").forEach(function (e) { e.placeholder = t(e.dataset.i18nPh); });
    qsa("[data-i18n-aria]").forEach(function (e) { e.setAttribute("aria-label", t(e.dataset.i18nAria)); });
    qsa(".carsel").forEach(fillCarSel);
    fillSlotSel($("s-slot"), slotOfTime($("s-time").value));
    fillSlotSel($("p-slot"), slotOfTime($("p-time").value));
    fillSlotSel($("c-slot"));
    ["h-from", "h-to", "s-from-q", "s-to-q"].forEach(function (id) { fillQuick($(id), id.indexOf("s-") === 0); });
    fillPriceSels();
    applyValues(); heroLead();
  }
  $("langBtn").onclick = function () {
    lang = lang === "es" ? "en" : "es"; window.FF_CTX.lang = lang;
    var u = new URL(location.href); if (lang === "en") u.searchParams.set("lang", "en"); else u.searchParams.delete("lang");
    history.replaceState(null, "", u.pathname + u.search + u.hash);
    applyStatic(); renderStops(); renderPax(); pbRender(false); renderTarifario(); renderParams();
    if (S.res.length) { renderResults(); sDrawRoutes(false); }
    renderBreak();
    track("lang_switch", {});
  };

  /* ---------- Pestañas ---------- */
  var VIEWS = ["inicio", "buscar", "publicar", "tarifario"], autoRan = false;
  function show() {
    var h = (location.hash || "#inicio").slice(1), v = VIEWS.indexOf(h) >= 0 ? h : "inicio";
    VIEWS.forEach(function (x) { $("v-" + x).classList.toggle("on", x === v); });
    qsa(".nav nav a").forEach(function (a) { var on = a.dataset.v === v; a.classList.toggle("on", on); if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    if (VIEWS.indexOf(h) >= 0) window.scrollTo(0, 0);
    else if (h && $(h)) setTimeout(function () { $(h).scrollIntoView(); }, 0);
    if (v === "buscar") {
      setTimeout(function () { sMap.invalidateSize(); if (sMap._ffB) sMap.fitBounds(sMap._ffB, { maxZoom: 15 }); }, 0);
      if (!autoRan) { autoRan = true; runSearch({ auto: true }); }
    }
    if (v === "publicar") setTimeout(function () { pMap.invalidateSize(); if (pMap._ffB) pMap.fitBounds(pMap._ffB, { maxZoom: 15 }); }, 0);
  }
  addEventListener("hashchange", show);

  /* ---------- Arranque ---------- */
  Promise.all([getJSON("data/places.json"), getJSON("data/trips.json"), getJSON("data/zones.json"), getJSON("data/ref_routes.json")]).then(function (d) {
    DATA.places = d[0].places; DATA.places.forEach(function (p) { PL[p.id] = p; });
    DATA.zones = d[2]; DATA.routes = d[3].routes;
    TRIPS = d[1].trips.map(function (tr) { return Object.assign({}, tr, { route: tr.route.map(placePt) }); });
    EXTRA = d[1].extra;

    applyStatic();
    $("h-from").value = "puig"; $("h-to").value = "upv";
    $("c-car").value = C.car; $("c-slot").value = C.slot;

    sMap = makeMap("s-map"); sLayer = L.layerGroup().addTo(sMap);
    pMap = makeMap("p-map"); pLayer = L.layerGroup().addTo(pMap);

    // Buscar
    var clickR = qsa('input[name="s-click"]');
    function setFrom(p) { S.from = p; sStatus(""); clickR[1].checked = true; }
    function setTo(p) { S.to = p; sStatus(""); }
    fromF = addrField($("s-from"), $("s-from-q"), function (p) { setFrom(p); if (S.to) runSearch(); else sDrawPoints(); }, function () { clickR[0].checked = true; });
    toF = addrField($("s-to"), $("s-to-q"), function (p) { setTo(p); if (S.from) runSearch(); else sDrawPoints(); }, function () { clickR[1].checked = true; });
    S.from = placePt("puig"); S.to = placePt("upv"); fromF.set(S.from); toF.set(S.to);
    sMap.on("click", function (e) {
      var p = mapPoint(e.latlng);
      if (!inBBox(p)) { sStatus(t("st_outside"), true); return; }
      var w = (document.querySelector('input[name="s-click"]:checked') || clickR[0]).value;
      if (w === "from") { fromF.set(p); setFrom(p); } else { toF.set(p); setTo(p); }
      if (S.from && S.to) runSearch(); else sDrawPoints();
    });
    $("s-go").onclick = function () { runSearch(); };
    ["s-seats", "s-slot", "s-car", "s-time"].forEach(function (id) {
      $(id).addEventListener("change", function () {
        if (id === "s-seats" || id === "s-time") { if (S.res.length) runSearch(); else sRead(); return; }
        sRead(); if (S.res.length) { renderResults(); sDrawRoutes(false); renderBreak(); }
      });
    });
    sDrawPoints(); renderBreak();

    // Publicar
    PB.stops = ["puig", "mass", "albo", "upv"].map(placePt);
    PB.pax = [{ name: "Marta", up: 0, down: 2 }, { name: "Ana", up: 1, down: 3 }, { name: "Jorge", up: 2, down: 3 }];
    renderStops(); renderPax();
    pMap.on("click", function (e) {
      var p = mapPoint(e.latlng);
      if (!inBBox(p)) { $("p-status").textContent = t("st_outside"); return; }
      pbStart();
      PB.stops[+$("p-click").value] = p;
      renderStops(); renderPax(); pbRecalc();
    });
    pbRecalc();

    // Tarifario
    renderParams(); renderTarifario();

    show();
    track("view", {});
  }).catch(function (err) { console.error(err); });

  window.FF_DEBUG = { F: F, P: function () { return P; }, S: S, PB: PB, C: C, zoneOf: zoneOf, slotOfTime: slotOfTime, sMap: function () { return sMap; }, pMap: function () { return pMap; } };
})();
