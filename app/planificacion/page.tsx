"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Menu,
  RotateCw,
  Search,
  X,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
} from "recharts";
import { Sidebar } from "@/components/dashboard/sidebar";
import { SidebarOpenButton } from "@/components/providers/sidebar-provider";
import {
  fetchPlanificacionData,
  fetchRawOperationalData,
  PlanificacionRecord,
  Solicitud,
  Installation,
  MONTH_ORDER,
} from "@/lib/dashboard-data";
import { AdvisorType, normalizeAdvisorName, classifyAdvisor } from "@/lib/normalization";
import { cn, formatNumber, formatProperCase } from "@/lib/utils";
import Link from "next/link";
import { useUser } from "@/components/providers/user-provider";
import { useModules } from "@/components/providers/modules-provider";

export interface EnrichedPlanRecord extends PlanificacionRecord {
  _normMes: string;
  _normAdv: string;
  _searchStr: string;
}

export interface EnrichedSolicitud extends Solicitud {
  _normMes: string;
  _normAdv: string;
  _searchStr: string;
}

export interface EnrichedInstallation extends Installation {
  _normMes: string;
  _normAdv: string;
  _searchStr: string;
}

// Normalizador estándar insensible a mayúsculas, tildes y espacios
const normKey = (str: string | null | undefined): string =>
  (str || "").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// Nombres cortos de meses para el eje X
const SHORT_MONTHS: Record<string, string> = {
  "01": "Ene",
  "02": "Feb",
  "03": "Mar",
  "04": "Abr",
  "05": "May",
  "06": "Jun",
  "07": "Jul",
  "08": "Ago",
  "09": "Sep",
  "10": "Oct",
  "11": "Nov",
  "12": "Dic",
  ENERO: "Ene",
  FEBRERO: "Feb",
  MARZO: "Mar",
  ABRIL: "Abr",
  MAYO: "May",
  JUNIO: "Jun",
  JULIO: "Jul",
  AGOSTO: "Ago",
  SEPTIEMBRE: "Sep",
  OCTUBRE: "Oct",
  NOVIEMBRE: "Nov",
  DICIEMBRE: "Dic",
};

// Formateador de fecha amigable para el eje X
const formatDateLabel = (dateStr: string): string => {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    const day = parts[2];
    const month = SHORT_MONTHS[parts[1]] || parts[1];
    return `${day} ${month}`;
  }
  return dateStr;
};

// Formateador completo para el tooltip
const formatFullDate = (dateStr: string): string => {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    const day = parseInt(parts[2], 10);
    const monthIdx = parseInt(parts[1], 10) - 1;
    const year = parts[0];
    const monthName = MONTH_ORDER[monthIdx] || parts[1];
    return `${day} de ${monthName.toLowerCase()} de ${year}`;
  }
  return dateStr;
};

type MetricType = "instalaciones" | "solicitudes";
type CategoryFilter = "all" | AdvisorType | "excolaborador";

const CATEGORY_TABS: { id: CategoryFilter; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "comercial", label: "Asesor comercial" },
  { id: "taquilla", label: "Taquilla" },
  { id: "externo", label: "Externo" },
  { id: "planificacion", label: "Planificación" },
  { id: "excolaborador", label: "Excolaboradores" },
  { id: "otro", label: "Otros" },
];

// Caché a nivel de cliente para transiciones instantáneas
let cachedPlan: EnrichedPlanRecord[] = [];
let cachedSols: EnrichedSolicitud[] = [];
let cachedInsts: EnrichedInstallation[] = [];
let hasLoadedData = false;

