import { CONFIG, SIZE, TEMPLATE_ALIASES, TEMPLATES } from "../config/config.js";
import { toast } from "./toast.js";
import { emptyProduct, sanitizeIntStr, validateProductData, computePrecioNormal, computePrecioAntes, computeCuotaDesdeEfectivo } from "../domain/product.js";
import { formatDateTimeNow, normalizeText } from "./svgRenderer.js";
import { openModal, closeModal, buildTextBlock, buildErrorList } from "../presentation/modal.js";
import { requestSave, normalizeExistingState } from "./storage.js";
import { scheduleRebuild } from "../presentation/preview.js";
import { renderList } from "../presentation/list.js";
import { applySelectionHighlight } from "../presentation/selection.js";
import { allocateColorIdx } from "../application/actions.js";

function getAllowedTemplates() {
  const sel = document.getElementById("fTemplate");
  if (!sel) return [];
  return Array.from(sel.options).map(o => o.value).filter(Boolean);
}

function stripExt(name) {
  const s = (name ?? "").toString().trim();
  const dot = s.lastIndexOf(".");
  return (dot > 0) ? s.slice(0, dot) : s;
}

function normalizeTemplateBase(v) {
  return normalizeText(stripExt(v)).replace(/\s+/g, "");
}

function getAllowedTemplateBases() {
  return getAllowedTemplates().map(t => stripExt(t));
}

function normalizeHeader(h) {
  return normalizeText(h).replace(/[\s\-_]+/g, "");
}

function truthyCell(v) {
  const t = normalizeText(v);
  return t === "si" || t === "sí" || t === "s" || t === "1" || t === "true" || t === "x" || t === "yes";
}

function parseSizeCell(v) {
  const t = normalizeText(v);
  if (!t) return "";

  if (t.includes("mini") || t.includes("4x7") || t === "28") return SIZE.mini;
  if (t.includes("1/4") || t.includes("cuarto") || t.includes("1-4")) return SIZE.quarter;
  if (t.includes("media") || t.includes("mitad") || t.includes("horizontal")) return SIZE.halfH;
  if (t.includes("carta") || t.includes("completa") || t.includes("pagina completa") || t.includes("página completa")) return SIZE.full;

  if (t.includes("quarter")) return SIZE.quarter;
  if (t.includes("half_h") || (t.includes("half") && !t.includes("quarter"))) return SIZE.halfH;
  if (t.includes("full")) return SIZE.full;

  if (t === SIZE.quarter || t === SIZE.halfH || t === SIZE.full || t === SIZE.mini) return t;
  return "";
}

function parseTemplateCell(v, allowed) {
  const raw = (v ?? "").toString().trim();
  if (!raw) return "";

  const rawNorm = normalizeText(raw);
  if (TEMPLATE_ALIASES[rawNorm]) return TEMPLATE_ALIASES[rawNorm];

  // Labels con espacios (ej: "Super Oferta") quedan con espacio en normalizeText
  // pero TEMPLATE_ALIASES los guarda sin espacios → intentar sin espacios
  const rawNormNoSpaces = rawNorm.replace(/\s+/g, "");
  if (TEMPLATE_ALIASES[rawNormNoSpaces]) return TEMPLATE_ALIASES[rawNormNoSpaces];

  const foundExact = allowed.find(a => normalizeText(a) === rawNorm);
  if (foundExact) return foundExact;

  const rawBase = normalizeTemplateBase(raw);
  const foundByBase = allowed.find(a => normalizeTemplateBase(a) === rawBase);
  if (foundByBase) return foundByBase;

  const maybe = rawNorm.replace(/[^a-z0-9]/g, "");
  const foundByLoose = allowed.find(a => normalizeTemplateBase(a).replace(/[^a-z0-9]/g, "") === maybe);
  return foundByLoose || "";
}

function parseNumberCell(v) {
  if (v === null || v === undefined) return "";
  const s = (typeof v === "number") ? String(Math.ceil(v)) : String(v);
  return sanitizeIntStr(s.replace(/[^\d]/g, ""));
}

function pad2num(n) { return String(n).padStart(2, "0"); }

function toISODate(y, m, d) {
  const yy = String(y);
  const mm = pad2num(m);
  const dd = pad2num(d);
  return `${yy}-${mm}-${dd}`;
}

