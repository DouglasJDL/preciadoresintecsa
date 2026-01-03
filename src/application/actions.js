import { COLOR_HUES } from "../config/config.js";
import { emptyProduct } from "../domain/product.js";
import { formatDateTimeNow } from "../infrastructure/svgRenderer.js";
import { requestSave, clearState } from "../infrastructure/storage.js";
import { UI } from "../presentation/ui.js";
import { renderList } from "../presentation/list.js";
import { scheduleRebuild } from "../presentation/preview.js";
import { validateDraft, fillFormFromProduct } from "../presentation/form.js";
import { hideContextMenu } from "../presentation/contextMenu.js";
import { applySelectionHighlight } from "../presentation/selection.js";

/* ===== Colores ===== */

export function allocateColorIdx(products) {
  const used = new Set(products.map(p => p.colorIdx).filter(n => Number.isFinite(n)));
  let idx = 0;
  while (used.has(idx)) idx++;
  return idx;
}

export function colorFromIdx(idx) {
  const base = idx % COLOR_HUES.length;
  const variant = Math.floor(idx / COLOR_HUES.length);
  const hue = (COLOR_HUES[base] + (variant * 7)) % 360;

  const satArr = [82, 78, 86, 80];
  const litArr = [46, 56, 38, 50];
  const sat = satArr[variant % satArr.length];
  const lit = litArr[variant % litArr.length];

  return `hsl(${hue} ${sat}% ${lit}%)`;
}

export function glowFromIdx(idx, strong = false) {
  const base = idx % COLOR_HUES.length;
  const variant = Math.floor(idx / COLOR_HUES.length);
  const hue = (COLOR_HUES[base] + (variant * 7)) % 360;
  const a = strong ? 0.22 : 0.14;
  return `hsla(${hue} 85% 45% / ${a})`;
}

/* ===== Acciones de negocio (sin cambiar comportamiento) ===== */

export function openAddForm() {
  const st = window.__APP_STATE__;

  UI.clearHoverState();
  st.presentation.scheduleHoverClear();

  st.expandedId = null;
  st.selectedProductId = null;
  hideContextMenu();

  st.editingId = null;
  st.formMode = "add";
  st.draft = emptyProduct();
  st.draft.impresionAt = formatDateTimeNow();

  UI.setFormTitles({ formMode: st.formMode });

  document.getElementById("fTemplate").value = "";
  document.getElementById("fSize").value = "";
  document.getElementById("fNombre").value = "";
  document.getElementById("fAntes").value = "";
  document.getElementById("fAhora").value = "";
  document.getElementById("fCuota").value = "";
  document.getElementById("fQty").value = "1";
  document.getElementById("fUseVig").checked = false;
  document.getElementById("fVigStart").value = "";
  document.getElementById("fVigEnd").value = "";
  document.getElementById("vigDates").style.display = "none";

  document.getElementById("btnSave").disabled = true;

  UI.setView("form");
  st.pendingFocus = { id: "__draft__", scroll: true };
  scheduleRebuild();
  requestSave();
}

export function backToList() {
  const st = window.__APP_STATE__;
  st.editingId = null;
  st.formMode = "add";
  st.draft = emptyProduct();
  UI.setView("list");
  requestSave();
}

export function onEditProduct(id) {
  const st = window.__APP_STATE__;
  const p = st.products.find(x => x.id === id);
  if (!p) return;

  UI.clearHoverState();
  st.presentation.scheduleHoverClear();

  st.expandedId = null;
  hideContextMenu();

  st.editingId = id;
  st.formMode = "edit";
  st.draft = { ...p, impresionAt: formatDateTimeNow() };

  UI.setFormTitles({ formMode: st.formMode });
  fillFormFromProduct(st.draft);

  UI.setView("form");
  st.pendingFocus = { id, scroll: true };
  scheduleRebuild();
  requestSave();
}

export function onDeleteProduct(id) {
  const st = window.__APP_STATE__;
  const p = st.products.find(x => x.id === id);
  if (!p) return;

  hideContextMenu();
  if (!confirm(`¿Eliminar "${p.nombre}"?`)) return;

  if (st.expandedId === id) st.expandedId = null;
  if (st.selectedProductId === id) st.selectedProductId = null;

  st.products = st.products.filter(x => x.id !== id);

  UI.updateTopButtonsVisibility();
  renderList();
  scheduleRebuild();
  requestSave();
}

export function saveDraft() {
  const st = window.__APP_STATE__;
  if (!validateDraft()) return;

  const nowText = formatDateTimeNow();
  let savedId = null;

  if (st.formMode === "add") {
    const p = { ...st.draft };
    p.id = st.domain.uid();
    p.impresionAt = nowText;
    p.colorIdx = allocateColorIdx(st.products);
    st.products.push(p);
    savedId = p.id;
  } else {
    const idx = st.products.findIndex(x => x.id === st.editingId);
    if (idx >= 0) {
      const prev = st.products[idx];
      const p = { ...st.draft };
      p.id = st.editingId;
      p.impresionAt = nowText;
      p.colorIdx = Number.isFinite(prev.colorIdx) ? prev.colorIdx : allocateColorIdx(st.products);
      st.products[idx] = p;
      savedId = p.id;
    }
  }

  st.selectedProductId = savedId;
  st.expandedId = savedId;

  UI.updateTopButtonsVisibility();
  renderList();
  backToList();
  scheduleRebuild();

  requestAnimationFrame(() => applySelectionHighlight());
  requestSave();
}

export function resetAll() {
  const st = window.__APP_STATE__;
  if (st.products.length === 0) return;
  if (!confirm("¿Eliminar TODOS los productos guardados?")) return;

  hideContextMenu();

  st.products = [];
  st.expandedId = null;
  st.selectedProductId = null;

  UI.updateTopButtonsVisibility();
  renderList();

  st.caches.templateTextCache.clear();
  st.caches.renderCache.clear();
  st.caches.imgDimCache.clear();
  st.previewSlotsByProduct.clear();

  UI.showEmptyPreview("Sin previsualización", "Agrega productos para ver cómo se acomodan en las hojas.");
  clearState();
}

export function uid() {
  return "p_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
}
