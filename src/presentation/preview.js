import { CONFIG, SIZE } from "../config/config.js";
const PREVIEW_PX = CONFIG.limits.renderPreviewPx;
import { $, Dom } from "./dom.js";
import { UI } from "./ui.js";
import { applySelectionHighlight, pairColor, pairGlow } from "./selection.js";
import { renderProductToPngs, getCachedRender } from "../infrastructure/svgRenderer.js";
import { packAll } from "../domain/packing.js";

let _lazyObserver = null;
const EAGER_PAGES = 4;

const ZOOM_MIN = 0.3;
const ZOOM_MAX = 3.0;
const ZOOM_STEP = 0.15;
let _zoom = CONFIG.previewScale;

function applyZoom(scale) {
  _zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(scale * 100) / 100));
  document.querySelectorAll(".page-shell").forEach(el => {
    el.style.setProperty("--previewScale", _zoom);
  });
  const label = document.getElementById("zoomLabel");
  if (label) label.textContent = Math.round(_zoom * 100) + "%";
  const btnIn  = document.getElementById("btnZoomIn");
  const btnOut = document.getElementById("btnZoomOut");
  if (btnIn)  btnIn.disabled  = _zoom >= ZOOM_MAX;
  if (btnOut) btnOut.disabled = _zoom <= ZOOM_MIN;
}

export function zoomIn()    { applyZoom(_zoom + ZOOM_STEP); }
export function zoomOut()   { applyZoom(_zoom - ZOOM_STEP); }
export function zoomReset() { applyZoom(CONFIG.previewScale); }

export function clearHighlight() {
  Dom.qsa(".slot.hl").forEach(el => {
    el.classList.remove("hl");
    const tag = Dom.qs(".hlTag", el);
    if (tag) tag.remove();
  });

  Dom.qsa(".page-shell.hlpage").forEach(el => {
    el.classList.remove("hlpage");
    el.style.removeProperty("--pairColor");
    el.style.removeProperty("--pairGlowStrong");
  });
}

export function highlightProduct(productId, { scroll = false, showTag = true } = {}) {
  const st = window.__APP_STATE__;
  if (!productId) return;

  clearHighlight();

  const slots = st.previewSlotsByProduct.get(productId) || [];
  if (!slots.length) return;

  const c = pairColor(productId);
  const g = pairGlow(productId, true);

  slots.forEach((slot, idx) => {
    slot.classList.add("hl");
    slot.style.setProperty("--pairColor", c);
    slot.style.setProperty("--pairGlowStrong", g);

    if (showTag && idx === 0) {
      const tag = document.createElement("div");
      tag.className = "hlTag";
      tag.textContent = "AQUÍ";
      slot.appendChild(tag);
    }

    const shell = slot.closest(".page-shell");
    if (shell) {
      shell.classList.add("hlpage");
      shell.style.setProperty("--pairColor", c);
      shell.style.setProperty("--pairGlowStrong", g);
    }
  });

  if (!scroll) return;
  const shell = slots[0].closest(".page-shell");
  if (shell) UI.scrollToChild($("paperPreviewWrap"), shell, 24);
}

function buildDraftSnapshot() {
  const st = window.__APP_STATE__;
  const now = st.time.formatDateTimeNow();

  if (st.editingId) {
    const existing = st.products.find(p => p.id === st.editingId);
    return {
      ...st.draft,
      id: st.editingId,
      impresionAt: st.draft.impresionAt || now,
      qty: (Number.isFinite(st.draft.qty) && st.draft.qty > 0) ? st.draft.qty : 0,
      colorIdx: Number.isFinite(existing?.colorIdx) ? existing.colorIdx : 0
    };
  }

  if (st.draft.template && st.draft.size) {
    return {
      ...st.draft,
      id: "__draft__",
      impresionAt: st.draft.impresionAt || now,
      qty: (Number.isFinite(st.draft.qty) && st.draft.qty > 0) ? st.draft.qty : 1,
      colorIdx: 0
    };
  }

  return null;
}

function buildItemsForPacking(includeDraft) {
  const st = window.__APP_STATE__;
  const list = [];

  // En modo formulario: mostrar solo la etiqueta que se está trabajando
  if (includeDraft) {
    const draft = buildDraftSnapshot();
    if (draft) {
      for (let i = 0; i < (draft.qty || 1); i++) {
        list.push({ product: draft, isDraft: true, instanceIndex: i });
      }
    }
    return list;
  }

  // En modo lista: mostrar todos los productos no excluidos
  for (const p of st.products) {
    if (p.excluded) continue;
    for (let i = 0; i < (p.qty || 0); i++) {
      list.push({ product: p, isDraft: false, instanceIndex: i });
    }
  }

  return list;
}

function ensureDraftVisible() {
  const wrap = $("paperPreviewWrap");
  const slot = Dom.qs(".slot.draft");
  if (!wrap || !slot) return;

  const shell = slot.closest(".page-shell");
  if (!shell) return;

  if (!UI.isElementInView(wrap, shell, 18)) UI.scrollToChild(wrap, shell, 24);
}

export function scheduleRebuild() {
  const st = window.__APP_STATE__;
  clearTimeout(st.timers.preview);
  st.timers.preview = setTimeout(() => buildPreview().catch(console.error), CONFIG.limits.previewDebounceMs);
}

