"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Search,
  X,
  ArrowDownWideNarrow,
  ArrowUpAZ,
  Settings2,
} from "lucide-react";
import { cn, formatNumber, formatProperCase } from "@/lib/utils";

export interface DimensionItem {
  name: string;
  value: number;
  secondaryValue?: number;
  secondaryLabel?: string;
  history?: number[];
  badge?: string;
  badgeVariant?: string;
  category?: string;
  subtext?: string;
  isExCollaborator?: boolean;
}

interface DimensionExplorerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  dimensionName: "asesores" | "sectores" | "zonas" | "tecnicos";
  items: DimensionItem[];
  selectedItem?: string;
  onSelectItem?: (name: string) => void;
  onOpenConfig?: () => void;
}

export function DimensionExplorerModal({
  isOpen,
  onClose,
  title,
  subtitle,
  dimensionName,
  items,
  selectedItem,
  onSelectItem,
  onOpenConfig,
}: DimensionExplorerModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"value-desc" | "name-asc">("value-desc");
  const [advisorTab, setAdvisorTab] = useState<"all" | "activos" | "ex">("all");

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Reset search & tab when opening
  useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      setAdvisorTab("all");
    }
  }, [isOpen]);

  // Advisor counts by status
  const advisorCounts = useMemo(() => {
    if (dimensionName !== "asesores") return { all: items.length, activos: items.length, ex: 0 };
    let ex = 0;
    let activos = 0;
    items.forEach((i) => {
      const isEx = i.isExCollaborator || i.subtext === "Ex Colaborador";
      if (isEx) ex++;
      else activos++;
    });
    return { all: items.length, activos, ex };
  }, [items, dimensionName]);

  // Filtered & Sorted items
  const processedItems = useMemo(() => {
    let result = [...items];

    if (dimensionName === "asesores" && advisorTab !== "all") {
      result = result.filter((item) => {
        const isEx = item.isExCollaborator || item.subtext === "Ex Colaborador";
        return advisorTab === "ex" ? isEx : !isEx;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((item) => {
        const matchName = item.name.toLowerCase().includes(q);
        const matchBadge = item.badge ? item.badge.toLowerCase().includes(q) : false;
        const matchSub = item.subtext ? item.subtext.toLowerCase().includes(q) : false;
        return matchName || matchBadge || matchSub;
      });
    }

    if (sortBy === "value-desc") {
      result.sort((a, b) => b.value - a.value);
    } else if (sortBy === "name-asc") {
      result.sort((a, b) => a.name.localeCompare(b.name));
    }

    return result;
  }, [items, searchQuery, sortBy, dimensionName, advisorTab]);

  // Dynamically select the first active leader (excluding ex-collaborators)
  const activeLeader = useMemo(() => {
    return (
      processedItems.find(
        (i) => !i.isExCollaborator && i.subtext !== "Ex Colaborador"
      ) || null
    );
  }, [processedItems]);

  // Summary statistics calculated DYNAMICALLY on filtered items
  const totalValue = useMemo(() => {
    return processedItems.reduce((acc, curr) => acc + curr.value, 0);
  }, [processedItems]);

  const maxValue = useMemo(() => {
    return processedItems.length > 0 ? Math.max(...processedItems.map((i) => i.value)) : 1;
  }, [processedItems]);

  const avgValue = useMemo(() => {
    return processedItems.length > 0 ? Math.round(totalValue / processedItems.length) : 0;
  }, [processedItems, totalValue]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-neutral-900/40 backdrop-blur-xs transition-opacity duration-200"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-white rounded-xl shadow-2xl border border-neutral-200/80 flex flex-col overflow-hidden z-10 animate-in fade-in-0 zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-neutral-900 tracking-tight font-sans">
                {title}
              </h2>
              <span className="text-[10px] font-mono text-neutral-600 bg-neutral-100 border border-neutral-200 px-1.5 py-0.5 rounded font-medium">
                {processedItems.length} de {items.length} totales
              </span>
            </div>
            {subtitle && (
              <p className="text-xs font-mono text-neutral-500 mt-0.5">
                {subtitle}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1">
            {dimensionName === "asesores" && onOpenConfig && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenConfig();
                }}
                className="min-h-[44px] px-2.5 text-xs font-mono text-neutral-500 hover:text-neutral-900 transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                title="Configurar roles y estado de colaboradores"
              >
                <Settings2 className="w-3.5 h-3.5 stroke-[1.75]" />
                <span className="hidden sm:inline">Configurar</span>
              </button>
            )}

            {/* Close Icon Button */}
            <button
              type="button"
              onClick={onClose}
              className="min-w-[44px] min-h-[44px] p-2 text-neutral-400 hover:text-neutral-900 transition-colors flex items-center justify-center cursor-pointer shrink-0 -mr-2"
              title="Cerrar modal (Esc)"
              aria-label="Cerrar modal"
            >
              <X className="w-4 h-4 stroke-[1.75]" />
            </button>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-5 py-3 bg-neutral-50/70 border-b border-neutral-100 text-xs font-mono">
          <div>
            <div className="text-[10px] uppercase text-neutral-400 tracking-wider">
              Volumen Total
            </div>
            <div className="text-sm font-bold text-neutral-900">
              {formatNumber(totalValue)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-neutral-400 tracking-wider">
              Registros / Promedio
            </div>
            <div className="text-sm font-bold text-neutral-900">
              {formatNumber(avgValue)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-neutral-400 tracking-wider">
              Líder Activo
            </div>
            <div className="text-xs font-semibold text-neutral-900 truncate" title={activeLeader?.name}>
              {formatProperCase(activeLeader?.name) || "N/A"}
            </div>
          </div>
          <div>            <div className="text-[10px] text-neutral-400">
              Pico de volumen
            </div>
            <div className="text-sm font-bold text-neutral-900">
              {formatNumber(maxValue)}
            </div>
          </div>
        </div>

        {/* Search & Sort Controls Toolbar */}
        <div className="px-3 sm:px-5 py-2.5 border-b border-neutral-100 flex flex-wrap items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Filtrar en ${items.length} ${dimensionName}...`}
              className="w-full pl-8 pr-8 py-2 sm:py-1.5 text-sm sm:text-xs font-mono text-neutral-900 placeholder:text-neutral-400 border-b border-neutral-200 focus:border-neutral-900 bg-transparent focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="min-w-[36px] min-h-[36px] p-2 text-neutral-400 hover:text-neutral-900 absolute right-0 top-1/2 -translate-y-1/2 flex items-center justify-center cursor-pointer"
                title="Limpiar búsqueda"
                aria-label="Limpiar búsqueda"
              >
                <X className="w-3.5 h-3.5 stroke-[1.75]" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Status Tabs for Advisors */}
            {dimensionName === "asesores" && (
              <div className="flex items-center gap-1.5 text-xs font-mono overflow-x-auto no-scrollbar py-1">
                {[
                  { id: "all", label: "Todos", count: advisorCounts.all },
                  { id: "activos", label: "Activos", count: advisorCounts.activos },
                  { id: "ex", label: "Ex Colaboradores", count: advisorCounts.ex },
                ].map((tab) => {
                  const isActive = advisorTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setAdvisorTab(tab.id as any)}
                      className={cn(
                        "min-h-[36px] py-1.5 px-2 text-xs flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap",
                        isActive
                          ? "text-neutral-900 font-semibold border-b-2 border-neutral-900 -mb-[1px]"
                          : "text-neutral-500 hover:text-neutral-900"
                      )}
                    >
                      <span>{tab.label}</span>
                      <span className={cn("text-[10px] opacity-70", isActive ? "text-neutral-900" : "text-neutral-400")}>
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Sort Buttons (Minimalist Icons Only) */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setSortBy("value-desc")}
                className={cn(
                  "min-w-[40px] min-h-[40px] p-2 flex items-center justify-center transition-colors cursor-pointer",
                  sortBy === "value-desc"
                    ? "text-neutral-900 font-bold"
                    : "text-neutral-400 hover:text-neutral-900"
                )}
                title="Ordenar por mayor volumen a menor"
                aria-label="Ordenar por volumen descendente"
              >
                <ArrowDownWideNarrow className={cn("w-4 h-4", sortBy === "value-desc" ? "stroke-[2.25]" : "stroke-[1.5]")} />
              </button>

              <button
                type="button"
                onClick={() => setSortBy("name-asc")}
                className={cn(
                  "min-w-[40px] min-h-[40px] p-2 flex items-center justify-center transition-colors cursor-pointer",
                  sortBy === "name-asc"
                    ? "text-neutral-900 font-bold"
                    : "text-neutral-400 hover:text-neutral-900"
                )}
                title="Ordenar alfabéticamente (A-Z)"
                aria-label="Ordenar alfabéticamente"
              >
                <ArrowUpAZ className={cn("w-4 h-4", sortBy === "name-asc" ? "stroke-[2.25]" : "stroke-[1.5]")} />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Ranking List */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-2 space-y-1 divide-y divide-neutral-100/60 max-h-[500px]">
          {processedItems.length === 0 ? (
            <div className="text-center py-12 text-xs font-mono text-neutral-400">
              No se encontraron registros que coincidan con la búsqueda.
            </div>
          ) : (
            processedItems.map((item, idx) => {
              const pctOfMax = maxValue > 0 ? Math.round((item.value / maxValue) * 100) : 0;
              const isSelected = selectedItem === item.name;
              const isEx = Boolean(item.isExCollaborator || item.subtext === "Ex Colaborador");

              return (
                <div
                  key={`${item.name}-${idx}`}
                  onClick={() => {
                    if (onSelectItem) {
                      onSelectItem(item.name);
                    }
                    onClose();
                  }}
                  className={cn(
                    "min-h-[44px] py-2.5 px-2 group flex items-center justify-between cursor-pointer transition-colors border-b border-neutral-100 last:border-b-0",
                    isSelected
                      ? "bg-neutral-50 font-medium"
                      : "hover:bg-neutral-50/60"
                  )}
                  title={`Filtrar dashboard por ${item.name}`}
                >
                  {/* Left: Rank & Name */}
                  <div className="flex items-center gap-3 min-w-0 flex-1 pr-4">
                    <span
                      className={cn(
                        "w-6 h-6 rounded-md flex items-center justify-center font-mono text-[10px] font-bold shrink-0",
                        idx === 0
                          ? "bg-neutral-900 text-white"
                          : idx === 1
                          ? "bg-neutral-700 text-white"
                          : idx === 2
                          ? "bg-neutral-400 text-white"
                          : "border border-neutral-200 text-neutral-600 bg-white"
                      )}
                    >
                      {idx + 1}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={cn(
                            "text-xs font-semibold truncate",
                            isEx
                              ? "text-neutral-500 line-through decoration-neutral-300"
                              : "text-neutral-900"
                          )}
                        >
                          {formatProperCase(item.name)}
                        </span>

                        {item.subtext && (
                          <>
                            <span className="text-neutral-300 text-[10px] select-none">•</span>
                            <span
                              className={cn(
                                "text-[10px] font-mono font-normal truncate shrink-0",
                                isEx ? "text-neutral-400 italic" : "text-neutral-400"
                              )}
                            >
                              {item.subtext}
                            </span>
                          </>
                        )}

                        {/* Neutral badge only for technical squads */}
                        {item.badge && item.badgeVariant === "equipo" && (
                          <>
                            <span className="text-neutral-300 text-[10px] select-none">•</span>
                            <span className="text-[10px] font-mono text-neutral-400 font-normal truncate shrink-0">
                              {item.badge}
                            </span>
                          </>
                        )}

                        {isSelected && (
                          <span className="w-1.5 h-1.5 rounded-full bg-neutral-900 shrink-0" />
                        )}
                      </div>

                      {/* Visual Bar Indicator */}
                      <div className="w-full max-w-xs bg-neutral-100 h-1 rounded-full overflow-hidden mt-1.5">
                        <div
                          className="h-full bg-neutral-900 rounded-full transition-all duration-300"
                          style={{ width: `${pctOfMax}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right: Metrics & Action */}
                  <div className="flex items-center gap-4 shrink-0 font-mono text-xs text-right">
                    {item.secondaryValue !== undefined && (
                      <div className="hidden sm:block text-[11px] text-neutral-500">
                        <span>{formatNumber(item.secondaryValue)}</span>
                        {item.secondaryLabel && (
                          <span className="text-[10px] text-neutral-400 ml-1">
                            {item.secondaryLabel}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="w-16">
                      <span className="font-semibold text-neutral-900">
                        {formatNumber(item.value)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Minimal Footer */}
        <div className="px-5 py-3 border-t border-neutral-100 bg-neutral-50/50 flex items-center justify-between text-xs font-mono text-neutral-500">
          <span>{processedItems.length} registros listados</span>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-700 hover:text-neutral-900 font-medium cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
