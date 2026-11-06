"use client";

import { useState, useMemo, useEffect } from "react";
import { ArrowLeft, ChevronDown, Check, X, Maximize2, Minimize2 } from "lucide-react";
import { cn, formatNumber, formatProperCase } from "@/lib/utils";
import { Installation, Solicitud } from "@/lib/dashboard-data";
import {
  getMonthDailyBreakdown,
  MonthDailyBreakdown,
  getDayFromDate,
  getMaxDayForMonth,
} from "@/lib/analytics-comparison";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DayByDayComparisonCard } from "@/components/dashboard/day-by-day-comparison-card";

interface DataPoint {
  name: string;
  value: number;
  subValue?: number;
  fullDate?: string;
}

interface SalesTrendBarChartProps {
  title?: string;
  subtitle?: string;
  data: DataPoint[];
  installations?: Installation[];
  solicitudes?: Solicitud[];
  onSelectMonth?: (month: string) => void;
  selectedMonth?: string;
  onSelectDate?: (dateStr: string) => void;
  selectedDate?: string;
  className?: string;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  viewMode?: "monthly" | "daily" | "mtdComparison";
  onViewModeChange?: (mode: "monthly" | "daily" | "mtdComparison") => void;
}

const MONTH_ORDER_LIST = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

export function SalesTrendBarChart({
  title = "Rendimiento Mensual",
  subtitle = "Instalaciones registradas • Mensual",
  data,
  installations = [],
  solicitudes = [],
  onSelectMonth,
  selectedMonth,
  onSelectDate,
  selectedDate,
  className,
  isExpanded,
  onToggleExpand,
  viewMode: controlledViewMode,
  onViewModeChange,
}: SalesTrendBarChartProps) {
  const [internalViewMode, setInternalViewMode] = useState<"monthly" | "daily" | "mtdComparison">("monthly");
  const viewMode = controlledViewMode !== undefined ? controlledViewMode : internalViewMode;

  const handleSetViewMode = (mode: "monthly" | "daily" | "mtdComparison") => {
    setInternalViewMode(mode);
    if (onViewModeChange) {
      onViewModeChange(mode);
    }
  };

  const [activeDailyMonth, setActiveDailyMonth] = useState<string>("Julio");
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [hoveredDayIdx, setHoveredDayIdx] = useState<number | null>(null);

  // Sync activeDailyMonth when selectedMonth changes
  useEffect(() => {
    if (selectedMonth && selectedMonth.trim()) {
      setActiveDailyMonth(formatProperCase(selectedMonth));
    }
  }, [selectedMonth]);

  // Available months from installations or fallback list
  const availableMonths = useMemo(() => {
    if (data && data.length > 0) {
      return data.map((d) => formatProperCase(d.name)).filter((m) => m && m !== "N/a");
    }
    return MONTH_ORDER_LIST;
  }, [data]);

  // Monthly View Data
  const displayData = data.length > 0 ? data : [
    { name: "Ene", value: 128 },
    { name: "Feb", value: 145 },
    { name: "Mar", value: 162 },
    { name: "Abr", value: 184 },
    { name: "May", value: 198 },
    { name: "Jun", value: 224 },
  ];

  const maxValue = Math.max(...displayData.map((d) => d.value), 1);
  const peakItem = displayData.reduce(
    (prev, curr) => (curr.value > prev.value ? curr : prev),
    displayData[0]
  );

  // Normalized MTD calculation between last two months (prevents distorted -61% drops)
  const deltaInfo = useMemo(() => {
    if (displayData.length < 2) return { text: "—", isPositive: true };

    const last = displayData[displayData.length - 1];
    const prev = displayData[displayData.length - 2];

    const lastNorm = (last.name || "").trim().toUpperCase();
    const prevNorm = (prev.name || "").trim().toUpperCase();

    if (installations.length > 0) {
      const maxDay = getMaxDayForMonth(installations, last.name);
      if (maxDay < 28) {
        // Incomplete month: like-for-like MTD comparison up to actual recorded maxDay
        const currentItems = installations.filter(
          (i) => (i.mes || "").trim().toUpperCase() === lastNorm
        );
        const prevItems = installations.filter(
          (i) => (i.mes || "").trim().toUpperCase() === prevNorm
        );
        const currentCut = currentItems.filter((i) => {
          const d = getDayFromDate(i.fecha);
          return d > 0 && d <= maxDay;
        }).length;
        const prevCut = prevItems.filter((i) => {
          const d = getDayFromDate(i.fecha);
          return d > 0 && d <= maxDay;
        }).length;

        if (prevCut > 0) {
          const diff = currentCut - prevCut;
          const isPos = diff >= 0;
          const pct = (diff / prevCut) * 100;
          if (Math.abs(pct) > 100 || prevCut < 15) {
            return {
              text: `${isPos ? "↑ +" : "↓ "}${formatNumber(Math.abs(diff))} inst. MTD`,
              isPositive: isPos,
            };
          }
          return {
            text: `${isPos ? "↑ +" : "↓ "}${Math.abs(pct).toFixed(1)}% MTD`,
            isPositive: isPos,
          };
        }
      }
    }

    if (prev.value > 0) {
      const diff = last.value - prev.value;
      const isPos = diff >= 0;
      const pct = (diff / prev.value) * 100;
      if (Math.abs(pct) > 100 || prev.value < 15) {
        return {
          text: `${isPos ? "↑ +" : "↓ "}${formatNumber(Math.abs(diff))} inst.`,
          isPositive: isPos,
        };
      }
      return {
        text: `${isPos ? "↑ +" : "↓ "}${Math.abs(pct).toFixed(1)}%`,
        isPositive: isPos,
      };
    }

    return { text: "—", isPositive: true };
  }, [displayData, installations]);

  // Monthly Y-axis grid ticks
  const yAxisTicks = [
    Math.round(maxValue),
    Math.round(maxValue * 0.75),
    Math.round(maxValue * 0.5),
    Math.round(maxValue * 0.25),
    0,
  ];

  // Daily View Breakdown computation
  const dailyBreakdown: MonthDailyBreakdown = useMemo(() => {
    const target = activeDailyMonth || selectedMonth || "Julio";
    return getMonthDailyBreakdown(installations, target);
  }, [installations, activeDailyMonth, selectedMonth]);

  // Daily Y-axis grid ticks
  const maxDailyValue = dailyBreakdown.maxDailyValue;
  const dailyYAxisTicks = [
    Math.round(maxDailyValue),
    Math.round(maxDailyValue * 0.75),
    Math.round(maxDailyValue * 0.5),
    Math.round(maxDailyValue * 0.25),
    0,
  ];

  // Average line height percentage
  const avgHeightPct = maxDailyValue > 0
    ? Math.round((dailyBreakdown.dailyAvg / maxDailyValue) * 88)
    : 0;

  // Handle month bar click in monthly view: DRILL DOWN TO DAILY BARS
  const handleMonthBarClick = (monthName: string) => {
    const properMonth = formatProperCase(monthName);
    setActiveDailyMonth(properMonth);
    handleSetViewMode("daily");
    if (onSelectMonth) {
      onSelectMonth(properMonth);
    }
    // Clear any day filter when switching months
    if (onSelectDate) {
      onSelectDate("");
    }
  };

  // Handle back to monthly view (without boxes)
  const handleBackToMonthly = () => {
    handleSetViewMode("monthly");
    if (onSelectDate) {
      onSelectDate("");
    }
  };

  return (
    <div className={cn("p-4 sm:p-6 bg-white flex flex-col justify-between h-full select-none", className)}>
      {/* Top View Mode Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-neutral-100 pb-1 mb-4 overflow-x-auto no-scrollbar whitespace-nowrap">
        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          <button
            onClick={() => handleSetViewMode("monthly")}
            className={cn(
              "text-xs min-h-[40px] py-2 px-1 flex items-center transition-colors cursor-pointer",
              viewMode === "monthly"
                ? "text-neutral-950 font-bold border-b-2 border-neutral-900 -mb-[1px]"
                : "text-neutral-400 hover:text-neutral-800 font-medium"
            )}
          >
            Mensual
          </button>
          <button
            onClick={() => handleSetViewMode("daily")}
            className={cn(
              "text-xs min-h-[40px] py-2 px-1 flex items-center transition-colors cursor-pointer",
              viewMode === "daily"
                ? "text-neutral-950 font-bold border-b-2 border-neutral-900 -mb-[1px]"
                : "text-neutral-400 hover:text-neutral-800 font-medium"
            )}
          >
            Diario
          </button>
          <button
            onClick={() => handleSetViewMode("mtdComparison")}
            className={cn(
              "text-xs min-h-[40px] py-2 px-1 flex items-center transition-colors cursor-pointer",
              viewMode === "mtdComparison"
                ? "text-neutral-950 font-bold border-b-2 border-neutral-900 -mb-[1px]"
                : "text-neutral-400 hover:text-neutral-800 font-medium"
            )}
          >
            Comparativa MTD
          </button>
        </div>

        {onToggleExpand && (
          <button
            onClick={onToggleExpand}
            className="min-w-[40px] min-h-[40px] text-neutral-400 hover:text-neutral-900 transition-colors flex items-center justify-center cursor-pointer p-2 shrink-0"
            title={isExpanded ? "Reducir a vista estándar" : "Expandir a ancho completo"}
            aria-label="Alternar tamaño de vista"
          >
            {isExpanded ? (
              <Minimize2 className="w-3.5 h-3.5 stroke-[1.5]" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5 stroke-[1.5]" />
            )}
          </button>
        )}
      </div>

      {viewMode === "mtdComparison" ? (
        <DayByDayComparisonCard
          installations={installations}
          solicitudes={solicitudes}
          defaultMonthA="Septiembre"
          defaultMonthB={selectedMonth || "Octubre"}
          onSelectDate={onSelectDate}
          selectedDate={selectedDate}
          className="p-0"
        />
      ) : viewMode === "monthly" ? (
        <div>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 tracking-tight">{title}</h3>
              <p className="text-[11px] font-mono text-neutral-500 mt-0.5">{subtitle}</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-neutral-600">
                <span className="w-2 h-2 rounded-full bg-neutral-900" />
                <span>Instalaciones</span>
              </div>
              <div className="flex items-center gap-1 text-[11px] font-sans">
                <span className={cn("font-mono font-medium", deltaInfo.isPositive ? "text-emerald-700" : "text-neutral-500")}>
                  {deltaInfo.text}
                </span>
                <span className="text-neutral-400 text-[10px]">vs prev</span>
              </div>
            </div>
          </div>

          {/* Clean Light Monochromatic Bar Chart (Monthly) */}
          <div className="relative pt-6 pb-2">
            {/* Y-Axis Lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none text-[10px] text-neutral-400 font-mono">
              {yAxisTicks.map((tick, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-center justify-between pb-1",
                    i < yAxisTicks.length - 1 && "border-b border-neutral-100"
                  )}
                >
                  <span className="w-8">{tick >= 1000 ? `${(tick / 1000).toFixed(0)}k` : tick}</span>
                  <span className="w-full border-t border-dashed border-neutral-200/70 ml-2" />
                </div>
              ))}
            </div>

            {/* Monochromatic Dark Gradient Bars */}
            <div className="relative h-56 w-full pt-8 flex items-end justify-between px-3 sm:px-8 z-10">
              {displayData.map((d, index) => {
                const heightPct = Math.max(12, Math.round((d.value / maxValue) * 88));
                const isPeak = d.name === peakItem?.name;
                const isSelected = selectedMonth === d.name;

                // Step gradients
                const gradientClass = isPeak
                  ? "bg-gradient-to-t from-neutral-800 via-neutral-900 to-black shadow-sm border-t border-x border-neutral-900"
                  : index < displayData.length / 3
                  ? "bg-gradient-to-t from-neutral-200 via-neutral-300 to-neutral-400"
                  : index < (displayData.length * 2) / 3
                  ? "bg-gradient-to-t from-neutral-300 via-neutral-400 to-neutral-500"
                  : "bg-gradient-to-t from-neutral-400 via-neutral-500 to-neutral-600";

                return (
                  <div
                    key={index}
                    onClick={() => handleMonthBarClick(d.name)}
                    onMouseEnter={() => setHoveredIdx(index)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    className="flex flex-col items-center gap-2 group cursor-pointer h-full justify-end relative flex-1 max-w-[56px] mx-0.5 sm:mx-1 transition-transform hover:-translate-y-0.5"
                    title={`Ver desglose día por día de ${d.name}`}
                  >
                    {/* Peak Highlight Badge */}
                    {isPeak && (
                      <div className="absolute -top-1 -translate-x-1/2 left-1/2 bg-neutral-900 border border-neutral-800 text-white font-mono text-[10px] sm:text-[11px] px-2 py-0.5 rounded shadow-md whitespace-nowrap tracking-tight z-20">
                        {formatNumber(d.value)}
                      </div>
                    )}

                    {/* Hover tooltip for other bars */}
                    {!isPeak && hoveredIdx === index && (
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-mono text-white bg-neutral-900 px-1.5 py-0.5 rounded shadow-sm pointer-events-none whitespace-nowrap z-20">
                        {formatNumber(d.value)}
                      </div>
                    )}

                    <div
                      className={cn(
                        "w-5 sm:w-8 md:w-10 rounded-t-sm transition-all duration-200 group-hover:brightness-90 relative",
                        gradientClass,
                        isSelected && "ring-2 ring-emerald-500 ring-offset-1"
                      )}
                      style={{ height: `${heightPct}%` }}
                    />

                    <span
                      className={cn(
                        "text-[10px] sm:text-[11px] font-mono transition-colors truncate max-w-full text-center",
                        isPeak
                          ? "text-neutral-900 font-bold"
                          : isSelected
                          ? "text-emerald-700 font-bold"
                          : "text-neutral-500 group-hover:text-neutral-900 font-medium"
                      )}
                    >
                      {d.name.length > 3 ? d.name.slice(0, 3) : d.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Footer of Chart (Monthly) */}
          <div className="pt-3 border-t border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between text-[11px] font-mono text-neutral-500 mt-2 gap-1">
            <span>
              Mes con más volumen:{" "}
              <strong className="text-neutral-900 font-semibold">{peakItem?.name || "—"}</strong>{" "}
              ({formatNumber(peakItem?.value || 0)} inst.)
            </span>
            <span className="text-neutral-400">
              Haz clic en cualquier mes para ver los días
            </span>
          </div>
        </div>
      ) : (
        /* ============================================================ */
        /* 2. DRILL-DOWN: DAY-BY-DAY BARS VIEW */
        /* ============================================================ */
        <div>
          {/* Header - Completely clean, without boxes or colored backgrounds */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-2">
            <div className="flex items-center gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-neutral-900 tracking-tight">
                    Rendimiento Diario – {dailyBreakdown.monthName}
                  </h3>
                  {selectedDate && (
                    <span className="text-[11px] font-mono text-neutral-900 font-semibold">
                      (Día {selectedDate.split("-")[2]} filtrado)
                    </span>
                  )}
                </div>
                <p className="text-[11px] font-mono text-neutral-500 mt-0.5">
                  {formatNumber(dailyBreakdown.total)} instalaciones • {dailyBreakdown.activeDaysCount} días operativos • Promedio: {dailyBreakdown.dailyAvg.toFixed(1)}/día
                </p>
              </div>
            </div>

            {/* Seamless Monochromatic Month Switcher - Pure text without border/box */}
            <div className="flex items-center gap-1.5 text-xs font-mono">
              <span className="text-[11px] font-medium text-neutral-400">Mes:</span>
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex items-center gap-1 text-xs font-mono font-medium text-neutral-800 hover:text-black transition-colors focus:outline-none cursor-pointer select-none py-0.5 group">
                  <span className="underline decoration-neutral-300 group-hover:decoration-neutral-900 underline-offset-2">{activeDailyMonth}</span>
                  <ChevronDown className="w-3 h-3 text-neutral-400 group-hover:text-neutral-700 shrink-0 transition-colors" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[8.5rem] p-1 bg-white border border-neutral-200/90 shadow-md rounded-lg font-mono text-xs z-50">
                  {availableMonths.map((m) => {
                    const isSelected = m === activeDailyMonth;
                    return (
                      <DropdownMenuItem
                        key={m}
                        onClick={() => handleMonthBarClick(m)}
                        className={cn(
                          "flex items-center justify-between px-2.5 py-1.5 rounded-md cursor-pointer transition-colors text-xs font-mono",
                          isSelected
                            ? "bg-neutral-900 text-white font-semibold focus:bg-neutral-900 focus:text-white"
                            : "text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 focus:bg-neutral-100 focus:text-neutral-900"
                        )}
                      >
                        <span>{m}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[2]" />}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Clean Light Monochromatic Day-by-Day Bar Chart */}
          <div className="relative pt-6 pb-2">
            {/* Y-Axis Grid Lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none text-[10px] text-neutral-400 font-mono">
              {dailyYAxisTicks.map((tick, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-center justify-between pb-1",
                    i < dailyYAxisTicks.length - 1 && "border-b border-neutral-100"
                  )}
                >
                  <span className="w-6 text-right pr-1 font-mono">{tick}</span>
                  <span className="w-full border-t border-dashed border-neutral-200/70 ml-1" />
                </div>
              ))}
            </div>

            {/* Daily Average Reference Dashed Line */}
            {avgHeightPct > 0 && (
              <div
                className="absolute left-7 right-0 border-t border-dashed border-neutral-400/70 pointer-events-none z-10 flex items-center justify-end pr-1"
                style={{ bottom: `calc(${avgHeightPct}% + 24px)` }}
              >
                <span className="text-neutral-500 text-[9px] font-mono px-1 -translate-y-2.5">
                  prom. {dailyBreakdown.dailyAvg.toFixed(1)}/d
                </span>
              </div>
            )}

            {/* 28 to 31 Day Bars Container */}
            <div className="relative h-56 w-full pt-8 flex items-end justify-between pl-6 sm:pl-8 pr-1 sm:pr-2 z-10 overflow-hidden sm:overflow-x-visible">
              {dailyBreakdown.days.map((dayPoint, index) => {
                const heightPct = dayPoint.value > 0
                  ? Math.max(8, Math.round((dayPoint.value / maxDailyValue) * 88))
                  : 0;
                const isPeak = dayPoint.isPeak && dayPoint.value > 0;
                const isSunday = dayPoint.dayName === "Dom";
                const isZero = dayPoint.value === 0;
                const isDaySelected = selectedDate === dayPoint.dateStr;

                // Gradient styling for daily bars
                const gradientClass = isPeak
                  ? "bg-gradient-to-t from-neutral-900 via-neutral-950 to-black shadow-sm"
                  : dayPoint.value >= dailyBreakdown.dailyAvg
                  ? "bg-gradient-to-t from-neutral-500 via-neutral-600 to-neutral-700"
                  : "bg-gradient-to-t from-neutral-300 via-neutral-400 to-neutral-500";

                return (
                  <div
                    key={dayPoint.day}
                    onClick={() => {
                      if (dayPoint.value > 0 && onSelectDate) {
                        onSelectDate(isDaySelected ? "" : dayPoint.dateStr);
                      }
                    }}
                    onMouseEnter={() => setHoveredDayIdx(index)}
                    onMouseLeave={() => setHoveredDayIdx(null)}
                    className={cn(
                      "flex flex-col items-center gap-1 sm:gap-1.5 group cursor-pointer h-full justify-end relative flex-1 min-w-0 sm:min-w-[14px] sm:max-w-[28px] mx-[0.5px] sm:mx-[1px]",
                      isZero && !dayPoint.isFuture && "cursor-default"
                    )}
                    title={
                      dayPoint.value > 0
                        ? `Día ${dayPoint.day}: ${dayPoint.value} instalaciones. Haz clic para filtrar el dashboard por este día.`
                        : `Día ${dayPoint.day}: Sin instalaciones registradas`
                    }
                  >
                    {/* Peak Highlight Badge */}
                    {isPeak && !isDaySelected && (
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-neutral-900 text-white font-mono text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap tracking-tight z-30">
                        {dayPoint.value}
                      </div>
                    )}

                    {/* Selected Day Badge */}
                    {isDaySelected && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-black text-white font-mono text-[9px] px-1.5 py-0.5 rounded shadow-md whitespace-nowrap tracking-tight z-30">
                        ✓ {dayPoint.value}
                      </div>
                    )}

                    {/* Telemetry Hover Tooltip */}
                    {!isPeak && !isDaySelected && hoveredDayIdx === index && dayPoint.value > 0 && (
                      <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-neutral-950 text-white font-mono text-[10px] px-2.5 py-1.5 rounded shadow-xl border border-neutral-800 pointer-events-none whitespace-nowrap z-30 flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5 text-neutral-300 text-[9px]">
                          <span>{dayPoint.dayName}</span>
                          <span>•</span>
                          <span>{dayPoint.dateStr}</span>
                        </div>
                        <div className="font-bold text-white text-[11px] flex items-center gap-1">
                          <span>{formatNumber(dayPoint.value)} instalaciones</span>
                          <span className={cn(
                            "text-[9px] font-normal px-1 rounded",
                            dayPoint.deltaVsAvgPercent >= 0 ? "bg-emerald-900/60 text-emerald-300" : "bg-neutral-800 text-neutral-400"
                          )}>
                            {dayPoint.deltaVsAvgPercent >= 0 ? `+${dayPoint.deltaVsAvgPercent}%` : `${dayPoint.deltaVsAvgPercent}%`}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Bar representation */}
                    {dayPoint.isFuture ? (
                      <div
                        className="w-full rounded-t-xs border-b border-dashed border-neutral-300 h-1 opacity-50"
                        title={`Día ${dayPoint.day}: Sin registros aún (mes en curso)`}
                      />
                    ) : isZero ? (
                      <div
                        className={cn(
                          "w-full rounded-xs transition-colors h-[2px]",
                          isSunday ? "bg-neutral-200" : "bg-neutral-300"
                        )}
                      />
                    ) : (
                      <div
                        className={cn(
                          "w-full rounded-t-xs transition-all duration-150 group-hover:brightness-90 relative",
                          gradientClass,
                          isDaySelected && "ring-2 ring-neutral-950 ring-offset-1 bg-black"
                        )}
                        style={{ height: `${heightPct}%` }}
                      />
                    )}

                    {/* X-axis Day Number Label */}
                    <span
                      className={cn(
                        "text-[8px] sm:text-[9px] font-mono transition-colors text-center leading-none",
                        dayPoint.day % 5 === 0 || dayPoint.day === 1 || isDaySelected || isPeak ? "block" : "hidden sm:block",
                        isDaySelected
                          ? "text-black font-black underline decoration-neutral-900"
                          : isPeak
                          ? "text-neutral-900 font-bold"
                          : hoveredDayIdx === index
                          ? "text-neutral-900 font-bold"
                          : isSunday
                          ? "text-neutral-300"
                          : "text-neutral-400 group-hover:text-neutral-700"
                      )}
                    >
                      {dayPoint.dayLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Footer of Daily Chart */}
          <div className="pt-3 border-t border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between text-[11px] font-mono text-neutral-500 mt-2 gap-1">
            <span>
              Día récord:{" "}
              <strong className="text-neutral-900 font-semibold">
                Día {dailyBreakdown.peakDay?.dayLabel || "—"} ({dailyBreakdown.peakDay?.dayName})
              </strong>{" "}
              con{" "}
              <strong className="text-neutral-900 font-semibold">
                {dailyBreakdown.peakDay?.value || 0} instalaciones
              </strong>
            </span>

            <div className="flex items-center gap-2">
              {selectedDate ? (
                <button
                  onClick={() => onSelectDate && onSelectDate("")}
                  className="px-1.5 py-0.5 text-neutral-600 hover:text-neutral-900 flex items-center gap-1 cursor-pointer transition-colors"
                  title={`Quitar filtro de día (${selectedDate})`}
                  aria-label="Quitar filtro de día"
                >
                  <X className="w-3.5 h-3.5 stroke-[1.75]" />
                  <span className="text-[10px] font-mono">{selectedDate}</span>
                </button>
              ) : (
                <span className="text-neutral-400">
                  Haz clic en cualquier día para filtrar el dashboard
                </span>
              )}

              <button
                onClick={handleBackToMonthly}
                className="p-1 text-neutral-400 hover:text-neutral-900 flex items-center justify-center cursor-pointer transition-colors"
                title="Volver a vista de meses"
                aria-label="Volver a meses"
              >
                <ArrowLeft className="w-3.5 h-3.5 stroke-[1.75]" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
