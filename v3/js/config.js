/* Flenflena · configuración central. */
window.FF_CONFIG = {
  VERSION: "v3",
  // Métricas anónimas: MISMO destino e indicadores que v2 (Apps Script → hoja de Google). Umami sin uso.
  UMAMI_WEBSITE_ID: "",
  UMAMI_SCRIPT_URL: "https://cloud.umami.is/script.js",
  SHEET_ENDPOINT: "https://script.google.com/macros/s/AKfycbx7S6x-_nl03Rj6QYp78ePDYIxOHUlPuoCUAyBgnMmM1-jbc8Cmeb-NN3ijqnc-X7v87A/exec", // el de v2, sin cambios
  USE_SESSION_ID: true,
  HEARTBEAT_S: 15,
  HEARTBEAT_MAX_S: 300,

  TILE_URL: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  TILE_ATTRIBUTION: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  OSRM_URL: "https://router.project-osrm.org/route/v1/driving/",
  OSRM_TIMEOUT_MS: 7000,
  PHOTON_URL: "https://photon.komoot.io/api/",
  VALENCIA_BBOX: [-0.62, 39.08, -0.20, 39.70], // sur ampliado (antes 39,33) para incluir Alzira y Carcaixent (Ribera Alta)
  STRAIGHT_LINE_FACTOR: 1.3,
  SPEED_KM_MIN: 0.55,        // ≈ 33 km/h, solo si OSRM no responde
  ARRIVAL_TOLERANCE_MIN: 10, // margen mostrado en las tarjetas (estimación)

  // Tarifa única. costPerKm de reserva si no carga data/fuel_prices.json (precios oficiales semanales).
  // €/km = precio €/L (o €/kWh) × consumo / 100. Sin GLP.
  FARE: {
    costPerKm: {
      petrol: 0.139, // reserva: 7,89 L/100 km × 1,758 €/L (notas 2-nov-2026)
      diesel: 0.130, // reserva: 6,88 L/100 km × 1,896 €/L
      hybrid: 0.100, // reserva: SUPUESTO, punto intermedio
      ev:     0.061  // reserva: 19,1 kWh/100 km × 0,3166 €/kWh (carga en casa)
    },
    consumption: {   // L/100 km (o kWh/100 km el eléctrico); el híbrido es un SUPUESTO
      petrol: 7.89,
      diesel: 6.88,
      hybrid: 5.0,
      ev: 19.1
    },
    fallbackEurL: { petrol: 1.758, diesel: 1.896 },
    evEurKwh: 0.3166, // supuesto: carga en casa (no hay serie oficial semanal sin token)
    fee: 0.15,       // tarifa de servicio: 15 % del subtotal; solo se explica en «Cómo calculamos el precio»
    minFare: 0.50    // mínimo por plaza; el ajuste NO va al conductor (decisión abierta)
  },

  // Fuentes de la comparación de ahorro (comprobadas 8-nov-2026, ver README)
  SAVINGS: {
    taxi: { flag: 2.00, perKm: 1.36, minDay: 4.95, checked: "2026-11-08",
            url: "https://teletaxivalencia.com/wp-content/uploads/2026/04/Tarifas-urbanas-2026-resolucion.pdf" },
    emt: { single: 2.00, checked: "2026-11-08", url: "https://www.emtvalencia.es/wp/tarifas-y-titulos/" },
    // Supuestos ILUSTRATIVOS editables en la portada (sin fuente; no son datos de mercado)
    assumptions: { taxiWaitMin: 5, vtcWaitMin: 5, vtcCoefOnTaxi: 1.00, flenWaitMin: 5 },
    metro: { single: 1.50, checked: "2026-11-08", url: "https://www.metrovalencia.es/es/nuestras-tarifas/" }
  },

  SLOTS: [ // solo para métricas agregadas (franja), ya no cambian el precio
    { id: "am_peak", from: 7, to: 10 }, { id: "midday", from: 10, to: 14 }, { id: "afternoon", from: 14, to: 17 },
    { id: "pm_peak", from: 17, to: 20 }, { id: "night", from: 20, to: 7 }
  ],

  VARIANTS: { A: { hero: "community" }, B: { hero: "savings" } },
  DEFAULT_VARIANT: "A",
  // ?src= solo acepta estos valores; cualquier otro se registra como "other" (evita filtrar texto privado)
  SRC_ALLOWED: ["direct", "qr", "poster", "whatsapp", "instagram", "x", "email", "class", "flyer", "linkedin", "form"],

  // Maqueta: sin verificación real ni servidor de cuentas (ver js/auth.js).
  // Dominios institucionales admitidos. Coincidencia exacta; subdominios solo con regla explícita (subdomainsOf).
  INSTITUTIONS: [
    { id: "upv", name: "UPV", enabled: true, domains: ["upv.es", "upv.edu.es"], subdomainsOf: [],
      source: "Facilitados por el equipo (8-nov-2026)" },
    { id: "uv", name: "UV", enabled: true, domains: ["uv.es", "alumni.uv.es"], subdomainsOf: [],
      source: "Universitat de València, SIUV: PDI/PAS @uv.es, alumnado @alumni.uv.es (uv.es/wikisiuv; uveg.atlassian.net, consultado 8-nov-2026)" },
    { id: "ceu", name: "CEU-UCH", enabled: true, domains: ["uchceu.es"], subdomainsOf: [],
      source: "uchceu.es (correos oficiales de la universidad, consultado 8-nov-2026). Dominio del alumnado: PENDIENTE de confirmar" }
  ],
  CONTACT: "TODO: contacto del equipo",
  DELETION_DATE: "TODO: fecha de borrado"
};
