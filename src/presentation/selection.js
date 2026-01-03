import { Dom, cssEsc } from "./dom.js";
import { colorFromIdx, glowFromIdx } from "../application/actions.js";
import { highlightProduct, clearHighlight } from "./preview.js";
import { findListItem } from "./list.js";
import { UI } from "./ui.js";

export function setActiveListItem(el) {
  const st = window.__APP_STATE__;
  if (st.activeItemEl && st.activeItemEl !== el) st.activeItemEl.classList.remove("activeHover");
  st.activeItemEl = el || null;
  if (st.activeItemEl) st.activeItemEl.classList.add("activeHover");
}

export function markSelectedInList() {
  const st = window.__APP_STATE__;
  Dom.qsa(".item.selected").forEach(el => el.classList.remove("selected"));
  if (!st.selectedProductId) return;
  const item = Dom.qs(`.item[data-id="${cssEsc(st.selectedProductId)}"]`);
  if (item) item.classList.add("selected");
}

function getProductById(pid) {
  const st = window.__APP_STATE__;
  return st.products.find(p => p.id === pid) || null;
}

export function pairColor(pid) {
  const p = getProductById(pid);
  const idx = Number.isFinite(p?.colorIdx) ? p.colorIdx : 0;
  return colorFromIdx(idx);
}

export function pairGlow(pid, strong = false) {
  const p = getProductById(pid);
  const idx = Number.isFinite(p?.colorIdx) ? p.colorIdx : 0;
  return glowFromIdx(idx, strong);
}

export function highlightProductInList(productId, scroll = false) {
  const item = findListItem(productId);
  if (!item) return;

  setActiveListItem(item);

  if (!scroll) return;
  const container = document.getElementById("listScrollArea");
  if (container) UI.scrollToChild(container, item, 24);
  else item.scrollIntoView({ behavior: "smooth", block: "center" });
}

export function applySelectionHighlight() {
  const st = window.__APP_STATE__;
  if (!st.selectedProductId) {
    clearHighlight();
    setActiveListItem(null);
    markSelectedInList();
    return;
  }
  highlightProduct(st.selectedProductId, { scroll: false, showTag: true });
  highlightProductInList(st.selectedProductId, false);
  markSelectedInList();
}

export function scheduleHover(pid) {
  const st = window.__APP_STATE__;
  if (!pid) return;

  clearTimeout(st.timers.hoverIn);
  clearTimeout(st.timers.hoverOut);
  st.hoverPid = pid;

  st.timers.hoverIn = setTimeout(() => {
    if (st.hoverPid !== pid) return;
    highlightProduct(pid, { scroll: false, showTag: true });
    highlightProductInList(pid, false);
  }, st.config.limits.hoverInMs);
}

export function scheduleHoverClear() {
  const st = window.__APP_STATE__;
  clearTimeout(st.timers.hoverIn);
  clearTimeout(st.timers.hoverOut);

  st.timers.hoverOut = setTimeout(() => {
    st.hoverPid = null;
    applySelectionHighlight();
  }, st.config.limits.hoverOutMs);
}
