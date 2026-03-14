import { CONFIG, TEMPLATES } from "./config/config.js";
import { emptyProduct } from "./domain/product.js";
import { createCappedCache, formatDateTimeNow } from "./infrastructure/svgRenderer.js";
import { loadTemplateText } from "./infrastructure/templates.js";
import { UI, wireBeforeUnloadGuard, wireGlobalCloseContextMenu } from "./presentation/ui.js";
import { wireModalCommonEvents, openModal, closeModal } from "./presentation/modal.js";
import { renderList, findListItem, updateSelectionCount } from "./presentation/list.js";
import { scheduleRebuild, zoomIn, zoomOut, zoomReset } from "./presentation/preview.js";
import { validateDraft, applyVigEndConstraint } from "./presentation/form.js";
import { showContextMenu, hideContextMenu } from "./presentation/contextMenu.js";
import { scheduleHover, scheduleHoverClear, highlightProductInList, markSelectedInList } from "./presentation/selection.js";
import { openAddForm, backToList, onEditProduct, onDeleteProduct, saveDraft, resetAll, uid, allocateColorIdx } from "./application/actions.js";
import { loadState, normalizeExistingState, hasWork, requestSave } from "./infrastructure/storage.js";
import { handleImportFile, downloadExcelTemplate } from "./infrastructure/excel.js";
import { exportPdfWithLoading, printViaPdf } from "./infrastructure/pdf.js";
import { startTour } from "./presentation/tour.js";

// Genera las opciones del select #fTemplate desde TEMPLATES en config.js.
// El HTML solo necesita el <option> placeholder — todo lo demás viene de aquí.
function applyTemplateConfig() {
  const sel = document.getElementById("fTemplate");
  if (!sel) return;

  // Elimina todas las opciones con valor (conserva solo el placeholder vacío)
  Array.from(sel.options).forEach(opt => { if (opt.value) opt.remove(); });

  // Genera las opciones habilitadas en el orden definido en config
  TEMPLATES.filter(t => t.enabled).forEach(({ file, label }) => {
    const opt = document.createElement("option");
    opt.value = file;
    opt.textContent = label;
    sel.appendChild(opt);
  });
}

function getAllowedTemplatesFromDom() {
  // Incluye TODAS las plantillas (incluso las desactivadas) para que los productos
  // guardados con plantillas desactivadas sigan renderizando correctamente.
  return TEMPLATES.map(t => t.file);
}

function buildServices() {
  return {
    loadTemplateText: async (file) => loadTemplateText({
      file,
      allowedTemplates: getAllowedTemplatesFromDom(),
      templateTextCache: window.__APP_STATE__.caches.templateTextCache
    })
  };
}

function buildAppState() {
  const st = {
    config: CONFIG,

    products: [],
    editingId: null,
    formMode: "add",
    draft: emptyProduct(),

    expandedId: null,
    selectedProductId: null,
    filterText: "",

    pendingFocus: null,

    exporting: false,
    importing: false,
    renderGeneration: 0,

    previewSlotsByProduct: new Map(),

    timers: { save: null, preview: null, hoverIn: null, hoverOut: null },

    hoverPid: null,
    activeItemEl: null,
    ctxPid: null,

    caches: {
      templateTextCache: createCappedCache(CONFIG.limits.maxTemplateCache),
      renderCache: createCappedCache(CONFIG.limits.maxRenderCache),
      imgDimCache: createCappedCache(CONFIG.limits.maxImgDimCache)
    },

    services: null,

    time: { formatDateTimeNow },

    domain: {
      emptyProduct,
      uid,
      allocateColorIdx
    },

    ui: UI,
    presentation: {
      scheduleHoverClear
    }
  };

  st.services = buildServices();
  return st;
}

