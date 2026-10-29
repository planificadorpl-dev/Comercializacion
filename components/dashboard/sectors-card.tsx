"use client";

import { useState, useMemo } from "react";
import { SlidersHorizontal, Maximize2, Activity } from "lucide-react";
import {
  CartesianGrid,
  Line,
  Area,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { cn, formatNumber, formatProperCase } from "@/lib/utils";
import { LevelReferenceStarLabel } from "@/components/ui/points-chart";
import { DimensionExplorerModal } from "./dimension-explorer-modal";

interface SectorItem {
  name: string;
  value: number;
}

interface SectorsCardProps {
  title?: string;
  subtitle?: string;
  data: SectorItem[];
  onSelectSector?: (sector: string) => void;
  selectedSector?: string;
  className?: string;
}

export function SectorsCard({
  title = "Sectores Principales",
  subtitle = "Distribución de volumen comercial continuo",
  data,
  onSelectSector,
  selectedSector,
  className,
}: SectorsCardProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [showAllInline, setShowAllInline] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const topSectors = useMemo(() => data.slice(0, 5), [data]);
  const total = useMemo(() => data.reduce((sum, d) => sum + d.value, 0) || 1, [data]);

  const chartData = useMemo(() => {
    if (topSectors.length === 0) return [];
    return topSectors.map((sector, idx) => {
      const prev = idx > 0 ? topSectors[idx - 1].value : sector.value;
      const change = sector.value - prev;
      const pct = Math.round((sector.value / total) * 100);
      return {
        name: sector.name,
        formattedName: formatProperCase(sector.name),
        total: sector.value,
        change,
        percentage: pct,
      };
    });
  }, [topSectors, total]);

  const avgSectorValue = useMemo(() => {
    if (topSectors.length === 0) return 0;
    return Math.round(topSectors.reduce((acc, s) => acc + s.value, 0) / topSectors.length);
  }, [topSectors]);

  const dotColors = ["bg-neutral-900", "bg-neutral-600", "bg-neutral-500", "bg-neutral-400", "bg-neutral-300"];

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
                title={showAllInline ? "Ver curva de top 5" : `Ver todos los sectores (${data.length})`}
                aria-label="Alternar vista de sectores"
              >
                {showAllInline ? (
                  <Activity className="w-3.5 h-3.5 stroke-[1.75]" />
                ) : (
                  <SlidersHorizontal className="w-3.5 h-3.5 stroke-[1.75]" />
                )}
              </button>

              {/* Modal Expand Button */}
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="min-w-[36px] min-h-[36px] p-2 flex items-center justify-center text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
                title={`Explorar todos los sectores (${data.length})`}
                aria-label="Abrir explorador de sectores"
              >
                <Maximize2 className="w-3.5 h-3.5 stroke-[1.75]" />
              </button>
            </div>
          </div>
          <p className="text-[11px] font-mono text-neutral-500 mb-3">{subtitle}</p>

          {!showAllInline ? (
            <>
              {/* Treemap / Proportional Density Matrix (Top Sectores) */}
              <div className="grid grid-cols-3 gap-1.5 h-28 mb-3 w-full">
                {topSectors.map((sector, idx) => {
                  const pct = Math.round((sector.value / total) * 100);
                  const isSelected = selectedSector === sector.name;
                  const isHovered = hoveredIndex === idx;

                  // Span first item across 2 cols if dominant
                  const colSpanClass = idx === 0 ? "col-span-2 row-span-1" : "col-span-1";
                  const bgClass = isSelected
                    ? "bg-neutral-900 text-white ring-1 ring-neutral-900"
                    : isHovered
                    ? "bg-neutral-800 text-white"
                    : idx === 0
                    ? "bg-neutral-900 text-white"
                    : idx === 1
                    ? "bg-neutral-700 text-white"
                    : idx === 2
                    ? "bg-neutral-200 text-neutral-900"
                    : idx === 3
                    ? "bg-neutral-150 text-neutral-800"
                    : "bg-neutral-100 text-neutral-700";

                  return (
                    <div
                      key={idx}
                      onClick={() => onSelectSector && onSelectSector(sector.name)}
                      onMouseEnter={() => setHoveredIndex(idx)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      className={cn(
                        "p-2 rounded flex flex-col justify-between transition-all cursor-pointer relative overflow-hidden group select-none",
                        colSpanClass,
                        bgClass
                      )}
                      title={`Sector: ${formatProperCase(sector.name)} • ${formatNumber(sector.value)} inst. (${pct}%)`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-[11px] font-medium leading-tight truncate">
                          {formatProperCase(sector.name)}
                        </span>
                        <span className="text-[10px] font-mono opacity-80 shrink-0 font-bold">
                          {pct}%
                        </span>
                      </div>
                      <div className="flex items-end justify-between mt-1">
                        <span className="text-xs font-mono font-bold tracking-tight">
                          {formatNumber(sector.value)}
                        </span>
                        <span className="text-[9px] font-mono opacity-70">
                          inst.
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Sectors Breakdown List (Top 5) */}
              <div className="space-y-1.5 text-xs font-mono">
                {topSectors.length === 0 ? (
                  <div className="text-center py-4 text-neutral-400">Sin datos</div>
                ) : (
                  topSectors.map((sector, idx) => {
                    const pct = Math.round((sector.value / total) * 100);
                    const isSelected = selectedSector === sector.name;
                    const isHovered = hoveredIndex === idx;

                    return (
                      <div
                        key={idx}
                        onClick={() => onSelectSector && onSelectSector(sector.name)}
                        onMouseEnter={() => setHoveredIndex(idx)}
                        onMouseLeave={() => setHoveredIndex(null)}
                        className={cn(
                          "flex items-center justify-between pb-1 cursor-pointer transition-colors px-1.5 py-1 rounded",
                          idx < topSectors.length - 1 && "border-b border-neutral-100",
                          isHovered
                            ? "bg-neutral-100 text-neutral-900"
                            : isSelected
                            ? "bg-neutral-100 text-neutral-900 ring-1 ring-neutral-900"
                            : "hover:bg-neutral-50"
                        )}
                        title={`Filtrar por sector: ${sector.name}`}
                      >
                        <span className="text-neutral-700 flex items-center gap-1.5 font-medium truncate max-w-[140px]">
                          <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotColors[idx % dotColors.length])} />
                          <span className="truncate">{formatProperCase(sector.name)}</span>
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-neutral-400">{formatNumber(sector.value)}</span>
                          <span className="text-neutral-900 font-bold">{pct}%</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            /* All Sectors Scrollable List */
            <div className="max-h-[260px] overflow-y-auto pr-1 space-y-1.5 text-xs font-mono">
              {data.map((sector, idx) => {
                const pct = total > 0 ? ((sector.value / total) * 100).toFixed(1) : "0.0";
                const isSelected = selectedSector === sector.name;

                return (
                  <div
                    key={`${sector.name}-${idx}`}
                    onClick={() => onSelectSector && onSelectSector(sector.name)}
                    className={cn(
                      "flex items-center justify-between p-1.5 rounded cursor-pointer transition-colors",
                      idx < data.length - 1 && "border-b border-neutral-100/70",
                      isSelected
                        ? "bg-neutral-100 text-neutral-900 ring-1 ring-neutral-900 font-semibold"
                        : "hover:bg-neutral-50 text-neutral-700"
                    )}
                    title={`Filtrar por sector: ${sector.name}`}
                  >
                    <span className="flex items-center gap-2 min-w-0 flex-1 pr-2 truncate">
                      <span className="w-4 h-4 rounded text-[9px] font-mono text-neutral-500 bg-neutral-100 flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="truncate">{formatProperCase(sector.name)}</span>
                    </span>
                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="text-[10px] text-neutral-400">{formatNumber(sector.value)}</span>
                      <span className="text-neutral-900 font-bold w-10 text-right">{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-neutral-100 text-[11px] font-mono text-neutral-500 mt-4 flex items-center justify-between">
          <span>
            Líder: <strong className="text-neutral-900 font-semibold">{formatProperCase(topSectors[0]?.name) || "N/A"}</strong>
          </span>
          <span className="text-neutral-900 font-mono font-medium">
            {total > 0 && topSectors[0] ? Math.round((topSectors[0].value / total) * 100) : 0}% del total
          </span>
        </div>
      </div>

      {/* Full Dimension Explorer Modal */}
      <DimensionExplorerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Directorio Integral de Sectores"
        subtitle="Distribución territorial y volumen comercial registrado"
        dimensionName="sectores"
        items={data.map((s) => ({
          name: s.name,
          value: s.value,
        }))}
        selectedItem={selectedSector}
        onSelectItem={onSelectSector}
      />
    </>
  );
}
