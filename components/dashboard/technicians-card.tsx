"use client";

import { useState, useMemo } from "react";
import { SlidersHorizontal, Maximize2, Flame, Settings2 } from "lucide-react";
import { cn, formatNumber, formatProperCase } from "@/lib/utils";
import { calculatePointsFromValues, generateSmoothPath, generateAreaPath } from "@/lib/svg-curve";
import { DimensionExplorerModal } from "./dimension-explorer-modal";

interface TechnicianItem {
  name: string;
  value: number;
  equipo?: string;
  history?: number[];
  isPositive?: boolean;
}

interface TechniciansCardProps {
  title?: string;
  subtitle?: string;
  data: TechnicianItem[];
  onSelectTechnician?: (technician: string) => void;
  selectedTechnician?: string;
  onOpenConfig?: () => void;
  className?: string;
}

export function TechniciansCard({
  title = "Técnicos de Campo",
  subtitle = "Rendimiento y resolución en campo",
  data,
  onSelectTechnician,
  selectedTechnician,
  onOpenConfig,
  className,
}: TechniciansCardProps) {
  const [hoveredTechIndex, setHoveredTechIndex] = useState<number | null>(null);
  const [showAllInline, setShowAllInline] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const topTechs = useMemo(() => data.slice(0, 5), [data]);
  const total = useMemo(() => data.reduce((sum, d) => sum + d.value, 0) || 1, [data]);

  // Compute dynamic performance data with smooth sparklines for top 5 technicians
  const performanceTechs = useMemo(() => {
    return topTechs.map((tech, idx) => {
      const nonZero = tech.history ? tech.history.filter((v) => v > 0) : [];
      const history = tech.history && nonZero.length >= 2
        ? tech.history
        : [
            Math.round(tech.value * 0.15),
            Math.round(tech.value * 0.22),
            Math.round(tech.value * 0.28),
            Math.round(tech.value * 0.25),
          ];

      const points = calculatePointsFromValues(history, 80, 24, 4, 3);
      const path = generateSmoothPath(points, 0.25);
      const area = generateAreaPath(points, 24, 0.25);

      const isPositive = typeof tech.isPositive === "boolean"
        ? tech.isPositive
        : history.length >= 2
        ? history[history.length - 1] >= history[history.length - 2]
        : true;

      const pctOfTotal = Math.round((tech.value / total) * 100);
      const themeColor = isPositive ? "#10b981" : "#f97316";

      return {
        ...tech,
        history,
        points,
        path,
        area,
        isPositive,
        pctOfTotal,
        themeColor,
      };
    });
  }, [topTechs, total]);

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
                title={showAllInline ? "Ver top 3 técnicos" : `Ver todos los técnicos (${data.length})`}
                aria-label="Alternar vista de técnicos"
              >
                {showAllInline ? (
                  <Flame className="w-3.5 h-3.5 stroke-[1.75]" />
                ) : (
                  <SlidersHorizontal className="w-3.5 h-3.5 stroke-[1.75]" />
                )}
              </button>

              {/* Modal Expand Button */}
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="min-w-[36px] min-h-[36px] p-2 flex items-center justify-center text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
                title={`Explorar todos los técnicos (${data.length})`}
                aria-label="Abrir explorador de técnicos"
              >
                <Maximize2 className="w-3.5 h-3.5 stroke-[1.75]" />
              </button>

              {/* Quick Configuration Button */}
              {onOpenConfig && (
                <button
                  type="button"
                  onClick={onOpenConfig}
                  className="min-w-[36px] min-h-[36px] p-2 flex items-center justify-center text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
                  title="Configurar técnicos, cuadrillas y vinculación laboral"
                  aria-label="Configuración de técnicos"
                >
                  <Settings2 className="w-3.5 h-3.5 stroke-[1.75]" />
                </button>
              )}
            </div>
          </div>
          <p className="text-[11px] font-mono text-neutral-500 mb-4">{subtitle}</p>

          {!showAllInline ? (
            /* Ranking con Micro-Olas Glow (Top 5 Técnicos) */
            <div className="space-y-2">
              {performanceTechs.length === 0 ? (
                <div className="text-center py-4 text-neutral-400 text-xs font-mono">Sin registros</div>
              ) : (
                performanceTechs.map((tech, idx) => {
                  const isSelected = selectedTechnician === tech.name;
                  const isHovered = hoveredTechIndex === idx;
                  const lastPoint = tech.points[tech.points.length - 1] || { x: 74, y: 12 };

                  return (
                    <div
                      key={idx}
                      onClick={() => onSelectTechnician && onSelectTechnician(tech.name)}
                      onMouseEnter={() => setHoveredTechIndex(idx)}
                      onMouseLeave={() => setHoveredTechIndex(null)}
                      className={cn(
                        "flex items-center justify-between p-1.5 rounded cursor-pointer transition-colors relative group",
                        isHovered
                          ? "bg-neutral-100"
                          : isSelected
                          ? "bg-neutral-100 ring-1 ring-neutral-900"
                          : "hover:bg-neutral-50"
                      )}
                      title={`Técnico: ${formatProperCase(tech.name)} • ${formatNumber(tech.value)} inst. (${tech.pctOfTotal}%)`}
                    >
                      {/* Left: Rank & Normalized Name */}
                      <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                        <span className="w-4 h-4 rounded text-[9px] font-mono text-neutral-500 bg-neutral-100 flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div className="flex flex-col min-w-0">
                          <span className="text-neutral-900 font-medium text-xs truncate max-w-[130px]" title={tech.name}>
                            {formatProperCase(tech.name)}
                          </span>
                          <span className="text-[10px] font-mono text-neutral-400">
                            {formatNumber(tech.value)} inst.
                          </span>
                        </div>
                      </div>

                      {/* Center: Micro-Wave SVG Sparkline (Opción 3) */}
                      <div className="h-6 w-20 relative shrink-0">
                        <svg
                          className="w-full h-full overflow-visible"
                          preserveAspectRatio="none"
                          viewBox="0 0 80 24"
                        >
                          <defs>
                            <linearGradient id={`techGrad-${idx}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={tech.themeColor} stopOpacity={0.42} />
                              <stop offset="65%" stopColor={tech.themeColor} stopOpacity={0.15} />
                              <stop offset="100%" stopColor={tech.themeColor} stopOpacity={0.0} />
                            </linearGradient>

                            <filter
                              id={`techGlow-${idx}`}
                              x="-10%"
                              y="-20%"
                              width="120%"
                              height="140%"
                            >
                              <feGaussianBlur stdDeviation="1.2" result="blur" />
                              <feComposite in="SourceGraphic" in2="blur" operator="over" />
                            </filter>
                          </defs>

                          {/* Gradient Fill */}
                          <path d={tech.area} fill={`url(#techGrad-${idx})`} className="transition-all duration-300" />

                          {/* Glowing Smooth Line */}
                          <path
                            d={tech.path}
                            fill="none"
                            stroke={tech.themeColor}
                            strokeLinecap="round"
                            strokeWidth="1.5"
                            filter={`url(#techGlow-${idx})`}
                            className="transition-all duration-300"
                          />

                          {/* Terminal Endpoint */}
                          <circle
                            cx={lastPoint.x}
                            cy={lastPoint.y}
                            fill={tech.themeColor}
                            stroke="#FFFFFF"
                            strokeWidth="1.5"
                            r="2"
                            className="transition-all duration-200"
                          />
                        </svg>
                      </div>

                      {/* Right: Percentage */}
                      <span
                        className={cn(
                          "font-mono text-xs font-bold w-9 text-right shrink-0 ml-1.5",
                          tech.isPositive ? "text-emerald-600" : "text-orange-600"
                        )}
                      >
                        {tech.pctOfTotal}%
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            /* All Technicians Scrollable List */
            <div className="max-h-[220px] overflow-y-auto pr-1 space-y-1.5 text-xs font-mono">
              {data.map((tech, idx) => {
                const pct = total > 0 ? ((tech.value / total) * 100).toFixed(1) : "0.0";
                const isSelected = selectedTechnician === tech.name;

                return (
                  <div
                    key={`${tech.name}-${idx}`}
                    onClick={() => onSelectTechnician && onSelectTechnician(tech.name)}
                    className={cn(
                      "flex items-center justify-between p-1.5 rounded cursor-pointer transition-colors",
                      idx < data.length - 1 && "border-b border-neutral-100/70",
                      isSelected
                        ? "bg-neutral-100 text-neutral-900 ring-1 ring-neutral-900 font-semibold"
                        : "hover:bg-neutral-50 text-neutral-700"
                    )}
                    title={`Filtrar por técnico: ${tech.name}`}
                  >
                    <span className="flex items-center gap-2 min-w-0 flex-1 pr-2 truncate">
                      <span className="w-4 h-4 rounded text-[9px] font-mono text-neutral-500 bg-neutral-100 flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="truncate">{formatProperCase(tech.name)}</span>
                    </span>
                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="text-[10px] text-neutral-400">{formatNumber(tech.value)}</span>
                      <span className="text-neutral-900 font-bold w-10 text-right">{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-neutral-100 text-[11px] font-mono text-neutral-500 mt-4 flex justify-between items-center">
          <span>{formatNumber(total)} instalaciones</span>
          <span className="text-neutral-900 font-medium font-mono">
            Prom: {data.length > 0 ? (total / data.length).toFixed(1) : 0} / técnico
          </span>
        </div>
      </div>

      {/* Full Dimension Explorer Modal */}
      <DimensionExplorerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Directorio Integral de Técnicos de Campo"
        subtitle="Rendimiento de resoluciones y volumen de tickets atendidos"
        dimensionName="tecnicos"
        items={data.map((t) => ({
          name: t.name,
          value: t.value,
          badge: t.equipo,
          badgeVariant: "equipo",
        }))}
        selectedItem={selectedTechnician}
        onSelectItem={onSelectTechnician}
      />
    </>
  );
}
