/* Flenflena v2 · motor de tarifas ÚNICO. Lo usan Buscar viaje, Publicar trayecto y el Tarifario.
   Coste del tramo   = km × coste/km del coche × factor de la franja horaria
   Parte por persona = coste del tramo ÷ (pasajeros a bordo + 1 conductor)
   Precio pasajero   = suma de sus tramos (× plazas) + ajuste mínimo hasta minFare × plazas
   Comisión          = commission × precio (incluida en el precio); conductor = el resto
   Tope              = lo que recupera el conductor nunca supera maxPerKm × km conducidos */
(function (root) {
  function r2(x) { return Math.round((x + 1e-9) * 100) / 100; }

  function slotMult(params, slots, slotId) {
    var s = (slots || []).filter(function (x) { return x.id === slotId; })[0];
    var key = s ? s.mult : "offpeak";
    return params.factor[key] != null ? params.factor[key] : 1;
  }

  /* legsKm: [km de cada tramo del conductor]; pax: [{up, down, seats}] con índices de parada
     (sube en la parada up y baja en down, tramo i = parada i → i+1). */
  function calcTrip(legsKm, pax, params, car, mult) {
    var cpk = params.costPerKm[car] != null ? params.costPerKm[car] : params.costPerKm.petrol;
    var legs = legsKm.map(function (km, i) {
      var onboard = 0;
      pax.forEach(function (p) { if (p.up <= i && p.down > i) onboard += (p.seats || 1); });
      var occ = onboard + 1;
      var cost = km * cpk * mult;
      return { km: km, onboard: onboard, occ: occ, cost: cost, share: cost / occ };
    });
    var tripKm = legsKm.reduce(function (a, b) { return a + b; }, 0);
    var res = pax.map(function (p) {
      var seats = p.seats || 1, base = 0, km = 0;
      for (var i = p.up; i < p.down; i++) { base += legs[i].share * seats; km += legs[i].km; }
      var adj = Math.max(0, params.minFare * seats - base);
      return { base: base, adj: adj, seats: seats, km: km };
    });
    // Tope: el conductor recibe (1 − comisión) × suma de precios; nunca más de maxPerKm × km
    var keep = 1 - params.commission;
    var capTotal = params.maxPerKm * tripKm;
    var sum = res.reduce(function (a, p) { return a + p.base + p.adj; }, 0);
    var capped = false;
    if (keep > 0 && sum * keep > capTotal + 1e-9) {
      capped = true;
      var target = capTotal / keep, excess = sum - target;
      var adjSum = res.reduce(function (a, p) { return a + p.adj; }, 0);
      if (adjSum >= excess) res.forEach(function (p) { p.adjCut = excess * (adjSum ? p.adj / adjSum : 0); p.adj -= p.adjCut; });
      else {
        var baseSum = sum - adjSum, f = baseSum > 0 ? target / baseSum : 0;
        res.forEach(function (p) { p.adjCut = p.adj; p.adj = 0; p.baseCut = p.base * (1 - f); p.base *= f; });
      }
    }
    // Redondeo a céntimos (sin redondeos a 0,05 €)
    res.forEach(function (p) {
      p.price = r2(p.base + p.adj);
      p.driver = r2(p.price * keep);
      p.comm = r2(p.price - p.driver);
      p.baseR = r2(p.base); p.adjR = r2(p.price - p.baseR);
    });
    var guard = 0;
    function drvSum() { return r2(res.reduce(function (a, p) { return a + p.driver; }, 0)); }
    while (drvSum() > r2(capTotal) && guard++ < 50) { // céntimos de redondeo frente al tope
      var big = res.slice().sort(function (a, b) { return b.price - a.price; })[0];
      big.price = r2(big.price - 0.01); big.driver = r2(big.price * keep); big.comm = r2(big.price - big.driver);
      big.adjR = r2(big.price - big.baseR); if (big.adjR < 0) { big.baseR = big.price; big.adjR = 0; }
      capped = true;
    }
    var carCost = legs.reduce(function (a, l) { return a + l.cost; }, 0);
    var paid = r2(res.reduce(function (a, p) { return a + p.price; }, 0));
    var comm = r2(res.reduce(function (a, p) { return a + p.comm; }, 0));
    var driver = r2(paid - comm);
    return {
      legs: legs, pax: res, cpk: cpk, mult: mult, capped: capped,
      tot: { km: tripKm, carCost: carCost, paid: paid, comm: comm, driver: driver,
             net: driver - carCost, capTotal: capTotal, perKm: tripKm > 0 ? driver / tripKm : 0 }
    };
  }

  /* Caso sencillo del Tarifario: n pasajeros que van todos de origen a destino (un solo tramo). */
  function simple(km, n, params, car, mult) {
    var pax = []; for (var i = 0; i < n; i++) pax.push({ up: 0, down: 1, seats: 1 });
    return calcTrip([km], pax, params, car, mult);
  }

  root.FFFare = { calcTrip: calcTrip, simple: simple, slotMult: slotMult, r2: r2 };
})(typeof window !== "undefined" ? window : module.exports);
