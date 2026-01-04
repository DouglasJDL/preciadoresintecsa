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
  - Plantilla SVG
  - Tamaño de impresión
  - Nombre del producto
  - Precio antes
  - Precio ahora
  - Cuota semanal
  - Cantidad de copias
  - Vigencia opcional
- Previsualización en hojas tamaño **Carta (Letter)**
- Impresión directa desde el navegador
- Exportación a PDF
- Importación masiva desde Excel
- Persistencia automática local
- No requiere servidor ni base de datos

---

## Requisitos

- Navegador moderno (Chrome, Edge, Firefox)
- Servidor HTTP local o remoto

⚠️ **No funciona correctamente abriendo el HTML con doble clic (`file://`).**

---

## Ejecutar el proyecto en local

Desde la carpeta raíz del proyecto:

```bash
python -m http.server 8080
```

Abrir en el navegador:

```
http://localhost:8080
```

---

## Dependencias externas

Cargadas por CDN en `index.html`:

- **jsPDF** → exportación a PDF
- **SheetJS / xlsx** → importación desde Excel

---

## Estructura del proyecto

```
editor_etiquetas/
├─ index.html
├─ resource/
│  ├─ css/
│  │  └─ styles.css
│  └─ svg/
│     ├─ normal1.svg
│     ├─ promocion1.svg
│     ├─ oferta1.svg
│     └─ liquidacion1.svg
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
│  │  ├─ print.js
│  │  └─ storage.js
│  └─ presentation/
│     ├─ ui.js
│     ├─ dom.js
│     ├─ form.js
│     ├─ list.js
│     ├─ preview.js
│     ├─ selection.js
│     ├─ contextMenu.js
│     └─ modal.js
└─ tests/
```

---

## Arquitectura

- **presentation** → interfaz, DOM, formularios, listas, preview y modales  
- **application** → acciones de negocio (crear, editar, eliminar)  
- **domain** → lógica pura, validaciones y empaquetado en páginas  
- **infrastructure** → SVG, canvas, Excel, PDF, impresión y `localStorage`  
- **config** → configuración central del sistema  

---

## Configuración principal

Archivo:

```
src/config/config.js
```

Define:

- Clave de `localStorage`
- Límites de validación
- Medidas del papel Carta
- IDs obligatorios del SVG
- Alias de plantillas para Excel

---

## Modelo de datos (Producto)

```js
{
  id: string,
  template: string,
  size: "quarter" | "half_h" | "full",
  nombre: string,
  antes: string,
  ahora: string,
  cuota: string,
  qty: number,
  useVig: boolean,
  vigStart: string,
  vigEnd: string,
  impresionAt: string,
  colorIdx: number
}
```

### Reglas de validación

- Todos los campos principales son obligatorios
- `qty ≥ 1`
- `ahora ≤ antes`
- Precios solo numéricos (máx. 5 dígitos)
- Si hay vigencia, las fechas deben ser válidas

---

## Tamaños de etiqueta

- **quarter** → 4 etiquetas por hoja
- **half_h** → 2 etiquetas por hoja (horizontal)
- **full** → 1 etiqueta por hoja

Para `half_h`, el sistema rota automáticamente el SVG **90°**.

---

## Funcionamiento del render SVG

Archivo clave:

```
src/infrastructure/svgRenderer.js
```

Proceso:

1. Carga el SVG desde `resource/svg`
2. Sanitiza el SVG (seguridad)
3. Inserta textos dinámicos por ID
4. Ajusta el nombre con *wrap* automático
5. Convierte SVG a PNG usando `canvas`
6. Cachea el resultado
7. Usa el PNG para preview, impresión y PDF

---

## IDs obligatorios en cada SVG

```text
nombre_producto
precio_antes
precio_ahora
cuota_semanal
fecha_vigencia
```

Fecha de impresión (uno de estos):

```text
Fecha_impresion
fecha_impresion
FECHA_IMPRESION
```

Recomendado:

```text
box_nombre_producto
```

---

## Crear una nueva plantilla SVG

1. Copiar una plantilla existente desde `resource/svg`
2. Editar el diseño en Inkscape o Illustrator
3. **No modificar** los IDs obligatorios
4. Ajustar `box_nombre_producto`
5. Guardar el SVG
6. Registrar la plantilla en `index.html`:

```html
<option value="miPlantilla1.svg">Mi Plantilla</option>
```

---

## Seguridad del SVG

Antes de renderizar:

- Se eliminan scripts y objetos
- Se eliminan eventos (`onClick`, etc.)
- Se bloquean URLs externas
- Solo se permiten imágenes base64 (`data:image/...`)

---

## Importación desde Excel

Columnas requeridas:

- Plantilla
- Tamaño
- Nombre
- Antes
- Ahora
- Cuota
- Cantidad

Columnas opcionales:

- AgregarVigencia
- VigenciaInicio
- VigenciaFin

⚠️ **Regla crítica:**  
Si una fila tiene error, **se rechaza todo el archivo**.

---

## Exportación a PDF

- Implementada con **jsPDF**
- Tamaño Carta
- Orientación vertical
- Inserta PNGs generados desde SVG

---

## Impresión

- Construye páginas temporales
- Ejecuta `window.print()`
- Usa CSS específico para impresión

---

## Persistencia

Todo el estado se guarda automáticamente en:

```
localStorage["editor_etiquetas_state_v7_secure"]
```

---

## Extender el sistema

Para agregar un nuevo campo:

1. Agregar ID en `SVG_IDS`
2. Agregar propiedad al producto
3. Modificar formulario
4. Modificar render SVG
5. Modificar Excel (si aplica)
6. Agregar el texto al SVG

---

## Errores comunes

- La plantilla no se muestra si no está registrada
- Las imágenes desaparecen si el SVG usa URLs externas
- El PDF sale en blanco si faltan IDs obligatorios
- No funciona sin servidor HTTP

---

## Licencia – Libre Uso sin Garantía

**Licencia de Uso Libre (Free Use License – FUL)**

Se concede permiso, de forma gratuita, para usar, copiar, modificar, fusionar, publicar, distribuir y reutilizar este software, con o sin modificaciones, para cualquier propósito, incluyendo fines comerciales.

### Condiciones

- El software se proporciona **“TAL CUAL”**, sin garantía de ningún tipo.
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
