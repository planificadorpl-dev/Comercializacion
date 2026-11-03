import { formatProperCase, isInstalacionStatus, isNuevoServicioStatus } from "@/lib/utils";
import { normalizeLocation, CanonicalLocationResult } from "@/lib/geo_normalization";
import {
    AdvisorType,
    AdvisorOverridesMap,
    AdvisorCustomConfig,
    TechnicianOverridesMap,
    TechnicianCustomConfig,
    MemberStatus,
    StaffDepartment,
    normalizeAdvisorName,
    classifyAdvisor,
    resolveAdvisorOffice,
    isAdvisorExCollaborator,
    normalizeTechnician,
    isTechnicianExCollaborator,
    findTechnicianOverride,
} from "@/lib/normalization";

export type {
    AdvisorType,
    AdvisorOverridesMap,
    AdvisorCustomConfig,
    TechnicianOverridesMap,
    TechnicianCustomConfig,
    MemberStatus,
    StaffDepartment,
};

// Types
export interface MetricData {
    name: string;
    value: number;
    [key: string]: any;
}

export interface Installation {
    id: number;
    created_at?: string;
    fecha: string; // YYYY-MM-DD
    mes: string;
    tecnico_1: string;
    tecnico_2: string | null;
    router: string | null;
    nombre_cliente: string;
    cedula: string;
    zona: string;
    sector: string;
    asesor: string;
    tipo_asesor: AdvisorType;
    es_ex_colaborador?: boolean;
    sede_taquilla?: string;
    equipo?: string;
    estatus: string;
    plan: string;
    power_go: string; // "SI" | "NO"
    servicio: string;
    oficina: string;  // Calculado: OFICINA_MAP[asesor] || "OTROS"
    estado: string | null;  // Calculado: zona → MIRANDA/ARAGUA/D.C.
    municipio?: string;
    parroquia?: string;
    subsector?: string;
}

export interface Solicitud {
    id: number;
    created_at?: string;
    fecha: string; // YYYY-MM-DD
    mes: string;
    asesor: string; // Asesor Normalizado
    tipo_asesor: AdvisorType;
    es_ex_colaborador?: boolean;
    sede_taquilla?: string;
    canal?: string;
    fuente?: string;
    estatus: string; // "Instalado" | "Pendiente"
    nombre_cliente: string;
    cedula: string;
    plan: string;
    tipo_operacion: string;
    power_go: string;
    estado: string;
    municipio: string;
    zona: string;
    sector: string;
    ubicacion?: string;
    parroquia?: string;
    subsector?: string;
}

export interface MetricChart {
    name: string;
    value: number;
    installed?: number;
    fill?: string;
    history?: number[];
    tipo_asesor?: AdvisorType;
    es_ex_colaborador?: boolean;
    sede_taquilla?: string;
    equipo?: string;
}

export interface DetailedDailyMetric {
    name: string;
    fullDate: string;
    instalaciones: number; // 100% instalaciones realizadas de CUADRO DIARIO
    solicitudes: number;   // 100% solicitudes de clientes de SOLICITUDES
    asesor_top: string;
    sector_principal: string;
}

export interface DashboardMetrics {
    counters: {
        totalInstalaciones: number;
        totalSolicitudes: number;
        powerGoCount: number;
        maxVentas: number;
        topAsesor: string;
        routerCount: number;
        nuevosServicios: number;
        diasLaborados: number;
        solicitudesInstaladas: number;
        tasaEfectividad: number;
    };
    trend: {
        percentageChange: number;
    };
    charts: {
        byMonth: MetricChart[];
        byDay: MetricChart[];
        detailedByDay: DetailedDailyMetric[];
        byStatus: MetricChart[];
        byService: MetricChart[];
        byPlan: MetricChart[];
        byZone: MetricChart[];
        byAdvisor: MetricChart[];
        byTechnician: MetricChart[];
        bySector: MetricChart[];
        byOficina: MetricChart[];
        byEstado: MetricChart[];
    };
    raw: Installation[];
    rawSolicitudes: Solicitud[];
}

export const MONTH_ORDER = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

export function getCurrentSpanishMonth(): string {
    const currentMonthIdx = new Date().getMonth();
    return MONTH_ORDER[currentMonthIdx] || "Noviembre";
}

export function getMonthIndex(month: string): number {
    const norm = String(month || "").trim().toUpperCase();
    const idx = MONTH_ORDER.findIndex(m => m.toUpperCase() === norm);
    return idx >= 0 ? idx : 999;
}