function parseDateCell(v) {
  if (!v) return "";

  if (v instanceof Date && !isNaN(v.getTime())) {
    return toISODate(v.getFullYear(), v.getMonth() + 1, v.getDate());
  }

  if (typeof v === "number" && Number.isFinite(v) && window.XLSX?.SSF?.parse_date_code) {
    const dc = XLSX.SSF.parse_date_code(v);
    if (dc?.y && dc?.m && dc?.d) return toISODate(dc.y, dc.m, dc.d);
  }

  const s = String(v).trim();
  if (!s) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return toISODate(m[3], parseInt(m[2], 10), parseInt(m[1], 10));

  return "";
}

function buildHeaderMap(headers) {
  const map = {};
  headers.forEach((h, idx) => { map[normalizeHeader(h)] = idx; });
  return map;
}

function cellBy(map, rowArr, keys) {
  for (const k of keys) {
    const idx = map[k];
    if (idx === 0 || idx) return rowArr[idx];
  }
  return "";
}

function parseExcelRowsToProducts(rows) {
  if (!rows || rows.length < 2) {
    return { products: [], errors: ["El archivo no tiene datos (mínimo encabezados + 1 fila)."] };
  }
  if (rows.length > CONFIG.limits.maxExcelRows) {
    return { products: [], errors: [`El archivo excede el máximo permitido de filas (${CONFIG.limits.maxExcelRows}).`] };
  }

  const allowed = getAllowedTemplates();
  const allowedBases = getAllowedTemplateBases();

  const headerRow = rows[0].map(h => (h ?? "").toString().trim());
  const map = buildHeaderMap(headerRow);

  const K = {
    template: ["plantilla", "template", "svg"],
    size: ["tamano", "tamaño", "size"],
    nombre: ["nombre", "producto", "name"],
    efectivo: ["precioefectivo", "efectivo", "contado", "precionormal", "precioahora", "ahora"],
    qty: ["cantidad", "qty", "cant"],
    useVig: ["agregarvigencia", "vigencia", "usevig"],
    vigStart: ["vigenciainicio", "fechainicial", "inicio", "vigenciadesde"],
    vigEnd: ["vigenciafin", "fechafinal", "fin", "vigenciahasta"]
  };

  const requiredCols = [
    ["Plantilla", K.template],
    ["Tamaño", K.size],
    ["Nombre", K.nombre],
    ["Precio Efectivo", K.efectivo],
    ["Cantidad", K.qty]
  ];

  const missing = requiredCols.filter(([_, keys]) => !keys.some(k => map[k] === 0 || map[k]));
  if (missing.length) {
    return { products: [], errors: missing.map(([label]) => `Falta la columna requerida: "${label}".`) };
  }

  const errors = [];
  const out = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !row.length) continue;

    const hasAny = row.some(x => String(x ?? "").trim() !== "");
    if (!hasAny) continue;

    const p = emptyProduct();
    p.template = parseTemplateCell(cellBy(map, row, K.template), allowed);
    p.size = parseSizeCell(cellBy(map, row, K.size));
    p.nombre = (cellBy(map, row, K.nombre) ?? "").toString().trim();

    p.efectivo = parseNumberCell(cellBy(map, row, K.efectivo));
    // ahora, antes y cuota se calculan automáticamente a partir del precio efectivo
    p.ahora = computePrecioNormal(p.efectivo);
    p.antes = computePrecioAntes(p.ahora);
    p.cuota = computeCuotaDesdeEfectivo(p.efectivo);

    const qtyN = parseInt(String(cellBy(map, row, K.qty) ?? "").replace(/[^\d]/g, ""), 10);
    p.qty = Number.isFinite(qtyN) ? qtyN : 0;

    p.useVig = truthyCell(cellBy(map, row, K.useVig));
    p.vigStart = p.useVig ? parseDateCell(cellBy(map, row, K.vigStart)) : "";
    p.vigEnd = p.useVig ? parseDateCell(cellBy(map, row, K.vigEnd)) : "";

    const rowErrs = [];
    if (!p.template) rowErrs.push(`Plantilla inválida. Usa solo el nombre (sin .svg). Permitidas: ${allowedBases.join(", ")}.`);
    if (!p.size) rowErrs.push("Tamaño inválido. Recomendado: 1/4, MEDIA HORIZONTAL, CARTA COMPLETA, MINI.");

    validateProductData(p).forEach(e => rowErrs.push(e));

    if (rowErrs.length) errors.push(`Fila ${r + 1}: ${rowErrs.join(" ")}`);
    else out.push(p);
  }

  if (errors.length) return { products: [], errors };
  if (!out.length) return { products: [], errors: ["No hay filas válidas para importar."] };

  return { products: out, errors: [] };
}

