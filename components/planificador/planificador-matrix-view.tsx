"use client";

import { useState, useMemo, useEffect } from "react";
import { ChevronLeft, ChevronRight, Plus, PenLine, X, Search, Copy, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PlanningSheetRecord,
  PlanningMetadata,
  NewPlanningItem,
  toIsoDateString,
  toSheetDateFormat,
  getMonthFromDate,
} from "@/lib/planificacion-types";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { CustomDropdown } from "@/components/ui/custom-dropdown";

interface PlanificadorMatrixViewProps {
  records: PlanningSheetRecord[];
  metadata: PlanningMetadata;
  selectedMonth?: string;
  onMonthChange?: (month: string) => void;
  onEditRecord: (record: PlanningSheetRecord) => void;
  onDeleteRecord: (record: PlanningSheetRecord) => Promise<boolean>;
  onQuickAdd: (advisor: string, isoDate: string) => void;
  onReplicateDay: (sourceIsoDate: string, targetIsoDate: string) => Promise<boolean>;
}

const DAYS_NAMES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export function PlanificadorMatrixView({
  records,
  metadata,
  selectedMonth,
  onMonthChange,
  onEditRecord,
  onDeleteRecord,
  onQuickAdd,
  onReplicateDay,
}: PlanificadorMatrixViewProps) {
  // Current reference date (defaults to today)
  const [currentWeekRefDate, setCurrentWeekRefDate] = useState<Date>(() => {
    const d = new Date();
    // Anchor to Monday of current week
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  });

  // Sincronizar semana de referencia cuando cambia selectedMonth desde el encabezado
  useEffect(() => {
    if (!selectedMonth) return;
    const SPANISH_MONTHS = [
      "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
      "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"
    ];
    const monthIdx = SPANISH_MONTHS.indexOf(selectedMonth.toUpperCase());
    if (monthIdx < 0) return;

    setCurrentWeekRefDate((cur) => {
      if (cur.getMonth() === monthIdx) return cur;

      const now = new Date();
      const currentYear = now.getFullYear();

      if (now.getMonth() === monthIdx) {
        // Mes actual: anclar a lunes de esta semana
        const d = new Date();
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
      } else {
        // Otro mes: anclar al primer lunes de ese mes
        const firstOfMonth = new Date(currentYear, monthIdx, 1);
        const day = firstOfMonth.getDay();
        const diff = firstOfMonth.getDate() - day + (day === 0 ? -6 : 1);
        firstOfMonth.setDate(diff);
        return firstOfMonth;
      }
    });
  }, [selectedMonth]);

  const [advisorSearch, setAdvisorSearch] = useState("");
  const [deletingRecord, setDeletingRecord] = useState<PlanningSheetRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Replication modal/dialog state
  const [showReplicateDialog, setShowReplicateDialog] = useState(false);
  const [replicateSourceDate, setReplicateSourceDate] = useState("");
  const [replicateTargetDate, setReplicateTargetDate] = useState("");
  const [isReplicating, setIsReplicating] = useState(false);
  const [replicateFeedback, setReplicateFeedback] = useState<string | null>(null);

  // Calculate the 6 days of the week (Monday to Saturday)
  const weekDays = useMemo(() => {
    const monday = new Date(currentWeekRefDate);
    // ensure Monday
    const day = monday.getDay();
    const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
    monday.setDate(diff);

    const days: { date: Date; iso: string; formatted: string; label: string }[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const iso = d.toISOString().split("T")[0];
      const dNum = d.getDate();
      const mNum = d.getMonth() + 1;
      const formatted = `${dNum}/${mNum}`;
      days.push({
        date: d,
        iso,
        formatted,
        label: DAYS_NAMES[i],
      });
    }
    return days;
  }, [currentWeekRefDate]);

  // Navigate weeks cleanly without feedback loops
  const prevWeek = () => {
    setCurrentWeekRefDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  };

  const nextWeek = () => {
    setCurrentWeekRefDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  };

  const currentMonthName = useMemo(() => {
    const m = currentWeekRefDate.getMonth();
    return metadata.months[m] || "";
  }, [currentWeekRefDate, metadata.months]);

  // Index records by advisor and date for quick matrix lookup
  const matrixMap = useMemo(() => {
    const map = new Map<string, PlanningSheetRecord[]>();
    for (const r of records) {
      if (!r.isoFecha || !r.asesor) continue;
      const key = `${r.asesor.trim().toLowerCase()}__${r.isoFecha}`;
      const existing = map.get(key) || [];
      existing.push(r);
      map.set(key, existing);
    }
    return map;
  }, [records]);

  // Filter advisors
  const displayAdvisors = useMemo(() => {
    if (!advisorSearch.trim()) return metadata.advisors;
    const q = advisorSearch.toLowerCase().trim();
    return metadata.advisors.filter((a) => a.toLowerCase().includes(q));
  }, [metadata.advisors, advisorSearch]);

  const confirmDelete = async () => {
    if (!deletingRecord) return;
    const target = deletingRecord;
    setDeletingRecord(null); // Cerrar modal inmediatamente (0 ms)
    onDeleteRecord(target).catch(() => {});
  };

  const handleStartReplication = () => {
    if (weekDays.length > 0) {
      setReplicateSourceDate(weekDays[0].iso);
      setReplicateTargetDate(weekDays[1]?.iso || weekDays[0].iso);
    }
    setShowReplicateDialog(true);
    setReplicateFeedback(null);
  };

  const handleExecuteReplication = async () => {
    if (!replicateSourceDate || !replicateTargetDate) return;
    if (replicateSourceDate === replicateTargetDate) {
      setReplicateFeedback("La fecha origen y destino deben ser distintas.");
      return;
    }

    setIsReplicating(true);
    setReplicateFeedback(null);
    try {
      const ok = await onReplicateDay(replicateSourceDate, replicateTargetDate);
      if (ok) {
        setReplicateFeedback("Asignaciones replicadas exitosamente.");
        setTimeout(() => {
          setShowReplicateDialog(false);
          setReplicateFeedback(null);
        }, 1200);
      } else {
        setReplicateFeedback("No se encontraron jornadas en la fecha de origen.");
      }
    } finally {
      setIsReplicating(false);
    }
  };

  return (
    <div className="space-y-4 pt-4">
      {/* Top controls: Week navigation and search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-100">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={prevWeek}
            className="text-neutral-400 hover:text-neutral-900 transition-colors p-1 cursor-pointer"
            title="Semana anterior"
          >
            <ChevronLeft className="w-4 h-4 stroke-[1.25]" />
          </button>

          <span className="text-xs font-medium text-neutral-900 font-mono">
            Semana del {weekDays[0]?.formatted} al {weekDays[5]?.formatted} ({currentMonthName.toLowerCase()})
          </span>

          <button
            type="button"
            onClick={nextWeek}
            className="text-neutral-400 hover:text-neutral-900 transition-colors p-1 cursor-pointer"
            title="Semana siguiente"
          >
            <ChevronRight className="w-4 h-4 stroke-[1.25]" />
          </button>
        </div>

        <div className="flex items-center gap-4">
          {/* Replicate day button */}
          <button
            type="button"
            onClick={handleStartReplication}
            className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer flex items-center gap-1.5"
            title="Replicar planificación de un día a otro"
          >
            <Copy className="w-3.5 h-3.5 stroke-[1.25]" />
            <span>Replicar día...</span>
          </button>

          {/* Search advisor */}
          <div className="relative w-44">
            <input
              type="text"
              value={advisorSearch}
              onChange={(e) => setAdvisorSearch(e.target.value)}
              placeholder="Buscar asesor..."
              className="w-full text-xs border-b border-neutral-200 focus:border-neutral-900 bg-transparent py-1 pl-5 pr-2 transition-colors outline-hidden placeholder:text-neutral-400"
            />
            <Search className="w-3 h-3 text-neutral-400 absolute left-0 top-1.5 stroke-[1.25]" />
            {advisorSearch && (
              <button
                type="button"
                onClick={() => setAdvisorSearch("")}
                className="absolute right-0 top-1.5 text-neutral-400 hover:text-neutral-700 cursor-pointer"
              >
                <X className="w-3 h-3 stroke-[1.5]" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* MATRIX TABLE */}
      <div className="overflow-x-auto pb-4">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-neutral-200 text-neutral-400 font-normal">
              <th className="py-2.5 pr-4 font-normal w-40 shrink-0">Asesor</th>
              {weekDays.map((d) => (
                <th key={d.iso} className="py-2.5 px-2 font-normal min-w-[130px]">
                  <div className="flex flex-col">
                    <span className="text-neutral-900 font-medium">{d.label}</span>
                    <span className="text-[10px] text-neutral-400 font-mono">{d.formatted}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-neutral-100">
            {displayAdvisors.map((adv) => (
              <tr key={adv} className="hover:bg-neutral-50/50 transition-colors group/row">
                <td className="py-3 pr-4 font-medium text-neutral-900 truncate">
                  {adv}
                </td>

                {weekDays.map((d) => {
                  const key = `${adv.trim().toLowerCase()}__${d.iso}`;
                  const assignedItems = matrixMap.get(key) || [];

                  return (
                    <td key={d.iso} className="py-2 px-2 align-top group/cell relative">
                      {assignedItems.length > 0 ? (
                        <div className="space-y-1.5">
                          {assignedItems.map((item) => (
                            <div
                              key={item.id}
                              className="text-[11px] leading-tight group/item relative pr-4"
                            >
                              <div className="font-medium text-neutral-900 truncate" title={item.sector}>
                                {item.sector}
                              </div>
                              <div className="text-[10px] text-neutral-500 truncate" title={item.tipo_actividad}>
                                {item.tipo_actividad}
                              </div>

                              {/* Hover actions: PenLine for edit, X for remove */}
                              <div className="absolute right-0 top-0 opacity-0 group-hover/item:opacity-100 transition-opacity flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => onEditRecord(item)}
                                  className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
                                  title="Editar jornada"
                                >
                                  <PenLine className="w-3 h-3 stroke-[1.25]" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingRecord(item)}
                                  className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
                                  title="Eliminar registro"
                                >
                                  <X className="w-3 h-3 stroke-[1.5]" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onQuickAdd(adv, d.iso)}
                          className="opacity-0 group-hover/cell:opacity-100 text-neutral-300 hover:text-neutral-900 transition-opacity cursor-pointer p-1"
                          title={`Asignar jornada a ${adv} el ${d.label} ${d.formatted}`}
                        >
                          <Plus className="w-3.5 h-3.5 stroke-[1.25]" />
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* REPLICATE DAY DIALOG */}
      {showReplicateDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/40 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setShowReplicateDialog(false)}
        >
          <div
            className="w-full max-w-sm bg-white p-5 space-y-4 animate-in zoom-in-95 duration-150 shadow-xl border border-neutral-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-900">
                Replicar planificación de un día
              </h3>
              <button
                type="button"
                onClick={() => setShowReplicateDialog(false)}
                className="text-neutral-400 hover:text-neutral-900 cursor-pointer"
              >
                <X className="w-4 h-4 stroke-[1.5]" />
              </button>
            </div>

            <p className="text-xs text-neutral-500 leading-relaxed">
              Copia todas las jornadas planificadas de una fecha y créalas en una fecha destino.
            </p>

            <div className="space-y-3 pt-1">
              <div>
                <label className="text-[11px] text-neutral-400 block mb-1">
                  Fecha de origen (copiar desde)
                </label>
                <input
                  type="date"
                  value={replicateSourceDate}
                  onChange={(e) => setReplicateSourceDate(e.target.value)}
                  className="w-full text-xs border-b border-neutral-200 focus:border-neutral-900 bg-transparent py-1.5 text-neutral-900 outline-hidden font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] text-neutral-400 block mb-1">
                  Fecha de destino (pegar en)
                </label>
                <input
                  type="date"
                  value={replicateTargetDate}
                  onChange={(e) => setReplicateTargetDate(e.target.value)}
                  className="w-full text-xs border-b border-neutral-200 focus:border-neutral-900 bg-transparent py-1.5 text-neutral-900 outline-hidden font-mono"
                />
              </div>
            </div>

            {replicateFeedback && (
              <p className="text-xs text-neutral-600 animate-in fade-in">
                {replicateFeedback}
              </p>
            )}

            <div className="pt-2 flex items-center justify-end gap-4">
              <button
                type="button"
                onClick={() => setShowReplicateDialog(false)}
                disabled={isReplicating}
                className="text-xs text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleExecuteReplication}
                disabled={isReplicating || !replicateSourceDate || !replicateTargetDate}
                className="text-xs font-semibold text-neutral-950 hover:text-neutral-600 transition-colors cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
              >
                {isReplicating && <Loader2 className="w-3 h-3 animate-spin stroke-[1.5]" />}
                <span>Replicar jornadas</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM DIALOG */}
      <DeleteConfirmDialog
        isOpen={Boolean(deletingRecord)}
        title="Eliminar jornada planificada"
        description={
          deletingRecord
            ? `¿Estás seguro de que deseas eliminar la jornada de ${deletingRecord.asesor} en ${deletingRecord.sector} (${deletingRecord.fecha}) de la hoja Data?`
            : undefined
        }
        onConfirm={confirmDelete}
        onCancel={() => setDeletingRecord(null)}
      />
    </div>
  );
}

