/* Flenflena · prototipo académico (MUGEPS, UPV). Configuración central. */
window.FF_CONFIG = {
  // Analítica: vacío = track() solo escribe en la consola. Pega aquí el ID de sitio de Umami
  // cuando Frank lo apruebe (Umami no usa cookies). No se envía nada mientras esté vacío.
  UMAMI_WEBSITE_ID: "",
  UMAMI_SCRIPT_URL: "https://cloud.umami.is/script.js",

  // Servicios de mapa (gratuitos, sin clave)
  TILE_URL: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  TILE_ATTRIBUTION: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  OSRM_URL: "https://router.project-osrm.org/route/v1/driving/",
  OSRM_TIMEOUT_MS: 7000,
  PHOTON_URL: "https://photon.komoot.io/api/",
  // Búsqueda limitada al área de València: [minLon, minLat, maxLon, maxLat]
  VALENCIA_BBOX: [-0.60, 39.33, -0.20, 39.62],
  STRAIGHT_LINE_FACTOR: 1.3, // si falla OSRM: distancia en línea recta × 1,3

  // Tarifa (fuentes: notas de Data, 2 nov 2026; ver README)
  FARE: {
    costPerKm: {          // €/km de combustible o energía del coche
      petrol: 0.139,      // 7,89 L/100 km × 1,758 €/L
      diesel: 0.130,      // 6,88 L/100 km × 1,896 €/L
      hybrid: 0.100,      // SUPUESTO: punto intermedio entre gasolina y eléctrico
      ev:     0.061,      // 19,1 kWh/100 km × 0,3166 €/kWh (carga en casa)
      suv:    0.170       // SUPUESTO: ~22 % más que un gasolina medio
    },
    congestion: { offpeak: 1.00, am_peak: 1.29, pm_peak: 1.32 },
    commission: 0.25,     // € por trayecto y pasajero
    minFare: 0.50,        // SUPUESTO: tarifa mínima por pasajero
    maxPerKm: 0.26        // tope absoluto: nunca más de 0,26 €/km por pasajero
  },

  // Franjas horarias (se registra solo el id de la franja)
  SLOTS: [
    { id: "am_peak",  from: 7,  to: 10, mult: "am_peak" },
    { id: "midday",   from: 10, to: 14, mult: "offpeak" },
    { id: "afternoon",from: 14, to: 17, mult: "offpeak" },
    { id: "pm_peak",  from: 17, to: 20, mult: "pm_peak" },
    { id: "night",    from: 20, to: 7,  mult: "offpeak" }
  ],

  // Variantes A/B por enlace (?v=A|B|C|D). Sin cookies: la variante la decide el enlace.
  VARIANTS: {
    A: { hero: "savings",   price: "separate" },
    B: { hero: "community", price: "separate" },
    C: { hero: "savings",   price: "included" },
    D: { hero: "community", price: "included" }
  },
  DEFAULT_VARIANT: "A",

  // TODO (Frank): contacto y fecha de borrado de los datos agregados
  CONTACT: "TODO: contacto del equipo",
  DELETION_DATE: "TODO: fecha de borrado"
};
