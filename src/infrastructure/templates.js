import { sanitizeSvgText, assertSafeTemplatePath, enforceAllowedTemplate } from "./svgRenderer.js";
const SVG_BASE_URL = new URL("../../resource/svg/", import.meta.url);


export async function loadTemplateText({ file, allowedTemplates, templateTextCache }) {
  const safe = assertSafeTemplatePath(file);
  if (!safe) throw new Error("Plantilla inválida o no permitida.");

  enforceAllowedTemplate(safe, allowedTemplates);

  const cached = templateTextCache.get(safe);
  if (cached) return cached;

  const url = new URL(safe, SVG_BASE_URL);

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`No pude cargar la plantilla: ${safe}`);


  const txt = await res.text();
  const clean = sanitizeSvgText(txt);
  if (!clean) throw new Error("El SVG no es válido o fue bloqueado por seguridad.");

  templateTextCache.set(safe, clean);
  return clean;
}

