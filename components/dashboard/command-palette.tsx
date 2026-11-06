"use client";

import { useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  zones: string[];
  sectors: string[];
  advisors: string[];
  months?: string[];
  technicians?: string[];
  onSelectFilter: (category: any, value: string) => void;
  onOpenAdvisorConfig?: () => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  zones,
  sectors,
  advisors,
  months = [],
  technicians = [],
  onSelectFilter,
  onOpenAdvisorConfig,
}: CommandPaletteProps) {
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setSearch("");
    }
  }, [isOpen]);

  // Global keyboard shortcuts (Cmd+K, Ctrl+K, ESC)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const query = search.toLowerCase();

  const filteredMonths = months.filter((m) => m.toLowerCase().includes(query)).slice(0, 4);
  const filteredZones = zones.filter((z) => z.toLowerCase().includes(query)).slice(0, 5);
  const filteredSectors = sectors.filter((s) => s.toLowerCase().includes(query)).slice(0, 5);
  const filteredAdvisors = advisors.filter((a) => a.toLowerCase().includes(query)).slice(0, 5);
  const filteredTechs = technicians.filter((t) => t.toLowerCase().includes(query)).slice(0, 4);

  const handleSelect = (category: string, val: string) => {
    onSelectFilter(category, val);
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-xs flex items-start justify-center pt-20 px-4 transition-all"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-white border border-neutral-200 rounded-xl shadow-2xl overflow-hidden font-sans transform transition-all"
      >
        {/* Search Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-neutral-200 bg-neutral-50 gap-2">
          <Search className="w-4 h-4 text-neutral-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Escribe un comando, asesor, zona o sector..."
            className="bg-transparent border-0 p-0 text-sm font-mono text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-0 w-full"
          />
          <button
            onClick={onClose}
            className="text-[11px] font-mono text-neutral-600 hover:text-neutral-900 px-2 py-0.5 rounded border border-neutral-300 hover:bg-neutral-100 shrink-0 cursor-pointer"
          >
            Cerrar
          </button>
        </div>

        {/* Quick Filter Suggestions List */}
        <div className="p-2 max-h-80 overflow-y-auto space-y-3 font-mono text-xs">
          {/* Quick Action: Configurar Asesores */}
          {onOpenAdvisorConfig && (query === "" || "configuracion roles asesores canales tipo venta".includes(query)) && (
            <div className="pb-1">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAdvisorConfig();
                }}
                className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left bg-neutral-50 hover:bg-neutral-100 border border-neutral-200/80 transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded bg-neutral-900 text-white flex items-center justify-center text-[10px] font-bold">
                    ⚙
                  </span>
                  <div>
                    <span className="text-neutral-900 font-semibold text-xs font-sans">
                      Configuración de Asesores y Canales
                    </span>
                    <p className="text-[10px] text-neutral-400">
                      Asignar tipo de venta (Calle, Taquilla, Planificación, Externo)
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-neutral-500 border border-neutral-200 bg-white px-1.5 py-0.5 rounded">
                  Abrir
                </span>
              </button>
            </div>
          )}

          {/* Category: Meses */}
          {filteredMonths.length > 0 && (
            <div>
              <p className="px-2 py-1 text-[10px] font-semibold uppercase text-neutral-400 tracking-wider">
                Meses
              </p>
              <div className="space-y-0.5">
                {filteredMonths.map((m) => (
                  <button
                    key={m}
                    onClick={() => handleSelect("months", m)}
                    className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer"
                  >
                    <span className="font-sans font-medium text-neutral-900">Mes: {m}</span>
                    <span className="text-[10px] text-neutral-500">Filtrar</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Category: Zonas */}
          {filteredZones.length > 0 && (
            <div>
              <p className="px-2 py-1 text-[10px] font-semibold uppercase text-neutral-400 tracking-wider">
                Zonas Territoriales
              </p>
              <div className="space-y-0.5">
                {filteredZones.map((z) => (
                  <button
                    key={z}
                    onClick={() => handleSelect("zones", z)}
                    className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer"
                  >
                    <span className="font-sans font-medium text-neutral-900">Zona: {z}</span>
                    <span className="text-[10px] text-neutral-500">Filtrar</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Category: Sectores */}
          {filteredSectors.length > 0 && (
            <div>
              <p className="px-2 py-1 text-[10px] font-semibold uppercase text-neutral-400 tracking-wider">
                Sectores Comerciales
              </p>
              <div className="space-y-0.5">
                {filteredSectors.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSelect("sectors", s)}
                    className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer"
                  >
                    <span className="font-sans font-medium text-neutral-900">Sector: {s}</span>
                    <span className="text-[10px] text-neutral-500">Filtrar</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Category: Asesores */}
          {filteredAdvisors.length > 0 && (
            <div>
              <p className="px-2 py-1 text-[10px] font-semibold uppercase text-neutral-400 tracking-wider">
                Asesores Top
              </p>
              <div className="space-y-0.5">
                {filteredAdvisors.map((a) => (
                  <button
                    key={a}
                    onClick={() => handleSelect("advisors", a)}
                    className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer"
                  >
                    <span className="font-sans font-medium text-neutral-900">Asesor: {a}</span>
                    <span className="text-[10px] text-emerald-700 font-mono font-medium">Seleccionar</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Category: Técnicos */}
          {filteredTechs.length > 0 && (
            <div>
              <p className="px-2 py-1 text-[10px] font-semibold uppercase text-neutral-400 tracking-wider">
                Técnicos de Campo
              </p>
              <div className="space-y-0.5">
                {filteredTechs.map((t) => (
                  <button
                    key={t}
                    onClick={() => handleSelect("technicians", t)}
                    className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer"
                  >
                    <span className="font-sans font-medium text-neutral-900">Técnico: {t}</span>
                    <span className="text-[10px] text-neutral-500">Filtrar</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {filteredMonths.length === 0 && filteredZones.length === 0 && filteredSectors.length === 0 && filteredAdvisors.length === 0 && filteredTechs.length === 0 && (
            <div className="p-4 text-center text-neutral-400 text-xs">
              No se encontraron coincidencias para &ldquo;{search}&rdquo;
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between text-[11px] font-mono text-neutral-500">
          <span>Búsqueda rápida</span>
          <span>Presiona ESC para salir</span>
        </div>
      </div>
    </div>
  );
}
