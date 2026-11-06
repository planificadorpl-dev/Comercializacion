"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  Menu,
  RotateCw,
  Search,
  Sun,
  Moon,
  Layers,
  MapPin,
  Copy,
  Check,
  Navigation,
  X,
  ExternalLink,
} from "lucide-react";
import { SidebarOpenButton, useSidebar } from "@/components/providers/sidebar-provider";
import { Sidebar } from "@/components/dashboard/sidebar";
import { MobileBottomNav } from "@/components/dashboard/mobile-nav";
import { useUser } from "@/components/providers/user-provider";
import type { OzBox } from "@/lib/ozmap-service";
import { cn } from "@/lib/utils";

// Leaflet map with dynamic import (SSR disabled)
const FactibilidadMap = dynamic(
  () => import("@/components/factibilidad/FactibilidadMap"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full min-h-[450px] flex items-center justify-center text-xs font-mono text-neutral-400 bg-neutral-50/50">
        Iniciando mapa Carto...
      </div>
    ),
  }
);

// Calculate distance between two lat/lng points using Haversine formula
function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3;
  const radLat1 = (lat1 * Math.PI) / 180;
  const radLat2 = (lat2 * Math.PI) / 180;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(radLat1) * Math.cos(radLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

export default function FactibilidadPage() {
  const { openMobileSidebar } = useSidebar();
  const { user } = useUser();

  const [boxes, setBoxes] = useState<OzBox[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Map Theme: 'light' (Carto claro), 'dark' (Carto oscuro), or 'satellite'
  const [theme, setTheme] = useState<"light" | "dark" | "satellite">("light");

  // Filters
  const [filterType, setFilterType] = useState<
    "all" | "naps" | "mangas" | "disponibles" | "criticas" | "ocupadas"
  >("disponibles");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBox, setSelectedBox] = useState<OzBox | null>(null);
  const [userCoords, setUserCoords] = useState<[number, number] | null>(null);
  const [copiedCoords, setCopiedCoords] = useState(false);

  // Load boxes from API
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
      console.error("Error al cargar cajas de OZmap:", err);
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
    const disponibles = naps.filter((b) => b.availablePorts > 2).length;
    const criticas = naps.filter((b) => b.availablePorts > 0 && b.availablePorts <= 2).length;
    const saturadas = naps.filter((b) => b.availablePorts === 0).length;
    const mangas = boxes.filter((b) => !b.isNap).length;

    return { total, naps: naps.length, disponibles, criticas, saturadas, mangas };
  }, [boxes]);

  // Distance from advisor's current location to selected box
  const selectedDistance = useMemo(() => {
    if (!selectedBox || !userCoords) return null;
    return calculateDistanceMeters(
      userCoords[0],
      userCoords[1],
      selectedBox.lat,
      selectedBox.lng
    );
  }, [selectedBox, userCoords]);

  // Copy coordinates
  const handleCopyCoords = (box: OzBox) => {
    const text = `${box.lat.toFixed(6)}, ${box.lng.toFixed(6)}`;
    navigator.clipboard.writeText(text);
    setCopiedCoords(true);
    setTimeout(() => setCopiedCoords(false), 2000);
  };

  // Open in Google Maps
  const handleOpenGoogleMaps = (box: OzBox) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${box.lat},${box.lng}`;
    window.open(url, "_blank");
  };

  return (
    <div className="flex h-screen bg-[#FAFAFA] text-neutral-900 font-sans antialiased overflow-hidden">
      {/* Desktop Sidebar */}
      <Sidebar activeSection="factibilidad" />

      {/* Main Container */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header - Strict Minimalist (no boxed buttons, pure typography and icons) */}
        <header className="sticky top-0 z-20 h-12 bg-white/95 backdrop-blur-xs border-b border-neutral-200/80 px-4 sm:px-6 flex items-center justify-between select-none">
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
              <span className="text-xs sm:text-sm font-medium text-neutral-800 tracking-tight">
                Factibilidad
              </span>
              <span className="hidden sm:inline-block text-[11px] text-neutral-400 font-mono ml-2">
                OZmap en vivo
              </span>
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-4 text-xs font-mono">
            {/* Theme switcher */}
            <button
              type="button"
              onClick={() =>
                setTheme((prev) => (prev === "light" ? "dark" : prev === "dark" ? "satellite" : "light"))
              }
              className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer flex items-center gap-1.5"
              title="Cambiar capa de mapa (Carto claro / Carto oscuro / Satélite)"
            >
              {theme === "dark" ? (
                <Moon className="w-3.5 h-3.5 stroke-[1.5]" />
              ) : theme === "satellite" ? (
                <Layers className="w-3.5 h-3.5 stroke-[1.5]" />
              ) : (
                <Sun className="w-3.5 h-3.5 stroke-[1.5]" />
              )}
              <span className="hidden md:inline text-[11px]">
                {theme === "light" ? "Carto claro" : theme === "dark" ? "Carto oscuro" : "Satélite"}
              </span>
            </button>

            {/* Refresh button */}
            <button
              type="button"
              onClick={() => loadBoxes(true)}
              disabled={refreshing || loading}
              className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-40"
              title="Refrescar cajas desde OZmap"
            >
              <RotateCw
                className={cn("w-3.5 h-3.5 stroke-[1.5]", refreshing && "animate-spin")}
              />
              <span className="hidden md:inline text-[11px]">
                {refreshing ? "Actualizando..." : "Actualizar"}
              </span>
            </button>
          </div>
        </header>

        {/* Sub-Header: Metrics & Filters Bar (Zero boxed cards, rule-compliant) */}
        <div className="px-4 sm:px-6 py-2.5 bg-white border-b border-neutral-100 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          {/* Typographic Filter Navigation */}
          <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto no-scrollbar whitespace-nowrap scroll-smooth py-0.5">
            <button
              type="button"
              onClick={() => setFilterType("disponibles")}
              className={cn(
                "py-1 font-medium transition-colors border-b-2 cursor-pointer shrink-0 text-[11px] sm:text-xs",
                filterType === "disponibles"
                  ? "border-neutral-900 text-neutral-950 font-semibold"
                  : "border-transparent text-neutral-400 hover:text-neutral-700"
              )}
            >
              Disponibles ({stats.disponibles})
            </button>

            <button
              type="button"
              onClick={() => setFilterType("criticas")}
              className={cn(
                "py-1 font-medium transition-colors border-b-2 cursor-pointer shrink-0 text-[11px] sm:text-xs",
                filterType === "criticas"
                  ? "border-neutral-900 text-neutral-950 font-semibold"
                  : "border-transparent text-neutral-400 hover:text-neutral-700"
              )}
            >
              Críticas ({stats.criticas})
            </button>

            <button
              type="button"
              onClick={() => setFilterType("ocupadas")}
              className={cn(
                "py-1 font-medium transition-colors border-b-2 cursor-pointer shrink-0 text-[11px] sm:text-xs",
                filterType === "ocupadas"
                  ? "border-neutral-900 text-neutral-950 font-semibold"
                  : "border-transparent text-neutral-400 hover:text-neutral-700"
              )}
            >
              Saturadas ({stats.saturadas})
            </button>

            <button
              type="button"
              onClick={() => setFilterType("naps")}
              className={cn(
                "py-1 font-medium transition-colors border-b-2 cursor-pointer shrink-0 text-[11px] sm:text-xs",
                filterType === "naps"
                  ? "border-neutral-900 text-neutral-950 font-semibold"
                  : "border-transparent text-neutral-400 hover:text-neutral-700"
              )}
            >
              Todas las NAPs ({stats.naps})
            </button>

            <button
              type="button"
              onClick={() => setFilterType("mangas")}
              className={cn(
                "py-1 font-medium transition-colors border-b-2 cursor-pointer shrink-0 text-[11px] sm:text-xs",
                filterType === "mangas"
                  ? "border-neutral-900 text-neutral-950 font-semibold"
                  : "border-transparent text-neutral-400 hover:text-neutral-700"
              )}
            >
              Mangas ({stats.mangas})
            </button>
          </div>

          {/* Minimalist Search Input (with subtle bottom baseline, zero perimeter border) */}
          <div className="relative flex items-center min-w-[200px] sm:min-w-[260px]">
            <Search className="w-3.5 h-3.5 text-neutral-400 stroke-[1.5] absolute left-0" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar caja, sector o PON..."
              className="w-full bg-transparent pl-5 pr-6 py-1 text-xs text-neutral-900 placeholder:text-neutral-400 border-b border-neutral-200 focus:border-neutral-900 focus:outline-none transition-colors font-sans"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-0 text-neutral-400 hover:text-neutral-700 cursor-pointer"
                title="Limpiar búsqueda"
              >
                <X className="w-3.5 h-3.5 stroke-[1.5]" />
              </button>
            )}
          </div>
        </div>

        {/* Status / Error indication (Minimal text feedback, Rule 2 compliant) */}
        {error && (
          <div className="px-6 py-2 text-xs font-mono text-neutral-600 border-b border-neutral-100 flex items-center justify-between">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => loadBoxes(true)}
              className="text-neutral-900 underline underline-offset-2 ml-4 cursor-pointer"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Map Workspace */}
        <div className="flex-1 relative w-full h-full min-h-0">
          <FactibilidadMap
            boxes={boxes}
            theme={theme}
            selectedBox={selectedBox}
            onSelectBox={setSelectedBox}
            filterType={filterType}
            searchTerm={searchTerm}
            userCoords={userCoords}
            onUserCoordsChange={setUserCoords}
          />

          {/* Floating Details Drawer for Selected Box (Rule 6 compliant: open, minimal blur, subtle divider) */}
          {selectedBox && (
            <div className="absolute bottom-4 left-4 right-4 sm:left-6 sm:right-auto sm:w-[380px] z-20 bg-white/95 backdrop-blur-md border border-neutral-200/80 shadow-sm p-4 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-150">
              {/* Header */}
              <div className="flex items-start justify-between gap-3 border-b border-neutral-100 pb-2.5">
                <div>
                  <h2 className="text-xs sm:text-sm font-semibold text-neutral-900 tracking-tight">
                    {selectedBox.name}
                  </h2>
                  <p className="text-[11px] text-neutral-500 font-mono mt-0.5">
                    {selectedBox.boxTypeName} &bull; {selectedBox.sector || "Sector general"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedBox(null)}
                  className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer p-0.5"
                  title="Cerrar detalle"
                >
                  <X className="w-4 h-4 stroke-[1.5]" />
                </button>
              </div>

              {/* Distance to advisor (if GPS is active) */}
              {selectedDistance !== null && (
                <div className="flex items-center justify-between text-[11px] font-mono border-b border-neutral-100 pb-2">
                  <span className="text-neutral-400">Distancia estimada:</span>
                  <span
                    className={cn(
                      "font-medium",
                      selectedDistance <= 150
                        ? "text-emerald-600"
                        : selectedDistance <= 300
                        ? "text-amber-600"
                        : "text-neutral-700"
                    )}
                  >
                    {selectedDistance < 1000
                      ? `${selectedDistance} m`
                      : `${(selectedDistance / 1000).toFixed(1)} km`}{" "}
                    {selectedDistance <= 150 ? "(Óptima)" : selectedDistance <= 300 ? "(Factible)" : "(Distante)"}
                  </span>
                </div>
              )}

              {/* Capacity details for NAPs */}
              {selectedBox.isNap ? (
                <div className="grid grid-cols-3 gap-2 text-center py-1">
                  <div>
                    <span className="text-[10px] text-neutral-400 font-mono block">Libres</span>
                    <span
                      className={cn(
                        "text-base font-semibold font-mono",
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
                    <span className="text-base font-medium font-mono text-neutral-700">
                      {selectedBox.usedPorts}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-400 font-mono block">Total</span>
                    <span className="text-base font-medium font-mono text-neutral-700">
                      {selectedBox.totalPorts}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-neutral-500 font-mono py-1">
                  Manga de empalme / Distribución troncal de fibra
                </div>
              )}

              {/* Extra technical fields: Potencia & PON */}
              {(selectedBox.potencia || selectedBox.pon) && (
                <div className="text-[11px] font-mono space-y-1 text-neutral-500 border-t border-neutral-100 pt-2.5">
                  {selectedBox.potencia && (
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Potencia:</span>
                      <span className="text-neutral-900 font-medium">{selectedBox.potencia}</span>
                    </div>
                  )}
                  {selectedBox.pon && (
                    <div className="flex justify-between">
                      <span className="text-neutral-400">PON:</span>
                      <span className="text-neutral-900 font-medium text-right max-w-[200px] truncate" title={selectedBox.pon}>
                        {selectedBox.pon}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Action buttons (Rule 1 compliant: clean text and icons, zero boxed frames) */}
              <div className="flex items-center justify-between gap-4 border-t border-neutral-100 pt-2.5">
                <button
                  type="button"
                  onClick={() => handleCopyCoords(selectedBox)}
                  className="text-xs font-mono text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  {copiedCoords ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 stroke-[1.25]" />
                  )}
                  <span>{copiedCoords ? "Copiadas" : "Copiar GPS"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenGoogleMaps(selectedBox)}
                  className="text-xs font-mono text-neutral-700 hover:text-neutral-950 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Navigation className="w-3.5 h-3.5 stroke-[1.25]" />
                  <span>Cómo llegar</span>
                  <ExternalLink className="w-3 h-3 text-neutral-400" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
    </div>
  );
}

