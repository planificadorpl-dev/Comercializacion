"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import Link from "next/link";
import {
  Menu,
  Plus,
  X,
  Send,
  RotateCw,
  Clock,
  MapPin,
  Calendar,
  MessageSquare,
  ChevronRight,
  CheckCheck,
  RotateCcw,
  CheckCircle,
} from "lucide-react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { SidebarOpenButton } from "@/components/providers/sidebar-provider";
import { useAsesor } from "@/components/providers/asesor-provider";
import { useUser } from "@/components/providers/user-provider";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { ToastPill } from "@/components/ui/toast-pill";
import { cn } from "@/lib/utils";
import {
  EVALUACION_FACTORES,
  TOTAL_EVALUACION_ITEMS,
  calculateChecklistScores,
  getChecklistCompletionStatus,
} from "@/lib/evaluaciones-data";

interface ActivityItem {
  id?: string;
  uid?: string;
  time: string;
  activityType: string;
  solicitudes: number;
  clientesCaptados: number;
  volantes: number;
  llamadasInfo: number;
  llamadasAgenda: number;
  receivedCalls?: boolean;
  ubicaciones?: {
    estado?: string;
    municipio?: string;
    parroquia?: string;
    sector?: string;
  };
  estado?: string;
  municipio?: string;
  parroquia?: string;
  sector?: string;
  condominio?: string;
  notes?: string;
}

interface HistoryDay {
  date: string;
  asesor: string;
  activitiesCount: number;
  totals: {
    solicitudes: number;
    captados: number;
    volantes: number;
    llamadasInfo: number;
    llamadasAgenda: number;
  };
  details: {
    time: string;
    type: string;
    location: string;
  }[];
  reporteWhatsapp?: string;
}

type TabMode = "en_curso" | "historial";

// Client module-level cache for instant transitions
let cachedActivitiesHistory: HistoryDay[] = [];
let hasLoadedActivitiesHistory = false;

