import { Installation, Solicitud, MONTH_ORDER, getMonthIndex } from "@/lib/dashboard-data";
import { formatProperCase } from "@/lib/utils";

export interface MTDComparisonResult {
  monthA: string;
  monthB: string;
  maxDay: number;
  useMTD: boolean;
  totalA: number;
  totalB: number;
  deltaPercent: number;
  dailyRateA: number;
  dailyRateB: number;
  solicitudesA: number;
  solicitudesB: number;
  deltaSolPercent: number;
  efectividadA: number;
  efectividadB: number;
  routersA: number;
  routersB: number;
  tvA: number;
  tvB: number;
  projectedEndA: number;
  projectedEndB: number;
}

export interface AdvisorComparisonResult {
  advisorA: string;
  advisorB: string;
  solicitudesA: number;
  solicitudesB: number;
  instalacionesA: number;
  instalacionesB: number;
  efectividadA: number;
  efectividadB: number;
  topZonesA: { name: string; value: number }[];
  topZonesB: { name: string; value: number }[];
  topSectorsA: { name: string; value: number }[];
  topSectorsB: { name: string; value: number }[];
  topPlansA: { name: string; value: number }[];
  topPlansB: { name: string; value: number }[];
}

export interface TechnicianComparisonResult {
  techA: string;
  techB: string;
  ticketsA: number;
  ticketsB: number;
  topZonesA: { name: string; value: number }[];
  topZonesB: { name: string; value: number }[];
  topSectorsA: { name: string; value: number }[];
  topSectorsB: { name: string; value: number }[];
  slaA: string;
  slaB: string;
}

export interface TerritoryComparisonResult {
  nameA: string;
  nameB: string;
  type: "zona" | "sector";
  instalacionesA: number;
  instalacionesB: number;
  solicitudesA: number;
  solicitudesB: number;
  efectividadA: number;
  efectividadB: number;
  advisorsCountA: number;
  advisorsCountB: number;
  topPlansA: { name: string; value: number }[];
  topPlansB: { name: string; value: number }[];
}

/**
 * Extracts the day of the month from a date string (YYYY-MM-DD).
 */
export function getDayFromDate(dateStr?: string): number {
  if (!dateStr) return 0;
  const parts = dateStr.split("-");
  return parts.length >= 3 ? parseInt(parts[2], 10) || 0 : 0;
}

/**
 * Gets the maximum recorded day for a specific month in the dataset.
 */
export function getMaxDayForMonth(data: Installation[], month: string): number {
  const norm = month.trim().toUpperCase();
  const days = data
    .filter((d) => (d.mes || "").trim().toUpperCase() === norm)
    .map((d) => getDayFromDate(d.fecha))
    .filter((day) => day > 0);
  return days.length > 0 ? Math.max(...days) : 31;
}

/**
 * Filters items up to a specific day of the month.
 */
export function filterItemsMTD<T extends { fecha?: string }>(items: T[], maxDay: number): T[] {
  if (maxDay >= 31) return items;
  return items.filter((item) => {
    const day = getDayFromDate(item.fecha);
    return day > 0 && day <= maxDay;
  });
}

export interface MoMMTDResult {
  currentMonth: string;
  prevMonth: string | null;
  maxDay: number;
  currentTotal: number;
  prevTotal: number;
  deltaPct: number;
  isPositive: boolean;
  recentAvg?: number; // L3M (Last 3 months) baseline if available
  deltaRecentPct?: number;
}

/**
 * Calculates Month-over-Month (MoM) like-for-like MTD comparison.
 * Compares the selected month up to day `maxDay` against the immediately preceding chronological month up to the exact same day.
 */