function wireContextMenuButtons() {
  document.getElementById("ctxClose").addEventListener("click", (e) => { e.stopPropagation(); hideContextMenu(); });
  document.getElementById("ctxEdit").addEventListener("click", (e) => {
    e.stopPropagation();
    const pid = window.__APP_STATE__.ctxPid;
    hideContextMenu();
    if (pid) onEditProduct(pid);
  });
  document.getElementById("ctxDelete").addEventListener("click", (e) => {
    e.stopPropagation();
    const pid = window.__APP_STATE__.ctxPid;
    hideContextMenu();
    if (pid) onDeleteProduct(pid);
  });
}

function openContactModal() {
  const body = document.createElement("div");
  body.style.cssText = "display:flex;flex-direction:column;gap:16px;";

  // Select tipo
  const tipoWrap = document.createElement("div");

  const tipoLabel = document.createElement("label");
  tipoLabel.htmlFor = "_contactTipo";
  tipoLabel.style.cssText = "display:block;font-size:12px;font-weight:700;color:#374151;margin-bottom:6px;";
  tipoLabel.textContent = "¿En qué podemos ayudarte?";

  const tipoSelect = document.createElement("select");
  tipoSelect.id = "_contactTipo";
  tipoSelect.style.cssText = "width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:12px;font-size:13px;background:#fff;outline:none;color:#111827;";
  [
    ["ayuda",      "🆘  Necesito ayuda con algo"],
    ["sugerencia", "💡  Tengo una sugerencia o mejora"],
    ["problema",   "🐛  Encontré un problema o error"],
    ["pregunta",   "❓  Tengo una pregunta"],
    ["felicitacion","👏  Quiero dar un comentario positivo"],
    ["otro",       "💬  Otro"],
  ].forEach(([val, txt]) => {
    const opt = document.createElement("option");
    opt.value = val;
    opt.textContent = txt;
    tipoSelect.appendChild(opt);
  });

  tipoWrap.appendChild(tipoLabel);
  tipoWrap.appendChild(tipoSelect);

  // Textarea mensaje
  const msgWrap = document.createElement("div");

  const msgLabel = document.createElement("label");
  msgLabel.htmlFor = "_contactMsg";
  msgLabel.style.cssText = "display:block;font-size:12px;font-weight:700;color:#374151;margin-bottom:6px;";
  msgLabel.textContent = "Tu mensaje:";

  const textarea = document.createElement("textarea");
  textarea.id = "_contactMsg";
  textarea.placeholder = "Escribe aquí tu mensaje con el mayor detalle posible…";
  textarea.style.cssText = "width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:12px;font-size:13px;font-family:inherit;resize:vertical;min-height:110px;outline:none;line-height:1.5;";

  textarea.addEventListener("input", () => {
    textarea.style.borderColor = textarea.value.trim() ? "#d1d5db" : "#fca5a5";
  });

  msgWrap.appendChild(msgLabel);
  msgWrap.appendChild(textarea);

  // Nota informativa
  const nota = document.createElement("div");
  nota.style.cssText = "font-size:11px;color:#64748b;display:flex;align-items:center;gap:6px;";
  nota.innerHTML = "<span style='font-size:15px'>📲</span> Al presionar <b>Enviar</b> se abrirá WhatsApp con tu mensaje listo para enviar.";

  body.appendChild(tipoWrap);
  body.appendChild(msgWrap);
  body.appendChild(nota);

  openModal({
    title: "💬 Contacto y ayuda",
    bodyNode: body,
    actions: [
      { text: "Cancelar", className: "btnNeutral", onClick: closeModal },
      {
        text: "Enviar por WhatsApp",
        className: "btnPrimary",
        onClick: () => {
          const msg = textarea.value.trim();
          if (!msg) {
            textarea.style.borderColor = "#fca5a5";
            textarea.focus();
            return;
          }
          const tipo = tipoSelect.options[tipoSelect.selectedIndex].text.replace(/^\S+\s+/, "");
          const texto = `*${tipo}*\n\n${msg}`;
          window.open(`https://wa.me/56355181?text=${encodeURIComponent(texto)}`, "_blank", "noopener,noreferrer");
          closeModal();
        }
      }
    ]
  });

  // Foco en el textarea tras render
  requestAnimationFrame(() => textarea.focus());
}