async function readExcelFile(file) {
  if (!file) throw new Error("Archivo vacío.");
  if (file.size > CONFIG.limits.maxExcelBytes) throw new Error("Archivo demasiado grande.");

  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });

  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("El archivo no contiene hojas.");

  const ws = wb.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
}

function setBtnLoading(btn, loading) {
  if (!btn) return;
  if (loading) {
    if (!btn.dataset.orig) btn.dataset.orig = btn.innerHTML;
    btn.innerHTML = `<span class="spin" aria-hidden="true"></span>`;
    btn.disabled = true;
    return;
  }
  if (btn.dataset.orig) btn.innerHTML = btn.dataset.orig;
  btn.disabled = false;
}

function showImportErrors(errs) {
  const body = document.createElement("div");

  body.appendChild(buildTextBlock([
    "El archivo tiene errores. No se creó ningún producto."
  ]));

  const pill = document.createElement("div");
  pill.className = "pill";
  pill.textContent = "Corrige y reintenta";
  pill.style.marginTop = "10px";
  body.appendChild(pill);

  body.appendChild(buildErrorList(errs.slice(0, CONFIG.limits.maxExcelErrorsShown)));

  if (errs.length > CONFIG.limits.maxExcelErrorsShown) {
    const hint = document.createElement("div");
    hint.className = "modalText";
    hint.style.marginTop = "10px";
    hint.style.color = "#64748b";
    hint.textContent = `Se muestran ${CONFIG.limits.maxExcelErrorsShown} errores. Corrige el Excel y vuelve a importar.`;
    body.appendChild(hint);
  }

  openModal({
    title: "Importación rechazada",
    bodyNode: body,
    actions: [{ text: "Cerrar", className: "btnNeutral", onClick: closeModal }]
  });
}

function showImportSuccess(count) {
  openModal({
    title: "Importación completada",
    bodyNode: buildTextBlock([`Se importaron ${count} producto(s) correctamente.`]),
    actions: [{ text: "OK", className: "btnSuccess", onClick: closeModal }]
  });
}

function askImportModeIfNeeded(onChoose) {
  const st = window.__APP_STATE__;
  if (st.products.length === 0) {
    onChoose("merge");
    return;
  }

  const body = document.createElement("div");
  body.appendChild(buildTextBlock([
    `Ya tienes ${st.products.length} producto(s) guardado(s).`,
    "¿Qué deseas hacer?"
  ]));

  const pills = document.createElement("div");
  pills.style.marginTop = "10px";

  const p1 = document.createElement("span");
  p1.className = "pill";
  p1.textContent = "Mantener y agregar";

  const p2 = document.createElement("span");
  p2.className = "pill";
  p2.textContent = "Reemplazar todo";

  pills.appendChild(p1);
  pills.appendChild(p2);
  body.appendChild(pills);

  openModal({
    title: "Importación masiva",
    bodyNode: body,
    actions: [
      { text: "Cancelar", className: "btnNeutral", onClick: closeModal },
      { text: "Reemplazar todo", className: "btnNeutral", onClick: () => { closeModal(); onChoose("replace"); } },
      { text: "Mantener y agregar", className: "btnSuccess", onClick: () => { closeModal(); onChoose("merge"); } }
    ]
  });
}

export async function handleImportFile(file) {
  const st = window.__APP_STATE__;
  if (!file) return;
  if (st.importing) return;

  st.importing = true;
  setBtnLoading(document.getElementById("btnImport"), true);

  try {
    const rows = await readExcelFile(file);
    const parsed = parseExcelRowsToProducts(rows);

    if (parsed.errors?.length) {
      showImportErrors(parsed.errors);
      return;
    }

    askImportModeIfNeeded((mode) => {
      const nowText = formatDateTimeNow();
      const base = (mode === "replace") ? [] : [...st.products];

      const newOnes = parsed.products.map(p => {
        const pp = { ...p };
        pp.id = st.domain.uid();
        pp.impresionAt = nowText;
        pp.colorIdx = allocateColorIdx(base);
        base.push(pp);
        return pp;
      });

      if (mode === "replace") {
        st.products = newOnes;
        st.caches.templateTextCache.clear();
        st.caches.renderCache.clear();
        st.caches.imgDimCache.clear();
        st.previewSlotsByProduct.clear();
        st.expandedId = null;
        st.selectedProductId = null;
      } else {
        st.products = [...st.products, ...newOnes];
      }

      const firstId = newOnes[0]?.id || null;
      if (firstId) {
        st.selectedProductId = firstId;
        st.expandedId = firstId;
      }

      normalizeExistingState();
      st.ui.updateTopButtonsVisibility();
      renderList();
      scheduleRebuild();
      requestAnimationFrame(() => applySelectionHighlight());
      requestSave();

      showImportSuccess(newOnes.length);
    });
  } catch (e) {
    console.error(e);
    openModal({
      title: "Error al importar",
      bodyNode: buildTextBlock([
        "No se pudo leer el archivo.",
        "Asegúrate que sea Excel (.xlsx/.xls) y que tenga encabezados correctos."
      ]),
      actions: [{ text: "Cerrar", className: "btnNeutral", onClick: closeModal }]
    });
  } finally {
    st.importing = false;
    setBtnLoading(document.getElementById("btnImport"), false);
    document.getElementById("fileImport").value = "";
  }
}

