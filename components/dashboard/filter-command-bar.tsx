"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Calendar, FilterX, RotateCcw, X } from "lucide-react";
import { cn, formatProperCase } from "@/lib/utils";

export interface FilterState {
  advisors: string[];
  zones: string[];
  statuses: string[];
  months: string[];
  sectors: string[];
  technicians: string[];
  oficinas: string[];
  plans?: string[];
  dateFrom: string;
  dateTo: string;
  resetKey?: number;
}

interface FilterCommandBarProps {
  currentFilters: FilterState;
  options: {
    advisors: string[];
    zones: string[];
    sectors: string[];
    statuses: string[];
    months: string[];
    technicians: string[];
  };
  onFilterChange: (type: keyof FilterState, value: string) => void;
  onDateChange: (type: "dateFrom" | "dateTo", value: string) => void;
  onResetFilters: () => void;
  onOpenAdvisorConfig?: () => void;
}

export function FilterCommandBar({
  currentFilters,
  options,
  onFilterChange,
  onDateChange,
  onResetFilters,
  onOpenAdvisorConfig,
}: FilterCommandBarProps) {
  const [search, setSearch] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);

  // Close dropdown or datepicker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setShowDatePicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Global shortcut (Cmd+K / Ctrl+K / Escape) to focus the direct search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setIsDropdownOpen(true);
      }
      if (e.key === "Escape") {
        setIsDropdownOpen(false);
        setShowDatePicker(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const query = search.trim().toLowerCase();

  // Filtered lists for the dropdown
  const filteredMonths = (options.months || []).filter((m) => m.toLowerCase().includes(query)).slice(0, 5);
  const filteredZones = (options.zones || []).filter((z) => z.toLowerCase().includes(query)).slice(0, 6);
  const filteredSectors = (options.sectors || []).filter((s) => s.toLowerCase().includes(query)).slice(0, 6);
  const filteredAdvisors = (options.advisors || []).filter((a) => a.toLowerCase().includes(query)).slice(0, 6);
  const filteredTechs = (options.technicians || []).filter((t) => t.toLowerCase().includes(query)).slice(0, 5);

  const totalResults =
    filteredMonths.length +
    filteredZones.length +
    filteredSectors.length +
    filteredAdvisors.length +
    filteredTechs.length;

  const handleSelect = (category: keyof FilterState, val: string) => {
    onFilterChange(category, val);
    setSearch("");
    setIsDropdownOpen(false);
  };

  // Collect all active filter chips
  const activeChips: { category: keyof FilterState; label: string; value: string }[] = [];

  currentFilters.months.forEach((m) => activeChips.push({ category: "months", label: "Mes", value: m }));
  currentFilters.zones.forEach((z) => activeChips.push({ category: "zones", label: "Zona", value: z }));
  currentFilters.sectors.forEach((s) => activeChips.push({ category: "sectors", label: "Sector", value: s }));
  currentFilters.advisors.forEach((a) => activeChips.push({ category: "advisors", label: "Asesor", value: a }));
  currentFilters.statuses.forEach((st) => activeChips.push({ category: "statuses", label: "Estatus", value: st }));
  currentFilters.technicians.forEach((t) => activeChips.push({ category: "technicians", label: "Técnico", value: t }));

  const hasActiveFilters = activeChips.length > 0 || currentFilters.dateFrom || currentFilters.dateTo;

  return (
    <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 text-xs font-mono select-none w-full justify-between sm:justify-start">
      {/* Search Input Container with Dropdown Attached Below */}
      <div ref={containerRef} className="relative flex-1 min-w-[180px] sm:max-w-[340px]">
        <div className="flex items-center gap-2 px-2.5 py-1.5 text-neutral-400 focus-within:text-neutral-900 border-b border-transparent focus-within:border-neutral-300 transition-colors">
          <Search className="w-3.5 h-3.5 shrink-0 transition-colors" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              if (!isDropdownOpen) setIsDropdownOpen(true);
            }}
            onFocus={() => setIsDropdownOpen(true)}
            placeholder="Buscar asesor, zona, mes..."
            className="w-full bg-transparent text-sm sm:text-xs font-mono text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
          />
          {search ? (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                inputRef.current?.focus();
              }}
              className="text-neutral-400 hover:text-neutral-900 cursor-pointer p-1 -m-0.5 transition-colors"
              title="Borrar texto"
            >
              <X className="w-3 h-3" />
            </button>
          ) : (
            <span className="text-[10px] text-neutral-300 font-mono hidden sm:inline select-none">
              ⌘K
            </span>
          )}
        </div>

        {/* Dropdown Menu attached directly beneath the search input */}
        {isDropdownOpen && (
          <div className="fixed sm:absolute top-20 sm:top-full left-3 right-3 sm:left-0 sm:right-auto mt-1.5 w-auto sm:w-[380px] max-w-none sm:max-w-[420px] bg-white border border-neutral-200 shadow-xl rounded-xl p-2 z-50 text-left font-sans max-h-96 overflow-y-auto">
            {/* Optional Advisor Config Quick Action */}
            {onOpenAdvisorConfig && (query === "" || "configuracion roles personal asesores tecnicos canales colaboradores".includes(query)) && (
              <div className="pb-1.5 mb-1 border-b border-neutral-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsDropdownOpen(false);
                    onOpenAdvisorConfig();
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left hover:bg-neutral-50 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded bg-neutral-900 text-white flex items-center justify-center text-[9px] font-bold">
                      ⚙
                    </span>
                    <span className="text-neutral-900 text-xs font-medium">
                      Configurar Personal (Asesores y Técnicos)
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-neutral-400 group-hover:text-neutral-900 transition-colors">
                    Abrir
                  </span>
                </button>
              </div>
            )}

            {/* Meses */}
            {filteredMonths.length > 0 && (
              <div className="mb-2">
                <p className="px-2 py-0.5 text-[10px] font-mono font-medium text-neutral-400">
                  Meses
                </p>
                <div className="space-y-0.5">
                  {filteredMonths.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleSelect("months", m)}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer text-xs"
                    >
                      <span className="font-medium text-neutral-900">Mes: {m}</span>
                      <span className="text-[10px] font-mono text-neutral-400">Filtrar</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Zonas */}
            {filteredZones.length > 0 && (
              <div className="mb-2">
                <p className="px-2 py-0.5 text-[10px] font-mono font-medium text-neutral-400">
                  Zonas
                </p>
                <div className="space-y-0.5">
                  {filteredZones.map((z) => (
                    <button
                      key={z}
                      type="button"
                      onClick={() => handleSelect("zones", z)}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer text-xs"
                    >
                      <span className="font-medium text-neutral-900">Zona: {z}</span>
                      <span className="text-[10px] font-mono text-neutral-400">Filtrar</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Sectores */}
            {filteredSectors.length > 0 && (
              <div className="mb-2">
                <p className="px-2 py-0.5 text-[10px] font-mono font-medium text-neutral-400">
                  Sectores
                </p>
                <div className="space-y-0.5">
                  {filteredSectors.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleSelect("sectors", s)}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer text-xs"
                    >
                      <span className="font-medium text-neutral-900">Sector: {s}</span>
                      <span className="text-[10px] font-mono text-neutral-400">Filtrar</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Asesores */}
            {filteredAdvisors.length > 0 && (
              <div className="mb-2">
                <p className="px-2 py-0.5 text-[10px] font-mono font-medium text-neutral-400">
                  Asesores
                </p>
                <div className="space-y-0.5">
                  {filteredAdvisors.map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => handleSelect("advisors", a)}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer text-xs"
                    >
                      <span className="font-medium text-neutral-900">Asesor: {a}</span>
                      <span className="text-[10px] font-mono text-neutral-500 font-medium">Filtrar</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Técnicos */}
            {filteredTechs.length > 0 && (
              <div className="mb-2">
                <p className="px-2 py-0.5 text-[10px] font-mono font-medium text-neutral-400">
                  Técnicos
                </p>
                <div className="space-y-0.5">
                  {filteredTechs.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleSelect("technicians", t)}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer text-xs"
                    >
                      <span className="font-medium text-neutral-900">Técnico: {t}</span>
                      <span className="text-[10px] font-mono text-neutral-400">Filtrar</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {totalResults === 0 && (
              <div className="p-3 text-center text-neutral-400 text-xs font-mono">
                Sin coincidencias para &ldquo;{search}&rdquo;
              </div>
            )}
          </div>
        )}
      </div>

      {/* Date Filter Trigger */}
      <div className="relative shrink-0" ref={datePickerRef}>
        <button
          type="button"
          onClick={() => setShowDatePicker(!showDatePicker)}
          className={cn(
            "min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer p-2",
            showDatePicker || currentFilters.dateFrom || currentFilters.dateTo
              ? "text-neutral-900 font-semibold underline decoration-neutral-900"
              : "text-neutral-400 hover:text-neutral-900"
          )}
          title="Filtrar por rango de fechas"
          aria-label="Filtrar por fechas"
        >
          <Calendar className="w-3.5 h-3.5 stroke-[1.75]" />
          {(currentFilters.dateFrom || currentFilters.dateTo) && (
            <span className="text-[11px]">
              {`${currentFilters.dateFrom || "..."} → ${currentFilters.dateTo || "..."}`}
            </span>
          )}
        </button>

        {/* Inline Date Picker Popover/Dropdown if open */}
        {showDatePicker && (
          <div className="fixed sm:absolute top-24 sm:top-full left-3 right-3 sm:left-auto sm:right-0 mt-2 bg-white border border-neutral-200 shadow-xl rounded-xl p-3 z-50 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-auto sm:w-auto">
            <div className="flex items-center gap-1.5 justify-between sm:justify-start">
              <span className="text-neutral-400 text-[11px] min-w-[42px]">Desde</span>
              <input
                type="date"
                value={currentFilters.dateFrom}
                onChange={(e) => onDateChange("dateFrom", e.target.value)}
                className="bg-transparent text-sm sm:text-xs font-mono text-neutral-900 border-b border-neutral-300 focus:border-black outline-none pb-0.5 cursor-pointer flex-1 sm:flex-initial"
              />
            </div>
            <span className="text-neutral-300 hidden sm:inline">—</span>
            <div className="flex items-center gap-1.5 justify-between sm:justify-start">
              <span className="text-neutral-400 text-[11px] min-w-[42px]">Hasta</span>
              <input
                type="date"
                value={currentFilters.dateTo}
                onChange={(e) => onDateChange("dateTo", e.target.value)}
                className="bg-transparent text-sm sm:text-xs font-mono text-neutral-900 border-b border-neutral-300 focus:border-black outline-none pb-0.5 cursor-pointer flex-1 sm:flex-initial"
              />
            </div>
            {(currentFilters.dateFrom || currentFilters.dateTo) && (
              <button
                type="button"
                onClick={() => {
                  onDateChange("dateFrom", "");
                  onDateChange("dateTo", "");
                }}
                className="min-h-[36px] px-2 text-neutral-400 hover:text-neutral-900 transition-colors inline-flex items-center justify-center cursor-pointer text-xs"
                title="Limpiar rango de fechas"
              >
                <RotateCcw className="w-3.5 h-3.5 stroke-[1.75] mr-1" />
                <span className="sm:hidden">Limpiar</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Active Filter Chips or Reset Button */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto pt-1 sm:pt-0 border-t sm:border-t-0 border-neutral-100">
          {activeChips.slice(0, 3).map((chip, idx) => (
            <span
              key={`${chip.category}-${chip.value}-${idx}`}
              className="inline-flex items-center gap-1 text-[11px] text-neutral-800 font-medium"
            >
              <span className="text-neutral-400 font-normal">{chip.label}:</span>
              <span className="text-neutral-900">{formatProperCase(chip.value)}</span>
              <button
                type="button"
                onClick={() => onFilterChange(chip.category, chip.value)}
                className="text-neutral-400 hover:text-neutral-900 cursor-pointer ml-0.5 p-1 -m-0.5 transition-colors inline-flex items-center justify-center"
                title={`Quitar filtro ${chip.value}`}
              >
                ✕
              </button>
            </span>
          ))}

          {activeChips.length > 3 && (
            <span className="text-[10px] text-neutral-400 font-mono">
              +{activeChips.length - 3} más
            </span>
          )}

          <button
            type="button"
            onClick={onResetFilters}
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center p-2 text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer ml-auto sm:ml-0"
            title="Restablecer todos los filtros"
            aria-label="Restablecer filtros"
          >
            <FilterX className="w-3.5 h-3.5 stroke-[1.75]" />
          </button>
        </div>
      )}
    </div>
  );
}
