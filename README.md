# Editor de Etiquetas SVG

⚠️ **Aviso importante – Uso bajo su responsabilidad**

Este proyecto ha sido **creado 100% con Inteligencia Artificial**.
**No ha pasado por revisión, auditoría ni validación de desarrolladores humanos**, pruebas formales de QA, ni evaluaciones de seguridad en entornos productivos.

Antes de **implementar, distribuir o usar en producción**, se recomienda:
- Revisar el código manualmente
- Realizar pruebas funcionales y de seguridad
- Validar cumplimiento de normativas internas
- Ajustar según el contexto real de uso

El autor **no asume responsabilidad** por fallos, pérdidas de datos, problemas de seguridad o impactos operativos derivados de su uso.

---

Aplicación web **100% frontend** (sin backend) para crear, editar e imprimir etiquetas comerciales usando plantillas **SVG**.
Permite **previsualizar**, **imprimir**, **exportar a PDF** e **importar productos desde Excel**.
Todo se ejecuta en el navegador y se **guarda automáticamente en `localStorage`**.

---

## Características principales

- Creación y edición de etiquetas con:
  - Plantilla SVG seleccionable
  - Tamaño de impresión
  - Nombre del producto
  - Precio Normal (ingresado por el usuario)
  - Precio Antes (calculado automáticamente: +10%)
  - Precio Efectivo (calculado automáticamente: −10%)
  - Cuota Semanal (calculada automáticamente, plan según monto)
  - Cantidad de copias
  - Vigencia opcional con fechas de inicio y fin
- Previsualización en hojas tamaño **Carta (Letter)**
- **Zoom de vista previa** entre 30% y 300% (pasos de 15%)
- Impresión directa desde el navegador
- Exportación a PDF
- Importación masiva desde Excel
- Tour interactivo de 23 pasos para nuevos usuarios
- Persistencia automática local (`localStorage`)
- No requiere servidor ni base de datos

---

## Requisitos

- Navegador moderno (Chrome, Edge, Firefox)
- Servidor HTTP local o remoto

⚠️ **No funciona correctamente abriendo el HTML con doble clic (`file://`).**

---

## Ejecutar el proyecto en local

Con Node.js (recomendado):

```bash
npx serve . -p 3000
```

Con Python:

```bash
python -m http.server 8080
```

Abrir en el navegador: `http://localhost:3000` (o el puerto elegido).

---

## Dependencias externas

Cargadas por CDN en `index.html`:

- **jsPDF** → exportación a PDF
- **SheetJS / xlsx** → importación desde Excel
- **Driver.js** → tour interactivo

---

## Estructura del proyecto

```
preciadoresintecsa/
├─ index.html
├─ resource/
│  ├─ css/
│  │  └─ styles.css
│  └─ svg/
│     ├─ normal1.svg
│     ├─ promocion1.svg
│     ├─ oferta1.svg
│     ├─ liquidacion1.svg
│     └─ pequeño1.svg
├─ src/
│  ├─ main.js
│  ├─ config/
│  │  └─ config.js
│  ├─ domain/
│  │  ├─ product.js
│  │  └─ packing.js
│  ├─ application/
│  │  └─ actions.js
│  ├─ infrastructure/
│  │  ├─ templates.js
│  │  ├─ svgRenderer.js
│  │  ├─ excel.js
│  │  ├─ pdf.js
│  │  └─ storage.js
│  └─ presentation/
│     ├─ ui.js
│     ├─ dom.js
│     ├─ form.js
│     ├─ list.js
│     ├─ preview.js
│     ├─ selection.js
│     ├─ contextMenu.js
│     ├─ modal.js
│     └─ tour.js
└─ tests/
```

---

## Arquitectura

- **presentation** → interfaz, DOM, formularios, listas, preview, zoom y modales
- **application** → acciones de negocio (crear, editar, eliminar)
- **domain** → lógica pura, validaciones y empaquetado en páginas
- **infrastructure** → SVG, canvas, Excel, PDF, impresión y `localStorage`
- **config** → configuración central del sistema

---

## Plantillas SVG disponibles

| Archivo | Nombre en UI | Alias Excel aceptados |
|---|---|---|
| `normal1.svg` | Normal | `normal`, `normal1` |
| `promocion1.svg` | Promoción | `promocion`, `promoción`, `promocion1` |
| `oferta1.svg` | Oferta | `oferta`, `oferta1` |
| `liquidacion1.svg` | Liquidación | `liquidacion`, `liquidación`, `liquidacion1` |
| `pequeño1.svg` | Pequeño | `pequeño`, `pequeno`, `pequeño1`, `pequeno1` |

---

## Tamaños de etiqueta

Todos los tamaños (excepto `full`) comparten el mismo **grid universal de 4 columnas × 14 filas**, lo que permite que distintos tamaños convivan en la misma hoja sin desperdiciar espacio.

