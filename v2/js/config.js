/* Flenflena v2 · prototipo académico (MUGEPS, UPV). Configuración central. */
window.FF_CONFIG = {
  VERSION: "v2",
  // Analítica (Umami, sin uso en v2): se mantiene el enganche, pero el destino es SHEET_ENDPOINT.
  UMAMI_WEBSITE_ID: "",
  UMAMI_SCRIPT_URL: "https://cloud.umami.is/script.js",
  // Métricas a Google Sheets (Apps Script, ver tools/apps-script.gs). Vacío = solo consola.
  // Si se rellena, se usa esto y no Umami.
  SHEET_ENDPOINT: "",
  HEARTBEAT_S: 15,       // latido cada 15 s con la pestaña visible…
  HEARTBEAT_MAX_S: 300,  // …hasta 5 minutos

  // Servicios de mapa (gratuitos, sin clave)
  TILE_URL: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  TILE_ATTRIBUTION: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  OSRM_URL: "https://router.project-osrm.org/route/v1/driving/",
  OSRM_TIMEOUT_MS: 7000,
  PHOTON_URL: "https://photon.komoot.io/api/",
  // Búsqueda limitada al área de València (incluye Sagunto y Alfara): [minLon, minLat, maxLon, maxLat]
  VALENCIA_BBOX: [-0.62, 39.33, -0.20, 39.70],
  STRAIGHT_LINE_FACTOR: 1.3, // si falla OSRM: distancia en línea recta × 1,3
  SPEED_KM_MIN: 0.55,        // velocidad media supuesta para estimar horas (≈ 33 km/h)

  // Tarifa única para toda la web (Buscar, Publicar, Tarifario). Editable en el Tarifario.
  FARE: {
    costPerKm: {          // €/km de combustible o energía del coche (mismos valores que v1)
      petrol: 0.139,      // 7,89 L/100 km × 1,758 €/L
      diesel: 0.130,      // 6,88 L/100 km × 1,896 €/L
      hybrid: 0.100,      // SUPUESTO: punto intermedio entre gasolina y eléctrico
      ev:     0.061,      // 19,1 kWh/100 km × 0,3166 €/kWh (carga en casa)
      suv:    0.170       // SUPUESTO: ~22 % más que un gasolina medio
    },
    factor: { offpeak: 1.00, am_peak: 1.29, pm_peak: 1.32 }, // factor por franja horaria
    commission: 0.15,     // 15 % del precio que paga el pasajero, ya incluido en el precio
    minFare: 0.50,        // € mínimos por plaza (línea "ajuste mínimo")
    maxPerKm: 0.26        // el conductor nunca recupera más de 0,26 € por km conducido
  },

  SLOTS: [
    { id: "am_peak",   from: 7,  to: 10, mult: "am_peak" },
    { id: "midday",    from: 10, to: 14, mult: "offpeak" },
    { id: "afternoon", from: 14, to: 17, mult: "offpeak" },
    { id: "pm_peak",   from: 17, to: 20, mult: "pm_peak" },
    { id: "night",     from: 20, to: 7,  mult: "offpeak" }
  ],

  // Variantes A/B por enlace (?v=A|B). Sin cookies: la variante la decide el enlace.
  VARIANTS: { A: { hero: "community" }, B: { hero: "savings" } },
  DEFAULT_VARIANT: "A",

  // TODO (equipo): contacto y fecha de borrado de los datos agregados
  CONTACT: "TODO: contacto del equipo",
  DELETION_DATE: "TODO: fecha de borrado"
};
