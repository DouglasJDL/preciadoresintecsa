import { MIGRATION } from "../config/config.js";
import { $, Dom } from "./dom.js";

// Aviso de fin de soporte + migración al nuevo preciador (Odoo).
// Se muestra una vez por sesión del navegador; después queda la píldora
// recordatorio abajo a la izquierda para volver a abrirlo.

function openDocs() {
  window.open(MIGRATION.docsUrl, "_blank", "noopener,noreferrer");
}

function openWhatsapp() {
  const url = `https://wa.me/${MIGRATION.whatsapp}?text=${encodeURIComponent(MIGRATION.helpText)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

function showStep(id) {
  ["depStep1", "depStepYes", "depStepNo"].forEach(s => {
    const el = $(s);
    if (el) el.hidden = (s !== id);
  });
}

function alreadySeen() {
  try { return sessionStorage.getItem(MIGRATION.sessionKey) === "1"; }
  catch { return false; }
}

function markSeen() {
  try { sessionStorage.setItem(MIGRATION.sessionKey, "1"); }
  catch { /* sessionStorage bloqueado: se mostrará de nuevo, no es crítico */ }
}

export function openDeprecationNotice() {
  const overlay = $("depOverlay");
  if (!overlay) return;
  showStep("depStep1");
  overlay.classList.add("open");
  overlay.setAttribute("aria-hidden", "false");
  requestAnimationFrame(() => $("depDocs")?.focus());
}

function closeDeprecationNotice(onDismiss) {
  const overlay = $("depOverlay");
  if (overlay) {
    overlay.classList.remove("open");
    overlay.setAttribute("aria-hidden", "true");
  }
  markSeen();
  const pill = $("depPill");
  if (pill) pill.hidden = false;
  if (typeof onDismiss === "function") onDismiss();
}

/**
 * Wirea el aviso y lo muestra si corresponde.
 * @param {{onDismiss?: () => void}} opts - onDismiss se llama al cerrar el aviso.
 * @returns {boolean} true si el aviso quedó abierto (bloqueando la pantalla).
 */
export function initDeprecationNotice({ onDismiss } = {}) {
  if (!MIGRATION.enabled) return false;

  const overlay = $("depOverlay");
  if (!overlay) return false;

  const close = () => closeDeprecationNotice(onDismiss);

  // Documentación (los tres puntos donde se ofrece)
  ["depDocs", "depDocsYes", "depDocsNo"].forEach(id => Dom.on($(id), "click", openDocs));

  // Paso 1 → respuesta
  Dom.on($("depYes"), "click", () => showStep("depStepYes"));
  Dom.on($("depNo"), "click", () => showStep("depStepNo"));

  // Paso 2 → salidas. La única forma de entrar al editor viejo es aceptando
  // explícitamente que va sin soporte; no hay un "cerrar" neutro.
  Dom.on($("depUseOldYes"), "click", close);
  Dom.on($("depUseOld"), "click", close);
  Dom.on($("depHelp"), "click", () => { openWhatsapp(); close(); });

  // Recordatorio permanente
  Dom.on($("depPill"), "click", openDeprecationNotice);

  if (alreadySeen()) {
    const pill = $("depPill");
    if (pill) pill.hidden = false;
    return false;
  }

  openDeprecationNotice();
  return true;
}
