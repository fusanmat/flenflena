/**
 * Flenflena v2 · receptor de métricas anónimas para Google Sheets.
 * Pegar en Extensiones → Apps Script de la hoja, guardar y desplegar como aplicación web
 * (Ejecutar como: yo · Acceso: cualquier usuario). Copiar la URL /exec en
 * FF_CONFIG.SHEET_ENDPOINT (v2/js/config.js).
 *
 * - Solo se guardan las claves de la lista blanca; cualquier otra se ignora.
 * - Los textos se recortan a una longitud máxima.
 * - No se registran IP ni cabeceras (Apps Script no las expone a doPost y no se leen).
 */
var SHEET_NAME = 'events';
var KEYS = ['session', 'event', 'variant', 'src', 'zone_from', 'zone_to', 'slot', 'vehicle',
            'passengers', 'option_rank', 'price', 'seconds_on_page', 'survey'];
var MAX_LEN = { survey: 160 };   // resto de claves: 40
var DEFAULT_MAX = 40;

function doPost(e) {
  var data = {};
  try { data = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { data = {}; }
  if (!data || typeof data !== 'object' || Array.isArray(data)) data = {};

  var row = [new Date()];                       // marca de tiempo del servidor
  KEYS.forEach(function (k) {
    var v = data[k];
    if (typeof v === 'number' && isFinite(v)) row.push(v);
    else if (typeof v === 'string') row.push(v.replace(/[\u0000-\u001f]/g, '').slice(0, MAX_LEN[k] || DEFAULT_MAX));
    else row.push('');
  });

  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
    if (sh.getLastRow() === 0) sh.appendRow(['server_time'].concat(KEYS));
    sh.appendRow(row);
  } finally {
    lock.releaseLock();
  }
  return ContentService.createTextOutput('ok').setMimeType(ContentService.MimeType.TEXT);
}
