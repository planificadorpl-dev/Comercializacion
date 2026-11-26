# Estándar y Reglas Visuales del Proyecto

Documento maestro de directrices de diseño visual, interfaz de usuario (UI) y experiencia de usuario (UX) para el proyecto.

---

## 🎯 Filosofía General de Diseño
El proyecto adopta una estética de **minimalismo radical, diseño abierto y tipografía limpia**. La interfaz debe respirar de forma natural sobre el lienzo, prescindiendo de recuadros saturados, bordes perimetrales agresivos, sombras pesadas y colores estridentes.

---

## 1. Estructura de Contenido y Contenedores

### 🚫 Prohibido
* **Cero cuadros o tarjetas encerradas (*No boxed cards*)**: NUNCA envolver secciones, formularios, listas, métricas (KPIs) o bloques de contenido en recuadros cerrados (`border rounded-lg`, `border rounded-xl`, `border border-neutral-200`, `shadow-sm` tipo card cerrada).
* No estructurar la pantalla como una cuadrícula de cajas independientes.

### ✅ Estándar Aprobado
* **Lienzo abierto**: La información se despliega de forma despejada y fluida directamente sobre el fondo.
* **Separadores difusos**: Para delimitar filas, columnas o bloques, usar únicamente líneas sutiles o gradientes tenues:
  * `border-b border-neutral-100` o `border-b border-neutral-200/60`
  * `divide-y divide-neutral-100`
  * `bg-gradient-to-r from-transparent via-neutral-200 to-transparent h-[1px]`

---

## 2. Botones y Controles de Acción

### 🚫 Prohibido
* **Cero recuadros, pastillas o fondos en botones**: NO usar botones con bordes perimetrales (`border`), fondos sólidos o grises (`bg-white`, `bg-neutral-100`, `bg-neutral-50`) ni sombras.
* No encapsular las acciones en cajas de clic evidentes.

### ✅ Estándar Aprobado
* **Icon-Only**: Los botones de acción deben mostrar **únicamente el icono**, con transiciones suaves de color en el texto:
  ```tsx
  // Ejemplo correcto
  <button className="text-neutral-400 hover:text-neutral-900 transition-colors">
    <Icon className="w-4 h-4" />
  </button>
  ```
* **Botones textuales limpios**: Si el botón lleva texto, mostrar únicamente la palabra limpia, sin contenedor ni pastilla:
  ```tsx
  // Ejemplo correcto
  <button className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors">
    Guardar cambios
  </button>
  ```

---

## 3. Selectores y Campos de Formulario (Inputs)

### 🚫 Prohibido
* **PROHIBIDO EL USO DE SELECTORES NATIVOS (`<select>`, `<option>`)**: Nunca utilizar etiquetas HTML `<select>` nativas ni menús desplegables genéricos del navegador con fondos azules de sistema operativo.
* **Cero inputs encapsulados**: No usar campos de texto encerrados en recuadros (`border rounded-md px-3 py-2`).

### ✅ Estándar Aprobado
* **Menús desplegables popover personalizados**: Utilizar siempre el componente [`CustomDropdown`](components/ui/custom-dropdown.tsx) con tipografía neutra, chevron sutil y apertura suave.
* **Inputs con línea base minimalista**:
  ```tsx
  // Ejemplo correcto
  <input
    type="text"
    className="bg-transparent border-b border-neutral-200 focus:border-neutral-900 py-1.5 text-sm text-neutral-900 outline-none transition-colors"
  />
  ```

---

## 4. Acciones en Tablas y Filas

### 🚫 Prohibido
* **NUNCA usar botes de basura (`Trash2`)**: Está terminantemente prohibido usar iconos de papelera para descartar o eliminar registros.
* No mantener los botones de acción permanentemente visibles con colores contrastantes.

### ✅ Estándar Aprobado
* **Iconografía fina y refinada**:
  * **Edición**: Lápiz refinado `PenLine` con trazo fino (`stroke-[1.25]`).
  * **Eliminación / Descarte**: **Únicamente la cruz minimalista (`X`)** con trazo sutil (`stroke-[1.5]`).
