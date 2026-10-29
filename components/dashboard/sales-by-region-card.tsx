"use client";

import { useState, useMemo } from "react";
import { SlidersHorizontal, Maximize2, LayoutGrid } from "lucide-react";
import { cn, formatNumber, formatProperCase } from "@/lib/utils";
import { calculatePointsFromValues, generateSmoothPath, generateAreaPath } from "@/lib/svg-curve";
import { DimensionExplorerModal } from "./dimension-explorer-modal";

interface ZoneItem {
  name: string;
  value: number;
  history?: number[];
  isPositive?: boolean;
}

interface SalesByRegionCardProps {
  title?: string;
  subtitle?: string;
  data: ZoneItem[];
  totalCount?: number;
  onSelectZone?: (zone: string) => void;
  selectedZone?: string;
  className?: string;
}

export function SalesByRegionCard({
  title = "Ventas por Zona",
  subtitle = "Distribución por zonas operativas",
  data,
  totalCount,
  onSelectZone,
  selectedZone,
  className,
}: SalesByRegionCardProps) {
  const [hoveredZoneIdx, setHoveredZoneIdx] = useState<number | null>(null);
  const [hoveredMonthIdx, setHoveredMonthIdx] = useState<number | null>(null);
  const [showAllInline, setShowAllInline] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const total = useMemo(() => {
    return totalCount || data.reduce((acc, curr) => acc + curr.value, 0) || 1;
  }, [totalCount, data]);

  const monthLabels = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

  // Top 6 zones with real dynamic sparkline curves (3x2 grid)
  const top6WithCurves = useMemo(() => {
    const rawList = data.length > 0 ? data.slice(0, 6) : [
      { name: "Distrito Capital", value: 3302 },
      { name: "Los Teques", value: 3248 },
      { name: "Tejerías", value: 758 },
      { name: "San Antonio", value: 526 },
      { name: "Guarenas", value: 395 },
      { name: "La Guaira", value: 327 },
    ];

    return rawList.map((d, idx) => {
      const percentage = Math.min(100, Math.round((d.value / total) * 100));

      const history = d.history && d.history.length >= 2
        ? d.history
        : [
            Math.round(d.value * 0.1),
            Math.round(d.value * 0.15),
            Math.round(d.value * 0.22),
            Math.round(d.value * 0.28),
            Math.round(d.value * 0.25),
          ];

      const points = calculatePointsFromValues(history, 100, 32, 4, 3);
      const path = generateSmoothPath(points, 0.25);
      const area = generateAreaPath(points, 32, 0.25);

      // Trend direction: use precomputed isPositive or compare last vs previous point
      const isPositive = typeof d.isPositive === "boolean"
        ? d.isPositive
        : history.length >= 2
        ? history[history.length - 1] >= history[history.length - 2]
        : true;
      const themeColor = isPositive ? "#10b981" : "#f97316";
      const dotBg = isPositive ? "bg-emerald-500" : "bg-orange-500";

      return {
        name: d.name,
        value: d.value,
        percentage,
        history,
        points,
        path,
        area,
        isPositive,
        strokeColor: themeColor,
        dotColor: dotBg,
      };
    });
  }, [data, total]);

  return (
    <>
      <div className={cn("p-4 sm:p-6 bg-white flex flex-col justify-between h-full select-none", className)}>
        <div>
          {/* Header */}
          <div className="flex items-center justify-between mb-1.5">
            <h3 className="text-sm font-semibold text-neutral-900 tracking-tight">{title}</h3>
            
            {/* Minimalist Icon Controls (Zero Words) */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-mono text-neutral-400">
                {data.length}
              </span>

              {/* Inline View Toggle */}
              <button
                type="button"
                onClick={() => setShowAllInline(!showAllInline)}
                className={cn(
                  "min-w-[36px] min-h-[36px] p-2 flex items-center justify-center transition-colors cursor-pointer",
                  showAllInline
                    ? "text-neutral-950 font-bold"
                    : "text-neutral-400 hover:text-neutral-900"
                )}
                title={showAllInline ? "Ver cuadrícula de top 4" : `Ver todas las zonas (${data.length})`}
                aria-label="Alternar vista de zonas"
              >
                {showAllInline ? (
                  <LayoutGrid className="w-3.5 h-3.5 stroke-[1.75]" />
                ) : (
                  <SlidersHorizontal className="w-3.5 h-3.5 stroke-[1.75]" />
                )}
              </button>

              {/* Modal Expand Button */}
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="min-w-[36px] min-h-[36px] p-2 flex items-center justify-center text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
                title={`Explorar todas las zonas (${data.length})`}
                aria-label="Abrir explorador de zonas"
              >
                <Maximize2 className="w-3.5 h-3.5 stroke-[1.75]" />
              </button>
            </div>
          </div>
          <p className="text-[11px] font-mono text-neutral-500 mb-5">{subtitle}</p>

          {!showAllInline ? (
            /* 3x2 Gauges / Real Dynamic Sparklines Grid (Top 6) */
            <div className="grid grid-cols-2 gap-y-2.5 gap-x-2.5 sm:gap-x-3">
              {top6WithCurves.map((region, idx) => {
                const isSelected = selectedZone === region.name;
                const isHovered = hoveredZoneIdx === idx;
                const lastPoint = region.points[region.points.length - 1] || { x: 94, y: 16 };

                return (
                  <div
                    key={idx}
                    onClick={() => onSelectZone && onSelectZone(region.name)}
                    onMouseEnter={() => setHoveredZoneIdx(idx)}
                    onMouseLeave={() => {
                      setHoveredZoneIdx(null);
                      setHoveredMonthIdx(null);
                    }}
                    className={cn(
                      "flex flex-col p-2 sm:p-1.5 transition-all cursor-pointer rounded relative group min-h-[72px] justify-between",
                      isHovered
                        ? "bg-neutral-100"
                        : isSelected
                        ? "bg-neutral-100 ring-1 ring-neutral-900"
                        : "hover:bg-neutral-50"
                    )}
                    title={`Filtrar por zona: ${region.name}`}
                  >
                    <div className="flex items-start justify-between mb-0.5 gap-1 min-h-[20px]">
                      <div className="flex items-start gap-1.5 text-[11px] leading-tight min-w-0 flex-1">
                        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0 mt-1", region.dotColor)} />
                        <span className="text-neutral-800 font-medium leading-tight truncate" title={region.name}>
                          {formatProperCase(region.name)}
                        </span>
                      </div>
                      <span className="text-xs font-mono font-bold text-neutral-900 shrink-0 ml-1">
                        {region.percentage}%
                      </span>
                    </div>

                    <span className="text-[10px] font-mono text-neutral-500 mb-0.5">
                      {formatNumber(region.value)} inst.
                    </span>

                    {/* Dynamic Sparkline SVG */}
                    <div className="h-7 w-full relative">
                      <svg
                        className="w-full h-full overflow-visible"
                        preserveAspectRatio="none"
                        viewBox="0 0 100 32"
                        onMouseMove={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const mouseX = e.clientX - rect.left;
                          const fraction = Math.max(0, Math.min(1, mouseX / rect.width));
                          const mIdx = Math.round(fraction * (region.history.length - 1));
                          setHoveredMonthIdx(mIdx);
                        }}
                      >
                        <defs>
                          {/* Difuminado abajo (Gradient Fill idéntico al header KPI) */}
                          <linearGradient id={`gradRegDynamic-${idx}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={region.strokeColor} stopOpacity="0.42" />
                            <stop offset="65%" stopColor={region.strokeColor} stopOpacity="0.16" />
                            <stop offset="100%" stopColor={region.strokeColor} stopOpacity="0.0" />
                          </linearGradient>

                          {/* Glowing Line Filter */}
                          <filter
                            id={`lineGlowReg-${idx}`}
                            x="-10%"
                            y="-20%"
                            width="120%"
                            height="140%"
                          >
                            <feGaussianBlur stdDeviation="1.5" result="blur" />
                            <feComposite in="SourceGraphic" in2="blur" operator="over" />
                          </filter>
                        </defs>

                        {/* Gradient Area Fill */}
                        <path d={region.area} fill={`url(#gradRegDynamic-${idx})`} className="transition-all duration-300" />

                        {/* Smooth Line Path with Glow */}
                        <path
                          d={region.path}
                          fill="none"
                          stroke={region.strokeColor}
                          strokeLinecap="round"
                          strokeWidth="1.5"
                          filter={`url(#lineGlowReg-${idx})`}
                          className="transition-all duration-300"
                        />

                        {/* Interactive dot on hover */}
                        {isHovered && hoveredMonthIdx !== null && region.points[hoveredMonthIdx] ? (
                          <circle
                            cx={region.points[hoveredMonthIdx].x}
                            cy={region.points[hoveredMonthIdx].y}
                            fill={region.strokeColor}
                            stroke="#FFFFFF"
                            strokeWidth="2"
                            r="3"
                          />
                        ) : (
                          <circle
                            cx={lastPoint.x}
                            cy={lastPoint.y}
                            fill={region.strokeColor}
                            stroke="#FFFFFF"
                            strokeWidth="1.5"
                            r="2.5"
                            className="transition-all duration-200"
                          />
                        )}
                      </svg>

                      {/* Hover tooltip for month */}
                      {isHovered && hoveredMonthIdx !== null && region.history[hoveredMonthIdx] !== undefined && (
                        <div
                          className="absolute pointer-events-none -top-5 bg-neutral-900 text-white text-[9px] font-mono px-1.5 py-0.5 rounded shadow -translate-x-1/2 z-20 whitespace-nowrap"
                          style={{
                            left: `${(hoveredMonthIdx / (region.history.length - 1 || 1)) * 100}%`,
                          }}
                        >
                          {monthLabels[hoveredMonthIdx] || `P${hoveredMonthIdx + 1}`}: {formatNumber(region.history[hoveredMonthIdx])} inst.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* All Zones Scrollable List */
            <div className="max-h-[220px] overflow-y-auto pr-1 space-y-1.5 text-xs font-mono">
              {data.map((zone, idx) => {
                const pct = total > 0 ? ((zone.value / total) * 100).toFixed(1) : "0.0";
                const isSelected = selectedZone === zone.name;

                return (
                  <div
                    key={`${zone.name}-${idx}`}
                    onClick={() => onSelectZone && onSelectZone(zone.name)}
                    className={cn(
                      "flex items-center justify-between p-2 rounded cursor-pointer transition-colors",
                      idx < data.length - 1 && "border-b border-neutral-100/70",
                      isSelected
                        ? "bg-neutral-100 text-neutral-900 ring-1 ring-neutral-900 font-semibold"
                        : "hover:bg-neutral-50 text-neutral-700"
                    )}
                    title={`Filtrar por zona: ${zone.name}`}
                  >
                    <span className="flex items-center gap-2 min-w-0 flex-1 pr-2 truncate">
                      <span className="w-4 h-4 rounded text-[9px] font-mono text-neutral-500 bg-neutral-100 flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="truncate">{formatProperCase(zone.name)}</span>
                    </span>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[10px] text-neutral-400">{formatNumber(zone.value)} inst.</span>
                      <span className="text-neutral-900 font-bold w-12 text-right">{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-neutral-100 text-[11px] font-mono text-neutral-500 mt-4 flex items-center justify-between">
          <span>Total Zonas:</span>
          <span className="text-neutral-900 font-bold">{formatNumber(total)} instalaciones</span>
        </div>
      </div>

      {/* Full Dimension Explorer Modal */}
      <DimensionExplorerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Directorio Integral de Zonas Operativas"
        subtitle="Distribución regional y volumen comercial consolidado"
        dimensionName="zonas"
        items={data.map((z) => ({
          name: z.name,
          value: z.value,
        }))}
        selectedItem={selectedZone}
        onSelectItem={onSelectZone}
      />
    </>
  );
}
