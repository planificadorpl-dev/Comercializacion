import { readAllActividades } from "@/lib/actividades-store";
import { readAdvisorChecklists } from "@/lib/advisor-checklists-store";
import { readEvaluaciones } from "@/lib/evaluaciones-store";
import {
  EVALUACION_FACTORES,
  getCumplimientoLevel,
  AdvisorChecklistRecord,
  EvaluacionRecord,
} from "@/lib/evaluaciones-data";
import {
  MatchItem,
  MatchMetrics,
  MatchFilterParams,
  MatchStatus,
  MatchDivergencia,
  MatchFactorComparison,
} from "./match-types";

// Date normalization helpers
export function normalizeDateToIso(dateStr?: string | null): string {
  if (!dateStr) return "";
  const clean = String(dateStr).trim();

  // If already YYYY-MM-DD or contains T
  if (clean.includes("T")) {
    return clean.split("T")[0];
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean;
  }
  // If DD/MM/YYYY or DD-MM-YYYY
  if (clean.includes("/")) {
    const parts = clean.split("/");
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY/MM/DD
        return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
      }
      // DD/MM/YYYY
      return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
    }
  }
  return clean;
}

export function formatIsoToDisplayDate(isoDate: string): string {
  if (!isoDate) return "";
  const parts = isoDate.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return isoDate;
}

function normalizeName(name?: string | null): string {
  return (name || "").trim().toLowerCase();
}

/**
 * Checks if two location strings have any territorial overlap
 */
function checkTerritorialOverlap(locA: string, locB: string): boolean | null {
  if (!locA || !locB) return null;
  const cleanA = locA.toLowerCase().replace(/[^a-záéíóúñ0-9\s]/gi, " ");
  const cleanB = locB.toLowerCase().replace(/[^a-záéíóúñ0-9\s]/gi, " ");

  const wordsA = cleanA.split(/\s+/).filter((w) => w.length > 3);
  const wordsB = cleanB.split(/\s+/).filter((w) => w.length > 3);

  for (const wa of wordsA) {
    if (wordsB.includes(wa)) return true;
  }
  return false;
}

/**
 * Core engine to build matched records from activities, advisor checklists, and evaluations.
 */
