"use client";

import { useState, useMemo, useCallback, useRef, useEffect, memo } from "react";
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
  initialDate?: string;
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

interface AdvisorDailyRowProps {
  adv: string;
  initials: string;
  isPlanned: boolean;
  isSelected: boolean;
  showBulkTool: boolean;
  draft: { parroquia: string; sector: string; actividad: string };
  status: "idle" | "saving" | "saved" | "error";
  existingRec?: PlanningSheetRecord;
  parroquiasOptions: { value: string; label: string }[];
  sectorOptions: { value: string; label: string }[];
  activitiesOptions: { value: string; label: string }[];
  onToggleSelect: (adv: string) => void;
  onFieldChange: (adv: string, field: "parroquia" | "sector" | "actividad", val: string) => void;
  onRequestDelete: (rec: PlanningSheetRecord) => void;
}

const AdvisorDailyRow = memo(function AdvisorDailyRow({
  adv,
  initials,
  isPlanned,
  isSelected,
  showBulkTool,
  draft,
  status,
  existingRec,
  parroquiasOptions,
  sectorOptions,
  activitiesOptions,
  onToggleSelect,
  onFieldChange,
  onRequestDelete,
}: AdvisorDailyRowProps) {
  const isSavingThis = status === "saving";

  return (
    <div
      onClick={() => {
        if (showBulkTool) {
          onToggleSelect(adv);
        }
      }}
      className={cn(
        "py-3 px-1 transition-colors group flex flex-col md:flex-row md:items-center justify-between gap-3",
        isSelected
          ? "bg-neutral-50/80"
          : isPlanned
          ? "hover:bg-neutral-50/40"
          : "hover:bg-neutral-50/20"
      )}
    >
      {/* 1. Nombre del asesor y estado */}
      <div className="flex items-center justify-between md:justify-start gap-3 min-w-[200px]">
        <div className="flex items-center gap-2.5">
          {showBulkTool && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelect(adv);
              }}
              className="p-0.5 text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer shrink-0"
              title={isSelected ? "Deseleccionar asesor" : "Seleccionar asesor"}
            >
              <span
                className={cn(
                  "w-4 h-4 rounded-full flex items-center justify-center transition-colors",
                  isSelected
                    ? "bg-neutral-900 text-white"
                    : "border border-neutral-300 hover:border-neutral-700 bg-transparent"
                )}
              >
                {isSelected && <Check className="w-2.5 h-2.5 stroke-[2.5]" />}
              </span>
            </button>
          )}

          <span
            className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center text-[11px] shrink-0 font-medium transition-colors",
              isPlanned
                ? "bg-neutral-900 text-white"
                : "bg-neutral-100 text-neutral-500"
            )}
          >
            {initials}
          </span>

          <div>
            <span
              className={cn(
                "text-xs block transition-colors",
                isSelected
                  ? "font-semibold text-neutral-900"
                  : "font-medium text-neutral-900"
              )}
            >
              {adv}
            </span>
            <span className="text-[11px] block">
              {isPlanned ? (
                <span className="text-neutral-600 font-medium">Planificado</span>
              ) : (
                <span className="text-neutral-400">Sin planificar</span>
              )}
            </span>
          </div>
        </div>

        {/* En móvil: indicador de estado o eliminación */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-2 md:hidden"
        >
          {isSavingThis ? (
            <Loader2 className="w-4 h-4 animate-spin text-neutral-400 stroke-[1.5]" />
          ) : isPlanned || status === "saved" ? (
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-neutral-900 stroke-[2] animate-in zoom-in-75 duration-150" />
              {existingRec && (
                <button
                  type="button"
                  onClick={() => onRequestDelete(existingRec)}
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
      <div
        onClick={(e) => e.stopPropagation()}
        className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1 max-w-2xl"
      >
        <div>
          <label className="text-[10px] text-neutral-400 block mb-0.5 md:hidden">
            Parroquia
          </label>
          <CustomDropdown
            value={draft.parroquia}
            options={parroquiasOptions}
            onChange={(p) => onFieldChange(adv, "parroquia", p)}
            compact
            placeholder="Seleccionar parroquia..."
          />
        </div>

        <div>
          <label className="text-[10px] text-neutral-400 block mb-0.5 md:hidden">
            Sector
          </label>
          <CustomDropdown
            value={draft.sector}
            options={sectorOptions}
            onChange={(s) => onFieldChange(adv, "sector", s)}
            compact
            placeholder={
              draft.parroquia ? "Seleccionar sector..." : "Elige parroquia primero..."
            }
          />
        </div>

        <div>
          <label className="text-[10px] text-neutral-400 block mb-0.5 md:hidden">
            Actividad
          </label>
          <CustomDropdown
            value={draft.actividad}
            options={activitiesOptions}
            onChange={(a) => onFieldChange(adv, "actividad", a)}
            compact
            placeholder="Seleccionar actividad..."
          />
        </div>
      </div>

      {/* 3. Indicador de guardado automático (Cargando / Check / Eliminar con hover sutil) */}
      <div className="hidden md:flex items-center justify-end gap-2.5 shrink-0 min-w-[70px]">
        {isSavingThis ? (
          <div
            className="flex items-center gap-1.5 text-xs text-neutral-500 py-1"
            title="Guardando automáticamente en Google Sheets y Base de Datos..."
          >
            <Loader2 className="w-4 h-4 animate-spin text-neutral-400 stroke-[1.5]" />
            <span className="text-[11px] font-mono">Guardando</span>
          </div>
        ) : isPlanned || status === "saved" ? (
          <div className="flex items-center gap-2">
            <div
              className="flex items-center text-neutral-900 py-1"
              title="Guardado exitosamente"
            >
              <Check className="w-4 h-4 text-neutral-900 stroke-[2] animate-in zoom-in-75 duration-150" />
            </div>
            {existingRec && (
              <button
                type="button"
                onClick={() => onRequestDelete(existingRec)}
                className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-neutral-400 hover:text-neutral-900 p-1 cursor-pointer"
                title="Eliminar jornada"
              >
                <X className="w-3.5 h-3.5 stroke-[1.5]" />
              </button>
            )}
          </div>
        ) : (
          <span className="text-[11px] text-neutral-300 py-1">Pendiente</span>
        )}
      </div>
    </div>
  );
});

export function PlanificadorDailySheet({
  metadata,
  existingRecords,
  onSuccess,
  defaultMonth,
  initialDate,
}: PlanificadorDailySheetProps) {
  // Fecha de hoy en formato ISO (YYYY-MM-DD)
  const todayIso = useMemo(() => new Date().toISOString().split("T")[0], []);

  // ── 1. DÍA DE LA PLANIFICACIÓN (FECHA ANCLA) ──────────────────────────────
  const [selectedDate, setSelectedDate] = useState<string>(
    initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate) ? initialDate : todayIso
  );
  const dateInputRef = useRef<HTMLInputElement>(null);

  // Sincronizar fecha inicial si cambia desde el exterior
  useEffect(() => {
    if (initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate)) {
      setSelectedDate(initialDate);
    }
  }, [initialDate]);

  // Filtros de búsqueda en la lista de asesores
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "planned">("all");

  // Estado de autoguardado por asesor: advKey -> "idle" | "saving" | "saved" | "error"
  const [savingStatus, setSavingStatus] = useState<Record<string, "idle" | "saving" | "saved" | "error">>({});

  // Eliminación de jornada
  const [recordToDelete, setRecordToDelete] = useState<PlanningSheetRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Herramienta de asignación rápida (separada: Dirección vs Actividad)
  const [showBulkTool, setShowBulkTool] = useState<boolean>(false);
  const [bulkMode, setBulkMode] = useState<"direccion" | "actividad">("direccion");
  const [bulkParroquia, setBulkParroquia] = useState<string>("Carrizal");
  const [bulkSector, setBulkSector] = useState<string>("Casco Central");
  const [bulkActivity, setBulkActivity] = useState<string>("Recorrido con Instaladores");
  const [selectedAdvisors, setSelectedAdvisors] = useState<Set<string>>(new Set());
  const [isApplyingBulk, setIsApplyingBulk] = useState<boolean>(false);

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

  // Catálogo unificado de sectores con su parroquia para cuando no se haya filtrado parroquia
  const allSectorOptions = useMemo(() => {
    const list: { value: string; label: string }[] = [];
    const seen = new Set<string>();

    for (const item of metadata.sectorsCatalog || []) {
      const key = `${item.sector}__${item.parroquia}`;
      if (!seen.has(key)) {
        seen.add(key);
        list.push({
          value: key,
          label: `${item.sector} (${item.parroquia})`,
        });
      }
    }

    return list.sort((a, b) => a.label.localeCompare(b.label, "es", { sensitivity: "base" }));
  }, [metadata.sectorsCatalog]);

  // Opciones precomputadas estables para evitar re-renders en AdvisorDailyRow
  const parroquiasOptions = useMemo(
    () => parroquiasList.map((p) => ({ value: p.parroquia, label: p.parroquia })),
    [parroquiasList]
  );

  const activitiesOptions = useMemo(
    () => metadata.activities.map((a) => ({ value: a, label: a })),
    [metadata.activities]
  );

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
    let updatedDraft = { ...currentDraft };

    if (field === "sector") {
      // Si el valor viene codificado como "sector__parroquia" (al elegir sector sin tener parroquia previa)
      if (val.includes("__")) {
        const [secName, parName] = val.split("__");
        updatedDraft.sector = secName;
        updatedDraft.parroquia = parName;
      } else {
        updatedDraft.sector = val;
      }
    } else if (field === "parroquia") {
      updatedDraft.parroquia = val;
      // Al cambiar parroquia, verificar si el sector actual pertenece a ella; si no, resetearlo
      const sectorsInPar = parroquiaMap.get(val)?.sectores || [];
      if (!sectorsInPar.includes(currentDraft.sector)) {
        updatedDraft.sector = "";
      }
    } else {
      updatedDraft.actividad = val;
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
    const deletedAdvisor = recordToDelete.asesor;

    // Reset optimista inmediato para respuesta instantánea
    setDrafts((prev) => ({
      ...prev,
      [deletedAdvisor]: {
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

    try {
      const params = new URLSearchParams();
      if (recordToDelete.id) params.set("id", String(recordToDelete.id));
      if (recordToDelete.sheetRowIndex) {
        params.set("sheetRowIndex", String(recordToDelete.sheetRowIndex));
      }
      if (recordToDelete.isoFecha) params.set("fecha", recordToDelete.isoFecha);
      if (recordToDelete.asesor) params.set("asesor", recordToDelete.asesor);

      const res = await fetch(`/api/planificacion?${params.toString()}`, {
        method: "DELETE",
      });
      const json = await res.json();

      if (json.success) {
        setFeedbackMessage(
          `Jornada de ${deletedAdvisor} eliminada correctamente.`
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

  // ── 8. SELECCIÓN Y ASIGNACIÓN RÁPIDA (DIRECCIÓN / ACTIVIDAD) ───────────────
  const toggleAdvisorSelection = (adv: string) => {
    const key = adv.trim().toLowerCase();
    setSelectedAdvisors((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const selectAllAdvisors = () => {
    const allKeys = new Set(metadata.advisors.map((a) => a.trim().toLowerCase()));
    setSelectedAdvisors(allKeys);
  };

  const selectPendingAdvisors = () => {
    const pendingKeys = new Set(
      metadata.advisors
        .filter((a) => !dayRecordsMap.has(a.trim().toLowerCase()))
        .map((a) => a.trim().toLowerCase())
    );
    setSelectedAdvisors(pendingKeys);
  };

  const clearSelectedAdvisors = () => {
    setSelectedAdvisors(new Set());
  };

  // Asignar Dirección (Parroquia y Sector) a los asesores seleccionados
  const applyBulkDireccion = async () => {
    if (selectedAdvisors.size === 0 || !bulkParroquia || !bulkSector) return;
    setIsApplyingBulk(true);

    const targetAdvisors = metadata.advisors.filter((adv) =>
      selectedAdvisors.has(adv.trim().toLowerCase())
    );

    const updatedDrafts = { ...drafts };
    const itemsToCreate: NewPlanningItem[] = [];
    const itemsToUpdate: { sheetRowIndex: number; item: NewPlanningItem; advKey: string }[] = [];
    const targetKeys = targetAdvisors.map((a) => a.trim().toLowerCase());

    const geo = parroquiaMap.get(bulkParroquia);

    for (const adv of targetAdvisors) {
      const advKey = adv.trim().toLowerCase();
      const current = getAdvisorDraft(adv);
      const updated = {
        ...current,
        parroquia: bulkParroquia,
        sector: bulkSector,
        actividad: current.actividad || "Recorrido con Instaladores",
      };
      updatedDrafts[adv] = updated;

      const existingRec = dayRecordsMap.get(advKey);
      const planningItem: NewPlanningItem = {
        fecha: selectedDate,
        mes: getMonthFromDate(selectedDate) || defaultMonth,
        asesor: adv,
        estado: geo?.estado || "Miranda",
        municipio: geo?.municipio || "Carrizal",
        parroquia: bulkParroquia,
        sector: bulkSector,
        tipo_actividad: updated.actividad,
        estatus: "Planificado",
      };

      if (existingRec && existingRec.sheetRowIndex) {
        itemsToUpdate.push({
          sheetRowIndex: existingRec.sheetRowIndex,
          item: planningItem,
          advKey,
        });
      } else {
        itemsToCreate.push(planningItem);
      }
    }

    setDrafts(updatedDrafts);

    // Marcar visualmente "saving" por cada asesor
    setSavingStatus((prev) => {
      const next = { ...prev };
      targetKeys.forEach((k) => (next[k] = "saving"));
      return next;
    });

    try {
      const promises: Promise<any>[] = [];

      // Crear nuevos registros en un solo lote eficiente
      if (itemsToCreate.length > 0) {
        promises.push(
          fetch("/api/planificacion", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: itemsToCreate }),
          }).then(async (res) => {
            const json = await res.json();
            if (!json.success) throw new Error(json.error || "Error al crear jornadas");
            return json;
          })
        );
      }

      // Actualizar registros existentes en un solo lote eficiente (Batch PUT)
      if (itemsToUpdate.length > 0) {
        promises.push(
          fetch("/api/planificacion", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ updates: itemsToUpdate }),
          }).then(async (res) => {
            const json = await res.json();
            if (!json.success) throw new Error(json.error || "Error al actualizar jornadas");
            return json;
          })
        );
      }

      await Promise.all(promises);

      // Marcar como guardados con checkmark
      setSavingStatus((prev) => {
        const next = { ...prev };
        targetKeys.forEach((k) => (next[k] = "saved"));
        return next;
      });

      onSuccess(targetAdvisors.length);
      setFeedbackMessage(
        `Dirección (${bulkSector}, ${bulkParroquia}) guardada para ${targetAdvisors.length} asesores.`
      );
      clearSelectedAdvisors();
    } catch (err: any) {
      console.error("Error al aplicar dirección rápida:", err);
      setSavingStatus((prev) => {
        const next = { ...prev };
        targetKeys.forEach((k) => (next[k] = "error"));
        return next;
      });
      setFeedbackMessage(err.message || "Error al guardar la asignación rápida.");
    } finally {
      setIsApplyingBulk(false);
    }
  };

  // Asignar Actividad a los asesores seleccionados
  const applyBulkActividad = async () => {
    if (selectedAdvisors.size === 0 || !bulkActivity) return;
    setIsApplyingBulk(true);

    const targetAdvisors = metadata.advisors.filter((adv) =>
      selectedAdvisors.has(adv.trim().toLowerCase())
    );

    const updatedDrafts = { ...drafts };
    const itemsToCreate: NewPlanningItem[] = [];
    const itemsToUpdate: { sheetRowIndex: number; item: NewPlanningItem; advKey: string }[] = [];
    const targetKeys = targetAdvisors.map((a) => a.trim().toLowerCase());

    for (const adv of targetAdvisors) {
      const advKey = adv.trim().toLowerCase();
      const current = getAdvisorDraft(adv);
      const updated = {
        ...current,
        actividad: bulkActivity,
      };
      updatedDrafts[adv] = updated;

      // Solo se persiste en base de datos si ya tiene parroquia y sector asignados
      if (updated.parroquia && updated.sector) {
        const existingRec = dayRecordsMap.get(advKey);
        const geo = parroquiaMap.get(updated.parroquia);

        const planningItem: NewPlanningItem = {
          fecha: selectedDate,
          mes: getMonthFromDate(selectedDate) || defaultMonth,
          asesor: adv,
          estado: geo?.estado || "Miranda",
          municipio: geo?.municipio || "Carrizal",
          parroquia: updated.parroquia,
          sector: updated.sector,
          tipo_actividad: bulkActivity,
          estatus: "Planificado",
        };

        if (existingRec && existingRec.sheetRowIndex) {
          itemsToUpdate.push({
            sheetRowIndex: existingRec.sheetRowIndex,
            item: planningItem,
            advKey,
          });
        } else {
          itemsToCreate.push(planningItem);
        }
      }
    }

    setDrafts(updatedDrafts);

    if (itemsToCreate.length === 0 && itemsToUpdate.length === 0) {
      setFeedbackMessage(
        `Actividad (${bulkActivity}) asignada a ${targetAdvisors.length} asesores (pendiente asignarles dirección para guardar).`
      );
      setIsApplyingBulk(false);
      clearSelectedAdvisors();
      return;
    }

    const keysToSave = [
      ...itemsToCreate.map((x) => x.asesor.trim().toLowerCase()),
      ...itemsToUpdate.map((x) => x.advKey),
    ];

    setSavingStatus((prev) => {
      const next = { ...prev };
      keysToSave.forEach((k) => (next[k] = "saving"));
      return next;
    });

    try {
      const promises: Promise<any>[] = [];

      if (itemsToCreate.length > 0) {
        promises.push(
          fetch("/api/planificacion", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: itemsToCreate }),
          }).then(async (res) => {
            const json = await res.json();
            if (!json.success) throw new Error(json.error || "Error al crear jornadas");
            return json;
          })
        );
      }

      // Actualizar registros existentes en un solo lote eficiente (Batch PUT)
      if (itemsToUpdate.length > 0) {
        promises.push(
          fetch("/api/planificacion", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ updates: itemsToUpdate }),
          }).then(async (res) => {
            const json = await res.json();
            if (!json.success) throw new Error(json.error || "Error al actualizar jornadas");
            return json;
          })
        );
      }

      await Promise.all(promises);

      setSavingStatus((prev) => {
        const next = { ...prev };
        keysToSave.forEach((k) => (next[k] = "saved"));
        return next;
      });

      onSuccess(keysToSave.length);
      setFeedbackMessage(
        `Actividad (${bulkActivity}) guardada para ${keysToSave.length} asesores.`
      );
      clearSelectedAdvisors();
    } catch (err: any) {
      console.error("Error al aplicar actividad rápida:", err);
      setSavingStatus((prev) => {
        const next = { ...prev };
        keysToSave.forEach((k) => (next[k] = "error"));
        return next;
      });
      setFeedbackMessage(err.message || "Error al guardar la actividad.");
    } finally {
      setIsApplyingBulk(false);
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
            onClick={() => {
              setShowBulkTool(!showBulkTool);
              if (showBulkTool) {
                clearSelectedAdvisors();
              }
            }}
            className={cn(
              "transition-colors cursor-pointer flex items-center gap-1",
              showBulkTool
                ? "text-neutral-900 font-semibold"
                : "text-neutral-500 hover:text-neutral-900"
            )}
          >
            <Copy className="w-3 h-3 stroke-[1.25]" />
            <span>{showBulkTool ? "Ocultar asignación rápida" : "Asignación rápida"}</span>
          </button>
        </div>
      </div>

      {/* ── PANEL DESPLEGABLE DE ASIGNACIÓN RÁPIDA (DIRECCIÓN / ACTIVIDAD) ── */}
      {showBulkTool && (
        <div className="space-y-3 py-3 px-1 border-b border-neutral-100 animate-in fade-in duration-150">
          {/* Fila superior: Selector de Modo (Dirección vs Actividad) y Selección de Asesores */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-neutral-100">
            {/* Selector de modo */}
            <div className="flex items-center gap-4 text-xs">
              <button
                type="button"
                onClick={() => setBulkMode("direccion")}
                className={cn(
                  "cursor-pointer transition-colors pb-0.5",
                  bulkMode === "direccion"
                    ? "text-neutral-900 font-semibold border-b border-neutral-900"
                    : "text-neutral-400 hover:text-neutral-700"
                )}
              >
                Asignar dirección
              </button>
              <button
                type="button"
                onClick={() => setBulkMode("actividad")}
                className={cn(
                  "cursor-pointer transition-colors pb-0.5",
                  bulkMode === "actividad"
                    ? "text-neutral-900 font-semibold border-b border-neutral-900"
                    : "text-neutral-400 hover:text-neutral-700"
                )}
              >
                Asignar actividad
              </button>
            </div>

            {/* Atajos de selección */}
            <div className="flex items-center gap-2.5 text-xs text-neutral-500 flex-wrap">
              <span
                className={cn(
                  selectedAdvisors.size > 0
                    ? "text-neutral-900 font-medium"
                    : "text-neutral-400"
                )}
              >
                {selectedAdvisors.size === 0
                  ? "Clic en asesores abajo para seleccionar"
                  : `${selectedAdvisors.size} ${
                      selectedAdvisors.size === 1 ? "seleccionado" : "seleccionados"
                    }`}
              </span>
              <span className="text-neutral-200">·</span>
              <button
                type="button"
                onClick={selectPendingAdvisors}
                className="hover:text-neutral-900 transition-colors cursor-pointer text-[11px]"
                title="Seleccionar todos los asesores pendientes"
              >
                Pendientes ({pendingCount})
              </button>
              <button
                type="button"
                onClick={selectAllAdvisors}
                className="hover:text-neutral-900 transition-colors cursor-pointer text-[11px]"
                title="Seleccionar todos los asesores"
              >
                Todos ({totalCount})
              </button>
              {selectedAdvisors.size > 0 && (
                <>
                  <span className="text-neutral-200">·</span>
                  <button
                    type="button"
                    onClick={clearSelectedAdvisors}
                    className="hover:text-neutral-900 transition-colors cursor-pointer text-[11px]"
                  >
                    Limpiar
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Formulario según el modo seleccionado */}
          {bulkMode === "direccion" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 items-end">
              <div>
                <label className="text-[11px] text-neutral-400 block mb-0.5">
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
                <label className="text-[11px] text-neutral-400 block mb-0.5">
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

              <div className="pt-1">
                <button
                  type="button"
                  onClick={applyBulkDireccion}
                  disabled={
                    selectedAdvisors.size === 0 ||
                    !bulkParroquia ||
                    !bulkSector ||
                    isApplyingBulk
                  }
                  className="text-xs font-semibold text-neutral-900 hover:text-neutral-600 disabled:opacity-35 transition-colors cursor-pointer flex items-center gap-1.5 py-1.5"
                >
                  {isApplyingBulk ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin stroke-[1.25]" />
                  ) : (
                    <Check className="w-3.5 h-3.5 stroke-[2]" />
                  )}
                  <span>
                    {selectedAdvisors.size === 0
                      ? "Selecciona asesores abajo"
                      : `Aplicar dirección a los ${selectedAdvisors.size} seleccionados`}
                  </span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 items-end">
              <div className="sm:col-span-1 md:col-span-2">
                <label className="text-[11px] text-neutral-400 block mb-0.5">
                  Actividad
                </label>
                <CustomDropdown
                  value={bulkActivity}
                  options={metadata.activities.map((a) => ({
                    value: a,
                    label: a,
                  }))}
                  onChange={setBulkActivity}
                  compact
                />
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={applyBulkActividad}
                  disabled={
                    selectedAdvisors.size === 0 ||
                    !bulkActivity ||
                    isApplyingBulk
                  }
                  className="text-xs font-semibold text-neutral-900 hover:text-neutral-600 disabled:opacity-35 transition-colors cursor-pointer flex items-center gap-1.5 py-1.5"
                >
                  {isApplyingBulk ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin stroke-[1.25]" />
                  ) : (
                    <Check className="w-3.5 h-3.5 stroke-[2]" />
                  )}
                  <span>
                    {selectedAdvisors.size === 0
                      ? "Selecciona asesores abajo"
                      : `Aplicar actividad a los ${selectedAdvisors.size} seleccionados`}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ENCABEZADO DE COLUMNAS (DESKTOP) ────────────────────────────── */}
      <div className="hidden md:flex items-center justify-between text-[11px] font-medium text-neutral-400 pb-2 border-b border-neutral-100 px-1">
        <div className="min-w-[200px] flex items-center gap-2">
          {showBulkTool && (
            <button
              type="button"
              onClick={
                selectedAdvisors.size === metadata.advisors.length
                  ? clearSelectedAdvisors
                  : selectAllAdvisors
              }
              className="p-0.5 text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
              title={
                selectedAdvisors.size === metadata.advisors.length
                  ? "Deseleccionar todos"
                  : "Seleccionar todos"
              }
            >
              <span
                className={cn(
                  "w-4 h-4 rounded-full flex items-center justify-center transition-colors",
                  selectedAdvisors.size === metadata.advisors.length &&
                    metadata.advisors.length > 0
                    ? "bg-neutral-900 text-white"
                    : "border border-neutral-300 hover:border-neutral-700 bg-transparent"
                )}
              >
                {selectedAdvisors.size === metadata.advisors.length &&
                  metadata.advisors.length > 0 && (
                    <Check className="w-2.5 h-2.5 stroke-[2.5]" />
                  )}
              </span>
            </button>
          )}
          <span>Asesor</span>
        </div>
        <div className="grid grid-cols-3 gap-3 flex-1 max-w-2xl text-left">
          <span>Parroquia</span>
          <span>Sector</span>
          <span>Actividad</span>
        </div>
        <div className="min-w-[70px] text-right">Estado</div>
      </div>

      {/* ── LISTA DE ASESORES EN PANTALLA (OPTIMIZADA PARA MÓVILES Y DESKTOP) ── */}
      <div className="divide-y divide-neutral-100 pb-32">
        {displayAdvisors.length === 0 ? (
          <div className="py-12 text-center text-xs text-neutral-400">
            No se encontraron asesores con los filtros seleccionados.
          </div>
        ) : (
          displayAdvisors.map((adv) => {
            const advKey = adv.trim().toLowerCase();
            const existingRec = dayRecordsMap.get(advKey);
            const isPlanned = Boolean(existingRec);
            const isSelected = selectedAdvisors.has(advKey);
            const draft = getAdvisorDraft(adv);
            const status = savingStatus[advKey] || (isPlanned ? "saved" : "idle");

            const availableSectores = draft.parroquia
              ? parroquiaMap.get(draft.parroquia)?.sectores || []
              : [];

            const sectorOptions = draft.parroquia
              ? availableSectores.map((s) => ({ value: s, label: s }))
              : allSectorOptions;

            const initials = adv
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("")
              .toUpperCase();

            return (
              <AdvisorDailyRow
                key={adv}
                adv={adv}
                initials={initials}
                isPlanned={isPlanned}
                isSelected={isSelected}
                showBulkTool={showBulkTool}
                draft={draft}
                status={status}
                existingRec={existingRec}
                parroquiasOptions={parroquiasOptions}
                sectorOptions={sectorOptions}
                activitiesOptions={activitiesOptions}
                onToggleSelect={toggleAdvisorSelection}
                onFieldChange={handleFieldChange}
                onRequestDelete={setRecordToDelete}
              />
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