function confirmTour() {
  const body = document.createElement("div");
  body.style.cssText = "display:flex;flex-direction:column;gap:14px;";

  // Ícono decorativo
  const icon = document.createElement("div");
  icon.style.cssText = "text-align:center;font-size:40px;line-height:1;";
  icon.textContent = "🎯";
  body.appendChild(icon);

  // Descripción
  const desc = document.createElement("div");
  desc.className = "modalText";
  desc.style.cssText = "text-align:center;line-height:1.6;";
  desc.innerHTML =
    "El tutorial te guía paso a paso por <b>todas las funciones</b> del editor.<br>" +
    "Aprenderás a crear etiquetas, elegir plantillas, imprimir y más.<br><br>" +
    "<span style='color:#64748b;font-size:12px'>Dura aproximadamente 2 minutos y puedes cerrarlo en cualquier momento.</span>";
  body.appendChild(desc);

  openModal({
    title: "👋 ¿Quieres iniciar el tutorial?",
    bodyNode: body,
    actions: [
      {
        text: "Ahora no", className: "btnNeutral",
        onClick: () => {
          closeModal();
          // Pulso en el FAB
          const fab = document.getElementById("fabToggle");
          if (fab) {
            fab.classList.remove("pulse");
            void fab.offsetWidth;
            fab.classList.add("pulse");
            fab.addEventListener("animationend", () => fab.classList.remove("pulse"), { once: true });
          }
          // Callout posicionado sobre el FAB
          const tip = document.createElement("div");
          tip.className = "fabCallout";
          tip.textContent = "👆 Pulsa aquí cuando quieras ver el tutorial.";
          document.body.appendChild(tip);
          const dismiss = () => {
            tip.classList.add("out");
            tip.addEventListener("animationend", () => tip.remove(), { once: true });
          };
          setTimeout(dismiss, 4500);
        }
      },
      {
        text: "🚀 Sí, iniciar recorrido",
        className: "btnPrimary",
        onClick: () => { closeModal(); startTour(); }
      }
    ]
  });
}

function wireFabHelp() {
  const fab = document.getElementById("floatingHelp");
  const toggle = document.getElementById("fabToggle");
  const tourBtn = document.getElementById("fabTour");
  if (!fab || !toggle) return;

  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = fab.classList.toggle("open");
    toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    document.getElementById("floatingHelpMenu")?.setAttribute("aria-hidden", isOpen ? "false" : "true");
  });

  document.addEventListener("click", (e) => {
    if (!fab.contains(e.target)) fab.classList.remove("open");
  });

  tourBtn?.addEventListener("click", () => {
    fab.classList.remove("open");
    confirmTour();
  });

  document.getElementById("fabContact")?.addEventListener("click", () => {
    fab.classList.remove("open");
    openContactModal();
  });
}

function wireTopButtons() {
  document.getElementById("btnTour").addEventListener("click", confirmTour);
  document.getElementById("btnShowForm").addEventListener("click", () => { openAddForm(); updateStartHereBadge(); });
  document.getElementById("btnCancel").addEventListener("click", () => { backToList(); updateStartHereBadge(); });
  document.getElementById("btnSave").addEventListener("click", saveDraft);
  document.getElementById("btnResetAll").addEventListener("click", resetAll);
  document.getElementById("btnPrint").addEventListener("click", printViaPdf);
  document.getElementById("btnPdf").addEventListener("click", exportPdfWithLoading);

  document.getElementById("btnZoomIn").addEventListener("click", zoomIn);
  document.getElementById("btnZoomOut").addEventListener("click", zoomOut);
  document.getElementById("btnZoomReset").addEventListener("click", zoomReset);

  document.getElementById("btnImport").addEventListener("click", () => {
    if (!UI.isListView()) return;
    if (window.__APP_STATE__.importing) return;
    document.getElementById("fileImport").click();
  });

  document.getElementById("fileImport").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    await handleImportFile(file);
  });

  document.getElementById("btnTemplate").addEventListener("click", () => {
    if (!UI.isListView()) return;
    downloadExcelTemplate();
  });
}

