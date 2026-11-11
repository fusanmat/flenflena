/* Métricas anónimas de Flenflena (mismas claves y destino que v2; v4 añade eventos y envía variant = "v4-A"/"v4-B").
   - SHEET_ENDPOINT vacío: track() solo escribe en la consola; no se envía ni se guarda nada.
   - SHEET_ENDPOINT relleno: cada evento se envía con fetch (no-cors, text/plain) a un Apps Script
     que añade una fila a una hoja de cálculo. Al salir se usa navigator.sendBeacon.
   Solo se envían las claves de la lista blanca: zonas y franjas, nunca direcciones, coordenadas,
   nombres ni correos. El identificador de sesión vive solo en sessionStorage (esta pestaña) y
   solo se crea si SHEET_ENDPOINT está relleno. El enganche de Umami se mantiene sin uso. */
(function () {
  var cfg = window.FF_CONFIG;
  var SHEET = cfg.SHEET_ENDPOINT || "";
  var UMAMI = !SHEET && !!cfg.UMAMI_WEBSITE_ID;
  var KEYS = ["session", "event", "variant", "src", "zone_from", "zone_to", "slot", "vehicle",
              "passengers", "option_rank", "price", "seconds_on_page", "survey"];
  var ID_RE = /^[a-z0-9_.+\-]{0,40}$/i;
  var t0 = Date.now();

  function secs() { return Math.round((Date.now() - t0) / 1000); }

  var session = null;
  if (SHEET && cfg.USE_SESSION_ID) {
    try {
      session = sessionStorage.getItem("ff_session");
      if (!session) {
        var a = new Uint8Array(8); crypto.getRandomValues(a);
        session = Array.prototype.map.call(a, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
        sessionStorage.setItem("ff_session", session);
      }
    } catch (e) { session = null; }
  }

  // Solo claves de la lista blanca; números finitos o textos cortos tipo id.
  function payload(name, props) {
    var ctx = window.FF_CTX || {};
    var src = Object.assign({ variant: ctx.variant, src: ctx.src }, props || {}, { event: name });
    if (session) src.session = session;
    // Valores acotados: variante y origen solo de listas cerradas (nunca texto libre de la URL)
    if (!cfg.VARIANTS || !cfg.VARIANTS[src.variant]) src.variant = cfg.DEFAULT_VARIANT;
    if ((cfg.SRC_ALLOWED || []).indexOf(src.src) < 0) src.src = "other";
    // v4: la versión viaja en la variante ("v4-A" / "v4-B"); la validación A/B se hace antes del prefijo
    if (cfg.VARIANT_PREFIX) src.variant = cfg.VARIANT_PREFIX + src.variant;
    var out = {};
    KEYS.forEach(function (k) {
      var v = src[k];
      if (v == null) return;
      if (typeof v === "number" && isFinite(v)) out[k] = Math.round(v * 100) / 100;
      else if (typeof v === "string") {
        if (k === "survey") { if (/^[a-z0-9_.=;:\-]{0,160}$/i.test(v)) out[k] = v; }
        else if (ID_RE.test(v)) out[k] = v;
      }
    });
    return out;
  }

  function post(body) {
    try {
      fetch(SHEET, { method: "POST", mode: "no-cors", keepalive: true,
        headers: { "Content-Type": "text/plain;charset=utf-8" }, body: body }).catch(function () {});
    } catch (e) {}
  }
  function beacon(body) {
    var ok = false;
    try { ok = navigator.sendBeacon && navigator.sendBeacon(SHEET, new Blob([body], { type: "text/plain;charset=utf-8" })); } catch (e) {}
    if (!ok) post(body);
  }

  // Enganche Umami (sin uso mientras SHEET_ENDPOINT esté relleno o UMAMI_WEBSITE_ID vacío)
  var uq = [];
  if (UMAMI) {
    var s = document.createElement("script");
    s.defer = true; s.src = cfg.UMAMI_SCRIPT_URL;
    s.setAttribute("data-website-id", cfg.UMAMI_WEBSITE_ID);
    s.setAttribute("data-auto-track", "false");
    s.setAttribute("data-do-not-track", "true");
    s.onload = function () { uq.splice(0).forEach(function (q) { umami(q[0], q[1]); }); };
    document.head.appendChild(s);
  }
  function umami(name, p) {
    if (window.umami && window.umami.track) { if (name === "view") window.umami.track(); window.umami.track(name, p); }
    else uq.push([name, p]);
  }

  function send(name, props, useBeacon) {
    var p = payload(name, props);
    if (SHEET) { var body = JSON.stringify(p); useBeacon ? beacon(body) : post(body); return; }
    if (UMAMI) { delete p.event; umami(name, p); return; }
    console.log("[track:stub] " + name + " " + JSON.stringify(p));
  }
  window.track = function (name, props) { send(name, props, false); };

  // Latido cada 15 s con la pestaña visible, hasta 5 minutos de página
  var hb = setInterval(function () {
    if (secs() > (cfg.HEARTBEAT_MAX_S || 300)) { clearInterval(hb); return; }
    if (document.visibilityState === "visible") send("heartbeat", { seconds_on_page: secs() }, false);
  }, (cfg.HEARTBEAT_S || 15) * 1000);

  // Salida: una sola vez, con sendBeacon
  var left = false;
  function leave() {
    if (left) return; left = true; clearInterval(hb);
    send("leave", { seconds_on_page: secs() }, true);
  }
  addEventListener("pagehide", leave);
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") leave(); });
})();
