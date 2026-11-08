"use client";

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import type { OzBox } from "@/lib/ozmap-service";
import { calculateDistanceMeters } from "@/lib/factibilidad-utils";
import "leaflet/dist/leaflet.css";

export type MapTheme = "light" | "dark" | "satellite";

interface FactibilidadMapProps {
  boxes: OzBox[];
  theme: MapTheme;
  selectedBox: OzBox | null;
  onSelectBox: (box: OzBox | null) => void;
  filterType: "all" | "naps" | "mangas" | "disponibles" | "criticas" | "ocupadas";
  searchTerm: string;
  userCoords: [number, number] | null;
  onUserCoordsChange: (coords: [number, number] | null) => void;
  clientCoords: [number, number] | null;
  onClientCoordsChange: (coords: [number, number] | null) => void;
  targetNap: OzBox | null;
  routeGeometry?: [number, number][] | null;
  routeDistance?: number | null;
  isStreetRoute?: boolean;
  isCalculatingRoute?: boolean;
  flyToCoords?: [number, number] | null;
  onMapInteraction?: () => void;
}

const getTileConfig = (theme: MapTheme) => {
  if (theme === "satellite") {
    return {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      className: "map-tiles-satellite",
      maxZoom: 18,
      subdomains: "abc",
      attribution: "&copy; Esri, Maxar",
    };
  }

  if (theme === "dark") {
    return {
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      className: "map-tiles-clean-dark",
      maxZoom: 18,
      subdomains: ["a", "b", "c"],
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    };
  }

  // Light: OpenStreetMap with clean desaturated minimalist styling
  return {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    className: "map-tiles-clean-light",
    maxZoom: 18,
    subdomains: ["a", "b", "c"],
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  };
};

// Box radius scaled according to zoom so street view maintains visible, touch-friendly markers
const getBoxRadius = (isNap: boolean, isTarget: boolean, isSelected: boolean, zoom: number) => {
  if (isTarget || isSelected) {
    if (zoom >= 16) return 9.5;
    if (zoom >= 14) return 8.5;
    return 7;
  }
  if (isNap) {
    // Street level (zoom 16 to 18): prominent, visible, easy to touch
    if (zoom >= 16) return 6.8;
    // Neighborhood level (zoom 14 to 15.5)
    if (zoom >= 14) return 5.5;
    // Overview level (zoom < 14)
    return 4;
  }
  // Mangas (distribución / empalme)
  if (zoom >= 16) return 4.5;
  if (zoom >= 14) return 3.5;
  return 2.5;
};

