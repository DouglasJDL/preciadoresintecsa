export const CONFIG = Object.freeze({
  storageKey: "editor_etiquetas_state_v7_secure",
  previewScale: 0.58,

  limits: Object.freeze({
    maxDigits: 5,
    saveDebounceMs: 180,
    previewDebounceMs: 160,
    hoverInMs: 140,
    hoverOutMs: 180,

    maxExcelBytes: 6 * 1024 * 1024,
    maxExcelRows: 5000,
    maxExcelErrorsShown: 80,

    maxTemplateCache: 40,
    maxRenderCache: 40,
    maxImgDimCache: 400,

    renderPreviewPx: 600,
    renderPrintPx: 1200
  }),

  paper: Object.freeze({
    letterWmm: 215.9,
    letterHmm: 279.4,
    padGridMm: 6,
    gapGridMm: 6,
    padFullMm: 10
  })
});

export const SVG_IDS = Object.freeze({
  nombre: "nombre_producto",
  antes: "precio_antes",
  ahora: "precio_ahora",
  efectivo: "precio_efectivo",
  cuota: "cuota_semanal",
  vigencia: "fecha_vigencia",
  impresionCandidates: Object.freeze(["Fecha_impresion", "fecha_impresion", "FECHA_IMPRESION"])
});

export const SIZE = Object.freeze({
  quarter: "quarter",
  halfH: "half_h",
  full: "full",
  mini: "mini"
});

/**
 * Alias humanos (normalizados sin tildes/espacios) => nombre real del archivo
 * FIX: evitar .SVG (rompe en Linux).
 */
/**
 * ─── CATÁLOGO DE PLANTILLAS ──────────────────────────────────────────────────
 *
 * Aquí está TODO lo que necesitas cambiar sobre una plantilla:
 *
 *   id      → identificador estable, NUNCA lo cambies (es la llave interna).
 *   file    → nombre del archivo SVG en /resource/templates/
 *   label   → nombre que ve el usuario en el formulario y en Excel.
 *   enabled → true = visible y usable | false = oculta para el usuario.
 *   aliases → palabras extra con las que se puede reconocer al importar Excel.
 *
 * Si renombras el archivo SVG → cambia solo "file".
 * Si renombras la etiqueta    → cambia solo "label".
 * Si la quieres ocultar       → pon enabled: false.
 * El resto del código se actualiza solo.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const TEMPLATES = Object.freeze([
  {
    id: "promocion",
    file: "promocion1.svg",
    label: "Promoción",
    enabled: true,
    aliases: ["promo", "promocion1"]
  },
  {
    id: "normal",
    file: "normal1.svg",
    label: "Normal",
    enabled: true,
    aliases: ["normal1"]
  },
  {
    id: "liquidacion",
    file: "liquidacion1.svg",
    label: "Liquidación",
    enabled: true,
    aliases: ["liqui", "liquidacion1"]
  },
  {
    id: "super_oferta",
    file: "oferta1.svg",
    label: "Super Oferta",
    enabled: true,
    aliases: ["oferta", "oferta1", "super oferta", "superoferta", "superoferta1"]
  },
  {
    id: "pequeño",
    file: "pequeño1.svg",
    label: "Pequeño",
    enabled: true,
    aliases: ["pequeno", "pequeño1", "pequeno1", "mini"]
  },
]);

// Auto-generado desde TEMPLATES — no tocar manualmente.
// Si cambia "file" o "label" en TEMPLATES, este mapa se actualiza solo.
function _buildAliases() {
  const normalize = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, "");
  const map = {};
  TEMPLATES.forEach(({ id, file, label, aliases = [] }) => {
    map[id]               = file;           // por id estable
    map[normalize(label)] = file;           // por label normalizado
    aliases.forEach(a => { map[normalize(a)] = file; });  // alias extra
  });
  return Object.freeze(map);
}
export const TEMPLATE_ALIASES = _buildAliases();

export const COLOR_HUES = Object.freeze([210, 150, 35, 0, 270, 190, 95, 235, 25, 330]);

/**
 * Configuración de precios automáticos.
 * markupPct    : % que se suma al Precio Normal para obtener Precio Antes.
 * downPaymentPct: % que se resta al Precio Normal antes de financiar.
 */
export const PRICING = Object.freeze({
  markupPct: 15,
  downPaymentPct: 10
});

/**
 * Planes de financiamiento por rango de Precio Efectivo.
 *
 * Cada plan se activa cuando el precio efectivo >= minEfectivo.
 * El array debe estar ordenado de menor a mayor minEfectivo.
 * Para agregar un nuevo plan: añade un objeto con minEfectivo, cuotas, cuotaRef, etc.
 *
 * Campos:
 *   minEfectivo : precio efectivo mínimo (inclusive) para aplicar este plan.
 *   refAmount   : monto de referencia sobre el que se calcula cuotaRef (Q).
 *   cuotaRef    : cuota semanal para el refAmount.
 *   cuotas      : número de cuotas (semanas).
 *   interes     : tasa de interés del plan.
 *   total       : total a pagar para el refAmount.
 */
export const FINANCING_PLANS = Object.freeze([
  {
    minEfectivo: 200,
    nombre: "Avanza Pay 04 Semanas",
    periodo: "Semanal",
    cuotas: 4,
    refAmount: 1000,
    cuotaRef: 315,
    interes: 0.26,
    total: 1260.00
  },
  {
    minEfectivo: 600,
    nombre: "Avanza Pay 08 Semanas",
    periodo: "Semanal",
    cuotas: 8,
    refAmount: 1000,
    cuotaRef: 190,
    interes: 0.52,
    total: 1520.00
  },
  {
    minEfectivo: 1000,
    nombre: "Avanza Pay 20 Semanas",
    periodo: "Semanal",
    cuotas: 20,
    refAmount: 1000,
    cuotaRef: 110,
    interes: 1.20,
    total: 2200.00,
    cobranzaDificil: 200
  }
]);

/**
 * Devuelve el plan de financiamiento correspondiente al precio efectivo dado.
 * Se selecciona el plan con el mayor minEfectivo que sea <= precioEfectivo.
 */
export function getPlanForEfectivo(precioEfectivo) {
  const n = parseInt(precioEfectivo, 10);
  let plan = FINANCING_PLANS[0];
  if (Number.isFinite(n) && n > 0) {
    for (const p of FINANCING_PLANS) {
      if (n >= p.minEfectivo) plan = p;
    }
  }
  return plan;
}

/** @deprecated Usa FINANCING_PLANS. Mantenido por compatibilidad. */
export const FINANCING_PLAN = FINANCING_PLANS[FINANCING_PLANS.length - 1];