// Client-side cache to make tab-switching 100% instant (0ms delay)
let clientCachedData: {
    instRaw: any[];
    solRaw: any[];
    timestamp: number;
} | null = null;

let clientCachedProcessedOps: {
    installations: Installation[];
    solicitudes: Solicitud[];
    timestamp: number;
} | null = null;

const CLIENT_CACHE_TTL = 15 * 60 * 1000; // 15 minutes
const LOCAL_STORAGE_PLAN_KEY = "comercializacion_cache_planificacion_v4";

export function clearDashboardDataCache() {
    clientCachedData = null;
    clientCachedProcessedOps = null;
    clientCachedPlanificacion = null;
    if (typeof window !== "undefined") {
        try {
            localStorage.removeItem("comercializacion_cache_planificacion_v1");
            localStorage.removeItem("comercializacion_cache_planificacion_v2");
            localStorage.removeItem("comercializacion_cache_planificacion_v3");
            localStorage.removeItem(LOCAL_STORAGE_PLAN_KEY);
        } catch (_) {}
    }
}

export function getCachedOperationalData(): { installations: Installation[]; solicitudes: Solicitud[] } | null {
    if (clientCachedProcessedOps && (Date.now() - clientCachedProcessedOps.timestamp < CLIENT_CACHE_TTL)) {
        return {
            installations: clientCachedProcessedOps.installations,
            solicitudes: clientCachedProcessedOps.solicitudes,
        };
    }
    return null;
}

export function getCachedPlanificacionData(): PlanificacionRecord[] | null {
    if (clientCachedPlanificacion && Array.isArray(clientCachedPlanificacion.data) && clientCachedPlanificacion.data.length > 0) {
        return clientCachedPlanificacion.data;
    }
    if (typeof window !== "undefined") {
        try {
            const rawStored = localStorage.getItem(LOCAL_STORAGE_PLAN_KEY);
            if (rawStored) {
                const parsed = JSON.parse(rawStored);
                if (parsed && Array.isArray(parsed.data) && parsed.data.length > 0) {
                    clientCachedPlanificacion = {
                        data: parsed.data,
                        timestamp: parsed.timestamp || Date.now(),
                    };
                    return parsed.data;
                }
            }
        } catch (_) {}
    }
    return null;
}

