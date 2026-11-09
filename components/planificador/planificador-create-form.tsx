"use client";

import { useState, useMemo } from "react";
import { Search, X, Check, Calendar as CalendarIcon, MapPin, User, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import {
  PlanningMetadata,
  PlanningSheetRecord,
  NewPlanningItem,
  getMonthFromDate,
  toIsoDateString,
  toSheetDateFormat,
} from "@/lib/planificacion-service";

interface PlanificadorCreateFormProps {
  metadata: PlanningMetadata;
  existingRecords: PlanningSheetRecord[];
  onSuccess: (count: number) => void;
  defaultMonth: string;
}

export function PlanificadorCreateForm({
  metadata,
  existingRecords,
  onSuccess,
  defaultMonth,
}: PlanificadorCreateFormProps) {
  // Date configuration
  const todayIso = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayIso);
  const [dateMode, setDateMode] = useState<"single" | "multiple">("single");
  const [endDate, setEndDate] = useState<string>(todayIso);
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([1, 2, 3, 4, 5]); // Lun-Vie

  // Advisors selection
  const [selectedAdvisors, setSelectedAdvisors] = useState<string[]>([]);
  const [advisorSearch, setAdvisorSearch] = useState<string>("");

  // Territorial selection
  const [sectorSearch, setSectorSearch] = useState<string>("");
  const [sectorSearchResultsOpen, setSectorSearchResultsOpen] = useState<boolean>(false);
  const [selectedEstado, setSelectedEstado] = useState<string>("Distrito Capital");
  const [selectedMunicipio, setSelectedMunicipio] = useState<string>("Libertador");
  const [selectedParroquia, setSelectedParroquia] = useState<string>("Sucre (Catia)");
  const [selectedSector, setSelectedSector] = useState<string>("Propatria");

  // Activity & Status
  const [selectedActivity, setSelectedActivity] = useState<string>("Recorrido con Instaladores");
  const [selectedStatus, setSelectedStatus] = useState<string>("Planificado");

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filtered advisors by search query
  const filteredAdvisors = useMemo(() => {
    if (!advisorSearch.trim()) return metadata.advisors;
    const q = advisorSearch.toLowerCase().trim();
    return metadata.advisors.filter((a) => a.toLowerCase().includes(q));
  }, [metadata.advisors, advisorSearch]);

  // Sector autocomplete matches
  const sectorMatches = useMemo(() => {
    if (!sectorSearch.trim() || sectorSearch.length < 2) return [];
    const q = sectorSearch.toLowerCase().trim();
    return metadata.sectorsCatalog.filter((item) =>
      item.sector.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [metadata.sectorsCatalog, sectorSearch]);

  // Available municipios based on selected estado
  const availableMunicipios = useMemo(() => {
    if (!selectedEstado || !metadata.geoHierarchy[selectedEstado]) return [];
    return Object.keys(metadata.geoHierarchy[selectedEstado]).sort();
  }, [metadata.geoHierarchy, selectedEstado]);

  // Available parroquias based on selected municipio
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

  // Available sectores based on selected parroquia
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

  // Select a sector from search results
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
    setSectorSearchResultsOpen(false);
  };

  // Toggle advisor selection
  const toggleAdvisor = (adv: string) => {
    setSelectedAdvisors((prev) =>
      prev.includes(adv) ? prev.filter((a) => a !== adv) : [...prev, adv]
    );
  };

  const selectAllFilteredAdvisors = () => {
    const combined = Array.from(new Set([...selectedAdvisors, ...filteredAdvisors]));
    setSelectedAdvisors(combined);
  };

  const clearAdvisorSelection = () => {
    setSelectedAdvisors([]);
  };

  // Generate target dates list
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
      const dayOfWeek = current.getDay(); // 0 is Sunday, 1 is Monday...
      if (selectedWeekdays.includes(dayOfWeek)) {
        dates.push(current.toISOString().split("T")[0]);
      }
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }, [dateMode, selectedDate, endDate, selectedWeekdays]);

  // Detected conflict warnings (if an advisor already has a planned activity on a target date)
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

  // Total records that will be generated
  const totalItemsToGenerate = selectedAdvisors.length * targetDates.length;

  // Handle Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setFeedbackMessage(null);

    if (selectedAdvisors.length === 0) {
      setErrorMessage("Por favor selecciona al menos un asesor.");
      return;
    }

    if (targetDates.length === 0) {
      setErrorMessage("Por favor selecciona al menos una fecha válida.");
      return;
    }

    if (!selectedSector.trim()) {
      setErrorMessage("Por favor selecciona un sector.");
      return;
    }

    // Build items payload
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
            items.length === 1 ? "registro insertado" : "registros insertados"
          } en la hoja Data.`
        );
        onSuccess(items.length);
        // Clear selection or keep location for next input
        setSelectedAdvisors([]);
        setTimeout(() => setFeedbackMessage(null), 4000);
      } else {
        setErrorMessage(json.error || "No se pudo guardar la planificación en Google Sheets.");
      }
    } catch (err: any) {
      setErrorMessage("Error de conexión al guardar en la hoja Data.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 pt-4">
      {/* 1. SELECCIÓN DE ASESORES */}
      <div className="space-y-3 pb-6 border-b border-neutral-100">
        <div className="flex items-baseline justify-between">
          <div>
            <h2 className="text-sm font-medium text-neutral-900 tracking-tight">
              1. Selección de asesores
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Elige uno o varios asesores para asignarles la jornada simultáneamente
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <button
              type="button"
              onClick={selectAllFilteredAdvisors}
              className="text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer"
            >
              Seleccionar visibles
            </button>
            <span className="text-neutral-200">·</span>
            <button
              type="button"
              onClick={clearAdvisorSelection}
              className="text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer"
            >
              Limpiar
            </button>
          </div>
        </div>

        {/* Advisor search input */}
        <div className="relative max-w-sm">
          <input
            type="text"
            value={advisorSearch}
            onChange={(e) => setAdvisorSearch(e.target.value)}
            placeholder="Filtrar asesores..."
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

        {/* Advisors Chips/List */}
        <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pt-1">
          {filteredAdvisors.map((adv) => {
            const isSelected = selectedAdvisors.includes(adv);
            return (
              <button
                key={adv}
                type="button"
                onClick={() => toggleAdvisor(adv)}
                className={cn(
                  "text-xs px-2.5 py-1 transition-colors cursor-pointer text-left flex items-center gap-1.5",
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
            {selectedAdvisors.length} {selectedAdvisors.length === 1 ? "asesor seleccionado" : "asesores seleccionados"}
          </p>
        )}
      </div>

      {/* 2. SELECCIÓN DE FECHA O RANGO */}
      <div className="space-y-4 pb-6 border-b border-neutral-100">
        <div className="flex items-baseline justify-between">
          <div>
            <h2 className="text-sm font-medium text-neutral-900 tracking-tight">
              2. Fechas de la planificación
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Asigna una fecha individual o distribuye la actividad en un rango de días
            </p>
          </div>

          {/* Mode switch */}
          <div className="flex items-center gap-3 text-xs">
            <button
              type="button"
              onClick={() => setDateMode("single")}
              className={cn(
                "transition-colors cursor-pointer",
                dateMode === "single"
                  ? "text-neutral-900 font-medium"
                  : "text-neutral-400 hover:text-neutral-700"
              )}
            >
              Fecha individual
            </button>
            <span className="text-neutral-200">·</span>
            <button
              type="button"
              onClick={() => setDateMode("multiple")}
              className={cn(
                "transition-colors cursor-pointer",
                dateMode === "multiple"
                  ? "text-neutral-900 font-medium"
                  : "text-neutral-400 hover:text-neutral-700"
              )}
            >
              Rango de días
            </button>
          </div>
        </div>

        {dateMode === "single" ? (
          <div className="flex items-center gap-4 max-w-sm">
            <div className="w-full">
              <label className="text-[11px] text-neutral-400 block mb-1">
                Fecha de la jornada
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full text-xs border-b border-neutral-200 focus:border-neutral-900 bg-transparent py-1.5 text-neutral-900 outline-hidden transition-colors font-mono"
              />
            </div>
            <div className="shrink-0 pt-4 text-xs text-neutral-400 font-mono">
              Mes: <span className="text-neutral-900">{getMonthFromDate(selectedDate) || defaultMonth}</span>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
              <div>
                <label className="text-[11px] text-neutral-400 block mb-1">
                  Fecha inicio
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full text-xs border-b border-neutral-200 focus:border-neutral-900 bg-transparent py-1.5 text-neutral-900 outline-hidden transition-colors font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] text-neutral-400 block mb-1">
                  Fecha fin
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full text-xs border-b border-neutral-200 focus:border-neutral-900 bg-transparent py-1.5 text-neutral-900 outline-hidden transition-colors font-mono"
                />
              </div>
            </div>

            {/* Weekdays checkboxes */}
            <div>
              <span className="text-[11px] text-neutral-400 block mb-1.5">
                Días de la semana incluidos:
              </span>
              <div className="flex items-center gap-3">
                {[
                  { label: "Lun", val: 1 },
                  { label: "Mar", val: 2 },
                  { label: "Mié", val: 3 },
                  { label: "Jue", val: 4 },
                  { label: "Vie", val: 5 },
                  { label: "Sáb", val: 6 },
                ].map((day) => {
                  const isChecked = selectedWeekdays.includes(day.val);
                  return (
                    <button
                      key={day.val}
                      type="button"
                      onClick={() =>
                        setSelectedWeekdays((prev) =>
                          prev.includes(day.val)
                            ? prev.filter((d) => d !== day.val)
                            : [...prev, day.val]
                        )
                      }
                      className={cn(
                        "text-xs transition-colors cursor-pointer py-1",
                        isChecked
                          ? "text-neutral-900 font-medium"
                          : "text-neutral-400 hover:text-neutral-700"
                      )}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="text-xs text-neutral-500 font-mono">
              {targetDates.length} {targetDates.length === 1 ? "día seleccionado" : "días seleccionados"} en el rango
            </p>
          </div>
        )}
      </div>

      {/* 3. SELECCIÓN TERRITORIAL */}
      <div className="space-y-4 pb-6 border-b border-neutral-100">
        <div>
          <h2 className="text-sm font-medium text-neutral-900 tracking-tight">
            3. Ubicación territorial
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Busca el sector directamente o selecciónalo mediante la jerarquía de Estado y Parroquia
          </p>
        </div>

        {/* Quick Sector Search Autocomplete */}
        <div className="relative max-w-md">
          <label className="text-[11px] text-neutral-400 block mb-1">
            Búsqueda rápida por sector
          </label>
          <div className="relative">
            <input
              type="text"
              value={sectorSearch}
              onChange={(e) => {
                setSectorSearch(e.target.value);
                setSectorSearchResultsOpen(true);
              }}
              onFocus={() => setSectorSearchResultsOpen(true)}
              placeholder="Escribe el nombre del sector (ej. Propatria, El Pueblo)..."
              className="w-full text-xs border-b border-neutral-200 focus:border-neutral-900 bg-transparent py-1.5 pl-6 pr-2 transition-colors outline-hidden placeholder:text-neutral-400"
            />
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-0 top-2 stroke-[1.25]" />
          </div>

          {/* Autocomplete dropdown popover */}
          {sectorSearchResultsOpen && sectorMatches.length > 0 && (
            <div className="absolute z-30 left-0 right-0 mt-1 bg-white shadow-lg border border-neutral-100 py-1 max-h-56 overflow-y-auto">
              {sectorMatches.map((item, idx) => (
                <button
                  key={`${item.sector}-${idx}`}
                  type="button"
                  onClick={() => handleSelectSearchedSector(item)}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-50 transition-colors flex flex-col cursor-pointer"
                >
                  <span className="font-medium text-neutral-900">{item.sector}</span>
                  <span className="text-[10px] text-neutral-400">
                    {item.parroquia} · {item.municipio} · {item.estado}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Manual Cascading Hierarchy */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-2">
          {/* Estado */}
          <div>
            <label className="text-[11px] text-neutral-400 block mb-1">
              Estado
            </label>
            <CustomDropdown
              value={selectedEstado}
              options={Object.keys(metadata.geoHierarchy).sort()}
              onChange={(val) => {
                setSelectedEstado(val);
                const firstMun = Object.keys(metadata.geoHierarchy[val] || {})[0] || "";
                setSelectedMunicipio(firstMun);
                const firstPar = firstMun ? Object.keys(metadata.geoHierarchy[val]?.[firstMun] || {})[0] || "" : "";
                setSelectedParroquia(firstPar);
                const firstSec = firstPar ? (metadata.geoHierarchy[val]?.[firstMun]?.[firstPar] || [])[0] || "" : "";
                setSelectedSector(firstSec);
              }}
              compact
            />
          </div>

          {/* Municipio */}
          <div>
            <label className="text-[11px] text-neutral-400 block mb-1">
              Municipio
            </label>
            <CustomDropdown
              value={selectedMunicipio}
              options={availableMunicipios}
              onChange={(val) => {
                setSelectedMunicipio(val);
                const firstPar = Object.keys(metadata.geoHierarchy[selectedEstado]?.[val] || {})[0] || "";
                setSelectedParroquia(firstPar);
                const firstSec = firstPar ? (metadata.geoHierarchy[selectedEstado]?.[val]?.[firstPar] || [])[0] || "" : "";
                setSelectedSector(firstSec);
              }}
              compact
            />
          </div>

          {/* Parroquia */}
          <div>
            <label className="text-[11px] text-neutral-400 block mb-1">
              Parroquia
            </label>
            <CustomDropdown
              value={selectedParroquia}
              options={availableParroquias}
              onChange={(val) => {
                setSelectedParroquia(val);
                const firstSec = (metadata.geoHierarchy[selectedEstado]?.[selectedMunicipio]?.[val] || [])[0] || "";
                setSelectedSector(firstSec);
              }}
              compact
            />
          </div>

          {/* Sector */}
          <div>
            <label className="text-[11px] text-neutral-400 block mb-1">
              Sector
            </label>
            <CustomDropdown
              value={selectedSector}
              options={availableSectores}
              onChange={(val) => setSelectedSector(val)}
              compact
              searchable
            />
          </div>
        </div>

        <div className="text-xs text-neutral-500 font-mono">
          Ubicación asignada: <span className="text-neutral-900 font-medium">{selectedSector}</span> ({selectedParroquia}, {selectedMunicipio}, {selectedEstado})
        </div>
      </div>

      {/* 4. TIPO DE ACTIVIDAD Y ESTATUS */}
      <div className="space-y-4 pb-6 border-b border-neutral-100">
        <div>
          <h2 className="text-sm font-medium text-neutral-900 tracking-tight">
            4. Actividad y estatus
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Selecciona la modalidad operativa de la jornada
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
          <div>
            <label className="text-[11px] text-neutral-400 block mb-1">
              Tipo de actividad
            </label>
            <CustomDropdown
              value={selectedActivity}
              options={metadata.activities}
              onChange={(val) => setSelectedActivity(val)}
              compact
            />
          </div>

          <div>
            <label className="text-[11px] text-neutral-400 block mb-1">
              Estatus inicial
            </label>
            <CustomDropdown
              value={selectedStatus}
              options={metadata.statuses}
              onChange={(val) => setSelectedStatus(val)}
              compact
            />
          </div>
        </div>
      </div>

      {/* CONFLICTS ALERT (Sutil, en texto neutro sin cuadros de colores) */}
      {conflicts.length > 0 && (
        <div className="space-y-1 text-xs text-neutral-500">
          <span className="font-medium text-neutral-800">
            Avisos de solapamiento detectados:
          </span>
          <div className="space-y-0.5">
            {conflicts.map((c, idx) => (
              <p key={idx} className="text-neutral-500">
                · {c.asesor} ya tiene planificada la actividad &ldquo;{c.actividad}&rdquo; en {c.sector} para el {toSheetDateFormat(c.fecha)}.
              </p>
            ))}
          </div>
        </div>
      )}

      {/* FEEDBACK & ACTIONS */}
      <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          {feedbackMessage && (
            <p className="text-xs text-neutral-900 font-medium animate-in fade-in">
              {feedbackMessage}
            </p>
          )}
          {errorMessage && (
            <p className="text-xs text-neutral-600 animate-in fade-in">
              {errorMessage}
            </p>
          )}
          {!feedbackMessage && !errorMessage && totalItemsToGenerate > 0 && (
            <p className="text-xs text-neutral-400 font-mono">
              Se generarán {totalItemsToGenerate} {totalItemsToGenerate === 1 ? "registro" : "registros"} en la hoja Data ({selectedAdvisors.length} asesores × {targetDates.length} fechas)
            </p>
          )}
        </div>

        {/* Submit button - strict rule: pure typography, zero borders or backgrounds */}
        <button
          type="submit"
          disabled={isSubmitting || totalItemsToGenerate === 0}
          className="text-xs font-semibold text-neutral-950 hover:text-neutral-600 transition-colors cursor-pointer disabled:opacity-40 flex items-center gap-2"
        >
          {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin stroke-[1.5]" />}
          <span>
            {isSubmitting
              ? "Guardando en Google Sheets..."
              : `Guardar planificación (${totalItemsToGenerate})`}
          </span>
        </button>
      </div>
    </form>
  );
}

