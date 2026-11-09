"use client";

import { useState, useMemo } from "react";
import {
  Search,
  X,
  Check,
  ChevronRight,
  ChevronLeft,
  Calendar as CalendarIcon,
  MapPin,
  User,
  Activity,
  RotateCcw,
  Loader2,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import {
  PlanningMetadata,
  PlanningSheetRecord,
  NewPlanningItem,
  getMonthFromDate,
  toIsoDateString,
  toSheetDateFormat,
} from "@/lib/planificacion-types";

interface PlanificadorCreateFormProps {
  metadata: PlanningMetadata;
  existingRecords: PlanningSheetRecord[];
  onSuccess: (count: number) => void;
  defaultMonth: string;
}

type WizardStep = 1 | 2 | 3 | 4;

export function PlanificadorCreateForm({
  metadata,
  existingRecords,
  onSuccess,
  defaultMonth,
}: PlanificadorCreateFormProps) {
  // Mode: "wizard" (step by step, optimized for mobile) or "complete" (all on one screen)
  const [viewMode, setViewMode] = useState<"wizard" | "complete">("wizard");
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);

  // 1. Advisor Selection
  const [selectedAdvisors, setSelectedAdvisors] = useState<string[]>([]);
  const [advisorSearch, setAdvisorSearch] = useState<string>("");
  const [selectionMode, setSelectionMode] = useState<"single" | "multi">("single");

  // 2. Date Selection
  const todayIso = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayIso);
  const [dateMode, setDateMode] = useState<"single" | "multiple">("single");
  const [endDate, setEndDate] = useState<string>(todayIso);
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([1, 2, 3, 4, 5]); // Lun-Vie

  // 3. Location Selection
  const [sectorSearch, setSectorSearch] = useState<string>("");
  const [showManualGeo, setShowManualGeo] = useState<boolean>(false);
  const [selectedEstado, setSelectedEstado] = useState<string>("Distrito Capital");
  const [selectedMunicipio, setSelectedMunicipio] = useState<string>("Libertador");
  const [selectedParroquia, setSelectedParroquia] = useState<string>("Sucre (Catia)");
  const [selectedSector, setSelectedSector] = useState<string>("");

  // 4. Activity & Status
  const [selectedActivity, setSelectedActivity] = useState<string>("Recorrido con Instaladores");
  const [selectedStatus, setSelectedStatus] = useState<string>("Planificado");

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ── FILTERED ADVISORS ─────────────────────────────────────────────────────
  const filteredAdvisors = useMemo(() => {
    if (!advisorSearch.trim()) return metadata.advisors;
    const q = advisorSearch.toLowerCase().trim();
    return metadata.advisors.filter((a) => a.toLowerCase().includes(q));
  }, [metadata.advisors, advisorSearch]);

  const toggleAdvisor = (adv: string) => {
    if (selectionMode === "single") {
      setSelectedAdvisors([adv]);
      if (viewMode === "wizard") {
        setCurrentStep(2);
      }
    } else {
      setSelectedAdvisors((prev) =>
        prev.includes(adv) ? prev.filter((a) => a !== adv) : [...prev, adv]
      );
    }
  };

  const selectAllFilteredAdvisors = () => {
    setSelectedAdvisors(Array.from(new Set([...selectedAdvisors, ...filteredAdvisors])));
  };

  const clearAdvisorSelection = () => {
    setSelectedAdvisors([]);
  };

  // ── DATE SHORTCUTS & TARGET DATES ─────────────────────────────────────────
  const setQuickDate = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const iso = d.toISOString().split("T")[0];
    setSelectedDate(iso);
    setDateMode("single");
  };

  const targetDates = useMemo<string[]>(() => {
    if (dateMode === "single") {
      return selectedDate ? [selectedDate] : [];
    }

    if (!selectedDate || !endDate) return [];
    const dates: string[] = [];
    const current = new Date(selectedDate + "T12:00:00");
    const end = new Date(endDate + "T12:00:00");

    if (current > end) return [selectedDate];

    while (current <= end) {
      const dayOfWeek = current.getDay();
      if (selectedWeekdays.includes(dayOfWeek)) {
        dates.push(current.toISOString().split("T")[0]);
      }
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }, [dateMode, selectedDate, endDate, selectedWeekdays]);

  // Format date in natural Spanish
  const formatNaturalDate = (isoStr: string) => {
    if (!isoStr) return "";
    try {
      const [y, m, d] = isoStr.split("-").map(Number);
      const date = new Date(y, m - 1, d);
      return date.toLocaleDateString("es-VE", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
    } catch {
      return isoStr;
    }
  };

  // ── TERRITORIAL AUTOCOMPLETE & HIERARCHY ──────────────────────────────────
  const sectorMatches = useMemo(() => {
    if (!sectorSearch.trim() || sectorSearch.length < 2) return [];
    const q = sectorSearch.toLowerCase().trim();
    return metadata.sectorsCatalog
      .filter((item) => item.sector.toLowerCase().includes(q))
      .slice(0, 8);
  }, [metadata.sectorsCatalog, sectorSearch]);

  const availableMunicipios = useMemo(() => {
    if (!selectedEstado || !metadata.geoHierarchy[selectedEstado]) return [];
    return Object.keys(metadata.geoHierarchy[selectedEstado]).sort();
  }, [metadata.geoHierarchy, selectedEstado]);

  const availableParroquias = useMemo(() => {
    if (
      !selectedEstado ||
      !selectedMunicipio ||
      !metadata.geoHierarchy[selectedEstado] ||
      !metadata.geoHierarchy[selectedEstado][selectedMunicipio]
    ) {
      return [];
    }
    return Object.keys(metadata.geoHierarchy[selectedEstado][selectedMunicipio]).sort();
  }, [metadata.geoHierarchy, selectedEstado, selectedMunicipio]);

  const availableSectores = useMemo(() => {
    if (
      !selectedEstado ||
      !selectedMunicipio ||
      !selectedParroquia ||
      !metadata.geoHierarchy[selectedEstado] ||
      !metadata.geoHierarchy[selectedEstado][selectedMunicipio] ||
      !metadata.geoHierarchy[selectedEstado][selectedMunicipio][selectedParroquia]
    ) {
      return [];
    }
    return metadata.geoHierarchy[selectedEstado][selectedMunicipio][selectedParroquia]
      .slice()
      .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  }, [metadata.geoHierarchy, selectedEstado, selectedMunicipio, selectedParroquia]);

  const handleSelectSearchedSector = (item: {
    sector: string;
    parroquia: string;
    municipio: string;
    estado: string;
  }) => {
    setSelectedEstado(item.estado);
    setSelectedMunicipio(item.municipio);
    setSelectedParroquia(item.parroquia);
    setSelectedSector(item.sector);
    setSectorSearch("");
    if (viewMode === "wizard") {
      setCurrentStep(4);
    }
  };

  // ── DETECT CONFLICTS ──────────────────────────────────────────────────────
  const conflicts = useMemo(() => {
    const found: { asesor: string; fecha: string; sector: string; actividad: string }[] = [];
    if (selectedAdvisors.length === 0 || targetDates.length === 0) return found;

    for (const d of targetDates) {
      for (const adv of selectedAdvisors) {
        const normAdv = adv.trim().toLowerCase();
        const existing = existingRecords.find(
          (r) =>
            r.isoFecha === d &&
            r.asesor.trim().toLowerCase() === normAdv
        );
        if (existing) {
          found.push({
            asesor: adv,
            fecha: d,
            sector: existing.sector,
            actividad: existing.tipo_actividad,
          });
        }
      }
    }
    return found;
  }, [selectedAdvisors, targetDates, existingRecords]);

  // Total items
  const totalItemsToGenerate = selectedAdvisors.length * targetDates.length;

  // ── SUBMISSION ────────────────────────────────────────────────────────────
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setFeedbackMessage(null);

    if (selectedAdvisors.length === 0) {
      setErrorMessage("Por favor selecciona al menos un asesor activo.");
      if (viewMode === "wizard") setCurrentStep(1);
      return;
    }

    if (targetDates.length === 0) {
      setErrorMessage("Por favor selecciona al menos una fecha.");
      if (viewMode === "wizard") setCurrentStep(2);
      return;
    }

    if (!selectedSector.trim()) {
      setErrorMessage("Por favor selecciona un sector.");
      if (viewMode === "wizard") setCurrentStep(3);
      return;
    }

    const items: NewPlanningItem[] = [];

    for (const d of targetDates) {
      const mes = getMonthFromDate(d);
      for (const adv of selectedAdvisors) {
        items.push({
          fecha: d,
          mes,
          asesor: adv,
          estado: selectedEstado,
          municipio: selectedMunicipio,
          parroquia: selectedParroquia,
          sector: selectedSector,
          tipo_actividad: selectedActivity,
          estatus: selectedStatus,
        });
      }
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/planificacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });

      const json = await res.json();

      if (json.success) {
        setFeedbackMessage(
          `Planificación guardada exitosamente: ${items.length} ${
            items.length === 1 ? "jornada registrada" : "jornadas registradas"
          } en la hoja Data.`
        );
        onSuccess(items.length);
      } else {
        setErrorMessage(json.error || "No se pudo guardar la planificación en Google Sheets.");
      }
    } catch {
      setErrorMessage("Error de conexión al guardar en la hoja Data.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForSameAdvisor = () => {
    setFeedbackMessage(null);
    setErrorMessage(null);
    // Move date forward 1 day
    if (selectedDate) {
      const d = new Date(selectedDate + "T12:00:00");
      d.setDate(d.getDate() + 1);
      setSelectedDate(d.toISOString().split("T")[0]);
    }
    if (viewMode === "wizard") setCurrentStep(2);
  };

  const handleResetAll = () => {
    setFeedbackMessage(null);
    setErrorMessage(null);
    setSelectedAdvisors([]);
    setSelectedSector("");
    if (viewMode === "wizard") setCurrentStep(1);
  };

  return (
    <div className="space-y-6 pt-2">
      {/* Top Controls: View Mode & Feedback */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-100">
        <div>
          <span className="text-xs text-neutral-400">
            {metadata.advisors.length} asesores activos disponibles para planificación
          </span>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-3 text-xs">
          <button
            type="button"
            onClick={() => setViewMode("wizard")}
            className={cn(
              "transition-colors cursor-pointer py-1",
              viewMode === "wizard"
                ? "text-neutral-900 font-medium"
                : "text-neutral-400 hover:text-neutral-700 font-normal"
            )}
          >
            Paso a paso (móvil)
          </button>
          <span className="text-neutral-200">·</span>
          <button
            type="button"
            onClick={() => setViewMode("complete")}
            className={cn(
              "transition-colors cursor-pointer py-1",
              viewMode === "complete"
                ? "text-neutral-900 font-medium"
                : "text-neutral-400 hover:text-neutral-700 font-normal"
            )}
          >
            Vista completa
          </button>
        </div>
      </div>

      {/* Subtle inline messages (Zero colored banners, strictly clean typography) */}
      {feedbackMessage && (
        <div className="py-2 animate-in fade-in duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-neutral-800 border-b border-neutral-100">
          <span>{feedbackMessage}</span>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleResetForSameAdvisor}
              className="text-neutral-900 font-medium hover:underline cursor-pointer"
            >
              Planificar otro día
            </button>
            <span className="text-neutral-300">·</span>
            <button
              type="button"
              onClick={handleResetAll}
              className="text-neutral-500 hover:text-neutral-900 cursor-pointer"
            >
              Nueva jornada
            </button>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="py-2 animate-in fade-in duration-200 text-xs text-neutral-600 border-b border-neutral-100">
          {errorMessage}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODO ASISTENTE PASO A PASO (OPTIMIZADO PARA MÓVILES)                 */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {viewMode === "wizard" && (
        <div className="space-y-6">
          {/* Step Navigation Bar */}
          <div className="flex items-center justify-between gap-1 border-b border-neutral-100 pb-2 overflow-x-auto no-scrollbar">
            {[
              { num: 1 as WizardStep, label: "Asesor", detail: selectedAdvisors.join(", ") },
              { num: 2 as WizardStep, label: "Fecha", detail: selectedDate ? toSheetDateFormat(selectedDate) : "" },
              { num: 3 as WizardStep, label: "Sector", detail: selectedSector },
              { num: 4 as WizardStep, label: "Actividad", detail: selectedActivity },
            ].map((st) => {
              const isActive = currentStep === st.num;
              const isFilled = Boolean(st.detail);
              return (
                <button
                  key={st.num}
                  type="button"
                  onClick={() => setCurrentStep(st.num)}
                  className={cn(
                    "flex-1 min-w-[70px] text-left py-1.5 transition-colors cursor-pointer group relative",
                    isActive
                      ? "text-neutral-900 font-medium"
                      : isFilled
                      ? "text-neutral-600 hover:text-neutral-900"
                      : "text-neutral-400 hover:text-neutral-700"
                  )}
                >
                  <div className="flex items-center gap-1.5 text-xs">
                    <span
                      className={cn(
                        "w-4 h-4 rounded-full flex items-center justify-center text-[10px]",
                        isActive
                          ? "bg-neutral-900 text-white font-medium"
                          : isFilled
                          ? "bg-neutral-200 text-neutral-800"
                          : "bg-neutral-100 text-neutral-400"
                      )}
                    >
                      {st.num}
                    </span>
                    <span className="truncate">{st.label}</span>
                  </div>
                  {st.detail && (
                    <span className="block text-[11px] text-neutral-400 truncate mt-0.5">
                      {st.detail}
                    </span>
                  )}
                  {isActive && (
                    <span className="absolute bottom-[-9px] left-0 right-0 h-0.5 bg-neutral-900" />
                  )}
                </button>
              );
            })}
          </div>

          {/* ── PASO 1: ASESOR ────────────────────────────────────────── */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                <div>
                  <h3 className="text-sm font-medium text-neutral-900">
                    ¿A quién vas a planificar?
                  </h3>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Toca un asesor para seleccionarlo y avanzar
                  </p>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectionMode((m) => (m === "single" ? "multi" : "single"))
                    }
                    className="text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer"
                  >
                    {selectionMode === "single"
                      ? "Modo: Un solo asesor"
                      : "Modo: Varios asesores"}
                  </button>
                  {selectionMode === "multi" && (
                    <>
                      <span className="text-neutral-200">·</span>
                      <button
                        type="button"
                        onClick={selectAllFilteredAdvisors}
                        className="text-neutral-500 hover:text-neutral-900 cursor-pointer"
                      >
                        Todos
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Instant Search Bar */}
              <div className="relative">
                <input
                  type="text"
                  value={advisorSearch}
                  onChange={(e) => setAdvisorSearch(e.target.value)}
                  placeholder="Buscar asesor activo por nombre..."
                  className="w-full text-sm border-b border-neutral-200 focus:border-neutral-900 bg-transparent py-2 pl-7 pr-7 transition-colors outline-hidden placeholder:text-neutral-400"
                />
                <Search className="w-4 h-4 text-neutral-400 absolute left-0 top-2.5 stroke-[1.25]" />
                {advisorSearch && (
                  <button
                    type="button"
                    onClick={() => setAdvisorSearch("")}
                    className="absolute right-1 top-2.5 text-neutral-400 hover:text-neutral-700 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5 stroke-[1.5]" />
                  </button>
                )}
              </div>

              {/* Active Advisors List - Touch target minimum 48px */}
              <div className="divide-y divide-neutral-100 max-h-[55vh] overflow-y-auto">
                {filteredAdvisors.length === 0 ? (
                  <div className="py-8 text-center text-xs text-neutral-400">
                    No se encontraron asesores activos con &quot;{advisorSearch}&quot;
                  </div>
                ) : (
                  filteredAdvisors.map((adv) => {
                    const isSelected = selectedAdvisors.includes(adv);
                    const initials = adv
                      .split(" ")
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase();

                    return (
                      <button
                        key={adv}
                        type="button"
                        onClick={() => toggleAdvisor(adv)}
                        className={cn(
                          "w-full py-3 px-1 flex items-center justify-between text-left transition-colors cursor-pointer group",
                          isSelected
                            ? "text-neutral-950 font-medium"
                            : "text-neutral-600 hover:text-neutral-900"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={cn(
                              "w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 transition-colors",
                              isSelected
                                ? "bg-neutral-900 text-white font-medium"
                                : "bg-neutral-100 text-neutral-500 group-hover:bg-neutral-200"
                            )}
                          >
                            {initials}
                          </span>
                          <span className="text-sm">{adv}</span>
                        </div>

                        {isSelected ? (
                          <Check className="w-4 h-4 text-neutral-900 stroke-[1.75]" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-neutral-500 transition-colors stroke-[1.25]" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              {/* Bottom Action */}
              {selectedAdvisors.length > 0 && (
                <div className="pt-2 flex items-center justify-between">
                  <span className="text-xs text-neutral-500">
                    {selectedAdvisors.length}{" "}
                    {selectedAdvisors.length === 1 ? "asesor elegido" : "asesores elegidos"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="text-xs text-neutral-900 font-medium hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Continuar a Fecha</span>
                    <ChevronRight className="w-3.5 h-3.5 stroke-[1.5]" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── PASO 2: FECHA ─────────────────────────────────────────── */}
          {currentStep === 2 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div>
                <h3 className="text-sm font-medium text-neutral-900">
                  ¿Qué día realizarán la jornada?
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Elige una fecha rápida o selecciona un día en el calendario
                </p>
              </div>

              {/* Quick Tap Presets */}
              <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
                <span className="text-neutral-400 text-[11px]">Accesos rápidos:</span>
                <button
                  type="button"
                  onClick={() => setQuickDate(0)}
                  className="text-neutral-600 hover:text-neutral-900 cursor-pointer font-medium"
                >
                  Hoy
                </button>
                <span className="text-neutral-200">·</span>
                <button
                  type="button"
                  onClick={() => setQuickDate(1)}
                  className="text-neutral-600 hover:text-neutral-900 cursor-pointer font-medium"
                >
                  Mañana
                </button>
                <span className="text-neutral-200">·</span>
                <button
                  type="button"
                  onClick={() => setQuickDate(2)}
                  className="text-neutral-600 hover:text-neutral-900 cursor-pointer font-medium"
                >
                  Pasado mañana
                </button>
              </div>

              {/* Mode switch: Single vs Range */}
              <div className="flex items-center gap-4 text-xs pt-1">
                <button
                  type="button"
                  onClick={() => setDateMode("single")}
                  className={cn(
                    "cursor-pointer transition-colors",
                    dateMode === "single"
                      ? "text-neutral-900 font-medium underline underline-offset-4"
                      : "text-neutral-400 hover:text-neutral-700"
                  )}
                >
                  Día individual
                </button>
                <span className="text-neutral-200">·</span>
                <button
                  type="button"
                  onClick={() => setDateMode("multiple")}
                  className={cn(
                    "cursor-pointer transition-colors",
                    dateMode === "multiple"
                      ? "text-neutral-900 font-medium underline underline-offset-4"
                      : "text-neutral-400 hover:text-neutral-700"
                  )}
                >
                  Rango de varios días
                </button>
              </div>

              {/* Date Input */}
              {dateMode === "single" ? (
                <div className="space-y-2 max-w-sm">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full text-sm border-b border-neutral-200 focus:border-neutral-900 bg-transparent py-2 text-neutral-900 outline-hidden font-mono transition-colors"
                  />
                  <div className="text-xs text-neutral-500 capitalize">
                    {formatNaturalDate(selectedDate)} · Mes:{" "}
                    <span className="text-neutral-900 font-medium">
                      {getMonthFromDate(selectedDate) || defaultMonth}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 max-w-md">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] text-neutral-400 block mb-1">
                        Desde
                      </label>
                      <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="w-full text-xs border-b border-neutral-200 focus:border-neutral-900 bg-transparent py-2 text-neutral-900 outline-hidden font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-neutral-400 block mb-1">
                        Hasta
                      </label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full text-xs border-b border-neutral-200 focus:border-neutral-900 bg-transparent py-2 text-neutral-900 outline-hidden font-mono"
                      />
                    </div>
                  </div>

                  {/* Weekday filters */}
                  <div className="flex items-center gap-3 text-xs pt-1">
                    <span className="text-[11px] text-neutral-400">Días:</span>
                    {[
                      { l: "Lun", v: 1 },
                      { l: "Mar", v: 2 },
                      { l: "Mié", v: 3 },
                      { l: "Jue", v: 4 },
                      { l: "Vie", v: 5 },
                      { l: "Sáb", v: 6 },
                    ].map((d) => (
                      <button
                        key={d.v}
                        type="button"
                        onClick={() =>
                          setSelectedWeekdays((prev) =>
                            prev.includes(d.v) ? prev.filter((x) => x !== d.v) : [...prev, d.v]
                          )
                        }
                        className={cn(
                          "cursor-pointer py-1 transition-colors",
                          selectedWeekdays.includes(d.v)
                            ? "text-neutral-900 font-medium"
                            : "text-neutral-400 hover:text-neutral-700"
                        )}
                      >
                        {d.l}
                      </button>
                    ))}
                  </div>

                  <p className="text-xs text-neutral-500">
                    {targetDates.length}{" "}
                    {targetDates.length === 1 ? "día resultante" : "días resultantes"}
                  </p>
                </div>
              )}

              {/* Conflict warning in natural text */}
              {conflicts.length > 0 && (
                <div className="pt-2 text-xs text-neutral-500">
                  <span className="text-neutral-800 font-medium">Nota:</span> Ya existen{" "}
                  {conflicts.length} asignaciones previas registradas para estos días. Se
                  crearán registros adicionales si continúas.
                </div>
              )}

              {/* Navigation */}
              <div className="pt-4 flex items-center justify-between border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="text-xs text-neutral-400 hover:text-neutral-900 flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5 stroke-[1.5]" />
                  <span>Volver a Asesor</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="text-xs text-neutral-900 font-medium hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>Continuar a Sector</span>
                  <ChevronRight className="w-3.5 h-3.5 stroke-[1.5]" />
                </button>
              </div>
            </div>
          )}

          {/* ── PASO 3: UBICACIÓN (SECTOR) ────────────────────────────── */}
          {currentStep === 3 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div>
                <h3 className="text-sm font-medium text-neutral-900">
                  ¿En qué sector estarán?
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Escribe el nombre del sector para encontrarlo al instante
                </p>
              </div>

              {/* Current Selection summary if selected */}
              {selectedSector && (
                <div className="py-2 flex items-baseline justify-between border-b border-neutral-100">
                  <div>
                    <span className="text-xs text-neutral-400 block">Sector seleccionado:</span>
                    <span className="text-sm font-medium text-neutral-900">
                      {selectedSector}
                    </span>
                    <span className="text-xs text-neutral-500 ml-2">
                      ({selectedParroquia}, {selectedMunicipio})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedSector("")}
                    className="text-xs text-neutral-400 hover:text-neutral-900 cursor-pointer"
                  >
                    Cambiar
                  </button>
                </div>
              )}

              {/* Instant Sector Search */}
              <div className="space-y-2">
                <div className="relative">
                  <input
                    type="text"
                    value={sectorSearch}
                    onChange={(e) => setSectorSearch(e.target.value)}
                    placeholder="Escribe el sector (ej. Propatria, Casco Central, Montaña Alta)..."
                    className="w-full text-sm border-b border-neutral-200 focus:border-neutral-900 bg-transparent py-2 pl-7 pr-7 transition-colors outline-hidden placeholder:text-neutral-400"
                  />
                  <Search className="w-4 h-4 text-neutral-400 absolute left-0 top-2.5 stroke-[1.25]" />
                  {sectorSearch && (
                    <button
                      type="button"
                      onClick={() => setSectorSearch("")}
                      className="absolute right-1 top-2.5 text-neutral-400 hover:text-neutral-700 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5 stroke-[1.5]" />
                    </button>
                  )}
                </div>

                {/* Instant Sector Results */}
                {sectorSearch.trim().length >= 2 && (
                  <div className="divide-y divide-neutral-100 max-h-60 overflow-y-auto">
                    {sectorMatches.length === 0 ? (
                      <div className="py-4 text-xs text-neutral-400">
                        No se encontraron sectores que coincidan con &quot;{sectorSearch}&quot;.
                      </div>
                    ) : (
                      sectorMatches.map((item, idx) => (
                        <button
                          key={`${item.sector}-${item.parroquia}-${idx}`}
                          type="button"
                          onClick={() => handleSelectSearchedSector(item)}
                          className="w-full py-2.5 px-1 flex items-baseline justify-between text-left hover:text-neutral-950 transition-colors cursor-pointer group"
                        >
                          <div>
                            <span className="text-sm font-medium text-neutral-900 block group-hover:underline">
                              {item.sector}
                            </span>
                            <span className="text-xs text-neutral-400">
                              {item.parroquia} · {item.municipio} ({item.estado})
                            </span>
                          </div>
                          <span className="text-xs text-neutral-400 group-hover:text-neutral-900">
                            Elegir →
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Collapsible Manual Territorial Explorer */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowManualGeo(!showManualGeo)}
                  className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer"
                >
                  {showManualGeo
                    ? "− Ocultar selector territorial por niveles"
                    : "+ O explorar navegando Estado, Parroquia y Sector manualmente"}
                </button>

                {showManualGeo && (
                  <div className="space-y-4 pt-3 border-t border-neutral-100 mt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[11px] text-neutral-400 block mb-1">
                          Estado
                        </label>
                        <CustomDropdown
                          value={selectedEstado}
                          options={Object.keys(metadata.geoHierarchy).sort().map((e) => ({
                            value: e,
                            label: e,
                          }))}
                          onChange={(e) => {
                            setSelectedEstado(e);
                            const mList = Object.keys(metadata.geoHierarchy[e] || {});
                            if (mList.length > 0) {
                              setSelectedMunicipio(mList[0]);
                              const pList = Object.keys(metadata.geoHierarchy[e][mList[0]] || {});
                              if (pList.length > 0) {
                                setSelectedParroquia(pList[0]);
                              }
                            }
                          }}
                        />
                      </div>

                      <div>
                        <label className="text-[11px] text-neutral-400 block mb-1">
                          Municipio
                        </label>
                        <CustomDropdown
                          value={selectedMunicipio}
                          options={availableMunicipios.map((m) => ({ value: m, label: m }))}
                          onChange={(m) => {
                            setSelectedMunicipio(m);
                            const pList = Object.keys(
                              metadata.geoHierarchy[selectedEstado]?.[m] || {}
                            );
                            if (pList.length > 0) setSelectedParroquia(pList[0]);
                          }}
                        />
                      </div>

                      <div>
                        <label className="text-[11px] text-neutral-400 block mb-1">
                          Parroquia
                        </label>
                        <CustomDropdown
                          value={selectedParroquia}
                          options={availableParroquias.map((p) => ({ value: p, label: p }))}
                          onChange={setSelectedParroquia}
                        />
                      </div>

                      <div>
                        <label className="text-[11px] text-neutral-400 block mb-1">
                          Sector
                        </label>
                        <CustomDropdown
                          value={selectedSector}
                          options={availableSectores.map((s) => ({ value: s, label: s }))}
                          onChange={(s) => {
                            setSelectedSector(s);
                            if (viewMode === "wizard") setCurrentStep(4);
                          }}
                          placeholder="Selecciona un sector..."
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Navigation */}
              <div className="pt-4 flex items-center justify-between border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="text-xs text-neutral-400 hover:text-neutral-900 flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5 stroke-[1.5]" />
                  <span>Volver a Fecha</span>
                </button>

                {selectedSector && (
                  <button
                    type="button"
                    onClick={() => setCurrentStep(4)}
                    className="text-xs text-neutral-900 font-medium hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Continuar a Actividad</span>
                    <ChevronRight className="w-3.5 h-3.5 stroke-[1.5]" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── PASO 4: ACTIVIDAD Y GUARDAR ──────────────────────────── */}
          {currentStep === 4 && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div>
                <h3 className="text-sm font-medium text-neutral-900">
                  ¿Qué actividad realizarán?
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Selecciona el tipo de trabajo de campo asignado
                </p>
              </div>

              {/* Activities list touch rows */}
              <div className="divide-y divide-neutral-100 max-h-64 overflow-y-auto">
                {metadata.activities.map((act) => {
                  const isSelected = selectedActivity === act;
                  return (
                    <button
                      key={act}
                      type="button"
                      onClick={() => setSelectedActivity(act)}
                      className={cn(
                        "w-full py-3 px-1 flex items-center justify-between text-left transition-colors cursor-pointer",
                        isSelected
                          ? "text-neutral-950 font-medium"
                          : "text-neutral-600 hover:text-neutral-900"
                      )}
                    >
                      <span className="text-sm">{act}</span>
                      {isSelected && (
                        <Check className="w-4 h-4 text-neutral-900 stroke-[1.75]" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Estatus selection */}
              <div className="pt-2 flex items-center gap-4">
                <span className="text-xs text-neutral-400">Estatus:</span>
                <CustomDropdown
                  value={selectedStatus}
                  options={metadata.statuses.map((st) => ({ value: st, label: st }))}
                  onChange={setSelectedStatus}
                  compact
                  className="w-36"
                />
              </div>

              {/* Summary Overview before saving */}
              <div className="pt-4 border-t border-neutral-100 space-y-2">
                <span className="text-xs text-neutral-400 block">Resumen de asignación:</span>
                <div className="space-y-1 text-xs text-neutral-700">
                  <div>
                    <span className="text-neutral-400">Asesor(es):</span>{" "}
                    <span className="text-neutral-900 font-medium">
                      {selectedAdvisors.join(", ") || "No seleccionado"}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-400">Fecha(s):</span>{" "}
                    <span className="text-neutral-900 font-medium">
                      {targetDates.map((d) => toSheetDateFormat(d)).join(", ")}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-400">Ubicación:</span>{" "}
                    <span className="text-neutral-900 font-medium">
                      {selectedSector ? `${selectedSector} (${selectedParroquia}, ${selectedMunicipio})` : "No seleccionado"}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-400">Actividad:</span>{" "}
                    <span className="text-neutral-900 font-medium">{selectedActivity}</span> · {selectedStatus}
                  </div>
                </div>
              </div>

              {/* Final Submit Action */}
              <div className="pt-4 flex items-center justify-between border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="text-xs text-neutral-400 hover:text-neutral-900 flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5 stroke-[1.5]" />
                  <span>Volver a Sector</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSubmit()}
                  disabled={isSubmitting || !selectedSector || selectedAdvisors.length === 0}
                  className="text-sm font-medium text-neutral-900 hover:text-neutral-600 disabled:opacity-40 transition-colors cursor-pointer flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin stroke-[1.25]" />
                      <span>Guardando en Google Sheets...</span>
                    </>
                  ) : (
                    <span>
                      Guardar {totalItemsToGenerate}{" "}
                      {totalItemsToGenerate === 1 ? "jornada" : "jornadas"} en Sheet Data
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODO COMPLETO (TODAS LAS SECCIONES EN UNA PANTALLA)                  */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {viewMode === "complete" && (
        <form onSubmit={handleSubmit} className="space-y-8 animate-in fade-in duration-150">
          {/* 1. SELECCIÓN DE ASESORES */}
          <div className="space-y-3 pb-6 border-b border-neutral-100">
            <div className="flex items-baseline justify-between">
              <div>
                <h3 className="text-sm font-medium text-neutral-900">
                  1. Asesores comerciales activos
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Selecciona uno o varios asesores
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <button
                  type="button"
                  onClick={selectAllFilteredAdvisors}
                  className="text-neutral-500 hover:text-neutral-900 cursor-pointer"
                >
                  Seleccionar todos
                </button>
                <span className="text-neutral-200">·</span>
                <button
                  type="button"
                  onClick={clearAdvisorSelection}
                  className="text-neutral-400 hover:text-neutral-700 cursor-pointer"
                >
                  Limpiar
                </button>
              </div>
            </div>

            <div className="relative max-w-sm">
              <input
                type="text"
                value={advisorSearch}
                onChange={(e) => setAdvisorSearch(e.target.value)}
                placeholder="Filtrar asesores activos..."
                className="w-full text-xs border-b border-neutral-200 focus:border-neutral-900 bg-transparent py-1.5 pl-6 pr-2 transition-colors outline-hidden placeholder:text-neutral-400"
              />
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-0 top-2 stroke-[1.25]" />
              {advisorSearch && (
                <button
                  type="button"
                  onClick={() => setAdvisorSearch("")}
                  className="absolute right-1 top-2 text-neutral-400 hover:text-neutral-700 cursor-pointer"
                >
                  <X className="w-3 h-3 stroke-[1.5]" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pt-1">
              {filteredAdvisors.map((adv) => {
                const isSelected = selectedAdvisors.includes(adv);
                return (
                  <button
                    key={adv}
                    type="button"
                    onClick={() =>
                      setSelectedAdvisors((prev) =>
                        prev.includes(adv) ? prev.filter((a) => a !== adv) : [...prev, adv]
                      )
                    }
                    className={cn(
                      "text-xs py-1 transition-colors cursor-pointer flex items-center gap-1.5",
                      isSelected
                        ? "text-neutral-950 font-medium"
                        : "text-neutral-400 hover:text-neutral-700 font-normal"
                    )}
                  >
                    <span
                      className={cn(
                        "w-1.5 h-1.5 rounded-full shrink-0",
                        isSelected ? "bg-neutral-900" : "bg-neutral-300"
                      )}
                    />
                    <span>{adv}</span>
                  </button>
                );
              })}
            </div>

            {selectedAdvisors.length > 0 && (
              <p className="text-xs text-neutral-500 font-mono">
                {selectedAdvisors.length}{" "}
                {selectedAdvisors.length === 1 ? "asesor seleccionado" : "asesores seleccionados"}
              </p>
            )}
          </div>

          {/* 2. FECHAS */}
          <div className="space-y-4 pb-6 border-b border-neutral-100">
            <div className="flex items-baseline justify-between">
              <div>
                <h3 className="text-sm font-medium text-neutral-900">
                  2. Fecha de la jornada
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Día individual o rango de fechas
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => setDateMode("single")}
                  className={cn(
                    "cursor-pointer transition-colors",
                    dateMode === "single"
                      ? "text-neutral-900 font-medium"
                      : "text-neutral-400 hover:text-neutral-700"
                  )}
                >
                  Individual
                </button>
                <span className="text-neutral-200">·</span>
                <button
                  type="button"
                  onClick={() => setDateMode("multiple")}
                  className={cn(
                    "cursor-pointer transition-colors",
                    dateMode === "multiple"
                      ? "text-neutral-900 font-medium"
                      : "text-neutral-400 hover:text-neutral-700"
                  )}
                >
                  Rango
                </button>
              </div>
            </div>

            {dateMode === "single" ? (
              <div className="flex items-center gap-4 max-w-sm">
                <div className="w-full">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full text-xs border-b border-neutral-200 focus:border-neutral-900 bg-transparent py-1.5 text-neutral-900 outline-hidden font-mono"
                  />
                </div>
                <div className="shrink-0 text-xs text-neutral-500 capitalize">
                  {formatNaturalDate(selectedDate)}
                </div>
              </div>
            ) : (
              <div className="space-y-4 max-w-md">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] text-neutral-400 block mb-1">
                      Inicio
                    </label>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-full text-xs border-b border-neutral-200 focus:border-neutral-900 bg-transparent py-1.5 text-neutral-900 outline-hidden font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-neutral-400 block mb-1">
                      Fin
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full text-xs border-b border-neutral-200 focus:border-neutral-900 bg-transparent py-1.5 text-neutral-900 outline-hidden font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  {[
                    { l: "Lun", v: 1 },
                    { l: "Mar", v: 2 },
                    { l: "Mié", v: 3 },
                    { l: "Jue", v: 4 },
                    { l: "Vie", v: 5 },
                  ].map((d) => (
                    <button
                      key={d.v}
                      type="button"
                      onClick={() =>
                        setSelectedWeekdays((prev) =>
                          prev.includes(d.v) ? prev.filter((x) => x !== d.v) : [...prev, d.v]
                        )
                      }
                      className={cn(
                        "cursor-pointer py-1",
                        selectedWeekdays.includes(d.v)
                          ? "text-neutral-900 font-medium"
                          : "text-neutral-400 hover:text-neutral-700"
                      )}
                    >
                      {d.l}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 3. UBICACIÓN */}
          <div className="space-y-4 pb-6 border-b border-neutral-100">
            <div>
              <h3 className="text-sm font-medium text-neutral-900">
                3. Ubicación territorial
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Búsqueda rápida por sector o selección por niveles
              </p>
            </div>

            {/* Quick Sector Search */}
            <div className="relative max-w-md">
              <input
                type="text"
                value={sectorSearch}
                onChange={(e) => setSectorSearch(e.target.value)}
                placeholder="Escribe el nombre del sector (ej. Propatria, El Pueblo)..."
                className="w-full text-xs border-b border-neutral-200 focus:border-neutral-900 bg-transparent py-1.5 pl-6 pr-2 transition-colors outline-hidden placeholder:text-neutral-400"
              />
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-0 top-2 stroke-[1.25]" />

              {sectorSearch.trim().length >= 2 && sectorMatches.length > 0 && (
                <div className="divide-y divide-neutral-100 mt-2 max-h-48 overflow-y-auto">
                  {sectorMatches.map((item, idx) => (
                    <button
                      key={`${item.sector}-${idx}`}
                      type="button"
                      onClick={() => handleSelectSearchedSector(item)}
                      className="w-full py-2 flex items-baseline justify-between text-left hover:text-neutral-950 transition-colors cursor-pointer group"
                    >
                      <span className="text-xs font-medium text-neutral-900 group-hover:underline">
                        {item.sector}
                      </span>
                      <span className="text-[11px] text-neutral-400">
                        {item.parroquia}, {item.municipio}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedSector && (
              <p className="text-xs text-neutral-700 font-medium">
                Seleccionado: {selectedSector} ({selectedParroquia}, {selectedMunicipio}, {selectedEstado})
              </p>
            )}
          </div>

          {/* 4. ACTIVIDAD Y ESTATUS */}
          <div className="space-y-4 pb-6 border-b border-neutral-100">
            <div>
              <h3 className="text-sm font-medium text-neutral-900">
                4. Actividad y estatus
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
              <div>
                <label className="text-[11px] text-neutral-400 block mb-1">
                  Tipo de actividad
                </label>
                <CustomDropdown
                  value={selectedActivity}
                  options={metadata.activities.map((a) => ({ value: a, label: a }))}
                  onChange={setSelectedActivity}
                />
              </div>

              <div>
                <label className="text-[11px] text-neutral-400 block mb-1">
                  Estatus
                </label>
                <CustomDropdown
                  value={selectedStatus}
                  options={metadata.statuses.map((s) => ({ value: s, label: s }))}
                  onChange={setSelectedStatus}
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-neutral-400">
              {totalItemsToGenerate}{" "}
              {totalItemsToGenerate === 1 ? "registro por guardar" : "registros por guardar"}
            </span>

            <button
              type="submit"
              disabled={isSubmitting || !selectedSector || selectedAdvisors.length === 0}
              className="text-sm font-medium text-neutral-900 hover:text-neutral-600 disabled:opacity-40 transition-colors cursor-pointer flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin stroke-[1.25]" />
                  <span>Guardando...</span>
                </>
              ) : (
                <span>Guardar planificación en Sheet Data</span>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