async function hydratePngs(items, gen) {
  const st = window.__APP_STATE__;

  // Sync pass: serve from cache without async overhead
  for (const it of items) {
    if (!it.product.template || !it.product.size) continue;
    const cached = getCachedRender(it.product, PREVIEW_PX);
    if (cached) {
      it._png = (it.product.size === SIZE.halfH) ? cached.pngRotated : cached.pngNormal;
    }
  }

  // Async pass: sequential render only for uncached items
  for (const it of items) {
    if (st.renderGeneration !== gen) return;
    if (!it.product.template || !it.product.size || it._png) continue;
    const r = await renderProductToPngs(it.product, PREVIEW_PX);
    if (st.renderGeneration !== gen) return;
    it._png = (it.product.size === SIZE.halfH) ? r.pngRotated : r.pngNormal;
  }
}

function registerSlotByProduct(slot, pid) {
  const st = window.__APP_STATE__;
  if (!st.previewSlotsByProduct.has(pid)) st.previewSlotsByProduct.set(pid, []);
  st.previewSlotsByProduct.get(pid).push(slot);
}

function buildSlot(it, pl) {
  const st = window.__APP_STATE__;
  if (!it._png) return null;

  const slot = document.createElement("div");
  slot.className = "slot" + (it.isDraft ? " draft" : "");
  slot.style.gridRow = `${pl.row} / span ${pl.rs}`;
  slot.style.gridColumn = `${pl.col} / span ${pl.cs}`;
  slot.dataset.productId = it.product.id || "";

  const pid = it.product.id || "";
  if (pid && pid !== "__draft__") {
    const c = pairColor(pid);
    const gs = pairGlow(pid, true);
    slot.style.setProperty("--pairColor", c);
    slot.style.setProperty("--pairGlowStrong", gs);

    const mark = document.createElement("div");
    mark.className = "pairMark";
    slot.appendChild(mark);

    registerSlotByProduct(slot, pid);
  }

  const img = document.createElement("img");
  img.src = it._png;
  img.alt = "Etiqueta";
  slot.appendChild(img);

  if (it.isDraft) {
    const tag = document.createElement("div");
    tag.className = "draftTag";
    tag.textContent = (st.formMode === "edit") ? "EDITANDO" : "AGREGANDO";
    slot.appendChild(tag);
  }

  return slot;
}

function buildPageShell(pageIndex, totalPages) {
  const shell = document.createElement("div");
  shell.className = "page-shell";
  shell.style.setProperty("--previewScale", _zoom);

  const pageLabel = document.createElement("div");
  pageLabel.className = "pageLabel";
  pageLabel.textContent = `Hoja ${pageIndex + 1} de ${totalPages}`;
  shell.appendChild(pageLabel);

  const inner = document.createElement("div");
  inner.className = "page-inner";
  shell.appendChild(inner);

  return shell;
}

function fillShellSlots(shell, page) {
  const inner = shell.querySelector(".page-inner");
  if (!inner) return;

  const paper = document.createElement("div");
  paper.className = "paper-page " + (page.type === "full" ? "paper-full" : "paper-universal");

  for (const pl of page.placements) {
    const slot = buildSlot(pl.item, pl);
    if (slot) paper.appendChild(slot);
  }

  inner.appendChild(paper);
}

export async function buildPreview() {
  const st = window.__APP_STATE__;

  // Incrementar generación — cualquier render anterior en curso queda obsoleto
  st.renderGeneration = (st.renderGeneration || 0) + 1;
  const myGen = st.renderGeneration;

  const includeDraft = !UI.isListView();
  const items = buildItemsForPacking(includeDraft);

  if (items.length === 0) {
    UI.showEmptyPreview("Sin previsualización", "Agrega productos para ver cómo se acomodan en las hojas.");
    st.previewSlotsByProduct.clear();
    return;
  }

  await hydratePngs(items, myGen);
  if (st.renderGeneration !== myGen) return;

  const pages = packAll(items);
  const preview = $("paperPreview");
  preview.innerHTML = "";
  st.previewSlotsByProduct = new Map();

  // Disconnect old lazy observer before creating new one
  if (_lazyObserver) {
    _lazyObserver.disconnect();
    _lazyObserver = null;
  }

  // Create lazy observer for off-screen pages
  const needsObserver = pages.length > EAGER_PAGES && typeof IntersectionObserver !== "undefined";
  if (needsObserver) {
    _lazyObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting || entry.target._pageFilled) return;
        entry.target._pageFilled = true;
        _lazyObserver.unobserve(entry.target);
        fillShellSlots(entry.target, entry.target._pageData);
        applySelectionHighlight();
      });
    }, { rootMargin: "400px 0px" });
  }

  pages.forEach((page, pageIndex) => {
    const shell = buildPageShell(pageIndex, pages.length);

    if (pageIndex < EAGER_PAGES || !_lazyObserver) {
      shell._pageFilled = true;
      fillShellSlots(shell, page);
    } else {
      shell._pageData = page;
      _lazyObserver.observe(shell);
    }

    preview.appendChild(shell);
  });

  if (st.pendingFocus?.id) {
    const { id, scroll } = st.pendingFocus;
    st.pendingFocus = null;

    if (id === "__draft__") ensureDraftVisible();
    else highlightProduct(id, { scroll: !!scroll, showTag: false });
  }

  if (includeDraft) ensureDraftVisible();
  else applySelectionHighlight();
}
