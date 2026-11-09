"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Sidebar } from "@/components/dashboard/sidebar";
import {
  SidebarOpenButton,
  SidebarMobileButton,
} from "@/components/providers/sidebar-provider";
import { PlanificadorHeader } from "@/components/planificador/planificador-header";
import { PlanificadorDailySheet } from "@/components/planificador/planificador-daily-sheet";
import { PlanificadorMatrixView } from "@/components/planificador/planificador-matrix-view";
import { PlanificadorEditDialog } from "@/components/planificador/planificador-edit-dialog";
import {
  PlanningSheetRecord,
  PlanningMetadata,
  NewPlanningItem,
  SPANISH_MONTHS,
  getMonthFromDate,
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
  const [activeView, setActiveView] = useState<"diaria" | "semanal">("diaria");
  const [initialDailyDate, setInitialDailyDate] = useState<string | undefined>(undefined);

  const [metadata, setMetadata] = useState<PlanningMetadata | null>(null);
  const [records, setRecords] = useState<PlanningSheetRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Edit dialog state for matrix view
  const [editingRecord, setEditingRecord] = useState<PlanningSheetRecord | null>(null);

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

  // Immediate optimistic delete in local memory (0 ms)
  const handleDeleteSuccess = useCallback((deletedRecord: PlanningSheetRecord) => {
    setRecords((prev) =>
      prev.filter((r) => {
        if (deletedRecord.id && r.id === deletedRecord.id) return false;
        if (
          deletedRecord.isoFecha &&
          deletedRecord.asesor &&
          r.isoFecha === deletedRecord.isoFecha &&
          r.asesor.trim().toLowerCase() === deletedRecord.asesor.trim().toLowerCase()
        ) {
          return false;
        }
        return true;
      })
    );
  }, []);

  // Matrix View: Edit record handler
  const handleEditRecord = (rec: PlanningSheetRecord) => {
    setEditingRecord(rec);
  };

  // Matrix View: Save edited record
  const handleSaveEditedRecord = async (
    sheetRowIndex: number,
    updatedItem: NewPlanningItem
  ): Promise<boolean> => {
    try {
      const res = await fetch("/api/planificacion", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetRowIndex, item: updatedItem }),
      });
      const json = await res.json();
      if (json.success) {
        showToast(`Jornada de ${updatedItem.asesor} actualizada en la hoja Data.`);
        loadPlanningData(true);
        setEditingRecord(null);
        return true;
      } else {
        showToast(json.error || "No se pudo actualizar la jornada.");
        return false;
      }
    } catch {
      showToast("Error de conexión al actualizar la jornada.");
      return false;
    }
  };

  // Matrix View: Delete record (optimistic instant update)
  const handleDeleteRecord = async (record: PlanningSheetRecord): Promise<boolean> => {
    handleDeleteSuccess(record);
    showToast(`Jornada de ${record.asesor} eliminada de la hoja Data.`);

    try {
      const params = new URLSearchParams();
      if (record.id) params.set("id", String(record.id));
      if (record.sheetRowIndex) params.set("sheetRowIndex", String(record.sheetRowIndex));
      if (record.isoFecha) params.set("fecha", record.isoFecha);
      if (record.asesor) params.set("asesor", record.asesor);

      const res = await fetch(`/api/planificacion?${params.toString()}`, {
        method: "DELETE",
      });
      const json = await res.json();
      return json.success;
    } catch {
      return false;
    }
  };

  // Matrix View: Quick Add button click -> switch to daily view on that date
  const handleQuickAdd = (advisor: string, isoDate: string) => {
    setInitialDailyDate(isoDate);
    setActiveView("diaria");
    showToast(`Asignando a ${advisor} para el ${isoDate}.`);
  };

  // User selected a month from PlanificadorHeader dropdown
  const handleMonthChange = useCallback((newMonth: string) => {
    setSelectedMonth(newMonth);

    // Calculate the target anchor date for that month
    const monthIdx = SPANISH_MONTHS.indexOf(newMonth.toUpperCase());
    if (monthIdx >= 0) {
      const now = new Date();
      const currentYear = now.getFullYear();
      const isCurrentMonth = now.getMonth() === monthIdx;
      const targetIso = isCurrentMonth
        ? now.toISOString().split("T")[0]
        : `${currentYear}-${String(monthIdx + 1).padStart(2, "0")}-01`;

      setInitialDailyDate(targetIso);
    }
  }, []);

  // User manually navigated dates via arrows or calendar in PlanificadorDailySheet
  const handleDailyDateChange = useCallback((isoDate: string) => {
    const derivedMonth = getMonthFromDate(isoDate);
    if (derivedMonth) {
      setSelectedMonth((prev) => (prev === derivedMonth ? prev : derivedMonth));
    }
  }, []);

  // Matrix View: Replicate day
  const handleReplicateDay = async (
    sourceIsoDate: string,
    targetIsoDate: string
  ): Promise<boolean> => {
    const sourceRecords = records.filter((r) => r.isoFecha === sourceIsoDate);
    if (sourceRecords.length === 0) return false;

    const targetMonth = getMonthFromDate(targetIsoDate) || selectedMonth;
    const itemsToCreate: NewPlanningItem[] = sourceRecords.map((r) => ({
      fecha: targetIsoDate,
      mes: targetMonth,
      asesor: r.asesor,
      estado: r.estado,
      municipio: r.municipio,
      parroquia: r.parroquia,
      sector: r.sector,
      tipo_actividad: r.tipo_actividad,
      estatus: "Planificado",
    }));

    try {
      const res = await fetch("/api/planificacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: itemsToCreate }),
      });
      const json = await res.json();
      if (json.success) {
        showToast(`${itemsToCreate.length} jornadas replicadas para el ${targetIsoDate}.`);
        loadPlanningData(true);
        return true;
      } else {
        showToast(json.error || "No se pudo replicar la jornada.");
        return false;
      }
    } catch {
      showToast("Error de conexión al replicar jornadas.");
      return false;
    }
  };

  // Count planned records in the selected month
  const monthRecordsCount = useMemo(() => {
    if (!selectedMonth) return records.length;
    const targetMonth = selectedMonth.toUpperCase();
    return records.filter((r) => {
      const m = (r.mes || getMonthFromDate(r.isoFecha || r.fecha) || "").toUpperCase();
      return m === targetMonth;
    }).length;
  }, [records, selectedMonth]);

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
            onMonthChange={handleMonthChange}
            onRefresh={() => loadPlanningData(true)}
            isRefreshing={isRefreshing}
            totalRecordsCount={records.length}
            monthRecordsCount={monthRecordsCount}
            activeView={activeView}
            onViewChange={setActiveView}
          />

          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-2 text-neutral-400">
              <Loader2 className="w-5 h-5 animate-spin stroke-[1.25]" />
              <span className="text-xs font-mono">
                Cargando asesores y registros de la hoja Data...
              </span>
            </div>
          ) : metadata ? (
            activeView === "diaria" ? (
              <PlanificadorDailySheet
                metadata={metadata}
                existingRecords={records}
                onSuccess={handleSuccess}
                defaultMonth={selectedMonth}
                initialDate={initialDailyDate}
                selectedMonth={selectedMonth}
                onDateChange={handleDailyDateChange}
                onDeleteSuccess={handleDeleteSuccess}
              />
            ) : (
              <PlanificadorMatrixView
                records={records}
                metadata={metadata}
                selectedMonth={selectedMonth}
                onMonthChange={setSelectedMonth}
                onEditRecord={handleEditRecord}
                onDeleteRecord={handleDeleteRecord}
                onQuickAdd={handleQuickAdd}
                onReplicateDay={handleReplicateDay}
              />
            )
          ) : (
            <div className="py-12 text-center text-xs text-neutral-400">
              No se pudo inicializar la conexión con Google Sheets.
            </div>
          )}
        </main>
      </div>

      {/* Edit modal when editing from matrix view */}
      {metadata && (
        <PlanificadorEditDialog
          record={editingRecord}
          metadata={metadata}
          isOpen={Boolean(editingRecord)}
          onClose={() => setEditingRecord(null)}
          onSave={handleSaveEditedRecord}
        />
      )}
    </div>
  );
}