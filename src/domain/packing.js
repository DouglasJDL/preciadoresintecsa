import { SIZE } from "../config/config.js";

// Grid universal: 4 columnas × 14 filas.
// Spans por tamaño:
//   mini    → 1 col × 2 filas  → 28 por página
//   quarter → 2 col × 7 filas  →  4 por página
//   half_h  → 4 col × 7 filas  →  2 por página
// Todos conviven en la misma hoja sin desperdiciar espacio.

const U_COLS = 4;
const U_ROWS = 14;

const SPANS = {
  [SIZE.mini]:    { cs: 1, rs: 2 },
  [SIZE.quarter]: { cs: 2, rs: 7 },
  [SIZE.halfH]:   { cs: 4, rs: 7 },
};

function makeUniversalPage() {
  const occ = Array.from({ length: U_ROWS }, () => Array(U_COLS).fill(null));
  return { type: "universal", occ, placements: [] };
}

function canPlace(occ, r, c, rs, cs) {
  if (r + rs > U_ROWS || c + cs > U_COLS) return false;
  for (let dr = 0; dr < rs; dr++)
    for (let dc = 0; dc < cs; dc++)
      if (occ[r + dr][c + dc]) return false;
  return true;
}

function placeInUniversal(page, item, cs, rs) {
  for (let r = 0; r <= U_ROWS - rs; r++) {
    for (let c = 0; c <= U_COLS - cs; c++) {
      if (canPlace(page.occ, r, c, rs, cs)) {
        for (let dr = 0; dr < rs; dr++)
          for (let dc = 0; dc < cs; dc++)
            page.occ[r + dr][c + dc] = item;
        page.placements.push({ item, row: r + 1, col: c + 1, rs, cs });
        return true;
      }
    }
  }
  return false;
}

export function packAll(items) {
  const pages = [];

  for (const it of items) {
    const size = it.product.size;

    if (size === SIZE.full) {
      pages.push({ type: "full", placements: [{ item: it, row: 1, col: 1, rs: 1, cs: 1 }] });
      continue;
    }

    const { cs, rs } = SPANS[size] || SPANS[SIZE.mini];

    let placed = false;
    for (const page of pages) {
      if (page.type !== "universal") continue;
      placed = placeInUniversal(page, it, cs, rs);
      if (placed) break;
    }

    if (!placed) {
      const p = makeUniversalPage();
      pages.push(p);
      placeInUniversal(p, it, cs, rs);
    }
  }

  return pages;
}
