"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  RotateCw,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { SidebarOpenButton, SidebarMobileButton } from "@/components/providers/sidebar-provider";
import {
  fetchPlanificacionData,
  fetchRawOperationalData,
  getCachedPlanificacionData,
  getCachedOperationalData,
  PlanificacionRecord,
  Installation,
  Solicitud,
  MONTH_ORDER,
} from "@/lib/dashboard-data";
import { cn, formatNumber, formatProperCase } from "@/lib/utils";
import { PlanificacionMetrics } from "@/components/planificacion/planificacion-metrics";
import { PlanificacionMonthlyView } from "@/components/planificacion/planificacion-monthly-view";
import { PlanificacionDailyView } from "@/components/planificacion/planificacion-daily-view";

type ViewMode = "mensual" | "diaria";

const normKey = (str: string | null | undefined): string =>
  (str || "").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");

function advisorKeysMatch(keyA: string, keyB: string): boolean {
  if (!keyA || !keyB) return false;
  if (keyA === keyB) return true;
  const wordsA = keyA.split(" ").filter(Boolean);
  const wordsB = keyB.split(" ").filter(Boolean);
  if (wordsA.length >= 2 && wordsB.length >= 2) {
    if (wordsA[0] === wordsB[0] && wordsA[wordsA.length - 1] === wordsB[wordsB.length - 1]) {
      return true;
    }
  }
  return false;
}

// Convierte objeto Date a ISO YYYY-MM-DD
function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const SPANISH_DAYS_FULL = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