export async function fetchRawOperationalData(
    customOverrides?: AdvisorOverridesMap,
    customAliases?: Record<string, string>,
    customTechOverrides?: TechnicianOverridesMap,
    customTechAliases?: Record<string, string>,
    forceRefresh: boolean = false
): Promise<{
    installations: Installation[];
    solicitudes: Solicitud[];
    activeTechOverrides: TechnicianOverridesMap;
}> {
    const now = Date.now();
    const hasValidClientCache = !forceRefresh && clientCachedData && (now - clientCachedData.timestamp < CLIENT_CACHE_TTL);

    let instRaw: any[] = [];
    let solRaw: any[] = [];
    let resOverrides: any = null;

    if (hasValidClientCache && clientCachedData) {
        instRaw = clientCachedData.instRaw;
        solRaw = clientCachedData.solRaw;
        if (!customOverrides || !customAliases || !customTechOverrides || !customTechAliases) {
            resOverrides = await fetch(`/api/advisors/config?t=${Date.now()}`, {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache' }
            }).then((r) => r.json()).catch(() => null);
        }
    } else {
        const refreshParam = forceRefresh ? '&refresh=true' : '';
        const [resInst, resSol, overridesResult] = await Promise.all([
            fetch(`/api/sheets?spreadsheetId=1rAV3gl6BWKRnXuC8IO6e7r2yPaEnWmuAOW_gyic5RiQ&sheetName=CUADRO DIARIO${refreshParam}`),
            fetch(`/api/sheets?spreadsheetId=1UZvhPyYhw8NV-_wwPESWQiGfqnwkASABr4JSBPRJoUw&sheetName=SOLICITUDES${refreshParam}`),
            (!customOverrides || !customAliases || !customTechOverrides || !customTechAliases)
                ? fetch(`/api/advisors/config?t=${Date.now()}`, {
                    cache: 'no-store',
                    headers: { 'Cache-Control': 'no-cache' }
                }).then((r) => r.json()).catch(() => null)
                : Promise.resolve(null),
        ]);

        const jsonInst = resInst && resInst.ok
            ? await resInst.json().catch(() => ({ success: false, data: [] }))
            : { success: false, data: [] };
        const jsonSol = resSol && resSol.ok
            ? await resSol.json().catch(() => ({ success: false, data: [] }))
            : { success: false, data: [] };

        instRaw = jsonInst.success ? jsonInst.data || [] : [];
        solRaw = jsonSol.success ? jsonSol.data || [] : [];
        resOverrides = overridesResult;

        // Cache data in client memory
        clientCachedData = {
            instRaw,
            solRaw,
            timestamp: now,
        };
    }

    const activeOverrides: AdvisorOverridesMap = customOverrides || resOverrides?.overrides || {};
    const activeAliases: Record<string, string> = customAliases || resOverrides?.aliases || {};
    const activeTechOverrides: TechnicianOverridesMap = customTechOverrides || resOverrides?.technicianOverrides || {};
    const activeTechAliases: Record<string, string> = customTechAliases || resOverrides?.technicianAliases || {};

    // Parse and title-case all fields from raw Google Sheets data (CUADRO DIARIO)
    const clientToCanonicalLocationMap = new Map<string, CanonicalLocationResult>();

    const formattedInstallations: Installation[] = instRaw
        .filter((item: any) => {
            const hasFecha = item.fecha && String(item.fecha).trim() !== "" && String(item.fecha).toUpperCase() !== "FECHA";
            const hasEstatus = item.estatus && String(item.estatus).trim() !== "";
            const hasClientOrCedula = (item.nombre_cliente && String(item.nombre_cliente).trim() !== "") || (item.cedula && String(item.cedula).trim() !== "");
            return hasFecha && hasEstatus && hasClientOrCedula;
        })
        .map((item: any) => {
            const normAdvisor = normalizeAdvisorName(item.asesor, activeAliases);
            const advisorType = classifyAdvisor(normAdvisor, activeOverrides);
            const sedeTaquilla = resolveAdvisorOffice(normAdvisor, activeOverrides);
            const isEx = isAdvisorExCollaborator(normAdvisor, activeOverrides);
            const normTech1 = normalizeTechnician(item.tecnico_1, activeTechOverrides, activeTechAliases);
            const normTech2 = normalizeTechnician(item.tecnico_2, activeTechOverrides, activeTechAliases);

            // Normalización territorial estricta desde el Padrón del Cuadro Diario
            const loc = normalizeLocation({
                sector: item.sector,
                zona: item.zona,
                estado: item.estado,
            });

            // Registrar en el puente determinístico por cédula limpia (solo dígitos)
            if (item.cedula) {
                const cleanCed = String(item.cedula).replace(/[^0-9]/g, "");
                if (cleanCed) {
                    clientToCanonicalLocationMap.set(cleanCed, loc);
                }
            }

            return {
                ...item,
                mes: formatProperCase(item.mes),
                zona: loc.zona,
                sector: loc.sector,
                subsector: loc.subsector,
                municipio: loc.municipio,
                parroquia: loc.parroquia,
                estado: loc.estado,
                asesor: normAdvisor,
                tipo_asesor: advisorType,
                es_ex_colaborador: isEx,
                sede_taquilla: sedeTaquilla,
                equipo: item.equipo || normTech1.team || "",
                tecnico_1: normTech1.name,
                tecnico_2: normTech2.name || null,
                nombre_cliente: formatProperCase(item.nombre_cliente),
                estatus: formatProperCase(item.estatus),
                plan: formatProperCase(item.plan),
                oficina: formatProperCase(item.oficina),
            };
        });

    // Mapa de cédula -> asesor desde CUADRO DIARIO para recuperar ventas sin asesor identificado
    const clientToAdvisorMap = new Map<string, string>();
    formattedInstallations.forEach((inst) => {
        if (inst.cedula && inst.asesor) {
            const cleanCed = String(inst.cedula).replace(/[^0-9]/g, "");
            const cleanAdv = inst.asesor.trim();
            if (cleanCed && cleanAdv !== "" && cleanAdv !== "Sin Asesor" && cleanAdv !== "Desconocido" && cleanAdv !== "Planificacion") {
                clientToAdvisorMap.set(cleanCed, cleanAdv);
            }
        }
    });

    // Parse and title-case fields from SOLICITUDES
    const formattedSolicitudes: Solicitud[] = solRaw.map((item: any) => {
        let normAdvisor = normalizeAdvisorName(item.asesor, activeAliases);
        const cleanCed = item.cedula ? String(item.cedula).replace(/[^0-9]/g, "") : "";

        // Si el asesor es 'Sin Asesor' o no identificado, intentar recuperar el asesor legítimo por la cédula del cliente en CUADRO DIARIO
        if ((normAdvisor === "Sin Asesor" || !normAdvisor || normAdvisor.toLowerCase().includes("no identificado")) && cleanCed) {
            if (clientToAdvisorMap.has(cleanCed)) {
                normAdvisor = clientToAdvisorMap.get(cleanCed)!;
            }
        }

        const advisorType = classifyAdvisor(normAdvisor, activeOverrides);
        const sedeTaquilla = item.sede_taquilla || resolveAdvisorOffice(normAdvisor, activeOverrides);
        const isEx = isAdvisorExCollaborator(normAdvisor, activeOverrides);

        // PUENTE DETERMINÍSTICO POR CÉDULA:
        // Si el cliente ya fue instalado en CUADRO DIARIO, adoptar el sector y zona oficial validado por el técnico
        let loc: CanonicalLocationResult;
        if (cleanCed && clientToCanonicalLocationMap.has(cleanCed)) {
            loc = clientToCanonicalLocationMap.get(cleanCed)!;
        } else {
            loc = normalizeLocation({
                sector: item.sector,
                ubicacion: item.ubicacion,
                zona: item.zona,
                parroquia: item.parroquia,
                municipio: item.municipio,
                estado: item.estado,
            });
        }

        return {
            ...item,
            mes: formatProperCase(item.mes),
            zona: loc.zona,
            sector: loc.sector,
            subsector: loc.subsector,
            municipio: loc.municipio,
            parroquia: loc.parroquia,
            estado: loc.estado,
            asesor: normAdvisor,
            tipo_asesor: advisorType,
            es_ex_colaborador: isEx,
            sede_taquilla: sedeTaquilla,
            canal: item.canal || (advisorType === "comercial" ? "Asesores Comerciales" : advisorType === "taquilla" ? "Taquillero / Ventas Admin" : "Planificación"),
            fuente: item.fuente || "",
            estatus: formatProperCase(item.estatus),
            plan: formatProperCase(item.plan),
        };
    });

    clientCachedProcessedOps = {
        installations: formattedInstallations,
        solicitudes: formattedSolicitudes,
        timestamp: now,
    };

    return {
        installations: formattedInstallations,
        solicitudes: formattedSolicitudes,
        activeTechOverrides,
    };
}

