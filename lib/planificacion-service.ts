import { getSheetsClient } from "@/app/lib/googleAuth";
import { geoHierarchy } from "@/lib/geo_hierarchy";
import { normGeoKey } from "@/lib/geo_normalization";
import { query, isDatabaseConfigured } from "@/lib/db";
export * from "./planificacion-types";
import {
  PLANIFICACION_SPREADSHEET_ID,
  PLANIFICACION_SHEET_NAME,
  CONF_SHEET_NAME,
  DATA_SHEET_ID,
  SPANISH_MONTHS,
  STANDARD_ACTIVITIES,
  STANDARD_STATUSES,
  PlanningSheetRecord,
  NewPlanningItem,
  SectorCatalogItem,
  PlanningMetadata,
  toIsoDateString,
  toSheetDateFormat,
  getMonthFromDate,
  buildFinalFormula,
} from "./planificacion-types";

let cachedMetadata: { data: PlanningMetadata; timestamp: number } | null = null;
const METADATA_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Obtiene exclusivamente la lista de asesores comerciales ACTIVOS
 * (excluyendo inactivos, ex-colaboradores y etiquetas del sistema).
 */
async function fetchActiveAdvisors(): Promise<string[]> {
  const exSet = new Set<string>();

  // 1. Cargar overrides de ex-colaboradores desde advisor-config.json
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const configPath = path.join(process.cwd(), "data", "advisor-config.json");
    const raw = await fs.readFile(configPath, "utf-8");
    const parsed = JSON.parse(raw);
    const overrides = parsed?.overrides || {};
    for (const [k, v] of Object.entries(overrides as Record<string, any>)) {
      if (v?.status === "ex" || v?.isExCollaborator === true) {
        exSet.add(k.toLowerCase().trim());
      }
    }
  } catch (err) {
    // Si no se puede leer el archivo, se continúa
  }

  // 2. Intentar consultar PostgreSQL asesores_config donde activo = true
  if (isDatabaseConfigured()) {
    try {
      const rows = await query<{ nombre: string }>(
        "SELECT nombre FROM public.asesores_config WHERE activo = true ORDER BY nombre ASC"
      );
      if (rows && rows.length > 0) {
        const activeList = rows
          .map((r) => r.nombre.trim())
          .filter((n) => {
            if (!n) return false;
            const lower = n.toLowerCase();
            if (lower === "planificación" || lower === "planificacion") return false;
            if (exSet.has(lower)) return false;
            return true;
          });

        if (activeList.length > 0) {
          return activeList;
        }
      }
    } catch (pgErr) {
      console.warn("Could not query active advisors from PostgreSQL:", pgErr);
    }
  }

  // 3. Respaldo curado de asesores activos actuales
  const defaultActive = [
    "Andrea Plaza", "Arianna Montaña", "Brainin Berrotera", "Cindy Infante",
    "Daiana Torres", "Danyelis Muñoz", "Diarnelis Mendoza", "Gabriela Marrero",
    "Genesis Ochoa", "Lorena Esqueda", "Maria Azuaje", "Naomi Tovar",
    "Patricia Mendoza", "Stephany Manrique", "Yaisen Herrera", "Yamery Rodriguez",
    "Yeilis Puentes", "Yesenia Teran", "Yilda Gonzalez", "Yuliana Carvajal"
  ];

  return defaultActive.filter((n) => !exSet.has(n.toLowerCase().trim()));
}

/**
 * Fetch reference metadata (advisors, activities, territorial lists) from CONF sheet and geoHierarchy
 */
