/* Flenflena v6 · comparación de ahorro para pasajeros. Solo modos sin coche propio: taxi, VTC, EMT, metro.
   Nunca se compara con ir en coche propio. Sin CO2. Tiempos de transporte público: solo si los escribe la persona. */
(function (root) {
  function r2(x) { return Math.round((x + 1e-9) * 100) / 100; }
  /* src: FF_CONFIG.SAVINGS ; km: distancia por carretera ; flen: precio Flenflena ;
     opt: { vtc: € o null, roadMin: min por carretera (estimados) o null, flenMin, emtMin, metroMin: min o null } */
  function compare(km, flen, src, opt) {
    opt = opt || {};
    var T = src.taxi;
    var taxi = Math.max(T.minDay, T.flag + T.perKm * km);
    function row(id, cost, mins, note) {
      var ok = cost != null && isFinite(cost);
      return { id: id, cost: ok ? r2(cost) : null, saving: ok ? r2(cost - flen) : null,
               timeDiff: (mins != null && opt.flenMin != null) ? Math.round(opt.flenMin - mins) : null, note: note || null };
    }
    var vtc = (opt.vtc != null && isFinite(opt.vtc) && opt.vtc > 0) ? opt.vtc : null;
    return [
      row("taxi", taxi, opt.roadMin, null),
      row("vtc", vtc, vtc != null ? opt.roadMin : null, vtc == null ? "unavailable" : "user_estimate"),
      row("emt", src.emt.single, opt.emtMin, null),
      row("metro", src.metro.single, opt.metroMin, null)
    ];
  }
  root.FFSavings = { compare: compare };
})(typeof window !== "undefined" ? window : module.exports);
