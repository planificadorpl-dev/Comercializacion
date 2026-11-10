/**
 * Tipos de datos para el módulo de Match / Conciliación
 * entre Reportes Diarios de Asesores y Evaluaciones del Impulsador / Supervisor.
 */

export type MatchStatus = "conciliado" | "solo_reporte" | "solo_evaluacion";

export interface MatchDivergencia {
  factorId: string;
  factorNombre: string;
  itemId: string;
  variable: string;
  descripcion: string;
  pregunta: string;
  preguntaEvaluador: string;
  asesorDijo: boolean; // true si marcó Sí en su checklist
  evaluadorPuntuacion: number; // 1 a 5
  evaluadorObservacion?: string;
  esCritico: boolean; // true si evaluadorPuntuacion <= 2
}

export interface MatchFactorComparison {
  factorId: string;
  nombre: string;
  asesorPct: number;
  asesorCumplidos: number;
  asesorTotal: number;
  evaluadorPct: number;
  evaluadorPuntos: number;
  evaluadorMax: number;
  evaluadorPromedio: number;
  gapPct: number; // asesorPct - evaluadorPct
}

export interface MatchItem {
  id: string; // Clave única: YYYY-MM-DD_Asesor
  fecha: string; // YYYY-MM-DD
  fechaDisplay: string; // DD/MM/YYYY
  asesor: string;
  asesorCompleto?: string;
  status: MatchStatus;
  statusLabel: string;

  // 1. Reporte diario cargado por el asesor
  reporte: {
    presente: boolean;
    activitiesCount: number;
    totals: {
      solicitudes: number;
      captados: number;
      volantes: number;
      llamadasInfo: number;
      llamadasAgenda: number;
    };
    actividades: Array<{
      time: string;
      activityType: string;
      solicitudes: number;
      clientesCaptados: number;
      volantes: number;
      llamadasInfo: number;
      llamadasAgenda: number;
      ubicacion: string;
      condominio?: string;
      notes?: string;
    }>;
    ubicacionResumen: string;
    reporteWhatsapp?: string;
    checklist?: Record<string, boolean>;
    checklistPct: number;
    checklistCumplidos: number;
    checklistTotal: number;
    checklistFactorScores?: Record<string, { cumplidos: number; total: number; pct: number }>;
  };

  // 2. Evaluación en campo del impulsador / supervisor
  evaluacion: {
    presente: boolean;
    id?: string;
    evaluador?: string;
    evaluadorRol?: string;
    frecuencia?: string;
    cumplimientoPct: number;
    puntuacionPromedio: number;
    puntuacionTotal: number;
    puntuacionMaxima: number;
    nivel?: {
      label: string;
      colorClass: string;
      dotColorClass: string;
    };
    factorScores?: Record<string, any>;
    observacionesGenerales?: string;
    items?: Record<string, any>;
    ubicacionResumen: string;
  };

  // 3. Cruce diagnóstico (Match)
  analisis: {
    coincidenciaTerritorial: boolean | null;
    gapPct: number | null; // Brecha: % declarado - % calificado
    divergenciasCount: number;
    divergencias: MatchDivergencia[];
    factorComparisons: MatchFactorComparison[];
  };
}

export interface MatchMetrics {
  totalJornadas: number;
  conciliadasCount: number;
  soloReporteCount: number;
  soloEvaluacionCount: number;
  coberturaPct: number; // % de jornadas de asesores con acompañamiento
  promedioGapPct: number; // Brecha promedio
  promedioSolicitudesConImpulsador: number;
  promedioSolicitudesSinImpulsador: number;
  factorSummary: Array<{
    factorId: string;
    nombre: string;
    asesorAvgPct: number;
    evaluadorAvgPct: number;
    gapPct: number;
  }>;
}

export interface MatchFilterParams {
  asesor?: string;
  evaluador?: string;
  status?: string; // "todos" | "conciliado" | "solo_reporte" | "solo_evaluacion"
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  search?: string;
}

