"use client";

import { useMemo } from "react";
import {
  EvaluacionRecord,
  EVALUACION_FACTORES,
  getCumplimientoLevel,
} from "@/lib/evaluaciones-data";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";

interface EvaluacionesAnalyticsProps {
  evaluaciones: EvaluacionRecord[];
  onNewEvaluationForAdvisor: (advisorName: string) => void;
  onViewEvaluation: (record: EvaluacionRecord) => void;
}

interface AdvisorStats {
  name: string;
  totalEvaluations: number;
  avgCompliance: number;
  lastDate: string;
  lastRecord: EvaluacionRecord;
  factorAverages: Record<string, number>;
}

export function EvaluacionesAnalytics({
  evaluaciones,
  onNewEvaluationForAdvisor,
  onViewEvaluation,
}: EvaluacionesAnalyticsProps) {
  // Aggregate stats per advisor
  const advisorStats = useMemo(() => {
    const map = new Map<string, { records: EvaluacionRecord[] }>();

    evaluaciones.forEach((e) => {
      const existing = map.get(e.asesor) || { records: [] };
      existing.records.push(e);
      map.set(e.asesor, existing);
    });

    const stats: AdvisorStats[] = [];

    map.forEach((val, name) => {
      const records = val.records.sort(
        (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
      );
      const total = records.length;
      const sumCompliance = records.reduce((acc, r) => acc + r.cumplimientoPct, 0);
      const avgCompliance = Math.round(sumCompliance / total);

      // Factor averages
      const factorSums: Record<string, number> = {};
      EVALUACION_FACTORES.forEach((f) => {
        factorSums[f.id] = 0;
      });

      records.forEach((r) => {
        EVALUACION_FACTORES.forEach((f) => {
          factorSums[f.id] += r.factorScores?.[f.id]?.pct || 0;
        });
      });

      const factorAverages: Record<string, number> = {};
      EVALUACION_FACTORES.forEach((f) => {
        factorAverages[f.id] = Math.round(factorSums[f.id] / total);
      });

      stats.push({
        name,
        totalEvaluations: total,
        avgCompliance,
        lastDate: records[0].fecha,
        lastRecord: records[0],
        factorAverages,
      });
    });

    // Sort by avg compliance desc
    stats.sort((a, b) => b.avgCompliance - a.avgCompliance || a.name.localeCompare(b.name));
    return stats;
  }, [evaluaciones]);

  // Overall factor performance across entire team
  const globalFactorStats = useMemo(() => {
    if (evaluaciones.length === 0) return [];

    return EVALUACION_FACTORES.map((factor) => {
      let totalPct = 0;
      evaluaciones.forEach((e) => {
        totalPct += e.factorScores?.[factor.id]?.pct || 0;
      });
      const avgPct = Math.round(totalPct / evaluaciones.length);
      return {
        factor,
        avgPct,
      };
    }).sort((a, b) => b.avgPct - a.avgPct);
  }, [evaluaciones]);

  if (evaluaciones.length === 0) {
    return (
      <div className="py-12 text-center text-xs text-neutral-400">
        No hay evaluaciones registradas para generar analíticas.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Global Factors Diagnosis Section (Diffuse lines, zero boxes) */}
      <div className="space-y-3">
        <div>
          <h3 className="text-xs font-semibold text-neutral-900 font-sans tracking-tight">
            Diagnóstico general por factores de evaluación
          </h3>
          <p className="text-[11px] text-neutral-400 font-sans mt-0.5">
            Cumplimiento promedio de la fuerza de ventas en los 5 factores clave del formato
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 relative py-2">
          {globalFactorStats.map(({ factor, avgPct }, idx) => {
            const level = getCumplimientoLevel(avgPct);
            return (
              <div
                key={factor.id}
                className="py-2 px-3 sm:px-4 flex flex-col justify-between relative select-none"
              >
                {idx > 0 && (
                  <div className="hidden lg:block absolute left-0 top-1 bottom-1 w-[1px] bg-gradient-to-b from-transparent via-neutral-300 to-transparent pointer-events-none" />
                )}
                <div>
                  <span className="text-xs font-medium text-neutral-800 block truncate">
                    {factor.nombre}
                  </span>
                  <span className="text-[10px] text-neutral-400 block font-sans">
                    {factor.items.length} variables
                  </span>
                </div>

                <div className="mt-3 flex items-baseline justify-between">
                  <div>
                    <span className="font-mono text-xl font-bold text-neutral-950">
                      {avgPct}%
                    </span>
                    <span className="text-[10px] text-neutral-400 font-mono ml-1.5">
                      ({(avgPct / 20).toFixed(1)}/5)
                    </span>
                  </div>
                  <span className={cn("text-[10px] font-medium", level.colorClass)}>
                    {level.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Línea difusa horizontal */}
        <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-neutral-300 to-transparent my-1" />
      </div>

      {/* Advisor Performance Table (Open layout, zero closed outer box) */}
      <div className="space-y-3">
        <div>
          <h3 className="text-xs font-semibold text-neutral-900 font-sans tracking-tight">
            Rendimiento individual por asesor
          </h3>
          <p className="text-[11px] text-neutral-400 font-sans mt-0.5">
            Promedio acumulado y desglose de cumplimiento en las evaluaciones realizadas
          </p>
        </div>

        {/* Desktop Table (hidden on mobile) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-neutral-200/80 text-neutral-400 font-medium text-[11px]">
                <th className="py-2.5 px-3 font-medium">Asesor</th>
                <th className="py-2.5 px-2 font-medium text-center">Evaluaciones</th>
                <th className="py-2.5 px-2 font-medium text-center">Promedio</th>
                {EVALUACION_FACTORES.map((f) => (
                  <th key={f.id} className="py-2.5 px-2 font-medium text-center">
                    {f.nombre}
                  </th>
                ))}
                <th className="py-2.5 px-3 font-medium text-right">Última fecha</th>
                <th className="py-2.5 px-3 font-medium text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
                {advisorStats.map((adv) => {
                  const level = getCumplimientoLevel(adv.avgCompliance);
                  return (
                    <tr
                      key={adv.name}
                      className="hover:bg-neutral-50/60 transition-colors group"
                    >
                      {/* Name */}
                      <td className="py-3 px-4 font-semibold text-neutral-900">
                        <span>{adv.name}</span>
                      </td>

                      {/* Evaluations Count */}
                      <td className="py-3 px-3 text-center font-mono text-neutral-600">
                        {adv.totalEvaluations}
                      </td>

                      {/* Avg Score */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex flex-col items-center">
                          <div className="inline-flex items-center gap-1.5 font-mono font-bold text-neutral-950">
                            <span>{adv.avgCompliance}%</span>
                            <span className={cn("text-[10px] font-medium font-sans", level.colorClass)}>
                              • {level.label}
                            </span>
                          </div>
                          <span className="text-[10px] text-neutral-400 font-mono">
                            {(adv.avgCompliance / 20).toFixed(1)}/5
                          </span>
                        </div>
                      </td>

                      {/* Factor averages */}
                      {EVALUACION_FACTORES.map((f) => {
                        const fAvg = adv.factorAverages[f.id] ?? 0;
                        return (
                          <td
                            key={f.id}
                            className="py-3 px-3 text-center font-mono text-neutral-600"
                          >
                            <span
                              className={cn(
                                fAvg >= 90
                                  ? "text-emerald-700 font-semibold"
                                  : fAvg < 70
                                  ? "text-amber-700 font-semibold"
                                  : "text-neutral-700"
                              )}
                            >
                              {fAvg}%
                            </span>
                          </td>
                        );
                      })}

                      {/* Last Date */}
                      <td className="py-3 px-4 text-right font-mono text-neutral-400">
                        <button
                          type="button"
                          onClick={() => onViewEvaluation(adv.lastRecord)}
                          className="hover:text-neutral-900 transition-colors cursor-pointer"
                          title="Ver última evaluación"
                        >
                          {adv.lastDate}
                        </button>
                      </td>

                      {/* Action to create new evaluation for this advisor */}
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => onNewEvaluationForAdvisor(adv.name)}
                          className="inline-flex items-center gap-1 text-[11px] text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer select-none"
                          title={`Evaluar a ${adv.name}`}
                        >
                          <Plus className="w-3 h-3 stroke-[2]" />
                          <span>Evaluar</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        {/* Mobile Advisor Performance Cards List (no horizontal scrollbar) */}
        <div className="md:hidden divide-y divide-neutral-100 font-sans text-xs">
          {advisorStats.map((adv) => {
            const level = getCumplimientoLevel(adv.avgCompliance);
            return (
              <div key={adv.name} className="py-3.5 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-semibold text-neutral-900 block text-xs">
                      {adv.name}
                    </span>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-neutral-500 font-mono">
                      <span>{adv.totalEvaluations} eval.</span>
                      <span>·</span>
                      <button
                        type="button"
                        onClick={() => onViewEvaluation(adv.lastRecord)}
                        className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
                        title="Ver última evaluación"
                      >
                        {adv.lastDate}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-mono font-bold text-neutral-950 text-xs">
                        {adv.avgCompliance}%
                      </div>
                      <span className={cn("text-[10px] font-medium block", level.colorClass)}>
                        {level.label}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => onNewEvaluationForAdvisor(adv.name)}
                      className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-950 transition-colors cursor-pointer p-1"
                      title={`Evaluar a ${adv.name}`}
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2]" />
                      <span>Evaluar</span>
                    </button>
                  </div>
                </div>

                {/* Factors compact summary */}
                <div className="grid grid-cols-5 gap-1 pt-1 border-t border-neutral-100 text-[10px] font-mono text-center">
                  {EVALUACION_FACTORES.map((f) => {
                    const fAvg = adv.factorAverages[f.id] ?? 0;
                    return (
                      <div key={f.id} className="py-1 bg-neutral-50 rounded">
                        <span className="text-[9px] text-neutral-400 block font-sans truncate px-0.5">
                          {f.nombre.slice(0, 4)}
                        </span>
                        <span
                          className={cn(
                            "font-semibold block",
                            fAvg >= 90 ? "text-emerald-700" : fAvg < 70 ? "text-amber-700" : "text-neutral-700"
                          )}
                        >
                          {fAvg}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
          {/* Línea difusa inferior */}
          <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-neutral-300 to-transparent mt-2" />
        </div>
      </div>
  );
}


