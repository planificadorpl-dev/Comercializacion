"use client";

import { useMemo } from "react";
import { PlanningSheetRecord } from "@/lib/planificacion-types";
import { formatNumber } from "@/lib/utils";

interface PlanificadorMetricsBarProps {
  records: PlanningSheetRecord[];
  activeMonth: string;
  totalAdvisorsCount: number;
}

export function PlanificadorMetricsBar({
  records,
  activeMonth,
  totalAdvisorsCount,
}: PlanificadorMetricsBarProps) {
  const metrics = useMemo(() => {
    // Filter records for the active month if specified
    const filtered = activeMonth
      ? records.filter(
          (r) =>
            (r.mes || "").trim().toUpperCase() === activeMonth.trim().toUpperCase()
        )
      : records;

    const plannedCount = filtered.length;

    const advisorsWithPlan = new Set(
      filtered.map((r) => r.asesor.trim().toLowerCase()).filter(Boolean)
    ).size;

    const sectorsCount = new Set(
      filtered.map((r) => r.sector.trim().toLowerCase()).filter(Boolean)
    ).size;

    const activeDatesCount = new Set(
      filtered.map((r) => r.isoFecha || r.fecha).filter(Boolean)
    ).size;

    return {
      plannedCount,
      advisorsWithPlan,
      sectorsCount,
      activeDatesCount,
    };
  }, [records, activeMonth]);

  return (
    <div className="py-4 border-b border-neutral-100">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
        <div>
          <span className="text-xs text-neutral-400 block font-normal">
            Jornadas planificadas
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-light tracking-tight text-neutral-900 font-mono">
              {formatNumber(metrics.plannedCount)}
            </span>
            <span className="text-[11px] text-neutral-400 font-normal">
              en {activeMonth.toLowerCase()}
            </span>
          </div>
        </div>

        <div>
          <span className="text-xs text-neutral-400 block font-normal">
            Asesores con planificación
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-light tracking-tight text-neutral-900 font-mono">
              {metrics.advisorsWithPlan}
            </span>
            <span className="text-[11px] text-neutral-400 font-normal">
              de {totalAdvisorsCount} registrados
            </span>
          </div>
        </div>

        <div>
          <span className="text-xs text-neutral-400 block font-normal">
            Sectores asignados
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-light tracking-tight text-neutral-900 font-mono">
              {metrics.sectorsCount}
            </span>
            <span className="text-[11px] text-neutral-400 font-normal">
              comunidades
            </span>
          </div>
        </div>

        <div>
          <span className="text-xs text-neutral-400 block font-normal">
            Días con actividad
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-light tracking-tight text-neutral-900 font-mono">
              {metrics.activeDatesCount}
            </span>
            <span className="text-[11px] text-neutral-400 font-normal">
              fechas programadas
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

