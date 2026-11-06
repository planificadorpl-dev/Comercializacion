"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  Calendar,
  CheckSquare,
  FileText,
  Send,
  Layers,
  Menu,
  X,
  Compass,
  MapPin,
  Plus,
  BarChart2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/providers/sidebar-provider";
import { useUser } from "@/components/providers/user-provider";
import { useModules } from "@/components/providers/modules-provider";

export function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { openMobileSidebar } = useSidebar();
  const { isAsesor, isSupervisorOrImpulsador, isAdmin } = useUser();
  const { isModuleEnabledForUser } = useModules();
  const [opsMenuOpen, setOpsMenuOpen] = useState(false);
  const [evalMenuOpen, setEvalMenuOpen] = useState(false);

  // Close sheets on Escape key
  useEffect(() => {
    if (!opsMenuOpen && !evalMenuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpsMenuOpen(false);
        setEvalMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [opsMenuOpen, evalMenuOpen]);

  // Do not render on login page
  if (pathname === "/login") return null;

  // Prefetch common routes on mount so mobile navigation transitions are instant (0ms delay)
  useEffect(() => {
    try {
      router.prefetch("/");
      router.prefetch("/planificacion");
      router.prefetch("/evaluaciones");
      router.prefetch("/evaluaciones/nueva");
      router.prefetch("/evaluaciones/rendimiento");
      router.prefetch("/actividades");
      router.prefetch("/solicitudes");
      router.prefetch("/factibilidad");
      router.prefetch("/competencia");
    } catch {}
  }, [router]);

  // Immediate navigation handler (zero lag, zero trailing timers)
  const handleNavigate = (e: React.MouseEvent, href: string) => {
    e.preventDefault();
    setOpsMenuOpen(false);
    setEvalMenuOpen(false);
    if (pathname === href) return;
    router.push(href);
  };

  // Dedicated handler for the 3 Evaluación sheet options
  const handleEvalAction = (e: React.MouseEvent, action: "nueva" | "rendimiento" | "registros") => {
    e.preventDefault();
    setEvalMenuOpen(false);
    setOpsMenuOpen(false);

    const targetHref =
      action === "nueva"
        ? "/evaluaciones/nueva"
        : action === "rendimiento"
        ? "/evaluaciones/rendimiento"
        : "/evaluaciones";

    if (pathname === targetHref) return;
    router.push(targetHref);
  };

  // Field operations metadata
  const FIELD_OPS = [
    {
      id: "actividades",
      href: "/actividades",
      label: "Registro de Actividades",
      desc: "Jornadas en campo y visitas",
      icon: FileText,
    },
    {
      id: "solicitudes",
      href: "/solicitudes",
      label: "Solicitudes de Servicio",
      desc: "Altas y ventas por verificar",
      icon: Send,
    },
    {
      id: "factibilidad",
      href: "/factibilidad",
      label: "Factibilidad",
      desc: "Mapa de cajas NAP y puertos",
      icon: MapPin,
    },
    {
      id: "competencia",
      href: "/competencia",
      label: "Estudio de Mercado",
      desc: "Monitoreo de ISPs y tarifas",
      icon: Compass,
    },
  ];

  // Filter operations based on admin privilege and module enablement
  const visibleFieldOps = FIELD_OPS.filter((item) => {
    if (isAdmin) return true;
    return isModuleEnabledForUser(item.id, false);
  });

  const isFieldRouteActive =
    pathname.startsWith("/actividades") ||
    pathname.startsWith("/solicitudes") ||
    pathname.startsWith("/factibilidad") ||
    pathname.startsWith("/competencia");

  return (
    <>
      {/* ─── DESPLEGABLE CON OPCIONES: EVALUACIÓN Y SUPERVISIÓN ─── */}
      {evalMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-xs xl:hidden animate-in fade-in duration-150"
          onClick={() => setEvalMenuOpen(false)}
        >
          <div
            className="absolute bottom-16 left-3 right-3 bg-white border border-neutral-200/90 shadow-2xl rounded-2xl p-3 space-y-1 animate-in slide-in-from-bottom-3 duration-200 select-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 mb-1 border-b border-neutral-100 px-2">
              <span className="text-xs font-semibold text-neutral-900">
                Evaluación y supervisión
              </span>
              <button
                type="button"
                onClick={() => setEvalMenuOpen(false)}
                className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer p-1"
                aria-label="Cerrar menú de evaluación"
              >
                <X className="w-3.5 h-3.5 stroke-[1.5]" />
              </button>
            </div>

            {/* 1. Nueva evaluación */}
            <button
              type="button"
              onClick={(e) => handleEvalAction(e, "nueva")}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer touch-manipulation text-neutral-700 hover:text-neutral-950 hover:bg-neutral-50"
            >
              <Plus className="w-4 h-4 stroke-[2] shrink-0 text-neutral-900" />
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-medium text-neutral-900 leading-tight">
                  Nueva evaluación
                </span>
                <span className="text-[10px] text-neutral-400 leading-tight mt-0.5">
                  Iniciar formato de supervisión en campo
                </span>
              </div>
            </button>

            {/* 2. Rendimiento por Asesor */}
            <button
              type="button"
              onClick={(e) => handleEvalAction(e, "rendimiento")}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer touch-manipulation text-neutral-700 hover:text-neutral-950 hover:bg-neutral-50"
            >
              <BarChart2 className="w-4 h-4 stroke-[1.5] shrink-0 text-neutral-500" />
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-medium text-neutral-900 leading-tight">
                  Rendimiento por Asesor
                </span>
                <span className="text-[10px] text-neutral-400 leading-tight mt-0.5">
                  Estadísticas y cumplimiento por asesor
                </span>
              </div>
            </button>

            {/* 3. Registro de Evaluaciones */}
            <button
              type="button"
              onClick={(e) => handleEvalAction(e, "registros")}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer touch-manipulation text-neutral-700 hover:text-neutral-950 hover:bg-neutral-50"
            >
              <CheckSquare className="w-4 h-4 stroke-[1.5] shrink-0 text-neutral-500" />
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-medium text-neutral-900 leading-tight">
                  Registro de Evaluaciones
                </span>
                <span className="text-[10px] text-neutral-400 leading-tight mt-0.5">
                  Historial de auditorías y supervisión
                </span>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* ─── DESPLEGABLE CON OPCIONES: OPERACIONES DE CAMPO ─── */}
      {opsMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-xs xl:hidden animate-in fade-in duration-150"
          onClick={() => setOpsMenuOpen(false)}
        >
          <div
            className="absolute bottom-16 left-3 right-3 bg-white border border-neutral-200/90 shadow-2xl rounded-2xl p-3 space-y-1 animate-in slide-in-from-bottom-3 duration-200 select-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 mb-1 border-b border-neutral-100 px-2">
              <span className="text-xs font-semibold text-neutral-900">
                Operaciones de campo
              </span>
              <button
                type="button"
                onClick={() => setOpsMenuOpen(false)}
                className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer p-1"
                aria-label="Cerrar menú de operaciones"
              >
                <X className="w-3.5 h-3.5 stroke-[1.5]" />
              </button>
            </div>

            {visibleFieldOps.map((op) => {
              const Icon = op.icon;
              const isActive = pathname.startsWith(op.href);
              return (
                <button
                  key={op.id}
                  type="button"
                  onClick={(e) => handleNavigate(e, op.href)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer touch-manipulation",
                    isActive
                      ? "text-neutral-950 font-bold bg-neutral-50"
                      : "text-neutral-600 hover:text-neutral-950 hover:bg-neutral-50"
                  )}
                >
                  <Icon
                    className={cn(
                      "w-4 h-4 stroke-[1.5] shrink-0",
                      isActive ? "text-neutral-900" : "text-neutral-500"
                    )}
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-medium text-neutral-900 leading-tight">
                      {op.label}
                    </span>
                    <span className="text-[10px] text-neutral-400 leading-tight mt-0.5">
                      {op.desc}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── BARRA DE NAVEGACIÓN MÓVIL INFERIOR DINÁMICA POR ROL ─── */}
      <nav
        aria-label="Navegación móvil inferior"
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-neutral-200/70 xl:hidden select-none"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 4px)" }}
      >
        <div className="flex items-center justify-around h-13 px-2 max-w-lg mx-auto">
          {isAsesor ? (
            /* 1. ASESOR: Solo herramientas de campo directas y permitidas */
            <>
              {visibleFieldOps.map((op) => {
                const Icon = op.icon;
                const isActive = pathname.startsWith(op.href);
                const shortLabel =
                  op.id === "actividades"
                    ? "Actividades"
                    : op.id === "solicitudes"
                    ? "Solicitudes"
                    : "Mercado";

                return (
                  <button
                    key={op.id}
                    type="button"
                    onClick={(e) => handleNavigate(e, op.href)}
                    className={cn(
                      "flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-colors cursor-pointer touch-manipulation",
                      isActive
                        ? "text-neutral-950 font-bold"
                        : "text-neutral-400 hover:text-neutral-700"
                    )}
                  >
                    <Icon className="w-4 h-4 stroke-[1.25]" />
                    <span className="text-[10px] mt-0.5 leading-none">{shortLabel}</span>
                    {isActive && (
                      <span className="w-1 h-1 rounded-full bg-neutral-900 mt-1" />
                    )}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={openMobileSidebar}
                className="flex flex-col items-center justify-center flex-1 h-full py-1 text-center text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer touch-manipulation"
                title="Abrir menú de navegación"
                aria-label="Abrir menú"
              >
                <Menu className="w-4 h-4 stroke-[1.25]" />
                <span className="text-[10px] mt-0.5 leading-none">Menú</span>
              </button>
            </>
          ) : isSupervisorOrImpulsador ? (
            /* 2. SUPERVISOR / IMPULSADOR: Solo paneles estratégicos y de supervisión */
            <>
              <button
                type="button"
                onClick={(e) => handleNavigate(e, "/")}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-colors cursor-pointer touch-manipulation",
                  pathname === "/"
                    ? "text-neutral-950 font-bold"
                    : "text-neutral-400 hover:text-neutral-700"
                )}
              >
                <Home className="w-4 h-4 stroke-[1.25]" />
                <span className="text-[10px] mt-0.5 leading-none">Principal</span>
                {pathname === "/" && (
                  <span className="w-1 h-1 rounded-full bg-neutral-900 mt-1" />
                )}
              </button>

              {isModuleEnabledForUser("planificacion", false) && (
                <button
                  type="button"
                  onClick={(e) => handleNavigate(e, "/planificacion")}
                  className={cn(
                    "flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-colors cursor-pointer touch-manipulation",
                    pathname.startsWith("/planificacion")
                      ? "text-neutral-950 font-bold"
                      : "text-neutral-400 hover:text-neutral-700"
                  )}
                >
                  <Calendar className="w-4 h-4 stroke-[1.25]" />
                  <span className="text-[10px] mt-0.5 leading-none">Planificación</span>
                  {pathname.startsWith("/planificacion") && (
                    <span className="w-1 h-1 rounded-full bg-neutral-900 mt-1" />
                  )}
                </button>
              )}

              {isModuleEnabledForUser("evaluaciones", false) && (
                <button
                  type="button"
                  onClick={() => {
                    setOpsMenuOpen(false);
                    setEvalMenuOpen(!evalMenuOpen);
                  }}
                  className={cn(
                    "flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-colors cursor-pointer touch-manipulation",
                    evalMenuOpen || pathname.startsWith("/evaluaciones")
                      ? "text-neutral-950 font-bold"
                      : "text-neutral-400 hover:text-neutral-700"
                  )}
                  title="Evaluación y supervisión"
                  aria-label="Evaluación y supervisión"
                >
                  <CheckSquare className="w-4 h-4 stroke-[1.25]" />
                  <span className="text-[10px] mt-0.5 leading-none">Evaluación</span>
                  {pathname.startsWith("/evaluaciones") && (
                    <span className="w-1 h-1 rounded-full bg-neutral-900 mt-1" />
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={openMobileSidebar}
                className="flex flex-col items-center justify-center flex-1 h-full py-1 text-center text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer touch-manipulation"
                title="Abrir menú de navegación"
                aria-label="Abrir menú"
              >
                <Menu className="w-4 h-4 stroke-[1.25]" />
                <span className="text-[10px] mt-0.5 leading-none">Menú</span>
              </button>
            </>
          ) : (
            /* 3. ADMINISTRADOR: Paneles de Supervisión + Desplegables + Menú */
            <>
              {/* 1. Página Principal */}
              <button
                type="button"
                onClick={(e) => handleNavigate(e, "/")}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-colors cursor-pointer touch-manipulation",
                  pathname === "/"
                    ? "text-neutral-950 font-bold"
                    : "text-neutral-400 hover:text-neutral-700"
                )}
              >
                <Home className="w-4 h-4 stroke-[1.25]" />
                <span className="text-[10px] mt-0.5 leading-none">Principal</span>
                {pathname === "/" && (
                  <span className="w-1 h-1 rounded-full bg-neutral-900 mt-1" />
                )}
              </button>

              {/* 2. Planificación Comercial */}
              <button
                type="button"
                onClick={(e) => handleNavigate(e, "/planificacion")}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-colors cursor-pointer touch-manipulation",
                  pathname.startsWith("/planificacion")
                    ? "text-neutral-950 font-bold"
                    : "text-neutral-400 hover:text-neutral-700"
                )}
              >
                <Calendar className="w-4 h-4 stroke-[1.25]" />
                <span className="text-[10px] mt-0.5 leading-none">Planificación</span>
                {pathname.startsWith("/planificacion") && (
                  <span className="w-1 h-1 rounded-full bg-neutral-900 mt-1" />
                )}
              </button>

              {/* 3. Evaluación y Supervisión (Desplegable con opciones: Nueva, Rendimiento, Registro) */}
              <button
                type="button"
                onClick={() => {
                  setOpsMenuOpen(false);
                  setEvalMenuOpen(!evalMenuOpen);
                }}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-colors cursor-pointer touch-manipulation",
                  evalMenuOpen || pathname.startsWith("/evaluaciones")
                    ? "text-neutral-950 font-bold"
                    : "text-neutral-400 hover:text-neutral-700"
                )}
                title="Evaluación y supervisión"
                aria-label="Evaluación y supervisión"
              >
                <CheckSquare className="w-4 h-4 stroke-[1.25]" />
                <span className="text-[10px] mt-0.5 leading-none">Evaluación</span>
                {pathname.startsWith("/evaluaciones") && (
                  <span className="w-1 h-1 rounded-full bg-neutral-900 mt-1" />
                )}
              </button>

              {/* 4. Campo (Desplegable con opciones de Operaciones de campo) */}
              <button
                type="button"
                onClick={() => {
                  setEvalMenuOpen(false);
                  setOpsMenuOpen(!opsMenuOpen);
                }}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-colors cursor-pointer touch-manipulation",
                  opsMenuOpen || isFieldRouteActive
                    ? "text-neutral-950 font-bold"
                    : "text-neutral-400 hover:text-neutral-700"
                )}
                title="Operaciones de campo"
                aria-label="Operaciones de campo"
              >
                <Layers className="w-4 h-4 stroke-[1.25]" />
                <span className="text-[10px] mt-0.5 leading-none">Campo</span>
                {isFieldRouteActive && (
                  <span className="w-1 h-1 rounded-full bg-neutral-900 mt-1" />
                )}
              </button>

              {/* 5. Menú (Acceso al Drawer completo, Administrador, Selector de asesor y Sesión) */}
              <button
                type="button"
                onClick={openMobileSidebar}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-colors cursor-pointer touch-manipulation",
                  pathname.startsWith("/admin")
                    ? "text-neutral-950 font-bold"
                    : "text-neutral-400 hover:text-neutral-900"
                )}
                title="Abrir menú de navegación"
                aria-label="Abrir menú"
              >
                <Menu className="w-4 h-4 stroke-[1.25]" />
                <span className="text-[10px] mt-0.5 leading-none">Menú</span>
                {pathname.startsWith("/admin") && (
                  <span className="w-1 h-1 rounded-full bg-neutral-900 mt-1" />
                )}
              </button>
            </>
          )}
        </div>
      </nav>
    </>
  );
}