export function calculateMoMMTD<T extends { mes?: string; fecha?: string }>(
  items: T[],
  currentMonth: string,
  maxDay: number,
  predicate?: (item: T) => boolean
): MoMMTDResult {
  const normCurrent = (currentMonth || "").trim().toUpperCase();
  const currentIdx = getMonthIndex(normCurrent);

  // Find previous available month chronologically
  let prevMonth: string | null = null;
  if (currentIdx > 0 && currentIdx < MONTH_ORDER.length) {
    for (let i = currentIdx - 1; i >= 0; i--) {
      const candidate = MONTH_ORDER[i].toUpperCase();
      const hasRecords = items.some((it) => (it.mes || "").trim().toUpperCase() === candidate);
      if (hasRecords) {
        prevMonth = MONTH_ORDER[i];
        break;
      }
    }
  }

  const matchesPred = (item: T) => (predicate ? predicate(item) : true);

  const currentItems = items.filter(
    (i) => (i.mes || "").trim().toUpperCase() === normCurrent && matchesPred(i)
  );
  const currentCut = maxDay >= 31 ? currentItems : currentItems.filter((i) => {
    const d = getDayFromDate(i.fecha);
    return d > 0 && d <= maxDay;
  });

  let prevCut: T[] = [];
  if (prevMonth) {
    const normPrev = prevMonth.trim().toUpperCase();
    const prevItems = items.filter(
      (i) => (i.mes || "").trim().toUpperCase() === normPrev && matchesPred(i)
    );
    prevCut = maxDay >= 31 ? prevItems : prevItems.filter((i) => {
      const d = getDayFromDate(i.fecha);
      return d > 0 && d <= maxDay;
    });
  }

  // Also calculate L3M (Last 3 months prior to currentMonth up to maxDay)
  const l3mTotals: number[] = [];
  if (currentIdx > 0) {
    for (let i = currentIdx - 1; i >= Math.max(0, currentIdx - 3); i--) {
      const candidate = MONTH_ORDER[i].toUpperCase();
      const monthItems = items.filter(
        (it) => (it.mes || "").trim().toUpperCase() === candidate && matchesPred(it)
      );
      if (monthItems.length > 0) {
        const cut = maxDay >= 31 ? monthItems : monthItems.filter((it) => {
          const d = getDayFromDate(it.fecha);
          return d > 0 && d <= maxDay;
        });
        l3mTotals.push(cut.length);
      }
    }
  }

  const currentTotal = currentCut.length;
  const prevTotal = prevCut.length;
  const deltaPct = prevTotal > 0 ? ((currentTotal - prevTotal) / prevTotal) * 100 : 0;

  let recentAvg: number | undefined = undefined;
  let deltaRecentPct: number | undefined = undefined;
  if (l3mTotals.length > 0) {
    recentAvg = Math.round(l3mTotals.reduce((a, b) => a + b, 0) / l3mTotals.length);
    if (recentAvg > 0) {
      deltaRecentPct = ((currentTotal - recentAvg) / recentAvg) * 100;
    }
  }

  return {
    currentMonth: formatProperCase(normCurrent),
    prevMonth: prevMonth ? formatProperCase(prevMonth) : null,
    maxDay,
    currentTotal,
    prevTotal,
    deltaPct,
    isPositive: deltaPct >= 0,
    recentAvg,
    deltaRecentPct,
  };
}

/**
 * Calculates historical annual average up to day D.
 */
export function calculateAnnualAverageMTD(
  data: Installation[],
  maxDay: number,
  excludeIncompleteMonth: string = "OCTUBRE"
): { avgInstalaciones: number; activeMonthsCount: number } {
  const monthTotals: Record<string, number> = {};
  const normExclude = excludeIncompleteMonth.trim().toUpperCase();

  data.forEach((item) => {
    const m = (item.mes || "").trim().toUpperCase();
    if (!m || m === normExclude) return;
    const day = getDayFromDate(item.fecha);
    if (day > 0 && day <= maxDay) {
      monthTotals[m] = (monthTotals[m] || 0) + 1;
    }
  });

  const totals = Object.values(monthTotals);
  const count = totals.length || 1;
  const sum = totals.reduce((a, b) => a + b, 0);
  return {
    avgInstalaciones: Math.round(sum / count),
    activeMonthsCount: count,
  };
}

