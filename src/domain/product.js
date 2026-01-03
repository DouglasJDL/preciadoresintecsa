import { CONFIG } from "../config/config.js";

export function emptyProduct() {
  return {
    id: null,
    template: "",
    size: "",
    nombre: "",
    antes: "",
    ahora: "",
    cuota: "",
    qty: 1,
    useVig: false,
    vigStart: "",
    vigEnd: "",
    impresionAt: "",
    colorIdx: null
  };
}

export function onlyDigits(str) {
  return (str ?? "").toString().replace(/[^\d]/g, "");
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

  const antes = sanitizeIntStr(p.antes || "");
  const ahora = sanitizeIntStr(p.ahora || "");
  const cuota = sanitizeIntStr(p.cuota || "");

  if (!antes) errs.push("Antes requerido (máx 5 dígitos).");
  if (!ahora) errs.push("Ahora requerido (máx 5 dígitos).");
  if (!cuota) errs.push("Cuota requerida (máx 5 dígitos).");

  const qty = parseInt(p.qty, 10);
  if (!Number.isFinite(qty) || qty < 1) errs.push("Cantidad debe ser mayor a 0.");

  if (antes && ahora) {
    const aN = parseInt(antes, 10);
    const hN = parseInt(ahora, 10);
    if (Number.isFinite(aN) && Number.isFinite(hN) && hN > aN) {
      errs.push("'Ahora' no puede ser mayor que 'Antes'.");
    }
  }

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

  out.antes = sanitizeIntStr(raw?.antes);
  out.ahora = sanitizeIntStr(raw?.ahora);
  out.cuota = sanitizeIntStr(raw?.cuota);

  const qtyN = parseInt(raw?.qty, 10);
  out.qty = Number.isFinite(qtyN) && qtyN > 0 ? qtyN : 1;

  out.useVig = !!raw?.useVig;
  out.vigStart = typeof raw?.vigStart === "string" ? raw.vigStart : "";
  out.vigEnd = typeof raw?.vigEnd === "string" ? raw.vigEnd : "";

  out.impresionAt = typeof raw?.impresionAt === "string" ? raw.impresionAt : "";
  out.colorIdx = Number.isFinite(raw?.colorIdx) ? raw.colorIdx : null;

  return out;
}