// ── Helpers para inyectar dataValidations en el ZIP del XLSX ──────────────────

function _xmlAttr(s) {
  return String(s).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
function _xmlText(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
function _buildDvXml(validations) {
  const items = validations.map(v =>
    `<dataValidation type="list" sqref="${v.sqref}" showDropDown="0" showErrorMessage="1" errorTitle="${_xmlAttr(v.errorTitle)}" error="${_xmlAttr(v.error)}"><formula1>${_xmlText(v.formula1)}</formula1></dataValidation>`
  ).join("");
  return `<dataValidations count="${validations.length}">${items}</dataValidations>`;
}
async function _loadJSZip() {
  if (window.JSZip) return window.JSZip;
  await new Promise((ok, fail) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js";
    s.onload = ok; s.onerror = fail;
    document.head.appendChild(s);
  });
  return window.JSZip;
}
async function _injectValidations(xlsxArr, validations) {
  const JSZip = await _loadJSZip();
  const zip   = await JSZip.loadAsync(xlsxArr);
  const entry = zip.file("xl/worksheets/sheet1.xml");
  if (!entry) throw new Error("sheet1.xml not found");

  // Leer en binario y decodificar con UTF-8 para no corromper caracteres especiales
  const bytes    = await entry.async("uint8array");
  const xml      = new TextDecoder("utf-8").decode(bytes);
  const dvXml    = _buildDvXml(validations);
  // dataValidations debe ir justo después de </sheetData> (antes de pageMargins)
  const modified = xml.includes("<dataValidations")
    ? xml.replace(/<dataValidations[\s\S]*?<\/dataValidations>/, dvXml)
    : xml.replace("</sheetData>", "</sheetData>" + dvXml);

  // Escribir de vuelta en bytes UTF-8
  zip.file("xl/worksheets/sheet1.xml", new TextEncoder().encode(modified));
  return zip.generateAsync({ type: "arraybuffer" });
}
function _triggerDownload(buffer, filename) {
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ── Función principal ──────────────────────────────────────────────────────────

export async function downloadExcelTemplate() {
  if (!window.XLSX) {
    toast.error("No se pudo cargar XLSX. Revisa el CDN.");
    return;
  }

  const enabledTemplates = TEMPLATES.filter(t => t.enabled);
  const templateLabels   = enabledTemplates.map(t => t.label);

  const headers = ["Plantilla", "Tamaño", "Nombre", "Precio Efectivo", "Cantidad", "AgregarVigencia", "VigenciaInicio", "VigenciaFin"];
  const examples = [
    ["Normal",       "1/4 (4 por hoja)",                    "AUDÍFONOS BLUETOOTH [DAF4561546401]",      "136",   "4",  "NO", "",           ""],
    ["Promoción",    "Media hoja horizontal (2 por hoja)",   "LAPTOP DELL I5 8GB 256SSD [DAF4561546402]","8181",  "2",  "SI", "01/01/2026", "31/01/2026"],
    ["Liquidación",  "1/4 (4 por hoja)",                    "TENIS NIKE AIR MAX [DAF4561546403]",        "909",   "4",  "SI", "05/02/2026", "20/02/2026"],
    ["Super Oferta", "Carta completa (1 por hoja)",          "SMART TV 55 PULGADAS [DAF4561546404]",     "11818", "1",  "SI", "01/03/2026", "15/03/2026"],
    ["Pequeño",      "Mini (28 por hoja)",                   "PILA DURACELL AA x4 [DAF4561546405]",       "45",   "28", "NO", "",           ""],
    ["Normal",       "1/4 (4 por hoja)",                    "AUDÍFONOS GAMER RGB [DAF4561546406]",       "545",  "4",  "SI", "01/04/2026", "30/04/2026"]
  ];

  const wsImportar = XLSX.utils.aoa_to_sheet([headers, ...examples]);
  wsImportar["!cols"] = [
    { wch: 14 }, { wch: 18 }, { wch: 44 }, { wch: 14 },
    { wch: 10 }, { wch: 18 }, { wch: 16 }, { wch: 16 }
  ];

  // Forzar columnas Plantilla (A) y Tamaño (B) como texto para evitar auto-conversión de Excel
  const rangeI = XLSX.utils.decode_range(wsImportar["!ref"]);
  for (let R = 1; R <= rangeI.e.r; R++) {
    [0, 1].forEach(C => {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      if (wsImportar[addr]) { wsImportar[addr].t = "s"; wsImportar[addr].z = "@"; }
    });
  }

  const allowedLabels = templateLabels.join(" | ");
  const notes = [
    ["NOTAS / AYUDA"],
    [""],
    ["Objetivo:", "Rellenar la hoja 'Importar' y luego usar el botón 'Importar Excel' en el sistema."],
    [""],
    ["Columnas requeridas:", "Plantilla, Tamaño, Nombre, Precio Efectivo, Cantidad"],
    ["Columnas automáticas:", "Precio Normal (+10%), Precio Antes y Cuota Semanal se calculan automáticamente."],
    [""],
    ["PLANTILLA:", "Selecciona del desplegable. Ej: Normal, Promoción, Liquidación"],
    ["Plantillas disponibles en este sistema:", allowedLabels || "Normal | Promoción | Liquidación | Super Oferta | Pequeño"],
    ["También se aceptan:", "Los nombres internos como normal1, promocion1, liquidacion1, oferta1, pequeño1"],
    [""],
    ["TAMAÑO:", "Selecciona del desplegable. Son los mismos nombres que en el formulario del sistema."],
    ["Opciones:", "1/4 (4 por hoja) | Media hoja horizontal (2 por hoja) | Carta completa (1 por hoja) | Mini (28 por hoja)"],
    [""],
    ["PRECIO EFECTIVO:", `Solo número entero (precio de contado), máximo ${CONFIG.limits.maxDigits} dígitos. Ej: 9090`],
    ["CANTIDAD:", "Entero > 0. Ej: 4"],
    [""],
    ["AGREGAR VIGENCIA:", "SI / NO. Si es SI, VigenciaInicio y VigenciaFin son obligatorias."],
    ["FECHAS (VigenciaInicio/VigenciaFin):", "Formato recomendado: DD/MM/AAAA. Ej: 31/01/2026"],
    ["Reglas de fechas:", "VigenciaFin no puede ser menor que VigenciaInicio."],
    [""],
    ["Reglas de precio:", "El sistema calcula Precio Normal (Efectivo +10%), Precio Antes y Cuota Semanal automáticamente."],
    [""],
    ["Importante:", "Si una fila tiene error, se rechaza todo el archivo (no se crea nada)."]
  ];

  const wsNotas = XLSX.utils.aoa_to_sheet(notes);
  wsNotas["!cols"] = [{ wch: 30 }, { wch: 78 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsImportar, "Importar");
  XLSX.utils.book_append_sheet(wb, wsNotas, "Notas");

  // SheetJS community no soporta dataValidations → inyectamos el XML manualmente en el ZIP
  const validations = [
    {
      sqref: "A2:A501",
      formula1: `"${templateLabels.join(",")}"`,
      errorTitle: "Plantilla inválida",
      error: "Selecciona una plantilla de la lista"
    },
    {
      sqref: "B2:B501",
      formula1: '"1/4 (4 por hoja),Media hoja horizontal (2 por hoja),Carta completa (1 por hoja),Mini (28 por hoja)"',
      errorTitle: "Tamaño inválido",
      error: "Selecciona un tamaño de la lista"
    }
  ];

  try {
    const xlsxArr = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const modified = await _injectValidations(xlsxArr, validations);
    _triggerDownload(modified, "plantilla_importacion_etiquetas.xlsx");
  } catch (e) {
    console.warn("No se pudo agregar desplegables, descargando sin ellos:", e);
    XLSX.writeFile(wb, "plantilla_importacion_etiquetas.xlsx");
  }
}
