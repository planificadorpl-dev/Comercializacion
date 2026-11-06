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
  flyToCoords?: [number, number] | null;
}

const getTileConfig = (theme: MapTheme) => {
  if (theme === "satellite") {
    return {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      className: "map-tiles-satellite",
      maxZoom: 19,
      attribution: "&copy; Esri, Maxar",
    };
  }

  if (theme === "dark") {
    return {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      className: "map-tiles-carto-dark",
      maxZoom: 19,
      attribution: "&copy; Esri, HERE, Garmin",
    };
  }

  // Light Canvas Base (Natively minimalist monochrome, no CSS filter flicker)
  return {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    className: "map-tiles-carto-light",
    maxZoom: 19,
    attribution: "&copy; Esri, HERE, Garmin",
  };
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
  flyToCoords,
}: FactibilidadMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const markersMapRef = useRef<Map<string, any>>(new Map());
  const userMarkerRef = useRef<any>(null);
  const clientLayerRef = useRef<any>(null);

  // Client visual element refs for in-place updates (no clearLayers flicker)
  const clientMarkerRef = useRef<any>(null);
  const kmCircleRef = useRef<any>(null);
  const optCircleRef = useRef<any>(null);
  const maxCircleRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);

  // Flag to prevent marker click from leaking to map click
  const isClickingMarkerRef = useRef(false);

  const [L, setL] = useState<any>(null);
  const [isLocating, setIsLocating] = useState(false);

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

    const map = L.map(mapContainerRef.current, {
      center: [10.4674, -66.9058],
      zoom: 14,
      zoomControl: false,
      attributionControl: false,
      preferCanvas: false, // SVG paths allow crisp, in-place style updates without full-canvas clearing
      fadeAnimation: true,
      zoomAnimation: true,
    });

    L.control.zoom({ position: "bottomright" }).addTo(map);

    const cfg = getTileConfig(theme);
    const tileLayer = L.tileLayer(cfg.url, {
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

    // Click on map to place or move client point (guaranteed isolated from marker clicks)
    map.on("click", (e: any) => {
      if (isClickingMarkerRef.current || e.originalEvent?._stopped) {
        return;
      }
      const { lat, lng } = e.latlng;
      if (onClientCoordsChangeRef.current) {
        onClientCoordsChangeRef.current([lat, lng]);
      }
    });

    mapInstanceRef.current = map;

    // ResizeObserver prevents black/unloaded strips when layout dimensions adjust
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

  // Render & Update Box Markers IN-PLACE (ZERO full layer wiping)
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
      let strokeColor = isDark ? "#ffffff" : "#0f172a";

      if (!box.isNap) {
        fillColor = "#3b82f6"; // Azul Manga
      } else if (box.status === "ocupada") {
        fillColor = "#ef4444"; // Rojo Saturada
      } else if (box.status === "critica") {
        fillColor = "#f59e0b"; // Ámbar Crítica
      }

      const isTarget = targetNap?.id === box.id;
      const isSelected = selectedBox?.id === box.id;
      const radius = isTarget || isSelected ? 8.5 : box.isNap ? 5 : 4;
      const weight = isTarget ? 3 : isSelected ? 2.5 : 1;
      const color = isTarget ? "#0284c7" : isSelected ? "#ffffff" : strokeColor;
      const opacity = isTarget || isSelected ? 1 : 0.75;
      const fillOpacity = isTarget || isSelected ? 1 : 0.85;

      const existingMarker = markersMap.get(box.id);

      if (existingMarker) {
        // Marker already on map: update style smoothly in-place!
        existingMarker.setStyle({
          fillColor,
          color,
          weight,
          opacity,
          fillOpacity,
        });
        existingMarker.setRadius(radius);
      } else {
        // New marker: create and add
        const circle = L.circleMarker([box.lat, box.lng], {
          radius,
          fillColor,
          color,
          weight,
          opacity,
          fillOpacity,
        });

        const tooltipContent = `
          <div style="font-family: system-ui, sans-serif; font-size: 11px; line-height: 1.35; color: ${
            isDark ? "#fafafa" : "#171717"
          }; min-width: 150px;">
            <div style="font-weight: 600; font-size: 11px; margin-bottom: 2px;">${box.name}</div>
            <div style="color: ${isDark ? "#a3a3a3" : "#737373"}; font-size: 10px; margin-bottom: 4px;">
              ${box.boxTypeName} &bull; ${box.sector || "Sector general"}
            </div>
            ${
              box.isNap
                ? `
              <div style="display: flex; justify-content: space-between; border-top: 1px solid ${
                isDark ? "#333" : "#e5e5e5"
              }; padding-top: 3px; font-size: 10px;">
                <span>Puertos libres:</span>
                <strong style="color: ${
                  box.availablePorts > 2 ? "#10b981" : box.availablePorts > 0 ? "#f59e0b" : "#ef4444"
                };">${box.availablePorts} de ${box.totalPorts}</strong>
              </div>
            `
                : ""
            }
          </div>
        `;

        circle.bindTooltip(tooltipContent, {
          direction: "top",
          offset: [0, -6],
          className: isDark ? "carto-tooltip-dark" : "carto-tooltip-light",
        });

        // Click on marker: isolates event so map click never triggers
        circle.on("click", (ev: any) => {
          isClickingMarkerRef.current = true;
          if (ev.originalEvent) {
            L.DomEvent.stopPropagation(ev.originalEvent);
            ev.originalEvent._stopped = true;
          }
          setTimeout(() => {
            isClickingMarkerRef.current = false;
          }, 200);

          if (onSelectBoxRef.current) {
            onSelectBoxRef.current(box);
          }
        });

        markersGroup.addLayer(circle);
        markersMap.set(box.id, circle);
      }
    });
  }, [L, filteredBoxes, selectedBox?.id, targetNap?.id, theme]);

  // Render & Update Client Location, Radii and Feasibility Line IN-PLACE
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

    // 1000m Circle (1 km Consultation Area)
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
      }).addTo(group);
    }

    // 150m Circle (Optimal Drop Radius)
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
      }).addTo(group);
    }

    // 250m Circle (Maximum Drop Limit)
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
      }).addTo(group);
    }

    // Connecting dashed line to Target NAP
    if (targetNap) {
      const dist = calculateDistanceMeters(cLat, cLng, targetNap.lat, targetNap.lng);
      const isOptimal = dist <= 150;
      const lineColor = isOptimal ? "#10b981" : dist <= 250 ? "#f59e0b" : "#ef4444";
      const lineCoords = [
        [cLat, cLng],
        [targetNap.lat, targetNap.lng],
      ];

      if (polylineRef.current) {
        polylineRef.current.setLatLngs(lineCoords);
        polylineRef.current.setStyle({ color: lineColor });
        polylineRef.current.setTooltipContent(`${dist} metros`);
      } else {
        polylineRef.current = L.polyline(lineCoords, {
          color: lineColor,
          weight: 2,
          dashArray: "6, 6",
          opacity: 0.9,
        })
          .bindTooltip(`${dist} metros`, {
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

    // Client Location Pin
    if (clientMarkerRef.current) {
      clientMarkerRef.current.setLatLng([cLat, cLng]);
    } else {
      clientMarkerRef.current = L.circleMarker([cLat, cLng], {
        radius: 9,
        fillColor: "#8b5cf6",
        color: "#ffffff",
        weight: 3,
        opacity: 1,
        fillOpacity: 0.95,
      })
        .bindTooltip("Ubicación del cliente", {
          permanent: true,
          direction: "top",
          offset: [0, -10],
          className: "client-pin-tooltip",
        })
        .addTo(group);
    }
  }, [L, clientCoords, targetNap?.id]);

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
    theme === "dark" ? "bg-[#242424]" : theme === "satellite" ? "bg-[#121212]" : "bg-[#e8ecef]";

  return (
    <div className={`relative w-full h-full min-h-[450px] overflow-hidden select-none ${containerBg}`}>
      <div ref={mapContainerRef} className="w-full h-full z-0 bg-transparent cursor-crosshair" />

      {/* Floating GPS Button */}
      <div className="absolute top-3 right-3 z-10">
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
    prev.flyToCoords?.[0] === next.flyToCoords?.[0] &&
    prev.flyToCoords?.[1] === next.flyToCoords?.[1]
  );
});

export default FactibilidadMap;
