import { CONFIG, SIZE } from "../config/config.js";
import { $, Dom } from "./dom.js";
import { UI } from "./ui.js";
import { applySelectionHighlight, pairColor, pairGlow } from "./selection.js";
import { renderProductToPngs } from "../infrastructure/svgRenderer.js";
import { packAll } from "../domain/packing.js";

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

  const draft = includeDraft ? buildDraftSnapshot() : null;

  for (const p of st.products) {
    const source = (includeDraft && st.editingId && p.id === st.editingId) ? draft : p;
    if (!source) continue;

    for (let i = 0; i < (source.qty || 0); i++) {
      list.push({ product: source, isDraft: false, instanceIndex: i });
    }
  }

  if (includeDraft && !st.editingId && draft && draft.id === "__draft__") {
    for (let i = 0; i < (draft.qty || 1); i++) {
      list.push({ product: draft, isDraft: true, instanceIndex: i });
    }
  }

  if (includeDraft && st.editingId && draft) {
    for (const it of list) {
      if (it.product.id === st.editingId) it.isDraft = true;
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

async function hydratePngs(items) {
  for (const it of items) {
    if (!it.product.template || !it.product.size) continue;
    const r = await renderProductToPngs(it.product);
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

function buildPageDom(page, pageIndex) {
  const shell = document.createElement("div");
  shell.className = "page-shell";
  shell.style.setProperty("--previewScale", CONFIG.previewScale);

  const pageLabel = document.createElement("div");
  pageLabel.className = "pageLabel";
  pageLabel.textContent = `HOJA ${pageIndex + 1}`;
  shell.appendChild(pageLabel);

  const inner = document.createElement("div");
  inner.className = "page-inner";

  const paper = document.createElement("div");
  paper.className = "paper-page " + (page.type === "full" ? "paper-full" : "paper-grid");

  for (const pl of page.placements) {
    const slot = buildSlot(pl.item, pl);
    if (slot) paper.appendChild(slot);
  }

  inner.appendChild(paper);
  shell.appendChild(inner);
  return shell;
}

export async function buildPreview() {
  const st = window.__APP_STATE__;
  const includeDraft = !UI.isListView();
  const items = buildItemsForPacking(includeDraft);

  if (items.length === 0) {
    UI.showEmptyPreview("Sin previsualización", "Agrega productos para ver cómo se acomodan en las hojas.");
    st.previewSlotsByProduct.clear();
    return;
  }

  await hydratePngs(items);

  const pages = packAll(items);
  const preview = $("paperPreview");
  preview.innerHTML = "";
  st.previewSlotsByProduct = new Map();

  pages.forEach((page, pageIndex) => preview.appendChild(buildPageDom(page, pageIndex)));

  if (st.pendingFocus?.id) {
    const { id, scroll } = st.pendingFocus;
    st.pendingFocus = null;

    if (id === "__draft__") ensureDraftVisible();
    else highlightProduct(id, { scroll: !!scroll, showTag: false });
  }

  if (includeDraft) ensureDraftVisible();
  else applySelectionHighlight();
}
