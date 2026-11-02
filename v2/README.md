# Flenflena v2

Sitio estático (HTML, CSS y JavaScript sin compilación) publicado en `/v2/` del repositorio.
Mapas: Leaflet + teselas de OpenStreetMap, rutas con OSRM y búsqueda de direcciones con Photon.

Nota para el equipo: es el PMV de «puerta falsa» del proyecto del máster MUGEPS (UPV).
La web no menciona que sea un prototipo hasta el momento de reservar o apuntarse, donde se
explica que Flenflena aún no está disponible y que no se ha guardado ningún dato personal.

## Métricas en Google Sheets

1. Crea una hoja de cálculo de Google y abre **Extensiones → Apps Script**.
2. Pega el contenido de `tools/apps-script.gs`, guarda.
3. **Implementar → Nueva implementación → Aplicación web**. Ejecutar como: tú. Acceso: cualquier usuario.
4. Copia la URL que termina en `/exec` y ponla en `js/config.js` → `SHEET_ENDPOINT`.
5. Publica. Con `SHEET_ENDPOINT` vacío, `track()` solo escribe en la consola.

Cada fila guarda la hora del servidor y solo estas claves (las demás se ignoran):
`session, event, variant, src, zone_from, zone_to, slot, vehicle, passengers, option_rank, price, seconds_on_page, survey`.
Nunca se envían direcciones, coordenadas, nombres ni correos. `session` es un identificador
aleatorio en `sessionStorage` (solo esta pestaña) que solo se crea si `SHEET_ENDPOINT` está relleno.

Eventos: `view, lang_switch, demo_start, route_shown, fare_shown, driver_select, reserve_click,
door_yes, door_no, form_start, form_submit, survey_submit, publish_start, publish_done,
heartbeat` (cada 15 s con la pestaña visible, hasta 5 min) y `leave` (al salir, con `sendBeacon`).

## Enlaces de campaña

- `?v=A` (comunidad, por defecto) o `?v=B` (ahorro): variante del texto principal.
- `?src=xxx`: origen del enlace (letras, números, `_` y `-`, hasta 24 caracteres).
- `?lang=en`: abre en inglés.

## Pendiente del equipo

- `CONTACT` y `DELETION_DATE` en `js/config.js`.
- `SHEET_ENDPOINT` en `js/config.js`.
