"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { PlanificacionRecord } from "@/lib/dashboard-data";

interface PlanificacionDailyViewProps {
  dateStr: string;
  dateLabel: string;
  records: PlanificacionRecord[];
  onSelectAdvisor?: (advisor: string) => void;
  selectedAdvisor?: string | null;
}

export function PlanificacionDailyView({
  dateStr,
  dateLabel,
  records,
  onSelectAdvisor,
  selectedAdvisor,
}: PlanificacionDailyViewProps) {
  const [groupBy, setGroupBy] = useState<"asesor" | "territorio">("asesor");

  // Agrupación por territorio (Parroquia o Municipio)
  const territoryGroups = useMemo(() => {
    const map = new Map<string, PlanificacionRecord[]>();
    records.forEach((r) => {
      const key = r.parroquia && r.parroquia !== "N/A"
        ? r.parroquia
        : r.municipio && r.municipio !== "N/A"
        ? r.municipio
        : "Sin zona especificada";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    });

    return Array.from(map.entries())
      .map(([territory, items]) => ({
        territory,
        municipio: items[0]?.municipio || "",
        estado: items[0]?.estado || "",
        items,
        advisorsCount: new Set(items.map((i) => i.asesor)).size,
      }))
      .sort((a, b) => b.items.length - a.items.length);
  }, [records]);

  if (records.length === 0) {
    return (
      <div className="py-20 text-center space-y-2">
        <p className="text-xs text-neutral-400 font-mono">
          No hay rutas ni asesores planificados para el {dateLabel.toLowerCase()}.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-2">
      {/* Sub-selector de agrupación tipográfico (Sin marcos ni cajas) */}
      <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
        <div className="flex items-center gap-3 text-xs">
          <span className="text-[11px] text-neutral-400 font-mono mr-1">Agrupar por:</span>
          <button
            type="button"
            onClick={() => setGroupBy("asesor")}
            className={cn(
              "transition-colors text-xs cursor-pointer py-0.5",
              groupBy === "asesor"
                ? "text-neutral-950 font-semibold border-b-2 border-neutral-900"
                : "text-neutral-400 hover:text-neutral-700"
            )}
          >
            Asesor ({records.length})
          </button>
          <span className="text-neutral-300">·</span>
          <button
            type="button"
            onClick={() => setGroupBy("territorio")}
            className={cn(
              "transition-colors text-xs cursor-pointer py-0.5",
              groupBy === "territorio"
                ? "text-neutral-950 font-semibold border-b-2 border-neutral-900"
                : "text-neutral-400 hover:text-neutral-700"
            )}
          >
            Territorio ({territoryGroups.length})
          </button>
        </div>

        <span className="text-[11px] text-neutral-400 font-mono">
          {records.length} {records.length === 1 ? "jornada en campo" : "jornadas en campo"}
        </span>
      </div>

      {/* Vista 1: Por Asesor */}
      {groupBy === "asesor" && (
        <div className="divide-y divide-neutral-100/70">
          {records.map((rec, idx) => {
            const isSelected = selectedAdvisor && selectedAdvisor.toLowerCase() === rec.asesor.toLowerCase();
            const sector = rec.sector || "Ruta no asignada";
            const actividad = rec.tipo_actividad || rec.plan || "Recorrido";
            const ubicacion = [rec.parroquia, rec.municipio, rec.estado]
              .filter((x) => x && x !== "N/A" && x !== "Otros")
              .join(" · ");

            return (
              <div
                key={rec.id || idx}
                onClick={() => onSelectAdvisor?.(rec.asesor)}
                className={cn(
                  "group flex flex-col sm:flex-row sm:items-center justify-between py-2.5 px-1 transition-colors cursor-pointer gap-2",
                  isSelected ? "bg-neutral-100/60 font-medium" : "hover:bg-neutral-50/60"
                )}
              >
                {/* Columna izquierda: Asesor e índice */}
                <div className="flex items-center gap-3 min-w-0 sm:w-1/3">
                  <span className="text-[10px] font-mono text-neutral-400 w-5 shrink-0">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <div className="flex flex-col min-w-0">
                    <span className={cn("text-xs truncate", isSelected ? "font-bold text-neutral-950" : "text-neutral-900")}>
                      {rec.asesor}
                    </span>
                    <span className="text-[10px] text-neutral-400 font-mono truncate">
                      {rec.estatus || "Planificado"}
                    </span>
                  </div>
                </div>

                {/* Columna central: Ruta y Territorio */}
                <div className="flex flex-col min-w-0 sm:w-5/12 pl-8 sm:pl-0">
                  <span className="text-xs font-medium text-neutral-900 truncate">
                    {sector}
                  </span>
                  {ubicacion && (
                    <span className="text-[10px] text-neutral-400 font-mono truncate">
                      {ubicacion}
                    </span>
                  )}
                </div>

                {/* Columna derecha: Modalidad de actividad */}
                <div className="text-left sm:text-right sm:w-1/4 pl-8 sm:pl-0 shrink-0">
                  <span className="text-xs text-neutral-600 font-sans block">
                    {actividad}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Vista 2: Por Territorio / Parroquia */}
      {groupBy === "territorio" && (
        <div className="space-y-6 pt-2">
          {territoryGroups.map((group) => (
            <div key={group.territory} className="space-y-2">
              {/* Encabezado del territorio */}
              <div className="flex items-baseline justify-between border-b border-neutral-100 pb-1.5">
                <div className="flex items-baseline gap-2">
                  <h3 className="text-xs font-semibold text-neutral-900">
                    {group.territory}
                  </h3>
                  {group.municipio && group.municipio !== group.territory && (
                    <span className="text-[10px] text-neutral-400 font-mono">
                      ({group.municipio})
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-neutral-400 font-mono">
                  {group.advisorsCount} {group.advisorsCount === 1 ? "asesor desplegado" : "asesores desplegados"}
                </span>
              </div>

              {/* Lista de asesores en esta zona */}
              <div className="divide-y divide-neutral-100/50 pl-2">
                {group.items.map((item, iIdx) => {
                  const actividad = item.tipo_actividad || item.plan || "Recorrido";
                  const sector = item.sector || "Sector general";

                  return (
                    <div
                      key={item.id || iIdx}
                      onClick={() => onSelectAdvisor?.(item.asesor)}
                      className="group flex items-center justify-between py-2 text-xs hover:bg-neutral-50/50 transition-colors px-1 cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs font-medium text-neutral-900 truncate">
                          {item.asesor}
                        </span>
                        <span className="text-neutral-300">·</span>
                        <span className="text-xs text-neutral-600 truncate">
                          {sector}
                        </span>
                      </div>

                      <span className="text-[11px] text-neutral-400 font-mono shrink-0 ml-4">
                        {actividad}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

