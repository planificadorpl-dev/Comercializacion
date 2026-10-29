import { calculateChecklistScores, EVALUACION_FACTORES } from "./evaluaciones-data";

export const REPORTES_SHEET_NAME = "REPORTES DE ASESORES";

export const REPORTES_SHEET_HEADERS = [
  // 1. Columnas Base de Actividad (A - O)
  "Fecha",
  "Hora",
  "Asesor",
  "Estado",
  "Municipio",
  "Parroquia",
  "Sector",
  "Tipo de Actividad",
  "Solicitudes (Ventas)",
  "Clientes Captados",
  "Volantes Entregados",
  "Llamadas Info",
  "Llamadas Agenda",
  "Condominio",
  "Observaciones",

  // 2. Métricas y Resumen del Checklist de Cierre (P - X)
  "% Cumplimiento",
  "Ítems Cumplidos",
  "Total Ítems",
  "Nivel",
  "% Territorial",
  "% Tecnológico",
  "% Táctico",
  "% Argumentativo",
  "% Organizacional",

  // 3. Los 30 Ítems Operativos (Sí / No) (Y - BB)
  // Factor Territorial (6)
  "Afluencia",
  "Barridos",
  "Competencia",
  "Ubicación",
  "Líderes",
  "Prospectos",

  // Factor Tecnológico (5)
  "Lectura NAP",
  "Mangas",
  "Conceptos",
  "Routers",
  "Dispositivos",

  // Factor Táctico (7)
  "Modelaje",
  "Conexión",
  "Abordaje",
  "Obstáculos",
  "Adaptabilidad",
  "Postventa",
  "Metodología",

  // Factor Argumentativo (6)
  "Beneficios",
  "Costo-Beneficio",
  "Justificación",
  "Tiempos",
  "Requerimientos",
  "Factibilidad",

  // Factor Organizacional (7)
  "Formatos",
  "Reporte",
  "Informe",
  "Servicios",
  "Contactos",
  "Canales",
];

const CHECKLIST_ITEM_KEYS = [
  // Territorial
  "afluencia",
  "barridos",
  "competencia",
  "ubicacion",
  "lideres",
  "prospectos",
  // Tecnológico
  "lectura",
  "mangas",
  "conceptos",
  "routers",
  "dispositivos",
  // Táctico
  "modelaje",
  "conexion",
  "abordaje",
  "obstaculos",
  "adaptabilidad",
  "postventa",
  "metodologia",
  // Argumentativo
  "beneficios",
  "costo_beneficio",
  "justificacion",
  "tiempos",
  "requerimientos",
  "factibilidad",
  // Organizacional
  "formatos",
  "reporte",
  "informe",
  "servicios",
  "contactos",
  "canales",
];

/**
 * Ensures the headers row (Row 1) in 'REPORTES DE ASESORES' has all 54 columns.
 */
export async function ensureActividadesSheetHeaders(sheets: any, spreadsheetId: string): Promise<void> {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${REPORTES_SHEET_NAME}'!1:1`,
    });

    const currentHeaders: string[] = res.data.values?.[0] || [];

    // If headers are missing or have fewer columns than our full set, update row 1
    if (currentHeaders.length < REPORTES_SHEET_HEADERS.length) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${REPORTES_SHEET_NAME}'!A1:BB1`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [REPORTES_SHEET_HEADERS],
        },
      });
      console.log("Encabezados de 'REPORTES DE ASESORES' actualizados con éxito en Google Sheets (54 columnas).");
    }
  } catch (err: any) {
    console.warn("Aviso: No se pudo verificar o actualizar encabezados de Google Sheets:", err.message);
  }
}

/**
 * Formats an activity record into a 54-column row for Google Sheets.
 */
export function formatActivitySheetRow(act: any, jornada: any, scores: any): (string | number)[] {
  const u = act.ubicaciones || {};
  const estadosStr = u.estado || act.estado || "";
  const municipiosStr = u.municipio || act.municipio || "";
  const parroquiasStr = u.parroquia || act.parroquia || "";
  const sectoresStr = u.sector || act.sector || "";

  const vol = act.volantes ? act.volantes : "";
  const info = act.llamadasInfo ? act.llamadasInfo : "";
  const agenda = act.llamadasAgenda ? act.llamadasAgenda : "";

  // Base row A - O
  const row: (string | number)[] = [
    jornada.date || "",
    act.time || act.hora || "",
    jornada.asesor || "",
    estadosStr,
    municipiosStr,
    parroquiasStr,
    sectoresStr,
    act.activityType || act.tipo || "",
    act.solicitudes || 0,
    act.clientesCaptados || act.clientes_captados || 0,
    vol,
    info,
    agenda,
    act.condominio || "",
    act.notes || act.notas || "",
  ];

  // Checklist metrics P - X
  if (scores) {
    row.push(
      `${scores.cumplimientoPct}%`,
      scores.totalCumplidos,
      scores.totalItems,
      scores.level?.label || "",
      `${scores.factorScores?.territorial?.pct ?? 0}%`,
      `${scores.factorScores?.tecnologico?.pct ?? 0}%`,
      `${scores.factorScores?.tactico?.pct ?? 0}%`,
      `${scores.factorScores?.argumentativo?.pct ?? 0}%`,
      `${scores.factorScores?.organizacional?.pct ?? 0}%`
    );
  } else {
    row.push("", "", "", "", "", "", "", "", "");
  }

  // 30 items Y - BB
  const chk = jornada.checklist || {};
  for (const k of CHECKLIST_ITEM_KEYS) {
    if (chk[k] === true) {
      row.push("Sí");
    } else if (chk[k] === false) {
      row.push("No");
    } else {
      row.push("");
    }
  }

  return row;
}
