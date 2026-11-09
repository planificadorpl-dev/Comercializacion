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

export function clearPlanningMetadataCache() {
  cachedMetadata = null;
}

/**
 * Obtiene exclusivamente la lista de asesores comerciales ACTIVOS
 * (excluyendo inactivos, ex-colaboradores y etiquetas del sistema).
 */
async function fetchActiveAdvisors(): Promise<string[]> {
  const exSet = new Set<string>();

  // 1. Cargar overrides de ex-colaboradores prioritariamente desde PostgreSQL (personal_config)
  if (isDatabaseConfigured()) {
    try {
      const pc = await queryRow<{ data: any }>(
        "SELECT data FROM public.personal_config WHERE key = 'main_config' LIMIT 1"
      );
      if (pc?.data?.overrides) {
        for (const [k, v] of Object.entries(pc.data.overrides as Record<string, any>)) {
          if (v?.status === "ex" || v?.isExCollaborator === true) {
            exSet.add(k.toLowerCase().trim());
          }
        }
      }
    } catch (err) {
      console.warn("Could not read ex-collaborators from personal_config:", err);
    }
  }

  // Respaldo secundario desde advisor-config.json local
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

  // 3. Respaldo curado de asesores activos actuales (excluyendo a Yeilis Puentes y otros ex-colaboradores)
  const defaultActive = [
    "Andrea Plaza", "Arianna Montaña", "Brainin Berrotera", "Cindy Infante",
    "Daiana Torres", "Danyelis Muñoz", "Diarnelis Mendoza", "Gabriela Marrero",
    "Genesis Ochoa", "Maria Azuaje", "Naomi Tovar",
    "Patricia Mendoza", "Stephany Manrique", "Yaisen Herrera", "Yamery Rodriguez",
    "Yesenia Teran", "Yilda Gonzalez", "Yuliana Carvajal"
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
 * Fetch all existing planning records from Supabase (fast cache/store) or fallback to sheet 'Data'
 */
export async function getPlanningSheetRecords(): Promise<PlanningSheetRecord[]> {
  // 1. Consultar primero en Supabase si está disponible para respuesta ultra-rápida
  if (isDatabaseConfigured()) {
    try {
      const rows = await query<any>(`
        SELECT 
          id,
          sheet_row_index,
          TO_CHAR(fecha, 'YYYY-MM-DD') as iso_fecha,
          TO_CHAR(fecha, 'DD/MM/YYYY') as sheet_fecha,
          mes,
          asesor,
          estado,
          municipio,
          parroquia,
          sector,
          tipo_actividad,
          estatus,
          formula_final
        FROM planificacion_jornadas
        ORDER BY fecha ASC, id ASC
      `);

      if (rows && rows.length > 0) {
        return rows.map((r, i) => ({
          id: String(r.id),
          sheetRowIndex: r.sheet_row_index || i + 2,
          mes: r.mes || "NOVIEMBRE",
          fecha: r.sheet_fecha,
          isoFecha: r.iso_fecha,
          asesor: r.asesor,
          estado: r.estado || "",
          municipio: r.municipio || "",
          parroquia: r.parroquia || "",
          sector: r.sector || "",
          tipo_actividad: r.tipo_actividad || "Recorrido con Instaladores",
          estatus: r.estatus || "Planificado",
          final: r.formula_final || "",
        }));
      }
    } catch (err: any) {
      console.warn("Aviso al consultar planificacion_jornadas en Supabase, recurriendo a Sheets:", err.message);
    }
  }

  // 2. Fallback a Google Sheets si la base de datos no tiene datos aún o no está configurada
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
 * Appends new planning records to Supabase and syncs to sheet 'Data' in Google Sheets
 */
export async function appendPlanningRecords(items: NewPlanningItem[]): Promise<{ insertedCount: number; message: string }> {
  if (!items || items.length === 0) {
    return { insertedCount: 0, message: "No se proporcionaron registros para agregar." };
  }

  // 1. Guardar primero de forma ultra-rápida en Supabase
  if (isDatabaseConfigured()) {
    try {
      for (const item of items) {
        const isoFecha = toIsoDateString(item.fecha);
        const mes = (item.mes || getMonthFromDate(isoFecha)).toUpperCase();
        await query(`
          INSERT INTO planificacion_jornadas (
            fecha, mes, asesor, estado, municipio, parroquia, sector, tipo_actividad, estatus, formula_final, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
          ON CONFLICT (fecha, LOWER(TRIM(asesor)))
          DO UPDATE SET
            mes = EXCLUDED.mes,
            estado = EXCLUDED.estado,
            municipio = EXCLUDED.municipio,
            parroquia = EXCLUDED.parroquia,
            sector = EXCLUDED.sector,
            tipo_actividad = EXCLUDED.tipo_actividad,
            estatus = EXCLUDED.estatus,
            formula_final = EXCLUDED.formula_final,
            updated_at = NOW()
        `, [
          isoFecha,
          mes,
          item.asesor.trim(),
          (item.estado || "").trim(),
          (item.municipio || "").trim(),
          (item.parroquia || "").trim(),
          (item.sector || "").trim(),
          (item.tipo_actividad || "Recorrido con Instaladores").trim(),
          (item.estatus || "Planificado").trim(),
          null
        ]);
      }
    } catch (dbErr: any) {
      console.error("Error al guardar planificación en Supabase:", dbErr.message);
    }
  }

  // 2. Sincronizar en Google Sheets
  try {
    const sheets = await getSheetsClient();

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

    await sheets.spreadsheets.values.append({
      spreadsheetId: PLANIFICACION_SPREADSHEET_ID,
      range: `${PLANIFICACION_SHEET_NAME}!A1:J`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: rowsToAppend,
      },
    });

    // Actualizar sheet_row_index en Supabase
    if (isDatabaseConfigured()) {
      for (let idx = 0; idx < items.length; idx++) {
        const it = items[idx];
        const rowNum = nextRow + idx;
        const iso = toIsoDateString(it.fecha);
        query(
          "UPDATE planificacion_jornadas SET sheet_row_index = $1 WHERE fecha = $2 AND LOWER(TRIM(asesor)) = LOWER(TRIM($3))",
          [rowNum, iso, it.asesor]
        ).catch(() => {});
      }
    }
  } catch (sheetErr: any) {
    console.warn("Aviso al sincronizar inserción con Google Sheets:", sheetErr.message);
  }

  return {
    insertedCount: items.length,
    message: `${items.length} ${items.length === 1 ? "registro planificado guardado" : "registros planificados guardados"}.`,
  };
}

/**
 * Updates a single planning record in Supabase and sheet 'Data'
 */
export async function updatePlanningRecord(
  sheetRowIndex: number,
  item: NewPlanningItem
): Promise<{ success: boolean; message: string }> {
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
  const finalFormula = buildFinalFormula(sheetRowIndex || 2, asesor, parroquia, actividad, estatus);

  // 1. Actualizar en Supabase inmediatamente
  if (isDatabaseConfigured()) {
    try {
      await query(`
        INSERT INTO planificacion_jornadas (
          sheet_row_index, fecha, mes, asesor, estado, municipio, parroquia, sector, tipo_actividad, estatus, formula_final, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        ON CONFLICT (fecha, LOWER(TRIM(asesor)))
        DO UPDATE SET
          sheet_row_index = COALESCE(EXCLUDED.sheet_row_index, planificacion_jornadas.sheet_row_index),
          mes = EXCLUDED.mes,
          estado = EXCLUDED.estado,
          municipio = EXCLUDED.municipio,
          parroquia = EXCLUDED.parroquia,
          sector = EXCLUDED.sector,
          tipo_actividad = EXCLUDED.tipo_actividad,
          estatus = EXCLUDED.estatus,
          formula_final = EXCLUDED.formula_final,
          updated_at = NOW()
      `, [
        sheetRowIndex || null,
        isoFecha,
        mes,
        asesor,
        estado,
        municipio,
        parroquia,
        sector,
        actividad,
        estatus,
        finalFormula
      ]);
    } catch (dbErr: any) {
      console.error("Error al actualizar en Supabase:", dbErr.message);
    }
  }

  // 2. Actualizar en Google Sheets
  if (sheetRowIndex && sheetRowIndex >= 2) {
    try {
      const sheets = await getSheetsClient();
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
    } catch (sheetErr: any) {
      console.warn("Aviso al actualizar en Google Sheets:", sheetErr.message);
    }
  }

  return {
    success: true,
    message: `Jornada actualizada correctamente en Supabase y Google Sheets.`,
  };
}

export interface BatchPlanningUpdateItem {
  sheetRowIndex: number;
  item: NewPlanningItem;
}

/**
 * Updates multiple planning records in a single batch in Supabase and Google Sheets (single HTTP call)
 */
export async function batchUpdatePlanningRecords(
  updates: BatchPlanningUpdateItem[]
): Promise<{ success: boolean; updatedCount: number; message: string }> {
  if (!updates || updates.length === 0) {
    return { success: true, updatedCount: 0, message: "No hay registros para actualizar." };
  }

  // 1. Actualizar en Supabase de forma rápida
  if (isDatabaseConfigured()) {
    try {
      for (const { sheetRowIndex, item } of updates) {
        const isoFecha = toIsoDateString(item.fecha);
        const mes = (item.mes || getMonthFromDate(isoFecha)).toUpperCase();
        const asesor = item.asesor.trim();
        const estado = (item.estado || "").trim();
        const municipio = (item.municipio || "").trim();
        const parroquia = (item.parroquia || "").trim();
        const sector = (item.sector || "").trim();
        const actividad = (item.tipo_actividad || "Recorrido con Instaladores").trim();
        const estatus = (item.estatus || "Planificado").trim();
        const finalFormula = buildFinalFormula(sheetRowIndex || 2, asesor, parroquia, actividad, estatus);

        await query(`
          INSERT INTO planificacion_jornadas (
            sheet_row_index, fecha, mes, asesor, estado, municipio, parroquia, sector, tipo_actividad, estatus, formula_final, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
          ON CONFLICT (fecha, LOWER(TRIM(asesor)))
          DO UPDATE SET
            sheet_row_index = COALESCE(EXCLUDED.sheet_row_index, planificacion_jornadas.sheet_row_index),
            mes = EXCLUDED.mes,
            estado = EXCLUDED.estado,
            municipio = EXCLUDED.municipio,
            parroquia = EXCLUDED.parroquia,
            sector = EXCLUDED.sector,
            tipo_actividad = EXCLUDED.tipo_actividad,
            estatus = EXCLUDED.estatus,
            formula_final = EXCLUDED.formula_final,
            updated_at = NOW()
        `, [
          sheetRowIndex || null,
          isoFecha,
          mes,
          asesor,
          estado,
          municipio,
          parroquia,
          sector,
          actividad,
          estatus,
          finalFormula,
        ]);
      }
    } catch (dbErr: any) {
      console.error("Error al actualizar lote en Supabase:", dbErr.message);
    }
  }

  // 2. Actualizar en Google Sheets mediante batchUpdate (1 sola petición HTTP)
  try {
    const validUpdates = updates.filter((u) => u.sheetRowIndex && u.sheetRowIndex >= 2);
    if (validUpdates.length > 0) {
      const sheets = await getSheetsClient();
      const batchData = validUpdates.map(({ sheetRowIndex, item }) => {
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

        return {
          range: `${PLANIFICACION_SHEET_NAME}!A${sheetRowIndex}:J${sheetRowIndex}`,
          values: [[
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
          ]],
        };
      });

      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: PLANIFICACION_SPREADSHEET_ID,
        requestBody: {
          valueInputOption: "USER_ENTERED",
          data: batchData,
        },
      });
    }
  } catch (sheetErr: any) {
    console.warn("Aviso al actualizar lote en Google Sheets:", sheetErr.message);
  }

  return {
    success: true,
    updatedCount: updates.length,
    message: `${updates.length} jornadas actualizadas correctamente.`,
  };
}

