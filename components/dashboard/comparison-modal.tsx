"use client";

import { useState, useMemo, useEffect } from "react";
import { X, ArrowLeftRight, Calendar, Users, Wrench, MapPin, Check, Sparkles } from "lucide-react";
import { cn, formatNumber, formatProperCase } from "@/lib/utils";
import { Installation, Solicitud, MONTH_ORDER } from "@/lib/dashboard-data";
import {
  compareMonthsMTD,
  compareAdvisors,
  compareTechnicians,
  compareTerritories,
  getMaxDayForMonth,
} from "@/lib/analytics-comparison";
import { DayByDayComparisonCard } from "@/components/dashboard/day-by-day-comparison-card";
import { CustomDropdown } from "@/components/ui/custom-dropdown";

interface ComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  rawData: Installation[];
  rawSolicitudes: Solicitud[];
  options: {
    advisors: string[];
    zones: string[];
    sectors: string[];
    months: string[];
    technicians: string[];
  };
}

type TabType = "months" | "advisors" | "technicians" | "territories";

export function ComparisonModal({
  isOpen,
  onClose,
  rawData,
  rawSolicitudes,
  options,
}: ComparisonModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("months");

  // Tab 1 state: Month vs Month
  const availableMonths = useMemo(() => {
    return options.months.filter(Boolean);
  }, [options.months]);

  const currentIdx = new Date().getMonth();
  const defaultMonthA = MONTH_ORDER[currentIdx] || "Noviembre";
  const defaultMonthB = currentIdx > 0 ? MONTH_ORDER[currentIdx - 1] : "Octubre";

  const [monthA, setMonthA] = useState<string>(defaultMonthA);
  const [monthB, setMonthB] = useState<string>(defaultMonthB);
  const [useMTD, setUseMTD] = useState<boolean>(true);

  // Tab 2 state: Advisor vs Advisor
  const [advisorA, setAdvisorA] = useState<string>("");
  const [advisorB, setAdvisorB] = useState<string>("");
  const [advFilterZone, setAdvFilterZone] = useState<string>("");
  const [advFilterSector, setAdvFilterSector] = useState<string>("");
  const [advFilterMonth, setAdvFilterMonth] = useState<string>("");

  // Tab 3 state: Technician vs Technician
  const [techA, setTechA] = useState<string>("");
  const [techB, setTechB] = useState<string>("");
  const [techFilterZone, setTechFilterZone] = useState<string>("");
  const [techFilterSector, setTechFilterSector] = useState<string>("");
  const [techFilterMonth, setTechFilterMonth] = useState<string>("");

  // Tab 4 state: Territory vs Territory
  const [territoryType, setTerritoryType] = useState<"zona" | "sector">("zona");
  const [territoryA, setTerritoryA] = useState<string>("");
  const [territoryB, setTerritoryB] = useState<string>("");
  const [terrFilterMonth, setTerrFilterMonth] = useState<string>("");

  // Set intelligent defaults once options are available
  useEffect(() => {
    if (availableMonths.length >= 2) {
      if (!monthA) setMonthA(availableMonths[availableMonths.length - 1]);
      if (!monthB) setMonthB(availableMonths[availableMonths.length - 2]);
    }
    if (options.advisors.length >= 2) {
      if (!advisorA) setAdvisorA(options.advisors[0]);
      if (!advisorB) setAdvisorB(options.advisors[1]);
    }
    if (options.technicians.length >= 2) {
      if (!techA) setTechA(options.technicians[0]);
      if (!techB) setTechB(options.technicians[1]);
    }
    if (options.zones.length >= 2) {
      if (!territoryA) setTerritoryA(options.zones[0]);
      if (!territoryB) setTerritoryB(options.zones[1]);
    }
  }, [availableMonths, options]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Calculations
  const monthComparison = useMemo(() => {
    if (!monthA || !monthB) return null;
    return compareMonthsMTD(rawData, rawSolicitudes, monthA, monthB, useMTD);
  }, [rawData, rawSolicitudes, monthA, monthB, useMTD]);

  const advisorComparison = useMemo(() => {
    if (!advisorA || !advisorB) return null;
    return compareAdvisors(
      rawSolicitudes,
      rawData,
      advisorA,
      advisorB,
      advFilterZone || undefined,
      advFilterSector || undefined,
      advFilterMonth || undefined
    );
  }, [rawSolicitudes, rawData, advisorA, advisorB, advFilterZone, advFilterSector, advFilterMonth]);

  const technicianComparison = useMemo(() => {
    if (!techA || !techB) return null;
    return compareTechnicians(
      rawData,
      techA,
      techB,
      techFilterZone || undefined,
      techFilterSector || undefined,
      techFilterMonth || undefined
    );
  }, [rawData, techA, techB, techFilterZone, techFilterSector, techFilterMonth]);

  const territoryComparison = useMemo(() => {
    if (!territoryA || !territoryB) return null;
    return compareTerritories(
      rawData,
      rawSolicitudes,
      territoryType,
      territoryA,
      territoryB,
      terrFilterMonth || undefined
    );
  }, [rawData, rawSolicitudes, territoryType, territoryA, territoryB, terrFilterMonth]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-neutral-200 rounded-xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden font-sans">
        {/* MODAL HEADER */}
        <header className="px-3 sm:px-6 py-3 border-b border-neutral-200 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-neutral-900 tracking-tight">
                  Centro de comparativas y telemetría
                </h2>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-700">
                  Like-for-Like MTD
                </span>
              </div>
              <p className="text-[11px] font-mono text-neutral-500">
                Benchmarking operativo de fibra óptica entre períodos y entidades
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] p-2.5 text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer flex items-center justify-center -mr-2"
            title="Cerrar (Esc)"
            aria-label="Cerrar comparativas"
          >
            <X className="w-4 h-4 stroke-[1.75]" />
          </button>
        </header>

        {/* TABS SELECTOR */}
        <div className="px-3 sm:px-6 py-1 border-b border-neutral-100 flex items-center gap-1 shrink-0 overflow-x-auto no-scrollbar scroll-smooth whitespace-nowrap">
          {[
            { id: "months", label: "Mes vs. Mes (MTD)", icon: Calendar },
            { id: "advisors", label: "Asesor vs. Asesor", icon: Users },
            { id: "technicians", label: "Técnico vs. Técnico", icon: Wrench },
            { id: "territories", label: "Zonas y Sectores", icon: MapPin },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={cn(
                  "min-h-[44px] py-2 px-2.5 text-xs font-mono font-medium transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap",
                  isActive
                    ? "text-neutral-900 font-semibold border-b-2 border-neutral-900 -mb-[1px]"
                    : "text-neutral-500 hover:text-neutral-900"
                )}
              >
                <Icon className={cn("w-3.5 h-3.5", isActive ? "text-neutral-900" : "text-neutral-400")} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* MODAL BODY (SCROLLABLE) */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
          {/* TAB 1: MONTH VS MONTH */}
          {activeTab === "months" && monthComparison && (
            <div className="space-y-4 sm:space-y-6">
              {/* Controls bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 rounded-lg border border-neutral-100 bg-neutral-50/60">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-[130px]">
                    <label className="text-[10px] font-mono text-neutral-400 block mb-1">
                      Mes base (A)
                    </label>
                    <CustomDropdown
                      value={monthA}
                      onChange={setMonthA}
                      options={availableMonths}
                      className="w-full sm:w-36"
                    />
                  </div>

                  <span className="text-neutral-400 font-mono text-xs pt-4">vs</span>

                  <div className="min-w-[130px]">
                    <label className="text-[10px] font-mono text-neutral-400 block mb-1">
                      Mes comparativo (B)
                    </label>
                    <CustomDropdown
                      value={monthB}
                      onChange={setMonthB}
                      options={availableMonths}
                      className="w-full sm:w-36"
                    />
                  </div>
                </div>

                {/* MTD Toggle */}
                <div className="flex items-center gap-2 pt-2 sm:pt-0">
                  <label className="min-h-[44px] flex items-center gap-2 cursor-pointer text-xs font-mono text-neutral-700 py-1.5 hover:text-neutral-900">
                    <input
                      type="checkbox"
                      checked={useMTD}
                      onChange={(e) => setUseMTD(e.target.checked)}
                      className="w-4 h-4 rounded border-neutral-300 text-neutral-900 focus:ring-0"
                    />
                    <span>Corte homólogo estricto al día {monthComparison.maxDay}</span>
                  </label>
                </div>
              </div>

              {/* MTD Status Note */}
              {useMTD && (
                <div className="py-1 px-1 text-xs font-mono text-neutral-600 flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-neutral-100">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                    <span>
                      Comparando <strong>{monthA}</strong> vs. <strong>{monthB}</strong> al día {monthComparison.maxDay}.
                    </span>
                  </div>
                  <span className="text-[11px] text-neutral-500">
                    Sin distorsión de mes incompleto
                  </span>
                </div>
              )}

              {/* KPI Comparison Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {/* 1. Instalaciones */}
                <div className="p-3.5 rounded-lg border border-neutral-200 bg-white flex flex-col justify-between">
                  <span className="text-[11px] font-mono text-neutral-500">Instalaciones</span>
                  <div className="my-2">
                    <div className="flex items-baseline justify-between text-xs font-mono">
                      <span className="font-bold text-neutral-900 text-base">{formatNumber(monthComparison.totalA)}</span>
                      <span className="text-neutral-400">vs {formatNumber(monthComparison.totalB)}</span>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "text-xs font-sans font-semibold",
                      monthComparison.deltaPercent >= 0 ? "text-emerald-600" : "text-orange-600"
                    )}
                  >
                    {monthComparison.deltaPercent >= 0 ? "↑ +" : "↓ "}
                    {monthComparison.deltaPercent}%
                  </span>
                </div>

                {/* 2. Solicitudes */}
                <div className="p-3.5 rounded-lg border border-neutral-200 bg-white flex flex-col justify-between">
                  <span className="text-[11px] font-mono text-neutral-500">Solicitudes</span>
                  <div className="my-2">
                    <div className="flex items-baseline justify-between text-xs font-mono">
                      <span className="font-bold text-neutral-900 text-base">{formatNumber(monthComparison.solicitudesA)}</span>
                      <span className="text-neutral-400">vs {formatNumber(monthComparison.solicitudesB)}</span>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "text-xs font-sans font-semibold",
                      monthComparison.deltaSolPercent >= 0 ? "text-emerald-600" : "text-orange-600"
                    )}
                  >
                    {monthComparison.deltaSolPercent >= 0 ? "↑ +" : "↓ "}
                    {monthComparison.deltaSolPercent}%
                  </span>
                </div>

                {/* 3. Tasa de Efectividad */}
                <div className="p-3.5 rounded-lg border border-neutral-200 bg-white flex flex-col justify-between">
                  <span className="text-[11px] font-mono text-neutral-500">Efectividad</span>
                  <div className="my-2">
                    <div className="flex items-baseline justify-between text-xs font-mono">
                      <span className="font-bold text-neutral-900 text-base">{monthComparison.efectividadA}%</span>
                      <span className="text-neutral-400">vs {monthComparison.efectividadB}%</span>
                    </div>
                  </div>
                  <span className="text-[11px] font-sans text-neutral-600">
                    conversión demanda
                  </span>
                </div>

                {/* 4. Ritmo Diario */}
                <div className="p-3.5 rounded-lg border border-neutral-200 bg-white flex flex-col justify-between">
                  <span className="text-[11px] font-mono text-neutral-500">Ritmo Diario</span>
                  <div className="my-2">
                    <div className="flex items-baseline justify-between text-xs font-mono">
                      <span className="font-bold text-neutral-900 text-base">{monthComparison.dailyRateA}</span>
                      <span className="text-neutral-400">vs {monthComparison.dailyRateB}</span>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-neutral-500">
                    inst./día registradas
                  </span>
                </div>

                {/* 5. Routers Instalados */}
                <div className="p-3.5 rounded-lg border border-neutral-200 bg-white flex flex-col justify-between">
                  <span className="text-[11px] font-mono text-neutral-500">Routers</span>
                  <div className="my-2">
                    <div className="flex items-baseline justify-between text-xs font-mono">
                      <span className="font-bold text-neutral-900 text-base">{formatNumber(monthComparison.routersA)}</span>
                      <span className="text-neutral-400">vs {formatNumber(monthComparison.routersB)}</span>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-neutral-500">
                    equipos entregados
                  </span>
                </div>

                {/* 6. Proyección a 30 Días */}
                <div className="p-3.5 rounded-lg border border-neutral-200 bg-white flex flex-col justify-between">
                  <span className="text-[11px] font-mono text-neutral-500">Cierre Proyectado</span>
                  <div className="my-2">
                    <div className="flex items-baseline justify-between text-xs font-mono">
                      <span className="font-bold text-neutral-900 text-base">{formatNumber(monthComparison.projectedEndA)}</span>
                      <span className="text-neutral-400">vs {formatNumber(monthComparison.projectedEndB)}</span>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-neutral-500">
                    run-rate mensual
                  </span>
                </div>
              </div>

              {/* Side-by-side Visual Balance Bar */}
              <div className="p-4 rounded-lg border border-neutral-200 bg-white">
                <div className="flex items-center justify-between text-xs font-mono mb-2">
                  <span className="font-bold text-neutral-900">
                    {monthA}: {formatNumber(monthComparison.totalA)} ({Math.round((monthComparison.totalA / (monthComparison.totalA + monthComparison.totalB || 1)) * 100)}%)
                  </span>
                  <span className="font-bold text-neutral-600">
                    {monthB}: {formatNumber(monthComparison.totalB)} ({Math.round((monthComparison.totalB / (monthComparison.totalA + monthComparison.totalB || 1)) * 100)}%)
                  </span>
                </div>
                <div className="h-4 w-full bg-neutral-100 rounded-full overflow-hidden flex">
                  <div
                    className="bg-neutral-900 h-full transition-all duration-300"
                    style={{
                      width: `${Math.round((monthComparison.totalA / (monthComparison.totalA + monthComparison.totalB || 1)) * 100)}%`,
                    }}
                  />
                  <div
                    className="bg-neutral-400 h-full transition-all duration-300"
                    style={{
                      width: `${Math.round((monthComparison.totalB / (monthComparison.totalA + monthComparison.totalB || 1)) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Day-by-Day MTD Analysis Table with Period Homologation and Zero-Filling */}
              <div className="pt-2">
                <DayByDayComparisonCard
                  installations={rawData}
                  solicitudes={rawSolicitudes}
                  defaultMonthA={monthB}
                  defaultMonthB={monthA}
                  className="p-0 border border-neutral-200 rounded-lg"
                />
              </div>
            </div>
          )}

          {/* TAB 2: ADVISOR VS ADVISOR */}
          {activeTab === "advisors" && advisorComparison && (
            <div className="space-y-6">
              {/* Advisor Controls & Filters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 sm:p-4 rounded-lg border border-neutral-100 bg-neutral-50/60">
                <div>
                  <label className="text-[10px] font-mono text-neutral-400 block mb-1">
                    Asesor A
                  </label>
                  <CustomDropdown
                    value={advisorA}
                    onChange={setAdvisorA}
                    options={options.advisors}
                    placeholder="Seleccionar Asesor A"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-mono text-neutral-400 block mb-1">
                    Asesor B
                  </label>
                  <CustomDropdown
                    value={advisorB}
                    onChange={setAdvisorB}
                    options={options.advisors}
                    placeholder="Seleccionar Asesor B"
                  />
                </div>

                {/* Contextual Territory Filters */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] font-mono text-neutral-400 block mb-1">
                      Zona (Opcional)
                    </label>
                    <CustomDropdown
                      value={advFilterZone}
                      onChange={setAdvFilterZone}
                      options={[{ value: "", label: "Todas las zonas" }, ...options.zones.map((z) => ({ value: z, label: z }))]}
                      placeholder="Todas las zonas"
                    />
                  </div>

                  <div className="flex-1">
                    <label className="text-[10px] font-mono text-neutral-400 block mb-1">
                      Mes
                    </label>
                    <CustomDropdown
                      value={advFilterMonth}
                      onChange={setAdvFilterMonth}
                      options={[{ value: "", label: "Todo el año" }, ...availableMonths.map((m) => ({ value: m, label: m }))]}
                      placeholder="Todo el año"
                    />
                  </div>
                </div>
              </div>

              {/* Head-to-Head Balance Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Advisor A Column */}
                <div className="p-4 rounded-lg border border-neutral-200 bg-white space-y-4">
                  <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                    <h3 className="font-bold text-sm text-neutral-900">{advisorComparison.advisorA}</h3>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-neutral-100 text-neutral-700">
                      Asesor A
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                    <div className="p-2 rounded bg-neutral-50 border border-neutral-100">
                      <span className="text-[10px] text-neutral-500 block">Solicitudes</span>
                      <strong className="text-base text-neutral-900">{formatNumber(advisorComparison.solicitudesA)}</strong>
                    </div>
                    <div className="p-2 rounded bg-neutral-50 border border-neutral-100">
                      <span className="text-[10px] text-neutral-500 block">Instaladas</span>
                      <strong className="text-base text-neutral-900">{formatNumber(advisorComparison.instalacionesA)}</strong>
                    </div>
                    <div className="p-2 rounded bg-neutral-50 border border-neutral-100">
                      <span className="text-[10px] text-neutral-500 block">Efectividad</span>
                      <strong className="text-base text-emerald-600">{advisorComparison.efectividadA}%</strong>
                    </div>
                  </div>

                  {/* Top Sectors */}
                  <div>
                    <span className="text-[11px] font-mono text-neutral-500 uppercase block mb-1.5">
                      Top Sectores de Demanda
                    </span>
                    <div className="space-y-1 text-xs font-mono">
                      {advisorComparison.topSectorsA.map((s, i) => (
                        <div key={i} className="flex justify-between text-neutral-700 pb-0.5 border-b border-neutral-100">
                          <span>{s.name}</span>
                          <span className="font-bold">{s.value} sol.</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Top Plans */}
                  <div>
                    <span className="text-[11px] font-mono text-neutral-500 uppercase block mb-1.5">
                      Planes más Vendidos
                    </span>
                    <div className="space-y-1 text-xs font-mono">
                      {advisorComparison.topPlansA.map((p, i) => (
                        <div key={i} className="flex justify-between text-neutral-700 pb-0.5 border-b border-neutral-100">
                          <span>{p.name}</span>
                          <span className="font-bold">{p.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Advisor B Column */}
                <div className="p-4 rounded-lg border border-neutral-200 bg-white space-y-4">
                  <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                    <h3 className="font-bold text-sm text-neutral-900">{advisorComparison.advisorB}</h3>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-neutral-100 text-neutral-700">
                      Asesor B
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                    <div className="p-2 rounded bg-neutral-50 border border-neutral-100">
                      <span className="text-[10px] text-neutral-500 block">Solicitudes</span>
                      <strong className="text-base text-neutral-900">{formatNumber(advisorComparison.solicitudesB)}</strong>
                    </div>
                    <div className="p-2 rounded bg-neutral-50 border border-neutral-100">
                      <span className="text-[10px] text-neutral-500 block">Instaladas</span>
                      <strong className="text-base text-neutral-900">{formatNumber(advisorComparison.instalacionesB)}</strong>
                    </div>
                    <div className="p-2 rounded bg-neutral-50 border border-neutral-100">
                      <span className="text-[10px] text-neutral-500 block">Efectividad</span>
                      <strong className="text-base text-emerald-600">{advisorComparison.efectividadB}%</strong>
                    </div>
                  </div>

                  {/* Top Sectors */}
                  <div>
                    <span className="text-[11px] font-mono text-neutral-500 uppercase block mb-1.5">
                      Top Sectores de Demanda
                    </span>
                    <div className="space-y-1 text-xs font-mono">
                      {advisorComparison.topSectorsB.map((s, i) => (
                        <div key={i} className="flex justify-between text-neutral-700 pb-0.5 border-b border-neutral-100">
                          <span>{s.name}</span>
                          <span className="font-bold">{s.value} sol.</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Top Plans */}
                  <div>
                    <span className="text-[11px] font-mono text-neutral-500 uppercase block mb-1.5">
                      Planes más Vendidos
                    </span>
                    <div className="space-y-1 text-xs font-mono">
                      {advisorComparison.topPlansB.map((p, i) => (
                        <div key={i} className="flex justify-between text-neutral-700 pb-0.5 border-b border-neutral-100">
                          <span>{p.name}</span>
                          <span className="font-bold">{p.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TECHNICIAN VS TECHNICIAN */}
          {activeTab === "technicians" && technicianComparison && (
            <div className="space-y-6">
              {/* Technician Controls */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 sm:p-4 rounded-lg border border-neutral-100 bg-neutral-50/60">
                <div>
                  <label className="text-[10px] font-mono text-neutral-400 block mb-1">
                    Técnico A
                  </label>
                  <CustomDropdown
                    value={techA}
                    onChange={setTechA}
                    options={options.technicians}
                    placeholder="Seleccionar Técnico A"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-mono text-neutral-400 block mb-1">
                    Técnico B
                  </label>
                  <CustomDropdown
                    value={techB}
                    onChange={setTechB}
                    options={options.technicians}
                    placeholder="Seleccionar Técnico B"
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] font-mono text-neutral-400 block mb-1">
                      Zona
                    </label>
                    <CustomDropdown
                      value={techFilterZone}
                      onChange={setTechFilterZone}
                      options={[{ value: "", label: "Todas las zonas" }, ...options.zones.map((z) => ({ value: z, label: z }))]}
                      placeholder="Todas las zonas"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] font-mono text-neutral-400 block mb-1">
                      Mes
                    </label>
                    <CustomDropdown
                      value={techFilterMonth}
                      onChange={setTechFilterMonth}
                      options={[{ value: "", label: "Todo el año" }, ...availableMonths.map((m) => ({ value: m, label: m }))]}
                      placeholder="Todo el año"
                    />
                  </div>
                </div>
              </div>

              {/* Head-to-Head Technicians */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Tech A */}
                <div className="p-4 rounded-lg border border-neutral-200 bg-white space-y-4">
                  <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                    <h3 className="font-bold text-sm text-neutral-900">{technicianComparison.techA}</h3>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-neutral-100 text-neutral-700">
                      SLA: {technicianComparison.slaA}
                    </span>
                  </div>

                  <div className="p-3 rounded bg-neutral-50 border border-neutral-100 flex items-center justify-between font-mono">
                    <span className="text-xs text-neutral-600">Total Instalaciones Resueltas:</span>
                    <strong className="text-lg text-neutral-900">{formatNumber(technicianComparison.ticketsA)}</strong>
                  </div>

                  <div>
                    <span className="text-[11px] font-mono text-neutral-500 uppercase block mb-1.5">
                      Zonas con Mayor Cobertura
                    </span>
                    <div className="space-y-1 text-xs font-mono">
                      {technicianComparison.topZonesA.map((z, i) => (
                        <div key={i} className="flex justify-between text-neutral-700 pb-0.5 border-b border-neutral-100">
                          <span>{z.name}</span>
                          <span className="font-bold">{z.value} tickets</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] font-mono text-neutral-500 uppercase block mb-1.5">
                      Sectores Principales
                    </span>
                    <div className="space-y-1 text-xs font-mono">
                      {technicianComparison.topSectorsA.map((s, i) => (
                        <div key={i} className="flex justify-between text-neutral-700 pb-0.5 border-b border-neutral-100">
                          <span>{s.name}</span>
                          <span className="font-bold">{s.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Tech B */}
                <div className="p-4 rounded-lg border border-neutral-200 bg-white space-y-4">
                  <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                    <h3 className="font-bold text-sm text-neutral-900">{technicianComparison.techB}</h3>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-neutral-100 text-neutral-700">
                      SLA: {technicianComparison.slaB}
                    </span>
                  </div>

                  <div className="p-3 rounded bg-neutral-50 border border-neutral-100 flex items-center justify-between font-mono">
                    <span className="text-xs text-neutral-600">Total Instalaciones Resueltas:</span>
                    <strong className="text-lg text-neutral-900">{formatNumber(technicianComparison.ticketsB)}</strong>
                  </div>

                  <div>
                    <span className="text-[11px] font-mono text-neutral-500 uppercase block mb-1.5">
                      Zonas con Mayor Cobertura
                    </span>
                    <div className="space-y-1 text-xs font-mono">
                      {technicianComparison.topZonesB.map((z, i) => (
                        <div key={i} className="flex justify-between text-neutral-700 pb-0.5 border-b border-neutral-100">
                          <span>{z.name}</span>
                          <span className="font-bold">{z.value} tickets</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] font-mono text-neutral-500 uppercase block mb-1.5">
                      Sectores Principales
                    </span>
                    <div className="space-y-1 text-xs font-mono">
                      {technicianComparison.topSectorsB.map((s, i) => (
                        <div key={i} className="flex justify-between text-neutral-700 pb-0.5 border-b border-neutral-100">
                          <span>{s.name}</span>
                          <span className="font-bold">{s.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: TERRITORY VS TERRITORY */}
          {activeTab === "territories" && territoryComparison && (
            <div className="space-y-6">
              {/* Territory Controls */}
              {/* Territory Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 p-3 sm:p-4 rounded-lg border border-neutral-100 bg-neutral-50/60">
                <div>
                  <label className="text-[10px] font-mono text-neutral-400 block mb-1">
                    Tipo de territorio
                  </label>
                  <CustomDropdown
                    value={territoryType}
                    onChange={(val) => {
                      const t = val as "zona" | "sector";
                      setTerritoryType(t);
                      if (t === "zona") {
                        setTerritoryA(options.zones[0] || "");
                        setTerritoryB(options.zones[1] || "");
                      } else {
                        setTerritoryA(options.sectors[0] || "");
                        setTerritoryB(options.sectors[1] || "");
                      }
                    }}
                    options={[
                      { value: "zona", label: "Zonas operativas" },
                      { value: "sector", label: "Sectores" },
                    ]}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-mono text-neutral-400 block mb-1">
                    {territoryType === "zona" ? "Zona A" : "Sector A"}
                  </label>
                  <CustomDropdown
                    value={territoryA}
                    onChange={setTerritoryA}
                    options={territoryType === "zona" ? options.zones : options.sectors}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-mono text-neutral-400 block mb-1">
                    {territoryType === "zona" ? "Zona B" : "Sector B"}
                  </label>
                  <CustomDropdown
                    value={territoryB}
                    onChange={setTerritoryB}
                    options={territoryType === "zona" ? options.zones : options.sectors}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-mono text-neutral-400 block mb-1">
                    Filtrar mes
                  </label>
                  <CustomDropdown
                    value={terrFilterMonth}
                    onChange={setTerrFilterMonth}
                    options={[{ value: "", label: "Todo el año" }, ...availableMonths.map((m) => ({ value: m, label: m }))]}
                    placeholder="Todo el año"
                  />
                </div>
              </div>

              {/* Head-to-Head Territories */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Territory A */}
                <div className="p-4 rounded-lg border border-neutral-200 bg-white space-y-4">
                  <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                    <h3 className="font-bold text-sm text-neutral-900">{territoryComparison.nameA}</h3>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-neutral-100 text-neutral-700">
                      {territoryType === "zona" ? "Zona A" : "Sector A"}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                    <div className="p-2 rounded bg-neutral-50 border border-neutral-100">
                      <span className="text-[10px] text-neutral-500 block">Instalaciones</span>
                      <strong className="text-base text-neutral-900">{formatNumber(territoryComparison.instalacionesA)}</strong>
                    </div>
                    <div className="p-2 rounded bg-neutral-50 border border-neutral-100">
                      <span className="text-[10px] text-neutral-500 block">Solicitudes</span>
                      <strong className="text-base text-neutral-900">{formatNumber(territoryComparison.solicitudesA)}</strong>
                    </div>
                    <div className="p-2 rounded bg-neutral-50 border border-neutral-100">
                      <span className="text-[10px] text-neutral-500 block">Efectividad</span>
                      <strong className="text-base text-emerald-600">{territoryComparison.efectividadA}%</strong>
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] font-mono text-neutral-500 uppercase block mb-1.5">
                      Asesores Activos en la Zona
                    </span>
                    <div className="p-2.5 rounded bg-neutral-50 border border-neutral-100 text-xs font-mono flex justify-between">
                      <span className="text-neutral-600">Fuerza de ventas comercial:</span>
                      <span className="font-bold text-neutral-900">{territoryComparison.advisorsCountA} asesores</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] font-mono text-neutral-500 uppercase block mb-1.5">
                      Mix de Planes Contratados
                    </span>
                    <div className="space-y-1 text-xs font-mono">
                      {territoryComparison.topPlansA.map((p, i) => (
                        <div key={i} className="flex justify-between text-neutral-700 pb-0.5 border-b border-neutral-100">
                          <span>{p.name}</span>
                          <span className="font-bold">{p.value} paquetes</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Territory B */}
                <div className="p-4 rounded-lg border border-neutral-200 bg-white space-y-4">
                  <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                    <h3 className="font-bold text-sm text-neutral-900">{territoryComparison.nameB}</h3>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-neutral-100 text-neutral-700">
                      {territoryType === "zona" ? "Zona B" : "Sector B"}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                    <div className="p-2 rounded bg-neutral-50 border border-neutral-100">
                      <span className="text-[10px] text-neutral-500 block">Instalaciones</span>
                      <strong className="text-base text-neutral-900">{formatNumber(territoryComparison.instalacionesB)}</strong>
                    </div>
                    <div className="p-2 rounded bg-neutral-50 border border-neutral-100">
                      <span className="text-[10px] text-neutral-500 block">Solicitudes</span>
                      <strong className="text-base text-neutral-900">{formatNumber(territoryComparison.solicitudesB)}</strong>
                    </div>
                    <div className="p-2 rounded bg-neutral-50 border border-neutral-100">
                      <span className="text-[10px] text-neutral-500 block">Efectividad</span>
                      <strong className="text-base text-emerald-600">{territoryComparison.efectividadB}%</strong>
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] font-mono text-neutral-500 uppercase block mb-1.5">
                      Asesores Activos en la Zona
                    </span>
                    <div className="p-2.5 rounded bg-neutral-50 border border-neutral-100 text-xs font-mono flex justify-between">
                      <span className="text-neutral-600">Fuerza de ventas comercial:</span>
                      <span className="font-bold text-neutral-900">{territoryComparison.advisorsCountB} asesores</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] font-mono text-neutral-500 uppercase block mb-1.5">
                      Mix de Planes Contratados
                    </span>
                    <div className="space-y-1 text-xs font-mono">
                      {territoryComparison.topPlansB.map((p, i) => (
                        <div key={i} className="flex justify-between text-neutral-700 pb-0.5 border-b border-neutral-100">
                          <span>{p.name}</span>
                          <span className="font-bold">{p.value} paquetes</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <footer className="h-12 border-t border-neutral-200 px-6 flex items-center justify-between text-[11px] font-mono text-neutral-500 bg-neutral-50/50 shrink-0">
          <span>Fuente de datos: CUADRO DIARIO & SOLICITUDES • Cálculos en memoria</span>
          <span>Presiona ESC para cerrar</span>
        </footer>
      </div>
    </div>
  );
}
