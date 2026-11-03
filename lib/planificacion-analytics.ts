import { PlanificacionRecord, Installation, Solicitud } from "./dashboard-data";
import { formatProperCase } from "./utils";

export interface SectorHealthItem {
  sector: string;
  parroquia: string;
  municipio: string;
  estado: string;
  totalJornadas: number;
  solicitudesCount: number;
  instalacionesCount: number;
  conversionRate: number; // 0 a 100
  avgLagDays: number;
  deltaMoM: number; // Porcentaje de cambio
  trend: "ascenso" | "cuello_botella" | "declive" | "estable" | "dormida";
  trendLabel: string;
  topAdvisors: string[];
}

export interface ActivityEffectivenessItem {
  name: string;
  totalJornadas: number;
  solicitudesCount: number;
  instalacionesCount: number;
  solicitudesPerJornada: number;
  instalacionesPerJornada: number;
  conversionRate: number;
  avgLagDays: number;
}

export interface AdvisorTerritoryYieldItem {
  name: string;
  normName: string;
  totalJornadas: number;
  solicitudesCount: number;
  instalacionesCount: number;
  conversionRate: number;
  topSectors: Array<{
    sector: string;
    jornadas: number;
    solicitudes: number;
    instalaciones: number;
    conversionRate: number;
  }>;
}

export interface PlanificacionAnalyticsResult {
  overall: {
    totalSolicitudes: number;
    totalInstalaciones: number;
    matchedCount: number;
    conversionRate: number;
    avgCycleTimeDays: number;
    medianCycleTimeDays: number;
    totalJornadas: number;
    instPerJornada: number;
    risingSectorsCount: number;
    decliningSectorsCount: number;
    bottleneckSectorsCount: number;
  };
  sectorsHealth: SectorHealthItem[];
  activitiesEffectiveness: ActivityEffectivenessItem[];
  advisorsYield: AdvisorTerritoryYieldItem[];
}

const normKey = (str: string | null | undefined): string =>
  (str || "").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const cleanCedula = (c: string | null | undefined): string =>
  String(c || "").replace(/[^0-9]/g, "").replace(/^0+/, "");

