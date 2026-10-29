# GUÍA DE RESTAURACIÓN Y PUESTA EN MARCHA EN NUEVO ORDENADOR
================================================================================
Proyecto: Intranet de Ventas & Operaciones (Next.js + PostgreSQL + Google Sheets)
Fecha del Respaldo: 28 de Octubre de 2026
================================================================================

Este respaldo contiene el código fuente esencial, configuraciones, credenciales de conexión
y la copia completa de la base de datos PostgreSQL (`ventas_intranet`) con sus 9.002 instalaciones
y 6.503 solicitudes actualizadas.

Se omitieron deliberadamente las carpetas pesadas regenerables (`node_modules` y `.next`)
para que el archivo sea liviano (~15 MB en total) y muy rápido de transferir por pendrive o red.

--------------------------------------------------------------------------------
1. PROGRAMAS NECESARIOS EN LA NUEVA COMPUTADORA
--------------------------------------------------------------------------------
Antes de comenzar, asegúrate de tener instalados estos dos programas gratuitos:

1. **Node.js** (Versión 18, 20 o 22 LTS):
   - Descarga gratuita: https://nodejs.org/
   - Al instalar, sigue las opciones predeterminadas (Next -> Next -> Install).

2. **PostgreSQL 16 & pgAdmin 4**:
   - Descarga oficial EnterpriseDB: https://www.enterprisedb.com/downloads/postgres-postgresql-downloads
   - Durante la instalación:
     * Cuando solicite la contraseña para el usuario `postgres`, escribe una clave que recuerdes
       (Sugerencia: usa `Jmlr25531617+-` para no tener que editar el archivo `.env.local`).
     * Puerto: Deja el predeterminado `5432`.
     * Componentes: Asegúrate de que estén marcados `PostgreSQL Server` y `pgAdmin 4`.

--------------------------------------------------------------------------------
2. PASO A PASO: RESTAURAR LA BASE DE DATOS EN pgAdmin 4
--------------------------------------------------------------------------------

### Paso 2.1: Abrir pgAdmin 4 y crear la base de datos
1. Abre **pgAdmin 4** desde el menú Inicio de Windows.
2. Ingresa la clave maestra que definiste al instalar PostgreSQL.
3. En el panel izquierdo, despliega: **Servers** -> **PostgreSQL 16**.
4. Haz clic derecho sobre **Databases** -> **Create** -> **Database...**
5. En la ventana emergente:
   - **Database**: escribe exactamente `ventas_intranet`
   - **Owner**: `postgres`
6. Haz clic en **Save** (Guardar).

---

### Paso 2.2: Restaurar los datos (Elige Método A o Método B)

#### Método A: Restauración gráfica con pgAdmin 4 (Más fácil)
1. En el panel izquierdo de pgAdmin 4, haz clic derecho sobre la base de datos recién creada `ventas_intranet`.
2. Selecciona **Restore...** (Restaurar).
3. En la pestaña **General**:
   - En **Filename** (Nombre de archivo), haz clic en el icono de carpeta 📁 a la derecha.
   - En la ventana de búsqueda, cambia el filtro de abajo a **All files (*)**.
   - Navega hasta la carpeta del proyecto y entra a:
     `database_backup/backup_ventas_intranet.dump` (o `backup_ventas_intranet.sql`).
   - Selecciónalo y haz clic en **Select**.
4. Haz clic en el botón inferior **Restore**.
5. ¡Listo! En unos segundos pgAdmin mostrará el mensaje de proceso completado con éxito.

#### Método B: Por el Query Tool de pgAdmin 4
1. Haz clic derecho sobre `ventas_intranet` -> selecciona **Query Tool** (Herramienta de Consulta).
2. Haz clic en el icono de Abrir archivo 📂 (o presiona `Ctrl + O`).
3. Selecciona el archivo `database_backup/backup_ventas_intranet.sql`.
4. Haz clic en el botón de Ejecutar ▶ (o presiona la tecla `F5`).
5. Tras unos segundos verás el mensaje: *"Query returned successfully"*.

#### Método C: Por Terminal (PowerShell / CMD como Administrador)
Si prefieres restaurar por comando en un solo paso:
```powershell
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d ventas_intranet -f "database_backup\backup_ventas_intranet.sql"
```

--------------------------------------------------------------------------------
3. PASO A PASO: INICIAR EL PROYECTO WEB
--------------------------------------------------------------------------------

1. **Ubicación**:
   Copia la carpeta de este respaldo (ej. `C:\Users\tu_usuario\Desktop\ventas`).

2. **Verificar contraseña en `.env.local`**:
   Abre el archivo `.env.local` con el Bloc de Notas.
   Verifica la línea:
   ```env
   DATABASE_URL=postgresql://postgres:Jmlr25531617+-@localhost:5432/ventas_intranet
   ```
   *(Si al instalar PostgreSQL en esta PC colocaste otra clave, cámbiala ahí)*.

3. **Abrir Terminal**:
   Abre PowerShell o la consola dentro de la carpeta del proyecto (o ábrela en VS Code).

4. **Instalar dependencias**:
   Ejecuta:
   ```powershell
   npm install
   ```

5. **Iniciar el servidor local**:
   Ejecuta:
   ```powershell
   npm run dev
   ```

6. **Abrir el Dashboard**:
   Abre Google Chrome o tu navegador en:
   ```
   http://localhost:3000
   ```
   (o el puerto indicado en la consola, ej. 3001).

--------------------------------------------------------------------------------
4. ESTRUCTURA DE ARCHIVOS DE ESTE RESPALDO
--------------------------------------------------------------------------------
- `database_backup/`                -> Copia de seguridad completa de PostgreSQL:
    * `backup_ventas_intranet.sql`  -> Archivo SQL plano con estructura y datos completos.
    * `backup_ventas_intranet.dump` -> Archivo binario comprimido nativo para pgAdmin 4.
- `app/`                            -> Rutas, dashboards, páginas y APIs de Next.js.
- `components/`                     -> Componentes UI, modales, tablas y gráficos.
- `lib/`                            -> Lógica de sincronización atómica y consultas a PostgreSQL.
- `db/`                             -> Scripts SQL de inicialización y esquema.
- `data/`                           -> Catálogos y configuración de asesores y metas.
- `scripts/`                        -> Scripts de sincronización manual y automática (.bat, .vbs).
- `.env.local`                      -> Variables de entorno y conexión a la base de datos.
- `credentials.json`                -> Credenciales seguras de Google Sheets API.
- `package.json` & configs          -> Dependencias exactas de Node.js y Next.js.
================================================================================
