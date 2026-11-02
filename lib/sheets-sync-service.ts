import { query, transaction } from "@/lib/db";
import { getSheetsClient } from "@/app/lib/googleAuth";

const MONTH_NAMES = [
  "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
  "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"
];

function getMesFromIsoDate(isoDate: string | null): string {
  if (!isoDate) return "";
  const parts = isoDate.split("-");
  if (parts.length >= 2) {
    const m = parseInt(parts[1], 10);
    return MONTH_NAMES[m - 1] || "";
  }
  return "";
}

function formatToIsoDate(fechaStr: any): string | null {
  if (!fechaStr) return null;
  const str = String(fechaStr).trim();
  const parts = str.split(/[\/\-]/);
  if (parts.length === 3) {
    let d = parts[0].padStart(2, "0");
    let m = parts[1].padStart(2, "0");
    let y = parts[2];
    if (y.length === 2) y = "20" + y;
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
    }
    return `${y}-${m}-${d}`;
  }
  return null;
}

async function batchInsert(
  client: any,
  table: string,
  columns: string[],
  rowsData: any[][],
  batchSize = 350
) {
  if (!rowsData || rowsData.length === 0) return 0;
  let totalInserted = 0;

  for (let i = 0; i < rowsData.length; i += batchSize) {
    const batch = rowsData.slice(i, i + batchSize);
    const valuePlaceholders: string[] = [];
    const values: any[] = [];

    batch.forEach((row) => {
      const rowPlaceholders: string[] = [];
      row.forEach((val) => {
        values.push(val);
        rowPlaceholders.push(`$${values.length}`);
      });
      valuePlaceholders.push(`(${rowPlaceholders.join(", ")})`);
    });

    const queryStr = `INSERT INTO ${table} (${columns.join(", ")}) VALUES ${valuePlaceholders.join(", ")}`;
    await client.query(queryStr, values);
    totalInserted += batch.length;
  }

  return totalInserted;
}

export interface SyncResult {
  success: boolean;
  instalaciones: number;
  solicitudes: number;
  elapsedSeconds: string;
  syncedAt: string;
}