export async function getPlanningMetadata(forceRefresh = false): Promise<PlanningMetadata> {
  const now = Date.now();
  if (!forceRefresh && cachedMetadata && (now - cachedMetadata.timestamp < METADATA_TTL_MS)) {
    return cachedMetadata.data;
  }

  let activitiesList: string[] = [...STANDARD_ACTIVITIES];
  const geoMap: Record<string, Record<string, Record<string, string[]>>> = JSON.parse(JSON.stringify(geoHierarchy));
  const sectorsCatalog: SectorCatalogItem[] = [];

  // Obtener solo asesores comerciales activos
  const advisorsList = await fetchActiveAdvisors();

  try {
    const sheets = await getSheetsClient();
    const confRes = await sheets.spreadsheets.values.get({
      spreadsheetId: PLANIFICACION_SPREADSHEET_ID,
      range: `${CONF_SHEET_NAME}!A2:G200`,
    });

    const rows = confRes.data.values || [];
    const activitiesSet = new Set<string>(STANDARD_ACTIVITIES);

    for (const r of rows) {
      // Col A: Estado, Col B: Municipio, Col C: Parroquia, Col D: Sector
      const estado = r[0] ? String(r[0]).trim() : "";
      const municipio = r[1] ? String(r[1]).trim() : "";
      const parroquia = r[2] ? String(r[2]).trim() : "";
      const sector = r[3] ? String(r[3]).trim() : "";
      // Col F: Actividades
      const act = r[5] ? String(r[5]).trim() : "";

      if (act) activitiesSet.add(act);

      if (estado && municipio && parroquia && sector) {
        // Buscar o crear estado insensible a tildes/mayúsculas
        const estadoKey = normGeoKey(estado);
        const canonicalEstado =
          Object.keys(geoMap).find((e) => normGeoKey(e) === estadoKey) || estado;
        if (!geoMap[canonicalEstado]) geoMap[canonicalEstado] = {};

        // Buscar o crear municipio
        const munKey = normGeoKey(municipio);
        const canonicalMun =
          Object.keys(geoMap[canonicalEstado]).find((m) => normGeoKey(m) === munKey) ||
          municipio;
        if (!geoMap[canonicalEstado][canonicalMun]) {
          geoMap[canonicalEstado][canonicalMun] = {};
        }

        // Buscar o crear parroquia
        const parKey = normGeoKey(parroquia);
        const existingPar = Object.keys(geoMap[canonicalEstado][canonicalMun]).find(
          (p) => normGeoKey(p) === parKey
        );
        const canonicalPar = existingPar || parroquia;
        if (!geoMap[canonicalEstado][canonicalMun][canonicalPar]) {
          geoMap[canonicalEstado][canonicalMun][canonicalPar] = [];
        }

        // Insertar sector si no existe (insensible a tildes/mayúsculas)
        const sectorsArr = geoMap[canonicalEstado][canonicalMun][canonicalPar];
        const secKey = normGeoKey(sector);
        if (!sectorsArr.some((s) => normGeoKey(s) === secKey)) {
          sectorsArr.push(sector);
        }
      }
    }

    activitiesList = Array.from(activitiesSet).filter(Boolean);
  } catch (err: any) {
    console.warn("Could not read CONF sheet, falling back to local hierarchies:", err.message);
  }

  // Flatten the full geoMap into a searchable catalog
  const catalogSet = new Set<string>();
  for (const [estado, municipios] of Object.entries(geoMap)) {
    for (const [municipio, parroquias] of Object.entries(municipios)) {
      for (const [parroquia, sectores] of Object.entries(parroquias)) {
        for (const sector of sectores) {
          const key = `${sector}__${parroquia}__${municipio}__${estado}`.toLowerCase();
          if (!catalogSet.has(key)) {
            catalogSet.add(key);
            sectorsCatalog.push({ sector, parroquia, municipio, estado });
          }
        }
      }
    }
  }

  // Sort sectors alphabetically
  sectorsCatalog.sort((a, b) => a.sector.localeCompare(b.sector, "es", { sensitivity: "base" }));

  advisorsList.sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));

  const result: PlanningMetadata = {
    advisors: advisorsList,
    activities: activitiesList,
    statuses: STANDARD_STATUSES,
    months: SPANISH_MONTHS,
    geoHierarchy: geoMap,
    sectorsCatalog,
  };

  cachedMetadata = {
    data: result,
    timestamp: now,
  };

  return result;
}

/**
 * Fetch all existing planning records from sheet 'Data' with exact row positions
 */
