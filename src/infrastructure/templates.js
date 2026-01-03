import { sanitizeSvgText, assertSafeTemplatePath, enforceAllowedTemplate } from "./svgRenderer.js";

export async function loadTemplateText({ file, allowedTemplates, templateTextCache }) {
  const safe = assertSafeTemplatePath(file);
  if (!safe) throw new Error("Plantilla inválida o no permitida.");

  enforceAllowedTemplate(safe, allowedTemplates);

  const cached = templateTextCache.get(safe);
  if (cached) return cached;

  const res = await fetch(safe, { cache: "no-store" });
  if (!res.ok) throw new Error("No se pudo cargar " + safe + ". Debe estar junto al HTML.");

  const txt = await res.text();
  const clean = sanitizeSvgText(txt);
  if (!clean) throw new Error("El SVG no es válido o fue bloqueado por seguridad.");

  templateTextCache.set(safe, clean);
  return clean;
}
