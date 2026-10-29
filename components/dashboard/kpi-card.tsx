"use client";

import { useId, useMemo } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts";
import { cn, formatNumber } from "@/lib/utils";

export interface KPISparklineItem {
  label: string;
  value: number;
}

interface KPICardProps {
  label: string;
  value: string | number;
  subValue?: string;
  trend?: { value: string; isPositive?: boolean };
  badgeText?: string;
  isFirst?: boolean;
  className?: string;
  sparklineData?: (number | KPISparklineItem)[];
}

export function KPICard({
  label,
  value,
  subValue,
  trend,
  badgeText,
  isFirst = false,
  className,
  sparklineData,
}: KPICardProps) {
  const isPositive = trend?.isPositive ?? true;
  const rawId = useId();
  const safeId = useMemo(
    () => `kpi-${label.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${rawId.replace(/[^a-z0-9]/g, "")}`,
    [label, rawId]
  );

  const fillId = `${safeId}-fill`;
  const dotGlowId = `${safeId}-dot-glow`;
  const lineGlowId = `${safeId}-line-glow`;

  // Colors: Green for increase / Orange for decrease
  const color = isPositive ? "#10b981" : "#f97316";

  // Data formatted for Recharts natural Area curve matching chart2
  const chartData = useMemo(() => {
    if (sparklineData && sparklineData.length >= 3) {
      return sparklineData.map((item, idx) => {
        if (typeof item === "number") {
          return {
            step: `M${idx + 1}`,
            value: item,
          };
        }
        return {
          step: item.label,
          value: item.value,
        };
      });
    }
    // Organic fallback if real history not available
    if (isPositive) {
      return [
        { step: "Ene", value: 34 },
        { step: "Feb", value: 48 },
        { step: "Mar", value: 40 },
        { step: "Abr", value: 62 },
        { step: "May", value: 58 },
        { step: "Jun", value: 74 },
        { step: "Jul", value: 68 },
        { step: "Ago", value: 88 },
      ];
    } else {
      return [
        { step: "Ene", value: 88 },
        { step: "Feb", value: 72 },
        { step: "Mar", value: 76 },
        { step: "Abr", value: 58 },
        { step: "May", value: 52 },
        { step: "Jun", value: 55 },
        { step: "Jul", value: 42 },
        { step: "Ago", value: 30 },
      ];
    }
  }, [sparklineData, isPositive]);

  return (
    <div
      className={cn(
        "p-3 sm:p-4 flex flex-col justify-between bg-white transition-colors relative select-none overflow-hidden",
        className
      )}
    >
      {!isFirst && (
        <div className="hidden md:block absolute left-0 top-3 bottom-3 w-[1px] bg-gradient-to-b from-transparent via-neutral-300 to-transparent pointer-events-none z-20" />
      )}

      {/* Top Header: Label and Large Value */}
      <div className="relative z-10 pointer-events-none">
        <span className="text-[10px] sm:text-[11px] font-medium text-neutral-500 tracking-tight truncate block">
          {label}
        </span>
        <div className="mt-0.5">
          <span
            className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-neutral-900 block truncate"
            title={String(value)}
            suppressHydrationWarning
          >
            {value}
          </span>
        </div>
      </div>

      {/* Chart 2 Style Glowing Area Chart: Elevated to the height of the value with deeper gradient flow downwards */}
      <div className="h-11 sm:h-14 w-full min-w-0 overflow-hidden -mt-5 sm:-mt-6 mb-1 relative z-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 6, right: 6, bottom: 0, left: 6 }}
          >
            <defs>
              {/* Deeper Difuminado abajo (Gradient Fill) */}
              <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.42} />
                <stop offset="65%" stopColor={color} stopOpacity={0.16} />
                <stop offset="100%" stopColor={color} stopOpacity={0.0} />
              </linearGradient>

              {/* Glowing Dot Filter (chart2.txt) */}
              <filter
                id={dotGlowId}
                x="-50%"
                y="-50%"
                width="200%"
                height="200%"
              >
                <feGaussianBlur stdDeviation="2.5" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>

              {/* Glowing Line Filter (chart2.txt) */}
              <filter
                id={lineGlowId}
                x="-10%"
                y="-20%"
                width="120%"
                height="140%"
              >
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            <Tooltip
              cursor={false}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload;
                return (
                  <div className="bg-white/95 backdrop-blur-xs text-neutral-900 rounded-md border border-neutral-200/90 px-2 py-0.5 text-[10px] font-mono shadow-md z-50">
                    <span className="text-neutral-500 mr-1.5">{row.step}:</span>
                    <span className="font-semibold tabular-nums text-neutral-900">
                      {formatNumber(row.value)}
                    </span>
                  </div>
                );
              }}
            />

            {/* Glowing Natural Area from chart2.txt */}
            <Area
              dataKey="value"
              type="natural"
              fill={`url(#${fillId})`}
              stroke={color}
              strokeWidth={1.25}
              filter={`url(#${lineGlowId})`}
              dot={false}
              activeDot={{
                r: 3.5,
                strokeWidth: 1.5,
                stroke: "#ffffff",
                fill: color,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Trend text (arriba - comparación) & subValue (abajo - cuota del total) */}
      <div className="flex flex-col gap-0.5 text-xs font-sans relative z-10 mt-0.5 min-w-0">
        {trend && (
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={cn(
                "font-semibold text-[10px] sm:text-[11px] shrink-0",
                isPositive ? "text-emerald-600" : "text-orange-600"
              )}
            >
              {trend.value}
            </span>
          </div>
        )}
        {(subValue || badgeText) && (
          <span className="text-neutral-500 font-sans text-[10px] sm:text-[11px] truncate" title={subValue || badgeText}>
            {subValue || badgeText}
          </span>
        )}
      </div>
    </div>
  );
}