export async function fetchInstallations(
    customOverrides?: AdvisorOverridesMap,
    customAliases?: Record<string, string>,
    customTechOverrides?: TechnicianOverridesMap,
    customTechAliases?: Record<string, string>,
    forceRefresh: boolean = false
): Promise<DashboardMetrics> {
    try {
        const { installations, solicitudes, activeTechOverrides } = await fetchRawOperationalData(
            customOverrides,
            customAliases,
            customTechOverrides,
            customTechAliases,
            forceRefresh
        );

        return calculateAdvancedMetrics(installations, installations, solicitudes, activeTechOverrides);
    } catch (e) {
        console.error("Error fetching data:", e);
        // Fallback to mock data
        const mockData = generateMockData(200);
        return calculateAdvancedMetrics(mockData);
    }
}

export function calculateAdvancedMetrics(
    data: Installation[],
    trendData: Installation[] = data,
    solicitudesData: Solicitud[] = [],
    activeTechOverrides?: TechnicianOverridesMap
): DashboardMetrics {
    // 1. Total Instalaciones (TODO en Cuadro Diario es una instalación realizada)
    const totalInstalaciones = data.length;

    // 2. Total Solicitudes
    const totalSolicitudes = solicitudesData.length;
    const solicitudesInstaladas = solicitudesData.filter(s => s.estatus?.toLowerCase().includes("instalado")).length;
    const tasaEfectividad = totalSolicitudes > 0 ? Math.round((solicitudesInstaladas / totalSolicitudes) * 100) : 0;

    // Counters from installations
    const powerGoCount = data.filter(d => String(d.power_go).toUpperCase() === "SI").length;
    const routerCount = data.filter(d => d.router && d.router !== "0").length;
    const nuevosServicios = data.filter(d => isNuevoServicioStatus(d.estatus)).length;

    // Days worked (unique count of dates)
    const uniqueDays = new Set(data.map(d => d.fecha).filter(Boolean));
    const diasLaborados = uniqueDays.size;

    // 3. Top Advisors (correlating installations and requests)
    const advisorMap: Record<string, { total: number; instalado: number; tipo: AdvisorType; sede?: string; es_ex: boolean }> = {};

    data.forEach(d => {
        const adv = d.asesor;
        if (!adv || adv === "Sin Asesor" || adv === "Desconocido") return;
        if (!advisorMap[adv]) {
            advisorMap[adv] = {
                total: 0,
                instalado: 0,
                tipo: d.tipo_asesor,
                sede: d.sede_taquilla,
                es_ex: Boolean(d.es_ex_colaborador),
            };
        }
        advisorMap[adv].total += 1;
    });

    solicitudesData.forEach(s => {
        const adv = s.asesor;
        if (!adv || adv === "Sin Asesor" || adv === "Desconocido") return;
        if (!advisorMap[adv]) {
            advisorMap[adv] = {
                total: 0,
                instalado: 0,
                tipo: s.tipo_asesor,
                sede: s.sede_taquilla,
                es_ex: Boolean(s.es_ex_colaborador),
            };
        }
        advisorMap[adv].instalado += 1;
    });

    const byAdvisor: MetricChart[] = Object.entries(advisorMap)
        .map(([name, stats]) => ({
            name,
            value: stats.total, // Instalaciones realizadas
            installed: stats.instalado, // Solicitudes registradas
            tipo_asesor: stats.tipo,
            es_ex_colaborador: stats.es_ex,
            sede_taquilla: stats.sede,
        }))
        .sort((a, b) => b.value - a.value);

    const commercialOnly = byAdvisor.filter(a => a.tipo_asesor === "comercial" && !a.es_ex_colaborador);
    const topAsesorRef = commercialOnly[0] || byAdvisor.find(a => !a.es_ex_colaborador) || byAdvisor[0];
    const topAsesor = topAsesorRef?.name || "N/A";
    const maxVentas = topAsesorRef?.value || 0;

    // 4. Trend (Based on month sequence in Cuadro Diario)
    let percentageChange = 0;

    if (trendData.length > 0 && data.length > 0) {
        const monthsInData = Array.from(new Set(data.map(d => d.mes))).sort((a, b) => getMonthIndex(a) - getMonthIndex(b));

        if (monthsInData.length > 0) {
            const currentMonth = monthsInData[monthsInData.length - 1];
            const currentMonthIdx = getMonthIndex(currentMonth);

            if (currentMonthIdx > 0 && currentMonthIdx < MONTH_ORDER.length) {
                const previousMonth = MONTH_ORDER[currentMonthIdx - 1];

                // Determine maximum recorded day in current month for like-for-like MTD
                const currentDays = trendData
                    .filter(d => d.mes === currentMonth)
                    .map(d => {
                        const parts = (d.fecha || "").split("-");
                        return parts.length >= 3 ? parseInt(parts[2], 10) || 0 : 0;
                    })
                    .filter(day => day > 0);
                const maxDay = currentDays.length > 0 ? Math.max(...currentDays) : 31;

                const currentMonthTotal = maxDay >= 28
                    ? trendData.filter(d => d.mes === currentMonth).length
                    : trendData.filter(d => {
                        if (d.mes !== currentMonth) return false;
                        const parts = (d.fecha || "").split("-");
                        const day = parts.length >= 3 ? parseInt(parts[2], 10) || 0 : 0;
                        return day > 0 && day <= maxDay;
                    }).length;

                const previousMonthTotal = maxDay >= 28
                    ? trendData.filter(d => d.mes === previousMonth).length
                    : trendData.filter(d => {
                        if (d.mes !== previousMonth) return false;
                        const parts = (d.fecha || "").split("-");
                        const day = parts.length >= 3 ? parseInt(parts[2], 10) || 0 : 0;
                        return day > 0 && day <= maxDay;
                    }).length;

                if (currentMonthTotal > 0 && previousMonthTotal > 0) {
                    percentageChange = Math.round(((currentMonthTotal - previousMonthTotal) / previousMonthTotal) * 100);
                } else if (previousMonthTotal > 0 && currentMonthTotal === 0) {
                    percentageChange = -100;
                } else if (currentMonthTotal > 0 && previousMonthTotal === 0) {
                    percentageChange = 100;
                }
            }
        }
    }

    // 5. General Charts
    const countBy = (key: keyof Installation) => {
        const counts: Record<string, number> = {};
        data.forEach(item => {
            const val = String(item[key] || "N/A");
            counts[val] = (counts[val] || 0) + 1;
        });
        return Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    };

    const byMonth = countBy('mes');
    byMonth.sort((a, b) => getMonthIndex(a.name) - getMonthIndex(b.name));

    const countByWithHistory = (key: keyof Installation) => {
        const counts: Record<string, number> = {};
        const monthlyCounts: Record<string, Record<string, number>> = {};

        data.forEach(item => {
            const val = String(item[key] || "N/A");
            const m = String(item.mes || "N/A");
            counts[val] = (counts[val] || 0) + 1;
            if (!monthlyCounts[val]) monthlyCounts[val] = {};
            monthlyCounts[val][m] = (monthlyCounts[val][m] || 0) + 1;
        });

        return Object.entries(counts)
            .map(([name, value]) => {
                const history = byMonth.map(m => monthlyCounts[name]?.[m.name] || 0);
                return { name, value, history };
            })
            .sort((a, b) => b.value - a.value);
    };

    // Merged technicians from installations with squad assignment and monthly trends
    const techCounts: Record<string, { count: number; team?: string }> = {};
    const techMonthly: Record<string, Record<string, number>> = {};
    data.forEach(item => {
        const m = String(item.mes || "N/A");
        if (item.tecnico_1) {
            const t1 = item.tecnico_1;
            if (!techCounts[t1]) techCounts[t1] = { count: 0, team: item.equipo };
            techCounts[t1].count += 1;
            if (!techMonthly[t1]) techMonthly[t1] = {};
            techMonthly[t1][m] = (techMonthly[t1][m] || 0) + 1;
        }
        if (item.tecnico_2) {
            const t2 = item.tecnico_2;
            if (!techCounts[t2]) techCounts[t2] = { count: 0, team: item.equipo };
            techCounts[t2].count += 1;
            if (!techMonthly[t2]) techMonthly[t2] = {};
            techMonthly[t2][m] = (techMonthly[t2][m] || 0) + 1;
        }
    });
    const byTechnician = Object.entries(techCounts)
        .map(([name, stats]) => {
            const history = byMonth.map(m => techMonthly[name]?.[m.name] || 0);
            const overrideMatch = findTechnicianOverride(name, activeTechOverrides);
            const isEx = overrideMatch?.config?.isExCollaborator !== undefined
                ? Boolean(overrideMatch.config.isExCollaborator)
                : overrideMatch?.config?.status === "ex";

            return {
                name,
                value: stats.count,
                equipo: overrideMatch?.config?.team || stats.team,
                history,
                es_ex_colaborador: isEx,
                status: overrideMatch?.config?.status || (isEx ? "ex" : "fijo"),
                departamento: overrideMatch?.config?.department || "tecnico",
            };
        })
        .sort((a, b) => b.value - a.value);

    // Detailed Timeline Daily: correlating Real Installations (Cuadro Diario) vs Real Solicitudes (Solicitudes)
    const allDates = new Set<string>();
    data.forEach(d => { if (d.fecha) allDates.add(d.fecha); });
    solicitudesData.forEach(s => { if (s.fecha) allDates.add(s.fecha); });

    const instByDay = new Map<string, Installation[]>();
    data.forEach(item => {
        if (!item.fecha) return;
        if (!instByDay.has(item.fecha)) instByDay.set(item.fecha, []);
        instByDay.get(item.fecha)!.push(item);
    });

    const solByDay = new Map<string, Solicitud[]>();
    solicitudesData.forEach(item => {
        if (!item.fecha) return;
        if (!solByDay.has(item.fecha)) solByDay.set(item.fecha, []);
        solByDay.get(item.fecha)!.push(item);
    });

    const detailedByDay: DetailedDailyMetric[] = Array.from(allDates)
        .sort((a, b) => a.localeCompare(b))
        .map(dateStr => {
            const parts = dateStr.split('-');
            const name = parts.length === 3 ? `${parts[2]}-${parts[1]}` : dateStr;

            const dayInst = instByDay.get(dateStr) || [];
            const daySol = solByDay.get(dateStr) || [];

            const instalaciones = dayInst.length; // 100% realizadas de Cuadro Diario
            const solicitudes = daySol.length;   // 100% solicitudes de asesores

            // Top Advisor on day (from Solicitudes)
            const advDay: Record<string, number> = {};
            daySol.forEach(s => {
                const adv = formatProperCase(s.asesor);
                if (adv && adv !== "Sin Asesor" && adv !== "N/a") {
                    advDay[adv] = (advDay[adv] || 0) + 1;
                }
            });
            const topAsesorDaily = Object.entries(advDay).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

            // Top Sector on day (from Installations)
            const secDay: Record<string, number> = {};
            dayInst.forEach(d => { if (d.sector) secDay[d.sector] = (secDay[d.sector] || 0) + 1; });
            const topSectorDaily = Object.entries(secDay).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

            return {
                name,
                fullDate: dateStr,
                instalaciones,
                solicitudes,
                asesor_top: topAsesorDaily,
                sector_principal: topSectorDaily
            };
        });

    const byDay = detailedByDay.map(d => ({ name: d.name, value: d.instalaciones }));

    return {
        counters: {
            totalInstalaciones,
            totalSolicitudes,
            powerGoCount,
            maxVentas,
            topAsesor,
            routerCount,
            nuevosServicios,
            diasLaborados,
            solicitudesInstaladas,
            tasaEfectividad,
        },
        trend: {
            percentageChange
        },
        charts: {
            byMonth,
            byDay,
            detailedByDay,
            byStatus: countByWithHistory('estatus'),
            byService: countByWithHistory('servicio'),
            byPlan: countByWithHistory('plan'),
            byZone: countByWithHistory('zona'),
            byAdvisor,
            byTechnician,
            bySector: countByWithHistory('sector'),
            byOficina: countByWithHistory('oficina'),
            byEstado: countByWithHistory('estado'),
        },
        raw: data,
        rawSolicitudes: solicitudesData
    };
}

