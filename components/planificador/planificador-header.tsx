"use client";

import Link from "next/link";
import { RotateCw, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { SPANISH_MONTHS } from "@/lib/planificacion-service";

export type PlanificadorTab = "crear" | "matriz" | "tabla";

interface PlanificadorHeaderProps {
  activeTab: PlanificadorTab;
  onSelectTab: (tab: PlanificadorTab) => void;
  selectedMonth: string;
  onMonthChange: (month: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  totalRecordsCount: number;
}

export function PlanificadorHeader({
  activeTab,
  onSelectTab,
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
    <div className="space-y-4 pb-2 border-b border-neutral-100">
      {/* Top row: Title and utilities */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-neutral-900">
            Planificador de Asesores
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Asignación de jornadas en campo y sincronización directa con la hoja Data ({totalRecordsCount} registros)
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

      {/* Navigation tabs row - Pure text typography, zero boxes or buttons with borders */}
      <div className="flex items-center gap-6 pt-1">
        <button
          type="button"
          onClick={() => onSelectTab("crear")}
          className={cn(
            "text-xs transition-colors cursor-pointer py-1 relative",
            activeTab === "crear"
              ? "text-neutral-900 font-medium"
              : "text-neutral-400 hover:text-neutral-700 font-normal"
          )}
        >
          Crear planificación
          {activeTab === "crear" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-900" />
          )}
        </button>

        <button
          type="button"
          onClick={() => onSelectTab("matriz")}
          className={cn(
            "text-xs transition-colors cursor-pointer py-1 relative",
            activeTab === "matriz"
              ? "text-neutral-900 font-medium"
              : "text-neutral-400 hover:text-neutral-700 font-normal"
          )}
        >
          Matriz semanal
          {activeTab === "matriz" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-900" />
          )}
        </button>

        <button
          type="button"
          onClick={() => onSelectTab("tabla")}
          className={cn(
            "text-xs transition-colors cursor-pointer py-1 relative",
            activeTab === "tabla"
              ? "text-neutral-900 font-medium"
              : "text-neutral-400 hover:text-neutral-700 font-normal"
          )}
        >
          Registros en Sheet Data
          {activeTab === "tabla" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-900" />
          )}
        </button>
      </div>
    </div>
  );
}

