export const $ = (id) => document.getElementById(id);

export const Dom = Object.freeze({
  qs: (sel, root = document) => root.querySelector(sel),
  qsa: (sel, root = document) => Array.from(root.querySelectorAll(sel)),
  on: (el, evt, handler, opts) => el && el.addEventListener(evt, handler, opts)
});

export function cssEsc(s) {
  try {
    return (window.CSS && CSS.escape)
      ? CSS.escape(String(s))
      : String(s).replace(/[^a-zA-Z0-9_\-]/g, "\\$&");
  } catch {
    return String(s);
  }
}

export function escapeHtml(s) {
  return (s ?? "").toString()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
