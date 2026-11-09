"use client";

import { useState, useEffect, useMemo } from "react";
import { X, Loader2 } from "lucide-react";
import {
  PlanningSheetRecord,
  PlanningMetadata,
  NewPlanningItem,
  getMonthFromDate,
  toIsoDateString,
} from "@/lib/planificacion-service";
import { CustomDropdown } from "@/components/ui/custom-dropdown";

interface PlanificadorEditDialogProps {
  record: PlanningSheetRecord | null;
  metadata: PlanningMetadata;
  isOpen: boolean;
  onClose: () => void;
  onSave: (sheetRowIndex: number, updatedItem: NewPlanningItem) => Promise<boolean>;
}

export function PlanificadorEditDialog({
  record,
  metadata,
  isOpen,
  onClose,
  onSave,
}: PlanificadorEditDialogProps) {
  const [fecha, setFecha] = useState("");
  const [asesor, setAsesor] = useState("");
  const [estado, setEstado] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [parroquia, setParroquia] = useState("");
  const [sector, setSector] = useState("");
  const [actividad, setActividad] = useState("");
  const [estatus, setEstatus] = useState("Planificado");

  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initialize values when record changes
  useEffect(() => {
    if (record) {
      setFecha(record.isoFecha || toIsoDateString(record.fecha));
      setAsesor(record.asesor);
      setEstado(record.estado || "Distrito Capital");
      setMunicipio(record.municipio || "Libertador");
      setParroquia(record.parroquia || "Sucre (Catia)");
      setSector(record.sector || "");
      setActividad(record.tipo_actividad || "Recorrido con Instaladores");
      setEstatus(record.estatus || "Planificado");
      setErrorMsg(null);
    }
  }, [record]);

  // Available municipios based on selected estado
  const availableMunicipios = useMemo(() => {
    if (!estado || !metadata.geoHierarchy[estado]) return [];
    return Object.keys(metadata.geoHierarchy[estado]).sort();
  }, [metadata.geoHierarchy, estado]);

  // Available parroquias based on selected municipio
  const availableParroquias = useMemo(() => {
    if (!estado || !municipio || !metadata.geoHierarchy[estado]?.[municipio]) return [];
    return Object.keys(metadata.geoHierarchy[estado][municipio]).sort();
  }, [metadata.geoHierarchy, estado, municipio]);

  // Available sectores based on selected parroquia
  const availableSectores = useMemo(() => {
    if (!estado || !municipio || !parroquia || !metadata.geoHierarchy[estado]?.[municipio]?.[parroquia]) return [];
    return metadata.geoHierarchy[estado][municipio][parroquia]
      .slice()
      .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  }, [metadata.geoHierarchy, estado, municipio, parroquia]);

  if (!isOpen || !record) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fecha) {
      setErrorMsg("La fecha es requerida.");
      return;
    }
    if (!asesor) {
      setErrorMsg("El asesor es requerido.");
      return;
    }
    if (!sector) {
      setErrorMsg("El sector es requerido.");
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    try {
      const mes = getMonthFromDate(fecha);
      const ok = await onSave(record.sheetRowIndex, {
        fecha,
        mes,
        asesor,
        estado,
        municipio,
        parroquia,
        sector,
        tipo_actividad: actividad,
        estatus,
      });

      if (ok) {
        onClose();
      } else {
        setErrorMsg("Error al guardar la actualización en la hoja.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Error al actualizar");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/40 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white p-6 space-y-5 animate-in zoom-in-95 duration-150 shadow-2xl border border-neutral-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900 tracking-tight">
              Editar jornada en Sheet Data
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Fila {record.sheetRowIndex} · {record.mes}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4 stroke-[1.5]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Fecha */}
            <div>
              <label className="text-[11px] text-neutral-400 block mb-1">
                Fecha
              </label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full text-xs border-b border-neutral-200 focus:border-neutral-900 bg-transparent py-1.5 text-neutral-900 outline-hidden font-mono"
              />
            </div>

            {/* Asesor */}
            <div>
              <label className="text-[11px] text-neutral-400 block mb-1">
                Asesor
              </label>
              <CustomDropdown
                value={asesor}
                options={metadata.advisors}
                onChange={(val) => setAsesor(val)}
                compact
                searchable
              />
            </div>
          </div>

          {/* Territorial Cascading */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="text-[11px] text-neutral-400 block mb-1">
                Estado
              </label>
              <CustomDropdown
                value={estado}
                options={Object.keys(metadata.geoHierarchy).sort()}
                onChange={(val) => {
                  setEstado(val);
                  const firstMun = Object.keys(metadata.geoHierarchy[val] || {})[0] || "";
                  setMunicipio(firstMun);
                  const firstPar = firstMun ? Object.keys(metadata.geoHierarchy[val]?.[firstMun] || {})[0] || "" : "";
                  setParroquia(firstPar);
                  const firstSec = firstPar ? (metadata.geoHierarchy[val]?.[firstMun]?.[firstPar] || [])[0] || "" : "";
                  setSector(firstSec);
                }}
                compact
              />
            </div>

            <div>
              <label className="text-[11px] text-neutral-400 block mb-1">
                Municipio
              </label>
              <CustomDropdown
                value={municipio}
                options={availableMunicipios}
                onChange={(val) => {
                  setMunicipio(val);
                  const firstPar = Object.keys(metadata.geoHierarchy[estado]?.[val] || {})[0] || "";
                  setParroquia(firstPar);
                  const firstSec = firstPar ? (metadata.geoHierarchy[estado]?.[val]?.[firstPar] || [])[0] || "" : "";
                  setSector(firstSec);
                }}
                compact
              />
            </div>

            <div>
              <label className="text-[11px] text-neutral-400 block mb-1">
                Parroquia
              </label>
              <CustomDropdown
                value={parroquia}
                options={availableParroquias}
                onChange={(val) => {
                  setParroquia(val);
                  const firstSec = (metadata.geoHierarchy[estado]?.[municipio]?.[val] || [])[0] || "";
                  setSector(firstSec);
                }}
                compact
              />
            </div>

            <div>
              <label className="text-[11px] text-neutral-400 block mb-1">
                Sector
              </label>
              <CustomDropdown
                value={sector}
                options={availableSectores}
                onChange={(val) => setSector(val)}
                compact
                searchable
              />
            </div>
          </div>

          {/* Actividad y Estatus */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="text-[11px] text-neutral-400 block mb-1">
                Tipo de actividad
              </label>
              <CustomDropdown
                value={actividad}
                options={metadata.activities}
                onChange={(val) => setActividad(val)}
                compact
              />
            </div>

            <div>
              <label className="text-[11px] text-neutral-400 block mb-1">
                Estatus
              </label>
              <CustomDropdown
                value={estatus}
                options={metadata.statuses}
                onChange={(val) => setEstatus(val)}
                compact
              />
            </div>
          </div>

          {errorMsg && (
            <p className="text-xs text-neutral-600 animate-in fade-in">
              {errorMsg}
            </p>
          )}

          <div className="pt-3 flex items-center justify-end gap-4 border-t border-neutral-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="text-xs text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="text-xs font-semibold text-neutral-950 hover:text-neutral-600 transition-colors cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
            >
              {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin stroke-[1.5]" />}
              <span>{isSaving ? "Guardando en Sheet..." : "Guardar cambios"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

