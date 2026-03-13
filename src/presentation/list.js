import { SIZE } from "../config/config.js";
import { $, Dom, cssEsc, escapeHtml } from "./dom.js";
import { toQuetzales, formatDMY } from "../infrastructure/svgRenderer.js";
import { pairColor, pairGlow, markSelectedInList } from "./selection.js";

const ICONS = Object.freeze({
  chevronRight: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>`,
  chevronDown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>`,
  edit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 16h10l1-16"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>`
});

function sizeLabel(size) {
  if (size === SIZE.quarter) return "1/4";
  if (size === SIZE.halfH) return "Media horiz.";
  return "Carta";
}

export function renderList() {
  const st = window.__APP_STATE__;
  const wrap = $("itemsWrap");

  if (st.products.length === 0) {
    wrap.innerHTML = `
      <div class="listEmpty">
        No hay productos agregados todav\xEDa.<br>
        Presiona <b>"Agregar"</b> o usa <b>Importar Excel</b>.
      </div>
    `;
    return;
  }

  const perfWarning = st.products.length > 80
    ? `<div class="perfWarning">\u26A0\uFE0F ${st.products.length} etiquetas \u2014 el rendimiento puede verse afectado. Considera dividir en grupos m\xE1s peque\xF1os.</div>`
    : "";

  wrap.innerHTML =
    perfWarning +
    `<div class="items" id="itemsList">` +
    st.products.map(p => {
      const isOpen = st.expandedId === p.id;

      const vigLabel = p.useVig
        ? `Vigencia: ${formatDMY(p.vigStart)} \u2192 ${formatDMY(p.vigEnd)}`
        : "Sin vigencia";

      const impLabel = p.impresionAt
        ? `Impresi\xF3n: ${p.impresionAt}`
        : "Impresi\xF3n: (pendiente)";

      const c = pairColor(p.id);
      const g = pairGlow(p.id, false);
      const gs = pairGlow(p.id, true);

      return (
        `<div class="item ${isOpen ? "expanded" : ""}"` +
        ` data-id="${escapeHtml(p.id)}"` +
        ` style="--pairColor:${c}; --pairGlow:${g}; --pairGlowStrong:${gs}"` +
        ` tabindex="0">` +
        `<div class="itemHead">` +
          `<div class="itemTitleRow" data-role="title">` +
            `<button class="btnIcon" type="button" data-action="toggle"` +
            ` title="${isOpen ? "Plegar" : "Desplegar"}" aria-label="${isOpen ? "Plegar" : "Desplegar"}">` +
              `<span class="chev-close">${ICONS.chevronRight}</span>` +
              `<span class="chev-open">${ICONS.chevronDown}</span>` +
            `</button>` +
            `<div class="pairDot" aria-hidden="true"></div>` +
            `<div class="itemName" data-role="name" title="${escapeHtml(p.nombre || "(Sin nombre)")}">` +
              `${escapeHtml(p.nombre || "(Sin nombre)")}` +
            `</div>` +
          `</div>` +
          `<div class="itemActions">` +
            `<button class="btnIcon warning" type="button" data-action="edit" title="Editar" aria-label="Editar">` +
              `${ICONS.edit}` +
            `</button>` +
            `<button class="btnIcon danger" type="button" data-action="delete" title="Eliminar" aria-label="Eliminar">` +
              `${ICONS.trash}` +
            `</button>` +
          `</div>` +
        `</div>` +
        `<div class="itemDetails">` +
          `<div class="metaGrid">` +
            `<div><b>Plantilla:</b> ${escapeHtml(p.template)}</div>` +
            `<div><b>Tama\xF1o:</b> ${escapeHtml(sizeLabel(p.size))}</div>` +
            `<div><b>Cantidad:</b> ${p.qty}</div>` +
            `<div><b>Precio Normal:</b> ${escapeHtml(toQuetzales(p.ahora))}</div>` +
            `<div><b>Precio Antes:</b> ${escapeHtml(toQuetzales(p.antes))}</div>` +
            `<div><b>Cuota:</b> ${escapeHtml(toQuetzales(p.cuota))}</div>` +
            `<div class="span2"><b>${escapeHtml(vigLabel)}</b></div>` +
            `<div class="span2">${escapeHtml(impLabel)}</div>` +
          `</div>` +
          `<div class="metaPill">\uD83D\uDCA1 Hover = resalta \xB7 Click = mover</div>` +
          `<div class="miniHint">Click en una etiqueta del preview: abre este producto aqu\xED.</div>` +
        `</div>` +
        `</div>`
      );
    }).join("") +
    `</div>`;

  markSelectedInList();
}

export function findListItem(productId) {
  if (!productId) return null;
  return Dom.qs(`.item[data-id="${cssEsc(productId)}"]`);
}
