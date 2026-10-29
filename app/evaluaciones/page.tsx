"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Menu,
  Plus,
  PenLine,
  X,
  Eye,
  Search,
  Check,
  RotateCw,
} from "lucide-react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { SidebarOpenButton } from "@/components/providers/sidebar-provider";
import {
  EvaluacionRecord,
  EvaluadorRol,
  EvaluacionFrecuencia,
  getCumplimientoLevel,
  EvaluacionItemState,
  EVALUACION_FACTORES,
  formatEvaluadorRol,
} from "@/lib/evaluaciones-data";
import { EvaluacionDropdown } from "@/components/evaluaciones/evaluacion-dropdown";
import { EvaluacionFormModal } from "@/components/evaluaciones/evaluacion-form-modal";
import { EvaluacionDetailModal } from "@/components/evaluaciones/evaluacion-detail-modal";
import { EvaluacionesAnalytics } from "@/components/evaluaciones/evaluaciones-analytics";
import { useUser } from "@/components/providers/user-provider";
import { cn } from "@/lib/utils";

type ActiveTab = "registros" | "rendimiento";

// Client module-level cache for instantaneous panel transitions
let cachedEvaluaciones: EvaluacionRecord[] = [];
let cachedAdvisorsList: string[] = [];
let hasLoadedEvaluaciones = false;

