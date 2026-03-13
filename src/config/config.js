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
  cuota: "cuota_semanal",
  vigencia: "fecha_vigencia",
  impresionCandidates: Object.freeze(["Fecha_impresion", "fecha_impresion", "FECHA_IMPRESION"])
});

export const SIZE = Object.freeze({
  quarter: "quarter",
  halfH: "half_h",
  full: "full"
});

/**
 * Alias humanos (normalizados sin tildes/espacios) => nombre real del archivo
 * FIX: evitar .SVG (rompe en Linux).
 */
export const TEMPLATE_ALIASES = Object.freeze({
  "promocion": "promocion1.svg",
  "promoción": "promocion1.svg",
  "normal": "normal1.svg",
  "liquidacion": "liquidacion1.svg",
  "liquidación": "liquidacion1.svg",
  "oferta": "oferta1.svg",

  "promocion1": "promocion1.svg",
  "normal1": "normal1.svg",
  "liquidacion1": "liquidacion1.svg",
  "liquidación1": "liquidacion1.svg",
  "oferta1": "oferta1.svg"
});

export const COLOR_HUES = Object.freeze([210, 150, 35, 0, 270, 190, 95, 235, 25, 330]);

/**
 * Configuración de precios automáticos.
 * markupPct    : % que se suma al Precio Normal para obtener Precio Antes.
 * downPaymentPct: % que se resta al Precio Normal antes de financiar.
 */
export const PRICING = Object.freeze({
  markupPct: 10,
  downPaymentPct: 10
});

/**
 * Plan de financiamiento.
 * id       : monto de referencia (1000 Q).
 * cuotaRef : cuota semanal para ese monto de referencia.
 * cuotas   : número de cuotas del plan.
 * total    : total a pagar para el monto de referencia.
 */
export const FINANCING_PLAN = Object.freeze({
  id: 1000,
  nombre: "Prenda Cuotas 20 Semanas",
  periodo: "Semanal",
  cuotas: 20,
  cuotaRef: 110,
  interes: 1.20,
  total: 2200.00,
  cobranzaDificil: 200
});