// Mock Generator (Simplified fallback)
export function generateMockData(count: number = 200): Installation[] {
    const STATUSES = ["Instalación", "Migración", "Convenio", "Empleado", "Mudanza"];
    return Array.from({ length: count }).map((_, i) => ({
        id: i,
        created_at: new Date().toISOString(),
        fecha: "2026-01-02",
        mes: "Enero",
        tecnico_1: "Técnico Mock",
        tecnico_2: "Técnico Mock 2",
        router: Math.random() > 0.5 ? "Huawei" : null,
        nombre_cliente: `Cliente ${i}`,
        cedula: "123456",
        zona: "Los Teques",
        sector: "El Vigía",
        asesor: "Taquilla",
        tipo_asesor: "taquilla",
        estatus: STATUSES[Math.floor(Math.random() * STATUSES.length)],
        plan: "400 MB",
        power_go: Math.random() > 0.8 ? "SI" : "NO",
        servicio: "Residencial",
        oficina: "Otros",
        estado: "Miranda"
    }));
}

// --- Network Map Data ---

export interface NetworkNode {
    id: number;
    nombre: string;
    latitud: number;
    longitud: number;
    tipo: string;
}

export async function fetchNetworkNodes(): Promise<NetworkNode[]> {
    return generateMockNodes();
}

