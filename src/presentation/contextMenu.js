import { $ } from "./dom.js";
import { pairColor } from "./selection.js";
import { renderList } from "./list.js";
import { applySelectionHighlight } from "./selection.js";
import { requestSave } from "../infrastructure/storage.js";
import { UI } from "./ui.js";

export function hideContextMenu() {
  const st = window.__APP_STATE__;
  st.ctxPid = null;
  const menu = $("ctxMenu");
  menu.style.display = "none";
  menu.setAttribute("aria-hidden", "true");
}

function placeMenu(x, y) {
  const menu = $("ctxMenu");
  const pad = 10;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  menu.style.display = "block";
  menu.style.left = "0px";
  menu.style.top = "0px";

  const rect = menu.getBoundingClientRect();
  let nx = x;
  let ny = y;

  if (nx + rect.width + pad > vw) nx = vw - rect.width - pad;
  if (ny + rect.height + pad > vh) ny = vh - rect.height - pad;
  if (nx < pad) nx = pad;
  if (ny < pad) ny = pad;

  menu.style.left = nx + "px";
  menu.style.top = ny + "px";
}

export function showContextMenu(pid, x, y) {
  const st = window.__APP_STATE__;
  if (!pid || !UI.isListView()) return;

  st.ctxPid = pid;
  const p = st.products.find(pp => pp.id === pid);
  const name = p?.nombre || "Producto";

  const c = pairColor(pid);
  $("ctxTop").style.setProperty("--pairColor", c);
  $("ctxTitle").textContent = name;

  st.selectedProductId = pid;
  st.expandedId = pid;

  renderList();
  requestAnimationFrame(() => applySelectionHighlight());

  placeMenu(x, y);
  $("ctxMenu").setAttribute("aria-hidden", "false");
  requestSave();
}
