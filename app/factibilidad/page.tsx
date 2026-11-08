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
  ChevronUp,
  ChevronDown,
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
  calculateDistanceMeters,
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
  const { user } = useUser();

  const [boxes, setBoxes] = useState<OzBox[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Map theme: 'light' (Carto claro), 'dark' (Carto oscuro), or 'satellite'
  const [theme, setTheme] = useState<MapTheme>("light");

  // Filters
  const [filterType, setFilterType] = useState<
    "all" | "naps" | "mangas" | "disponibles" | "criticas" | "ocupadas"
  >("disponibles");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBox, setSelectedBox] = useState<OzBox | null>(null);
  const [isBoxDetailsExpanded, setIsBoxDetailsExpanded] = useState(false);
  const [isDiagnosisExpanded, setIsDiagnosisExpanded] = useState(false);
  const [userCoords, setUserCoords] = useState<[number, number] | null>(null);

  // Client Coordinates Query Workflow
  const [coordInput, setCoordInput] = useState("");
  const [clientCoords, setClientCoords] = useState<[number, number] | null>(null);
  const [flyToCoords, setFlyToCoords] = useState<[number, number] | null>(null);
  const [coordError, setCoordError] = useState<string | null>(null);
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);
  const [copiedCoords, setCopiedCoords] = useState(false);

  // Load all boxes from API
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
        setError(json.error || "No se pudieron obtener las cajas de factibilidad");
      }
    } catch (err: any) {
      console.error("Error al cargar cajas de factibilidad:", err);
      setError("Error de conexión al consultar el servidor");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load on mount
  useEffect(() => {
    loadBoxes();
  }, [loadBoxes]);

  // Keep bars compact by default so the map is 100% visible
  // The user can tap the bar anytime to expand the full technical sheet

  // Statistics calculation for the boxes
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

  // Target NAP: highlight nearest available NAP (or nearest NAP)
  const targetNap = useMemo(() => {
    const nap = feasibilityResult?.nearestAvailableNap || feasibilityResult?.nearestNap || null;
    if (!nap || !clientCoords) return null;
    const dist = calculateDistanceMeters(clientCoords[0], clientCoords[1], nap.lat, nap.lng);
    return dist <= 2000 ? nap : null;
  }, [feasibilityResult, clientCoords]);

  // Handle client coordinates submission from form
  const handleQueryCoords = useCallback(
    (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (!coordInput.trim()) return;

      setCoordError(null);
      const parsed = parseCoordinatesInput(coordInput);

      if (parsed) {
        setClientCoords(parsed);
        setFlyToCoords(parsed);
        setSelectedBox(null);
      } else {
        setCoordError("Formato no reconocido. Ingresa latitud y longitud (ej. 10.4681, -66.9058) o link de Google Maps.");
      }
    },
    [coordInput]
  );

  // Direct map click to place client pin (keeps camera completely still without jump or zoom bounce)
  const handleClientCoordsFromMap = useCallback((coords: [number, number] | null) => {
    setClientCoords(coords);
    setFlyToCoords(null);
    if (coords) {
      setCoordInput(`${coords[0].toFixed(6)}, ${coords[1].toFixed(6)}`);
      setCoordError(null);
      setSelectedBox(null);
    }
  }, []);

  // Clear client query
  const handleClearQuery = () => {
    setClientCoords(null);
    setFlyToCoords(null);
    setCoordInput("");
    setCoordError(null);
    setSelectedBox(null);
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
    <div className="flex h-[100dvh] bg-[#FAFAFA] text-neutral-900 font-sans antialiased overflow-hidden">
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
                OZmap &bull; {boxes.length > 0 ? `${boxes.length} cajas activas` : "Cargando red..."}
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
                className={cn("w-3.5 h-3.5 stroke-[1.5]", (refreshing || loading) && "animate-spin")}
              />
              <span className="hidden md:inline text-[11px]">
                {refreshing || loading ? "Consultando..." : "Actualizar"}
              </span>
            </button>
          </div>
        </header>

        {/* Coordenadas del Cliente Query Bar & Quick Filters */}
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
              <span>Evaluar</span>
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

          {/* Quick Filter Navigation */}
          <div className="flex items-center gap-4 overflow-x-auto no-scrollbar whitespace-nowrap scroll-smooth shrink-0 text-[11px] font-mono">
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
              Todas las NAPs ({stats.naps})
            </button>

            <button
              type="button"
              onClick={() => setFilterType("mangas")}
              className={cn(
                "py-1 font-medium transition-colors border-b-2 cursor-pointer",
                filterType === "mangas"
                  ? "border-neutral-900 text-neutral-950 font-semibold"
                  : "border-transparent text-neutral-400 hover:text-neutral-700"
              )}
            >
              Mangas ({stats.mangas})
            </button>
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
            targetNap={targetNap}
            flyToCoords={flyToCoords}
            onMapInteraction={() => {
              setIsDiagnosisExpanded(false);
              setIsBoxDetailsExpanded(false);
            }}
          />

          {/* Feasibility Diagnosis Panel for Client Coordinates (Retractable 2-State Bar at Top) */}
          {feasibilityResult && !selectedBox && (
            <div className="absolute top-2.5 left-3 right-3 sm:left-6 sm:right-auto sm:w-[410px] z-30 bg-white/95 backdrop-blur-md border-b border-neutral-200/80 shadow-xs animate-in fade-in slide-in-from-top-2 duration-150 select-none">
              {/* Compact Bar (Always visible in 1 ultra-clean row) */}
              <div className="flex items-center justify-between px-3 py-2.5 gap-2">
                <button
                  type="button"
                  onClick={() => setIsDiagnosisExpanded((prev) => !prev)}
                  className="flex items-center gap-2 min-w-0 text-left cursor-pointer group flex-1"
                  title={isDiagnosisExpanded ? "Contraer diagnóstico" : "Expandir diagnóstico"}
                >
                  <span
                    className={cn(
                      "w-2 h-2 rounded-full shrink-0",
                      feasibilityResult.isFeasible
                        ? feasibilityResult.feasibilityLevel === "optima"
                          ? "bg-emerald-500"
                          : "bg-amber-500"
                        : feasibilityResult.feasibilityLevel === "saturada"
                        ? "bg-amber-500"
                        : "bg-red-500"
                    )}
                  />
                  <div className="flex items-center gap-1.5 min-w-0 truncate">
                    <span className="text-xs font-semibold text-neutral-900 group-hover:text-neutral-700 transition-colors truncate">
                      {feasibilityResult.nearestAvailableNap?.name?.toUpperCase() || feasibilityResult.diagnosisTitle}
                    </span>
                    {feasibilityResult.distanceToAvailableMeters !== null && (
                      <span
                        className={cn(
                          "text-xs font-mono font-medium shrink-0",
                          feasibilityResult.distanceToAvailableMeters <= 150
                            ? "text-emerald-600"
                            : feasibilityResult.distanceToAvailableMeters <= 250
                            ? "text-amber-600"
                            : "text-red-500"
                        )}
                      >
                        &bull; {feasibilityResult.distanceToAvailableMeters}m
                      </span>
                    )}
                    {feasibilityResult.nearestAvailableNap && (
                      <span className="text-[11px] font-mono text-neutral-400 shrink-0 hidden xs:inline">
                        ({feasibilityResult.nearestAvailableNap.availablePorts} libres)
                      </span>
                    )}
                  </div>
                </button>

                {/* Minimalist icon actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleCopyWhatsApp}
                    className="text-neutral-400 hover:text-emerald-700 transition-colors cursor-pointer p-1"
                    title={copiedWhatsApp ? "Copiado a portapapeles" : "Copiar respuesta para WhatsApp"}
                    aria-label="Copiar respuesta para WhatsApp"
                  >
                    {copiedWhatsApp ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <MessageCircle className="w-3.5 h-3.5 stroke-[1.25]" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleOpenGoogleMaps(clientCoords![0], clientCoords![1])
                    }
                    className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer p-1"
                    title="Ver en Google Maps"
                    aria-label="Ver en Google Maps"
                  >
                    <Navigation className="w-3.5 h-3.5 stroke-[1.25]" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsDiagnosisExpanded((prev) => !prev)}
                    className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer p-1"
                    title={isDiagnosisExpanded ? "Contraer diagnóstico" : "Expandir diagnóstico"}
                    aria-label={isDiagnosisExpanded ? "Contraer diagnóstico" : "Expandir diagnóstico"}
                  >
                    {isDiagnosisExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5 stroke-[1.25]" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 stroke-[1.25]" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleClearQuery}
                    className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer p-1"
                    title="Limpiar consulta"
                    aria-label="Limpiar consulta"
                  >
                    <X className="w-3.5 h-3.5 stroke-[1.5]" />
                  </button>
                </div>
              </div>

              {/* Expanded Technical & Diagnostic Details */}
              {isDiagnosisExpanded && (
                <div className="px-3 pb-3 pt-1 border-t border-neutral-100 space-y-2.5 max-h-[50dvh] overflow-y-auto animate-in fade-in duration-150">
                  {/* Diagnosis title & client coords */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-xs font-semibold text-neutral-900">
                      {feasibilityResult.diagnosisTitle}
                    </span>
                    <span className="text-[10px] text-neutral-400 font-mono">
                      {clientCoords?.[0].toFixed(5)}, {clientCoords?.[1].toFixed(5)}
                    </span>
                  </div>

                  {/* Diagnosis message */}
                  <p className="text-xs text-neutral-600 leading-relaxed font-sans">
                    {feasibilityResult.diagnosisMessage}
                  </p>

                  {/* Assigned / Nearest Available NAP specs */}
                  {feasibilityResult.nearestAvailableNap && (
                    <div className="border-t border-neutral-100 pt-2 space-y-1.5 text-[11px] font-mono">
                      <div className="flex justify-between items-center">
                        <span className="text-neutral-400">
                          {feasibilityResult.isFeasible ? "Caja asignada:" : "Caja más cercana:"}
                        </span>
                        <span className="text-neutral-900 font-medium">
                          {feasibilityResult.nearestAvailableNap.name.toUpperCase()}
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

                  {/* Nearby Alternatives List */}
                  {feasibilityResult.nearbyNaps.length > 1 && (
                    <div className="border-t border-neutral-100 pt-2">
                      <span className="text-[10px] text-neutral-400 font-mono block mb-1">
                        Otras cajas cercanas:
                      </span>
                      <div className="space-y-1">
                        {feasibilityResult.nearbyNaps.slice(1, 4).map(({ box, distance }) => (
                          <div
                            key={box.id}
                            className="flex items-center justify-between text-[11px] font-mono text-neutral-600 hover:text-neutral-950 cursor-pointer"
                            onClick={() => setSelectedBox(box)}
                          >
                            <span className="truncate max-w-[190px]">{box.name.toUpperCase()}</span>
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

                  {/* Quick Action Link Buttons */}
                  <div className="flex items-center justify-between gap-3 border-t border-neutral-100 pt-2 text-xs font-mono">
                    <button
                      type="button"
                      onClick={handleCopyWhatsApp}
                      className="text-emerald-700 hover:text-emerald-900 transition-colors cursor-pointer flex items-center gap-1.5"
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
                      className="text-neutral-600 hover:text-neutral-900 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Navigation className="w-3 h-3 stroke-[1.5]" />
                      <span>Ver en Maps</span>
                      <ExternalLink className="w-2.5 h-2.5 text-neutral-400" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Retractable 2-State Information Bar for Box Clicked (At Top) */}
          {selectedBox && (
            <div className="absolute top-2.5 left-3 right-3 sm:left-6 sm:right-auto sm:w-[380px] z-30 bg-white/95 backdrop-blur-md border-b border-neutral-200/80 shadow-xs animate-in fade-in slide-in-from-top-2 duration-150 select-none">
              {/* Compact Bar (Always visible in 1 ultra-clean row) */}
              <div className="flex items-center justify-between px-3 py-2.5 gap-2">
                <button
                  type="button"
                  onClick={() => setIsBoxDetailsExpanded((prev) => !prev)}
                  className="flex items-center gap-2 min-w-0 text-left cursor-pointer group flex-1"
                  title={isBoxDetailsExpanded ? "Contraer detalles" : "Expandir detalles"}
                >
                  <span className="text-xs font-semibold text-neutral-900 group-hover:text-neutral-700 transition-colors truncate">
                    {selectedBox.name.toUpperCase()}
                  </span>
                  <span className="text-[11px] font-mono text-neutral-300">&bull;</span>
                  <span
                    className={cn(
                      "text-xs font-mono font-medium shrink-0",
                      selectedBox.isNap
                        ? selectedBox.availablePorts > 2
                          ? "text-emerald-600"
                          : selectedBox.availablePorts > 0
                          ? "text-amber-600"
                          : "text-red-500"
                        : "text-neutral-500"
                    )}
                  >
                    {selectedBox.isNap
                      ? `${selectedBox.availablePorts} libres (${selectedBox.totalPorts})`
                      : "Manga"}
                  </span>
                </button>

                {/* Minimalist icon actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {clientCoords && feasibilityResult && (
                    <button
                      type="button"
                      onClick={handleCopyWhatsApp}
                      className="text-neutral-400 hover:text-emerald-700 transition-colors cursor-pointer p-1"
                      title={copiedWhatsApp ? "Copiado a portapapeles" : "Copiar respuesta para WhatsApp"}
                      aria-label="Copiar respuesta para WhatsApp"
                    >
                      {copiedWhatsApp ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <MessageCircle className="w-3.5 h-3.5 stroke-[1.25]" />
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleCopyBoxCoords(selectedBox)}
                    className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer p-1"
                    title={copiedCoords ? "Coordenadas copiadas" : "Copiar coordenadas"}
                    aria-label="Copiar coordenadas"
                  >
                    {copiedCoords ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 stroke-[1.25]" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenGoogleMaps(selectedBox.lat, selectedBox.lng)}
                    className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer p-1"
                    title="Cómo llegar (Google Maps)"
                    aria-label="Cómo llegar (Google Maps)"
                  >
                    <Navigation className="w-3.5 h-3.5 stroke-[1.25]" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsBoxDetailsExpanded((prev) => !prev)}
                    className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer p-1"
                    title={isBoxDetailsExpanded ? "Contraer información" : "Expandir información"}
                    aria-label={isBoxDetailsExpanded ? "Contraer información" : "Expandir información"}
                  >
                    {isBoxDetailsExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5 stroke-[1.25]" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 stroke-[1.25]" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedBox(null);
                      setIsBoxDetailsExpanded(false);
                    }}
                    className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer p-1"
                    title="Cerrar detalle"
                    aria-label="Cerrar detalle"
                  >
                    <X className="w-3.5 h-3.5 stroke-[1.5]" />
                  </button>
                </div>
              </div>

              {/* Expanded Technical Details (Unfolds on demand) */}
              {isBoxDetailsExpanded && (
                <div className="px-3 pb-3 pt-1 border-t border-neutral-100 text-[11px] font-mono space-y-2 max-h-[50dvh] overflow-y-auto animate-in fade-in duration-150">
                  <div className="flex justify-between items-center text-neutral-500">
                    <span>Tipo y sector:</span>
                    <span className="text-neutral-800">
                      {selectedBox.boxTypeName} &bull; {selectedBox.sector || "Sector general"}
                    </span>
                  </div>

                  {clientCoords && (
                    <div className="flex justify-between items-center text-neutral-500">
                      <span>Distancia de acometida:</span>
                      <span
                        className={cn(
                          "font-semibold",
                          calculateDistanceMeters(clientCoords[0], clientCoords[1], selectedBox.lat, selectedBox.lng) <= 150
                            ? "text-emerald-600"
                            : calculateDistanceMeters(clientCoords[0], clientCoords[1], selectedBox.lat, selectedBox.lng) <= 250
                            ? "text-amber-600"
                            : "text-red-500"
                        )}
                      >
                        {calculateDistanceMeters(clientCoords[0], clientCoords[1], selectedBox.lat, selectedBox.lng)} metros
                      </span>
                    </div>
                  )}

                  {selectedBox.isNap ? (
                    <div className="flex justify-between items-center text-neutral-500">
                      <span>Distribución de puertos:</span>
                      <span className="text-neutral-800">
                        <span className="font-semibold text-emerald-600">
                          {selectedBox.availablePorts} libres
                        </span>
                        {" / "}
                        <span>{selectedBox.usedPorts} ocupados</span>
                        {" / "}
                        <span>{selectedBox.totalPorts} totales</span>
                      </span>
                    </div>
                  ) : (
                    <div className="text-neutral-500">
                      Manga de empalme / Distribución troncal de fibra
                    </div>
                  )}

                  {selectedBox.potencia && (
                    <div className="flex justify-between items-center text-neutral-500">
                      <span>Potencia óptica:</span>
                      <span className="text-neutral-800 font-medium">{selectedBox.potencia}</span>
                    </div>
                  )}

                  {selectedBox.pon && (
                    <div className="flex justify-between items-center text-neutral-500">
                      <span>PON:</span>
                      <span
                        className="text-neutral-800 font-medium text-right max-w-[210px] truncate"
                        title={selectedBox.pon}
                      >
                        {selectedBox.pon}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-neutral-400 pt-1 text-[10px]">
                    <span>
                      GPS: {selectedBox.lat.toFixed(5)}, {selectedBox.lng.toFixed(5)}
                    </span>
                    <div className="flex items-center gap-3">
                      {clientCoords && feasibilityResult && (
                        <button
                          type="button"
                          onClick={handleCopyWhatsApp}
                          className="text-emerald-700 hover:text-emerald-900 transition-colors cursor-pointer flex items-center gap-1 text-[11px]"
                        >
                          {copiedWhatsApp ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <MessageCircle className="w-3 h-3 stroke-[1.25]" />
                          )}
                          <span>{copiedWhatsApp ? "Copiado" : "WhatsApp"}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleOpenGoogleMaps(selectedBox.lat, selectedBox.lng)}
                        className="text-neutral-600 hover:text-neutral-900 transition-colors cursor-pointer flex items-center gap-1 text-[11px]"
                      >
                        <span>Abrir en Maps</span>
                        <ExternalLink className="w-2.5 h-2.5 text-neutral-400" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
    </div>
  );
}