function generateMockNodes(): NetworkNode[] {
    return [
        { id: 101, nombre: "Manga-Test-01", latitud: 10.467, longitud: -66.905, tipo: "Manga 96" },
        { id: 102, nombre: "NAP-Test-01", latitud: 10.468, longitud: -66.904, tipo: "Manga 48" },
        { id: 103, nombre: "NAP-Test-02", latitud: 10.466, longitud: -66.906, tipo: "Manga 48" },
        { id: 104, nombre: "Manga-Test-02", latitud: 10.469, longitud: -66.903, tipo: "Manga 96" },
        { id: 105, nombre: "NAP-Test-03", latitud: 10.465, longitud: -66.907, tipo: "Manga 48" },
        { id: 106, nombre: "Empalme-Test-03", latitud: 10.470, longitud: -66.902, tipo: "Empalme" },
    ];
}

// --- Planificación Asesores Data ---

export interface PlanificacionRecord {
    id: number;
    fecha: string;
    mes: string;
    asesor: string;
    sector: string;
    subsector?: string;
    estatus: string;
    estado: string;
    zona?: string;
    servicio?: string;
    oficina?: string;
    municipio?: string;
    parroquia?: string;
    tipo_actividad?: string;
    power_go?: string;
    plan?: string;
    tipo_asesor?: AdvisorType;
    es_ex_colaborador?: boolean;
    sede_taquilla?: string;
    raw_asesor?: string;
}

