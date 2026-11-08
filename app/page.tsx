"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { GitCompareArrows, RotateCw, ArrowDownToLine, BellRing, Menu } from "lucide-react";

import {
  fetchInstallations,
  fetchRawOperationalData,
  calculateAdvancedMetrics,
  clearDashboardDataCache,
  Installation,
  Solicitud,
  getMonthIndex,
  MONTH_ORDER,
} from "@/lib/dashboard-data";
import {
  getKPISummaryCache,
  setKPISummaryCache,
  CachedKPISummary,
} from "@/lib/client-cache";
import { getTvLabel } from "@/app/admin/settings-actions";
import { cn, formatNumber, formatProperCase, isInstalacionStatus, isNuevoServicioStatus } from "@/lib/utils";
import { calculateMoMMTD, calculateAnnualAverageMTD, getMaxDayForMonth, getDayFromDate } from "@/lib/analytics-comparison";

import { Sidebar } from "@/components/dashboard/sidebar";
import { SidebarOpenButton } from "@/components/providers/sidebar-provider";
import { KPICard } from "@/components/dashboard/kpi-card";
import { FilterCommandBar, FilterState } from "@/components/dashboard/filter-command-bar";
import { ComparisonModal } from "@/components/dashboard/comparison-modal";
import { SalesTrendBarChart } from "@/components/dashboard/sales-trend-bar-chart";
import { SalesByRegionCard } from "@/components/dashboard/sales-by-region-card";
import { SectorsCard } from "@/components/dashboard/sectors-card";
import { TechniciansCard } from "@/components/dashboard/technicians-card";
import { ConnectionTypeCard } from "@/components/dashboard/connection-type-card";
import { PlansCard } from "@/components/dashboard/plans-card";
import { PersonalBreakdownCard } from "@/components/dashboard/personal-breakdown-card";
import { AdvisorConfigModal, PersonnelTab } from "@/components/dashboard/advisor-config-modal";
import {
  AdvisorOverridesMap,
  TechnicianOverridesMap,
  classifyAdvisor,
  resolveAdvisorOffice,
} from "@/lib/normalization";

export function getCurrentSpanishMonth(): string {
  const currentMonthIdx = new Date().getMonth();
  return MONTH_ORDER[currentMonthIdx] || "Noviembre";
}

const INITIAL_FILTERS: FilterState = {
  advisors: [],
  zones: [],
  statuses: [],
  months: [getCurrentSpanishMonth()],
  sectors: [],
  technicians: [],
  oficinas: [],
  plans: [],
  dateFrom: "",
  dateTo: "",
  resetKey: 0,
};

// Client module-level cache for instantaneous panel transitions
let cachedRawData: Installation[] = [];
let cachedRawSolicitudes: Solicitud[] = [];
let cachedTvLabel = "TV / Servicios";
let hasLoadedDashboard = false;

