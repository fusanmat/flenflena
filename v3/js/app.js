/* Flenflena · lógica de la web (sin compilación). Base: v2 (mapa, direcciones, rutas, tarjetas). */
(function () {
  "use strict";
  var CFG = window.FF_CONFIG, I18N = window.FF_I18N, F = window.FFFare, SV = window.FFSavings;
  var $ = function (id) { return document.getElementById(id); };
  var qsa = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var CARS = ["petrol", "diesel", "hybrid", "ev"];
  var UNI = { upv: "UPV", uv: "UV", ceu: "CEU-UCH" };
  var UNI_COLOR = { upv: "#1E5EEB", uv: "#16A866", ceu: "#F26B1D" };

  /* ---------- Contexto (variante, origen, idioma) ---------- */
  var qs = new URLSearchParams(location.search);
  /* Variante A/B: ?v=A|B manda y se guarda; si no, se reutiliza sessionStorage; si es la 1ª visita, 50/50. */
  var vParam = (qs.get("v") || "").toUpperCase();
  var vKey = null;
  if (CFG.VARIANTS[vParam]) {
    vKey = vParam;
    try { sessionStorage.setItem("ff_variant", vKey); } catch (e) {}
  } else {
    try {
      var stored = sessionStorage.getItem("ff_variant");
      if (stored && CFG.VARIANTS[stored]) vKey = stored;
    } catch (e) {}
    if (!vKey) {
      vKey = Math.random() < 0.5 ? "A" : "B";
      if (!CFG.VARIANTS[vKey]) vKey = CFG.DEFAULT_VARIANT;
      try { sessionStorage.setItem("ff_variant", vKey); } catch (e) {}
    }
  }
  var variant = CFG.VARIANTS[vKey];
  var srcRaw = (qs.get("src") || "").toLowerCase();
  var src = !srcRaw ? "direct" : (CFG.SRC_ALLOWED.indexOf(srcRaw) >= 0 ? srcRaw : "other");
  var lang = (qs.get("lang") || "").toLowerCase() === "en" ? "en" : "es";
  window.FF_CTX = { variant: vKey, src: src, lang: lang };

  var DEF = JSON.parse(JSON.stringify(CFG.FARE));
  var P = JSON.parse(JSON.stringify(CFG.FARE));

  /* ---------- Formatos e i18n ---------- */
  function loc() { return lang === "en" ? "en-GB" : "es-ES"; }
  function nf(x, d) { return new Intl.NumberFormat(loc(), { minimumFractionDigits: d, maximumFractionDigits: d }).format(x); }
  function eur(x) { return new Intl.NumberFormat(loc(), { style: "currency", currency: "EUR" }).format(x); }
  function pct(x) { return nf(x * 100, Math.round(x * 100) === x * 100 ? 0 : 1) + (lang === "en" ? "%" : " %"); }
  function km1(x) { return nf(x, 1); }
  function meters(k) { return k < 1 ? Math.round(k * 1000 / 10) * 10 + " m" : km1(k) + " km"; }
  function globals() { return { comm: pct(P.fee), min: eur(P.minFare), tol: CFG.ARRIVAL_TOLERANCE_MIN, contact: CFG.CONTACT, deletion: CFG.DELETION_DATE }; }
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
  function fillCarSel(sel) {
    var v = sel.value, h = "";
    if (sel.dataset.each) h += '<option value="each">' + esc(t("car_each")) + "</option>";
    CARS.forEach(function (c) { h += '<option value="' + c + '">' + esc(t("car_" + c)) + "</option>"; });
    sel.innerHTML = h; if (v) sel.value = v;
    if (!sel.value) sel.selectedIndex = 0;
  }
  // Fechas: siempre en hora local del navegador
  function ymd(d) { return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function today() { return ymd(new Date()); }
  function nowMin() { var d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
  function parseYmd(s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ""); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
  function fmtDate(s) { var d = parseYmd(s); return d ? new Intl.DateTimeFormat(loc(), { weekday: "short", day: "numeric", month: "short" }).format(d) : ""; }
  // Valida fecha (hoy o futuro) y hora (no pasada si es hoy). Devuelve clave de error o "".
  function dateTimeErr(dateStr, timeStr) {
    var td = today();
    if (!parseYmd(dateStr) || dateStr < td) return "err_past_date";
    if (dateStr === td && toMin(timeStr) <= nowMin()) return "err_past_time";
    return "";
  }
  function weekdaysBetween(a, b) {
    var out = [], d = parseYmd(a), e = parseYmd(b); if (!d || !e) return out;
    for (var k = 0; d <= e && k < 400; k++) { var w = d.getDay(); if (w >= 1 && w <= 5) out.push(ymd(d)); d.setDate(d.getDate() + 1); }
    return out;
  }
  function zoneName(id) {
    if (!id || id === "unknown" || id === "outside_area") return "—";
    return id.replace(/^(vlc|campus|mun)_/, "").split("_").map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(" ");
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
    var km = legs.reduce(function (a, b) { return a + b; }, 0);
    return { legs: legs, line: ll, wp: ll, mode: "fallback", min: km / CFG.SPEED_KM_MIN };
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
          mode: "osrm", min: r.duration / 60
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
  var MI = window.FFMapInput;
  var coarse = MI.touchOnly(window.matchMedia ? function (q) { return window.matchMedia(q); } : null);
  MI.installWheelGuard(window);
  function makeMap(id) {
    var m = L.map(id, { scrollWheelZoom: true, zoomControl: true }).setView([39.48, -0.38], 11);
    L.tileLayer(CFG.TILE_URL, { attribution: CFG.TILE_ATTRIBUTION, maxZoom: 19 }).addTo(m);
    var el = m.getContainer();
    // La rueda del ratón solo hace zoom en el mapa: nunca desplaza la página.
    m.scrollWheelZoom.enable();
    L.DomEvent.disableScrollPropagation(el);
    el.addEventListener("wheel", function (e) { e.preventDefault(); }, { passive: false });
    el.dataset.coop = coarse ? "1" : "0";
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
     ESTADO GENERAL (solo en memoria; nada en el navegador)
     ====================================================================== */
  // Acceso de miembros: SOLO el servidor decide (js/auth.js). Sin proveedor configurado, siempre bloqueado.
  var ACCESS = window.FFAuth.createDemoAccess();   // maqueta: desbloqueo de perfiles FICTICIOS solo en memoria
  function unlocked() { return ACCESS.canSeeMembers(); }
  var QUOTE = null;     // presupuesto fijado al pulsar «Reservar por X €»
  var SLF = CFG.STRAIGHT_LINE_FACTOR;

  /* ======================================================================
     BUSCAR VIAJE
     ====================================================================== */
  var S = { from: null, to: null, res: [], sel: -1, seq: 0, started: false, genN: 0, time: "08:00", seats: 1,
            mode: "arrive", date: "", women: false, repeat: false, rfrom: "", rto: "", skip: {} };
  var sMap, sLayer, pMap, pLayer, fromF, toF, hFromF, hToF, H = { from: null, to: null };

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
        var detour = (len - baseLen) * SLF;
        if (detour > detourLimit(baseLen * SLF)) return;
        var walk = a.walk + b.walk, pen;
        var pk = toMin(tr.time) + kmTo[up] * SLF / CFG.SPEED_KM_MIN;
        var arr = toMin(tr.time) + kmTo[down] * SLF / CFG.SPEED_KM_MIN;
        // Prefiltro (estimación en línea recta). El filtro definitivo usa la ruta real en runSearch.
        if (S.mode === "depart") { var d1 = pk - tDes; if (d1 < 0 || d1 > 45) return; pen = d1; }
        else { var d2 = arr - tDes; if (d2 > 0 || d2 < -75) return; pen = -d2 * 0.3; }
        var score = detour + walk * 2 + pen / 8;
        if (!best || score < best.score) best = { trip: tr, route: items.map(function (it) { return it.p; }), up: up, down: down, pax: pax, walkUp: a.walk, walkDown: b.walk, puAt: a.ins ? null : a.at, doAt: b.ins ? null : b.at, score: score };
      });
    });
    return best;
  }

  // Si hay pocos trayectos que encajen, se completan con perfiles ficticios de la lista "extra"
  function genTrips(need, exclude) {
    var from = S.from, to = S.to, dFT = hav(from, to), out = [];
    var pool = EXTRA.filter(function (x) { return !S.women || x.f; });
    if (!pool.length) return out;
    var camp = DATA.places.filter(function (p) { return p.g === "campus"; }).sort(function (a, b) { return hav(a, to) - hav(b, to); })[0];
    var dest = camp && hav(camp, to) <= 1.5 ? placePt(camp.id) : { lat: to.lat, lng: to.lng, label: to.label };
    var cands = DATA.places.filter(function (p) {
      var dF = hav(p, from);
      return p.g !== "campus" && exclude.indexOf(p.id) < 0 && dF >= 1.5 && dF <= 12 && hav(p, dest) > 1;
    }).map(function (p) {
      var base = hav(p, dest), via = hav(p, from) + dFT + hav(to, dest);
      return { p: p, det: (via - base) * SLF, base: base * SLF };
    }).filter(function (c) { return c.det <= detourLimit(c.base) * 0.8; })
      .sort(function (a, b) { return a.det - b.det; });
    for (var k = 0; k < need && k < cands.length; k++) {
      // Determinista: mismo origen/destino/hora ⇒ mismos perfiles ficticios (sin contador global)
      var st = placePt(cands[k].p.id), x = pool[hashStr(cands[k].p.id + "|" + zoneOf(dest) + "|" + k) % pool.length];
      var toPick = hav(st, from) * SLF / CFG.SPEED_KM_MIN, len = (hav(st, from) + dFT + hav(to, dest)) * SLF;
      var dep = S.mode === "depart" ? toMin(S.time) - toPick + 3 + 6 * k : toMin(S.time) - len / CFG.SPEED_KM_MIN - 4 - 6 * k;
      out.push({ id: "g_" + cands[k].p.id + "_" + k, name: x.name, f: x.f, uni: x.uni, model: x.model, type: x.type, time: hm(dep), cap: 3, route: [st, dest], pax: k % 2 ? [] : [{ name: "—", up: 0, down: 1 }], gen: true, genK: k });
    }
    return out;
  }

  function sRead() {
    S.time = $("s-time").value || "08:00";
    S.seats = +$("s-seats").value || 1;
    S.mode = $("s-mode").value === "depart" ? "depart" : "arrive";
    S.date = $("s-date").value;
    S.repeat = $("s-repeat").checked;
    S.rfrom = $("s-rfrom").value; S.rto = $("s-rto").value;
    $("s-modenote").textContent = t(S.mode === "depart" ? "note_depart" : "note_arrive");
  }
  function searchErr() {
    var e = dateTimeErr(S.repeat ? S.rfrom : S.date, S.time);
    if (e) return e;
    if (S.repeat && (!parseYmd(S.rto) || S.rto <= S.rfrom)) return "err_range";
    return "";
  }

  function runSearch(opts) {
    opts = opts || {};
    sRead();
    if (!S.from || !S.to) { sStatus(t("st_need_both"), true); return; }
    if (hav(S.from, S.to) < 0.3) { sStatus(t("st_same"), true); return; }
    var err = searchErr();
    if (err) { sStatus(t(err), true); if (opts.done) opts.done(null); return; }
    if (!opts.auto) demoStart();
    var seq = ++S.seq;
    sStatus(t("st_routing"));
    $("s-go").disabled = true;
    TRIPS = TRIPS.filter(function (x) { return !x.gen; });
    var ms = TRIPS.filter(function (tr) { return !S.women || tr.f; }).map(function (tr) { return matchTrip(tr, S.from, S.to, S.seats); }).filter(Boolean)
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
      list.forEach(function (m) {
        m.detour = Math.max(0, sum(m.r.legs) - sum(m.base.legs));
        // Perfiles ficticios generados: su horario se fija con la ruta real, de forma coherente con la petición
        // (recogida 3–21 min después / llegada 4–22 min antes). Los trayectos existentes NO se mueven.
        if (m.trip.gen) {
          var off = timeOffsets(m), k = m.trip.genK || 0, tD = toMin(S.time);
          m.trip.time = hm(S.mode === "depart" ? tD + 3 + 6 * k - off.pick : tD - 4 - 6 * k - off.arr);
        }
        priceRes(m);
      });
      list = list.filter(fitsTime);   // promesa estricta: recogida ≥ hora pedida / llegada ≤ hora pedida
      list.sort(function (a, b) { return a.score - b.score; });
      list = list.slice(0, 4);
      list.forEach(function (m, i) { m.rank = i + 1; });
      S.res = list;
      S.routing = list.every(function (m) { return m.r.mode === "osrm"; }) ? "osrm" : "fallback";
      var none = S.women ? t("st_none_women") : t("st_none");
      sStatus(!list.length ? none : (S.routing === "fallback" ? t("st_fallback") : ""), S.routing === "fallback" || !list.length);
      S.sel = list.length ? 0 : -1;
      renderResults(); sDrawRoutes(true); renderBreak(); renderPreview();
      if (opts.done) opts.done(list);
      if (!opts.auto && list.length) {
        var m0 = list[0], z = { zone_from: zoneOf(S.from), zone_to: zoneOf(S.to), slot: slotOfTime(S.time), passengers: S.seats };
        track("route_shown", Object.assign({ option_rank: list.length }, z));
        track("fare_shown", Object.assign({ vehicle: m0.car, option_rank: 1, price: m0.me.price }, z));
      }
    });
  }

  // Minutos desde la salida del conductor hasta tu recogida y tu llegada (ruta real o plan B)
  function timeOffsets(m) {
    var tot = sum(m.r.legs) || 1, mpk = (m.r.min || tot / CFG.SPEED_KM_MIN) / tot;
    return { pick: sum(m.r.legs.slice(0, m.up)) * mpk, arr: sum(m.r.legs.slice(0, m.down)) * mpk };
  }
  function fitsTime(m) {
    var tD = toMin(S.time);
    return S.mode === "depart" ? m.pickMin >= tD : m.arrMin <= tD;
  }
  function priceRes(m) {
    m.car = m.trip.type;
    var pax = m.pax.map(function (p) { return { name: p.name, up: p.up, down: p.down, seats: 1 }; });
    pax.push({ name: t("b_you"), up: m.up, down: m.down, seats: S.seats, me: true });
    m.allPax = pax;
    m.calc = F.calcTrip(m.r.legs, pax, P, m.car);
    m.me = m.calc.pax[m.calc.pax.length - 1];
    var dep = toMin(m.trip.time), off = timeOffsets(m);
    m.pickMin = Math.round(dep + off.pick); m.arrMin = Math.round(dep + off.arr);  // mismos minutos que se muestran
    m.tPick = hm(m.pickMin); m.tArr = hm(m.arrMin);
    var maxOn = 0;
    for (var L1 = m.up; L1 < m.down; L1++) { var on = 0; m.pax.forEach(function (p) { if (p.up <= L1 && p.down > L1) on++; }); maxOn = Math.max(maxOn, on); }
    m.free = m.trip.cap - maxOn - S.seats;   // plazas que quedan libres además de las tuyas
    m.conf = m.trip.pax.length;              // pasajeros ya confirmados en el trayecto
  }

  function seatsTxt(n) { return n === 1 ? t("c_seat1") : t("c_seatn", { n: n }); }
  function whoHTML(tr) {
    if (unlocked() || tr.published) return "<b>" + esc(tr.name) + "</b>" + '<span class="small muted">' + (UNI[tr.uni] ? esc(UNI[tr.uni]) : "") + (tr.model ? " · " + esc(tr.model) : "") + "</span>";
    return '<b class="blur" aria-hidden="true">Xxxxxx</b><span class="small muted"><span class="blur" aria-hidden="true">XXX · Xxxxx Xxxxx</span> <a href="#join" class="lock">🔒 ' + esc(t("locked")) + "</a></span>";
  }
  function avatarHTML(tr) {
    var c = unlocked() || tr.published ? (UNI_COLOR[tr.uni] || "#0F1B3D") : "#C9D2E3";
    return '<div class="avatar" style="background:' + c + '">' + esc(unlocked() || tr.published ? tr.name.charAt(0) : "·") + "</div>";
  }

  function cardHTML(m, i, compact) {
    var tr = m.trip;
    var meet = m.puAt != null ? tr.route[m.puAt].label : t("c_meet_near");
    var walk = m.puAt != null && m.walkUp > 0.02 ? t("c_walk", { m: meters(m.walkUp) }) : t("c_walk0");
    return '<article class="card trip' + (i === S.sel && !compact ? " sel" : "") + '" data-i="' + i + '" tabindex="0" aria-label="' + esc(t("rank", { n: m.rank })) + '">' +
      '<div class="top1">' + avatarHTML(tr) +
      '<div class="who"><span class="tiny muted">' + esc(t("rank", { n: m.rank })) + "</span>" + whoHTML(tr) +
      '<span class="small">' + esc(t("car_" + tr.type)) + "</span></div>" +
      '<div class="pricebox"><div class="price">' + eur(m.me.price) + '</div><div class="tiny muted">' + esc(t("c_price_sub", { seats: seatsTxt(S.seats) })) + "</div></div></div>" +
      '<div class="mid"><span><b>' + esc(t("c_pickup", { label: shortLabel(meet) })) + "</b> · " + esc(walk) + "</span>" +
      "<span>" + esc(t("c_zone", { z: zoneName(zoneOf(m.route[m.up])) })) + "</span>" +
      "<span>" + esc(t("c_depart", { p: m.tPick, a: m.tArr })) + "</span>" +
      "<span>" + esc(t("c_conf", { n: m.conf })) + "</span>" +
      "<span>" + esc(t("c_seats", { n: Math.max(0, m.free) })) + "</span>" +
      (compact ? "" : "<span>" + esc(m.detour > 0.05 ? t("c_detour", { km: km1(m.detour) }) : t("c_detour0")) + "</span>") +
      (tr.published ? '<span class="chip">' + esc(t("pub_note")) + "</span>" : "") +
      '<button type="button" class="chip g cancelchip" data-act="cancel">' + esc(t("c_cancel")) + " ›</button></div>" +
      (compact ? "" : '<div class="acts"><button class="btn ghost sm" type="button" data-act="break">' + esc(t("btn_break")) + "</button>" +
      '<button class="btn sm" type="button" data-act="reserve">' + esc(t("btn_reserve", { x: eur(m.me.price) })) + "</button></div>") + "</article>";
  }

  function renderResults() {
    var box = $("results");
    if (!S.res.length) { box.innerHTML = '<div class="card pad empty">' + esc(S.women ? t("st_none_women") : t("st_none")) + "</div>"; $("s-summary").textContent = ""; return; }
    $("s-summary").textContent = t("summary", { n: S.res.length });
    box.innerHTML = S.res.map(function (m, i) { priceRes(m); return cardHTML(m, i, false); }).join("");
  }
  function hashStr(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
  /* ---------- Mapa de la portada: trayecto elegido en la calculadora + trayectos ficticios de demostración ---------- */
  var hMap = null, hLayer = null, hSeq = 0;
  function hDraw() {
    if (!hMap || !H.from || !H.to || hav(H.from, H.to) < 0.3) return;
    var seq = ++hSeq, from = H.from, to = H.to;
    route([from, to]).then(function (r) {
      if (seq !== hSeq) return;
      hLayer.clearLayers();
      var all = r.line.slice();
      // Trayectos de demostración: los mismos conductores ficticios de la vista previa, solo si la búsqueda es de este trayecto
      var same = S.from && S.to && hav(S.from, from) < 0.05 && hav(S.to, to) < 0.05;
      (same ? S.res.slice(0, 3) : []).forEach(function (m, i) {
        if (!m.r || !m.r.line) return;
        L.polyline(m.r.line, { color: "#0F1B3D", weight: 5, opacity: 0.28, className: "hm-demo", bubblingMouseEvents: false })
          .bindTooltip(esc(t("hm_demo_n", { n: i + 1 }))).addTo(hLayer);
        all = all.concat(m.r.line);
      });
      L.polyline(r.line, { color: "#F26B1D", weight: 6, opacity: 0.95, className: "hm-sel" }).bindTooltip(esc(t("hm_sel"))).addTo(hLayer);
      pinAt("#F26B1D", "A", from, from.label).addTo(hLayer);
      pinAt("#0F1B3D", "B", to, to.label).addTo(hLayer);
      $("h-map-note").textContent = r.mode === "osrm" ? "" : t("hm_fallback");
      fitTo(hMap, all);
    });
  }
  function renderPreview() {
    hDraw();
    var box = $("h-preview"); if (!box) return;
    box.innerHTML = S.res.slice(0, 3).map(function (m, i) { priceRes(m); return cardHTML(m, i, true); }).join("");
  }

  function selectRes(i) {
    if (i < 0 || i >= S.res.length) return;
    var changed = i !== S.sel;
    S.sel = i;
    qsa("#results .trip").forEach(function (el) { el.classList.toggle("sel", +el.dataset.i === i); });
    if (changed) { sDrawRoutes(false); renderBreak(); }
    var m = S.res[i];
    track("driver_select", { option_rank: m.rank, vehicle: m.car, slot: slotOfTime(S.time), passengers: S.seats, price: m.me.price });
  }

  $("results").addEventListener("click", function (e) {
    if (e.target.closest("a.lock")) return;
    var card = e.target.closest(".trip"); if (!card) return;
    var i = +card.dataset.i, b = e.target.closest("button");
    if (b && b.dataset.act === "cancel") { cancelInfo(); return; }
    if (b && b.dataset.act === "reserve") { if (i !== S.sel) selectRes(i); door(i); return; }
    selectRes(i);
    if (b && b.dataset.act === "break") $("s-break").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  $("results").addEventListener("keydown", function (e) {
    var card = e.target.closest(".trip");
    if (card && e.target === card && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); selectRes(+card.dataset.i); }
  });
  $("h-preview").addEventListener("click", function (e) {
    if (e.target.closest("a.lock")) return;
    var cb = e.target.closest('[data-act="cancel"]'); if (cb) { cancelInfo(); return; }
    var card = e.target.closest(".trip"); if (!card) return;
    location.hash = "#buscar"; setTimeout(function () { selectRes(+card.dataset.i); }, 60);
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
    var order = S.res.map(function (m, i) { return i; }).filter(function (i) { return i !== S.sel; });
    if (S.sel >= 0) order.push(S.sel);
    order.forEach(function (i) {
      var m = S.res[i], on = i === S.sel;
      var pl = L.polyline(m.r.line, on ? { color: "#0F1B3D", weight: 6, opacity: 0.9, bubblingMouseEvents: false, className: "rt-sel" }
                                       : { color: "#8A94A6", weight: 5, opacity: 0.4, bubblingMouseEvents: false, className: "rt-faded" });
      pl.on("click", function (e) { L.DomEvent.stop(e); selectRes(i); });
      pl.bindTooltip(esc(t("rank", { n: m.rank }) + " · " + eur(m.me.price)), { sticky: true });
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

  /* ---------- «Cómo calculamos el precio» (único sitio donde se explica la tarifa de servicio) ---------- */
  function kpi(v, l, cls) { return '<div class="kpi ' + (cls || "") + '"><div class="v">' + v + '</div><div class="l">' + esc(l) + "</div></div>"; }
  function renderBreak() {
    var box = $("s-break"), m = S.res[S.sel];
    if (!m) { box.innerHTML = "<h3>" + esc(t("b_title")) + '</h3><p class="small muted">' + esc(t("b_none")) + "</p>"; return; }
    var c = m.calc, me = m.me;
    var h = "<h3>" + esc(t("b_title")) + "</h3>";
    h += '<div class="price" style="font-size:30px">' + eur(me.price) + '</div><div class="tiny muted">' + esc(t("c_price_sub", { seats: seatsTxt(S.seats) })) + "</div>";
    h += '<p class="calcline">' + esc(t("b_formula", { cpk: nf(c.cpk, 3), car: t("car_" + m.car) })) + "</p>";
    h += '<div class="scroll"><table><thead><tr><th>' + esc(t("b_leg")) + '</th><th class="r">' + esc(t("b_km")) + '</th><th class="r">' + esc(t("b_cost")) + '</th><th class="r">' + esc(t("b_people")) + '</th><th class="r">' + esc(t("b_share")) + "</th></tr></thead><tbody>";
    for (var i = m.up; i < m.down; i++) {
      var lg = c.legs[i];
      h += "<tr><td>" + esc(t("leg_line", { a: shortLabel(m.route[i].label), b: shortLabel(m.route[i + 1].label) })) + '</td><td class="r">' + km1(lg.km) + '</td><td class="r">' + eur(lg.cost) + '</td><td class="r">' + lg.occ + '</td><td class="r">' + eur(lg.share * me.seats) + "</td></tr>";
    }
    h += '<tr><td colspan="4">' + esc(t("b_sum")) + (me.seats > 1 ? " (" + esc(seatsTxt(me.seats)) + ")" : "") + '</td><td class="r">' + eur(me.recovery) + "</td></tr>";
    h += '<tr><td colspan="4">' + esc(t("b_fee", { pct: pct(P.fee) })) + '</td><td class="r">' + eur(me.fee) + "</td></tr>";
    if (me.minAdj > 0.004) h += '<tr class="adj"><td colspan="4">' + esc(t("b_adj")) + '</td><td class="r">' + eur(me.minAdj) + "</td></tr>";
    h += '<tr class="tot"><td colspan="4">' + esc(t("b_total")) + '</td><td class="r">' + eur(me.price) + "</td></tr></tbody></table></div>";
    h += '<p class="small" style="margin:8px 0 0">' + esc(t("b_fixed")) + "</p>";
    h += '<p class="tiny muted" style="margin:6px 0 0">' + esc(t("b_assump")) + "</p>";
    h += '<p class="small policy">⚠ ' + esc(t("b_policy")) + "</p>";
    if (me.minAdj > 0.004) h += '<p class="tiny muted">' + esc(t("b_minowner")) + "</p>";
    box.innerHTML = h;
  }

  // Puerta falsa: «Reservar por X €» → precio fijado → pantalla de revelación
  function door(i) {
    var m = S.res[i];
    QUOTE = F.freezeQuote(m.me, { rank: m.rank, car: m.car, time: S.time, mode: S.mode });
    track("reserve_click", { zone_from: zoneOf(S.from), zone_to: zoneOf(S.to), slot: slotOfTime(S.time), vehicle: m.car, passengers: S.seats, option_rank: m.rank, price: QUOTE.price });
    var top = '<p class="small muted" style="margin:0 0 8px">' + esc(t("rv_price", { x: eur(QUOTE.price) })) + "</p>";
    var extra = '<p class="small">' + esc(t("rv_cancel")) + "</p>";
    modal(reveal(top, '<button class="btn" type="button" data-act="yes">' + esc(t("rv_join")) + '</button><button class="btn ghost" type="button" data-act="no">' + esc(t("close")) + "</button>") , function (b) {
      b.querySelector(".rv-main").insertAdjacentHTML("beforeend", extra);
      b.querySelector('[data-act="yes"]').onclick = function () { track("door_yes", { option_rank: QUOTE.rank, vehicle: QUOTE.car }); closeModal(); goTo("join"); };
      b.querySelector('[data-act="no"]').onclick = function () { track("door_no", { option_rank: QUOTE.rank, vehicle: QUOTE.car }); closeModal(); };
      b.querySelector('[data-act="survey"]').onclick = function (e) { e.preventDefault(); track("door_yes", { option_rank: QUOTE.rank, vehicle: QUOTE.car }); closeModal(); goTo("encuesta"); };
    });
  }
  function goTo(id) {
    if (location.hash !== "#inicio") location.hash = "#inicio";
    setTimeout(function () { $(id).scrollIntoView({ behavior: "smooth", block: "start" }); if (id === "join") $("f-name").focus({ preventScroll: true }); }, 80);
  }

  /* ---------- Repetir de lunes a viernes ---------- */
  function renderRepeat() {
    var on = $("s-repeat").checked; $("s-repeat-box").hidden = !on;
    if (!on) return;
    if (!$("s-rfrom").value) $("s-rfrom").value = $("s-date").value || today();
    if (!$("s-rto").value) { var d = parseYmd($("s-rfrom").value); d.setDate(d.getDate() + 13); $("s-rto").value = ymd(d); }
    var days = weekdaysBetween($("s-rfrom").value, $("s-rto").value).slice(0, 60);
    $("s-days").innerHTML = days.map(function (d) {
      var off = !!S.skip[d];
      return '<button type="button" class="day' + (off ? " off" : "") + '" data-d="' + d + '" aria-pressed="' + (off ? "true" : "false") + '" title="' + esc(t("r_skip")) + '">' + esc(fmtDate(d)) + "</button>";
    }).join("");
    var n = days.filter(function (d) { return !S.skip[d]; }).length;
    $("s-rsum").textContent = days.length ? t("r_sum", { n: n, a: fmtDate(days[0]), b: fmtDate(days[days.length - 1]) }) : t("err_range");
  }
  $("s-repeat").addEventListener("change", function () { renderRepeat(); sRead(); });
  ["s-rfrom", "s-rto"].forEach(function (id) { $(id).addEventListener("change", function () { renderRepeat(); sRead(); }); });
  $("s-days").addEventListener("click", function (e) {
    var b = e.target.closest(".day"); if (!b) return;
    S.skip[b.dataset.d] = !S.skip[b.dataset.d]; renderRepeat();
  });
  $("s-women").addEventListener("click", function () {
    S.women = !S.women; $("s-women").setAttribute("aria-pressed", S.women ? "true" : "false"); $("s-women").classList.toggle("on", S.women);
    runSearch();
  });

  /* ======================================================================
     PUBLICAR TRAYECTO (vista de conductor)
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
  ["p-time", "p-cap", "p-car", "p-date"].forEach(function (id) {
    $(id).addEventListener("change", function () { pbStart(); pbRender(false); });
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
  function pbParams() { return { car: $("p-car").value || "petrol", slot: slotOfTime($("p-time").value), cap: +$("p-cap").value || 3 }; }
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
    var c = F.calcTrip(PB.r.legs, pax, P, pp.car), over = null, minFree = Infinity;
    PB.calc = c;
    legsBox.innerHTML = c.legs.map(function (lg, i) {
      var seats = '<span class="seat dr" title="' + esc(t("seat_driver")) + '"></span>';
      for (var k = 0; k < Math.max(pp.cap, lg.onboard); k++) {
        var cls = k < lg.onboard ? (k >= pp.cap ? "seat over" : "seat p") : "seat";
        seats += '<span class="' + cls + '" title="' + esc(k < lg.onboard ? t("seat_taken") : t("seat_free")) + '"></span>';
      }
      if (lg.onboard > pp.cap && !over) over = { leg: i + 1, n: lg.onboard };
      minFree = Math.min(minFree, pp.cap - lg.onboard);
      return '<div class="leg"><span>' + esc(t("leg_line", { a: stopShort(i), b: stopShort(i + 1) })) + ' · <span class="muted">' + km1(lg.km) + ' km</span></span><span class="seats">' + seats + '</span><span class="r">' + eur(lg.cost) + "</span></div>";
    }).join("");
    $("p-warn").innerHTML = over ? '<p class="status warn">' + esc(t("p_over", { leg: over.leg, n: over.n, cap: pp.cap })) + "</p>" : "";
    var h = "<h3>" + esc(t("p_br_title")) + "</h3>";
    h += '<p class="calcline">' + esc(t("b_formula", { cpk: nf(c.cpk, 3), car: t("car_" + pp.car) })) + "</p>";
    h += '<div class="kpis">' + kpi(eur(c.tot.carCost), t("p_trip_cost"), "o") + kpi(eur(c.tot.recovered), t("p_recovered"), "gg") + kpi(eur(Math.max(0, c.tot.driverOwn)), t("p_own"), "") + "</div>";
    h += '<div class="kpis" style="margin-top:8px">' + kpi(String(PB.pax.length), t("p_conf"), "b") + kpi(String(Math.max(0, minFree === Infinity ? pp.cap : minFree)), t("p_free"), "") + "</div>";
    if (PB.pax.length) {
      h += '<div class="scroll" style="margin-top:12px"><table><thead><tr><th>' + esc(t("b_pax")) + "</th><th>" + esc(t("b_legs")) + '</th><th class="r">' + esc(t("p_tbl_pays")) + '</th><th class="r">' + esc(t("p_tbl_rec")) + "</th></tr></thead><tbody>";
      c.pax.forEach(function (r, i) { var p = PB.pax[i]; h += "<tr><td>" + esc(p.name || "—") + "</td><td>" + (p.up + 1) + "→" + (p.down + 1) + '</td><td class="r">' + eur(r.price) + '</td><td class="r">' + eur(r.recovery) + "</td></tr>"; });
      h += '<tr class="tot"><td colspan="2">' + esc(t("b_totals")) + '</td><td class="r">' + eur(c.tot.paid) + '</td><td class="r">' + eur(c.tot.recovered) + "</td></tr></tbody></table></div>";
    } else h += '<p class="small muted">' + esc(t("p_err_nopax")) + "</p>";
    h += '<p class="small" style="margin:10px 0 0">' + esc(t("p_never")) + "</p>";
    brk.innerHTML = h;
  }

  $("p-publish").onclick = function () {
    pbStart();
    var errs = [], pp = pbParams();
    if (isNaN(toMin($("p-time").value))) errs.push(t("p_err_time"));
    else if (dateTimeErr($("p-date").value, $("p-time").value)) errs.push(t("p_err_date"));
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
      id: "pub" + (TRIPS.length + 1), name: t("you_driver"), uni: "", model: "", type: pp.car, f: false,
      time: hm(toMin($("p-time").value)), cap: pp.cap, route: PB.stops.slice(),
      pax: PB.pax.map(function (p) { return { name: p.name.trim(), up: p.up, down: p.down }; }), published: true
    });
    track("publish_done", { zone_from: zoneOf(PB.stops[0]), zone_to: zoneOf(PB.stops[PB.stops.length - 1]), slot: pp.slot, vehicle: pp.car, passengers: PB.pax.length });
    modal(reveal("", '<button class="btn" type="button" data-act="go">' + esc(t("p_done_go")) + '</button><button class="btn ghost" type="button" data-act="no">' + esc(t("close")) + "</button>", "p_done_h", ["p_done_p"]), function (b) {
      b.querySelector('[data-act="go"]').onclick = function () { closeModal(); location.hash = "#buscar"; };
      b.querySelector('[data-act="no"]').onclick = closeModal;
      b.querySelector('[data-act="survey"]').onclick = function (e) { e.preventDefault(); closeModal(); goTo("encuesta"); };
    });
  };

  /* ======================================================================
     INICIO: calculadora de ahorro (solo taxi, VTC, EMT y metro; nunca coche propio)
     ====================================================================== */
  function heroLead() {
    var el = $("heroLead");
    if (variant.hero === "savings") {
      var r = DATA.routes.filter(function (x) { return x.from === "puig" && x.to === "upv"; })[0], km = r ? r.km : 16.1;
      el.textContent = t("hero_lead_savings", { km: km1(km), price: eur(F.simple(km, 1, P, "petrol").pax[0].price) });
    } else el.textContent = t("hero_lead_community");
  }
  function optNum(id) { var v = parseFloat(String($(id).value).replace(",", ".")); return isFinite(v) && v >= 0 && $(id).value !== "" ? v : null; }
  var HC = null, HOPT = "taxi"; // último cálculo y opción elegida para el titular
  function calcSavings() {
    if (!H.from || !H.to) { $("h-status").textContent = t("sv_need"); $("h-status").classList.add("warn"); return; }
    if (hav(H.from, H.to) < 0.3) { $("h-status").textContent = t("st_same"); $("h-status").classList.add("warn"); return; }
    $("h-status").textContent = t("st_routing"); $("h-status").classList.remove("warn");
    route([H.from, H.to]).then(function (r) {
      HC = { km: sum(r.legs), mode: r.mode, roadMin: r.min };
      // La misma búsqueda alimenta la vista previa, «Buscar viaje» y el precio de Flenflena del titular
      S.from = H.from; S.to = H.to; fromF.set(S.from); toF.set(S.to);
      runSearch({ auto: true, done: function () { $("h-status").textContent = ""; renderSavings(); } });
    });
  }
  // Precio y tiempo de Flenflena: del conductor seleccionado en la búsqueda (mismo cálculo que las tarjetas)
  function flenBasis() {
    var m = S.res[S.sel >= 0 ? S.sel : 0], wait = optNum("h-flenwait");
    if (m) return { price: m.me.price, m: m, min: SV.flenDoorToDoor({ walkUpKm: m.puAt != null ? m.walkUp : 0, walkDownKm: m.doAt != null ? m.walkDown : 0, waitMin: wait, rideMin: m.arrMin - m.pickMin }) };
    return { price: F.simple(HC.km, 1, P, "petrol").pax[0].price, m: null, min: null };
  }
  function renderSavings() {
    if (!HC) { $("h-out").innerHTML = ""; $("h-tiles").innerHTML = ""; $("h-head").innerHTML = ""; return; }
    var fb = flenBasis();
    var rows = SV.compare(HC.km, fb.price, CFG.SAVINGS, { roadMin: HC.roadMin, flenMin: fb.min, taxiWait: optNum("h-taxiwait"), vtcWait: optNum("h-vtcwait"),
      vtcQuote: optNum("h-vtc"), vtcCoef: optNum("h-vtccoef"), emtMin: optNum("h-emtmin"), metroMin: optNum("h-metromin") });
    function timeTxt(r) { return r.timeDiff == null ? t("sv_t_na") : (Math.abs(r.timeDiff) < 3 ? t("sv_t_same") : r.timeDiff > 0 ? t("sv_t_more", { n: r.timeDiff }) : t("sv_t_less", { n: -r.timeDiff })); }
    // Titular según la opción elegida
    var hd = SV.headline(rows, HOPT), mode = t("sv_" + HOPT), sel = rows.filter(function (r) { return r.id === HOPT; })[0];
    var main = hd.kind === "nodata" ? t("hd_nodata", { mode: mode }) : t(hd.kind === "save" ? "hd_save" : "hd_more", { x: eur(hd.amount), mode: mode });
    $("h-head").className = "headline " + hd.kind;
    $("h-head").innerHTML = "<strong>" + esc(main) + "</strong><span>" + esc(timeTxt(sel)) + " · " + esc(t("hd_est")) + "</span>";
    // Baldosas: una por alternativa + Flenflena destacada
    $("h-tiles").innerHTML = rows.map(function (r) {
      var cost = r.cost == null ? "—" : eur(r.cost);
      return '<button type="button" role="radio" aria-checked="' + (r.id === HOPT) + '" class="tile' + (r.id === HOPT ? " on" : "") + '" data-opt="' + r.id + '"><span>' + esc(t("sv_" + r.id)) + "</span><strong>" + esc(cost) + "</strong><small>" +
        esc(r.minutes != null ? t("sv_min", { n: r.minutes }) : t("sv_t_na")) + "</small></button>";
    }).join("") + '<div class="tile best"><span>Flenflena</span><strong>' + eur(fb.price) + "</strong><small>" + esc(fb.min != null ? t("sv_min", { n: fb.min }) : t("sv_t_na")) + "</small></div>";
    var h = '<p class="small" style="margin:12px 0 4px">' + esc(HC.mode === "osrm" ? t("sv_route", { km: km1(HC.km), min: Math.round(HC.roadMin) }) : t("sv_route_fb", { km: km1(HC.km) })) + "</p>";
    h += '<p class="small"><b>' + esc(fb.m ? t("sv_flen_basis", { x: eur(fb.price), name: unlocked() ? fb.m.trip.name : t("rank", { n: fb.m.rank }), n: fb.m.rank, min: fb.min }) : t("sv_flen_est", { x: eur(fb.price) })) + "</b></p>";
    h += '<div class="scroll"><table><thead><tr><th>' + esc(t("sv_mode")) + '</th><th class="r">' + esc(t("sv_cost")) + '</th><th class="r">' + esc(t("sv_save")) + '</th><th class="r">' + esc(t("sv_time")) + "</th></tr></thead><tbody>";
    rows.forEach(function (r) {
      var cost = r.cost == null ? (r.id === "vtc" ? t("sv_vtc_na") : t("sv_na")) : eur(r.cost);
      if (r.id === "vtc" && r.cost != null) cost += " · " + (r.kind === "quote" ? t("sv_vtc_quote") : t("sv_vtc_ill", { c: nf(optNum("h-vtccoef") || 0, 2) }));
      var sv = r.saving == null ? "—" : (r.saving >= 0 ? t("sv_saves", { x: eur(r.saving) }) : t("sv_costs", { x: eur(-r.saving) }));
      h += "<tr><td>" + esc(t("sv_" + r.id)) + '</td><td class="r">' + esc(cost) + '</td><td class="r' + (r.saving != null && r.saving >= 0 ? " good" : "") + '">' + esc(sv) + '</td><td class="r">' + esc(timeTxt(r)) + "</td></tr>";
    });
    h += "</tbody></table></div>";
    h += '<p class="tiny muted">' + esc(t("sv_note_pass")) + "</p>";
    h += '<p class="tiny muted">' + esc(t("sv_note_time")) + "</p>";
    h += '<p class="tiny muted">' + esc(t("sv_limit")) + "</p>";
    h += '<p class="tiny muted">' + esc(t("sv_note_src")) + ' <a href="' + esc(CFG.SAVINGS.taxi.url) + '" target="_blank" rel="noopener noreferrer">' + esc(t("sv_src_taxi")) + '</a> · <a href="' + esc(CFG.SAVINGS.emt.url) + '" target="_blank" rel="noopener noreferrer">' + esc(t("sv_src_emt")) + '</a> · <a href="' + esc(CFG.SAVINGS.metro.url) + '" target="_blank" rel="noopener noreferrer">' + esc(t("sv_src_metro")) + "</a></p>";
    $("h-out").innerHTML = h;
  }
  $("h-calc").onclick = calcSavings;
  $("h-tiles").addEventListener("click", function (e) { var b = e.target.closest("[data-opt]"); if (!b) return; HOPT = b.dataset.opt; renderSavings(); });
  ["h-vtc", "h-vtccoef", "h-vtcwait", "h-taxiwait", "h-flenwait", "h-emtmin", "h-metromin"].forEach(function (id) { $(id).addEventListener("input", renderSavings); });

  /* ---------- Acceso de miembros (verificación por correo institucional; decide el servidor) ---------- */
  function applyAccess() {
    var on = unlocked();
    document.body.classList.toggle("signed", on);
    $("acct-off").hidden = on; $("acct-on").hidden = !on;
    renderResults(); renderPreview(); renderSavings();
  }
  function refreshAccess() { applyAccess(); }
  function cancelInfo() {
    modal('<h3 id="modal-h">' + esc(t("cancel_h")) + "</h3><p>" + esc(t("cancel_p")) + '</p><div class="acts"><button class="btn ghost" type="button" data-act="no">' + esc(t("close")) + "</button></div>", function (b) {
      b.querySelector('[data-act="no"]').onclick = closeModal;
    });
  }
  var EMAIL_ERR = { invalid: function () { return t("err_invalid"); }, domain_pending: function () { return t("err_domain_pending"); },
    uni_mismatch: function () { return t("err_uni_mismatch"); }, domain_not_allowed: function () { return t("err_domain_not_allowed", { list: allowListText() }); } };
  function emailErr(res) { return res.ok ? "" : (EMAIL_ERR[res.reason] || EMAIL_ERR.invalid)(); }
  function allowListText() {
    return CFG.INSTITUTIONS.filter(function (r) { return r.enabled; }).map(function (r) { return r.name + ": " + r.domains.map(function (d) { return "@" + d; }).join(", "); }).join(" · ");
  }
  // Pantalla de verificación SIMULADA. Recibe solo la institución; el correo ya se ha descartado.
  function verifyScreen(institution) {
    ACCESS.startVerification(institution);
    var inst = CFG.INSTITUTIONS.filter(function (r) { return r.id === institution; })[0] || { name: "" };
    modal('<h3 id="modal-h">' + esc(t("vf_h")) + '</h3><p>' + esc(t("vf_p", { uni: inst.name })) + "</p>" +
      '<div class="field"><label for="vf-code">' + esc(t("vf_code")) + '</label><input id="vf-code" inputmode="numeric" maxlength="6" placeholder="······" autocomplete="off" disabled></div>' +
      '<p class="policy small" id="vf-demo"><strong>' + esc(t("vf_demo_t")) + "</strong> " + esc(t("vf_demo")) + "</p>" +
      '<p><a href="#encuesta" data-act="survey">' + esc(t("rv_survey")) + "</a></p>" +
      '<div class="acts"><button class="btn" type="button" data-act="demo">' + esc(t("vf_continue")) + '</button><button class="btn ghost" type="button" data-act="no">' + esc(t("close")) + "</button></div>", function (b) {
      b.querySelector('[data-act="no"]').onclick = function () { ACCESS.cancel(); closeModal(); };
      b.querySelector('[data-act="survey"]').onclick = function (e) { e.preventDefault(); ACCESS.cancel(); closeModal(); goTo("encuesta"); };
      b.querySelector('[data-act="demo"]').onclick = function () {
        if (ACCESS.continueDemo()) { closeModal(); refreshAccess(); location.hash = "#buscar"; }
      };
    });
  }
  function loginModal() {
    modal('<h3 id="modal-h">' + esc(t("li_h")) + '</h3><p class="small muted">' + esc(t("li_p")) + "</p>" +
      '<form id="li-form" novalidate autocomplete="off"><div class="field"><label for="li-email">' + esc(t("f_email_inst")) + '</label><input type="email" id="li-email" maxlength="120"><div class="err" id="li-e1"></div></div>' +
      '<p class="tiny muted">' + esc(t("allow_line", { list: allowListText() })) + "</p>" +
      '<div class="acts"><button class="btn" type="submit">' + esc(t("send_link")) + '</button><button class="btn ghost" type="button" data-act="no">' + esc(t("close")) + "</button></div></form>", function (b) {
      b.querySelector('[data-act="no"]').onclick = closeModal;
      b.querySelector("#li-form").onsubmit = function (e) {
        e.preventDefault();
        var em = b.querySelector("#li-email"), res = window.FFAuth.checkEmail(em.value, "", CFG.INSTITUTIONS);
        b.querySelector("#li-e1").textContent = emailErr(res);
        if (!res.ok) return;
        em.value = "";
        verifyScreen(res.institution);
      };
    });
  }
  $("btn-login").onclick = loginModal;
  $("btn-signup").onclick = function () { goTo("join"); };
  $("btn-logout").onclick = function () { ACCESS.logout(); refreshAccess(); };
  qsa("#h-overlay [data-act], #s-lockbar [data-act]").forEach(function (b) {
    b.onclick = function () { if (b.dataset.act === "login") loginModal(); else goTo("join"); };
  });

  /* ---------- Registro simulado y encuesta ---------- */
  var formStarted = false;
  $("joinForm").addEventListener("input", function () { if (!formStarted) { formStarted = true; track("form_start", {}); } });
  $("joinForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var name = $("f-name").value.trim(), email = $("f-email").value.trim();
    var nOk = /^[\p{L}][\p{L} '.\-]{1,79}$/u.test(name), aOk = $("f-adult").checked;
    var eRes = window.FFAuth.checkEmail(email, $("f-uni").value, CFG.INSTITUTIONS), eOk = eRes.ok;
    $("e-name").textContent = nOk ? "" : t("err_name"); $("f-name").classList.toggle("bad", !nOk); $("f-name").setAttribute("aria-invalid", !nOk);
    $("e-email").textContent = emailErr(eRes); $("f-email").classList.toggle("bad", !eOk); $("f-email").setAttribute("aria-invalid", !eOk);
    $("e-adult").textContent = aOk ? "" : t("err_adult");
    if (!(nOk && eOk && aOk)) { (!nOk ? $("f-name") : !eOk ? $("f-email") : $("f-adult")).focus(); return; }
    // Solo se cuenta el envío; nombre, correo y el resto del formulario se descartan aquí mismo.
    name = email = null;
    track("form_submit", {});
    var inst = eRes.institution;
    $("joinForm").reset(); formStarted = false;
    verifyScreen(inst);
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
    qsa("[data-i18n]").forEach(function (e) { e.textContent = t(e.dataset.i18n); });
    qsa("[data-i18n-html]").forEach(function (e) { e.innerHTML = t(e.dataset.i18nHtml); });
  }
  function applyStatic() {
    document.documentElement.lang = lang;
    $("langBtn").textContent = t("lang_btn"); $("langBtn").setAttribute("aria-label", t("lang_label")); $("langBtn").title = t("lang_label");
    qsa("[data-i18n-ph]").forEach(function (e) { e.placeholder = t(e.dataset.i18nPh); });
    qsa("[data-i18n-aria]").forEach(function (e) { e.setAttribute("aria-label", t(e.dataset.i18nAria)); });
    qsa(".carsel").forEach(fillCarSel);
    ["h-from-q", "h-to-q", "s-from-q", "s-to-q"].forEach(function (id) { fillQuick($(id), true); });
    fillPriceSels();
    applyValues(); heroLead();
    $("s-modenote").textContent = t($("s-mode").value === "depart" ? "note_depart" : "note_arrive");
  }
  $("langBtn").onclick = function () {
    lang = lang === "es" ? "en" : "es"; window.FF_CTX.lang = lang;
    var u = new URL(location.href); if (lang === "en") u.searchParams.set("lang", "en"); else u.searchParams.delete("lang");
    history.replaceState(null, "", u.pathname + u.search + u.hash);
    applyStatic(); renderStops(); renderPax(); pbRender(false); renderRepeat(); renderSavings();
    if (S.res.length) { renderResults(); sDrawRoutes(false); renderPreview(); }
    renderBreak();
    track("lang_switch", {});
  };

  /* ---------- Pestañas ---------- */
  var VIEWS = ["inicio", "buscar", "publicar"], autoRan = false;
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

    // Fechas: mínimo hoy; por defecto mañana (así la hora nunca está en el pasado)
    var tm = new Date(); tm.setDate(tm.getDate() + 1);
    ["s-date", "p-date", "s-rfrom", "s-rto"].forEach(function (id) { $(id).min = today(); });
    $("s-date").value = ymd(tm); $("p-date").value = ymd(tm);

    applyStatic();
    var AS = CFG.SAVINGS.assumptions;
    $("h-taxiwait").value = AS.taxiWaitMin; $("h-vtcwait").value = AS.vtcWaitMin; $("h-vtccoef").value = AS.vtcCoefOnTaxi.toFixed(2); $("h-flenwait").value = AS.flenWaitMin;
    sMap = makeMap("s-map"); sLayer = L.layerGroup().addTo(sMap);
    pMap = makeMap("p-map"); pLayer = L.layerGroup().addTo(pMap);

    // Inicio: calculadora
    hMap = makeMap("h-map"); hLayer = L.layerGroup().addTo(hMap);
    hFromF = addrField($("h-from"), $("h-from-q"), function (p) { H.from = p; hDraw(); }, null);
    hToF = addrField($("h-to"), $("h-to-q"), function (p) { H.to = p; hDraw(); }, null);
    H.from = placePt("puig"); H.to = placePt("upv"); hFromF.set(H.from); hToF.set(H.to); hDraw();

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
    ["s-seats", "s-time", "s-mode", "s-date"].forEach(function (id) {
      $(id).addEventListener("change", function () { if (S.res.length) runSearch(); else sRead(); });
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

    $("allow-list").textContent = t("allow_line", { list: allowListText() });
    refreshAccess();
    show();
    if (!autoRan) { autoRan = true; runSearch({ auto: true }); } // vista previa de la portada
    track("view", {});
  }).catch(function (err) { console.error(err); });

  window.FF_DEBUG = { access: ACCESS, hSetTo: function (p) { hToF.set(p); H.to = p; hDraw(); }, hSetFrom: function (p) { hFromF.set(p); H.from = p; hDraw(); }, place: function (id) { return placePt(id); }, unlocked: unlocked, fitsTime: fitsTime, F: F, P: function () { return P; }, S: S, PB: PB, quote: function () { return QUOTE; }, zoneOf: zoneOf, slotOfTime: slotOfTime, dateTimeErr: dateTimeErr, sMap: function () { return sMap; }, run: function () { runSearch(); } };
})();
