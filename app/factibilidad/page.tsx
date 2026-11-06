"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  Menu,
  RotateCcw,
  Search,
  Sun,
  Moon,
  MapPin,
  Maximize2,
  Copy,
  Check,
  ChevronDown,
  X,
  Navigation,
} from "lucide-react";
import { SidebarOpenButton } from "@/components/providers/sidebar-provider";
import { Sidebar } from "@/components/dashboard/sidebar";
import { MobileBottomNav } from "@/components/dashboard/mobile-nav";
import { useSidebar } from "@/components/providers/sidebar-provider";
import { useUser } from "@/components/providers/user-provider";
import type { OzBox } from "@/lib/ozmap-service";
import { cn } from "@/lib/utils";

// Dynamically import Leaflet Map (SSR False)
const FactibilidadMap = dynamic(
  () => import("@/components/factibilidad/FactibilidadMap"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full min-h-[500px] flex items-center justify-center text-xs font-mono text-neutral-400">
        Iniciando mapa Carto...
      </div>
    ),
  }
);

export default function FactibilidadPage() {
  const { isMobileOpen, openMobileSidebar, closeMobileSidebar } = useSidebar();
  const { user } = useUser();

  const [boxes, setBoxes] = useState<OzBox[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carto Theme toggle: 'dark' or 'light'
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // Filters
  const [filterType, setFilterType] = useState<"all" | "naps" | "mangas" | "disponibles">("disponibles");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBox, setSelectedBox] = useState<OzBox | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  // Fetch boxes from API
  const loadBoxes = useCallback(async (forceRefresh = false) => {
    try {
      if (forceRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const res = await fetch(`/api/factibilidad${forceRefresh ? "?refresh=true" : ""}`);
      const json = await res.json();

      if (json.success && Array.isArray(json.data)) {
        setBoxes(json.data);
      } else {
        setError(json.error || "No se pudieron obtener las cajas de OZmap");
      }
    } catch (err: any) {
      console.error("Error al cargar cajas:", err);
      setError("Error de conexión al consultar el servidor");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadBoxes();
  }, [loadBoxes]);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = boxes.length;
    const naps = boxes.filter((b) => b.isNap);
    const disponibles = naps.filter((b) => b.availablePorts > 0).length;
    const saturadas = naps.filter((b) => b.availablePorts === 0).length;
    const mangas = boxes.filter((b) => !b.isNap).length;

    return { total, naps: naps.length, disponibles, saturadas, mangas };
  }, [boxes]);

  // Copy coordinates to clipboard
  const handleCopyCoords = (box: OzBox) => {
    const text = `${box.lat.toFixed(6)}, ${box.lng.toFixed(6)}`;
    navigator.clipboard.writeText(text);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Open in Google Maps navigation
  const handleOpenGoogleMaps = (box: OzBox) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${box.lat},${box.lng}`;
    window.open(url, "_blank");
  };

  return (
    <div className="flex h-screen bg-[#FAFAFA] text-neutral-900 font-sans antialiased overflow-hidden">
      {/* Desktop Sidebar */}
      <Sidebar activeSection="factibilidad" />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header - Minimalist, zero boxes */}
        <header className="sticky top-0 z-20 flex items-center justify-between px-4 sm:px-6 py-3.5 bg-[#FAFAFA]/90 backdrop-blur-xs border-b border-neutral-100">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={openMobileSidebar}
              className="xl:hidden -ml-2 p-2 text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
              title="Abrir menú"
              aria-label="Abrir menú"
            >
              <Menu className="w-4 h-4 stroke-[1.5]" />
            </button>
            <SidebarOpenButton />
            <div>
              <h1 className="text-sm font-semibold text-neutral-900 tracking-tight">
                Factibilidad de Campo
              </h1>
              <p className="text-[11px] text-neutral-400 font-mono">
                Cajas y puertos en tiempo real vía OZmap
              </p>
            </div>
          </div>

          {/* Action icons / stats */}
          <div className="flex items-center gap-3">
            {/* Quick stats indicator */}
            <div className="hidden md:flex items-center gap-4 text-xs font-mono text-neutral-400">
              <span>
                <strong className="text-emerald-600 font-medium">{stats.disponibles}</strong> libres
              </span>
              <span>
                <strong className="text-neutral-700 font-medium">{stats.naps}</strong> NAPs
              </span>
              <span>
                <strong className="text-neutral-500 font-medium">{stats.mangas}</strong> mangas
              </span>
            </div>

            <div className="h-3 w-[1px] bg-neutral-200 hidden md:block" />

            {/* Carto Theme Switcher (Dark / Light) */}
            <button
              type="button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title={`Cambiar a versión ${theme === "dark" ? "clara" : "oscura"} de Carto`}
              className="p-1.5 text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer flex items-center gap-1 text-xs font-mono"
            >
              {theme === "dark" ? (
                <>
                  <Sun className="w-3.5 h-3.5 stroke-[1.5]" />
                  <span className="hidden sm:inline">Claro</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 stroke-[1.5]" />
                  <span className="hidden sm:inline">Oscuro</span>
                </>
              )}
            </button>

            {/* Refresh from OZmap */}
            <button
              type="button"
              onClick={() => loadBoxes(true)}
              title="Sincronizar con OZmap"
              disabled={refreshing}
              className={cn(
                "p-1.5 text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer",
                refreshing && "animate-spin"
              )}
            >
              <RotateCcw className="w-3.5 h-3.5 stroke-[1.5]" />
            </button>
          </div>
        </header>

        {/* Sub Header - Search & Filter Tabs */}
        <div className="px-4 sm:px-6 py-2 border-b border-neutral-100 flex flex-wrap items-center justify-between gap-3 bg-white/60">
          {/* Typographic filter buttons */}
          <div className="flex items-center gap-4 text-xs font-mono">
            <button
              type="button"
              onClick={() => setFilterType("disponibles")}
              className={cn(
                "transition-colors cursor-pointer pb-0.5",
                filterType === "disponibles"
                  ? "text-neutral-950 font-semibold border-b border-neutral-900"
                  : "text-neutral-400 hover:text-neutral-700"
              )}
            >
              Disponibles
            </button>
            <button
              type="button"
              onClick={() => setFilterType("naps")}
              className={cn(
                "transition-colors cursor-pointer pb-0.5",
                filterType === "naps"
                  ? "text-neutral-950 font-semibold border-b border-neutral-900"
                  : "text-neutral-400 hover:text-neutral-700"
              )}
            >
              Todas las NAPs
            </button>
            <button
              type="button"
              onClick={() => setFilterType("mangas")}
              className={cn(
                "transition-colors cursor-pointer pb-0.5",
                filterType === "mangas"
                  ? "text-neutral-950 font-semibold border-b border-neutral-900"
                  : "text-neutral-400 hover:text-neutral-700"
              )}
            >
              Mangas
            </button>
            <button
              type="button"
              onClick={() => setFilterType("all")}
              className={cn(
                "transition-colors cursor-pointer pb-0.5",
                filterType === "all"
                  ? "text-neutral-950 font-semibold border-b border-neutral-900"
                  : "text-neutral-400 hover:text-neutral-700"
              )}
            >
              Todo
            </button>
          </div>

          {/* Search box - Minimalist underline input */}
          <div className="relative flex items-center min-w-[200px] sm:min-w-[260px]">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-0" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar caja, sector o PON..."
              className="w-full pl-6 pr-6 py-1 text-xs bg-transparent border-b border-neutral-200 focus:border-neutral-900 outline-none text-neutral-800 placeholder-neutral-400 font-sans transition-colors"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-0 text-neutral-400 hover:text-neutral-700"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Map Canvas and Selected Box Details Drawer */}
        <div className="relative flex-1 w-full h-full overflow-hidden">
          {loading ? (
            <div className="w-full h-full flex flex-col items-center justify-center space-y-2 text-xs font-mono text-neutral-400">
              <span className="w-2 h-2 rounded-full bg-neutral-400 animate-ping" />
              <span>Conectando con OZmap y cargando cajas...</span>
            </div>
          ) : error ? (
            <div className="w-full h-full flex flex-col items-center justify-center space-y-3 text-xs font-mono text-neutral-400 p-6 text-center">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => loadBoxes(true)}
                className="text-neutral-900 font-medium underline underline-offset-4 cursor-pointer"
              >
                Reintentar conexión
              </button>
            </div>
          ) : (
            <FactibilidadMap
              boxes={boxes}
              theme={theme}
              selectedBox={selectedBox}
              onSelectBox={setSelectedBox}
              filterType={filterType}
              searchTerm={searchTerm}
            />
          )}

          {/* Minimalist Floating Details Panel (Bottom Left on Desktop, Bottom Sheet on Mobile) */}
          {selectedBox && (
            <div
              className={cn(
                "absolute bottom-4 left-4 right-4 sm:right-auto sm:w-84 z-20",
                "bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md",
                "border border-neutral-200/80 dark:border-neutral-800 shadow-lg p-4 space-y-3 rounded-none animate-in fade-in slide-in-from-bottom-2 duration-150"
              )}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2 border-b border-neutral-100 dark:border-neutral-800 pb-2">
                <div>
                  <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 font-sans">
                    {selectedBox.name}
                  </div>
                  <div className="text-[10px] text-neutral-400 font-mono">
                    {selectedBox.boxTypeName} &bull; {selectedBox.sector || "Sector no esp."}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedBox(null)}
                  className="text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5 stroke-[1.5]" />
                </button>
              </div>

              {/* Ports & Capacity Details */}
              {selectedBox.isNap ? (
                <div className="grid grid-cols-3 gap-2 text-center py-1">
                  <div>
                    <span className="text-[10px] text-neutral-400 font-mono block">Libres</span>
                    <span
                      className={cn(
                        "text-sm font-semibold font-mono",
                        selectedBox.availablePorts > 2
                          ? "text-emerald-600"
                          : selectedBox.availablePorts > 0
                          ? "text-amber-600"
                          : "text-red-500"
                      )}
                    >
                      {selectedBox.availablePorts}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-400 font-mono block">Ocupados</span>
                    <span className="text-sm font-medium font-mono text-neutral-600 dark:text-neutral-300">
                      {selectedBox.usedPorts}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-400 font-mono block">Total</span>
                    <span className="text-sm font-medium font-mono text-neutral-600 dark:text-neutral-300">
                      {selectedBox.totalPorts}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono">
                  Manga de empalme / Distribución troncal
                </div>
              )}

              {/* Extra technical fields */}
              {(selectedBox.potencia || selectedBox.pon) && (
                <div className="text-[10px] font-mono space-y-1 text-neutral-500 dark:text-neutral-400 border-t border-neutral-100 dark:border-neutral-800 pt-2">
                  {selectedBox.potencia && (
                    <div>
                      Potencia: <span className="text-neutral-900 dark:text-white font-medium">{selectedBox.potencia}</span>
                    </div>
                  )}
                  {selectedBox.pon && (
                    <div>
                      PON: <span className="text-neutral-900 dark:text-white font-medium">{selectedBox.pon}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons: Copy coordinates & Google Maps navigation */}
              <div className="flex items-center justify-between gap-2 border-t border-neutral-100 dark:border-neutral-800 pt-2">
                <button
                  type="button"
                  onClick={() => handleCopyCoords(selectedBox)}
                  className="text-[11px] font-mono text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer flex items-center gap-1"
                >
                  {copiedId ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 stroke-[1.25]" />}
                  <span>{copiedId ? "Copiadas" : "Coordenadas"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenGoogleMaps(selectedBox)}
                  className="text-[11px] font-mono text-neutral-700 dark:text-neutral-200 hover:text-neutral-950 dark:hover:text-white transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Navigation className="w-3 h-3 stroke-[1.25]" />
                  <span>Cómo llegar</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
    </div>
  );
}
