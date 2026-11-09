"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  Check,
  Loader2,
  Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { normGeoKey } from "@/lib/geo_normalization";
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

// Formato de fecha para el botón: si es hoy retorna "Hoy", sino "DD/MM/YYYY"
function formatButtonDate(isoStr: string, todayIso: string): string {
  if (isoStr === todayIso) return "Hoy";
  const parts = isoStr.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return isoStr;
}

export function PlanificadorDailySheet({
  metadata,
  existingRecords,
  onSuccess,
  defaultMonth,
}: PlanificadorDailySheetProps) {
  // Fecha de hoy en formato ISO (YYYY-MM-DD)
  const todayIso = useMemo(() => new Date().toISOString().split("T")[0], []);

  // ── 1. DÍA DE LA PLANIFICACIÓN (FECHA ANCLA) ──────────────────────────────
  const [selectedDate, setSelectedDate] = useState<string>(todayIso);
  const dateInputRef = useRef<HTMLInputElement>(null);

  // Filtros de búsqueda en la lista de asesores
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "planned">("all");

  // Estado de autoguardado por asesor: advKey -> "idle" | "saving" | "saved" | "error"
  const [savingStatus, setSavingStatus] = useState<Record<string, "idle" | "saving" | "saved" | "error">>({});
  const [isSavingAll, setIsSavingAll] = useState<boolean>(false);

  // Eliminación de jornada
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
    // Mapa canonical por clave normalizada (sin tildes, mayúsculas) para eliminar duplicados
    const canonicalMap = new Map<string, ParroquiaItem>();

    const hierarchy = metadata.geoHierarchy || {};
    for (const [estado, municipios] of Object.entries(hierarchy)) {
      for (const [municipio, parroquias] of Object.entries(municipios)) {
        for (const [parroquia, rawSectores] of Object.entries(parroquias)) {
          const trimmedPar = parroquia.trim();
          if (!trimmedPar) continue;

          const key = normGeoKey(trimmedPar);
          const existing = canonicalMap.get(key);

          // Determinar la mejor versión del nombre (preferir tildes y Title Case)
          let bestParroquiaName = trimmedPar;
          if (existing) {
            const existingHasAccents = /[áéíóúÁÉÍÓÚñÑ]/.test(existing.parroquia);
            const currentHasAccents = /[áéíóúÁÉÍÓÚñÑ]/.test(trimmedPar);
            if (existingHasAccents && !currentHasAccents) {
              bestParroquiaName = existing.parroquia;
            } else if (!existingHasAccents && currentHasAccents) {
              bestParroquiaName = trimmedPar;
            } else {
              const existingUpperCount = (existing.parroquia.match(/[A-Z]/g) || []).length;
              const currentUpperCount = (trimmedPar.match(/[A-Z]/g) || []).length;
              bestParroquiaName =
                currentUpperCount >= existingUpperCount ? trimmedPar : existing.parroquia;
            }
          }

          // Unificar sectores sin duplicados
          const sectorMap = new Map<string, string>();
          if (existing) {
            for (const s of existing.sectores) {
              const sKey = normGeoKey(s);
              if (sKey && !sectorMap.has(sKey)) sectorMap.set(sKey, s.trim());
            }
          }
          if (Array.isArray(rawSectores)) {
            for (const s of rawSectores) {
              const sTrim = String(s).trim();
              const sKey = normGeoKey(sTrim);
              if (sKey) {
                const currentSec = sectorMap.get(sKey);
                if (!currentSec) {
                  sectorMap.set(sKey, sTrim);
                } else if (/[áéíóúÁÉÍÓÚñÑ]/.test(sTrim) && !/[áéíóúÁÉÍÓÚñÑ]/.test(currentSec)) {
                  sectorMap.set(sKey, sTrim);
                }
              }
            }
          }

          const uniqueSectores = Array.from(sectorMap.values()).sort((a, b) =>
            a.localeCompare(b, "es", { sensitivity: "base" })
          );

          canonicalMap.set(key, {
            parroquia: bestParroquiaName,
            municipio: existing?.municipio || municipio,
            estado: existing?.estado || estado,
            sectores: uniqueSectores,
          });
        }
      }
    }

    const list = Array.from(canonicalMap.values()).sort((a, b) =>
      a.parroquia.localeCompare(b.parroquia, "es", { sensitivity: "base" })
    );

    // Mapeo accesible por nombre exacto, minúsculas y clave normalizada
    const lookupMap = new Map<string, ParroquiaItem>();
    for (const item of list) {
      lookupMap.set(item.parroquia, item);
      lookupMap.set(item.parroquia.toLowerCase(), item);
      lookupMap.set(normGeoKey(item.parroquia), item);
    }

    return { parroquiasList: list, parroquiaMap: lookupMap };
  }, [metadata.geoHierarchy]);

  // ── 3. MAPA DE REGISTROS DE LA FECHA SELECCIONADA ─────────────────────────
  const dayRecordsMap = useMemo(() => {
    const map = new Map<string, PlanningSheetRecord>();
    for (const rec of existingRecords) {
      if (rec.isoFecha === selectedDate && rec.asesor) {
        map.set(rec.asesor.trim().toLowerCase(), rec);
      }
    }
    return map;
  }, [existingRecords, selectedDate]);

  // Cambio de fecha por paso (adelantar o retrasar un día)
  const advanceDay = (offsetDays: number) => {
    try {
      const parts = selectedDate.split("-").map(Number);
      const current = new Date(parts[0], parts[1] - 1, parts[2]);
      current.setDate(current.getDate() + offsetDays);
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, "0");
      const d = String(current.getDate()).padStart(2, "0");
      setSelectedDate(`${y}-${m}-${d}`);
      setDrafts({});
      setSavingStatus({});
      setFeedbackMessage(null);
    } catch {
      // Fallback
    }
  };

  // Formato legible para el encabezado
  const formatNaturalDate = (isoStr: string) => {
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
        const canonicalItem = record.parroquia ? parroquiaMap.get(record.parroquia) : null;
        return {
          parroquia: canonicalItem?.parroquia || record.parroquia || "",
          sector: record.sector || "",
          actividad: record.tipo_actividad || "Recorrido con Instaladores",
        };
      }

      return {
        parroquia: "",
        sector: "",
        actividad: "Recorrido con Instaladores",
      };
    },
    [drafts, dayRecordsMap, parroquiaMap]
  );

  // ── 6. AUTOGUARDADO AUTOMÁTICO AL COMPLETAR TODOS LOS CAMPOS ──────────────
  const triggerAutoSave = async (
    adv: string,
    draftToSave: { parroquia: string; sector: string; actividad: string }
  ) => {
    const advKey = adv.trim().toLowerCase();
    setSavingStatus((prev) => ({ ...prev, [advKey]: "saving" }));
    setFeedbackMessage(null);

    const existingRec = dayRecordsMap.get(advKey);
    const geo = parroquiaMap.get(draftToSave.parroquia);

    const item: NewPlanningItem = {
      fecha: selectedDate,
      mes: getMonthFromDate(selectedDate) || defaultMonth,
      asesor: adv,
      estado: geo?.estado || "Miranda",
      municipio: geo?.municipio || "Carrizal",
      parroquia: draftToSave.parroquia,
      sector: draftToSave.sector,
      tipo_actividad: draftToSave.actividad,
      estatus: "Planificado",
    };

    try {
      let res;
      if (existingRec && existingRec.sheetRowIndex) {
        // Actualizar fila existente
        res = await fetch("/api/planificacion", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sheetRowIndex: existingRec.sheetRowIndex,
            item,
          }),
        });
      } else {
        // Crear nueva fila
        res = await fetch("/api/planificacion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: [item] }),
        });
      }

      const json = await res.json();
      if (json.success) {
        setSavingStatus((prev) => ({ ...prev, [advKey]: "saved" }));
        onSuccess(1);
      } else {
        setSavingStatus((prev) => ({ ...prev, [advKey]: "error" }));
        setFeedbackMessage(json.error || `Error al guardar ${adv}.`);
      }
    } catch (err: any) {
      console.error("Error al autoguardar asesor:", err);
      setSavingStatus((prev) => ({ ...prev, [advKey]: "error" }));
      setFeedbackMessage(`Error de red al guardar ${adv}.`);
    }
  };

  // Manejador de cambio de campo con autoguardado si todos los campos están llenos
  const handleFieldChange = (
    adv: string,
    field: "parroquia" | "sector" | "actividad",
    val: string
  ) => {
    const currentDraft = getAdvisorDraft(adv);
    let updatedDraft = { ...currentDraft, [field]: val };

    if (field === "parroquia") {
      // Al cambiar parroquia, se resetea sector para que el usuario seleccione el correspondiente
      updatedDraft.sector = "";
    }

    setDrafts((prev) => ({
      ...prev,
      [adv]: updatedDraft,
    }));

    // Verificar si todos los campos están seleccionados
    const isComplete =
      updatedDraft.parroquia.trim() !== "" &&
      updatedDraft.sector.trim() !== "" &&
      updatedDraft.actividad.trim() !== "";

    if (isComplete) {
      triggerAutoSave(adv, updatedDraft);
    }
  };

  // ── 7. ELIMINAR JORNADA CON CONFIRMACIÓN ──────────────────────────────────
  const handleConfirmDelete = async () => {
    if (!recordToDelete) return;
    setIsDeleting(true);

    const advKey = recordToDelete.asesor.trim().toLowerCase();

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
        // Reset local draft & status
        setDrafts((prev) => ({
          ...prev,
          [recordToDelete.asesor]: {
            parroquia: "",
            sector: "",
            actividad: "Recorrido con Instaladores",
          },
        }));
        setSavingStatus((prev) => {
          const next = { ...prev };
          delete next[advKey];
          return next;
        });
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
      if (draft.sector && draft.parroquia) {
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

    if (items.length === 0) {
      setFeedbackMessage("Ningún asesor pendiente tiene parroquia y sector asignados.");
      setIsSavingAll(false);
      return;
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

  const isToday = selectedDate === todayIso;

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

        {/* Controles de cambio de fecha integrados */}
        <div className="flex items-center gap-2 text-xs">
          {/* Botón rápido para volver a hoy si se navega a otra fecha */}
          {!isToday && (
            <button
              type="button"
              onClick={() => {
                setSelectedDate(todayIso);
                setDrafts({});
                setSavingStatus({});
                setFeedbackMessage(null);
              }}
              className="text-neutral-500 hover:text-neutral-900 transition-colors px-1.5 py-0.5 text-xs font-medium cursor-pointer"
              title="Volver al día de hoy"
            >
              Hoy
            </button>
          )}

          {/* Flecha izquierda */}
          <button
            type="button"
            onClick={() => advanceDay(-1)}
            className="text-neutral-400 hover:text-neutral-900 transition-colors p-1 cursor-pointer"
            title="Día anterior"
          >
            <ChevronLeft className="w-4 h-4 stroke-[1.5]" />
          </button>

          {/* Botón central: Muestra "Hoy" o la fecha (DD/MM/YYYY) dentro de los botones */}
          <div className="relative inline-flex items-center">
            <button
              type="button"
              onClick={() => {
                if (dateInputRef.current) {
                  try {
                    dateInputRef.current.showPicker();
                  } catch {
                    dateInputRef.current.focus();
                  }
                }
              }}
              className="text-neutral-900 font-medium px-2 py-0.5 text-center select-none font-mono text-xs cursor-pointer hover:text-neutral-600 transition-colors"
              title="Clic para seleccionar fecha en el calendario"
            >
              {formatButtonDate(selectedDate, todayIso)}
            </button>

            {/* Input date invisible sobre el botón para invocar el calendario directamente */}
            <input
              ref={dateInputRef}
              type="date"
              value={selectedDate}
              onChange={(e) => {
                if (e.target.value) {
                  setSelectedDate(e.target.value);
                  setDrafts({});
                  setSavingStatus({});
                  setFeedbackMessage(null);
                }
              }}
              className="sr-only"
              tabIndex={-1}
            />
          </div>

          {/* Flecha derecha */}
          <button
            type="button"
            onClick={() => advanceDay(1)}
            className="text-neutral-400 hover:text-neutral-900 transition-colors p-1 cursor-pointer"
            title="Día siguiente"
          >
            <ChevronRight className="w-4 h-4 stroke-[1.5]" />
          </button>
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
            const advKey = adv.trim().toLowerCase();
            const existingRec = dayRecordsMap.get(advKey);
            const isPlanned = Boolean(existingRec);
            const draft = getAdvisorDraft(adv);
            const status = savingStatus[advKey] || (isPlanned ? "saved" : "idle");
            const isSavingThis = status === "saving";

            // Sectores disponibles para la parroquia seleccionada en este asesor
            const availableSectores = draft.parroquia
              ? parroquiaMap.get(draft.parroquia)?.sectores || []
              : [];

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
                            Planificado
                          </span>
                        ) : (
                          <span>Sin planificar</span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* En móvil: indicador de estado o eliminación */}
                  <div className="flex items-center gap-2 md:hidden">
                    {isSavingThis ? (
                      <Loader2 className="w-4 h-4 animate-spin text-neutral-400 stroke-[1.5]" />
                    ) : isPlanned || status === "saved" ? (
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-neutral-900 stroke-[2] animate-in zoom-in-75 duration-150" />
                        {existingRec && (
                          <button
                            type="button"
                            onClick={() => setRecordToDelete(existingRec)}
                            className="text-neutral-400 hover:text-neutral-900 transition-colors p-1 cursor-pointer"
                            title="Eliminar jornada"
                          >
                            <X className="w-3.5 h-3.5 stroke-[1.5]" />
                          </button>
                        )}
                      </div>
                    ) : null}
                  </div>
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
                      onChange={(p) => handleFieldChange(adv, "parroquia", p)}
                      compact
                      placeholder="Seleccionar parroquia..."
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
                      onChange={(s) => handleFieldChange(adv, "sector", s)}
                      compact
                      disabled={!draft.parroquia}
                      placeholder={
                        draft.parroquia
                          ? "Seleccionar sector..."
                          : "Elige primero parroquia..."
                      }
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
                      onChange={(a) => handleFieldChange(adv, "actividad", a)}
                      compact
                      placeholder="Seleccionar actividad..."
                    />
                  </div>
                </div>

                {/* 3. Indicador de guardado automático (Cargando / Check / Eliminar) */}
                <div className="hidden md:flex items-center justify-end gap-2.5 shrink-0 min-w-[70px]">
                  {isSavingThis ? (
                    <div
                      className="flex items-center gap-1.5 text-xs text-neutral-500 py-1"
                      title="Guardando automáticamente en Google Sheets..."
                    >
                      <Loader2 className="w-4 h-4 animate-spin text-neutral-400 stroke-[1.5]" />
                      <span className="text-[11px] font-mono">Guardando</span>
                    </div>
                  ) : isPlanned || status === "saved" ? (
                    <div className="flex items-center gap-2">
                      <div
                        className="flex items-center text-neutral-900 py-1"
                        title="Guardado exitosamente en Google Sheets"
                      >
                        <Check className="w-4 h-4 text-neutral-900 stroke-[2] animate-in zoom-in-75 duration-150" />
                      </div>
                      {existingRec && (
                        <button
                          type="button"
                          onClick={() => setRecordToDelete(existingRec)}
                          className="text-neutral-300 hover:text-neutral-900 transition-colors p-1 cursor-pointer"
                          title="Eliminar jornada de la hoja Data"
                        >
                          <X className="w-3.5 h-3.5 stroke-[1.5]" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className="text-[11px] text-neutral-300 py-1">
                      Pendiente
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── MODAL MINIMALISTA DE CONFIRMACIÓN DE ELIMINACIÓN ──────────────── */}
      <DeleteConfirmDialog
        isOpen={Boolean(recordToDelete)}
        title="Eliminar jornada de planificación"
        description={
          recordToDelete
            ? `¿Deseas eliminar la jornada de ${recordToDelete.asesor} para el ${recordToDelete.fecha} (${recordToDelete.sector}) de la hoja Data?`
            : ""
        }
        confirmLabel="Eliminar jornada"
        onCancel={() => setRecordToDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
