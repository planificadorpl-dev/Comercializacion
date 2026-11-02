"use client";

import { cn } from "@/lib/utils";
import { PlanificacionRecord } from "@/lib/dashboard-data";

export interface WeekDay {
  dateStr: string; // YYYY-MM-DD
  dayName: string; // Lunes, Martes...
  dayShort: string; // Lun, Mar...
  dayNumber: string; // 02, 03...
  isToday: boolean;
}

export interface AdvisorWeeklySchedule {
  name: string;
  normName: string;
  assignmentsByDate: Record<string, PlanificacionRecord[]>;
  totalJornadas: number;
  distinctSectors: number;
}

interface PlanificacionWeeklyMatrixProps {
  days: WeekDay[];
  schedules: AdvisorWeeklySchedule[];
  onSelectDay?: (dateStr: string) => void;
  onSelectAdvisor?: (advisor: string) => void;
  selectedAdvisor?: string | null;
}

export function PlanificacionWeeklyMatrix({
  days,
  schedules,
  onSelectDay,
  onSelectAdvisor,
  selectedAdvisor,
}: PlanificacionWeeklyMatrixProps) {
  if (schedules.length === 0) {
    return (
      <div className="py-16 text-center text-xs text-neutral-400 font-mono">
        No hay asesores ni rutas planificadas para esta semana con los filtros aplicados.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto no-scrollbar pb-6">
      <table className="w-full text-left border-collapse min-w-[900px]">
        {/* Cabecera de la matriz */}
        <thead>
          <tr className="border-b border-neutral-200 text-xs text-neutral-500">
            <th className="py-3 px-3 font-normal w-48 sticky left-0 bg-[#FBFBFB] z-10">
              Asesor comercial
            </th>
            {days.map((day) => (
              <th
                key={day.dateStr}
                onClick={() => onSelectDay?.(day.dateStr)}
                className={cn(
                  "py-3 px-3 font-normal cursor-pointer transition-colors group",
                  day.isToday ? "text-neutral-950 font-semibold" : "hover:text-neutral-900"
                )}
              >
                <div className="flex items-center gap-1.5">
                  <span className="capitalize">{day.dayShort}</span>
                  <span className="font-mono text-neutral-900">{day.dayNumber}</span>
                  {day.isToday && (
                    <span className="w-1.5 h-1.5 rounded-full bg-neutral-900 inline-block shrink-0" />
                  )}
                </div>
              </th>
            ))}
            <th className="py-3 px-3 font-normal text-right w-24">
              Jornadas
            </th>
          </tr>
        </thead>

        {/* Cuerpo de la matriz con separadores sutiles */}
        <tbody className="divide-y divide-neutral-100/70 text-xs">
          {schedules.map((adv, idx) => {
            const isSelected = selectedAdvisor && selectedAdvisor.toLowerCase() === adv.name.toLowerCase();

            return (
              <tr
                key={adv.normName || idx}
                className={cn(
                  "group transition-colors",
                  isSelected ? "bg-neutral-100/60 font-medium" : "hover:bg-neutral-50/50"
                )}
              >
                {/* Columna de Asesor */}
                <td
                  onClick={() => onSelectAdvisor?.(adv.name)}
                  className="py-3 px-3 sticky left-0 bg-[#FBFBFB] group-hover:bg-[#F8F8F8] z-10 cursor-pointer"
                >
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className={cn("truncate", isSelected ? "font-bold text-neutral-950" : "text-neutral-900")}>
                      {adv.name}
                    </span>
                    <span className="text-[10px] text-neutral-400 font-mono">
                      {adv.distinctSectors} {adv.distinctSectors === 1 ? "sector" : "sectores"}
                    </span>
                  </div>
                </td>

                {/* Celdas de los días de la semana */}
                {days.map((day) => {
                  const dayRecords = adv.assignmentsByDate[day.dateStr] || [];

                  if (dayRecords.length === 0) {
                    return (
                      <td
                        key={day.dateStr}
                        onClick={() => onSelectDay?.(day.dateStr)}
                        className="py-3 px-3 align-top cursor-pointer text-neutral-300 font-mono text-[11px]"
                      >
                        —
                      </td>
                    );
                  }

                  return (
                    <td
                      key={day.dateStr}
                      onClick={() => onSelectDay?.(day.dateStr)}
                      className="py-3 px-3 align-top cursor-pointer group/cell"
                    >
                      <div className="space-y-1.5">
                        {dayRecords.map((rec, rIdx) => {
                          const actividad = rec.tipo_actividad || rec.plan || "Recorrido";
                          const sector = rec.sector || "Sector no especificado";
                          const parroquia = rec.parroquia || rec.zona || "";

                          return (
                            <div key={rec.id || rIdx} className="space-y-0.5">
                              <span className="text-xs font-medium text-neutral-900 block leading-tight truncate">
                                {sector}
                              </span>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {parroquia && parroquia !== "N/A" && (
                                  <span className="text-[10px] text-neutral-400 font-mono truncate max-w-[120px]">
                                    {parroquia}
                                  </span>
                                )}
                                <span className="text-[10px] text-neutral-500 font-mono">
                                  · {actividad}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                  );
                })}

                {/* Total semanal */}
                <td className="py-3 px-3 text-right font-mono text-neutral-700 align-top">
                  {adv.totalJornadas}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
