"use client";

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import type { OzBox } from "@/lib/ozmap-service";
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

  // Pure open raster tiles rendered with Carto Positron / Carto Dark Matter CSS filters
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
}: FactibilidadMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const [L, setL] = useState<any>(null);
  const [isLocating, setIsLocating] = useState(false);

  // Dynamic client-side Leaflet import
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

  // Filter boxes according to active tab and search query
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

    // Center Caracas / Altos Mirandinos
    const map = L.map(mapContainerRef.current, {
      center: [10.4674, -66.9058],
      zoom: 14,
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true, // Hardware-accelerated canvas for 6,500+ markers
    });

    // Zoom controls bottom-right
    L.control.zoom({ position: "bottomright" }).addTo(map);

    const cfg = getTileConfig(theme);
    const tileLayer = L.tileLayer(cfg.url, {
      subdomains: cfg.subdomains || ["a", "b", "c"],
      maxZoom: cfg.maxZoom,
      className: cfg.className,
    }).addTo(map);
    tileLayerRef.current = tileLayer;

    const markersGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = markersGroup;

    mapInstanceRef.current = map;

    setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
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
      subdomains: cfg.subdomains || ["a", "b", "c"],
      maxZoom: cfg.maxZoom,
      className: cfg.className,
    }).addTo(mapInstanceRef.current);

    tileLayerRef.current = newLayer;
  }, [theme, L]);

  // Render Markers on Map
  useEffect(() => {
    if (!L || !markersLayerRef.current || !mapInstanceRef.current) return;

    const markersGroup = markersLayerRef.current;
    markersGroup.clearLayers();

    const isDark = theme === "dark" || theme === "satellite";

    filteredBoxes.forEach((box) => {
      let fillColor = "#10b981"; // Emerald (>2 disponibles)
      let strokeColor = isDark ? "#ffffff" : "#0f172a";

      if (!box.isNap) {
        fillColor = "#3b82f6"; // Azul Manga
      } else if (box.status === "ocupada") {
        fillColor = "#ef4444"; // Rojo Saturada
      } else if (box.status === "critica") {
        fillColor = "#f59e0b"; // Ámbar Crítica
      }

      const isSelected = selectedBox?.id === box.id;
      const radius = isSelected ? 8 : box.isNap ? 5 : 4;
      const weight = isSelected ? 2.5 : 1;

      const circle = L.circleMarker([box.lat, box.lng], {
        radius,
        fillColor,
        color: isSelected ? "#ffffff" : strokeColor,
        weight,
        opacity: isSelected ? 1 : 0.7,
        fillOpacity: isSelected ? 0.95 : 0.85,
      });

      // Minimalist hover tooltip
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

      circle.on("click", () => {
        onSelectBox(box);
      });

      markersGroup.addLayer(circle);
    });
  }, [L, filteredBoxes, selectedBox, theme, onSelectBox]);

  // Center on selected box
  useEffect(() => {
    if (!mapInstanceRef.current || !selectedBox) return;
    mapInstanceRef.current.setView([selectedBox.lat, selectedBox.lng], 17, {
      animate: true,
      duration: 0.6,
    });
  }, [selectedBox]);

  // User GPS Geolocation handler
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
        }).bindTooltip("Tu ubicación actual", { permanent: false, direction: "top" });

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
      {/* Map Element */}
      <div ref={mapContainerRef} className="w-full h-full z-0 bg-transparent" />

      {/* Floating GPS Button */}
      <div className="absolute top-3 right-3 z-10">
        <button
          type="button"
          onClick={handleLocateMe}
          title="Centrar en mi ubicación actual"
          className="text-xs font-mono text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer flex items-center gap-1.5 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-xs px-2 py-1"
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

        /* Carto Positron minimal light shader: Clean desaturated streets, identical to Carto Positron without watermark */
        .map-tiles-carto-light {
          filter: grayscale(88%) contrast(1.08) brightness(1.02) !important;
        }

        /* Carto Dark Matter minimal dark shader: Deep slate night theme, high contrast */
        .map-tiles-carto-dark {
          filter: invert(100%) hue-rotate(180deg) brightness(82%) contrast(115%) grayscale(30%) !important;
        }

        /* Satellite imagery shader */
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
      `}</style>
    </div>
  );
}