function wireListEvents() {
  const wrap = document.getElementById("itemsWrap");

  wrap.addEventListener("mouseover", (e) => {
    const item = e.target.closest?.(".item[data-id]");
    if (!item || !UI.isListView()) return;
    scheduleHover(item.dataset.id);
  });

  wrap.addEventListener("mouseout", (e) => {
    const item = e.target.closest?.(".item[data-id]");
    if (!item) return;
    if (item.contains(e.relatedTarget)) return;
    const toSlot = e.relatedTarget?.closest?.(".slot[data-product-id]");
    if (toSlot) return;
    scheduleHoverClear();
  });

  wrap.addEventListener("contextmenu", (e) => {
    const item = e.target.closest?.(".item[data-id]");
    if (!item || !UI.isListView()) return;
    e.preventDefault();
    showContextMenu(item.dataset.id, e.clientX, e.clientY);
  });

  wrap.addEventListener("click", (e) => {
    const st = window.__APP_STATE__;
    const item = e.target.closest?.(".item[data-id]");
    if (!item || !UI.isListView()) return;

    const pid = item.dataset.id;
    const actionBtn = e.target.closest?.("[data-action]");

    if (actionBtn) {
      const action = actionBtn.dataset.action;

      if (action === "check") {
        e.stopPropagation();
        const p = st.products.find(q => q.id === pid);
        if (p) {
          p.excluded = !e.target.checked;
          const itemEl = findListItem(pid);
          if (itemEl) itemEl.classList.toggle("excluded", !!p.excluded);
          updateSelectionCount();
          scheduleRebuild();
          requestSave();
        }
        return;
      }

      if (action === "toggle") {
        e.stopPropagation();
        st.selectedProductId = pid;

        const wasOpen = st.expandedId === pid;
        st.expandedId = wasOpen ? null : pid;

        // Fast path: toggle CSS class without rebuilding the whole list
        document.querySelectorAll(".item.expanded").forEach(el => el.classList.remove("expanded"));
        if (!wasOpen) {
          const el = findListItem(pid);
          if (el) el.classList.add("expanded");
        }

        const opened = !wasOpen;
        requestAnimationFrame(() => {
          markSelectedInList();
          window.__APP_STATE__.presentationPreview.highlight(pid, opened);
        });

        requestSave();
        return;
      }

      if (action === "edit") {
        e.stopPropagation();
        onEditProduct(pid);
        return;
      }
      if (action === "delete") {
        e.stopPropagation();
        onDeleteProduct(pid);
        return;
      }
    }

    const inTitle = !!e.target.closest?.('[data-role="title"]') || !!e.target.closest?.('[data-role="name"]');
    st.selectedProductId = pid;

    // Click en el nombre/título = abre/cierra; click en otra parte = siempre abre
    const wasOpen = st.expandedId === pid;
    st.expandedId = inTitle ? (wasOpen ? null : pid) : pid;
    const opened = st.expandedId === pid;

    // Fast path: toggle CSS class without rebuilding the whole list
    document.querySelectorAll(".item.expanded").forEach(el => el.classList.remove("expanded"));
    if (st.expandedId) {
      const el = findListItem(st.expandedId);
      if (el) el.classList.add("expanded");
    }

    requestAnimationFrame(() => {
      markSelectedInList();
      window.__APP_STATE__?.presentationPreview?.highlight?.(pid, opened);
      highlightProductInList(pid, false);
    });

    requestSave();
  });
}

