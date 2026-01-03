import { CONFIG, SVG_IDS, SIZE } from "../config/config.js";

export function normalizeText(s) {
  const t = (s ?? "").toString().trim().toLowerCase();
  try { return t.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
  catch { return t; }
}

export function formatThousands(num) {
  try { return Number(num).toLocaleString("en-US"); }
  catch { return String(num || "").replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
}

export function toQuetzales(digits) {
  if (!digits) return "";
  const n = parseInt(digits, 10);
  if (!Number.isFinite(n)) return "";
  return "Q " + formatThousands(n);
}

function pad2(n) { return String(n).padStart(2, "0"); }

export function formatDateTimeNow() {
  const dt = new Date();
  const d = pad2(dt.getDate());
  const m = pad2(dt.getMonth() + 1);
  const y = dt.getFullYear();
  const hh = pad2(dt.getHours());
  const mm = pad2(dt.getMinutes());
  return `${d}/${m}/${y} ${hh}:${mm}`;
}

export function formatDMY(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function createCappedCache(maxEntries) {
  const map = new Map();
  return {
    get(k) {
      if (!map.has(k)) return undefined;
      const v = map.get(k);
      map.delete(k);
      map.set(k, v);
      return v;
    },
    set(k, v) {
      if (map.has(k)) map.delete(k);
      map.set(k, v);
      while (map.size > maxEntries) {
        const firstKey = map.keys().next().value;
        map.delete(firstKey);
      }
    },
    clear() { map.clear(); }
  };
}

/* ===== Seguridad SVG ===== */

export function sanitizeSvgText(svgText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, "image/svg+xml");

  if (doc.querySelector("parsererror")) return "";
  const svg = doc.querySelector("svg");
  if (!svg) return "";

  ["script", "foreignObject", "iframe", "object", "embed"].forEach(tag => {
    doc.querySelectorAll(tag).forEach(n => n.remove());
  });

  doc.querySelectorAll("*").forEach((el) => {
    Array.from(el.attributes || []).forEach(attr => {
      const name = (attr.name || "").toLowerCase();
      const value = (attr.value || "").toString().trim().toLowerCase();

      if (name.startsWith("on")) el.removeAttribute(attr.name);

      const isHref = (name === "href" || name.endsWith(":href"));
        if (isHref) {
          // Bloquea javascript:, http(s): y data: que NO sea imagen segura
          const isBadProto =
            value.startsWith("javascript:") ||
            value.startsWith("http:") ||
            value.startsWith("https:");

          // Solo permitir data:image/(png|jpeg|jpg|webp|gif)
          const isAllowedDataImage =
            value.startsWith("data:image/png") ||
            value.startsWith("data:image/jpeg") ||
            value.startsWith("data:image/jpg") ||
            value.startsWith("data:image/webp") ||
            value.startsWith("data:image/gif");

          if (isBadProto) {
            el.removeAttribute(attr.name);
          } else if (value.startsWith("data:") && !isAllowedDataImage) {
            el.removeAttribute(attr.name);
          }
        }



      if (name === "style" && value.includes("url(") && (
        value.includes("http") ||
        value.includes("javascript") ||
        value.includes("data:")
      )) {
        el.removeAttribute(attr.name);
      }


    });
  });

  return new XMLSerializer().serializeToString(svg);
}

export function assertSafeTemplatePath(file) {
  const f = (file ?? "").toString().trim();
  if (!f) return "";
  if (/^[a-z]+:\/\//i.test(f)) return "";
  if (/^data:/i.test(f)) return "";
  return f;
}

export function enforceAllowedTemplate(template, allowedTemplates) {
  if (!Array.isArray(allowedTemplates) || !allowedTemplates.length) return;
  const ok = allowedTemplates.includes(template);
  if (!ok) throw new Error("Plantilla no permitida (whitelist).");
}

/* ===== SVG utils ===== */

function cssEsc(s) {
  try { return (window.CSS && CSS.escape) ? CSS.escape(String(s)) : String(s).replace(/[^a-zA-Z0-9_\-]/g, "\\$&"); }
  catch { return String(s); }
}

function parseSvgTextToNode(svgText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, "image/svg+xml");
  const svg = doc.querySelector("svg");
  if (!svg) return null;

  // Importar al documento actual (clave para estilos/mediciones)
  return document.importNode(svg, true);
}

function ensureHiddenSvgHost() {
  let host = document.getElementById("__svgHostHidden");
  if (!host) {
    host = document.createElement("div");
    host.id = "__svgHostHidden";
    host.style.position = "absolute";
    host.style.left = "-99999px";
    host.style.top = "-99999px";
    host.style.width = "0";
    host.style.height = "0";
    host.style.overflow = "hidden";
    document.body.appendChild(host);
  }
  return host;
}



function getSvgViewBox(svg) {
  const vb = svg.viewBox && svg.viewBox.baseVal;
  if (vb && vb.width && vb.height) return { x: vb.x, y: vb.y, w: vb.width, h: vb.height };
  const w = parseFloat(svg.getAttribute("width") || "0") || 0;
  const h = parseFloat(svg.getAttribute("height") || "0") || 0;
  return { x: 0, y: 0, w: w || 1000, h: h || 1000 };
}

function clearSvgText(el) {
  if (!el) return;
  while (el.firstChild) el.removeChild(el.firstChild);
  el.textContent = "";
}

function setSvgText(el, txt) {
  if (!el) return;
  const t = (txt ?? "").toString();
  if (!t.trim()) { clearSvgText(el); return; }
  const tspan = el.querySelector ? el.querySelector("tspan") : null;
  if (tspan) tspan.textContent = t;
  else el.textContent = t;
}

function findByAnyId(svg, ids) {
  for (const id of ids) {
    const el = svg.querySelector(`#${cssEsc(id)}`);
    if (el) return el;
  }
  return null;
}

function replaceTokenInSvg(svg, token, value) {
  if (!svg || !token) return;

  svg.querySelectorAll("tspan").forEach(ts => {
    if (ts.textContent && ts.textContent.includes(token)) {
      ts.textContent = ts.textContent.split(token).join(value);
    }
  });

  svg.querySelectorAll("text").forEach(t => {
    if (t.querySelector("tspan")) return;
    if (t.textContent && t.textContent.includes(token)) {
      t.textContent = t.textContent.split(token).join(value);
    }
  });
}

function getFontSizePx(textEl) {
  const fsAttr = textEl.getAttribute("font-size");
  if (fsAttr) {
    const n = parseFloat(fsAttr);
    if (Number.isFinite(n)) return n;
  }
  const cs = window.getComputedStyle(textEl);
  const n = parseFloat(cs.fontSize || "0");
  return Number.isFinite(n) && n > 0 ? n : 16;
}

function getTextBoxById(svg, textId) {
  const box = svg.querySelector(`#box_${cssEsc(textId)}`);
  if (box && typeof box.getBBox === "function") {
    const b = box.getBBox();
    return { x: b.x, y: b.y, w: b.width, h: b.height, cx: b.x + b.width / 2, cy: b.y + b.height / 2 };
  }
  const vb = getSvgViewBox(svg);
  const w = vb.w * 0.85;
  const h = vb.h * 0.18;
  return { x: vb.x + (vb.w - w) / 2, y: vb.y + vb.h * 0.18, w, h, cx: vb.x + vb.w / 2, cy: vb.y + vb.h * 0.27 };
}

function setWrappedTextInBox(textEl, text, box, opts = {}) {
  const NS = "http://www.w3.org/2000/svg";
  const t = (text || "").trim();
  if (!t) { clearSvgText(textEl); return; }

  const words = t.split(/\s+/).filter(Boolean);
  const lineHeightEm = opts.lineHeightEm ?? 1.10;
  const maxWidth = box.w;

  const fontPx = getFontSizePx(textEl);
  const maxLines = Math.max(1, Math.floor(box.h / (fontPx * lineHeightEm)));

  const cx = box.cx;
  const cy = box.cy;

  textEl.setAttribute("text-anchor", "middle");
  textEl.setAttribute("x", cx);
  textEl.setAttribute("y", cy);

  while (textEl.firstChild) textEl.removeChild(textEl.firstChild);

  const meas = document.createElementNS(NS, "tspan");
  meas.setAttribute("x", cx);
  textEl.appendChild(meas);

  let lines = [];
  let line = [];

  for (let i = 0; i < words.length; i++) {
    line.push(words[i]);
    meas.textContent = line.join(" ");
    if (meas.getComputedTextLength() > maxWidth && line.length > 1) {
      line.pop();
      lines.push(line.join(" "));
      line = [words[i]];
      if (lines.length === maxLines) break;
      meas.textContent = line.join(" ");
    }
  }
  if (lines.length < maxLines && line.length) lines.push(line.join(" "));

  if (words.length && lines.length === maxLines) {
    let last = lines[lines.length - 1];
    meas.textContent = last;
    while (meas.getComputedTextLength() > maxWidth && last.length > 1) {
      last = last.slice(0, -2) + "…";
      meas.textContent = last;
    }
    lines[lines.length - 1] = last;
  }

  while (textEl.firstChild) textEl.removeChild(textEl.firstChild);

  const n = Math.max(lines.length, 1);
  const totalEm = (n - 1) * lineHeightEm;
  const firstDy = -totalEm / 2;

  lines.forEach((txt, idx) => {
    const ts = document.createElementNS(NS, "tspan");
    ts.setAttribute("x", cx);
    ts.setAttribute("dy", (idx === 0 ? firstDy : lineHeightEm) + "em");
    ts.textContent = txt;
    textEl.appendChild(ts);
  });
}

async function svgNodeToPng(svgNode, targetWidthPx = 2200) {
  const serializer = new XMLSerializer();
  let svgText = serializer.serializeToString(svgNode);

  if (!svgText.includes('xmlns="http://www.w3.org/2000/svg"')) {
    svgText = svgText.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  if (!svgText.includes('xmlns:xlink="http://www.w3.org/1999/xlink"')) {
    svgText = svgText.replace("<svg", '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
  }

  const vb = getSvgViewBox(svgNode);
  const w = vb.w || parseFloat(svgNode.getAttribute("width") || "408");
  const h = vb.h || parseFloat(svgNode.getAttribute("height") || "528");

  const scale = targetWidthPx / w;
  const cw = Math.round(w * scale);
  const ch = Math.round(h * scale);

  const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const img = new Image();
  img.crossOrigin = "anonymous";

  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = url;
  });

  const canvas = document.getElementById("workCanvas");
  canvas.width = cw;
  canvas.height = ch;

  const ctx = canvas.getContext("2d");
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, cw, ch);
  ctx.drawImage(img, 0, 0, cw, ch);

  URL.revokeObjectURL(url);
  return canvas.toDataURL("image/png");
}

async function rotatePng90(pngDataUrl) {
  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = pngDataUrl;
  });

  const canvas = document.getElementById("workCanvas");
  canvas.width = img.height;
  canvas.height = img.width;

  const ctx = canvas.getContext("2d");
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.translate(canvas.width, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(img, 0, 0);

  return canvas.toDataURL("image/png");
}

