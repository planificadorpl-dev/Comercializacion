import fs from "fs/promises";
import path from "path";
import { readAllActividades } from "@/lib/actividades-store";
import { readAdvisorChecklists } from "@/lib/advisor-checklists-store";
import { readEvaluaciones } from "@/lib/evaluaciones-store";
import {
  EVALUACION_FACTORES,
  getCumplimientoLevel,
  AdvisorChecklistRecord,
  EvaluacionRecord,
} from "@/lib/evaluaciones-data";
import { normalizeAdvisorName, stripAccents, areSameAdvisorName } from "@/lib/normalization";
import {
  MatchItem,
  MatchMetrics,
  MatchFilterParams,
  MatchStatus,
  MatchDivergencia,
  MatchFactorComparison,
  MatchMonitorReportes,
} from "./match-types";
export { areSameAdvisorName };

export function canonicalAdvisorKey(name?: string | null): string {
  if (!name) return "";
  const norm = normalizeAdvisorName(name);
  if (norm && norm !== "Sin Asesor") {
    return stripAccents(norm);
  }
  return stripAccents(name);
}

import {
  getCaracasTodayIso,
  getCaracasDateIso,
  normalizeDateToIso,
} from "@/lib/caracas-time";

export { getCaracasTodayIso, getCaracasDateIso, normalizeDateToIso };

export async function getPlantillaAsesores(): Promise<Array<{ nombre: string; nombreCompleto?: string }>> {
  try {
    const usersPath = path.join(process.cwd(), "data", "users.json");
    const content = await fs.readFile(usersPath, "utf-8");
    const users = JSON.parse(content);
    if (Array.isArray(users)) {
      const asesores = users
        .filter((u: any) => u.rol === "asesor" && u.activo !== false)
        .map((u: any) => {
          const canonical = normalizeAdvisorName(u.nombre);
          return {
            nombre: canonical && canonical !== "Sin Asesor" ? canonical : u.nombre,
            nombreCompleto: u.nombre,
          };
        });
      if (asesores.length > 0) return asesores;
    }
  } catch {}

  const fallback = [
    "Gabriela Marrero", "Lorena Esqueda", "Patricia Mendoza", "Génesis Ochoa",
    "Yesenia Terán", "Branin Berroteran", "Daiana Torres", "Stephany Manrique",
    "Cindy Infante", "Yuliana Carvajal", "María Azuaje", "Yilda González",
    "Yamery Rodríguez", "Arianna Montaña", "Diarnelis Mendoza", "Andrea Plaza",
    "Danyelis Muñoz", "Naomi Tovar", "Asesor Demostracion"
  ];

  return fallback.map((n) => ({ nombre: n, nombreCompleto: n }));
}

