import { CONFIG, SIZE } from "../config/config.js";
import { renderProductToPngs, createCappedCache } from "./svgRenderer.js";
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

async function exportPdf() {
  const st = window.__APP_STATE__;
  if (st.products.length === 0) return;

  if (!window.jspdf?.jsPDF) {
    alert("No se pudo cargar jsPDF. Revisa tu conexión o el script CDN.");
    return;
  }

  const { jsPDF } = window.jspdf;

  const items = buildItemsForPackingNoDraft();
  for (const it of items) {
    const r = await renderProductToPngs(it.product);
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

  doc.save("etiquetas.pdf");
}

export async function exportPdfWithLoading() {
  const st = window.__APP_STATE__;
  if (st.exporting) return;
  st.exporting = true;

  const btn = document.getElementById("btnPdf");
  setIconLoading(btn, true);

  try {
    await new Promise(r => setTimeout(r, 60));
    await exportPdf();
  } catch (e) {
    console.error(e);
    alert("No se pudo exportar a PDF. Revisa la consola para más detalle.");
  } finally {
    setIconLoading(btn, false);
    st.exporting = false;
  }
}
