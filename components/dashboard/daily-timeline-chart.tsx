"use client";

import { useState, useMemo } from "react";
import { DetailedDailyMetric } from "@/lib/dashboard-data";
import { cn, formatNumber, formatProperCase } from "@/lib/utils";

interface DailyTimelineChartProps {
  data: DetailedDailyMetric[];
  title?: string;
  subtitle?: string;
  onSelectDate?: (dateStr: string) => void;
  selectedDate?: string;
  className?: string;
}

export function DailyTimelineChart({
  data,
  title = "Timeline Diario de Operaciones",
  subtitle = "Seguimiento de instalaciones realizadas día por día",
  onSelectDate,
  selectedDate,
  className,
}: DailyTimelineChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Fallback to 30 days if empty
  const timelineData = useMemo(() => {
    if (data && data.length > 0) return data;
    return Array.from({ length: 30 }).map((_, i) => {
      const day = i + 1;
      const inst = Math.round(40 + Math.sin(day * 0.8) * 16);
      const sol = Math.round(inst * 1.2);
      return {
        name: `Día ${day}`,
        fullDate: `2026-06-${String(day).padStart(2, "0")}`,
        instalaciones: inst,
        solicitudes: sol,
        asesor_top: "Top Asesor",
        sector_principal: "Sector Central",
      };
    });
  }, [data]);

  // Max value for Y-Axis
  const maxInst = Math.max(...timelineData.map((d) => d.instalaciones), 1);
  const ceilMaxY = Math.ceil(maxInst / 10) * 10 || 10;

  // Active days & daily average
  const activeDays = timelineData.filter((d) => d.instalaciones > 0);
  const totalInst = timelineData.reduce((acc, d) => acc + d.instalaciones, 0);
  const dailyAvg = activeDays.length > 0 ? totalInst / activeDays.length : 0;

  // Peak day
  const peakItem = timelineData.reduce(
    (prev, curr) => (curr.instalaciones > prev.instalaciones ? curr : prev),
    timelineData[0]
  );

  // Y-axis grid ticks
  const yTicks = [
    ceilMaxY,
    Math.round(ceilMaxY * 0.75),
    Math.round(ceilMaxY * 0.5),
    Math.round(ceilMaxY * 0.25),
    0,
  ];

  // Average line height percentage
  const avgHeightPct = ceilMaxY > 0 ? Math.round((dailyAvg / ceilMaxY) * 88) : 0;

  // Whether data is long (> 45 days) or short (single month)
  const isLongTimeline = timelineData.length > 45;

  return (
    <section className={cn("p-6 bg-white select-none", className)} id="dailyTimelineSection">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-neutral-900 tracking-tight">{title}</h3>
            {selectedDate && (
              <span className="text-[11px] font-mono text-neutral-900 font-semibold">
                (Día {selectedDate} filtrado)
              </span>
            )}
          </div>
          <p className="text-[11px] font-mono text-neutral-500 mt-0.5">
            {formatNumber(totalInst)} instalaciones realizadas • {activeDays.length} días operativos • Promedio: {dailyAvg.toFixed(1)}/día
          </p>
        </div>

        {/* Legend & Stats */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-neutral-900" />
            <span className="text-neutral-700 font-medium">Instalaciones</span>
          </div>
          <span className="text-neutral-300 hidden sm:inline">•</span>
          <span className="text-neutral-500 font-mono">
            Promedio: <strong className="text-neutral-900">{dailyAvg.toFixed(1)}/d</strong>
          </span>
        </div>
      </div>

      {/* Bar Chart Container (Same design as the month day-by-day bars) */}
      <div className="relative pt-6 pb-2">
        {/* Y-Axis Grid Lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none text-[10px] text-neutral-400 font-mono">
          {yTicks.map((tick, i) => (
            <div
              key={i}
              className={cn(
                "flex items-center justify-between pb-1",
                i < yTicks.length - 1 && "border-b border-neutral-100"
              )}
            >
              <span className="w-7 text-right pr-1 font-mono">{tick}</span>
              <span className="w-full border-t border-dashed border-neutral-200/70 ml-2" />
            </div>
          ))}
        </div>

        {/* Daily Average Reference Dashed Line */}
        {avgHeightPct > 0 && (
          <div
            className="absolute left-8 right-0 border-t border-dashed border-neutral-400/70 pointer-events-none z-10 flex items-center justify-end pr-1"
            style={{ bottom: `calc(${avgHeightPct}% + 24px)` }}
          >
            <span className="text-neutral-500 text-[9px] font-mono px-1 -translate-y-2.5">
              prom. {dailyAvg.toFixed(1)}/d
            </span>
          </div>
        )}

        {/* Vertical Bars Container */}
        <div className="relative h-56 w-full pt-8 flex items-end justify-between pl-7 sm:pl-9 pr-1 sm:pr-2 z-10 overflow-x-auto sm:overflow-x-visible">
          {timelineData.map((d, index) => {
            const heightPct = d.instalaciones > 0
              ? Math.max(8, Math.round((d.instalaciones / ceilMaxY) * 88))
              : 0;
            const isPeak = d.instalaciones === peakItem?.instalaciones && d.instalaciones > 0;
            const isZero = d.instalaciones === 0;
            const isSelected = selectedDate === d.fullDate;

            // Gradient styling matching day-by-day month view
            const gradientClass = isPeak
              ? "bg-gradient-to-t from-neutral-900 via-neutral-950 to-black shadow-sm"
              : d.instalaciones >= dailyAvg
              ? "bg-gradient-to-t from-neutral-500 via-neutral-600 to-neutral-700"
              : "bg-gradient-to-t from-neutral-300 via-neutral-400 to-neutral-500";

            // Delta vs daily average
            const deltaPct = dailyAvg > 0
              ? Math.round(((d.instalaciones - dailyAvg) / dailyAvg) * 100)
              : 0;

            // X-axis label display rule (sparse if hundreds of days, all if single month)
            const showLabel = !isLongTimeline || (
              index === 0 ||
              index === timelineData.length - 1 ||
              index === Math.floor(timelineData.length * 0.25) ||
              index === Math.floor(timelineData.length * 0.5) ||
              index === Math.floor(timelineData.length * 0.75) ||
              isSelected ||
              isPeak
            );

            return (
              <div
                key={d.fullDate || index}
                onClick={() => {
                  if (d.instalaciones > 0 && onSelectDate) {
                    onSelectDate(isSelected ? "" : d.fullDate);
                  }
                }}
                onMouseEnter={() => setHoveredIdx(index)}
                onMouseLeave={() => setHoveredIdx(null)}
                className={cn(
                  "flex flex-col items-center gap-1.5 group cursor-pointer h-full justify-end relative flex-1 min-w-[3px] sm:min-w-[6px] max-w-[28px] mx-[0.5px] sm:mx-[1px]",
                  isZero && "cursor-default"
                )}
                title={
                  d.instalaciones > 0
                    ? `${d.fullDate || d.name}: ${d.instalaciones} instalaciones. Haz clic para filtrar.`
                    : `${d.fullDate || d.name}: 0 instalaciones`
                }
              >
                {/* Peak Highlight Badge */}
                {isPeak && !isSelected && !isLongTimeline && (
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-neutral-900 text-white font-mono text-[9px] px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap tracking-tight z-30">
                    {d.instalaciones}
                  </div>
                )}

                {/* Selected Day Badge */}
                {isSelected && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-black text-white font-mono text-[9px] px-1.5 py-0.5 rounded shadow-md whitespace-nowrap tracking-tight z-30">
                    ✓ {d.instalaciones}
                  </div>
                )}

                {/* Rich Telemetry Tooltip on Hover */}
                {hoveredIdx === index && d.instalaciones > 0 && (
                  <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-neutral-950 text-white font-mono text-[10px] px-2.5 py-1.5 rounded shadow-xl border border-neutral-800 pointer-events-none whitespace-nowrap z-30 flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5 text-neutral-300 text-[9px]">
                      <span>{d.fullDate || d.name}</span>
                    </div>
                    <div className="font-bold text-white text-[11px] flex items-center gap-1">
                      <span>{formatNumber(d.instalaciones)} instalaciones</span>
                      <span className={cn(
                        "text-[9px] font-normal px-1 rounded",
                        deltaPct >= 0 ? "bg-emerald-900/60 text-emerald-300" : "bg-neutral-800 text-neutral-400"
                      )}>
                        {deltaPct >= 0 ? `+${deltaPct}%` : `${deltaPct}%`}
                      </span>
                    </div>
                    {d.solicitudes > 0 && (
                      <div className="text-[9px] text-neutral-400 flex items-center justify-between gap-2">
                        <span>Solicitudes: {d.solicitudes}</span>
                        {d.asesor_top && d.asesor_top !== "N/A" && (
                          <span className="truncate max-w-[80px]">Top: {formatProperCase(d.asesor_top)}</span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Bar representation */}
                {isZero ? (
                  <div className="w-full rounded-xs transition-colors h-[2px] bg-neutral-200" />
                ) : (
                  <div
                    className={cn(
                      "w-full rounded-t-xs transition-all duration-150 group-hover:brightness-90 relative",
                      gradientClass,
                      isSelected && "ring-2 ring-neutral-950 ring-offset-1 bg-black"
                    )}
                    style={{ height: `${heightPct}%` }}
                  />
                )}

                {/* X-axis Day/Date Label */}
                <span
                  className={cn(
                    "text-[9px] font-mono transition-colors text-center leading-none",
                    showLabel ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                    isSelected
                      ? "text-black font-black underline decoration-neutral-900"
                      : isPeak
                      ? "text-neutral-900 font-bold"
                      : hoveredIdx === index
                      ? "text-neutral-900 font-bold"
                      : "text-neutral-400 group-hover:text-neutral-700"
                  )}
                >
                  {isLongTimeline
                    ? d.name
                    : d.name?.includes("-")
                    ? d.name.split("-")[0]
                    : d.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Footer */}
      <div className="mt-3 pt-3 border-t border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between text-[11px] font-mono text-neutral-500 gap-1">
        <span>
          Día récord:{" "}
          <strong className="text-neutral-900 font-semibold">
            {peakItem?.fullDate || peakItem?.name}
          </strong>{" "}
          con{" "}
          <strong className="text-neutral-900 font-semibold">
            {peakItem?.instalaciones || 0} instalaciones realizadas
          </strong>
        </span>

        <div className="flex items-center gap-3">
          {selectedDate ? (
            <button
              onClick={() => onSelectDate && onSelectDate("")}
              className="text-neutral-900 font-medium hover:underline cursor-pointer"
            >
              ✕ Quitar filtro de día ({selectedDate})
            </button>
          ) : (
            <span className="text-neutral-400">
              Haz clic en cualquier barra para filtrar el dashboard por ese día
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