* **Microinteracciones en hover**: Los iconos de acción deben permanecer ocultos o sumamente tenues y revelarse fluidamente solo al pasar el cursor sobre la fila (`group-hover`):
  ```tsx
  // Ejemplo en fila de tabla o lista
  <tr className="group hover:bg-neutral-50/50 transition-colors">
    {/* Contenido de la fila */}
    <td className="text-right">
      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center justify-end gap-2">
        <button className="text-neutral-400 hover:text-neutral-900 transition-colors">
          <PenLine className="w-3.5 h-3.5" strokeWidth={1.25} />
        </button>
        <button className="text-neutral-400 hover:text-neutral-900 transition-colors">
          <X className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>
      </div>
    </td>
  </tr>
  ```

---

## 5. Alertas, Notificaciones y Diálogos

### 🚫 Prohibido
* **Cero banners visuales en bloque o con colores de fondo**: NUNCA crear alertas rectangulares horizontales con fondos de color (`bg-emerald-50`, `bg-red-50`, `bg-amber-50`, `border-emerald-200`, etc.).
* **PROHIBICIÓN ABSOLUTA DE DIÁLOGOS NATIVOS**: Nunca usar `window.confirm()`, `window.alert()` ni `window.prompt()`. Las ventanas emergentes del sistema operativo ("localhost dice...") están estrictamente prohibidas.

### ✅ Estándar Aprobado
* **Feedback minimalista en línea**: Confirmar acciones con texto neutro discreto (`text-neutral-500`, `text-neutral-900`), iconos sutiles o cambios de estado inline.
* **Modales / Diálogos integrados**: Para confirmaciones destructivas, usar componentes integrados como `DeleteConfirmDialog` con tipografía minimalista, desenfoque sutil (`backdrop-blur-xs`), bordes tenues y animaciones fluidas (`animate-in fade-in zoom-in-95`).

---

## 6. Tipografía, Títulos y Métricas (KPIs)

### 🚫 Prohibido
* **Cero mayúsculas sostenidas (`uppercase`)**: No usar la clase `uppercase` en títulos, encabezados, columnas de tablas ni etiquetas de métricas.
* **Sin iconos decorativos en métricas**: No colocar iconos decorativos (flechas, checkmarks, carpetas, etc.) al lado de los títulos de las métricas a menos que se solicite explícitamente.

### ✅ Estándar Aprobado
* **Capitalización natural**: Usar siempre Sentence case o Capital case sutil (ej. *"Jornadas en campo"*, *"Solicitudes enviadas"*, *"Clientes instalados"*).
* **Métricas puramente tipográficas**: Los indicadores se comunican únicamente con el número y el texto en tipografía limpia y jerárquica:
  ```tsx
  // Ejemplo correcto de métrica
  <div className="flex flex-col">
    <span className="text-xs text-neutral-500 font-normal">Solicitudes enviadas</span>
    <span className="text-2xl font-light tracking-tight text-neutral-900 mt-0.5">142</span>
  </div>
  ```

---

## 📋 Resumen Rápido (Cheatsheet)

| Elemento | ❌ Prohibido | ✅ Estándar del Proyecto |
| :--- | :--- | :--- |
| **Contenedor** | `border rounded-xl shadow-sm bg-white` | Lienzo abierto con divisores `border-b border-neutral-100` |
| **Botón de acción** | Botones con bordes, sombras o pastillas de fondo | Solo el icono `text-neutral-400 hover:text-neutral-900` |
| **Botón de texto** | Pastillas con fondo o marcos | Palabra limpia sin marco `text-neutral-500 hover:text-neutral-900` |
| **Selector** | `<select><option>...</option></select>` | `CustomDropdown` personalizado |
| **Input de texto** | `border rounded-md px-3 py-2` | Línea inferior `border-b border-neutral-200 bg-transparent py-1.5` |
| **Eliminar fila** | Icono `Trash2` (bote de basura) | **Únicamente `X` (`stroke-[1.5]`)** |
| **Editar fila** | Botón permanente o destacado | `PenLine` (`stroke-[1.25]`) revelado en hover |
| **Alertas** | Banners en bloque (`bg-emerald-50`, `bg-red-50`) | Texto neutro en línea o microindicadores sutiles |
| **Confirmaciones** | `window.confirm()` o `window.alert()` | Modales en interfaz con `backdrop-blur-xs` |
| **Títulos y KPIs** | `uppercase` e iconos decorativos | Sentence case limpio, tipografía pura sin iconos decorativos |

