/* Flenflena · comparación de ahorro para pasajeros. Solo modos sin coche propio: taxi, VTC, EMT, metro.
   Nunca coche propio. Sin CO2. Todos los tiempos son puerta a puerta e incluyen espera/acceso de forma coherente:
   - taxi:  espera supuesta (editable) + tiempo por carretera OSRM (sin tráfico en tiempo real)
   - VTC:   espera supuesta (editable) + tiempo por carretera OSRM
   - Flenflena: a pie hasta el punto de encuentro + espera supuesta (editable) + trayecto en el coche + a pie al final
   - EMT / metro: SOLO si la persona escribe su tiempo puerta a puerta (no tenemos horarios en tiempo real)
   VTC: precio que te hayan dado, o estimación ILUSTRATIVA = fórmula del taxi × coeficiente editable (no es tarifa real). */
(function (root) {
  function r2(x) { return Math.round((x + 1e-9) * 100) / 100; }
  function num(x) { return x != null && isFinite(x) ? +x : null; }
  function taxiCost(km, T) { return Math.max(T.minDay, T.flag + T.perKm * km); }
  /* opt: { roadMin, flenMin, taxiWait, vtcWait, vtcQuote, vtcCoef, emtMin, metroMin } */
  function compare(km, flen, src, opt) {
    opt = opt || {};
    var road = num(opt.roadMin), flenMin = num(opt.flenMin);
    var taxi = taxiCost(km, src.taxi);
    var vq = num(opt.vtcQuote), vc = num(opt.vtcCoef);
    var vtc = vq != null && vq > 0 ? vq : (vc != null && vc > 0 ? taxi * vc : null);
    var vtcKind = vq != null && vq > 0 ? "quote" : (vtc != null ? "illustrative" : "unavailable");
    function row(id, cost, mins, kind) {
      var ok = cost != null && isFinite(cost);
      var m = num(mins);
      return { id: id, cost: ok ? r2(cost) : null, saving: ok ? r2(cost - flen) : null, minutes: m != null ? Math.round(m) : null,
               timeDiff: (m != null && flenMin != null) ? Math.round(flenMin - m) : null, kind: kind };
    }
    return [
      row("taxi", taxi, road != null && num(opt.taxiWait) != null ? road + opt.taxiWait : null, "source"),
      row("vtc", vtc, vtc != null && road != null && num(opt.vtcWait) != null ? road + opt.vtcWait : null, vtcKind),
      row("emt", src.emt.single, opt.emtMin, "source"),
      row("metro", src.metro.single, opt.metroMin, "source")
    ];
  }
  /* Tiempo puerta a puerta de Flenflena a partir del trayecto elegido */
  function flenDoorToDoor(o) {
    var walk = 60 / (o.walkKmh || 5);
    return Math.round((o.walkUpKm || 0) * walk + (o.waitMin || 0) + (o.rideMin || 0) + (o.walkDownKm || 0) * walk);
  }
  function headline(rows, id) {
    var r = rows.filter(function (x) { return x.id === id; })[0];
    if (!r || r.cost == null) return { kind: "nodata", id: id };
    return { kind: r.saving > 0 ? "save" : "more", id: id, amount: Math.abs(r.saving), timeDiff: r.timeDiff };
  }
  root.FFSavings = { compare: compare, flenDoorToDoor: flenDoorToDoor, headline: headline, taxiCost: taxiCost };
})(typeof window !== "undefined" ? window : module.exports);
