/**
 * Toast notifications — wrapper de Notyf.
 * Notyf se carga como script global (window.Notyf) desde /resource/vendor/notyf.min.js
 */

let _notyf = null;

function getNotyf() {
  if (!_notyf) {
    if (typeof window.Notyf === "undefined") return null;
    _notyf = new window.Notyf({
      duration: 4000,
      ripple: true,
      dismissible: true,
      position: { x: "right", y: "top" },
      types: [
        {
          type: "success",
          background: "#16a34a",
          icon: {
            className: "",
            tagName: "span",
            text: "✓"
          }
        },
        {
          type: "error",
          background: "#b91c1c",
          icon: {
            className: "",
            tagName: "span",
            text: "✕"
          }
        },
        {
          type: "info",
          background: "#2563eb",
          icon: {
            className: "",
            tagName: "span",
            text: "ℹ"
          }
        }
      ]
    });
  }
  return _notyf;
}

export const toast = {
  success(msg) {
    const n = getNotyf();
    if (n) n.success(msg);
    else console.log("[Toast] " + msg);
  },
  error(msg) {
    const n = getNotyf();
    if (n) n.error(msg);
    else console.error("[Toast] " + msg);
  },
  info(msg) {
    const n = getNotyf();
    if (n) n.open({ type: "info", message: msg });
    else console.info("[Toast] " + msg);
  }
};
