"use client";

import { useState, useMemo } from "react";
import { X } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import { PlanificacionRecord, Solicitud, Installation, MONTH_ORDER } from "@/lib/dashboard-data";
import { normGeoKey } from "@/lib/geo_normalization";

interface PlanificacionMonthlyViewProps {
  month: string;
  year?: number;
  records: PlanificacionRecord[];
  solicitudes?: Solicitud[];
  installations?: Installation[];
  selectedAdvisor?: string | null;
  onSelectDay?: (dateStr: string) => void;
  onSelectAdvisor?: (advisor: string) => void;
  selectedSector?: string | null;
  onSelectSector?: (sector: string | null) => void;
}

function toStandardIsoDate(val: any): string {
  if (!val) return "";
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);

  const parts = str.split(/[\/\-]/).map((p) => parseInt(p, 10));
  if (parts.length === 3) {
    let y = parts[2];
    let m = parts[1];
    let d = parts[0];
    if (parts[0] > 1000) {
      y = parts[0];
      m = parts[1];
      d = parts[2];
    }
    if (y && m && d && !isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }
  return "";
}

function getMonthDayKey(val: any): string {
  const iso = toStandardIsoDate(val);
  if (iso) {
    const parts = iso.split("-");
    if (parts.length === 3) {
      return `${parseInt(parts[1], 10)}-${parseInt(parts[2], 10)}`;
    }
  }
  return "";
}

