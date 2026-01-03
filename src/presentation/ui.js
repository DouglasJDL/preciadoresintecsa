import { CONFIG } from "../config/config.js";
import { $, Dom, escapeHtml } from "./dom.js";
import { requestSave } from "../infrastructure/storage.js";
import { scheduleRebuild, clearHighlight } from "./preview.js";
import { renderList } from "./list.js";
import { hideContextMenu } from "./contextMenu.js";
import { syncDraftFromForm } from "./form.js";

export const UI = {
  isListView() {
    return $("listView").style.display !== "none";
  },

  setView(view, { skipPreview = false } = {}) {
    if (view === "list") {
      $("listView").style.display = "flex";
      $("formView").style.display = "none";
      UI.updateTopButtonsVisibility();
      renderList();
    } else {
      UI.clearHoverState();
      $("listView").style.display = "none";
      $("formView").style.display = "flex";
      $("btnPrint").style.display = "none";
      $("btnPdf").style.display = "none";
      $("btnResetAll").style.display = "none";
      hideContextMenu();
    }

    if (!skipPreview) scheduleRebuild();
    requestSave();
  },

  setFormTitles({ formMode }) {
    $("formTitle").textContent = (formMode === "edit") ? "Editar producto" : "Agregar producto";
    $("formSubtitle").textContent = (formMode === "edit")
      ? "Al guardar, se actualiza la fecha y hora de impresión"
      : "Completa todo para guardar";
  },

  updateTopButtonsVisibility() {
    const has = window.__APP_STATE__.products.length > 0;
    $("btnPrint").style.display = has ? "inline-flex" : "none";
    $("btnPdf").style.display = has ? "inline-flex" : "none";
    $("btnResetAll").style.display = has ? "inline-flex" : "none";
  },

  showEmptyPreview(title, body) {
    $("paperPreview").innerHTML = `
      <div class="emptyPreview">
        <h4>${escapeHtml(title)}</h4>
        <p>${escapeHtml(body)}</p>
      </div>
    `;
  },

  scrollToChild(container, child, pad = 16) {
    if (!container || !child) return;
    const c = container.getBoundingClientRect();
    const r = child.getBoundingClientRect();
    const target = container.scrollTop + (r.top - c.top) - pad;
    container.scrollTo({ top: target, behavior: "smooth" });
  },

  isElementInView(container, el, margin = 10) {
    if (!container || !el) return false;
    const c = container.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return (r.top >= c.top + margin) && (r.bottom <= c.bottom - margin);
  },

  clearHoverState() {
    const st = window.__APP_STATE__;
    clearTimeout(st.timers.hoverIn);
    clearTimeout(st.timers.hoverOut);
    st.hoverPid = null;

    if (st.activeItemEl) st.activeItemEl.classList.remove("activeHover");
    st.activeItemEl = null;

    clearHighlight();
  }
};

export function wireBeforeUnloadGuard(hasWorkFn) {
  window.addEventListener("beforeunload", (e) => {
    if (!hasWorkFn()) return;
    e.preventDefault();
    e.returnValue = "";
  });
}

export function requestSafeSyncDraftIfNeeded() {
  if (!UI.isListView()) syncDraftFromForm();
}

export function wireGlobalCloseContextMenu() {
  Dom.on(document, "click", (e) => {
    const menu = $("ctxMenu");
    if (menu.style.display === "none") return;
    if (menu.contains(e.target)) return;
    hideContextMenu();
  });
  Dom.on(document, "keydown", (e) => { if (e.key === "Escape") hideContextMenu(); });
  window.addEventListener("scroll", () => hideContextMenu(), true);
}
