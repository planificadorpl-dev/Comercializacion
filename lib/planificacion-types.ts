export const PLANIFICACION_SPREADSHEET_ID = "1_PzDJLZ8jnPTZq9PgQMLfomwBwles8XOd8RD5Ksko2Y";
export const PLANIFICACION_SHEET_NAME = "Data";
export const CONF_SHEET_NAME = "CONF";
export const DATA_SHEET_ID = 1841098404; // Numeric gid for Sheet 'Data'

export const SPANISH_MONTHS = [
  "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
  "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"
];

export const STANDARD_ACTIVITIES = [
  "Recorrido con Instaladores",
  "Recorrido (Solo)",
  "Recorrido con Distribución",
  "Stand Publicitario",
  "Iglu Publicitario",
  "Visita a Condominio",
  "Caravana",
  "De permiso / Inasistencia",
  "Inducción",
];

export const STANDARD_STATUSES = [
  "Planificado",
  "Realizado",
  "Reprogramado",
  "Cancelado",
];

export interface PlanningSheetRecord {
  sheetRowIndex: number; // 1-indexed in Google Sheets (Row 2 is first data row)
  id: string | number;
  mes: string;
  fecha: string; // "DD/MM/YYYY" as stored in Google Sheet
  isoFecha: string; // "YYYY-MM-DD" standard for filtering/date controls
  asesor: string;
  estado: string;
  municipio: string;
  parroquia: string;
  sector: string;
  tipo_actividad: string;
  estatus: string;
  final?: string;
}

export interface NewPlanningItem {
  fecha: string; // "YYYY-MM-DD" or "D/M/YYYY"
  mes?: string;
  asesor: string;
  estado: string;
  municipio: string;
  parroquia: string;
  sector: string;
  tipo_actividad: string;
  estatus?: string;
}

export interface SectorCatalogItem {
  sector: string;
  parroquia: string;
  municipio: string;
  estado: string;
}

export interface PlanningMetadata {
  advisors: string[];
  activities: string[];
  statuses: string[];
  months: string[];
  geoHierarchy: Record<string, Record<string, Record<string, string[]>>>;
  sectorsCatalog: SectorCatalogItem[];
}

// Helper to convert any date string to standard YYYY-MM-DD
export function toIsoDateString(val: any): string {
  if (!val) return "";
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, "0");
    const d = String(val.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);

  const parts = str.split(/[\/\-]/).map((p) => parseInt(p, 10));
  if (parts.length === 3) {
    let y = parts[2];
    let m = parts[1];
    let d = parts[0];
    if (parts[0] > 1000) {
      y = parts[0];
      m = parts[1];
      d = parts[2];
    }
    if (y && m && d && !isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }
  return "";
}

// Convert YYYY-MM-DD to D/M/YYYY for Google Sheets
export function toSheetDateFormat(isoDate: string): string {
  if (!isoDate) return "";
  const parts = isoDate.split("-");
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return `${d}/${m}/${y}`;
    }
  }
  return isoDate;
}

// Derive uppercase Spanish month from an ISO date or D/M/YYYY date
export function getMonthFromDate(dateStr: string): string {
  const iso = toIsoDateString(dateStr);
  if (!iso) return "";
  const parts = iso.split("-");
  if (parts.length >= 2) {
    const m = parseInt(parts[1], 10);
    if (m >= 1 && m <= 12) {
      return SPANISH_MONTHS[m - 1];
    }
  }
  return "";
}

// Build the summary formula or text for Column J (FINAL)
export function buildFinalFormula(sheetRowIndex: number, asesor: string, parroquia: string, actividad: string, estatus: string): string {
  return `=IF(C${sheetRowIndex}="", "", "Asesor: " & C${sheetRowIndex} & IF(F${sheetRowIndex}<>"", " - " & F${sheetRowIndex}, "") & IF(H${sheetRowIndex}<>"", " - " & H${sheetRowIndex}, "") & IF(I${sheetRowIndex}<>"", " (" & I${sheetRowIndex} & ")", ""))`;
}

