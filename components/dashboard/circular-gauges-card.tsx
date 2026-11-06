"use client";

import { LucideIcon, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

interface CircularGaugesCardProps {
    title: string;
    data: { name: string; value: number }[];
    totalCount?: number;
    icon?: LucideIcon;
    className?: string;
}

export function CircularGaugesCard({ title, data, totalCount, icon: Icon, className }: CircularGaugesCardProps) {
    const total = totalCount || data.reduce((acc, curr) => acc + curr.value, 0) || 1;

    // Take top 4 items
    const top4 = data.slice(0, 4).map(item => ({
        name: item.name,
        value: item.value,
        percentage: Math.min(100, Math.round((item.value / total) * 100))
    }));

    // Colors matching the reference design: green tones
    const ringColors = [
        { stroke: "#10B981", bg: "rgba(16, 185, 129, 0.08)" },
        { stroke: "#34D399", bg: "rgba(52, 211, 153, 0.08)" },
        { stroke: "#6EE7B7", bg: "rgba(110, 231, 183, 0.08)" },
        { stroke: "#A7F3D0", bg: "rgba(167, 243, 208, 0.08)" },
    ];

    return (
        <div className={cn("glass-card p-5 flex flex-col h-full", className)}>
            {/* Header */}
            <div className="flex items-center justify-between pb-4 shrink-0">
                <div>
                    <h3 className="text-sm font-semibold text-white tracking-tight">{title}</h3>
                    <p className="text-[11px] text-[#6B7280] mt-0.5">Distribución por zona</p>
                </div>
                <button className="p-1 text-[#6B7280] hover:text-white transition-colors">
                    <MoreHorizontal className="w-4 h-4" />
                </button>
            </div>

            {/* 2x2 Grid of Circular Gauges - matching reference style */}
            <div className="grid grid-cols-2 gap-5 flex-1 items-center justify-items-center py-2">
                {top4.length === 0 ? (
                    <div className="col-span-2 text-center text-xs text-[#6B7280] py-6">
                        Sin datos disponibles
                    </div>
                ) : (
                    top4.map((item, idx) => {
                        const radius = 32;
                        const strokeWidth = 5;
                        const circumference = 2 * Math.PI * radius;
                        const strokeDashoffset = circumference - (item.percentage / 100) * circumference;
                        const color = ringColors[idx % ringColors.length];

                        return (
                            <div key={idx} className="flex flex-col items-center group">
                                <div className="relative w-20 h-20 flex items-center justify-center">
                                    <svg className="w-20 h-20 -rotate-90 transform" viewBox="0 0 80 80">
                                        {/* Background Track */}
                                        <circle
                                            cx="40"
                                            cy="40"
                                            r={radius}
                                            stroke="rgba(255, 255, 255, 0.05)"
                                            strokeWidth={strokeWidth}
                                            fill="transparent"
                                        />
                                        {/* Progress Ring */}
                                        <circle
                                            cx="40"
                                            cy="40"
                                            r={radius}
                                            stroke={color.stroke}
                                            strokeWidth={strokeWidth}
                                            strokeDasharray={circumference}
                                            strokeDashoffset={strokeDashoffset}
                                            strokeLinecap="round"
                                            fill="transparent"
                                            className="transition-all duration-700 ease-out"
                                            style={{
                                                filter: `drop-shadow(0 0 4px ${color.stroke}40)`
                                            }}
                                        />
                                    </svg>
                                    {/* Percentage in center */}
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-base font-bold text-white tracking-tight">
                                            {item.percentage}%
                                        </span>
                                    </div>
                                </div>
                                {/* Label + dot underneath */}
                                <div className="flex items-center gap-1.5 mt-2">
                                    <span
                                        className="w-1.5 h-1.5 rounded-full"
                                        style={{ backgroundColor: color.stroke }}
                                    />
                                    <span
                                        className="text-[11px] text-[#6B7280] text-center max-w-[90px] truncate"
                                        title={item.name}
                                    >
                                        {item.name}
                                    </span>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
