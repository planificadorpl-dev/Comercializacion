"use client";

import Link from "next/link";
import { RotateCw, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { SPANISH_MONTHS } from "@/lib/planificacion-types";

interface PlanificadorHeaderProps {
  selectedMonth: string;
  onMonthChange: (month: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  totalRecordsCount: number;
}

export function PlanificadorHeader({
  selectedMonth,
  onMonthChange,
  onRefresh,
  isRefreshing,
  totalRecordsCount,
}: PlanificadorHeaderProps) {
  const monthOptions = SPANISH_MONTHS.map((m) => ({
    value: m,
    label: m.charAt(0) + m.slice(1).toLowerCase(),
  }));

  return (
    <div className="space-y-2 pb-3 border-b border-neutral-100">
      {/* Top row: Title and utilities */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-neutral-900">
            Planificador de Asesores
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Asignación de parroquia, sector y actividad sincronizada directamente con la hoja Data ({totalRecordsCount} registros)
          </p>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          {/* Month selector */}
          <div className="flex items-center gap-1.5 text-xs text-neutral-500">
            <span>Mes:</span>
            <CustomDropdown
              value={selectedMonth}
              options={monthOptions}
              onChange={onMonthChange}
              className="w-32"
              compact
            />
          </div>

          {/* Refresh button - icon only */}
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="text-neutral-400 hover:text-neutral-900 transition-colors p-1 cursor-pointer disabled:opacity-40"
            title="Sincronizar con Google Sheets"
          >
            <RotateCw
              className={cn(
                "w-3.5 h-3.5 stroke-[1.25]",
                isRefreshing && "animate-spin text-neutral-900"
              )}
            />
          </button>

          {/* Link to visualizer */}
          <Link
            href="/planificacion"
            className="text-xs text-neutral-400 hover:text-neutral-900 transition-colors flex items-center gap-1"
            title="Ver métricas de efectividad y cumplimiento"
          >
            <span>Ver métricas</span>
            <ArrowRight className="w-3 h-3 stroke-[1.25]" />
          </Link>
        </div>
      </div>
    </div>
  );
}