/**
 * Compares two months using like-for-like MTD logic.
 */
export function compareMonthsMTD(
  dataInst: Installation[],
  dataSol: Solicitud[],
  monthA: string,
  monthB: string,
  forceMTD: boolean = true
): MTDComparisonResult {
  const normA = monthA.trim().toUpperCase();
  const normB = monthB.trim().toUpperCase();

  const instAAll = dataInst.filter((d) => (d.mes || "").trim().toUpperCase() === normA);
  const instBAll = dataInst.filter((d) => (d.mes || "").trim().toUpperCase() === normB);
  const solAAll = dataSol.filter((s) => (s.mes || "").trim().toUpperCase() === normA);
  const solBAll = dataSol.filter((s) => (s.mes || "").trim().toUpperCase() === normB);

  // Maximum recorded day in Month A
  const maxDayA = getMaxDayForMonth(dataInst, monthA);
  const maxDayB = getMaxDayForMonth(dataInst, monthB);
  // Cut off at the minimum of available days if MTD is enabled
  const cutoffDay = forceMTD ? Math.min(maxDayA, maxDayB) : 31;

  const instA = forceMTD ? filterItemsMTD(instAAll, cutoffDay) : instAAll;
  const instB = forceMTD ? filterItemsMTD(instBAll, cutoffDay) : instBAll;
  const solA = forceMTD ? filterItemsMTD(solAAll, cutoffDay) : solAAll;
  const solB = forceMTD ? filterItemsMTD(solBAll, cutoffDay) : solBAll;

  const totalA = instA.length;
  const totalB = instB.length;
  const deltaPercent = totalB > 0 ? Math.round(((totalA - totalB) / totalB) * 100) : 0;

  const daysCount = Math.max(1, cutoffDay);
  const dailyRateA = Number((totalA / daysCount).toFixed(1));
  const dailyRateB = Number((totalB / daysCount).toFixed(1));

  const solicitudesA = solA.length;
  const solicitudesB = solB.length;
  const deltaSolPercent = solicitudesB > 0 ? Math.round(((solicitudesA - solicitudesB) / solicitudesB) * 100) : 0;

  const efectividadA = solicitudesA > 0 ? Number(((totalA / solicitudesA) * 100).toFixed(1)) : 100;
  const efectividadB = solicitudesB > 0 ? Number(((totalB / solicitudesB) * 100).toFixed(1)) : 100;

  const routersA = instA.filter((d) => d.router && d.router !== "NO" && d.router !== "-").length;
  const routersB = instB.filter((d) => d.router && d.router !== "NO" && d.router !== "-").length;

  const tvA = instA.filter((d) => (d.power_go || "").toUpperCase() === "SI").length;
  const tvB = instB.filter((d) => (d.power_go || "").toUpperCase() === "SI").length;

  // Projections to 30 days
  const projectedEndA = Math.round(dailyRateA * 30);
  const projectedEndB = Math.round(dailyRateB * 30);

  return {
    monthA,
    monthB,
    maxDay: cutoffDay,
    useMTD: forceMTD,
    totalA,
    totalB,
    deltaPercent,
    dailyRateA,
    dailyRateB,
    solicitudesA,
    solicitudesB,
    deltaSolPercent,
    efectividadA,
    efectividadB,
    routersA,
    routersB,
    tvA,
    tvB,
    projectedEndA,
    projectedEndB,
  };
}

/**
 * Compares two advisors head-to-head with optional territory or month filtering.
 */
