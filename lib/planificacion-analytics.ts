import { PlanificacionRecord, Installation, Solicitud } from "./dashboard-data";
import { formatProperCase } from "./utils";

export interface SectorHealthItem {
  sector: string;
  parroquia: string;
  municipio: string;
  estado: string;
  totalJornadas: number;
  solicitudesCount: number;
  instalacionesCount: number; // Instalaciones convertidas verificadas de estas solicitudes
  instalacionesTotalesZona: number; // Total de instalaciones registradas en la zona en el periodo
  conversionRate: number; // 0 a 100% (instalacionesCount / solicitudesCount * 100)
  avgLagDays: number;
  deltaMoM: number; // Porcentaje de cambio MoM
  // Baseline de Media Histórica de Zona (Estado, Municipio, Parroquia y Sector)
  mediaDiariaSolicitudes: number; // Media histórica diaria de solicitudes de la zona
  mediaDiariaInstalaciones: number; // Media histórica diaria de instalaciones de la zona
  solicitudesEsperadas: number; // mediaDiaria * jornadas o días
  deltaVsMedia: number; // % variación vs media histórica
  impactoVsMedia: "sobre_media" | "en_media" | "bajo_media";
  impactoLabel: string; // "+28% vs media", "En la media", "-35% vs media"
  trend: "ascenso" | "cuello_botella" | "declive" | "estable" | "dormida";
  trendLabel: string;
  topAdvisors: string[];
  activities: string[];
}

export interface ActivityEffectivenessItem {
  name: string;
  totalJornadas: number;
  solicitudesCount: number;
  instalacionesCount: number; // Instalaciones reales convertidas
  solicitudesPerJornada: number;
  instalacionesPerJornada: number;
  conversionRate: number; // (instalacionesCount / solicitudesCount) * 100
  avgLagDays: number;
  mediaDiariaZona: number;
  deltaVsMedia: number;
  rendimientoLabel: string;
}

export interface AdvisorTerritoryYieldItem {
  name: string;
  normName: string;
  totalJornadas: number;
  solicitudesCount: number;
  instalacionesCount: number; // Instalaciones reales convertidas por cédula
  totalInstalacionesZona: number;
  conversionRate: number; // 0 a 100%
  mediaDiariaZonas: number;
  solicitudesEsperadas: number;
  rendimientoVsMedia: number;
  impactoLabel: string;
  topSectors: Array<{
    sector: string;
    jornadas: number;
    solicitudes: number;
    instalaciones: number;
    conversionRate: number;
    mediaDiariaZona: number;
  }>;
}

