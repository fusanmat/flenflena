/* Flenflena · motor de tarifas ÚNICO (tarjetas, explicación, reserva, vista de conductor, calculadora de ahorro).
   Coste del tramo      = km × coste de energía €/km del coche (gasolina, diésel, híbrido, eléctrico; supuestos ilustrativos)
   S (plazas del coche) = plazas para pasajeros ofrecidas (cap / p_cap) + 1 conductor. Sin campo nuevo.
   Parte por plaza      = coste del tramo ÷ S  (conductor incluido; da igual cuántas plazas estén ocupadas)
   Un pasajero que reserva 2 plazas paga 2 partes. Las plazas vacías no se facturan (sin complemento al conductor).
   Recuperación conductor = suma de las partes de quienes reservan, redondeada a la baja al céntimo
                          → nunca supera el coste real; a coche lleno como máximo (S−1)/S del coste
   Tarifa de servicio   = fee × precio sin ajuste (15 % del subtotal: recuperación ÷ (1 − fee) − recuperación)
   Ajuste mínimo        = hasta minFare × plazas; se guarda APARTE: no va al conductor (destino: decisión abierta)
   Precio pasajero      = recuperación + tarifa + ajuste mínimo (todo incluido)                               */
(function (root) {
  function r2(x) { return Math.round((x + 1e-9) * 100) / 100; }
  function floor2(x) { return Math.floor((x + 1e-9) * 100) / 100; }

  function cpkOf(params, car) {
    if (params.costPerKm[car] == null) throw new Error("drivetrain desconocido: " + car);
    return params.costPerKm[car];
  }

  /* legsKm: [km de cada tramo]; pax: [{up, down, seats}] (sube en parada up, baja en down; tramo i = parada i → i+1) */
  function calcTrip(legsKm, pax, params, car, seatsOffered) {
    var cpk = cpkOf(params, car), fee = params.fee, minFare = params.minFare || 0;
    var S = seatsOffered | 0;
    if (S < 2) throw new Error("plazas del coche inválidas: " + seatsOffered);
    var legs = legsKm.map(function (km, i) {
      var onboard = 0;
      pax.forEach(function (p) { if (p.up <= i && p.down > i) onboard += (p.seats || 1); });
      var cost = km * cpk, occ = onboard + 1;
      return { km: km, onboard: onboard, occ: occ, seats: S, cost: cost, share: cost / S };
    });
    var res = pax.map(function (p) {
      var seats = p.seats || 1, base = 0, km = 0;
      for (var i = p.up; i < p.down; i++) { base += legs[i].share * seats; km += legs[i].km; }
      var recovery = floor2(base);
      var feeAmt = r2(recovery * fee / (1 - fee));
      var sub = r2(recovery + feeAmt);
      var minAdj = Math.max(0, r2(minFare * seats - sub));
      return { base: base, km: km, seats: seats, recovery: recovery, fee: feeAmt, minAdj: minAdj, price: r2(sub + minAdj) };
    });
    var carCost = legs.reduce(function (a, l) { return a + l.cost; }, 0);
    var recovered = r2(res.reduce(function (a, p) { return a + p.recovery; }, 0));
    // Salvaguarda: lo recuperado nunca supera el coste real (por construcción ya es así)
    if (recovered > floor2(carCost)) throw new Error("recuperación > coste");
    return {
      legs: legs, pax: res, cpk: cpk,
      tot: {
        km: legsKm.reduce(function (a, b) { return a + b; }, 0), carCost: carCost, recovered: recovered,
        driverOwn: carCost - recovered,
        fees: r2(res.reduce(function (a, p) { return a + p.fee; }, 0)),
        minAdj: r2(res.reduce(function (a, p) { return a + p.minAdj; }, 0)),
        paid: r2(res.reduce(function (a, p) { return a + p.price; }, 0))
      }
    };
  }

  /* Caso de un solo tramo (calculadora de ahorro): n pasajeros de origen a destino + conductor */
  function simple(km, n, params, car, seatsOffered) {
    var pax = []; for (var i = 0; i < n; i++) pax.push({ up: 0, down: 1, seats: 1 });
    return calcTrip([km], pax, params, car, seatsOffered == null ? 4 : seatsOffered);
  }

  /* Presupuesto fijado al confirmar: copia inmutable; los selectores posteriores no lo cambian */
  function freezeQuote(p, meta) {
    var q = { price: p.price, recovery: p.recovery, fee: p.fee, minAdj: p.minAdj, seats: p.seats, km: Math.round(p.km * 10) / 10 };
    Object.keys(meta || {}).forEach(function (k) { q[k] = meta[k]; });
    return Object.freeze(q);
  }

  root.FFFare = { calcTrip: calcTrip, simple: simple, freezeQuote: freezeQuote, r2: r2, floor2: floor2 };
})(typeof window !== "undefined" ? window : module.exports);
