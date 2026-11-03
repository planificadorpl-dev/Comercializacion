"use client";

import { formatNumber } from "@/lib/utils";

interface PlanificacionMetricsProps {
  totalAdvisors: number;
  totalSectors: number;
  totalJornadas: number;
  totalSolicitudes?: number;
  totalInstallations?: number;
  predominantActivity?: { name: string; count: number; pct: number };
  periodLabel: string;
}

export function PlanificacionMetrics({
  totalAdvisors,
  totalSectors,
  totalJornadas,
  totalSolicitudes = 0,
  totalInstallations = 0,
  predominantActivity,
  periodLabel,
}: PlanificacionMetricsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6 py-4">
      {/* 1. Asesores en campo */}
      <div className="space-y-1 relative">
        <span className="text-xs text-neutral-500 font-sans block">
          Asesores en campo
        </span>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold text-neutral-950 font-mono tracking-tight">
            {formatNumber(totalAdvisors)}
          </span>
          <span className="text-[11px] text-neutral-400 font-mono">
            activos
          </span>
        </div>
        <p className="text-[11px] text-neutral-400 font-mono">
          Desplegados en {periodLabel.toLowerCase()}
        </p>
      </div>

      {/* 2. Rutas y sectores */}
      <div className="space-y-1 relative">
        <div className="hidden sm:block absolute left-[-12px] top-1 bottom-1 w-[1px] bg-gradient-to-b from-transparent via-neutral-200 to-transparent pointer-events-none" />
        <span className="text-xs text-neutral-500 font-sans block">
          Rutas y sectores
        </span>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold text-neutral-950 font-mono tracking-tight">
            {formatNumber(totalSectors)}
          </span>
          <span className="text-[11px] text-neutral-400 font-mono">
            sectores
          </span>
        </div>
        <p className="text-[11px] text-neutral-400 font-mono">
          Puntos de venta atendidos
        </p>
      </div>

      {/* 3. Jornadas planificadas */}
      <div className="space-y-1 relative">
        <div className="hidden md:block absolute left-[-12px] top-1 bottom-1 w-[1px] bg-gradient-to-b from-transparent via-neutral-200 to-transparent pointer-events-none" />
        <span className="text-xs text-neutral-500 font-sans block">
          Jornadas planificadas
        </span>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold text-neutral-950 font-mono tracking-tight">
            {formatNumber(totalJornadas)}
          </span>
          <span className="text-[11px] text-neutral-400 font-mono">
            asignaciones
          </span>
        </div>
        <p className="text-[11px] text-neutral-400 font-mono">
          Total de turnos programados
        </p>
      </div>

      {/* 4. Solicitudes registradas */}
      <div className="space-y-1 relative">
        <div className="hidden lg:block absolute left-[-12px] top-1 bottom-1 w-[1px] bg-gradient-to-b from-transparent via-neutral-200 to-transparent pointer-events-none" />
        <span className="text-xs text-neutral-500 font-sans block">
          Solicitudes registradas
        </span>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold text-neutral-950 font-mono tracking-tight">
            {formatNumber(totalSolicitudes)}
          </span>
          <span className="text-[11px] text-neutral-400 font-mono">
            ventas
          </span>
        </div>
        <p className="text-[11px] text-neutral-400 font-mono">
          Generadas en el período
        </p>
      </div>

      {/* 5. Clientes instalados */}
      <div className="space-y-1 relative">
        <div className="hidden lg:block absolute left-[-12px] top-1 bottom-1 w-[1px] bg-gradient-to-b from-transparent via-neutral-200 to-transparent pointer-events-none" />
        <span className="text-xs text-neutral-500 font-sans block">
          Clientes instalados
        </span>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold text-neutral-950 font-mono tracking-tight">
            {formatNumber(totalInstallations)}
          </span>
          <span className="text-[11px] text-neutral-400 font-mono">
            instalaciones
          </span>
        </div>
        <p className="text-[11px] text-neutral-400 font-mono">
          {totalSolicitudes > 0
            ? `${Math.round((totalInstallations / totalSolicitudes) * 100)}% de efectividad`
            : "Instalaciones ejecutadas"}
        </p>
      </div>

      {/* 6. Modalidad predominante */}
      <div className="space-y-1 relative">
        <div className="hidden lg:block absolute left-[-12px] top-1 bottom-1 w-[1px] bg-gradient-to-b from-transparent via-neutral-200 to-transparent pointer-events-none" />
        <span className="text-xs text-neutral-500 font-sans block">
          Actividad predominante
        </span>
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-base font-semibold text-neutral-900 truncate">
            {predominantActivity?.name || "Sin datos"}
          </span>
        </div>
        <p className="text-[11px] text-neutral-400 font-mono truncate">
          {predominantActivity
            ? `${predominantActivity.count} jornadas (${predominantActivity.pct}%)`
            : "No hay actividades en el período"}
        </p>
      </div>
    </div>
  );
}