export async function getPlanningSheetRecords(): Promise<PlanningSheetRecord[]> {
  try {
    const sheets = await getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: PLANIFICACION_SPREADSHEET_ID,
      range: `${PLANIFICACION_SHEET_NAME}!A1:J`,
    });

    const values = res.data.values || [];
    if (values.length <= 1) return [];

    const headers = values[0].map((h: any) => String(h || "").trim().toUpperCase());
    const idxMes = headers.findIndex((h) => h === "MES");
    const idxFecha = headers.findIndex((h) => h === "FECHA");
    const idxAsesor = headers.findIndex((h) => h === "ASESOR");
    const idxEstado = headers.findIndex((h) => h === "ESTADO");
    const idxMunicipio = headers.findIndex((h) => h === "MUNICIPIO");
    const idxParroquia = headers.findIndex((h) => h === "PARROQUIA");
    const idxSector = headers.findIndex((h) => h === "SECTOR");
    const idxActividad = headers.findIndex((h) => h.includes("ACTIVIDAD"));
    const idxEstatus = headers.findIndex((h) => h === "ESTATUS");
    const idxFinal = headers.findIndex((h) => h === "FINAL");

    const records: PlanningSheetRecord[] = [];

    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      if (!row || row.length === 0) continue;

      const rawFecha = idxFecha >= 0 && row[idxFecha] !== undefined ? String(row[idxFecha]).trim() : "";
      if (!rawFecha || rawFecha.toUpperCase() === "FECHA") continue;

      const rawAsesor = idxAsesor >= 0 && row[idxAsesor] !== undefined ? String(row[idxAsesor]).trim() : "";
      if (!rawAsesor) continue;

      const mes = idxMes >= 0 && row[idxMes] !== undefined ? String(row[idxMes]).trim().toUpperCase() : getMonthFromDate(rawFecha);
      const estado = idxEstado >= 0 && row[idxEstado] !== undefined ? String(row[idxEstado]).trim() : "";
      const municipio = idxMunicipio >= 0 && row[idxMunicipio] !== undefined ? String(row[idxMunicipio]).trim() : "";
      const parroquia = idxParroquia >= 0 && row[idxParroquia] !== undefined ? String(row[idxParroquia]).trim() : "";
      const sector = idxSector >= 0 && row[idxSector] !== undefined ? String(row[idxSector]).trim() : "";
      const actividad = idxActividad >= 0 && row[idxActividad] !== undefined ? String(row[idxActividad]).trim() : "";
      const estatus = idxEstatus >= 0 && row[idxEstatus] !== undefined ? String(row[idxEstatus]).trim() : "Planificado";
      const finalVal = idxFinal >= 0 && row[idxFinal] !== undefined ? String(row[idxFinal]).trim() : "";

      const isoFecha = toIsoDateString(rawFecha);

      records.push({
        sheetRowIndex: i + 1, // 1-indexed in Google Sheets (Row 1 is header, Row 2 is i=1)
        id: `row_${i + 1}`,
        mes,
        fecha: rawFecha,
        isoFecha,
        asesor: rawAsesor,
        estado,
        municipio,
        parroquia,
        sector,
        tipo_actividad: actividad,
        estatus,
        final: finalVal,
      });
    }

    return records;
  } catch (err: any) {
    console.error("Error reading Planning records from Sheet Data:", err.message);
    throw err;
  }
}

/**
 * Appends new planning records to sheet 'Data' in Google Sheets
 */
