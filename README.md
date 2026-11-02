# Flenflena · prototipo (PMV) — proyecto académico MUGEPS (UPV)

> **Maqueta de curso** para la asignatura BPT (fase 3, producto mínimo viable) del máster MUGEPS.
> **No es un servicio real.** Conductores, rutas y precios son ficticios. No es un servicio de la UPV ni de ninguna universidad.

Página estática (HTML + CSS + JS, sin compilación) para probar si la idea interesa: quien visita prueba una demo de mapa
con un conductor simulado y un precio estimado, pulsa "Reservar" (puerta falsa) y puede rellenar un registro simulado.

## Estructura
```
index.html          página única ES/EN
css/styles.css      estilos (móvil primero), paleta #F6F8FC #0D1B3E #2463FF #0EBE76
js/config.js        TODA la configuración: tarifa, franjas, variantes A/B, ID de analítica, TODOs
js/i18n.js          textos ES/EN
js/track.js         track(evento, props): solo consola mientras no haya ID de Umami
js/app.js           mapa, búsqueda, emparejamiento, tarifa, puerta falsa, formulario
data/drivers.json   22 rutas de conductores SIMULADOS hacia Vera, Blasco Ibáñez, Tarongers y Burjassot
data/zones.json     campus (bbox OSM) + centroides de distritos de València y municipios cercanos
assets/             Manrope (OFL, alojada aquí), Leaflet 1.9.4 (alojado aquí), favicon
```

## Servicios externos (gratis, sin clave)
- Teselas: OpenStreetMap estándar (tile.openstreetmap.org; uso ligero según su política). Las teselas gratuitas de CARTO ya piden clave.
- Rutas: servidor demo público de OSRM. Si falla o tarda más de 7 s: línea recta × 1,3.
- Búsqueda: Photon (komoot), limitada al recuadro de València.

## Tarifa (por pasajero)
```
compartido = km × coste/km(coche) × congestión(franja) ÷ (pasajeros + conductor)
total      = compartido + 0,25 € comisión, mínimo 0,50 €, y NUNCA más de 0,26 €/km
```
| Coche | €/km | Fuente |
|---|---|---|
| Gasolina | 0,139 | 7,89 L/100 km × 1,758 €/L (notas de Data, 2 nov 2026) |
| Diésel | 0,130 | 6,88 L/100 km × 1,896 €/L |
| Eléctrico | 0,061 | 19,1 kWh/100 km × 0,3166 €/kWh (carga en casa) |
| Híbrido | 0,100 | **supuesto**: punto intermedio gasolina / eléctrico |
| SUV o grande | 0,170 | **supuesto**: ~22 % más que gasolina |

Congestión: 1,00 fuera de punta · 1,29 punta de mañana (7–10 h) · 1,32 punta de tarde (17–20 h).
Si el mínimo o el tope cambian el total, la diferencia se ajusta en la comisión.

## Variantes A/B (por enlace, sin cookies)
| `?v=` | Mensaje del hero | Precio |
|---|---|---|
| A (por defecto) | ahorro | compartido + comisión por separado |
| B | comunidad | por separado |
| C | ahorro | comisión incluida |
| D | comunidad | comisión incluida |

`?src=` (letras, números, `_` o `-`) marca la fuente de tráfico, p. ej. `?v=B&src=clase`. `?lang=en` abre en inglés.

## Analítica anónima
`track()` añade a cada evento la variante, `src` e idioma. Eventos: `view`, `demo_start`, `route_shown`
(zona de origen y destino, franja, tramo de km), `fare_shown`, `reserve_click`, `door_yes`, `door_no`,
`form_start`, `form_submit` (rol, sexo opcional, 18+), `survey_submit`, `lang_switch`, `leave` (tramo de tiempo en la página).
Solo se aceptan valores cortos tipo id; nunca nombres, correos, direcciones ni coordenadas.
Para activarla: crear un sitio en Umami (sin cookies) y pegar su ID en `UMAMI_WEBSITE_ID` de `js/config.js`.

## Pendiente (TODO)
- `CONTACT` y `DELETION_DATE` en `js/config.js`.
- ID de Umami.

## Licencias
Manrope: SIL Open Font License 1.1 (`assets/fonts/OFL.txt`). Leaflet: BSD-2-Clause. Datos del mapa © colaboradores de OpenStreetMap.
