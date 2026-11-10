# Flenflena v3

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
`node tests/auth.test.js && node tests/fare.test.js && node tests/mapinput.test.js && node tests/static.test.js && JSDOM=/path/jsdom node tests/dom.smoke.js`
