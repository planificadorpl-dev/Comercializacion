import { EvaluacionRecord, formatFrecuencia, formatEvaluadorRol } from "./evaluaciones-data";
import { getSheetsClient } from "@/app/lib/googleAuth";

export const PLANIFICACION_SPREADSHEET_ID = "1_PzDJLZ8jnPTZq9PgQMLfomwBwles8XOd8RD5Ksko2Y";
export const EVALUACIONES_SHEET_NAME = "EVALUACIONES";

export const EVALUACIONES_SHEET_HEADERS = [
  "ID",
  "Fecha",
  "Frecuencia",
  "Asesor",
  "Evaluador",
  "Rol Evaluador",
  "Estado",
  "Municipio",
  "Parroquia",
  "Sector",
  "Cumplimiento %",
  "Ítems Cumplidos",
  "Total Ítems",
  "Nivel",
  "Territorial %",
  "Tecnológico %",
  "Táctico %",
  "Argumentativo %",
  "Organizacional %",
  "Observaciones Generales / Plan de Acción",
  // 30 variables (Cumple + Observación)
  "Afluencia", "Afluencia (Obs)",
  "Barridos", "Barridos (Obs)",
  "Competencia", "Competencia (Obs)",
  "Ubicación", "Ubicación (Obs)",
  "Líderes", "Líderes (Obs)",
  "Prospectos", "Prospectos (Obs)",
  "Lectura NAP", "Lectura NAP (Obs)",
  "Mangas", "Mangas (Obs)",
  "Conceptos", "Conceptos (Obs)",
  "Routers", "Routers (Obs)",
  "Dispositivos", "Dispositivos (Obs)",
  "Modelaje", "Modelaje (Obs)",
  "Conexión", "Conexión (Obs)",
  "Abordaje", "Abordaje (Obs)",
  "Obstáculos", "Obstáculos (Obs)",
  "Adaptabilidad", "Adaptabilidad (Obs)",
  "Postventa", "Postventa (Obs)",
  "Metodología", "Metodología (Obs)",
  "Beneficios", "Beneficios (Obs)",
  "Costo-Beneficio", "Costo-Beneficio (Obs)",
  "Justificación", "Justificación (Obs)",
  "Tiempos", "Tiempos (Obs)",
  "Requerimientos", "Requerimientos (Obs)",
  "Factibilidad", "Factibilidad (Obs)",
  "Formatos", "Formatos (Obs)",
  "Reporte", "Reporte (Obs)",
  "Informe", "Informe (Obs)",
  "Servicios", "Servicios (Obs)",
  "Contactos", "Contactos (Obs)",
  "Canales", "Canales (Obs)",
  "Fecha Registro"
];

const ITEMS_KEYS = [
  "afluencia", "barridos", "competencia", "ubicacion", "lideres", "prospectos",
  "lectura", "mangas", "conceptos", "routers", "dispositivos",
  "modelaje", "conexion", "abordaje", "obstaculos", "adaptabilidad", "postventa", "metodologia",
  "beneficios", "costo_beneficio", "justificacion", "tiempos", "requerimientos", "factibilidad",
  "formatos", "reporte", "informe", "servicios", "contactos", "canales"
];

/**
 * Transforms an EvaluacionRecord into a Google Sheets row array.
 */
export function evaluacionRecordToSheetRow(r: EvaluacionRecord): (string | number)[] {
  const level =
    r.cumplimientoPct >= 90
      ? "Excelente"
      : r.cumplimientoPct >= 80
      ? "Bueno"
      : r.cumplimientoPct >= 70
      ? "Regular"
      : "Crítico";

  const row: (string | number)[] = [
    r.id,
    r.fecha,
    formatFrecuencia(r.frecuencia),
    r.asesor,
    r.evaluador,
    formatEvaluadorRol(r.evaluadorRol),
    r.estado || "",
    r.municipio || "",
    r.parroquia || "",
    r.sector || "",
    `${r.cumplimientoPct}%`,
    r.puntuacionTotal ?? r.itemsCumplidos,
    r.puntuacionMaxima ?? r.itemsTotal,
    level,
    `${r.factorScores?.territorial?.pct ?? 0}%`,
    `${r.factorScores?.tecnologico?.pct ?? 0}%`,
    `${r.factorScores?.tactico?.pct ?? 0}%`,
    `${r.factorScores?.argumentativo?.pct ?? 0}%`,
    `${r.factorScores?.organizacional?.pct ?? 0}%`,
    r.observacionesGenerales || ""
  ];

  for (const k of ITEMS_KEYS) {
    const item = r.items?.[k];
    const scoreVal = item ? (typeof item.puntuacion === "number" ? item.puntuacion : item.cumple ? 5 : 1) : 5;
    const obsStr = item?.observacion || "";
    row.push(scoreVal, obsStr);
  }

  row.push(r.updatedAt || r.createdAt || new Date().toISOString());
  return row;
}

