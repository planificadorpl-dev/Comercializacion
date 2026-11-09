"use client";

import { useState, useRef } from "react";
import { X, Printer, ChevronRight } from "lucide-react";
import { MatchItem } from "@/lib/match-types";
import { EVALUACION_FACTORES } from "@/lib/evaluaciones-data";
import { cn } from "@/lib/utils";

interface MatchDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: MatchItem | null;
}

type ModalTab = "rubrica" | "operativo" | "observaciones";

export function MatchDetailModal({ isOpen, onClose, item }: MatchDetailModalProps) {
  const [activeTab, setActiveTab] = useState<ModalTab>("rubrica");
  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !item) return null;

  const handlePrint = () => {
    window.print();
  };

  const getStatusBadge = () => {
    switch (item.status) {
      case "conciliado":
        return <span className="text-neutral-900 font-medium text-xs">Conciliado</span>;
      case "solo_reporte":
        return <span className="text-neutral-500 font-medium text-xs">Solo reporte (Sin supervisar)</span>;
      case "solo_evaluacion":
        return <span className="text-neutral-500 font-medium text-xs">Solo evaluación</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col sm:items-center sm:justify-center p-0 sm:p-4 md:p-6 bg-white sm:bg-neutral-900/40 sm:backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white w-full h-full sm:h-auto sm:max-h-[94vh] sm:max-w-4xl sm:rounded-xl sm:shadow-2xl sm:border sm:border-neutral-200/80 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 print:m-0 print:p-0 print:border-none print:shadow-none print:max-h-none print:w-full"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Toolbar */}
        <div className="px-6 py-3.5 border-b border-neutral-200/80 flex items-center justify-between bg-white shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-neutral-900 font-sans">
              Conciliación de jornada
            </span>
            <span className="text-[11px] font-mono text-neutral-400">
              {item.fechaDisplay} · {item.asesor}
            </span>
            <div className="hidden sm:inline-flex items-center">
              {getStatusBadge()}
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer select-none"
              title="Imprimir formato o guardar PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1 text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
              title="Cerrar ventana"
            >
              <X className="w-4 h-4 stroke-[1.5]" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Area */}
        <div ref={printAreaRef} className="overflow-y-auto flex-1 p-6 space-y-6">
          {/* Header Summary (Open layout, no boxed card) */}
          <div className="border-b border-neutral-200 pb-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-mono text-neutral-400 block">
                  Jornada de campo
                </span>
                <h2 className="text-lg font-bold text-neutral-950 font-sans">
                  {item.asesor}
                </h2>
                <p className="text-xs text-neutral-500 font-sans mt-0.5">
                  Fecha: {item.fechaDisplay}
                  {item.evaluacion.evaluador && ` · Supervisado por: ${item.evaluacion.evaluador} (${item.evaluacion.evaluadorRol || "Impulsador"})`}
                </p>
              </div>

              {/* High-level Score Badges */}
              <div className="flex items-center gap-6 shrink-0 text-right">
                <div>
                  <span className="text-[11px] text-neutral-400 font-mono block">
                    Declarado asesor
                  </span>
                  <span className="text-base font-bold text-neutral-950 font-sans">
                    {item.reporte.presente ? `${item.reporte.checklistPct}%` : "Sin reporte"}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] text-neutral-400 font-mono block">
                    Calificado impulsador
                  </span>
                  <span className="text-base font-bold text-neutral-950 font-sans">
                    {item.evaluacion.presente ? `${item.evaluacion.puntuacionPromedio}/5 (${item.evaluacion.cumplimientoPct}%)` : "Sin evaluación"}
                  </span>
                </div>

                {item.analisis.gapPct !== null && (
                  <div>
                    <span className="text-[11px] text-neutral-400 font-mono block">
                      Brecha (Gap)
                    </span>
                    <span
                      className={cn(
                        "text-base font-bold font-sans",
                        item.analisis.gapPct > 15
                          ? "text-amber-700"
                          : item.analisis.gapPct < -5
                          ? "text-neutral-700"
                          : "text-neutral-950"
                      )}
                    >
                      {item.analisis.gapPct > 0 ? `+${item.analisis.gapPct}%` : `${item.analisis.gapPct}%`}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Sub-metrics: Territorial & Sales match */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-neutral-100 text-xs font-sans">
              <div>
                <span className="text-[11px] text-neutral-400 block font-mono">
                  Territorio declarado
                </span>
                <span className="text-neutral-800 font-medium line-clamp-1" title={item.reporte.ubicacionResumen}>
                  {item.reporte.ubicacionResumen}
                </span>
              </div>

              <div>
                <span className="text-[11px] text-neutral-400 block font-mono">
                  Territorio supervisado
                </span>
                <span className="text-neutral-800 font-medium line-clamp-1" title={item.evaluacion.ubicacionResumen}>
                  {item.evaluacion.ubicacionResumen}
                </span>
              </div>

              <div>
                <span className="text-[11px] text-neutral-400 block font-mono">
                  Resultados reportados
                </span>
                <span className="text-neutral-950 font-semibold font-mono">
                  {item.reporte.totals.solicitudes} ventas · {item.reporte.totals.captados} captados
                </span>
              </div>

              <div>
                <span className="text-[11px] text-neutral-400 block font-mono">
                  Discrepancias críticas
                </span>
                <span className="text-neutral-950 font-semibold font-mono">
                  {item.analisis.divergenciasCount > 0
                    ? `${item.analisis.divergenciasCount} puntos con brecha`
                    : "Ninguna detectada"}
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Sub-Tabs inside Modal */}
          <div className="flex items-center gap-6 border-b border-neutral-200 pb-1 text-xs select-none print:hidden">
            <button
              type="button"
              onClick={() => setActiveTab("rubrica")}
              className={cn(
                "py-2 font-medium transition-colors border-b-2 -mb-[5px] cursor-pointer",
                activeTab === "rubrica"
                  ? "border-neutral-900 text-neutral-950 font-semibold"
                  : "border-transparent text-neutral-400 hover:text-neutral-700"
              )}
            >
              Comparativa de rúbrica ({item.analisis.divergenciasCount} discrepancias)
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("operativo")}
              className={cn(
                "py-2 font-medium transition-colors border-b-2 -mb-[5px] cursor-pointer",
                activeTab === "operativo"
                  ? "border-neutral-900 text-neutral-950 font-semibold"
                  : "border-transparent text-neutral-400 hover:text-neutral-700"
              )}
            >
              Detalle operativo del asesor ({item.reporte.activitiesCount} registros)
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("observaciones")}
              className={cn(
                "py-2 font-medium transition-colors border-b-2 -mb-[5px] cursor-pointer",
                activeTab === "observaciones"
                  ? "border-neutral-900 text-neutral-950 font-semibold"
                  : "border-transparent text-neutral-400 hover:text-neutral-700"
              )}
            >
              Feedback del impulsador
            </button>
          </div>

          {/* Tab 1: Rubrica Side-by-Side Comparison */}
          {activeTab === "rubrica" && (
            <div className="space-y-8">
              {/* Factor summary strip */}
              {item.analisis.factorComparisons.length > 0 && (
                <div className="space-y-2 border-b border-neutral-100 pb-5">
                  <span className="text-xs font-semibold text-neutral-900 font-sans block">
                    Cumplimiento comparativo por factor
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-1">
                    {item.analisis.factorComparisons.map((fc) => (
                      <div key={fc.factorId} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-sans">
                          <span className="text-neutral-600 font-medium">{fc.nombre}</span>
                          <span
                            className={cn(
                              "font-mono font-bold text-[11px]",
                              fc.gapPct > 15 ? "text-amber-700" : "text-neutral-950"
                            )}
                          >
                            {fc.gapPct > 0 ? `+${fc.gapPct}%` : `${fc.gapPct}%`}
                          </span>
                        </div>
                        <div className="text-[11px] text-neutral-400 font-mono flex items-center justify-between">
                          <span>Asesor: {fc.asesorPct}%</span>
                          <span>Impulsador: {fc.evaluadorPct}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 30 items grouped by factor */}
              {EVALUACION_FACTORES.map((factor) => {
                const fc = item.analisis.factorComparisons.find((f) => f.factorId === factor.id);

                return (
                  <div key={factor.id} className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between border-b border-neutral-200 pb-1.5 gap-1">
                      <div>
                        <h3 className="text-xs font-bold text-neutral-950 font-sans">
                          {factor.titulo}
                        </h3>
                        <p className="text-[11px] text-neutral-500 font-sans">
                          {factor.descripcion}
                        </p>
                      </div>

                      {fc && (
                        <div className="text-xs font-mono text-neutral-500 flex items-center gap-2">
                          <span>Declarado: {fc.asesorPct}%</span>
                          <span>·</span>
                          <span className="font-semibold text-neutral-900">
                            Calificado: {fc.evaluadorPromedio}/5 ({fc.evaluadorPct}%)
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="divide-y divide-neutral-100">
                      {factor.items.map((itemDef) => {
                        const asesorVal = Boolean(item.reporte.checklist && item.reporte.checklist[itemDef.id] === true);
                        const hasAdvisorChecklist = Boolean(item.reporte.checklist);

                        const evItemState = item.evaluacion.items ? item.evaluacion.items[itemDef.id] : undefined;
                        let evScore: number | null = null;
                        if (evItemState) {
                          if (typeof evItemState.puntuacion === "number") {
                            evScore = evItemState.puntuacion;
                          } else if (evItemState.cumple !== undefined) {
                            evScore = evItemState.cumple ? 5 : 1;
                          }
                        }

                        const isDiscrepant = asesorVal && evScore !== null && evScore <= 2;

                        return (
                          <div
                            key={itemDef.id}
                            className={cn(
                              "py-3 flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-xs font-sans",
                              isDiscrepant && "bg-neutral-50/70 -mx-2 px-2 rounded-sm"
                            )}
                          >
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-neutral-950">
                                  {itemDef.variable}
                                </span>
                                <span className="text-[11px] text-neutral-400">
                                  · {itemDef.descripcion}
                                </span>
                                {isDiscrepant && (
                                  <span className="text-[10px] text-amber-700 font-mono font-medium">
                                    Discrepancia crítica
                                  </span>
                                )}
                              </div>
                              <p className="text-neutral-600 text-[11px] leading-relaxed">
                                {itemDef.preguntaEvaluador || itemDef.pregunta}
                              </p>
                              {evItemState?.observacion && (
                                <p className="text-[11px] text-neutral-700 font-sans italic pt-0.5">
                                  Observación de campo: {evItemState.observacion}
                                </p>
                              )}
                            </div>

                            {/* Side-by-side values */}
                            <div className="flex items-center gap-6 shrink-0 sm:text-right pt-1 sm:pt-0">
                              <div>
                                <span className="text-[10px] text-neutral-400 font-mono block">
                                  Asesor
                                </span>
                                <span className="text-xs font-mono font-semibold text-neutral-900">
                                  {!hasAdvisorChecklist
                                    ? "—"
                                    : asesorVal
                                    ? "Sí"
                                    : "No"}
                                </span>
                              </div>

                              <div className="w-16">
                                <span className="text-[10px] text-neutral-400 font-mono block">
                                  Impulsador
                                </span>
                                <span
                                  className={cn(
                                    "text-xs font-mono font-bold",
                                    evScore === null
                                      ? "text-neutral-400"
                                      : evScore <= 2
                                      ? "text-amber-800"
                                      : "text-neutral-950"
                                  )}
                                >
                                  {evScore !== null ? `${evScore} / 5` : "—"}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Tab 2: Operativo Detail */}
          {activeTab === "operativo" && (
            <div className="space-y-6">
              {item.reporte.actividades.length === 0 ? (
                <div className="py-12 text-center text-xs text-neutral-400 font-mono">
                  No se registraron detalles de actividades para esta jornada.
                </div>
              ) : (
                <div className="divide-y divide-neutral-100">
                  {item.reporte.actividades.map((act, idx) => (
                    <div key={idx} className="py-3 space-y-1.5 text-xs font-sans">
                      <div className="flex items-baseline justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-neutral-400 text-[11px]">
                            {act.time || `Punto ${idx + 1}`}
                          </span>
                          <span className="font-semibold text-neutral-950">
                            {act.activityType}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 font-mono text-[11px] text-neutral-500">
                          {act.solicitudes > 0 && (
                            <span className="text-neutral-950 font-semibold">
                              {act.solicitudes} ventas
                            </span>
                          )}
                          {act.clientesCaptados > 0 && (
                            <span>{act.clientesCaptados} captados</span>
                          )}
                          {act.volantes > 0 && (
                            <span>{act.volantes} volantes</span>
                          )}
                        </div>
                      </div>

                      {act.ubicacion && (
                        <p className="text-neutral-600 text-[11px]">
                          Ubicación: {act.ubicacion}
                          {act.condominio && ` · Condominio: ${act.condominio}`}
                        </p>
                      )}

                      {act.notes && (
                        <p className="text-neutral-500 text-[11px] italic">
                          Notas: {act.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* WhatsApp message text if available */}
              {item.reporte.reporteWhatsapp && (
                <div className="border-t border-neutral-100 pt-4 space-y-2">
                  <span className="text-xs font-semibold text-neutral-900 font-sans block">
                    Reporte despachado por WhatsApp
                  </span>
                  <pre className="p-3 bg-neutral-50 border-0 text-[11px] text-neutral-700 font-mono whitespace-pre-wrap leading-relaxed">
                    {item.reporte.reporteWhatsapp}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Observaciones y Feedback */}
          {activeTab === "observaciones" && (
            <div className="space-y-5 text-xs font-sans">
              <div className="space-y-1 border-b border-neutral-100 pb-4">
                <span className="text-[11px] text-neutral-400 font-mono block">
                  Evaluador asignado
                </span>
                <p className="text-neutral-900 font-semibold">
                  {item.evaluacion.evaluador || "Sin evaluador registrado"}
                </p>
                <p className="text-neutral-500 text-[11px]">
                  Rol: {item.evaluacion.evaluadorRol || "Impulsador"} · Frecuencia: {item.evaluacion.frecuencia || "Diaria"}
                </p>
              </div>

              <div className="space-y-1 border-b border-neutral-100 pb-4">
                <span className="text-[11px] text-neutral-400 font-mono block">
                  Nivel de cumplimiento alcanzado
                </span>
                <p className="text-neutral-950 font-bold text-sm">
                  {item.evaluacion.nivel?.label || "Sin calificar"} ({item.evaluacion.cumplimientoPct}%)
                </p>
                <p className="text-neutral-500 text-[11px]">
                  Puntaje total: {item.evaluacion.puntuacionTotal} de {item.evaluacion.puntuacionMaxima} puntos (Promedio: {item.evaluacion.puntuacionPromedio}/5)
                </p>
              </div>

              <div className="space-y-2">
                <span className="text-[11px] text-neutral-400 font-mono block">
                  Observaciones generales y plan de acción
                </span>
                <p className="text-neutral-800 text-xs leading-relaxed whitespace-pre-wrap">
                  {item.evaluacion.observacionesGenerales || "No se registraron observaciones generales para esta evaluación."}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-neutral-100 flex items-center justify-end bg-neutral-50/50 shrink-0 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="py-1.5 px-3 text-xs font-medium text-neutral-600 hover:text-neutral-900 transition-colors cursor-pointer select-none"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