function EvaluacionesContent() {
  const router = useRouter();
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState<ActiveTab>("registros");
  const [evaluaciones, setEvaluaciones] = useState<EvaluacionRecord[]>(() => cachedEvaluaciones);
  const [advisorsList, setAdvisorsList] = useState<string[]>(() => cachedAdvisorsList);
  const [loading, setLoading] = useState(!hasLoadedEvaluaciones);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterFrecuencia, setFilterFrecuencia] = useState<string>("todas");
  const [filterRol, setFilterRol] = useState<string>("todos");
  const [filterAsesor, setFilterAsesor] = useState<string>("todos");

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<EvaluacionRecord | null>(null);
  const [viewingRecord, setViewingRecord] = useState<EvaluacionRecord | null>(null);
  const [saving, setSaving] = useState(false);

  // In-app Delete Confirmation Modal (Rule 4: Zero native browser dialogs)
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    id: string;
    asesor: string;
    fecha: string;
  } | null>(null);

  // Toast feedback (Rule 2: Minimalist dark pill, zero colored banner boxes)
  const [toastMsg, setToastMsg] = useState<{ text: string; type?: "success" | "error" } | null>(null);

  const showToast = useCallback((text: string, type: "success" | "error" = "success") => {
    setToastMsg({ text, type });
    setTimeout(() => {
      setToastMsg((cur) => (cur?.text === text ? null : cur));
    }, 3500);
  }, []);

  const searchParams = useSearchParams();

  // Listen to searchParams for incoming links (?action=nueva, ?tab=rendimiento, ?tab=registros)
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "rendimiento") {
      router.replace("/evaluaciones/rendimiento");
    } else if (tabParam === "registros") {
      setActiveTab("registros");
    }

    const actionParam = searchParams.get("action");
    if (actionParam === "nueva") {
      router.replace("/evaluaciones/nueva");
    }
  }, [searchParams, router]);

  // Fetch evaluations
  const loadEvaluaciones = useCallback(async (silent = hasLoadedEvaluaciones) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/evaluaciones?t=${Date.now()}`, {
        cache: "no-store",
      }).then((r) => r.json());

      if (res.success) {
        const evals = res.evaluaciones || [];
        cachedEvaluaciones = evals;
        setEvaluaciones(evals);
        if (Array.isArray(res.advisors)) {
          cachedAdvisorsList = res.advisors;
          setAdvisorsList(res.advisors);
        }
        hasLoadedEvaluaciones = true;
      } else {
        showToast("Error al cargar evaluaciones", "error");
      }
    } catch (err) {
      console.error("Error loading evaluaciones:", err);
      showToast("Error de conexión al cargar evaluaciones", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadEvaluaciones();
  }, [loadEvaluaciones]);

  // Handle Save
  const handleSaveEvaluation = async (recordData: Partial<EvaluacionRecord>): Promise<boolean> => {
    setSaving(true);
    try {
      const res = await fetch("/api/evaluaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(recordData),
      }).then((r) => r.json());

      if (res.success) {
        showToast(
          recordData.id
            ? "Evaluación actualizada correctamente"
            : "Evaluación registrada con éxito"
        );
        loadEvaluaciones();
        return true;
      } else {
        showToast(res.error || "Error al guardar la evaluación", "error");
        return false;
      }
    } catch (err) {
      console.error("Error saving evaluation:", err);
      showToast("Error de conexión al guardar", "error");
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Handle Delete
  const executeDelete = async () => {
    if (!deleteConfirmation) return;
    const { id } = deleteConfirmation;

    try {
      const res = await fetch(`/api/evaluaciones?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      }).then((r) => r.json());

      if (res.success) {
        showToast("Evaluación eliminada correctamente");
        setEvaluaciones((prev) => prev.filter((e) => e.id !== id));
      } else {
        showToast(res.error || "Error al eliminar la evaluación", "error");
      }
    } catch (err) {
      console.error("Error deleting evaluation:", err);
      showToast("Error de conexión al eliminar", "error");
    } finally {
      setDeleteConfirmation(null);
    }
  };

  // Open create modal for specific advisor
  const handleOpenCreateForAdvisor = (advisorName: string) => {
    const defaultItems: Record<string, EvaluacionItemState> = {};
    EVALUACION_FACTORES.forEach((f) => {
      f.items.forEach((it) => {
        defaultItems[it.id] = { puntuacion: 5, cumple: true, observacion: "" };
      });
    });

    setEditingRecord({
      id: "",
      asesor: advisorName,
      evaluador: user?.nombre?.trim() || user?.email || "",
      evaluadorRol: formatEvaluadorRol(user?.rol),
      frecuencia: "Diaria",
      fecha: new Date().toISOString().split("T")[0],
      estado: "",
      municipio: "",
      parroquia: "",
      sector: "",
      items: defaultItems,
      observacionesGenerales: "",
      cumplimientoPct: 100,
      puntuacionTotal: 150,
      puntuacionMaxima: 150,
      puntuacionPromedio: 5.0,
      itemsCumplidos: 150,
      itemsTotal: 150,
      factorScores: {},
      createdAt: "",
      updatedAt: "",
    });
    setIsFormModalOpen(true);
  };

  // Filtered evaluations
  const filteredEvaluaciones = useMemo(() => {
    return evaluaciones.filter((item) => {
      // Frecuencia (case-insensitive)
      if (
        filterFrecuencia !== "todas" &&
        (item.frecuencia || "").toLowerCase() !== filterFrecuencia.toLowerCase()
      ) {
        return false;
      }
      // Rol (case-insensitive and format-aware)
      if (filterRol !== "todos") {
        const itemRolNorm = (item.evaluadorRol || "").toLowerCase().replace(/_/g, " ");
        const filterRolNorm = filterRol.toLowerCase().replace(/_/g, " ");
        if (itemRolNorm !== filterRolNorm) {
          return false;
        }
      }
      // Asesor
      if (filterAsesor !== "todos" && item.asesor !== filterAsesor) {
        return false;
      }
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = item.asesor.toLowerCase().includes(q);
        const matchesEval = item.evaluador.toLowerCase().includes(q);
        const matchesSector = item.sector.toLowerCase().includes(q);
        const matchesObs = item.observacionesGenerales?.toLowerCase().includes(q);
        if (!matchesName && !matchesEval && !matchesSector && !matchesObs) {
          return false;
        }
      }
      return true;
    });
  }, [evaluaciones, filterFrecuencia, filterRol, filterAsesor, searchQuery]);

  // Overall KPI Metrics (Rule 5: Zero uppercase, clean typography, zero decorative icons in headings)
  const kpiStats = useMemo(() => {
    const total = evaluaciones.length;
    const avgScore =
      total > 0
        ? Math.round(evaluaciones.reduce((acc, e) => acc + e.cumplimientoPct, 0) / total)
        : 0;

    const currentMonthIso = new Date().toISOString().slice(0, 7); // YYYY-MM
    const thisMonthCount = evaluaciones.filter((e) => e.fecha.startsWith(currentMonthIso)).length;

    const uniqueAdvisors = new Set(evaluaciones.map((e) => e.asesor)).size;

    return {
      total,
      avgScore,
      thisMonthCount,
      uniqueAdvisors,
    };
  }, [evaluaciones]);

  // Dropdown options
  const frecuenciaFilterOptions = [
    { value: "todas", label: "Todas las frecuencias" },
    { value: "diaria", label: "Diaria" },
    { value: "semanal", label: "Semanal" },
    { value: "mensual", label: "Mensual" },
  ];

  const rolFilterOptions = [
    { value: "todos", label: "Todos los evaluadores" },
    { value: "supervisor", label: "Supervisor" },
    { value: "asesor_impulsador", label: "Asesor Impulsador" },
    { value: "coordinador", label: "Coordinador" },
  ];

  const advisorFilterOptions = useMemo(() => {
    const list = [{ value: "todos", label: "Todos los asesores de ventas" }];
    const unique = Array.from(new Set(advisorsList)).sort();
    unique.forEach((adv) => {
      list.push({ value: adv, label: adv });
    });
    return list;
  }, [advisorsList]);

  const getFrecuenciaBadge = (f: EvaluacionFrecuencia) => {
    if (f === "diaria") return "Diaria";
    if (f === "semanal") return "Semanal";
    if (f === "mensual") return "Mensual";
    return f;
  };

  const getRolLabel = (r: EvaluadorRol) => {
    if (r === "supervisor") return "Supervisor";
    if (r === "asesor_impulsador") return "Asesor Impulsador";
    if (r === "coordinador") return "Coordinador";
    return r;
  };

  return (
    <div className="flex min-h-screen bg-[#FDFDFD] text-neutral-900 font-sans antialiased selection:bg-neutral-900 selection:text-white">
      {/* Sidebar Desktop & Mobile */}
      <Sidebar
        activeSection="evaluaciones"
        isMobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <header className="sticky top-0 z-20 h-12 bg-white border-b border-neutral-200/80 px-3 sm:px-6 flex items-center justify-between select-none">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="xl:hidden -ml-2 min-w-[44px] min-h-[44px] p-2.5 text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer flex items-center justify-center"
              title="Abrir menú"
              aria-label="Abrir menú"
            >
              <Menu className="w-4 h-4 stroke-[1.75]" />
            </button>
            <SidebarOpenButton />
          </div>

          <div className="flex items-center">
            <span className="text-xs sm:text-sm font-normal text-neutral-700 tracking-tight font-sans">
              Evaluación y supervisión
            </span>
          </div>
        </header>

        {/* Page Inner Container */}
        <main className="p-3 sm:p-6 pb-20 xl:pb-6 max-w-5xl w-full mx-auto space-y-5 sm:space-y-6">
          {/* Sub Navigation Tabs & Top Actions Bar (Standard project structure) */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-2 text-xs">
            <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto no-scrollbar scroll-smooth whitespace-nowrap -mx-3 px-3 sm:mx-0 sm:px-0">
              <button
                type="button"
                onClick={() => setActiveTab("registros")}
                className={cn(
                  "min-h-[44px] py-2.5 font-medium transition-colors border-b-2 -mb-2 cursor-pointer flex items-center gap-2",
                  activeTab === "registros"
                    ? "border-neutral-900 text-neutral-950 font-semibold"
                    : "border-transparent text-neutral-400 hover:text-neutral-700"
                )}
              >
                <span>Registro de evaluaciones</span>
                <span className="text-[10px] font-mono text-neutral-400">
                  ({filteredEvaluaciones.length})
                </span>
              </button>

              <Link
                href="/evaluaciones/rendimiento"
                className="min-h-[44px] py-2.5 font-medium transition-colors border-b-2 -mb-2 cursor-pointer flex items-center gap-2 border-transparent text-neutral-400 hover:text-neutral-700"
              >
                <span>Rendimiento por asesor</span>
              </Link>
            </div>

            <div className="flex items-center gap-2 sm:gap-4 ml-auto">
              <button
                type="button"
                onClick={() => loadEvaluaciones()}
                className="min-h-[44px] py-2 px-2 text-neutral-500 hover:text-neutral-900 font-medium transition-colors cursor-pointer flex items-center gap-1.5"
                title="Recargar datos"
                aria-label="Actualizar datos"
              >
                <RotateCw className={cn("w-3.5 h-3.5 stroke-[1.75]", loading && "animate-spin text-neutral-900")} />
                <span className="hidden sm:inline">Actualizar</span>
              </button>

              <Link
                href="/evaluaciones/nueva"
                className="min-h-[44px] py-2 px-2.5 inline-flex items-center gap-1.5 text-neutral-900 hover:text-neutral-600 font-semibold transition-colors cursor-pointer select-none"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2]" />
                <span>Nueva evaluación</span>
              </Link>
            </div>
          </div>

          {/* Metric KPI Section: Compact responsive grid with subtle dividers */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-y-3 sm:gap-y-0 py-2 divide-y sm:divide-y-0 sm:divide-x divide-neutral-100 select-none">
            {/* Total evaluaciones */}
            <div className="py-1 px-3 sm:px-4 flex flex-col justify-between">
              <span className="text-[11px] sm:text-xs text-neutral-500 font-sans font-medium">
                Total evaluaciones
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl sm:text-2xl font-bold font-mono text-neutral-950">
                  {kpiStats.total}
                </span>
                <span className="text-[10px] sm:text-[11px] font-mono text-neutral-400">
                  histórico
                </span>
              </div>
            </div>

            {/* Cumplimiento promedio */}
            <div className="py-1 px-3 sm:px-4 flex flex-col justify-between">
              <span className="text-[11px] sm:text-xs text-neutral-500 font-sans font-medium">
                Cumplimiento promedio
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl sm:text-2xl font-bold font-mono text-neutral-950">
                  {kpiStats.avgScore}%
                </span>
                <span className="text-[10px] sm:text-[11px] font-mono text-neutral-400">
                  global
                </span>
              </div>
            </div>

            {/* Evaluaciones este mes */}
            <div className="py-1 px-3 sm:px-4 flex flex-col justify-between">
              <span className="text-[11px] sm:text-xs text-neutral-500 font-sans font-medium">
                Evaluaciones este mes
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl sm:text-2xl font-bold font-mono text-neutral-950">
                  {kpiStats.thisMonthCount}
                </span>
                <span className="text-[10px] sm:text-[11px] font-mono text-neutral-400">
                  recientes
                </span>
              </div>
            </div>

            {/* Asesores evaluados */}
            <div className="py-1 px-3 sm:px-4 flex flex-col justify-between">
              <span className="text-[11px] sm:text-xs text-neutral-500 font-sans font-medium">
                Asesores evaluados
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl sm:text-2xl font-bold font-mono text-neutral-950">
                  {kpiStats.uniqueAdvisors}
                </span>
                <span className="text-[10px] sm:text-[11px] font-mono text-neutral-400">
                  colaboradores
                </span>
              </div>
            </div>
          </section>

          {/* Línea difusa horizontal (feathered reference line) */}
          <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-neutral-300 to-transparent my-1" />

          {/* Tab 1: Registro de Evaluaciones */}
          {activeTab === "registros" && (
            <div className="space-y-4">
              {/* Filter and Search Bar: Compact 2-row layout on mobile, single row on desktop */}
              <div className="space-y-2 sm:space-y-0 sm:flex sm:items-center sm:justify-between text-xs">
                {/* Search */}
                <div className="flex items-center gap-2 w-full sm:w-72 border-b border-neutral-200/80 pb-1 focus-within:border-neutral-900 transition-colors">
                  <Search className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar asesor, evaluador o sector..."
                    className="w-full bg-transparent border-none outline-none text-xs text-neutral-900 placeholder:text-neutral-400 font-sans"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="text-neutral-400 hover:text-neutral-900 cursor-pointer p-0.5"
                      title="Borrar búsqueda"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Dropdown Filters: Horizontal scrollable strip on mobile, clean flex on desktop */}
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 whitespace-nowrap">
                  <div className="min-w-[130px] shrink-0">
                    <EvaluacionDropdown
                      value={filterFrecuencia}
                      options={frecuenciaFilterOptions}
                      onChange={(val) => setFilterFrecuencia(val)}
                      className="py-1 px-1.5 border-b border-neutral-200/70 hover:border-neutral-900 text-xs text-neutral-700"
                    />
                  </div>

                  <div className="min-w-[140px] shrink-0">
                    <EvaluacionDropdown
                      value={filterRol}
                      options={rolFilterOptions}
                      onChange={(val) => setFilterRol(val)}
                      className="py-1 px-1.5 border-b border-neutral-200/70 hover:border-neutral-900 text-xs text-neutral-700"
                    />
                  </div>

                  <div className="min-w-[150px] shrink-0">
                    <EvaluacionDropdown
                      value={filterAsesor}
                      options={advisorFilterOptions}
                      onChange={(val) => setFilterAsesor(val)}
                      withSearch
                      align="right"
                      className="py-1 px-1.5 border-b border-neutral-200/70 hover:border-neutral-900 text-xs text-neutral-700"
                    />
                  </div>

                  {(searchQuery || filterFrecuencia !== "todas" || filterRol !== "todos" || filterAsesor !== "todos") && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery("");
                        setFilterFrecuencia("todas");
                        setFilterRol("todos");
                        setFilterAsesor("todos");
                      }}
                      className="shrink-0 text-[11px] text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer px-1 py-1"
                    >
                      Limpiar
                    </button>
                  )}
                </div>
              </div>

              {/* Desktop Table (hidden on mobile) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-200/80 text-neutral-400 font-medium text-[11px]">
                      <th className="py-2.5 px-3 font-medium">Fecha</th>
                      <th className="py-2.5 px-3 font-medium">Asesor</th>
                      <th className="py-2.5 px-3 font-medium">Evaluador / Rol</th>
                      <th className="py-2.5 px-3 font-medium">Frecuencia</th>
                      <th className="py-2.5 px-3 font-medium">Sector / Ubicación</th>
                      <th className="py-2.5 px-3 font-medium text-center">Cumplimiento</th>
                      <th className="py-2.5 px-3 font-medium text-right w-24">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-xs text-neutral-400">
                          Cargando evaluaciones...
                        </td>
                      </tr>
                    ) : filteredEvaluaciones.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-14 text-center">
                          <div className="flex flex-col items-center justify-center space-y-1.5">
                            <span className="text-xs font-semibold text-neutral-800">
                              Sin evaluaciones registradas
                            </span>
                            <p className="text-[11px] text-neutral-400">
                              No se encontraron registros con los filtros actuales.
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredEvaluaciones.map((item) => {
                        const level = getCumplimientoLevel(item.cumplimientoPct);
                        return (
                          <tr
                            key={item.id}
                            className="hover:bg-neutral-50/70 transition-colors group"
                          >
                            {/* Fecha */}
                            <td className="py-3 px-3 font-mono text-neutral-600">
                              {item.fecha}
                            </td>

                            {/* Asesor */}
                            <td className="py-3 px-3 font-semibold text-neutral-900">
                              <button
                                type="button"
                                onClick={() => setViewingRecord(item)}
                                className="text-left hover:underline cursor-pointer"
                                title="Ver formato oficial completo"
                              >
                                {item.asesor}
                              </button>
                            </td>

                            {/* Evaluador & Rol */}
                            <td className="py-3 px-3 text-neutral-700">
                              <div className="flex flex-col">
                                <span>{item.evaluador}</span>
                                <span className="text-[10px] text-neutral-400 font-sans">
                                  {getRolLabel(item.evaluadorRol)}
                                </span>
                              </div>
                            </td>

                            {/* Frecuencia */}
                            <td className="py-3 px-3 text-neutral-600 font-sans">
                              <span className="text-[11px]">
                                {getFrecuenciaBadge(item.frecuencia)}
                              </span>
                            </td>

                            {/* Sector & Ubicación */}
                            <td className="py-3 px-3 text-neutral-600 font-sans">
                              <div className="flex flex-col">
                                <span className="font-medium text-neutral-800">{item.sector}</span>
                                {(item.parroquia || item.municipio) && (
                                  <span className="text-[10px] text-neutral-400">
                                    {[item.parroquia, item.estado].filter(Boolean).join(" · ")}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Cumplimiento */}
                            <td className="py-3 px-3 text-center">
                              <div className="inline-flex items-center gap-1.5 font-mono">
                                <span className="font-bold text-neutral-950">
                                  {item.cumplimientoPct}%
                                </span>
                                <span className="text-[10px] text-neutral-400">
                                  ({item.puntuacionPromedio ?? (item.cumplimientoPct / 20).toFixed(1)}/5)
                                </span>
                                <span
                                  className={cn(
                                    "w-1.5 h-1.5 rounded-full",
                                    level.dotColorClass
                                  )}
                                  title={level.label}
                                />
                              </div>
                            </td>

                            {/* Acciones (reveal on hover, PenLine stroke-[1.25], X stroke-[1.5]) */}
                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                {/* View Detail */}
                                <button
                                  type="button"
                                  onClick={() => setViewingRecord(item)}
                                  className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
                                  title="Ver formato oficial e imprimir"
                                >
                                  <Eye className="w-3.5 h-3.5 stroke-[1.25]" />
                                </button>

                                {/* Edit */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    router.push(`/evaluaciones/nueva?id=${encodeURIComponent(item.id)}`);
                                  }}
                                  className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
                                  title="Editar evaluación"
                                >
                                  <PenLine className="w-3.5 h-3.5 stroke-[1.25]" />
                                </button>

                                {/* Delete (minimalist X only) */}
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDeleteConfirmation({
                                      id: item.id,
                                      asesor: item.asesor,
                                      fecha: item.fecha,
                                    })
                                  }
                                  className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
                                  title="Eliminar evaluación"
                                >
                                  <X className="w-3.5 h-3.5 stroke-[1.5]" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Evaluations Card List (no horizontal scrollbar) */}
              <div className="md:hidden divide-y divide-neutral-100 font-sans text-xs">
                {loading ? (
                  <div className="py-12 text-center text-neutral-400">
                    Cargando evaluaciones...
                  </div>
                ) : filteredEvaluaciones.length === 0 ? (
                  <div className="py-14 text-center flex flex-col items-center justify-center space-y-1.5 select-none">
                    <span className="text-xs font-semibold text-neutral-800">
                      Sin evaluaciones registradas
                    </span>
                    <p className="text-[11px] text-neutral-400 max-w-xs">
                      No se encontraron registros con los filtros actuales.
                    </p>
                  </div>
                ) : (
                  filteredEvaluaciones.map((item) => {
                    const level = getCumplimientoLevel(item.cumplimientoPct);
                    return (
                      <div key={item.id} className="py-3.5 space-y-2">
                        {/* Header: Asesor, Cumplimiento & Actions */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={() => setViewingRecord(item)}
                              className="font-semibold text-neutral-900 text-left hover:underline cursor-pointer truncate block"
                            >
                              {item.asesor}
                            </button>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-neutral-500">
                              <span className="font-mono text-neutral-400">{item.fecha}</span>
                              <span>·</span>
                              <span>{getFrecuenciaBadge(item.frecuencia)}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5 shrink-0">
                            <div className="flex items-center gap-1 font-mono text-[11px]">
                              <span className="font-bold text-neutral-950">{item.cumplimientoPct}%</span>
                              <span className={cn("w-1.5 h-1.5 rounded-full", level.dotColorClass)} title={level.label} />
                            </div>

                            <button
                              type="button"
                              onClick={() => setViewingRecord(item)}
                              className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer p-1"
                              title="Ver formato oficial"
                            >
                              <Eye className="w-3.5 h-3.5 stroke-[1.25]" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                router.push(`/evaluaciones/nueva?id=${encodeURIComponent(item.id)}`);
                              }}
                              className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer p-1"
                              title="Editar evaluación"
                            >
                              <PenLine className="w-3.5 h-3.5 stroke-[1.25]" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDeleteConfirmation({
                                  id: item.id,
                                  asesor: item.asesor,
                                  fecha: item.fecha,
                                })
                              }
                              className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer p-1"
                              title="Eliminar evaluación"
                            >
                              <X className="w-3.5 h-3.5 stroke-[1.5]" />
                            </button>
                          </div>
                        </div>

                        {/* Details */}
                        <div className="text-[11px] text-neutral-500 space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-neutral-400">Evaluador:</span>
                            <span className="text-neutral-800">{item.evaluador}</span>
                            <span className="text-neutral-400 font-mono text-[10px]">({getRolLabel(item.evaluadorRol)})</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-neutral-400">Ubicación:</span>
                            <span className="text-neutral-800 font-medium">{item.sector}</span>
                            {(item.parroquia || item.estado) && (
                              <span className="text-neutral-400">
                                · {[item.parroquia, item.estado].filter(Boolean).join(", ")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Línea difusa inferior */}
              <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-neutral-300 to-transparent mt-2" />
            </div>
          )}

          {/* Tab 2: Rendimiento por Asesor */}
          {activeTab === "rendimiento" && (
            <EvaluacionesAnalytics
              evaluaciones={evaluaciones}
              onNewEvaluationForAdvisor={handleOpenCreateForAdvisor}
              onViewEvaluation={(record) => setViewingRecord(record)}
            />
          )}
        </main>
      </div>

      {/* Form Modal (Create / Edit) */}
      <EvaluacionFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingRecord(null);
        }}
        onSave={handleSaveEvaluation}
        initialData={editingRecord}
        advisorsList={advisorsList}
        saving={saving}
      />

      {/* Official Format Printable Detail Modal */}
      <EvaluacionDetailModal
        isOpen={!!viewingRecord}
        onClose={() => setViewingRecord(null)}
        record={viewingRecord}
        onEdit={(rec) => {
          setViewingRecord(null);
          router.push(`/evaluaciones/nueva?id=${encodeURIComponent(rec.id)}`);
        }}
      />

      {/* In-app Custom Delete Confirmation Dialog (Rule 4: Zero window.confirm) */}
      {deleteConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="bg-white rounded-xl shadow-xl border border-neutral-200/80 p-5 max-w-sm w-full space-y-4 animate-in zoom-in-95 duration-150"
            role="alertdialog"
          >
            <div>
              <h3 className="text-xs font-semibold text-neutral-900 font-sans tracking-tight">
                ¿Eliminar registro de evaluación?
              </h3>
              <p className="text-xs text-neutral-500 mt-1 font-sans">
                Esta acción eliminará la evaluación del asesor{" "}
                <strong className="text-neutral-900 font-medium">
                  {deleteConfirmation.asesor}
                </strong>{" "}
                correspondiente a la fecha {deleteConfirmation.fecha}.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 text-xs pt-1">
              <button
                type="button"
                onClick={() => setDeleteConfirmation(null)}
                className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer select-none"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={executeDelete}
                className="text-red-600 hover:text-red-700 font-semibold transition-colors cursor-pointer select-none"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification (Rule 2: Minimalist dark pill, zero colored banner rectangles) */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-3 py-2 bg-neutral-900 text-white rounded-md shadow-lg text-xs font-mono animate-in fade-in slide-in-from-bottom-2 duration-150">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
          <span>{toastMsg.text}</span>
          <button
            type="button"
            onClick={() => setToastMsg(null)}
            className="text-neutral-400 hover:text-white ml-2 transition-colors cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function EvaluacionesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#FDFDFD] text-xs font-mono text-neutral-400">
          Cargando módulo de evaluación...
        </div>
      }
    >
      <EvaluacionesContent />
    </Suspense>
  );
}
