"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { SystemModule, DEFAULT_SYSTEM_MODULES } from "@/lib/modules-types";

interface ModulesContextType {
  modules: SystemModule[];
  isLoading: boolean;
  isModuleEnabledForUser: (idOrRoute: string, isAdmin?: boolean) => boolean;
  toggleModule: (id: string, enabledForUsers: boolean) => Promise<{ success: boolean; error?: string }>;
  refreshModules: () => Promise<void>;
}

const ModulesContext = createContext<ModulesContextType | undefined>(undefined);

export function ModulesProvider({ children }: { children: React.ReactNode }) {
  const [modules, setModules] = useState<SystemModule[]>(DEFAULT_SYSTEM_MODULES);
  const [isLoading, setIsLoading] = useState(true);

  const fetchModules = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/modules?t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.modules)) {
        setModules(data.modules);
      }
    } catch (err) {
      console.warn("Could not load system modules:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModules();

    // Listen to custom cross-tab or in-page module updates
    const handleSync = () => {
      fetchModules();
    };
    window.addEventListener("modules-updated", handleSync);
    window.addEventListener("focus", handleSync);

    return () => {
      window.removeEventListener("modules-updated", handleSync);
      window.removeEventListener("focus", handleSync);
    };
  }, [fetchModules]);

  const isModuleEnabledForUser = useCallback(
    (idOrRoute: string, isAdmin = false): boolean => {
      // Administrators always have full access to everything
      if (isAdmin) return true;

      const cleanTarget = idOrRoute.toLowerCase().trim();
      const mod = modules.find(
        (m) =>
          m.id.toLowerCase() === cleanTarget ||
          m.route.toLowerCase() === cleanTarget ||
          (cleanTarget !== "/" && m.route.toLowerCase().startsWith(cleanTarget))
      );

      // If module is not configured, permit by default
      if (!mod) return true;

      return mod.enabledForUsers;
    },
    [modules]
  );

  const toggleModule = useCallback(
    async (id: string, enabledForUsers: boolean): Promise<{ success: boolean; error?: string }> => {
      // Optimistic update
      setModules((prev) =>
        prev.map((m) =>
          m.id === id
            ? { ...m, enabledForUsers, updatedAt: new Date().toISOString() }
            : m
        )
      );

      try {
        const res = await fetch("/api/admin/modules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ moduleId: id, enabledForUsers }),
        });
        const data = await res.json();
        if (data.success && Array.isArray(data.modules)) {
          setModules(data.modules);
          window.dispatchEvent(new CustomEvent("modules-updated"));
          return { success: true };
        } else {
          // Rollback on failure
          await fetchModules();
          return { success: false, error: data.error || "Error al actualizar" };
        }
      } catch (err: any) {
        await fetchModules();
        return { success: false, error: err.message || "Error de red" };
      }
    },
    [fetchModules]
  );

  return (
    <ModulesContext.Provider
      value={{
        modules,
        isLoading,
        isModuleEnabledForUser,
        toggleModule,
        refreshModules: fetchModules,
      }}
    >
      {children}
    </ModulesContext.Provider>
  );
}

export function useModules() {
  const context = useContext(ModulesContext);
  if (!context) {
    throw new Error("useModules must be used within a ModulesProvider");
  }
  return context;
}
