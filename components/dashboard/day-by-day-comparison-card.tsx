"use client";

import { useState, useMemo, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn, formatNumber, formatProperCase } from "@/lib/utils";
import { Installation, Solicitud, MONTH_ORDER } from "@/lib/dashboard-data";
import {
  calculateDayByDayMTDComparison,
  DayByDayMTDComparison,
} from "@/lib/analytics-comparison";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DayByDayComparisonCardProps {
  installations: Installation[];
  solicitudes?: Solicitud[];
  defaultMonthA?: string;
  defaultMonthB?: string;
  onSelectDate?: (dateStr: string) => void;
  selectedDate?: string;
  className?: string;
}

export function DayByDayComparisonCard({
  installations = [],
  solicitudes = [],
  defaultMonthA,
  defaultMonthB,
  onSelectDate,
  selectedDate,
  className,
}: DayByDayComparisonCardProps) {
  const currentIdx = new Date().getMonth();
  const fallbackMonthB = MONTH_ORDER[currentIdx] || "Noviembre";
  const fallbackMonthA = currentIdx > 0 ? MONTH_ORDER[currentIdx - 1] : "Octubre";

  // Available months from data (considering both installations and solicitudes)
  const availableMonths = useMemo(() => {
    const set = new Set([
      ...installations.map((d) => formatProperCase(d.mes)),
      ...solicitudes.map((s) => formatProperCase(s.mes)),
    ].filter(Boolean));
    return MONTH_ORDER.filter((m) => set.has(m));
  }, [installations, solicitudes]);

  const [monthA, setMonthA] = useState<string>(() => {
    const targetA = defaultMonthA || fallbackMonthA;
    return availableMonths.includes(targetA)
      ? targetA
      : availableMonths[availableMonths.length - 2] || fallbackMonthA;
  });
  const [monthB, setMonthB] = useState<string>(() => {
    const targetB = defaultMonthB || fallbackMonthB;
    return availableMonths.includes(targetB)
      ? targetB
      : availableMonths[availableMonths.length - 1] || fallbackMonthB;
  });

  useEffect(() => {
    if (defaultMonthA && availableMonths.includes(defaultMonthA)) {
      setMonthA(defaultMonthA);
    }
  }, [defaultMonthA, availableMonths]);

  useEffect(() => {
    if (defaultMonthB && availableMonths.includes(defaultMonthB)) {
      setMonthB(defaultMonthB);
    }
  }, [defaultMonthB, availableMonths]);

  const [displayType, setDisplayType] = useState<"chart" | "table">("chart");
  const [tableLayout, setTableLayout] = useState<"split" | "single">("split");
  const [metricType, setMetricType] = useState<"installations" | "solicitudes">("installations");
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  const activeDataset = metricType === "installations" ? installations : (solicitudes as any[]);

  const comparison: DayByDayMTDComparison = useMemo(() => {
    return calculateDayByDayMTDComparison(
      activeDataset,
      monthA,
      monthB,
      true // Siempre homologado MTD al corte actual para comparación justa
    );
  }, [activeDataset, monthA, monthB]);

  const isDeficit = comparison.differenceMTD < 0;
  const rawMaxVal = Math.max(
    ...comparison.rows.map((r) => Math.max(r.valueA, r.valueB)),
    1
  );

  // Round ceiling for Y-axis ticks, matching the Daily and Monthly charts
  const ceiling = Math.ceil(rawMaxVal / 10) * 10;
  const yAxisTicks = [
    ceiling,
    Math.round(ceiling * 0.75),
    Math.round(ceiling * 0.5),
    Math.round(ceiling * 0.25),
    0,
  ];

  const midIndex = Math.ceil(comparison.rows.length / 2);
  const leftRows = useMemo(() => comparison.rows.slice(0, midIndex), [comparison.rows, midIndex]);
  const rightRows = useMemo(() => comparison.rows.slice(midIndex), [comparison.rows, midIndex]);
  const renderComparisonRow = (row: (typeof comparison.rows)[0]) => {
    const isSelected = selectedDate === row.dateStrB;
    return (
      <tr
        key={row.day}
        onClick={() => {
          if (onSelectDate) {
            onSelectDate(isSelected ? "" : row.dateStrB);
          }
        }}
        className={cn(
          "hover:bg-neutral-50/80 transition-colors cursor-pointer",
          isSelected && "bg-neutral-100/80 font-semibold"
        )}
      >
        <td className="py-1 px-2 text-center text-neutral-400 font-mono">
          #{String(row.day).padStart(2, "0")}
        </td>
        <td className="py-1 px-2 text-center">
          <span className={cn(row.valueA === 0 ? "text-neutral-300" : "text-neutral-800")}>
            {row.valueA}
          </span>
        </td>
        <td className="py-1 px-2 text-center font-medium">
          <span className={cn(row.valueB === 0 ? "text-neutral-300" : "text-neutral-900")}>
            {row.valueB}
          </span>
        </td>
        <td className="py-1 px-2 text-center">
          <span
            className={cn(
              "font-mono font-medium",
              row.diff > 0
                ? "text-emerald-600"
                : row.diff < 0
                ? "text-amber-600"
                : "text-neutral-300"
            )}
          >
            {row.diff > 0 ? `+${row.diff}` : row.diff === 0 ? "0" : row.diff}
          </span>
        </td>
      </tr>
    );
  };

  return (
    <div className={cn("bg-white flex flex-col justify-between select-none", className)}>
      {/* 1. Header & Minimalist Controls (Cohesive with panel design) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-2 border-b border-neutral-100 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-neutral-900 tracking-tight">
              Comparativa MTD – {monthB} vs {monthA}
            </h3>
            <span className="text-[11px] font-mono text-neutral-400">
              (Corte al día {comparison.cutoffDay})
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-neutral-500 mt-0.5">
            <span>Días sin registros con 0</span>
            <span className="text-neutral-300">•</span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-neutral-300 inline-block" />
              <span>{monthA} ({formatNumber(comparison.totalMonthAMTD)})</span>
            </span>
            <span className="text-neutral-300">•</span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-neutral-900 inline-block" />
              <span>{monthB} ({formatNumber(comparison.totalMonthBMTD)})</span>
            </span>
          </div>
        </div>

        {/* Mobile Minimalist Controls (Zero horizontal overflow) */}
        <div className="flex sm:hidden flex-col gap-2.5 w-full pt-1 text-xs font-mono">
          {/* Row 1: Executive Pill + Metric Switcher */}
          <div className="flex items-center justify-between gap-2">
            <span
              className={cn(
                "text-[11px] font-semibold px-2 py-0.5 rounded-xs shrink-0",
                isDeficit
                  ? "text-amber-700 bg-neutral-100"
                  : comparison.differenceMTD > 0
                  ? "text-emerald-700 bg-neutral-100"
                  : "text-neutral-700 bg-neutral-100"
              )}
            >
              {comparison.differenceMTD > 0 ? `+${comparison.differenceMTD}` : comparison.differenceMTD} {metricType === "solicitudes" ? "sol." : "inst."} ({comparison.differencePercent > 0 ? `+${comparison.differencePercent}%` : `${comparison.differencePercent}%`})
            </span>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setMetricType("installations")}
                className={cn(
                  "pb-0.5 transition-colors cursor-pointer text-xs",
                  metricType === "installations"
                    ? "text-neutral-950 font-bold border-b border-neutral-900"
                    : "text-neutral-400 hover:text-neutral-800 font-medium"
                )}
              >
                Instalaciones
              </button>
              <span className="text-neutral-300">/</span>
              <button
                onClick={() => setMetricType("solicitudes")}
                className={cn(
                  "pb-0.5 transition-colors cursor-pointer text-xs",
                  metricType === "solicitudes"
                    ? "text-neutral-950 font-bold border-b border-neutral-900"
                    : "text-neutral-400 hover:text-neutral-800 font-medium"
                )}
              >
                Solicitudes
              </button>
            </div>
          </div>

          {/* Row 2: Months Selectors & View Switcher */}
          <div className="flex items-center justify-between gap-2 border-t border-neutral-100 pt-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-neutral-400">Base:</span>
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex items-center gap-1 text-xs font-mono font-medium text-neutral-800 hover:text-black transition-colors focus:outline-none cursor-pointer py-0.5 group">
                  <span className="underline decoration-neutral-300 group-hover:decoration-neutral-900 underline-offset-2">{monthA}</span>
                  <ChevronDown className="w-3 h-3 text-neutral-400 group-hover:text-neutral-700 shrink-0 transition-colors" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[8.5rem] max-w-[calc(100vw-32px)] p-1 bg-white border border-neutral-200/90 shadow-md rounded-lg font-mono text-xs z-50">
                  {availableMonths.map((m) => (
                    <DropdownMenuItem
                      key={m}
                      onClick={() => setMonthA(m)}
                      className={cn(
                        "flex items-center justify-between px-2.5 py-1.5 rounded-md cursor-pointer transition-colors text-xs font-mono",
                        m === monthA
                          ? "bg-neutral-900 text-white font-semibold focus:bg-neutral-900 focus:text-white"
                          : "text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 focus:bg-neutral-100 focus:text-neutral-900"
                      )}
                    >
                      <span>{m}</span>
                      {m === monthA && <Check className="w-3.5 h-3.5 stroke-[2]" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <span className="text-neutral-300 mx-0.5">vs</span>

              <span className="text-[11px] text-neutral-400">Actual:</span>
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex items-center gap-1 text-xs font-mono font-medium text-neutral-800 hover:text-black transition-colors focus:outline-none cursor-pointer py-0.5 group">
                  <span className="underline decoration-neutral-300 group-hover:decoration-neutral-900 underline-offset-2">{monthB}</span>
                  <ChevronDown className="w-3 h-3 text-neutral-400 group-hover:text-neutral-700 shrink-0 transition-colors" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[8.5rem] max-w-[calc(100vw-32px)] p-1 bg-white border border-neutral-200/90 shadow-md rounded-lg font-mono text-xs z-50">
                  {availableMonths.map((m) => (
                    <DropdownMenuItem
                      key={m}
                      onClick={() => setMonthB(m)}
                      className={cn(
                        "flex items-center justify-between px-2.5 py-1.5 rounded-md cursor-pointer transition-colors text-xs font-mono",
                        m === monthB
                          ? "bg-neutral-900 text-white font-semibold focus:bg-neutral-900 focus:text-white"
                          : "text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 focus:bg-neutral-100 focus:text-neutral-900"
                      )}
                    >
                      <span>{m}</span>
                      {m === monthB && <Check className="w-3.5 h-3.5 stroke-[2]" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* View Switcher: Gráfico vs Tabla */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setDisplayType("chart")}
                className={cn(
                  "pb-0.5 transition-colors cursor-pointer text-xs",
                  displayType === "chart"
                    ? "text-neutral-950 font-bold border-b border-neutral-900"
                    : "text-neutral-400 hover:text-neutral-800 font-medium"
                )}
              >
                Gráfico
              </button>
              <button
                onClick={() => setDisplayType("table")}
                className={cn(
                  "pb-0.5 transition-colors cursor-pointer text-xs",
                  displayType === "table"
                    ? "text-neutral-950 font-bold border-b border-neutral-900"
                    : "text-neutral-400 hover:text-neutral-800 font-medium"
                )}
              >
                Tabla
              </button>
            </div>
          </div>
        </div>

        {/* Minimalist Controls & Executive Summary Pill (Desktop) */}
        <div className="hidden sm:flex flex-wrap items-center gap-3 text-xs font-mono">
          {/* Executive Summary Tag (Direct insight without number clutter) */}
          <div className="flex items-center">
            <span
              className={cn(
                "text-[11px] font-semibold px-2 py-0.5 rounded-xs",
                isDeficit
                  ? "text-amber-700 bg-neutral-100"
                  : comparison.differenceMTD > 0
                  ? "text-emerald-700 bg-neutral-100"
                  : "text-neutral-700 bg-neutral-100"
              )}
            >
              {comparison.differenceMTD > 0 ? `+${comparison.differenceMTD}` : comparison.differenceMTD} {metricType === "solicitudes" ? "sol." : "inst."} ({comparison.differencePercent > 0 ? `+${comparison.differencePercent}%` : `${comparison.differencePercent}%`})
            </span>
          </div>

          {/* Dataset Switcher (Instalaciones vs Solicitudes) */}
          <div className="flex items-center gap-2 border-l border-neutral-200 pl-3">
            <button
              onClick={() => setMetricType("installations")}
              className={cn(
                "pb-0.5 transition-colors cursor-pointer text-xs",
                metricType === "installations"
                  ? "text-neutral-950 font-bold border-b border-neutral-900"
                  : "text-neutral-400 hover:text-neutral-800 font-medium"
              )}
            >
              Instalaciones
            </button>
            <button
              onClick={() => setMetricType("solicitudes")}
              className={cn(
                "pb-0.5 transition-colors cursor-pointer text-xs",
                metricType === "solicitudes"
                  ? "text-neutral-950 font-bold border-b border-neutral-900"
                  : "text-neutral-400 hover:text-neutral-800 font-medium"
              )}
            >
              Solicitudes
            </button>
          </div>

          {/* Month A Selector (Pure typographic dropdown, matches Daily chart) */}
          <div className="flex items-center gap-1 border-l border-neutral-200 pl-3">
            <span className="text-[11px] text-neutral-400">Base:</span>
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center gap-1 text-xs font-mono font-medium text-neutral-800 hover:text-black transition-colors focus:outline-none cursor-pointer py-0.5 group">
                <span className="underline decoration-neutral-300 group-hover:decoration-neutral-900 underline-offset-2">{monthA}</span>
                <ChevronDown className="w-3 h-3 text-neutral-400 group-hover:text-neutral-700 shrink-0 transition-colors" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[8.5rem] p-1 bg-white border border-neutral-200/90 shadow-md rounded-lg font-mono text-xs z-50">
                {availableMonths.map((m) => (
                  <DropdownMenuItem
                    key={m}
                    onClick={() => setMonthA(m)}
                    className={cn(
                      "flex items-center justify-between px-2.5 py-1.5 rounded-md cursor-pointer transition-colors text-xs font-mono",
                      m === monthA
                        ? "bg-neutral-900 text-white font-semibold focus:bg-neutral-900 focus:text-white"
                        : "text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 focus:bg-neutral-100 focus:text-neutral-900"
                    )}
                  >
                    <span>{m}</span>
                    {m === monthA && <Check className="w-3.5 h-3.5 stroke-[2]" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <span className="text-neutral-300">vs</span>

          {/* Month B Selector */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-neutral-400">Actual:</span>
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center gap-1 text-xs font-mono font-medium text-neutral-800 hover:text-black transition-colors focus:outline-none cursor-pointer py-0.5 group">
                <span className="underline decoration-neutral-300 group-hover:decoration-neutral-900 underline-offset-2">{monthB}</span>
                <ChevronDown className="w-3 h-3 text-neutral-400 group-hover:text-neutral-700 shrink-0 transition-colors" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[8.5rem] p-1 bg-white border border-neutral-200/90 shadow-md rounded-lg font-mono text-xs z-50">
                {availableMonths.map((m) => (
                  <DropdownMenuItem
                    key={m}
                    onClick={() => setMonthB(m)}
                    className={cn(
                      "flex items-center justify-between px-2.5 py-1.5 rounded-md cursor-pointer transition-colors text-xs font-mono",
                      m === monthB
                        ? "bg-neutral-900 text-white font-semibold focus:bg-neutral-900 focus:text-white"
                        : "text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 focus:bg-neutral-100 focus:text-neutral-900"
                    )}
                  >
                    <span>{m}</span>
                    {m === monthB && <Check className="w-3.5 h-3.5 stroke-[2]" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* View Switcher: Gráfico vs Tabla */}
          <div className="flex items-center gap-2 border-l border-neutral-200 pl-3">
            <button
              onClick={() => setDisplayType("chart")}
              className={cn(
                "pb-0.5 transition-colors cursor-pointer text-xs",
                displayType === "chart"
                  ? "text-neutral-950 font-bold border-b border-neutral-900"
                  : "text-neutral-400 hover:text-neutral-800 font-medium"
              )}
            >
              Gráfico
            </button>
            <button
              onClick={() => setDisplayType("table")}
              className={cn(
                "pb-0.5 transition-colors cursor-pointer text-xs",
                displayType === "table"
                  ? "text-neutral-950 font-bold border-b border-neutral-900"
                  : "text-neutral-400 hover:text-neutral-800 font-medium"
              )}
            >
              Tabla
            </button>
          </div>

          {/* Sub-selector de formato de tabla: Doble columna vs Continua */}
          {displayType === "table" && (
            <div className="flex items-center gap-2 border-l border-neutral-200 pl-3">
              <button
                onClick={() => setTableLayout("split")}
                className={cn(
                  "pb-0.5 transition-colors cursor-pointer text-[11px]",
                  tableLayout === "split"
                    ? "text-neutral-950 font-bold border-b border-neutral-900"
                    : "text-neutral-400 hover:text-neutral-800 font-medium"
                )}
                title="Ver mes completo en dos columnas paralelas sin scroll"
              >
                Doble columna
              </button>
              <button
                onClick={() => setTableLayout("single")}
                className={cn(
                  "pb-0.5 transition-colors cursor-pointer text-[11px]",
                  tableLayout === "single"
                    ? "text-neutral-950 font-bold border-b border-neutral-900"
                    : "text-neutral-400 hover:text-neutral-800 font-medium"
                )}
                title="Ver en una sola tabla continua"
              >
                Continua
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. Main Content: Visual Chart (Default) or Minimalist Table */}
      {displayType === "chart" ? (
        <div className="relative pt-6 pb-2">
          {/* Y-Axis Grid Lines (EXACT same style as Monthly & Daily in SalesTrendBarChart) */}
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none text-[10px] text-neutral-400 font-mono">
            {yAxisTicks.map((tick, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center justify-between pb-1",
                  i < yAxisTicks.length - 1 && "border-b border-neutral-100"
                )}
              >
                <span className="w-6 text-right pr-1 font-mono">{tick}</span>
                <span className="w-full border-t border-dashed border-neutral-200/70 ml-1" />
              </div>
            ))}
          </div>

          {/* Dual Bars Container with Value Labels */}
          <div className="relative h-60 w-full pt-8 flex items-end justify-between pl-6 sm:pl-8 pr-1 sm:pr-2 z-10 overflow-hidden sm:overflow-x-visible">
            {comparison.rows.map((row) => {
              const heightA = ceiling > 0 && row.valueA > 0
                ? Math.max(6, Math.round((row.valueA / ceiling) * 78))
                : 0;
              const heightB = ceiling > 0 && row.valueB > 0
                ? Math.max(6, Math.round((row.valueB / ceiling) * 78))
                : 0;
              const isHovered = hoveredDay === row.day;
              const isSelected = selectedDate === row.dateStrB;

              return (
                <div
                  key={row.day}
                  onMouseEnter={() => setHoveredDay(row.day)}
                  onMouseLeave={() => setHoveredDay(null)}
                  onClick={() => {
                    if (onSelectDate) {
                      onSelectDate(isSelected ? "" : row.dateStrB);
                    }
                  }}
                  className="flex flex-col items-center gap-1 sm:gap-1.5 group cursor-pointer h-full justify-end relative flex-1 min-w-0 sm:min-w-[14px] sm:max-w-[36px] mx-[0.5px] sm:mx-[2px]"
                >
                  {/* Floating Hover Tooltip (Matching daily chart tooltip style) */}
                  {isHovered && (
                    <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-neutral-950 text-white font-mono text-[10px] px-2.5 py-1.5 rounded shadow-xl border border-neutral-800 pointer-events-none whitespace-nowrap z-30 flex flex-col gap-0.5">
                      <div className="font-bold border-b border-neutral-800 pb-0.5 text-neutral-300">
                        Día {String(row.day).padStart(2, "0")}
                      </div>
                      <div className="flex items-center justify-between gap-3 text-neutral-200">
                        <span>{monthB}:</span>
                        <strong className="text-white">{row.valueB}</strong>
                      </div>
                      <div className="flex items-center justify-between gap-3 text-neutral-400">
                        <span>{monthA}:</span>
                        <span>{row.valueA}</span>
                      </div>
                      <div className={cn(
                        "pt-0.5 font-bold border-t border-neutral-800 flex items-center justify-between gap-3",
                        row.diff > 0 ? "text-emerald-400" : row.diff < 0 ? "text-amber-400" : "text-neutral-400"
                      )}>
                        <span>Diferencia:</span>
                        <span>{row.diff > 0 ? `+${row.diff}` : row.diff}</span>
                      </div>
                    </div>
                  )}

                  {/* Dual Bars with Dynamic Values */}
                  <div className="w-full flex items-end justify-center gap-[1px] sm:gap-1 h-48">
                    {/* Month A (Base) Bar Column */}
                    <div className="flex flex-col items-center justify-end h-full w-[3px] sm:w-2.5 group/barA">
                      {row.valueA > 0 ? (
                        <>
                          <span
                            className={cn(
                              "text-[8px] sm:text-[9px] font-mono leading-none mb-1 select-none transition-colors hidden sm:block",
                              isHovered ? "text-neutral-900 font-semibold" : "text-neutral-500 font-medium"
                            )}
                            title={`${monthA}: ${row.valueA}`}
                          >
                            {row.valueA}
                          </span>
                          <div
                            style={{ height: `${heightA}%` }}
                            className="w-full rounded-t-xs transition-all duration-150 bg-neutral-300 group-hover:bg-neutral-400"
                            title={`${monthA}: ${row.valueA}`}
                          />
                        </>
                      ) : (
                        <>
                          <span className="text-[7px] sm:text-[8px] font-mono text-neutral-300 leading-none mb-1 select-none hidden sm:block">
                            0
                          </span>
                          <div
                            className="w-full h-[2px] bg-neutral-200 rounded-xs"
                            title={`${monthA} d.${row.day}: 0 registros`}
                          />
                        </>
                      )}
                    </div>

                    {/* Month B (Actual) Bar Column */}
                    <div className="flex flex-col items-center justify-end h-full w-[3px] sm:w-2.5 group/barB">
                      {row.valueB > 0 ? (
                        <>
                          <span
                            className={cn(
                              "text-[8px] sm:text-[9px] font-mono leading-none mb-1 select-none transition-colors hidden sm:block",
                              isSelected
                                ? "text-neutral-950 font-extrabold"
                                : isHovered
                                ? "text-neutral-950 font-bold"
                                : "text-neutral-900 font-bold"
                            )}
                            title={`${monthB}: ${row.valueB}`}
                          >
                            {row.valueB}
                          </span>
                          <div
                            style={{ height: `${heightB}%` }}
                            className={cn(
                              "w-full rounded-t-xs transition-all duration-150",
                              isSelected
                                ? "bg-neutral-950 ring-2 ring-neutral-950 ring-offset-1"
                                : "bg-neutral-900 group-hover:bg-neutral-700"
                            )}
                            title={`${monthB}: ${row.valueB}`}
                          />
                        </>
                      ) : (
                        <>
                          <span className="text-[7px] sm:text-[8px] font-mono text-neutral-300 leading-none mb-1 select-none hidden sm:block">
                            0
                          </span>
                          <div
                            className="w-full h-[2px] bg-neutral-300 rounded-xs"
                            title={`${monthB} d.${row.day}: 0 registros`}
                          />
                        </>
                      )}
                    </div>
                  </div>

                  {/* Day Label */}
                  <span
                    className={cn(
                      "text-[8px] sm:text-[10px] font-mono transition-colors text-center leading-none mt-1",
                      isHovered || isSelected ? "text-neutral-950 font-bold" : "text-neutral-400",
                      row.day % 5 === 0 || row.day === 1 || isSelected ? "block" : "hidden sm:block"
                    )}
                  >
                    {String(row.day).padStart(2, "0")}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* VISTA TABLA CENTRADA Y SIN SCROLL INTERNO FORZADO */
        <div className="pt-2 pb-1">
          {tableLayout === "split" ? (
            /* FORMATO HÍBRIDO 1: DOBLE COLUMNA PARALELA (100% VISIBLE SIN SCROLL) */
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto w-full">
                {/* Bloque 1: Primera mitad de días */}
                <div className="w-full">
                  <div className="text-[11px] font-mono text-neutral-400 text-center pb-1">
                    Días 01 – {String(leftRows[leftRows.length - 1]?.day || "").padStart(2, "0")}
                  </div>
                  <table className="w-full text-center border-collapse text-xs font-mono">
                    <thead>
                      <tr className="border-b border-neutral-200 text-[11px] text-neutral-500 font-medium">
                        <th className="py-1.5 px-2 text-center w-12 font-medium">Día</th>
                        <th className="py-1.5 px-2 text-center font-medium">{monthA}</th>
                        <th className="py-1.5 px-2 text-center font-medium">{monthB}</th>
                        <th className="py-1.5 px-2 text-center font-medium">Diferencia</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {leftRows.map(renderComparisonRow)}
                    </tbody>
                  </table>
                </div>

                {/* Bloque 2: Segunda mitad de días */}
                <div className="w-full">
                  <div className="text-[11px] font-mono text-neutral-400 text-center pb-1">
                    Días {String(rightRows[0]?.day || "").padStart(2, "0")} – {String(rightRows[rightRows.length - 1]?.day || "").padStart(2, "0")}
                  </div>
                  <table className="w-full text-center border-collapse text-xs font-mono">
                    <thead>
                      <tr className="border-b border-neutral-200 text-[11px] text-neutral-500 font-medium">
                        <th className="py-1.5 px-2 text-center w-12 font-medium">Día</th>
                        <th className="py-1.5 px-2 text-center font-medium">{monthA}</th>
                        <th className="py-1.5 px-2 text-center font-medium">{monthB}</th>
                        <th className="py-1.5 px-2 text-center font-medium">Diferencia</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {rightRows.map(renderComparisonRow)}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Total MTD unificado para vista paralela */}
              <div className="max-w-4xl mx-auto w-full pt-2.5 pb-1 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between text-xs font-mono px-3 gap-2">
                <span className="font-bold text-neutral-900">Total MTD</span>
                <div className="flex flex-wrap items-center justify-center gap-5 sm:gap-8">
                  <div className="flex items-center gap-1.5">
                    <span className="text-neutral-500">{monthA}:</span>
                    <span className="font-bold text-neutral-900">{formatNumber(comparison.totalMonthAMTD)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-neutral-500">{monthB}:</span>
                    <span className="font-bold text-neutral-950">{formatNumber(comparison.totalMonthBMTD)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-neutral-500">Diferencia:</span>
                    <span className={cn("font-bold", isDeficit ? "text-amber-600" : "text-emerald-600")}>
                      {comparison.differenceMTD > 0 ? `+${comparison.differenceMTD}` : comparison.differenceMTD} ({comparison.differencePercent > 0 ? `+${comparison.differencePercent}%` : `${comparison.differencePercent}%`})
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* FORMATO HÍBRIDO 2: TABLA ÚNICA CENTRADA Y CONTINUA (SIN CAJA DE SCROLL INTERNA) */
            <div className="max-w-xl mx-auto w-full pt-1 pb-1">
              <table className="w-full text-center border-collapse text-xs font-mono">
                <thead>
                  <tr className="border-b border-neutral-200 text-[11px] text-neutral-500 font-medium">
                    <th className="py-2 px-3 text-center w-16 font-medium">Día</th>
                    <th className="py-2 px-3 text-center font-medium">{monthA}</th>
                    <th className="py-2 px-3 text-center font-medium">{monthB}</th>
                    <th className="py-2 px-3 text-center font-medium">Diferencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {comparison.rows.map(renderComparisonRow)}
                </tbody>
                <tfoot className="border-t border-neutral-300 font-mono">
                  <tr>
                    <td className="py-2.5 px-3 font-bold text-neutral-900 text-center">Total MTD</td>
                    <td className="py-2.5 px-3 font-bold text-neutral-900 text-center">{formatNumber(comparison.totalMonthAMTD)}</td>
                    <td className="py-2.5 px-3 font-bold text-neutral-950 text-center">{formatNumber(comparison.totalMonthBMTD)}</td>
                    <td className="py-2.5 px-3 font-bold text-center">
                      <span className={cn(isDeficit ? "text-amber-600" : "text-emerald-600")}>
                        {comparison.differenceMTD > 0 ? `+${comparison.differenceMTD}` : comparison.differenceMTD} ({comparison.differencePercent > 0 ? `+${comparison.differencePercent}%` : `${comparison.differencePercent}%`})
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 3. Footer (Identical to Monthly & Daily charts in SalesTrendBarChart) */}
      <div className="pt-3 border-t border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between text-[11px] font-mono text-neutral-500 mt-2 gap-1">
        <span>
          Acumulado al día {comparison.cutoffDay}: <strong className="text-neutral-900 font-semibold">{monthB} {formatNumber(comparison.totalMonthBMTD)}</strong> vs <strong className="text-neutral-900 font-semibold">{monthA} {formatNumber(comparison.totalMonthAMTD)}</strong> • Diferencia neta: <span className={cn(isDeficit ? "text-amber-600" : "text-emerald-600", "font-semibold")}>{comparison.differenceMTD > 0 ? `+${comparison.differenceMTD}` : comparison.differenceMTD} {metricType === "solicitudes" ? "sol." : "inst."} ({comparison.differencePercent > 0 ? `+${comparison.differencePercent}%` : `${comparison.differencePercent}%`})</span>
        </span>
        <span className="text-neutral-400">
          Días sin actividad normalizados con 0
        </span>
      </div>
    </div>
  );
}

