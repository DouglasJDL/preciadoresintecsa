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
    aliases: ["oferta", "oferta1", "super oferta"]
  },
  {
    id: "pequeño",
    file: "pequeño1.svg",
    label: "Pequeño",
    enabled: true,
    aliases: ["pequeno", "pequeño1", "pequeno1", "mini"]
  },
  {
    id: "superoferta_legacy",
    file: "superoferta.svg",
    label: "Super Oferta (desactivada)",
    enabled: false,
    aliases: ["superoferta", "superoferta1"]
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
