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
  MessageCircle,
  Send,
  ShieldCheck,
} from "lucide-react";
import { SidebarOpenButton, useSidebar } from "@/components/providers/sidebar-provider";
import { Sidebar } from "@/components/dashboard/sidebar";
import { MobileBottomNav } from "@/components/dashboard/mobile-nav";
import { useUser } from "@/components/providers/user-provider";
import type { OzBox } from "@/lib/ozmap-service";
import {
  parseCoordinatesInput,
  analyzeFeasibility,
  generateWhatsAppResponse,
  type FeasibilityResult,
} from "@/lib/factibilidad-utils";
import type { MapTheme } from "@/components/factibilidad/FactibilidadMap";
import { cn } from "@/lib/utils";

// Leaflet map with dynamic import (SSR disabled)
const FactibilidadMap = dynamic(
  () => import("@/components/factibilidad/FactibilidadMap"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full min-h-[450px] flex items-center justify-center text-xs font-mono text-neutral-400 bg-neutral-50/50">
        Iniciando mapa...
      </div>
    ),
  }
);

export default function FactibilidadPage() {
  const { openMobileSidebar } = useSidebar();
  const { user, isAdmin } = useUser();

  const [boxes, setBoxes] = useState<OzBox[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Map theme: 'light' (Carto claro), 'dark' (Carto oscuro), or 'satellite'
  const [theme, setTheme] = useState<MapTheme>("light");

  // Admin view mode: 'radius' (default 1 km protected) or 'full' (all 6,000+ boxes)
  const [viewMode, setViewMode] = useState<"radius" | "full">("radius");

  // Filters
  const [filterType, setFilterType] = useState<
    "all" | "naps" | "mangas" | "disponibles" | "criticas" | "ocupadas"
  >("disponibles");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBox, setSelectedBox] = useState<OzBox | null>(null);
  const [userCoords, setUserCoords] = useState<[number, number] | null>(null);

  // Client Coordinates Query Workflow
  const [coordInput, setCoordInput] = useState("");
  const [clientCoords, setClientCoords] = useState<[number, number] | null>(null);
  const [coordError, setCoordError] = useState<string | null>(null);
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);
  const [copiedCoords, setCopiedCoords] = useState(false);

  // Query NAPs in 1 km radius around specific coordinates (Protects full network topology)
  const queryNearbyBoxes = useCallback(
    async (lat: number, lng: number, forceRefresh = false) => {
      try {
        if (forceRefresh) setRefreshing(true);
        else setLoading(true);
        setError(null);

        const res = await fetch(
          `/api/factibilidad?lat=${lat}&lng=${lng}&radius=1000${forceRefresh ? "&refresh=true" : ""}`
        );
        const json = await res.json();

        if (json.success && Array.isArray(json.data)) {
          setBoxes(json.data);
        } else {
          setError(json.error || "No se pudo consultar el radio de 1 km");
        }
      } catch (err: any) {
        console.error("Error al consultar radio de 1 km:", err);
        setError("Error de conexión al consultar factibilidad");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  // Admin-only: Load full network overview
  const loadFullNetwork = useCallback(
    async (forceRefresh = false) => {
      try {
        if (forceRefresh) setRefreshing(true);
        else setLoading(true);
        setError(null);

        const res = await fetch(
          `/api/factibilidad?full=true${forceRefresh ? "&refresh=true" : ""}`
        );
        const json = await res.json();

        if (json.success && Array.isArray(json.data)) {
          setBoxes(json.data);
        } else {
          setError(json.error || "No se pudieron obtener las cajas");
        }
      } catch (err: any) {
        console.error("Error al cargar red completa:", err);
        setError("Error de conexión al cargar la red");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  // Toggle admin full mode vs 1 km protected mode
  const handleToggleAdminMode = () => {
    if (!isAdmin) return;
    if (viewMode === "radius") {
      setViewMode("full");
      loadFullNetwork();
    } else {
      setViewMode("radius");
      if (clientCoords) {
        queryNearbyBoxes(clientCoords[0], clientCoords[1]);
      } else {
        setBoxes([]);
      }
    }
  };

  // Statistics calculation for the current visible set of boxes
  const stats = useMemo(() => {
    const total = boxes.length;
    const naps = boxes.filter((b) => b.isNap);
    const disponibles = naps.filter((b) => b.availablePorts > 2).length;
    const criticas = naps.filter((b) => b.availablePorts > 0 && b.availablePorts <= 2).length;
    const saturadas = naps.filter((b) => b.availablePorts === 0).length;
    const mangas = boxes.filter((b) => !b.isNap).length;

    return { total, naps: naps.length, disponibles, criticas, saturadas, mangas };
  }, [boxes]);

  // Compute feasibility diagnosis when clientCoords changes
  const feasibilityResult: FeasibilityResult | null = useMemo(() => {
    if (!clientCoords || boxes.length === 0) return null;
    return analyzeFeasibility(clientCoords, boxes);
  }, [clientCoords, boxes]);

  // Handle client coordinates submission
  const handleQueryCoords = useCallback(
    (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (!coordInput.trim()) return;

      setCoordError(null);
      const parsed = parseCoordinatesInput(coordInput);

      if (parsed) {
        setClientCoords(parsed);
        setSelectedBox(null);
        queryNearbyBoxes(parsed[0], parsed[1]);
      } else {
        setCoordError("Formato no reconocido. Ingresa latitud y longitud (ej. 10.4681, -66.9058) o link de Google Maps.");
      }
    },
    [coordInput, queryNearbyBoxes]
  );

  // Direct map click to place client pin
  const handleClientCoordsFromMap = useCallback(
    (coords: [number, number] | null) => {
      setClientCoords(coords);
      if (coords) {
        setCoordInput(`${coords[0].toFixed(6)}, ${coords[1].toFixed(6)}`);
        setCoordError(null);
        setSelectedBox(null);
        queryNearbyBoxes(coords[0], coords[1]);
      }
    },
    [queryNearbyBoxes]
  );

  // Clear client query and return to clean protected state
  const handleClearQuery = () => {
    setClientCoords(null);
    setCoordInput("");
    setCoordError(null);
    setSelectedBox(null);
    if (viewMode === "radius") {
      setBoxes([]);
    }
  };

  // Copy WhatsApp response
  const handleCopyWhatsApp = () => {
    if (!feasibilityResult) return;
    const text = generateWhatsAppResponse(feasibilityResult);
    navigator.clipboard.writeText(text);
    setCopiedWhatsApp(true);
    setTimeout(() => setCopiedWhatsApp(false), 2200);
  };

  // Copy raw coordinates
  const handleCopyBoxCoords = (box: OzBox) => {
    const text = `${box.lat.toFixed(6)}, ${box.lng.toFixed(6)}`;
    navigator.clipboard.writeText(text);
    setCopiedCoords(true);
    setTimeout(() => setCopiedCoords(false), 2000);
  };

  // Open in Google Maps
  const handleOpenGoogleMaps = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, "_blank");
  };

  return (
    <div className="flex h-screen bg-[#FAFAFA] text-neutral-900 font-sans antialiased overflow-hidden">
      {/* Desktop Sidebar */}
      <Sidebar activeSection="factibilidad" />

      {/* Main Container */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header - Pure typography & icon controls */}
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
                Consulta protegida en radio de 1 km
              </span>
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-4 text-xs font-mono">
            {/* Admin-only full network mode switch */}
            {isAdmin && (
              <button
                type="button"
                onClick={handleToggleAdminMode}
                className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer flex items-center gap-1.5"
                title={viewMode === "radius" ? "Ver mapa de red global (Modo Admin)" : "Volver a modo protegido 1 km"}
              >
                <ShieldCheck className={cn("w-3.5 h-3.5 stroke-[1.5]", viewMode === "full" && "text-blue-600")} />
                <span className="hidden lg:inline text-[11px]">
                  {viewMode === "full" ? "Red global (Admin)" : "Radio 1 km"}
                </span>
              </button>
            )}

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
              onClick={() => {
                if (clientCoords) queryNearbyBoxes(clientCoords[0], clientCoords[1], true);
                else if (viewMode === "full") loadFullNetwork(true);
              }}
              disabled={refreshing || loading}
              className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-40"
              title="Refrescar cajas desde OZmap"
            >
              <RotateCw
                className={cn("w-3.5 h-3.5 stroke-[1.5]", (refreshing || loading) && "animate-spin")}
              />
              <span className="hidden md:inline text-[11px]">
                {refreshing || loading ? "Consultando..." : "Actualizar"}
              </span>
            </button>
          </div>
        </header>

        {/* Coordenadas del Cliente Query Bar */}
        <div className="px-4 sm:px-6 py-2 bg-white border-b border-neutral-100 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          {/* Query Form */}
          <form onSubmit={handleQueryCoords} className="flex-1 flex items-center gap-3 max-w-2xl">
            <div className="relative flex-1 flex items-center">
              <MapPin className="w-3.5 h-3.5 text-neutral-400 stroke-[1.5] absolute left-0" />
              <input
                type="text"
                value={coordInput}
                onChange={(e) => setCoordInput(e.target.value)}
                placeholder="Pegar coordenadas o link de Maps (ej. 10.4681, -66.9058)..."
                className="w-full bg-transparent pl-5 pr-6 py-1 text-xs text-neutral-900 placeholder:text-neutral-400 border-b border-neutral-200 focus:border-neutral-900 focus:outline-none transition-colors font-sans"
              />
              {coordInput && (
                <button
                  type="button"
                  onClick={handleClearQuery}
                  className="absolute right-0 text-neutral-400 hover:text-neutral-700 cursor-pointer"
                  title="Limpiar coordenadas"
                >
                  <X className="w-3.5 h-3.5 stroke-[1.5]" />
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="text-neutral-700 hover:text-neutral-950 font-medium transition-colors cursor-pointer flex items-center gap-1 shrink-0 text-xs disabled:opacity-50"
            >
              <Send className="w-3 h-3 stroke-[1.5]" />
              <span>{loading ? "Buscando..." : "Consultar 1 km"}</span>
            </button>

            {clientCoords && (
              <button
                type="button"
                onClick={handleClearQuery}
                className="text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer text-xs"
              >
                Limpiar
              </button>
            )}
          </form>

          {/* Quick Filter Navigation (Displays counts ONLY for the active 1 km radius) */}
          <div className="flex items-center gap-4 overflow-x-auto no-scrollbar whitespace-nowrap scroll-smooth shrink-0 text-[11px] font-mono">
            {clientCoords || viewMode === "full" ? (
              <>
                <button
                  type="button"
                  onClick={() => setFilterType("disponibles")}
                  className={cn(
                    "py-1 font-medium transition-colors border-b-2 cursor-pointer",
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
                    "py-1 font-medium transition-colors border-b-2 cursor-pointer",
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
                    "py-1 font-medium transition-colors border-b-2 cursor-pointer",
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
                    "py-1 font-medium transition-colors border-b-2 cursor-pointer",
                    filterType === "naps"
                      ? "border-neutral-900 text-neutral-950 font-semibold"
                      : "border-transparent text-neutral-400 hover:text-neutral-700"
                  )}
                >
                  En 1 km ({stats.naps})
                </button>
              </>
            ) : (
              <span className="text-neutral-400">
                Pega coordenadas o haz clic en el mapa para revelar cajas en 1 km
              </span>
            )}
          </div>
        </div>

        {/* Coordinate parse error notice */}
        {coordError && (
          <div className="px-6 py-1.5 text-xs font-mono text-neutral-600 bg-neutral-50/50 border-b border-neutral-100 flex items-center justify-between">
            <span>{coordError}</span>
            <button
              type="button"
              onClick={() => setCoordError(null)}
              className="text-neutral-400 hover:text-neutral-700 cursor-pointer ml-3"
            >
              <X className="w-3 h-3 stroke-[1.5]" />
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
            clientCoords={clientCoords}
            onClientCoordsChange={handleClientCoordsFromMap}
            targetNap={feasibilityResult?.nearestAvailableNap || feasibilityResult?.nearestNap || null}
          />

          {/* Initial Clean Guide (shown when no coordinate is queried yet) */}
          {!clientCoords && viewMode === "radius" && (
            <div className="absolute top-4 left-4 right-4 sm:left-6 sm:right-auto sm:w-[360px] z-20 bg-white/90 backdrop-blur-xs border border-neutral-200/80 p-3.5 space-y-1.5 animate-in fade-in duration-200">
              <span className="text-xs font-medium text-neutral-900 block">
                Consulta protegida de factibilidad
              </span>
              <p className="text-[11px] text-neutral-500 font-sans leading-relaxed">
                Pega las coordenadas enviadas por el cliente o haz clic directamente sobre su casa en el mapa. Se mostrarán las cajas NAP dentro de un radio de 1 km y se evaluará la distancia de acometida.
              </p>
            </div>
          )}

          {/* Feasibility Diagnosis Panel for Client Coordinates */}
          {feasibilityResult && (
            <div className="absolute top-4 left-4 right-4 sm:left-6 sm:right-auto sm:w-[410px] z-20 bg-white/95 backdrop-blur-md border border-neutral-200/90 shadow-sm p-4 space-y-3.5 animate-in fade-in slide-in-from-top-2 duration-150">
              {/* Header */}
              <div className="flex items-start justify-between gap-3 border-b border-neutral-100 pb-2.5">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "w-2.5 h-2.5 rounded-full shrink-0",
                        feasibilityResult.isFeasible
                          ? feasibilityResult.feasibilityLevel === "optima"
                            ? "bg-emerald-500"
                            : "bg-amber-500"
                          : feasibilityResult.feasibilityLevel === "saturada"
                          ? "bg-amber-500"
                          : "bg-red-500"
                      )}
                    />
                    <h2 className="text-xs sm:text-sm font-semibold text-neutral-900 tracking-tight">
                      {feasibilityResult.diagnosisTitle}
                    </h2>
                  </div>
                  <p className="text-[11px] text-neutral-500 font-mono mt-1">
                    Punto del cliente: {clientCoords?.[0].toFixed(5)}, {clientCoords?.[1].toFixed(5)} &bull; Radio 1 km
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClearQuery}
                  className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer p-0.5"
                  title="Cerrar diagnóstico"
                >
                  <X className="w-4 h-4 stroke-[1.5]" />
                </button>
              </div>

              {/* Diagnosis details */}
              <p className="text-xs text-neutral-700 leading-relaxed font-sans">
                {feasibilityResult.diagnosisMessage}
              </p>

              {/* Assigned / Nearest Available NAP specs */}
              {feasibilityResult.nearestAvailableNap && (
                <div className="border-t border-neutral-100 pt-2.5 space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-400">Caja asignada:</span>
                    <span className="text-neutral-900 font-medium">
                      {feasibilityResult.nearestAvailableNap.name}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-neutral-400">Distancia de acometida:</span>
                    <span
                      className={cn(
                        "font-semibold",
                        feasibilityResult.distanceToAvailableMeters! <= 150
                          ? "text-emerald-600"
                          : feasibilityResult.distanceToAvailableMeters! <= 250
                          ? "text-amber-600"
                          : "text-red-500"
                      )}
                    >
                      {feasibilityResult.distanceToAvailableMeters} metros
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-neutral-400">Puertos libres:</span>
                    <span className="text-emerald-600 font-semibold">
                      {feasibilityResult.nearestAvailableNap.availablePorts} de{" "}
                      {feasibilityResult.nearestAvailableNap.totalPorts}
                    </span>
                  </div>

                  {feasibilityResult.nearestAvailableNap.potencia && (
                    <div className="flex justify-between items-center">
                      <span className="text-neutral-400">Potencia óptica:</span>
                      <span className="text-neutral-700">
                        {feasibilityResult.nearestAvailableNap.potencia}
                      </span>
                    </div>
                  )}

                  {feasibilityResult.nearestAvailableNap.pon && (
                    <div className="flex justify-between items-center">
                      <span className="text-neutral-400">PON:</span>
                      <span
                        className="text-neutral-700 text-right max-w-[210px] truncate"
                        title={feasibilityResult.nearestAvailableNap.pon}
                      >
                        {feasibilityResult.nearestAvailableNap.pon}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Nearby Alternatives List (in 1 km radius) */}
              {feasibilityResult.nearbyNaps.length > 1 && (
                <div className="border-t border-neutral-100 pt-2">
                  <span className="text-[10px] text-neutral-400 font-mono block mb-1">
                    Otras cajas en el radio de 1 km:
                  </span>
                  <div className="space-y-1">
                    {feasibilityResult.nearbyNaps.slice(1, 4).map(({ box, distance }) => (
                      <div
                        key={box.id}
                        className="flex items-center justify-between text-[11px] font-mono text-neutral-600 hover:text-neutral-950 cursor-pointer"
                        onClick={() => setSelectedBox(box)}
                      >
                        <span className="truncate max-w-[190px]">{box.name}</span>
                        <div className="flex items-center gap-2">
                          <span>{distance}m</span>
                          <span
                            className={cn(
                              "font-semibold",
                              box.availablePorts > 0 ? "text-emerald-600" : "text-neutral-400"
                            )}
                          >
                            {box.availablePorts} libres
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Action Buttons for Advisors */}
              <div className="flex items-center justify-between gap-3 border-t border-neutral-100 pt-2.5">
                <button
                  type="button"
                  onClick={handleCopyWhatsApp}
                  className="text-xs font-mono text-emerald-700 hover:text-emerald-900 transition-colors cursor-pointer flex items-center gap-1.5"
                  title="Copiar texto formal para enviar al cliente por WhatsApp"
                >
                  {copiedWhatsApp ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <MessageCircle className="w-3.5 h-3.5 stroke-[1.5]" />
                  )}
                  <span>{copiedWhatsApp ? "Copiado a portapapeles" : "Copiar WhatsApp"}</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleOpenGoogleMaps(clientCoords![0], clientCoords![1])
                  }
                  className="text-xs font-mono text-neutral-600 hover:text-neutral-900 transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Navigation className="w-3 h-3 stroke-[1.5]" />
                  <span>Ver en Maps</span>
                  <ExternalLink className="w-2.5 h-2.5 text-neutral-400" />
                </button>
              </div>
            </div>
          )}

          {/* Floating Details Drawer for Box explicitly clicked (if not reviewing client query) */}
          {selectedBox && !feasibilityResult && (
            <div className="absolute bottom-4 left-4 right-4 sm:left-6 sm:right-auto sm:w-[380px] z-20 bg-white/95 backdrop-blur-md border border-neutral-200/80 shadow-sm p-4 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-150">
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

              <div className="flex items-center justify-between gap-4 border-t border-neutral-100 pt-2.5">
                <button
                  type="button"
                  onClick={() => handleCopyBoxCoords(selectedBox)}
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
                  onClick={() => handleOpenGoogleMaps(selectedBox.lat, selectedBox.lng)}
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
