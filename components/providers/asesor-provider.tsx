"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useUser } from "./user-provider";

type AsesorContextType = {
  currentAsesor: string;
  setCurrentAsesor: (asesor: string) => void;
  availableAsesores: string[];
  refreshAsesores: () => Promise<void>;
  isAdminAuthenticated: boolean;
  setIsAdminAuthenticated: (auth: boolean) => void;
  isAsesorLocked: boolean;
};

const DEFAULT_FALLBACK_ASESORES = [
  "Andrea Plaza",
  "Arianna Montaña",
  "Brainin Berrotera",
  "Cindy Infante",
  "Daiana Torres",
  "Danyelis Muñoz",
  "Diarnelis Mendoza",
  "Gabriela Marrero",
  "Genesis Ochoa",
  "Lorena Esqueda",
  "Maria Azuaje",
  "Naomi Tovar",
  "Patricia Mendoza",
  "Stephany Manrique",
  "Yaisen Herrera",
  "Yamery Rodriguez",
  "Yeilis Puentes",
  "Yesenia Teran",
  "Yilda Gonzalez",
  "Yuliana Carvajal",
];

// Set of known ex-collaborators or inactive advisors to purge from stale localStorage immediately
const STALE_EX_ADVISORS_SET = new Set([
  "haymar barros",
  "johana parra",
  "johanna parra",
  "harry moreno",
  "michel ochoa",
  "carla figueroa",
  "accel moreno",
  "roxana yepez",
  "xahory gómez",
  "xahory gomez",
  "yosmery hernández",
  "yosmery hernandez",
  "planificación",
  "planificacion",
  "carlos ruiz",
  "greacie cruzado",
  "gracie cruzado",
]);

let globalCachedAsesores: string[] | null = null;

const AsesorContext = createContext<AsesorContextType>({
  currentAsesor: "",
  setCurrentAsesor: () => {},
  availableAsesores: DEFAULT_FALLBACK_ASESORES,
  refreshAsesores: async () => {},
  isAdminAuthenticated: false,
  setIsAdminAuthenticated: () => {},
  isAsesorLocked: false,
});

export function AsesorProvider({ children }: { children: React.ReactNode }) {
  const { user, isAdmin } = useUser();
  const [currentAsesor, setCurrentAsesorState] = useState("");
  const [availableAsesores, setAvailableAsesores] = useState<string[]>(
    globalCachedAsesores || DEFAULT_FALLBACK_ASESORES
  );
  const [isAdminAuthenticated, setIsAdminAuthenticatedState] = useState(false);

  const CACHE_VERSION = "v3_active_20";

  // Automatically lock session to logged in advisor
  useEffect(() => {
    if (user?.rol === "asesor" && user.nombre) {
      setCurrentAsesorState(user.nombre);
      try {
        localStorage.setItem("current_asesor", user.nombre);
      } catch {}
    }
  }, [user]);

  // Sync admin authentication
  useEffect(() => {
    if (isAdmin) {
      setIsAdminAuthenticatedState(true);
    }
  }, [isAdmin]);

  const fetchAsesoresList = async () => {
    try {
      const { getAsesores } = await import("@/app/actions/asesores");
      const data = await getAsesores(true);
      if (data && data.length > 0) {
        const names = data.map((a: any) => a.nombre);
        globalCachedAsesores = names;
        setAvailableAsesores(names);
        try {
          localStorage.setItem("cached_available_asesores", JSON.stringify(names));
          localStorage.setItem("cached_asesores_version", CACHE_VERSION);
        } catch {}

        if (user?.rol === "asesor" && user.nombre) {
          setCurrentAsesorState(user.nombre);
        } else {
          setCurrentAsesorState((prev) => {
            if (prev && !names.includes(prev)) {
              try {
                localStorage.removeItem("current_asesor");
              } catch {}
              return "";
            }
            return prev;
          });
        }
      }
    } catch {
      // Keep fallbacks
    }
  };

  useEffect(() => {
    try {
      const savedVersion = localStorage.getItem("cached_asesores_version");
      if (savedVersion !== CACHE_VERSION) {
        localStorage.removeItem("cached_available_asesores");
        localStorage.setItem("cached_asesores_version", CACHE_VERSION);
        globalCachedAsesores = DEFAULT_FALLBACK_ASESORES;
        setAvailableAsesores(DEFAULT_FALLBACK_ASESORES);
      }

      if (user?.rol === "asesor" && user.nombre) {
        setCurrentAsesorState(user.nombre);
      } else {
        const stored = localStorage.getItem("current_asesor");
        if (stored) {
          if (
            STALE_EX_ADVISORS_SET.has(stored.toLowerCase().trim()) ||
            !DEFAULT_FALLBACK_ASESORES.some(
              (a) => a.toLowerCase().trim() === stored.toLowerCase().trim()
            )
          ) {
            localStorage.removeItem("current_asesor");
            setCurrentAsesorState("");
          } else {
            setCurrentAsesorState(stored);
          }
        }
      }

      const cached = localStorage.getItem("cached_available_asesores");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const sanitized = parsed.filter(
            (name: string) => !STALE_EX_ADVISORS_SET.has(String(name).toLowerCase().trim())
          );
          if (sanitized.length > 0) {
            globalCachedAsesores = sanitized;
            setAvailableAsesores(sanitized);
          }
        }
      }

      const adminAuth = localStorage.getItem("admin_auth");
      if (adminAuth === "true" || isAdmin) {
        setIsAdminAuthenticatedState(true);
      }
    } catch {
      // LocalStorage unavailable
    }

    fetchAsesoresList();
  }, [user, isAdmin]);

  const setCurrentAsesor = (asesor: string) => {
    // If the logged-in user is an advisor, their identity is strictly locked to their account
    if (user?.rol === "asesor") return;

    setCurrentAsesorState(asesor);
    try {
      localStorage.setItem("current_asesor", asesor);
    } catch {}
  };

  const setIsAdminAuthenticated = (auth: boolean) => {
    setIsAdminAuthenticatedState(auth);
    try {
      if (auth) {
        localStorage.setItem("admin_auth", "true");
      } else {
        localStorage.removeItem("admin_auth");
      }
    } catch {}
  };

  return (
    <AsesorContext.Provider
      value={{
        currentAsesor,
        setCurrentAsesor,
        availableAsesores,
        refreshAsesores: fetchAsesoresList,
        isAdminAuthenticated,
        setIsAdminAuthenticated,
        isAsesorLocked: user?.rol === "asesor",
      }}
    >
      {children}
    </AsesorContext.Provider>
  );
}

export const useAsesor = () => useContext(AsesorContext);
