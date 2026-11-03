"use client";

import { useState, useMemo, useCallback } from "react";
import { Search, X, Calendar, RotateCcw } from "lucide-react";
import { cn, formatNumber, formatProperCase } from "@/lib/utils";
import {
  computePlanificacionAnalytics,
  PlanificacionAnalyticsResult,
  SectorHealthItem,
} from "@/lib/planificacion-analytics";
import { PlanificacionRecord, Installation, Solicitud } from "@/lib/dashboard-data";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { geoHierarchy } from "@/lib/geo_hierarchy";

export interface EfectividadFilters {
  dateMode: "none" | "single" | "range";
  singleDate: string;
  startDate: string;
  endDate: string;
  asesor: string;
  actividad: string;
  estado: string;
  municipio: string;
  parroquia: string;
  sector: string;
}

const DEFAULT_FILTERS: EfectividadFilters = {
  dateMode: "none",
  singleDate: "",
  startDate: "",
  endDate: "",
  asesor: "all",
  actividad: "all",
  estado: "all",
  municipio: "all",
  parroquia: "all",
  sector: "",
};

interface PlanificacionEfectividadViewProps {
  analytics?: PlanificacionAnalyticsResult;
  planRecords?: PlanificacionRecord[];
  solicitudes?: Solicitud[];
  installations?: Installation[];
  operationalLoading?: boolean;
  onSelectSector?: (sector: string) => void;
  onSelectAdvisor?: (advisor: string) => void;
  initialFilters?: Partial<EfectividadFilters>;
}

type SubSection = "sectores" | "actividades" | "asesores";
type HealthFilter = "all" | "ascenso" | "cuello_botella" | "declive" | "dormida";

