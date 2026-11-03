"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Search, X, Calendar, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlanificacionFilterCommandBarProps {
  searchTerm: string;
  onSearchChange: (val: string) => void;
  options: {
    advisors: string[];
    sectors: string[];
    months: string[];
    parroquias: string[];
    municipios: string[];
  };
  selectedAdvisor?: string | null;
  onSelectAdvisor: (advisor: string | null) => void;
  selectedSector?: string | null;
  onSelectSector: (sector: string | null) => void;
  selectedMonth?: string;
  onSelectMonth: (month: string) => void;
  onResetFilters: () => void;
}

export function PlanificacionFilterCommandBar({
  searchTerm,
  onSearchChange,
  options,
  selectedAdvisor,
  onSelectAdvisor,
  selectedSector,
  onSelectSector,
  selectedMonth,
  onSelectMonth,
  onResetFilters,
}: PlanificacionFilterCommandBarProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Atajo de teclado (Cmd+K / Ctrl+K / Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setIsDropdownOpen(true);
      }
      if (e.key === "Escape") {
        setIsDropdownOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const query = searchTerm.trim().toLowerCase();

  // Listas filtradas con límite para el desplegable interactivo
  const filteredMonths = useMemo(() => {
    return (options.months || []).filter((m) => m.toLowerCase().includes(query)).slice(0, 5);
  }, [options.months, query]);

  const filteredAdvisors = useMemo(() => {
    return (options.advisors || []).filter((a) => a.toLowerCase().includes(query)).slice(0, 6);
  }, [options.advisors, query]);

  const filteredSectors = useMemo(() => {
    return (options.sectors || []).filter((s) => s.toLowerCase().includes(query)).slice(0, 6);
  }, [options.sectors, query]);

  const filteredParroquias = useMemo(() => {
    return (options.parroquias || []).filter((p) => p.toLowerCase().includes(query)).slice(0, 4);
  }, [options.parroquias, query]);

  const totalResults =
    filteredMonths.length +
    filteredAdvisors.length +
    filteredSectors.length +
    filteredParroquias.length;

  const handleSelectAdvisor = (adv: string) => {
    onSelectAdvisor(adv);
    onSearchChange("");
    setIsDropdownOpen(false);
  };

  const handleSelectSector = (sec: string) => {
    onSelectSector(sec);
    onSearchChange("");
    setIsDropdownOpen(false);
  };

  const handleSelectMonth = (m: string) => {
    onSelectMonth(m);
    onSearchChange("");
    setIsDropdownOpen(false);
  };

  const handleSelectTextQuery = (val: string) => {
    onSearchChange(val);
    setIsDropdownOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full sm:w-80">
      <div className="flex items-center gap-2 px-2.5 py-1.5 text-neutral-400 focus-within:text-neutral-900 border-b border-transparent focus-within:border-neutral-300 transition-colors">
        <Search className="w-3.5 h-3.5 shrink-0 transition-colors" />
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => {
            onSearchChange(e.target.value);
            if (!isDropdownOpen) setIsDropdownOpen(true);
          }}
          onFocus={() => setIsDropdownOpen(true)}
          placeholder="Buscar asesor, sector, mes..."
          className="w-full bg-transparent text-sm sm:text-xs font-mono text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
        />
        {searchTerm ? (
          <button
            type="button"
            onClick={() => {
              onSearchChange("");
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

      {/* Desplegable emergente de sugerencias estilo FilterCommandBar */}
      {isDropdownOpen && (
        <div className="fixed sm:absolute top-20 sm:top-full left-3 right-3 sm:left-auto sm:right-0 mt-1.5 w-auto sm:w-[380px] max-w-none sm:max-w-[420px] bg-white border border-neutral-200 shadow-xl rounded-xl p-2 z-50 text-left font-sans max-h-96 overflow-y-auto">
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
                    onClick={() => handleSelectMonth(m)}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer text-xs"
                  >
                    <span className="font-medium text-neutral-900">Mes: {m}</span>
                    <span className="text-[10px] font-mono text-neutral-400">Seleccionar</span>
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
                    onClick={() => handleSelectAdvisor(a)}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer text-xs"
                  >
                    <span className="font-medium text-neutral-900">Asesor: {a}</span>
                    <span className="text-[10px] font-mono text-neutral-500 font-medium">Filtrar</span>
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
                    onClick={() => handleSelectSector(s)}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer text-xs"
                  >
                    <span className="font-medium text-neutral-900">Sector: {s}</span>
                    <span className="text-[10px] font-mono text-neutral-400">Filtrar</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Parroquias o Zonas */}
          {filteredParroquias.length > 0 && (
            <div className="mb-2">
              <p className="px-2 py-0.5 text-[10px] font-mono font-medium text-neutral-400">
                Parroquias / Rutas
              </p>
              <div className="space-y-0.5">
                {filteredParroquias.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handleSelectTextQuery(p)}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer text-xs"
                  >
                    <span className="font-medium text-neutral-900">Ruta: {p}</span>
                    <span className="text-[10px] font-mono text-neutral-400">Buscar</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {totalResults === 0 && (
            <div className="p-3 text-center text-neutral-400 text-xs font-mono">
              Sin coincidencias directas para &ldquo;{searchTerm}&rdquo;
            </div>
          )}
        </div>
      )}
    </div>
  );
}
