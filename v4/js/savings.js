/* Flenflena · comparación de ahorro para pasajeros. Solo modos sin coche propio: taxi, VTC, EMT, metro.
   Nunca coche propio. Sin CO2. Todos los tiempos son puerta a puerta e incluyen espera/acceso de forma coherente:
   - taxi:  espera supuesta (editable) + tiempo por carretera OSRM (sin tráfico en tiempo real)
   - VTC:   espera supuesta (editable) + tiempo por carretera OSRM
   - Flenflena: a pie hasta el punto de encuentro + espera supuesta (editable) + trayecto en el coche + a pie al final
   - EMT / metro: SOLO si la persona escribe su tiempo puerta a puerta (no tenemos horarios en tiempo real)
   - Cercanías (v4): a pie hasta/desde la estación (ESTIMACIÓN 5 km/h) + margen + horario Renfe (GTFS oficial); sin precio
   - Me lleva alguien que conozco (v4): 0 €, tiempo del coche OSRM; depende de que haya alguien disponible
   VTC: precio que te hayan dado, o estimación ILUSTRATIVA = fórmula del taxi × coeficiente editable (no es tarifa real). */
(function (root) {
  function r2(x) { return Math.round((x + 1e-9) * 100) / 100; }
  function num(x) { return x != null && isFinite(x) ? +x : null; }
  function taxiCost(km, T) { return Math.max(T.minDay, T.flag + T.perKm * km); }
  /* opt: { roadMin, flenMin, taxiWait, vtcWait, vtcQuote, vtcCoef, emtMin, metroMin, cercMin } */
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
    ].concat(
      // v4: Cercanías solo si hay estación cerca de los dos extremos (tiempo: horario Renfe + a pie estimado; sin precio)
      num(opt.cercMin) != null ? [row("cercanias", null, opt.cercMin, "estimate")] : [],
      // v4: «me lleva alguien que conozco»: 0 €, coche puerta a puerta (OSRM) si hay alguien disponible
      road != null ? [row("lift", 0, road, "lift")] : []
    );
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
  /* v4: estimación Cercanías puerta a puerta. st: estaciones [{id,lat,lng}]; pairs: {"a>b": {med}}; hav: distancia km */
  function cercaniasDoorToDoor(from, to, st, pairs, hav, o) {
    o = o || {};
    if (!from || !to || !st || !st.length || !pairs) return null;
    var maxKm = o.maxKm || 2.5, f = o.lineFactor || 1.3, walk = 60 / (o.walkKmh || 5);
    function near(p) {
      var b = null, bd = Infinity;
      st.forEach(function (s) { var d = hav(p, s); if (d < bd) { bd = d; b = s; } });
      return b && bd <= maxKm ? { s: b, km: bd * f } : null;
    }
    var a = near(from), b = near(to);
    if (!a || !b || a.s.id === b.s.id) return null;
    var pr = pairs[a.s.id + ">" + b.s.id]; if (!pr) return null;
    var wUp = Math.round(a.km * walk), wDn = Math.round(b.km * walk), margin = o.marginMin || 0;
    return { min: wUp + margin + pr.med + wDn, walkUp: wUp, walkDown: wDn, margin: margin, train: pr.med, via: pr.via, n: pr.n, a: a.s, b: b.s };
  }
  root.FFSavings = { cercaniasDoorToDoor: cercaniasDoorToDoor, compare: compare, flenDoorToDoor: flenDoorToDoor, headline: headline, taxiCost: taxiCost };
})(typeof window !== "undefined" ? window : module.exports);