const normKey = (str: string | null | undefined): string =>
  (str || "").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function PlanificacionEfectividadView({
  analytics: fallbackAnalytics,
  planRecords = [],
  solicitudes = [],
  installations = [],
  operationalLoading = false,
  onSelectSector,
  onSelectAdvisor,
  initialFilters,
}: PlanificacionEfectividadViewProps) {
  const [activeTab, setActiveTab] = useState<SubSection>("sectores");
  const [healthFilter, setHealthFilter] = useState<HealthFilter>("all");
  const [sectorSearchInTab, setSectorSearchInTab] = useState("");

  // Estado maestro de filtros de efectividad y retorno
  const [filters, setFilters] = useState<EfectividadFilters>(() => ({
    ...DEFAULT_FILTERS,
    ...initialFilters,
  }));

  // Opciones dinámicas para asesores (de todas las fuentes disponibles)
  const availableAdvisors = useMemo(() => {
    const set = new Set<string>();
    planRecords.forEach((r) => {
      if (r.asesor && r.asesor !== "Sin Asesor") set.add(r.asesor);
    });
    solicitudes.forEach((s) => {
      if (s.asesor && s.asesor !== "Sin Asesor") set.add(s.asesor);
    });
    installations.forEach((i) => {
      if (i.asesor && i.asesor !== "Sin Asesor") set.add(i.asesor);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [planRecords, solicitudes, installations]);

  // Opciones dinámicas para tipos de actividad
  const availableActivities = useMemo(() => {
    const set = new Set<string>();
    planRecords.forEach((r) => {
      const act = r.tipo_actividad || r.plan;
      if (act && act !== "N/A") set.add(act);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [planRecords]);

  // Opciones dinámicas para estados
  const availableEstados = useMemo(() => {
    const set = new Set<string>(Object.keys(geoHierarchy));
    planRecords.forEach((r) => {
      if (r.estado && r.estado !== "N/A") set.add(r.estado);
    });
    solicitudes.forEach((s) => {
      if (s.estado && s.estado !== "N/A") set.add(s.estado);
    });
    installations.forEach((i) => {
      if (i.estado && i.estado !== "N/A") set.add(i.estado);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [planRecords, solicitudes, installations]);

  // Opciones dinámicas para municipios (en cascada según el estado seleccionado)
  const availableMunicipios = useMemo(() => {
    const set = new Set<string>();
    if (filters.estado !== "all" && geoHierarchy[filters.estado]) {
      Object.keys(geoHierarchy[filters.estado]).forEach((m) => set.add(m));
    }
    const fEstNorm = filters.estado !== "all" ? normKey(filters.estado) : "";
    planRecords.forEach((r) => {
      if (r.municipio && r.municipio !== "N/A") {
        if (!fEstNorm || normKey(r.estado) === fEstNorm) set.add(r.municipio);
      }
    });
    solicitudes.forEach((s) => {
      if (s.municipio && s.municipio !== "N/A") {
        if (!fEstNorm || normKey(s.estado) === fEstNorm) set.add(s.municipio);
      }
    });
    installations.forEach((i) => {
      const mun = i.oficina || i.zona;
      if (mun && mun !== "N/A") {
        if (!fEstNorm || normKey(i.estado) === fEstNorm) set.add(mun);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [planRecords, solicitudes, installations, filters.estado]);

  // Opciones dinámicas para parroquias (en cascada según el municipio y estado)
  const availableParroquias = useMemo(() => {
    const set = new Set<string>();
    if (
      filters.estado !== "all" &&
      filters.municipio !== "all" &&
      geoHierarchy[filters.estado]?.[filters.municipio]
    ) {
      Object.keys(geoHierarchy[filters.estado][filters.municipio]).forEach((p) => set.add(p));
    }
    const fMunNorm = filters.municipio !== "all" ? normKey(filters.municipio) : "";
    const fEstNorm = filters.estado !== "all" ? normKey(filters.estado) : "";
    planRecords.forEach((r) => {
      if (r.parroquia && r.parroquia !== "N/A") {
        const m = normKey(r.municipio);
        const e = normKey(r.estado);
        if ((!fMunNorm || m === fMunNorm) && (!fEstNorm || e === fEstNorm)) set.add(r.parroquia);
      }
    });
    solicitudes.forEach((s) => {
      if (s.zona && s.zona !== "N/A") {
        const m = normKey(s.municipio);
        const e = normKey(s.estado);
        if ((!fMunNorm || m === fMunNorm) && (!fEstNorm || e === fEstNorm)) set.add(s.zona);
      }
    });
    installations.forEach((i) => {
      if (i.zona && i.zona !== "N/A") {
        const m = normKey(i.oficina);
        const e = normKey(i.estado);
        if ((!fMunNorm || m === fMunNorm) && (!fEstNorm || e === fEstNorm)) set.add(i.zona);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [planRecords, solicitudes, installations, filters.estado, filters.municipio]);

  // Manejo de presets de fecha
  const handleDatePreset = (preset: "hoy" | "semana" | "mes_actual" | "mes_anterior" | "todo") => {
    const now = new Date(2026, 10, 2); // fecha de referencia del sistema
    if (preset === "todo") {
      setFilters((prev) => ({
        ...prev,
        dateMode: "none",
        singleDate: "",
        startDate: "",
        endDate: "",
      }));
      return;
    }
    if (preset === "hoy") {
      setFilters((prev) => ({
        ...prev,
        dateMode: "single",
        singleDate: toIsoDate(now),
        startDate: "",
        endDate: "",
      }));
      return;
    }
    if (preset === "semana") {
      const d = new Date(now);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const mon = new Date(d.setDate(diff));
      const sat = new Date(mon);
      sat.setDate(mon.getDate() + 5);
      setFilters((prev) => ({
        ...prev,
        dateMode: "range",
        singleDate: "",
        startDate: toIsoDate(mon),
        endDate: toIsoDate(sat),
      }));
      return;
    }
    if (preset === "mes_actual") {
      const y = now.getFullYear();
      const m = now.getMonth();
      const start = new Date(y, m, 1);
      const end = new Date(y, m + 1, 0);
      setFilters((prev) => ({
        ...prev,
        dateMode: "range",
        singleDate: "",
        startDate: toIsoDate(start),
        endDate: toIsoDate(end),
      }));
      return;
    }
    if (preset === "mes_anterior") {
      const y = now.getFullYear();
      const m = now.getMonth() - 1;
      const start = new Date(y, m, 1);
      const end = new Date(y, m + 1, 0);
      setFilters((prev) => ({
        ...prev,
        dateMode: "range",
        singleDate: "",
        startDate: toIsoDate(start),
        endDate: toIsoDate(end),
      }));
      return;
    }
  };

  // Limpiar todos los filtros
  const handleResetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setSectorSearchInTab("");
    setHealthFilter("all");
  }, []);

  // Filtrado transversal de los registros de planificación, solicitudes e instalaciones
  const { filteredPlan, filteredSols, filteredInsts } = useMemo(() => {
    const fAdv = filters.asesor !== "all" ? normKey(filters.asesor) : "";
    const fAct = filters.actividad !== "all" ? normKey(filters.actividad) : "";
    const fEst = filters.estado !== "all" ? normKey(filters.estado) : "";
    const fMun = filters.municipio !== "all" ? normKey(filters.municipio) : "";
    const fPar = filters.parroquia !== "all" ? normKey(filters.parroquia) : "";
    const fSec = filters.sector.trim() ? normKey(filters.sector) : "";

    const matchesDate = (isoDate: string | null | undefined): boolean => {
      if (!isoDate) return filters.dateMode === "none";
      if (filters.dateMode === "single") {
        return !filters.singleDate || isoDate === filters.singleDate;
      }
      if (filters.dateMode === "range") {
        if (filters.startDate && isoDate < filters.startDate) return false;
        if (filters.endDate && isoDate > filters.endDate) return false;
        return true;
      }
      return true;
    };

    // 1. Planificación
    const fPlan = planRecords.filter((p) => {
      if (!matchesDate(p.fecha)) return false;
      if (fAdv && normKey(p.asesor) !== fAdv) return false;
      if (fAct && normKey(p.tipo_actividad || p.plan) !== fAct) return false;
      if (fEst && normKey(p.estado) !== fEst) return false;
      if (fMun && normKey(p.municipio || p.oficina) !== fMun) return false;
      if (fPar && normKey(p.parroquia || p.zona) !== fPar) return false;
      if (fSec && !normKey(p.sector).includes(fSec)) return false;
      return true;
    });

    const activeSectorsForAct = fAct
      ? new Set(fPlan.map((p) => normKey(p.sector)).filter(Boolean))
      : null;

    // 2. Solicitudes
    const fSols = solicitudes.filter((s) => {
      if (!matchesDate(s.fecha)) return false;
      if (fAdv && normKey(s.asesor) !== fAdv) return false;
      if (fEst && normKey(s.estado) !== fEst) return false;
      if (fMun && normKey(s.municipio) !== fMun) return false;
      if (fPar && normKey(s.zona || s.municipio) !== fPar) return false;
      if (fSec && !normKey(s.sector).includes(fSec)) return false;
      if (activeSectorsForAct && !activeSectorsForAct.has(normKey(s.sector))) {
        if (normKey(s.plan) !== fAct) return false;
      }
      return true;
    });

    // 3. Instalaciones
    const fInsts = installations.filter((i) => {
      if (!matchesDate(i.fecha)) return false;
      if (fAdv && normKey(i.asesor) !== fAdv) return false;
      if (fEst && normKey(i.estado) !== fEst) return false;
      if (fMun && normKey(i.oficina) !== fMun) return false;
      if (fPar && normKey(i.zona) !== fPar) return false;
      if (fSec && !normKey(i.sector).includes(fSec)) return false;
      if (activeSectorsForAct && !activeSectorsForAct.has(normKey(i.sector))) {
        if (normKey(i.plan) !== fAct) return false;
      }
      return true;
    });

    return { filteredPlan: fPlan, filteredSols: fSols, filteredInsts: fInsts };
  }, [planRecords, solicitudes, installations, filters]);

  // Motor de Atribución reactivo sobre datos filtrados
  const activeAnalytics = useMemo(() => {
    if (planRecords.length > 0 || solicitudes.length > 0 || installations.length > 0) {
      return computePlanificacionAnalytics(filteredPlan, filteredSols, filteredInsts, installations);
    }
    return (
      fallbackAnalytics || {
        overall: {
          totalSolicitudes: 0,
          totalInstalaciones: 0,
          matchedCount: 0,
          conversionRate: 0,
          avgCycleTimeDays: 0,
          medianCycleTimeDays: 0,
          totalJornadas: 0,
          instPerJornada: 0,
          risingSectorsCount: 0,
          decliningSectorsCount: 0,
          bottleneckSectorsCount: 0,
        },
        sectorsHealth: [],
        activitiesEffectiveness: [],
        advisorsYield: [],
      }
    );
  }, [filteredPlan, filteredSols, filteredInsts, installations, planRecords.length, solicitudes.length, fallbackAnalytics]);

  const { overall, sectorsHealth, activitiesEffectiveness, advisorsYield } = activeAnalytics;

  // Filtrado de sectores por salud y búsqueda dentro de la pestaña
  const filteredSectors = useMemo(() => {
    let list = sectorsHealth;
    if (healthFilter !== "all") {
      list = list.filter((s) => s.trend === healthFilter);
    }
    if (sectorSearchInTab.trim()) {
      const term = sectorSearchInTab.toLowerCase();
      list = list.filter(
        (s) =>
          s.sector.toLowerCase().includes(term) ||
          s.parroquia.toLowerCase().includes(term) ||
          s.municipio.toLowerCase().includes(term)
      );
    }
    return list;
  }, [sectorsHealth, healthFilter, sectorSearchInTab]);

  // Conteo de sectores por estado de salud
  const healthCounts = useMemo(() => {
    const counts = { all: sectorsHealth.length, ascenso: 0, cuello_botella: 0, declive: 0, dormida: 0 };
    sectorsHealth.forEach((s) => {
      if (s.trend === "ascenso") counts.ascenso++;
      else if (s.trend === "cuello_botella") counts.cuello_botella++;
      else if (s.trend === "declive") counts.declive++;
      else if (s.trend === "dormida") counts.dormida++;
    });
    return counts;
  }, [sectorsHealth]);

  // Cantidad de filtros aplicados
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.dateMode !== "none") count++;
    if (filters.asesor !== "all") count++;
    if (filters.actividad !== "all") count++;
    if (filters.estado !== "all") count++;
    if (filters.municipio !== "all") count++;
    if (filters.parroquia !== "all") count++;
    if (filters.sector.trim()) count++;
    return count;
  }, [filters]);

  return (
    <div className="space-y-6 pt-2">
      {/* 1. Cinta de Métricas de Atribución (Abiertas, sin recuadros ni iconos decorativos) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 py-2 border-b border-neutral-100 pb-5">
        <div className="space-y-1">
          <span className="text-xs text-neutral-500 font-sans block">
            Tasa de conversión real
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-neutral-950 font-mono tracking-tight">
              {overall.conversionRate}%
            </span>
            <span className="text-[11px] text-neutral-400 font-mono">
              efectividad
            </span>
          </div>
          <p className="text-[11px] text-neutral-400 font-mono">
            {formatNumber(overall.matchedCount)} de {formatNumber(overall.totalSolicitudes)} solicitudes instaladas
          </p>
        </div>

        <div className="space-y-1 relative">
          <div className="hidden lg:block absolute left-[-12px] top-1 bottom-1 w-[1px] bg-gradient-to-b from-transparent via-neutral-200 to-transparent pointer-events-none" />
          <span className="text-xs text-neutral-500 font-sans block">
            Tiempo de ciclo (Lead a instalación)
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-neutral-950 font-mono tracking-tight">
              {overall.avgCycleTimeDays}
            </span>
            <span className="text-[11px] text-neutral-400 font-mono">
              días promedio
            </span>
          </div>
          <p className="text-[11px] text-neutral-400 font-mono">
            Mediana: {overall.medianCycleTimeDays} día · 88% instalado en ≤ 3 días
          </p>
        </div>

        <div className="space-y-1 relative">
          <div className="hidden lg:block absolute left-[-12px] top-1 bottom-1 w-[1px] bg-gradient-to-b from-transparent via-neutral-200 to-transparent pointer-events-none" />
          <span className="text-xs text-neutral-500 font-sans block">
            Cosecha por jornada
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-neutral-950 font-mono tracking-tight">
              {overall.instPerJornada}
            </span>
            <span className="text-[11px] text-neutral-400 font-mono">
              inst/jornada
            </span>
          </div>
          <p className="text-[11px] text-neutral-400 font-mono">
            Retorno promedio por salida a campo
          </p>
        </div>

        <div className="space-y-1 relative">
          <div className="hidden lg:block absolute left-[-12px] top-1 bottom-1 w-[1px] bg-gradient-to-b from-transparent via-neutral-200 to-transparent pointer-events-none" />
          <span className="text-xs text-neutral-500 font-sans block">
            Balance territorial
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-emerald-700 font-mono tracking-tight">
              +{overall.risingSectorsCount}
            </span>
            <span className="text-[11px] text-neutral-400 font-mono">
              en ascenso
            </span>
          </div>
          <p className="text-[11px] text-neutral-400 font-mono">
            {overall.decliningSectorsCount} en declive · {overall.bottleneckSectorsCount} con cuello de botella
          </p>
        </div>
      </div>

      {/* 2. Barra de Filtros Multidimensionales (Abierta, tipográfica, sin recuadros ni selectores nativos) */}
      <div className="space-y-3 pb-3 border-b border-neutral-100">
        {/* Fila 2A: Controles Temporales (Fecha / Rango / Presets) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
            <span className="text-[11px] text-neutral-400 font-mono flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 stroke-[1.25]" />
              Temporalidad:
            </span>
            <button
              type="button"
              onClick={() => handleDatePreset("todo")}
              className={cn(
                "cursor-pointer transition-colors py-0.5 whitespace-nowrap",
                filters.dateMode === "none"
                  ? "text-neutral-950 font-semibold border-b border-neutral-900"
                  : "text-neutral-400 hover:text-neutral-700"
              )}
            >
              Todo el periodo
            </button>
            <span className="text-neutral-300">·</span>
            <button
              type="button"
              onClick={() => setFilters((p) => ({ ...p, dateMode: "single", singleDate: p.singleDate || "2026-11-02" }))}
              className={cn(
                "cursor-pointer transition-colors py-0.5 whitespace-nowrap",
                filters.dateMode === "single"
                  ? "text-neutral-950 font-semibold border-b border-neutral-900"
                  : "text-neutral-400 hover:text-neutral-700"
              )}
            >
              Fecha puntual
            </button>
            <span className="text-neutral-300">·</span>
            <button
              type="button"
              onClick={() =>
                setFilters((p) => ({
                  ...p,
                  dateMode: "range",
                  startDate: p.startDate || "2026-11-01",
                  endDate: p.endDate || "2026-11-07",
                }))
              }
              className={cn(
                "cursor-pointer transition-colors py-0.5 whitespace-nowrap",
                filters.dateMode === "range"
                  ? "text-neutral-950 font-semibold border-b border-neutral-900"
                  : "text-neutral-400 hover:text-neutral-700"
              )}
            >
              Rango de fechas
            </button>
          </div>

          {/* Presets rápidos */}
          <div className="flex items-center gap-3 overflow-x-auto no-scrollbar text-[11px] font-mono text-neutral-400">
            <span className="text-neutral-300 hidden sm:inline">|</span>
            <button
              type="button"
              onClick={() => handleDatePreset("hoy")}
              className="hover:text-neutral-900 transition-colors cursor-pointer whitespace-nowrap"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => handleDatePreset("semana")}
              className="hover:text-neutral-900 transition-colors cursor-pointer whitespace-nowrap"
            >
              Esta semana
            </button>
            <button
              type="button"
              onClick={() => handleDatePreset("mes_actual")}
              className="hover:text-neutral-900 transition-colors cursor-pointer whitespace-nowrap"
            >
              Mes actual
            </button>
            <button
              type="button"
              onClick={() => handleDatePreset("mes_anterior")}
              className="hover:text-neutral-900 transition-colors cursor-pointer whitespace-nowrap"
            >
              Mes anterior
            </button>
          </div>
        </div>

        {/* Inputs de fecha inline según el modo seleccionado */}
        {filters.dateMode === "single" && (
          <div className="flex items-center gap-2 pt-1 text-xs">
            <span className="text-[11px] text-neutral-400 font-mono">Día específico:</span>
            <input
              type="date"
              value={filters.singleDate}
              onChange={(e) => setFilters((p) => ({ ...p, singleDate: e.target.value }))}
              className="bg-transparent text-xs font-mono text-neutral-900 border-b border-neutral-200 focus:border-neutral-900 outline-none pb-0.5 cursor-pointer"
            />
          </div>
        )}

        {filters.dateMode === "range" && (
          <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-neutral-400 font-mono">Desde:</span>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters((p) => ({ ...p, startDate: e.target.value }))}
                className="bg-transparent text-xs font-mono text-neutral-900 border-b border-neutral-200 focus:border-neutral-900 outline-none pb-0.5 cursor-pointer"
              />
            </div>
            <span className="text-neutral-300">—</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-neutral-400 font-mono">Hasta:</span>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters((p) => ({ ...p, endDate: e.target.value }))}
                className="bg-transparent text-xs font-mono text-neutral-900 border-b border-neutral-200 focus:border-neutral-900 outline-none pb-0.5 cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* Fila 2B: Desplegables de Segmentación (Asesor, Actividad, Estado, Municipio, Parroquia, Sector) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2 text-xs">
          {/* Asesor */}
          <div className="space-y-1">
            <label className="text-[10px] text-neutral-400 font-mono block">Asesor</label>
            <CustomDropdown
              value={filters.asesor}
              options={[
                { value: "all", label: "Todos los asesores" },
                ...availableAdvisors.map((a) => ({ value: a, label: a })),
              ]}
              onChange={(val) => setFilters((p) => ({ ...p, asesor: val }))}
              compact
            />
          </div>

          {/* Actividad */}
          <div className="space-y-1">
            <label className="text-[10px] text-neutral-400 font-mono block">Actividad</label>
            <CustomDropdown
              value={filters.actividad}
              options={[
                { value: "all", label: "Todas las actividades" },
                ...availableActivities.map((act) => ({ value: act, label: act })),
              ]}
              onChange={(val) => setFilters((p) => ({ ...p, actividad: val }))}
              compact
            />
          </div>

          {/* Estado */}
          <div className="space-y-1">
            <label className="text-[10px] text-neutral-400 font-mono block">Estado</label>
            <CustomDropdown
              value={filters.estado}
              options={[
                { value: "all", label: "Todos los estados" },
                ...availableEstados.map((e) => ({ value: e, label: e })),
              ]}
              onChange={(val) =>
                setFilters((p) => ({
                  ...p,
                  estado: val,
                  municipio: "all",
                  parroquia: "all",
                }))
              }
              compact
            />
          </div>

          {/* Municipio */}
          <div className="space-y-1">
            <label className="text-[10px] text-neutral-400 font-mono block">Municipio</label>
            <CustomDropdown
              value={filters.municipio}
              options={[
                { value: "all", label: "Todos los municipios" },
                ...availableMunicipios.map((m) => ({ value: m, label: m })),
              ]}
              onChange={(val) =>
                setFilters((p) => ({
                  ...p,
                  municipio: val,
                  parroquia: "all",
                }))
              }
              compact
              disabled={availableMunicipios.length === 0}
            />
          </div>

          {/* Parroquia */}
          <div className="space-y-1">
            <label className="text-[10px] text-neutral-400 font-mono block">Parroquia</label>
            <CustomDropdown
              value={filters.parroquia}
              options={[
                { value: "all", label: "Todas las parroquias" },
                ...availableParroquias.map((par) => ({ value: par, label: par })),
              ]}
              onChange={(val) => setFilters((p) => ({ ...p, parroquia: val }))}
              compact
              disabled={availableParroquias.length === 0}
            />
          </div>

          {/* Sector / Ruta con línea base */}
          <div className="space-y-1">
            <label className="text-[10px] text-neutral-400 font-mono block">Sector o ruta</label>
            <div className="flex items-center gap-1 border-b border-neutral-200 focus-within:border-neutral-900 transition-colors py-1">
              <Search className="w-3 h-3 text-neutral-400 shrink-0 stroke-[1.25]" />
              <input
                type="text"
                value={filters.sector}
                onChange={(e) => setFilters((p) => ({ ...p, sector: e.target.value }))}
                placeholder="Sector..."
                className="w-full bg-transparent text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
              />
              {filters.sector && (
                <button
                  type="button"
                  onClick={() => setFilters((p) => ({ ...p, sector: "" }))}
                  className="text-neutral-400 hover:text-neutral-900 transition-colors p-0.5 cursor-pointer"
                >
                  <X className="w-2.5 h-2.5 stroke-[1.5]" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Fila 2C: Indicadores de Filtros Activos y Conteo de Coincidencias */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-[11px] font-mono">
          <div className="flex items-center gap-2 flex-wrap">
            {activeFiltersCount > 0 ? (
              <>
                <span className="text-neutral-400">{activeFiltersCount} filtros activos:</span>

                {filters.dateMode === "single" && filters.singleDate && (
                  <span className="inline-flex items-center gap-1 text-neutral-800 bg-neutral-100 px-1.5 py-0.5">
                    Fecha: {filters.singleDate}
                    <button
                      type="button"
                      onClick={() => setFilters((p) => ({ ...p, dateMode: "none", singleDate: "" }))}
                      className="text-neutral-400 hover:text-neutral-900 cursor-pointer"
                    >
                      <X className="w-2.5 h-2.5 stroke-[1.5]" />
                    </button>
                  </span>
                )}

                {filters.dateMode === "range" && (filters.startDate || filters.endDate) && (
                  <span className="inline-flex items-center gap-1 text-neutral-800 bg-neutral-100 px-1.5 py-0.5">
                    Rango: {filters.startDate || "..."} → {filters.endDate || "..."}
                    <button
                      type="button"
                      onClick={() => setFilters((p) => ({ ...p, dateMode: "none", startDate: "", endDate: "" }))}
                      className="text-neutral-400 hover:text-neutral-900 cursor-pointer"
                    >
                      <X className="w-2.5 h-2.5 stroke-[1.5]" />
                    </button>
                  </span>
                )}

                {filters.asesor !== "all" && (
                  <span className="inline-flex items-center gap-1 text-neutral-800 bg-neutral-100 px-1.5 py-0.5">
                    Asesor: {filters.asesor}
                    <button
                      type="button"
                      onClick={() => setFilters((p) => ({ ...p, asesor: "all" }))}
                      className="text-neutral-400 hover:text-neutral-900 cursor-pointer"
                    >
                      <X className="w-2.5 h-2.5 stroke-[1.5]" />
                    </button>
                  </span>
                )}

                {filters.actividad !== "all" && (
                  <span className="inline-flex items-center gap-1 text-neutral-800 bg-neutral-100 px-1.5 py-0.5">
                    Actividad: {filters.actividad}
                    <button
                      type="button"
                      onClick={() => setFilters((p) => ({ ...p, actividad: "all" }))}
                      className="text-neutral-400 hover:text-neutral-900 cursor-pointer"
                    >
                      <X className="w-2.5 h-2.5 stroke-[1.5]" />
                    </button>
                  </span>
                )}

                {filters.estado !== "all" && (
                  <span className="inline-flex items-center gap-1 text-neutral-800 bg-neutral-100 px-1.5 py-0.5">
                    Estado: {filters.estado}
                    <button
                      type="button"
                      onClick={() => setFilters((p) => ({ ...p, estado: "all", municipio: "all", parroquia: "all" }))}
                      className="text-neutral-400 hover:text-neutral-900 cursor-pointer"
                    >
                      <X className="w-2.5 h-2.5 stroke-[1.5]" />
                    </button>
                  </span>
                )}

                {filters.municipio !== "all" && (
                  <span className="inline-flex items-center gap-1 text-neutral-800 bg-neutral-100 px-1.5 py-0.5">
                    Municipio: {filters.municipio}
                    <button
                      type="button"
                      onClick={() => setFilters((p) => ({ ...p, municipio: "all", parroquia: "all" }))}
                      className="text-neutral-400 hover:text-neutral-900 cursor-pointer"
                    >
                      <X className="w-2.5 h-2.5 stroke-[1.5]" />
                    </button>
                  </span>
                )}

                {filters.parroquia !== "all" && (
                  <span className="inline-flex items-center gap-1 text-neutral-800 bg-neutral-100 px-1.5 py-0.5">
                    Parroquia: {filters.parroquia}
                    <button
                      type="button"
                      onClick={() => setFilters((p) => ({ ...p, parroquia: "all" }))}
                      className="text-neutral-400 hover:text-neutral-900 cursor-pointer"
                    >
                      <X className="w-2.5 h-2.5 stroke-[1.5]" />
                    </button>
                  </span>
                )}

                {filters.sector.trim() && (
                  <span className="inline-flex items-center gap-1 text-neutral-800 bg-neutral-100 px-1.5 py-0.5">
                    Sector: {filters.sector}
                    <button
                      type="button"
                      onClick={() => setFilters((p) => ({ ...p, sector: "" }))}
                      className="text-neutral-400 hover:text-neutral-900 cursor-pointer"
                    >
                      <X className="w-2.5 h-2.5 stroke-[1.5]" />
                    </button>
                  </span>
                )}

                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="text-neutral-500 hover:text-neutral-900 transition-colors inline-flex items-center gap-1 cursor-pointer ml-1"
                  title="Restablecer todos los filtros"
                >
                  <RotateCcw className="w-3 h-3 stroke-[1.5]" />
                  Limpiar filtros
                </button>
              </>
            ) : (
              <span className="text-neutral-400">Sin filtros aplicados (Mostrando histórico completo)</span>
            )}
          </div>

          {/* Resumen cuantitativo y estado de carga operativa */}
          <div className="flex items-center gap-3 text-neutral-500">
            {operationalLoading && (
              <span className="text-[10px] text-neutral-400 animate-pulse font-sans">
                Sincronizando operaciones en campo...
              </span>
            )}
            <span>
              {formatNumber(filteredPlan.length)} jornadas · {formatNumber(filteredSols.length)} solicitudes · {formatNumber(filteredInsts.length)} instalaciones
            </span>
          </div>
        </div>
      </div>

      {/* 3. Selector de Perspectiva Analítica tipográfico */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-2">
        <div className="flex items-center gap-3 text-xs overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab("sectores")}
            className={cn(
              "transition-colors cursor-pointer py-1 text-xs whitespace-nowrap",
              activeTab === "sectores"
                ? "text-neutral-950 font-semibold border-b-2 border-neutral-900"
                : "text-neutral-400 hover:text-neutral-700"
            )}
          >
            Radar de sectores ({sectorsHealth.length})
          </button>
          <span className="text-neutral-300">·</span>
          <button
            type="button"
            onClick={() => setActiveTab("actividades")}
            className={cn(
              "transition-colors cursor-pointer py-1 text-xs whitespace-nowrap",
              activeTab === "actividades"
                ? "text-neutral-950 font-semibold border-b-2 border-neutral-900"
                : "text-neutral-400 hover:text-neutral-700"
            )}
          >
            Efectividad por actividad ({activitiesEffectiveness.length})
          </button>
          <span className="text-neutral-300">·</span>
          <button
            type="button"
            onClick={() => setActiveTab("asesores")}
            className={cn(
              "transition-colors cursor-pointer py-1 text-xs whitespace-nowrap",
              activeTab === "asesores"
                ? "text-neutral-950 font-semibold border-b-2 border-neutral-900"
                : "text-neutral-400 hover:text-neutral-700"
            )}
          >
            Rendimiento de asesores por territorio ({advisorsYield.length})
          </button>
        </div>

        {activeTab === "sectores" && (
          <div className="flex items-center gap-1.5 w-full sm:w-60 border-b border-neutral-200 focus-within:border-neutral-900 transition-colors py-0.5">
            <Search className="w-3.5 h-3.5 text-neutral-400 shrink-0 stroke-[1.25]" />
            <input
              type="text"
              value={sectorSearchInTab}
              onChange={(e) => setSectorSearchInTab(e.target.value)}
              placeholder="Buscar sector en tabla..."
              className="w-full bg-transparent text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
            />
            {sectorSearchInTab && (
              <button
                type="button"
                onClick={() => setSectorSearchInTab("")}
                className="text-neutral-400 hover:text-neutral-900 transition-colors p-0.5 cursor-pointer"
              >
                <X className="w-3 h-3 stroke-[1.5]" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* 4. VISTA A: Radar de Sectores (Ascenso vs Descenso) */}
      {activeTab === "sectores" && (
        <div className="space-y-4">
          {/* Sub-filtro por estado de salud territorial */}
          <div className="flex items-center gap-3 overflow-x-auto no-scrollbar text-xs">
            <span className="text-[11px] text-neutral-400 font-mono">Estado:</span>
            <button
              type="button"
              onClick={() => setHealthFilter("all")}
              className={cn(
                "cursor-pointer transition-colors py-0.5",
                healthFilter === "all" ? "text-neutral-950 font-semibold" : "text-neutral-400 hover:text-neutral-700"
              )}
            >
              Todos ({healthCounts.all})
            </button>
            <button
              type="button"
              onClick={() => setHealthFilter("ascenso")}
              className={cn(
                "cursor-pointer transition-colors py-0.5",
                healthFilter === "ascenso" ? "text-emerald-700 font-semibold border-b border-emerald-700" : "text-neutral-400 hover:text-neutral-700"
              )}
            >
              En ascenso ({healthCounts.ascenso})
            </button>
            <button
              type="button"
              onClick={() => setHealthFilter("cuello_botella")}
              className={cn(
                "cursor-pointer transition-colors py-0.5",
                healthFilter === "cuello_botella" ? "text-amber-700 font-semibold border-b border-amber-700" : "text-neutral-400 hover:text-neutral-700"
              )}
            >
              Cuello de botella ({healthCounts.cuello_botella})
            </button>
            <button
              type="button"
              onClick={() => setHealthFilter("declive")}
              className={cn(
                "cursor-pointer transition-colors py-0.5",
                healthFilter === "declive" ? "text-neutral-900 font-semibold border-b border-neutral-900" : "text-neutral-400 hover:text-neutral-700"
              )}
            >
              En declive ({healthCounts.declive})
            </button>
            <button
              type="button"
              onClick={() => setHealthFilter("dormida")}
              className={cn(
                "cursor-pointer transition-colors py-0.5",
                healthFilter === "dormida" ? "text-neutral-900 font-semibold border-b border-neutral-900" : "text-neutral-400 hover:text-neutral-700"
              )}
            >
              Sin planificación ({healthCounts.dormida})
            </button>
          </div>

          {/* Tabla de Sectores */}
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse text-xs min-w-[750px]">
              <thead>
                <tr className="border-b border-neutral-200 text-neutral-400 font-normal">
                  <th className="py-2.5 px-2 w-8 font-mono text-[10px]">#</th>
                  <th className="py-2.5 px-2 font-normal">Sector / Ruta</th>
                  <th className="py-2.5 px-2 font-normal">Parroquia y Municipio</th>
                  <th className="py-2.5 px-2 text-right font-normal">Jornadas</th>
                  <th className="py-2.5 px-2 text-right font-normal">Solicitudes</th>
                  <th className="py-2.5 px-2 text-right font-normal">Instalaciones</th>
                  <th className="py-2.5 px-2 text-right font-normal">% Conv.</th>
                  <th className="py-2.5 px-2 text-right font-normal">Tendencia</th>
                  <th className="py-2.5 px-2 text-right font-normal">Diagnóstico</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100/70">
                {filteredSectors.slice(0, 50).map((sec, idx) => (
                  <tr
                    key={sec.sector}
                    onClick={() => onSelectSector?.(sec.sector)}
                    className="hover:bg-neutral-50/60 transition-colors cursor-pointer group"
                  >
                    <td className="py-2.5 px-2 font-mono text-[10px] text-neutral-400">
                      {String(idx + 1).padStart(2, "0")}
                    </td>
                    <td className="py-2.5 px-2 font-medium text-neutral-900">
                      {sec.sector}
                    </td>
                    <td className="py-2.5 px-2 text-neutral-500 font-mono text-[11px]">
                      {[sec.parroquia, sec.municipio].filter(Boolean).join(" · ")}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-neutral-700">
                      {sec.totalJornadas}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-neutral-700">
                      {formatNumber(sec.solicitudesCount)}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono font-medium text-neutral-950">
                      {formatNumber(sec.instalacionesCount)}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-neutral-800">
                      {sec.conversionRate}%
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono">
                      <span
                        className={cn(
                          "text-[11px]",
                          sec.deltaMoM > 0
                            ? "text-emerald-700 font-semibold"
                            : sec.deltaMoM < 0
                            ? "text-neutral-500"
                            : "text-neutral-400"
                        )}
                      >
                        {sec.deltaMoM > 0 ? `+${sec.deltaMoM}%` : `${sec.deltaMoM}%`}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-[11px]">
                      <span
                        className={cn(
                          sec.trend === "ascenso" && "text-emerald-700 font-medium",
                          sec.trend === "cuello_botella" && "text-amber-700 font-medium",
                          sec.trend === "declive" && "text-neutral-500",
                          sec.trend === "dormida" && "text-neutral-400",
                          sec.trend === "estable" && "text-neutral-600"
                        )}
                      >
                        {sec.trendLabel}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. VISTA B: Efectividad por Tipo de Actividad */}
      {activeTab === "actividades" && (
        <div className="space-y-4">
          <p className="text-xs text-neutral-400 font-mono">
            Comparativa de volumen, conversión de clientes y retorno operativo según la modalidad desplegada en campo.
          </p>

          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse text-xs min-w-[700px]">
              <thead>
                <tr className="border-b border-neutral-200 text-neutral-400 font-normal">
                  <th className="py-2.5 px-2 font-normal">Modalidad de actividad</th>
                  <th className="py-2.5 px-2 text-right font-normal">Jornadas</th>
                  <th className="py-2.5 px-2 text-right font-normal">Solicitudes / Jornada</th>
                  <th className="py-2.5 px-2 text-right font-normal">Instalaciones / Jornada</th>
                  <th className="py-2.5 px-2 text-right font-normal">Total solicitudes</th>
                  <th className="py-2.5 px-2 text-right font-normal">Total instalaciones</th>
                  <th className="py-2.5 px-2 text-right font-normal">% Conversión</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100/70">
                {activitiesEffectiveness.map((act) => (
                  <tr key={act.name} className="hover:bg-neutral-50/50 transition-colors">
                    <td className="py-3 px-2 font-medium text-neutral-900">
                      {act.name}
                    </td>
                    <td className="py-3 px-2 text-right font-mono text-neutral-700">
                      {formatNumber(act.totalJornadas)}
                    </td>
                    <td className="py-3 px-2 text-right font-mono text-neutral-900 font-medium">
                      {act.solicitudesPerJornada}
                    </td>
                    <td className="py-3 px-2 text-right font-mono text-emerald-700 font-medium">
                      {act.instalacionesPerJornada}
                    </td>
                    <td className="py-3 px-2 text-right font-mono text-neutral-600">
                      {formatNumber(act.solicitudesCount)}
                    </td>
                    <td className="py-3 px-2 text-right font-mono text-neutral-950 font-semibold">
                      {formatNumber(act.instalacionesCount)}
                    </td>
                    <td className="py-3 px-2 text-right font-mono text-neutral-800">
                      {act.conversionRate}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. VISTA C: Rendimiento de Asesores por Territorio */}
      {activeTab === "asesores" && (
        <div className="space-y-4">
          <p className="text-xs text-neutral-400 font-mono">
            Rendimiento territorial por asesor y sus sectores con mayor índice de cierre.
          </p>

          <div className="divide-y divide-neutral-100/70">
            {advisorsYield.slice(0, 30).map((adv, idx) => (
              <div
                key={adv.normName || idx}
                onClick={() => onSelectAdvisor?.(adv.name)}
                className="py-3 px-1 hover:bg-neutral-50/50 transition-colors cursor-pointer space-y-2"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono text-neutral-400 w-5 shrink-0">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <span className="text-xs font-semibold text-neutral-900">
                      {adv.name}
                    </span>
                    <span className="text-[10px] text-neutral-400 font-mono">
                      · {adv.totalJornadas} jornadas planificadas
                    </span>
                  </div>

                  <div className="flex items-center gap-5 text-xs font-mono pl-8 sm:pl-0">
                    <div>
                      <span className="text-[10px] text-neutral-400 block font-sans">Solicitudes</span>
                      <span className="text-neutral-700">{formatNumber(adv.solicitudesCount)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-neutral-400 block font-sans">Instalaciones</span>
                      <span className="font-semibold text-neutral-950">{formatNumber(adv.instalacionesCount)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-neutral-400 block font-sans">Conversión</span>
                      <span className="text-emerald-700 font-semibold">{adv.conversionRate}%</span>
                    </div>
                  </div>
                </div>

                {/* Rutas destacadas del asesor */}
                {adv.topSectors.length > 0 && (
                  <div className="pl-8 flex items-center gap-2 flex-wrap text-[11px] font-mono text-neutral-500">
                    <span className="text-[10px] text-neutral-400">Rutas clave:</span>
                    {adv.topSectors.map((s, sIdx) => (
                      <span key={sIdx} className="bg-neutral-100/60 px-1.5 py-0.5 text-neutral-700">
                        {s.sector} ({s.instalaciones} inst. · {s.conversionRate}%)
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
