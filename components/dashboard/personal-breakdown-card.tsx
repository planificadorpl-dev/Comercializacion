"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Search, X } from "lucide-react";
import { cn, formatNumber, formatProperCase } from "@/lib/utils";
import { Installation, Solicitud, PlanificacionRecord, fetchPlanificacionData, MONTH_ORDER } from "@/lib/dashboard-data";
import { AdvisorType } from "@/lib/normalization";

export type MetricType = "instalaciones" | "solicitudes";
export type CategoryFilter = "all" | AdvisorType | "excolaborador";

const CATEGORY_TABS: { id: CategoryFilter; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "comercial", label: "Asesor comercial" },
  { id: "taquilla", label: "Taquilla" },
  { id: "externo", label: "Externo" },
  { id: "planificacion", label: "Planificación" },
  { id: "excolaborador", label: "Excolaboradores" },
  { id: "otro", label: "Otros" },
];

const normKey = (str: string | null | undefined): string =>
  (str || "").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

interface PersonalBreakdownCardProps {
  installations: Installation[];
  solicitudes: Solicitud[];
  selectedAdvisor?: string;
  onSelectAdvisor?: (advisor: string) => void;
  selectedMonth?: string;
  className?: string;
}

export function PersonalBreakdownCard({
  installations,
  solicitudes,
  selectedAdvisor,
  onSelectAdvisor,
  selectedMonth,
  className,
}: PersonalBreakdownCardProps) {
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");
  const [activeMetric, setActiveMetric] = useState<MetricType>("instalaciones");
  const [searchTerm, setSearchTerm] = useState("");
  const [planRecords, setPlanRecords] = useState<PlanificacionRecord[]>([]);

  // Carga ligera de registros de planificación para identificar comerciales activos
  useEffect(() => {
    let isMounted = true;
    fetchPlanificacionData().then((data) => {
      if (isMounted && Array.isArray(data)) {
        setPlanRecords(data);
      }
    }).catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  // Determinar asesores comerciales activos según la fecha más reciente de planificación
  const { activeCommercialAdvisors, activeCommercialCount, activeCommercialList } = useMemo(() => {
    const set = new Set<string>();
    const uniqueMap = new Map<string, string>();

    const allDates = Array.from(new Set(planRecords.map((d) => d.fecha).filter(Boolean))).sort();
    const globalMaxDate = allDates[allDates.length - 1];

    const isAll = !selectedMonth || selectedMonth === "all";
    const currentSpanishMonth = MONTH_ORDER[new Date().getMonth()] || "Noviembre";
    const isCurrentMonth = selectedMonth && (normKey(selectedMonth) === normKey(currentSpanishMonth) || normKey(selectedMonth) === "OCTUBRE");

    if (isAll || isCurrentMonth) {
      planRecords.forEach((d) => {
        if (d.fecha === globalMaxDate) {
          const candidates = [d.asesor, d.raw_asesor].filter(Boolean) as string[];
          candidates.forEach((nameToUse) => {
            if (nameToUse && nameToUse.trim()) {
              const raw = nameToUse.trim().toUpperCase();
              const nk = normKey(nameToUse);
              if (nk && nk !== "SIN ASESOR" && nk !== "N/A" && nk !== "DESCONOCIDO" && !nk.includes("PLANIFICAC")) {
                set.add(raw);
                set.add(nk);
              }
            }
          });

          const primaryName = d.asesor || d.raw_asesor;
          if (primaryName && primaryName.trim()) {
            const nk = normKey(primaryName);
            if (nk && nk !== "SIN ASESOR" && nk !== "N/A" && nk !== "DESCONOCIDO" && !nk.includes("PLANIFICAC")) {
              if (!uniqueMap.has(nk)) {
                uniqueMap.set(nk, formatProperCase(primaryName.trim()));
              }
            }
          }
        }
      });
    } else {
      const inMonthPlan = planRecords.filter((d) => normKey(d.mes) === normKey(selectedMonth));
      if (inMonthPlan.length > 0) {
        inMonthPlan.forEach((d) => {
          const candidates = [d.asesor, d.raw_asesor].filter(Boolean) as string[];
          candidates.forEach((nameToUse) => {
            if (nameToUse && nameToUse.trim()) {
              const raw = nameToUse.trim().toUpperCase();
              const nk = normKey(nameToUse);
              if (nk && nk !== "SIN ASESOR" && nk !== "N/A" && nk !== "DESCONOCIDO" && !nk.includes("PLANIFICAC")) {
                set.add(raw);
                set.add(nk);
              }
            }
          });

          const primaryName = d.asesor || d.raw_asesor;
          if (primaryName && primaryName.trim()) {
            const nk = normKey(primaryName);
            if (nk && nk !== "SIN ASESOR" && nk !== "N/A" && nk !== "DESCONOCIDO" && !nk.includes("PLANIFICAC")) {
              if (!uniqueMap.has(nk)) {
                uniqueMap.set(nk, formatProperCase(primaryName.trim()));
              }
            }
          }
        });
      } else {
        const inMonthInst = installations.filter((d) => normKey(d.mes) === normKey(selectedMonth));
        const inMonthSol = solicitudes.filter((d) => normKey(d.mes) === normKey(selectedMonth));
        [...inMonthInst, ...inMonthSol].forEach((item) => {
          if (!item.asesor) return;
          const nk = normKey(item.asesor);
          const normCanal = normKey((item as any).canal);
          if (
            !nk ||
            nk === "SIN ASESOR" ||
            nk === "N/A" ||
            nk === "DESCONOCIDO" ||
            normCanal.includes("TAQUILL") ||
            nk.includes("TAQUILL") ||
            item.tipo_asesor === "taquilla" ||
            normCanal.includes("EXTERNO") ||
            nk.includes("EXTERNO") ||
            item.tipo_asesor === "externo" ||
            normCanal.includes("PLANIFICAC") ||
            nk.includes("PLANIFICAC") ||
            item.tipo_asesor === "planificacion"
          ) {
            return;
          }
          set.add(item.asesor.trim().toUpperCase());
          set.add(nk);
          if (!uniqueMap.has(nk)) {
            uniqueMap.set(nk, formatProperCase(item.asesor.trim()));
          }
        });
      }
    }

    return {
      activeCommercialAdvisors: set,
      activeCommercialCount: uniqueMap.size,
      activeCommercialList: Array.from(uniqueMap.values()),
    };
  }, [planRecords, installations, solicitudes, selectedMonth]);

  // Regla para clasificar excolaboradores
  const isAdvisorExColaborador = useCallback(
    (advisorName: string | null | undefined, canal?: string, tipo_asesor?: AdvisorType): boolean => {
      if (!advisorName) return false;
      const clean = advisorName.trim();
      const raw = clean.toUpperCase();
      const nk = normKey(clean);
      if (
        !nk ||
        nk === "SIN ASESOR" ||
        nk === "N/A" ||
        nk === "DESCONOCIDO" ||
        nk === "NO IDENTIFICADO" ||
        nk === "ASESOR COMERCIAL"
      ) {
        return false;
      }

      if (activeCommercialAdvisors.has(raw) || activeCommercialAdvisors.has(nk)) {
        return false;
      }

      if (tipo_asesor === "taquilla" || tipo_asesor === "externo" || tipo_asesor === "planificacion") {
        return false;
      }

      const normCanal = normKey(canal);
      if (normCanal.includes("TAQUILL") || nk.includes("TAQUILL")) return false;
      if (normCanal.includes("EXTERNO") || nk.includes("EXTERNO")) return false;
      if (normCanal.includes("PLANIFICAC") || nk.includes("PLANIFICAC")) return false;

      return true;
    },
    [activeCommercialAdvisors]
  );

  // Contador de personal único por categoría
  const personnelCounts = useMemo(() => {
    const counts: Record<CategoryFilter, number> = {
      all: 0,
      comercial: activeCommercialCount,
      taquilla: 0,
      externo: 0,
      planificacion: 0,
      excolaborador: 0,
      otro: 0,
    };

    const taquillaSet = new Set<string>();
    const externoSet = new Set<string>();
    const planificacionSet = new Set<string>();
    const excolaboradorSet = new Set<string>();
    const otroSet = new Set<string>();
    const allSet = new Set<string>();

    activeCommercialList.forEach((adv) => {
      const nk = normKey(adv);
      allSet.add(nk);
    });

    const processItem = (item: { asesor?: string; canal?: string; tipo_asesor?: AdvisorType }) => {
      if (!item.asesor) return;
      const cleanName = item.asesor.trim();
      const raw = cleanName.toUpperCase();
      const nk = normKey(cleanName);
      if (
        !nk ||
        nk === "SIN ASESOR" ||
        nk === "N/A" ||
        nk === "DESCONOCIDO" ||
        nk === "NO IDENTIFICADO" ||
        nk === "ASESOR COMERCIAL"
      ) {
        return;
      }

      allSet.add(nk);

      const isActiveComm = activeCommercialAdvisors.has(raw) || activeCommercialAdvisors.has(nk);
      if (isActiveComm) return;

      if (isAdvisorExColaborador(cleanName, item.canal, item.tipo_asesor)) {
        excolaboradorSet.add(nk);
        return;
      }

      const normCanal = normKey(item.canal);
      if (normCanal.includes("TAQUILL") || nk.includes("TAQUILL") || item.tipo_asesor === "taquilla") {
        taquillaSet.add(nk);
      } else if (normCanal.includes("EXTERNO") || nk.includes("EXTERNO") || item.tipo_asesor === "externo") {
        externoSet.add(nk);
      } else if (normCanal.includes("PLANIFICAC") || nk.includes("PLANIFICAC") || item.tipo_asesor === "planificacion") {
        planificacionSet.add(nk);
      } else if (item.tipo_asesor === "otro") {
        otroSet.add(nk);
      }
    };

    installations.forEach(processItem);
    solicitudes.forEach(processItem);

    counts.taquilla = taquillaSet.size;
    counts.externo = externoSet.size;
    counts.planificacion = planificacionSet.size;
    counts.excolaborador = excolaboradorSet.size;
    counts.otro = otroSet.size;
    counts.all = allSet.size;

    return counts;
  }, [installations, solicitudes, activeCommercialAdvisors, activeCommercialCount, activeCommercialList, isAdvisorExColaborador]);

  // Lista detallada de personal para el desglose
  const advisorBreakdown = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        normName: string;
        tipoLabel: string;
        isEx: boolean;
        isActiveCommercial: boolean;
        sede?: string;
        instalaciones: number;
        solicitudes: number;
      }
    >();

    if (activeCategory === "comercial" || activeCategory === "all") {
      activeCommercialList.forEach((advName) => {
        const nk = normKey(advName);
        if (!map.has(nk)) {
          map.set(nk, {
            name: advName,
            normName: nk,
            tipoLabel: "Asesor comercial",
            isEx: false,
            isActiveCommercial: true,
            instalaciones: 0,
            solicitudes: 0,
          });
        }
      });
    }

    installations.forEach((i) => {
      if (!i.asesor) return;
      const adv = formatProperCase(i.asesor);
      const cleanName = i.asesor.trim();
      const raw = cleanName.toUpperCase();
      const nk = normKey(cleanName);
      if (
        !nk ||
        nk === "SIN ASESOR" ||
        nk === "N/A" ||
        nk === "DESCONOCIDO" ||
        nk === "NO IDENTIFICADO" ||
        nk === "ASESOR COMERCIAL"
      ) {
        return;
      }

      const isActive = activeCommercialAdvisors.has(raw) || activeCommercialAdvisors.has(nk);
      const isEx = !isActive && isAdvisorExColaborador(cleanName, (i as any).canal, i.tipo_asesor);

      let tipoLabel = "Asesor comercial";
      if (isActive) {
        tipoLabel = "Asesor comercial";
      } else if (isEx) {
        tipoLabel = "Excolaborador";
      } else {
        const normCanal = normKey((i as any).canal);
        if (normCanal.includes("TAQUILL") || nk.includes("TAQUILL") || i.tipo_asesor === "taquilla") {
          tipoLabel = "Taquilla";
        } else if (normCanal.includes("EXTERNO") || nk.includes("EXTERNO") || i.tipo_asesor === "externo") {
          tipoLabel = "Externo";
        } else if (normCanal.includes("PLANIFICAC") || nk.includes("PLANIFICAC") || i.tipo_asesor === "planificacion") {
          tipoLabel = "Planificación";
        } else {
          tipoLabel = "Excolaborador";
        }
      }

      if (!map.has(nk)) {
        map.set(nk, {
          name: adv,
          normName: nk,
          tipoLabel,
          isEx: tipoLabel === "Excolaborador",
          isActiveCommercial: isActive,
          sede: i.sede_taquilla,
          instalaciones: 0,
          solicitudes: 0,
        });
      } else {
        const entry = map.get(nk)!;
        if (!entry.sede && i.sede_taquilla) entry.sede = i.sede_taquilla;
      }
      map.get(nk)!.instalaciones += 1;
    });

    solicitudes.forEach((s) => {
      if (!s.asesor) return;
      const adv = formatProperCase(s.asesor);
      const cleanName = s.asesor.trim();
      const raw = cleanName.toUpperCase();
      const nk = normKey(cleanName);
      if (
        !nk ||
        nk === "SIN ASESOR" ||
        nk === "N/A" ||
        nk === "DESCONOCIDO" ||
        nk === "NO IDENTIFICADO" ||
        nk === "ASESOR COMERCIAL"
      ) {
        return;
      }

      const isActive = activeCommercialAdvisors.has(raw) || activeCommercialAdvisors.has(nk);
      const isEx = !isActive && isAdvisorExColaborador(cleanName, s.canal, s.tipo_asesor);

      let tipoLabel = "Asesor comercial";
      if (isActive) {
        tipoLabel = "Asesor comercial";
      } else if (isEx) {
        tipoLabel = "Excolaborador";
      } else {
        const normCanal = normKey(s.canal);
        if (normCanal.includes("TAQUILL") || nk.includes("TAQUILL") || s.tipo_asesor === "taquilla") {
          tipoLabel = "Taquilla";
        } else if (normCanal.includes("EXTERNO") || nk.includes("EXTERNO") || s.tipo_asesor === "externo") {
          tipoLabel = "Externo";
        } else if (normCanal.includes("PLANIFICAC") || nk.includes("PLANIFICAC") || s.tipo_asesor === "planificacion") {
          tipoLabel = "Planificación";
        } else {
          tipoLabel = "Excolaborador";
        }
      }

      if (!map.has(nk)) {
        map.set(nk, {
          name: adv,
          normName: nk,
          tipoLabel,
          isEx: tipoLabel === "Excolaborador",
          isActiveCommercial: isActive,
          sede: s.sede_taquilla,
          instalaciones: 0,
          solicitudes: 0,
        });
      } else {
        const entry = map.get(nk)!;
        if (!entry.sede && s.sede_taquilla) entry.sede = s.sede_taquilla;
      }
      map.get(nk)!.solicitudes += 1;
    });

    let list = Array.from(map.values());

    // Filtrar por categoría activa
    if (activeCategory === "comercial") {
      list = list.filter((a) => a.isActiveCommercial);
    } else if (activeCategory === "excolaborador") {
      list = list.filter((a) => a.isEx);
    } else if (activeCategory === "taquilla") {
      list = list.filter((a) => a.tipoLabel === "Taquilla");
    } else if (activeCategory === "externo") {
      list = list.filter((a) => a.tipoLabel === "Externo");
    } else if (activeCategory === "planificacion") {
      list = list.filter((a) => a.tipoLabel === "Planificación");
    }

    // Filtrar por término de búsqueda si existe
    if (searchTerm.trim()) {
      const term = normKey(searchTerm);
      list = list.filter((a) => a.normName.includes(term) || normKey(a.name).includes(term));
    }

    // Ordenar según métrica activa
    return list.sort((a, b) => {
      if (activeMetric === "instalaciones") {
        if (b.instalaciones !== a.instalaciones) return b.instalaciones - a.instalaciones;
        return b.solicitudes - a.solicitudes;
      }
      if (b.solicitudes !== a.solicitudes) return b.solicitudes - a.solicitudes;
      return b.instalaciones - a.instalaciones;
    });
  }, [
    installations,
    solicitudes,
    activeMetric,
    activeCategory,
    activeCommercialList,
    activeCommercialAdvisors,
    isAdvisorExColaborador,
    searchTerm,
  ]);

  return (
    <div className={cn("space-y-4 pt-4", className)}>
      {/* Encabezado y controles de visualización tipográficos (Sin marcos ni cajas) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900 tracking-tight">
            Desglose de personal ({advisorBreakdown.length})
          </h2>
          <p className="text-[11px] text-neutral-400 font-mono">
            {selectedAdvisor
              ? `Filtro activo: ${selectedAdvisor} • Haz clic nuevamente para limpiar`
              : "Selecciona un asesor para filtrar las métricas del panel principal"}
          </p>
        </div>

        {/* Alternador de Métrica: puramente tipográfico */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[11px] text-neutral-400 font-mono mr-1">Ordenar por:</span>
          <button
            type="button"
            onClick={() => setActiveMetric("instalaciones")}
            className={cn(
              "transition-colors text-xs cursor-pointer",
              activeMetric === "instalaciones"
                ? "text-emerald-700 font-semibold"
                : "text-neutral-400 hover:text-neutral-900"
            )}
          >
            Instalaciones
          </button>
          <span className="text-neutral-300">·</span>
          <button
            type="button"
            onClick={() => setActiveMetric("solicitudes")}
            className={cn(
              "transition-colors text-xs cursor-pointer",
              activeMetric === "solicitudes"
                ? "text-sky-700 font-semibold"
                : "text-neutral-400 hover:text-neutral-900"
            )}
          >
            Solicitudes
          </button>
        </div>
      </div>

      {/* Fila de Categorías y Buscador sutil (Línea base sin recuadros) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-2">
        {/* Selector de Categorías */}
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar text-xs">
          {CATEGORY_TABS.filter((tab) => tab.id !== "otro" || (personnelCounts[tab.id] || 0) > 0).map((tab) => {
            const count = personnelCounts[tab.id] || 0;
            const isActive = activeCategory === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveCategory(tab.id)}
                className={cn(
                  "whitespace-nowrap transition-colors cursor-pointer py-1 text-xs",
                  isActive
                    ? "text-neutral-950 font-semibold border-b-2 border-neutral-900"
                    : "text-neutral-400 hover:text-neutral-700"
                )}
              >
                {tab.label}{" "}
                <span className="font-mono text-[10px] text-neutral-400 ml-0.5">
                  ({count})
                </span>
              </button>
            );
          })}
        </div>

        {/* Buscador minimalista con línea base */}
        <div className="flex items-center gap-1.5 w-full sm:w-56 border-b border-neutral-200 focus-within:border-neutral-900 transition-colors py-0.5">
          <Search className="w-3.5 h-3.5 text-neutral-400 shrink-0 stroke-[1.25]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre..."
            className="w-full bg-transparent text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="text-neutral-400 hover:text-neutral-900 transition-colors p-0.5 cursor-pointer"
            >
              <X className="w-3 h-3 stroke-[1.5]" />
            </button>
          )}
        </div>
      </div>

      {/* Lista / Desglose de Personal (Abierto, con separadores sutiles y scroll fluido) */}
      <div className="divide-y divide-neutral-100/70 max-h-96 overflow-y-auto pr-1">
        {advisorBreakdown.length === 0 ? (
          <div className="py-8 text-center text-xs text-neutral-400 font-mono">
            No se encontró personal en esta categoría o filtro
          </div>
        ) : (
          advisorBreakdown.map((adv, idx) => {
            const isSelected = selectedAdvisor && normKey(selectedAdvisor) === adv.normName;

            return (
              <div
                key={adv.normName}
                onClick={() => {
                  if (onSelectAdvisor) {
                    onSelectAdvisor(adv.name);
                  }
                }}
                className={cn(
                  "group flex items-center justify-between py-2 text-xs transition-colors px-1 cursor-pointer",
                  isSelected ? "bg-neutral-100/70 font-medium" : "hover:bg-neutral-50/60"
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[10px] font-mono text-neutral-400 w-5 shrink-0">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "truncate",
                          isSelected ? "font-bold text-neutral-950" : "text-neutral-900"
                        )}
                      >
                        {adv.name}
                      </span>
                      {adv.isEx && (
                        <span className="text-[10px] font-mono text-neutral-400 shrink-0">
                          · Excolaborador
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-neutral-400 font-mono">
                      {adv.isActiveCommercial
                        ? "Asesor comercial activo"
                        : adv.sede && adv.sede !== "N/A" && adv.sede !== "OTROS"
                        ? `Sede: ${adv.sede}`
                        : adv.tipoLabel}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-6 shrink-0 font-mono text-right">
                  <div>
                    <span className="text-[10px] text-neutral-400 block font-sans">
                      Instalaciones
                    </span>
                    <span
                      className={cn(
                        "text-xs font-semibold",
                        activeMetric === "instalaciones" ? "text-emerald-700" : "text-neutral-600"
                      )}
                    >
                      {formatNumber(adv.instalaciones)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-neutral-400 block font-sans">
                      Solicitudes
                    </span>
                    <span
                      className={cn(
                        "text-xs font-semibold",
                        activeMetric === "solicitudes" ? "text-sky-700" : "text-neutral-600"
                      )}
                    >
                      {formatNumber(adv.solicitudes)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

