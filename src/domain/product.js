import { CONFIG, PRICING, getPlanForNormal } from "../config/config.js";

export function emptyProduct() {
  return {
    id: null,
    template: "",
    size: "",
    nombre: "",
    antes: "",
    ahora: "",
    efectivo: "",
    cuota: "",
    qty: 1,
    useVig: false,
    vigStart: "",
    vigEnd: "",
    impresionAt: "",
    colorIdx: null,
    excluded: false
  };
}

export function onlyDigits(str) {
  return (str ?? "").toString().replace(/[^\d]/g, "");
}

/**
 * Calcula el Precio Antes = ceil(precioNormal * (1 + markupPct/100)).
 * Devuelve string vacío si el valor no es válido.
 */
export function computePrecioAntes(precioNormal) {
  const n = parseInt(precioNormal, 10);
  if (!Number.isFinite(n) || n <= 0) return "";
  return String(Math.ceil(n * (1 + PRICING.markupPct / 100)));
}

/**
 * Calcula el Precio Efectivo = round(precioNormal * (1 - downPaymentPct/100)).
 * Ejemplo: precioNormal=6290 → efectivo=round(6290*0.90)=5661
 */
export function computePrecioEfectivo(precioNormal) {
  const n = parseInt(precioNormal, 10);
  if (!Number.isFinite(n) || n <= 0) return "";
  const monto = Math.round(n * (1 - PRICING.downPaymentPct / 100));
  return monto > 0 ? String(monto) : "";
}

/**
 * Calcula la cuota semanal directamente desde el precio normal.
 * Selecciona el plan según el monto y aplica cuota = ceil(normal * cuotaRef / refAmount).
 */
export function computeCuotaDesdeNormal(precioNormal) {
  const n = parseInt(precioNormal, 10);
  if (!Number.isFinite(n) || n <= 0) return "";
  const plan = getPlanForNormal(n);
  return String(Math.ceil(n * plan.cuotaRef / plan.refAmount));
}

export function sanitizeIntStr(raw) {
  let cleaned = onlyDigits(raw).slice(0, CONFIG.limits.maxDigits);
  if (cleaned.length > 1) cleaned = cleaned.replace(/^0+/, "") || "0";
  return cleaned;
}

export function validateProductData(p) {
  const errs = [];

  if (!p.template) errs.push("Plantilla requerida.");
  if (!p.size) errs.push("Tamaño requerido.");
  if (!p.nombre || !p.nombre.trim()) errs.push("Nombre requerido.");

  const ahora = sanitizeIntStr(p.ahora || "");

  if (!ahora || ahora === "0") errs.push("Precio Normal debe ser mayor a 0 (máx 5 dígitos).");

  const qty = parseInt(p.qty, 10);
  if (!Number.isFinite(qty) || qty < 1) errs.push("Cantidad debe ser mayor a 0.");

  if (p.useVig) {
    if (!p.vigStart) errs.push("VigenciaInicio requerida.");
    if (!p.vigEnd) errs.push("VigenciaFin requerida.");
    if (p.vigStart && p.vigEnd && p.vigEnd < p.vigStart) {
      errs.push("VigenciaFin no puede ser menor que VigenciaInicio.");
    }
  }

  return errs;
}

export function sanitizeLoadedProduct(raw) {
  const base = emptyProduct();
  const out = { ...base };

  out.id = typeof raw?.id === "string" ? raw.id : null;
  out.template = typeof raw?.template === "string" ? raw.template : "";
  out.size = typeof raw?.size === "string" ? raw.size : "";
  out.nombre = typeof raw?.nombre === "string" ? raw.nombre : "";

  // ahora es el campo canónico que ingresa el usuario; los demás se derivan
  out.ahora    = sanitizeIntStr(raw?.ahora);
  out.efectivo = computePrecioEfectivo(out.ahora);
  out.antes    = computePrecioAntes(out.ahora);
  out.cuota    = computeCuotaDesdeNormal(out.ahora);

  const qtyN = parseInt(raw?.qty, 10);
  out.qty = Number.isFinite(qtyN) && qtyN > 0 ? qtyN : 1;

  out.useVig = !!raw?.useVig;
  out.vigStart = typeof raw?.vigStart === "string" ? raw.vigStart : "";
  out.vigEnd = typeof raw?.vigEnd === "string" ? raw.vigEnd : "";

  out.impresionAt = typeof raw?.impresionAt === "string" ? raw.impresionAt : "";
  out.colorIdx = Number.isFinite(raw?.colorIdx) ? raw.colorIdx : null;
  out.excluded = !!raw?.excluded;

  return out;
}
