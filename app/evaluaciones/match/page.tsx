"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import Link from "next/link";
import {
  Menu,
  RotateCw,
  Search,
  Eye,
  ChevronRight,
  Filter,
} from "lucide-react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { SidebarOpenButton } from "@/components/providers/sidebar-provider";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { ToastPill } from "@/components/ui/toast-pill";
import { MatchItem, MatchMetrics, MatchStatus } from "@/lib/match-types";
import { MatchDetailModal } from "@/components/evaluaciones/match-detail-modal";
import { cn } from "@/lib/utils";

type DatePreset = "hoy" | "7dias" | "mes" | "todos";

function MatchContent() {
  const [items, setItems] = useState<MatchItem[]>([]);
  const [metrics, setMetrics] = useState<MatchMetrics | null>(null);
  const [advisorsList, setAdvisorsList] = useState<string[]>([]);
  const [evaluadoresList, setEvaluadoresList] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAsesor, setSelectedAsesor] = useState<string>("todos");
  const [selectedEvaluador, setSelectedEvaluador] = useState<string>("todos");
  const [selectedStatus, setSelectedStatus] = useState<string>("todos");
  const [datePreset, setDatePreset] = useState<DatePreset>("todos");

  // Detail Modal
  const [selectedItemForModal, setSelectedItemForModal] = useState<MatchItem | null>(null);
  const [toastMsg, setToastMsg] = useState<{ text: string; type?: "success" | "error" } | null>(null);

  const showToast = useCallback((text: string, type: "success" | "error" = "success") => {
    setToastMsg({ text, type });
    setTimeout(() => {
      setToastMsg((cur) => (cur?.text === text ? null : cur));
    }, 3500);
  }, []);

  // Compute dates based on preset
  const dateRange = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    if (datePreset === "hoy") {
      return { from: today, to: today };
    }
    if (datePreset === "7dias") {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return { from: d.toISOString().split("T")[0], to: today };
    }
    if (datePreset === "mes") {
      const d = new Date();
      const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
      return { from: firstDay.toISOString().split("T")[0], to: today };
    }
    return { from: undefined, to: undefined };
  }, [datePreset]);

  // Load dataset
  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedAsesor !== "todos") params.set("asesor", selectedAsesor);
      if (selectedEvaluador !== "todos") params.set("evaluador", selectedEvaluador);
      if (selectedStatus !== "todos") params.set("status", selectedStatus);
      if (dateRange.from) params.set("from", dateRange.from);
      if (dateRange.to) params.set("to", dateRange.to);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      params.set("t", Date.now().toString());

      const res = await fetch(`/api/evaluaciones/match?${params.toString()}`, {
        cache: "no-store",
      }).then((r) => r.json());

      if (res.success) {
        setItems(res.items || []);
        setMetrics(res.metrics || null);
        if (Array.isArray(res.advisorsList) && res.advisorsList.length > 0) {
          setAdvisorsList(res.advisorsList);
        }
        if (Array.isArray(res.evaluadoresList) && res.evaluadoresList.length > 0) {
          setEvaluadoresList(res.evaluadoresList);
        }
      } else {
        showToast("No se pudo cargar la información de match", "error");
      }
    } catch (err: any) {
      console.error("Error loading match data:", err);
      showToast("Error de conexión al cargar datos", "error");
    } finally {
      setLoading(false);
    }
  }, [selectedAsesor, selectedEvaluador, selectedStatus, dateRange, searchQuery, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Status dropdown options
  const statusOptions = [
    { value: "todos", label: "Todos los estados" },
    { value: "conciliado", label: "Conciliados (Match completo)" },
    { value: "solo_reporte", label: "Solo reporte (Sin supervisar)" },
    { value: "solo_evaluacion", label: "Solo evaluación" },
  ];

  // Advisor dropdown options
  const advisorOptions = useMemo(() => {
    const list = [{ value: "todos", label: "Todos los asesores" }];
    advisorsList.forEach((adv) => {
      list.push({ value: adv, label: adv });
    });
    return list;
  }, [advisorsList]);

  // Evaluator dropdown options
  const evaluadorOptions = useMemo(() => {
    const list = [{ value: "todos", label: "Todos los evaluadores" }];
    evaluadoresList.forEach((ev) => {
      list.push({ value: ev, label: ev });
    });
    return list;
  }, [evaluadoresList]);

  return (
    <div className="flex min-h-screen bg-[#FDFDFD] text-neutral-900 font-sans antialiased selection:bg-neutral-900 selection:text-white">
      <Sidebar
        activeSection="evaluaciones"
        isMobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-20 h-14 bg-white/95 backdrop-blur-md border-b border-neutral-200/80 px-4 sm:px-6 flex items-center justify-between select-none">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="xl:hidden -ml-2 min-w-[44px] min-h-[44px] p-2.5 text-neutral-400 hover:text-neutral-900 transition-colors flex items-center justify-center cursor-pointer"
              title="Abrir menú"
              aria-label="Abrir menú"
            >
              <Menu className="w-4 h-4 stroke-[1.75]" />
            </button>
            <SidebarOpenButton />

            <div>
              <h1 className="text-sm font-bold text-neutral-950 font-sans leading-tight">
                Conciliación de actividades
              </h1>
              <p className="text-[10px] text-neutral-400 font-mono leading-none">
                Cruce entre reportes diarios de asesores y evaluaciones en campo
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => loadData(false)}
              className="p-2 text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
              title="Actualizar datos"
            >
              <RotateCw className={cn("w-3.5 h-3.5 stroke-[1.75]", loading && "animate-spin text-neutral-900")} />
            </button>

            <Link
              href="/evaluaciones/nueva"
              className="inline-flex items-center py-1.5 px-3 text-xs font-semibold text-neutral-950 hover:text-neutral-600 transition-colors cursor-pointer select-none"
            >
              Nueva evaluación
            </Link>
          </div>
        </header>

        {/* Content Body */}
        <div className="max-w-6xl w-full mx-auto p-4 sm:p-6 pb-24 space-y-6">
          {/* Navigation Tabs */}
          <div className="flex items-center gap-6 border-b border-neutral-200/80 pb-2 text-xs select-none">
            <Link
              href="/evaluaciones"
              className="min-h-[44px] py-2.5 font-medium transition-colors border-b-2 -mb-2 cursor-pointer flex items-center gap-2 border-transparent text-neutral-400 hover:text-neutral-700"
            >
              <span>Registro de evaluaciones</span>
            </Link>

            <Link
              href="/evaluaciones/rendimiento"
              className="min-h-[44px] py-2.5 font-medium transition-colors border-b-2 -mb-2 cursor-pointer flex items-center gap-2 border-transparent text-neutral-400 hover:text-neutral-700"
            >
              <span>Rendimiento por asesor</span>
            </Link>

            <span className="min-h-[44px] py-2.5 font-medium border-b-2 -mb-2 flex items-center gap-2 border-neutral-900 text-neutral-950 font-semibold cursor-default">
              <span>Match de actividades</span>
              <span className="text-[10px] font-mono text-neutral-400">
                ({items.length})
              </span>
            </span>
          </div>

          {/* KPI Metrics Line (Strict Rule 5 & 6: Zero framed cards, no uppercase, no decorative icons) */}
          <div className="border-b border-neutral-100 pb-5 pt-1">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
              <div className="space-y-1">
                <span className="text-xs text-neutral-500 font-sans block">
                  Jornadas analizadas
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-neutral-950 font-mono tracking-tight">
                    {metrics?.totalJornadas ?? 0}
                  </span>
                  <span className="text-[11px] text-neutral-400 font-sans">
                    ({metrics?.conciliadasCount ?? 0} con match)
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs text-neutral-500 font-sans block">
                  Cobertura de supervisión
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-neutral-950 font-mono tracking-tight">
                    {metrics?.coberturaPct ?? 0}%
                  </span>
                  <span className="text-[11px] text-neutral-400 font-sans">
                    en campo
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs text-neutral-500 font-sans block">
                  Brecha de autoevaluación
                </span>
                <div className="flex items-baseline gap-2">
                  <span
                    className={cn(
                      "text-2xl font-bold font-mono tracking-tight",
                      (metrics?.promedioGapPct ?? 0) > 15
                        ? "text-amber-700"
                        : "text-neutral-950"
                    )}
                  >
                    {(metrics?.promedioGapPct ?? 0) > 0
                      ? `+${metrics?.promedioGapPct}%`
                      : `${metrics?.promedioGapPct ?? 0}%`}
                  </span>
                  <span className="text-[11px] text-neutral-400 font-sans">
                    diferencia media
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs text-neutral-500 font-sans block">
                  Impacto en ventas
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-neutral-950 font-mono tracking-tight">
                    {metrics?.promedioSolicitudesConImpulsador ?? 0}
                  </span>
                  <span className="text-[11px] text-neutral-400 font-sans">
                    vs. {metrics?.promedioSolicitudesSinImpulsador ?? 0} en solitario
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Factor Gap Overview Strip */}
          {metrics && metrics.factorSummary.length > 0 && (
            <div className="border-b border-neutral-100 pb-5 space-y-2">
              <span className="text-xs font-semibold text-neutral-900 font-sans block">
                Brecha por factor operativo (Asesor vs. Impulsador)
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 pt-1">
                {metrics.factorSummary.map((f) => (
                  <div key={f.factorId} className="space-y-1 text-xs font-sans">
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-600 font-medium text-[11px] truncate" title={f.nombre}>
                        {f.nombre}
                      </span>
                      <span
                        className={cn(
                          "font-mono font-bold text-[11px]",
                          f.gapPct > 15 ? "text-amber-700" : "text-neutral-950"
                        )}
                      >
                        {f.gapPct > 0 ? `+${f.gapPct}%` : `${f.gapPct}%`}
                      </span>
                    </div>
                    <div className="text-[10px] text-neutral-400 font-mono flex items-center justify-between">
                      <span>Asesor: {f.asesorAvgPct}%</span>
                      <span>Impulsador: {f.evaluadorAvgPct}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filter Bar (CustomDropdown, clean baseline input, date preset pills) */}
          <div className="space-y-3 pt-1">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Search input with baseline style */}
              <div className="relative flex-1 max-w-sm">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por asesor, sector o notas..."
                  className="w-full border-b border-neutral-200 focus:border-neutral-900 bg-transparent py-1.5 text-xs text-neutral-900 placeholder:text-neutral-400 transition-colors focus:outline-hidden"
                />
              </div>

              {/* Date Presets */}
              <div className="flex items-center gap-4 text-xs font-sans shrink-0">
                <span className="text-neutral-400 text-[11px]">Período:</span>
                {(["todos", "hoy", "7dias", "mes"] as DatePreset[]).map((preset) => {
                  const labels: Record<DatePreset, string> = {
                    todos: "Todos",
                    hoy: "Hoy",
                    "7dias": "Últimos 7 días",
                    mes: "Este mes",
                  };
                  const isSelected = datePreset === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setDatePreset(preset)}
                      className={cn(
                        "transition-colors cursor-pointer select-none",
                        isSelected
                          ? "text-neutral-950 font-semibold border-b border-neutral-950"
                          : "text-neutral-400 hover:text-neutral-700"
                      )}
                    >
                      {labels[preset]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dropdown Filters Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <CustomDropdown
                value={selectedStatus}
                options={statusOptions}
                onChange={(val) => setSelectedStatus(val)}
                compact
              />

              <CustomDropdown
                value={selectedAsesor}
                options={advisorOptions}
                onChange={(val) => setSelectedAsesor(val)}
                compact
                searchable
                searchPlaceholder="Buscar asesor..."
              />

              <CustomDropdown
                value={selectedEvaluador}
                options={evaluadorOptions}
                onChange={(val) => setSelectedEvaluador(val)}
                compact
                searchable
                searchPlaceholder="Buscar evaluador..."
              />
            </div>
          </div>

          {/* Matched List / Table */}
          <div className="pt-2">
            {loading ? (
              <div className="py-20 text-center text-xs text-neutral-400 font-mono">
                Cargando conciliación de actividades...
              </div>
            ) : items.length === 0 ? (
              <div className="py-16 text-center space-y-1">
                <p className="text-xs font-semibold text-neutral-800 font-sans">
                  No se encontraron jornadas que coincidan con los filtros
                </p>
                <p className="text-[11px] text-neutral-400 font-sans">
                  Ajusta los criterios de búsqueda o el período seleccionado
                </p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-100">
                {/* Table Header Row */}
                <div className="hidden lg:grid grid-cols-12 gap-3 py-2 text-[11px] text-neutral-400 font-mono border-b border-neutral-200">
                  <div className="col-span-2">Fecha y asesor</div>
                  <div className="col-span-3">Territorio (Asesor / Impulsador)</div>
                  <div className="col-span-2">Resultados de campo</div>
                  <div className="col-span-2">Declarado vs. Evaluado</div>
                  <div className="col-span-2">Brecha y discrepancias</div>
                  <div className="col-span-1 text-right">Detalle</div>
                </div>

                {/* Table Item Rows */}
                {items.map((item) => {
                  const isConciliado = item.status === "conciliado";

                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedItemForModal(item)}
                      className="group py-3.5 grid grid-cols-1 lg:grid-cols-12 gap-3 items-center hover:bg-neutral-50/70 transition-colors cursor-pointer text-xs font-sans -mx-2 px-2 rounded-sm"
                    >
                      {/* Col 1: Fecha y asesor */}
                      <div className="lg:col-span-2 space-y-0.5">
                        <div className="flex flex-col">
                          <span className="font-semibold text-neutral-950 leading-snug">
                            {item.asesor}
                          </span>
                          {item.asesorCompleto && item.asesorCompleto.toLowerCase() !== item.asesor.toLowerCase() && (
                            <span className="text-[10px] text-neutral-400 font-sans truncate" title={item.asesorCompleto}>
                              {item.asesorCompleto}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-neutral-400 font-mono flex items-center gap-2">
                          <span>{item.fechaDisplay}</span>
                          <span>·</span>
                          <span
                            className={cn(
                              "font-sans",
                              item.status === "conciliado"
                                ? "text-neutral-900 font-medium"
                                : "text-neutral-400"
                            )}
                          >
                            {item.status === "conciliado"
                              ? "Conciliado"
                              : item.status === "solo_reporte"
                              ? "Sin supervisión"
                              : "Sin reporte"}
                          </span>
                        </div>
                      </div>

                      {/* Col 2: Territorio */}
                      <div className="lg:col-span-3 space-y-0.5">
                        <p className="text-neutral-800 text-[11px] truncate" title={item.reporte.ubicacionResumen}>
                          {item.reporte.presente ? item.reporte.ubicacionResumen : "Sin reporte"}
                        </p>
                        {item.evaluacion.presente && (
                          <p className="text-neutral-400 text-[10px] truncate" title={item.evaluacion.ubicacionResumen}>
                            Sup: {item.evaluacion.ubicacionResumen}
                            {item.analisis.coincidenciaTerritorial === true && " · Coincide"}
                          </p>
                        )}
                      </div>

                      {/* Col 3: Resultados */}
                      <div className="lg:col-span-2">
                        {item.reporte.presente ? (
                          <div className="space-y-0.5 font-mono text-[11px]">
                            <span className="text-neutral-950 font-semibold">
                              {item.reporte.totals.solicitudes} ventas · {item.reporte.totals.captados} captados
                            </span>
                            <span className="text-neutral-400 block text-[10px]">
                              {item.reporte.totals.volantes} volantes · {item.reporte.activitiesCount} registros
                            </span>
                          </div>
                        ) : (
                          <span className="text-neutral-400 font-mono text-[11px]">
                            —
                          </span>
                        )}
                      </div>

                      {/* Col 4: Declarado vs. Evaluado */}
                      <div className="lg:col-span-2 space-y-0.5 font-mono text-[11px]">
                        <div className="flex items-center gap-2">
                          <span className="text-neutral-500">Asesor:</span>
                          <span className="font-semibold text-neutral-900">
                            {item.reporte.presente ? `${item.reporte.checklistPct}%` : "—"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-neutral-500">Impulsador:</span>
                          <span
                            className={cn(
                              "font-semibold",
                              item.evaluacion.presente ? "text-neutral-950" : "text-neutral-400"
                            )}
                          >
                            {item.evaluacion.presente
                              ? `${item.evaluacion.puntuacionPromedio}/5 (${item.evaluacion.cumplimientoPct}%)`
                              : "—"}
                          </span>
                        </div>
                      </div>

                      {/* Col 5: Brecha y Discrepancias */}
                      <div className="lg:col-span-2 space-y-0.5">
                        {item.analisis.gapPct !== null ? (
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-neutral-500 font-sans">Brecha:</span>
                            <span
                              className={cn(
                                "font-mono font-bold text-xs",
                                item.analisis.gapPct > 15
                                  ? "text-amber-700"
                                  : "text-neutral-950"
                              )}
                            >
                              {item.analisis.gapPct > 0 ? `+${item.analisis.gapPct}%` : `${item.analisis.gapPct}%`}
                            </span>
                          </div>
                        ) : (
                          <span className="text-neutral-400 text-[11px] font-mono">
                            No comparable
                          </span>
                        )}

                        {item.analisis.divergenciasCount > 0 && (
                          <span className="text-[10px] text-amber-800 font-medium font-sans block">
                            {item.analisis.divergenciasCount} ítems en desacuerdo
                          </span>
                        )}
                      </div>

                      {/* Col 6: Acción (Icon-only subtle eye) */}
                      <div className="lg:col-span-1 flex items-center justify-end">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedItemForModal(item);
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 p-1.5 text-neutral-400 hover:text-neutral-900 cursor-pointer"
                          title="Ver comparativa lado a lado"
                        >
                          <Eye className="w-4 h-4 stroke-[1.5]" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Side-by-side Match Detail Modal */}
        {selectedItemForModal && (
          <MatchDetailModal
            isOpen={Boolean(selectedItemForModal)}
            onClose={() => setSelectedItemForModal(null)}
            item={selectedItemForModal}
          />
        )}

        {/* Minimalist Toast Pill (Rule 2) */}
        {toastMsg && (
          <ToastPill
            message={toastMsg.text}
            type={toastMsg.type}
            onClose={() => setToastMsg(null)}
          />
        )}
      </main>
    </div>
  );
}

export default function MatchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#FDFDFD] text-xs font-mono text-neutral-400">
          Cargando conciliación...
        </div>
      }
    >
      <MatchContent />
    </Suspense>
  );
}

