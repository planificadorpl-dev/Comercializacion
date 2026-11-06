"use client";

import { LucideIcon, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChannelItem {
    name: string;
    value: number;
}

interface TopChannelsCardProps {
    title: string;
    data: ChannelItem[];
    subtitle?: string;
    icon?: LucideIcon;
    action?: React.ReactNode;
    className?: string;
}

export function TopChannelsCard({ title, data, subtitle, icon: Icon, action, className }: TopChannelsCardProps) {
    const max = data.length > 0 ? Math.max(...data.map(d => d.value)) : 1;
    const total = data.reduce((sum, d) => sum + d.value, 0);
    const topItem = data.length > 0 ? data[0] : null;
    const topPct = topItem && total > 0 ? ((topItem.value / total) * 100).toFixed(1) : "0";

    return (
        <div className={cn("glass-card p-5 flex flex-col h-full", className)}>
            {/* Header */}
            <div className="flex items-center justify-between pb-4 shrink-0">
                <div>
                    <h3 className="text-sm font-semibold text-white tracking-tight">{title}</h3>
                    <p className="text-[11px] text-[#6B7280] mt-0.5">{subtitle || "Ranking por cantidad"}</p>
                </div>
                <button className="p-1 text-[#6B7280] hover:text-white transition-colors">
                    <MoreHorizontal className="w-4 h-4" />
                </button>
            </div>

            {/* List with progress bars - matching reference style */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                {data.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-[#6B7280] text-xs italic py-6">
                        Sin datos disponibles
                    </div>
                ) : (
                    data.map((item, idx) => {
                        const pct = max > 0 ? (item.value / max) * 100 : 0;
                        return (
                            <div key={idx} className="flex flex-col gap-2 group">
                                <div className="flex justify-between items-center text-xs">
                                    <div className="flex items-center gap-2 min-w-0">
                                        {Icon && (
                                            <div className="w-6 h-6 rounded-md bg-white/[0.04] flex items-center justify-center shrink-0">
                                                <Icon className="w-3 h-3 text-[#6B7280]" />
                                            </div>
                                        )}
                                        <span className="font-medium text-[#D1D5DB] truncate" title={item.name}>
                                            {item.name}
                                        </span>
                                    </div>
                                    <span className="font-bold text-white font-mono tracking-tight shrink-0 ml-2">
                                        {item.value.toLocaleString()}
                                    </span>
                                </div>
                                {/* Green progress bar */}
                                <div className="h-1.5 w-full bg-white/[0.04] rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-500"
                                        style={{
                                            width: `${pct}%`,
                                            background: idx === 0
                                                ? "linear-gradient(90deg, #10B981, #34D399)"
                                                : "linear-gradient(90deg, #1F2937, #374151)"
                                        }}
                                    />
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Bottom footer */}
            {topItem && (
                <div className="pt-3 border-t border-white/[0.04] mt-2 text-[11px] text-[#6B7280]">
                    {topItem.name} lidera con {topPct}% del total
                </div>
            )}
        </div>
    );
}
