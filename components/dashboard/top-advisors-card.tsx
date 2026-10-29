"use client";

import { useState, useMemo } from "react";
import { Maximize2, Settings2 } from "lucide-react";
import { cn, formatNumber, formatProperCase } from "@/lib/utils";
import { AdvisorType } from "@/lib/normalization";
import { DimensionExplorerModal } from "./dimension-explorer-modal";

export interface AdvisorItem {
  name: string;
  value: number;
  installed?: number;
  tipo_asesor?: AdvisorType;
  es_ex_colaborador?: boolean;
  sede_taquilla?: string;
  deltaMoM?: number;
  prevMonthValue?: number;
  isPositive?: boolean;
  sharePct?: number;
}

interface TopAdvisorsCardProps {
  title?: string;
  subtitle?: string;
  data: AdvisorItem[];
  totalAdvisorsCount?: number;
  onSelectAdvisor?: (advisor: string) => void;
  selectedAdvisor?: string;
  isTechnicianFiltered?: boolean;
  technicianName?: string;
  isSectorFiltered?: boolean;
  sectorName?: string;
  onOpenConfig?: () => void;
  className?: string;
}

function getAdvisorRoleLabel(
  tipo?: AdvisorType,
  sede?: string,
  name?: string,
  isEx?: boolean
): string {
  if (isEx) {
    return "Ex Colaborador";
  }
  if (name && (name.toLowerCase() === "planificación" || name.toLowerCase() === "planificacion")) {
    return "";
  }
  if (tipo === "taquilla") {
    return sede ? `Taquilla (${formatProperCase(sede)})` : "Taquilla";
  }
  if (tipo === "planificacion") return "Planificación";
  if (tipo === "externo") return "Externo";
  return "Ventas";
}