function wirePreviewEvents() {
  const preview = document.getElementById("paperPreview");

  preview.addEventListener("mouseover", (e) => {
    const slot = e.target.closest?.(".slot[data-product-id]");
    if (!slot || !UI.isListView()) return;
    const pid = slot.dataset.productId || "";
    if (!pid || pid === "__draft__") return;
    scheduleHover(pid);
  });

  preview.addEventListener("mouseout", (e) => {
    const fromSlot = e.target.closest?.(".slot[data-product-id]");
    if (!fromSlot) return;

    const toSlot = e.relatedTarget?.closest?.(".slot[data-product-id]");
    if (toSlot) return;

    const toItem = e.relatedTarget?.closest?.(".item[data-id]");
    if (toItem) return;

    scheduleHoverClear();
  });

  preview.addEventListener("contextmenu", (e) => {
    const slot = e.target.closest?.(".slot[data-product-id]");
    if (!slot || !UI.isListView()) return;

    const pid = slot.dataset.productId || "";
    if (!pid || pid === "__draft__") return;

    e.preventDefault();
    showContextMenu(pid, e.clientX, e.clientY);
  });

  preview.addEventListener("click", (e) => {
    const st = window.__APP_STATE__;
    const slot = e.target.closest?.(".slot[data-product-id]");
    if (!slot || !UI.isListView()) return;

    const pid = slot.dataset.productId || "";
    if (!pid || pid === "__draft__") return;

    st.selectedProductId = pid;
    st.expandedId = pid;

    // Fast path: toggle CSS class without rebuilding the whole list
    document.querySelectorAll(".item.expanded").forEach(el => el.classList.remove("expanded"));
    const el = findListItem(pid);
    if (el) el.classList.add("expanded");

    requestAnimationFrame(() => {
      highlightProductInList(pid, true);
      markSelectedInList();
      scheduleRebuild();
    });
    requestSave();
  });
}

function wireNumericInputs() {
  ["fAhora"].forEach(id => {
    const el = document.getElementById(id);

    el.addEventListener("keydown", (e) => {
      const allowed = ["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Home", "End", "Tab"];
      if (allowed.includes(e.key)) return;
      if (e.ctrlKey || e.metaKey) return;
      if (!/^\d$/.test(e.key)) e.preventDefault();
    });

    el.addEventListener("input", () => {
      validateDraft();
      scheduleRebuild();
    });

    el.addEventListener("paste", () => {
      setTimeout(() => {
        validateDraft();
        scheduleRebuild();
      }, 0);
    });
  });
}

function wireGeneralInputs() {
  ["fTemplate", "fSize", "fNombre", "fQty", "fUseVig", "fVigStart", "fVigEnd"].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener("input", () => { validateDraft(); scheduleRebuild(); });
    el.addEventListener("change", () => { validateDraft(); scheduleRebuild(); });
  });

  document.getElementById("fUseVig").addEventListener("change", () => {
    document.getElementById("vigDates").style.display = document.getElementById("fUseVig").checked ? "block" : "none";
    validateDraft();
    scheduleRebuild();
  });

  // Al cambiar la fecha inicial, siempre limpiar la fecha final y obligar a elegirla de nuevo
  document.getElementById("fVigStart").addEventListener("change", () => {
    document.getElementById("fVigEnd").value = "";
    applyVigEndConstraint();
    validateDraft();
    scheduleRebuild();
  });
}

function updateStartHereBadge() {
  const st = window.__APP_STATE__;
  const btn = document.getElementById("btnShowForm");
  if (!btn) return;
  // Quitar badge anterior si existe
  btn.querySelector(".startHereBadge")?.remove();
  // Agregar badge si lista vacía y estamos en vista lista
  if (st.products.length === 0 && UI.isListView()) {
    const badge = document.createElement("span");
    badge.className = "startHereBadge";
    badge.textContent = "Empieza aquí";
    btn.appendChild(badge);
  }
}

function wireSearchEvents() {
  const input = document.getElementById("listSearch");
  const btnClear = document.getElementById("btnClearSearch");

  input?.addEventListener("input", () => {
    window.__APP_STATE__.filterText = input.value;
    renderList();
  });

  btnClear?.addEventListener("click", () => {
    if (input) input.value = "";
    window.__APP_STATE__.filterText = "";
    renderList();
  });

  document.getElementById("btnIncludeAll")?.addEventListener("click", () => {
    const st = window.__APP_STATE__;
    st.products.forEach(p => { p.excluded = false; });
    renderList();
    scheduleRebuild();
    requestSave();
  });

  document.getElementById("btnExcludeAll")?.addEventListener("click", () => {
    const st = window.__APP_STATE__;
    st.products.forEach(p => { p.excluded = true; });
    renderList();
    scheduleRebuild();
    requestSave();
  });
}

