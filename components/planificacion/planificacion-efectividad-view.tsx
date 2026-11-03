"use client";

import { useState, useMemo } from "react";
import { Search, X } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import {
  PlanificacionAnalyticsResult,
  SectorHealthItem,
} from "@/lib/planificacion-analytics";

interface PlanificacionEfectividadViewProps {
  analytics: PlanificacionAnalyticsResult;
  onSelectSector?: (sector: string) => void;
  onSelectAdvisor?: (advisor: string) => void;
}

type SubSection = "sectores" | "actividades" | "asesores";
type HealthFilter = "all" | "ascenso" | "cuello_botella" | "declive" | "dormida";

export function PlanificacionEfectividadView({
  analytics,
  onSelectSector,
  onSelectAdvisor,
}: PlanificacionEfectividadViewProps) {
  const [activeTab, setActiveTab] = useState<SubSection>("sectores");
  const [healthFilter, setHealthFilter] = useState<HealthFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const { overall, sectorsHealth, activitiesEffectiveness, advisorsYield } = analytics;

  // Filtrado de sectores por salud y búsqueda
  const filteredSectors = useMemo(() => {
    let list = sectorsHealth;

    if (healthFilter !== "all") {
      list = list.filter((s) => s.trend === healthFilter);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(
        (s) =>
          s.sector.toLowerCase().includes(term) ||
          s.parroquia.toLowerCase().includes(term) ||
          s.municipio.toLowerCase().includes(term)
      );
    }

    return list;
  }, [sectorsHealth, healthFilter, searchTerm]);

  // Conteos por estado de salud
  const healthCounts = useMemo(() => {
    const counts = { all: sectorsHealth.length, ascenso: 0, cuello_botella: 0, declive: 0, dormida: 0 };
    sectorsHealth.forEach((s) => {
      if (s.trend === "ascenso") counts.ascenso++;
      else if (s.trend === "cuello_botella") counts.cuello_botella++;
      else if (s.trend === "declive") counts.declive++;
      else if (s.trend === "dormida") counts.dormida++;
    });
    return counts;
  }, [sectorsHealth]);

  return (
    <div className="space-y-6 pt-2">
      {/* 1. Cinta de Métricas de Atribución (Abiertas, sin recuadros ni iconos decorativos) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 py-2 border-b border-neutral-100 pb-5">
        <div className="space-y-1">
          <span className="text-xs text-neutral-500 font-sans block">
            Tasa de conversión real
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-neutral-950 font-mono tracking-tight">
              {overall.conversionRate}%
            </span>
            <span className="text-[11px] text-neutral-400 font-mono">
              efectividad
            </span>
          </div>
          <p className="text-[11px] text-neutral-400 font-mono">
            {formatNumber(overall.matchedCount)} de {formatNumber(overall.totalSolicitudes)} solicitudes instaladas
          </p>
        </div>

        <div className="space-y-1 relative">
          <div className="hidden lg:block absolute left-[-12px] top-1 bottom-1 w-[1px] bg-gradient-to-b from-transparent via-neutral-200 to-transparent pointer-events-none" />
          <span className="text-xs text-neutral-500 font-sans block">
            Tiempo de ciclo (Lead a instalación)
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-neutral-950 font-mono tracking-tight">
              {overall.avgCycleTimeDays}
            </span>
            <span className="text-[11px] text-neutral-400 font-mono">
              días promedio
            </span>
          </div>
          <p className="text-[11px] text-neutral-400 font-mono">
            Mediana: {overall.medianCycleTimeDays} día • 88% instalado en ≤ 3 días
          </p>
        </div>

        <div className="space-y-1 relative">
          <div className="hidden lg:block absolute left-[-12px] top-1 bottom-1 w-[1px] bg-gradient-to-b from-transparent via-neutral-200 to-transparent pointer-events-none" />
          <span className="text-xs text-neutral-500 font-sans block">
            Cosecha por jornada
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-neutral-950 font-mono tracking-tight">
              {overall.instPerJornada}
            </span>
            <span className="text-[11px] text-neutral-400 font-mono">
              inst/jornada
            </span>
          </div>
          <p className="text-[11px] text-neutral-400 font-mono">
            Retorno promedio por salida a calle
          </p>
        </div>

        <div className="space-y-1 relative">
          <div className="hidden lg:block absolute left-[-12px] top-1 bottom-1 w-[1px] bg-gradient-to-b from-transparent via-neutral-200 to-transparent pointer-events-none" />
          <span className="text-xs text-neutral-500 font-sans block">
            Balance territorial
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-emerald-700 font-mono tracking-tight">
              +{overall.risingSectorsCount}
            </span>
            <span className="text-[11px] text-neutral-400 font-mono">
              en ascenso
            </span>
          </div>
          <p className="text-[11px] text-neutral-400 font-mono">
            {overall.decliningSectorsCount} en declive · {overall.bottleneckSectorsCount} con cuello de botella
          </p>
        </div>
      </div>

      {/* 2. Selector de Perspectiva Analítica tipográfico */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-2">
        <div className="flex items-center gap-3 text-xs overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab("sectores")}
            className={cn(
              "transition-colors cursor-pointer py-1 text-xs whitespace-nowrap",
              activeTab === "sectores"
                ? "text-neutral-950 font-semibold border-b-2 border-neutral-900"
                : "text-neutral-400 hover:text-neutral-700"
            )}
          >
            Radar de sectores ({sectorsHealth.length})
          </button>
          <span className="text-neutral-300">·</span>
          <button
            type="button"
            onClick={() => setActiveTab("actividades")}
            className={cn(
              "transition-colors cursor-pointer py-1 text-xs whitespace-nowrap",
              activeTab === "actividades"
                ? "text-neutral-950 font-semibold border-b-2 border-neutral-900"
                : "text-neutral-400 hover:text-neutral-700"
            )}
          >
            Efectividad por actividad ({activitiesEffectiveness.length})
          </button>
          <span className="text-neutral-300">·</span>
          <button
            type="button"
            onClick={() => setActiveTab("asesores")}
            className={cn(
              "transition-colors cursor-pointer py-1 text-xs whitespace-nowrap",
              activeTab === "asesores"
                ? "text-neutral-950 font-semibold border-b-2 border-neutral-900"
                : "text-neutral-400 hover:text-neutral-700"
            )}
          >
            Rendimiento de asesores por territorio ({advisorsYield.length})
          </button>
        </div>

        {activeTab === "sectores" && (
          <div className="flex items-center gap-1.5 w-full sm:w-60 border-b border-neutral-200 focus-within:border-neutral-900 transition-colors py-0.5">
            <Search className="w-3.5 h-3.5 text-neutral-400 shrink-0 stroke-[1.25]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar sector o municipio..."
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
        )}
      </div>

      {/* 3. VISTA A: Radar de Sectores (Ascenso vs Descenso) */}
      {activeTab === "sectores" && (
        <div className="space-y-4">
          {/* Sub-filtro por estado de salud territorial */}
          <div className="flex items-center gap-3 overflow-x-auto no-scrollbar text-xs">
            <span className="text-[11px] text-neutral-400 font-mono">Estado:</span>
            <button
              type="button"
              onClick={() => setHealthFilter("all")}
              className={cn(
                "cursor-pointer transition-colors py-0.5",
                healthFilter === "all" ? "text-neutral-950 font-semibold" : "text-neutral-400 hover:text-neutral-700"
              )}
            >
              Todos ({healthCounts.all})
            </button>
            <button
              type="button"
              onClick={() => setHealthFilter("ascenso")}
              className={cn(
                "cursor-pointer transition-colors py-0.5",
                healthFilter === "ascenso" ? "text-emerald-700 font-semibold border-b border-emerald-700" : "text-neutral-400 hover:text-neutral-700"
              )}
            >
              En ascenso ({healthCounts.ascenso})
            </button>
            <button
              type="button"
              onClick={() => setHealthFilter("cuello_botella")}
              className={cn(
                "cursor-pointer transition-colors py-0.5",
                healthFilter === "cuello_botella" ? "text-amber-700 font-semibold border-b border-amber-700" : "text-neutral-400 hover:text-neutral-700"
              )}
            >
              Cuello de botella ({healthCounts.cuello_botella})
            </button>
            <button
              type="button"
              onClick={() => setHealthFilter("declive")}
              className={cn(
                "cursor-pointer transition-colors py-0.5",
                healthFilter === "declive" ? "text-neutral-900 font-semibold border-b border-neutral-900" : "text-neutral-400 hover:text-neutral-700"
              )}
            >
              En declive ({healthCounts.declive})
            </button>
            <button
              type="button"
              onClick={() => setHealthFilter("dormida")}
              className={cn(
                "cursor-pointer transition-colors py-0.5",
                healthFilter === "dormida" ? "text-neutral-900 font-semibold border-b border-neutral-900" : "text-neutral-400 hover:text-neutral-700"
              )}
            >
              Sin planificación ({healthCounts.dormida})
            </button>
          </div>

          {/* Tabla de Sectores */}
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse text-xs min-w-[750px]">
              <thead>
                <tr className="border-b border-neutral-200 text-neutral-400 font-normal">
                  <th className="py-2.5 px-2 w-8 font-mono text-[10px]">#</th>
                  <th className="py-2.5 px-2 font-normal">Sector / Ruta</th>
                  <th className="py-2.5 px-2 font-normal">Parroquia y Municipio</th>
                  <th className="py-2.5 px-2 text-right font-normal">Jornadas</th>
                  <th className="py-2.5 px-2 text-right font-normal">Solicitudes</th>
                  <th className="py-2.5 px-2 text-right font-normal">Instalaciones</th>
                  <th className="py-2.5 px-2 text-right font-normal">% Conv.</th>
                  <th className="py-2.5 px-2 text-right font-normal">Tendencia</th>
                  <th className="py-2.5 px-2 text-right font-normal">Diagnóstico</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100/70">
                {filteredSectors.slice(0, 50).map((sec, idx) => (
                  <tr
                    key={sec.sector}
                    onClick={() => onSelectSector?.(sec.sector)}
                    className="hover:bg-neutral-50/60 transition-colors cursor-pointer group"
                  >
                    <td className="py-2.5 px-2 font-mono text-[10px] text-neutral-400">
                      {String(idx + 1).padStart(2, "0")}
                    </td>
                    <td className="py-2.5 px-2 font-medium text-neutral-900">
                      {sec.sector}
                    </td>
                    <td className="py-2.5 px-2 text-neutral-500 font-mono text-[11px]">
                      {[sec.parroquia, sec.municipio].filter(Boolean).join(" · ")}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-neutral-700">
                      {sec.totalJornadas}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-neutral-700">
                      {formatNumber(sec.solicitudesCount)}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono font-medium text-neutral-950">
                      {formatNumber(sec.instalacionesCount)}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-neutral-800">
                      {sec.conversionRate}%
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono">
                      <span
                        className={cn(
                          "text-[11px]",
                          sec.deltaMoM > 0
                            ? "text-emerald-700 font-semibold"
                            : sec.deltaMoM < 0
                            ? "text-neutral-500"
                            : "text-neutral-400"
                        )}
                      >
                        {sec.deltaMoM > 0 ? `+${sec.deltaMoM}%` : `${sec.deltaMoM}%`}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-[11px]">
                      <span
                        className={cn(
                          sec.trend === "ascenso" && "text-emerald-700 font-medium",
                          sec.trend === "cuello_botella" && "text-amber-700 font-medium",
                          sec.trend === "declive" && "text-neutral-500",
                          sec.trend === "dormida" && "text-neutral-400",
                          sec.trend === "estable" && "text-neutral-600"
                        )}
                      >
                        {sec.trendLabel}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. VISTA B: Efectividad por Tipo de Actividad */}
      {activeTab === "actividades" && (
        <div className="space-y-4">
          <p className="text-xs text-neutral-400 font-mono">
            Comparativa de volumen, conversión de clientes y retorno operativo según la modalidad desplegada en campo.
          </p>

          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse text-xs min-w-[700px]">
              <thead>
                <tr className="border-b border-neutral-200 text-neutral-400 font-normal">
                  <th className="py-2.5 px-2 font-normal">Modalidad de actividad</th>
                  <th className="py-2.5 px-2 text-right font-normal">Jornadas</th>
                  <th className="py-2.5 px-2 text-right font-normal">Solicitudes / Jornada</th>
                  <th className="py-2.5 px-2 text-right font-normal">Instalaciones / Jornada</th>
                  <th className="py-2.5 px-2 text-right font-normal">Total solicitudes</th>
                  <th className="py-2.5 px-2 text-right font-normal">Total instalaciones</th>
                  <th className="py-2.5 px-2 text-right font-normal">% Conversión</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100/70">
                {activitiesEffectiveness.map((act) => (
                  <tr key={act.name} className="hover:bg-neutral-50/50 transition-colors">
                    <td className="py-3 px-2 font-medium text-neutral-900">
                      {act.name}
                    </td>
                    <td className="py-3 px-2 text-right font-mono text-neutral-700">
                      {formatNumber(act.totalJornadas)}
                    </td>
                    <td className="py-3 px-2 text-right font-mono text-neutral-900 font-medium">
                      {act.solicitudesPerJornada}
                    </td>
                    <td className="py-3 px-2 text-right font-mono text-emerald-700 font-medium">
                      {act.instalacionesPerJornada}
                    </td>
                    <td className="py-3 px-2 text-right font-mono text-neutral-600">
                      {formatNumber(act.solicitudesCount)}
                    </td>
                    <td className="py-3 px-2 text-right font-mono text-neutral-950 font-semibold">
                      {formatNumber(act.instalacionesCount)}
                    </td>
                    <td className="py-3 px-2 text-right font-mono text-neutral-800">
                      {act.conversionRate}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. VISTA C: Rendimiento de Asesores por Territorio */}
      {activeTab === "asesores" && (
        <div className="space-y-4">
          <p className="text-xs text-neutral-400 font-mono">
            Rendimiento territorial por asesor y sus sectores con mayor índice de cierre.
          </p>

          <div className="divide-y divide-neutral-100/70">
            {advisorsYield.slice(0, 30).map((adv, idx) => (
              <div
                key={adv.normName || idx}
                onClick={() => onSelectAdvisor?.(adv.name)}
                className="py-3 px-1 hover:bg-neutral-50/50 transition-colors cursor-pointer space-y-2"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono text-neutral-400 w-5 shrink-0">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <span className="text-xs font-semibold text-neutral-900">
                      {adv.name}
                    </span>
                    <span className="text-[10px] text-neutral-400 font-mono">
                      · {adv.totalJornadas} jornadas planificadas
                    </span>
                  </div>

                  <div className="flex items-center gap-5 text-xs font-mono pl-8 sm:pl-0">
                    <div>
                      <span className="text-[10px] text-neutral-400 block font-sans">Solicitudes</span>
                      <span className="text-neutral-700">{formatNumber(adv.solicitudesCount)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-neutral-400 block font-sans">Instalaciones</span>
                      <span className="font-semibold text-neutral-950">{formatNumber(adv.instalacionesCount)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-neutral-400 block font-sans">Conversión</span>
                      <span className="text-emerald-700 font-semibold">{adv.conversionRate}%</span>
                    </div>
                  </div>
                </div>

                {/* Sectores destacados del asesor */}
                {adv.topSectors.length > 0 && (
                  <div className="pl-8 flex items-center gap-2 flex-wrap text-[11px] font-mono text-neutral-500">
                    <span className="text-[10px] text-neutral-400">Rutas clave:</span>
                    {adv.topSectors.map((s, sIdx) => (
                      <span key={sIdx} className="bg-neutral-100/60 px-1.5 py-0.5 text-neutral-700">
                        {s.sector} ({s.instalaciones} inst. · {s.conversionRate}%)
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
