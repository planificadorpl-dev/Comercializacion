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

  return {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    className: theme === "dark" ? "map-tiles-carto-dark" : "map-tiles-carto-light",
    maxZoom: 19,
    subdomains: ["a", "b", "c"],
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  };
};

export default function FactibilidadMap({
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
}: FactibilidadMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const clientLayerRef = useRef<any>(null);
  const [L, setL] = useState<any>(null);
  const [isLocating, setIsLocating] = useState(false);

  // Dynamic Leaflet import on client
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
      preferCanvas: true,
    });

    L.control.zoom({ position: "bottomright" }).addTo(map);

    const cfg = getTileConfig(theme);
    const tileLayer = L.tileLayer(cfg.url, {
      subdomains: cfg.subdomains || ["a", "b", "c"],
      maxZoom: cfg.maxZoom,
      className: cfg.className,
    }).addTo(map);
    tileLayerRef.current = tileLayer;

    // Layer for all boxes
    const markersGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = markersGroup;

    // Layer for client pin, radiuses, and connection line
    const clientGroup = L.layerGroup().addTo(map);
    clientLayerRef.current = clientGroup;

    // Click on map to place or move client point
    map.on("click", (e: any) => {
      const { lat, lng } = e.latlng;
      onClientCoordsChange([lat, lng]);
    });

    mapInstanceRef.current = map;

    setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [L, onClientCoordsChange]);

  // Update Tile Layer when Theme changes
  useEffect(() => {
    if (!L || !mapInstanceRef.current || !tileLayerRef.current) return;
    const cfg = getTileConfig(theme);
    mapInstanceRef.current.removeLayer(tileLayerRef.current);

    const newLayer = L.tileLayer(cfg.url, {
      subdomains: cfg.subdomains || ["a", "b", "c"],
      maxZoom: cfg.maxZoom,
      className: cfg.className,
    }).addTo(mapInstanceRef.current);

    tileLayerRef.current = newLayer;
  }, [theme, L]);

  // Render Box Markers
  useEffect(() => {
    if (!L || !markersLayerRef.current || !mapInstanceRef.current) return;

    const markersGroup = markersLayerRef.current;
    markersGroup.clearLayers();

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

      const circle = L.circleMarker([box.lat, box.lng], {
        radius,
        fillColor,
        color: isTarget ? "#0284c7" : isSelected ? "#ffffff" : strokeColor,
        weight,
        opacity: isTarget || isSelected ? 1 : 0.7,
        fillOpacity: isTarget || isSelected ? 1 : 0.85,
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

      circle.on("click", (ev: any) => {
        L.DomEvent.stopPropagation(ev);
        onSelectBox(box);
      });

      markersGroup.addLayer(circle);
    });
  }, [L, filteredBoxes, selectedBox, targetNap, theme, onSelectBox]);

  // Render Client Location, Coverage Radii (150m & 250m) and Feasibility Line
  useEffect(() => {
    if (!L || !clientLayerRef.current || !mapInstanceRef.current) return;

    const group = clientLayerRef.current;
    group.clearLayers();

    if (!clientCoords) return;

    const [cLat, cLng] = clientCoords;

    // 1000m Circle (1 km Consultation Area)
    const kmCircle = L.circle([cLat, cLng], {
      radius: 1000,
      color: "#94a3b8",
      weight: 1,
      dashArray: "6, 10",
      fillColor: "#3b82f6",
      fillOpacity: 0.02,
    });
    group.addLayer(kmCircle);

    // 150m Circle (Optimal Drop Radius)
    const optCircle = L.circle([cLat, cLng], {
      radius: 150,
      color: "#10b981",
      weight: 1.5,
      dashArray: "4, 6",
      fillColor: "#10b981",
      fillOpacity: 0.08,
    });
    group.addLayer(optCircle);

    // 250m Circle (Maximum Drop Limit)
    const maxCircle = L.circle([cLat, cLng], {
      radius: 250,
      color: "#f59e0b",
      weight: 1.25,
      dashArray: "3, 6",
      fillColor: "#f59e0b",
      fillOpacity: 0.03,
    });
    group.addLayer(maxCircle);

    // Connecting dashed line to Target NAP (nearest available)
    if (targetNap) {
      const dist = calculateDistanceMeters(cLat, cLng, targetNap.lat, targetNap.lng);
      const isOptimal = dist <= 150;

      const polyline = L.polyline(
        [
          [cLat, cLng],
          [targetNap.lat, targetNap.lng],
        ],
        {
          color: isOptimal ? "#10b981" : dist <= 250 ? "#f59e0b" : "#ef4444",
          weight: 2,
          dashArray: "6, 6",
          opacity: 0.9,
        }
      ).bindTooltip(`${dist} metros`, {
        permanent: true,
        direction: "center",
        className: "feasibility-dist-badge",
      });
      group.addLayer(polyline);
    }

    // Client Location Pin
    const clientMarker = L.circleMarker([cLat, cLng], {
      radius: 9,
      fillColor: "#8b5cf6", // Purple distinct client pin
      color: "#ffffff",
      weight: 3,
      opacity: 1,
      fillOpacity: 0.95,
    }).bindTooltip("Ubicación del cliente", {
      permanent: true,
      direction: "top",
      offset: [0, -10],
      className: "client-pin-tooltip",
    });
    group.addLayer(clientMarker);

    // Only adjust view if the queried coordinates are not currently visible on screen
    // (Prevents jarring camera jumping and zoom in/out bounce when user clicks on map)
    const map = mapInstanceRef.current;
    if (map) {
      const isVisible = map.getBounds().contains([cLat, cLng]);
      if (!isVisible) {
        const currentZoom = map.getZoom();
        const targetZoom = currentZoom < 14 ? 16 : currentZoom;
        map.setView([cLat, cLng], targetZoom, { animate: true, duration: 0.4 });
      }
    }
  }, [L, clientCoords, targetNap]);

  // Gentle pan to selected box without changing zoom level
  useEffect(() => {
    if (!mapInstanceRef.current || !selectedBox) return;
    mapInstanceRef.current.panTo([selectedBox.lat, selectedBox.lng], {
      animate: true,
      duration: 0.3,
    });
  }, [selectedBox]);

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

        mapInstanceRef.current.setView([latitude, longitude], 16, { animate: true });
      },
      (err) => {
        setIsLocating(false);
        console.warn("No se pudo obtener la geolocalización:", err);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [L, onUserCoordsChange]);

  return (
    <div className="relative w-full h-full min-h-[450px] overflow-hidden select-none bg-neutral-100 dark:bg-neutral-900">
      <div ref={mapContainerRef} className="w-full h-full z-0 bg-transparent cursor-crosshair" />

      {/* Floating GPS Button */}
      <div className="absolute top-3 right-3 z-10">
        <button
          type="button"
          onClick={handleLocateMe}
          title="Centrar en mi ubicación actual"
          className="text-xs font-mono text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer flex items-center gap-1.5 bg-white/75 dark:bg-neutral-900/75 backdrop-blur-xs px-2 py-1"
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isLocating ? "bg-amber-500 animate-ping" : userCoords ? "bg-emerald-500" : "bg-neutral-400"
            }`}
          />
          <span>{isLocating ? "Buscando..." : userCoords ? "GPS activo" : "Mi ubicación"}</span>
        </button>
      </div>

      <style jsx global>{`
        .leaflet-container {
          background-color: transparent !important;
          outline: none;
        }

        .map-tiles-carto-light {
          filter: grayscale(88%) contrast(1.08) brightness(1.02) !important;
        }

        .map-tiles-carto-dark {
          filter: invert(100%) hue-rotate(180deg) brightness(82%) contrast(115%) grayscale(30%) !important;
        }

        .map-tiles-satellite {
          filter: saturate(1.1) contrast(1.05) !important;
        }

        .carto-tooltip-dark {
          background: #171717 !important;
          border: 1px solid #262626 !important;
          color: #fafafa !important;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4) !important;
          padding: 6px 9px !important;
          border-radius: 4px !important;
        }
        .carto-tooltip-dark .leaflet-tooltip-tip {
          background: #171717 !important;
        }

        .carto-tooltip-light {
          background: #ffffff !important;
          border: 1px solid #e5e5e5 !important;
          color: #171717 !important;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08) !important;
          padding: 6px 9px !important;
          border-radius: 4px !important;
        }
        .carto-tooltip-light .leaflet-tooltip-tip {
          background: #ffffff !important;
        }

        .client-pin-tooltip {
          background: #8b5cf6 !important;
          border: none !important;
          color: #ffffff !important;
          font-family: system-ui, sans-serif !important;
          font-size: 11px !important;
          font-weight: 600 !important;
          padding: 3px 8px !important;
          border-radius: 4px !important;
          box-shadow: 0 2px 8px rgba(139, 92, 246, 0.4) !important;
        }
        .client-pin-tooltip .leaflet-tooltip-tip {
          background: #8b5cf6 !important;
        }

        .feasibility-dist-badge {
          background: #171717 !important;
          color: #ffffff !important;
          border: 1px solid #333333 !important;
          font-family: monospace !important;
          font-size: 11px !important;
          font-weight: 600 !important;
          padding: 2px 6px !important;
          border-radius: 4px !important;
        }
        .feasibility-dist-badge .leaflet-tooltip-tip {
          background: #171717 !important;
        }
      `}</style>
    </div>
  );
}