export function TopAdvisorsCard({
  title = "Top Asesores",
  subtitle = "Cumplimiento y volumen comercial",
  data,
  totalAdvisorsCount,
  onSelectAdvisor,
  selectedAdvisor,
  isTechnicianFiltered = false,
  technicianName,
  isSectorFiltered = false,
  sectorName,
  onOpenConfig,
  className,
}: TopAdvisorsCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [roleFilter, setRoleFilter] = useState<"ventas" | "taquilla" | "externos" | "todos">("ventas");

  // Calculate counts per role
  const counts = useMemo(() => {
    let ventas = 0;
    let taquilla = 0;
    let externos = 0;
    let todos = 0;

    data.forEach((d) => {
      const isPlan = d.tipo_asesor === "planificacion" || d.name.toLowerCase().includes("planificac");
      if (isPlan) return;
      const lower = d.name.toLowerCase();
      if (lower === "sin asesor" || lower === "desconocido" || lower.includes("administrador")) return;

      todos++;
      if (d.tipo_asesor === "taquilla") {
        taquilla++;
      } else if (d.tipo_asesor === "externo") {
        externos++;
      } else if ((d.tipo_asesor === "comercial" || !d.tipo_asesor) && !d.es_ex_colaborador) {
        ventas++;
      }
    });

    return { ventas, taquilla, externos, todos };
  }, [data]);

  // Filter advisors based on active role segment (Default: Ventas / Calle)
  const filteredItems = useMemo(() => {
    return data.filter((d) => {
      const isPlan = d.tipo_asesor === "planificacion" || d.name.toLowerCase().includes("planificac");
      if (isPlan) return false;
      const lower = d.name.toLowerCase();
      if (lower === "sin asesor" || lower === "desconocido" || lower.includes("administrador")) return false;

      if (roleFilter === "ventas") {
        return (d.tipo_asesor === "comercial" || !d.tipo_asesor) && !d.es_ex_colaborador;
      }
      if (roleFilter === "taquilla") {
        return d.tipo_asesor === "taquilla";
      }
      if (roleFilter === "externos") {
        return d.tipo_asesor === "externo";
      }
      return true; // "todos"
    });
  }, [data, roleFilter]);

  const displayedItems = filteredItems.slice(0, 5);
  const max = filteredItems.length > 0 ? filteredItems[0].value : 100;
  const barColors = [
    "bg-neutral-900",
    "bg-neutral-800",
    "bg-neutral-700",
    "bg-neutral-500",
    "bg-neutral-400",
  ];

  return (
    <>
      <div className={cn("p-4 sm:p-6 bg-white flex flex-col justify-between h-full select-none", className)}>
        <div>
          {/* Header */}
          <div className="flex items-center justify-between mb-1.5">
            <h3 className="text-sm font-semibold text-neutral-900 tracking-tight">{title}</h3>

            {/* Minimalist Controls */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-mono text-neutral-400">
                {filteredItems.length}
              </span>

              {/* Modal Expand Button */}
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="min-w-[36px] min-h-[36px] p-2 flex items-center justify-center text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
                title={`Explorar ranking completo (${data.length} asesores)`}
                aria-label="Abrir explorador de asesores"
              >
                <Maximize2 className="w-3.5 h-3.5 stroke-[1.75]" />
              </button>

              {/* Quick Advisor Configuration Button */}
              {onOpenConfig && (
                <button
                  type="button"
                  onClick={onOpenConfig}
                  className="min-w-[36px] min-h-[36px] p-2 flex items-center justify-center text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
                  title="Configurar roles, alias y estado de asesores"
                  aria-label="Configuración de asesores"
                >
                  <Settings2 className="w-3.5 h-3.5 stroke-[1.75]" />
                </button>
              )}
            </div>
          </div>
          <p className="text-[11px] font-mono text-neutral-500 mb-2 truncate">
            {isTechnicianFiltered && technicianName ? (
              <span>
                Asesores para técnico:{" "}
                <strong className="text-neutral-900 font-semibold">{technicianName}</strong>
              </span>
            ) : isSectorFiltered && sectorName ? (
              <span>
                Asesores para sector:{" "}
                <strong className="text-neutral-900 font-semibold">{sectorName}</strong>
              </span>
            ) : (
              subtitle
            )}
          </p>

          {/* Minimalist Typographic Role Switcher: Ventas | Taquilla | Externos | Todos */}
          <div className="flex items-center gap-x-4 text-xs font-mono mb-3.5 border-b border-neutral-100 pb-1 overflow-x-auto no-scrollbar whitespace-nowrap scroll-smooth -mx-4 px-4 sm:mx-0 sm:px-0">
            <button
              type="button"
              onClick={() => setRoleFilter("ventas")}
              className={cn(
                "min-h-[40px] py-2 px-1 flex items-center transition-colors cursor-pointer text-xs shrink-0",
                roleFilter === "ventas"
                  ? "text-neutral-950 font-bold border-b-2 border-neutral-900 -mb-[1px]"
                  : "text-neutral-400 hover:text-neutral-800 font-medium"
              )}
            >
              Ventas ({counts.ventas})
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter("taquilla")}
              className={cn(
                "min-h-[40px] py-2 px-1 flex items-center transition-colors cursor-pointer text-xs shrink-0",
                roleFilter === "taquilla"
                  ? "text-neutral-950 font-bold border-b-2 border-neutral-900 -mb-[1px]"
                  : "text-neutral-400 hover:text-neutral-800 font-medium"
              )}
            >
              Taquilla ({counts.taquilla})
            </button>
            {counts.externos > 0 && (
              <button
                type="button"
                onClick={() => setRoleFilter("externos")}
                className={cn(
                  "min-h-[40px] py-2 px-1 flex items-center transition-colors cursor-pointer text-xs shrink-0",
                  roleFilter === "externos"
                    ? "text-neutral-950 font-bold border-b-2 border-neutral-900 -mb-[1px]"
                    : "text-neutral-400 hover:text-neutral-800 font-medium"
                )}
              >
                Externos ({counts.externos})
              </button>
            )}
            <button
              type="button"
              onClick={() => setRoleFilter("todos")}
              className={cn(
                "min-h-[40px] py-2 px-1 flex items-center transition-colors cursor-pointer text-xs shrink-0",
                roleFilter === "todos"
                  ? "text-neutral-950 font-bold border-b-2 border-neutral-900 -mb-[1px]"
                  : "text-neutral-400 hover:text-neutral-800 font-medium"
              )}
            >
              Todos ({counts.todos})
            </button>
          </div>

          {/* Clean Advisor List - Labels without box (sin cuadro) */}
          <div className="space-y-1.5">
            {displayedItems.length === 0 ? (
              <div className="text-center py-6 text-xs text-neutral-400">Sin registros</div>
            ) : (
              displayedItems.map((advisor, idx) => {
                const pct = max > 0 ? Math.round((advisor.value / max) * 100) : 0;
                const isSelected = selectedAdvisor === advisor.name;
                const isAboveGoal = pct >= 80;
                const isEx = Boolean(advisor.es_ex_colaborador);
                const roleLabel = getAdvisorRoleLabel(advisor.tipo_asesor, advisor.sede_taquilla, advisor.name, isEx);

                return (
                  <div
                    key={`${advisor.name}-${idx}`}
                    onClick={() => onSelectAdvisor && onSelectAdvisor(advisor.name)}
                    className={cn(
                      "cursor-pointer transition-colors px-2 py-2 sm:py-1.5 rounded-lg min-h-[40px] flex flex-col justify-center",
                      idx < displayedItems.length - 1 && "border-b border-neutral-100 pb-2",
                      isSelected ? "bg-neutral-100 ring-1 ring-neutral-900" : "hover:bg-neutral-50"
                    )}
                    title={`Filtrar por asesor: ${advisor.name}${roleLabel ? ` (${roleLabel})` : ""}`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-5 h-5 rounded-full border border-neutral-300 bg-neutral-50 flex items-center justify-center font-mono text-[9px] font-bold text-neutral-900 shrink-0">
                          {idx + 1}
                        </span>
                        <span
                          className={cn("font-medium truncate", isEx ? "text-neutral-500 line-through decoration-neutral-300" : "text-neutral-900")}
                          title={advisor.name}
                        >
                          {formatProperCase(advisor.name)}
                        </span>
                        {roleLabel && (
                          <>
                            <span className="text-neutral-300 shrink-0 text-[10px] select-none">•</span>
                            <span className={cn("text-[10px] font-mono font-normal truncate shrink-0", isEx ? "text-neutral-400 italic" : "text-neutral-400")}>
                              {roleLabel}
                            </span>
                          </>
                        )}
                      </div>
                      {typeof advisor.sharePct === "number" ? (
                        <span
                          className="font-mono text-[11px] font-semibold text-neutral-800 shrink-0 ml-2"
                          title={
                            isTechnicianFiltered
                              ? `${advisor.sharePct.toFixed(1)}% de las instalaciones realizadas por ${technicianName || "el técnico"}`
                              : isSectorFiltered
                              ? `${advisor.sharePct.toFixed(1)}% de las ventas en ${sectorName || "el sector"}`
                              : advisor.prevMonthValue !== undefined
                              ? `${advisor.sharePct.toFixed(1)}% de cuota comercial • vs. mes ant. (${advisor.isPositive ? "+" : ""}${advisor.value - advisor.prevMonthValue} inst.)`
                              : `${advisor.sharePct.toFixed(1)}% de las ventas consolidadas`
                          }
                        >
                          {advisor.sharePct.toFixed(1)}%
                        </span>
                      ) : (
                        <span
                          className={cn(
                            "font-sans text-[11px] font-semibold shrink-0 ml-2",
                            isAboveGoal ? "text-emerald-600" : "text-orange-600"
                          )}
                        >
                          {pct}%
                        </span>
                      )}
                    </div>

                    <div className="w-full bg-neutral-100 h-1.5 rounded-full overflow-hidden mb-1">
                      <div
                        className={cn("h-full rounded-full transition-all duration-500", barColors[idx % barColors.length])}
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    <div className="flex justify-between text-[10px] font-mono text-neutral-500">
                      <span>{formatNumber(advisor.value)} instalaciones</span>
                      <span>{formatNumber(advisor.installed || 0)} solicitudes</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-neutral-100 text-[11px] font-mono text-neutral-500 flex justify-between items-center mt-4">
          <span>
            {formatNumber(filteredItems.length)}{" "}
            {roleFilter === "ventas"
              ? "asesores de ventas"
              : roleFilter === "taquilla"
              ? "taquilleros"
              : roleFilter === "externos"
              ? "externos"
              : "asesores"}
          </span>
          <span className="text-neutral-900 font-medium">
            Promedio:{" "}
            {filteredItems.length > 0
              ? (filteredItems.reduce((acc, a) => acc + a.value, 0) / filteredItems.length).toFixed(1)
              : 0}{" "}
            inst.
          </span>
        </div>
      </div>

      {/* Full Dimension Explorer Modal */}
      <DimensionExplorerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Directorio de Asesores"
        subtitle="Cumplimiento, ranking y volumen de solicitudes"
        dimensionName="asesores"
        items={data.map((a) => ({
          name: a.name,
          value: a.value,
          secondaryValue: a.installed,
          secondaryLabel: "solic.",
          subtext: getAdvisorRoleLabel(a.tipo_asesor, a.sede_taquilla, a.name, a.es_ex_colaborador),
          isExCollaborator: Boolean(a.es_ex_colaborador),
        }))}
        selectedItem={selectedAdvisor}
        onSelectItem={onSelectAdvisor}
        onOpenConfig={onOpenConfig}
      />
    </>
  );
}