/**
 * Ensures headers exist on row 1 of the EVALUACIONES sheet.
 */
export async function ensureSheetHeaders(): Promise<void> {
  try {
    const sheets = await getSheetsClient();
    const checkRes = await sheets.spreadsheets.values.get({
      spreadsheetId: PLANIFICACION_SPREADSHEET_ID,
      range: `${EVALUACIONES_SHEET_NAME}!A1:Z1`,
    });

    const existing = checkRes.data.values?.[0] || [];
    if (existing.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: PLANIFICACION_SPREADSHEET_ID,
        range: `${EVALUACIONES_SHEET_NAME}!A1`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [EVALUACIONES_SHEET_HEADERS],
        },
      });
    }
  } catch (err) {
    console.warn("Could not ensure EVALUACIONES headers:", err);
  }
}

/**
 * Appends or updates an evaluation record in the EVALUACIONES Google Sheet.
 */
export async function appendOrUpdateEvaluacionInSheet(record: EvaluacionRecord): Promise<boolean> {
  try {
    await ensureSheetHeaders();
    const sheets = await getSheetsClient();

    // Read column A to find existing row index
    const colARes = await sheets.spreadsheets.values.get({
      spreadsheetId: PLANIFICACION_SPREADSHEET_ID,
      range: `${EVALUACIONES_SHEET_NAME}!A:A`,
    });

    const rows = colARes.data.values || [];
    const rowIndex = rows.findIndex((r) => r[0] === record.id);
    const rowData = evaluacionRecordToSheetRow(record);

    if (rowIndex > 0) {
      // 1-indexed row number
      const rowNum = rowIndex + 1;
      await sheets.spreadsheets.values.update({
        spreadsheetId: PLANIFICACION_SPREADSHEET_ID,
        range: `${EVALUACIONES_SHEET_NAME}!A${rowNum}`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [rowData],
        },
      });
    } else {
      // Append as new row
      await sheets.spreadsheets.values.append({
        spreadsheetId: PLANIFICACION_SPREADSHEET_ID,
        range: `${EVALUACIONES_SHEET_NAME}!A1`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [rowData],
        },
      });
    }

    return true;
  } catch (err) {
    console.error("Error saving evaluacion to Google Sheet:", err);
    return false;
  }
}

/**
 * Removes an evaluation record from the EVALUACIONES Google Sheet by clearing its row.
 */
export async function deleteEvaluacionFromSheet(id: string): Promise<boolean> {
  try {
    const sheets = await getSheetsClient();
    const colARes = await sheets.spreadsheets.values.get({
      spreadsheetId: PLANIFICACION_SPREADSHEET_ID,
      range: `${EVALUACIONES_SHEET_NAME}!A:A`,
    });

    const rows = colARes.data.values || [];
    const rowIndex = rows.findIndex((r) => r[0] === id);
    if (rowIndex <= 0) return true; // not found in sheet

    const rowNum = rowIndex + 1;
    await sheets.spreadsheets.values.clear({
      spreadsheetId: PLANIFICACION_SPREADSHEET_ID,
      range: `${EVALUACIONES_SHEET_NAME}!A${rowNum}:ZZ${rowNum}`,
    });

    return true;
  } catch (err) {
    console.error("Error clearing evaluacion row from Google Sheet:", err);
    return false;
  }
}

/**
 * Bulk syncs all evaluations into the EVALUACIONES sheet.
 */
export async function syncAllEvaluacionesToSheet(records: EvaluacionRecord[]): Promise<boolean> {
  try {
    await ensureSheetHeaders();
    const sheets = await getSheetsClient();

    const rows = records.map(evaluacionRecordToSheetRow);

    // Clear old data rows from row 2 downwards
    await sheets.spreadsheets.values.clear({
      spreadsheetId: PLANIFICACION_SPREADSHEET_ID,
      range: `${EVALUACIONES_SHEET_NAME}!A2:ZZ1000`,
    });

    if (rows.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: PLANIFICACION_SPREADSHEET_ID,
        range: `${EVALUACIONES_SHEET_NAME}!A2`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: rows,
        },
      });
    }

    return true;
  } catch (err) {
    console.error("Error bulk syncing evaluaciones to Google Sheet:", err);
    return false;
  }
}
