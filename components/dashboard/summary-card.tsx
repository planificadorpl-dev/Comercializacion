import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface SummaryItem {
    name: string;
    value: number;
}

interface SummaryCardProps {
    title: string;
    data: SummaryItem[];
    className?: string;
    action?: React.ReactNode;
    icon?: LucideIcon;
}

export function SummaryCard({ title, data, className, action, icon: Icon }: SummaryCardProps) {
    const total = data.reduce((acc, curr) => acc + curr.value, 0);
    const max = data.length > 0 ? Math.max(...data.map(d => d.value)) : 1;

    return (
        <div className={cn("flex flex-col h-full rounded-2xl border border-white/[0.07] bg-[#13151B] overflow-hidden", className)}>
            {/* Header */}
            <div className="px-5 py-4 border-b border-white/[0.06] flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                    {Icon && (
                        <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-zinc-300">
                            <Icon className="w-3.5 h-3.5" />
                        </div>
                    )}
                    <h3 className="text-sm font-semibold tracking-tight text-white truncate">{title}</h3>
                    {total > 0 && (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-white/[0.06] text-zinc-300 shrink-0 font-mono">
                            {total}
                        </span>
                    )}
                </div>
                <div className="shrink-0">{action}</div>
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 custom-scrollbar">
                {data.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-zinc-500 text-xs italic py-8">
                        Sin datos disponibles
                    </div>
                ) : (
                    data.map((item, idx) => {
                        const pct = max > 0 ? (item.value / max) * 100 : 0;
                        return (
                            <div 
                                key={idx} 
                                className="group flex flex-col p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] transition-all relative overflow-hidden border border-white/[0.04]"
                            >
                                <div className="flex justify-between items-center z-10 text-xs">
                                    <span className="font-medium text-zinc-200 truncate max-w-[75%]" title={item.name}>
                                        <span className="text-zinc-500 mr-2 text-[11px] font-mono">#{idx + 1}</span>
                                        {item.name}
                                    </span>
                                    <span className="font-semibold text-white font-mono tracking-tight shrink-0">
                                        {item.value.toLocaleString()}
                                    </span>
                                </div>
                                {/* Subtle progress indicator background */}
                                <div 
                                    className="absolute left-0 bottom-0 top-0 bg-[#F97316]/10 rounded-xl pointer-events-none transition-all duration-300 group-hover:bg-[#F97316]/15"
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
