/* Flenflena v6 · configuración central (borrador LOCAL, sin publicar). */
window.FF_CONFIG = {
  VERSION: "v6",
  // Métricas: TODO apagado en v6. Con SHEET_ENDPOINT vacío y UMAMI_WEBSITE_ID vacío, track() solo escribe en la consola.
  UMAMI_WEBSITE_ID: "",
  UMAMI_SCRIPT_URL: "https://cloud.umami.is/script.js",
  SHEET_ENDPOINT: "",
  USE_SESSION_ID: false,
  HEARTBEAT_S: 15,
  HEARTBEAT_MAX_S: 300,

  TILE_URL: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  TILE_ATTRIBUTION: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  OSRM_URL: "https://router.project-osrm.org/route/v1/driving/",
  OSRM_TIMEOUT_MS: 7000,
  PHOTON_URL: "https://photon.komoot.io/api/",
  VALENCIA_BBOX: [-0.62, 39.33, -0.20, 39.70],
  STRAIGHT_LINE_FACTOR: 1.3,
  SPEED_KM_MIN: 0.55,        // ≈ 33 km/h, solo si OSRM no responde
  ARRIVAL_TOLERANCE_MIN: 10, // margen mostrado en las tarjetas (estimación)

  // Tarifa única (supuestos ilustrativos de energía por km; sin GLP)
  FARE: {
    costPerKm: {
      petrol: 0.139, // 7,89 L/100 km × 1,758 €/L (notas 2-nov-2026)
      diesel: 0.130, // 6,88 L/100 km × 1,896 €/L
      hybrid: 0.100, // SUPUESTO: punto intermedio
      ev:     0.061  // 19,1 kWh/100 km × 0,3166 €/kWh (carga en casa)
    },
    fee: 0.15,       // tarifa de servicio: 15 % del subtotal; solo se explica en «Cómo calculamos el precio»
    minFare: 0.50    // mínimo por plaza; el ajuste NO va al conductor (decisión abierta)
  },

  // Fuentes de la comparación de ahorro (comprobadas 8-nov-2026, ver README)
  SAVINGS: {
    taxi: { flag: 2.00, perKm: 1.36, minDay: 4.95, checked: "2026-11-08",
            url: "https://teletaxivalencia.com/wp-content/uploads/2026/04/Tarifas-urbanas-2026-resolucion.pdf" },
    emt: { single: 2.00, checked: "2026-11-08", url: "https://www.emtvalencia.es/wp/tarifas-y-titulos/" },
    metro: { single: 1.50, checked: "2026-11-08", url: "https://www.metrovalencia.es/es/nuestras-tarifas/" }
  },

  SLOTS: [ // solo para métricas agregadas (franja), ya no cambian el precio
    { id: "am_peak", from: 7, to: 10 }, { id: "midday", from: 10, to: 14 }, { id: "afternoon", from: 14, to: 17 },
    { id: "pm_peak", from: 17, to: 20 }, { id: "night", from: 20, to: 7 }
  ],

  VARIANTS: { A: { hero: "community" }, B: { hero: "savings" } },
  DEFAULT_VARIANT: "A",
  // ?src= solo acepta estos valores; cualquier otro se registra como "other" (evita filtrar texto privado)
  SRC_ALLOWED: ["direct", "qr", "poster", "whatsapp", "instagram", "x", "email", "class", "flyer", "linkedin"],

  CONTACT: "TODO: contacto del equipo",
  DELETION_DATE: "TODO: fecha de borrado"
};
