# Flenflena v4

Copia de v3 (commit 6fba2d6, que queda congelada como registro) con las recomendaciones de la ronda de pruebas. Misma tarifa por plaza (S = plazas + 1, mínimo 0,50 €/plaza que no va al conductor, tarifa 15 %), mismos precios MITECO del 10/11/2026, mismo acceso simulado por correo universitario.

## Novedades v4
- **Entrada desde el formulario**: `https://fusanmat.github.io/flenflena/v4/?src=form` abre «Buscar» con el atajo «Clase tarde» (UPV Vera → Alfafar, 18:00), un aviso «Prueba: elige un conductor y pulsa Reservar», el buscador plegado y sin la barra de registro. `src=form` se guarda en `sessionStorage` (`ff_src`).
- **Código de prueba**: tras `reserve_click`, código aleatorio de 5 caracteres (sin 0/O/1/I/L), sin datos personales, para copiarlo en el formulario.
- **Tiempos puerta a puerta** en tarjetas y calculadora (ver «Fuentes de tiempos»).
- **Promesa de cancelación** en la tarjeta y en la FAQ: si quien conduce cancela, devolución completa al instante y se muestra el siguiente viaje disponible.
- **Conductores habituales** (Publicar): «Repetir cada semana (L-V)», resumen semanal simulado y elección de cobro (semanal con extra / en un día). El extra lo paga la plataforma con el 20 % de SU tarifa de servicio de esos viajes (`REGULAR.perkShareOfFee`); quien viaja paga lo mismo.
- **Estaciones de Cercanías** como lugares (grupo «Estaciones de Cercanías») y atajo «Estación → campus» (Cercanías Alzira → UPV Vera, llegar antes de las 09:00).
- **Puertas falsas**: «Guardar mi ruta / avisarme cuando haya plaza» y pantalla «Aún no hay viajes en esta ruta» con lista de espera. No guardan nada.
- **Comparación**: taxi, VTC, EMT, metro + Cercanías (si hay estación a ≤ 2,5 km de los dos extremos) + «Me lleva alguien que conozco» (0 €, depende de disponibilidad) y «Dónde gana Flenflena».

## Métricas v4 (mismas claves, sin columnas nuevas)
`variant` se envía como `v4-A` / `v4-B` (v3 envía `A` / `B`); `?v=A|B` sigue funcionando. Eventos nuevos:

| Evento | Campos |
|---|---|
| `form_entry` | zone_from, zone_to, slot, option_rank (= nº de resultados), vehicle, price (1.ª opción) — entrada automática desde el formulario |
| `calc_shown` | zone_from, zone_to, slot, price (precio Flenflena de la calculadora), vehicle, option_rank |
| `preset_click` / `station_preset_click` | zone_from, zone_to, slot |
| `faq_open` | survey = `faq=1…6` o `faq=break` («Ver desglose», con option_rank) |
| `publish_open` | — |
| `scroll_50` | seconds_on_page (una vez por sesión, `ff_s50`) |
| `confirm_code_shown` | survey = `code=XXXXX`, option_rank, price |
| `save_route_click` / `waitlist_click` / `notrips_shown` | zone_from, zone_to, slot, passengers |
| `recurring_toggle` | survey = `recurring=on|off` |
| `payout_choice` | survey = `payout=weekly_bonus|within_day` |
| `publish_done` (ya existía) | ahora también survey = `recurring=…;payout=…` |

## Fuentes de tiempos
- **Flenflena**: a pie (5 km/h) + 5 min de espera supuesta (editable) + tiempo del coche OSRM sin tráfico en tiempo real.
- **Cercanías**: ESTIMACIÓN = a pie hasta y desde la estación más cercana (5 km/h sobre línea recta × 1,3) + 5 min de margen + mediana del tiempo de tren del horario oficial de Renfe Cercanías (GTFS `fomento_transit.zip`, https://ssl.renfe.com/ftransit/Fichero_CER_FOMENTO/fomento_transit.zip, jueves 12-nov-2026, salidas 07:00–20:00, transbordo de 8 min en València Nord según `transfers.txt`). Datos en `data/cercanias.json`, generados a mano con `tools/build-cercanias.py`. Coordenadas de las 28 estaciones: `stops.txt` del mismo GTFS. Sin precio (no se muestra tarifa de Renfe).
- **Bus EMT / metro**: solo si la persona escribe sus minutos en la calculadora (no hay horarios propios).
- **Me lleva alguien que conozco**: 0 €, tiempo del coche OSRM.


Sitio estático (sin compilación) para compartir coche hacia los campus de València. Mapa Leaflet/OSM, búsqueda de direcciones con Photon, rutas OSRM (si no responde, se usa la distancia en línea recta × 1,3).

## Acceso de miembros (MAQUETA)
- Es una simulación con aspecto real: registro o «Entrar» con correo institucional → pantalla «Verifica tu correo universitario», que avisa de que «En esta demostración no enviamos correos ni creamos cuentas» → botón «Continuar con la demostración», que desbloquea perfiles **ficticios** solo en memoria (se pierde al recargar o al pulsar «Salir»).
- No hay servidor, cuentas ni envío de correos. El nombre y el correo se validan en el navegador y se descartan; solo queda en memoria la institución. `authenticated()` es siempre `false` y la cabecera muestra «Vista de demostración · sin verificar».
- Dominios admitidos (`config.js → INSTITUTIONS`), con coincidencia exacta y subdominios solo con regla explícita:
  - UPV: upv.es, upv.edu.es.
  - UV: uv.es, alumni.uv.es (fuente: UV SIUV).
  - CEU-UCH: uchceu.es (dominio del alumnado pendiente).
- La universidad elegida debe coincidir con el dominio del correo.

## Métricas
Mismos eventos, claves (lista blanca de `track.js`) y destino (`SHEET_ENDPOINT`, el de v2) que v2: sin identificador de sesión en el navegador y latido cada 15 s hasta 5 min. Nunca se envían nombres, correos, direcciones ni coordenadas. Ojo: **abrir la web en local también envía eventos reales**. Las pruebas usan un sumidero simulado.

## Pendiente
- Precio uniforme por plaza: decisión pendiente (aviso visible).
- Dominio del alumnado de CEU-UCH.
- Contacto y fecha de borrado (`CONTACT`, `DELETION_DATE`, heredados de v2 como TODO).

## Área de servicio
`config.js → VALENCIA_BBOX = [-0.62, 39.08, -0.20, 39.70]` (oeste, sur, este, norte). El límite sur se amplió de 39,33 a 39,08 para incluir Alzira. Photon y los clics en el mapa se limitan a esta caja. Lugares conocidos añadidos (con zona `mun_*` para las métricas): Almussafes, Benifaió, Algemesí, Alzira y Carcaixent.

## Tarifa y ahorro
Una sola función en `js/fare.js` (coste/km por motor ÷ ocupantes; comisión del 15 %; ajuste mínimo separado; cotización congelada al confirmar). Las comparativas en `js/savings.js` muestran sus supuestos y fuentes con fecha. Los precios de combustible son una instantánea fechada en `data/fuel_prices.json` (MITECO, provincia de Valencia); se actualizan solo a mano, si hace falta, con `tools/update-fuel-prices.py`.

## Pruebas
Las pruebas de v4 viven fuera del sitio publicado (copia de trabajo). Igual que en v3:
`node tests/auth.test.js && node tests/fare.test.js && node tests/mapinput.test.js && node tests/static.test.js && JSDOM=/path/jsdom node tests/dom.smoke.js`
