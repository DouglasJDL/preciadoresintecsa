import { UI } from "./ui.js";

function getDriver() {
  return window.driver?.js?.driver ?? null;
}

function showExportButtons() {
  ["btnPdf", "btnPrint", "btnResetAll"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.removeProperty("display");
  });
}

function flashError(el) {
  if (!el) return;
  el.classList.remove("tour-error");
  void el.offsetWidth;
  el.classList.add("tour-error");
  setTimeout(() => el.classList.remove("tour-error"), 1200);
}

function requireSelect(fieldId) {
  const el = document.getElementById(fieldId);
  if (!el?.value) { flashError(el); return false; }
  return true;
}

function requireText(fieldId) {
  const el = document.getElementById(fieldId);
  if (!(el?.value?.trim())) { flashError(el); return false; }
  return true;
}

const IDX_VIG_DATES = 11;
const IDX_SAVE      = 12;

// showButtons global: sin bot\xF3n Atr\xE1s ni X en ning\xFAn paso
const NB = {};

export function startTour() {
  const driverFn = getDriver();
  if (!driverFn) {
    alert("El tour no est\xE1 disponible. Recarga la p\xE1gina e intenta de nuevo.");
    return;
  }

  if (!UI.isListView()) document.getElementById("btnCancel")?.click();

  const tour = driverFn({
    animate: true,
    showProgress: true,
    showButtons: ["next"],
    progressText: "{{current}} de {{total}}",
    nextBtnText: "Siguiente \u2192",
    prevBtnText: "\u2190 Atr\xE1s",
    doneBtnText: "Entendido \u2714",
    allowClose: false,
    overlayClickBehavior: "none",
    disableActiveInteraction: true,
    overlayOpacity: 0.65,
    stagePadding: 6,
    steps: [

      // 0 \u2500 Bienvenida
      {
        popover: {

          title: "\uD83C\uDFF7\uFE0F Bienvenido al Editor de Etiquetas",
          description:
            "Este tour te gu\xEDa paso a paso para crear una etiqueta. " +
            "<b>Deber\xE1s completar cada acci\xF3n</b> antes de poder avanzar.",
          side: "over", align: "center"
        }
      },

      // 1 \u2500 Panel izquierdo
      {
        element: "#leftCard",
        popover: {

          title: "Panel de productos",
          description:
            "Aqu\xED ver\xE1s la lista de etiquetas creadas. " +
            "Puedes agregar, editar, eliminar e importar desde Excel.",
          side: "right", align: "start"
        }
      },

      // 2 \u2500 "Nueva etiqueta" \u2500 resalta el bot\xF3n directamente; Siguiente simula el click
      {
        element: "#btnShowForm",
        popover: {

          title: "\u2795 Nueva etiqueta",
          description:
            "Este es el bot\xF3n para crear una etiqueta. " +
            "Presiona <b>Siguiente</b> y el editor abrir\xE1 el formulario por ti.",
          side: "right", align: "start",
          onNextClick: () => {
            document.getElementById("btnShowForm")?.click();
            tour.moveNext();
          }
        }
      },

      // 3 \u2500 Plantilla (sin Atr\xE1s desde aqu\xED)
      {
        element: "#fTemplate",
        disableActiveInteraction: false,
        popover: {

          title: "\uD83D\uDDBC\uFE0F Elige una plantilla",
          description:
            "Selecciona el dise\xF1o visual: <b>Promoci\xF3n</b>, <b>Normal</b>, " +
            "<b>Liquidaci\xF3n</b> u <b>Oferta</b>. El preview se actualiza al instante." +
            "<br><small style='color:#ef4444'>\u26A0\uFE0F Debes seleccionar una opci\xF3n para continuar.</small>",
          side: "right", align: "start",
          onNextClick: () => { if (!requireSelect("fTemplate")) return; tour.moveNext(); }
        }
      },

      // 4 \u2500 Tama\xF1o
      {
        element: "#fSize",
        disableActiveInteraction: false,
        popover: {

          title: "\uD83D\uDCCF Elige el tama\xF1o",
          description:
            "<b>1/4 hoja</b> \u2192 4 etiquetas por p\xE1gina<br>" +
            "<b>Media horizontal</b> \u2192 2 por p\xE1gina<br>" +
            "<b>Carta completa</b> \u2192 1 por p\xE1gina" +
            "<br><small style='color:#ef4444'>\u26A0\uFE0F Debes seleccionar un tama\xF1o para continuar.</small>",
          side: "right", align: "start",
          onNextClick: () => { if (!requireSelect("fSize")) return; tour.moveNext(); }
        }
      },

      // 5 \u2500 Nombre
      {
        element: "#fNombre",
        disableActiveInteraction: false,
        popover: {

          title: "\uD83D\uDCDD Escribe el nombre del producto",
          description:
            "Ingresa el nombre del producto." +
            "<br><small style='color:#ef4444'>\u26A0\uFE0F Debes escribir un nombre para continuar.</small>",
          side: "right", align: "start",
          onNextClick: () => { if (!requireText("fNombre")) return; tour.moveNext(); }
        }
      },

      // 6 \u2500 Precio Normal
      {
        element: "#fAhora",
        disableActiveInteraction: false,
        popover: {

          title: "\uD83D\uDCB0 Ingresa el Precio Normal",
          description:
            "Escribe el <b>precio de lista</b> del art\xEDculo (solo n\xFAmeros, m\xE1x. 5 d\xEDgitos)." +
            "<br><small style='color:#ef4444'>\u26A0\uFE0F Debes ingresar un precio para continuar.</small>",
          side: "right", align: "start",
          onNextClick: () => {
            const el = document.getElementById("fAhora");
            if (!el?.value?.trim() || el.value.trim() === "0") { flashError(el); return; }
            tour.moveNext();
          }
        }
      },

      // 7 \u2500 Precio Antes
      {
        element: "#fAntes",
        popover: {

          title: "\uD83E\uDEA7 Precio Antes \u2014 autom\xE1tico",
          description: "Se calcula solo en base al Precio Normal que ingresaste.",
          side: "right", align: "start"
        }
      },

      // 8 \u2500 Cuota
      {
        element: "#fCuota",
        popover: {

          title: "\uD83D\uDCC5 Cuota Semanal \u2014 autom\xE1tica",
          description:
            "Se calcula sola en base al Precio Normal. " +
            "El cliente pagar\xE1 esta cuota cada semana durante <b>20 semanas sin enganche</b>.",
          side: "right", align: "start"
        }
      },

      // 9 \u2500 Cantidad
      {
        element: "#fQty",
        popover: {

          title: "\uD83D\uDD22 Cantidad de copias",
          description: "Cu\xE1ntas etiquetas iguales necesitas. Por defecto es 1.",
          side: "right", align: "start"
        }
      },

      // 10 \u2500 Vigencia
      {
        element: "#fUseVig",
        popover: {

          title: "\uD83D\uDCC6 Vigencia (opcional)",
          description:
            "Si la promoci\xF3n tiene fechas l\xEDmite, activa este toggle y elige las fechas. " +
            "Si no aplica, deja el toggle desactivado y presiona Siguiente.",
          side: "right", align: "start",
          onNextClick: () => {
            const checked = document.getElementById("fUseVig").checked;
            tour.moveTo(checked ? IDX_VIG_DATES : IDX_SAVE);
          }
        }
      },

      // 11 \u2500 Fechas de vigencia (condicional)
      {
        element: "#vigDates",
        disableActiveInteraction: false,
        popover: {

          title: "\uD83D\uDDD3\uFE0F Fechas de vigencia",
          description:
            "Elige la <b>fecha inicial</b> primero, luego la <b>fecha final</b>. " +
            "La fecha final se habilita despu\xE9s de elegir la inicial.",
          side: "right", align: "start",
          onNextClick: () => {
            const start = document.getElementById("fVigStart").value;
            const end   = document.getElementById("fVigEnd").value;
            if (!start) { flashError(document.getElementById("fVigStart")); return; }
            if (!end)   { flashError(document.getElementById("fVigEnd"));   return; }
            tour.moveTo(IDX_SAVE);
          }
        }
      },

      // 12 \u2500 Guardar \u2500 resalta el bot\xF3n directamente; Siguiente simula el click
      {
        element: "#btnSave",
        popover: {

          title: "\u2705 Guardar etiqueta",
          description:
            "Este bot\xF3n guarda tu etiqueta. " +
            "Presiona <b>Siguiente</b> y el editor la guardar\xE1 autom\xE1ticamente." +
            "<br><small style='color:#ef4444'>\u26A0\uFE0F Aseg\xFArate de haber completado todos los campos.</small>",
          side: "right", align: "start",
          onNextClick: () => {
            const btn = document.getElementById("btnSave");
            if (btn?.disabled) { flashError(btn); return; }
            btn?.click();
            tour.moveNext();
          }
        }
      },

      // 13 \u2500 Preview
      {
        element: "#paperPreviewWrap",
        popover: {

          title: "\uD83D\uDDC2\uFE0F Vista previa",
          description:
            "Tu etiqueta ya aparece aqu\xED distribuida en hoja carta. " +
            "Haz click en una etiqueta del preview para seleccionarla en la lista.",
          side: "left", align: "start"
        }
      },

      // 14 — Zoom
      {
        element: ".zoomSidebar",
        popover: {
          title: "🔍 Control de zoom",
          description:
            "Usa estos botones para acercar o alejar la vista previa.<br>" +
            "<b>+</b> acerca · <b>−</b> aleja · <b>↺</b> restablece al tamaño original.<br>" +
            "Muy útil con la plantilla <b>Mini (28 por hoja)</b> para ver los detalles.",
          side: "right", align: "start"
        }
      },

      // 15 \u2500 Lista de etiquetas
      {
        element: "#itemsWrap",
        popover: {

          title: "\uD83D\uDDC2\uFE0F Lista de etiquetas",
          description:
            "Aqu\xED aparecen todas tus etiquetas guardadas. " +
            "Haz click en una para expandirla y ver sus detalles.",
          side: "right", align: "start"
        }
      },

      // 15 \u2500 Bot\xF3n editar
      {
        element: ".item [data-action='edit']",
        popover: {

          title: "\u270F\uFE0F Editar etiqueta",
          description:
            "Abre el formulario con los datos de la etiqueta para que puedas modificarla.",
          side: "left", align: "start"
        }
      },

      // 16 \u2500 Bot\xF3n eliminar
      {
        element: ".item [data-action='delete']",
        popover: {

          title: "\uD83D\uDDD1\uFE0F Eliminar etiqueta",
          description:
            "Elimina esta etiqueta de la lista. Te pedir\xE1 confirmaci\xF3n antes de borrarla.",
          side: "left", align: "start"
        }
      },

      // 17 \u2500 Plantilla Excel
      {
        element: "#btnTemplate",
        popover: {

          title: "\uD83D\uDCCB Plantilla Excel",
          description:
            "Descarga la plantilla para <b>crear etiquetas de forma masiva</b>. " +
            "Ll\xE9nala con todos tus productos y lu\xE9go imp\xF3rtala de una sola vez.",
          side: "bottom", align: "start"
        }
      },

      // 18 \u2500 Importar Excel
      {
        element: "#btnImport",
        popover: {

          title: "\uD83D\uDCCA Importar desde Excel",
          description:
            "Carga muchas etiquetas a la vez desde un archivo Excel. " +
            "Usa primero la <b>Plantilla Excel</b> para no equivocarte.",
          side: "bottom", align: "start"
        }
      },

      // 19 \u2500 Borrar todo
      {
        element: "#btnResetAll",
        popover: {

          title: "\uD83D\uDDD1\uFE0F Borrar todo",
          description:
            "Elimina <b>todas</b> las etiquetas de la lista de una vez. " +
            "Te pedir\xE1 confirmaci\xF3n antes de borrar.",
          side: "bottom", align: "start",
          onHighlightStarted: showExportButtons
        }
      },

      // 20 \u2500 Descargar PDF
      {
        element: "#btnPdf",
        popover: {

          title: "\uD83D\uDCC4 Descargar PDF",
          description: "Genera un PDF listo para imprimir con todas las etiquetas.",
          side: "bottom", align: "start"
        }
      },

      // 21 \u2500 Imprimir
      {
        element: "#btnPrint",
        popover: {

          title: "\uD83D\uDDA8\uFE0F Imprimir",
          description:
            "Abre el di\xE1logo de impresi\xF3n del navegador con las etiquetas listas en tama\xF1o carta.",
          side: "bottom", align: "start"
        }
      },

      // 22 \u2500 Fin
      {
        popover: {
          showButtons: ["next"],
          title: "\uD83C\uDF89 \xA1Listo!",
          description:
            "Ya conoces todas las funciones del editor. " +
            "Recuerda: <b>click derecho</b> en cualquier etiqueta muestra m\xE1s opciones." +
            "<br><br>\xA1Mucho \xE9xito!",
          side: "over", align: "center"
        }
      }
    ]
  });

  tour.drive();
}