export async function getMatchDataset(filters?: MatchFilterParams): Promise<{
  items: MatchItem[];
  metrics: MatchMetrics;
  advisorsList: string[];
  evaluadoresList: string[];
}> {
  // 1. Fetch raw datasets in parallel
  const [actividadesRaw, checklistsRaw, evaluacionesRaw] = await Promise.all([
    readAllActividades().catch(() => []),
    readAdvisorChecklists().catch(() => []),
    readEvaluaciones().catch(() => []),
  ]);

  // Map of advisor checklists by `${isoDate}_${advisorLower}`
  const checklistMap = new Map<string, AdvisorChecklistRecord>();
  checklistsRaw.forEach((chk) => {
    const iso = normalizeDateToIso(chk.fecha);
    const key = `${iso}_${normalizeName(chk.asesor)}`;
    checklistMap.set(key, chk);
  });

  // Group activities by `${isoDate}_${advisorLower}`
  const activitiesByDayAndAdvisor = new Map<
    string,
    {
      isoDate: string;
      advisorOriginal: string;
      rows: typeof actividadesRaw;
    }
  >();

  actividadesRaw.forEach((act) => {
    const iso = normalizeDateToIso(act.fecha);
    if (!iso || !act.asesor) return;
    const key = `${iso}_${normalizeName(act.asesor)}`;
    const cur = activitiesByDayAndAdvisor.get(key) || {
      isoDate: iso,
      advisorOriginal: act.asesor,
      rows: [],
    };
    cur.rows.push(act);
    activitiesByDayAndAdvisor.set(key, cur);
  });

  // Group evaluations by `${isoDate}_${advisorLower}`
  const evaluacionesByDayAndAdvisor = new Map<string, EvaluacionRecord>();
  evaluacionesRaw.forEach((ev) => {
    const iso = normalizeDateToIso(ev.fecha);
    if (!iso || !ev.asesor) return;
    const key = `${iso}_${normalizeName(ev.asesor)}`;
    // Keep most recent if duplicate
    evaluacionesByDayAndAdvisor.set(key, ev);
  });

  // Collect all unique keys
  const allKeys = new Set<string>([
    ...activitiesByDayAndAdvisor.keys(),
    ...evaluacionesByDayAndAdvisor.keys(),
  ]);

  // Set of all distinct advisors and evaluators for filter menus
  const advisorSet = new Set<string>();
  const evaluadorSet = new Set<string>();

  const allItems: MatchItem[] = [];

  allKeys.forEach((key) => {
    const actGroup = activitiesByDayAndAdvisor.get(key);
    const evRecord = evaluacionesByDayAndAdvisor.get(key);

    const isoDate = actGroup?.isoDate || normalizeDateToIso(evRecord?.fecha) || "";
    const advisorName = actGroup?.advisorOriginal || evRecord?.asesor || "";

    if (!isoDate || !advisorName) return;

    advisorSet.add(advisorName);
    if (evRecord?.evaluador) {
      evaluadorSet.add(evRecord.evaluador);
    }

    // ── Build Reporte Side ───────────────────────────────────────────────────
    const hasActivities = Boolean(actGroup && actGroup.rows.length > 0);
    const chk = checklistMap.get(key);

    let totSolicitudes = 0;
    let totCaptados = 0;
    let totVolantes = 0;
    let totInfo = 0;
    let totAgenda = 0;
    let waText = "";
    const locParts = new Set<string>();
    const detailsTimeline: MatchItem["reporte"]["actividades"] = [];

    if (actGroup) {
      actGroup.rows.forEach((act) => {
        totSolicitudes += Number(act.solicitudes || 0);
        totCaptados += Number(act.clientes_captados || 0);
        totVolantes += Number(act.volantes || 0);
        totInfo += Number(act.llamadas_info || 0);
        totAgenda += Number(act.llamadas_agenda || 0);

        if (!waText && act.reporte_wa) {
          waText = act.reporte_wa;
        }

        const lParts = [act.estado, act.municipio, act.parroquia, act.sector].filter(Boolean);
        const locLabel = lParts.join(", ");
        if (locLabel) locParts.add(locLabel);

        detailsTimeline.push({
          time: act.hora || "",
          activityType: act.tipo || "Actividad",
          solicitudes: Number(act.solicitudes || 0),
          clientesCaptados: Number(act.clientes_captados || 0),
          volantes: Number(act.volantes || 0),
          llamadasInfo: Number(act.llamadas_info || 0),
          llamadasAgenda: Number(act.llamadas_agenda || 0),
          ubicacion: locLabel,
          condominio: act.condominio || undefined,
          notes: act.notas || undefined,
        });
      });
    }

    const firstRowWithChecklist = actGroup?.rows.find((r) => r.checklist && typeof r.checklist === "object");
    const activeChecklistItems = chk?.items || firstRowWithChecklist?.checklist || undefined;
    const chkPct = chk?.cumplimientoPct ?? firstRowWithChecklist?.checklist_cumplimiento_pct ?? 0;
    const chkCumplidos = chk?.itemsCumplidos ?? firstRowWithChecklist?.checklist_cumplidos ?? 0;
    const chkTotal = chk?.itemsTotal ?? firstRowWithChecklist?.checklist_total ?? 30;

    // ── Build Evaluacion Side ────────────────────────────────────────────────
    const hasEvaluacion = Boolean(evRecord);
    let evLocation = "";
    if (evRecord) {
      const parts = [evRecord.estado, evRecord.municipio, evRecord.parroquia, evRecord.sector].filter(Boolean);
      evLocation = parts.join(", ");
    }

    // ── Match Status ─────────────────────────────────────────────────────────
    let status: MatchStatus = "conciliado";
    let statusLabel = "Conciliado";

    if (hasActivities && !hasEvaluacion) {
      status = "solo_reporte";
      statusLabel = "Solo reporte (Sin supervisar)";
    } else if (!hasActivities && hasEvaluacion) {
      status = "solo_evaluacion";
      statusLabel = "Solo evaluación (Sin reporte)";
    }

    // ── Diagnostic / Gap Analysis ────────────────────────────────────────────
    const locAdvisorStr = Array.from(locParts).join(" | ");
    const territorialCoincide = hasActivities && hasEvaluacion
      ? checkTerritorialOverlap(locAdvisorStr, evLocation)
      : null;

    let gapPct: number | null = null;
    const divergencias: MatchDivergencia[] = [];
    const factorComparisons: MatchFactorComparison[] = [];

    if (hasActivities && hasEvaluacion && evRecord) {
      // Gap: Asesor declared % - Evaluator assessed %
      gapPct = chkPct - evRecord.cumplimientoPct;

      // Item-by-item divergence check
      EVALUACION_FACTORES.forEach((factor) => {
        let fAsesorCumplidos = 0;
        const fAsesorTotal = factor.items.length;

        factor.items.forEach((item) => {
          const asesorVal = Boolean(activeChecklistItems && activeChecklistItems[item.id] === true);
          if (asesorVal) fAsesorCumplidos++;

          const evItemState = evRecord.items ? evRecord.items[item.id] : undefined;
          let evScore = 5;
          if (evItemState) {
            if (typeof evItemState.puntuacion === "number") {
              evScore = evItemState.puntuacion;
            } else if (evItemState.cumple !== undefined) {
              evScore = evItemState.cumple ? 5 : 1;
            }
          }

          // Discrepancy rule: Advisor claimed "Sí", but Evaluator gave 1 or 2 (Critical gap)
          if (asesorVal && evScore <= 2) {
            divergencias.push({
              factorId: factor.id,
              factorNombre: factor.nombre,
              itemId: item.id,
              variable: item.variable,
              descripcion: item.descripcion,
              pregunta: item.pregunta,
              preguntaEvaluador: item.preguntaEvaluador,
              asesorDijo: true,
              evaluadorPuntuacion: evScore,
              evaluadorObservacion: evItemState?.observacion || undefined,
              esCritico: evScore <= 2,
            });
          }
        });

        const fAsesorPct = fAsesorTotal > 0 ? Math.round((fAsesorCumplidos / fAsesorTotal) * 100) : 0;
        const fEvScore = evRecord.factorScores ? evRecord.factorScores[factor.id] : null;
        const fEvPct = fEvScore?.pct ?? 0;
        const fEvPuntos = fEvScore?.puntos ?? 0;
        const fEvMax = fEvScore?.puntosMax ?? fAsesorTotal * 5;
        const fEvPromedio = fEvScore?.promedio ?? 0;

        factorComparisons.push({
          factorId: factor.id,
          nombre: factor.nombre,
          asesorPct: fAsesorPct,
          asesorCumplidos: fAsesorCumplidos,
          asesorTotal: fAsesorTotal,
          evaluadorPct: fEvPct,
          evaluadorPuntos: fEvPuntos,
          evaluadorMax: fEvMax,
          evaluadorPromedio: fEvPromedio,
          gapPct: fAsesorPct - fEvPct,
        });
      });
    }

    const item: MatchItem = {
      id: `${isoDate}_${advisorName.replace(/\s+/g, "_")}`,
      fecha: isoDate,
      fechaDisplay: formatIsoToDisplayDate(isoDate),
      asesor: advisorName,
      status,
      statusLabel,
      reporte: {
        presente: hasActivities,
        activitiesCount: actGroup?.rows.length || 0,
        totals: {
          solicitudes: totSolicitudes,
          captados: totCaptados,
          volantes: totVolantes,
          llamadasInfo: totInfo,
          llamadasAgenda: totAgenda,
        },
        actividades: detailsTimeline,
        ubicacionResumen: locAdvisorStr || "Sin ubicación registrada",
        reporteWhatsapp: waText || undefined,
        checklist: activeChecklistItems,
        checklistPct: chkPct,
        checklistCumplidos: chkCumplidos,
        checklistTotal: chkTotal,
        checklistFactorScores: chk?.factorScores,
      },
      evaluacion: {
        presente: hasEvaluacion,
        id: evRecord?.id,
        evaluador: evRecord?.evaluador,
        evaluadorRol: evRecord?.evaluadorRol,
        frecuencia: evRecord?.frecuencia,
        cumplimientoPct: evRecord?.cumplimientoPct || 0,
        puntuacionPromedio: evRecord?.puntuacionPromedio || 0,
        puntuacionTotal: evRecord?.puntuacionTotal || 0,
        puntuacionMaxima: evRecord?.puntuacionMaxima || 150,
        nivel: evRecord ? getCumplimientoLevel(evRecord.cumplimientoPct) : undefined,
        factorScores: evRecord?.factorScores,
        observacionesGenerales: evRecord?.observacionesGenerales,
        items: evRecord?.items,
        ubicacionResumen: evLocation || "Sin ubicación de supervisión",
      },
      analisis: {
        coincidenciaTerritorial: territorialCoincide,
        gapPct,
        divergenciasCount: divergencias.length,
        divergencias,
        factorComparisons,
      },
    };

    allItems.push(item);
  });

  // Sort descending by date, then advisor name
  allItems.sort((a, b) => {
    const cmp = b.fecha.localeCompare(a.fecha);
    if (cmp !== 0) return cmp;
    return a.asesor.localeCompare(b.asesor);
  });

  // ── Apply Filters ──────────────────────────────────────────────────────────
  let filtered = allItems;

  if (filters?.status && filters.status !== "todos") {
    filtered = filtered.filter((i) => i.status === filters.status);
  }

  if (filters?.asesor && filters.asesor !== "todos") {
    const qAsesor = filters.asesor.toLowerCase().trim();
    filtered = filtered.filter((i) => i.asesor.toLowerCase().includes(qAsesor));
  }

  if (filters?.evaluador && filters.evaluador !== "todos") {
    const qEvaluador = filters.evaluador.toLowerCase().trim();
    filtered = filtered.filter((i) => (i.evaluacion.evaluador || "").toLowerCase().includes(qEvaluador));
  }

  if (filters?.from) {
    filtered = filtered.filter((i) => i.fecha >= filters.from!);
  }

  if (filters?.to) {
    filtered = filtered.filter((i) => i.fecha <= filters.to!);
  }

  if (filters?.search) {
    const q = filters.search.toLowerCase().trim();
    filtered = filtered.filter(
      (i) =>
        i.asesor.toLowerCase().includes(q) ||
        (i.evaluacion.evaluador || "").toLowerCase().includes(q) ||
        i.reporte.ubicacionResumen.toLowerCase().includes(q) ||
        i.evaluacion.ubicacionResumen.toLowerCase().includes(q) ||
        (i.evaluacion.observacionesGenerales || "").toLowerCase().includes(q)
    );
  }

  // ── Calculate Metrics ──────────────────────────────────────────────────────
  const totalJornadas = filtered.length;
  const conciliadas = filtered.filter((i) => i.status === "conciliado");
  const soloReporte = filtered.filter((i) => i.status === "solo_reporte");
  const soloEvaluacion = filtered.filter((i) => i.status === "solo_evaluacion");

  const totalConReporte = conciliadas.length + soloReporte.length;
  const coberturaPct = totalConReporte > 0
    ? Math.round((conciliadas.length / totalConReporte) * 100)
    : 0;

  // Average gap
  let sumGap = 0;
  conciliadas.forEach((c) => {
    if (c.analisis.gapPct !== null) {
      sumGap += c.analisis.gapPct;
    }
  });
  const promedioGapPct = conciliadas.length > 0 ? Math.round(sumGap / conciliadas.length) : 0;

  // Average solicitudes with vs without companion
  let sumSoliCon = 0;
  conciliadas.forEach((c) => {
    sumSoliCon += c.reporte.totals.solicitudes;
  });
  const promedioSolicitudesConImpulsador = conciliadas.length > 0
    ? Number((sumSoliCon / conciliadas.length).toFixed(1))
    : 0;

  let sumSoliSin = 0;
  soloReporte.forEach((s) => {
    sumSoliSin += s.reporte.totals.solicitudes;
  });
  const promedioSolicitudesSinImpulsador = soloReporte.length > 0
    ? Number((sumSoliSin / soloReporte.length).toFixed(1))
    : 0;

  // Factor summary across conciliadas
  const factorSummary = EVALUACION_FACTORES.map((factor) => {
    let sumAsesor = 0;
    let sumEv = 0;
    let count = 0;

    conciliadas.forEach((c) => {
      const fc = c.analisis.factorComparisons.find((f) => f.factorId === factor.id);
      if (fc) {
        sumAsesor += fc.asesorPct;
        sumEv += fc.evaluadorPct;
        count++;
      }
    });

    const asesorAvgPct = count > 0 ? Math.round(sumAsesor / count) : 0;
    const evaluadorAvgPct = count > 0 ? Math.round(sumEv / count) : 0;

    return {
      factorId: factor.id,
      nombre: factor.nombre,
      asesorAvgPct,
      evaluadorAvgPct,
      gapPct: asesorAvgPct - evaluadorAvgPct,
    };
  });

  const metrics: MatchMetrics = {
    totalJornadas,
    conciliadasCount: conciliadas.length,
    soloReporteCount: soloReporte.length,
    soloEvaluacionCount: soloEvaluacion.length,
    coberturaPct,
    promedioGapPct,
    promedioSolicitudesConImpulsador,
    promedioSolicitudesSinImpulsador,
    factorSummary,
  };

  return {
    items: filtered,
    metrics,
    advisorsList: Array.from(advisorSet).sort((a, b) => a.localeCompare(b, "es")),
    evaluadoresList: Array.from(evaluadorSet).sort((a, b) => a.localeCompare(b, "es")),
  };
}

