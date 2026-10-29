"use client";

import * as React from "react";
import { Star } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { cn } from "@/lib/utils";

export interface PointsChartDataPoint {
  date: string;
  total: number;
  change: number;
}

export interface PointsChartLevel {
  value: number;
  color: string;
}

export interface PointsChartProps extends React.HTMLAttributes<HTMLDivElement> {
  data: PointsChartDataPoint[];
  height?: number;
  title?: string;
  headerRight?: React.ReactNode;
  yAxisLabel?: string;
  levels?: PointsChartLevel[];
}

function formatValue(value: number) {
  return Math.round(value).toLocaleString();
}

export function LevelReferenceStarLabel({
  viewBox,
  color = "#737373",
}: {
  viewBox?: { x?: number; y?: number } | null;
  color?: string;
}) {
  const x = viewBox?.x;
  const y = viewBox?.y;

  if (typeof x !== "number" || typeof y !== "number") {
    return null;
  }

  return (
    <g transform={`translate(${Math.max(6, x)},${y})`}>
      <Star
        x={-4.5}
        y={-4.5}
        width={9}
        height={9}
        fill={color}
        stroke={color}
        strokeWidth={1.5}
      />
    </g>
  );
}

export function PointsChart({
  data,
  height = 260,
  title = "Your points",
  headerRight,
  yAxisLabel,
  levels,
  className,
  ...props
}: PointsChartProps) {
  const yDomain = React.useMemo<[number, number]>(() => {
    const values = [
      ...data.map((item) => item.total),
      ...(levels?.map((level) => level.value) ?? []),
    ];

    if (values.length === 0) return [0, 100];

    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = maxValue - minValue;

    if (range === 0) {
      const padding = Math.max(maxValue * 0.15, 10);
      return [Math.max(0, minValue - padding), maxValue + padding];
    }

    const padding = Math.max(range * 0.12, 10);
    return [Math.max(0, minValue - padding), maxValue + padding];
  }, [data, levels]);

  return (
    <div className={cn("bg-card rounded-2xl border p-4", className)} {...props}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-md text-foreground font-semibold">{title}</p>
        {headerRight ? <div className="shrink-0">{headerRight}</div> : null}
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 12, right: 12, left: 0, bottom: 4 }}
          >
            <CartesianGrid stroke="#e5e5e5" strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#737373", fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              domain={yDomain}
              tick={{ fill: "#737373", fontSize: 11 }}
              tickFormatter={formatValue}
              width={48}
              label={
                yAxisLabel
                  ? {
                      value: yAxisLabel,
                      angle: -90,
                      position: "insideLeft",
                      fill: "#737373",
                      fontSize: 11,
                      dx: -14,
                    }
                  : undefined
              }
            />
            {levels?.map((level) => (
              <ReferenceLine
                key={level.value}
                y={level.value}
                stroke={level.color}
                strokeDasharray="6 6"
                strokeWidth={1.5}
                label={{
                  position: "left",
                  content: (labelProps: { viewBox?: unknown }) => (
                    <LevelReferenceStarLabel
                      viewBox={
                        (labelProps.viewBox as {
                          x?: number;
                          y?: number;
                        } | null) ?? null
                      }
                      color={level.color}
                    />
                  ),
                }}
              />
            ))}
            <Tooltip
              cursor={{ stroke: "#171717", strokeDasharray: "4 4" }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as PointsChartDataPoint;
                const changePrefix = row.change > 0 ? "+" : "";
                return (
                  <div className="bg-white text-neutral-900 rounded-lg border border-neutral-200 px-3 py-2 text-xs shadow-md font-mono">
                    <p className="text-neutral-500 mb-1">{label}</p>
                    <p className="font-semibold tabular-nums text-neutral-900">
                      Total {formatValue(row.total)}
                    </p>
                    <p className="text-neutral-500 text-[10px] tabular-nums">
                      {changePrefix}
                      {formatValue(row.change)}
                    </p>
                  </div>
                );
              }}
            />
            <Line
              type="monotone"
              dataKey="total"
              stroke="#171717"
              strokeWidth={2}
              connectNulls
              dot={{ r: 3, fill: "#171717" }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
