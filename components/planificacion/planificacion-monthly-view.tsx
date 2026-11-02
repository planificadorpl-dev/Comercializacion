"use client";

import { useMemo } from "react";
import { cn, formatNumber } from "@/lib/utils";
import { PlanificacionRecord, MONTH_ORDER } from "@/lib/dashboard-data";

interface PlanificacionMonthlyViewProps {
  month: string;
  year?: number;
  records: PlanificacionRecord[];
  onSelectDay?: (dateStr: string) => void;
  onSelectAdvisor?: (advisor: string) => void;
}

export function PlanificacionMonthlyView({
  month,
  year = 2026,
  records,
  onSelectDay,
  onSelectAdvisor,
}: PlanificacionMonthlyViewProps) {
  const monthIdx = useMemo(() => {
    const idx = MONTH_ORDER.findIndex((m) => m.toLowerCase() === month.toLowerCase());
    return idx >= 0 ? idx : 10; // Default Noviembre (10)
  }, [month]);

  // Construir matriz del calendario mensual
  const { calendarDays, topSectors, topAdvisors } = useMemo(() => {
    // 1. Agrupar registros por fecha ISO (YYYY-MM-DD)
    const dateMap = new Map<string, PlanificacionRecord[]>();
    records.forEach((r) => {
      if (!r.fecha) return;
      if (!dateMap.has(r.fecha)) dateMap.set(r.fecha, []);
      dateMap.get(r.fecha)!.push(r);
    });

    // 2. Días del mes (1 al último día)
    const firstDayDate = new Date(year, monthIdx, 1);
    const lastDayDate = new Date(year, monthIdx + 1, 0);
    const totalDays = lastDayDate.getDate();

    // El día de la semana del día 1 (0 es Domingo, 1 es Lunes...)
    // Lo convertimos para que la semana empiece en Lunes (0 = Lunes, 6 = Domingo)
    const rawStartDay = firstDayDate.getDay();
    const startPadding = rawStartDay === 0 ? 6 : rawStartDay - 1;

    const days: Array<{
      dayNum: number | null;
      dateStr: string | null;
      isToday: boolean;
      advisorsCount: number;
      recordsCount: number;
      topSectors: string[];
    }> = [];

    // Relleno inicial de días vacíos antes del 1
    for (let i = 0; i < startPadding; i++) {
      days.push({
        dayNum: null,
        dateStr: null,
        isToday: false,
        advisorsCount: 0,
        recordsCount: 0,
        topSectors: [],
      });
    }

    const todayIso = new Date().toISOString().split("T")[0];

    // Días del mes
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayRecs = dateMap.get(dateStr) || [];
      const distinctAdvisors = new Set(dayRecs.map((r) => r.asesor)).size;

      // Sectores principales de ese día
      const sectorCounts = new Map<string, number>();
      dayRecs.forEach((r) => {
        if (r.sector && r.sector !== "N/A") {
          sectorCounts.set(r.sector, (sectorCounts.get(r.sector) || 0) + 1);
        }
      });
      const sortedSecs = Array.from(sectorCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([s]) => s);

      days.push({
        dayNum: d,
        dateStr,
        isToday: dateStr === todayIso,
        advisorsCount: distinctAdvisors,
        recordsCount: dayRecs.length,
        topSectors: sortedSecs,
      });
    }

    // 3. Top sectores del mes
    const sectorStats = new Map<string, { count: number; parroquia?: string; municipio?: string }>();
    records.forEach((r) => {
      if (!r.sector || r.sector === "N/A") return;
      if (!sectorStats.has(r.sector)) {
        sectorStats.set(r.sector, { count: 0, parroquia: r.parroquia, municipio: r.municipio });
      }
      sectorStats.get(r.sector)!.count += 1;
    });
    const sortedTopSectors = Array.from(sectorStats.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // 4. Top asesores del mes
    const advisorStats = new Map<string, { count: number; sectors: Set<string> }>();
    records.forEach((r) => {
      if (!r.asesor || r.asesor === "Sin Asesor") return;
      if (!advisorStats.has(r.asesor)) {
        advisorStats.set(r.asesor, { count: 0, sectors: new Set() });
      }
      const entry = advisorStats.get(r.asesor)!;
      entry.count += 1;
      if (r.sector) entry.sectors.add(r.sector);
    });
    const sortedTopAdvisors = Array.from(advisorStats.entries())
      .map(([name, data]) => ({ name, count: data.count, sectorsCount: data.sectors.size }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    return {
      calendarDays: days,
      topSectors: sortedTopSectors,
      topAdvisors: sortedTopAdvisors,
    };
  }, [records, monthIdx, year]);

  return (
    <div className="space-y-8 pt-2">
      {/* Cuadrícula del Calendario Mensual */}
      <div className="space-y-2">
        {/* Cabecera de días de la semana */}
        <div className="grid grid-cols-7 border-b border-neutral-200 pb-2 text-xs text-neutral-400 font-mono text-center">
          <div>Lun</div>
          <div>Mar</div>
          <div>Mié</div>
          <div>Jue</div>
          <div>Vie</div>
          <div>Sáb</div>
          <div>Dom</div>
        </div>

        {/* Días del mes */}
        <div className="grid grid-cols-7 divide-x divide-y divide-neutral-100/60 border-b border-neutral-100/60">
          {calendarDays.map((day, idx) => {
            if (!day.dayNum) {
              return (
                <div key={`empty-${idx}`} className="h-24 p-2 bg-neutral-50/20" />
              );
            }

            const hasData = day.recordsCount > 0;

            return (
              <div
                key={day.dateStr}
                onClick={() => {
                  if (day.dateStr && onSelectDay) {
                    onSelectDay(day.dateStr);
                  }
                }}
                className={cn(
                  "h-24 p-2 flex flex-col justify-between transition-colors cursor-pointer",
                  day.isToday ? "bg-neutral-100/40" : "hover:bg-neutral-50/60",
                  !hasData && "opacity-40"
                )}
              >
                {/* Número del día */}
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "text-xs font-mono",
                      day.isToday ? "font-bold text-neutral-950 underline" : "text-neutral-700"
                    )}
                  >
                    {String(day.dayNum).padStart(2, "0")}
                  </span>
                  {hasData && (
                    <span className="text-[10px] text-neutral-500 font-mono">
                      {day.advisorsCount} as.
                    </span>
                  )}
                </div>

                {/* Rutas principales de ese día */}
                <div className="min-w-0 space-y-0.5">
                  {day.topSectors.map((sec, sIdx) => (
                    <span
                      key={sIdx}
                      className="text-[10px] text-neutral-600 block truncate leading-tight"
                    >
                      {sec}
                    </span>
                  ))}
                  {day.recordsCount === 0 && (
                    <span className="text-[10px] text-neutral-300 font-mono block">
                      Sin jornada
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* LÍNEA DIVISORIA SUTIL */}
      <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-neutral-300 to-transparent my-2" />

      {/* Secciones de Análisis Mensual: Sectores con mayor presencia y Asesores con más jornadas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
        {/* 1. Sectores más planificados en el mes */}
        <div className="space-y-3">
          <div className="border-b border-neutral-100 pb-1.5 flex items-baseline justify-between">
            <h3 className="text-xs font-semibold text-neutral-900">
              Sectores con mayor cobertura mensual
            </h3>
            <span className="text-[11px] text-neutral-400 font-mono">
              Frecuencia de visitas
            </span>
          </div>

          <div className="divide-y divide-neutral-100/70">
            {topSectors.map((sec, idx) => (
              <div
                key={sec.name}
                className="flex items-center justify-between py-2 text-xs hover:bg-neutral-50/50 transition-colors px-1"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[10px] font-mono text-neutral-400 w-4 shrink-0">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium text-neutral-900 truncate">
                      {sec.name}
                    </span>
                    {sec.parroquia && sec.parroquia !== "N/A" && (
                      <span className="text-[10px] text-neutral-400 font-mono truncate">
                        {sec.parroquia} {sec.municipio ? `· ${sec.municipio}` : ""}
                      </span>
                    )}
                  </div>
                </div>

                <span className="font-mono text-xs text-neutral-800 shrink-0">
                  {sec.count} {sec.count === 1 ? "jornada" : "jornadas"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 2. Asesores con mayor despliegue en el mes */}
        <div className="space-y-3">
          <div className="border-b border-neutral-100 pb-1.5 flex items-baseline justify-between">
            <h3 className="text-xs font-semibold text-neutral-900">
              Asesores con mayor actividad en el mes
            </h3>
            <span className="text-[11px] text-neutral-400 font-mono">
              Turnos asignados
            </span>
          </div>

          <div className="divide-y divide-neutral-100/70">
            {topAdvisors.map((adv, idx) => (
              <div
                key={adv.name}
                onClick={() => onSelectAdvisor?.(adv.name)}
                className="flex items-center justify-between py-2 text-xs hover:bg-neutral-50/50 transition-colors px-1 cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[10px] font-mono text-neutral-400 w-4 shrink-0">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium text-neutral-900 truncate">
                      {adv.name}
                    </span>
                    <span className="text-[10px] text-neutral-400 font-mono truncate">
                      {adv.sectorsCount} {adv.sectorsCount === 1 ? "sector cubierto" : "sectores cubiertos"}
                    </span>
                  </div>
                </div>

                <span className="font-mono text-xs text-neutral-800 shrink-0">
                  {adv.count} jornadas
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
