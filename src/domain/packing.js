import { SIZE } from "../config/config.js";

function makeGridPage() {
  return { type: "grid", occ: [[null, null], [null, null]], placements: [] };
}

function rowEmpty(page, r) {
  return !page.occ[r][0] && !page.occ[r][1];
}

function placeQuarter(page, item) {
  const prefer = [];
  const any = [];

  for (let r = 0; r < 2; r++) {
    const emptyCols = [];
    for (let c = 0; c < 2; c++) if (!page.occ[r][c]) emptyCols.push(c);
    if (!emptyCols.length) continue;

    const filled = 2 - emptyCols.length;
    if (filled === 1 && emptyCols.length === 1) prefer.push({ r, c: emptyCols[0] });
    else any.push({ r, c: emptyCols[0] });
  }

  const spot = prefer[0] || any[0];
  if (!spot) return false;

  page.occ[spot.r][spot.c] = item;
  page.placements.push({ item, row: spot.r + 1, col: spot.c + 1, rs: 1, cs: 1 });
  return true;
}

function placeHalf(page, item) {
  const opts = [];
  for (let r = 0; r < 2; r++) {
    if (!rowEmpty(page, r)) continue;
    const other = r === 0 ? 1 : 0;
    const otherHas = (!!page.occ[other][0] || !!page.occ[other][1]);
    opts.push({ r, score: otherHas ? 2 : 1 });
  }

  if (!opts.length) return false;
  opts.sort((a, b) => b.score - a.score);

  const r = opts[0].r;
  page.occ[r][0] = item;
  page.occ[r][1] = item;
  page.placements.push({ item, row: r + 1, col: 1, rs: 1, cs: 2 });
  return true;
}

export function packAll(items) {
  const pages = [];

  for (const it of items) {
    const size = it.product.size;

    if (size === SIZE.full) {
      pages.push({ type: "full", placements: [{ item: it, row: 1, col: 1, rs: 1, cs: 1 }] });
      continue;
    }

    let placed = false;

    for (const page of pages) {
      if (page.type !== "grid") continue;

      if (size === SIZE.quarter) placed = placeQuarter(page, it);
      else if (size === SIZE.halfH) placed = placeHalf(page, it);

      if (placed) break;
    }

    if (!placed) {
      const p = makeGridPage();
      pages.push(p);
      if (size === SIZE.quarter) placeQuarter(p, it);
      else placeHalf(p, it);
    }
  }

  return pages;
}
