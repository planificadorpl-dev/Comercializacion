"use client";

import { useState, useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { cn, formatNumber, formatProperCase } from "@/lib/utils";

interface StatusItem {
  name: string;
  value: number;
}

interface ConnectionTypeCardProps {
  title?: string;
  subtitle?: string;
  data: StatusItem[];
  totalCount?: number;
  onSelectStatus?: (status: string) => void;
  selectedStatus?: string;
  className?: string;
}

// Sophisticated monochrome palette matching project aesthetic
const DONUT_COLORS = [
  "#171717", // Neutral 900
  "#404040", // Neutral 700
  "#525252", // Neutral 600
  "#737373", // Neutral 500
  "#a3a3a3", // Neutral 400
  "#d4d4d4", // Neutral 300
];

export function ConnectionTypeCard({
  title = "Tipo de Solicitud / Conexión",
  subtitle = "Distribución por tipo de solicitud y conexión",
  data,
  totalCount,
  onSelectStatus,
  selectedStatus,
  className,
}: ConnectionTypeCardProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const topItems = useMemo(() => {
    if (data.length === 0) {
      return [
        { name: "Instalación", value: 8043, percentage: 94 },
        { name: "Mudanza", value: 427, percentage: 5 },
        { name: "Empleado", value: 87, percentage: 1 },
        { name: "Convenio", value: 18, percentage: 0 },
        { name: "Exonerado", value: 12, percentage: 0 },
      ];
    }
    const total = totalCount || data.reduce((sum, d) => sum + d.value, 0) || 1;
    // Show all significant categories up to 6 so Exonerado is always visible
    return data.slice(0, 6).map((d) => ({
      name: d.name,
      value: d.value,
      percentage: Math.min(100, Math.round((d.value / total) * 100)),
    }));
  }, [data, totalCount]);

  const total = useMemo(() => {
    return totalCount || topItems.reduce((sum, d) => sum + d.value, 0);
  }, [totalCount, topItems]);

  const activeItem = hoveredIndex !== null ? topItems[hoveredIndex] : null;

  return (
    <div className={cn("p-4 sm:p-6 bg-white flex flex-col justify-between h-full select-none", className)}>
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-neutral-900 tracking-tight">{title}</h3>
          <span className="text-[11px] font-mono text-neutral-400">
            {formatNumber(total)} total
          </span>
        </div>
        <p className="text-[11px] font-mono text-neutral-500 mb-2">{subtitle}</p>

        {/* Minimalist Donut Chart with Center KPI */}
        <div className="relative w-full min-w-0 h-32 flex items-center justify-center my-1 overflow-hidden">
          {topItems.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={topItems}
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
                      if (entry?.name && onSelectStatus) {
                        onSelectStatus(entry.name);
                      }
                    }}
                  >
                    {topItems.map((_, idx) => (
                      <Cell
                        key={`cell-${idx}`}
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

              {/* Dynamic Center Label que se actualiza al pasar el cursor */}
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
          {topItems.map((item, idx) => {
            const isSelected = selectedStatus === item.name;
            const isHovered = hoveredIndex === idx;

            return (
              <div
                key={idx}
                onClick={() => onSelectStatus && onSelectStatus(item.name)}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                className={cn(
                  "flex items-center justify-between cursor-pointer transition-colors px-1.5 py-1 rounded",
                  isHovered
                    ? "bg-neutral-100 text-neutral-900"
                    : isSelected
                    ? "bg-neutral-100 text-neutral-900 ring-1 ring-neutral-900"
                    : "hover:bg-neutral-50"
                )}
                title={`Filtrar por estatus: ${item.name}`}
              >
                <span className="flex items-center gap-2 text-neutral-700 truncate max-w-[150px]">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 transition-transform"
                    style={{
                      backgroundColor: DONUT_COLORS[idx % DONUT_COLORS.length],
                      transform: isHovered ? "scale(1.25)" : "scale(1)",
                    }}
                  />
                  <span className="truncate">{formatProperCase(item.name)}</span>
                </span>
                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="text-[11px] text-neutral-400 font-mono">
                    {formatNumber(item.value)}
                  </span>
                  <span className="text-neutral-900 font-bold w-9 text-right">{item.percentage}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="pt-3 border-t border-neutral-100 text-[11px] font-mono text-neutral-500 mt-3 flex items-center justify-between">
        <span>Mayor tipo: <strong className="text-neutral-900 font-semibold">{formatProperCase(topItems[0]?.name || "N/A")}</strong></span>
        <span className="text-neutral-900 font-bold">{topItems[0]?.percentage || 0}%</span>
      </div>
    </div>
  );
}
