"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { PlanificacionRecord, Solicitud, Installation } from "@/lib/dashboard-data";
import { normGeoKey } from "@/lib/geo_normalization";

interface PlanificacionDailyViewProps {
  dateStr: string;
  dateLabel: string;
  records: PlanificacionRecord[];
  solicitudes?: Solicitud[];
  installations?: Installation[];
  onSelectAdvisor?: (advisor: string) => void;
  selectedAdvisor?: string | null;
}

const normAdvKey = (s: string | null | undefined): string =>
  (s || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");

function advisorKeysMatch(keyA: string, keyB: string): boolean {
  if (!keyA || !keyB) return false;
  if (keyA === keyB) return true;
  const wordsA = keyA.split(" ").filter(Boolean);
  const wordsB = keyB.split(" ").filter(Boolean);
  if (wordsA.length >= 2 && wordsB.length >= 2) {
    if (wordsA[0] === wordsB[0] && wordsA[wordsA.length - 1] === wordsB[wordsB.length - 1]) {
      return true;
    }
  }
  return false;
}

export function PlanificacionDailyView({
  dateStr,
  dateLabel,
  records,
  solicitudes = [],
  installations = [],
  onSelectAdvisor,
  selectedAdvisor,
}: PlanificacionDailyViewProps) {
  const [groupBy, setGroupBy] = useState<"asesor" | "territorio">("asesor");

  // Mapeo de solicitudes e instalaciones del día por asesor
  const { solByAdvisor, instByAdvisor, solByTerritory, instByTerritory } = useMemo(() => {
    const solAdv = new Map<string, number>();
    const instAdv = new Map<string, number>();
    const solTerr = new Map<string, number>();
    const instTerr = new Map<string, number>();

    const isMatchDate = (itemDate: string | undefined) => {
      if (!itemDate) return false;
      const clean = itemDate.includes("T") ? itemDate.split("T")[0] : itemDate.slice(0, 10);
      return clean === dateStr;
    };

    solicitudes.forEach((s) => {
      if (!isMatchDate(s.fecha)) return;
      if (s.asesor && s.asesor !== "Sin Asesor") {
        const k = normAdvKey(s.asesor);
        if (k) solAdv.set(k, (solAdv.get(k) || 0) + 1);
      }
      const tKey = normGeoKey(s.parroquia || s.municipio || s.sector);
      if (tKey) solTerr.set(tKey, (solTerr.get(tKey) || 0) + 1);
    });

    installations.forEach((i) => {
      if (!isMatchDate(i.fecha)) return;
      if (i.asesor && i.asesor !== "Sin Asesor") {
        const k = normAdvKey(i.asesor);
        if (k) instAdv.set(k, (instAdv.get(k) || 0) + 1);
      }
      const tKey = normGeoKey(i.parroquia || i.municipio || i.sector);
      if (tKey) instTerr.set(tKey, (instTerr.get(tKey) || 0) + 1);
    });

    return {
      solByAdvisor: solAdv,
      instByAdvisor: instAdv,
      solByTerritory: solTerr,
      instByTerritory: instTerr,
    };
  }, [solicitudes, installations, dateStr]);

  const getAdvSolInst = (advName: string) => {
    const targetKey = normAdvKey(advName);
    let sol = 0;
    let inst = 0;
    if (!targetKey) return { sol, inst };

    for (const [k, count] of solByAdvisor.entries()) {
      if (k === targetKey || advisorKeysMatch(targetKey, k)) {
        sol += count;
      }
    }
    for (const [k, count] of instByAdvisor.entries()) {
      if (k === targetKey || advisorKeysMatch(targetKey, k)) {
        inst += count;
      }
    }
    return { sol, inst };
  };

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
            const metrics = getAdvSolInst(rec.asesor);

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

                {/* Columna derecha: Modalidad de actividad y métricas de resultados */}
                <div className="text-left sm:text-right sm:w-1/4 pl-8 sm:pl-0 shrink-0 flex flex-col sm:items-end">
                  <span className="text-xs text-neutral-600 font-sans block">
                    {actividad}
                  </span>
                  <div className="flex items-center gap-1.5 text-[11px] font-mono pt-0.5">
                    <span
                      className={metrics.sol > 0 ? "text-neutral-950 font-semibold" : "text-neutral-400"}
                      title={`${metrics.sol} solicitudes enviadas`}
                    >
                      {metrics.sol} <span className="font-normal text-neutral-400">sol</span>
                    </span>
                    <span className="text-neutral-300">·</span>
                    <span
                      className={metrics.inst > 0 ? "text-neutral-950 font-semibold" : "text-neutral-400"}
                      title={`${metrics.inst} clientes instalados`}
                    >
                      {metrics.inst} <span className="font-normal text-neutral-400">inst</span>
                    </span>
                  </div>
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
                  const metrics = getAdvSolInst(item.asesor);

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

                      <div className="flex items-center gap-3 shrink-0 ml-4">
                        <span className="text-[11px] text-neutral-400 font-mono">
                          {actividad}
                        </span>
                        <div className="flex items-center gap-1.5 text-[11px] font-mono">
                          <span
                            className={metrics.sol > 0 ? "text-neutral-950 font-semibold" : "text-neutral-400"}
                            title={`${metrics.sol} solicitudes`}
                          >
                            {metrics.sol} <span className="font-normal text-neutral-400">sol</span>
                          </span>
                          <span className="text-neutral-300">·</span>
                          <span
                            className={metrics.inst > 0 ? "text-neutral-950 font-semibold" : "text-neutral-400"}
                            title={`${metrics.inst} instalaciones`}
                          >
                            {metrics.inst} <span className="font-normal text-neutral-400">inst</span>
                          </span>
                        </div>
                      </div>
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