| Tamaño | Clave | Span en grid | Etiquetas por hoja |
|---|---|---|---|
| 1/4 hoja | `quarter` | 2 col × 7 filas | 4 |
| Media hoja horizontal | `half_h` | 4 col × 7 filas | 2 |
| Carta completa | `full` | página dedicada | 1 |
| Mini | `mini` | 1 col × 2 filas | 28 |

- Para `half_h` el sistema rota automáticamente el PNG **90°**.
- Los tamaños `quarter`, `half_h` y `mini` pueden coexistir en la misma hoja.
- Márgenes de página: **8 mm** (compatibles con la mayoría de impresoras). Gap entre celdas: **2 mm**.

---

## Zoom de la vista previa

Controles verticales fijos a la izquierda del panel de preview:

- **`+`** → acercar (paso: 15%)
- **`−`** → alejar (paso: 15%)
- **`↺`** → restablecer al 58% predeterminado
- Rango: **30% – 300%**
- Los botones `+` y `−` se deshabilitan al alcanzar el límite.
- El control permanece visible (sticky) aunque se haga scroll en el preview.

---

## Modelo de datos (Producto)

```js
{
  id: string,
  template: string,           // e.g. "normal1.svg"
  size: "quarter" | "half_h" | "full" | "mini",
  nombre: string,
  ahora: string,              // Precio Normal: ingresado por el usuario
  antes: string,              // calculado automáticamente
  efectivo: string,           // calculado automáticamente
  cuota: string,              // calculado automáticamente
  qty: number,
  useVig: boolean,
  vigStart: string,           // ISO: YYYY-MM-DD
  vigEnd: string,             // ISO: YYYY-MM-DD
  impresionAt: string,
  colorIdx: number
}
```

### Reglas de validación

- Todos los campos principales son obligatorios
- `qty ≥ 1`
- Precio Normal: solo numérico, máx. 5 dígitos, mayor a 0
- Si hay vigencia, `vigEnd` no puede ser menor que `vigStart`

### Cálculos automáticos

- **Precio Antes** = `ceil(Precio Normal × 1.10)` (+10%)
- **Precio Efectivo** = `round(Precio Normal × 0.90)` (−10%)
- **Cuota Semanal** = `ceil(Precio Normal × plan.cuotaRef / plan.refAmount)`. El plan se elige por el Precio Normal: `≥200 → 4 semanas (315/1000)`, `≥600 → 8 semanas (190/1000)`, `≥1000 → 20 semanas (110/1000)`.

---

## Funcionamiento del render SVG

Archivo clave: `src/infrastructure/svgRenderer.js`

1. Carga el SVG desde `resource/svg/`
2. Sanitiza el SVG (elimina scripts, eventos y URLs externas)
3. Inserta textos dinámicos por ID
4. Ajusta el nombre con *text wrap* automático
5. Convierte el SVG a PNG usando `<canvas>`
6. Cachea el resultado (máx. 40 entradas)
7. Usa el PNG para preview (600 px), impresión y PDF (1200 px)

---

## IDs obligatorios en cada SVG

```
nombre_producto       → nombre del producto
precio_antes          → precio antes (tachado)
precio_ahora          → precio normal
cuota_semanal         → cuota semanal
fecha_vigencia        → rango de vigencia (opcional)
```

Fecha de impresión (cualquiera de estos):

```
Fecha_impresion
fecha_impresion
FECHA_IMPRESION
```

Recomendado para ajuste automático del texto:

```
box_nombre_producto
```

> La plantilla `pequeño1.svg` puede omitir `precio_antes` y `cuota_semanal` si su diseño no los requiere.

---

## Crear una nueva plantilla SVG

1. Copiar una plantilla existente desde `resource/svg/`
2. Editar el diseño en Inkscape o Illustrator
3. **Respetar** los IDs obligatorios indicados arriba
4. Guardar en `resource/svg/`
5. Registrar en `index.html`:

```html
<option value="miPlantilla1.svg">Mi Plantilla</option>
```

6. Agregar alias en `src/config/config.js` → `TEMPLATE_ALIASES`:

```js
"miplantilla":  "miPlantilla1.svg",
"miplantilla1": "miPlantilla1.svg",
```

---

## Seguridad del SVG

Antes de renderizar se elimina:

- `<script>`, `<foreignObject>`, `<iframe>`, `<object>`, `<embed>`
- Atributos de evento (`onClick`, `onLoad`, etc.)
- URLs externas (`http://`, `https://`, `javascript:`)
- Solo se permiten imágenes base64 `data:image/(png|jpeg|jpg|webp|gif)`

---

## Importación desde Excel

### Columnas requeridas

| Columna | Descripción |
|---|---|
| Plantilla | Nombre de la plantilla (sin `.svg`) |
| Tamaño | Tamaño de impresión |
| Nombre | Nombre del producto |
| Precio Normal | Solo números enteros, máx. 5 dígitos |
| Cantidad | Entero ≥ 1 |