// ─── Helpers de normalización para URL params ─────────────────────────────────
function _normalizeStr(s) {
  return String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[\s_\-]/g, "");
}

function _resolveTemplate(val) {
  const norm = _normalizeStr(val.replace(/\.svg$/i, ""));
  const aliases = {
    "promocion": "promocion1.svg", "promo": "promocion1.svg",
    "normal": "normal1.svg",
    "liquidacion": "liquidacion1.svg", "liqui": "liquidacion1.svg",
    "oferta": "oferta1.svg",
    "pequeno": "pequeño1.svg", "pequeño": "pequeño1.svg", "pequeño1": "pequeño1.svg",
    "superoferta": "superoferta.svg", "super": "superoferta.svg"
  };
  // Coincidencia directa en alias
  for (const [key, mapped] of Object.entries(aliases)) {
    if (_normalizeStr(key) === norm) return mapped;
  }
  // Coincidencia contra las opciones reales del select
  const opts = Array.from(document.getElementById("fTemplate")?.options || []).map(o => o.value).filter(Boolean);
  return opts.find(o => _normalizeStr(o.replace(/\.svg$/i, "")) === norm) || "";
}

function _resolveSize(val) {
  const norm = _normalizeStr(val);
  const map = {
    "quarter": "quarter", "1/4": "quarter", "cuarto": "quarter",
    "half_h": "half_h", "media": "half_h", "horizontal": "half_h",
    "mediahorizontal": "half_h", "mediahoja": "half_h",
    "full": "full", "carta": "full", "completa": "full", "cartacompleta": "full",
    "mini": "mini", "pequeno": "mini", "28": "mini"
  };
  for (const [key, mapped] of Object.entries(map)) {
    if (_normalizeStr(key) === norm) return mapped;
  }
  return "";
}

