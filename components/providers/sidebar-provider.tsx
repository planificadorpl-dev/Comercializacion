"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { PanelLeftOpen, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

type SidebarContextType = {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  openMobileSidebar: () => void;
  closeMobileSidebar: () => void;
};

const SidebarContext = createContext<SidebarContextType>({
  isCollapsed: false,
  setIsCollapsed: () => {},
  toggleSidebar: () => {},
  isMobileOpen: false,
  setIsMobileOpen: () => {},
  openMobileSidebar: () => {},
  closeMobileSidebar: () => {},
});

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("sidebar_collapsed");
      if (stored !== null) {
        setIsCollapsed(stored === "true");
      } else {
        setIsCollapsed(true);
      }
    } catch {}
  }, []);

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("sidebar_collapsed", String(next));
      } catch {}
      return next;
    });
  };

  const handleSetCollapsed = (val: boolean) => {
    setIsCollapsed(val);
    try {
      localStorage.setItem("sidebar_collapsed", String(val));
    } catch {}
  };

  return (
    <SidebarContext.Provider
      value={{
        isCollapsed,
        setIsCollapsed: handleSetCollapsed,
        toggleSidebar,
        isMobileOpen,
        setIsMobileOpen,
        openMobileSidebar: () => setIsMobileOpen(true),
        closeMobileSidebar: () => setIsMobileOpen(false),
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}

export function SidebarOpenButton({ className }: { className?: string }) {
  const { isCollapsed, toggleSidebar } = useSidebar();
  if (!isCollapsed) return null;

  return (
    <button
      type="button"
      onClick={toggleSidebar}
      className={cn(
        "hidden xl:flex items-center justify-center text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer p-1 shrink-0",
        className
      )}
      title="Abrir panel lateral"
      aria-label="Abrir panel lateral"
    >
      <PanelLeftOpen className="w-4 h-4 stroke-[1.5]" />
    </button>
  );
}

export function SidebarMobileButton({ className }: { className?: string }) {
  const { openMobileSidebar } = useSidebar();

  return (
    <button
      type="button"
      onClick={openMobileSidebar}
      className={cn(
        "xl:hidden -ml-2 min-w-[44px] min-h-[44px] p-2.5 text-neutral-400 hover:text-neutral-900 transition-colors flex items-center justify-center cursor-pointer shrink-0",
        className
      )}
      title="Abrir menú de navegación"
      aria-label="Abrir menú de navegación"
    >
      <Menu className="w-4 h-4 stroke-[1.75]" />
    </button>
  );
}
