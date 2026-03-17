import { CONFIG, PRICING, getPlanForEfectivo } from "../config/config.js";

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
 * Calcula el Precio Efectivo = round(precioNormal / (1 + downPaymentPct/100)).
 * Ejemplo: precioNormal=1000 → efectivo=round(1000/1.10)=909
 */
export function computePrecioEfectivo(precioNormal) {
  const n = parseInt(precioNormal, 10);
  if (!Number.isFinite(n) || n <= 0) return "";
  const monto = Math.round(n / (1 + PRICING.downPaymentPct / 100));
  return monto > 0 ? String(monto) : "";
}

/**
 * Calcula el Precio Normal = round(precioEfectivo * (1 + downPaymentPct/100)).
 * Inversa de computePrecioEfectivo: el usuario ingresa efectivo y se obtiene el normal.
 * Siempre redondea hacia arriba (ceil).
 * Ejemplo: efectivo=909 → normal=ceil(909*1.10)=ceil(999.9)=1000
 * Ejemplo: efectivo=91  → normal=ceil(91*1.10)=ceil(100.1)=101
 */
export function computePrecioNormal(precioEfectivo) {
  const n = parseInt(precioEfectivo, 10);
  if (!Number.isFinite(n) || n <= 0) return "";
  return String(Math.ceil(n * (1 + PRICING.downPaymentPct / 100)));
}

/**
 * Calcula la cuota semanal directamente desde el precio efectivo.
 * Selecciona el plan según el monto: efectivo < 500 → 4 semanas, >= 500 → 20 semanas.
 * cuota = ceil(efectivo * plan.cuotaRef / plan.refAmount)
 */
export function computeCuotaDesdeEfectivo(precioEfectivo) {
  const n = parseInt(precioEfectivo, 10);
  if (!Number.isFinite(n) || n <= 0) return "";
  const plan = getPlanForEfectivo(n);
  return String(Math.ceil(n * plan.cuotaRef / plan.refAmount));
}

/**
 * @deprecated Usa computeCuotaDesdeEfectivo cuando el efectivo ya está disponible.
 * Mantiene compatibilidad con código que solo tiene precioNormal.
 */
export function computeCuota(precioNormal) {
  return computeCuotaDesdeEfectivo(computePrecioEfectivo(precioNormal));
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

  const efectivo = sanitizeIntStr(p.efectivo || "");

  if (!efectivo || efectivo === "0") errs.push("Precio Efectivo debe ser mayor a 0 (máx 5 dígitos).");

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

  // efectivo es el campo canónico que ingresa el usuario
  // Para compat con productos guardados antes del cambio (que solo tienen ahora):
  out.efectivo = sanitizeIntStr(raw?.efectivo) || computePrecioEfectivo(raw?.ahora);
  out.ahora    = computePrecioNormal(out.efectivo) || sanitizeIntStr(raw?.ahora);
  out.antes    = computePrecioAntes(out.ahora)    || sanitizeIntStr(raw?.antes);
  out.cuota    = computeCuotaDesdeEfectivo(out.efectivo) || sanitizeIntStr(raw?.cuota);

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
