"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { PanelLeftClose, X, User, Search, LogOut, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAsesor } from "@/components/providers/asesor-provider";
import { useSidebar } from "@/components/providers/sidebar-provider";
import { useUser } from "@/components/providers/user-provider";
import { useModules } from "@/components/providers/modules-provider";

interface SidebarProps {
  advisorsCount?: number;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  activeSection?: string;
  onSelectSection?: (section: string) => void;
}

interface NavGroup {
  groupTitle?: string;
  items: {
    id: string;
    label: string;
    short: string;
    href: string;
    badge?: string | null;
  }[];
}

const DEFAULT_NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { id: "principal", label: "Página Principal", short: "PP", href: "/", badge: null },
      { id: "planificacion", label: "Planificación Comercial", short: "PC", href: "/planificacion", badge: null },
      { id: "evaluaciones", label: "Evaluación y Supervisión", short: "ES", href: "/evaluaciones", badge: null },
    ],
  },
  {
    groupTitle: "Operaciones de campo",
    items: [
      { id: "actividades", label: "Registro de Actividades", short: "RA", href: "/actividades", badge: null },
      { id: "solicitudes", label: "Solicitudes de Servicio", short: "SS", href: "/solicitudes", badge: null },
      { id: "factibilidad", label: "Factibilidad", short: "FC", href: "/factibilidad", badge: null },
      { id: "competencia", label: "Estudio de Mercado", short: "EM", href: "/competencia", badge: null },
    ],
  },
  {
    groupTitle: "Sistema",
    items: [
      { id: "admin", label: "Administrador", short: "AD", href: "/admin", badge: null },
    ],
  },
];