// Parsea una fecha en YYYY-MM-DD o D/M/YYYY de forma segura
function parseDateSafe(str: string): Date | null {
  if (!str) return null;
  const clean = str.trim();
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

export default function PlanificacionPage() {
  // Inicialización instantánea desde caché si está disponible
  const [records, setRecords] = useState<PlanificacionRecord[]>(() => getCachedPlanificacionData() || []);
  const [rawSolicitudes, setRawSolicitudes] = useState<Solicitud[]>(() => getCachedOperationalData()?.solicitudes || []);
  const [rawInstallations, setRawInstallations] = useState<Installation[]>(() => getCachedOperationalData()?.installations || []);
  const [loading, setLoading] = useState(() => !getCachedPlanificacionData() || getCachedPlanificacionData()!.length === 0);
  const [refreshing, setRefreshing] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAdvisor, setSelectedAdvisor] = useState<string | null>(null);
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [selectedDateFilter, setSelectedDateFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("mensual");

  // Fecha de referencia: por defecto 2026-11-02 (o fecha actual)
  const [referenceDate, setReferenceDate] = useState<Date>(() => new Date(2026, 10, 2));

  // Carga concurrente de planificación y operaciones para renderizado instantáneo
  const loadData = useCallback(async (force = false) => {
    if (force) setRefreshing(true);
    else if (records.length === 0) setLoading(true);

    try {
      const [planData, opData] = await Promise.all([
        fetchPlanificacionData(force),
        fetchRawOperationalData(undefined, undefined, undefined, undefined, force).catch((err) => {
          console.warn("Aviso al cargar operaciones en planificación:", err);
          return null;
        }),
      ]);

      if (planData && planData.length > 0) {
        setRecords(planData);
        const sortedDates = planData
          .map((d) => d.fecha)
          .filter(Boolean)
          .sort();
        if (sortedDates.length > 0) {
          const latestStr = sortedDates[sortedDates.length - 1];
          const latestParsed = parseDateSafe(latestStr);
          if (latestParsed) {
            setReferenceDate(latestParsed);
          }
        }
      }

      if (opData) {
        if (opData.solicitudes) setRawSolicitudes(opData.solicitudes);
        if (opData.installations) setRawInstallations(opData.installations);
      }
    } catch (err) {
      console.error("Error al cargar planificación comercial:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [records.length]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Lista de meses disponibles ordenada
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => {
      if (r.mes) set.add(formatProperCase(r.mes));
    });
    return Array.from(set).sort(
      (a, b) => MONTH_ORDER.indexOf(a) - MONTH_ORDER.indexOf(b)
    );
  }, [records]);

  // Mes seleccionado actual basado en referenceDate
  const currentSelectedMonth = useMemo(() => {
    const mIdx = referenceDate.getMonth();
    return MONTH_ORDER[mIdx] || "Noviembre";
  }, [referenceDate]);

  // Registros filtrados transversalmente por búsqueda, asesor y sector
  const filteredRecords = useMemo(() => {
    let list = records;

    if (searchTerm.trim()) {
      const term = normKey(searchTerm);
      list = list.filter((r) => {
        const adv = normKey(r.asesor);
        const sec = normKey(r.sector);
        const par = normKey(r.parroquia);
        const mun = normKey(r.municipio);
        return adv.includes(term) || sec.includes(term) || par.includes(term) || mun.includes(term);
      });
    }

    if (selectedAdvisor) {
      const targetNk = normKey(selectedAdvisor);
      list = list.filter((r) => normKey(r.asesor) === targetNk);
    }

    if (selectedSector) {
      const targetSec = normKey(selectedSector);
      list = list.filter((r) => normKey(r.sector) === targetSec);
    }

    return list;
  }, [records, searchTerm, selectedAdvisor, selectedSector]);

  // Conjunto de claves de asesores comerciales planificados en el periodo
  const commercialAdvisorKeys = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => {
      if (r.asesor && r.asesor !== "Sin Asesor" && r.asesor !== "Desconocido") {
        const k = normKey(r.asesor);
        if (k) set.add(k);
      }
    });
    return set;
  }, [records]);

  const isCommercialAdvisor = useCallback((advName: string | null | undefined): boolean => {
    if (!advName) return false;
    const k = normKey(advName);
    if (!k || k === "SIN ASESOR" || k === "DESCONOCIDO" || k === "PLANIFICACION") return false;
    if (commercialAdvisorKeys.has(k)) return true;
    for (const canonical of commercialAdvisorKeys) {
      if (advisorKeysMatch(canonical, k)) return true;
    }
    return false;
  }, [commercialAdvisorKeys]);

  // Solicitudes filtradas transversalmente según selección activa (periodo, asesor, sector, búsqueda, día móvil)
  const filteredSolicitudes = useMemo(() => {
    let list = rawSolicitudes.filter((s) => isCommercialAdvisor(s.asesor));

    if (viewMode === "diaria") {
      const dateIso = toIsoDate(referenceDate);
      list = list.filter((s) => s.fecha === dateIso);
    } else if (selectedDateFilter) {
      list = list.filter((s) => s.fecha === selectedDateFilter || (s.created_at && s.created_at.startsWith(selectedDateFilter)));
    } else {
      const mKey = normKey(currentSelectedMonth);
      list = list.filter((s) => normKey(s.mes) === mKey);
    }

    if (selectedAdvisor) {
      const advNk = normKey(selectedAdvisor);
      list = list.filter((s) => normKey(s.asesor) === advNk || advisorKeysMatch(advNk, normKey(s.asesor)));
    }

    if (selectedSector) {
      const secNk = normKey(selectedSector);
      list = list.filter((s) => normKey(s.sector) === secNk);
    }

    if (searchTerm.trim()) {
      const term = normKey(searchTerm);
      list = list.filter((s) => {
        const adv = normKey(s.asesor);
        const sec = normKey(s.sector);
        const par = normKey(s.parroquia);
        const mun = normKey(s.municipio);
        return adv.includes(term) || sec.includes(term) || par.includes(term) || mun.includes(term);
      });
    }

    return list;
  }, [rawSolicitudes, isCommercialAdvisor, viewMode, referenceDate, selectedDateFilter, currentSelectedMonth, selectedAdvisor, selectedSector, searchTerm]);

  // Instalaciones filtradas transversalmente según selección activa (periodo, asesor, sector, búsqueda, día móvil)
  const filteredInstallations = useMemo(() => {
    // Filtrar estrictamente a ventas conseguidas por asesores comerciales
    let list = rawInstallations.filter((i) => isCommercialAdvisor(i.asesor));

    if (viewMode === "diaria") {
      const dateIso = toIsoDate(referenceDate);
      list = list.filter((i) => i.fecha === dateIso);
    } else if (selectedDateFilter) {
      list = list.filter((i) => i.fecha === selectedDateFilter || (i.created_at && i.created_at.startsWith(selectedDateFilter)));
    } else {
      const mKey = normKey(currentSelectedMonth);
      list = list.filter((i) => normKey(i.mes) === mKey);
    }

    if (selectedAdvisor) {
      const advNk = normKey(selectedAdvisor);
      list = list.filter((i) => normKey(i.asesor) === advNk || advisorKeysMatch(advNk, normKey(i.asesor)));
    }

    if (selectedSector) {
      const secNk = normKey(selectedSector);
      list = list.filter((i) => normKey(i.sector) === secNk);
    }

    if (searchTerm.trim()) {
      const term = normKey(searchTerm);
      list = list.filter((i) => {
        const adv = normKey(i.asesor);
        const sec = normKey(i.sector);
        const par = normKey(i.parroquia);
        const mun = normKey(i.municipio);
        return adv.includes(term) || sec.includes(term) || par.includes(term) || mun.includes(term);
      });
    }

    return list;
  }, [rawInstallations, isCommercialAdvisor, viewMode, referenceDate, selectedDateFilter, currentSelectedMonth, selectedAdvisor, selectedSector, searchTerm]);

  // Registros filtrados para el mes o día actualmente seleccionado (para métricas y listados dependientes del filtro)
  const monthlyRecords = useMemo(() => {
    if (selectedDateFilter) {
      return filteredRecords.filter((r) => r.fecha === selectedDateFilter);
    }
    const mKey = normKey(currentSelectedMonth);
    return filteredRecords.filter((r) => normKey(r.mes) === mKey);
  }, [filteredRecords, selectedDateFilter, currentSelectedMonth]);

  // Registros completos del asesor en el mes para la cuadrícula del calendario
  // (permite que el calendario siempre muestre dónde estuvo el asesor cada día)
  const advisorMonthlyRecords = useMemo(() => {
    const mKey = normKey(currentSelectedMonth);
    let list = records.filter((r) => normKey(r.mes) === mKey);
    if (selectedAdvisor) {
      const advNk = normKey(selectedAdvisor);
      list = list.filter((r) => normKey(r.asesor) === advNk);
    }
    return list;
  }, [records, currentSelectedMonth, selectedAdvisor]);

  // Solicitudes del mes o día móvil (restringidas a asesores comerciales, filtradas por asesor si aplica)
  const monthlySolicitudes = useMemo(() => {
    let list = rawSolicitudes.filter((s) => isCommercialAdvisor(s.asesor));
    if (selectedDateFilter) {
      list = list.filter((s) => s.fecha === selectedDateFilter || (s.created_at && s.created_at.startsWith(selectedDateFilter)));
    } else {
      const mKey = normKey(currentSelectedMonth);
      list = list.filter((s) => normKey(s.mes) === mKey);
    }
    if (selectedAdvisor) {
      const advNk = normKey(selectedAdvisor);
      list = list.filter((s) => normKey(s.asesor) === advNk || advisorKeysMatch(advNk, normKey(s.asesor)));
    }
    return list;
  }, [rawSolicitudes, isCommercialAdvisor, selectedDateFilter, currentSelectedMonth, selectedAdvisor]);

  // Instalaciones del mes o día móvil (restringidas a asesores comerciales, filtradas por asesor si aplica)
  const monthlyInstallations = useMemo(() => {
    let list = rawInstallations.filter((i) => isCommercialAdvisor(i.asesor));
    if (selectedDateFilter) {
      list = list.filter((i) => i.fecha === selectedDateFilter || (i.created_at && i.created_at.startsWith(selectedDateFilter)));
    } else {
      const mKey = normKey(currentSelectedMonth);
      list = list.filter((i) => normKey(i.mes) === mKey);
    }
    if (selectedAdvisor) {
      const advNk = normKey(selectedAdvisor);
      list = list.filter((i) => normKey(i.asesor) === advNk || advisorKeysMatch(advNk, normKey(i.asesor)));
    }
    return list;
  }, [rawInstallations, isCommercialAdvisor, selectedDateFilter, currentSelectedMonth, selectedAdvisor]);

  // Registros filtrados para la vista diaria
  const { dailyRecords, dailyDateLabel } = useMemo(() => {
    const dateIso = toIsoDate(referenceDate);
    const inDay = filteredRecords.filter((r) => r.fecha === dateIso);
    const dayName = SPANISH_DAYS_FULL[referenceDate.getDay()];
    const dayNum = referenceDate.getDate();
    const monthName = MONTH_ORDER[referenceDate.getMonth()] || "";
    const year = referenceDate.getFullYear();
    const label = `${dayName}, ${dayNum} de ${monthName.toLowerCase()} de ${year}`;

    return { dailyRecords: inDay, dailyDateLabel: label };
  }, [referenceDate, filteredRecords]);

  // Métricas para el periodo activo (diario o mensual)
  const activeMetrics = useMemo(() => {
    const scopeRecords = viewMode === "diaria" ? dailyRecords : monthlyRecords;
    const advisorsSet = new Set<string>();
    const sectorsSet = new Set<string>();
    const activityMap = new Map<string, number>();

    scopeRecords.forEach((r) => {
      if (r.asesor && r.asesor !== "Sin Asesor") advisorsSet.add(r.asesor);
      if (r.sector && r.sector !== "N/A") sectorsSet.add(r.sector);
      const act = r.tipo_actividad || r.plan || "Recorrido";
      activityMap.set(act, (activityMap.get(act) || 0) + 1);
    });

    let predName = "";
    let predCount = 0;
    activityMap.forEach((cnt, name) => {
      if (cnt > predCount) {
        predCount = cnt;
        predName = name;
      }
    });

    const predPct = scopeRecords.length > 0 ? Math.round((predCount / scopeRecords.length) * 100) : 0;

    let activeLabel = `Mes de ${currentSelectedMonth}`;
    if (viewMode === "diaria") {
      activeLabel = dailyDateLabel;
    } else if (selectedDateFilter) {
      const parsed = parseDateSafe(selectedDateFilter);
      if (parsed) {
        const dName = SPANISH_DAYS_FULL[parsed.getDay()];
        activeLabel = `${dName}, ${parsed.getDate()} de ${currentSelectedMonth.toLowerCase()}`;
      } else {
        activeLabel = selectedDateFilter;
      }
    }

    return {
      totalAdvisors: advisorsSet.size,
      totalSectors: sectorsSet.size,
      totalJornadas: scopeRecords.length,
      predominantActivity: predCount > 0 ? { name: predName, count: predCount, pct: predPct } : undefined,
      periodLabel: activeLabel,
    };
  }, [viewMode, selectedDateFilter, dailyRecords, monthlyRecords, dailyDateLabel, currentSelectedMonth]);

  // Manejadores de navegación temporal (mensual o diario)
  const handlePrevPeriod = () => {
    setSelectedDateFilter(null);
    const d = new Date(referenceDate);
    if (viewMode === "diaria") {
      d.setDate(d.getDate() - 1);
    } else {
      d.setMonth(d.getMonth() - 1);
    }
    setReferenceDate(d);
  };

  const handleNextPeriod = () => {
    setSelectedDateFilter(null);
    const d = new Date(referenceDate);
    if (viewMode === "diaria") {
      d.setDate(d.getDate() + 1);
    } else {
      d.setMonth(d.getMonth() + 1);
    }
    setReferenceDate(d);
  };

  const handleToday = () => {
    setSelectedDateFilter(null);
    const sorted = records.map((r) => r.fecha).filter(Boolean).sort();
    if (sorted.length > 0) {
      const parsed = parseDateSafe(sorted[sorted.length - 1]);
      if (parsed) {
        setReferenceDate(parsed);
        return;
      }
    }
    setReferenceDate(new Date(2026, 10, 2));
  };

  const handleSelectSpecificDay = (dateStr: string) => {
    setSelectedDateFilter(null);
    const parsed = parseDateSafe(dateStr);
    if (parsed) {
      setReferenceDate(parsed);
      setViewMode("diaria");
    }
  };

  const handleSelectMonth = (monthName: string) => {
    setSelectedDateFilter(null);
    const mIdx = MONTH_ORDER.findIndex((m) => m.toLowerCase() === monthName.toLowerCase());
    if (mIdx >= 0) {
      const d = new Date(referenceDate);
      d.setMonth(mIdx);
      d.setDate(1);
      setReferenceDate(d);
      setViewMode("mensual");
      setSelectedSector(null);
    }
  };

  return (
    <div className="flex h-screen bg-[#FBFBFB] text-neutral-900 font-sans antialiased overflow-hidden selection:bg-neutral-900 selection:text-white">
      {/* Barra lateral */}
      <Sidebar activeSection="planificacion" />

      {/* Contenedor principal con scroll fluido */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Cabecera abierta minimalista */}
        <header className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 bg-[#FBFBFB]/90 backdrop-blur-xs border-b border-neutral-100/80">
          <div className="flex items-center gap-3">
            <SidebarMobileButton />
            <SidebarOpenButton />
            <div>
              <h1 className="text-base font-semibold text-neutral-900 tracking-tight">
                Planificación Comercial
              </h1>
              <p className="text-xs text-neutral-400 font-mono">
                Rutas y cronograma mensual de actividades en campo
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-[11px] text-neutral-400 font-mono hidden sm:inline">
              {formatNumber(records.length)} jornadas planificadas
            </span>
            <button
              type="button"
              onClick={() => loadData(true)}
              title="Actualizar datos desde Google Sheets"
              className={cn(
                "p-1 text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer",
                refreshing && "animate-spin"
              )}
            >
              <RotateCw className="w-4 h-4 stroke-[1.25]" />
            </button>
          </div>
        </header>

        {/* Contenido principal abierto sin tarjetas encerradas */}
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
          {/* Fila 1: Título de sección "Calendario" y Controles Temporales */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-100 pb-3">
            <div className="flex items-center gap-2">
              {viewMode === "diaria" ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setViewMode("mensual")}
                    className="text-xs text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 stroke-[1.5]" />
                    <span>Mes</span>
                  </button>
                  <span className="text-neutral-300">/</span>
                  <span className="text-xs font-semibold text-neutral-950">
                    Detalle diario
                  </span>
                </div>
              ) : (
                <span className="text-xs font-semibold text-neutral-950">
                  Calendario
                </span>
              )}
              {selectedAdvisor && (
                <div className="flex items-center gap-1.5 ml-2">
                  <span className="text-xs text-neutral-400">· Asesor:</span>
                  <span className="text-xs font-medium text-neutral-900">{selectedAdvisor}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedAdvisor(null)}
                    title="Quitar filtro de asesor"
                    className="text-neutral-400 hover:text-neutral-900 p-0.5 cursor-pointer transition-colors"
                  >
                    <X className="w-3 h-3 stroke-[1.5]" />
                  </button>
                </div>
              )}
              {selectedSector && (
                <div className="flex items-center gap-1.5 ml-2">
                  <span className="text-xs text-neutral-400">· Sector:</span>
                  <span className="text-xs font-medium text-neutral-900">{selectedSector}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedSector(null)}
                    title="Quitar filtro de sector"
                    className="text-neutral-400 hover:text-neutral-900 p-0.5 cursor-pointer transition-colors"
                  >
                    <X className="w-3 h-3 stroke-[1.5]" />
                  </button>
                </div>
              )}
              {selectedDateFilter && (
                <div className="flex items-center gap-1.5 ml-2">
                  <span className="text-xs text-neutral-400">· Día:</span>
                  <span className="text-xs font-medium text-neutral-900 font-mono">
                    {(() => {
                      const parsed = parseDateSafe(selectedDateFilter);
                      return parsed ? `${String(parsed.getDate()).padStart(2, "0")} de ${currentSelectedMonth}` : selectedDateFilter;
                    })()}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedDateFilter(null)}
                    title="Quitar filtro de día y ver mes completo"
                    className="text-neutral-400 hover:text-neutral-900 p-0.5 cursor-pointer transition-colors"
                  >
                    <X className="w-3 h-3 stroke-[1.5]" />
                  </button>
                </div>
              )}
            </div>

            {/* Controles de Navegación Temporal */}
            <div className="flex items-center gap-3 text-xs">
              <button
                type="button"
                onClick={handlePrevPeriod}
                className="p-1 text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
                title={viewMode === "diaria" ? "Día anterior" : "Mes anterior"}
              >
                <ChevronLeft className="w-4 h-4 stroke-[1.5]" />
              </button>

              <span className="text-xs font-medium text-neutral-900 font-sans">
                {viewMode === "diaria"
                  ? `${referenceDate.getDate()} de ${currentSelectedMonth} ${referenceDate.getFullYear()}`
                  : `${currentSelectedMonth} ${referenceDate.getFullYear()}`}
              </span>

              <button
                type="button"
                onClick={handleNextPeriod}
                className="p-1 text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
                title={viewMode === "diaria" ? "Día siguiente" : "Mes siguiente"}
              >
                <ChevronRight className="w-4 h-4 stroke-[1.5]" />
              </button>

              <span className="text-neutral-300">·</span>

              <button
                type="button"
                onClick={handleToday}
                className="text-[11px] text-neutral-400 hover:text-neutral-900 transition-colors font-mono cursor-pointer"
              >
                {viewMode === "diaria" ? "Día actual" : "Mes actual"}
              </button>
            </div>
          </div>

          {/* Fila 2: Selector de Meses y Buscador */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 overflow-x-auto no-scrollbar text-xs">
              {availableMonths.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleSelectMonth(m)}
                  className={cn(
                    "transition-colors whitespace-nowrap py-1 cursor-pointer",
                    normKey(m) === normKey(currentSelectedMonth)
                      ? "text-neutral-950 font-semibold border-b-2 border-neutral-900"
                      : "text-neutral-400 hover:text-neutral-700"
                  )}
                >
                  {m}
                </button>
              ))}
            </div>

            {/* Buscador minimalista con línea base */}
            <div className="flex items-center gap-1.5 w-full sm:w-64 border-b border-neutral-200 focus-within:border-neutral-900 transition-colors py-0.5">
              <Search className="w-3.5 h-3.5 text-neutral-400 shrink-0 stroke-[1.25]" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar asesor, ruta o sector..."
                className="w-full bg-transparent text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="text-neutral-400 hover:text-neutral-900 transition-colors p-0.5 cursor-pointer"
                >
                  <X className="w-3 h-3 stroke-[1.5]" />
                </button>
              )}
            </div>
          </div>


          {/* Fila 3: Cinta de Métricas Operativas */}
          <PlanificacionMetrics
            totalAdvisors={activeMetrics.totalAdvisors}
            totalSectors={activeMetrics.totalSectors}
            totalJornadas={activeMetrics.totalJornadas}
            totalSolicitudes={filteredSolicitudes.length}
            totalInstallations={filteredInstallations.length}
            predominantActivity={activeMetrics.predominantActivity}
            periodLabel={activeMetrics.periodLabel}
          />
          <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-neutral-300 to-transparent my-1" />

          {/* Fila 4: Visualización Principal según Modo */}
          {loading ? (
            <div className="py-24 text-center text-xs text-neutral-400 font-mono">
              Cargando planificación comercial...
            </div>
          ) : viewMode === "diaria" ? (
            <PlanificacionDailyView
              dateStr={toIsoDate(referenceDate)}
              dateLabel={dailyDateLabel}
              records={dailyRecords}
              solicitudes={filteredSolicitudes}
              installations={filteredInstallations}
              onSelectAdvisor={(adv) => setSelectedAdvisor(adv === selectedAdvisor ? null : adv)}
              selectedAdvisor={selectedAdvisor}
            />
          ) : (
            <PlanificacionMonthlyView
              month={currentSelectedMonth}
              year={referenceDate.getFullYear()}
              records={advisorMonthlyRecords}
              solicitudes={monthlySolicitudes}
              installations={monthlyInstallations}
              selectedAdvisor={selectedAdvisor}
              onSelectDay={handleSelectSpecificDay}
              onSelectAdvisor={(adv) => setSelectedAdvisor(adv === selectedAdvisor ? null : adv)}
              selectedSector={selectedSector}
              onSelectSector={setSelectedSector}
              selectedDateFilter={selectedDateFilter}
              onSelectDateFilter={setSelectedDateFilter}
            />
          )}
        </main>
      </div>
    </div>
  );
}
