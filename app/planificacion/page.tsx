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
import { PlanificacionWeeklyMatrix, WeekDay, AdvisorWeeklySchedule } from "@/components/planificacion/planificacion-weekly-matrix";
import { PlanificacionDailyView } from "@/components/planificacion/planificacion-daily-view";
import { PlanificacionMonthlyView } from "@/components/planificacion/planificacion-monthly-view";
import { PlanificacionEfectividadView } from "@/components/planificacion/planificacion-efectividad-view";
import { geoHierarchy } from "@/lib/geo_hierarchy";

type ViewMode = "mensual" | "efectividad";

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

// Convierte objeto Date a ISO YYYY-MM-DD
function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

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

// Obtiene el lunes de la semana que contiene una fecha
function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
}

const SPANISH_DAYS_FULL = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const SPANISH_DAYS_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export default function PlanificacionPage() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Inicialización instantánea desde caché si está disponible
  const [records, setRecords] = useState<PlanificacionRecord[]>(() => getCachedPlanificacionData() || []);
  const [rawSolicitudes, setRawSolicitudes] = useState<Solicitud[]>(() => getCachedOperationalData()?.solicitudes || []);
  const [rawInstallations, setRawInstallations] = useState<Installation[]>(() => getCachedOperationalData()?.installations || []);
  const [loading, setLoading] = useState(() => !getCachedPlanificacionData() || getCachedPlanificacionData()!.length === 0);
  const [operationalLoading, setOperationalLoading] = useState(() => !getCachedOperationalData());
  const [refreshing, setRefreshing] = useState(false);

  // Estados de vista y navegación: Calendario o Efectividad
  const [viewMode, setViewMode] = useState<ViewMode>("mensual");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMunicipio, setSelectedMunicipio] = useState("all");
  const [selectedActividad, setSelectedActividad] = useState("all");
  const [selectedAdvisor, setSelectedAdvisor] = useState<string | null>(null);

  // Fecha de referencia: por defecto 2026-11-02 (o fecha actual)
  const [referenceDate, setReferenceDate] = useState<Date>(() => new Date(2026, 10, 2));

  // Carga progresiva y desacoplada de planificación y operaciones para renderizado instantáneo
  const loadData = useCallback(async (force = false) => {
    if (force) setRefreshing(true);
    else if (records.length === 0) setLoading(true);

    // 1. Cargar datos de planificación comercial primero (renderizado inmediato de cuadrícula)
    const planPromise = fetchPlanificacionData(force)
      .then((planData) => {
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
      })
      .catch((err) => {
        console.error("Error al cargar planificación comercial:", err);
      })
      .finally(() => {
        setLoading(false);
      });

    // 2. Cargar datos operativos (solicitudes e instalaciones) concurrentemente en segundo plano
    setOperationalLoading(true);
    const opPromise = fetchRawOperationalData(undefined, undefined, undefined, undefined, force)
      .then((opData) => {
        if (opData) {
          setRawSolicitudes(opData.solicitudes || []);
          setRawInstallations(opData.installations || []);
        }
      })
      .catch((err) => {
        console.warn("Aviso al cargar datos de operaciones en segundo plano:", err);
      })
      .finally(() => {
        setOperationalLoading(false);
        setRefreshing(false);
      });

    await Promise.all([planPromise, opPromise]);
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

  // Lista de municipios disponibles para el filtro (solo municipios reales de la jerarquía oficial y registros válidos)
  const availableMunicipios = useMemo(() => {
    const set = new Set<string>();
    // De geoHierarchy (fuente canónica oficial)
    Object.values(geoHierarchy).forEach((munMap) => {
      Object.keys(munMap).forEach((m) => {
        if (isValidGeoName(m)) set.add(m);
      });
    });
    // De records
    records.forEach((r) => {
      if (isValidGeoName(r.municipio)) {
        set.add(formatProperCase(r.municipio));
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [records]);

  // Mes seleccionado actual basado en referenceDate
  const currentSelectedMonth = useMemo(() => {
    const mIdx = referenceDate.getMonth();
    return MONTH_ORDER[mIdx] || "Noviembre";
  }, [referenceDate]);

  // Registros filtrados transversalmente por búsqueda, municipio y actividad
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

    if (selectedMunicipio !== "all") {
      list = list.filter((r) => normKey(r.municipio) === normKey(selectedMunicipio));
    }

    if (selectedActividad !== "all") {
      list = list.filter((r) => normKey(r.tipo_actividad || r.plan) === normKey(selectedActividad));
    }

    if (selectedAdvisor) {
      const targetNk = normKey(selectedAdvisor);
      list = list.filter((r) => normKey(r.asesor) === targetNk);
    }

    return list;
  }, [records, searchTerm, selectedMunicipio, selectedActividad, selectedAdvisor]);

  // Cálculos para la VISTA SEMANAL
  const { weekDays, weeklySchedules } = useMemo(() => {
    const monday = getMonday(referenceDate);
    const todayIso = toIsoDate(new Date(2026, 10, 2));

    const days: WeekDay[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const iso = toIsoDate(d);
      const dayIdx = d.getDay();

      days.push({
        dateStr: iso,
        dayName: SPANISH_DAYS_FULL[dayIdx],
        dayShort: SPANISH_DAYS_SHORT[dayIdx],
        dayNumber: String(d.getDate()).padStart(2, "0"),
        isToday: iso === todayIso,
      });
    }

    const weekDatesSet = new Set(days.map((d) => d.dateStr));
    const inWeekRecords = filteredRecords.filter((r) => weekDatesSet.has(r.fecha));

    const advisorMap = new Map<string, {
      name: string;
      normName: string;
      assignmentsByDate: Record<string, PlanificacionRecord[]>;
      totalJornadas: number;
      sectorsSet: Set<string>;
    }>();

    inWeekRecords.forEach((r) => {
      if (!r.asesor || r.asesor === "Sin Asesor") return;
      const nk = normKey(r.asesor);
      if (!advisorMap.has(nk)) {
        advisorMap.set(nk, {
          name: r.asesor,
          normName: nk,
          assignmentsByDate: {},
          totalJornadas: 0,
          sectorsSet: new Set(),
        });
      }

      const adv = advisorMap.get(nk)!;
      if (!adv.assignmentsByDate[r.fecha]) {
        adv.assignmentsByDate[r.fecha] = [];
      }
      adv.assignmentsByDate[r.fecha].push(r);
      adv.totalJornadas += 1;
      if (r.sector) adv.sectorsSet.add(r.sector);
    });

    const schedules: AdvisorWeeklySchedule[] = Array.from(advisorMap.values())
      .map((a) => ({
        name: a.name,
        normName: a.normName,
        assignmentsByDate: a.assignmentsByDate,
        totalJornadas: a.totalJornadas,
        distinctSectors: a.sectorsSet.size,
      }))
      .sort((a, b) => b.totalJornadas - a.totalJornadas || a.name.localeCompare(b.name));

    return { weekDays: days, weeklySchedules: schedules };
  }, [referenceDate, filteredRecords]);

  // Cálculos para la VISTA DIARIA
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

  // Cálculos para la VISTA MENSUAL
  const monthlyRecords = useMemo(() => {
    const mKey = normKey(currentSelectedMonth);
    return filteredRecords.filter((r) => normKey(r.mes) === mKey);
  }, [filteredRecords, currentSelectedMonth]);

  // Métricas para el periodo activo
  const activeMetrics = useMemo(() => {
    let scopeRecords: PlanificacionRecord[] = [];
    let periodLabel = "";

    if (viewMode === "semanal") {
      const weekDatesSet = new Set(weekDays.map((d) => d.dateStr));
      scopeRecords = filteredRecords.filter((r) => weekDatesSet.has(r.fecha));
      const first = weekDays[0];
      const last = weekDays[weekDays.length - 1];
      periodLabel = `Semana del ${first?.dayNumber} al ${last?.dayNumber} de ${currentSelectedMonth}`;
    } else if (viewMode === "diaria") {
      scopeRecords = dailyRecords;
      periodLabel = dailyDateLabel;
    } else {
      scopeRecords = monthlyRecords;
      periodLabel = `Mes de ${currentSelectedMonth}`;
    }

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

    return {
      totalAdvisors: advisorsSet.size,
      totalSectors: sectorsSet.size,
      totalJornadas: scopeRecords.length,
      predominantActivity: predCount > 0 ? { name: predName, count: predCount, pct: predPct } : undefined,
      periodLabel,
    };
  }, [viewMode, weekDays, currentSelectedMonth, filteredRecords, dailyRecords, dailyDateLabel, monthlyRecords]);

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
                Rutas, cronograma y efectividad de actividades en campo
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
          {/* Fila 1: Selector de Perspectiva (Calendario y Efectividad y retorno) y Controles Temporales */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-100 pb-3">
            {/* Selector de Perspectiva: Botones tipográficos limpios */}
            <div className="flex items-center gap-3 text-xs overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setViewMode("mensual")}
                className={cn(
                  "transition-colors cursor-pointer py-1 text-xs whitespace-nowrap",
                  viewMode === "mensual"
                    ? "text-neutral-950 font-semibold border-b-2 border-neutral-900"
                    : "text-neutral-400 hover:text-neutral-700"
                )}
              >
                Calendario
              </button>
              <span className="text-neutral-300">·</span>
              <button
                type="button"
                onClick={() => setViewMode("efectividad")}
                className={cn(
                  "transition-colors cursor-pointer py-1 text-xs whitespace-nowrap",
                  viewMode === "efectividad"
                    ? "text-neutral-950 font-semibold border-b-2 border-neutral-900"
                    : "text-neutral-400 hover:text-neutral-700"
                )}
              >
                Efectividad y retorno
              </button>
            </div>

            {/* Controles de Navegación Temporal (en vista Calendario) */}
            {viewMode === "mensual" && (
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
            )}
          </div>

          {/* Fila 2: Sub-filtros y Buscador para vistas operativas */}
          {viewMode !== "efectividad" && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {viewMode === "mensual" ? (
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
              ) : (
                <div className="flex items-center gap-3 overflow-x-auto no-scrollbar text-xs">
                  <span className="text-[11px] text-neutral-400 font-mono">Municipio:</span>
                  <button
                    type="button"
                    onClick={() => setSelectedMunicipio("all")}
                    className={cn(
                      "cursor-pointer transition-colors py-0.5",
                      selectedMunicipio === "all" ? "text-neutral-950 font-semibold" : "text-neutral-400 hover:text-neutral-700"
                    )}
                  >
                    Todos
                  </button>
                  {availableMunicipios.slice(0, 5).map((mun) => (
                    <button
                      key={mun}
                      type="button"
                      onClick={() => setSelectedMunicipio(mun === selectedMunicipio ? "all" : mun)}
                      className={cn(
                        "cursor-pointer transition-colors py-0.5 whitespace-nowrap",
                        selectedMunicipio === mun ? "text-neutral-950 font-semibold border-b border-neutral-900" : "text-neutral-400 hover:text-neutral-700"
                      )}
                    >
                      {mun}
                    </button>
                  ))}
                </div>
              )}

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
          )}

          {/* Fila 3: Cinta de Métricas Operativas (solo en vistas de cronograma) */}
          {viewMode !== "efectividad" && (
            <>
              <PlanificacionMetrics
                totalAdvisors={activeMetrics.totalAdvisors}
                totalSectors={activeMetrics.totalSectors}
                totalJornadas={activeMetrics.totalJornadas}
                predominantActivity={activeMetrics.predominantActivity}
                periodLabel={activeMetrics.periodLabel}
              />
              <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-neutral-300 to-transparent my-1" />
            </>
          )}

          {/* Fila 4: Visualización Principal según Modo */}
          {loading ? (
            <div className="py-24 text-center text-xs text-neutral-400 font-mono">
              Cargando registros operativos de planificación...
            </div>
          ) : (
            <>
              {viewMode === "mensual" && (
                <PlanificacionMonthlyView
                  month={currentSelectedMonth}
                  year={referenceDate.getFullYear()}
                  records={monthlyRecords}
                  onSelectDay={handleSelectSpecificDay}
                  onSelectAdvisor={(adv) => setSelectedAdvisor(adv === selectedAdvisor ? null : adv)}
                />
              )}

              {viewMode === "efectividad" && (
                <PlanificacionEfectividadView
                  planRecords={records}
                  solicitudes={rawSolicitudes}
                  installations={rawInstallations}
                  operationalLoading={operationalLoading}
                  onSelectSector={(sec) => {
                    setSearchTerm(sec);
                    setViewMode("mensual");
                  }}
                  onSelectAdvisor={(adv) => {
                    setSelectedAdvisor(adv === selectedAdvisor ? null : adv);
                  }}
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