### Columnas opcionales

| Columna | Descripción |
|---|---|
| AgregarVigencia | `SI` / `NO` |
| VigenciaInicio | Fecha inicio (`DD/MM/AAAA` o ISO) |
| VigenciaFin | Fecha fin (`DD/MM/AAAA` o ISO) |

> **Precio Antes**, **Precio Efectivo** y **Cuota Semanal** se calculan automáticamente; no es necesario incluirlos.

### Alias aceptados para Tamaño

| Valor en Excel | Tamaño resultante |
|---|---|
| `1/4`, `cuarto`, `quarter` | `quarter` |
| `media`, `mitad`, `horizontal`, `half_h` | `half_h` |
| `carta`, `completa`, `pagina completa`, `full` | `full` |
| `mini`, `4x7`, `28` | `mini` |

### Límites

- Tamaño máximo de archivo: **6 MB**
- Máximo de filas: **5 000**
- Si **una fila** tiene error, se rechaza todo el archivo

### Modos de importación

- **Mantener y agregar** → conserva los productos existentes
- **Reemplazar todo** → borra todo y carga los nuevos

---

## Exportación a PDF

- Implementada con **jsPDF**
- Tamaño Carta, orientación vertical
- Resolución de render: **1200 px**
- Archivo generado: `etiquetas.pdf`

---

## Impresión

- Genera páginas HTML con posicionamiento absoluto (unidades `mm`)
- Ejecuta `window.print()` en una nueva pestaña
- Usa `@page { size: letter portrait; margin: 0 }` para máxima fidelidad

---

## Tour interactivo

23 pasos guiados, activados con el botón **Tour**:

| Pasos | Contenido |
|---|---|
| 0 | Bienvenida |
| 1–2 | Panel de productos y botón Nueva etiqueta |
| 3–9 | Formulario: plantilla, tamaño, nombre, precios, cantidad |
| 10–11 | Vigencia (condicional) |
| 12 | Guardar |
| 13–14 | Vista previa y controles de zoom |
| 15–17 | Lista, editar y eliminar |
| 18–22 | Importar/exportar Excel, PDF, imprimir |
| 23 | Fin |

Validaciones activas: no es posible avanzar sin completar cada acción requerida.

---

## Persistencia

Estado guardado automáticamente en:

```
localStorage["editor_etiquetas_state_v8_secure"]
```

---

## Configuración principal (`src/config/config.js`)

| Constante | Descripción |
|---|---|
| `CONFIG.storageKey` | Clave de localStorage |
| `CONFIG.previewScale` | Escala inicial del preview (0.58 = 58%) |
| `CONFIG.limits` | Validaciones, cachés, resoluciones |
| `CONFIG.paper` | Medidas del papel Carta en mm |
| `SIZE` | Claves de tamaño: `quarter`, `half_h`, `full`, `mini` |
| `SVG_IDS` | IDs que el render inyecta en el SVG |
| `TEMPLATE_ALIASES` | Mapeo alias → nombre de archivo |
| `PRICING` | `markupPct` (Antes = Normal × 1.10) y `downPaymentPct` (Efectivo = Normal × 0.90) |
| `FINANCING_PLANS` | Planes de financiamiento con umbral `minNormal` (4/8/20 semanas) |

---

## Errores comunes

| Síntoma | Causa |
|---|---|
| La plantilla no se muestra | No está registrada en el `<select>` de `index.html` |
| El PDF sale en blanco | Faltan IDs obligatorios en el SVG |
| Las imágenes desaparecen | El SVG usa URLs externas (bloqueadas por seguridad) |
| No carga nada | Abriste el HTML con `file://` en lugar de un servidor HTTP |
| La impresora corta los bordes | Aumenta `U_PAD` en `src/infrastructure/pdf.js` (actualmente 8 mm) |

---

## Licencia – Libre Uso sin Garantía

**Licencia de Uso Libre (Free Use License – FUL)**

Se concede permiso, de forma gratuita, para usar, copiar, modificar, fusionar, publicar, distribuir y reutilizar este software, con o sin modificaciones, para cualquier propósito, incluyendo fines comerciales.

### Condiciones

- El software se proporciona **"TAL CUAL"**, sin garantía de ningún tipo.
- No se garantiza que el software sea seguro, estable o adecuado para producción.
- El uso del software es **bajo total responsabilidad del usuario**.
- El autor no será responsable por daños directos o indirectos, pérdida de datos, interrupciones del negocio o cualquier otro perjuicio derivado del uso del software.

### Recomendación

Este proyecto debe considerarse como:
- Prototipo
- Herramienta interna
- Base de desarrollo
- Proyecto educativo o experimental

**No se recomienda su uso en entornos críticos sin una revisión técnica completa.**