function FactibilidadMapInner({
  boxes,
  theme,
  selectedBox,
  onSelectBox,
  filterType,
  searchTerm,
  userCoords,
  onUserCoordsChange,
  clientCoords,
  onClientCoordsChange,
  targetNap,
  routeGeometry,
  routeDistance,
  isStreetRoute = false,
  isCalculatingRoute = false,
  flyToCoords,
  onMapInteraction,
}: FactibilidadMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const markersMapRef = useRef<Map<string, any>>(new Map());
  const userMarkerRef = useRef<any>(null);
  const clientLayerRef = useRef<any>(null);
  const canvasRendererRef = useRef<any>(null);

  // Client visual element refs for in-place updates (no clearLayers flicker)
  const clientMarkerRef = useRef<any>(null);
  const kmCircleRef = useRef<any>(null);
  const optCircleRef = useRef<any>(null);
  const maxCircleRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);

  // Guard against marker click triggering map click (timestamp-based so it NEVER gets stuck)
  const lastMarkerClickTimeRef = useRef<number>(0);

  const [L, setL] = useState<any>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(14);

  // Keep callback refs stable
  const onClientCoordsChangeRef = useRef(onClientCoordsChange);
  useEffect(() => {
    onClientCoordsChangeRef.current = onClientCoordsChange;
  }, [onClientCoordsChange]);

  const onSelectBoxRef = useRef(onSelectBox);
  useEffect(() => {
    onSelectBoxRef.current = onSelectBox;
  }, [onSelectBox]);

  const onUserCoordsChangeRef = useRef(onUserCoordsChange);
  useEffect(() => {
    onUserCoordsChangeRef.current = onUserCoordsChange;
  }, [onUserCoordsChange]);

  const onMapInteractionRef = useRef(onMapInteraction);
  useEffect(() => {
    onMapInteractionRef.current = onMapInteraction;
  }, [onMapInteraction]);

  // Load Leaflet once on client
  useEffect(() => {
    let mounted = true;
    import("leaflet").then((mod) => {
      if (mounted) {
        setL(mod.default || mod);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Filter boxes according to active tabs
  const filteredBoxes = useMemo(() => {
    let list = boxes;

    if (filterType === "naps") {
      list = list.filter((b) => b.isNap);
    } else if (filterType === "disponibles") {
      list = list.filter((b) => b.isNap && b.availablePorts > 2);
    } else if (filterType === "criticas") {
      list = list.filter((b) => b.isNap && b.availablePorts > 0 && b.availablePorts <= 2);
    } else if (filterType === "ocupadas") {
      list = list.filter((b) => b.isNap && b.availablePorts === 0);
    } else if (filterType === "mangas") {
      list = list.filter((b) => !b.isNap);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          (b.sector && b.sector.toLowerCase().includes(q)) ||
          (b.pon && b.pon.toLowerCase().includes(q)) ||
          b.boxTypeName.toLowerCase().includes(q)
      );
    }

    return list;
  }, [boxes, filterType, searchTerm]);

  // Initialize Map
  useEffect(() => {
    if (!L || !mapContainerRef.current || mapInstanceRef.current) return;

    // Tolerance 4: tight hit testing so clicking near a marker on a street places the client pin accurately
    const canvasRenderer = L.canvas({ tolerance: 4, padding: 0.1 });
    canvasRendererRef.current = canvasRenderer;

    const map = L.map(mapContainerRef.current, {
      center: [10.4674, -66.9058],
      zoom: 14,
      minZoom: 11,
      maxZoom: 18,
      zoomControl: false,
      attributionControl: false,
      renderer: canvasRenderer,
      preferCanvas: true,
      fadeAnimation: true,
      zoomAnimation: true,
      zoomSnap: 0.5,
      zoomDelta: 0.5,
      wheelPxPerZoomLevel: 100,
    });

    map.on("zoomstart", () => {
      const overlayPane = map.getPane("overlayPane");
      if (overlayPane) {
        overlayPane.style.transition = "opacity 0.15s ease-out";
        overlayPane.style.opacity = "0.55";
      }
    });

    map.on("zoomend", () => {
      const overlayPane = map.getPane("overlayPane");
      if (overlayPane) {
        overlayPane.style.transition = "opacity 0.2s ease-in";
        overlayPane.style.opacity = "1";
      }
      setCurrentZoom(map.getZoom());
    });

    L.control.zoom({ position: "bottomright" }).addTo(map);

    const cfg = getTileConfig(theme);
    const tileLayer = L.tileLayer(cfg.url, {
      subdomains: cfg.subdomains || "abcd",
      maxZoom: cfg.maxZoom,
      className: cfg.className,
      updateWhenIdle: false,
      updateWhenZooming: false,
      keepBuffer: 6,
    }).addTo(map);
    tileLayerRef.current = tileLayer;

    // Layer groups
    const markersGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = markersGroup;

    const clientGroup = L.layerGroup().addTo(map);
    clientLayerRef.current = clientGroup;

    // Click on map to place or reposition client pin
    // Timestamp-guarded: if user just clicked a marker within 250ms, ignore; otherwise ALWAYS responsive!
    map.on("click", (e: any) => {
      if (Date.now() - lastMarkerClickTimeRef.current < 250) {
        return;
      }
      const { lat, lng } = e.latlng;
      if (onClientCoordsChangeRef.current) {
        onClientCoordsChangeRef.current([lat, lng]);
      }
    });

    // Collapse details on drag to keep map visible
    map.on("dragstart", () => {
      if (onMapInteractionRef.current) {
        onMapInteractionRef.current();
      }
    });

    mapInstanceRef.current = map;

    const resizeObserver = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize({ debounceMoveEvents: true });
      }
    });
    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [L]);

  // Update Tile Layer when Theme changes
  useEffect(() => {
    if (!L || !mapInstanceRef.current || !tileLayerRef.current) return;
    const cfg = getTileConfig(theme);
    mapInstanceRef.current.removeLayer(tileLayerRef.current);

    const newLayer = L.tileLayer(cfg.url, {
      subdomains: cfg.subdomains || "abcd",
      maxZoom: cfg.maxZoom,
      className: cfg.className,
      updateWhenIdle: false,
      updateWhenZooming: false,
      keepBuffer: 6,
    }).addTo(mapInstanceRef.current);

    tileLayerRef.current = newLayer;
  }, [theme, L]);

  // Smooth camera flight when explicitly triggered from search bar or GPS
  useEffect(() => {
    if (!mapInstanceRef.current || !flyToCoords) return;
    mapInstanceRef.current.flyTo(flyToCoords, 16, {
      duration: 0.8,
      easeLinearity: 0.25,
    });
  }, [flyToCoords]);

  // Render & Update Box Markers IN-PLACE
  useEffect(() => {
    if (!L || !markersLayerRef.current || !mapInstanceRef.current) return;

    const markersGroup = markersLayerRef.current;
    const markersMap = markersMapRef.current;
    const currentIds = new Set(filteredBoxes.map((b) => b.id));

    // Remove markers that are no longer in filteredBoxes
    for (const [id, marker] of markersMap.entries()) {
      if (!currentIds.has(id)) {
        markersGroup.removeLayer(marker);
        markersMap.delete(id);
      }
    }

    const isDark = theme === "dark" || theme === "satellite";

    filteredBoxes.forEach((box) => {
      let fillColor = "#10b981"; // Emerald

      if (!box.isNap) {
        fillColor = "#3b82f6"; // Azul Manga
      } else if (box.status === "ocupada") {
        fillColor = "#ef4444"; // Rojo Saturada
      } else if (box.status === "critica") {
        fillColor = "#f59e0b"; // Ámbar Crítica
      }

      const isTarget = targetNap?.id === box.id;
      const isSelected = selectedBox?.id === box.id;
      const radius = getBoxRadius(box.isNap, isTarget, isSelected, currentZoom);
      const weight = isTarget ? 2.5 : isSelected ? 2 : 1;
      const color = isTarget ? "#0284c7" : isSelected ? "#ffffff" : isDark ? "#ffffff" : "#0f172a";
      const opacity = isTarget || isSelected ? 1 : 0.75;
      const fillOpacity = isTarget || isSelected ? 1 : 0.85;

      const existingMarker = markersMap.get(box.id);

      if (existingMarker) {
        existingMarker.setStyle({
          fillColor,
          color,
          weight,
          opacity,
          fillOpacity,
        });
        existingMarker.setRadius(radius);
      } else {
        const circle = L.circleMarker([box.lat, box.lng], {
          renderer: canvasRendererRef.current || undefined,
          radius,
          fillColor,
          color,
          weight,
          opacity,
          fillOpacity,
        });

        // Click on marker: clean event stop, never locks map click
        const handleMarkerSelect = (ev: any) => {
          lastMarkerClickTimeRef.current = Date.now();
          if (ev.originalEvent) {
            L.DomEvent.stopPropagation(ev.originalEvent);
            ev.originalEvent._stopped = true;
          }
          if (onSelectBoxRef.current) {
            onSelectBoxRef.current(box);
          }
        };

        circle.on("click", handleMarkerSelect);

        markersGroup.addLayer(circle);
        markersMap.set(box.id, circle);
      }
    });
  }, [L, filteredBoxes, selectedBox?.id, targetNap?.id, theme, currentZoom]);

  // Render & Update Client Location, Radii and Smart Street Polyline IN-PLACE
  useEffect(() => {
    if (!L || !clientLayerRef.current || !mapInstanceRef.current) return;
    const group = clientLayerRef.current;

    if (!clientCoords) {
      group.clearLayers();
      clientMarkerRef.current = null;
      kmCircleRef.current = null;
      optCircleRef.current = null;
      maxCircleRef.current = null;
      polylineRef.current = null;
      return;
    }

    const [cLat, cLng] = clientCoords;

    // 1000m Circle (1 km Consultation Area) - interactive: false so it NEVER intercepts clicks
    if (kmCircleRef.current) {
      kmCircleRef.current.setLatLng([cLat, cLng]);
    } else {
      kmCircleRef.current = L.circle([cLat, cLng], {
        radius: 1000,
        color: "#94a3b8",
        weight: 1,
        dashArray: "6, 10",
        fillColor: "#3b82f6",
        fillOpacity: 0.02,
        interactive: false,
      }).addTo(group);
    }

    // 150m Circle (Optimal Drop Radius) - interactive: false
    if (optCircleRef.current) {
      optCircleRef.current.setLatLng([cLat, cLng]);
    } else {
      optCircleRef.current = L.circle([cLat, cLng], {
        radius: 150,
        color: "#10b981",
        weight: 1.5,
        dashArray: "4, 6",
        fillColor: "#10b981",
        fillOpacity: 0.08,
        interactive: false,
      }).addTo(group);
    }

    // 250m Circle (Maximum Drop Limit) - interactive: false
    if (maxCircleRef.current) {
      maxCircleRef.current.setLatLng([cLat, cLng]);
    } else {
      maxCircleRef.current = L.circle([cLat, cLng], {
        radius: 250,
        color: "#f59e0b",
        weight: 1.25,
        dashArray: "3, 6",
        fillColor: "#f59e0b",
        fillOpacity: 0.03,
        interactive: false,
      }).addTo(group);
    }

    // Connecting line to Target NAP (Street route or straight fallback)
    if (targetNap) {
      const dist = routeDistance ?? calculateDistanceMeters(cLat, cLng, targetNap.lat, targetNap.lng);
      const isOptimal = dist <= 150;
      const lineColor = isOptimal ? "#10b981" : dist <= 250 ? "#f59e0b" : "#ef4444";

      // If we have street waypoints, use them so line follows the actual road
      const lineCoords: [number, number][] =
        routeGeometry && routeGeometry.length > 1
          ? routeGeometry
          : [
              [cLat, cLng],
              [targetNap.lat, targetNap.lng],
            ];

      const tooltipText = isCalculatingRoute
        ? "Calculando ruta vial..."
        : isStreetRoute
        ? `${dist}m por calle`
        : `${dist}m (directa)`;

      if (polylineRef.current) {
        polylineRef.current.setLatLngs(lineCoords);
        polylineRef.current.setStyle({
          color: lineColor,
          weight: isStreetRoute ? 3.5 : 2,
          dashArray: isStreetRoute ? "none" : "6, 6",
          opacity: 0.95,
        });
        polylineRef.current.setTooltipContent(tooltipText);
      } else {
        polylineRef.current = L.polyline(lineCoords, {
          color: lineColor,
          weight: isStreetRoute ? 3.5 : 2,
          dashArray: isStreetRoute ? "none" : "6, 6",
          opacity: 0.95,
          interactive: false, // Never blocks clicks
        })
          .bindTooltip(tooltipText, {
            permanent: true,
            direction: "center",
            className: "feasibility-dist-badge",
          })
          .addTo(group);
      }
    } else if (polylineRef.current) {
      group.removeLayer(polylineRef.current);
      polylineRef.current = null;
    }

    // Draggable Client Location Pin
    if (clientMarkerRef.current) {
      clientMarkerRef.current.setLatLng([cLat, cLng]);
    } else {
      const pinIcon = L.divIcon({
        className: "client-pin-dot",
        html: `<div style="width: 15px; height: 15px; border-radius: 9999px; background: #8b5cf6; border: 2px solid #ffffff; box-shadow: 0 0 0 2.5px rgba(139,92,246,0.35), 0 2px 6px rgba(0,0,0,0.3); cursor: grab;"></div>`,
        iconSize: [15, 15],
        iconAnchor: [7.5, 7.5],
      });

      const marker = L.marker([cLat, cLng], {
        icon: pinIcon,
        draggable: true,
        zIndexOffset: 1000,
      })
        .bindTooltip("Ubicación del cliente", {
          permanent: true,
          direction: "top",
          offset: [0, -10],
          className: "client-pin-tooltip",
        })
        .addTo(group);

      marker.on("dragend", (ev: any) => {
        const { lat, lng } = ev.target.getLatLng();
        if (onClientCoordsChangeRef.current) {
          onClientCoordsChangeRef.current([lat, lng]);
        }
      });

      clientMarkerRef.current = marker;
    }
  }, [
    L,
    clientCoords,
    targetNap?.id,
    routeGeometry,
    routeDistance,
    isStreetRoute,
    isCalculatingRoute,
    currentZoom,
  ]);

  // Advisor GPS Geolocation
  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation || !mapInstanceRef.current || !L) return;
    setIsLocating(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const { latitude, longitude } = pos.coords;
        onUserCoordsChange([latitude, longitude]);

        if (userMarkerRef.current) {
          mapInstanceRef.current.removeLayer(userMarkerRef.current);
        }

        const userMarker = L.circleMarker([latitude, longitude], {
          radius: 7,
          fillColor: "#0284c7",
          color: "#ffffff",
          weight: 2,
          opacity: 1,
          fillOpacity: 0.95,
        }).bindTooltip("Tu GPS actual", { permanent: false, direction: "top" });

        userMarker.addTo(mapInstanceRef.current);
        userMarkerRef.current = userMarker;

        mapInstanceRef.current.flyTo([latitude, longitude], 16, { duration: 0.8 });
      },
      (err) => {
        setIsLocating(false);
        console.warn("No se pudo obtener la geolocalización:", err);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [L, onUserCoordsChange]);

  const containerBg =
    theme === "dark" ? "bg-[#18181b]" : theme === "satellite" ? "bg-[#121212]" : "bg-[#f5f5f4]";

  return (
    <div className={`relative w-full h-full min-h-[450px] overflow-hidden select-none ${containerBg}`}>
      <div ref={mapContainerRef} className="w-full h-full z-0 bg-transparent cursor-crosshair" />

      {/* Floating GPS Button */}
      <div className="absolute bottom-16 sm:bottom-4 right-3 z-10">
        <button
          type="button"
          onClick={handleLocateMe}
          title="Centrar en mi ubicación actual"
          className="text-xs font-mono text-neutral-600 hover:text-neutral-900 transition-colors cursor-pointer flex items-center gap-1.5 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xs px-2 py-1"
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isLocating ? "bg-amber-500 animate-ping" : userCoords ? "bg-emerald-500" : "bg-neutral-400"
            }`}
          />
          <span>{isLocating ? "Buscando..." : userCoords ? "GPS activo" : "Mi ubicación"}</span>
        </button>
      </div>
    </div>
  );
}

// React.memo with prop comparison prevents re-rendering on parent form inputs, timers, or loaders
const FactibilidadMap = React.memo(FactibilidadMapInner, (prev, next) => {
  return (
    prev.boxes === next.boxes &&
    prev.theme === next.theme &&
    prev.selectedBox?.id === next.selectedBox?.id &&
    prev.filterType === next.filterType &&
    prev.searchTerm === next.searchTerm &&
    prev.userCoords?.[0] === next.userCoords?.[0] &&
    prev.userCoords?.[1] === next.userCoords?.[1] &&
    prev.clientCoords?.[0] === next.clientCoords?.[0] &&
    prev.clientCoords?.[1] === next.clientCoords?.[1] &&
    prev.targetNap?.id === next.targetNap?.id &&
    prev.routeDistance === next.routeDistance &&
    prev.isStreetRoute === next.isStreetRoute &&
    prev.isCalculatingRoute === next.isCalculatingRoute &&
    prev.routeGeometry?.length === next.routeGeometry?.length &&
    prev.flyToCoords?.[0] === next.flyToCoords?.[0] &&
    prev.flyToCoords?.[1] === next.flyToCoords?.[1]
  );
});

export default FactibilidadMap;
