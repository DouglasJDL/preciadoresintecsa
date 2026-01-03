import { $ } from "./dom.js";
import { sanitizeIntStr, validateProductData } from "../domain/product.js";
import { requestSave } from "../infrastructure/storage.js";
import { scheduleRebuild } from "./preview.js";

function setFieldError(inputId, errorId, msg) {
  const input = $(inputId);
  const err = $(errorId);
  if (!input || !err) return;

  const has = !!msg;
  err.textContent = msg || "";
  err.classList.toggle("show", has);
  input.classList.toggle("isInvalid", has);
}

function clearAllErrors() {
  setFieldError("fTemplate", "eTemplate", "");
  setFieldError("fSize", "eSize", "");
  setFieldError("fNombre", "eNombre", "");
  setFieldError("fAntes", "eAntes", "");
  setFieldError("fAhora", "eAhora", "");
  setFieldError("fCuota", "eCuota", "");
  setFieldError("fQty", "eQty", "");
  setFieldError("fUseVig", "eVig", "");
  setFieldError("fVigStart", "eVigStart", "");
  setFieldError("fVigEnd", "eVigEnd", "");
}

export function syncDraftFromForm() {
  const st = window.__APP_STATE__;

  st.draft.template = $("fTemplate").value || "";
  st.draft.size = $("fSize").value || "";
  st.draft.nombre = ($("fNombre").value || "").trim();

  st.draft.antes = sanitizeIntStr($("fAntes").value);
  st.draft.ahora = sanitizeIntStr($("fAhora").value);
  st.draft.cuota = sanitizeIntStr($("fCuota").value);

  $("fAntes").value = st.draft.antes;
  $("fAhora").value = st.draft.ahora;
  $("fCuota").value = st.draft.cuota;

  const q = parseInt($("fQty").value, 10);
  st.draft.qty = Number.isFinite(q) && q > 0 ? q : 0;

  st.draft.useVig = !!$("fUseVig").checked;
  $("vigDates").style.display = st.draft.useVig ? "block" : "none";
  st.draft.vigStart = $("fVigStart").value || "";
  st.draft.vigEnd = $("fVigEnd").value || "";
}

export function validateDraft() {
  const st = window.__APP_STATE__;

  clearAllErrors();
  syncDraftFromForm();

  const errs = validateProductData(st.draft);

  if (!st.draft.template) setFieldError("fTemplate", "eTemplate", "Selecciona una plantilla.");
  if (!st.draft.size) setFieldError("fSize", "eSize", "Selecciona un tamaño.");
  if (!st.draft.nombre) setFieldError("fNombre", "eNombre", "Este campo es obligatorio.");
  if (!st.draft.antes) setFieldError("fAntes", "eAntes", "Ingresa 'Antes' (máx 5 dígitos).");
  if (!st.draft.ahora) setFieldError("fAhora", "eAhora", "Ingresa 'Ahora' (máx 5 dígitos).");
  if (!st.draft.cuota) setFieldError("fCuota", "eCuota", "Ingresa 'Cuota' (máx 5 dígitos).");
  if (!st.draft.qty || st.draft.qty < 1) setFieldError("fQty", "eQty", "Cantidad debe ser mayor a 0.");

  if (st.draft.useVig) {
    if (!st.draft.vigStart) setFieldError("fVigStart", "eVigStart", "Selecciona fecha inicial.");
    if (!st.draft.vigEnd) setFieldError("fVigEnd", "eVigEnd", "Selecciona fecha final.");
    if (st.draft.vigStart && st.draft.vigEnd && st.draft.vigEnd < st.draft.vigStart) {
      setFieldError("fVigEnd", "eVigEnd", "La fecha final no puede ser menor que la inicial.");
    }
  }

  const ok = errs.length === 0;
  $("btnSave").disabled = !ok;

  requestSave();
  return ok;
}

export function fillFormFromProduct(p) {
  $("fTemplate").value = p.template || "";
  $("fSize").value = p.size || "";
  $("fNombre").value = p.nombre || "";
  $("fAntes").value = p.antes || "";
  $("fAhora").value = p.ahora || "";
  $("fCuota").value = p.cuota || "";
  $("fQty").value = String(p.qty || 1);

  $("fUseVig").checked = !!p.useVig;
  $("vigDates").style.display = p.useVig ? "block" : "none";
  $("fVigStart").value = p.vigStart || "";
  $("fVigEnd").value = p.vigEnd || "";

  syncDraftFromForm();
  validateDraft();
  scheduleRebuild();
}
