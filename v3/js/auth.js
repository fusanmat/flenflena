/* Flenflena · acceso de miembros. Independiente del proveedor.
   REGLAS
   1. Solo correos de dominios institucionales de la lista (coincidencia EXACTA del dominio; subdominios solo si una
      regla los aprueba de forma explícita). Nunca endsWith ingenuo: "attackerupv.es" o "upv.es.evil" se rechazan.
   2. Verificación OBLIGATORIA por correo, decidida SOLO por un servidor. El navegador nunca marca a nadie como
      verificado: ni validando un formulario, ni con un indicador local, ni con un token que no haya validado el servidor.
   3. Sin proveedor configurado (estado actual), la verificación está «no disponible» y los datos de miembros siguen bloqueados.
   4. No se guarda ni se registra el correo en el navegador ni en las métricas.
   El difuminado CSS de las tarjetas NO protege datos: con datos reales, los detalles de miembros solo deben llegar
   del servidor tras autorización. Aquí los perfiles son ficticios y los nombres no se pintan mientras están bloqueados. */
(function (root) {
  "use strict";
  var LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

  /* Normaliza y separa el correo. Devuelve null si no es un correo válido. */
  function parseEmail(raw) {
    if (typeof raw !== "string") return null;
    var s = raw.trim().toLowerCase();
    if (s.length > 254 || /\s/.test(s)) return null;
    var at = s.lastIndexOf("@");
    if (at <= 0 || s.indexOf("@") !== at) return null;          // exactamente una @
    var local = s.slice(0, at), domain = s.slice(at + 1);
    if (local.length > 64 || !/^[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+$/.test(local) || /^\.|\.$|\.\./.test(local)) return null;
    if (domain.endsWith(".")) return null;
    var labels = domain.split(".");
    if (labels.length < 2 || !labels.every(function (l) { return LABEL.test(l); })) return null;
    return { local: local, domain: domain };
  }

  /* Reglas: [{ id, name, enabled, domains: ["upv.es"], subdomainsOf: [] }]
     - domains: el dominio del correo debe ser EXACTAMENTE uno de estos.
     - subdomainsOf: SOLO si se aprueba explícitamente; permite x.<dominio> (con punto delante), nunca <algo><dominio>. */
  function matchInstitution(domain, rules) {
    if (!domain) return null;
    for (var i = 0; i < rules.length; i++) {
      var r = rules[i];
      if (!r.enabled) continue;
      if ((r.domains || []).indexOf(domain) >= 0) return r;
      var subs = r.subdomainsOf || [];
      for (var k = 0; k < subs.length; k++) {
        var base = subs[k];
        if (domain.length > base.length + 1 && domain.slice(-(base.length + 1)) === "." + base) return r;
      }
    }
    return null;
  }

  /* Comprueba correo + universidad elegida (deben coincidir). No envía nada. */
  function checkEmail(raw, uniId, rules) {
    var p = parseEmail(raw);
    if (!p) return { ok: false, reason: "invalid" };
    var inst = matchInstitution(p.domain, rules);
    if (!inst) {
      var disabled = rules.some(function (r) { return !r.enabled && (r.domains || []).indexOf(p.domain) >= 0; });
      return { ok: false, reason: disabled ? "domain_pending" : "domain_not_allowed" };
    }
    if (uniId && uniId !== inst.id) return { ok: false, reason: "uni_mismatch", institution: inst.id };
    return { ok: true, institution: inst.id };
  }

  /* ---------- Acceso de DEMOSTRACIÓN (maqueta) ----------
     No hay verificación real: no se envían correos, no se crean cuentas, no hay servidor.
     Solo guarda en memoria la institución (nunca el correo ni el nombre) y si la persona pulsó
     «Continuar con la demostración». Al recargar la página se pierde todo.
     authenticated() es SIEMPRE false: la demo nunca equivale a una verificación auténtica. */
  function createDemoAccess() {
    var pendingInst = null, demo = null;
    return {
      // Paso 1: correo ya validado por checkEmail → pantalla «Verifica tu correo». No se conserva el correo.
      startVerification: function (institution) { pendingInst = String(institution || ""); demo = null; return { stage: "verify", institution: pendingInst }; },
      // Paso 2: solo posible tras el paso 1
      continueDemo: function () { if (!pendingInst) return false; demo = { mode: "demo", institution: pendingInst }; pendingInst = null; return true; },
      cancel: function () { pendingInst = null; },
      awaitingVerification: function () { return !!pendingInst; },
      canSeeMembers: function () { return !!demo; },        // perfiles FICTICIOS en modo demo
      authenticated: function () { return false; },          // nunca hay verificación auténtica en la maqueta
      state: function () { return demo ? { mode: "demo", institution: demo.institution, verified: false } : null; },
      logout: function () { demo = null; pendingInst = null; }
    };
  }

  root.FFAuth = { parseEmail: parseEmail, matchInstitution: matchInstitution, checkEmail: checkEmail, createDemoAccess: createDemoAccess };
})(typeof window !== "undefined" ? window : module.exports);
