"use client";

import { useState } from "react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { SidebarOpenButton } from "@/components/providers/sidebar-provider";
import { useUser } from "@/components/providers/user-provider";
import { useModules } from "@/components/providers/modules-provider";

export default function PlanificacionPage() {
  const { user } = useUser();
  const { isModuleEnabledForUser } = useModules();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-[#FBFBFB] text-neutral-900 font-sans antialiased overflow-hidden selection:bg-neutral-900 selection:text-white">
      {/* Barra lateral de navegación */}
      <Sidebar
        collapsed={false}
        onToggleCollapse={() => {}}
        activeItem="planificacion"
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />

      {/* Contenedor principal */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Cabecera minimalista abierta */}
        <header className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 bg-[#FBFBFB]/90 backdrop-blur-xs border-b border-neutral-100/80">
          <div className="flex items-center gap-3">
            <SidebarOpenButton onClick={() => setMobileSidebarOpen(true)} />
            <div>
              <h1 className="text-base font-semibold text-neutral-900 tracking-tight">
                Planificación Comercial
              </h1>
              <p className="text-xs text-neutral-400 font-mono">
                Panel listo para nuevas modificaciones
              </p>
            </div>
          </div>
        </header>

        {/* Lienzo abierto despejado (sin recuadros ni tarjetas) */}
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
          <div className="py-20 text-center space-y-2">
            <p className="text-xs text-neutral-400 font-mono">
              El panel de planificación comercial se ha despejado para tus modificaciones.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