export default function DashboardPage() {
  const router = useRouter();
  const [kpiSummary, setKpiSummary] = useState<CachedKPISummary | null>(null);
  const [rawData, setRawData] = useState<Installation[]>(() => cachedRawData);
  const [rawSolicitudes, setRawSolicitudes] = useState<Solicitud[]>(() => cachedRawSolicitudes);
  const [loading, setLoading] = useState(!hasLoadedDashboard && !cachedRawData.length);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [tvLabel, setTvLabel] = useState(() => cachedTvLabel);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [comparisonModalOpen, setComparisonModalOpen] = useState(false);
  const [isTrendExpanded, setIsTrendExpanded] = useState(false);
  const [trendViewMode, setTrendViewMode] = useState<"monthly" | "daily" | "mtdComparison">("monthly");
  const [activeSection, setActiveSection] = useState("principal");
  const [advisorConfigOpen, setAdvisorConfigOpen] = useState(false);
  const [configInitialTab, setConfigInitialTab] = useState<PersonnelTab>("asesores");
  const [advisorOverrides, setAdvisorOverrides] = useState<AdvisorOverridesMap>({});
  const [advisorAliases, setAdvisorAliases] = useState<Record<string, string>>({});
  const [techOverrides, setTechOverrides] = useState<TechnicianOverridesMap>({});
  const [techAliases, setTechAliases] = useState<Record<string, string>>({});

  // Restore cached KPI summary safely strictly after client mount (prevents SSR hydration mismatch)
  useEffect(() => {
    const cached = getKPISummaryCache();
    if (cached) {
      setKpiSummary(cached);
    }
  }, []);

  // Filter State
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);

  const loadData = useCallback(async (
    isRefresh = false,
    explicitOverrides?: AdvisorOverridesMap,
    explicitAliases?: Record<string, string>,
    explicitTechOverrides?: TechnicianOverridesMap,
    explicitTechAliases?: Record<string, string>
  ) => {
    if (isRefresh) {
      setRefreshing(true);
      clearDashboardDataCache();
    } else if (!hasLoadedDashboard && !cachedRawData.length) {
      setLoading(true);
    }

    try {
      let activeOverrides = explicitOverrides;
      let activeAliases = explicitAliases;
      let activeTechOverrides = explicitTechOverrides;
      let activeTechAliases = explicitTechAliases;

      // Always fetch fresh authoritative personnel & advisor configuration from server
      if (!activeOverrides || !activeAliases || !activeTechOverrides || !activeTechAliases) {
        try {
          const cfgRes = await fetch(`/api/advisors/config?t=${Date.now()}`, {
            cache: "no-store",
            headers: { "Cache-Control": "no-cache" },
          });
          const cfgData = await cfgRes.json();
          if (cfgData && cfgData.success) {
            activeOverrides = cfgData.overrides || {};
            activeAliases = cfgData.aliases || {};
            activeTechOverrides = cfgData.technicianOverrides || {};
            activeTechAliases = cfgData.technicianAliases || {};

            if (typeof window !== "undefined") {
              try {
                localStorage.setItem("buildly_advisor_overrides", JSON.stringify(activeOverrides));
                localStorage.setItem("buildly_advisor_aliases", JSON.stringify(activeAliases));
                localStorage.setItem("buildly_tech_overrides", JSON.stringify(activeTechOverrides));
                localStorage.setItem("buildly_tech_aliases", JSON.stringify(activeTechAliases));
              } catch (e) {}
            }
          }
        } catch (e) {
          // Fallback to local storage only if network / server fails
          if (typeof window !== "undefined") {
            try {
              const o = localStorage.getItem("buildly_advisor_overrides");
              const a = localStorage.getItem("buildly_advisor_aliases");
              const to = localStorage.getItem("buildly_tech_overrides");
              const ta = localStorage.getItem("buildly_tech_aliases");
              if (o) activeOverrides = JSON.parse(o);
              if (a) activeAliases = JSON.parse(a);
              if (to) activeTechOverrides = JSON.parse(to);
              if (ta) activeTechAliases = JSON.parse(ta);
            } catch (err) {}
          }
        }
      }

      if (activeOverrides) setAdvisorOverrides(activeOverrides);
      if (activeAliases) setAdvisorAliases(activeAliases);
      if (activeTechOverrides) setTechOverrides(activeTechOverrides);
      if (activeTechAliases) setTechAliases(activeTechAliases);

      // Fetch operational dataset and TV label concurrently (all API queries in parallel)
      const [operationalResult, tvLab] = await Promise.all([
        fetchRawOperationalData(activeOverrides, activeAliases, activeTechOverrides, activeTechAliases, isRefresh),
        getTvLabel(),
      ]);

      if (operationalResult && operationalResult.installations) {
        cachedRawData = operationalResult.installations || [];
        cachedRawSolicitudes = operationalResult.solicitudes || [];
        setRawData(cachedRawData);
        setRawSolicitudes(cachedRawSolicitudes);
        if (operationalResult.activeTechOverrides) {
          setTechOverrides(operationalResult.activeTechOverrides);
        }

        // Save fresh summary to LocalStorage for instant 0ms startup next time
        try {
          const m = calculateAdvancedMetrics(cachedRawData, cachedRawData, cachedRawSolicitudes);
          const freshSummary: CachedKPISummary = {
            totalInstalaciones: cachedRawData.length,
            totalSolicitudes: cachedRawSolicitudes.length,
            nuevosServicios: m.counters?.nuevosServicios || 0,
            routerCount: m.counters?.routerCount || 0,
            powerGoCount: m.counters?.powerGoCount || 0,
            topAsesor: m.counters?.topAsesor || "N/A",
            maxVentas: m.counters?.maxVentas || 0,
            timestamp: Date.now(),
          };
          setKPISummaryCache(freshSummary);
          setKpiSummary(freshSummary);
        } catch {}
      }

      if (tvLab) {
        cachedTvLabel = tvLab;
        setTvLabel(tvLab);
      }
      hasLoadedDashboard = true;
    } catch (error) {
      console.error("Failed to load data", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Global Keyboard Shortcuts (⌘B / Ctrl+B for Compare, ⌘K / Ctrl+K for Palette)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setComparisonModalOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Filter Logic for Cuadro Diario without month and without date (used for trend charts)
  const filteredDataWithoutMonthOrDate = useMemo(() => {
    return rawData.filter((item) => {
      const matchAdvisor = filters.advisors.length === 0 || filters.advisors.includes(item.asesor);
      const matchZone = filters.zones.length === 0 || filters.zones.includes(item.zona);
      const matchStatus = filters.statuses.length === 0 || filters.statuses.includes(item.estatus);
      const matchSector = filters.sectors.length === 0 || filters.sectors.includes(item.sector);
      const matchPlan = !filters.plans || filters.plans.length === 0 || filters.plans.includes(item.plan);
      const matchTechnician =
        filters.technicians.length === 0 ||
        filters.technicians.includes(item.tecnico_1) ||
        filters.technicians.includes(item.tecnico_2 || "");
      const matchOficina = filters.oficinas.length === 0 || filters.oficinas.includes(item.oficina);

      return (
        matchAdvisor &&
        matchZone &&
        matchStatus &&
        matchSector &&
        matchPlan &&
        matchTechnician &&
        matchOficina
      );
    });
  }, [rawData, filters.advisors, filters.zones, filters.statuses, filters.sectors, filters.plans, filters.technicians, filters.oficinas]);

  // Filter Logic for Cuadro Diario (Instalaciones Realizadas)
  const filteredDataWithoutMonth = useMemo(() => {
    return rawData.filter((item) => {
      const matchAdvisor = filters.advisors.length === 0 || filters.advisors.includes(item.asesor);
      const matchZone = filters.zones.length === 0 || filters.zones.includes(item.zona);
      const matchStatus = filters.statuses.length === 0 || filters.statuses.includes(item.estatus);
      const matchSector = filters.sectors.length === 0 || filters.sectors.includes(item.sector);
      const matchPlan = !filters.plans || filters.plans.length === 0 || filters.plans.includes(item.plan);
      const matchTechnician =
        filters.technicians.length === 0 ||
        filters.technicians.includes(item.tecnico_1) ||
        filters.technicians.includes(item.tecnico_2 || "");
      const matchOficina = filters.oficinas.length === 0 || filters.oficinas.includes(item.oficina);

      // Date range filter
      const matchDateFrom = !filters.dateFrom || item.fecha >= filters.dateFrom;
      const matchDateTo = !filters.dateTo || item.fecha <= filters.dateTo;

      return (
        matchAdvisor &&
        matchZone &&
        matchStatus &&
        matchSector &&
        matchPlan &&
        matchTechnician &&
        matchOficina &&
        matchDateFrom &&
        matchDateTo
      );
    });
  }, [rawData, filters]);

  // Filtered data specifically for TechniciansCard (keeps all technicians visible for comparison and selection while respecting month, zone, sector, status, plan, date)
  const filteredDataWithoutTechnician = useMemo(() => {
    return rawData.filter((item) => {
      const matchAdvisor = filters.advisors.length === 0 || filters.advisors.includes(item.asesor);
      const matchZone = filters.zones.length === 0 || filters.zones.includes(item.zona);
      const matchStatus = filters.statuses.length === 0 || filters.statuses.includes(item.estatus);
      const matchSector = filters.sectors.length === 0 || filters.sectors.includes(item.sector);
      const matchPlan = !filters.plans || filters.plans.length === 0 || filters.plans.includes(item.plan);
      const matchOficina = filters.oficinas.length === 0 || filters.oficinas.includes(item.oficina);

      // Date range filter
      const matchDateFrom = !filters.dateFrom || item.fecha >= filters.dateFrom;
      const matchDateTo = !filters.dateTo || item.fecha <= filters.dateTo;

      // Month filter
      const matchMonth = filters.months.length === 0 || filters.months.some((m) => m.toLowerCase() === (item.mes || "").toLowerCase());

      return (
        matchAdvisor &&
        matchZone &&
        matchStatus &&
        matchSector &&
        matchPlan &&
        matchOficina &&
        matchDateFrom &&
        matchDateTo &&
        matchMonth
      );
    });
  }, [rawData, filters.advisors, filters.zones, filters.statuses, filters.sectors, filters.plans, filters.oficinas, filters.dateFrom, filters.dateTo, filters.months]);

  const filteredDataWithoutTechnicianOrMonthOrDate = useMemo(() => {
    return rawData.filter((item) => {
      const matchAdvisor = filters.advisors.length === 0 || filters.advisors.includes(item.asesor);
      const matchZone = filters.zones.length === 0 || filters.zones.includes(item.zona);
      const matchStatus = filters.statuses.length === 0 || filters.statuses.includes(item.estatus);
      const matchSector = filters.sectors.length === 0 || filters.sectors.includes(item.sector);
      const matchPlan = !filters.plans || filters.plans.length === 0 || filters.plans.includes(item.plan);
      const matchOficina = filters.oficinas.length === 0 || filters.oficinas.includes(item.oficina);

      return (
        matchAdvisor &&
        matchZone &&
        matchStatus &&
        matchSector &&
        matchPlan &&
        matchOficina
      );
    });
  }, [rawData, filters.advisors, filters.zones, filters.statuses, filters.sectors, filters.plans, filters.oficinas]);

  // Filtered data specifically for SectorsCard (keeps all sectors visible for comparison and selection while respecting technician, advisor, month, zone, status, plan, oficina, date)
  const filteredDataWithoutSector = useMemo(() => {
    return rawData.filter((item) => {
      const matchAdvisor = filters.advisors.length === 0 || filters.advisors.includes(item.asesor);
      const matchZone = filters.zones.length === 0 || filters.zones.includes(item.zona);
      const matchStatus = filters.statuses.length === 0 || filters.statuses.includes(item.estatus);
      const matchPlan = !filters.plans || filters.plans.length === 0 || filters.plans.includes(item.plan);
      const matchTechnician =
        filters.technicians.length === 0 ||
        filters.technicians.includes(item.tecnico_1) ||
        filters.technicians.includes(item.tecnico_2 || "");
      const matchOficina = filters.oficinas.length === 0 || filters.oficinas.includes(item.oficina);

      // Date range filter
      const matchDateFrom = !filters.dateFrom || item.fecha >= filters.dateFrom;
      const matchDateTo = !filters.dateTo || item.fecha <= filters.dateTo;

      // Month filter
      const matchMonth = filters.months.length === 0 || filters.months.some((m) => m.toLowerCase() === (item.mes || "").toLowerCase());

      return (
        matchAdvisor &&
        matchZone &&
        matchStatus &&
        matchPlan &&
        matchTechnician &&
        matchOficina &&
        matchDateFrom &&
        matchDateTo &&
        matchMonth
      );
    });
  }, [rawData, filters.advisors, filters.zones, filters.statuses, filters.plans, filters.technicians, filters.oficinas, filters.dateFrom, filters.dateTo, filters.months]);

  // All sectors with aggregated count for the SectorsCard
  const sectorsData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredDataWithoutSector.forEach((item) => {
      const sec = item.sector;
      if (sec && sec.trim() !== "") {
        counts[sec] = (counts[sec] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredDataWithoutSector]);

  // Filtered data specifically without advisor filter (used for TopAdvisorsCard persistence and calculating advisor's % share of total)
  const filteredDataWithoutAdvisor = useMemo(() => {
    return rawData.filter((item) => {
      const matchZone = filters.zones.length === 0 || filters.zones.includes(item.zona);
      const matchStatus = filters.statuses.length === 0 || filters.statuses.includes(item.estatus);
      const matchSector = filters.sectors.length === 0 || filters.sectors.includes(item.sector);
      const matchPlan = !filters.plans || filters.plans.length === 0 || filters.plans.includes(item.plan);
      const matchTechnician =
        filters.technicians.length === 0 ||
        filters.technicians.includes(item.tecnico_1) ||
        filters.technicians.includes(item.tecnico_2 || "");
      const matchOficina = filters.oficinas.length === 0 || filters.oficinas.includes(item.oficina);

      // Date range filter
      const matchDateFrom = !filters.dateFrom || item.fecha >= filters.dateFrom;
      const matchDateTo = !filters.dateTo || item.fecha <= filters.dateTo;

      // Month filter
      const matchMonth = filters.months.length === 0 || filters.months.some((m) => m.toLowerCase() === (item.mes || "").toLowerCase());

      return (
        matchZone &&
        matchStatus &&
        matchSector &&
        matchPlan &&
        matchTechnician &&
        matchOficina &&
        matchDateFrom &&
        matchDateTo &&
        matchMonth
      );
    });
  }, [rawData, filters.zones, filters.statuses, filters.sectors, filters.plans, filters.technicians, filters.oficinas, filters.dateFrom, filters.dateTo, filters.months]);

  // Solicitudes without advisor filter (used to compute what % of total solicitudes an advisor accounts for)
  const filteredSolicitudesWithoutAdvisor = useMemo(() => {
    return rawSolicitudes.filter((item) => {
      const matchZone =
        filters.zones.length === 0 ||
        filters.zones.includes(item.zona) ||
        filters.zones.includes(item.estado);
      const matchSector =
        filters.sectors.length === 0 ||
        filters.sectors.some((s) => item.sector && item.sector.toLowerCase().includes(s.toLowerCase()));
      const matchMonth =
        filters.months.length === 0 ||
        filters.months.some((m) => m.toLowerCase() === (item.mes || "").toLowerCase());
      const matchDateFrom = !filters.dateFrom || item.fecha >= filters.dateFrom;
      const matchDateTo = !filters.dateTo || item.fecha <= filters.dateTo;

      return matchZone && matchSector && matchMonth && matchDateFrom && matchDateTo;
    });
  }, [rawSolicitudes, filters.zones, filters.sectors, filters.months, filters.dateFrom, filters.dateTo]);

  // All advisors aggregated without advisor filter (keeps all advisors visible with the selected one highlighted)
  const advisorsDataWithoutAdvisorFilter = useMemo(() => {
    const advisorMap: Record<string, { total: number; instalado: number; tipo?: any; sede?: string; es_ex?: boolean; equipo?: string }> = {};

    filteredDataWithoutAdvisor.forEach((item) => {
      const adv = item.asesor;
      if (!adv || adv.trim() === "" || adv === "Sin Asesor" || adv === "Desconocido") return;
      if (!advisorMap[adv]) {
        advisorMap[adv] = {
          total: 0,
          instalado: 0,
          tipo: item.tipo_asesor,
          sede: item.sede_taquilla,
          es_ex: Boolean(item.es_ex_colaborador),
          equipo: item.equipo,
        };
      }
      advisorMap[adv].total += 1;
    });

    filteredSolicitudesWithoutAdvisor.forEach((s) => {
      const adv = s.asesor;
      if (!adv || adv.trim() === "" || adv === "Sin Asesor" || adv === "Desconocido") return;
      if (!advisorMap[adv]) {
        advisorMap[adv] = {
          total: 0,
          instalado: 0,
          tipo: s.tipo_asesor,
          sede: s.sede_taquilla,
          es_ex: Boolean(s.es_ex_colaborador),
        };
      }
      advisorMap[adv].instalado += 1;
    });

    return Object.entries(advisorMap)
      .map(([name, stats]) => ({
        name,
        value: stats.total,
        installed: stats.instalado,
        tipo_asesor: stats.tipo,
        es_ex_colaborador: stats.es_ex,
        sede_taquilla: stats.sede,
        equipo: stats.equipo,
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredDataWithoutAdvisor, filteredSolicitudesWithoutAdvisor]);

  // Data without date filter (keeps all days visible in timeline even when a day is clicked)
  const filteredDataWithoutDate = useMemo(() => {
    return filteredDataWithoutMonthOrDate.filter((item) => {
      return (
        filters.months.length === 0 ||
        filters.months.some((m) => m.toLowerCase() === (item.mes || "").toLowerCase())
      );
    });
  }, [filteredDataWithoutMonthOrDate, filters.months]);

  // Filter Logic for Solicitudes without month and without date (used for multi-month sparkline & MoM comparisons)
  const filteredSolicitudesWithoutMonthOrDate = useMemo(() => {
    return rawSolicitudes.filter((item) => {
      const matchAdvisor = filters.advisors.length === 0 || filters.advisors.includes(item.asesor);
      const matchZone =
        filters.zones.length === 0 ||
        filters.zones.includes(item.zona) ||
        filters.zones.includes(item.estado);
      const matchSector =
        filters.sectors.length === 0 ||
        filters.sectors.some((s) => item.sector && item.sector.toLowerCase().includes(s.toLowerCase()));

      return matchAdvisor && matchZone && matchSector;
    });
  }, [rawSolicitudes, filters.advisors, filters.zones, filters.sectors]);

  // Filter Logic for Solicitudes without date
  const filteredSolicitudesWithoutDate = useMemo(() => {
    return filteredSolicitudesWithoutMonthOrDate.filter((item) => {
      return (
        filters.months.length === 0 ||
        filters.months.some((m) => m.toLowerCase() === (item.mes || "").toLowerCase())
      );
    });
  }, [filteredSolicitudesWithoutMonthOrDate, filters.months]);

  // Filter Logic for Solicitudes (Demandas de Clientes por Asesor)
  const filteredSolicitudes = useMemo(() => {
    return filteredSolicitudesWithoutDate.filter((item) => {
      const matchDateFrom = !filters.dateFrom || item.fecha >= filters.dateFrom;
      const matchDateTo = !filters.dateTo || item.fecha <= filters.dateTo;
      return matchDateFrom && matchDateTo;
    });
  }, [filteredSolicitudesWithoutDate, filters.dateFrom, filters.dateTo]);


  // Main filtered data (applying all filters including month and date)
  const filteredData = useMemo(() => {
    return filteredDataWithoutMonth.filter((item) => {
      return (
        filters.months.length === 0 ||
        filters.months.some((m) => m.toLowerCase() === (item.mes || "").toLowerCase())
      );
    });
  }, [filteredDataWithoutMonth, filters.months]);

  // Calculate Metrics based on FILTERED data
  const metrics = useMemo(
    () => calculateAdvancedMetrics(filteredData, filteredDataWithoutMonth, filteredSolicitudes),
    [filteredData, filteredDataWithoutMonth, filteredSolicitudes]
  );

  // Todo lo que está en Cuadro Diario es una instalación realizada
  const totalInstalaciones = rawData.length > 0 ? filteredData.length : (kpiSummary?.totalInstalaciones || 0);
  // Todo lo que está en Solicitudes es una solicitud de cliente
  const totalSolicitudes = rawSolicitudes.length > 0 ? filteredSolicitudes.length : (kpiSummary?.totalSolicitudes || 0);

  // MoM Normalized Statistics (comparing against previous month at exact same day of month)
  const momStats = useMemo(() => {
    const selectedMonth = filters.months.length === 1 ? filters.months[0] : getCurrentSpanishMonth();
    const maxDay = getMaxDayForMonth(filteredDataWithoutMonth, selectedMonth);
    const isSingleMonth = filters.months.length === 1;

    // MoM for Instalaciones
    const inst = calculateMoMMTD(filteredDataWithoutMonth, selectedMonth, maxDay);

    // MoM for Solicitudes
    const sol = calculateMoMMTD(filteredSolicitudesWithoutMonthOrDate, selectedMonth, maxDay);

    // MoM for Nuevos Clientes
    const nuevos = calculateMoMMTD(
      filteredDataWithoutMonth,
      selectedMonth,
      maxDay,
      (item) => isNuevoServicioStatus(item.estatus)
    );

    // MoM for Routers
    const routers = calculateMoMMTD(
      filteredDataWithoutMonth,
      selectedMonth,
      maxDay,
      (item) => Boolean(item.router && item.router !== "0" && item.router.toUpperCase() !== "NO" && item.router !== "-")
    );

    // MoM for TV / Power Go
    const tv = calculateMoMMTD(
      filteredDataWithoutMonth,
      selectedMonth,
      maxDay,
      (item) => (item.power_go || "").toUpperCase() === "SI"
    );

    return {
      maxDay,
      isSingleMonth,
      isPartialMonth: isSingleMonth && maxDay < 28,
      selectedMonth,
      inst,
      sol,
      nuevos,
      routers,
      tv,
    };
  }, [filteredDataWithoutMonth, filteredSolicitudesWithoutMonthOrDate, filters.months]);

  // Options from RAW data (Advisors from normalized Solicitudes sheet)
  const options = useMemo(() => {
    const unique = (key: keyof Installation) =>
      Array.from(new Set(rawData.map((i) => formatProperCase(String(i[key] || ""))).filter(Boolean)));

    const allTechs = new Set<string>();
    rawData.forEach((i) => {
      if (i.tecnico_1) allTechs.add(formatProperCase(i.tecnico_1));
      if (i.tecnico_2) allTechs.add(formatProperCase(i.tecnico_2));
    });

    const normalizedAdvisors = Array.from(
      new Set([
        ...rawData.map((i) => formatProperCase(i.asesor)),
        ...rawSolicitudes.map((s) => formatProperCase(s.asesor)),
      ])
    )
      .filter((a) => a && a !== "Sin Asesor" && a !== "N/a")
      .sort();

    return {
      advisors: normalizedAdvisors,
      zones: unique("zona").sort(),
      sectors: unique("sector").sort(),
      statuses: unique("estatus").sort(),
      months: unique("mes"),
      technicians: Array.from(allTechs).sort(),
    };
  }, [rawData, rawSolicitudes]);

  // Cascading options (e.g. Sectors depend on Zones)
  const dynamicSectors = useMemo(() => {
    if (filters.zones.length === 0) {
      return options.sectors;
    }
    const filteredByZone = rawData.filter((i) => filters.zones.includes(i.zona));
    return Array.from(new Set(filteredByZone.map((i) => String(i.sector || ""))))
      .filter(Boolean)
      .sort();
  }, [rawData, filters.zones, options.sectors]);


  const handleFilterChange = (type: keyof FilterState, value: string) => {
    setFilters((prev) => {
      const rawCurrent = (prev as any)[type];
      const current = Array.isArray(rawCurrent) ? rawCurrent : [];
      const exists = current.includes(value);
      return {
        ...prev,
        [type]: exists ? current.filter((i) => i !== value) : [...current, value],
      };
    });
  };

  const handleSelectMonth = (month: string) => {
    setFilters((prev) => ({
      ...prev,
      months: month ? [month] : [],
      // Clear specific day filter when changing or clearing month
      dateFrom: "",
      dateTo: "",
    }));
  };

  const handleSelectDate = (dateStr: string) => {
    setFilters((prev) => ({
      ...prev,
      dateFrom: dateStr,
      dateTo: dateStr,
    }));
  };

  const handleSelectTechnician = (technician: string) => {
    setFilters((prev) => ({
      ...prev,
      technicians: prev.technicians.includes(technician) ? [] : [technician],
    }));
  };

  const handleSelectSector = (sector: string) => {
    setFilters((prev) => ({
      ...prev,
      sectors: prev.sectors.includes(sector) ? [] : [sector],
    }));
  };

  const handleSelectAdvisor = (advisor: string) => {
    setFilters((prev) => ({
      ...prev,
      advisors: prev.advisors.includes(advisor) ? [] : [advisor],
    }));
  };

  // Full monthly trend calculated from filteredDataWithoutMonthOrDate so all 12 months stay available in the chart
  const monthlyTrendData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredDataWithoutMonthOrDate.forEach((item) => {
      const m = formatProperCase(item.mes || "N/A");
      if (m && m !== "N/a") {
        counts[m] = (counts[m] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => getMonthIndex(a.name) - getMonthIndex(b.name));
  }, [filteredDataWithoutMonthOrDate]);

  const monthlySolicitudesData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredSolicitudesWithoutMonthOrDate.forEach((item) => {
      const m = formatProperCase(item.mes || "N/A");
      if (m && m !== "N/a") {
        counts[m] = (counts[m] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ label: name, value }))
      .sort((a, b) => getMonthIndex(a.label) - getMonthIndex(b.label));
  }, [filteredSolicitudesWithoutMonthOrDate]);

  const monthlyNuevosClientesData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredDataWithoutMonthOrDate.forEach((item) => {
      if (isNuevoServicioStatus(item.estatus)) {
        const m = formatProperCase(item.mes || "N/A");
        if (m && m !== "N/a") {
          counts[m] = (counts[m] || 0) + 1;
        }
      }
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ label: name, value }))
      .sort((a, b) => getMonthIndex(a.label) - getMonthIndex(b.label));
  }, [filteredDataWithoutMonthOrDate]);

  const monthlyRoutersData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredDataWithoutMonthOrDate.forEach((item) => {
      if (item.router && item.router !== "0" && item.router.toUpperCase() !== "NO") {
        const m = formatProperCase(item.mes || "N/A");
        if (m && m !== "N/a") {
          counts[m] = (counts[m] || 0) + 1;
        }
      }
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ label: name, value }))
      .sort((a, b) => getMonthIndex(a.label) - getMonthIndex(b.label));
  }, [filteredDataWithoutMonthOrDate]);

  const monthlyTvData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredDataWithoutMonthOrDate.forEach((item) => {
      if (item.power_go && item.power_go.toUpperCase() === "SI") {
        const m = formatProperCase(item.mes || "N/A");
        if (m && m !== "N/a") {
          counts[m] = (counts[m] || 0) + 1;
        }
      }
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ label: name, value }))
      .sort((a, b) => getMonthIndex(a.label) - getMonthIndex(b.label));
  }, [filteredDataWithoutMonthOrDate]);

  // Real multi-month historical trend for each zone (so sparkline compares the selected month vs previous month)
  const zonesWithAnnualHistory = useMemo(() => {
    // 1. Get ordered list of months present in the unfiltered data
    const monthCounts: Record<string, number> = {};
    filteredDataWithoutMonthOrDate.forEach((item) => {
      const m = formatProperCase(item.mes || "");
      if (m && m !== "N/a") monthCounts[m] = (monthCounts[m] || 0) + 1;
    });
    const sortedMonths = Object.keys(monthCounts).sort((a, b) => getMonthIndex(a) - getMonthIndex(b));

    // 2. Count by zone in current filtered scope (for current card values)
    const currentZoneCounts: Record<string, number> = {};
    filteredData.forEach((item) => {
      const z = String(item.zona || "N/A");
      currentZoneCounts[z] = (currentZoneCounts[z] || 0) + 1;
    });

    // 3. Count by zone and month across all months
    const zoneMonthCounts: Record<string, Record<string, number>> = {};
    filteredDataWithoutMonthOrDate.forEach((item) => {
      const z = String(item.zona || "N/A");
      const m = formatProperCase(item.mes || "");
      if (!zoneMonthCounts[z]) zoneMonthCounts[z] = {};
      zoneMonthCounts[z][m] = (zoneMonthCounts[z][m] || 0) + 1;
    });

    // 4. Resolve selected month index and check if month is partial (MTD cutoff)
    const activeMonth = filters.months[0] ? formatProperCase(filters.months[0]) : sortedMonths[sortedMonths.length - 1];
    const activeMonthIdx = sortedMonths.indexOf(activeMonth);
    const activeMaxDay = getMaxDayForMonth(filteredDataWithoutMonthOrDate, activeMonth);
    const isPartialMonth = activeMaxDay < 28;

    // Count previous month's like-for-like MTD for fair comparison
    const prevMonthMtdCounts: Record<string, number> = {};
    if (activeMonthIdx > 0 && isPartialMonth) {
      const prevM = sortedMonths[activeMonthIdx - 1].toUpperCase();
      filteredDataWithoutMonthOrDate.forEach((item) => {
        if ((item.mes || "").toUpperCase() === prevM) {
          const d = getDayFromDate(item.fecha);
          if (d > 0 && d <= activeMaxDay) {
            const z = String(item.zona || "N/A");
            prevMonthMtdCounts[z] = (prevMonthMtdCounts[z] || 0) + 1;
          }
        }
      });
    }

    // 5. Build zone items
    return Object.entries(currentZoneCounts)
      .map(([name, val]) => {
        // Full history up to active month (or all months if all selected)
        const relevantMonths = activeMonthIdx >= 0 
          ? sortedMonths.slice(0, activeMonthIdx + 1)
          : sortedMonths;

        const history = relevantMonths.map((m) => zoneMonthCounts[name]?.[m] || 0);

        // Trend is positive if active month >= previous month (like-for-like MTD when month is in progress)
        let isPositive = true;
        if (activeMonthIdx > 0) {
          const currentMVal = zoneMonthCounts[name]?.[activeMonth] || 0;
          const prevM = sortedMonths[activeMonthIdx - 1];
          const prevMVal = isPartialMonth
            ? (prevMonthMtdCounts[name] || 0)
            : (zoneMonthCounts[name]?.[prevM] || 0);
          isPositive = currentMVal >= prevMVal;
        } else if (history.length >= 2) {
          isPositive = history[history.length - 1] >= history[history.length - 2];
        }

        return {
          name,
          value: val,
          history,
          isPositive,
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [filteredData, filteredDataWithoutMonthOrDate, filters.months]);

  // Real multi-month historical trend for each technician (keeps all technicians visible for comparison and allows switching)
  const techsWithAnnualHistory = useMemo(() => {
    const monthCounts: Record<string, number> = {};
    filteredDataWithoutTechnicianOrMonthOrDate.forEach((item) => {
      const m = formatProperCase(item.mes || "");
      if (m && m !== "N/a") monthCounts[m] = (monthCounts[m] || 0) + 1;
    });
    const sortedMonths = Object.keys(monthCounts).sort((a, b) => getMonthIndex(a) - getMonthIndex(b));

    const techCounts: Record<string, { count: number; team?: string }> = {};
    const techMonthCounts: Record<string, Record<string, number>> = {};

    filteredDataWithoutTechnician.forEach((item) => {
      if (item.tecnico_1) {
        const t1 = item.tecnico_1;
        if (!techCounts[t1]) techCounts[t1] = { count: 0, team: item.equipo };
        techCounts[t1].count += 1;
      }
      if (item.tecnico_2) {
        const t2 = item.tecnico_2;
        if (!techCounts[t2]) techCounts[t2] = { count: 0, team: item.equipo };
        techCounts[t2].count += 1;
      }
    });

    filteredDataWithoutTechnicianOrMonthOrDate.forEach((item) => {
      const m = formatProperCase(item.mes || "");
      if (item.tecnico_1) {
        const t1 = item.tecnico_1;
        if (!techMonthCounts[t1]) techMonthCounts[t1] = {};
        techMonthCounts[t1][m] = (techMonthCounts[t1][m] || 0) + 1;
      }
      if (item.tecnico_2) {
        const t2 = item.tecnico_2;
        if (!techMonthCounts[t2]) techMonthCounts[t2] = {};
        techMonthCounts[t2][m] = (techMonthCounts[t2][m] || 0) + 1;
      }
    });

    const activeMonth = filters.months[0] ? formatProperCase(filters.months[0]) : sortedMonths[sortedMonths.length - 1];
    const activeMonthIdx = sortedMonths.indexOf(activeMonth);
    const activeMaxDay = getMaxDayForMonth(filteredDataWithoutTechnicianOrMonthOrDate, activeMonth);
    const isPartialMonth = activeMaxDay < 28;

    // Count previous month's like-for-like MTD tickets for technicians
    const prevMonthMtdTechCounts: Record<string, number> = {};
    if (activeMonthIdx > 0 && isPartialMonth) {
      const prevM = sortedMonths[activeMonthIdx - 1].toUpperCase();
      filteredDataWithoutTechnicianOrMonthOrDate.forEach((item) => {
        if ((item.mes || "").toUpperCase() === prevM) {
          const d = getDayFromDate(item.fecha);
          if (d > 0 && d <= activeMaxDay) {
            if (item.tecnico_1) prevMonthMtdTechCounts[item.tecnico_1] = (prevMonthMtdTechCounts[item.tecnico_1] || 0) + 1;
            if (item.tecnico_2) prevMonthMtdTechCounts[item.tecnico_2] = (prevMonthMtdTechCounts[item.tecnico_2] || 0) + 1;
          }
        }
      });
    }

    return Object.entries(techCounts)
      .map(([name, stats]) => {
        const relevantMonths = activeMonthIdx >= 0 
          ? sortedMonths.slice(0, activeMonthIdx + 1)
          : sortedMonths;

        const history = relevantMonths.map((m) => techMonthCounts[name]?.[m] || 0);

        let isPositive = true;
        if (activeMonthIdx > 0) {
          const currentMVal = techMonthCounts[name]?.[activeMonth] || 0;
          const prevM = sortedMonths[activeMonthIdx - 1];
          const prevMVal = isPartialMonth
            ? (prevMonthMtdTechCounts[name] || 0)
            : (techMonthCounts[name]?.[prevM] || 0);
          isPositive = currentMVal >= prevMVal;
        } else if (history.length >= 2) {
          isPositive = history[history.length - 1] >= history[history.length - 2];
        }

        return {
          name,
          value: stats.count,
          equipo: stats.team,
          history,
          isPositive,
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [filteredDataWithoutTechnician, filteredDataWithoutTechnicianOrMonthOrDate, filters.months]);

  // Real multi-month and MoM historical comparison for each advisor
  const advisorsWithMoM = useMemo(() => {
    const baseAdvisors = advisorsDataWithoutAdvisorFilter.length > 0
      ? advisorsDataWithoutAdvisorFilter
      : (metrics?.charts?.byAdvisor || []);
    if (baseAdvisors.length === 0) return [];

    const isSingleMonth = momStats.isSingleMonth;
    const activeMonth = isSingleMonth && filters.months[0] ? formatProperCase(filters.months[0]) : null;
    const normActive = activeMonth ? activeMonth.trim().toUpperCase() : null;
    const activeMonthIdx = normActive ? getMonthIndex(normActive) : -1;
    const activeMaxDay = activeMonth ? getMaxDayForMonth(filteredDataWithoutMonthOrDate, activeMonth) : 31;
    const isPartialMonth = activeMaxDay < 28;

    // Resolve previous month ONLY if a single month is active
    let prevMonth: string | null = null;
    if (isSingleMonth && activeMonthIdx > 0 && activeMonthIdx < MONTH_ORDER.length) {
      for (let i = activeMonthIdx - 1; i >= 0; i--) {
        const candidate = MONTH_ORDER[i].toUpperCase();
        if (filteredDataWithoutMonthOrDate.some((it) => (it.mes || "").toUpperCase() === candidate)) {
          prevMonth = MONTH_ORDER[i];
          break;
        }
      }
    }

    // Count previous month's like-for-like MTD per advisor ONLY when single month is active
    const prevMonthCounts: Record<string, number> = {};
    if (isSingleMonth && prevMonth) {
      const normPrev = prevMonth.toUpperCase();
      filteredDataWithoutMonthOrDate.forEach((item) => {
        if ((item.mes || "").toUpperCase() === normPrev) {
          const d = getDayFromDate(item.fecha);
          if (!isPartialMonth || (d > 0 && d <= activeMaxDay)) {
            const adv = item.asesor;
            if (adv) {
              prevMonthCounts[adv] = (prevMonthCounts[adv] || 0) + 1;
            }
          }
        }
      });
    }

    const totalScopedInst = baseAdvisors.reduce((acc, a) => acc + a.value, 0);

    return baseAdvisors.map((adv) => {
      const prevVal = isSingleMonth && prevMonth ? (prevMonthCounts[adv.name] || 0) : undefined;
      let deltaMoM: number | undefined = undefined;
      let isPositive: boolean = true;

      if (prevVal !== undefined) {
        if (prevVal > 0) {
          deltaMoM = ((adv.value - prevVal) / prevVal) * 100;
          isPositive = deltaMoM >= 0;
        } else if (adv.value > 0) {
          deltaMoM = 100;
          isPositive = true;
        } else {
          deltaMoM = 0;
          isPositive = true;
        }
      }

      const sharePct = totalScopedInst > 0
        ? (adv.value / totalScopedInst) * 100
        : 0;

      return {
        ...adv,
        prevMonthValue: prevVal,
        prevMonthName: prevMonth,
        deltaMoM,
        isPositive,
        sharePct,
      };
    });
  }, [advisorsDataWithoutAdvisorFilter, metrics?.charts?.byAdvisor, filteredDataWithoutMonthOrDate, filters.months, filters.technicians, filters.sectors, momStats.isSingleMonth]);

  // Top commercial advisor specific metrics, personal MoM MTD trend and history
  const topAdvisorStats = useMemo(() => {
    const isAdvisorFiltered = filters.advisors.length > 0;
    const selectedAdvisorName = isAdvisorFiltered ? filters.advisors[0] : null;

    // If an advisor is explicitly selected, they are the top focus
    const targetAdvisor = selectedAdvisorName
      ? advisorsWithMoM.find((a) => a.name.toLowerCase() === selectedAdvisorName.toLowerCase()) || {
          name: selectedAdvisorName,
          value: filteredData.length,
          installed: filteredSolicitudes.length,
          sharePct: filteredDataWithoutAdvisor.length > 0 ? (filteredData.length / filteredDataWithoutAdvisor.length) * 100 : 0,
          isPositive: true,
        }
      : advisorsWithMoM.filter(
          (a) => !a.name.toLowerCase().includes("planificac") && !a.es_ex_colaborador
        )[0] || advisorsWithMoM[0];

    if (!targetAdvisor) return null;

    // Monthly historical installations specifically for this advisor
    const monthlyCounts: Record<string, number> = {};
    filteredDataWithoutMonthOrDate.forEach((item) => {
      if (item.asesor === targetAdvisor.name) {
        const m = formatProperCase(item.mes || "");
        if (m && m !== "N/a") {
          monthlyCounts[m] = (monthlyCounts[m] || 0) + 1;
        }
      }
    });

    const sparkline = Object.entries(monthlyCounts)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => getMonthIndex(a.label) - getMonthIndex(b.label));

    const isSingleMonth = momStats.isSingleMonth;
    const deltaMoM = isSingleMonth ? targetAdvisor.deltaMoM : undefined;
    const isPositive = targetAdvisor.isPositive ?? (deltaMoM !== undefined ? deltaMoM >= 0 : true);

    return {
      name: targetAdvisor.name,
      value: targetAdvisor.value,
      installed: targetAdvisor.installed || 0,
      prevMonthValue: isSingleMonth ? targetAdvisor.prevMonthValue : undefined,
      prevMonthName: isSingleMonth ? targetAdvisor.prevMonthName : null,
      deltaMoM,
      isPositive,
      sharePct: targetAdvisor.sharePct,
      sparkline,
    };
  }, [advisorsWithMoM, filteredDataWithoutMonthOrDate, filteredData.length, filteredDataWithoutAdvisor.length, filteredSolicitudes.length, filters.advisors, momStats.isSingleMonth]);

  // Contextual share statistics when an advisor or technician is selected
  // Fulfills exact user requirement:
  // "Si elijo un asesor debe decir el porcentaje de instalaciones de total que representa el asesor o tecnic
  //  en solicitudes solo el asesor, en nuevos clientes ambos, en routers vendidos / instalados ambos, en tv vendido e instalados ambos."
  const shareContextStats = useMemo(() => {
    const isAdvisorFiltered = filters.advisors.length > 0;
    const isTechFiltered = !isAdvisorFiltered && filters.technicians.length > 0;

    if (!isAdvisorFiltered && !isTechFiltered) {
      return null;
    }

    const type: "advisor" | "technician" = isAdvisorFiltered ? "advisor" : "technician";
    const name = isAdvisorFiltered ? filters.advisors[0] : filters.technicians[0];
    const baseDataset = isAdvisorFiltered ? filteredDataWithoutAdvisor : filteredDataWithoutTechnician;

    // 1. Installations share
    const totalInst = filteredData.length;
    const baseInst = baseDataset.length;
    const instShare = baseInst > 0 ? (totalInst / baseInst) * 100 : 0;

    // 2. Nuevos Clientes share (ambos)
    const currentNuevos = metrics?.counters?.nuevosServicios || 0;
    const baseNuevos = baseDataset.filter((i) => isNuevoServicioStatus(i.estatus)).length;
    const nuevosShare = baseNuevos > 0 ? (currentNuevos / baseNuevos) * 100 : 0;

    // 3. Routers share (ambos: vendidos para asesor / instalados para técnico)
    const currentRouters = metrics?.counters?.routerCount || 0;
    const baseRouters = baseDataset.filter((i) =>
      Boolean(i.router && i.router !== "0" && i.router.toUpperCase() !== "NO" && i.router !== "-")
    ).length;
    const routersShare = baseRouters > 0 ? (currentRouters / baseRouters) * 100 : 0;

    // 4. TV / Servicios share (ambos: vendidos para asesor / instalados para técnico)
    const currentTv = metrics?.counters?.powerGoCount || 0;
    const baseTv = baseDataset.filter((i) => (i.power_go || "").toUpperCase() === "SI").length;
    const tvShare = baseTv > 0 ? (currentTv / baseTv) * 100 : 0;

    // 5. Solicitudes share (SOLO para asesor, los técnicos no generan solicitudes comerciales)
    let solShare: number | null = null;
    let baseSol = 0;
    if (isAdvisorFiltered) {
      const currentSol = filteredSolicitudes.length;
      baseSol = filteredSolicitudesWithoutAdvisor.length;
      solShare = baseSol > 0 ? (currentSol / baseSol) * 100 : 0;
    }

    return {
      type,
      name,
      instShare,
      baseInst,
      nuevosShare,
      baseNuevos,
      routersShare,
      baseRouters,
      tvShare,
      baseTv,
      solShare,
      baseSol,
    };
  }, [
    filters.advisors,
    filters.technicians,
    filteredData.length,
    filteredDataWithoutAdvisor,
    filteredDataWithoutTechnician,
    filteredSolicitudes.length,
    filteredSolicitudesWithoutAdvisor,
    metrics?.counters?.nuevosServicios,
    metrics?.counters?.routerCount,
    metrics?.counters?.powerGoCount,
  ]);

  const handleDateChange = (type: "dateFrom" | "dateTo", value: string) => {
    setFilters((prev) => ({ ...prev, [type]: value }));
  };

  const handleResetFilters = () => {
    setFilters(INITIAL_FILTERS);
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const exportRows = filteredData.map((d) => ({
        Fecha: d.fecha,
        Mes: d.mes,
        Asesor: d.asesor,
        Zona: d.zona,
        Sector: d.sector,
        Estatus: d.estatus,
        Plan: d.plan,
        Cliente: d.nombre_cliente,
        Cedula: d.cedula,
        Router: d.router || "N/A",
        "Power Go": d.power_go,
        "Tecnico 1": d.tecnico_1,
        "Tecnico 2": d.tecnico_2 || "N/A",
      }));
      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Rendimiento");
      XLSX.writeFile(workbook, `Reporte_Comercial_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      console.error("Error al exportar:", err);
    } finally {
      setExporting(false);
    }
  };

  const handleSaveOverrides = async (payload: {
    overrides: AdvisorOverridesMap;
    aliases: Record<string, string>;
    technicianOverrides: TechnicianOverridesMap;
    technicianAliases: Record<string, string>;
  }) => {
    // 1. Immediately persist to localStorage for instant local durability
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("buildly_advisor_overrides", JSON.stringify(payload.overrides));
        localStorage.setItem("buildly_advisor_aliases", JSON.stringify(payload.aliases));
        localStorage.setItem("buildly_tech_overrides", JSON.stringify(payload.technicianOverrides));
        localStorage.setItem("buildly_tech_aliases", JSON.stringify(payload.technicianAliases));
      } catch (e) {}
    }
    setAdvisorOverrides(payload.overrides);
    setAdvisorAliases(payload.aliases);
    setTechOverrides(payload.technicianOverrides);
    setTechAliases(payload.technicianAliases);

    // 2. Persist to server API route
    const res = await fetch("/api/advisors/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || "Error al guardar en el servidor");
    }

    // 3. Immediately refresh dataset passing newOverrides & newAliases explicitly
    await loadData(true, payload.overrides, payload.aliases, payload.technicianOverrides, payload.technicianAliases);
  };

  const handleOpenConfigWithTab = (tab: PersonnelTab) => {
    router.push("/configuracion");
  };

  const handleSelectSection = (section: string) => {
    setActiveSection(section);
    if (section === "configuracion" || section === "fuerza-ventas" || section === "tecnicos") {
      router.push("/configuracion");
    }
  };

  return (
    <div className="bg-white text-[#09090B] font-sans min-h-screen flex flex-col xl:flex-row antialiased selection:bg-neutral-900 selection:text-white">
      {/* COLLAPSIBLE DESKTOP SIDEBAR + MOBILE DRAWER */}
      <Sidebar
        advisorsCount={options.advisors.length || 24}
        isMobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        activeSection={activeSection}
        onSelectSection={handleSelectSection}
      />

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col min-w-0 bg-white">
        {/* UNIFIED COMPACT HEADER (48px / Single bar) */}
        <header className="sticky top-0 z-20 h-12 bg-white border-b border-neutral-200/80 px-4 sm:px-6 flex items-center justify-between select-none">
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger Menu Toggle */}
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="xl:hidden -ml-2 min-w-[44px] min-h-[44px] p-2.5 text-neutral-400 hover:text-neutral-900 transition-colors flex items-center justify-center cursor-pointer shrink-0"
              title="Abrir menú de navegación"
              aria-label="Abrir menú de navegación"
              id="mobileMenuBtn"
            >
              <Menu className="w-4 h-4 stroke-[1.75]" />
            </button>
            <SidebarOpenButton />
          </div>

          {/* Right: Panel Title & Sincronizar Button */}
          <div className="flex items-center gap-1 sm:gap-2">
            <span className="text-xs sm:text-sm font-normal text-neutral-700 tracking-tight font-sans">
              Página principal
            </span>
            <button
              onClick={() => loadData(true)}
              disabled={refreshing || loading}
              className="min-w-[36px] min-h-[36px] p-2 text-neutral-400 hover:text-neutral-900 transition-colors flex items-center justify-center cursor-pointer disabled:opacity-50 -mr-1"
              title={refreshing ? "Sincronizando..." : "Sincronizar datos"}
              aria-label="Sincronizar datos"
              id="refreshBtn"
              suppressHydrationWarning
            >
              <RotateCw className={cn("w-3.5 h-3.5 stroke-[1.75]", (refreshing || loading) && "animate-spin")} />
            </button>
          </div>
        </header>

        {/* MAIN DASHBOARD CONTENT WRAPPER */}
        <div className="p-3 sm:p-6 pb-20 xl:pb-6 max-w-[1750px] w-full mx-auto space-y-3 sm:space-y-4">
          {/* Dashboard Control & Filter Bar */}
          <div className="w-full pb-2 border-b border-neutral-100">
            <FilterCommandBar
              currentFilters={filters}
              options={{
                advisors: options.advisors,
                zones: options.zones,
                sectors: dynamicSectors,
                statuses: options.statuses,
                months: options.months,
                technicians: options.technicians,
              }}
              onFilterChange={handleFilterChange}
              onDateChange={handleDateChange}
              onResetFilters={handleResetFilters}
              onOpenAdvisorConfig={() => setAdvisorConfigOpen(true)}
            />
          </div>
          {/* ROW 0: KPI METRIC CARDS (Feathered reference dividers) */}
          {(() => {
            const formatKPIVariation = (
              current: number,
              prev: number | undefined,
              deltaPct: number | undefined,
              isPositive: boolean,
              unitLabel: string
            ): string => {
              if (prev === undefined || deltaPct === undefined) return unitLabel;
              const absPct = Math.abs(deltaPct);
              // When relative percentage exceeds 100% or base is small (< 15),
              // relative % produces misleading values (e.g. +160% on 8 units).
              // Factual net unit delta is shown instead: e.g. "↑ +8 paq."
              if (absPct > 100 || prev < 15) {
                const diff = current - prev;
                return `${diff >= 0 ? "↑ +" : "↓ "}${formatNumber(Math.abs(diff))} ${unitLabel}`;
              }
              return `${isPositive ? "↑ +" : "↓ "}${absPct.toFixed(1)}%`;
            };

            return (
              <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 relative divide-y divide-neutral-100 md:divide-y-0">
                <KPICard
                  label="Instalaciones"
                  value={formatNumber(totalInstalaciones)}
                  trend={{
                    value: filters.dateFrom && filters.dateFrom === filters.dateTo
                      ? "Día activo"
                      : momStats.isSingleMonth && momStats.inst.prevMonth
                      ? `${formatKPIVariation(momStats.inst.currentTotal, momStats.inst.prevTotal, momStats.inst.deltaPct, momStats.inst.isPositive, "inst.")} vs. ${momStats.inst.prevMonth.slice(0, 3)} (${formatNumber(momStats.inst.prevTotal)})`
                      : "100% realizadas",
                    isPositive: momStats.isSingleMonth && momStats.inst.prevMonth
                      ? momStats.inst.isPositive
                      : true,
                  }}
                  subValue={
                    shareContextStats
                      ? `${shareContextStats.instShare.toFixed(1)}% del total • ${
                          shareContextStats.type === "advisor"
                            ? `ventas de ${formatProperCase(shareContextStats.name)}`
                            : `ejecutadas por ${formatProperCase(shareContextStats.name)}`
                        }`
                      : filters.dateFrom && filters.dateFrom === filters.dateTo
                      ? `Día ${filters.dateFrom.split("-")[2]} filtrado`
                      : momStats.isPartialMonth && momStats.inst.prevMonth
                      ? `${formatNumber(momStats.inst.prevTotal)} al d.${momStats.maxDay} en ${momStats.inst.prevMonth.slice(0, 3)}`
                      : momStats.isSingleMonth && momStats.inst.prevMonth
                      ? `${formatNumber(momStats.inst.prevTotal)} en ${momStats.inst.prevMonth.slice(0, 3)}`
                      : "volumen consolidado"
                  }
                  isFirst={true}
                  sparklineData={monthlyTrendData.map((d) => ({ label: d.name, value: d.value }))}
                />
                <KPICard
                  label="Solicitudes"
                  value={formatNumber(totalSolicitudes)}
                  trend={{
                    value: filters.dateFrom && filters.dateFrom === filters.dateTo
                      ? "Día activo"
                      : momStats.isSingleMonth && momStats.sol.prevMonth
                      ? `${formatKPIVariation(momStats.sol.currentTotal, momStats.sol.prevTotal, momStats.sol.deltaPct, momStats.sol.isPositive, "sol.")} vs. ${momStats.sol.prevMonth.slice(0, 3)} (${formatNumber(momStats.sol.prevTotal)})`
                      : "Demanda total",
                    isPositive: momStats.isSingleMonth && momStats.sol.prevMonth
                      ? momStats.sol.isPositive
                      : true,
                  }}
                  subValue={
                    shareContextStats?.type === "advisor"
                      ? `${shareContextStats.solShare !== null ? shareContextStats.solShare.toFixed(1) : "0.0"}% del total • demandas de ${formatProperCase(shareContextStats.name)}`
                      : shareContextStats?.type === "technician"
                      ? "Demanda global • cartera comercial"
                      : filters.dateFrom && filters.dateFrom === filters.dateTo
                      ? `Día ${filters.dateFrom.split("-")[2]} filtrado`
                      : momStats.isPartialMonth && momStats.sol.prevMonth
                      ? `${formatNumber(momStats.sol.prevTotal)} al d.${momStats.maxDay} en ${momStats.sol.prevMonth.slice(0, 3)}`
                      : momStats.isSingleMonth && momStats.sol.prevMonth
                      ? `${formatNumber(momStats.sol.prevTotal)} en ${momStats.sol.prevMonth.slice(0, 3)}`
                      : "solicitudes registradas"
                  }
                  sparklineData={monthlySolicitudesData}
                />
                <KPICard
                  label="Nuevos Clientes"
                  value={formatNumber(rawData.length > 0 ? (metrics?.counters?.nuevosServicios || 0) : (kpiSummary?.nuevosServicios || 0))}
                  trend={{
                    value: momStats.isSingleMonth && momStats.nuevos.prevMonth
                      ? `${formatKPIVariation(momStats.nuevos.currentTotal, momStats.nuevos.prevTotal, momStats.nuevos.deltaPct, momStats.nuevos.isPositive, "altas")} vs. ${momStats.nuevos.prevMonth.slice(0, 3)} (${formatNumber(momStats.nuevos.prevTotal)})`
                      : `${(((metrics?.counters?.nuevosServicios || 0) / (totalInstalaciones || 1)) * 100).toFixed(1)}% altas`,
                    isPositive: momStats.isSingleMonth && momStats.nuevos.prevMonth
                      ? momStats.nuevos.isPositive
                      : true,
                  }}
                  subValue={
                    shareContextStats
                      ? `${shareContextStats.nuevosShare.toFixed(1)}% del total • altas de ${formatProperCase(shareContextStats.name)}`
                      : momStats.isPartialMonth && momStats.nuevos.prevMonth
                      ? `${formatNumber(momStats.nuevos.prevTotal)} al d.${momStats.maxDay} en ${momStats.nuevos.prevMonth.slice(0, 3)}`
                      : momStats.isSingleMonth && momStats.nuevos.prevMonth
                      ? `${formatNumber(momStats.nuevos.prevTotal)} en ${momStats.nuevos.prevMonth.slice(0, 3)}`
                      : "nuevos suscriptores"
                  }
                  sparklineData={monthlyNuevosClientesData}
                />
                <KPICard
                  label="Routers Instalados"
                  value={formatNumber(rawData.length > 0 ? (metrics?.counters?.routerCount || 0) : (kpiSummary?.routerCount || 0))}
                  trend={{
                    value: momStats.isSingleMonth && momStats.routers.prevMonth
                      ? `${formatKPIVariation(momStats.routers.currentTotal, momStats.routers.prevTotal, momStats.routers.deltaPct, momStats.routers.isPositive, "Wi-Fi")} vs. ${momStats.routers.prevMonth.slice(0, 3)} (${formatNumber(momStats.routers.prevTotal)})`
                      : `${(((metrics?.counters?.routerCount || 0) / (totalInstalaciones || 1)) * 100).toFixed(1)}% Wi-Fi`,
                    isPositive: momStats.isSingleMonth && momStats.routers.prevMonth
                      ? momStats.routers.isPositive
                      : true,
                  }}
                  subValue={
                    shareContextStats
                      ? `${shareContextStats.routersShare.toFixed(1)}% del total • ${
                          shareContextStats.type === "advisor"
                            ? `vendidos por ${formatProperCase(shareContextStats.name)}`
                            : `instalados por ${formatProperCase(shareContextStats.name)}`
                        }`
                      : momStats.isPartialMonth && momStats.routers.prevMonth
                      ? `${formatNumber(momStats.routers.prevTotal)} al d.${momStats.maxDay} en ${momStats.routers.prevMonth.slice(0, 3)}`
                      : momStats.isSingleMonth && momStats.routers.prevMonth
                      ? `${formatNumber(momStats.routers.prevTotal)} en ${momStats.routers.prevMonth.slice(0, 3)}`
                      : "equipos entregados"
                  }
                  sparklineData={monthlyRoutersData}
                />
                <KPICard
                  label={formatProperCase(tvLabel) || "TV / Servicios"}
                  value={formatNumber(rawData.length > 0 ? (metrics?.counters?.powerGoCount || 0) : (kpiSummary?.powerGoCount || 0))}
                  trend={{
                    value: momStats.isSingleMonth && momStats.tv.prevMonth
                      ? `${formatKPIVariation(momStats.tv.currentTotal, momStats.tv.prevTotal, momStats.tv.deltaPct, momStats.tv.isPositive, "paquetes")} vs. ${momStats.tv.prevMonth.slice(0, 3)} (${formatNumber(momStats.tv.prevTotal)})`
                      : `${(((metrics?.counters?.powerGoCount || 0) / (totalInstalaciones || 1)) * 100).toFixed(1)}% TV`,
                    isPositive: momStats.isSingleMonth && momStats.tv.prevMonth
                      ? momStats.tv.isPositive
                      : true,
                  }}
                  subValue={
                    shareContextStats
                      ? `${shareContextStats.tvShare.toFixed(1)}% del total • ${
                          shareContextStats.type === "advisor"
                            ? `vendidos por ${formatProperCase(shareContextStats.name)}`
                            : `instalados por ${formatProperCase(shareContextStats.name)}`
                        }`
                      : momStats.isPartialMonth && momStats.tv.prevMonth
                      ? `${formatNumber(momStats.tv.prevTotal)} al d.${momStats.maxDay} en ${momStats.tv.prevMonth.slice(0, 3)}`
                      : momStats.isSingleMonth && momStats.tv.prevMonth
                      ? `${formatNumber(momStats.tv.prevTotal)} en ${momStats.tv.prevMonth.slice(0, 3)}`
                      : "paquetes activos"
                  }
                  sparklineData={monthlyTvData}
                />
                <KPICard
                  label="Top Rendimiento"
                  value={
                    rawData.length > 0
                      ? shareContextStats?.type === "advisor"
                        ? formatProperCase(shareContextStats.name)
                        : formatProperCase(topAdvisorStats?.name || metrics?.counters?.topAsesor || "N/A")
                      : formatProperCase(kpiSummary?.topAsesor || "N/A")
                  }
                  trend={{
                    value: shareContextStats?.type === "advisor"
                      ? momStats.isSingleMonth && topAdvisorStats?.prevMonthValue !== undefined && topAdvisorStats.prevMonthName
                        ? `${formatKPIVariation(topAdvisorStats.value, topAdvisorStats.prevMonthValue, topAdvisorStats.deltaMoM, topAdvisorStats.isPositive ?? true, "inst.")} vs. ${topAdvisorStats.prevMonthName.slice(0, 3)} (${formatNumber(topAdvisorStats.prevMonthValue)})`
                        : "Asesor activo"
                      : typeof topAdvisorStats?.sharePct === "number"
                      ? `${topAdvisorStats.sharePct.toFixed(1)}% ${
                          filters.technicians.length > 0
                            ? "del técnico"
                            : filters.sectors.length > 0
                            ? "del sector"
                            : momStats.isSingleMonth
                            ? "del mes"
                            : "de cuota"
                        }`
                      : "Líder comercial",
                    isPositive: shareContextStats?.type === "advisor"
                      ? topAdvisorStats?.isPositive ?? true
                      : true,
                  }}
                  subValue={
                    shareContextStats?.type === "advisor"
                      ? `${shareContextStats.instShare.toFixed(1)}% de cuota • ${formatNumber(totalInstalaciones)} inst. realizadas`
                      : filters.technicians.length > 0
                      ? `${formatNumber(topAdvisorStats?.value || 0)} inst. de ${filters.technicians[0]}`
                      : filters.sectors.length > 0
                      ? `${formatNumber(topAdvisorStats?.value || 0)} inst. en ${filters.sectors[0]}`
                      : momStats.isSingleMonth && topAdvisorStats?.prevMonthValue !== undefined && topAdvisorStats.prevMonthName
                      ? `${formatNumber(topAdvisorStats.value)} inst • vs. ${topAdvisorStats.prevMonthName.slice(0, 3)} (${formatNumber(topAdvisorStats.prevMonthValue)})`
                      : `${formatNumber(topAdvisorStats?.value || metrics?.counters?.maxVentas || 0)} inst. consolidadas`
                  }
                  sparklineData={
                    topAdvisorStats?.sparkline && topAdvisorStats.sparkline.length >= 3
                      ? topAdvisorStats.sparkline
                      : monthlySolicitudesData
                  }
                />
              </section>
            );
          })()}

          {/* HORIZONTAL REFERENCE LINE (Feathered at ends) */}
          <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-neutral-300 to-transparent my-1" />

          {/* ROW 1: STANDARD (50% | 25% | 25%) OR MTD COMPARISON (ZONAS 50% + ASESORES 50% ARRIBA, COMPARATIVA 100% ABAJO) */}
          {trendViewMode === "mtdComparison" ? (
            <div className="space-y-4">
              {/* FILA SUPERIOR: VENTAS POR ZONA (50%) Y TOP ASESORES (50%) */}
              <section className="grid grid-cols-1 lg:grid-cols-12 relative gap-4">
                <div className="lg:col-span-6 min-h-[380px] relative">
                  <SalesByRegionCard
                    title="Ventas por Zona"
                    subtitle={
                      filters.advisors.length > 0
                        ? `Zonas atendidas por ${filters.advisors[0]} (${formatNumber(filteredData.length)} inst.)`
                        : filters.technicians.length > 0
                        ? `Zonas atendidas por ${filters.technicians[0]} (${formatNumber(filteredData.length)} inst.)`
                        : momStats.isSingleMonth
                        ? `Distribución en ${formatProperCase(momStats.selectedMonth)} (${formatNumber(filteredData.length)} inst.)`
                        : "Distribución geográfica por zonas operativas"
                    }
                    data={zonesWithAnnualHistory}
                    totalCount={filteredData.length}
                    onSelectZone={(zone) => handleFilterChange("zones", zone)}
                    selectedZone={filters.zones[0]}
                  />
                </div>

                <div className="lg:col-span-6 min-h-[380px] relative">
                  <div className="hidden lg:block absolute left-0 top-6 bottom-6 w-[1px] bg-gradient-to-b from-transparent via-neutral-300 to-transparent pointer-events-none" />
                  <PersonalBreakdownCard
                    installations={filteredDataWithoutAdvisor}
                    solicitudes={filteredSolicitudesWithoutAdvisor}
                    selectedAdvisor={filters.advisors[0]}
                    onSelectAdvisor={handleSelectAdvisor}
                    selectedMonth={filters.months[0]}
                  />
                </div>
              </section>

              {/* LÍNEA DIVISORIA SUTIL */}
              <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-neutral-300 to-transparent my-1" />

              {/* FILA INFERIOR: COMPARATIVA MTD OCUPANDO TODO HASTA LA DERECHA (ANCHO COMPLETO 100%) */}
              <section className="w-full">
                <SalesTrendBarChart
                  title="Rendimiento Mensual"
                  subtitle="Comparativa temporal y normalización día por día"
                  data={monthlyTrendData}
                  installations={filteredDataWithoutMonthOrDate}
                  solicitudes={filteredSolicitudesWithoutMonthOrDate}
                  onSelectMonth={handleSelectMonth}
                  selectedMonth={filters.months[0]}
                  onSelectDate={handleSelectDate}
                  selectedDate={filters.dateFrom && filters.dateFrom === filters.dateTo ? filters.dateFrom : ""}
                  viewMode={trendViewMode}
                  onViewModeChange={setTrendViewMode}
                />
              </section>
            </div>
          ) : (
            <section className="grid grid-cols-1 lg:grid-cols-12 relative gap-y-4">
              {/* 1. RENDIMIENTO MENSUAL */}
              <div className="lg:col-span-6 min-h-[380px] relative">
                <SalesTrendBarChart
                  title="Rendimiento Mensual"
                  subtitle={
                    filters.advisors.length > 0
                      ? `Evolución mensual de ${filters.advisors[0]} • Corte al día ${momStats.maxDay}`
                      : filters.technicians.length > 0
                      ? `Evolución mensual de ${filters.technicians[0]} • Corte al día ${momStats.maxDay}`
                      : filters.dateFrom && filters.dateFrom === filters.dateTo
                      ? `Día ${filters.dateFrom.split("-")[2]} filtrado • Comparativa vs promedio`
                      : momStats.isPartialMonth && momStats.inst.prevMonth
                      ? `Evolución mensual • Corte al día ${momStats.maxDay} en ${formatProperCase(momStats.selectedMonth)}`
                      : momStats.isSingleMonth
                      ? `Evolución mensual • ${formatProperCase(momStats.selectedMonth)} consolidado`
                      : "Evolución histórica y comparativa mensual"
                  }
                  data={monthlyTrendData}
                  installations={filteredDataWithoutMonthOrDate}
                  solicitudes={filteredSolicitudesWithoutMonthOrDate}
                  onSelectMonth={handleSelectMonth}
                  selectedMonth={filters.months[0]}
                  onSelectDate={handleSelectDate}
                  selectedDate={filters.dateFrom && filters.dateFrom === filters.dateTo ? filters.dateFrom : ""}
                  viewMode={trendViewMode}
                  onViewModeChange={setTrendViewMode}
                />
              </div>

              {/* 2. VENTAS POR ZONA */}
              <div className="lg:col-span-3 min-h-[380px] relative">
                <div className="hidden lg:block absolute left-0 top-6 bottom-6 w-[1px] bg-gradient-to-b from-transparent via-neutral-300 to-transparent pointer-events-none" />
                <SalesByRegionCard
                  title="Ventas por Zona"
                  subtitle={
                    filters.advisors.length > 0
                      ? `Zonas atendidas por ${filters.advisors[0]} (${formatNumber(filteredData.length)} inst.)`
                      : filters.technicians.length > 0
                      ? `Zonas atendidas por ${filters.technicians[0]} (${formatNumber(filteredData.length)} inst.)`
                      : momStats.isSingleMonth
                      ? `Distribución en ${formatProperCase(momStats.selectedMonth)} (${formatNumber(filteredData.length)} inst.)`
                      : "Distribución geográfica por zonas operativas"
                  }
                  data={zonesWithAnnualHistory}
                  totalCount={filteredData.length}
                  onSelectZone={(zone) => handleFilterChange("zones", zone)}
                  selectedZone={filters.zones[0]}
                />
              </div>

              {/* 3. DESGLOSE DE PERSONAL */}
              <div className="lg:col-span-3 min-h-[380px] relative">
                <div className="hidden lg:block absolute left-0 top-6 bottom-6 w-[1px] bg-gradient-to-b from-transparent via-neutral-300 to-transparent pointer-events-none" />
                <PersonalBreakdownCard
                  installations={filteredDataWithoutAdvisor}
                  solicitudes={filteredSolicitudesWithoutAdvisor}
                  selectedAdvisor={filters.advisors[0]}
                  onSelectAdvisor={handleSelectAdvisor}
                  selectedMonth={filters.months[0]}
                />
              </div>
            </section>
          )}

          {/* HORIZONTAL REFERENCE LINE (Feathered at ends) */}
          <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-neutral-300 to-transparent my-1" />

          {/* ROW 2: 4 COLUMNS (25% | 25% | 25% | 25%) SEPARATED BY FEATHERED VERTICAL REFERENCE LINES */}
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 relative">
            {/* COL 1: SECTORES */}
            <div className="min-h-[340px] relative">
              <SectorsCard
                title="Sectores Principales"
                subtitle={
                  filters.sectors.length > 0
                    ? `Sector seleccionado: ${filters.sectors[0]} (${formatNumber(filteredData.length)} inst.)`
                    : filters.advisors.length > 0
                    ? `Sectores atendidos por ${filters.advisors[0]}`
                    : filters.technicians.length > 0
                    ? `Sectores atendidos por ${filters.technicians[0]}`
                    : momStats.isSingleMonth
                    ? `Sectores con mayor volumen en ${formatProperCase(momStats.selectedMonth)}`
                    : "Sectores urbanos con mayor concentración de instalaciones"
                }
                data={sectorsData}
                onSelectSector={handleSelectSector}
                selectedSector={filters.sectors[0]}
              />
            </div>

            {/* COL 2: TÉCNICOS */}
            <div className="min-h-[340px] relative">
              {/* Vertical feathered reference line on left */}
              <div className="hidden md:block absolute left-0 top-6 bottom-6 w-[1px] bg-gradient-to-b from-transparent via-neutral-300 to-transparent pointer-events-none" />
              <TechniciansCard
                title="Técnicos de Campo"
                subtitle={
                  filters.technicians.length > 0
                    ? `Técnico seleccionado: ${filters.technicians[0]} (${formatNumber(filteredData.length)} inst.)`
                    : filters.advisors.length > 0
                    ? `Técnicos que instalaron ventas de ${filters.advisors[0]}`
                    : filters.sectors.length > 0
                    ? `Técnicos desplegados en ${filters.sectors[0]}`
                    : momStats.isSingleMonth
                    ? `Instalaciones asignadas en ${formatProperCase(momStats.selectedMonth)}`
                    : "Instalaciones ejecutadas por cuadrillas técnicas"
                }
                data={techsWithAnnualHistory}
                onSelectTechnician={handleSelectTechnician}
                selectedTechnician={filters.technicians[0]}
              />
            </div>

            {/* COL 3: TIPO DE CONEXIÓN / SOLICITUD */}
            <div className="min-h-[340px] relative">
              {/* Vertical feathered reference line on left */}
              <div className="hidden md:block absolute left-0 top-6 bottom-6 w-[1px] bg-gradient-to-b from-transparent via-neutral-300 to-transparent pointer-events-none" />
              <ConnectionTypeCard
                title="Tipo de Solicitud / Conexión"
                subtitle={
                  momStats.isSingleMonth
                    ? `Estatus en ${formatProperCase(momStats.selectedMonth)} (altas, mudanzas, convenios)`
                    : "Desglose por modalidad operativa (altas, mudanzas, convenios)"
                }
                data={metrics?.charts?.byStatus || []}
                totalCount={filteredData.length}
                onSelectStatus={(st) => handleFilterChange("statuses", st)}
                selectedStatus={filters.statuses[0]}
              />
            </div>

            {/* COL 4: PLANES CONTRATADOS */}
            <div className="min-h-[340px] relative">
              {/* Vertical feathered reference line on left */}
              <div className="hidden md:block absolute left-0 top-6 bottom-6 w-[1px] bg-gradient-to-b from-transparent via-neutral-300 to-transparent pointer-events-none" />
              <PlansCard
                title="Planes Contratados"
                subtitle={
                  momStats.isSingleMonth
                    ? `Velocidades y paquetes en ${formatProperCase(momStats.selectedMonth)}`
                    : "Distribución por velocidades y planes contratados"
                }
                currentPeriod={filters.months[0] ? formatProperCase(filters.months[0]) : "Todos los meses"}
                data={metrics?.charts?.byPlan || []}
                totalCount={filteredData.length}
                onSelectPlan={(plan) => handleFilterChange("plans" as any, plan)}
                selectedPlan={filters.plans?.[0]}
              />
            </div>
          </section>
        </div>
      </main>

      {/* CENTRO DE COMPARATIVAS MULTIDIMENSIONAL (⌘B) */}
      <ComparisonModal
        isOpen={comparisonModalOpen}
        onClose={() => setComparisonModalOpen(false)}
        rawData={rawData}
        rawSolicitudes={rawSolicitudes}
        options={options}
      />

      {/* MODAL CONFIGURADOR INTEGRAL DE PERSONAL (ASESORES, TÉCNICOS Y DEPARTAMENTOS) */}
      <AdvisorConfigModal
        isOpen={advisorConfigOpen}
        onClose={() => setAdvisorConfigOpen(false)}
        initialTab={configInitialTab}
        advisorsList={metrics?.charts?.byAdvisor || []}
        techniciansList={metrics?.charts?.byTechnician || []}
        currentOverrides={advisorOverrides}
        currentAliases={advisorAliases}
        currentTechOverrides={techOverrides}
        currentTechAliases={techAliases}
        onSaveOverrides={handleSaveOverrides}
      />
    </div>
  );
}
