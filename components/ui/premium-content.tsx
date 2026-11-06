"use client";

import { cn } from "@/lib/utils";

interface PremiumContentProps {
    children: React.ReactNode;
    className?: string;
}

export function PremiumContent({ children, className }: PremiumContentProps) {
    return (
        <div className={cn(
            "relative flex flex-col overflow-hidden rounded-xl border-[0.75px] border-border bg-background/50 backdrop-blur-xl p-6 shadow-sm transition-all hover:bg-background/60",
            className
        )}>
            {children}
        </div>
    );
}