export interface DeletePlanningRecordOptions {
  id?: string | number;
  sheetRowIndex?: number;
  fecha?: string;
  asesor?: string;
}

/**
 * Deletes a planning record with instant response from Supabase and background sync to Google Sheets
 */
export async function deletePlanningRecord(
  target: number | DeletePlanningRecordOptions
): Promise<{ success: boolean; message: string }> {
  const options: DeletePlanningRecordOptions =
    typeof target === "number" ? { sheetRowIndex: target } : target;

  const { id, sheetRowIndex, fecha, asesor } = options;
  let deletedFromDb = false;

  // 1. Eliminación instantánea en Supabase (10-20ms)
  if (isDatabaseConfigured()) {
    try {
      if (id) {
        await query("DELETE FROM planificacion_jornadas WHERE id = $1", [id]);
        deletedFromDb = true;
      }
      if (fecha && asesor) {
        const iso = toIsoDateString(fecha);
        await query(
          "DELETE FROM planificacion_jornadas WHERE fecha = $1 AND LOWER(TRIM(asesor)) = LOWER(TRIM($2))",
          [iso, asesor.trim()]
        );
        deletedFromDb = true;
      } else if (sheetRowIndex && sheetRowIndex >= 2) {
        await query("DELETE FROM planificacion_jornadas WHERE sheet_row_index = $1", [sheetRowIndex]);
        deletedFromDb = true;
      }
    } catch (dbErr: any) {
      console.error("Error al eliminar en Supabase:", dbErr.message);
    }
  }

  // 2. Sincronizar en Google Sheets (asíncrono en segundo plano si la BD ya eliminó)
  if (sheetRowIndex && sheetRowIndex >= 2) {
    const syncSheets = async () => {
      try {
        const sheets = await getSheetsClient();
        await sheets.spreadsheets.values.clear({
          spreadsheetId: PLANIFICACION_SPREADSHEET_ID,
          range: `${PLANIFICACION_SHEET_NAME}!A${sheetRowIndex}:J${sheetRowIndex}`,
        });

        const startIndex = sheetRowIndex - 1;
        const endIndex = sheetRowIndex;
        sheets.spreadsheets
          .batchUpdate({
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
          })
          .catch((e: any) => console.warn("Background sheet row deleteDimension:", e.message));
      } catch (sheetErr: any) {
        console.warn("Aviso al sincronizar eliminación con Google Sheets:", sheetErr.message);
      }
    };

    if (deletedFromDb) {
      // Fire-and-forget: Supabase ya lo eliminó en 15ms, sincronizar Sheets en background para respuesta instantánea
      syncSheets().catch(() => {});
    } else {
      // Si no hay DB configurada, esperar a Sheets para asegurar la persistencia
      await syncSheets();
    }
  }

  return {
    success: true,
    message: "Jornada eliminada correctamente.",
  };
}