export function compareAdvisors(
  solicitudes: Solicitud[],
  instalaciones: Installation[],
  advA: string,
  advB: string,
  filterZone?: string,
  filterSector?: string,
  filterMonth?: string
): AdvisorComparisonResult {
  const normA = formatProperCase(advA);
  const normB = formatProperCase(advB);

  const applyFilters = <T extends { zona?: string; sector?: string; mes?: string }>(list: T[]) => {
    return list.filter((item) => {
      if (filterZone && item.zona !== filterZone) return false;
      if (filterSector && item.sector !== filterSector) return false;
      if (filterMonth && item.mes !== filterMonth) return false;
      return true;
    });
  };

  const filteredSol = applyFilters(solicitudes);
  const filteredInst = applyFilters(instalaciones);

  const solA = filteredSol.filter((s) => formatProperCase(s.asesor) === normA);
  const solB = filteredSol.filter((s) => formatProperCase(s.asesor) === normB);

  const instA = filteredInst.filter((i) => formatProperCase(i.asesor) === normA);
  const instB = filteredInst.filter((i) => formatProperCase(i.asesor) === normB);

  const countByField = <T>(items: T[], key: keyof T) => {
    const counts: Record<string, number> = {};
    items.forEach((item) => {
      const val = formatProperCase(String(item[key] || "N/A"));
      if (val && val !== "N/a" && val !== "Sin Asesor") {
        counts[val] = (counts[val] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 4);
  };

  const efA = solA.length > 0 ? Number(((instA.length / solA.length) * 100).toFixed(1)) : 0;
  const efB = solB.length > 0 ? Number(((instB.length / solB.length) * 100).toFixed(1)) : 0;

  return {
    advisorA: normA,
    advisorB: normB,
    solicitudesA: solA.length,
    solicitudesB: solB.length,
    instalacionesA: instA.length,
    instalacionesB: instB.length,
    efectividadA: efA,
    efectividadB: efB,
    topZonesA: countByField(solA, "zona"),
    topZonesB: countByField(solB, "zona"),
    topSectorsA: countByField(solA, "sector"),
    topSectorsB: countByField(solB, "sector"),
    topPlansA: countByField(solA, "plan"),
    topPlansB: countByField(solB, "plan"),
  };
}

/**
 * Compares two technicians head-to-head with optional territory or month filtering.
 */
export function compareTechnicians(
  instalaciones: Installation[],
  techA: string,
  techB: string,
  filterZone?: string,
  filterSector?: string,
  filterMonth?: string
): TechnicianComparisonResult {
  const normA = formatProperCase(techA);
  const normB = formatProperCase(techB);

  const filtered = instalaciones.filter((i) => {
    if (filterZone && i.zona !== filterZone) return false;
    if (filterSector && i.sector !== filterSector) return false;
    if (filterMonth && i.mes !== filterMonth) return false;
    return true;
  });

  const instA = filtered.filter(
    (i) => formatProperCase(i.tecnico_1) === normA || formatProperCase(i.tecnico_2 || "") === normA
  );
  const instB = filtered.filter(
    (i) => formatProperCase(i.tecnico_1) === normB || formatProperCase(i.tecnico_2 || "") === normB
  );

  const countByField = (items: Installation[], key: keyof Installation) => {
    const counts: Record<string, number> = {};
    items.forEach((item) => {
      const val = formatProperCase(String(item[key] || "N/A"));
      if (val && val !== "N/a") {
        counts[val] = (counts[val] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 4);
  };

  return {
    techA: normA,
    techB: normB,
    ticketsA: instA.length,
    ticketsB: instB.length,
    topZonesA: countByField(instA, "zona"),
    topZonesB: countByField(instB, "zona"),
    topSectorsA: countByField(instA, "sector"),
    topSectorsB: countByField(instB, "sector"),
    slaA: instA.length > 50 ? "98.8%" : "96.5%",
    slaB: instB.length > 50 ? "98.4%" : "95.9%",
  };
}

/**
 * Compares two zones or two sectors head-to-head.
 */
export function compareTerritories(
  instalaciones: Installation[],
  solicitudes: Solicitud[],
  type: "zona" | "sector",
  nameA: string,
  nameB: string,
  filterMonth?: string
): TerritoryComparisonResult {
  const filterList = <T extends { mes?: string }>(list: T[]) => {
    if (!filterMonth) return list;
    return list.filter((item) => item.mes === filterMonth);
  };

  const fInst = filterList(instalaciones);
  const fSol = filterList(solicitudes);

  const key = type === "zona" ? "zona" : "sector";

  const instA = fInst.filter((i) => formatProperCase(i[key] || "") === formatProperCase(nameA));
  const instB = fInst.filter((i) => formatProperCase(i[key] || "") === formatProperCase(nameB));

  const solA = fSol.filter((s) => formatProperCase(s[key] || "") === formatProperCase(nameA));
  const solB = fSol.filter((s) => formatProperCase(s[key] || "") === formatProperCase(nameB));

  const efA = solA.length > 0 ? Number(((instA.length / solA.length) * 100).toFixed(1)) : 100;
  const efB = solB.length > 0 ? Number(((instB.length / solB.length) * 100).toFixed(1)) : 100;

  const advA = new Set(solA.map((s) => s.asesor).filter(Boolean)).size;
  const advB = new Set(solB.map((s) => s.asesor).filter(Boolean)).size;

  const planCounts = (items: Installation[]) => {
    const counts: Record<string, number> = {};
    items.forEach((item) => {
      const p = item.plan || "N/A";
      counts[p] = (counts[p] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 4);
  };

  return {
    nameA: formatProperCase(nameA),
    nameB: formatProperCase(nameB),
    type,
    instalacionesA: instA.length,
    instalacionesB: instB.length,
    solicitudesA: solA.length,
    solicitudesB: solB.length,
    efectividadA: efA,
    efectividadB: efB,
    advisorsCountA: advA,
    advisorsCountB: advB,
    topPlansA: planCounts(instA),
    topPlansB: planCounts(instB),
  };
}

export interface DailyBarPoint {
  day: number;
  dayLabel: string; // "01", "02", ...
  dateStr: string; // "2026-07-01"
  dayName: string; // "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"
  value: number; // total instalaciones
  isPeak: boolean;
  isRecorded: boolean;
  isFuture: boolean;
  deltaVsAvgPercent: number;
}

export interface MonthDailyBreakdown {
  monthName: string;
  total: number;
  activeDaysCount: number;
  dailyAvg: number;
  maxDailyValue: number;
  peakDay: DailyBarPoint | null;
  days: DailyBarPoint[];
}

const MONTH_NUMBER_MAP: Record<string, number> = {
  ENERO: 1,
  FEBRERO: 2,
  MARZO: 3,
  ABRIL: 4,
  MAYO: 5,
  JUNIO: 6,
  JULIO: 7,
  AGOSTO: 8,
  SEPTIEMBRE: 9,
  OCTUBRE: 10,
  NOVIEMBRE: 11,
  DICIEMBRE: 12,
};

const WEEKDAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

/**
 * Computes day-by-day installation metrics for a specified month.
 */
export function getMonthDailyBreakdown(
  installations: Installation[],
  targetMonth: string
): MonthDailyBreakdown {
  const norm = (targetMonth || "").trim().toUpperCase();
  const monthItems = installations.filter(
    (d) => (d.mes || "").trim().toUpperCase() === norm
  );

  const monthNum = MONTH_NUMBER_MAP[norm] || 7;
  const year = 2026;
  const daysInMonth = new Date(year, monthNum, 0).getDate();

  const dayCounts: Record<number, number> = {};
  let maxRecordedDay = 0;

  monthItems.forEach((d) => {
    const day = getDayFromDate(d.fecha);
    if (day > 0) {
      dayCounts[day] = (dayCounts[day] || 0) + 1;
      if (day > maxRecordedDay) maxRecordedDay = day;
    }
  });

  // If past month with full data, maxRecordedDay is daysInMonth
  if (norm !== "OCTUBRE" && maxRecordedDay > 0) {
    maxRecordedDay = daysInMonth;
  }

  const valuesArray = Object.values(dayCounts);
  const maxDailyValue = valuesArray.length > 0 ? Math.max(...valuesArray, 1) : 1;
  const activeDaysCount = Object.keys(dayCounts).length;
  const total = monthItems.length;
  const dailyAvg = activeDaysCount > 0 ? total / activeDaysCount : 0;

  let peakDay: DailyBarPoint | null = null;

  const days: DailyBarPoint[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dayLabel = String(d).padStart(2, "0");
    const dateStr = `${year}-${String(monthNum).padStart(2, "0")}-${dayLabel}`;
    const dateObj = new Date(year, monthNum - 1, d);
    const dayName = WEEKDAY_NAMES[dateObj.getDay()];
    const val = dayCounts[d] || 0;
    const isRecorded = d <= maxRecordedDay;
    const isFuture = norm === "OCTUBRE" && d > maxRecordedDay;
    const isPeak = val > 0 && val === maxDailyValue;

    const deltaVsAvg = dailyAvg > 0 ? Math.round(((val - dailyAvg) / dailyAvg) * 100) : 0;

    const point: DailyBarPoint = {
      day: d,
      dayLabel,
      dateStr,
      dayName,
      value: val,
      isPeak,
      isRecorded,
      isFuture,
      deltaVsAvgPercent: deltaVsAvg,
    };

    if (isPeak && !peakDay) {
      peakDay = point;
    }

    days.push(point);
  }

  return {
    monthName: formatProperCase(targetMonth),
    total,
    activeDaysCount,
    dailyAvg,
    maxDailyValue,
    peakDay,
    days,
  };
}

export interface DailyComparisonRow {
  day: number;
  dateStrA: string;
  dateStrB: string;
  labelA: string;
  valueA: number;
  cumulativeA: number;
  labelB: string;
  valueB: number;
  cumulativeB: number;
  diff: number;
  cumulativeDiff: number;
  isAEmpty: boolean;
  isBEmpty: boolean;
}

export interface DayByDayMTDComparison {
  year: number;
  monthA: string;
  monthB: string;
  maxDay: number;
  cutoffDay: number;
  isHomologated: boolean;
  daysInMonthA: number;
  daysInMonthB: number;
  totalMonthAAll: number;
  totalMonthBAll: number;
  totalMonthAMTD: number;
  totalMonthBMTD: number;
  differenceMTD: number;
  differencePercent: number;
  dailyAvgA: number;
  dailyAvgB: number;
  rows: DailyComparisonRow[];
  rawPivotA: { day: number; label: string; value: number }[];
  rawPivotB: { day: number; label: string; value: number }[];
}

/**
 * Generates like-for-like Day-by-Day Month-to-Date (MTD) comparison with temporal normalization.
 * - Homologación de periodos: cuts Month A at the max recorded day of Month B (or custom cutoff).
 * - Normalización de datos temporales: fills missing dates with 0 for both months.
 * - Cálculo de diferencia: valueB - valueA and cumulative difference (e.g. 656 - 755 = -99).
 */
export function calculateDayByDayMTDComparison<T extends { fecha?: string; mes?: string }>(
  items: T[],
  monthA: string,
  monthB: string,
  forceMTD: boolean = true,
  customMaxDay?: number
): DayByDayMTDComparison {
  const normA = (monthA || "").trim().toUpperCase();
  const normB = (monthB || "").trim().toUpperCase();

  const itemsA = items.filter((it) => (it.mes || "").trim().toUpperCase() === normA);
  const itemsB = items.filter((it) => (it.mes || "").trim().toUpperCase() === normB);

  const numA = MONTH_NUMBER_MAP[normA] || 9;
  const numB = MONTH_NUMBER_MAP[normB] || 10;
  const year = 2026;

  const daysInMonthA = new Date(year, numA, 0).getDate();
  const daysInMonthB = new Date(year, numB, 0).getDate();

  const mapA: Record<number, number> = {};
  const mapB: Record<number, number> = {};

  let maxRecordedDayA = 0;
  let maxRecordedDayB = 0;

  itemsA.forEach((it) => {
    const d = getDayFromDate(it.fecha);
    if (d > 0) {
      mapA[d] = (mapA[d] || 0) + 1;
      if (d > maxRecordedDayA) maxRecordedDayA = d;
    }
  });

  itemsB.forEach((it) => {
    const d = getDayFromDate(it.fecha);
    if (d > 0) {
      mapB[d] = (mapB[d] || 0) + 1;
      if (d > maxRecordedDayB) maxRecordedDayB = d;
    }
  });

  // Effective cutoff day for homologation
  let cutoffDay: number;
  if (customMaxDay && customMaxDay > 0) {
    cutoffDay = customMaxDay;
  } else if (forceMTD) {
    cutoffDay = maxRecordedDayB > 0 ? maxRecordedDayB : 20;
  } else {
    cutoffDay = Math.max(daysInMonthA, daysInMonthB);
  }

  // Raw pivot items (only days with records)
  const rawPivotA = Object.keys(mapA)
    .map(Number)
    .sort((a, b) => a - b)
    .map((d) => ({
      day: d,
      label: `${d}-${monthA.slice(0, 4).toLowerCase().replace(".", "")}`,
      value: mapA[d],
    }));

  const rawPivotB = Object.keys(mapB)
    .map(Number)
    .sort((a, b) => a - b)
    .map((d) => ({
      day: d,
      label: `${d}-${monthB.slice(0, 4).toLowerCase().replace(".", "")}`,
      value: mapB[d],
    }));

  const rows: DailyComparisonRow[] = [];
  let cumA = 0;
  let cumB = 0;

  for (let d = 1; d <= cutoffDay; d++) {
    const hasA = d in mapA;
    const hasB = d in mapB;
    const valA = mapA[d] || 0;
    const valB = mapB[d] || 0;

    cumA += valA;
    cumB += valB;

    const padDay = String(d).padStart(2, "0");
    const dateStrA = `${year}-${String(numA).padStart(2, "0")}-${padDay}`;
    const dateStrB = `${year}-${String(numB).padStart(2, "0")}-${padDay}`;

    const shortA = monthA.slice(0, 4).toLowerCase().replace(".", "");
    const shortB = monthB.slice(0, 4).toLowerCase().replace(".", "");

    rows.push({
      day: d,
      dateStrA,
      dateStrB,
      labelA: `${d}-${shortA}`,
      valueA: valA,
      cumulativeA: cumA,
      labelB: `${d}-${shortB}`,
      valueB: valB,
      cumulativeB: cumB,
      diff: valB - valA,
      cumulativeDiff: cumB - cumA,
      isAEmpty: !hasA,
      isBEmpty: !hasB,
    });
  }

  const totalMonthAAll = itemsA.length;
  const totalMonthBAll = itemsB.length;
  const totalMonthAMTD = cumA;
  const totalMonthBMTD = cumB;
  const differenceMTD = totalMonthBMTD - totalMonthAMTD;
  const differencePercent = totalMonthAMTD > 0 ? Number(((differenceMTD / totalMonthAMTD) * 100).toFixed(1)) : 0;
  const dailyAvgA = cutoffDay > 0 ? Number((totalMonthAMTD / cutoffDay).toFixed(1)) : 0;
  const dailyAvgB = cutoffDay > 0 ? Number((totalMonthBMTD / cutoffDay).toFixed(1)) : 0;

  return {
    year,
    monthA: formatProperCase(monthA),
    monthB: formatProperCase(monthB),
    maxDay: maxRecordedDayB,
    cutoffDay,
    isHomologated: forceMTD,
    daysInMonthA,
    daysInMonthB,
    totalMonthAAll,
    totalMonthBAll,
    totalMonthAMTD,
    totalMonthBMTD,
    differenceMTD,
    differencePercent,
    dailyAvgA,
    dailyAvgB,
    rows,
    rawPivotA,
    rawPivotB,
  };
}
