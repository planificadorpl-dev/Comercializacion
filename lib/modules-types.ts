export type AppUserRole = "admin" | "supervisor" | "impulsador" | "asesor";

export interface SystemModule {
  id: string;
  name: string;
  route: string;
  short: string;
  description: string;
  category: "Supervisión y Estrategia" | "Operaciones de Campo";
  targetRoles: AppUserRole[];
  enabledForUsers: boolean;
  updatedAt: string;
  updatedBy?: string;
}

export const DEFAULT_SYSTEM_MODULES: SystemModule[] = [
  {
    id: "planificacion",
    name: "Planificación Comercial",
    route: "/planificacion",
    short: "PC",
    description: "Metas comerciales, proyección de ventas, planificación por asesor y agenda de trabajo.",
    category: "Supervisión y Estrategia",
    targetRoles: ["supervisor", "impulsador"],
    enabledForUsers: false,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "competencia",
    name: "Estudio de Mercado",
    route: "/competencia",
    short: "EM",
    description: "Relevamiento de operadores de la competencia, tarifas, planes de mercado y tasas BCV / Binance.",
    category: "Operaciones de Campo",
    targetRoles: ["asesor"],
    enabledForUsers: false,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "evaluaciones",
    name: "Evaluación y Supervisión",
    route: "/evaluaciones",
    short: "ES",
    description: "Evaluación continua de asesores en campo, rúbricas de supervisión y desempeño operativo.",
    category: "Supervisión y Estrategia",
    targetRoles: ["supervisor", "impulsador"],
    enabledForUsers: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "actividades",
    name: "Registro de Actividades",
    route: "/actividades",
    short: "RA",
    description: "Registro en tiempo real de puntos de abordaje, recorridos, checklists y jornadas diarias.",
    category: "Operaciones de Campo",
    targetRoles: ["asesor"],
    enabledForUsers: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "solicitudes",
    name: "Solicitudes de Servicio",
    route: "/solicitudes",
    short: "SS",
    description: "Captación, validación preliminar de cobertura y seguimiento comercial de solicitudes.",
    category: "Operaciones de Campo",
    targetRoles: ["asesor"],
    enabledForUsers: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "factibilidad",
    name: "Factibilidad",
    route: "/factibilidad",
    short: "FC",
    description: "Consulta de factibilidad técnica, cobertura y puertos de cajas NAP en tiempo real vía OZmap.",
    category: "Operaciones de Campo",
    targetRoles: ["asesor", "supervisor", "impulsador"],
    enabledForUsers: true,
    updatedAt: new Date().toISOString(),
  },
];
