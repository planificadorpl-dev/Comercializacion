"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  RotateCw,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
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
import { PlanificacionFilterCommandBar } from "@/components/planificacion/planificacion-filter-command-bar";
import { PlanificadorCreateForm } from "@/components/planificador/planificador-create-form";
import { PlanificadorMatrixView } from "@/components/planificador/planificador-matrix-view";
import { PlanificadorTableView } from "@/components/planificador/planificador-table-view";
import { PlanificadorEditDialog } from "@/components/planificador/planificador-edit-dialog";
import {
  PlanningSheetRecord,
  PlanningMetadata,
  NewPlanningItem,
  getMonthFromDate,
} from "@/lib/planificacion-types";

type ViewMode = "mensual" | "diaria" | "crear";

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

function toStandardIsoDate(val: any): string {
  if (!val) return "";
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, "0");
    const d = String(val.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);

  const parts = str.split(/[\/\-]/).map((p) => parseInt(p, 10));
  if (parts.length === 3) {
    let y = parts[2];
    let m = parts[1];
    let d = parts[0];
    if (parts[0] > 1000) {
      y = parts[0];
      m = parts[1];
      d = parts[2];
    }
    if (y && m && d && !isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }
  return "";
}

const toIsoDate = toStandardIsoDate;

function matchesDate(itemFecha: any, targetIso: string): boolean {
  if (!targetIso || !itemFecha) return false;
  const iso = toStandardIsoDate(itemFecha);
  return Boolean(iso && iso === targetIso);
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

  // Planificador integrado state
  const [planificadorSubTab, setPlanificadorSubTab] = useState<"crear" | "matriz" | "tabla">("crear");
  const [planificadorMetadata, setPlanificadorMetadata] = useState<PlanningMetadata | null>(null);
  const [planificadorRecords, setPlanificadorRecords] = useState<PlanningSheetRecord[]>([]);
  const [editingSheetRecord, setEditingSheetRecord] = useState<PlanningSheetRecord | null>(null);
  const [planificadorLoading, setPlanificadorLoading] = useState(false);

  const loadPlanificadorData = useCallback(async (force = false) => {
    try {
      setPlanificadorLoading(true);
      const refreshParam = force ? "?refresh=true" : "";
      const res = await fetch(`/api/planificacion${refreshParam}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      const json = await res.json();
      if (json.success) {
        if (json.metadata) setPlanificadorMetadata(json.metadata);
        if (Array.isArray(json.records)) setPlanificadorRecords(json.records);
      }
    } catch (err) {
      console.warn("Could not load planificador data:", err);
    } finally {
      setPlanificadorLoading(false);
    }
  }, []);

  const handleSaveEditSheetRecord = async (
    sheetRowIndex: number,
    updatedItem: NewPlanningItem
  ): Promise<boolean> => {
    try {
      const res = await fetch("/api/planificacion", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetRowIndex, item: updatedItem }),
      });
      const json = await res.json();
      if (json.success) {
        loadPlanificadorData(true);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const handleDeleteSheetRecord = async (rec: PlanningSheetRecord): Promise<boolean> => {
    try {
      const res = await fetch(`/api/planificacion?sheetRowIndex=${rec.sheetRowIndex}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        loadPlanificadorData(true);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const handleReplicateDay = async (sourceIso: string, targetIso: string): Promise<boolean> => {
    const sourceRecords = planificadorRecords.filter((r) => r.isoFecha === sourceIso);
    if (sourceRecords.length === 0) return false;
    const targetMonth = getMonthFromDate(targetIso);
    const newItems: NewPlanningItem[] = sourceRecords.map((r) => ({
      fecha: targetIso,
      mes: targetMonth,
      asesor: r.asesor,
      estado: r.estado,
      municipio: r.municipio,
      parroquia: r.parroquia,
      sector: r.sector,
      tipo_actividad: r.tipo_actividad,
      estatus: "Planificado",
    }));

    try {
      const res = await fetch("/api/planificacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: newItems }),
      });
      const json = await res.json();
      if (json.success) {
        loadPlanificadorData(true);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

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

  // Opciones dinámicas para el buscador de filtros
  const filterOptions = useMemo(() => {
    const advSet = new Set<string>();
    const secSet = new Set<string>();
    const parSet = new Set<string>();
    const munSet = new Set<string>();

    records.forEach((r) => {
      if (r.asesor && r.asesor !== "Sin Asesor" && r.asesor !== "Desconocido") advSet.add(r.asesor);
      if (r.sector) secSet.add(r.sector);
      if (r.parroquia) parSet.add(r.parroquia);
      if (r.municipio) munSet.add(r.municipio);
    });

    return {
      advisors: Array.from(advSet).sort(),
      sectors: Array.from(secSet).sort(),
      months: availableMonths,
      parroquias: Array.from(parSet).sort(),
      municipios: Array.from(munSet).sort(),
    };
  }, [records, availableMonths]);

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
      const targetIso = toStandardIsoDate(referenceDate);
      list = list.filter((s) => matchesDate(s.fecha, targetIso));
    } else if (selectedDateFilter) {
      const targetIso = toStandardIsoDate(selectedDateFilter);
      list = list.filter((s) => matchesDate(s.fecha, targetIso));
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
      const targetIso = toStandardIsoDate(referenceDate);
      list = list.filter((i) => matchesDate(i.fecha, targetIso));
    } else if (selectedDateFilter) {
      const targetIso = toStandardIsoDate(selectedDateFilter);
      list = list.filter((i) => matchesDate(i.fecha, targetIso));
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
      const targetIso = toStandardIsoDate(selectedDateFilter);
      return filteredRecords.filter((r) => toStandardIsoDate(r.fecha) === targetIso);
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
      const targetIso = toStandardIsoDate(selectedDateFilter);
      list = list.filter((s) => matchesDate(s.fecha, targetIso));
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
      const targetIso = toStandardIsoDate(selectedDateFilter);
      list = list.filter((i) => matchesDate(i.fecha, targetIso));
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
    const targetIso = toStandardIsoDate(referenceDate);
    const inDay = filteredRecords.filter((r) => toStandardIsoDate(r.fecha) === targetIso);
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

    let todayIso = "";
    try {
      todayIso = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Caracas" }).format(new Date());
    } catch {
      todayIso = new Date().toISOString().slice(0, 10);
    }

    let realizedCount = 0;
    scopeRecords.forEach((r) => {
      if (r.asesor && r.asesor !== "Sin Asesor") advisorsSet.add(r.asesor);
      if (r.sector && r.sector !== "N/A") sectorsSet.add(r.sector);
      const act = r.tipo_actividad || r.plan || "Recorrido";
      activityMap.set(act, (activityMap.get(act) || 0) + 1);

      const iso = toStandardIsoDate(r.fecha);
      const actLower = (r.tipo_actividad || r.plan || "").toLowerCase();
      const isNotInasistencia = !actLower.includes("inasistencia") && !actLower.includes("permiso");
      const hasSector = Boolean(r.sector && r.sector !== "N/A" && r.sector.trim() !== "");
      if (iso && iso <= todayIso && isNotInasistencia && hasSector) {
        realizedCount += 1;
      }
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
      realizedJornadas: realizedCount,
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
            <Link
              href="/planificador"
              className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors flex items-center gap-1 font-normal"
              title="Crear y asignar planificación en la hoja Data"
            >
              <span>Crear planificación</span>
              <ArrowRight className="w-3 h-3 stroke-[1.25]" />
            </Link>
            <span className="text-neutral-300">·</span>
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
        <main className="flex-1 p-4 sm:p-6 pb-28 xl:pb-8 max-w-7xl w-full mx-auto space-y-6">
          {/* Fila 1: Selector de Modo de Vista y Controles Temporales */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-100 pb-3">
            <div className="flex flex-wrap items-center gap-6">
              <button
                type="button"
                onClick={() => setViewMode("mensual")}
                className={cn(
                  "text-xs transition-colors cursor-pointer py-1 relative",
                  viewMode === "mensual"
                    ? "text-neutral-900 font-semibold"
                    : "text-neutral-400 hover:text-neutral-700 font-normal"
                )}
              >
                Calendario mensual
                {viewMode === "mensual" && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-900" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setViewMode("diaria")}
                className={cn(
                  "text-xs transition-colors cursor-pointer py-1 relative",
                  viewMode === "diaria"
                    ? "text-neutral-900 font-semibold"
                    : "text-neutral-400 hover:text-neutral-700 font-normal"
                )}
              >
                Detalle diario
                {viewMode === "diaria" && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-900" />
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setViewMode("crear");
                  loadPlanificadorData();
                }}
                className={cn(
                  "text-xs transition-colors cursor-pointer py-1 relative",
                  viewMode === "crear"
                    ? "text-neutral-900 font-semibold"
                    : "text-neutral-400 hover:text-neutral-700 font-normal"
                )}
              >
                Crear planificación (Sheet Data)
                {viewMode === "crear" && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-900" />
                )}
              </button>
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

          {viewMode === "crear" ? (
            <div className="space-y-6 pt-2">
              {/* Sub-tabs navigation */}
              <div className="flex items-center gap-6 border-b border-neutral-100 pb-2">
                <button
                  type="button"
                  onClick={() => setPlanificadorSubTab("crear")}
                  className={cn(
                    "text-xs transition-colors cursor-pointer py-1 relative",
                    planificadorSubTab === "crear"
                      ? "text-neutral-900 font-medium"
                      : "text-neutral-400 hover:text-neutral-700 font-normal"
                  )}
                >
                  Asignación rápida / por lotes
                  {planificadorSubTab === "crear" && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-900" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setPlanificadorSubTab("matriz")}
                  className={cn(
                    "text-xs transition-colors cursor-pointer py-1 relative",
                    planificadorSubTab === "matriz"
                      ? "text-neutral-900 font-medium"
                      : "text-neutral-400 hover:text-neutral-700 font-normal"
                  )}
                >
                  Matriz semanal
                  {planificadorSubTab === "matriz" && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-900" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setPlanificadorSubTab("tabla")}
                  className={cn(
                    "text-xs transition-colors cursor-pointer py-1 relative",
                    planificadorSubTab === "tabla"
                      ? "text-neutral-900 font-medium"
                      : "text-neutral-400 hover:text-neutral-700 font-normal"
                  )}
                >
                  Registros en Sheet Data ({planificadorRecords.length})
                  {planificadorSubTab === "tabla" && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-900" />
                  )}
                </button>
              </div>

              {planificadorLoading && !planificadorMetadata ? (
                <div className="py-20 text-center text-xs text-neutral-400 font-mono">
                  Cargando herramientas del planificador desde Google Sheets...
                </div>
              ) : planificadorMetadata ? (
                <>
                  {planificadorSubTab === "crear" && (
                    <PlanificadorCreateForm
                      metadata={planificadorMetadata}
                      existingRecords={planificadorRecords}
                      onSuccess={(count) => {
                        loadPlanificadorData(true);
                        loadData(true);
                      }}
                      defaultMonth={currentSelectedMonth.toUpperCase()}
                    />
                  )}

                  {planificadorSubTab === "matriz" && (
                    <PlanificadorMatrixView
                      records={planificadorRecords}
                      metadata={planificadorMetadata}
                      onEditRecord={(r) => setEditingSheetRecord(r)}
                      onDeleteRecord={handleDeleteSheetRecord}
                      onQuickAdd={(adv, d) => {
                        setPlanificadorSubTab("crear");
                      }}
                      onReplicateDay={handleReplicateDay}
                    />
                  )}

                  {planificadorSubTab === "tabla" && (
                    <PlanificadorTableView
                      records={planificadorRecords}
                      metadata={planificadorMetadata}
                      selectedMonth={currentSelectedMonth.toUpperCase()}
                      onEditRecord={(r) => setEditingSheetRecord(r)}
                      onDeleteRecord={handleDeleteSheetRecord}
                    />
                  )}
                </>
              ) : null}
            </div>
          ) : (
            <>
              {/* Fila 2: Selector de Meses y Buscador Avanzado de Filtros */}
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

                {/* Buscador de filtros con autocompletado y atajo interactivo */}
                <PlanificacionFilterCommandBar
                  searchTerm={searchTerm}
                  onSearchChange={setSearchTerm}
                  options={filterOptions}
                  selectedAdvisor={selectedAdvisor}
                  onSelectAdvisor={setSelectedAdvisor}
                  selectedSector={selectedSector}
                  onSelectSector={setSelectedSector}
                  selectedMonth={currentSelectedMonth}
                  onSelectMonth={handleSelectMonth}
                  onResetFilters={() => {
                    setSearchTerm("");
                    setSelectedAdvisor(null);
                    setSelectedSector(null);
                    setSelectedDateFilter(null);
                  }}
                />
              </div>

              {/* Fila 3: Cinta de Métricas Operativas */}
              <PlanificacionMetrics
                totalAdvisors={activeMetrics.totalAdvisors}
                totalSectors={activeMetrics.totalSectors}
                totalJornadas={activeMetrics.totalJornadas}
                realizedJornadas={activeMetrics.realizedJornadas}
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
            </>
          )}
        </main>
      </div>

      {/* Edit Record Modal Dialog */}
      {planificadorMetadata && (
        <PlanificadorEditDialog
          record={editingSheetRecord}
          metadata={planificadorMetadata}
          isOpen={Boolean(editingSheetRecord)}
          onClose={() => setEditingSheetRecord(null)}
          onSave={handleSaveEditSheetRecord}
        />
      )}
    </div>
  );
}
