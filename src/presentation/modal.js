import { $, Dom } from "./dom.js";

function clearModal() {
  $("modalBody").textContent = "";
  $("modalActions").textContent = "";
}

export function closeModal() {
  $("modalOverlay").style.display = "none";
  $("modalOverlay").setAttribute("aria-hidden", "true");
  clearModal();
}

function addActionButton(action) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = action.className || "btnNeutral";
  btn.textContent = action.text || "OK";
  btn.addEventListener("click", () => action.onClick && action.onClick());
  $("modalActions").appendChild(btn);
}

export function openModal({ title, bodyNode, actions }) {
  $("modalTitle").textContent = title || "Mensaje";

  clearModal();
  if (bodyNode) $("modalBody").appendChild(bodyNode);

  (actions || []).forEach(addActionButton);

  $("modalOverlay").style.display = "flex";
  $("modalOverlay").setAttribute("aria-hidden", "false");
}

export function buildTextBlock(lines) {
  const wrap = document.createElement("div");
  wrap.className = "modalText";
  (lines || []).forEach((t) => {
    const p = document.createElement("div");
    p.textContent = t;
    wrap.appendChild(p);
  });
  return wrap;
}

export function buildErrorList(errs) {
  const ul = document.createElement("ul");
  ul.className = "errList";
  (errs || []).forEach((e) => {
    const li = document.createElement("li");
    li.textContent = e;
    ul.appendChild(li);
  });
  return ul;
}

export function wireModalCommonEvents() {
  Dom.on($("modalX"), "click", closeModal);
  Dom.on($("modalOverlay"), "click", (e) => { if (e.target === $("modalOverlay")) closeModal(); });
  Dom.on(document, "keydown", (e) => { if (e.key === "Escape") closeModal(); });
}
