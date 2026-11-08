# Flenflena v6 (borrador LOCAL, sin publicar)

Sitio estático sin compilación, construido sobre el código de v2 (Leaflet/OSM, direcciones con Photon,
rutas OSRM con plan B línea recta × 1,3, 2–4 tarjetas seleccionables con ruta resaltada, rueda solo en el
mapa en escritorio y dos dedos en móvil, ES/EN). v1, v2 y v5 no se tocan.

## Cambios frente a v2
- Logo v7 (icono en la cabecera, logotipo con nombre en la portada). Etiqueta discreta
  «Demostración: perfiles, viajes y precios ficticios» bajo la cabecera (ES/EN).
- Portada para visitantes: mensaje de comunidad universitaria (sin aval), calculadora de ahorro con la
  distancia por carretera de la ruta frente a taxi, VTC, bus EMT y metro (nunca coche propio), y vista
  previa de conductores con los perfiles difuminados hasta el registro simulado.
- Buscar: día (desde hoy), «Llegar antes de» / «Salir a partir de», hora (no pasada si es hoy),
  «Repetir de lunes a viernes» (apagado por defecto; rango de fechas y días que se pueden saltar),
  filtro «Solo conductoras» sobre datos ficticios.
- Tarjetas: punto de encuentro público o zona aproximada, distancia a pie, recogida y llegada estimada
  (±10 min), motorización, pasajeros confirmados y plazas libres por separado, precio todo incluido.
  Sin valoraciones ni contadores de viajes; sin fotos; sin roles.
- Sin Tarifario. Una sola función de precio (js/fare.js) para tarjetas, explicación, reserva, conductor
  y calculadora. La tarifa de servicio (15 %) solo aparece en «Cómo calculamos el precio».
- Reservar → precio fijado en memoria (no cambia con los selectores) → pantalla de revelación.
- Conductor: «Costes recuperados · cubre tus gastos, no es un ingreso»; nunca supera el coste del viaje.
- Métricas apagadas (SHEET_ENDPOINT vacío). ?src= y ?v= solo aceptan valores de listas cerradas.

## Fórmula
Coste del tramo = km × €/km de energía (gasolina 0,139; diésel 0,130; híbrido 0,100 supuesto; eléctrico 0,061).
Parte = coste ÷ (pasajeros a bordo + conductor). Recuperación del conductor = suma de partes, a la baja al
céntimo. Tarifa = 15 % del subtotal. Ajuste mínimo hasta 0,50 €/plaza, aparte (no va al conductor).

## Pruebas
`node ../tests-v6/fare.test.js`, `node ../tests-v6/static.test.js` y (con jsdom) `node ../tests-v6/dom.smoke.js`.

## Pendiente del equipo
CONTACT y DELETION_DATE en js/config.js; decisiones abiertas en el informe.
