"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Map as MapIcon, ChevronLeft, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export function DashboardNav() {
    const pathname = usePathname();
    const router = useRouter();

    return (
        <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/60 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-14 max-w-screen-2xl items-center gap-1">

                {/* Back Button */}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.back()}
                    className="text-muted-foreground hover:text-foreground"
                    title="Atrás"
                >
                    <ChevronLeft className="h-5 w-5" />
                    <span className="sr-only">Atrás</span>
                </Button>

                {/* Vertical Separator */}
                <div className="h-4 w-px bg-border/50 mx-1" />

                {/* Home / Dashboard Link */}
                <Link href="/">
                    <Button
                        variant={pathname === "/" ? "secondary" : "ghost"}
                        size="icon"
                        className={cn(
                            "rounded-full transition-colors",
                            pathname === "/" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                        )}
                        title="Dashboard Principal"
                    >
                        <Home className="h-5 w-5" />
                        <span className="sr-only">Dashboard</span>
                    </Button>
                </Link>

                {/* Map Link */}
                <Link href="/map">
                    <Button
                        variant={pathname === "/map" ? "secondary" : "ghost"}
                        size="icon"
                        className={cn(
                            "rounded-full transition-colors",
                            pathname === "/map" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                        )}
                        title="Mapa de Red"
                    >
                        <MapIcon className="h-5 w-5" />
                        <span className="sr-only">Mapa</span>
                    </Button>
                </Link>

                {/* Right Side Actions */}
                <div className="ml-auto flex items-center gap-2">
                    <ThemeToggle />
                </div>
            </div>
        </header>
    );
}
