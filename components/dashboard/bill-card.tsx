import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface BillCardProps {
    icon: LucideIcon;
    label: string;
    amount: string;
    lastMonthAmount?: string; // Optional, maybe we just show "Last Month" text
    active?: boolean;
    color?: string; // For the icon background/glow
}

export function BillCard({ icon: Icon, label, amount, active, color = "bg-zinc-800" }: BillCardProps) {
    return (
        <div className={cn(
            "relative p-4 rounded-3xl flex flex-col justify-between h-[180px] transition-all duration-300 overflow-hidden group cursor-pointer border-0",
            active ? "bg-[#2d2d2d]" : "bg-[#1f1f1f] hover:bg-[#252525]"
        )}>
            {/* Top Row: Icon and Menu Dots */}
            <div className="flex justify-between items-start mb-4">
                <div className={cn("p-3 rounded-full text-white", active ? "bg-white/10" : "bg-zinc-800")}>
                    <Icon className="w-5 h-5" />
                </div>
                <div className="flex gap-1">
                    <div className="w-1 h-1 rounded-full bg-zinc-500"></div>
                    <div className="w-1 h-1 rounded-full bg-zinc-500"></div>
                </div>
            </div>

            {/* Content */}
            <div className="space-y-1">
                <p className="text-zinc-400 text-sm font-medium">{label}</p>
                <h3 className="text-2xl font-bold text-white">${amount}</h3>
                <p className="text-xs text-zinc-500">Mes Pasado</p>
            </div>

            {/* Glow effect for active state if needed */}
            {active && (
                <div className="absolute -bottom-10 -right-10 w-24 h-24 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>
            )}
        </div>
    );
}
