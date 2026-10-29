<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Reglas de Diseño Visual del Proyecto

## 1. Botones y Controles (Strict Rule)
- **Cero recuadros o marcos en botones**: NO usar botones con bordes (`border`), cajas de fondo (`bg-white`, `bg-neutral-100`, pastillas o sombras) a menos que el usuario lo solicite explícitamente.
- **Icon-Only y Tipografía Limpia**:
  - Los botones de acción deben mostrar **únicamente el icono** (`<Icon className="..." />`) con transiciones suaves de color de texto (`text-neutral-400 hover:text-neutral-900 transition-colors`).
  - Los botones textuales deben mostrar **únicamente la palabra** limpia sin recuadros ni pastillas de fondo.
  - Para selectores y menús, usar estilos tipográficos o de texto fluido con chevron sutil, sin encerrarlos en cajas de formulario.
- **PROHIBIDO EL USO DE SELECTORES NATIVOS (`<select>`, `<option>`)**: Nunca utilizar etiquetas HTML `<select>` nativas ni menús desplegables genéricos del navegador con fondos azules de sistema operativo. Siempre implementar menús desplegables popover personalizados (`CustomDropdown`) con tipografía sutil, sombras tenues, bordes neutros y estados hover acordes a la identidad visual minimalista del proyecto.

## 2. Alertas, Notificaciones y Banners (Strict Rule)
- **Cero alertas visuales en bloque o con colores de fondo**: NUNCA crear banners de alerta o notificaciones rectangulares con fondos verdes, rojos, amarillos ni bordes coloreados (ej: `bg-emerald-50`, `border-emerald-200`, `bg-red-50`, `bg-green-100`, etc.) a menos que el usuario lo solicite directamente y de forma explícita.
- **Feedback Minimalista y Discreto**:
  - Para confirmar acciones (guardado, creación, eliminación), usar indicadores tipográficos sutiles en texto neutro (`text-neutral-500`, `text-neutral-900`), iconos discretos que desaparecen suavemente o cambios de estado en línea sin romper la armonía visual de la página.
  - No generar barras horizontales que ocupen el ancho de la pantalla con fondos pasteles o llamativos.

## 3. Acciones en Tablas y Filas (Strict Rule)
- **Iconografía fina y discreta**:
  - Para edición, usar el icono de lápiz refinado (`PenLine` con `stroke-[1.25]`).
  - Para eliminar o descartar registros, usar **únicamente la cruz minimalista (`X`)** con trazo sutil (`stroke-[1.5]`), **NUNCA usar botes de basura (`Trash2`)**.
  - Los iconos de acción deben permanecer ocultos o muy tenues (`opacity-0 group-hover:opacity-100 transition-opacity duration-150`), revelándose fluidamente únicamente al pasar el ratón (hover) sobre la fila correspondiente.
  - Colores siempre en gamas neutras (`text-neutral-400 hover:text-neutral-900 transition-colors`).

## 4. Prohibición de Alertas y Diálogos Nativos del Navegador (Strict Rule)
- **NUNCA usar diálogos nativos del navegador (`window.confirm()`, `window.alert()`, `window.prompt()`)**:
  - Están terminantemente prohibidas las ventanas emergentes del sistema operativo o del navegador ("localhost:3000 dice...", etc.).
  - Para confirmaciones destructivas o de eliminación, implementar siempre diálogos modales o popovers integrados directamente en la interfaz (`DeleteConfirmDialog`), siguiendo la identidad visual del proyecto con tipografía minimalista, desenfoque sutil de fondo (`backdrop-blur-xs`), bordes tenues y animaciones fluidas (`animate-in fade-in zoom-in-95`).

## 5. Títulos, Etiquetas e Iconos en Métricas y Encabezados (Strict Rule)
- **Cero mayúsculas sostenidas (`uppercase`) en títulos y etiquetas**: NO usar clases como `uppercase` o textos en mayúsculas sostenidas para títulos, encabezados o etiquetas de tarjetas de métricas/KPIs. Usar siempre tipografía normal con capitalización natural/oración (Sentence case o Capital case sutil: ej. "Jornadas en campo", "Solicitudes enviadas", "Clientes instalados", etc.).
- **Sin iconos decorativos en encabezados de métricas**: NO incluir iconos decorativos (como `<Send />`, `<CheckCircle />`, flechas o símbolos) junto a los títulos de las métricas ni en los encabezados, a menos que el usuario lo solicite explícitamente. Las palabras deben mostrarse limpias, legibles y puramente tipográficas.

## 6. Estructura de Contenido y Contenedores (Strict Rule)
- **Cero cuadros o tarjetas encerradas (No framed/boxed cards)**:
  - NUNCA encerrar secciones, formularios, listas, métricas o bloques de información en recuadros con bordes perimetrales completos (`border rounded-lg`, `border rounded-xl`, `border border-neutral-200` creando un marco o tarjeta cerrada).
  - La información debe presentarse abierta, despejada y minimalista sobre el lienzo.
- **Solo líneas difusas y separadores sutiles**:
  - Para separar secciones, filas o campos, usar únicamente líneas difusas o divisores sutiles (`border-b border-neutral-100`, `divide-y divide-neutral-100`, o gradientes tenues como `from-transparent via-neutral-200 to-transparent`).
  - Los campos de entrada (inputs) deben prescindir de cajas perimetrales (`border rounded`) y utilizar líneas base sutiles (`border-b border-neutral-200 focus:border-neutral-900 bg-transparent py-1.5 transition-colors`).

