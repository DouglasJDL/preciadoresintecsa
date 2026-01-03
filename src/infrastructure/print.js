import { SIZE } from "../config/config.js";
import { Dom } from "../presentation/dom.js";
import { renderProductToPngs } from "./svgRenderer.js";
import { packAll } from "../domain/packing.js";

async function waitForImages(container) {
  const imgs = Dom.qsa("img", container);
  if (!imgs.length) return;

  await Promise.all(imgs.map(img => {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise(resolve => {
      img.onload = resolve;
      img.onerror = resolve;
    });
  }));

  await Promise.all(imgs.map(img => img.decode ? img.decode().catch(() => {}) : Promise.resolve()));
}

async function nextFrame() {
  await new Promise(requestAnimationFrame);
  await new Promise(requestAnimationFrame);
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

export async function printNow() {
  const st = window.__APP_STATE__;
  if (st.products.length === 0) return;

  const items = buildItemsForPackingNoDraft();
  for (const it of items) {
    const r = await renderProductToPngs(it.product);
    it._png = (it.product.size === SIZE.halfH) ? r.pngRotated : r.pngNormal;
  }

  const pages = packAll(items);

  const root = document.getElementById("printRoot");
  root.innerHTML = "";
  root.style.display = "block";

  for (const page of pages) {
    const wrap = document.createElement("div");
    wrap.className = "print-page";

    const paper = document.createElement("div");
    paper.className = "paper-page " + (page.type === "full" ? "paper-full" : "paper-grid");

    for (const pl of page.placements) {
      const it = pl.item;
      if (!it._png) continue;

      const slot = document.createElement("div");
      slot.className = "slot";
      slot.style.gridRow = `${pl.row} / span ${pl.rs}`;
      slot.style.gridColumn = `${pl.col} / span ${pl.cs}`;

      const img = document.createElement("img");
      img.src = it._png;
      img.alt = "Etiqueta";
      slot.appendChild(img);

      paper.appendChild(slot);
    }

    wrap.appendChild(paper);
    root.appendChild(wrap);
  }

  await waitForImages(root);
  await nextFrame();

  const cleanup = () => {
    root.style.display = "none";
    root.innerHTML = "";
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);

  window.print();
}
