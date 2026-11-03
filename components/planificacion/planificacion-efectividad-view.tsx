"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Search, X, Calendar, RotateCcw } from "lucide-react";
import { cn, formatNumber, formatProperCase } from "@/lib/utils";
import {
  computePlanificacionAnalytics,
  PlanificacionAnalyticsResult,
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
  estado: string;
  municipio: string;
  parroquia: string;
  sector: string;
  actividad: string;
}

const DEFAULT_FILTERS: EfectividadFilters = {
  dateMode: "none",
  singleDate: "",
  startDate: "",
  endDate: "",
  asesor: "all",
  estado: "all",
  municipio: "all",
  parroquia: "all",
  sector: "",
  actividad: "all",
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

const normKey = (str: string | null | undefined): string =>
  (str || "").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

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
    clean !== "OFICINA" &&
    clean !== "SIN MUNICIPIO"
  );
};

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function PlanificacionEfectividadView({
  planRecords = [],
  solicitudes = [],
  installations = [],
  operationalLoading = false,
  onSelectSector,
  onSelectAdvisor,
  initialFilters,
}: PlanificacionEfectividadViewProps) {
  // Estado maestro de filtros
  const [filters, setFilters] = useState<EfectividadFilters>(() => ({
    ...DEFAULT_FILTERS,
    ...initialFilters,
  }));

  const [tableSearch, setTableSearch] = useState("");

  // =========================================================================
  // FILTRADO CRUZADO TOTAL (CROSS-FILTERING BIDIRECCIONAL)
  // Cada selector calcula sus opciones basadas en todos los demás filtros activos.
  // =========================================================================

  const matchesFilter = useCallback(
    (
      r: {
        fecha?: string | null;
        asesor?: string | null;
        estado?: string | null;
        municipio?: string | null;
        parroquia?: string | null;
        sector?: string | null;
        tipo_actividad?: string | null;
        plan?: string | null;
      },
      ignoreField?: "date" | "asesor" | "estado" | "municipio" | "parroquia" | "sector" | "actividad"
    ) => {
      // 1. Fecha o Rango
      if (ignoreField !== "date" && filters.dateMode !== "none") {
        if (!r.fecha) return false;
        if (filters.dateMode === "single") {
          if (filters.singleDate && r.fecha !== filters.singleDate) return false;
        } else if (filters.dateMode === "range") {
          if (filters.startDate && r.fecha < filters.startDate) return false;
          if (filters.endDate && r.fecha > filters.endDate) return false;
        }
      }

      // 2. Asesor
      if (ignoreField !== "asesor" && filters.asesor !== "all") {
        if (normKey(r.asesor) !== normKey(filters.asesor)) return false;
      }

      // 3. Estado
      if (ignoreField !== "estado" && filters.estado !== "all") {
        if (normKey(r.estado) !== normKey(filters.estado)) return false;
      }

      // 4. Municipio
      if (ignoreField !== "municipio" && filters.municipio !== "all") {
        if (normKey(r.municipio) !== normKey(filters.municipio)) return false;
      }

      // 5. Parroquia
      if (ignoreField !== "parroquia" && filters.parroquia !== "all") {
        if (normKey(r.parroquia) !== normKey(filters.parroquia)) return false;
      }

      // 6. Sector
      if (ignoreField !== "sector" && filters.sector.trim()) {
        if (!normKey(r.sector).includes(normKey(filters.sector))) return false;
      }

      // 7. Actividad
      if (ignoreField !== "actividad" && filters.actividad !== "all") {
        const act = r.tipo_actividad || r.plan;
        if (normKey(act) !== normKey(filters.actividad)) return false;
      }

      return true;
    },
    [filters]
  );

  // 1. Asesores disponibles (Filtro cruzado: solo comerciales activos que coincidan con los demás filtros)
  const availableAdvisors = useMemo(() => {
    const set = new Set<string>();

    planRecords.forEach((r) => {
      if (!isValidGeoName(r.asesor)) return;
      if (r.tipo_asesor && r.tipo_asesor !== "comercial") return;
      if (r.es_ex_colaborador) return;

      if (matchesFilter(r, "asesor")) {
        set.add(r.asesor.trim());
      }
    });

    solicitudes.forEach((s) => {
      if (!isValidGeoName(s.asesor)) return;
      if (s.tipo_asesor && s.tipo_asesor !== "comercial") return;
      if (s.es_ex_colaborador) return;

      if (matchesFilter(s, "asesor")) {
        set.add(s.asesor.trim());
      }
    });

    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [planRecords, solicitudes, matchesFilter]);

  // 2. Estados disponibles (Filtro cruzado)
  const availableEstados = useMemo(() => {
    const set = new Set<string>();
    const geoEstados = Object.keys(geoHierarchy).filter(isValidGeoName);

    // Si hay municipio o parroquia seleccionados, deducir estado canónico
    if (filters.municipio !== "all" || filters.parroquia !== "all") {
      const targetMun = filters.municipio !== "all" ? normKey(filters.municipio) : "";
      const targetPar = filters.parroquia !== "all" ? normKey(filters.parroquia) : "";

      Object.entries(geoHierarchy).forEach(([estadoName, munMap]) => {
        if (!isValidGeoName(estadoName)) return;
        Object.entries(munMap).forEach(([munName, parMap]) => {
          if (targetMun && normKey(munName) !== targetMun) return;
          if (targetPar && !Object.keys(parMap).some((p) => normKey(p) === targetPar)) return;
          set.add(estadoName);
        });
      });
    }

    // Agregar estados presentes en los registros que cumplen los demás filtros
    planRecords.forEach((r) => {
      if (!isValidGeoName(r.estado)) return;
      if (matchesFilter(r, "estado")) {
        set.add(formatProperCase(r.estado));
      }
    });

    if (set.size === 0) {
      geoEstados.forEach((e) => set.add(e));
    }

    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [planRecords, filters.municipio, filters.parroquia, matchesFilter]);

  // 3. Municipios disponibles (Filtro cruzado)
  const availableMunicipios = useMemo(() => {
    const set = new Set<string>();
    const fEstNorm = filters.estado !== "all" ? normKey(filters.estado) : "";

    // De geoHierarchy según el estado activo
    Object.entries(geoHierarchy).forEach(([estadoName, munMap]) => {
      if (!isValidGeoName(estadoName)) return;
      if (!fEstNorm || normKey(estadoName) === fEstNorm) {
        Object.keys(munMap).forEach((m) => {
          if (isValidGeoName(m)) set.add(m);
        });
      }
    });

    // De planRecords que cumplen los demás filtros
    const geoMunNormSet = new Set(Array.from(set).map(normKey));
    planRecords.forEach((r) => {
      if (!isValidGeoName(r.municipio)) return;
      if (matchesFilter(r, "municipio")) {
        const nk = normKey(r.municipio);
        if (!geoMunNormSet.has(nk)) {
          set.add(formatProperCase(r.municipio));
          geoMunNormSet.add(nk);
        }
      }
    });

    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [planRecords, filters.estado, matchesFilter]);

  // 4. Parroquias disponibles (Filtro cruzado)
  const availableParroquias = useMemo(() => {
    const set = new Set<string>();
    const fEstNorm = filters.estado !== "all" ? normKey(filters.estado) : "";
    const fMunNorm = filters.municipio !== "all" ? normKey(filters.municipio) : "";

    // De geoHierarchy
    Object.entries(geoHierarchy).forEach(([estadoName, munMap]) => {
      if (!isValidGeoName(estadoName)) return;
      if (!fEstNorm || normKey(estadoName) === fEstNorm) {
        Object.entries(munMap).forEach(([munName, parMap]) => {
          if (!isValidGeoName(munName)) return;
          if (!fMunNorm || normKey(munName) === fMunNorm) {
            Object.keys(parMap).forEach((p) => {
              if (isValidGeoName(p)) set.add(p);
            });
          }
        });
      }
    });

    // De planRecords
    const geoParNormSet = new Set(Array.from(set).map(normKey));
    planRecords.forEach((r) => {
      if (!isValidGeoName(r.parroquia)) return;
      if (matchesFilter(r, "parroquia")) {
        const nk = normKey(r.parroquia);
        if (!geoParNormSet.has(nk)) {
          set.add(formatProperCase(r.parroquia));
          geoParNormSet.add(nk);
        }
      }
    });

    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [planRecords, filters.estado, filters.municipio, matchesFilter]);

  // 5. Sectores disponibles (Filtro cruzado)
  const availableSectores = useMemo(() => {
    const set = new Set<string>();
    const fEstNorm = filters.estado !== "all" ? normKey(filters.estado) : "";
    const fMunNorm = filters.municipio !== "all" ? normKey(filters.municipio) : "";
    const fParNorm = filters.parroquia !== "all" ? normKey(filters.parroquia) : "";

    // De geoHierarchy si hay municipio o parroquia
    if (fMunNorm || fParNorm) {
      Object.entries(geoHierarchy).forEach(([estadoName, munMap]) => {
        if (!fEstNorm || normKey(estadoName) === fEstNorm) {
          Object.entries(munMap).forEach(([munName, parMap]) => {
            if (!fMunNorm || normKey(munName) === fMunNorm) {
              Object.entries(parMap).forEach(([parName, secList]) => {
                if (!fParNorm || normKey(parName) === fParNorm) {
                  secList.forEach((s) => {
                    if (isValidGeoName(s)) set.add(s);
                  });
                }
              });
            }
          });
        }
      });
    }

    // De planRecords que cumplen los demás filtros
    planRecords.forEach((r) => {
      if (!isValidGeoName(r.sector)) return;
      if (matchesFilter(r, "sector")) {
        set.add(formatProperCase(r.sector));
      }
    });

    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [planRecords, filters.estado, filters.municipio, filters.parroquia, matchesFilter]);

  // 6. Actividades disponibles (Filtro cruzado)
  const availableActivities = useMemo(() => {
    const set = new Set<string>();

    planRecords.forEach((r) => {
      const act = r.tipo_actividad || r.plan;
      if (!isValidGeoName(act)) return;
      if (matchesFilter(r, "actividad")) {
        set.add(formatProperCase(act));
      }
    });

    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [planRecords, matchesFilter]);

  // Resets automáticos cuando una selección ya no existe en el subconjunto filtrado
  useEffect(() => {
    if (filters.asesor !== "all" && availableAdvisors.length > 0 && !availableAdvisors.includes(filters.asesor)) {
      setFilters((p) => ({ ...p, asesor: "all" }));
    }
  }, [availableAdvisors, filters.asesor]);

  useEffect(() => {
    if (filters.municipio !== "all" && availableMunicipios.length > 0 && !availableMunicipios.includes(filters.municipio)) {
      setFilters((p) => ({ ...p, municipio: "all" }));
    }
  }, [availableMunicipios, filters.municipio]);

  useEffect(() => {
    if (filters.parroquia !== "all" && availableParroquias.length > 0 && !availableParroquias.includes(filters.parroquia)) {
      setFilters((p) => ({ ...p, parroquia: "all" }));
    }
  }, [availableParroquias, filters.parroquia]);

  useEffect(() => {
    if (filters.sector && availableSectores.length > 0 && !availableSectores.includes(filters.sector)) {
      setFilters((p) => ({ ...p, sector: "" }));
    }
  }, [availableSectores, filters.sector]);

  useEffect(() => {
    if (filters.actividad !== "all" && availableActivities.length > 0 && !availableActivities.includes(filters.actividad)) {
      setFilters((p) => ({ ...p, actividad: "all" }));
    }
  }, [availableActivities, filters.actividad]);

  // Presets rápidos de fecha
  const handleDatePreset = (preset: "hoy" | "semana" | "mes_actual" | "todo") => {
    const now = new Date(2026, 10, 2);
    if (preset === "todo") {
      setFilters((p) => ({ ...p, dateMode: "none", singleDate: "", startDate: "", endDate: "" }));
      return;
    }
    if (preset === "hoy") {
      setFilters((p) => ({ ...p, dateMode: "single", singleDate: toIsoDate(now), startDate: "", endDate: "" }));
      return;
    }
    if (preset === "semana") {
      const d = new Date(now);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const mon = new Date(d.setDate(diff));
      const sat = new Date(mon);
      sat.setDate(mon.getDate() + 5);
      setFilters((p) => ({
        ...p,
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
      setFilters((p) => ({
        ...p,
        dateMode: "range",
        singleDate: "",
        startDate: toIsoDate(start),
        endDate: toIsoDate(end),
      }));
      return;
    }
  };

  const handleResetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setTableSearch("");
  }, []);

  // Filtrado final de registros de planificación, solicitudes e instalaciones
  const { filteredPlan, filteredSols, filteredInsts } = useMemo(() => {
    const fPlan = planRecords.filter((r) => matchesFilter(r));
    const fSols = solicitudes.filter((s) => matchesFilter(s));
    const fInsts = installations.filter((i) => {
      if (!matchesFilter(i)) return false;
      return true;
    });

    return { filteredPlan: fPlan, filteredSols: fSols, filteredInsts: fInsts };
  }, [planRecords, solicitudes, installations, matchesFilter]);

  // Cálculo analítico de Jornadas, Instalaciones reales, Tendencia y Diagnóstico
  const analytics = useMemo(() => {
    return computePlanificacionAnalytics(
      filteredPlan,
      filteredSols,
      filteredInsts,
      solicitudes, // Pool histórico total para baseline
      installations // Pool histórico total para baseline y matching por cédula
    );
  }, [filteredPlan, filteredSols, filteredInsts, solicitudes, installations]);

  const { overall, sectorsHealth } = analytics;

  // Filtrado en tabla por texto
  const displayRows = useMemo(() => {
    if (!tableSearch.trim()) return sectorsHealth;
    const term = normKey(tableSearch);
    return sectorsHealth.filter((s) => {
      return (
        normKey(s.sector).includes(term) ||
        normKey(s.parroquia).includes(term) ||
        normKey(s.municipio).includes(term) ||
        normKey(s.estado).includes(term) ||
        s.topAdvisors.some((a) => normKey(a).includes(term))
      );
    });
  }, [sectorsHealth, tableSearch]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.dateMode !== "none") count++;
    if (filters.asesor !== "all") count++;
    if (filters.estado !== "all") count++;
    if (filters.municipio !== "all") count++;
    if (filters.parroquia !== "all") count++;
    if (filters.sector.trim()) count++;
    if (filters.actividad !== "all") count++;
    return count;
  }, [filters]);

  return (
    <div className="space-y-5 pt-2">
      {/* =========================================================================
          1. PANEL DE FILTROS CRUZADOS (Tipografía limpia, sin recuadros ni selectores nativos)
         ========================================================================= */}
      <div className="space-y-3 pb-3 border-b border-neutral-100">
        {/* Fila A: Fecha o Rango de Fecha */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
            <span className="text-[11px] text-neutral-400 font-mono flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 stroke-[1.25]" />
              Fecha o rango:
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
              onClick={() =>
                setFilters((p) => ({
                  ...p,
                  dateMode: "single",
                  singleDate: p.singleDate || "2026-11-02",
                }))
              }
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

          <div className="flex items-center gap-3 text-[11px] font-mono text-neutral-400">
            <button
              type="button"
              onClick={() => handleDatePreset("hoy")}
              className="hover:text-neutral-900 transition-colors cursor-pointer"
            >
              Hoy
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={() => handleDatePreset("semana")}
              className="hover:text-neutral-900 transition-colors cursor-pointer"
            >
              Esta semana
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={() => handleDatePreset("mes_actual")}
              className="hover:text-neutral-900 transition-colors cursor-pointer"
            >
              Mes actual
            </button>
          </div>
        </div>

        {/* Inputs de fecha inline */}
        {filters.dateMode === "single" && (
          <div className="flex items-center gap-2 pt-1 text-xs">
            <span className="text-[11px] text-neutral-400 font-mono">Día:</span>
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

        {/* Fila B: 6 Selectores Cruzados (Asesor, Estado, Municipio, Parroquia, Sector, Actividad) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-1 text-xs">
          {/* 1. Asesor */}
          <div className="space-y-1">
            <label className="text-[10px] text-neutral-400 font-mono block">
              Asesor ({availableAdvisors.length})
            </label>
            <CustomDropdown
              value={filters.asesor}
              options={[
                { value: "all", label: "Todos los asesores" },
                ...availableAdvisors.map((a) => ({ value: a, label: a })),
              ]}
              onChange={(val) => setFilters((p) => ({ ...p, asesor: val }))}
              compact
              disabled={availableAdvisors.length === 0}
            />
          </div>

          {/* 2. Estado */}
          <div className="space-y-1">
            <label className="text-[10px] text-neutral-400 font-mono block">Estado</label>
            <CustomDropdown
              value={filters.estado}
              options={[
                { value: "all", label: "Todos los estados" },
                ...availableEstados.map((e) => ({ value: e, label: e })),
              ]}
              onChange={(val) => setFilters((p) => ({ ...p, estado: val }))}
              compact
            />
          </div>

          {/* 3. Municipio */}
          <div className="space-y-1">
            <label className="text-[10px] text-neutral-400 font-mono block">Municipio</label>
            <CustomDropdown
              value={filters.municipio}
              options={[
                { value: "all", label: "Todos los municipios" },
                ...availableMunicipios.map((m) => ({ value: m, label: m })),
              ]}
              onChange={(val) => setFilters((p) => ({ ...p, municipio: val }))}
              compact
              disabled={availableMunicipios.length === 0}
            />
          </div>

          {/* 4. Parroquia */}
          <div className="space-y-1">
            <label className="text-[10px] text-neutral-400 font-mono block">Parroquia</label>
            <CustomDropdown
              value={filters.parroquia}
              options={[
                { value: "all", label: "Todas las parroquias" },
                ...availableParroquias.map((p) => ({ value: p, label: p })),
              ]}
              onChange={(val) => setFilters((p) => ({ ...p, parroquia: val }))}
              compact
              disabled={availableParroquias.length === 0}
            />
          </div>

          {/* 5. Sector */}
          <div className="space-y-1">
            <label className="text-[10px] text-neutral-400 font-mono block">Sector</label>
            {availableSectores.length > 0 ? (
              <CustomDropdown
                value={filters.sector}
                options={[
                  { value: "", label: "Todos los sectores" },
                  ...availableSectores.map((s) => ({ value: s, label: s })),
                ]}
                onChange={(val) => setFilters((p) => ({ ...p, sector: val }))}
                compact
              />
            ) : (
              <div className="flex items-center gap-1 border-b border-neutral-200 focus-within:border-neutral-900 transition-colors py-1">
                <Search className="w-3 h-3 text-neutral-400 shrink-0 stroke-[1.25]" />
                <input
                  type="text"
                  value={filters.sector}
                  onChange={(e) => setFilters((p) => ({ ...p, sector: e.target.value }))}
                  placeholder="Sector..."
                  className="w-full bg-transparent text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* 6. Actividad */}
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
        </div>

        {/* Fila C: Resumen de filtros activos */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-[11px] font-mono text-neutral-500">
          <div className="flex items-center gap-2">
            <span>
              {formatNumber(overall.totalJornadas)} jornadas · {formatNumber(overall.totalSolicitudes)} solicitudes · {formatNumber(overall.matchedCount)} instalaciones ({overall.conversionRate}% conversión real)
            </span>
            {operationalLoading && (
              <span className="text-[10px] text-neutral-400 animate-pulse font-sans">
                · sincronizando...
              </span>
            )}
          </div>

          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-neutral-400 hover:text-neutral-900 transition-colors inline-flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3 stroke-[1.5]" />
              Limpiar filtros ({activeFiltersCount})
            </button>
          )}
        </div>
      </div>

      {/* =========================================================================
          2. BUSCADOR DIRECTO EN EL CUADRO
         ========================================================================= */}
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-xs font-semibold text-neutral-900 tracking-tight">
          Cuadro de jornadas, instalaciones, tendencia y diagnóstico ({displayRows.length})
        </span>

        <div className="flex items-center gap-1.5 w-60 border-b border-neutral-200 focus-within:border-neutral-900 transition-colors py-0.5">
          <Search className="w-3.5 h-3.5 text-neutral-400 shrink-0 stroke-[1.25]" />
          <input
            type="text"
            value={tableSearch}
            onChange={(e) => setTableSearch(e.target.value)}
            placeholder="Buscar en el cuadro..."
            className="w-full bg-transparent text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
          />
          {tableSearch && (
            <button
              type="button"
              onClick={() => setTableSearch("")}
              className="text-neutral-400 hover:text-neutral-900 transition-colors p-0.5 cursor-pointer"
            >
              <X className="w-3 h-3 stroke-[1.5]" />
            </button>
          )}
        </div>
      </div>

      {/* =========================================================================
          3. EL CUADRO (TABLA PRINCIPAL)
         ========================================================================= */}
      <div className="overflow-x-auto no-scrollbar">
        <table className="w-full text-left border-collapse text-xs min-w-[850px]">
          <thead>
            <tr className="border-b border-neutral-200 text-neutral-400 font-normal">
              <th className="py-2.5 px-2 w-8 font-mono text-[10px]">#</th>
              <th className="py-2.5 px-2 font-normal">Sector / Ruta</th>
              <th className="py-2.5 px-2 font-normal">Parroquia y Municipio</th>
              <th className="py-2.5 px-2 font-normal">Asesor</th>
              <th className="py-2.5 px-2 font-normal">Actividad</th>
              <th className="py-2.5 px-2 text-right font-normal">Jornadas</th>
              <th className="py-2.5 px-2 text-right font-normal">Instalaciones</th>
              <th className="py-2.5 px-2 text-right font-normal">Tendencia</th>
              <th className="py-2.5 px-2 text-right font-normal">Diagnóstico</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100/70">
            {displayRows.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-xs text-neutral-400 font-mono">
                  No hay registros coincidentes con los filtros seleccionados
                </td>
              </tr>
            ) : (
              displayRows.slice(0, 100).map((sec, idx) => (
                <tr
                  key={sec.sector + idx}
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
                    {[sec.parroquia, sec.municipio].filter(Boolean).join(" · ") || sec.estado}
                  </td>
                  <td
                    className="py-2.5 px-2 text-neutral-700 hover:text-neutral-950 font-medium cursor-pointer"
                    onClick={(e) => {
                      if (sec.topAdvisors[0]) {
                        e.stopPropagation();
                        onSelectAdvisor?.(sec.topAdvisors[0]);
                      }
                    }}
                  >
                    {sec.topAdvisors.join(", ") || "—"}
                  </td>
                  <td className="py-2.5 px-2 text-neutral-600 font-mono text-[11px]">
                    {sec.activities?.join(", ") || "Recorrido"}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-neutral-700">
                    {sec.totalJornadas}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono">
                    <span className="font-medium text-neutral-950">
                      {formatNumber(sec.instalacionesCount)}
                    </span>
                    <span className="text-[10px] text-neutral-400 block font-mono">
                      {formatNumber(sec.solicitudesCount)} sols ({sec.conversionRate}%)
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-xs">
                    <span
                      className={cn(
                        sec.deltaVsMedia > 0
                          ? "text-emerald-700 font-medium"
                          : sec.deltaVsMedia < 0
                          ? "text-neutral-500"
                          : "text-neutral-400"
                      )}
                    >
                      {sec.deltaVsMedia > 0 ? `+${sec.deltaVsMedia}%` : sec.deltaVsMedia < 0 ? `${sec.deltaVsMedia}%` : "Estable"}
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
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
