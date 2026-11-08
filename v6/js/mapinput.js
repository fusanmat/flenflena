/* Flenflena v6 · entrada del mapa (rueda y táctil). Funciones puras para poder probarlas sin navegador.
   - Modo cooperativo (un dedo desplaza la página, dos dedos mueven el mapa) SOLO si el dispositivo no
     tiene ningún puntero fino (ratón/trackpad). Un portátil táctil con ratón NO entra en este modo.
   - La rueda sobre cualquier mapa nunca desplaza la página: oyente no pasivo en captura sobre window
     que hace preventDefault; Leaflet (scrollWheelZoom) hace el zoom. */
(function (root) {
  function touchOnly(mm) {
    if (!mm) return false;
    var q = function (s) { try { return !!mm(s).matches; } catch (e) { return false; } };
    return q("(pointer: coarse)") && !q("(any-pointer: fine)") && !q("(any-hover: hover)");
  }
  function inMap(target) {
    var el = target && target.nodeType === 1 ? target : target && target.parentElement;
    return !!(el && el.closest && el.closest(".leaflet-container"));
  }
  function wheelGuard(e) { if (inMap(e.target)) e.preventDefault(); }
  function installWheelGuard(win) {
    if (win.__ffWheel) return false;
    win.__ffWheel = true;
    win.addEventListener("wheel", wheelGuard, { passive: false, capture: true });
    return true;
  }
  root.FFMapInput = { touchOnly: touchOnly, inMap: inMap, wheelGuard: wheelGuard, installWheelGuard: installWheelGuard };
})(typeof window !== "undefined" ? window : module.exports);