export async function runSheetsSync(): Promise<SyncResult> {
  const startTime = Date.now();
  const sheets = await getSheetsClient();

  // IDs de hojas oficiales
  const CUADRO_DIARIO_SPREADSHEET_ID = "1rAV3gl6BWKRnXuC8IO6e7r2yPaEnWmuAOW_gyic5RiQ";
  const SOLICITUDES_SPREADSHEET_ID =
    process.env.SPREADSHEET_ID || "1UZvhPyYhw8NV-_wwPESWQiGfqnwkASABr4JSBPRJoUw";

  // ── 1. LEER CUADRO DIARIO (Instalaciones reales ejecutadas) ────────────────
  let dataResponse: any;
  try {
    dataResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: CUADRO_DIARIO_SPREADSHEET_ID,
      range: "'CUADRO DIARIO'",
    });
  } catch (e1) {
    // Respaldo en caso de que cambie el ID
    dataResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: "1_PzDJLZ8jnPTZq9PgQMLfomwBwles8XOd8RD5Ksko2Y",
      range: "'DATA LIMPIA'",
    });
  }

  const rawInstalaciones = dataResponse.data.values || [];
  const parsedInstalaciones: any[][] = [];

  if (rawInstalaciones.length > 1) {
    for (let i = 1; i < rawInstalaciones.length; i++) {
      const r = rawInstalaciones[i];
      // En CUADRO DIARIO col B (índice 1) es Fecha; si no, verificar col A (índice 0)
      let rawFecha = r[1] !== undefined ? String(r[1]).trim() : "";
      let offset = 0; // offset = 0 si col 1 es Fecha (CUADRO DIARIO estándar)

      if (!rawFecha || !rawFecha.includes("/") && !rawFecha.includes("-")) {
        // Podría ser DATA LIMPIA donde col 0 es Fecha
        if (r[0] && (String(r[0]).includes("/") || String(r[0]).includes("-"))) {
          rawFecha = String(r[0]).trim();
          offset = -1;
        }
      }

      if (!rawFecha || rawFecha.toUpperCase() === "FECHA") continue;
      const fecha = formatToIsoDate(rawFecha);
      if (!fecha) continue;

      // Obtener campos respetando la estructura de CUADRO DIARIO
      const equipo = r[3 + offset] ? String(r[3 + offset]).trim() : "";
      const nombreCliente = r[8 + offset] ? String(r[8 + offset]).trim() : "";
      const cedula = r[9 + offset] ? String(r[9 + offset]).trim() : "";
      const estatusRaw = r[13 + offset] ? String(r[13 + offset]).trim().toUpperCase() : "";

      // Filtrar filas de resumen, totales financieros o cupos de técnicos vacíos sin cliente ni cédula
      if (!nombreCliente && !cedula) continue;
      if (
        nombreCliente.toUpperCase().includes("TOTAL") ||
        estatusRaw.includes("DIVISAS") ||
        estatusRaw.includes("PAGO") ||
        estatusRaw.includes("EFECTIVO")
      ) {
        continue;
      }

      // En CUADRO DIARIO, toda instalación real requiere obligatoriamente estatus operativo y equipo técnico asignado
      // Filas sin estatus o sin equipo corresponden a abonos contables o entregas de router a clientes ya instalados
      if (!estatusRaw || !equipo) continue;

      const mes = r[2 + offset]
        ? String(r[2 + offset]).trim().toUpperCase()
        : getMesFromIsoDate(fecha);
      const tec1 = r[4 + offset] ? String(r[4 + offset]).trim() : null;
      const tec2 = r[5 + offset] ? String(r[5 + offset]).trim() : null;
      const router = r[6 + offset] ? String(r[6 + offset]).trim() : "0";
      const zona = r[10 + offset] ? String(r[10 + offset]).trim() : "";
      const sector = r[11 + offset] ? String(r[11 + offset]).trim() : "";
      const asesor = r[12 + offset] ? String(r[12 + offset]).trim() : "Sin Asesor";
      const plan = r[14 + offset] ? String(r[14 + offset]).trim() : "";
      const powerGo =
        r[15 + offset] && String(r[15 + offset]).trim().toUpperCase().includes("S")
          ? "SI"
          : "NO";

      parsedInstalaciones.push([
        fecha,
        mes,
        tec1,
        tec2,
        router,
        nombreCliente || "Cliente",
        cedula,
        zona,
        sector,
        asesor,
        "comercial",
        estatusRaw || "INSTALADO",
        plan,
        powerGo,
        "Internet Fibra",
        "",
        null,
      ]);
    }
  }

  // ── 2. LEER SOLICITUDES DE CLIENTES ───────────────────────────────────────
  const parsedSolicitudes: any[][] = [];
  try {
    const solResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SOLICITUDES_SPREADSHEET_ID,
      range: "SOLICITUDES",
    });

    const solRows = solResponse.data.values || [];
    if (solRows.length > 1) {
      const headers = solRows[0].map((h: any) => String(h || "").trim().toUpperCase());
      const idxFecha = headers.findIndex((h: string) => h.includes("FECHA"));
      const idxMes = headers.findIndex((h: string) => h === "MES");
      const idxAsesor = headers.findIndex((h: string) => h.includes("ASESOR"));
      const idxNombre = headers.findIndex((h: string) => h.includes("NOMBRE"));
      const idxEstatus = headers.findIndex((h: string) => h === "ESTATUS");
      const idxCedula = headers.findIndex((h: string) => h.includes("CEDULA") || h.includes("CÉDULA"));
      const idxPlan = headers.findIndex((h: string) => h.includes("PLAN"));
      const idxOperacion = headers.findIndex((h: string) => h.includes("OPERACION") || h.includes("OPERACIÓN"));
      const idxPowerGo = headers.findIndex((h: string) => h.includes("POWERGO") || h.includes("POWER GO"));
      const idxEstado = headers.findIndex((h: string) => h === "ESTADO");
      const idxMunicipio = headers.findIndex((h: string) => h === "MUNICIPIO");
      const idxParroquia = headers.findIndex((h: string) => h === "PARROQUIA");
      const idxSector = headers.findIndex((h: string) => h === "SECTOR");
      const idxCanal = headers.findIndex((h: string) => h.includes("CANAL"));
      const idxSede = headers.findIndex((h: string) => h.includes("SEDE"));
      const idxFuente = headers.findIndex((h: string) => h === "FUENTE");

      for (let i = 1; i < solRows.length; i++) {
        const r = solRows[i];
        const rawFecha = idxFecha >= 0 && r[idxFecha] ? String(r[idxFecha]).trim() : "";
        const fechaIso = formatToIsoDate(rawFecha) || new Date().toISOString().split("T")[0];
        const mes =
          (idxMes >= 0 && r[idxMes] ? String(r[idxMes]).trim().toUpperCase() : "") ||
          getMesFromIsoDate(fechaIso);

        const asesor = idxAsesor >= 0 && r[idxAsesor] ? String(r[idxAsesor]).trim() : "Sin Asesor";
        const nombre = idxNombre >= 0 && r[idxNombre] ? String(r[idxNombre]).trim() : "";
        const estatus = idxEstatus >= 0 && r[idxEstatus] ? String(r[idxEstatus]).trim() : "Pendiente";
        const cedula = idxCedula >= 0 && r[idxCedula] ? String(r[idxCedula]).trim() : "";
        const plan = idxPlan >= 0 && r[idxPlan] ? String(r[idxPlan]).trim() : "";
        const operacion = idxOperacion >= 0 && r[idxOperacion] ? String(r[idxOperacion]).trim() : "Instalación";
        const powerGo = idxPowerGo >= 0 && r[idxPowerGo] && String(r[idxPowerGo]).toUpperCase().includes("S") ? "SI" : "NO";
        const estado = idxEstado >= 0 && r[idxEstado] ? String(r[idxEstado]).trim() : "";
        const municipio = idxMunicipio >= 0 && r[idxMunicipio] ? String(r[idxMunicipio]).trim() : "";
        const parroquia = idxParroquia >= 0 && r[idxParroquia] ? String(r[idxParroquia]).trim() : "";
        const sector = idxSector >= 0 && r[idxSector] ? String(r[idxSector]).trim() : "";
        const canal = idxCanal >= 0 && r[idxCanal] ? String(r[idxCanal]).trim() : "";
        const sede = idxSede >= 0 && r[idxSede] ? String(r[idxSede]).trim() : "";
        const fuente = idxFuente >= 0 && r[idxFuente] ? String(r[idxFuente]).trim() : "";

        parsedSolicitudes.push([
          fechaIso,
          mes,
          asesor,
          asesor,
          nombre,
          cedula,
          plan,
          estatus,
          operacion,
          powerGo,
          estado,
          municipio,
          parroquia,
          sector,
          canal,
          sede,
          fuente,
        ]);
      }
    }
  } catch (solErr: any) {
    console.warn("Aviso al leer SOLICITUDES:", solErr.message);
  }

  // ── 3. ACTUALIZACIÓN ATÓMICA EN POSTGRESQL ─────────────────────────────────
  let insCount = 0;
  let solCount = 0;

  await transaction(async (client) => {
    if (parsedInstalaciones.length > 0) {
      await client.query("TRUNCATE TABLE public.instalaciones RESTART IDENTITY;");
      const columnasInst = [
        "fecha",
        "mes",
        "tecnico_1",
        "tecnico_2",
        "router",
        "nombre_cliente",
        "cedula",
        "zona",
        "sector",
        "asesor",
        "tipo_asesor",
        "estatus",
        "plan",
        "power_go",
        "servicio",
        "oficina",
        "estado",
      ];
      insCount = await batchInsert(client, "public.instalaciones", columnasInst, parsedInstalaciones);
    }

    if (parsedSolicitudes.length > 0) {
      await client.query("TRUNCATE TABLE public.solicitudes RESTART IDENTITY;");
      const columnasSol = [
        "fecha_solicitud",
        "mes",
        "promotor",
        "asesor_normalizado",
        "nombre_cliente",
        "cedula",
        "plan",
        "estatus",
        "tipo_operacion",
        "power_go",
        "estado",
        "municipio",
        "parroquia",
        "sector",
        "canal",
        "sede_taquilla",
        "fuente",
      ];
      solCount = await batchInsert(client, "public.solicitudes", columnasSol, parsedSolicitudes);
    }
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  return {
    success: true,
    instalaciones: insCount,
    solicitudes: solCount,
    elapsedSeconds: elapsed,
    syncedAt: new Date().toISOString(),
  };
}