export function Sidebar({
  advisorsCount = 24,
  isCollapsed: propIsCollapsed,
  onToggleCollapse: propOnToggleCollapse,
  isMobileOpen: propIsMobileOpen,
  onCloseMobile: propOnCloseMobile,
  activeSection = "principal",
  onSelectSection,
}: SidebarProps) {
  const sidebarCtx = useSidebar();
  const collapsed = propIsCollapsed !== undefined ? propIsCollapsed : sidebarCtx.isCollapsed;
  const toggle = propOnToggleCollapse || sidebarCtx.toggleSidebar;
  const mobileOpen = Boolean(propIsMobileOpen || sidebarCtx.isMobileOpen);
  const closeMobile = () => {
    if (propOnCloseMobile) propOnCloseMobile();
    sidebarCtx.closeMobileSidebar();
  };

  const { user, logout, isAsesor, isSupervisorOrImpulsador, isAdmin, stopImpersonating } = useUser();
  const { isModuleEnabledForUser, modules } = useModules();
  const { currentAsesor, setCurrentAsesor, availableAsesores, isAsesorLocked } = useAsesor();
  const [asesorModalOpen, setAsesorModalOpen] = useState(false);
  const [asesorSearch, setAsesorSearch] = useState("");

  // Role-based / Customized visible navigation groups with dynamic module availability filtering
  const visibleNavGroups = useMemo(() => {
    const isCustom = Boolean(user?.customAccess && Array.isArray(user?.allowedModules));

    const isItemAllowed = (itemId: string): boolean => {
      if (isAdmin) return true;
      if (isCustom && user?.allowedModules) {
        return user.allowedModules.includes(itemId);
      }
      const mod = modules.find((m) => m.id === itemId);
      const isRoleAllowed = mod ? Boolean(mod.targetRoles && mod.targetRoles.includes(user?.rol as any)) : false;
      return isRoleAllowed && isModuleEnabledForUser(itemId, false);
    };

    const filterAndEnrichItems = (
      rawItems: { id: string; label: string; short: string; href: string; badge?: string | null }[]
    ) => {
      return rawItems
        .filter((item) => isItemAllowed(item.id))
        .map((item) => {
          if (isAdmin) {
            const mod = modules.find((m) => m.id === item.id);
            if (mod && !mod.enabledForUsers) {
              return { ...item, badge: "Solo admin" };
            }
          }
          return item;
        });
    };

    const topItems = filterAndEnrichItems([
      { id: "principal", label: "Página Principal", short: "PP", href: "/", badge: null },
      { id: "planificacion", label: "Planificación Comercial", short: "PC", href: "/planificacion", badge: null },
      { id: "evaluaciones", label: "Evaluación y Supervisión", short: "ES", href: "/evaluaciones", badge: null },
    ]);

    const fieldItems = filterAndEnrichItems([
      { id: "actividades", label: "Registro de Actividades", short: "RA", href: "/actividades", badge: null },
      { id: "solicitudes", label: "Solicitudes de Servicio", short: "SS", href: "/solicitudes", badge: null },
      { id: "factibilidad", label: "Factibilidad", short: "FC", href: "/factibilidad", badge: null },
      { id: "competencia", label: "Estudio de Mercado", short: "EM", href: "/competencia", badge: null },
    ]);

    const groups: NavGroup[] = [];

    if (topItems.length > 0) {
      groups.push({ items: topItems });
    }

    if (fieldItems.length > 0) {
      groups.push({
        groupTitle: "Operaciones de campo",
        items: fieldItems,
      });
    }

    if (isAdmin) {
      groups.push({
        groupTitle: "Sistema",
        items: [
          { id: "admin", label: "Administrador", short: "AD", href: "/admin", badge: null },
        ],
      });
    }

    return groups;
  }, [user, isAdmin, isModuleEnabledForUser, modules]);

  // Lock body scroll on mobile when drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  // Close mobile drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (asesorModalOpen) setAsesorModalOpen(false);
        else if (mobileOpen && closeMobile) closeMobile();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen, closeMobile, asesorModalOpen]);

  const userRoleLabel = useMemo(() => {
    if (user?.isImpersonated) return `Simulando ${user.rol} (Admin)`;
    if (isAsesor) return "Asesor en sesión";
    if (user?.rol === "impulsador") return "Asesor impulsador";
    if (user?.rol === "supervisor") return "Supervisor en sesión";
    if (isAdmin) return "Administrador";
    return "Usuario en sesión";
  }, [isAsesor, user?.rol, user?.isImpersonated, isAdmin]);

  return (
    <>
      {/* DESKTOP SIDEBAR (Visible on xl: 1280px and above) */}
      <aside
        className={cn(
          "bg-[#FDFDFD] relative hidden xl:flex flex-col shrink-0 justify-between min-h-screen z-30 select-none transition-all duration-200 overflow-hidden",
          collapsed ? "w-0 border-r-0" : "w-60"
        )}
        id="sidebar"
      >
        {/* Línea difuminada vertical separando el panel lateral de la página principal */}
        {!collapsed && (
          <div className="absolute right-0 top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-neutral-300 to-transparent pointer-events-none z-40" />
        )}

        <div className="flex flex-col h-full justify-between">
          <div>
            {/* Workspace Brand Logo & Sleek Collapse Toggle */}
            <div className="h-12 flex items-center justify-between relative bg-[#FDFDFD] px-4 sm:px-5">
              <div className="absolute bottom-0 left-2 right-2 h-[1px] bg-gradient-to-r from-transparent via-neutral-200 to-transparent pointer-events-none" />

              <div className="sidebar-full-content flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-extrabold tracking-tight text-[#09090B] font-sans leading-none">
                    Comercialización<span className="text-emerald-600">.</span>
                  </span>
                </div>
                <button
                  onClick={toggle}
                  className="flex items-center justify-center text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
                  title="Contraer panel lateral"
                  aria-label="Contraer panel lateral"
                >
                  <PanelLeftClose className="w-4 h-4 stroke-[1.5]" />
                </button>
              </div>
            </div>

            {/* Navigation Groups: Clean Minimal Typographic Only */}
            {!collapsed && (
              <div className="py-4 px-3 space-y-6" suppressHydrationWarning>
                {visibleNavGroups.map((group, groupIdx) => (
                  <div key={groupIdx} className="space-y-1">
                    {group.groupTitle && (
                      <div className="pt-3 pb-1 px-2 select-none pointer-events-none">
                        <span className="sidebar-separator-title block">
                          {group.groupTitle}
                        </span>
                      </div>
                    )}
                    <nav className="space-y-0.5">
                      {group.items.map((item) => {
                        const isActive =
                          activeSection === item.id ||
                          (item.id === "personal" && activeSection === "configuracion") ||
                          (item.id === "admin" && activeSection === "administrador");
                        const className = cn(
                          "w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors text-left cursor-pointer",
                          isActive
                            ? "text-neutral-950 font-bold"
                            : "text-neutral-500 hover:text-neutral-900 font-medium"
                        );
                        const content = (
                          <>
                            <div className="flex flex-col items-start gap-1">
                              <span className="tracking-tight">{item.label}</span>
                              {isActive && (
                                <span className="w-4 h-[1.5px] bg-neutral-900 rounded-full" />
                              )}
                            </div>
                            {item.badge !== null && !isActive ? (
                              <span className="text-[11px] font-mono text-neutral-400 shrink-0">
                                {item.badge}
                              </span>
                            ) : null}
                          </>
                        );

                        if (item.href && item.href !== "#") {
                          return (
                            <Link
                              key={item.id}
                              href={item.href}
                              prefetch={true}
                              onClick={() => onSelectSection && onSelectSection(item.id)}
                              className={className}
                            >
                              {content}
                            </Link>
                          );
                        }

                        return (
                          <button
                            key={item.id}
                            onClick={() => onSelectSection && onSelectSection(item.id)}
                            className={className}
                          >
                            {content}
                          </button>
                        );
                      })}
                    </nav>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar Footer: User Session Indicator & Logout */}
          {!collapsed && (
            <div className="p-3 border-t border-neutral-100 flex items-center justify-between gap-1" suppressHydrationWarning>
              <div
                className={cn(
                  "flex-1 flex items-center justify-between text-left p-1.5 rounded transition-colors group min-w-0",
                  !isAsesorLocked ? "hover:bg-neutral-50 cursor-pointer" : "cursor-default"
                )}
                onClick={() => {
                  if (!isAsesorLocked) setAsesorModalOpen(true);
                }}
                title={!isAsesorLocked ? "Cambiar asesor activo para operaciones" : undefined}
              >
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] text-neutral-400 font-medium">{userRoleLabel}</span>
                  <span className="text-xs font-semibold text-neutral-900 truncate">
                    {user?.nombre || currentAsesor || "Seleccionar..."}
                  </span>
                </div>
                {!isAsesorLocked && (
                  <User className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-900 transition-colors shrink-0" />
                )}
              </div>
              {user?.isImpersonated ? (
                <button
                  type="button"
                  onClick={stopImpersonating}
                  className="p-1.5 text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer shrink-0 rounded flex items-center gap-1"
                  title="Restaurar sesión de Administrador"
                  aria-label="Restaurar Administrador"
                >
                  <RotateCcw className="w-3.5 h-3.5 stroke-[1.5]" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={logout}
                  className="p-1.5 text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer shrink-0 rounded"
                  title="Cerrar sesión"
                  aria-label="Cerrar sesión"
                >
                  <LogOut className="w-3.5 h-3.5 stroke-[1.5]" />
                </button>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* ============================================================ */}
      {/* MOBILE DRAWER BACKDROP & PANEL (Below xl screen sizes)       */}
      {/* ============================================================ */}
      <div
        className={cn(
          "fixed inset-0 bg-neutral-900/40 backdrop-blur-xs z-50 xl:hidden transition-opacity duration-200",
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={closeMobile}
        aria-hidden="true"
      />

      <div
        className={cn(
          "fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-[#FDFDFD] z-50 flex flex-col justify-between shadow-2xl xl:hidden transition-transform duration-300 ease-in-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full pointer-events-none"
        )}
        id="mobile-sidebar"
        role="dialog"
        aria-modal="true"
        aria-label="Panel de navegación lateral"
      >
        <div className="flex flex-col h-full justify-between overflow-y-auto">
          <div>
            {/* Mobile Drawer Header with Brand & Close Button */}
            <div className="h-16 flex items-center justify-between px-5 relative bg-[#FDFDFD] border-b border-neutral-200/80">
              <div className="flex items-center gap-2">
                <span className="text-sm font-extrabold tracking-tight text-[#09090B] font-sans">
                  Comercialización<span className="text-emerald-600">.</span>
                </span>
              </div>
              <button
                onClick={closeMobile}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer -mr-2"
                title="Cerrar panel lateral"
                aria-label="Cerrar panel lateral"
              >
                <X className="w-5 h-5 stroke-[1.75]" />
              </button>
            </div>

            {/* Navigation Groups Mobile */}
            <div className="py-4 px-3 space-y-5" suppressHydrationWarning>
              {visibleNavGroups.map((group, groupIdx) => (
                <div key={groupIdx} className="space-y-1">
                  {group.groupTitle && (
                    <div className="pt-3 pb-1 px-3 select-none pointer-events-none">
                      <span className="sidebar-separator-title block">
                        {group.groupTitle}
                      </span>
                    </div>
                  )}
                  <nav className="space-y-1">
                    {group.items.map((item) => {
                      const isActive =
                        activeSection === item.id ||
                        (item.id === "personal" && activeSection === "configuracion") ||
                        (item.id === "admin" && activeSection === "administrador");
                      const className = cn(
                        "w-full flex items-center justify-between px-3 py-3 min-h-[48px] text-xs transition-colors text-left cursor-pointer",
                        isActive
                          ? "text-neutral-950 font-bold"
                          : "text-neutral-500 hover:text-neutral-900 font-medium"
                      );
                      const content = (
                        <>
                          <div className="flex flex-col items-start gap-1">
                            <span className="tracking-tight text-sm font-medium">{item.label}</span>
                            {isActive && (
                              <span className="w-4 h-[1.5px] bg-neutral-900 rounded-full" />
                            )}
                          </div>
                          {item.badge !== null && !isActive ? (
                            <span className="text-[11px] font-mono text-neutral-400 shrink-0">
                              {item.badge}
                            </span>
                          ) : null}
                        </>
                      );

                      if (item.href && item.href !== "#") {
                        return (
                          <Link
                            key={item.id}
                            href={item.href}
                            prefetch={true}
                            onClick={() => {
                              if (onSelectSection) onSelectSection(item.id);
                              if (closeMobile) closeMobile();
                            }}
                            className={className}
                          >
                            {content}
                          </Link>
                        );
                      }

                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            if (onSelectSection) onSelectSection(item.id);
                            if (closeMobile) closeMobile();
                          }}
                          className={className}
                        >
                          {content}
                        </button>
                      );
                    })}
                  </nav>
                </div>
              ))}
            </div>
          </div>

          {/* Mobile Footer Asesor & Logout */}
          <div className="p-4 border-t border-neutral-100 flex items-center justify-between gap-2" suppressHydrationWarning>
            <div
              className={cn(
                "flex-1 flex items-center justify-between text-left p-2.5 min-h-[44px] transition-colors group min-w-0",
                !isAsesorLocked ? "hover:bg-neutral-50 cursor-pointer" : "cursor-default"
              )}
              onClick={() => {
                if (!isAsesorLocked) {
                  if (closeMobile) closeMobile();
                  setAsesorModalOpen(true);
                }
              }}
            >
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] text-neutral-400 font-medium">{userRoleLabel}</span>
                <span className="text-xs font-semibold text-neutral-900 truncate">
                  {user?.nombre || currentAsesor || "Seleccionar..."}
                </span>
              </div>
              {!isAsesorLocked && (
                <User className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-900 transition-colors shrink-0" />
              )}
            </div>
            {user?.isImpersonated ? (
              <button
                type="button"
                onClick={() => {
                  if (closeMobile) closeMobile();
                  stopImpersonating();
                }}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer shrink-0"
                title="Restaurar sesión de Administrador"
                aria-label="Restaurar Administrador"
              >
                <RotateCcw className="w-4 h-4 stroke-[1.5]" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (closeMobile) closeMobile();
                  logout();
                }}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer shrink-0"
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
              >
                <LogOut className="w-4 h-4 stroke-[1.5]" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* ASESOR SELECTOR MODAL (Rule 4: In-app modal with backdrop)    */}
      {/* ============================================================ */}
      {asesorModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/20 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setAsesorModalOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-xl shadow-xl p-5 space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-900 tracking-tight">
                Seleccionar asesor en sesión
              </h3>
              <button
                type="button"
                onClick={() => setAsesorModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4 stroke-[1.5]" />
              </button>
            </div>

            <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-neutral-200 to-transparent" />

            <p className="text-xs text-neutral-500">
              Elige el asesor que está cargando actividades, solicitudes y reportes de campo en esta sesión.
            </p>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-0 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={asesorSearch}
                onChange={(e) => setAsesorSearch(e.target.value)}
                placeholder="Buscar asesor..."
                className="w-full pl-6 pr-2 py-1.5 text-xs bg-transparent border-b border-neutral-200 focus:border-neutral-900 text-neutral-900 placeholder:text-neutral-400 focus:outline-none transition-colors"
              />
            </div>

            <div className="max-h-60 overflow-y-auto divide-y divide-neutral-100 py-1">
              {availableAsesores
                .filter((asesorName) =>
                  asesorName.toLowerCase().includes(asesorSearch.toLowerCase().trim())
                )
                .map((asesorName) => {
                  const isSelected = currentAsesor === asesorName;
                  return (
                    <button
                      key={asesorName}
                      type="button"
                      onClick={() => {
                        setCurrentAsesor(asesorName);
                        setAsesorModalOpen(false);
                        setAsesorSearch("");
                      }}
                      className={cn(
                        "w-full text-left py-2 px-1 text-xs transition-colors flex items-center justify-between cursor-pointer",
                        isSelected
                          ? "text-neutral-950 font-semibold"
                          : "text-neutral-500 hover:text-neutral-950"
                      )}
                    >
                      <span>{asesorName}</span>
                      {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-neutral-900" />}
                    </button>
                  );
                })}
              {availableAsesores.filter((a) =>
                a.toLowerCase().includes(asesorSearch.toLowerCase().trim())
              ).length === 0 && (
                <div className="py-4 text-center text-xs text-neutral-400">
                  No se encontraron asesores activos con ese nombre
                </div>
              )}
            </div>

            <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-neutral-200 to-transparent" />

            <div className="flex items-center justify-end pt-1">
              <button
                type="button"
                onClick={() => {
                  setAsesorModalOpen(false);
                  setAsesorSearch("");
                }}
                className="text-xs text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