export default function PlanificacionPage() {
  const { user, isAdmin } = useUser();
  const { isModuleEnabledForUser } = useModules();
  const [mounted, setMounted] = useState(false);
  const [planData, setPlanData] = useState<EnrichedPlanRecord[]>(() => cachedPlan);
  const [solicitudes, setSolicitudes] = useState<EnrichedSolicitud[]>(() => cachedSols);
  const [installations, setInstallations] = useState<EnrichedInstallation[]>(() => cachedInsts);
  const [loading, setLoading] = useState(!hasLoadedData);
  const [refreshing, setRefreshing] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Estados de control interactivo
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");
  const [activeMetric, setActiveMetric] = useState<MetricType>("instalaciones");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedAdvisor, setSelectedAdvisor] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const loadData = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) setRefreshing(true);
    else if (!hasLoadedData) setLoading(true);

    try {
      const [recordsPlan, rawOperational] = await Promise.all([
        fetchPlanificacionData(forceRefresh),
        fetchRawOperationalData(undefined, undefined, undefined, undefined, forceRefresh),
      ]);

      const enrichedPlan: EnrichedPlanRecord[] = recordsPlan.map((d) => {
        const asesorStr = d.asesor || "";
        const mesStr = d.mes || "";
        return {
          ...d,
          _normMes: normKey(mesStr),
          _normAdv: normKey(asesorStr),
          _searchStr: `${asesorStr} ${d.sector || ""} ${d.estado || ""} ${d.fecha || ""}`.toLowerCase(),
        };
      });

      const rawSols = rawOperational?.solicitudes || [];
      const enrichedSols: EnrichedSolicitud[] = rawSols.map((s) => {
        const asesorStr = s.asesor || "";
        const mesStr = s.mes || "";
        return {
          ...s,
          _normMes: normKey(mesStr),
          _normAdv: normKey(asesorStr),
          _searchStr: `${asesorStr} ${s.sector || ""} ${s.municipio || ""} ${s.estado || ""} ${s.fecha || ""}`.toLowerCase(),
        };
      });

      const rawInsts = rawOperational?.installations || [];
      const enrichedInsts: EnrichedInstallation[] = rawInsts.map((i) => {
        const asesorStr = i.asesor || "";
        const mesStr = i.mes || "";
        return {
          ...i,
          _normMes: normKey(mesStr),
          _normAdv: normKey(asesorStr),
          _searchStr: `${asesorStr} ${i.sector || ""} ${i.zona || ""} ${i.estado || ""} ${i.fecha || ""}`.toLowerCase(),
        };
      });

      cachedPlan = enrichedPlan;
      cachedSols = enrichedSols;
      cachedInsts = enrichedInsts;
      hasLoadedData = true;

      setPlanData(enrichedPlan);
      setSolicitudes(enrichedSols);
      setInstallations(enrichedInsts);
    } catch (err) {
      console.error("Error al cargar datos operativos de planificación:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    loadData();
  }, [loadData]);

  // Lista de meses disponibles ordenada cronológicamente
  const availableMonths = useMemo(() => {
    const monthSet = new Set<string>();
    installations.forEach((i) => { if (i.mes) monthSet.add(formatProperCase(i.mes)); });
    solicitudes.forEach((s) => { if (s.mes) monthSet.add(formatProperCase(s.mes)); });
    return Array.from(monthSet).sort(
      (a, b) => MONTH_ORDER.indexOf(a) - MONTH_ORDER.indexOf(b)
    );
  }, [installations, solicitudes]);

  // ASESORES COMERCIALES ACTIVOS SEGÚN LA FECHA MÁS ACTUAL DE LA HOJA PLANIFICACIÓN ASESORES
  // ASESORES COMERCIALES ACTIVOS SEGÚN EL MES SELECCIONADO O LA FECHA MÁS ACTUAL
  const { activeCommercialAdvisors, activeCommercialCount, activeCommercialList } = useMemo(() => {
    const set = new Set<string>();
    const uniqueMap = new Map<string, string>();

    const allDates = Array.from(new Set(planData.map((d) => d.fecha).filter(Boolean))).sort();
    const globalMaxDate = allDates[allDates.length - 1]; // Fecha más reciente (2026-10-23)

    const isAll = selectedMonth === "all";
    const currentSpanishMonth = MONTH_ORDER[new Date().getMonth()] || "Noviembre";
    const isCurrentMonth = normKey(selectedMonth) === normKey(currentSpanishMonth) || normKey(selectedMonth) === "OCTUBRE";

    if (isAll || isCurrentMonth) {
      // En 'Todos los meses' o 'Octubre', los comerciales activos son estrictamente los 20 de la fecha más reciente (2026-10-23)
      planData.forEach((d) => {
        if (d.fecha === globalMaxDate) {
          const candidates = [d.asesor, d.raw_asesor].filter(Boolean) as string[];
          candidates.forEach((nameToUse) => {
            if (nameToUse && nameToUse.trim()) {
              const raw = nameToUse.trim().toUpperCase();
              const nk = normKey(nameToUse);
              if (
                nk &&
                nk !== "SIN ASESOR" &&
                nk !== "N/A" &&
                nk !== "DESCONOCIDO" &&
                !nk.includes("PLANIFICAC")
              ) {
                set.add(raw);
                set.add(nk);
              }
            }
          });

          const primaryName = d.asesor || d.raw_asesor;
          if (primaryName && primaryName.trim()) {
            const nk = normKey(primaryName);
            if (
              nk &&
              nk !== "SIN ASESOR" &&
              nk !== "N/A" &&
              nk !== "DESCONOCIDO" &&
              !nk.includes("PLANIFICAC")
            ) {
              if (!uniqueMap.has(nk)) {
                uniqueMap.set(nk, formatProperCase(primaryName.trim()));
              }
            }
          }
        }
      });
    } else {
      // Para un mes específico histórico:
      const inMonthPlan = planData.filter((d) => normKey(d.mes) === normKey(selectedMonth));
      if (inMonthPlan.length > 0) {
        // Obtenido de la hoja Planificación Asesores
        inMonthPlan.forEach((d) => {
          const candidates = [d.asesor, d.raw_asesor].filter(Boolean) as string[];
          candidates.forEach((nameToUse) => {
            if (nameToUse && nameToUse.trim()) {
              const raw = nameToUse.trim().toUpperCase();
              const nk = normKey(nameToUse);
              if (
                nk &&
                nk !== "SIN ASESOR" &&
                nk !== "N/A" &&
                nk !== "DESCONOCIDO" &&
                !nk.includes("PLANIFICAC")
              ) {
                set.add(raw);
                set.add(nk);
              }
            }
          });

          const primaryName = d.asesor || d.raw_asesor;
          if (primaryName && primaryName.trim()) {
            const nk = normKey(primaryName);
            if (
              nk &&
              nk !== "SIN ASESOR" &&
              nk !== "N/A" &&
              nk !== "DESCONOCIDO" &&
              !nk.includes("PLANIFICAC")
            ) {
              if (!uniqueMap.has(nk)) {
                uniqueMap.set(nk, formatProperCase(primaryName.trim()));
              }
            }
          }
        });
      } else {
        // Para meses anteriores a abril (Enero, Febrero, Marzo) desde Cuadro Diario y Solicitudes
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
  }, [planData, installations, solicitudes, selectedMonth]);

  // Determina si un asesor es excolaborador:
  // Regla estricta: los 20 de la fecha más actual son comerciales activos;
  // TODO el resto de asesores en la lista deben tomarse como excolaboradores
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

      // Si está en los 20 comerciales activos de la fecha más actual, NO es excolaborador
      if (activeCommercialAdvisors.has(raw) || activeCommercialAdvisors.has(nk)) {
        return false;
      }

      // Si pertenece explícitamente a taquilla, externo o planificación, va en su respectiva categoría
      if (tipo_asesor === "taquilla" || tipo_asesor === "externo" || tipo_asesor === "planificacion") {
        return false;
      }

      const normCanal = normKey(canal);
      if (normCanal.includes("TAQUILL") || nk.includes("TAQUILL")) return false;
      if (normCanal.includes("EXTERNO") || nk.includes("EXTERNO")) return false;
      if (normCanal.includes("PLANIFICAC") || nk.includes("PLANIFICAC")) return false;

      // El resto de asesores en la lista se toma estrictamente como excolaborador
      return true;
    },
    [activeCommercialAdvisors]
  );

  // Filtro de coincidencia por categoría de emisor
  const isMatchCategory = useCallback(
    (item: { tipo_asesor?: AdvisorType; canal?: string; asesor?: string }, category: CategoryFilter): boolean => {
      if (category === "all") return true;

      // Regla estricta: los asesores comerciales activos son los 20 de la fecha más actual de la hoja Planificación Asesores
      if (category === "comercial") {
        if (!item.asesor) return false;
        const raw = item.asesor.trim().toUpperCase();
        const nk = normKey(item.asesor);
        return activeCommercialAdvisors.has(raw) || activeCommercialAdvisors.has(nk);
      }

      if (category === "excolaborador") {
        return isAdvisorExColaborador(item.asesor, item.canal, item.tipo_asesor);
      }

      const normCanal = normKey(item.canal);
      const normAdv = normKey(item.asesor);

      if (category === "taquilla") {
        return normCanal.includes("TAQUILL") || normAdv.includes("TAQUILL") || item.tipo_asesor === "taquilla";
      }
      if (category === "externo") {
        return normCanal.includes("EXTERNO") || normAdv.includes("EXTERNO") || item.tipo_asesor === "externo";
      }
      if (category === "planificacion") {
        return normCanal.includes("PLANIFICAC") || normAdv.includes("PLANIFICAC") || item.tipo_asesor === "planificacion";
      }
      if (category === "otro") {
        return item.tipo_asesor === "otro";
      }
      return false;
    },
    [activeCommercialAdvisors, isAdvisorExColaborador]
  );

  // CONTADOR DE PERSONAL ÚNICO POR CATEGORÍA
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

    const registerOtherCategories = (items: { asesor?: string; raw_asesor?: string; tipo_asesor?: AdvisorType; canal?: string; mes?: string }[]) => {
      items.forEach((item) => {
        if (selectedMonth !== "all" && normKey(item.mes) !== normKey(selectedMonth)) return;
        const nameToUse = item.raw_asesor || item.asesor;
        if (!nameToUse) return;
        const cleanName = nameToUse.trim();
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

        // Si es comercial activo, ya está contabilizado en counts.comercial
        if (activeCommercialAdvisors.has(raw) || activeCommercialAdvisors.has(nk)) {
          return;
        }

        const normCanal = normKey(item.canal);
        if (normCanal.includes("TAQUILL") || nk.includes("TAQUILL") || item.tipo_asesor === "taquilla") {
          taquillaSet.add(nk);
        } else if (normCanal.includes("EXTERNO") || nk.includes("EXTERNO") || item.tipo_asesor === "externo") {
          externoSet.add(nk);
        } else if (normCanal.includes("PLANIFICAC") || nk.includes("PLANIFICAC") || item.tipo_asesor === "planificacion") {
          planificacionSet.add(nk);
        } else if (isAdvisorExColaborador(cleanName, item.canal, item.tipo_asesor)) {
          excolaboradorSet.add(nk);
        } else if (item.tipo_asesor === "otro") {
          otroSet.add(nk);
        }
      });
    };

    registerOtherCategories(planData);
    registerOtherCategories(installations);
    registerOtherCategories(solicitudes);

    counts.taquilla = taquillaSet.size;
    counts.externo = externoSet.size;
    counts.planificacion = planificacionSet.size;
    counts.excolaborador = excolaboradorSet.size;
    counts.otro = otroSet.size;

    counts.all = counts.comercial + counts.taquilla + counts.externo + counts.planificacion + counts.excolaborador + counts.otro;

    return counts;
  }, [activeCommercialCount, activeCommercialAdvisors, isAdvisorExColaborador, planData, installations, solicitudes, selectedMonth]);

  // Filtrado de instalaciones
  const filteredInstallations = useMemo(() => {
    return installations.filter((item) => {
      if (!isMatchCategory(item, activeCategory)) return false;
      if (selectedMonth !== "all" && normKey(item.mes) !== normKey(selectedMonth)) return false;
      if (selectedAdvisor && normKey(item.asesor) !== normKey(selectedAdvisor)) return false;
      if (searchTerm.trim() && !item._searchStr.includes(searchTerm.toLowerCase().trim())) return false;
      return true;
    });
  }, [installations, activeCategory, selectedMonth, selectedAdvisor, searchTerm, isMatchCategory]);

  // Filtrado de solicitudes
  const filteredSolicitudes = useMemo(() => {
    return solicitudes.filter((item) => {
      if (!isMatchCategory(item, activeCategory)) return false;
      if (selectedMonth !== "all" && normKey(item.mes) !== normKey(selectedMonth)) return false;
      if (selectedAdvisor && normKey(item.asesor) !== normKey(selectedAdvisor)) return false;
      if (searchTerm.trim() && !item._searchStr.includes(searchTerm.toLowerCase().trim())) return false;
      return true;
    });
  }, [solicitudes, activeCategory, selectedMonth, selectedAdvisor, searchTerm, isMatchCategory]);

  // Construcción de la línea de tiempo cronológica para Recharts
  const timelineData = useMemo(() => {
    const activeData = activeMetric === "instalaciones" ? filteredInstallations : filteredSolicitudes;
    const secondaryData = activeMetric === "instalaciones" ? filteredSolicitudes : filteredInstallations;

    const dateMap = new Map<
      string,
      {
        dateKey: string;
        dateLabel: string;
        fullDate: string;
        value: number;
        instalaciones: number;
        solicitudes: number;
        advisors: Record<string, number>;
      }
    >();

    activeData.forEach((item) => {
      if (!item.fecha) return;
      const key = item.fecha.trim();
      if (!dateMap.has(key)) {
        dateMap.set(key, {
          dateKey: key,
          dateLabel: formatDateLabel(key),
          fullDate: formatFullDate(key),
          value: 0,
          instalaciones: 0,
          solicitudes: 0,
          advisors: {},
        });
      }
      const entry = dateMap.get(key)!;
      entry.value += 1;
      if (activeMetric === "instalaciones") {
        entry.instalaciones += 1;
      } else {
        entry.solicitudes += 1;
      }

      const advName = item.asesor ? formatProperCase(item.asesor) : "Sin asesor";
      entry.advisors[advName] = (entry.advisors[advName] || 0) + 1;
    });

    secondaryData.forEach((item) => {
      if (!item.fecha) return;
      const key = item.fecha.trim();
      if (dateMap.has(key)) {
        const entry = dateMap.get(key)!;
        if (activeMetric === "instalaciones") {
          entry.solicitudes += 1;
        } else {
          entry.instalaciones += 1;
        }
      }
    });

    return Array.from(dateMap.values()).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  }, [activeMetric, filteredInstallations, filteredSolicitudes]);

  // Resumen estadístico
  const summaryStats = useMemo(() => {
    const totalPrimary = activeMetric === "instalaciones" ? filteredInstallations.length : filteredSolicitudes.length;
    const totalDays = timelineData.length;
    const dailyAverage = totalDays > 0 ? (totalPrimary / totalDays).toFixed(1) : "0.0";

    let maxDayCount = 0;
    let maxDayLabel = "-";
    timelineData.forEach((d) => {
      if (d.value > maxDayCount) {
        maxDayCount = d.value;
        maxDayLabel = d.dateLabel;
      }
    });

    // Personal activo en el filtro
    const activeAdvisorsSet = new Set<string>();
    const dataset = activeMetric === "instalaciones" ? filteredInstallations : filteredSolicitudes;
    dataset.forEach((item) => {
      if (item.asesor && item.asesor !== "Sin Asesor" && item.asesor !== "N/A") {
        activeAdvisorsSet.add(normKey(item.asesor));
      }
    });

    return {
      totalPrimary,
      totalDays,
      dailyAverage,
      maxDayCount,
      maxDayLabel,
      uniqueAdvisorsCount: selectedAdvisor
        ? 1
        : (personnelCounts[activeCategory] || activeAdvisorsSet.size),
    };
  }, [activeMetric, filteredInstallations, filteredSolicitudes, timelineData, personnelCounts, activeCategory, selectedAdvisor]);

  // Desglose por asesor dentro del filtro
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

    // Si la categoría es comercial o todos, precargamos los 20 asesores comerciales activos
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

    filteredInstallations.forEach((i) => {
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

    filteredSolicitudes.forEach((s) => {
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
    if (selectedAdvisor) {
      const targetNk = normKey(selectedAdvisor);
      list = list.filter((a) => a.normName === targetNk || normKey(a.name) === targetNk);
    } else {
      if (activeCategory === "comercial") {
        list = list.filter((a) => a.isActiveCommercial);
      } else if (activeCategory === "excolaborador") {
        list = list.filter((a) => a.isEx);
      }
    }

    return list.sort((a, b) => {
      if (activeMetric === "instalaciones") {
        if (b.instalaciones !== a.instalaciones) return b.instalaciones - a.instalaciones;
        return b.solicitudes - a.solicitudes;
      }
      if (b.solicitudes !== a.solicitudes) return b.solicitudes - a.solicitudes;
      return b.instalaciones - a.instalaciones;
    });
  }, [
    filteredInstallations,
    filteredSolicitudes,
    activeMetric,
    activeCategory,
    activeCommercialList,
    activeCommercialAdvisors,
    isAdvisorExColaborador,
    selectedAdvisor,
  ]);

  // Tooltip personalizado para Recharts
  const CustomRechartTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      const topAdvEntries = Object.entries(dataPoint.advisors || {})
        .sort((a: any, b: any) => b[1] - a[1])
        .slice(0, 3);

      return (
        <div className="bg-neutral-900 text-white p-3 rounded-lg shadow-xl text-xs min-w-[220px] border border-neutral-800">
          <p className="text-neutral-400 font-mono text-[11px] mb-2 pb-1.5 border-b border-neutral-800">
            {dataPoint.fullDate}
          </p>

          <div className="flex justify-between items-baseline mb-1">
            <span className="text-neutral-300 font-medium">
              {activeMetric === "instalaciones" ? "Instalaciones realizadas" : "Solicitudes enviadas"}:
            </span>
            <span
              className={cn(
                "font-bold text-sm font-mono",
                activeMetric === "instalaciones" ? "text-emerald-400" : "text-sky-400"
              )}
            >
              {formatNumber(dataPoint.value)}
            </span>
          </div>

          <div className="flex justify-between items-baseline text-[11px] text-neutral-400 mb-2">
            <span>
              {activeMetric === "instalaciones" ? "Solicitudes captadas" : "Instalaciones correspondientes"}:
            </span>
            <span className="font-mono text-neutral-200">
              {formatNumber(activeMetric === "instalaciones" ? dataPoint.solicitudes : dataPoint.instalaciones)}
            </span>
          </div>

          {topAdvEntries.length > 0 && (
            <div className="pt-2 border-t border-neutral-800 mt-2">
              <span className="text-[10px] text-neutral-400 font-mono block mb-1">
                Principales emisores del día:
              </span>
              <div className="space-y-0.5">
                {topAdvEntries.map(([name, count]) => (
                  <div key={name} className="flex justify-between text-[11px]">
                    <span className="text-neutral-300 truncate max-w-[150px]">{name}</span>
                    <span className="font-mono text-neutral-400">{String(count)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  if (!mounted) {
    return null;
  }

  // Restricción para usuarios no administradores cuando el módulo está desactivado
  if (user && !isAdmin && !isModuleEnabledForUser("planificacion", false)) {
    return (
      <div className="flex min-h-screen bg-[#FDFDFD] text-[#09090B]">
        <Sidebar activeSection="planificacion" />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="max-w-md space-y-3">
            <h1 className="text-lg font-bold text-neutral-900 font-sans">
              Panel en preparación
            </h1>
            <p className="text-xs text-neutral-500 font-sans leading-relaxed">
              El panel de Planificación Comercial no está disponible actualmente para usuarios generales.
            </p>
            <div className="pt-2">
              <Link
                href="/"
                className="text-xs font-medium text-neutral-900 hover:text-neutral-600 transition-colors cursor-pointer"
              >
                Volver a la Página Principal
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#FDFDFD] text-neutral-900 font-sans antialiased selection:bg-neutral-900 selection:text-white">
      {/* Barra lateral */}
      <Sidebar
        isMobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        activeSection="planificacion"
      />

      {/* Contenedor principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Encabezado limpio */}
        <header className="sticky top-0 z-20 h-12 bg-white border-b border-neutral-200/80 px-3 sm:px-6 flex items-center justify-between select-none">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="xl:hidden -ml-2 min-w-[44px] min-h-[44px] p-2.5 text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer flex items-center justify-center"
              title="Abrir menú"
              aria-label="Abrir menú"
            >
              <Menu className="w-4 h-4 stroke-[1.75]" />
            </button>
            <SidebarOpenButton />
          </div>

          <div className="flex items-center">
            <span className="text-xs sm:text-sm font-normal text-neutral-700 tracking-tight font-sans">
              Planificación comercial
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1.5 text-xs text-neutral-500 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="hidden sm:inline">
                {loading
                  ? "Sincronizando..."
                  : `${formatNumber(installations.length)} inst. • ${formatNumber(solicitudes.length)} sols.`}
              </span>
            </div>

            <button
              onClick={() => loadData(true)}
              disabled={refreshing || loading}
              className="min-w-[44px] min-h-[44px] p-2.5 text-neutral-400 hover:text-neutral-900 transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center -mr-2"
              title="Sincronizar con Google Sheets"
              aria-label="Sincronizar"
            >
              <RotateCw className={cn("w-3.5 h-3.5 stroke-[1.75]", (refreshing || loading) && "animate-spin")} />
            </button>
          </div>
        </header>

        {/* Cuerpo del contenido (Totalmente abierto, sin recuadros ni cajas envolventes) */}
        <main className="flex-1 p-3 sm:p-6 lg:p-8 pb-20 xl:pb-8 max-w-7xl w-full mx-auto space-y-5 sm:space-y-6">
          {/* Fila 1: Selector de Categorías (con contador de personal) y Alternador de Métrica */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 border-b border-neutral-200/70 pb-3">
            {/* Categorías con contador de personal */}
            <div className="overflow-x-auto no-scrollbar scroll-smooth whitespace-nowrap -mx-3 px-3 sm:mx-0 sm:px-0 flex items-center gap-x-4 py-1 text-xs">
              {CATEGORY_TABS.filter((tab) => tab.id !== "otro" || (personnelCounts[tab.id] || 0) > 0).map((tab) => {
                const isSelected = activeCategory === tab.id;
                const personalCount = personnelCounts[tab.id] || 0;

                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveCategory(tab.id);
                      setSelectedAdvisor(null);
                    }}
                    className={cn(
                      "min-h-[40px] inline-flex items-center transition-colors cursor-pointer pb-1",
                      isSelected
                        ? "text-neutral-950 font-bold border-b-2 border-neutral-950 -mb-[1px]"
                        : "text-neutral-400 hover:text-neutral-800"
                    )}
                  >
                    <span>{tab.label}</span>
                    <span className="ml-1 text-[11px] font-mono font-normal text-neutral-400">
                      ({personalCount})
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Alternador de Métrica: Instalación (Prioridad) vs Solicitudes Enviadas */}
            <div className="flex items-center gap-4 sm:gap-5 text-xs shrink-0 self-start lg:self-auto overflow-x-auto no-scrollbar">
              <button
                onClick={() => setActiveMetric("instalaciones")}
                className={cn(
                  "min-h-[40px] inline-flex items-center transition-colors cursor-pointer pb-1",
                  activeMetric === "instalaciones"
                    ? "text-neutral-950 font-bold border-b-2 border-neutral-950 -mb-[1px]"
                    : "text-neutral-400 hover:text-neutral-800"
                )}
              >
                <span>Instalación</span>
                <span className="ml-1 text-[10px] font-mono text-neutral-400 font-normal">
                  (Prioridad)
                </span>
              </button>

              <button
                onClick={() => setActiveMetric("solicitudes")}
                className={cn(
                  "min-h-[40px] inline-flex items-center transition-colors cursor-pointer pb-1",
                  activeMetric === "solicitudes"
                    ? "text-neutral-950 font-bold border-b-2 border-neutral-950 -mb-[1px]"
                    : "text-neutral-400 hover:text-neutral-800"
                )}
              >
                <span>Solicitudes enviadas</span>
              </button>
            </div>
          </div>

          {/* Fila 2: Filtro de Mes y Búsqueda contextual */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            {/* Selector tipográfico de meses */}
            <div className="overflow-x-auto no-scrollbar scroll-smooth whitespace-nowrap -mx-3 px-3 sm:mx-0 sm:px-0 flex items-center gap-x-2 py-1">
              <button
                onClick={() => setSelectedMonth("all")}
                className={cn(
                  "min-h-[36px] inline-flex items-center px-1.5 py-0.5 transition-colors cursor-pointer whitespace-nowrap",
                  selectedMonth === "all"
                    ? "text-neutral-950 font-bold border-b border-neutral-900"
                    : "text-neutral-400 hover:text-neutral-800"
                )}
              >
                Todos los meses
              </button>

              {availableMonths.map((m) => {
                const isSel = selectedMonth === m;
                return (
                  <button
                    key={m}
                    onClick={() => setSelectedMonth(m)}
                    className={cn(
                      "min-h-[36px] inline-flex items-center px-1.5 py-0.5 transition-colors cursor-pointer whitespace-nowrap",
                      isSel
                        ? "text-neutral-950 font-bold border-b border-neutral-900"
                        : "text-neutral-400 hover:text-neutral-800"
                    )}
                  >
                    {m}
                  </button>
                );
              })}
            </div>

            {/* Búsqueda de emisor o término */}
            <div className="flex items-center gap-2 text-xs text-neutral-500 w-full sm:w-auto sm:ml-auto">
              <Search className="w-3.5 h-3.5 stroke-[1.5] text-neutral-400 shrink-0" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar en este filtro..."
                className="bg-transparent border-b border-neutral-200 focus:border-neutral-900 py-1.5 text-sm sm:text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none w-full sm:w-56 transition-colors"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="min-w-[36px] min-h-[36px] p-2 text-neutral-400 hover:text-neutral-900 cursor-pointer flex items-center justify-center shrink-0"
                  title="Borrar búsqueda"
                  aria-label="Borrar búsqueda"
                >
                  <X className="w-3.5 h-3.5 stroke-[1.5]" />
                </button>
              )}
            </div>
          </div>

          {/* Indicador de filtro activo por asesor (Limpio, sin recuadro ni caja de alerta) */}
          {selectedAdvisor && (
            <div className="flex items-center gap-2 text-xs text-neutral-600 py-1.5 border-b border-neutral-100">
              <span className="text-neutral-400">Filtrando por asesor:</span>
              <strong className="text-neutral-900 font-semibold">{formatProperCase(selectedAdvisor)}</strong>
              <button
                onClick={() => setSelectedAdvisor(null)}
                className="ml-auto text-xs text-neutral-400 hover:text-neutral-900 cursor-pointer flex items-center gap-1 transition-colors"
                title="Quitar filtro de asesor"
              >
                <span>Mostrar todos los asesores</span>
                <X className="w-3 h-3 stroke-[1.5]" />
              </button>
            </div>
          )}

          {/* Fila 3: Métricas resumidas abiertas */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 py-4 border-y border-neutral-100">
            <div>
              <span className="text-[11px] text-neutral-500 font-medium">
                {activeMetric === "instalaciones" ? "Total instalaciones" : "Total solicitudes enviadas"}
              </span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-bold tracking-tight text-neutral-900">
                  {formatNumber(summaryStats.totalPrimary)}
                </span>
                <span className="text-[10px] font-mono text-neutral-400">
                  {activeMetric === "instalaciones" ? "clientes activos" : "solicitudes"}
                </span>
              </div>
            </div>

            <div>
              <span className="text-[11px] text-neutral-500 font-medium">
                Promedio diario
              </span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-bold tracking-tight text-neutral-900">
                  {summaryStats.dailyAverage}
                </span>
                <span className="text-[10px] font-mono text-neutral-400">por día activo</span>
              </div>
            </div>

            <div>
              <span className="text-[11px] text-neutral-500 font-medium">
                Pico en un día
              </span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-bold tracking-tight text-neutral-900">
                  {summaryStats.maxDayCount}
                </span>
                <span className="text-[10px] font-mono text-neutral-400">
                  ({summaryStats.maxDayLabel})
                </span>
              </div>
            </div>

            <div>
              <span className="text-[11px] text-neutral-500 font-medium">
                {activeCategory === "excolaborador" ? "Excolaboradores" : "Personal activo"}
              </span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-bold tracking-tight text-neutral-900">
                  {summaryStats.uniqueAdvisorsCount}
                </span>
                <span className="text-[10px] font-mono text-neutral-400">en este filtro</span>
              </div>
            </div>
          </div>

          {/* Fila 4: RECHART INTERACTIVO DE LA LÍNEA DE TIEMPO (Sin recuadro) */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-900">
                Línea de tiempo cronológica ({timelineData.length} días registrados)
              </span>
              <span className="text-[11px] font-mono text-neutral-400">
                {activeMetric === "instalaciones" ? "Evolución de instalaciones" : "Evolución de solicitudes"}
              </span>
            </div>

            {timelineData.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-xs text-neutral-400">
                <span>No hay registros para este filtro y período.</span>
              </div>
            ) : (
              <div className="h-72 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={timelineData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="metricGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor={activeMetric === "instalaciones" ? "#10B981" : "#0284C7"}
                          stopOpacity={0.25}
                        />
                        <stop
                          offset="95%"
                          stopColor={activeMetric === "instalaciones" ? "#10B981" : "#0284C7"}
                          stopOpacity={0.0}
                        />
                      </linearGradient>
                    </defs>

                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#F3F4F6"
                    />

                    <XAxis
                      dataKey="dateLabel"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 10, fill: "#9CA3AF" }}
                      interval="preserveStartEnd"
                      minTickGap={24}
                    />

                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 10, fill: "#9CA3AF" }}
                      allowDecimals={false}
                    />

                    <RechartsTooltip content={<CustomRechartTooltip />} />

                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke={activeMetric === "instalaciones" ? "#059669" : "#0284C7"}
                      strokeWidth={2}
                      fill="url(#metricGradient)"
                      isAnimationActive={false}
                      activeDot={{
                        r: 5,
                        strokeWidth: 2,
                        stroke: "#FFFFFF",
                        fill: activeMetric === "instalaciones" ? "#059669" : "#0284C7",
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Fila 5: Desglose de Emisores/Personal (Abierto, sin recuadros) */}
          <div className="space-y-3 pt-6 border-t border-neutral-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-900">
                Desglose de personal en este filtro ({advisorBreakdown.length})
              </span>
              <span className="text-[11px] font-mono text-neutral-400">
                Haz clic sobre un asesor para aislar su línea de tiempo
              </span>
            </div>

            <div className="divide-y divide-neutral-100/70 max-h-72 overflow-y-auto pr-1">
              {advisorBreakdown.map((adv, idx) => {
                const isSelected = selectedAdvisor && normKey(selectedAdvisor) === adv.normName;

                return (
                  <div
                    key={adv.normName}
                    onClick={() => {
                      setSelectedAdvisor((prev) =>
                        prev && normKey(prev) === adv.normName ? null : adv.name
                      );
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

                    <div className="flex items-center gap-5 shrink-0 font-mono text-right">
                      <div>
                        <span className="text-[10px] text-neutral-400 block font-sans">
                          Instalaciones
                        </span>
                        <span
                          className={cn(
                            "text-xs font-semibold",
                            activeMetric === "instalaciones" ? "text-emerald-600" : "text-neutral-600"
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
                            activeMetric === "solicitudes" ? "text-sky-600" : "text-neutral-600"
                          )}
                        >
                          {formatNumber(adv.solicitudes)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