export async function appendPlanningRecords(items: NewPlanningItem[]): Promise<{ insertedCount: number; message: string }> {
  if (!items || items.length === 0) {
    return { insertedCount: 0, message: "No se proporcionaron registros para agregar." };
  }

  const sheets = await getSheetsClient();

  // First, find the current last row to build formulas if needed
  const colARes = await sheets.spreadsheets.values.get({
    spreadsheetId: PLANIFICACION_SPREADSHEET_ID,
    range: `${PLANIFICACION_SHEET_NAME}!A:A`,
  });

  const currentCount = (colARes.data.values || []).length;
  let nextRow = currentCount + 1;

  const rowsToAppend = items.map((item, idx) => {
    const rowNum = nextRow + idx;
    const isoFecha = toIsoDateString(item.fecha);
    const sheetFecha = toSheetDateFormat(isoFecha);
    const mes = (item.mes || getMonthFromDate(isoFecha)).toUpperCase();
    const asesor = item.asesor.trim();
    const estado = (item.estado || "").trim();
    const municipio = (item.municipio || "").trim();
    const parroquia = (item.parroquia || "").trim();
    const sector = (item.sector || "").trim();
    const actividad = (item.tipo_actividad || "Recorrido con Instaladores").trim();
    const estatus = (item.estatus || "Planificado").trim();
    const finalFormula = buildFinalFormula(rowNum, asesor, parroquia, actividad, estatus);

    // Columns: [ MES, Fecha, Asesor, Estado, Municipio, Parroquia, Sector, Tipo de Actividad, Estatus, FINAL ]
    return [
      mes,
      sheetFecha,
      asesor,
      estado,
      municipio,
      parroquia,
      sector,
      actividad,
      estatus,
      finalFormula,
    ];
  });

  const appendRes = await sheets.spreadsheets.values.append({
    spreadsheetId: PLANIFICACION_SPREADSHEET_ID,
    range: `${PLANIFICACION_SHEET_NAME}!A1:J`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: rowsToAppend,
    },
  });

  return {
    insertedCount: rowsToAppend.length,
    message: `${rowsToAppend.length} ${rowsToAppend.length === 1 ? "registro planificado guardado" : "registros planificados guardados"} en la hoja Data.`,
  };
}

/**
 * Updates a single row in sheet 'Data'
 */
export async function updatePlanningRecord(sheetRowIndex: number, item: NewPlanningItem): Promise<{ success: boolean; message: string }> {
  if (!sheetRowIndex || sheetRowIndex < 2) {
    throw new Error("Índice de fila inválido.");
  }

  const sheets = await getSheetsClient();
  const isoFecha = toIsoDateString(item.fecha);
  const sheetFecha = toSheetDateFormat(isoFecha);
  const mes = (item.mes || getMonthFromDate(isoFecha)).toUpperCase();
  const asesor = item.asesor.trim();
  const estado = (item.estado || "").trim();
  const municipio = (item.municipio || "").trim();
  const parroquia = (item.parroquia || "").trim();
  const sector = (item.sector || "").trim();
  const actividad = (item.tipo_actividad || "Recorrido con Instaladores").trim();
  const estatus = (item.estatus || "Planificado").trim();
  const finalFormula = buildFinalFormula(sheetRowIndex, asesor, parroquia, actividad, estatus);

  const rowData = [
    mes,
    sheetFecha,
    asesor,
    estado,
    municipio,
    parroquia,
    sector,
    actividad,
    estatus,
    finalFormula,
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId: PLANIFICACION_SPREADSHEET_ID,
    range: `${PLANIFICACION_SHEET_NAME}!A${sheetRowIndex}:J${sheetRowIndex}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [rowData],
    },
  });

  return {
    success: true,
    message: `Fila ${sheetRowIndex} actualizada correctamente.`,
  };
}

/**
 * Deletes a row from sheet 'Data' using Google Sheets deleteDimension
 */
export async function deletePlanningRecord(sheetRowIndex: number): Promise<{ success: boolean; message: string }> {
  if (!sheetRowIndex || sheetRowIndex < 2) {
    throw new Error("No se puede eliminar la fila de encabezados ni un índice inválido.");
  }

  const sheets = await getSheetsClient();

  // startIndex is 0-indexed inclusive; row 2 in sheet has 0-indexed index 1
  const startIndex = sheetRowIndex - 1;
  const endIndex = sheetRowIndex;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: PLANIFICACION_SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: DATA_SHEET_ID,
              dimension: "ROWS",
              startIndex,
              endIndex,
            },
          },
        },
      ],
    },
  });

  return {
    success: true,
    message: `Fila eliminada correctamente de la hoja Data.`,
  };
}

