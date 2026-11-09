"use client";

import { useState, useMemo, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  Check,
  RotateCw,
  Loader2,
  Copy,
  PenLine,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import {
  PlanningMetadata,
  PlanningSheetRecord,
  NewPlanningItem,
  getMonthFromDate,
  toSheetDateFormat,
} from "@/lib/planificacion-types";

interface PlanificadorDailySheetProps {
  metadata: PlanningMetadata;
  existingRecords: PlanningSheetRecord[];
  onSuccess: (count: number) => void;
  defaultMonth: string;
}

interface ParroquiaItem {
  parroquia: string;
  municipio: string;
  estado: string;
  sectores: string[];
}

export function PlanificadorDailySheet({
  metadata,
  existingRecords,
  onSuccess,
  defaultMonth,
}: PlanificadorDailySheetProps) {
  // ── 1. DÍA DE LA PLANIFICACIÓN (FECHA ANCLA) ──────────────────────────────
  const [selectedDate, setSelectedDate] = useState<string>(
    () => new Date().toISOString().split("T")[0]
  );

  // Filtros de búsqueda en la lista de asesores
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "planned">("all");

  // Estado de guardado / eliminación
  const [savingAdvisor, setSavingAdvisor] = useState<string | null>(null);
  const [isSavingAll, setIsSavingAll] = useState<boolean>(false);
  const [recordToDelete, setRecordToDelete] = useState<PlanningSheetRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Herramienta de asignación en bloque
  const [showBulkTool, setShowBulkTool] = useState<boolean>(false);
  const [bulkParroquia, setBulkParroquia] = useState<string>("Carrizal");
  const [bulkSector, setBulkSector] = useState<string>("Casco Central");
  const [bulkActivity, setBulkActivity] = useState<string>("Recorrido con Instaladores");

  // Borradores locales para cada asesor: Record<asesor, { parroquia, sector, actividad }>
  const [drafts, setDrafts] = useState<
    Record<string, { parroquia: string; sector: string; actividad: string }>
  >({});

  // ── 2. CATÁLOGO DE PARROQUIAS Y SECTORES DESDE METADATA ───────────────────
  const { parroquiasList, parroquiaMap } = useMemo(() => {
    const list: ParroquiaItem[] = [];
    const map = new Map<string, ParroquiaItem>();

    const hierarchy = metadata.geoHierarchy || {};
    for (const [estado, municipios] of Object.entries(hierarchy)) {
      for (const [municipio, parroquias] of Object.entries(municipios)) {
        for (const [parroquia, sectores] of Object.entries(parroquias)) {
          const item: ParroquiaItem = {
            parroquia,
            municipio,
            estado,
            sectores: Array.isArray(sectores)
              ? [...sectores].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }))
              : [],
          };
          if (!map.has(parroquia)) {
            map.set(parroquia, item);
            list.push(item);
          }
        }
      }
    }

    list.sort((a, b) => a.parroquia.localeCompare(b.parroquia, "es", { sensitivity: "base" }));
    return { parroquiasList: list, parroquiaMap: map };
  }, [metadata.geoHierarchy]);

  // Parroquia por defecto si no hay selección
  const defaultParroquia = parroquiasList[0]?.parroquia || "Carrizal";
  const defaultSector =
    parroquiaMap.get(defaultParroquia)?.sectores[0] || "Casco Central";
  const defaultActividad = "Recorrido con Instaladores";

  // ── 3. MAPA DE REGISTROS DE ESTE DÍA EN SHEET DATA ────────────────────────
  const dayRecordsMap = useMemo(() => {
    const map = new Map<string, PlanningSheetRecord>();
    for (const r of existingRecords) {
      if (r.isoFecha === selectedDate && r.asesor) {
        map.set(r.asesor.trim().toLowerCase(), r);
      }
    }
    return map;
  }, [selectedDate, existingRecords]);

  // Navegación de días
  const advanceDay = (days: number) => {
    const parts = selectedDate.split("-").map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2] + days);
    setSelectedDate(d.toISOString().split("T")[0]);
    setDrafts({});
    setFeedbackMessage(null);
  };

  const setQuickDay = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    setSelectedDate(d.toISOString().split("T")[0]);
    setDrafts({});
    setFeedbackMessage(null);
  };

  // Formato de fecha natural
  const formatNaturalDate = (isoStr: string) => {
    if (!isoStr || typeof isoStr !== "string" || !isoStr.includes("-")) return "";
    try {
      const parts = isoStr.split("-").map(Number);
      if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
        return "";
      }
      const [y, m, d] = parts;
      const date = new Date(y, m - 1, d);
      if (isNaN(date.getTime())) return "";
      return date.toLocaleDateString("es-VE", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return "";
    }
  };

  // ── 4. ESTADÍSTICAS DEL DÍA ───────────────────────────────────────────────
  const plannedCount = dayRecordsMap.size;
  const totalCount = metadata.advisors.length;
  const pendingCount = Math.max(0, totalCount - plannedCount);

  // ── 5. ASESORES FILTRADOS ─────────────────────────────────────────────────
  const displayAdvisors = useMemo(() => {
    let list = metadata.advisors;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((adv) => adv.toLowerCase().includes(q));
    }

    if (statusFilter === "pending") {
      list = list.filter((adv) => !dayRecordsMap.has(adv.trim().toLowerCase()));
    } else if (statusFilter === "planned") {
      list = list.filter((adv) => dayRecordsMap.has(adv.trim().toLowerCase()));
    }

    return list;
  }, [metadata.advisors, searchQuery, statusFilter, dayRecordsMap]);

  // Obtener o inicializar borrador para un asesor
  const getAdvisorDraft = useCallback(
    (adv: string) => {
      if (drafts[adv]) return drafts[adv];

      const record = dayRecordsMap.get(adv.trim().toLowerCase());
      if (record) {
        return {
          parroquia: record.parroquia || defaultParroquia,
          sector: record.sector || defaultSector,
          actividad: record.tipo_actividad || defaultActividad,
        };
      }

      return {
        parroquia: defaultParroquia,
        sector: defaultSector,
        actividad: defaultActividad,
      };
    },
    [drafts, dayRecordsMap, defaultParroquia, defaultSector, defaultActividad]
  );

  const updateAdvisorDraft = (
    adv: string,
    field: "parroquia" | "sector" | "actividad",
    val: string
  ) => {
    setDrafts((prev) => {
      const curr = prev[adv] || getAdvisorDraft(adv);
      if (field === "parroquia") {
        const item = parroquiaMap.get(val);
        const newSector = item?.sectores[0] || "";
        return {
          ...prev,
          [adv]: {
            ...curr,
            parroquia: val,
            sector: newSector,
          },
        };
      }
      return {
        ...prev,
        [adv]: {
          ...curr,
          [field]: val,
        },
      };
    });
  };

  // ── 6. GUARDAR JORNADA INDIVIDUAL ─────────────────────────────────────────
  const handleSaveAdvisor = async (adv: string) => {
    const draft = getAdvisorDraft(adv);
    const existingRec = dayRecordsMap.get(adv.trim().toLowerCase());
    const geo = parroquiaMap.get(draft.parroquia);

    if (!draft.sector) {
      setFeedbackMessage(`Selecciona un sector para ${adv}.`);
      return;
    }

    setSavingAdvisor(adv);
    setFeedbackMessage(null);

    const item: NewPlanningItem = {
      fecha: selectedDate,
      mes: getMonthFromDate(selectedDate) || defaultMonth,
      asesor: adv,
      estado: geo?.estado || "Miranda",
      municipio: geo?.municipio || "Carrizal",
      parroquia: draft.parroquia,
      sector: draft.sector,
      tipo_actividad: draft.actividad,
      estatus: "Planificado",
    };

    try {
      if (existingRec) {
        // Actualizar fila existente en Google Sheets
        const res = await fetch("/api/planificacion", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sheetRowIndex: existingRec.sheetRowIndex,
            item,
          }),
        });
        const json = await res.json();
        if (json.success) {
          setFeedbackMessage(`Jornada de ${adv} actualizada en la hoja Data.`);
          onSuccess(1);
        } else {
          setFeedbackMessage(json.error || `Error al actualizar a ${adv}.`);
        }
      } else {
        // Crear nueva fila en Google Sheets
        const res = await fetch("/api/planificacion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: [item] }),
        });
        const json = await res.json();
        if (json.success) {
          setFeedbackMessage(`Jornada de ${adv} guardada en la hoja Data.`);
          onSuccess(1);
        } else {
          setFeedbackMessage(json.error || `Error al registrar a ${adv}.`);
        }
      }
    } catch {
      setFeedbackMessage(`Error de conexión al guardar la jornada de ${adv}.`);
    } finally {
      setSavingAdvisor(null);
    }
  };

  // ── 7. ELIMINAR JORNADA ───────────────────────────────────────────────────
  const handleConfirmDelete = async () => {
    if (!recordToDelete) return;
    setIsDeleting(true);

    try {
      const res = await fetch(
        `/api/planificacion?sheetRowIndex=${recordToDelete.sheetRowIndex}`,
        { method: "DELETE" }
      );
      const json = await res.json();

      if (json.success) {
        setFeedbackMessage(
          `Jornada de ${recordToDelete.asesor} eliminada de la hoja Data.`
        );
        onSuccess(1);
        setRecordToDelete(null);
      } else {
        setFeedbackMessage(json.error || "No se pudo eliminar el registro.");
      }
    } catch {
      setFeedbackMessage("Error de conexión al eliminar la jornada.");
    } finally {
      setIsDeleting(false);
    }
  };

  // ── 8. HERRAMIENTA MASIVA PARA PENDIENTES ─────────────────────────────────
  const applyBulkToPendingDrafts = () => {
    const updated: Record<string, { parroquia: string; sector: string; actividad: string }> = {
      ...drafts,
    };
    for (const adv of metadata.advisors) {
      if (!dayRecordsMap.has(adv.trim().toLowerCase())) {
        updated[adv] = {
          parroquia: bulkParroquia,
          sector: bulkSector,
          actividad: bulkActivity,
        };
      }
    }
    setDrafts(updated);
    setFeedbackMessage(
      `Se aplicó ${bulkSector} (${bulkParroquia}) a los ${pendingCount} asesores pendientes.`
    );
  };

  const handleSaveAllPending = async () => {
    const pendingAdvisors = metadata.advisors.filter(
      (adv) => !dayRecordsMap.has(adv.trim().toLowerCase())
    );
    if (pendingAdvisors.length === 0) return;

    setIsSavingAll(true);
    setFeedbackMessage(null);

    const items: NewPlanningItem[] = [];
    for (const adv of pendingAdvisors) {
      const draft = getAdvisorDraft(adv);
      const geo = parroquiaMap.get(draft.parroquia);
      if (draft.sector) {
        items.push({
          fecha: selectedDate,
          mes: getMonthFromDate(selectedDate) || defaultMonth,
          asesor: adv,
          estado: geo?.estado || "Miranda",
          municipio: geo?.municipio || "Carrizal",
          parroquia: draft.parroquia,
          sector: draft.sector,
          tipo_actividad: draft.actividad,
          estatus: "Planificado",
        });
      }
    }

    try {
      const res = await fetch("/api/planificacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const json = await res.json();
      if (json.success) {
        setFeedbackMessage(
          `Se guardaron ${items.length} jornadas en la hoja Data para el ${toSheetDateFormat(selectedDate)}.`
        );
        onSuccess(items.length);
      } else {
        setFeedbackMessage(json.error || "Error al guardar las jornadas masivas.");
      }
    } catch {
      setFeedbackMessage("Error de conexión al guardar jornadas.");
    } finally {
      setIsSavingAll(false);
    }
  };

  return (
    <div className="space-y-6 pt-2">
      {/* ── BARRA DE CONTROL DE FECHA (MÓVIL Y DESKTOP) ───────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-neutral-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-neutral-900 capitalize">
              {formatNaturalDate(selectedDate)}
            </span>
          </div>
          <p className="text-xs text-neutral-500 mt-0.5 font-normal">
            {plannedCount} de {totalCount} asesores planificados hoy ·{" "}
            {pendingCount === 0 ? "¡Día completado!" : `${pendingCount} pendientes`}
          </p>
        </div>

        {/* Controles de cambio de fecha */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1 text-neutral-400">
            <button
              type="button"
              onClick={() => advanceDay(-1)}
              className="text-neutral-500 hover:text-neutral-900 transition-colors p-1 cursor-pointer"
              title="Día anterior"
            >
              <ChevronLeft className="w-4 h-4 stroke-[1.5]" />
            </button>
            <button
              type="button"
              onClick={() => setQuickDay(0)}
              className="text-neutral-600 hover:text-neutral-900 transition-colors px-1.5 py-0.5 font-medium cursor-pointer"
            >
              Hoy
            </button>
            <span className="text-neutral-200">·</span>
            <button
              type="button"
              onClick={() => setQuickDay(1)}
              className="text-neutral-600 hover:text-neutral-900 transition-colors px-1.5 py-0.5 font-medium cursor-pointer"
            >
              Mañana
            </button>
            <button
              type="button"
              onClick={() => advanceDay(1)}
              className="text-neutral-500 hover:text-neutral-900 transition-colors p-1 cursor-pointer"
              title="Día siguiente"
            >
              <ChevronRight className="w-4 h-4 stroke-[1.5]" />
            </button>
          </div>

          <span className="text-neutral-200">|</span>

          {/* Selector de fecha nativo */}
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              setDrafts({});
              setFeedbackMessage(null);
            }}
            className="text-xs border-b border-neutral-200 focus:border-neutral-900 bg-transparent py-1 text-neutral-900 outline-hidden font-mono cursor-pointer transition-colors"
          />
        </div>
      </div>

      {/* ── MENSAJE DE RETROALIMENTACIÓN DISCRETO (Strict Rule: Cero banners) */}
      {feedbackMessage && (
        <div className="py-2 animate-in fade-in duration-200 flex items-center justify-between gap-3 text-xs text-neutral-700 border-b border-neutral-100">
          <span>{feedbackMessage}</span>
          <button
            type="button"
            onClick={() => setFeedbackMessage(null)}
            className="text-neutral-400 hover:text-neutral-700 cursor-pointer"
          >
            <X className="w-3 h-3 stroke-[1.5]" />
          </button>
        </div>
      )}

      {/* ── BARRA DE BÚSQUEDA Y HERRAMIENTAS RÁPIDAS ───────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-neutral-100">
        {/* Buscador de asesor */}
        <div className="relative max-w-xs w-full">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrar asesor por nombre..."
            className="w-full text-xs border-b border-neutral-200 focus:border-neutral-900 bg-transparent py-1.5 pl-6 pr-2 transition-colors outline-hidden placeholder:text-neutral-400"
          />
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-0 top-2 stroke-[1.25]" />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-1 top-2 text-neutral-400 hover:text-neutral-700 cursor-pointer"
            >
              <X className="w-3 h-3 stroke-[1.5]" />
            </button>
          )}
        </div>

        {/* Filtros de estado y herramienta en bloque */}
        <div className="flex items-center gap-3 text-xs">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={cn(
              "cursor-pointer transition-colors py-1",
              statusFilter === "all"
                ? "text-neutral-900 font-medium underline underline-offset-4"
                : "text-neutral-400 hover:text-neutral-700 font-normal"
            )}
          >
            Todos ({totalCount})
          </button>
          <span className="text-neutral-200">·</span>
          <button
            type="button"
            onClick={() => setStatusFilter("pending")}
            className={cn(
              "cursor-pointer transition-colors py-1",
              statusFilter === "pending"
                ? "text-neutral-900 font-medium underline underline-offset-4"
                : "text-neutral-400 hover:text-neutral-700 font-normal"
            )}
          >
            Pendientes ({pendingCount})
          </button>
          <span className="text-neutral-200">·</span>
          <button
            type="button"
            onClick={() => setStatusFilter("planned")}
            className={cn(
              "cursor-pointer transition-colors py-1",
              statusFilter === "planned"
                ? "text-neutral-900 font-medium underline underline-offset-4"
                : "text-neutral-400 hover:text-neutral-700 font-normal"
            )}
          >
            Planificados ({plannedCount})
          </button>

          <span className="text-neutral-200">|</span>

          {/* Toggle de herramienta en bloque */}
          <button
            type="button"
            onClick={() => setShowBulkTool(!showBulkTool)}
            className="text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer flex items-center gap-1"
          >
            <Copy className="w-3 h-3 stroke-[1.25]" />
            <span>{showBulkTool ? "Ocultar carga rápida" : "Asignación rápida"}</span>
          </button>
        </div>
      </div>

      {/* ── PANEL DESPLEGABLE DE ASIGNACIÓN RÁPIDA EN BLOQUE ───────────────── */}
      {showBulkTool && (
        <div className="space-y-3 py-3 px-1 border-b border-neutral-100 animate-in fade-in duration-150">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-medium text-neutral-900">
              Copiar zona y actividad a todos los pendientes ({pendingCount})
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] text-neutral-400 block mb-1">
                Parroquia
              </label>
              <CustomDropdown
                value={bulkParroquia}
                options={parroquiasList.map((p) => ({
                  value: p.parroquia,
                  label: p.parroquia,
                }))}
                onChange={(p) => {
                  setBulkParroquia(p);
                  const firstSector = parroquiaMap.get(p)?.sectores[0] || "";
                  setBulkSector(firstSector);
                }}
                compact
              />
            </div>

            <div>
              <label className="text-[11px] text-neutral-400 block mb-1">
                Sector
              </label>
              <CustomDropdown
                value={bulkSector}
                options={(parroquiaMap.get(bulkParroquia)?.sectores || []).map((s) => ({
                  value: s,
                  label: s,
                }))}
                onChange={setBulkSector}
                compact
              />
            </div>

            <div>
              <label className="text-[11px] text-neutral-400 block mb-1">
                Actividad
              </label>
              <CustomDropdown
                value={bulkActivity}
                options={metadata.activities.map((a) => ({ value: a, label: a }))}
                onChange={setBulkActivity}
                compact
              />
            </div>
          </div>

          <div className="flex items-center gap-4 pt-1">
            <button
              type="button"
              onClick={applyBulkToPendingDrafts}
              className="text-xs font-medium text-neutral-900 hover:text-neutral-600 transition-colors cursor-pointer"
            >
              1. Aplicar a campos de pendientes
            </button>
            <span className="text-neutral-200">·</span>
            <button
              type="button"
              onClick={handleSaveAllPending}
              disabled={isSavingAll || pendingCount === 0}
              className="text-xs font-semibold text-neutral-900 hover:text-neutral-600 disabled:opacity-40 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              {isSavingAll && <Loader2 className="w-3.5 h-3.5 animate-spin stroke-[1.25]" />}
              <span>2. Guardar todos en Sheet Data</span>
            </button>
          </div>
        </div>
      )}

      {/* ── LISTA DE ASESORES EN PANTALLA (OPTIMIZADA PARA MÓVILES Y DESKTOP) ── */}
      <div className="divide-y divide-neutral-100">
        {displayAdvisors.length === 0 ? (
          <div className="py-12 text-center text-xs text-neutral-400">
            No se encontraron asesores con los filtros seleccionados.
          </div>
        ) : (
          displayAdvisors.map((adv) => {
            const existingRec = dayRecordsMap.get(adv.trim().toLowerCase());
            const isPlanned = Boolean(existingRec);
            const draft = getAdvisorDraft(adv);
            const isSavingThis = savingAdvisor === adv;

            // Sectores disponibles para la parroquia seleccionada en este asesor
            const availableSectores = parroquiaMap.get(draft.parroquia)?.sectores || [];

            // Detectar si el borrador ha cambiado respecto al registro guardado
            const isModified =
              isPlanned &&
              (draft.parroquia !== existingRec?.parroquia ||
                draft.sector !== existingRec?.sector ||
                draft.actividad !== existingRec?.tipo_actividad);

            const initials = adv
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("")
              .toUpperCase();

            return (
              <div
                key={adv}
                className={cn(
                  "py-3 px-1 transition-colors group flex flex-col md:flex-row md:items-center justify-between gap-3",
                  isPlanned ? "hover:bg-neutral-50/40" : "hover:bg-neutral-50/20"
                )}
              >
                {/* 1. Nombre del asesor y estado */}
                <div className="flex items-center justify-between md:justify-start gap-3 min-w-[200px]">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-[11px] shrink-0 font-medium",
                        isPlanned
                          ? "bg-neutral-900 text-white"
                          : "bg-neutral-100 text-neutral-500"
                      )}
                    >
                      {initials}
                    </span>

                    <div>
                      <span className="text-xs font-medium text-neutral-900 block">
                        {adv}
                      </span>
                      <span className="text-[11px] text-neutral-400 block">
                        {isPlanned ? (
                          <span className="text-neutral-600 font-medium">
                            ✓ Planificado{" "}
                            {existingRec?.sheetRowIndex && (
                              <span className="font-mono text-[10px] text-neutral-400">
                                (fila {existingRec.sheetRowIndex})
                              </span>
                            )}
                          </span>
                        ) : (
                          <span>Sin planificar</span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* En móvil: botón rápido de eliminar si está planificado */}
                  {isPlanned && existingRec && (
                    <button
                      type="button"
                      onClick={() => setRecordToDelete(existingRec)}
                      className="md:hidden text-neutral-400 hover:text-neutral-900 transition-colors p-1 cursor-pointer"
                      title="Eliminar jornada"
                    >
                      <X className="w-3.5 h-3.5 stroke-[1.5]" />
                    </button>
                  )}
                </div>

                {/* 2. Selectores: Parroquia, Sector, Actividad */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1 max-w-2xl">
                  {/* Parroquia */}
                  <div>
                    <label className="text-[10px] text-neutral-400 block mb-0.5 sm:hidden">
                      Parroquia
                    </label>
                    <CustomDropdown
                      value={draft.parroquia}
                      options={parroquiasList.map((p) => ({
                        value: p.parroquia,
                        label: p.parroquia,
                      }))}
                      onChange={(p) => updateAdvisorDraft(adv, "parroquia", p)}
                      compact
                      placeholder="Parroquia..."
                    />
                  </div>

                  {/* Sector */}
                  <div>
                    <label className="text-[10px] text-neutral-400 block mb-0.5 sm:hidden">
                      Sector
                    </label>
                    <CustomDropdown
                      value={draft.sector}
                      options={availableSectores.map((s) => ({
                        value: s,
                        label: s,
                      }))}
                      onChange={(s) => updateAdvisorDraft(adv, "sector", s)}
                      compact
                      placeholder="Sector..."
                    />
                  </div>

                  {/* Actividad */}
                  <div>
                    <label className="text-[10px] text-neutral-400 block mb-0.5 sm:hidden">
                      Actividad
                    </label>
                    <CustomDropdown
                      value={draft.actividad}
                      options={metadata.activities.map((a) => ({
                        value: a,
                        label: a,
                      }))}
                      onChange={(a) => updateAdvisorDraft(adv, "actividad", a)}
                      compact
                      placeholder="Actividad..."
                    />
                  </div>
                </div>

                {/* 3. Botones de acción: Guardar / Actualizar / Eliminar */}
                <div className="flex items-center justify-end gap-3 shrink-0 pt-1 md:pt-0">
                  <button
                    type="button"
                    onClick={() => handleSaveAdvisor(adv)}
                    disabled={isSavingThis}
                    className={cn(
                      "text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 py-1 px-2.5",
                      isSavingThis && "opacity-50",
                      isModified
                        ? "text-neutral-900 font-bold hover:text-neutral-600 underline"
                        : isPlanned
                        ? "text-neutral-400 hover:text-neutral-900"
                        : "text-neutral-900 hover:text-neutral-600"
                    )}
                  >
                    {isSavingThis ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin stroke-[1.25]" />
                        <span>Guardando...</span>
                      </>
                    ) : isModified ? (
                      <span>Actualizar</span>
                    ) : isPlanned ? (
                      <span>Guardado</span>
                    ) : (
                      <span>Guardar</span>
                    )}
                  </button>

                  {/* En desktop: botón eliminar con X discreto */}
                  {isPlanned && existingRec && (
                    <button
                      type="button"
                      onClick={() => setRecordToDelete(existingRec)}
                      className="hidden md:block text-neutral-400 hover:text-neutral-900 transition-colors p-1 cursor-pointer opacity-0 group-hover:opacity-100"
                      title="Eliminar esta jornada de Sheet Data"
                    >
                      <X className="w-3.5 h-3.5 stroke-[1.5]" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── MODAL DE CONFIRMACIÓN DE ELIMINACIÓN (Strict Rule: Cero window.confirm) */}
      <DeleteConfirmDialog
        isOpen={Boolean(recordToDelete)}
        title="Eliminar jornada de la hoja Data"
        description={
          recordToDelete
            ? `¿Deseas eliminar la jornada de ${recordToDelete.asesor} para el ${recordToDelete.fecha} en ${recordToDelete.sector}? Esta acción modificará directamente la fila ${recordToDelete.sheetRowIndex} de Google Sheets.`
            : ""
        }
        confirmLabel={isDeleting ? "Eliminando..." : "Eliminar de Sheet Data"}
        cancelLabel="Conservar"
        onConfirm={handleConfirmDelete}
        onCancel={() => setRecordToDelete(null)}
      />
    </div>
  );
}