function _parseUrlDate(val) {
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;                      // YYYY-MM-DD
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`; // DD/MM/YYYY
  return "";
}

// ─── Pre-llenado del formulario desde parámetros de URL ───────────────────────
// Parámetros soportados:
//   nombre    → nombre del producto
//   precio    → precio normal  (alias: ahora)
//   plantilla → plantilla SVG  (alias: template) — ej: "Normal", "Promocion", "normal1.svg"
//   tamano    → tamaño de hoja (alias: size)      — ej: "1/4", "media", "carta", "mini"
//   cantidad  → número de copias (alias: qty)     — ej: 4
//   vigencia  → activa fechas  (si/no/1/0)        — si se omite pero hay fechas, se activa sola
//   vigstart  → fecha inicial  (alias: inicio)    — formato YYYY-MM-DD o DD/MM/YYYY
//   vigend    → fecha final    (alias: fin)        — formato YYYY-MM-DD o DD/MM/YYYY
//
// Si no viene ningún parámetro → no hace nada, devuelve false.
// ────────────────────────────────────────────────────────────────────────────────
function applyUrlParams() {
  const params = new URLSearchParams(window.location.search);

  const nombre    = params.get("nombre");
  const precio    = params.get("precio")    ?? params.get("ahora");
  const plantilla = params.get("plantilla") ?? params.get("template");
  const tamano    = params.get("tamano")    ?? params.get("size");
  const cantidad  = params.get("cantidad")  ?? params.get("qty");
  const vigencia  = params.get("vigencia");
  const vigStart  = params.get("vigstart")  ?? params.get("inicio");
  const vigEnd    = params.get("vigend")    ?? params.get("fin");

  const hasAny = nombre || precio || plantilla || tamano || cantidad || vigencia || vigStart || vigEnd;
  if (!hasAny) return false;

  // Limpiar URL de inmediato — evita re-apertura al refrescar
  if (window.history?.replaceState) {
    window.history.replaceState(null, "", window.location.pathname + window.location.hash);
  }

  // Determinar si activar vigencia:
  // - Explícito "si/1/true" → true | "no/0/false" → false
  // - Omitido pero hay fechas → true automáticamente
  const vigExplicit = vigencia !== null
    ? /^(si|s|1|true|yes|x)$/i.test((vigencia || "").trim())
    : null;
  const useVig = vigExplicit !== null ? vigExplicit : !!(vigStart || vigEnd);

  // Abrir formulario (resetea draft y campos)
  openAddForm();
  updateStartHereBadge();

  requestAnimationFrame(() => {
    if (nombre) {
      const el = document.getElementById("fNombre");
      if (el) el.value = nombre.trim();
    }
    if (precio) {
      const el = document.getElementById("fAhora");
      if (el) el.value = precio.replace(/[^\d]/g, "").slice(0, 5);
    }
    if (plantilla) {
      const resolved = _resolveTemplate(plantilla);
      if (resolved) document.getElementById("fTemplate").value = resolved;
    }
    if (tamano) {
      const resolved = _resolveSize(tamano);
      if (resolved) document.getElementById("fSize").value = resolved;
    }
    if (cantidad) {
      const q = parseInt(cantidad.replace(/[^\d]/g, ""), 10);
      if (q >= 1) {
        const el = document.getElementById("fQty");
        if (el) el.value = String(q);
      }
    }
    // Vigencia y fechas
    if (vigencia !== null || vigStart || vigEnd) {
      const chk = document.getElementById("fUseVig");
      if (chk) {
        chk.checked = useVig;
        document.getElementById("vigDates").style.display = useVig ? "block" : "none";
      }
      if (useVig && vigStart) {
        const parsed = _parseUrlDate(vigStart);
        if (parsed) {
          const el = document.getElementById("fVigStart");
          if (el) el.value = parsed;
          applyVigEndConstraint();
        }
      }
      if (useVig && vigEnd) {
        const parsed = _parseUrlDate(vigEnd);
        if (parsed) {
          const el = document.getElementById("fVigEnd");
          if (el) { el.disabled = false; el.value = parsed; }
        }
      }
    }
    // Sincroniza el draft y calcula campos automáticos (antes, efectivo, cuota)
    validateDraft();
    scheduleRebuild();
  });

  return true;
}

function init() {
  applyTemplateConfig();

  window.__APP_STATE__ = buildAppState();

  // puente mínimo para no romper wiring anterior
  window.__APP_STATE__.presentationPreview = {
    highlight(pid, scroll) {
      import("./presentation/preview.js").then(m => m.highlightProduct(pid, { scroll, showTag: true }));
    }
  };

  wireModalCommonEvents();
  wireGlobalCloseContextMenu();
  wireContextMenuButtons();
  wireTopButtons();
  wireFabHelp();
  wireListEvents();
  wirePreviewEvents();
  wireNumericInputs();
  wireGeneralInputs();
  wireSearchEvents();

  const restored = loadState();

  if (!restored) {
    UI.setView("list", { skipPreview: true });
    UI.showEmptyPreview("Sin previsualización", "Agrega productos o importa un Excel para ver cómo se acomodan.");
  }

  normalizeExistingState();
  UI.updateTopButtonsVisibility();
  renderList();
  updateStartHereBadge();

  // Auto-animate en el contenedor de la lista
  requestAnimationFrame(() => {
    const wrap = document.getElementById("itemsWrap");
    if (wrap && window.autoAnimate) window.autoAnimate(wrap);
  });

  scheduleRebuild();
  requestSave();

  // Pre-llenar formulario desde URL (?nombre=...&precio=...)
  // Devuelve true si se usaron parámetros → omitir el tour automático
  const hadUrlParams = applyUrlParams();

  // Tour automático en primera visita (se omite si vinieron parámetros de URL)
  const TOUR_KEY = "preciadoresintecsa_tour_done";
  if (!hadUrlParams && !localStorage.getItem(TOUR_KEY)) {
    localStorage.setItem(TOUR_KEY, "1");
    setTimeout(() => confirmTour(), 800);
  }

  wireBeforeUnloadGuard(hasWork);
}

init();
