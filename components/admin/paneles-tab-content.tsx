"use client";

import { useState, useMemo } from "react";
import { RotateCw, Search, ShieldAlert, Check, Layers } from "lucide-react";
import { useModules } from "@/components/providers/modules-provider";
import { SystemModule } from "@/lib/modules-types";
import { cn } from "@/lib/utils";

interface PanelesTabContentProps {
  showToast: (text: string, type?: "success" | "error") => void;
}

export function PanelesTabContent({ showToast }: PanelesTabContentProps) {
  const { modules, isLoading, toggleModule, refreshModules } = useModules();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "enabled" | "disabled">("all");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Filtered module list
  const filteredModules = useMemo(() => {
    return modules.filter((m) => {
      // Status filter
      if (filterStatus === "enabled" && !m.enabledForUsers) return false;
      if (filterStatus === "disabled" && m.enabledForUsers) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = m.name.toLowerCase().includes(q);
        const matchesRoute = m.route.toLowerCase().includes(q);
        const matchesDesc = m.description.toLowerCase().includes(q);
        const matchesCategory = m.category.toLowerCase().includes(q);
        return matchesName || matchesRoute || matchesDesc || matchesCategory;
      }

      return true;
    });
  }, [modules, filterStatus, searchQuery]);

  // Metric counts
  const totalCount = modules.length;
  const enabledCount = modules.filter((m) => m.enabledForUsers).length;
  const disabledCount = modules.filter((m) => !m.enabledForUsers).length;

  const handleToggle = async (module: SystemModule) => {
    const nextState = !module.enabledForUsers;
    setTogglingId(module.id);
    try {
      const res = await toggleModule(module.id, nextState);
      if (res.success) {
        showToast(
          nextState
            ? `Panel "${module.name}" habilitado para usuarios`
            : `Panel "${module.name}" restringido a solo Administrador`,
          "success"
        );
      } else {
        showToast(res.error || "No se pudo actualizar el estado del panel", "error");
      }
    } catch {
      showToast("Error de conexión al cambiar disponibilidad del panel", "error");
    } finally {
      setTogglingId(null);
    }
  };

  const getTargetRolesText = (roles: string[]) => {
    if (roles.includes("asesor") && !roles.includes("supervisor")) {
      return "Asesores de campo";
    }
    if (roles.includes("supervisor") || roles.includes("impulsador")) {
      return "Supervisores e impulsadores";
    }
    return "Todos los roles autorizados";
  };

  return (
    <div className="space-y-6">
      {/* Metrics Section: Strict Rule 5 - Zero uppercase, no decorative icons in headers */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Metric 1 */}
        <div className="p-4 rounded-lg bg-neutral-50/70 border border-neutral-200/70 space-y-1">
          <p className="text-xs text-neutral-500 font-sans">Paneles registrados</p>
          <p className="text-2xl font-bold tracking-tight text-neutral-900 font-sans">
            {totalCount}
          </p>
          <p className="text-[11px] text-neutral-400 font-sans">
            Módulos del ecosistema comercial
          </p>
        </div>

        {/* Metric 2 */}
        <div className="p-4 rounded-lg bg-neutral-50/70 border border-neutral-200/70 space-y-1">
          <p className="text-xs text-neutral-500 font-sans">Habilitados para usuarios</p>
          <p className="text-2xl font-bold tracking-tight text-emerald-600 font-sans">
            {enabledCount}
          </p>
          <p className="text-[11px] text-neutral-400 font-sans">
            Visibles para asesores y supervisores
          </p>
        </div>

        {/* Metric 3 */}
        <div className="p-4 rounded-lg bg-neutral-50/70 border border-neutral-200/70 space-y-1">
          <p className="text-xs text-neutral-500 font-sans">Restringidos a administrador</p>
          <p className="text-2xl font-bold tracking-tight text-amber-600 font-sans">
            {disabledCount}
          </p>
          <p className="text-[11px] text-neutral-400 font-sans">
            En desarrollo o mantenimiento
          </p>
        </div>
      </div>

      {/* Description & Search / Filter Bar */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900 font-sans">
              Disponibilidad de paneles y módulos
            </h2>
            <p className="text-xs text-neutral-500 font-sans mt-0.5">
              Desactiva temporalmente los paneles que no están listos para usuarios generales.
              Tú como Administrador siempre mantienes acceso total a todos los paneles.
            </p>
          </div>

          <button
            type="button"
            onClick={refreshModules}
            disabled={isLoading}
            className="self-start sm:self-auto p-1 text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
            title="Sincronizar módulos"
            aria-label="Sincronizar módulos"
          >
            <RotateCw className={cn("w-4 h-4", isLoading && "animate-spin text-neutral-900")} />
          </button>
        </div>

        {/* Filters and search: Strict Rule 1 - Clean words, zero frames on buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-b border-neutral-200/80 pb-3">
          {/* Typographic status filters */}
          <div className="flex items-center gap-4 text-xs">
            <button
              type="button"
              onClick={() => setFilterStatus("all")}
              className={cn(
                "transition-colors cursor-pointer select-none",
                filterStatus === "all"
                  ? "text-neutral-950 font-semibold"
                  : "text-neutral-400 hover:text-neutral-900 font-medium"
              )}
            >
              Todos ({totalCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus("enabled")}
              className={cn(
                "transition-colors cursor-pointer select-none",
                filterStatus === "enabled"
                  ? "text-neutral-950 font-semibold"
                  : "text-neutral-400 hover:text-neutral-900 font-medium"
              )}
            >
              Habilitados ({enabledCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus("disabled")}
              className={cn(
                "transition-colors cursor-pointer select-none",
                filterStatus === "disabled"
                  ? "text-neutral-950 font-semibold"
                  : "text-neutral-400 hover:text-neutral-900 font-medium"
              )}
            >
              Solo Administrador ({disabledCount})
            </button>
          </div>

          {/* Search Input: Minimalist input with bottom border, no box */}
          <div className="relative flex items-center min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar panel o ruta..."
              className="w-full bg-transparent pl-7 pr-3 py-1 text-xs font-sans text-neutral-900 placeholder:text-neutral-400 border-b border-neutral-200 focus:border-neutral-900 focus:outline-none transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Modules Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-neutral-200 text-neutral-400 font-medium select-none">
              <th className="py-2.5 px-3 font-normal">Panel / Módulo</th>
              <th className="py-2.5 px-3 font-normal">Ruta</th>
              <th className="py-2.5 px-3 font-normal">Audiencia no admin</th>
              <th className="py-2.5 px-3 font-normal">Estado para usuarios</th>
              <th className="py-2.5 px-3 font-normal text-right">Acceso usuarios</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 font-sans">
            {filteredModules.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-neutral-400 font-sans">
                  No se encontraron paneles con los criterios indicados.
                </td>
              </tr>
            ) : (
              filteredModules.map((m) => {
                const isSpecialTarget = m.id === "planificacion" || m.id === "competencia";
                const isToggling = togglingId === m.id;

                return (
                  <tr
                    key={m.id}
                    className="group hover:bg-neutral-50/50 transition-colors"
                  >
                    {/* Module Name and Description */}
                    <td className="py-3 px-3">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-neutral-900">
                            {m.name}
                          </span>
                          {isSpecialTarget && (
                            <span className="text-[10px] font-mono text-neutral-400 font-normal">
                              (Módulo en preparación)
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-neutral-500 font-normal mt-0.5 line-clamp-1 max-w-md">
                          {m.description}
                        </span>
                      </div>
                    </td>

                    {/* Route */}
                    <td className="py-3 px-3">
                      <span className="font-mono text-[11px] text-neutral-600">
                        {m.route}
                      </span>
                    </td>

                    {/* Target Roles */}
                    <td className="py-3 px-3 text-neutral-500 text-[11px]">
                      {getTargetRolesText(m.targetRoles)}
                    </td>

                    {/* Status Indicator */}
                    <td className="py-3 px-3">
                      <div className="inline-flex items-center gap-1.5 text-[11px] font-medium">
                        <span
                          className={cn(
                            "w-1.5 h-1.5 rounded-full shrink-0",
                            m.enabledForUsers ? "bg-emerald-500" : "bg-amber-500"
                          )}
                        />
                        <span
                          className={
                            m.enabledForUsers
                              ? "text-neutral-800"
                              : "text-neutral-600"
                          }
                        >
                          {m.enabledForUsers
                            ? "Habilitado para usuarios"
                            : "Solo Administrador"}
                        </span>
                      </div>
                    </td>

                    {/* Toggle Control: Strict Rule 1 - Clean minimal toggle switch, zero frames */}
                    <td className="py-3 px-3 text-right">
                      <div className="inline-flex items-center justify-end gap-2.5">
                        <button
                          type="button"
                          onClick={() => handleToggle(m)}
                          disabled={isToggling}
                          className={cn(
                            "group/switch relative inline-flex h-4 w-8 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none select-none",
                            m.enabledForUsers ? "bg-emerald-500" : "bg-neutral-300",
                            isToggling && "opacity-50 cursor-wait"
                          )}
                          title={
                            m.enabledForUsers
                              ? "Haz clic para restringir a solo Administrador"
                              : "Haz clic para habilitar para todos los usuarios autorizados"
                          }
                          aria-label={`Cambiar disponibilidad de ${m.name}`}
                        >
                          <span
                            className={cn(
                              "pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out mt-0.5",
                              m.enabledForUsers ? "translate-x-4 ml-0.5" : "translate-x-0.5"
                            )}
                          />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggle(m)}
                          disabled={isToggling}
                          className={cn(
                            "text-xs transition-colors cursor-pointer select-none",
                            m.enabledForUsers
                              ? "text-neutral-400 hover:text-neutral-900"
                              : "text-neutral-700 hover:text-neutral-950 font-medium"
                          )}
                        >
                          {m.enabledForUsers ? "Desactivar" : "Activar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Informative note footer (Strict Rule 2 - feedback minimalista y discreto, sin banners de alerta) */}
      <div className="pt-3 border-t border-neutral-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] text-neutral-400 font-sans">
        <span>
          Cualquier cambio se aplica en tiempo real a la barra de navegación y al control de acceso de todos los usuarios.
        </span>
        <span className="font-mono text-[10px]">
          Sincronizado local y Supabase
        </span>
      </div>
    </div>
  );
}
