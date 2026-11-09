"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Sidebar } from "@/components/dashboard/sidebar";
import {
  SidebarOpenButton,
  SidebarMobileButton,
} from "@/components/providers/sidebar-provider";
import {
  PlanificadorHeader,
  PlanificadorTab,
} from "@/components/planificador/planificador-header";
import { PlanificadorMetricsBar } from "@/components/planificador/planificador-metrics-bar";
import { PlanificadorCreateForm } from "@/components/planificador/planificador-create-form";
import { PlanificadorMatrixView } from "@/components/planificador/planificador-matrix-view";
import { PlanificadorTableView } from "@/components/planificador/planificador-table-view";
import { PlanificadorEditDialog } from "@/components/planificador/planificador-edit-dialog";
import {
  PlanningSheetRecord,
  PlanningMetadata,
  NewPlanningItem,
  SPANISH_MONTHS,
  getMonthFromDate,
  toIsoDateString,
} from "@/lib/planificacion-types";
import { clearDashboardDataCache } from "@/lib/dashboard-data";
import { Loader2 } from "lucide-react";

export default function PlanificadorPage() {
  const [activeTab, setActiveTab] = useState<PlanificadorTab>("crear");

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

  // Edit record dialog state
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

  // Handle successful creation of records
  const handleCreateSuccess = (count: number) => {
    showToast(
      `${count} ${count === 1 ? "jornada guardada" : "jornadas guardadas"} exitosamente en la hoja Data.`
    );
    loadPlanningData(true);
  };

  // Handle edit save
  const handleSaveEdit = async (
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
        showToast(`Fila ${sheetRowIndex} actualizada correctamente.`);
        loadPlanningData(true);
        return true;
      } else {
        showToast(json.error || "Error al actualizar registro.");
        return false;
      }
    } catch {
      showToast("Error de conexión al actualizar en Google Sheets.");
      return false;
    }
  };

  // Handle delete record
  const handleDeleteRecord = async (record: PlanningSheetRecord): Promise<boolean> => {
    try {
      const res = await fetch(`/api/planificacion?sheetRowIndex=${record.sheetRowIndex}`, {
        method: "DELETE",
      });

      const json = await res.json();
      if (json.success) {
        showToast(`Jornada eliminada de la hoja Data.`);
        loadPlanningData(true);
        return true;
      } else {
        showToast(json.error || "Error al eliminar registro.");
        return false;
      }
    } catch {
      showToast("Error de conexión al eliminar de Google Sheets.");
      return false;
    }
  };

  // Quick add from matrix cell (switches to create tab)
  const handleQuickAdd = (advisor: string, isoDate: string) => {
    setActiveTab("crear");
    showToast(`Asignando para ${advisor} en fecha ${isoDate}.`);
  };

  // Handle day replication
  const handleReplicateDay = async (
    sourceIsoDate: string,
    targetIsoDate: string
  ): Promise<boolean> => {
    // Find all records from source date
    const sourceRecords = records.filter((r) => r.isoFecha === sourceIsoDate);
    if (sourceRecords.length === 0) {
      showToast("No existen registros en la fecha de origen para replicar.");
      return false;
    }

    const targetMonth = getMonthFromDate(targetIsoDate);
    const newItems: NewPlanningItem[] = sourceRecords.map((r) => ({
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
        body: JSON.stringify({ items: newItems }),
      });

      const json = await res.json();
      if (json.success) {
        showToast(
          `Se replicaron ${newItems.length} asignaciones para el ${targetIsoDate}.`
        );
        loadPlanningData(true);
        return true;
      } else {
        showToast(json.error || "Error al replicar planificación.");
        return false;
      }
    } catch {
      showToast("Error de red al replicar planificación.");
      return false;
    }
  };

  return (
    <div className="flex h-screen bg-[#FBFBFB] text-neutral-900 font-sans antialiased overflow-hidden selection:bg-neutral-900 selection:text-white">
      {/* Sidebar with activeSection planificador */}
      <Sidebar activeSection="planificador" />

      {/* Main scrollable canvas */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
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
        <main className="p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* Header & Tabs */}
          <PlanificadorHeader
            activeTab={activeTab}
            onSelectTab={setActiveTab}
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
                Cargando registros de la hoja Data...
              </span>
            </div>
          ) : metadata ? (
            <>
              {/* Metrics bar */}
              <PlanificadorMetricsBar
                records={records}
                activeMonth={selectedMonth}
                totalAdvisorsCount={metadata.advisors.length}
              />

              {/* Tab 1: Crear Planificación */}
              {activeTab === "crear" && (
                <PlanificadorCreateForm
                  metadata={metadata}
                  existingRecords={records}
                  onSuccess={handleCreateSuccess}
                  defaultMonth={selectedMonth}
                />
              )}

              {/* Tab 2: Matriz Semanal */}
              {activeTab === "matriz" && (
                <PlanificadorMatrixView
                  records={records}
                  metadata={metadata}
                  onEditRecord={(r) => setEditingRecord(r)}
                  onDeleteRecord={handleDeleteRecord}
                  onQuickAdd={handleQuickAdd}
                  onReplicateDay={handleReplicateDay}
                />
              )}

              {/* Tab 3: Registros en Sheet Data */}
              {activeTab === "tabla" && (
                <PlanificadorTableView
                  records={records}
                  metadata={metadata}
                  selectedMonth={selectedMonth}
                  onEditRecord={(r) => setEditingRecord(r)}
                  onDeleteRecord={handleDeleteRecord}
                />
              )}
            </>
          ) : (
            <div className="py-12 text-center text-xs text-neutral-400">
              No se pudo inicializar la conexión con Google Sheets.
            </div>
          )}
        </main>
      </div>

      {/* Edit Record Modal Dialog */}
      {metadata && (
        <PlanificadorEditDialog
          record={editingRecord}
          metadata={metadata}
          isOpen={Boolean(editingRecord)}
          onClose={() => setEditingRecord(null)}
          onSave={handleSaveEdit}
        />
      )}
    </div>
  );
}