export function PlanificacionMonthlyView({
  month,
  year = 2026,
  records,
  solicitudes = [],
  installations = [],
  selectedAdvisor,
  onSelectDay,
  onSelectAdvisor,
  selectedSector: propSelectedSector,
  onSelectSector,
}: PlanificacionMonthlyViewProps) {
  const [internalSector, setInternalSector] = useState<string | null>(null);
  const [showAllAdvisors, setShowAllAdvisors] = useState(false);
  const activeSector = propSelectedSector !== undefined ? propSelectedSector : internalSector;

  const handleToggleSector = (secName: string) => {
    const next = activeSector?.toLowerCase() === secName.toLowerCase() ? null : secName;
    if (onSelectSector) onSelectSector(next);
    setInternalSector(next);
  };

  const monthIdx = useMemo(() => {
    const idx = MONTH_ORDER.findIndex((m) => m.toLowerCase() === month.toLowerCase());
    return idx >= 0 ? idx : 10; // Default Noviembre (10)
  }, [month]);

  // Mapeo de solicitudes e instalaciones por fecha (YYYY-MM-DD), día del mes y por sector canónico
  const { solByDate, instByDate, solByMonthDay, instByMonthDay, solBySector, instBySector } = useMemo(() => {
    const sMap = new Map<string, number>();
    const sMdMap = new Map<string, number>();
    const sSecMap = new Map<string, number>();

    const targetSecKey = activeSector ? normGeoKey(activeSector) : null;

    solicitudes.forEach((s) => {
      const sKey = normGeoKey(s.sector);
      const subKey = normGeoKey(s.subsector);

      // Mapeo global por sector (para la lista de sectores con cobertura)
      if (sKey) {
        sSecMap.set(sKey, (sSecMap.get(sKey) || 0) + 1);
      }

      // Para el calendario: si hay un sector seleccionado, filtrar estrictamente por ese sector
      if (s.fecha) {
        if (targetSecKey) {
          const isMatch =
            sKey === targetSecKey ||
            subKey === targetSecKey ||
            (sKey && sKey.includes(targetSecKey)) ||
            (targetSecKey && targetSecKey.includes(sKey));
          if (!isMatch) return;
        }
        const iso = toStandardIsoDate(s.fecha);
        const md = getMonthDayKey(s.fecha);
        if (iso) sMap.set(iso, (sMap.get(iso) || 0) + 1);
        if (md) sMdMap.set(md, (sMdMap.get(md) || 0) + 1);
      }
    });

    const iMap = new Map<string, number>();
    const iMdMap = new Map<string, number>();
    const iSecMap = new Map<string, number>();
    installations.forEach((i) => {
      const iKey = normGeoKey(i.sector);
      const subKey = normGeoKey(i.subsector);

      // Mapeo global por sector (para la lista de sectores con cobertura)
      if (iKey) {
        iSecMap.set(iKey, (iSecMap.get(iKey) || 0) + 1);
      }

      // Para el calendario: si hay un sector seleccionado, filtrar estrictamente por ese sector
      if (i.fecha) {
        if (targetSecKey) {
          const isMatch =
            iKey === targetSecKey ||
            subKey === targetSecKey ||
            (iKey && iKey.includes(targetSecKey)) ||
            (targetSecKey && targetSecKey.includes(iKey));
          if (!isMatch) return;
        }
        const iso = toStandardIsoDate(i.fecha);
        const md = getMonthDayKey(i.fecha);
        if (iso) iMap.set(iso, (iMap.get(iso) || 0) + 1);
        if (md) iMdMap.set(md, (iMdMap.get(md) || 0) + 1);
      }
    });

    return {
      solByDate: sMap,
      instByDate: iMap,
      solByMonthDay: sMdMap,
      instByMonthDay: iMdMap,
      solBySector: sSecMap,
      instBySector: iSecMap,
    };
  }, [solicitudes, installations, activeSector]);

  // Construir matriz del calendario mensual
  const { calendarDays, topSectors, topAdvisors } = useMemo(() => {
    // 1. Agrupar registros por fecha ISO (YYYY-MM-DD)
    const dateMap = new Map<string, PlanificacionRecord[]>();
    records.forEach((r) => {
      if (!r.fecha) return;
      if (!dateMap.has(r.fecha)) dateMap.set(r.fecha, []);
      dateMap.get(r.fecha)!.push(r);
    });

    // 2. Días del mes (1 al último día)
    const firstDayDate = new Date(year, monthIdx, 1);
    const lastDayDate = new Date(year, monthIdx + 1, 0);
    const totalDays = lastDayDate.getDate();

    // El día de la semana del día 1 (0 es Domingo, 1 es Lunes...)
    // Lo convertimos para que la semana empiece en Lunes (0 = Lunes, 6 = Domingo)
    const rawStartDay = firstDayDate.getDay();
    const startPadding = rawStartDay === 0 ? 6 : rawStartDay - 1;

    const days: Array<{
      dayNum: number | null;
      dateStr: string | null;
      isToday: boolean;
      advisorsCount: number;
      recordsCount: number;
      solicitudesCount: number;
      installationsCount: number;
      topSectors: string[];
    }> = [];

    // Relleno inicial de días vacíos antes del 1
    for (let i = 0; i < startPadding; i++) {
      days.push({
        dayNum: null,
        dateStr: null,
        isToday: false,
        advisorsCount: 0,
        recordsCount: 0,
        solicitudesCount: 0,
        installationsCount: 0,
        topSectors: [],
      });
    }

    const todayIso = new Date().toISOString().split("T")[0];

    // Días del mes
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayRecs = dateMap.get(dateStr) || [];
      const distinctAdvisors = new Set(dayRecs.map((r) => r.asesor)).size;

      // Sectores principales de ese día
      const sectorCounts = new Map<string, number>();
      dayRecs.forEach((r) => {
        if (r.sector && r.sector !== "N/A") {
          sectorCounts.set(r.sector, (sectorCounts.get(r.sector) || 0) + 1);
        }
      });
      const sortedSecs = Array.from(sectorCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([s]) => s);

      const mdKey = `${monthIdx + 1}-${d}`;
      const solCount = solByDate.get(dateStr) || solByMonthDay.get(mdKey) || 0;
      const instCount = instByDate.get(dateStr) || instByMonthDay.get(mdKey) || 0;

      days.push({
        dayNum: d,
        dateStr,
        isToday: dateStr === todayIso,
        advisorsCount: distinctAdvisors,
        recordsCount: dayRecs.length,
        solicitudesCount: solCount,
        installationsCount: instCount,
        topSectors: sortedSecs,
      });
    }

    // 3. Top sectores del mes y resultados de gestión en el sector
    const sectorStats = new Map<string, { count: number; parroquia?: string; municipio?: string }>();
    records.forEach((r) => {
      if (!r.sector || r.sector === "N/A") return;
      if (!sectorStats.has(r.sector)) {
        sectorStats.set(r.sector, { count: 0, parroquia: r.parroquia, municipio: r.municipio });
      }
      sectorStats.get(r.sector)!.count += 1;
    });

    const sortedTopSectors = Array.from(sectorStats.entries())
      .map(([name, data]) => {
        const secKey = normGeoKey(name);
        let solCount = solBySector.get(secKey) || 0;
        let instCount = instBySector.get(secKey) || 0;

        // Fallback para variantes de subsector o inclusión parcial
        if (solCount === 0) {
          solicitudes.forEach((s) => {
            const sKey = normGeoKey(s.sector);
            const subKey = normGeoKey(s.subsector);
            if (sKey === secKey || subKey === secKey || (sKey && secKey && (sKey.includes(secKey) || secKey.includes(sKey)))) {
              solCount += 1;
            }
          });
        }

        if (instCount === 0) {
          installations.forEach((i) => {
            const iKey = normGeoKey(i.sector);
            const subKey = normGeoKey(i.subsector);
            if (iKey === secKey || subKey === secKey || (iKey && secKey && (iKey.includes(secKey) || secKey.includes(iKey)))) {
              instCount += 1;
            }
          });
        }

        return {
          name,
          ...data,
          solicitudesCount: solCount,
          installationsCount: instCount,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // 4. Top asesores del mes
    const advisorStats = new Map<string, { count: number; sectors: Set<string> }>();
    records.forEach((r) => {
      if (!r.asesor || r.asesor === "Sin Asesor") return;
      if (!advisorStats.has(r.asesor)) {
        advisorStats.set(r.asesor, { count: 0, sectors: new Set() });
      }
      const entry = advisorStats.get(r.asesor)!;
      entry.count += 1;
      if (r.sector) entry.sectors.add(r.sector);
    });
    const sortedTopAdvisors = Array.from(advisorStats.entries())
      .map(([name, data]) => ({ name, count: data.count, sectorsCount: data.sectors.size }))
      .sort((a, b) => b.count - a.count);

    return {
      calendarDays: days,
      topSectors: sortedTopSectors,
      topAdvisors: sortedTopAdvisors,
    };
  }, [records, monthIdx, year, solByDate, instByDate, solByMonthDay, instByMonthDay, solBySector, instBySector, solicitudes, installations]);

  // Asesores a mostrar a la derecha (filtrados por sector si se seleccionó uno, o top asesores generales)
  const displayedAdvisors = useMemo(() => {
    if (!activeSector) {
      return topAdvisors.map((adv) => ({
        name: adv.name,
        count: adv.count,
        subtext: `${adv.sectorsCount} ${adv.sectorsCount === 1 ? "sector cubierto" : "sectores cubiertos"}`,
      }));
    }

    const secKey = activeSector.trim().toLowerCase();
    const map = new Map<string, { count: number; dates: Set<string> }>();

    records.forEach((r) => {
      if (!r.asesor || r.asesor === "Sin Asesor") return;
      if (r.sector && r.sector.trim().toLowerCase() === secKey) {
        if (!map.has(r.asesor)) {
          map.set(r.asesor, { count: 0, dates: new Set() });
        }
        const item = map.get(r.asesor)!;
        item.count += 1;
        if (r.fecha) item.dates.add(r.fecha);
      }
    });

    return Array.from(map.entries())
      .map(([name, data]) => ({
        name,
        count: data.count,
        subtext: `${data.dates.size} ${data.dates.size === 1 ? "día de actividad" : "días de actividad"}`,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [activeSector, topAdvisors, records]);

  return (
    <div className="space-y-8 pt-2">
      {/* Cuadrícula del Calendario Mensual */}
      <div className="space-y-2">
        {/* Leyenda contextual discreta cuando hay asesor seleccionado */}
        {selectedAdvisor && (
          <div className="flex flex-wrap items-center justify-between text-[11px] text-neutral-400 font-mono pb-1 border-b border-neutral-100">
            <span>
              {activeSector
                ? `Ruta del asesor con foco en ${activeSector} · ${selectedAdvisor}`
                : `Ruta mensual y resultados · ${selectedAdvisor}`}
            </span>
            <div className="flex items-center gap-2">
              <span>
                <strong className="text-neutral-700 font-semibold">sol</strong>: solicitudes enviadas
              </span>
              <span className="text-neutral-300">·</span>
              <span>
                <strong className="text-neutral-700 font-semibold">inst</strong>: clientes instalados
              </span>
            </div>
          </div>
        )}

        {/* Cabecera de días de la semana */}
        <div className="grid grid-cols-7 border-b border-neutral-200 pb-2 text-xs text-neutral-400 font-mono text-center">
          <div>Lun</div>
          <div>Mar</div>
          <div>Mié</div>
          <div>Jue</div>
          <div>Vie</div>
          <div>Sáb</div>
          <div>Dom</div>
        </div>

        {/* Días del mes */}
        <div className="grid grid-cols-7 divide-x divide-y divide-neutral-100/60 border-b border-neutral-100/60">
          {calendarDays.map((day, idx) => {
            if (!day.dayNum) {
              return (
                <div key={`empty-${idx}`} className="h-24 p-2.5 bg-neutral-50/20" />
              );
            }

            const isMatchSector = (secName: string) => {
              if (!activeSector) return false;
              const k = normGeoKey(secName);
              const target = normGeoKey(activeSector);
              return k === target || k.includes(target) || target.includes(k);
            };

            const isCurrentSectorDay = activeSector
              ? day.topSectors.some(isMatchSector)
              : true;

            const hasResults = day.solicitudesCount > 0 || day.installationsCount > 0;
            const hasData = day.recordsCount > 0 || hasResults;

            return (
              <div
                key={day.dateStr}
                onClick={() => {
                  if (day.dateStr && onSelectDay) {
                    onSelectDay(day.dateStr);
                  }
                }}
                title={
                  selectedAdvisor
                    ? `${String(day.dayNum).padStart(2, "0")} de ${month}: ${
                        day.topSectors.join(", ") || "Sin ruta asignada"
                      }${
                        hasResults
                          ? ` (${day.solicitudesCount} sol · ${day.installationsCount} inst)`
                          : day.recordsCount > 0
                          ? " (Jornada planificada)"
                          : " (Sin jornada)"
                      }`
                    : `${String(day.dayNum).padStart(2, "0")} de ${month}: ${
                        day.topSectors.join(", ") || "Sin jornada"
                      } (${day.advisorsCount} asesores)`
                }
                className={cn(
                  "h-24 p-2.5 flex flex-col justify-between transition-colors cursor-pointer group",
                  day.isToday ? "bg-neutral-100/40" : "hover:bg-neutral-50/60",
                  !hasData && "opacity-30"
                )}
              >
                {/* 1. Número del día e Indicador de Asesores Totales (solo en vista global) */}
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "text-xs font-mono transition-colors",
                      day.isToday
                        ? "font-bold text-neutral-950 underline decoration-neutral-400 underline-offset-4"
                        : "text-neutral-500 group-hover:text-neutral-900"
                    )}
                  >
                    {String(day.dayNum).padStart(2, "0")}
                  </span>
                  {!selectedAdvisor && hasData && (
                    <span className="text-[10px] text-neutral-400 font-mono">
                      {day.advisorsCount} as.
                    </span>
                  )}
                </div>

                {/* 2. Rutas o Sectores principales de ese día (SIEMPRE visible dónde estuvo el asesor) */}
                <div className="min-w-0 my-auto py-0.5 space-y-0.5">
                  {day.topSectors.length > 0 ? (
                    day.topSectors.map((sec, sIdx) => {
                      const isMatch = isMatchSector(sec);

                      return (
                        <span
                          key={sIdx}
                          className={cn(
                            "text-[11px] block truncate leading-tight font-sans transition-colors",
                            activeSector
                              ? isMatch
                                ? "font-semibold text-neutral-950"
                                : "text-neutral-400 font-normal"
                              : "text-neutral-700 font-normal"
                          )}
                          title={sec}
                        >
                          {sec}
                        </span>
                      );
                    })
                  ) : activeSector && hasResults ? (
                    <span className="text-[11px] block truncate leading-tight font-sans font-semibold text-neutral-950">
                      {activeSector}
                    </span>
                  ) : day.recordsCount === 0 && !hasResults ? (
                    <span className="text-[10px] text-neutral-300 font-mono block">
                      Sin jornada
                    </span>
                  ) : null}
                </div>

                {/* 3. Desempeño del Asesor (solicitudes e instalaciones del sector activo) */}
                {selectedAdvisor && hasResults ? (
                  <div className="pt-1.5 border-t border-neutral-100/80 flex items-center gap-1.5 text-[10px] font-mono leading-none">
                    {day.solicitudesCount > 0 && (
                      <span
                        className="text-neutral-900 inline-flex items-baseline gap-0.5"
                        title={`${day.solicitudesCount} solicitudes enviadas`}
                      >
                        <strong className="font-semibold text-neutral-950">
                          {day.solicitudesCount}
                        </strong>
                        <span className="text-neutral-400 font-normal">sol</span>
                      </span>
                    )}
                    {day.solicitudesCount > 0 && day.installationsCount > 0 && (
                      <span className="text-neutral-300">·</span>
                    )}
                    {day.installationsCount > 0 && (
                      <span
                        className="text-neutral-900 inline-flex items-baseline gap-0.5"
                        title={`${day.installationsCount} clientes instalados`}
                      >
                        <strong className="font-semibold text-neutral-950">
                          {day.installationsCount}
                        </strong>
                        <span className="text-neutral-400 font-normal">inst</span>
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="h-0" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* LÍNEA DIVISORIA SUTIL */}
      <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-neutral-300 to-transparent my-2" />

      {/* Secciones de Análisis Mensual: Sectores con mayor presencia y Asesores con más jornadas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
        {/* 1. Sectores más planificados en el mes */}
        <div className="space-y-3">
          <div className="border-b border-neutral-100 pb-1.5 flex items-baseline justify-between">
            <h3 className="text-xs font-semibold text-neutral-900">
              {selectedAdvisor ? "Sectores con cobertura del asesor" : "Sectores con mayor cobertura mensual"}
            </h3>
            <span className="text-[11px] text-neutral-400 font-mono">
              {selectedAdvisor ? "Jornadas y resultados" : "Frecuencia de visitas"}
            </span>
          </div>

          <div className="divide-y divide-neutral-100/70">
            {topSectors.map((sec, idx) => {
              const isSelected = activeSector?.toLowerCase() === sec.name.toLowerCase();

              return (
                <div
                  key={sec.name}
                  onClick={() => handleToggleSector(sec.name)}
                  className={cn(
                    "flex items-center justify-between py-2 text-xs transition-colors px-1 cursor-pointer",
                    isSelected
                      ? "bg-neutral-100/60 font-medium text-neutral-950"
                      : "hover:bg-neutral-50/50 text-neutral-900"
                  )}
                  title={`Clic para filtrar asesores en ${sec.name}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-[10px] font-mono text-neutral-400 w-4 shrink-0">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={cn("truncate", isSelected ? "font-semibold text-neutral-950" : "font-medium text-neutral-900")}>
                          {sec.name}
                        </span>
                        {isSelected && (
                          <span className="text-[9px] text-neutral-400 font-mono">
                            · Activo
                          </span>
                        )}
                      </div>
                      {sec.parroquia && sec.parroquia !== "N/A" && (
                        <span className="text-[10px] text-neutral-400 font-mono truncate">
                          {sec.parroquia} {sec.municipio ? `· ${sec.municipio}` : ""}
                        </span>
                      )}
                    </div>
                  </div>

                  {selectedAdvisor ? (
                    <div className="flex flex-col items-end shrink-0 pl-3">
                      <span className="font-mono text-xs text-neutral-800">
                        {sec.count} {sec.count === 1 ? "jornada" : "jornadas"}
                      </span>
                      <div className="flex items-center gap-1.5 text-[11px] font-mono pt-0.5">
                        <span
                          className={cn(
                            sec.solicitudesCount > 0 ? "text-neutral-900" : "text-neutral-400"
                          )}
                          title={`${sec.solicitudesCount} solicitudes enviadas en ${sec.name}`}
                        >
                          <strong
                            className={cn(
                              sec.solicitudesCount > 0 ? "font-semibold text-neutral-950" : "font-normal"
                            )}
                          >
                            {sec.solicitudesCount}
                          </strong>{" "}
                          <span className="text-neutral-400 font-normal">sol</span>
                        </span>
                        <span className="text-neutral-300">·</span>
                        <span
                          className={cn(
                            sec.installationsCount > 0 ? "text-neutral-900" : "text-neutral-400"
                          )}
                          title={`${sec.installationsCount} clientes instalados en ${sec.name}`}
                        >
                          <strong
                            className={cn(
                              sec.installationsCount > 0 ? "font-semibold text-neutral-950" : "font-normal"
                            )}
                          >
                            {sec.installationsCount}
                          </strong>{" "}
                          <span className="text-neutral-400 font-normal">inst</span>
                        </span>
                      </div>
                    </div>
                  ) : (
                    <span className="font-mono text-xs text-neutral-800 shrink-0">
                      {sec.count} {sec.count === 1 ? "jornada" : "jornadas"}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. Asesores con mayor despliegue en el mes o en el sector seleccionado */}
        <div className="space-y-3">
          <div className="border-b border-neutral-100 pb-1.5 flex items-baseline justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold text-neutral-900">
                {activeSector ? `Asesores en ${activeSector}` : "Asesores con mayor actividad en el mes"}
              </h3>
              {activeSector && (
                <button
                  type="button"
                  onClick={() => handleToggleSector(activeSector)}
                  title="Quitar filtro de sector"
                  className="text-neutral-400 hover:text-neutral-900 p-0.5 cursor-pointer transition-colors"
                >
                  <X className="w-3 h-3 stroke-[1.5]" />
                </button>
              )}
            </div>
            <span className="text-[11px] text-neutral-400 font-mono">
              {activeSector
                ? `${displayedAdvisors.length} ${displayedAdvisors.length === 1 ? "asesor asignado" : "asesores asignados"}`
                : "Turnos asignados"}
            </span>
          </div>

          {displayedAdvisors.length === 0 ? (
            <div className="py-8 text-center text-xs text-neutral-400 font-mono">
              No hay asesores asignados a este sector en el mes.
            </div>
          ) : (
            <div className="space-y-2">
              <div className="divide-y divide-neutral-100/70">
                {(showAllAdvisors || activeSector ? displayedAdvisors : displayedAdvisors.slice(0, 8)).map((adv, idx) => (
                  <div
                    key={adv.name}
                    onClick={() => onSelectAdvisor?.(adv.name)}
                    className="flex items-center justify-between py-2 text-xs hover:bg-neutral-50/50 transition-colors px-1 cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-[10px] font-mono text-neutral-400 w-4 shrink-0">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium text-neutral-900 truncate">
                          {adv.name}
                        </span>
                        <span className="text-[10px] text-neutral-400 font-mono truncate">
                          {adv.subtext}
                        </span>
                      </div>
                    </div>

                    <span className="font-mono text-xs text-neutral-800 shrink-0">
                      {adv.count} {adv.count === 1 ? "jornada" : "jornadas"}
                    </span>
                  </div>
                ))}
              </div>

              {!activeSector && displayedAdvisors.length > 8 && (
                <button
                  type="button"
                  onClick={() => setShowAllAdvisors(!showAllAdvisors)}
                  className="pt-1 text-[11px] text-neutral-400 hover:text-neutral-900 transition-colors font-mono cursor-pointer"
                >
                  {showAllAdvisors
                    ? "Ver menos"
                    : `Ver todos los asesores (${displayedAdvisors.length})`}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