export function formatIsoToDisplayDate(isoDate: string): string {
  if (!isoDate) return "";
  const parts = isoDate.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return isoDate;
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

  // Map of advisor checklists by `${isoDate}_${canonicalAdvisorKey}`
  const checklistMap = new Map<string, AdvisorChecklistRecord>();
  checklistsRaw.forEach((chk) => {
    const iso = normalizeDateToIso(chk.fecha);
    const key = `${iso}_${canonicalAdvisorKey(chk.asesor)}`;
    checklistMap.set(key, chk);
  });

  // Group activities by `${isoDate}_${canonicalAdvisorKey}`
  const activitiesByDayAndAdvisor = new Map<
    string,
    {
      isoDate: string;
      advisorOriginal: string;
      canonicalKey: string;
      rows: typeof actividadesRaw;
    }
  >();

  actividadesRaw.forEach((act) => {
    const iso = normalizeDateToIso(act.fecha);
    if (!iso || !act.asesor) return;
    const cKey = canonicalAdvisorKey(act.asesor);
    const key = `${iso}_${cKey}`;
    const cur = activitiesByDayAndAdvisor.get(key) || {
      isoDate: iso,
      advisorOriginal: act.asesor,
      canonicalKey: cKey,
      rows: [],
    };
    cur.rows.push(act);
    activitiesByDayAndAdvisor.set(key, cur);
  });

  // Group evaluations by `${isoDate}_${canonicalAdvisorKey}`
  const evaluacionesByDayAndAdvisor = new Map<
    string,
    {
      isoDate: string;
      advisorOriginal: string;
      canonicalKey: string;
      record: EvaluacionRecord;
    }
  >();

  evaluacionesRaw.forEach((ev) => {
    const iso = normalizeDateToIso(ev.fecha);
    if (!iso || !ev.asesor) return;
    const cKey = canonicalAdvisorKey(ev.asesor);
    const key = `${iso}_${cKey}`;
    evaluacionesByDayAndAdvisor.set(key, {
      isoDate: iso,
      advisorOriginal: ev.asesor,
      canonicalKey: cKey,
      record: ev,
    });
  });

  // Secondary fuzzy pass:
  // If an evaluation has no exact key match with activities on the same date,
  // check if any activity on that same date refers to the same advisor via areSameAdvisorName!
  for (const [evKey, evObj] of Array.from(evaluacionesByDayAndAdvisor.entries())) {
    if (!activitiesByDayAndAdvisor.has(evKey)) {
      for (const [actKey, actObj] of Array.from(activitiesByDayAndAdvisor.entries())) {
        if (actObj.isoDate === evObj.isoDate) {
          if (areSameAdvisorName(evObj.advisorOriginal, actObj.advisorOriginal)) {
            // Remap evaluation to the activity key so they merge!
            evaluacionesByDayAndAdvisor.delete(evKey);
            evaluacionesByDayAndAdvisor.set(actKey, evObj);
            break;
          }
        }
      }
    }
  }

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
    const evEntry = evaluacionesByDayAndAdvisor.get(key);
    const evRecord = evEntry?.record;

    const isoDate = actGroup?.isoDate || evEntry?.isoDate || "";
    const rawAdvisorName = actGroup?.advisorOriginal || evEntry?.advisorOriginal || "";

    if (!isoDate || !rawAdvisorName) return;

    // Resolve clean canonical display name (e.g. "Yamery Rodríguez")
    const norm = normalizeAdvisorName(rawAdvisorName);
    const advisorDisplayName = norm && norm !== "Sin Asesor" ? norm : rawAdvisorName;
    const asesorCompleto =
      rawAdvisorName.toLowerCase() !== advisorDisplayName.toLowerCase()
        ? rawAdvisorName
        : undefined;

    advisorSet.add(advisorDisplayName);
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

    let firstGeo: { estado?: string; municipio?: string; parroquia?: string; sector?: string } | undefined;
    if (actGroup) {
      for (const act of actGroup.rows) {
        if (act.estado || act.municipio || act.parroquia || act.sector) {
          firstGeo = {
            estado: act.estado || undefined,
            municipio: act.municipio || undefined,
            parroquia: act.parroquia || undefined,
            sector: act.sector || undefined,
          };
          break;
        }
      }
    }

    const item: MatchItem = {
      id: `${isoDate}_${advisorDisplayName.replace(/\s+/g, "_")}`,
      fecha: isoDate,
      fechaDisplay: formatIsoToDisplayDate(isoDate),
      asesor: advisorDisplayName,
      asesorCompleto,
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
        territorioPrincipal: firstGeo,
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

  // ── Apply Date Filters First (for accurate Monitor de Reportes) ────────────
  let dateFiltered = allItems;

  if (filters?.preset === "hoy") {
    const todayCaracas = getCaracasTodayIso();
    dateFiltered = dateFiltered.filter((i) => i.fecha === todayCaracas);
  } else {
    if (filters?.from) {
      dateFiltered = dateFiltered.filter((i) => i.fecha >= filters.from!);
    }
    if (filters?.to) {
      dateFiltered = dateFiltered.filter((i) => i.fecha <= filters.to!);
    }
  }

  // ── Monitor de Reportes (Plantilla de Asesores vs Reportes Enviados) ───────
  const plantilla = await getPlantillaAsesores();
  const totalPlantilla = plantilla.length;

  const asesoresReportaron: Array<{ nombre: string; nombreCompleto?: string }> = [];
  const asesoresSinReporte: Array<{ nombre: string; nombreCompleto?: string }> = [];

  for (const adv of plantilla) {
    const hasReport = dateFiltered.some(
      (item) =>
        item.reporte.presente &&
        (areSameAdvisorName(adv.nombre, item.asesor) ||
          areSameAdvisorName(adv.nombreCompleto || "", item.asesor) ||
          (item.asesorCompleto && areSameAdvisorName(adv.nombreCompleto || "", item.asesorCompleto)))
    );

    if (hasReport) {
      asesoresReportaron.push(adv);
    } else {
      asesoresSinReporte.push(adv);
    }
  }

  const reportaronCount = asesoresReportaron.length;
  const noReportaronCount = asesoresSinReporte.length;
  const cumplimientoPct = totalPlantilla > 0 ? Math.round((reportaronCount / totalPlantilla) * 100) : 0;
  const ratioText = `${reportaronCount}/${totalPlantilla}`;
  const subText = `(${reportaronCount} reportes enviados de ${totalPlantilla} asesores)`;

  const monitorReportes: MatchMonitorReportes = {
    totalPlantilla,
    reportaronCount,
    noReportaronCount,
    cumplimientoPct,
    ratioText,
    subText,
    asesoresReportaron,
    asesoresSinReporte,
  };

  // ── Apply Remaining Filters (status, asesor, evaluador, search) ────────────
  let filtered = dateFiltered;

  if (filters?.status && filters.status !== "todos") {
    filtered = filtered.filter((i) => i.status === filters.status);
  }

  if (filters?.asesor && filters.asesor !== "todos") {
    const qAsesor = stripAccents(filters.asesor);
    filtered = filtered.filter(
      (i) =>
        stripAccents(i.asesor).includes(qAsesor) ||
        (i.asesorCompleto && stripAccents(i.asesorCompleto).includes(qAsesor))
    );
  }

  if (filters?.evaluador && filters.evaluador !== "todos") {
    const qEvaluador = stripAccents(filters.evaluador);
    filtered = filtered.filter((i) => stripAccents(i.evaluacion.evaluador || "").includes(qEvaluador));
  }

  if (filters?.search) {
    const q = stripAccents(filters.search);
    filtered = filtered.filter(
      (i) =>
        stripAccents(i.asesor).includes(q) ||
        (i.asesorCompleto && stripAccents(i.asesorCompleto).includes(q)) ||
        stripAccents(i.evaluacion.evaluador || "").includes(q) ||
        stripAccents(i.reporte.ubicacionResumen).includes(q) ||
        stripAccents(i.evaluacion.ubicacionResumen).includes(q) ||
        stripAccents(i.evaluacion.observacionesGenerales || "").includes(q)
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
    monitorReportes,
  };

  return {
    items: filtered,
    metrics,
    advisorsList: Array.from(advisorSet).sort((a, b) => a.localeCompare(b, "es")),
    evaluadoresList: Array.from(evaluadorSet).sort((a, b) => a.localeCompare(b, "es")),
  };
}
