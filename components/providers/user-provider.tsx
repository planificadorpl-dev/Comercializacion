"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  AppUser,
  AppUserRole,
  getCurrentSessionUser,
  loginUser,
  logoutUser,
  impersonateUser,
  stopImpersonation,
} from "@/app/actions/auth";

interface UserContextType {
  user: AppUser | null;
  isLoading: boolean;
  login: (credentials: { emailOrUsername: string; password: string }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  impersonate: (userId: string) => Promise<{ success: boolean; error?: string }>;
  stopImpersonating: () => Promise<{ success: boolean; error?: string }>;
  isImpersonating: boolean;
  hasRole: (role: AppUserRole) => boolean;
  isAsesor: boolean;
  isSupervisor: boolean;
  isImpulsador: boolean;
  isSupervisorOrImpulsador: boolean;
  isAdmin: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

// Route permission definitions
const FIELD_OPERATIONS_ROUTES = ["/actividades", "/solicitudes", "/competencia"];
const SUPERVISION_ROUTES = ["/", "/planificacion", "/evaluaciones"];
const ADMIN_ROUTES = ["/admin"];

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();
  const pathname = usePathname();

  const fetchSession = useCallback(async () => {
    try {
      const current = await getCurrentSessionUser();
      if (current) {
        setUser(current);
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("ventas_current_user", JSON.stringify(current));
          } catch {}
        }
      } else {
        // If server confirms no active session and there is no cached token
        setUser(null);
        if (typeof window !== "undefined") {
          try {
            localStorage.removeItem("ventas_current_user");
          } catch {}
        }
      }
    } catch (err) {
      console.warn("Error checking session with server (retaining cached user if present):", err);
      // Do not clear user if network or server temporarily glitched
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Restore cached session on client mount to avoid hydration mismatch while retaining instant UX
    try {
      const cached = localStorage.getItem("ventas_current_user");
      if (cached) {
        setUser(JSON.parse(cached));
        setIsLoading(false);
      }
    } catch {}

    fetchSession();
  }, [fetchSession]);

  // Route guarding and permissions
  useEffect(() => {
    if (isLoading) return;

    const isLoginPage = pathname === "/login";

    // 1. Unauthenticated users must go to /login
    if (!user) {
      if (!isLoginPage) {
        window.location.href = "/login";
      }
      return;
    }

    // 2. Authenticated user sitting on /login -> redirect to their home
    if (isLoginPage) {
      window.location.href = user.rol === "asesor" ? "/actividades" : "/";
      return;
    }

    // 3. Role-based restrictions
    if (user.rol === "asesor") {
      // Asesores can ONLY see field operations: /actividades, /solicitudes, /competencia
      const isForbidden = SUPERVISION_ROUTES.some((r) => r === pathname || (r !== "/" && pathname.startsWith(r))) ||
        ADMIN_ROUTES.some((r) => pathname.startsWith(r));

      if (isForbidden) {
        window.location.href = "/actividades";
      }
    } else if (user.rol === "supervisor" || user.rol === "impulsador") {
      // Supervisores / Impulsadores can ONLY see the 3 top panels: /, /planificacion, /evaluaciones
      const isForbidden = FIELD_OPERATIONS_ROUTES.some((r) => pathname.startsWith(r)) ||
        ADMIN_ROUTES.some((r) => pathname.startsWith(r));

      if (isForbidden) {
        window.location.href = "/";
      }
    }
    // Admins have access to all routes
  }, [user, isLoading, pathname]);

  const handleLogin = async (credentials: { emailOrUsername: string; password: string }) => {
    const res = await loginUser(credentials);
    if (res.success && res.user) {
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("ventas_current_user", JSON.stringify(res.user));
        } catch {}
      }
      const target = res.user.rol === "asesor" ? "/actividades" : "/";
      window.location.href = target;
    }
    return res;
  };

  const handleLogout = async () => {
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("ventas_current_user");
      } catch {}
    }
    try {
      await logoutUser();
    } catch {}
    window.location.href = "/login";
  };

  const handleImpersonate = async (targetUserId: string) => {
    setIsLoading(true);
    try {
      const res = await impersonateUser(targetUserId);
      if (res.success && res.user) {
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("ventas_current_user", JSON.stringify(res.user));
          } catch {}
        }
        const target = res.user.rol === "asesor" ? "/actividades" : "/";
        window.location.href = target;
      }
      return res;
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopImpersonating = async () => {
    setIsLoading(true);
    try {
      const res = await stopImpersonation();
      if (res.success && res.user) {
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("ventas_current_user", JSON.stringify(res.user));
          } catch {}
        }
        window.location.href = "/admin?tab=usuarios";
      }
      return res;
    } finally {
      setIsLoading(false);
    }
  };

  const hasRole = (role: AppUserRole) => {
    if (!user) return false;
    if (user.rol === "admin") return true;
    return user.rol === role;
  };

  const isAsesor = user?.rol === "asesor";
  const isSupervisor = user?.rol === "supervisor";
  const isImpulsador = user?.rol === "impulsador";
  const isSupervisorOrImpulsador = isSupervisor || isImpulsador;
  const isAdmin = user?.rol === "admin";
  const isImpersonating = Boolean(user?.isImpersonated);

  const value = {
    user,
    isLoading,
    login: handleLogin,
    logout: handleLogout,
    refreshUser: fetchSession,
    impersonate: handleImpersonate,
    stopImpersonating: handleStopImpersonating,
    isImpersonating,
    hasRole,
    isAsesor,
    isSupervisor,
    isImpulsador,
    isSupervisorOrImpulsador,
    isAdmin,
  };

  return (
    <UserContext.Provider value={value}>
      {children}
      {user?.isImpersonated && (
        <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-3 py-1.5 bg-neutral-900/95 backdrop-blur-md text-white rounded-full shadow-2xl text-xs font-sans animate-in fade-in slide-in-from-top-2 duration-150 select-none border border-neutral-700/60 max-w-[calc(100vw-24px)]">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
          <div className="flex items-center gap-1.5 truncate text-[11px] sm:text-xs">
            <span className="text-neutral-400 hidden sm:inline">Viendo como:</span>
            <span className="font-semibold text-white truncate max-w-[140px] sm:max-w-none">{user.nombre}</span>
            <span className="text-neutral-400 font-mono text-[10px]">({user.rol})</span>
          </div>
          <button
            type="button"
            onClick={handleStopImpersonating}
            className="ml-1 sm:ml-2 px-2.5 py-0.5 rounded-full bg-white/20 hover:bg-white/30 text-white font-medium text-[11px] transition-colors cursor-pointer shrink-0"
            title="Restaurar tu sesión de Administrador"
          >
            Volver a Admin
          </button>
        </div>
      )}
    </UserContext.Provider>
  );
}

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
};
