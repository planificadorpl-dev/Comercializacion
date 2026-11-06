"use client";

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { cn } from "@/lib/utils";
import { MetricData } from "@/lib/dashboard-data";

interface DashboardChartProps {
    title: string;
    data: MetricData[];
    colors?: string[];
    className?: string;
}

const DEFAULT_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#6366f1"];

export function DashboardChart({ title, data, colors = DEFAULT_COLORS, className }: DashboardChartProps) {
    return (
        <div className={cn("bg-[#1f1f1f] p-6 rounded-3xl", className)}>
            <h3 className="text-lg font-medium text-white mb-6">{title}</h3>

            <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} barSize={20}>
                        <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: "#71717a", fontSize: 10 }}
                            interval={0}
                            dy={10}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: "#2d2d2d",
                                border: "none",
                                borderRadius: "8px",
                                color: "#fff",
                                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.5)"
                            }}
                            itemStyle={{ color: "#fff" }}
                            cursor={{ fill: "transparent" }}
                        />
                        <Bar dataKey="value" radius={[4, 4, 4, 4]}>
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Legend / Stats */}
            <div className="mt-4 flex flex-wrap gap-2 overflow-y-auto max-h-[100px] fancy-scrollbar">
                {data.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-zinc-400 bg-[#2d2d2d] px-2 py-1 rounded-lg">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors[i % colors.length] }}></div>
                        <span className="truncate max-w-[100px]" title={item.name}>{item.name}:</span>
                        <span className="font-bold text-white ml-auto">{item.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