function parseDate(str: string | null | undefined): Date | null {
  if (!str) return null;
  const clean = String(str).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
    const [y, m, d] = clean.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const parts = clean.split(/[\/\-]/).map(Number);
  if (parts.length === 3) {
    if (parts[2] > 1000) return new Date(parts[2], parts[1] - 1, parts[0]);
    if (parts[0] > 1000) return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  return null;
}

export function computePlanificacionAnalytics(
  planRecords: PlanificacionRecord[],
  solicitudes: Solicitud[],
  installations: Installation[]
): PlanificacionAnalyticsResult {
  // 1. Mapeo de Instalaciones por Cédula para Matching Determinístico
  const instByCedula = new Map<string, { fecha: string; parsedDate: Date | null; inst: Installation }>();
  installations.forEach((inst) => {
    const ced = cleanCedula(inst.cedula);
    if (ced && ced.length >= 6) {
      if (!instByCedula.has(ced)) {
        instByCedula.set(ced, {
          fecha: inst.fecha,
          parsedDate: parseDate(inst.fecha),
          inst,
        });
      }
    }
  });

  // 2. Cálculo de Lag / Ciclo de Conversión Solicitud -> Instalación
  let matchedCount = 0;
  const lagDaysList: number[] = [];
  const solWithStatus = solicitudes.map((sol) => {
    const ced = cleanCedula(sol.cedula);
    const solDate = parseDate(sol.fecha);
    let isInstalled = false;
    let installDate: Date | null = null;
    let lagDays = -1;

    if (ced && instByCedula.has(ced)) {
      const match = instByCedula.get(ced)!;
      isInstalled = true;
      installDate = match.parsedDate;
      if (solDate && installDate) {
        const diff = Math.round((installDate.getTime() - solDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diff >= 0 && diff <= 90) {
          lagDays = diff;
          lagDaysList.push(diff);
        }
      }
    } else {
      // Fallback: Si el estatus de la solicitud dice "Instalado"
      const st = (sol.estatus || "").toLowerCase();
      if (st.includes("instalad")) {
        isInstalled = true;
      }
    }

    if (isInstalled) matchedCount++;

    return {
      sol,
      ced,
      solDate,
      isInstalled,
      installDate,
      lagDays,
    };
  });

  const totalSolicitudes = solicitudes.length;
  const totalInstalaciones = installations.length;
  const conversionRate = totalSolicitudes > 0 ? Math.round((matchedCount / totalSolicitudes) * 1000) / 10 : 0;

  lagDaysList.sort((a, b) => a - b);
  const avgCycleTimeDays =
    lagDaysList.length > 0
      ? Math.round((lagDaysList.reduce((a, b) => a + b, 0) / lagDaysList.length) * 10) / 10
      : 2.0;
  const medianCycleTimeDays =
    lagDaysList.length > 0 ? lagDaysList[Math.floor(lagDaysList.length / 2)] : 1;

  // 3. Agrupación por Sector: Diagnóstico Territorial (Ascenso vs Descenso)
  const sectorMap = new Map<
    string,
    {
      name: string;
      parroquia: string;
      municipio: string;
      estado: string;
      jornadas: PlanificacionRecord[];
      sols: typeof solWithStatus;
      insts: Installation[];
    }
  >();

  const getSectorEntry = (rawSector: string, parroquia = "", municipio = "", estado = "") => {
    const clean = formatProperCase(rawSector || "Sin Sector");
    const key = normKey(clean);
    if (!sectorMap.has(key)) {
      sectorMap.set(key, {
        name: clean,
        parroquia: formatProperCase(parroquia),
        municipio: formatProperCase(municipio),
        estado: formatProperCase(estado),
        jornadas: [],
        sols: [],
        insts: [],
      });
    }
    const entry = sectorMap.get(key)!;
    if (!entry.parroquia && parroquia) entry.parroquia = formatProperCase(parroquia);
    if (!entry.municipio && municipio) entry.municipio = formatProperCase(municipio);
    if (!entry.estado && estado) entry.estado = formatProperCase(estado);
    return entry;
  };

  planRecords.forEach((p) => {
    if (p.sector && p.sector !== "N/A") {
      const entry = getSectorEntry(p.sector, p.parroquia, p.municipio, p.estado);
      entry.jornadas.push(p);
    }
  });

  solWithStatus.forEach((item) => {
    const s = item.sol;
    if (s.sector && s.sector !== "N/A") {
      const entry = getSectorEntry(s.sector, s.parroquia || s.zona, s.municipio, s.estado);
      entry.sols.push(item);
    }
  });

  installations.forEach((i) => {
    if (i.sector && i.sector !== "N/A") {
      const entry = getSectorEntry(i.sector, i.zona, i.oficina, i.estado);
      entry.insts.push(i);
    }
  });

  // Fecha límite para cálculo de tendencia reciente (últimos 45 días)
  const refDate = new Date(2026, 10, 2);
  const cutoffRecent = new Date(refDate);
  cutoffRecent.setDate(cutoffRecent.getDate() - 30);
  const cutoffPrevious = new Date(cutoffRecent);
  cutoffPrevious.setDate(cutoffPrevious.getDate() - 30);

  const sectorsHealth: SectorHealthItem[] = [];

  sectorMap.forEach((entry) => {
    if (!entry.name || entry.name === "Sin Sector" || entry.name === "N/A") return;

    const totalJornadas = entry.jornadas.length;
    const solsCount = entry.sols.length;
    const instsCount = entry.insts.length;

    // Solo evaluar sectores que tengan al menos alguna actividad o volumen
    if (totalJornadas === 0 && solsCount === 0 && instsCount === 0) return;

    // Instalaciones en periodo reciente vs periodo previo para calcular tendencia MoM
    let recentInst = 0;
    let prevInst = 0;

    entry.insts.forEach((inst) => {
      const d = parseDate(inst.fecha);
      if (d) {
        if (d >= cutoffRecent) recentInst++;
        else if (d >= cutoffPrevious && d < cutoffRecent) prevInst++;
      }
    });

    let deltaMoM = 0;
    if (prevInst > 0) {
      deltaMoM = Math.round(((recentInst - prevInst) / prevInst) * 100);
    } else if (recentInst > 0) {
      deltaMoM = 100;
    }

    const convRate = solsCount > 0 ? Math.round((instsCount / solsCount) * 100) : instsCount > 0 ? 100 : 0;

    // Cálculo del promedio de lag en este sector
    const sectorLags = entry.sols.filter((x) => x.lagDays >= 0).map((x) => x.lagDays);
    const avgLag =
      sectorLags.length > 0
        ? Math.round((sectorLags.reduce((a, b) => a + b, 0) / sectorLags.length) * 10) / 10
        : avgCycleTimeDays;

    // Top asesores en este sector
    const advCounts = new Map<string, number>();
    entry.jornadas.forEach((j) => {
      if (j.asesor) advCounts.set(j.asesor, (advCounts.get(j.asesor) || 0) + 1);
    });
    const topAdvisors = Array.from(advCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name);

    // Clasificación de Cuadrante de Salud
    let trend: SectorHealthItem["trend"] = "estable";
    let trendLabel = "Estable";

    if (totalJornadas === 0 && (solsCount > 0 || instsCount > 0)) {
      trend = "dormida";
      trendLabel = "Sin planificación";
    } else if (solsCount >= 8 && convRate < 40) {
      trend = "cuello_botella";
      trendLabel = "Cuello de botella";
    } else if (deltaMoM >= 20 || (recentInst >= 5 && deltaMoM >= 0)) {
      trend = "ascenso";
      trendLabel = "En ascenso";
    } else if (deltaMoM <= -20 && totalJornadas > 0) {
      trend = "declive";
      trendLabel = "En declive";
    }

    sectorsHealth.push({
      sector: entry.name,
      parroquia: entry.parroquia,
      municipio: entry.municipio,
      estado: entry.estado,
      totalJornadas,
      solicitudesCount: solsCount,
      instalacionesCount: instsCount,
      conversionRate: convRate,
      avgLagDays: avgLag,
      deltaMoM,
      trend,
      trendLabel,
      topAdvisors,
    });
  });

  // Ordenar sectores: primero por volumen de instalaciones y solicitudes
  sectorsHealth.sort((a, b) => b.instalacionesCount - a.instalacionesCount || b.solicitudesCount - a.solicitudesCount);

  // 4. Efectividad por Tipo de Actividad
  const actMap = new Map<
    string,
    {
      name: string;
      jornadas: PlanificacionRecord[];
      solsSet: Set<string>;
      instsSet: Set<string>;
    }
  >();

  planRecords.forEach((p) => {
    const act = formatProperCase(p.tipo_actividad || p.plan || "Recorrido (Solo)");
    if (!act || act === "N/A") return;
    if (!actMap.has(act)) {
      actMap.set(act, {
        name: act,
        jornadas: [],
        solsSet: new Set(),
        instsSet: new Set(),
      });
    }
    actMap.get(act)!.jornadas.push(p);
  });

  // Ventana de atribución temporal por jornada de actividad:
  // Si una solicitud o instalación ocurrió en el mismo sector y fecha [T, T+7] atribuible
  const activitiesEffectiveness: ActivityEffectivenessItem[] = [];

  actMap.forEach((entry) => {
    const totalJ = entry.jornadas.length;
    if (totalJ === 0) return;

    let attributedSols = 0;
    let attributedInsts = 0;

    // Para cada jornada de esta actividad, buscar solicitudes del mismo asesor o sector en ventana [T, T+4]
    entry.jornadas.forEach((j) => {
      const jDate = parseDate(j.fecha);
      if (!jDate) return;
      const targetSec = normKey(j.sector);
      const targetAdv = normKey(j.asesor);

      // Solicitudes en ventana
      solicitudes.forEach((s) => {
        if (!s.fecha) return;
        const sDate = parseDate(s.fecha);
        if (!sDate) return;
        const diff = Math.round((sDate.getTime() - jDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diff >= 0 && diff <= 4) {
          const sSec = normKey(s.sector);
          const sAdv = normKey(s.asesor);
          if (sAdv === targetAdv || (targetSec && sSec === targetSec)) {
            attributedSols++;
          }
        }
      });

      // Instalaciones en ventana [T, T+14]
      installations.forEach((i) => {
        if (!i.fecha) return;
        const iDate = parseDate(i.fecha);
        if (!iDate) return;
        const diff = Math.round((iDate.getTime() - jDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diff >= 0 && diff <= 14) {
          const iSec = normKey(i.sector);
          const iAdv = normKey(i.asesor);
          if (iAdv === targetAdv || (targetSec && iSec === targetSec)) {
            attributedInsts++;
          }
        }
      });
    });

    // Normalización prudencial
    const cappedSols = Math.min(attributedSols, totalJ * 4);
    const cappedInsts = Math.min(attributedInsts, Math.round(cappedSols * 0.8));

    const solsPerJ = totalJ > 0 ? Math.round((cappedSols / totalJ) * 10) / 10 : 0;
    const instPerJ = totalJ > 0 ? Math.round((cappedInsts / totalJ) * 10) / 10 : 0;
    const actConvRate = cappedSols > 0 ? Math.round((cappedInsts / cappedSols) * 100) : 0;

    activitiesEffectiveness.push({
      name: entry.name,
      totalJornadas: totalJ,
      solicitudesCount: cappedSols,
      instalacionesCount: cappedInsts,
      solicitudesPerJornada: solsPerJ,
      instalacionesPerJornada: instPerJ,
      conversionRate: actConvRate,
      avgLagDays: avgCycleTimeDays,
    });
  });

  activitiesEffectiveness.sort((a, b) => b.totalJornadas - a.totalJornadas);

  // 5. Rendimiento de Asesores por Territorio
  const advMap = new Map<
    string,
    {
      name: string;
      normName: string;
      jornadasCount: number;
      sectorsMap: Map<string, { sector: string; jornadas: number; sol: number; inst: number }>;
      solsCount: number;
      instsCount: number;
    }
  >();

  planRecords.forEach((p) => {
    if (!p.asesor || p.asesor === "Sin Asesor") return;
    const nk = normKey(p.asesor);
    if (!advMap.has(nk)) {
      advMap.set(nk, {
        name: p.asesor,
        normName: nk,
        jornadasCount: 0,
        sectorsMap: new Map(),
        solsCount: 0,
        instsCount: 0,
      });
    }
    const a = advMap.get(nk)!;
    a.jornadasCount++;
    if (p.sector) {
      const sKey = normKey(p.sector);
      if (!a.sectorsMap.has(sKey)) {
        a.sectorsMap.set(sKey, { sector: formatProperCase(p.sector), jornadas: 0, sol: 0, inst: 0 });
      }
      a.sectorsMap.get(sKey)!.jornadas++;
    }
  });

  solWithStatus.forEach((item) => {
    if (!item.sol.asesor) return;
    const nk = normKey(item.sol.asesor);
    if (advMap.has(nk)) {
      const a = advMap.get(nk)!;
      a.solsCount++;
      if (item.sol.sector) {
        const sKey = normKey(item.sol.sector);
        if (a.sectorsMap.has(sKey)) {
          a.sectorsMap.get(sKey)!.sol++;
        }
      }
    }
  });

  installations.forEach((i) => {
    if (!i.asesor) return;
    const nk = normKey(i.asesor);
    if (advMap.has(nk)) {
      const a = advMap.get(nk)!;
      a.instsCount++;
      if (i.sector) {
        const sKey = normKey(i.sector);
        if (a.sectorsMap.has(sKey)) {
          a.sectorsMap.get(sKey)!.inst++;
        }
      }
    }
  });

  const advisorsYield: AdvisorTerritoryYieldItem[] = Array.from(advMap.values())
    .map((a) => {
      const topSecs = Array.from(a.sectorsMap.values())
        .map((s) => ({
          sector: s.sector,
          jornadas: s.jornadas,
          solicitudes: s.sol,
          instalaciones: s.inst,
          conversionRate: s.sol > 0 ? Math.round((s.inst / s.sol) * 100) : s.inst > 0 ? 100 : 0,
        }))
        .sort((x, y) => y.jornadas - x.jornadas || y.instalaciones - x.instalaciones)
        .slice(0, 4);

      const conv = a.solsCount > 0 ? Math.round((a.instsCount / a.solsCount) * 100) : a.instsCount > 0 ? 100 : 0;

      return {
        name: a.name,
        normName: a.normName,
        totalJornadas: a.jornadasCount,
        solicitudesCount: a.solsCount,
        instalacionesCount: a.instsCount,
        conversionRate: conv,
        topSectors: topSecs,
      };
    })
    .sort((x, y) => y.instalacionesCount - x.instalacionesCount || y.totalJornadas - x.totalJornadas);

  const risingSectorsCount = sectorsHealth.filter((s) => s.trend === "ascenso").length;
  const decliningSectorsCount = sectorsHealth.filter((s) => s.trend === "declive").length;
  const bottleneckSectorsCount = sectorsHealth.filter((s) => s.trend === "cuello_botella").length;
  const totalJornadas = planRecords.length;
  const instPerJornada = totalJornadas > 0 ? Math.round((matchedCount / totalJornadas) * 10) / 10 : 0;

  return {
    overall: {
      totalSolicitudes,
      totalInstalaciones,
      matchedCount,
      conversionRate,
      avgCycleTimeDays,
      medianCycleTimeDays,
      totalJornadas,
      instPerJornada,
      risingSectorsCount,
      decliningSectorsCount,
      bottleneckSectorsCount,
    },
    sectorsHealth,
    activitiesEffectiveness,
    advisorsYield,
  };
}
