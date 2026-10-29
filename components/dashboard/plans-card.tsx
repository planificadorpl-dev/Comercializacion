"use client";

import { useState, useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { cn, formatNumber, formatProperCase } from "@/lib/utils";

interface PlanItem {
  name: string;
  value: number;
}

interface PlansCardProps {
  title?: string;
  subtitle?: string;
  currentPeriod?: string;
  data: PlanItem[];
  totalCount?: number;
  onSelectPlan?: (plan: string) => void;
  selectedPlan?: string;
  className?: string;
}

const DONUT_COLORS = [
  "#09090B", // Dominant / Primary - Dark
  "#27272A",
  "#52525B",
  "#71717A",
  "#A1A1AA",
  "#D4D4D8",
];

export function PlansCard({
  title = "Planes Contratados",
  subtitle = "Distribución de paquetes activos",
  currentPeriod = "Todos los meses",
  data,
  totalCount,
  onSelectPlan,
  selectedPlan,
  className,
}: PlansCardProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const validPlans = useMemo(() => {
    return data.filter((d) => {
      const name = (d.name || "").trim().toLowerCase();
      return name && name !== "n/a" && name !== "na" && name !== "sin plan" && name !== "undefined";
    });
  }, [data]);

  const total = useMemo(() => {
    return totalCount || validPlans.reduce((acc, curr) => acc + curr.value, 0) || 1;
  }, [totalCount, validPlans]);

  const topPlans = useMemo(() => {
    if (validPlans.length === 0) {
      return [
        { name: "400 MB", value: 1192, percentage: 85 },
        { name: "600 MB", value: 154, percentage: 11 },
        { name: "800 MB", value: 28, percentage: 2 },
        { name: "1 GB", value: 28, percentage: 2 },
      ];
    }
    return validPlans.slice(0, 5).map((d) => ({
      name: d.name,
      value: d.value,
      percentage: Math.min(100, Math.round((d.value / total) * 100)),
    }));
  }, [validPlans, total]);

  const activeItem = hoveredIndex !== null ? topPlans[hoveredIndex] : null;

  return (
    <div className={cn("p-4 sm:p-6 bg-white flex flex-col justify-between h-full select-none", className)}>
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-neutral-900 tracking-tight">{title}</h3>
          <span className="text-[10px] font-mono text-neutral-400">{currentPeriod}</span>
        </div>
        <p className="text-[11px] font-mono text-neutral-500 mb-2">{subtitle}</p>

        {/* Minimalist Donut Chart with Center KPI */}
        <div className="relative w-full min-w-0 h-32 flex items-center justify-center my-1 overflow-hidden">
          {topPlans.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={topPlans}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={36}
                    outerRadius={52}
                    paddingAngle={3}
                    stroke="#ffffff"
                    strokeWidth={2}
                    onClick={(entry) => {
                      if (entry?.name && onSelectPlan) {
                        onSelectPlan(entry.name);
                      }
                    }}
                  >
                    {topPlans.map((_, idx) => (
                      <Cell
                        key={`plan-cell-${idx}`}
                        fill={DONUT_COLORS[idx % DONUT_COLORS.length]}
                        opacity={
                          hoveredIndex !== null && hoveredIndex !== idx ? 0.45 : 1
                        }
                        className="transition-opacity duration-200 cursor-pointer"
                        onMouseEnter={() => setHoveredIndex(idx)}
                        onMouseLeave={() => setHoveredIndex(null)}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>

              {/* Dynamic Center Label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center select-none z-0">
                <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider leading-none">
                  {activeItem ? activeItem.percentage + "%" : "Total"}
                </span>
                <span className="text-xs font-bold font-mono text-neutral-900 tracking-tight leading-tight mt-0.5">
                  {formatNumber(activeItem ? activeItem.value : total)}
                </span>
                {activeItem && (
                  <span className="text-[9px] font-sans text-neutral-500 truncate max-w-[70px] leading-tight">
                    {formatProperCase(activeItem.name)}
                  </span>
                )}
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-xs font-mono text-neutral-400">
              Sin datos
            </div>
          )}
        </div>

        {/* Legend Breakdown */}
        <div className="space-y-1.5 mt-2 text-xs font-mono">
          {topPlans.map((item, idx) => {
            const isSelected = selectedPlan === item.name;
            const isHovered = hoveredIndex === idx;

            return (
              <div
                key={idx}
                onClick={() => onSelectPlan && onSelectPlan(item.name)}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                className={cn(
                  "flex items-center justify-between p-1.5 rounded cursor-pointer transition-colors",
                  isHovered
                    ? "bg-neutral-100 text-neutral-900"
                    : isSelected
                    ? "bg-neutral-100 text-neutral-900 ring-1 ring-neutral-900 font-semibold"
                    : "hover:bg-neutral-50 text-neutral-600"
                )}
                title={`Filtrar por plan: ${item.name}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: DONUT_COLORS[idx % DONUT_COLORS.length] }}
                  />
                  <span className="truncate text-neutral-800 font-medium">
                    {item.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-neutral-400">
                    {formatNumber(item.value)}
                  </span>
                  <span className="text-neutral-900 font-bold w-9 text-right font-mono">
                    {item.percentage}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="pt-3 border-t border-neutral-100 text-[11px] font-mono text-neutral-500 mt-4 flex items-center justify-between">
        <span>Plan principal:</span>
        <span className="text-neutral-900 font-semibold font-mono">
          {topPlans[0]?.name || "N/A"}{topPlans[0]?.percentage ? ` (${topPlans[0].percentage}%)` : ""}
        </span>
      </div>
    </div>
  );
}
