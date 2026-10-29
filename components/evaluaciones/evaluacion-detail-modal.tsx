"use client";

import { useRef, Fragment } from "react";
import { X, Printer, PenLine } from "lucide-react";
import {
  EVALUACION_FACTORES,
  EvaluacionRecord,
  getCumplimientoLevel,
} from "@/lib/evaluaciones-data";
import { cn } from "@/lib/utils";

interface EvaluacionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (record: EvaluacionRecord) => void;
  record: EvaluacionRecord | null;
}

export function EvaluacionDetailModal({
  isOpen,
  onClose,
  onEdit,
  record,
}: EvaluacionDetailModalProps) {
  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !record) return null;

  const level = getCumplimientoLevel(record.cumplimientoPct);

  const handlePrint = () => {
    window.print();
  };

  const getFrecuenciaLabel = (f: string) => {
    if (f === "diaria") return "Diaria";
    if (f === "semanal") return "Semanal";
    if (f === "mensual") return "Mensual";
    return f;
  };

  const getRolLabel = (r: string) => {
    if (r === "supervisor") return "Supervisor";
    if (r === "asesor_impulsador") return "Asesor Impulsador";
    if (r === "coordinador") return "Coordinador";
    return r;
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col sm:items-center sm:justify-center p-0 sm:p-4 md:p-6 bg-white sm:bg-neutral-900/40 sm:backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white w-full h-full sm:h-auto sm:max-h-[94vh] sm:max-w-4xl sm:rounded-xl sm:shadow-2xl sm:border sm:border-neutral-200/80 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 print:m-0 print:p-0 print:border-none print:shadow-none print:max-h-none print:w-full"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Toolbar - Hidden during print */}
        <div className="px-6 py-3.5 border-b border-neutral-200/80 flex items-center justify-between bg-white shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-neutral-900 font-sans">
              Formato oficial de evaluación
            </span>
            <span className="text-[11px] font-mono text-neutral-400">
              ID: {record.id}
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer select-none"
              title="Imprimir formato o guardar PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir / PDF</span>
            </button>

            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(record);
                }}
                className="inline-flex items-center gap-1.5 text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer select-none"
                title="Editar esta evaluación"
              >
                <PenLine className="w-3.5 h-3.5 stroke-[1.25]" />
                <span>Editar</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="text-neutral-400 hover:text-neutral-900 transition-colors p-1 cursor-pointer"
              title="Cerrar vista"
            >
              <X className="w-4 h-4 stroke-[1.75]" />
            </button>
          </div>
        </div>

        {/* Printable Official Document Body */}
        <div
          ref={printAreaRef}
          className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 text-neutral-900 bg-white font-sans print:overflow-visible print:p-4"
        >
          {/* Document Header */}
          <div className="border-b-2 border-neutral-900 pb-3 text-center sm:text-left flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-neutral-950 font-sans uppercase">
                POWER LINK CORP, C.A.
              </h1>
              <h2 className="text-xs font-semibold text-neutral-600 tracking-wide mt-0.5">
                FORMATO DE SUPERVISIÓN Y EVALUACIÓN
              </h2>
            </div>
            <div className="text-right font-mono text-xs text-neutral-500">
              <div>Frecuencia: <span className="font-semibold text-neutral-900">{getFrecuenciaLabel(record.frecuencia)}</span></div>
              <div>Evaluador: <span className="font-semibold text-neutral-900">{record.evaluador}</span> ({getRolLabel(record.evaluadorRol)})</div>
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-neutral-50/70 border border-neutral-200/80 rounded text-xs">
            <div>
              <span className="text-neutral-500">Asesor: </span>
              <span className="font-bold text-neutral-950">{record.asesor}</span>
            </div>
            <div>
              <span className="text-neutral-500">Fecha: </span>
              <span className="font-semibold text-neutral-950 font-mono">{record.fecha}</span>
            </div>
            <div>
              <span className="text-neutral-500">Ubicación: </span>
              <span className="font-semibold text-neutral-950">
                {[record.parroquia, record.municipio, record.estado].filter(Boolean).join(", ") || "No especificada"}
              </span>
            </div>
            <div>
              <span className="text-neutral-500">Sector: </span>
              <span className="font-semibold text-neutral-950">{record.sector}</span>
            </div>
          </div>

          {/* Compliance Score Ribbon */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 border border-neutral-200/70 rounded bg-white text-xs">
            <div className="flex items-center gap-3">
              <span className="text-neutral-500">Cumplimiento global:</span>
              <span className="font-bold text-sm font-mono text-neutral-950">
                {record.cumplimientoPct}%
              </span>
              <span className="text-[11px] text-neutral-400 font-mono">
                ({record.puntuacionTotal ?? record.itemsCumplidos} de {record.puntuacionMaxima ?? record.itemsTotal} pts · Promedio: {record.puntuacionPromedio ?? (record.cumplimientoPct / 20).toFixed(1)}/5)
              </span>
              <span className={cn("text-[11px] font-semibold", level.colorClass)}>
                • {level.label}
              </span>
            </div>

            {/* Factor Scores Mini Badges */}
            <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-neutral-500">
              {EVALUACION_FACTORES.map((f) => {
                const fs = record.factorScores?.[f.id];
                return (
                  <span key={f.id} className="whitespace-nowrap">
                    {f.nombre}: <strong className="text-neutral-900">{fs ? fs.pct : 0}%</strong>{" "}
                    <span className="text-neutral-400">({fs?.promedio ?? (fs ? (fs.pct / 20).toFixed(1) : 0)}/5)</span>
                  </span>
                );
              })}
            </div>
          </div>

          {/* Factors and Items Table */}
          <div className="border border-neutral-200/80 rounded overflow-hidden text-xs">
            <table className="w-full border-collapse table-fixed">
              <colgroup>
                <col className="w-[20%]" />
                <col className="w-[42%]" />
                <col className="w-[14%]" />
                <col className="w-[24%]" />
              </colgroup>
              <thead>
                <tr className="bg-neutral-100/80 border-b border-neutral-200 text-neutral-700 font-bold text-[11px]">
                  <th className="text-left px-3 py-2">Factor / Variable</th>
                  <th className="text-left px-3 py-2">Descripción del Ítem</th>
                  <th className="text-center px-3 py-2">Puntuación (1-5)</th>
                  <th className="text-left px-3 py-2">Observación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {EVALUACION_FACTORES.map((factor) => {
                  const factorScore = record.factorScores?.[factor.id];
                  return (
                    <Fragment key={factor.id}>
                      {/* Factor Header Row */}
                      <tr className="bg-neutral-50 font-bold text-neutral-900 border-t border-b border-neutral-200/80">
                        <td colSpan={4} className="px-3 py-1.5 text-[11px] tracking-wide">
                          <div className="flex items-center justify-between">
                            <span>{factor.titulo}</span>
                            <span className="font-mono text-neutral-500 font-normal">
                              {factorScore?.puntos ?? factorScore?.cumplidos} / {factorScore?.puntosMax ?? (factor.items.length * 5)} pts ({factorScore?.promedio ?? (factorScore ? (factorScore.pct / 20).toFixed(1) : 0)}/5 · {factorScore?.pct}%)
                            </span>
                          </div>
                        </td>
                      </tr>

                      {/* Items */}
                      {factor.items.map((item) => {
                        const itemState = record.items?.[item.id] || {};
                        const score = typeof itemState.puntuacion === "number"
                          ? itemState.puntuacion
                          : itemState.cumple !== undefined
                          ? (itemState.cumple ? 5 : 1)
                          : 5;

                        return (
                          <tr key={item.id} className="hover:bg-neutral-50/50">
                            <td className="px-3 py-2 font-medium text-neutral-900 align-top truncate">
                              {item.variable}
                            </td>
                            <td className="px-3 py-2 text-neutral-600 align-top break-words">
                              <div className="text-neutral-900 font-medium text-xs">
                                {item.preguntaEvaluador || item.pregunta}
                              </div>
                              <div className="text-[11px] text-neutral-400 mt-0.5">
                                {item.descripcion}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-center align-top whitespace-nowrap">
                              <div className="inline-flex items-center justify-center gap-1 font-mono">
                                <span
                                  className={cn(
                                    "font-bold text-xs",
                                    score >= 4
                                      ? "text-emerald-700"
                                      : score === 3
                                      ? "text-neutral-900"
                                      : "text-red-600"
                                  )}
                                >
                                  {score}
                                </span>
                                <span className="text-[10px] text-neutral-400 font-normal">/ 5</span>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-neutral-600 align-top font-sans italic text-[11px] break-words">
                              {itemState.observacion || "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Observations & Action Plan Box */}
          <div className="p-4 border border-neutral-200/80 rounded bg-white space-y-1.5">
            <h3 className="text-xs font-bold text-neutral-900 tracking-wide font-sans">
              Observaciones generales / Plan de acción:
            </h3>
            <p className="text-xs text-neutral-700 whitespace-pre-line leading-relaxed font-sans">
              {record.observacionesGenerales || "Sin observaciones generales registradas."}
            </p>
          </div>

          {/* Signatures Section */}
          <div className="grid grid-cols-2 gap-8 pt-8 text-center text-xs text-neutral-600">
            <div className="space-y-2">
              <div className="border-t border-neutral-300 w-48 mx-auto" />
              <div className="font-bold text-neutral-900">{record.asesor}</div>
              <div className="text-[11px] text-neutral-400">Firma del Asesor</div>
            </div>
            <div className="space-y-2">
              <div className="border-t border-neutral-300 w-48 mx-auto" />
              <div className="font-bold text-neutral-900">{record.evaluador}</div>
              <div className="text-[11px] text-neutral-400">
                Firma del Evaluador ({getRolLabel(record.evaluadorRol)})
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer - Hidden during print */}
        <div className="px-6 py-3 border-t border-neutral-200/80 bg-neutral-50/50 flex items-center justify-between shrink-0 print:hidden text-xs">
          <span className="text-[11px] text-neutral-400 font-mono">
            Registrado: {new Date(record.createdAt).toLocaleString()}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer select-none"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
