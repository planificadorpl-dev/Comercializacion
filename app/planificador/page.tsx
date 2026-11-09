"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Sidebar } from "@/components/dashboard/sidebar";
import {
  SidebarOpenButton,
  SidebarMobileButton,
} from "@/components/providers/sidebar-provider";
import { PlanificadorHeader } from "@/components/planificador/planificador-header";
import { PlanificadorDailySheet } from "@/components/planificador/planificador-daily-sheet";
import {
  PlanningSheetRecord,
  PlanningMetadata,
  SPANISH_MONTHS,
} from "@/lib/planificacion-types";
import { clearDashboardDataCache } from "@/lib/dashboard-data";
import { Loader2 } from "lucide-react";

export default function PlanificadorPage() {
  // Default month: Current month in uppercase Spanish
  const currentMonthInitial = useMemo(() => {
    const m = new Date().getMonth();
    return SPANISH_MONTHS[m] || "NOVIEMBRE";
  }, []);

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthInitial);
  const [metadata, setMetadata] = useState<PlanningMetadata | null>(null);
  const [records, setRecords] = useState<PlanningSheetRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Subtle toast indicator
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 3500);
  }, []);

  // Fetch planning data from backend
  const loadPlanningData = useCallback(async (force = false) => {
    try {
      if (force) {
        setIsRefreshing(true);
        clearDashboardDataCache();
      }
      const refreshParam = force ? "?refresh=true" : "";
      const res = await fetch(`/api/planificacion${refreshParam}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });

      const json = await res.json();
      if (json.success) {
        if (json.metadata) setMetadata(json.metadata);
        if (Array.isArray(json.records)) setRecords(json.records);
      } else {
        showToast(json.error || "No se pudo cargar la planificación.");
      }
    } catch (err: any) {
      console.error("Error al obtener datos del planificador:", err);
      showToast("Error de conexión al cargar la planificación.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadPlanningData();
  }, [loadPlanningData]);

  // Handle successful creation or update of records
  const handleSuccess = (count: number) => {
    showToast(
      `${count} ${count === 1 ? "jornada sincronizada" : "jornadas sincronizadas"} con la hoja Data.`
    );
    loadPlanningData(true);
  };

  return (
    <div className="flex min-h-screen h-[100dvh] bg-[#FBFBFB] text-neutral-900 font-sans antialiased overflow-hidden selection:bg-neutral-900 selection:text-white">
      {/* Sidebar with activeSection planificador */}
      <Sidebar activeSection="planificador" />

      {/* Main scrollable canvas */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto overscroll-y-contain">
        {/* Sticky subtle top bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between px-4 sm:px-6 py-3 bg-[#FBFBFB]/90 backdrop-blur-xs border-b border-neutral-100">
          <div className="flex items-center gap-2 sm:gap-3">
            <SidebarMobileButton />
            <SidebarOpenButton />
            <span className="text-xs font-semibold text-neutral-900 hidden xs:inline">
              Supervisión Comercial
            </span>
            <span className="text-neutral-300 hidden xs:inline">/</span>
            <span className="text-xs text-neutral-500 truncate">Planificador de Asesores</span>
          </div>

          <div className="flex items-center gap-3">
            {toastMessage && (
              <span className="text-xs text-neutral-600 font-medium animate-in fade-in duration-150">
                {toastMessage}
              </span>
            )}
          </div>
        </header>

        {/* Content area */}
        <main className="p-4 sm:p-6 md:p-8 pb-36 sm:pb-40 md:pb-48 xl:pb-12 max-w-7xl w-full mx-auto space-y-6">
          {/* Header */}
          <PlanificadorHeader
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
            onRefresh={() => loadPlanningData(true)}
            isRefreshing={isRefreshing}
            totalRecordsCount={records.length}
          />

          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-2 text-neutral-400">
              <Loader2 className="w-5 h-5 animate-spin stroke-[1.25]" />
              <span className="text-xs font-mono">
                Cargando asesores y registros de la hoja Data...
              </span>
            </div>
          ) : metadata ? (
            <PlanificadorDailySheet
              metadata={metadata}
              existingRecords={records}
              onSuccess={handleSuccess}
              defaultMonth={selectedMonth}
            />
          ) : (
            <div className="py-12 text-center text-xs text-neutral-400">
              No se pudo inicializar la conexión con Google Sheets.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