export const PLANIFICACION_SPREADSHEET_ID = "1_PzDJLZ8jnPTZq9PgQMLfomwBwles8XOd8RD5Ksko2Y";
export const PLANIFICACION_SHEET_NAME = "Data";

let clientCachedPlanificacion: { data: PlanificacionRecord[]; timestamp: number } | null = null;

export async function fetchPlanificacionData(forceRefresh = false): Promise<PlanificacionRecord[]> {
    const now = Date.now();
    if (!forceRefresh && clientCachedPlanificacion && (now - clientCachedPlanificacion.timestamp < CLIENT_CACHE_TTL)) {
        return clientCachedPlanificacion.data;
    }

    // Try reading from localStorage for instant retrieval on client
    if (!forceRefresh && typeof window !== "undefined") {
        try {
            const rawStored = localStorage.getItem(LOCAL_STORAGE_PLAN_KEY);
            if (rawStored) {
                const parsed = JSON.parse(rawStored);
                if (parsed && Array.isArray(parsed.data) && parsed.data.length > 0 && (now - (parsed.timestamp || 0) < CLIENT_CACHE_TTL)) {
                    clientCachedPlanificacion = {
                        data: parsed.data,
                        timestamp: parsed.timestamp || now,
                    };
                    // Silently revalidate in background if older than 3 minutes
                    if (now - (parsed.timestamp || 0) > 3 * 60 * 1000) {
                        setTimeout(() => fetchPlanificacionData(true).catch(() => {}), 150);
                    }
                    return parsed.data;
                }
            }
        } catch (_) {}
    }

    try {
        const refreshParam = forceRefresh ? "&refresh=true" : "";
        const url = `/api/sheets?spreadsheetId=${PLANIFICACION_SPREADSHEET_ID}&sheetName=${encodeURIComponent(PLANIFICACION_SHEET_NAME)}${refreshParam}`;
        
        // Fetch planning sheet and advisor configuration concurrently in parallel
        const [res, configRes] = await Promise.all([
            fetch(url),
            fetch(`/api/advisors/config?t=${Date.now()}`, {
                cache: "no-store",
                headers: { "Cache-Control": "no-cache" }
            }).then(r => r.json()).catch(() => null),
        ]);

        const json = res.ok ? await res.json().catch(() => ({ success: false, data: [] })) : { success: false, data: [] };

        if (!json.success || !Array.isArray(json.data)) {
            return [];
        }

        const overrides: AdvisorOverridesMap = configRes?.overrides || {};
        const aliases: Record<string, string> = configRes?.aliases || {};

        const formatted: PlanificacionRecord[] = json.data
            .filter((item: any) => {
                const hasFecha = item.fecha && String(item.fecha).trim() !== "" && String(item.fecha).toUpperCase() !== "FECHA";
                const hasAsesor = item.asesor && String(item.asesor).trim() !== "";
                return hasFecha && hasAsesor;
            })
            .map((item: any) => {
                const normAdvisor = normalizeAdvisorName(item.asesor, aliases);
                const advisorType = classifyAdvisor(normAdvisor, overrides);
                const sedeTaquilla = resolveAdvisorOffice(normAdvisor, overrides);
                const isEx = isAdvisorExCollaborator(normAdvisor, overrides);

                // Normalización territorial estricta hacia el Padrón Oficial del Cuadro Diario
                const loc = normalizeLocation({
                    sector: item.sector,
                    zona: item.zona,
                    parroquia: item.parroquia,
                    municipio: item.municipio,
                    estado: item.estado,
                });

                return {
                    id: item.id,
                    fecha: item.fecha,
                    mes: formatProperCase(item.mes),
                    asesor: normAdvisor,
                    sector: loc.sector,
                    subsector: loc.subsector,
                    estatus: formatProperCase(item.estatus || "Planificado"),
                    estado: loc.estado,
                    zona: loc.zona,
                    servicio: formatProperCase(item.servicio || "Residencial"),
                    oficina: formatProperCase(item.oficina || ""),
                    municipio: loc.municipio,
                    power_go: item.power_go || "NO",
                    plan: formatProperCase(item.plan || ""),
                    parroquia: loc.parroquia,
                    tipo_actividad: formatProperCase(item.tipo_actividad || item.plan || "Recorrido"),
                    tipo_asesor: advisorType,
                    es_ex_colaborador: isEx,
                    sede_taquilla: sedeTaquilla,
                    raw_asesor: item.asesor,
                };
            });

        clientCachedPlanificacion = {
            data: formatted,
            timestamp: now,
        };

        if (typeof window !== "undefined") {
            try {
                localStorage.setItem(LOCAL_STORAGE_PLAN_KEY, JSON.stringify({
                    data: formatted,
                    timestamp: now,
                }));
            } catch (_) {}
        }

        return formatted;
    } catch (err) {
        console.error("Error al obtener datos de Planificación:", err);
        return [];
    }
}

