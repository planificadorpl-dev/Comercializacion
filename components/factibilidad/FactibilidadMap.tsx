"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import type { OzBox } from "@/lib/ozmap-service";
import "leaflet/dist/leaflet.css";

interface FactibilidadMapProps {
  boxes: OzBox[];
  theme: "dark" | "light";
  selectedBox: OzBox | null;
  onSelectBox: (box: OzBox | null) => void;
  filterType: "all" | "naps" | "mangas" | "disponibles";
  searchTerm: string;
}

// CARTO Positron (Light) & CARTO Dark Matter (Dark) Tile URLs
const TILES = {
  light: {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap',
    subdomains: "abcd",
  },
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap',
    subdomains: "abcd",
  },
};

export default function FactibilidadMap({
  boxes,
  theme,
  selectedBox,
  onSelectBox,
  filterType,
  searchTerm,
}: FactibilidadMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const [L, setL] = useState<any>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

  // Load leaflet dynamically on client side
  useEffect(() => {
    let mounted = true;
    import("leaflet").then((leafletModule) => {
      if (mounted) {
        setL(leafletModule.default || leafletModule);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Filter boxes according to active tabs and search text
  const filteredBoxes = useMemo(() => {
    let list = boxes;
    if (filterType === "naps") {
      list = list.filter((b) => b.isNap);
    } else if (filterType === "mangas") {
      list = list.filter((b) => !b.isNap);
    } else if (filterType === "disponibles") {
      list = list.filter((b) => b.isNap && b.availablePorts > 0);
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

  // Initialize Leaflet map
  useEffect(() => {
    if (!L || !mapContainerRef.current || mapInstanceRef.current) return;

    // Center on Caracas / Altos Mirandinos (approx 10.45, -66.90)
    const map = L.map(mapContainerRef.current, {
      center: [10.4674, -66.9058],
      zoom: 14,
      zoomControl: false,
      attributionControl: false,
    });

    // Add minimal zoom controls on bottom right
    L.control.zoom({ position: "bottomright" }).addTo(map);

    // Initial tile layer
    const currentTile = TILES[theme];
    const tileLayer = L.tileLayer(currentTile.url, {
      subdomains: currentTile.subdomains,
      maxZoom: 19,
    }).addTo(map);

    tileLayerRef.current = tileLayer;

    // Layer group for box markers
    const markersGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = markersGroup;

    mapInstanceRef.current = map;

    // Invalidate size on mount
    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [L]);

  // Update map tile layer when theme changes (Carto Light <-> Carto Dark)
  useEffect(() => {
    if (!L || !mapInstanceRef.current || !tileLayerRef.current) return;
    const currentTile = TILES[theme];
    mapInstanceRef.current.removeLayer(tileLayerRef.current);

    const newLayer = L.tileLayer(currentTile.url, {
      subdomains: currentTile.subdomains,
      maxZoom: 19,
    }).addTo(mapInstanceRef.current);

    tileLayerRef.current = newLayer;
  }, [theme, L]);

  // Render markers on the map
  useEffect(() => {
    if (!L || !markersLayerRef.current || !mapInstanceRef.current) return;

    const markersGroup = markersLayerRef.current;
    markersGroup.clearLayers();

    // Color definitions
    // Disponible = Emerald (#10b981), Ocupada = Red/Neutral, Crítica = Amber (#f59e0b), Manga = Blue (#3b82f6)
    const isDark = theme === "dark";

    filteredBoxes.forEach((box) => {
      let fillColor = "#10b981"; // Emerald
      let borderColor = isDark ? "#ffffff" : "#0f172a";

      if (!box.isNap) {
        fillColor = "#3b82f6"; // Blue Manga
      } else if (box.status === "ocupada") {
        fillColor = "#ef4444"; // Red Ocupada
      } else if (box.status === "critica") {
        fillColor = "#f59e0b"; // Amber Crítica
      }

      const isSelected = selectedBox?.id === box.id;
      const radius = isSelected ? 8 : box.isNap ? 5 : 4;
      const weight = isSelected ? 2.5 : 1;

      const circle = L.circleMarker([box.lat, box.lng], {
        radius,
        fillColor,
        color: isSelected ? "#ffffff" : borderColor,
        weight,
        opacity: isSelected ? 1 : 0.7,
        fillOpacity: isSelected ? 0.95 : 0.8,
      });

      // Minimalist tooltip
      const popupHtml = `
        <div style="font-family: system-ui, sans-serif; font-size: 11px; line-height: 1.4; color: ${
          isDark ? "#fafafa" : "#171717"
        }; min-width: 170px;">
          <div style="font-weight: 600; font-size: 12px; margin-bottom: 2px;">${box.name}</div>
          <div style="color: ${isDark ? "#a3a3a3" : "#737373"}; font-size: 10px; margin-bottom: 6px;">
            ${box.boxTypeName} &bull; ${box.sector || "Sector no esp."}
          </div>
          ${
            box.isNap
              ? `
            <div style="display: flex; justify-content: space-between; border-top: 1px solid ${
              isDark ? "#333" : "#e5e5e5"
            }; padding-top: 4px; margin-bottom: 4px;">
              <span>Puertos libres:</span>
              <strong style="color: ${
                box.availablePorts > 2 ? "#10b981" : box.availablePorts > 0 ? "#f59e0b" : "#ef4444"
              };">${box.availablePorts} de ${box.totalPorts}</strong>
            </div>
          `
              : ""
          }
          ${
            box.potencia
              ? `<div style="font-size: 10px; color: ${isDark ? "#a3a3a3" : "#737373"};">Potencia: <strong>${box.potencia}</strong></div>`
              : ""
          }
        </div>
      `;

      circle.bindTooltip(popupHtml, {
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

  // Center on selected box when it changes
  useEffect(() => {
    if (!mapInstanceRef.current || !selectedBox) return;
    mapInstanceRef.current.setView([selectedBox.lat, selectedBox.lng], 17, {
      animate: true,
      duration: 0.8,
    });
  }, [selectedBox]);

  // Geolocate user device
  const handleLocateMe = () => {
    if (!navigator.geolocation || !mapInstanceRef.current) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserLocation([latitude, longitude]);
        mapInstanceRef.current.setView([latitude, longitude], 17, { animate: true });

        if (L) {
          const userMarker = L.circleMarker([latitude, longitude], {
            radius: 8,
            fillColor: "#06b6d4",
            color: "#ffffff",
            weight: 2,
            fillOpacity: 0.9,
          }).bindTooltip("Tu ubicación actual", { permanent: true, direction: "top" });
          userMarker.addTo(mapInstanceRef.current);
        }
      },
      (err) => {
        console.warn("No se pudo obtener la geolocalización:", err);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="relative w-full h-full min-h-[500px] overflow-hidden select-none">
      {/* Map container */}
      <div ref={mapContainerRef} className="w-full h-full z-0 bg-transparent" />

      {/* Floating GPS Locate Button (Minimalist, zero frame) */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <button
          type="button"
          onClick={handleLocateMe}
          title="Centrar en mi ubicación actual"
          className="text-xs font-mono text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Mi GPS</span>
        </button>
      </div>

      <style jsx global>{`
        .leaflet-container {
          background-color: transparent !important;
          outline: none;
        }
        .carto-tooltip-dark {
          background: #171717 !important;
          border: 1px solid #262626 !important;
          color: #fafafa !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4) !important;
          padding: 8px 10px !important;
          border-radius: 6px !important;
        }
        .carto-tooltip-dark .leaflet-tooltip-tip {
          background: #171717 !important;
        }
        .carto-tooltip-light {
          background: #ffffff !important;
          border: 1px solid #e5e5e5 !important;
          color: #171717 !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08) !important;
          padding: 8px 10px !important;
          border-radius: 6px !important;
        }
        .carto-tooltip-light .leaflet-tooltip-tip {
          background: #ffffff !important;
        }
      `}</style>
    </div>
  );
}

