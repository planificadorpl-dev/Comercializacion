"use client";

import { BackgroundPaths } from "@/components/ui/background-paths";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";

interface PremiumPageLayoutProps {
    children: React.ReactNode;
    title?: string;
    description?: string;
    showBack?: boolean;
    backUrl?: string;
    backLabel?: string;
}

export function PremiumPageLayout({
    children,
    title,
    description,
    showBack = true,
    backUrl = "back",
    backLabel = "Volver",
}: PremiumPageLayoutProps) {
    const router = useRouter();

    return (
        <div className="relative min-h-screen w-full overflow-y-auto bg-background selection:bg-primary/20">

            {/* Sticky top navigation bar */}
            <div className="sticky top-0 z-50 flex items-center justify-between px-4 h-14 bg-background/80 backdrop-blur-md border-b border-border/40">
                <div className="flex items-center">
                    <SidebarTrigger className="mr-2" />
                    {showBack && (
                        <Button
                            variant="ghost"
                            onClick={() => {
                                if (backUrl === "back") {
                                    router.back();
                                } else {
                                    router.push(backUrl);
                                }
                            }}
                            className="flex items-center gap-2 h-9 px-3 rounded-full hover:bg-muted transition-colors text-sm font-medium text-muted-foreground hover:text-foreground"
                            aria-label={backLabel}
                        >
                            <ArrowLeft className="h-4 w-4" />
                            <span className="hidden sm:inline">{backLabel}</span>
                        </Button>
                    )}
                </div>

                <ModeToggle />
            </div>

            <div className="relative z-40 mx-auto max-w-7xl px-4 py-8 md:py-12 lg:py-16">
                {(title || description) && (
                    <div className="mb-8 md:mb-12">
                        {title && (
                            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
                                {title}
                            </h1>
                        )}
                        {description && (
                            <p className="mt-4 text-muted-foreground md:text-lg">
                                {description}
                            </p>
                        )}
                    </div>
                )}

                {children}
            </div>

            <div className="fixed inset-0 z-0 pointer-events-none">
                <BackgroundPaths />
            </div>
        </div>
    );
}