export interface PlanificacionAnalyticsResult {
  overall: {
    totalSolicitudes: number;
    totalInstalaciones: number;
    matchedCount: number;
    conversionRate: number; // 0 a 100%
    avgCycleTimeDays: number;
    medianCycleTimeDays: number;
    totalJornadas: number;
    instPerJornada: number;
    mediaDiariaGlobalSolicitudes: number;
    mediaDiariaGlobalInstalaciones: number;
    rendimientoGlobalVsMedia: number;
    rendimientoGlobalLabel: string;
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

const isValidGeoName = (val: string | null | undefined): boolean => {
  if (!val) return false;
  const clean = val.trim().toUpperCase();
  return (
    clean !== "" &&
    clean !== "N/A" &&
    clean !== "NA" &&
    clean !== "OTROS" &&
    clean !== "OTRO" &&
    clean !== "SIN SECTOR" &&
    clean !== "SIN ASESOR" &&
    clean !== "DESCONOCIDO" &&
    clean !== "CALL CENTER" &&
    clean !== "COMERCIALIZACION" &&
    clean !== "COMERCIALIZACION / EX-COLABORADOR" &&
    clean !== "ALI PRIMERA" &&
    clean !== "SEDE" &&
    clean !== "OFICINA"
  );
};

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
  installations: Installation[],
  allSolicitudesForBaseline?: Solicitud[],
  allInstallationsForBaseline?: Installation[]
): PlanificacionAnalyticsResult {
  // 1. Pool Histórico Completo para Baselines de Zona y Matching Determinístico
  const historicalSols =
    allSolicitudesForBaseline && allSolicitudesForBaseline.length > 0
      ? allSolicitudesForBaseline
      : solicitudes;
  const matchPool =
    allInstallationsForBaseline && allInstallationsForBaseline.length > 0
      ? allInstallationsForBaseline
      : installations;

  // 2. Mapeo de Instalaciones por Cédula para Matching Determinístico
  const instByCedula = new Map<string, { fecha: string; parsedDate: Date | null; inst: Installation }>();
  matchPool.forEach((inst) => {
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

  // 3. Cálculo de Baseline Histórico por Entidad Territorial (Sector, Parroquia, Municipio, Estado)
  interface ZoneAccumulator {
    totalSols: number;
    solsByDate: Set<string>;
    totalInsts: number;
    instsByDate: Set<string>;
  }

  const createZoneAcc = (): ZoneAccumulator => ({
    totalSols: 0,
    solsByDate: new Set<string>(),
    totalInsts: 0,
    instsByDate: new Set<string>(),
  });

  const sectorBaselines = new Map<string, ZoneAccumulator>();
  const parroquiaBaselines = new Map<string, ZoneAccumulator>();
  const municipioBaselines = new Map<string, ZoneAccumulator>();
  const estadoBaselines = new Map<string, ZoneAccumulator>();
  const allHistoricalDates = new Set<string>();

  // Acumular solicitudes históricas completas
  historicalSols.forEach((s) => {
    const sDate = s.fecha ? s.fecha.slice(0, 10) : "";
    if (sDate) allHistoricalDates.add(sDate);

    // Sector
    if (s.sector && isValidGeoName(s.sector)) {
      const k = normKey(s.sector);
      if (!sectorBaselines.has(k)) sectorBaselines.set(k, createZoneAcc());
      const acc = sectorBaselines.get(k)!;
      acc.totalSols++;
      if (sDate) acc.solsByDate.add(sDate);
    }
    // Parroquia
    const par = s.parroquia || s.zona;
    if (par && isValidGeoName(par)) {
      const k = normKey(par);
      if (!parroquiaBaselines.has(k)) parroquiaBaselines.set(k, createZoneAcc());
      const acc = parroquiaBaselines.get(k)!;
      acc.totalSols++;
      if (sDate) acc.solsByDate.add(sDate);
    }
    // Municipio
    if (s.municipio && isValidGeoName(s.municipio)) {
      const k = normKey(s.municipio);
      if (!municipioBaselines.has(k)) municipioBaselines.set(k, createZoneAcc());
      const acc = municipioBaselines.get(k)!;
      acc.totalSols++;
      if (sDate) acc.solsByDate.add(sDate);
    }
    // Estado
    if (s.estado && isValidGeoName(s.estado)) {
      const k = normKey(s.estado);
      if (!estadoBaselines.has(k)) estadoBaselines.set(k, createZoneAcc());
      const acc = estadoBaselines.get(k)!;
      acc.totalSols++;
      if (sDate) acc.solsByDate.add(sDate);
    }
  });

  // Acumular instalaciones históricas completas
  matchPool.forEach((i) => {
    const iDate = i.fecha ? i.fecha.slice(0, 10) : "";
    if (iDate) allHistoricalDates.add(iDate);

    // Sector
    if (i.sector && isValidGeoName(i.sector)) {
      const k = normKey(i.sector);
      if (!sectorBaselines.has(k)) sectorBaselines.set(k, createZoneAcc());
      const acc = sectorBaselines.get(k)!;
      acc.totalInsts++;
      if (iDate) acc.instsByDate.add(iDate);
    }
    // Parroquia
    const par = i.zona;
    if (par && isValidGeoName(par)) {
      const k = normKey(par);
      if (!parroquiaBaselines.has(k)) parroquiaBaselines.set(k, createZoneAcc());
      const acc = parroquiaBaselines.get(k)!;
      acc.totalInsts++;
      if (iDate) acc.instsByDate.add(iDate);
    }
    // Municipio
    if (i.oficina && isValidGeoName(i.oficina)) {
      const k = normKey(i.oficina);
      if (!municipioBaselines.has(k)) municipioBaselines.set(k, createZoneAcc());
      const acc = municipioBaselines.get(k)!;
      acc.totalInsts++;
      if (iDate) acc.instsByDate.add(iDate);
    }
    // Estado
    if (i.estado && isValidGeoName(i.estado)) {
      const k = normKey(i.estado);
      if (!estadoBaselines.has(k)) estadoBaselines.set(k, createZoneAcc());
      const acc = estadoBaselines.get(k)!;
      acc.totalInsts++;
      if (iDate) acc.instsByDate.add(iDate);
    }
  });

  // Función jerárquica para resolver la media diaria histórica de una zona
  const getZoneBaseline = (sector?: string, parroquia?: string, municipio?: string, estado?: string) => {
    // 1. Sector (si tiene al menos 2 días con actividad)
    if (sector && isValidGeoName(sector)) {
      const acc = sectorBaselines.get(normKey(sector));
      if (acc && acc.solsByDate.size >= 2) {
        const activeDaysSols = Math.max(1, acc.solsByDate.size);
        const activeDaysInsts = Math.max(1, acc.instsByDate.size);
        return {
          level: "sector",
          mediaDiariaSols: Math.round((acc.totalSols / activeDaysSols) * 10) / 10,
          mediaDiariaInsts: Math.round((acc.totalInsts / activeDaysInsts) * 10) / 10,
        };
      }
    }
    // 2. Parroquia (ej: Los Teques, Petare, Sucre, Caricuao)
    if (parroquia && isValidGeoName(parroquia)) {
      const acc = parroquiaBaselines.get(normKey(parroquia));
      if (acc && acc.solsByDate.size > 0) {
        const activeDaysSols = Math.max(1, acc.solsByDate.size);
        const activeDaysInsts = Math.max(1, acc.instsByDate.size);
        return {
          level: "parroquia",
          mediaDiariaSols: Math.round((acc.totalSols / activeDaysSols) * 10) / 10,
          mediaDiariaInsts: Math.round((acc.totalInsts / activeDaysInsts) * 10) / 10,
        };
      }
    }
    // 3. Municipio (ej: Guaicaipuro, Libertador, Sucre)
    if (municipio && isValidGeoName(municipio)) {
      const acc = municipioBaselines.get(normKey(municipio));
      if (acc && acc.solsByDate.size > 0) {
        const activeDaysSols = Math.max(1, acc.solsByDate.size);
        const activeDaysInsts = Math.max(1, acc.instsByDate.size);
        return {
          level: "municipio",
          mediaDiariaSols: Math.round((acc.totalSols / activeDaysSols) * 10) / 10,
          mediaDiariaInsts: Math.round((acc.totalInsts / activeDaysInsts) * 10) / 10,
        };
      }
    }
    // 4. Estado (ej: Miranda, Distrito Capital)
    if (estado && isValidGeoName(estado)) {
      const acc = estadoBaselines.get(normKey(estado));
      if (acc && acc.solsByDate.size > 0) {
        const activeDaysSols = Math.max(1, acc.solsByDate.size);
        const activeDaysInsts = Math.max(1, acc.instsByDate.size);
        return {
          level: "estado",
          mediaDiariaSols: Math.round((acc.totalSols / activeDaysSols) * 10) / 10,
          mediaDiariaInsts: Math.round((acc.totalInsts / activeDaysInsts) * 10) / 10,
        };
      }
    }
    return {
      level: "default",
      mediaDiariaSols: 2.0,
      mediaDiariaInsts: 1.5,
    };
  };

  // Medias globales históricas
  const totalHistoricalDays = Math.max(1, allHistoricalDates.size);
  const mediaDiariaGlobalSolicitudes =
    Math.round((historicalSols.length / totalHistoricalDays) * 10) / 10;
  const mediaDiariaGlobalInstalaciones =
    Math.round((matchPool.length / totalHistoricalDays) * 10) / 10;

  // 4. Conversión Determinística Real por Cédula
  // Una solicitud solo cuenta como conversión SI Y SOLO SI su cliente fue instalado
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
  // Tasa de conversión matemática real: NUNCA excede el 100%
  const conversionRate =
    totalSolicitudes > 0 ? Math.round((matchedCount / totalSolicitudes) * 1000) / 10 : 0;

  lagDaysList.sort((a, b) => a - b);
  const avgCycleTimeDays =
    lagDaysList.length > 0
      ? Math.round((lagDaysList.reduce((a, b) => a + b, 0) / lagDaysList.length) * 10) / 10
      : 2.0;
  const medianCycleTimeDays =
    lagDaysList.length > 0 ? lagDaysList[Math.floor(lagDaysList.length / 2)] : 1;

  // 5. Agrupación por Sector: Diagnóstico Territorial y Comparativa vs Media de Zona
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
        parroquia: isValidGeoName(parroquia) ? formatProperCase(parroquia) : "",
        municipio: isValidGeoName(municipio) ? formatProperCase(municipio) : "",
        estado: isValidGeoName(estado) ? formatProperCase(estado) : "",
        jornadas: [],
        sols: [],
        insts: [],
      });
    }
    const entry = sectorMap.get(key)!;
    if (!entry.parroquia && isValidGeoName(parroquia)) entry.parroquia = formatProperCase(parroquia);
    if (!entry.municipio && isValidGeoName(municipio)) entry.municipio = formatProperCase(municipio);
    if (!entry.estado && isValidGeoName(estado)) entry.estado = formatProperCase(estado);
    return entry;
  };

  planRecords.forEach((p) => {
    if (p.sector && isValidGeoName(p.sector)) {
      const entry = getSectorEntry(p.sector, p.parroquia, p.municipio, p.estado);
      entry.jornadas.push(p);
    }
  });

  solWithStatus.forEach((item) => {
    const s = item.sol;
    if (s.sector && isValidGeoName(s.sector)) {
      const entry = getSectorEntry(s.sector, s.parroquia || s.zona, s.municipio, s.estado);
      entry.sols.push(item);
    }
  });

  installations.forEach((i) => {
    if (i.sector && isValidGeoName(i.sector)) {
      const entry = getSectorEntry(i.sector, i.zona, i.oficina, i.estado);
      entry.insts.push(i);
    }
  });

  // Ventana de tendencia MoM reciente
  const refDate = new Date(2026, 10, 2);
  const cutoffRecent = new Date(refDate);
  cutoffRecent.setDate(cutoffRecent.getDate() - 30);
  const cutoffPrevious = new Date(cutoffRecent);
  cutoffPrevious.setDate(cutoffPrevious.getDate() - 30);

  const sectorsHealth: SectorHealthItem[] = [];

  sectorMap.forEach((entry) => {
    if (!entry.name || !isValidGeoName(entry.name)) return;

    const totalJornadas = entry.jornadas.length;
    const solsCount = entry.sols.length;
    const totalInstsZona = entry.insts.length;

    // Solo evaluar sectores que tengan al menos alguna actividad o volumen
    if (totalJornadas === 0 && solsCount === 0 && totalInstsZona === 0) return;

    // Conversión real por cédula del sector
    const matchedSolsCount = entry.sols.filter((x) => x.isInstalled).length;
    const convRate =
      solsCount > 0 ? Math.round((matchedSolsCount / solsCount) * 1000) / 10 : 0;

    // Media histórica de la zona (Sector / Parroquia / Municipio / Estado)
    const baseline = getZoneBaseline(entry.name, entry.parroquia, entry.municipio, entry.estado);
    const mediaDiariaSolicitudes = baseline.mediaDiariaSols;
    const mediaDiariaInstalaciones = baseline.mediaDiariaInsts;

    // Volumen esperado de solicitudes para la intensidad de despliegue
    const diasDespliegue = Math.max(1, totalJornadas);
    const solsEsperadas = Math.round(mediaDiariaSolicitudes * diasDespliegue * 10) / 10;

    // Lift o variación porcentual vs media histórica esperada
    const deltaVsMedia =
      solsEsperadas > 0
        ? Math.round(((solsCount - solsEsperadas) / solsEsperadas) * 100)
        : 0;

    let impactoVsMedia: SectorHealthItem["impactoVsMedia"] = "en_media";
    let impactoLabel = "En la media";

    if (solsCount > 0 && deltaVsMedia >= 15) {
      impactoVsMedia = "sobre_media";
      impactoLabel = `+${deltaVsMedia}% vs media`;
    } else if (solsEsperadas > 0 && deltaVsMedia <= -15) {
      impactoVsMedia = "bajo_media";
      impactoLabel = `${deltaVsMedia}% vs media`;
    }

    // Instalaciones recientes vs previas para MoM
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

    // Cálculo del promedio de lag
    const sectorLags = entry.sols.filter((x) => x.lagDays >= 0).map((x) => x.lagDays);
    const avgLag =
      sectorLags.length > 0
        ? Math.round((sectorLags.reduce((a, b) => a + b, 0) / sectorLags.length) * 10) / 10
        : avgCycleTimeDays;

    // Top asesores en este sector
    const advCounts = new Map<string, number>();
    entry.jornadas.forEach((j) => {
      if (j.asesor && isValidGeoName(j.asesor)) {
        advCounts.set(j.asesor, (advCounts.get(j.asesor) || 0) + 1);
      }
    });
    const topAdvisors = Array.from(advCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name);

    // Modalidades de actividad en este sector
    const actCounts = new Map<string, number>();
    entry.jornadas.forEach((j) => {
      const act = formatProperCase(j.tipo_actividad || j.plan || "Recorrido");
      if (act && isValidGeoName(act)) {
        actCounts.set(act, (actCounts.get(act) || 0) + 1);
      }
    });
    const activities = Array.from(actCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([name]) => name);

    // Clasificación de Cuadrante Territorial
    let trend: SectorHealthItem["trend"] = "estable";
    let trendLabel = "Estable";

    if (totalJornadas === 0 && solsCount > 0) {
      trend = "dormida";
      trendLabel = "Orgánico sin planificación";
    } else if (solsCount >= 5 && convRate < 35) {
      trend = "cuello_botella";
      trendLabel = "Cuello de botella técnico";
    } else if (deltaVsMedia >= 15 && convRate >= 35) {
      trend = "ascenso";
      trendLabel = "Sobre la media de zona";
    } else if (deltaVsMedia <= -20 && totalJornadas > 0) {
      trend = "declive";
      trendLabel = "Bajo rendimiento de zona";
    }

    sectorsHealth.push({
      sector: entry.name,
      parroquia: entry.parroquia,
      municipio: entry.municipio,
      estado: entry.estado,
      totalJornadas,
      solicitudesCount: solsCount,
      instalacionesCount: matchedSolsCount,
      instalacionesTotalesZona: totalInstsZona,
      conversionRate: convRate,
      avgLagDays: avgLag,
      deltaMoM,
      mediaDiariaSolicitudes,
      mediaDiariaInstalaciones,
      solicitudesEsperadas: solsEsperadas,
      deltaVsMedia,
      impactoVsMedia,
      impactoLabel,
      trend,
      trendLabel,
      topAdvisors,
      activities,
    });
  });

  // Ordenar sectores por solicitudes e instalaciones
  sectorsHealth.sort(
    (a, b) => b.solicitudesCount - a.solicitudesCount || b.instalacionesCount - a.instalacionesCount
  );

  // 6. Efectividad por Tipo de Actividad
  const actMap = new Map<
    string,
    {
      name: string;
      jornadas: PlanificacionRecord[];
    }
  >();

  planRecords.forEach((p) => {
    const act = formatProperCase(p.tipo_actividad || p.plan || "Recorrido");
    if (!act || !isValidGeoName(act)) return;
    if (!actMap.has(act)) {
      actMap.set(act, {
        name: act,
        jornadas: [],
      });
    }
    actMap.get(act)!.jornadas.push(p);
  });

  // Indexación para velocidad de atribución
  interface PreIndexedAttributionItem {
    time: number;
    normAdv: string;
    normSec: string;
    isInstalled: boolean;
  }

  const solsByAdv = new Map<string, PreIndexedAttributionItem[]>();
  const solsBySec = new Map<string, PreIndexedAttributionItem[]>();

  solWithStatus.forEach((item) => {
    const s = item.sol;
    if (!s.fecha) return;
    const d = parseDate(s.fecha);
    if (!d) return;
    const preItem: PreIndexedAttributionItem = {
      time: d.getTime(),
      normAdv: normKey(s.asesor),
      normSec: normKey(s.sector),
      isInstalled: item.isInstalled,
    };
    if (preItem.normAdv) {
      if (!solsByAdv.has(preItem.normAdv)) solsByAdv.set(preItem.normAdv, []);
      solsByAdv.get(preItem.normAdv)!.push(preItem);
    }
    if (preItem.normSec) {
      if (!solsBySec.has(preItem.normSec)) solsBySec.set(preItem.normSec, []);
      solsBySec.get(preItem.normSec)!.push(preItem);
    }
  });

  const ONE_DAY_MS = 86400000;
  const activitiesEffectiveness: ActivityEffectivenessItem[] = [];

  actMap.forEach((entry) => {
    const totalJ = entry.jornadas.length;
    if (totalJ === 0) return;

    let attributedSols = 0;
    let matchedInsts = 0;
    let totalExpectedSols = 0;

    entry.jornadas.forEach((j) => {
      const jDate = parseDate(j.fecha);
      if (!jDate) return;
      const jTime = jDate.getTime();
      const targetSec = normKey(j.sector);
      const targetAdv = normKey(j.asesor);

      // Media esperada de la zona para esta jornada
      const base = getZoneBaseline(j.sector, j.parroquia, j.municipio, j.estado);
      totalExpectedSols += base.mediaDiariaSols;

      const candidateSols = new Set<PreIndexedAttributionItem>();
      if (targetAdv && solsByAdv.has(targetAdv)) {
        solsByAdv.get(targetAdv)!.forEach((s) => candidateSols.add(s));
      }
      if (targetSec && solsBySec.has(targetSec)) {
        solsBySec.get(targetSec)!.forEach((s) => candidateSols.add(s));
      }

      candidateSols.forEach((s) => {
        const diff = Math.round((s.time - jTime) / ONE_DAY_MS);
        if (diff >= 0 && diff <= 4) {
          attributedSols++;
          if (s.isInstalled) {
            matchedInsts++;
          }
        }
      });
    });

    const cappedSols = Math.min(attributedSols, totalJ * 6);
    const cappedInsts = Math.min(matchedInsts, cappedSols);

    const solsPerJ = totalJ > 0 ? Math.round((cappedSols / totalJ) * 10) / 10 : 0;
    const instPerJ = totalJ > 0 ? Math.round((cappedInsts / totalJ) * 10) / 10 : 0;
    const actConvRate = cappedSols > 0 ? Math.round((cappedInsts / cappedSols) * 1000) / 10 : 0;

    const mediaDiariaZona = totalJ > 0 ? Math.round((totalExpectedSols / totalJ) * 10) / 10 : 1.0;
    const deltaVsMedia =
      totalExpectedSols > 0
        ? Math.round(((cappedSols - totalExpectedSols) / totalExpectedSols) * 100)
        : 0;

    const rendimientoLabel =
      deltaVsMedia >= 15
        ? `+${deltaVsMedia}% vs media`
        : deltaVsMedia <= -15
        ? `${deltaVsMedia}% vs media`
        : "En la media";

    activitiesEffectiveness.push({
      name: entry.name,
      totalJornadas: totalJ,
      solicitudesCount: cappedSols,
      instalacionesCount: cappedInsts,
      solicitudesPerJornada: solsPerJ,
      instalacionesPerJornada: instPerJ,
      conversionRate: actConvRate,
      avgLagDays: avgCycleTimeDays,
      mediaDiariaZona,
      deltaVsMedia,
      rendimientoLabel,
    });
  });

  activitiesEffectiveness.sort((a, b) => b.totalJornadas - a.totalJornadas);

  // 7. Rendimiento de Asesores por Territorio
  const advMap = new Map<
    string,
    {
      name: string;
      normName: string;
      jornadasCount: number;
      sols: typeof solWithStatus;
      insts: Installation[];
      sectorsMap: Map<
        string,
        {
          sector: string;
          jornadas: number;
          sol: number;
          matched: number;
          mediaDiaria: number;
        }
      >;
    }
  >();

  planRecords.forEach((p) => {
    if (!p.asesor || !isValidGeoName(p.asesor)) return;
    const nk = normKey(p.asesor);
    if (!advMap.has(nk)) {
      advMap.set(nk, {
        name: p.asesor,
        normName: nk,
        jornadasCount: 0,
        sols: [],
        insts: [],
        sectorsMap: new Map(),
      });
    }
    const a = advMap.get(nk)!;
    a.jornadasCount++;
    if (p.sector && isValidGeoName(p.sector)) {
      const sKey = normKey(p.sector);
      if (!a.sectorsMap.has(sKey)) {
        const base = getZoneBaseline(p.sector, p.parroquia, p.municipio, p.estado);
        a.sectorsMap.set(sKey, {
          sector: formatProperCase(p.sector),
          jornadas: 0,
          sol: 0,
          matched: 0,
          mediaDiaria: base.mediaDiariaSols,
        });
      }
      a.sectorsMap.get(sKey)!.jornadas++;
    }
  });

  solWithStatus.forEach((item) => {
    if (!item.sol.asesor || !isValidGeoName(item.sol.asesor)) return;
    const nk = normKey(item.sol.asesor);
    if (advMap.has(nk)) {
      const a = advMap.get(nk)!;
      a.sols.push(item);
      if (item.sol.sector && isValidGeoName(item.sol.sector)) {
        const sKey = normKey(item.sol.sector);
        if (!a.sectorsMap.has(sKey)) {
          const base = getZoneBaseline(
            item.sol.sector,
            item.sol.parroquia || item.sol.zona,
            item.sol.municipio,
            item.sol.estado
          );
          a.sectorsMap.set(sKey, {
            sector: formatProperCase(item.sol.sector),
            jornadas: 0,
            sol: 0,
            matched: 0,
            mediaDiaria: base.mediaDiariaSols,
          });
        }
        const sEntry = a.sectorsMap.get(sKey)!;
        sEntry.sol++;
        if (item.isInstalled) sEntry.matched++;
      }
    }
  });

  installations.forEach((i) => {
    if (!i.asesor || !isValidGeoName(i.asesor)) return;
    const nk = normKey(i.asesor);
    if (advMap.has(nk)) {
      const a = advMap.get(nk)!;
      a.insts.push(i);
    }
  });

  const advisorsYield: AdvisorTerritoryYieldItem[] = Array.from(advMap.values())
    .map((a) => {
      const solsCount = a.sols.length;
      const matchedSols = a.sols.filter((x) => x.isInstalled).length;
      // Conversión real por cédula del asesor (<= 100%)
      const convRate =
        solsCount > 0 ? Math.round((matchedSols / solsCount) * 1000) / 10 : 0;

      // Expectativa de solicitudes basada en las zonas visitadas por el asesor
      let totalExpected = 0;
      let totalSectorJornadas = 0;

      a.sectorsMap.forEach((sec) => {
        const jCount = Math.max(1, sec.jornadas);
        totalExpected += sec.mediaDiaria * jCount;
        totalSectorJornadas += jCount;
      });

      const mediaDiariaZonas =
        totalSectorJornadas > 0
          ? Math.round((totalExpected / totalSectorJornadas) * 10) / 10
          : mediaDiariaGlobalSolicitudes;

      const solicitudesEsperadas = Math.round(totalExpected * 10) / 10;
      const rendimientoVsMedia =
        solicitudesEsperadas > 0
          ? Math.round(((solsCount - solicitudesEsperadas) / solicitudesEsperadas) * 100)
          : 0;

      const impactoLabel =
        rendimientoVsMedia >= 15
          ? `+${rendimientoVsMedia}% vs media`
          : rendimientoVsMedia <= -15
          ? `${rendimientoVsMedia}% vs media`
          : "En la media";

      const topSecs = Array.from(a.sectorsMap.values())
        .map((s) => ({
          sector: s.sector,
          jornadas: s.jornadas,
          solicitudes: s.sol,
          instalaciones: s.matched, // convertidas reales
          conversionRate:
            s.sol > 0 ? Math.round((s.matched / s.sol) * 1000) / 10 : 0,
          mediaDiariaZona: s.mediaDiaria,
        }))
        .sort((x, y) => y.solicitudes - x.solicitudes || y.jornadas - x.jornadas)
        .slice(0, 4);

      return {
        name: a.name,
        normName: a.normName,
        totalJornadas: a.jornadasCount,
        solicitudesCount: solsCount,
        instalacionesCount: matchedSols,
        totalInstalacionesZona: a.insts.length,
        conversionRate: convRate,
        mediaDiariaZonas,
        solicitudesEsperadas,
        rendimientoVsMedia,
        impactoLabel,
        topSectors: topSecs,
      };
    })
    .sort(
      (x, y) =>
        y.solicitudesCount - x.solicitudesCount ||
        y.instalacionesCount - x.instalacionesCount ||
        y.totalJornadas - x.totalJornadas
    );

  const risingSectorsCount = sectorsHealth.filter((s) => s.trend === "ascenso").length;
  const decliningSectorsCount = sectorsHealth.filter((s) => s.trend === "declive").length;
  const bottleneckSectorsCount = sectorsHealth.filter((s) => s.trend === "cuello_botella").length;
  const totalJornadas = planRecords.length;
  const instPerJornada =
    totalJornadas > 0 ? Math.round((matchedCount / totalJornadas) * 10) / 10 : 0;

  const expectedGlobalSols = Math.round(mediaDiariaGlobalSolicitudes * Math.max(1, totalJornadas));
  const rendimientoGlobalVsMedia =
    expectedGlobalSols > 0
      ? Math.round(((totalSolicitudes - expectedGlobalSols) / expectedGlobalSols) * 100)
      : 0;

  const rendimientoGlobalLabel =
    rendimientoGlobalVsMedia >= 15
      ? `+${rendimientoGlobalVsMedia}% vs media histórica`
      : rendimientoGlobalVsMedia <= -15
      ? `${rendimientoGlobalVsMedia}% vs media histórica`
      : "En la media histórica esperada";

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
      mediaDiariaGlobalSolicitudes,
      mediaDiariaGlobalInstalaciones,
      rendimientoGlobalVsMedia,
      rendimientoGlobalLabel,
      risingSectorsCount,
      decliningSectorsCount,
      bottleneckSectorsCount,
    },
    sectorsHealth,
    activitiesEffectiveness,
    advisorsYield,
  };
}
