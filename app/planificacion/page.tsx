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
import { SidebarOpenButton } from "@/components/providers/sidebar-provider";
import {
  fetchPlanificacionData,
  getCachedPlanificacionData,
  PlanificacionRecord,
  MONTH_ORDER,
} from "@/lib/dashboard-data";
import { cn, formatNumber, formatProperCase } from "@/lib/utils";
import { PlanificacionMetrics } from "@/components/planificacion/planificacion-metrics";
import { PlanificacionMonthlyView } from "@/components/planificacion/planificacion-monthly-view";

const normKey = (str: string | null | undefined): string =>
  (str || "").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

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
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Inicialización instantánea desde caché si está disponible
  const [records, setRecords] = useState<PlanificacionRecord[]>(() => getCachedPlanificacionData() || []);
  const [loading, setLoading] = useState(() => !getCachedPlanificacionData() || getCachedPlanificacionData()!.length === 0);
  const [refreshing, setRefreshing] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAdvisor, setSelectedAdvisor] = useState<string | null>(null);

  // Fecha de referencia: por defecto 2026-11-02 (o fecha actual)
  const [referenceDate, setReferenceDate] = useState<Date>(() => new Date(2026, 10, 2));

  // Carga directa de planificación comercial para renderizado instantáneo
  const loadData = useCallback(async (force = false) => {
    if (force) setRefreshing(true);
    else if (records.length === 0) setLoading(true);

    try {
      const planData = await fetchPlanificacionData(force);
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

  // Registros filtrados transversalmente por búsqueda y asesor
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

    return list;
  }, [records, searchTerm, selectedAdvisor]);

  // Registros filtrados para el mes actualmente seleccionado
  const monthlyRecords = useMemo(() => {
    const mKey = normKey(currentSelectedMonth);
    return filteredRecords.filter((r) => normKey(r.mes) === mKey);
  }, [filteredRecords, currentSelectedMonth]);

  // Métricas para el mes activo
  const activeMetrics = useMemo(() => {
    const advisorsSet = new Set<string>();
    const sectorsSet = new Set<string>();
    const activityMap = new Map<string, number>();

    monthlyRecords.forEach((r) => {
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

    const predPct = monthlyRecords.length > 0 ? Math.round((predCount / monthlyRecords.length) * 100) : 0;

    return {
      totalAdvisors: advisorsSet.size,
      totalSectors: sectorsSet.size,
      totalJornadas: monthlyRecords.length,
      predominantActivity: predCount > 0 ? { name: predName, count: predCount, pct: predPct } : undefined,
      periodLabel: `Mes de ${currentSelectedMonth}`,
    };
  }, [monthlyRecords, currentSelectedMonth]);

  // Manejadores de navegación temporal (mensual / calendario)
  const handlePrevPeriod = () => {
    const d = new Date(referenceDate);
    d.setMonth(d.getMonth() - 1);
    setReferenceDate(d);
  };

  const handleNextPeriod = () => {
    const d = new Date(referenceDate);
    d.setMonth(d.getMonth() + 1);
    setReferenceDate(d);
  };

  const handleToday = () => {
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
    const parsed = parseDateSafe(dateStr);
    if (parsed) {
      setReferenceDate(parsed);
    }
  };

  const handleSelectMonth = (monthName: string) => {
    const mIdx = MONTH_ORDER.findIndex((m) => m.toLowerCase() === monthName.toLowerCase());
    if (mIdx >= 0) {
      const d = new Date(referenceDate);
      d.setMonth(mIdx);
      d.setDate(1);
      setReferenceDate(d);
    }
  };

  return (
    <div className="flex h-screen bg-[#FBFBFB] text-neutral-900 font-sans antialiased overflow-hidden selection:bg-neutral-900 selection:text-white">
      {/* Barra lateral */}
      <Sidebar
        collapsed={false}
        onToggleCollapse={() => {}}
        activeItem="planificacion"
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />

      {/* Contenedor principal con scroll fluido */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Cabecera abierta minimalista */}
        <header className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 bg-[#FBFBFB]/90 backdrop-blur-xs border-b border-neutral-100/80">
          <div className="flex items-center gap-3">
            <SidebarOpenButton onClick={() => setMobileSidebarOpen(true)} />
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
              <span className="text-xs font-semibold text-neutral-950">
                Calendario
              </span>
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
            </div>

            {/* Controles de Navegación Temporal */}
            <div className="flex items-center gap-3 text-xs">
              <button
                type="button"
                onClick={handlePrevPeriod}
                className="p-1 text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
                title="Mes anterior"
              >
                <ChevronLeft className="w-4 h-4 stroke-[1.5]" />
              </button>

              <span className="text-xs font-medium text-neutral-900 font-sans">
                {currentSelectedMonth} {referenceDate.getFullYear()}
              </span>

              <button
                type="button"
                onClick={handleNextPeriod}
                className="p-1 text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
                title="Mes siguiente"
              >
                <ChevronRight className="w-4 h-4 stroke-[1.5]" />
              </button>

              <span className="text-neutral-300">·</span>

              <button
                type="button"
                onClick={handleToday}
                className="text-[11px] text-neutral-400 hover:text-neutral-900 transition-colors font-mono cursor-pointer"
              >
                Mes actual
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
            predominantActivity={activeMetrics.predominantActivity}
            periodLabel={activeMetrics.periodLabel}
          />
          <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-neutral-300 to-transparent my-1" />

          {/* Fila 4: Visualización Calendario Mensual */}
          {loading ? (
            <div className="py-24 text-center text-xs text-neutral-400 font-mono">
              Cargando planificación comercial...
            </div>
          ) : (
            <PlanificacionMonthlyView
              month={currentSelectedMonth}
              year={referenceDate.getFullYear()}
              records={monthlyRecords}
              onSelectDay={handleSelectSpecificDay}
              onSelectAdvisor={(adv) => setSelectedAdvisor(adv === selectedAdvisor ? null : adv)}
            />
          )}
        </main>
      </div>
    </div>
  );
}
