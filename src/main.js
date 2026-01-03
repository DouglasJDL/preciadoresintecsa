import { CONFIG } from "./config/config.js";
import { emptyProduct } from "./domain/product.js";
import { createCappedCache, formatDateTimeNow } from "./infrastructure/svgRenderer.js";
import { loadTemplateText } from "./infrastructure/templates.js";
import { UI, wireBeforeUnloadGuard, wireGlobalCloseContextMenu } from "./presentation/ui.js";
import { wireModalCommonEvents } from "./presentation/modal.js";
import { renderList } from "./presentation/list.js";
import { scheduleRebuild } from "./presentation/preview.js";
import { validateDraft } from "./presentation/form.js";
import { showContextMenu, hideContextMenu } from "./presentation/contextMenu.js";
import { scheduleHover, scheduleHoverClear, highlightProductInList, markSelectedInList } from "./presentation/selection.js";
import { openAddForm, backToList, onEditProduct, onDeleteProduct, saveDraft, resetAll, uid, allocateColorIdx } from "./application/actions.js";
import { loadState, normalizeExistingState, hasWork, requestSave } from "./infrastructure/storage.js";
import { handleImportFile, downloadExcelTemplate } from "./infrastructure/excel.js";
import { printNow } from "./infrastructure/print.js";
import { exportPdfWithLoading } from "./infrastructure/pdf.js";

function getAllowedTemplatesFromDom() {
  const sel = document.getElementById("fTemplate");
  return Array.from(sel.options).map(o => o.value).filter(Boolean);
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

    pendingFocus: null,

    exporting: false,
    importing: false,

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

function wireTopButtons() {
  document.getElementById("btnShowForm").addEventListener("click", openAddForm);
  document.getElementById("btnCancel").addEventListener("click", backToList);
  document.getElementById("btnSave").addEventListener("click", saveDraft);
  document.getElementById("btnResetAll").addEventListener("click", resetAll);
  document.getElementById("btnPrint").addEventListener("click", printNow);
  document.getElementById("btnPdf").addEventListener("click", exportPdfWithLoading);

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

      if (action === "toggle") {
        e.stopPropagation();
        st.selectedProductId = pid;

        st.expandedId = (st.expandedId === pid) ? null : pid;
        renderList();

        const opened = (st.expandedId === pid);
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

    // Click en el nombre/título = igual que desplegar:
    // - abre/cierra
    // - resalta y (si abre) hace scroll en preview
    st.expandedId = inTitle ? ((st.expandedId === pid) ? null : pid) : pid;
    const opened = (st.expandedId === pid);
    renderList();

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
    renderList();

    requestAnimationFrame(() => {
      highlightProductInList(pid, true);
      markSelectedInList();
      scheduleRebuild();
    });
    requestSave();
  });
}

function wireNumericInputs() {
  ["fAntes", "fAhora", "fCuota"].forEach(id => {
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
}

function init() {
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
  wireListEvents();
  wirePreviewEvents();
  wireNumericInputs();
  wireGeneralInputs();

  const restored = loadState();

  if (!restored) {
    UI.setView("list", { skipPreview: true });
    UI.showEmptyPreview("Sin previsualización", "Agrega productos o importa un Excel para ver cómo se acomodan.");
  }

  normalizeExistingState();
  UI.updateTopButtonsVisibility();
  renderList();
  scheduleRebuild();
  requestSave();

  wireBeforeUnloadGuard(hasWork);
}

init();
