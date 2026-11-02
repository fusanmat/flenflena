/* Analítica anónima. track(evento, props) solo escribe en la consola mientras
   FF_CONFIG.UMAMI_WEBSITE_ID esté vacío. Nunca se pasan nombres, correos,
   coordenadas ni direcciones: solo zonas, franjas y opciones de menú. */
(function () {
  var cfg = window.FF_CONFIG;
  var ALLOWED = /^[a-z0-9_.+\-]{0,40}$/i; // valores cortos tipo id/zona/franja
  var enabled = !!cfg.UMAMI_WEBSITE_ID;
  var queue = [];

  if (enabled) {
    var s = document.createElement("script");
    s.defer = true;
    s.src = cfg.UMAMI_SCRIPT_URL;
    s.setAttribute("data-website-id", cfg.UMAMI_WEBSITE_ID);
    s.setAttribute("data-auto-track", "false");
    s.setAttribute("data-do-not-track", "true");
    s.onload = function () { queue.splice(0).forEach(function (q) { send(q[0], q[1]); }); };
    document.head.appendChild(s);
  }

  function clean(props) {
    var out = {};
    Object.keys(props || {}).forEach(function (k) {
      var v = props[k];
      if (typeof v === "number" && isFinite(v)) out[k] = v;
      else if (typeof v === "boolean") out[k] = v;
      else if (typeof v === "string" && ALLOWED.test(v)) out[k] = v;
      // cualquier otra cosa (texto libre, objetos) se descarta
    });
    return out;
  }

  function send(name, props) {
    if (window.umami && typeof window.umami.track === "function") {
      if (name === "view") window.umami.track(); // visita (sin cookies)
      window.umami.track(name, props);
    } else queue.push([name, props]);
  }

  window.track = function (name, props) {
    var p = clean(Object.assign({}, window.FF_CTX || {}, props || {}));
    if (!enabled) { console.log("[track:stub] " + name + " " + JSON.stringify(p)); return; }
    send(name, p);
  };

  // Tiempo en la página, por tramos, una sola vez al salir
  var t0 = Date.now(), sent = false;
  function leave() {
    if (sent) return; sent = true;
    var s = Math.round((Date.now() - t0) / 1000);
    var b = s < 10 ? "lt10s" : s < 30 ? "10_30s" : s < 60 ? "30_60s" : s < 180 ? "1_3min" : s < 600 ? "3_10min" : "gt10min";
    window.track("leave", { time_bucket: b });
  }
  addEventListener("pagehide", leave);
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") leave(); });
})();