function renderKey(p) {
  return JSON.stringify({
    template: p.template,
    nombre: (p.nombre || "").trim().toUpperCase(),
    antes: p.antes,
    ahora: p.ahora,
    cuota: p.cuota,
    useVig: !!p.useVig,
    vigStart: p.vigStart || "",
    vigEnd: p.vigEnd || "",
    impresionAt: (p.impresionAt || "").trim()
  });
}

export async function renderProductToPngs(p) {
  const st = window.__APP_STATE__;
  const key = renderKey(p);

  const cached = st.caches.renderCache.get(key);
  if (cached) return cached;

  const svgText = await st.services.loadTemplateText(p.template);
  const svg = parseSvgTextToNode(svgText);
  if (!svg) throw new Error("El archivo no contiene un <svg> válido: " + p.template);

  // ✅ Montar en DOM para mediciones reales (tspan/getBBox/getComputedTextLength)
  const host = ensureHiddenSvgHost();
  host.appendChild(svg);
  svg.getBoundingClientRect(); // fuerza layout

  const upperName = (p.nombre || "").trim().toUpperCase();
  const antes = toQuetzales(p.antes);
  const ahora = toQuetzales(p.ahora);
  const cuota = toQuetzales(p.cuota);

  // ===== Nombre (wrap) =====
  const nameEl = svg.querySelector("#" + cssEsc(SVG_IDS.nombre));
  if (nameEl) {
    const box = getTextBoxById(svg, SVG_IDS.nombre);
    setWrappedTextInBox(nameEl, upperName, box, { lineHeightEm: 1.10 });
  } else {
    console.warn("No encontré el ID del nombre:", SVG_IDS.nombre);
  }

  // ===== Precios =====
  setSvgText(svg.querySelector("#" + cssEsc(SVG_IDS.antes)), antes);
  setSvgText(svg.querySelector("#" + cssEsc(SVG_IDS.ahora)), ahora);
  setSvgText(svg.querySelector("#" + cssEsc(SVG_IDS.cuota)), cuota);

  // ===== Vigencia =====
  const vigEl = svg.querySelector("#" + cssEsc(SVG_IDS.vigencia));
  if (p.useVig && p.vigStart && p.vigEnd) {
    const txt = `* VÁLIDO DESDE ${formatDMY(p.vigStart)} AL ${formatDMY(p.vigEnd)}`;
    setSvgText(vigEl, txt);
    replaceTokenInSvg(svg, "[Fecha_vigencia]", txt);
  } else {
    clearSvgText(vigEl);
    replaceTokenInSvg(svg, "[Fecha_vigencia]", "");
  }

  // ===== Impresión =====
  const impTxt = (p.impresionAt && p.impresionAt.trim())
    ? p.impresionAt.trim()
    : formatDateTimeNow();

  const impEl = findByAnyId(svg, SVG_IDS.impresionCandidates);
  setSvgText(impEl, impTxt);

  replaceTokenInSvg(svg, "[Fecha_impresion]", impTxt);
  replaceTokenInSvg(svg, "[fecha_impresion]", impTxt);
  replaceTokenInSvg(svg, "[FECHA_IMPRESION]", impTxt);

  // ===== Rasterizar =====
  const pngNormal = await svgNodeToPng(svg, 2200);
  const pngRotated = await rotatePng90(pngNormal);

  // ✅ Limpieza (no acumular SVGs)
  svg.remove();

  const out = { pngNormal, pngRotated };
  st.caches.renderCache.set(key, out);
  return out;
}


