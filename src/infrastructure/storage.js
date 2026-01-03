import { CONFIG } from "../config/config.js";
import { sanitizeLoadedProduct } from "../domain/product.js";
import { formatDateTimeNow } from "./svgRenderer.js";
import { UI } from "../presentation/ui.js";
import { syncDraftFromForm, fillFormFromProduct } from "../presentation/form.js";


function safeParseJson(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}

export function requestSave() {
  const st = window.__APP_STATE__;
  clearTimeout(st.timers.save);
  st.timers.save = setTimeout(saveState, CONFIG.limits.saveDebounceMs);
}

function saveState() {
  const st = window.__APP_STATE__;
  try {
    if (!UI.isListView()) syncDraftFromForm();

    const payload = {
      products: st.products,
      selectedProductId: st.selectedProductId,
      expandedId: st.expandedId,
      view: UI.isListView() ? "list" : "form",
      formMode: st.formMode,
      editingId: st.editingId,
      draft: st.draft
    };

    const raw = JSON.stringify(payload);
    if (raw.length > 2_000_000) return;

    localStorage.setItem(CONFIG.storageKey, raw);
  } catch (e) {
    console.warn("No se pudo guardar estado:", e);
  }
}

export function clearState() {
  try { localStorage.removeItem(CONFIG.storageKey); } catch {}
}

export function hasWork() {
  const st = window.__APP_STATE__;
  if (st.products.length > 0) return true;

  if (!UI.isListView()) {
    syncDraftFromForm();
    const d = st.draft;
    return !!(d.template || d.size || d.nombre || d.antes || d.ahora || d.cuota || d.useVig || (d.qty && d.qty > 1));
  }

  return false;
}

export function loadState() {
  const st = window.__APP_STATE__;
  const raw = localStorage.getItem(CONFIG.storageKey);
  if (!raw) return false;

  const data = safeParseJson(raw);
  if (!data) return false;

  const productsRaw = Array.isArray(data.products) ? data.products : [];
  st.products = productsRaw.map(sanitizeLoadedProduct);

  st.selectedProductId = typeof data.selectedProductId === "string" ? data.selectedProductId : null;
  st.expandedId = typeof data.expandedId === "string" ? data.expandedId : null;

  st.formMode = (data.formMode === "edit") ? "edit" : "add";
  st.editingId = typeof data.editingId === "string" ? data.editingId : null;

  st.draft = data.draft ? sanitizeLoadedProduct(data.draft) : st.domain.emptyProduct();
  st.draft.impresionAt = st.draft.impresionAt || formatDateTimeNow();

  const view = (data.view === "form") ? "form" : "list";
  UI.setView(view, { skipPreview: true });

  if (view === "form") {
    UI.setFormTitles({ formMode: st.formMode });
    fillFormFromProduct(st.draft);

    st.pendingFocus = { id: st.editingId ? st.editingId : "__draft__", scroll: true };
  }

  return true;
}

export function normalizeExistingState() {
  const st = window.__APP_STATE__;
  let changed = false;

  for (const p of st.products) {
    if (!Number.isFinite(p.colorIdx)) {
      p.colorIdx = st.domain.allocateColorIdx(st.products);
      changed = true;
    }
    if (!p.impresionAt) {
      p.impresionAt = formatDateTimeNow();
      changed = true;
    }
  }

  if (changed) requestSave();
}