function ActividadesContent() {
  const { currentAsesor, setCurrentAsesor, availableAsesores } = useAsesor();
  const { user, isAdmin } = useUser();
  const [activeTab, setActiveTab] = useState<TabMode>("en_curso");
  const [isMounted, setIsMounted] = useState(false);
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  useEffect(() => {
    setIsMounted(true);
    try {
      const saved = localStorage.getItem("appState_activities");
      if (saved) return setActivities(JSON.parse(saved));
    } catch {}
  }, []);
  const [history, setHistory] = useState<HistoryDay[]>(() => cachedActivitiesHistory);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Modals & Notifications
  const [activityToDelete, setActivityToDelete] = useState<number | null>(null);
  const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);
  const [isSubmittingClose, setIsSubmittingClose] = useState(false);
  const [closingSummary, setClosingSummary] = useState<{
    whatsappText: string;
    solicitudes: number;
    captados: number;
    volantes: number;
    llamadasInfo: number;
    llamadasAgenda: number;
  } | null>(null);

  // Daily Work Guide Checklist State (5 Factors, 30 Items, Sí / No)
  // Starts empty ({}) so the advisor must answer all 30 items to close the day
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});

  const checklistScores = useMemo(() => {
    return calculateChecklistScores(checklist);
  }, [checklist]);

  const completionStatus = useMemo(() => {
    return getChecklistCompletionStatus(checklist);
  }, [checklist]);

  const handleSetAllChecklist = (val: boolean) => {
    const next: Record<string, boolean> = {};
    EVALUACION_FACTORES.forEach((f) => {
      f.items.forEach((it) => {
        next[it.id] = val;
      });
    });
    setChecklist(next);
  };

  const handleResetChecklist = () => {
    setChecklist({});
  };

  const handleToggleChecklistItem = (itemId: string, val: boolean) => {
    setChecklist((prev) => ({
      ...prev,
      [itemId]: val,
    }));
  };

  const [toastMsg, setToastMsg] = useState<{ text: string; type?: "success" | "error" } | null>(null);

  const saveActivitiesToStorage = (items: ActivityItem[]) => {
    setActivities(items);
    try {
      localStorage.setItem("appState_activities", JSON.stringify(items));
    } catch {
      // Ignore
    }
  };

  const fetchHistory = useCallback(async (silent = hasLoadedActivitiesHistory) => {
    if (!silent) setHistoryLoading(true);
    try {
      const res = await fetch("/api/history");
      if (res.ok) {
        const text = await res.text();
        const data = text ? JSON.parse(text) : [];
        const filtered = Array.isArray(data)
          ? currentAsesor
            ? data.filter((h: HistoryDay) => h.asesor === currentAsesor)
            : data
          : [];
        cachedActivitiesHistory = filtered;
        hasLoadedActivitiesHistory = true;
        setHistory(filtered);
      }
    } catch {
      setToastMsg({ text: "Error al cargar historial", type: "error" });
    } finally {
      setHistoryLoading(false);
    }
  }, [currentAsesor]);

  useEffect(() => {
    if (activeTab === "historial") {
      fetchHistory();
    }
  }, [activeTab, fetchHistory]);

  // Lock body scroll when modal is open to ensure clean mobile experience
  useEffect(() => {
    if (isClosingModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isClosingModalOpen]);

  const confirmDeleteActivity = () => {
    if (activityToDelete === null) return;
    const updated = [...activities];
    updated.splice(activityToDelete, 1);
    saveActivitiesToStorage(updated);
    setActivityToDelete(null);
    setToastMsg({ text: "Actividad eliminada", type: "success" });
  };

  // Prepare closing summary and whatsapp message
  const handleOpenCloseModal = () => {
    if (activities.length === 0) {
      setToastMsg({ text: "No hay actividades registradas en la jornada actual", type: "error" });
      return;
    }

    let totSoli = 0;
    let totCap = 0;
    let totVol = 0;
    let totInfo = 0;
    let totAgenda = 0;

    activities.forEach((a) => {
      totSoli += Number(a.solicitudes || 0);
      totCap += Number(a.clientesCaptados || 0);
      totVol += Number(a.volantes || 0);
      totInfo += Number(a.llamadasInfo || 0);
      totAgenda += Number(a.llamadasAgenda || 0);
    });

    const effectiveAsesor = currentAsesor || (isAdmin ? (user?.nombre || "Administrador") : "");
    const todayStr = new Date().toLocaleDateString("es-VE");
    let msg = `*REPORTE DIARIO DE COMERCIALIZACIÓN*\n`;
    msg += `Fecha: ${todayStr}\n`;
    msg += `Asesor: ${effectiveAsesor}\n\n`;
    msg += `*RESUMEN*\n`;
    msg += `Solicitudes confirmadas: ${totSoli}\n`;
    msg += `Clientes captados: ${totCap}\n`;
    if (totVol > 0) msg += `Volantes entregados: ${totVol}\n`;
    if (totInfo > 0 || totAgenda > 0) {
      msg += `Llamadas (info): ${totInfo}\n`;
      msg += `Llamadas (agenda): ${totAgenda}\n`;
    }
    msg += `\n*DETALLE DE ACTIVIDADES*\n`;

    activities.forEach((act, idx) => {
      const u = act.ubicaciones || {};
      const loc = [u.estado || act.estado, u.municipio || act.municipio, u.parroquia || act.parroquia, u.sector || act.sector]
        .filter(Boolean)
        .join(", ");
      msg += `${idx + 1}. [${act.time}] ${act.activityType}\n`;
      if (loc) msg += `   Ubicación: ${loc}\n`;
      if (act.condominio) msg += `   Condominio: ${act.condominio}\n`;
      if (Number(act.solicitudes) > 0) msg += `   Solicitudes: ${act.solicitudes}\n`;
      if (Number(act.clientesCaptados) > 0) msg += `   Captados: ${act.clientesCaptados}\n`;
      if (Number(act.volantes) > 0) msg += `   Volantes: ${act.volantes}\n`;
      if (act.receivedCalls) {
        msg += `   Llamadas recibidas: Info: ${act.llamadasInfo || 0} · Agenda: ${act.llamadasAgenda || 0}\n`;
      }
      if (act.notes) msg += `   Notas: ${act.notes}\n`;
      msg += `\n`;
    });

    setClosingSummary({
      whatsappText: msg,
      solicitudes: totSoli,
      captados: totCap,
      volantes: totVol,
      llamadasInfo: totInfo,
      llamadasAgenda: totAgenda,
    });
    setIsClosingModalOpen(true);
  };

  const executeCloseJornada = async () => {
    if (!closingSummary) return;

    const effectiveAsesor = currentAsesor || (isAdmin ? (user?.nombre || "Administrador") : "");
    if (!effectiveAsesor) {
      setToastMsg({ text: "Debes seleccionar un asesor para cerrar la jornada", type: "error" });
      return;
    }

    if (!completionStatus.isComplete) {
      setToastMsg({
        text: `Debes responder los ${TOTAL_EVALUACION_ITEMS} ítems de la guía (Sí o No) para poder finalizar la jornada (faltan ${completionStatus.pendingCount}).`,
        type: "error",
      });
      return;
    }

    setIsSubmittingClose(true);

    const today = new Date().toLocaleDateString("es-VE");

    // Enrich WhatsApp message with the daily checklist summary
    let fullWhatsappText = closingSummary.whatsappText;
    fullWhatsappText += `\n*GUÍA OPERATIVA EN CAMPO*\n`;
    fullWhatsappText += `Cumplimiento declarado: ${checklistScores.totalCumplidos}/${checklistScores.totalItems} (${checklistScores.cumplimientoPct}% · ${checklistScores.level.label})\n`;
    EVALUACION_FACTORES.forEach((f) => {
      const sc = checklistScores.factorScores[f.id];
      fullWhatsappText += `• ${f.nombre}: ${sc?.cumplidos ?? 0}/${sc?.total ?? 0}\n`;
    });

    const noCumplidos = EVALUACION_FACTORES.flatMap((f) =>
      f.items.filter((it) => !checklist[it.id]).map((it) => `${f.nombre}: ${it.variable}`)
    );
    if (noCumplidos.length > 0) {
      fullWhatsappText += `\n*Aspectos no aplicados hoy:*\n- ${noCumplidos.join("\n- ")}\n`;
    }

    const payload = {
      date: today,
      asesor: effectiveAsesor,
      activitiesDetail: activities,
      reporteWhatsapp: fullWhatsappText,
      checklist,
    };

    const waUrl = `https://wa.me/?text=${encodeURIComponent(fullWhatsappText)}`;

    try {
      await fetch("/api/save-jornada", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (err: any) {
      console.warn("Aviso de sincronización:", err?.message);
    } finally {
      // Clear current local activities
      saveActivitiesToStorage([]);
      setIsClosingModalOpen(false);
      setIsSubmittingClose(false);
      setToastMsg({ text: "Jornada cerrada. Abriendo WhatsApp...", type: "success" });

      // Direct redirection to WhatsApp (bypasses mobile/desktop popup blockers)
      window.location.href = waUrl;
    }
  };

  return (
    <div className="flex min-h-screen bg-[#FDFDFD] text-neutral-900 font-sans antialiased selection:bg-neutral-900 selection:text-white">
      <Sidebar
        activeSection="actividades"
        isMobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-20 h-12 bg-white border-b border-neutral-200/80 px-4 sm:px-6 flex items-center justify-between select-none">
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
          </div>

          <div className="flex items-center">
            <span className="text-xs sm:text-sm font-normal text-neutral-700 tracking-tight font-sans">
              Registro de actividades
            </span>
          </div>
        </header>

        {/* Content Body */}
        <div className="p-3 sm:p-6 pb-20 xl:pb-6 max-w-5xl w-full mx-auto space-y-5">
          {/* Sub Navigation Tabs & Actions Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-200 pb-1 text-xs">
            <div className="flex items-center gap-5 sm:gap-6 overflow-x-auto no-scrollbar whitespace-nowrap scroll-smooth shrink-0 -mx-3 px-3 sm:mx-0 sm:px-0">
              <button
                type="button"
                onClick={() => setActiveTab("en_curso")}
                className={cn(
                  "min-h-[44px] py-2.5 px-1 inline-flex items-center font-medium transition-colors border-b-2 cursor-pointer shrink-0",
                  activeTab === "en_curso"
                    ? "border-neutral-900 text-neutral-950 font-semibold -mb-[1px]"
                    : "border-transparent text-neutral-400 hover:text-neutral-700"
                )}
              >
                Jornada en curso ({isMounted ? activities.length : 0})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("historial")}
                className={cn(
                  "min-h-[44px] py-2.5 px-1 inline-flex items-center font-medium transition-colors border-b-2 cursor-pointer shrink-0",
                  activeTab === "historial"
                    ? "border-neutral-900 text-neutral-950 font-semibold -mb-[1px]"
                    : "border-transparent text-neutral-400 hover:text-neutral-700"
                )}
              >
                Historial guardado
              </button>
            </div>

            <div className="flex items-center gap-3 sm:gap-4 justify-between sm:justify-end pt-1 sm:pt-0">
              <Link
                href="/actividades/nueva"
                className="min-h-[44px] py-2 px-2 inline-flex items-center gap-1.5 text-neutral-600 hover:text-neutral-950 font-medium transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2]" />
                <span>Nueva actividad</span>
              </Link>

              {isMounted && activities.length > 0 && (
                <button
                  type="button"
                  onClick={handleOpenCloseModal}
                  className="min-h-[44px] py-2 px-2 inline-flex items-center gap-1.5 text-neutral-900 hover:text-neutral-950 font-semibold transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5 stroke-[1.75]" />
                  <span>Finalizar jornada ({activities.length})</span>
                </button>
              )}
            </div>
          </div>

          {/* TAB 1: JORNADA EN CURSO */}
          {activeTab === "en_curso" && (
            <div className="space-y-4">
              {!isMounted || activities.length === 0 ? (
                <div className="py-16 text-center text-xs text-neutral-400 space-y-3">
                  <p>No tienes actividades registradas en la jornada de hoy.</p>
                  <Link
                    href="/actividades/nueva"
                    className="inline-flex items-center gap-1 text-neutral-900 hover:text-neutral-600 font-medium transition-colors"
                  >
                    <span>Comenzar primera actividad</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ) : (
                <>
                  <div className="divide-y divide-neutral-100 border-b border-neutral-100">
                  {activities.map((act, index) => {
                    const u = act.ubicaciones || {};
                    const loc = [
                      u.estado || act.estado,
                      u.municipio || act.municipio,
                      u.parroquia || act.parroquia,
                      u.sector || act.sector,
                    ]
                      .filter(Boolean)
                      .join(", ");

                    return (
                      <div
                        key={index}
                        className="group p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-neutral-50/60 transition-colors"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-neutral-900">
                              {act.activityType}
                            </span>
                            <span className="text-[11px] font-mono text-neutral-400">
                              {act.time}
                            </span>
                          </div>

                          {loc && (
                            <div className="flex items-center gap-1 text-[11px] text-neutral-500">
                              <MapPin className="w-3 h-3 text-neutral-400 shrink-0" />
                              <span className="truncate">{loc}</span>
                              {act.condominio && (
                                <span className="text-neutral-400">· {act.condominio}</span>
                              )}
                            </div>
                          )}

                          {act.notes && (
                            <p className="text-[11px] text-neutral-500 italic line-clamp-1">
                              &ldquo;{act.notes}&rdquo;
                            </p>
                          )}
                        </div>

                        {/* Metric pills & delete action */}
                        <div className="flex items-center gap-4 text-xs shrink-0 self-end sm:self-center">
                          <div className="flex items-center gap-3 text-[11px] text-neutral-600">
                            {Number(act.solicitudes) > 0 && (
                              <span>
                                <strong className="font-semibold text-neutral-900">
                                  {act.solicitudes}
                                </strong>{" "}
                                solicitudes
                              </span>
                            )}
                            {Number(act.clientesCaptados) > 0 && (
                              <span>
                                <strong className="font-semibold text-neutral-900">
                                  {act.clientesCaptados}
                                </strong>{" "}
                                captados
                              </span>
                            )}
                            {Number(act.volantes) > 0 && (
                              <span className="text-neutral-400">
                                {act.volantes} volantes
                              </span>
                            )}
                            {act.receivedCalls && (Number(act.llamadasInfo) > 0 || Number(act.llamadasAgenda) > 0) && (
                              <span className="text-neutral-500 font-mono text-[10px]">
                                📞 {act.llamadasInfo || 0} info · {act.llamadasAgenda || 0} agenda
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => setActivityToDelete(index)}
                            className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-150 text-neutral-400 hover:text-neutral-900 cursor-pointer p-1"
                            title="Eliminar actividad"
                          >
                            <X className="w-3.5 h-3.5 stroke-[1.5]" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <span className="text-neutral-400 font-sans">
                    {activities.length} actividad{activities.length > 1 ? "es" : ""} en la jornada de hoy
                  </span>
                  <div className="flex items-center gap-4">
                    <Link
                      href="/actividades/nueva"
                      className="inline-flex items-center gap-1.5 text-neutral-500 hover:text-neutral-900 font-medium transition-colors cursor-pointer select-none"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2]" />
                      <span>Añadir otra actividad</span>
                    </Link>
                    <button
                      type="button"
                      onClick={handleOpenCloseModal}
                      className="inline-flex items-center gap-1.5 text-neutral-900 hover:text-neutral-600 font-semibold transition-colors cursor-pointer select-none"
                    >
                      <Send className="w-3.5 h-3.5 stroke-[1.75]" />
                      <span>Finalizar jornada ({activities.length})</span>
                    </button>
                  </div>
                </div>
              </>
            )}
            </div>
          )}

          {/* TAB 2: HISTORIAL */}
          {activeTab === "historial" && (
            <div className="space-y-4">
              {historyLoading ? (
                <div className="py-16 text-center text-xs text-neutral-400">
                  Cargando historial de actividades...
                </div>
              ) : history.length === 0 ? (
                <div className="py-16 text-center text-xs text-neutral-400">
                  No hay jornadas registradas en el historial.
                </div>
              ) : (
                <div className="divide-y divide-neutral-100 border-b border-neutral-100">
                  {history.map((day, dIdx) => (
                    <div
                      key={dIdx}
                      className="py-4 space-y-3"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                          <span className="font-semibold text-neutral-900">{day.date}</span>
                          <span className="text-neutral-400">· {day.asesor}</span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-neutral-500">
                          <span>
                            <strong>{day.totals.solicitudes}</strong> solicitudes
                          </span>
                          <span>
                            <strong>{day.totals.captados}</strong> captados
                          </span>
                          {day.reporteWhatsapp && (
                            <button
                              type="button"
                              onClick={() => {
                                const url = `https://wa.me/?text=${encodeURIComponent(day.reporteWhatsapp || "")}`;
                                window.open(url, "_blank");
                              }}
                              className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
                              title="Reenviar a WhatsApp"
                            >
                              <MessageSquare className="w-3.5 h-3.5 stroke-[1.5]" />
                            </button>
                          )}
                        </div>
                      </div>

                      {day.details && day.details.length > 0 && (
                        <div className="divide-y divide-neutral-50 text-[11px] text-neutral-500 border-t border-neutral-100 pt-2 space-y-1">
                          {day.details.map((item, itIdx) => (
                            <div key={itIdx} className="flex items-center justify-between py-1">
                              <span>
                                {item.time} — {item.type}
                              </span>
                              <span className="text-neutral-400 truncate max-w-xs">{item.location}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* MODAL: CIERRE DE JORNADA */}
      {isClosingModalOpen && closingSummary && (
        <div
          className="fixed inset-0 z-50 flex flex-col sm:items-center sm:justify-center sm:p-4 bg-neutral-900/40 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => !isSubmittingClose && setIsClosingModalOpen(false)}
        >
          <div
            className="w-full h-full sm:h-auto sm:max-h-[88vh] sm:max-w-2xl bg-white sm:rounded-2xl sm:border sm:border-neutral-200/80 shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header: Clean & minimal */}
            <div className="shrink-0 px-4 sm:px-6 py-3 border-b border-neutral-100 flex items-center justify-between bg-white">
              <div className="flex items-center gap-2 min-w-0">
                <h3 className="text-sm font-semibold text-neutral-900 tracking-tight truncate">
                  Cierre de jornada
                </h3>
                {currentAsesor ? (
                  <span className="text-xs text-neutral-400 font-normal truncate">
                    · {currentAsesor}
                  </span>
                ) : (
                  <div className="w-36 text-xs">
                    <CustomDropdown
                      value={currentAsesor}
                      options={availableAsesores}
                      onChange={(v) => setCurrentAsesor(v)}
                      placeholder="Asesor..."
                    />
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsClosingModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer p-1 -mr-1"
                disabled={isSubmittingClose}
                aria-label="Cerrar modal"
              >
                <X className="w-4 h-4 stroke-[1.5]" />
              </button>
            </div>

            {/* Quick Strip: Counter and Quick Actions */}
            <div className="shrink-0 px-4 sm:px-6 py-2 bg-neutral-50/70 border-b border-neutral-100 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 font-mono text-xs">
                <span className="font-semibold text-neutral-900">
                  {completionStatus.answeredCount}/{TOTAL_EVALUACION_ITEMS}
                </span>
                <span className="text-[11px] text-neutral-400 font-sans">
                  {completionStatus.isComplete ? "completadas" : `(faltan ${completionStatus.pendingCount})`}
                </span>
                {completionStatus.isComplete && (
                  <span className={cn("text-[11px] font-medium ml-1", checklistScores.level.colorClass)}>
                    · {checklistScores.cumplimientoPct}%
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs shrink-0">
                <button
                  type="button"
                  onClick={() => handleSetAllChecklist(true)}
                  className="text-neutral-500 hover:text-neutral-950 transition-colors cursor-pointer flex items-center gap-1 select-none text-[11px] font-medium"
                  title="Marcar todas las preguntas en Sí"
                >
                  <CheckCheck className="w-3.5 h-3.5 stroke-[1.75] text-emerald-600" />
                  <span>Todos en Sí</span>
                </button>
                <span className="text-neutral-300">|</span>
                <button
                  type="button"
                  onClick={handleResetChecklist}
                  className="text-neutral-400 hover:text-neutral-800 transition-colors cursor-pointer select-none text-[11px]"
                  title="Limpiar respuestas"
                >
                  Limpiar
                </button>
              </div>
            </div>

            {/* Modal Body: Continuous clean list of all 30 questions without tabs */}
            <div className="flex-1 overflow-y-auto no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden overscroll-contain px-4 sm:px-6 py-2 divide-y divide-neutral-100 pb-8">
              {EVALUACION_FACTORES.map((factor) => {
                return (
                  <div key={factor.id} className="pt-2 first:pt-0">
                    <div className="pt-3 pb-1 text-[11px] font-semibold text-neutral-400 font-sans select-none">
                      {factor.nombre}
                    </div>
                    <div className="divide-y divide-neutral-100">
                      {factor.items.map((item) => {
                        const val = checklist[item.id];
                        const isSi = val === true;
                        const isNo = val === false;

                        return (
                          <div
                            key={item.id}
                            className="py-2.5 flex items-center justify-between gap-3"
                          >
                            <div className="flex-1 min-w-0 pr-2">
                              <span className="text-xs font-semibold text-neutral-900 block leading-tight">
                                {item.variable}
                              </span>
                              <span className="text-[11px] text-neutral-500 block leading-tight mt-0.5">
                                {item.pregunta || item.descripcion}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 shrink-0 text-xs select-none">
                              <button
                                type="button"
                                onClick={() => handleToggleChecklistItem(item.id, true)}
                                className={cn(
                                  "px-2.5 py-1.5 transition-colors cursor-pointer flex items-center gap-1",
                                  isSi
                                    ? "font-bold text-neutral-950"
                                    : "text-neutral-400 hover:text-neutral-700 font-normal"
                                )}
                                title="Marcar Sí"
                              >
                                <span>Sí</span>
                                {isSi && <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block" />}
                              </button>
                              <span className="text-neutral-200">/</span>
                              <button
                                type="button"
                                onClick={() => handleToggleChecklistItem(item.id, false)}
                                className={cn(
                                  "px-2.5 py-1.5 transition-colors cursor-pointer flex items-center gap-1",
                                  isNo
                                    ? "font-bold text-neutral-950"
                                    : "text-neutral-400 hover:text-neutral-700 font-normal"
                                )}
                                title="Marcar No"
                              >
                                <span>No</span>
                                {isNo && <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 inline-block" />}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="shrink-0 px-4 sm:px-6 py-3 border-t border-neutral-100 flex items-center justify-between gap-3 bg-white text-xs pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <div className="min-w-0">
                {!completionStatus.isComplete ? (
                  <span className="text-[11px] text-neutral-400 font-sans truncate block">
                    Faltan {completionStatus.pendingCount} de {TOTAL_EVALUACION_ITEMS}
                  </span>
                ) : (
                  <span className="text-[11px] text-neutral-700 font-sans flex items-center gap-1 truncate">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600 stroke-[2] shrink-0" />
                    <span className="truncate">Listo ({checklistScores.cumplimientoPct}%)</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsClosingModalOpen(false)}
                  disabled={isSubmittingClose}
                  className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer select-none py-1.5 px-2 text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={executeCloseJornada}
                  disabled={isSubmittingClose || !completionStatus.isComplete}
                  className={cn(
                    "font-semibold transition-colors cursor-pointer select-none flex items-center gap-1.5 py-1.5 px-2 text-xs",
                    completionStatus.isComplete
                      ? "text-neutral-950 hover:text-neutral-700"
                      : "text-neutral-300 cursor-not-allowed"
                  )}
                  title={
                    !completionStatus.isComplete
                      ? `Faltan ${completionStatus.pendingCount} preguntas`
                      : "Confirmar y enviar reporte a WhatsApp"
                  }
                >
                  <Send className="w-3.5 h-3.5 stroke-[1.75]" />
                  <span>{isSubmittingClose ? "Enviando..." : "Confirmar y enviar a WhatsApp"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ELIMINAR ACTIVIDAD */}
      <DeleteConfirmDialog
        isOpen={activityToDelete !== null}
        title="Eliminar actividad"
        description="¿Estás seguro de que deseas eliminar este registro de actividad de la jornada?"
        onConfirm={confirmDeleteActivity}
        onCancel={() => setActivityToDelete(null)}
      />

      {/* TOAST PILL */}
      <ToastPill
        message={toastMsg?.text || null}
        type={toastMsg?.type || "success"}
        onClose={() => setToastMsg(null)}
      />
    </div>
  );
}

export default function ActividadesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#FDFDFD] text-xs font-mono text-neutral-400">
          Cargando registro de actividades...
        </div>
      }
    >
      <ActividadesContent />
    </Suspense>
  );
}
