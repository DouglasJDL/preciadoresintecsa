import { CONFIG, SIZE } from "../config/config.js";
import { renderProductToPngs, createCappedCache } from "./svgRenderer.js";
const PRINT_PX = CONFIG.limits.renderPrintPx;
import { packAll } from "../domain/packing.js";

function setIconLoading(btn, loading) {
  if (!btn) return;
  if (loading) {
    if (!btn.dataset.orig) btn.dataset.orig = btn.innerHTML;
    btn.innerHTML = `<span class="spin" aria-hidden="true"></span>`;
    btn.disabled = true;
    return;
  }
  if (btn.dataset.orig) btn.innerHTML = btn.dataset.orig;
  btn.disabled = false;
}

function buildItemsForPackingNoDraft() {
  const st = window.__APP_STATE__;
  const list = [];

  for (const p of st.products) {
    for (let i = 0; i < (p.qty || 0); i++) {
      list.push({ product: p, isDraft: false, instanceIndex: i });
    }
  }
  return list;
}

async function getImgDim(dataUrl) {
  const st = window.__APP_STATE__;
  const cached = st.caches.imgDimCache.get(dataUrl);
  if (cached) return cached;

  const p = new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || img.width, h: img.naturalHeight || img.height });
    img.onerror = reject;
    img.src = dataUrl;
  });

  st.caches.imgDimCache.set(dataUrl, p);
  return p;
}

function boxForPlacement(pageType, row, col, rs, cs) {
  const { letterWmm, letterHmm, padGridMm, gapGridMm, padFullMm } = CONFIG.paper;

  if (pageType === "full") {
    const pad = padFullMm;
    return { x: pad, y: pad, w: letterWmm - (pad * 2), h: letterHmm - (pad * 2) };
  }

  const pad = padGridMm;
  const gap = gapGridMm;

  const availW = letterWmm - (pad * 2);
  const availH = letterHmm - (pad * 2);

  const cols = 2, rows = 2;
  const cellW = (availW - gap) / cols;
  const cellH = (availH - gap) / rows;

  const x = pad + (col - 1) * (cellW + gap);
  const y = pad + (row - 1) * (cellH + gap);

  const w = cellW * cs + gap * (cs - 1);
  const h = cellH * rs + gap * (rs - 1);

  return { x, y, w, h };
}

async function buildPdfDoc() {
  const st = window.__APP_STATE__;
  if (st.products.length === 0) return null;

  if (!window.jspdf?.jsPDF) {
    alert("No se pudo cargar jsPDF. Revisa tu conexión o el script CDN.");
    return null;
  }

  const { jsPDF } = window.jspdf;

  const items = buildItemsForPackingNoDraft();
  for (const it of items) {
    const r = await renderProductToPngs(it.product, PRINT_PX);
    it._png = (it.product.size === SIZE.halfH) ? r.pngRotated : r.pngNormal;
  }

  const pages = packAll(items);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });

  for (let pi = 0; pi < pages.length; pi++) {
    if (pi > 0) doc.addPage("letter", "portrait");

    const page = pages[pi];
    const pageType = (page.type === "full") ? "full" : "grid";

    for (const pl of page.placements) {
      const it = pl.item;
      if (!it._png) continue;

      const box = boxForPlacement(pageType, pl.row, pl.col, pl.rs, pl.cs);
      const dim = await getImgDim(it._png);

      const scale = Math.min(box.w / dim.w, box.h / dim.h);
      const drawW = dim.w * scale;
      const drawH = dim.h * scale;

      const dx = box.x + (box.w - drawW) / 2;
      const dy = box.y + (box.h - drawH) / 2;

      doc.addImage(it._png, "PNG", dx, dy, drawW, drawH);
    }
  }

  return doc;
}

export async function exportPdfWithLoading() {
  const st = window.__APP_STATE__;
  if (st.exporting) return;
  st.exporting = true;

  const btn = document.getElementById("btnPdf");
  setIconLoading(btn, true);

  try {
    await new Promise(r => setTimeout(r, 60));
    const doc = await buildPdfDoc();
    if (doc) doc.save("etiquetas.pdf");
  } catch (e) {
    console.error(e);
    alert("No se pudo exportar a PDF. Revisa la consola para más detalle.");
  } finally {
    st.caches.renderCache.clear();
    setIconLoading(btn, false);
    st.exporting = false;
  }
}

export async function printViaPdf() {
  const st = window.__APP_STATE__;
  if (st.exporting) return;
  st.exporting = true;

  const btn = document.getElementById("btnPrint");
  setIconLoading(btn, true);

  try {
    await new Promise(r => setTimeout(r, 60));

    const items = buildItemsForPackingNoDraft();
    if (items.length === 0) return;

    for (const it of items) {
      const r = await renderProductToPngs(it.product, PRINT_PX);
      it._png = (it.product.size === SIZE.halfH) ? r.pngRotated : r.pngNormal;
    }

    const pages = packAll(items);

    // Construir HTML con las etiquetas posicionadas en páginas carta
    let pagesHtml = "";
    for (const page of pages) {
      const pageType = page.type === "full" ? "full" : "grid";
      let slots = "";
      for (const pl of page.placements) {
        if (!pl.item._png) continue;
        const box = boxForPlacement(pageType, pl.row, pl.col, pl.rs, pl.cs);
        slots += `<img src="${pl.item._png}" style="position:absolute;left:${box.x}mm;top:${box.y}mm;width:${box.w}mm;height:${box.h}mm;object-fit:contain;">`;
      }
      pagesHtml += `<div class="pg">${slots}</div>`;
    }

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      @page{size:letter portrait;margin:0}
      *{margin:0;padding:0;box-sizing:border-box}
      body{background:#fff}
      .pg{width:215.9mm;height:279.4mm;position:relative;overflow:hidden;page-break-after:always;break-after:page}
    </style></head><body>${pagesHtml}</body></html>`;

    const win = window.open("", "_blank");
    if (!win) {
      alert("El navegador bloqueó la nueva pestaña. Permite ventanas emergentes para este sitio.");
      return;
    }

    win.document.write(html);
    win.document.close();

    // Las imágenes son data URLs (ya en memoria), solo necesitamos un tick para que el navegador pinte
    setTimeout(() => {
      win.focus();
      win.print();
    }, 300);

  } catch (e) {
    console.error(e);
    alert("No se pudo imprimir. Revisa la consola para más detalle.");
  } finally {
    st.caches.renderCache.clear();
    setIconLoading(btn, false);
    st.exporting = false;
  }
}
