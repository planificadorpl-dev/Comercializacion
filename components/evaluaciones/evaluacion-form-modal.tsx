"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { X, RotateCcw, CheckCheck, Save, ArrowLeft, ArrowRight } from "lucide-react";
import {
  EVALUACION_FACTORES,
  TOTAL_EVALUACION_ITEMS,
  EvaluadorRol,
  EvaluacionFrecuencia,
  EvaluacionRecord,
  EvaluacionItemState,
  AdvisorChecklistRecord,
  EVALUACION_FRECUENCIAS_OPTIONS,
  TERRITORIOS_VENEZUELA,
  calculateEvaluationScores,
  getCumplimientoLevel,
  formatEvaluadorRol,
  formatFrecuencia,
} from "@/lib/evaluaciones-data";
import { EvaluacionDropdown } from "./evaluacion-dropdown";
import { useUser } from "@/components/providers/user-provider";
import { cn } from "@/lib/utils";

interface EvaluacionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (recordData: Partial<EvaluacionRecord>) => Promise<boolean>;
  initialData?: EvaluacionRecord | null;
  advisorsList: string[];
  saving?: boolean;
}

export function EvaluacionFormModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  advisorsList,
  saving = false,
}: EvaluacionFormModalProps) {
  const { user } = useUser();

  // General Form state - Advisor is SELECTABLE ONLY
  const [asesor, setAsesor] = useState("");
  const [frecuencia, setFrecuencia] = useState<EvaluacionFrecuencia>("Diaria");
  const [fecha, setFecha] = useState(() => new Date().toISOString().split("T")[0]);
  const [observacionesGenerales, setObservacionesGenerales] = useState("");

  const isEditingExisting = Boolean(initialData && initialData.id && initialData.id.trim() !== "");

  // Evaluator name and role automatically derived from current session user (or initialData if editing)
  const currentEvaluador = useMemo(() => {
    if (isEditingExisting && initialData?.evaluador?.trim()) {
      return initialData.evaluador.trim();
    }
    return user?.nombre?.trim() || user?.email || "Supervisor";
  }, [isEditingExisting, initialData?.evaluador, user?.nombre, user?.email]);

  const currentEvaluadorRol = useMemo<EvaluadorRol>(() => {
    if (isEditingExisting && initialData?.evaluadorRol) {
      return formatEvaluadorRol(initialData.evaluadorRol);
    }
    return formatEvaluadorRol(user?.rol);
  }, [isEditingExisting, initialData?.evaluadorRol, user?.rol]);

  // Geographic Territory state: Starts completely empty until selected
  const [estado, setEstado] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [parroquia, setParroquia] = useState("");
  const [sector, setSector] = useState("");

  // Items states map { [itemId]: { cumple: boolean; observacion?: string } }
  const [items, setItems] = useState<Record<string, EvaluacionItemState>>({});

  // Form validation error
  const [formError, setFormError] = useState<string | null>(null);

  // Active factor tab for easy navigation (step-by-step or all)
  const [activeFactorTab, setActiveFactorTab] = useState<string>("territorial");
  const formBodyRef = useRef<HTMLDivElement>(null);

  // Latest advisor daily checklist for cross-check
  const [latestAdvisorChecklist, setLatestAdvisorChecklist] = useState<AdvisorChecklistRecord | null>(null);

  useEffect(() => {
    if (!asesor) {
      setLatestAdvisorChecklist(null);
      return;
    }
    let active = true;
    fetch(`/api/advisor-checklists?asesor=${encodeURIComponent(asesor)}&latest=true`)
      .then((r) => r.json())
      .then((data) => {
        if (active && data.success && data.checklist) {
          setLatestAdvisorChecklist(data.checklist);
        } else if (active) {
          setLatestAdvisorChecklist(null);
        }
      })
      .catch(() => {
        if (active) setLatestAdvisorChecklist(null);
      });
    return () => {
      active = false;
    };
  }, [asesor]);

  // Geographic cascading options
  const estadoOptions = useMemo(() => {
    return TERRITORIOS_VENEZUELA.estados.map((e) => ({
      value: e.nombre,
      label: e.nombre,
    }));
  }, []);

  const currentEstadoObj = useMemo(() => {
    if (!estado) return null;
    return TERRITORIOS_VENEZUELA.estados.find((e) => e.nombre === estado) || null;
  }, [estado]);

  const municipioOptions = useMemo(() => {
    if (!currentEstadoObj) return [];
    return currentEstadoObj.municipios.map((m) => ({
      value: m.nombre,
      label: m.nombre,
    }));
  }, [currentEstadoObj]);

  const currentMunicipioObj = useMemo(() => {
    if (!currentEstadoObj || !municipio) return null;
    return currentEstadoObj.municipios.find((m) => m.nombre === municipio) || null;
  }, [currentEstadoObj, municipio]);

  const parroquiaOptions = useMemo(() => {
    if (!currentMunicipioObj) return [];
    return currentMunicipioObj.parroquias.map((p) => ({
      value: p.nombre,
      label: p.nombre,
    }));
  }, [currentMunicipioObj]);

  const currentParroquiaObj = useMemo(() => {
    if (!currentMunicipioObj || !parroquia) return null;
    return currentMunicipioObj.parroquias.find((p) => p.nombre === parroquia) || null;
  }, [currentMunicipioObj, parroquia]);

  // Predefined sectors for the selected parish only - strictly selectable
  const sectorDropdownOptions = useMemo(() => {
    if (!currentParroquiaObj) return [];
    return currentParroquiaObj.sectores.map((s) => ({
      value: s,
      label: s,
    }));
  }, [currentParroquiaObj]);

  // Handle cascading state changes
  const handleEstadoChange = (newEstado: string) => {
    setEstado(newEstado);
    setMunicipio("");
    setParroquia("");
    setSector("");
    setFormError(null);
  };

  const handleMunicipioChange = (newMunicipio: string) => {
    setMunicipio(newMunicipio);
    setParroquia("");
    setSector("");
    setFormError(null);
  };

  const handleParroquiaChange = (newParroquia: string) => {
    setParroquia(newParroquia);
    setSector("");
    setFormError(null);
  };

  // Load initial data if editing, or set initial active advisor
  useEffect(() => {
    const isEditingExisting = Boolean(initialData && initialData.id && initialData.id.trim() !== "");

    if (isEditingExisting && initialData) {
      setAsesor(initialData.asesor || "");
      setFrecuencia(formatFrecuencia(initialData.frecuencia));
      setFecha(initialData.fecha || new Date().toISOString().split("T")[0]);
      setObservacionesGenerales(initialData.observacionesGenerales || "");

      // Location fields
      setEstado(initialData.estado || "");
      setMunicipio(initialData.municipio || "");
      setParroquia(initialData.parroquia || "");
      setSector(initialData.sector || "");

      // Populate all 30 items from initialData with 1-5 scoring
      const populatedItems: Record<string, EvaluacionItemState> = {};
      EVALUACION_FACTORES.forEach((f) => {
        f.items.forEach((it) => {
          const raw = initialData.items?.[it.id];
          if (raw !== undefined) {
            let score = 5;
            if (typeof raw.puntuacion === "number" && !isNaN(raw.puntuacion)) {
              score = Math.max(1, Math.min(5, Math.round(raw.puntuacion)));
            } else if (raw.cumple !== undefined) {
              const isCumple = typeof raw.cumple === "boolean"
                ? raw.cumple
                : String(raw.cumple).toLowerCase() === "sí" ||
                  String(raw.cumple).toLowerCase() === "si" ||
                  String(raw.cumple).toLowerCase() === "true";
              score = isCumple ? 5 : 1;
            }
            populatedItems[it.id] = {
              puntuacion: score,
              cumple: score >= 3,
              observacion: raw.observacion || "",
            };
          } else {
            populatedItems[it.id] = { puntuacion: 5, cumple: true, observacion: "" };
          }
        });
      });
      setItems(populatedItems);
    } else {
      // Default blank form or new evaluation for specific advisor
      setAsesor(initialData?.asesor || "");
      setFrecuencia(formatFrecuencia(initialData?.frecuencia));
      setFecha(initialData?.fecha || new Date().toISOString().split("T")[0]);
      setObservacionesGenerales(initialData?.observacionesGenerales || "");

      // Default territory: empty
      setEstado(initialData?.estado || "");
      setMunicipio(initialData?.municipio || "");
      setParroquia(initialData?.parroquia || "");
      setSector(initialData?.sector || "");

      // Initialize all items with score 5 by default
      const defaultItems: Record<string, EvaluacionItemState> = {};
      EVALUACION_FACTORES.forEach((f) => {
        f.items.forEach((it) => {
          defaultItems[it.id] = { puntuacion: 5, cumple: true, observacion: "" };
        });
      });
      setItems(defaultItems);
    }
    setFormError(null);
  }, [initialData, advisorsList, isOpen]);

  // Live score calculation
  const scores = useMemo(() => calculateEvaluationScores(items), [items]);
  const level = useMemo(() => getCumplimientoLevel(scores.cumplimientoPct), [scores.cumplimientoPct]);

  if (!isOpen) return null;

  const handleItemScoreChange = (itemId: string, score: number) => {
    setItems((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || { observacion: "" }),
        puntuacion: score,
        cumple: score >= 3,
      },
    }));
  };

  const handleItemObservationChange = (itemId: string, obs: string) => {
    setItems((prev) => ({
      ...prev,
      [itemId]: {
        puntuacion: prev[itemId]?.puntuacion ?? 5,
        cumple: (prev[itemId]?.puntuacion ?? 5) >= 3,
        observacion: obs,
      },
    }));
  };

  const handleSetAllScores = (score: number) => {
    setItems((prev) => {
      const updated: Record<string, EvaluacionItemState> = {};
      EVALUACION_FACTORES.forEach((f) => {
        f.items.forEach((it) => {
          updated[it.id] = {
            puntuacion: score,
            cumple: score >= 3,
            observacion: prev[it.id]?.observacion || "",
          };
        });
      });
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!asesor.trim()) {
      setFormError("Por favor seleccione un asesor de ventas activo.");
      return;
    }
    if (!estado.trim()) {
      setFormError("Por favor seleccione el Estado.");
      return;
    }
    if (!municipio.trim()) {
      setFormError("Por favor seleccione el Municipio.");
      return;
    }
    if (!parroquia.trim()) {
      setFormError("Por favor seleccione la Parroquia.");
      return;
    }
    if (!sector.trim()) {
      setFormError("Por favor seleccione el Sector.");
      return;
    }
    setFormError(null);

    const payload: Partial<EvaluacionRecord> = {
      ...(initialData?.id ? { id: initialData.id } : {}),
      asesor: asesor.trim(),
      evaluador: currentEvaluador,
      evaluadorRol: currentEvaluadorRol,
      frecuencia,
      fecha,
      estado: estado.trim(),
      municipio: municipio.trim(),
      parroquia: parroquia.trim(),
      sector: sector.trim(),
      items,
      observacionesGenerales,
    };

    const ok = await onSave(payload);
    if (ok) {
      onClose();
    }
  };

  const advisorOptions = advisorsList.map((adv) => ({
    value: adv,
    label: adv,
  }));
  const currentFactorIdx = EVALUACION_FACTORES.findIndex((f) => f.id === activeFactorTab);
  const prevFactor = currentFactorIdx > 0 ? EVALUACION_FACTORES[currentFactorIdx - 1] : null;
  const nextFactor =
    currentFactorIdx >= 0 && currentFactorIdx < EVALUACION_FACTORES.length - 1
      ? EVALUACION_FACTORES[currentFactorIdx + 1]
      : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col sm:items-center sm:justify-center p-0 sm:p-4 md:p-6 bg-white sm:bg-neutral-900/40 sm:backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white w-full h-[100dvh] sm:h-auto sm:max-h-[92vh] sm:max-w-4xl sm:rounded-2xl sm:shadow-2xl sm:border sm:border-neutral-200/80 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-3 border-b border-neutral-100 flex items-center justify-between bg-white shrink-0 select-none">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900 font-sans tracking-tight">
              {initialData ? "Editar evaluación de asesor" : "Nueva evaluación de asesor"}
            </h2>
            <p className="text-[11px] text-neutral-400 font-mono mt-0.5">
              Power Link Corp, C.A. — Formato de supervisión y evaluación
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-900 transition-colors p-1.5 -mr-1.5 cursor-pointer"
            title="Cerrar ventana"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5 stroke-[1.5]" />
          </button>
        </div>

        {/* Modal Form wrapper */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0">
          {/* Scrollable Form Body */}
          <div ref={formBodyRef} className="flex-1 overflow-y-auto">
            {/* Section 1: General Info & Cascading Location (Ultra-compact 2x2 grid for mobile) */}
            <div className="px-4 sm:px-6 py-3.5 border-b border-neutral-100 bg-white space-y-3.5 shrink-0">
              {/* Advisor Row 1 */}
              <div className="min-w-0">
                <label className="block text-[10px] font-semibold text-neutral-500 font-sans tracking-tight mb-1">
                  Asesor de ventas activo
                </label>
                <div className="border-b border-neutral-200/80 focus-within:border-neutral-900 transition-colors pb-0.5">
                  <EvaluacionDropdown
                    value={asesor}
                    options={advisorOptions}
                    onChange={(val) => {
                      setAsesor(val);
                      setFormError(null);
                    }}
                    withSearch
                    placeholder="Seleccionar asesor de ventas..."
                    className="text-xs font-semibold text-neutral-900"
                  />
                </div>
              </div>

              {/* Evaluador & Frecuencia: 2 Columns on mobile */}
              <div className="grid grid-cols-2 gap-3 text-xs pt-0.5">
                {/* Evaluador */}
                <div className="min-w-0">
                  <label className="block text-[10px] text-neutral-400 font-mono mb-0.5">
                    Evaluador
                  </label>
                  <div className="py-1 border-b border-neutral-200/60 truncate">
                    <span className="font-semibold text-neutral-900 text-xs truncate block">
                      {currentEvaluador}
                    </span>
                    <span className="text-[10px] text-neutral-400 truncate block font-mono">
                      {currentEvaluadorRol}
                    </span>
                  </div>
                </div>

                {/* Frecuencia */}
                <div className="min-w-0">
                  <label className="block text-[10px] text-neutral-400 font-mono mb-0.5">
                    Frecuencia
                  </label>
                  <div className="border-b border-neutral-200/80 pb-0.5">
                    <EvaluacionDropdown
                      value={frecuencia}
                      options={EVALUACION_FRECUENCIAS_OPTIONS}
                      onChange={(val) => setFrecuencia(val)}
                      align="right"
                      className="text-xs font-semibold text-neutral-900"
                    />
                  </div>
                </div>
              </div>

              {/* Territory & Location: Compact 2x2 Grid (Takes 60% less vertical space!) */}
              <div className="pt-2 border-t border-neutral-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-neutral-700 font-sans">
                    Ubicación en campo
                  </span>
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-[10px] text-neutral-400 font-mono">Fecha:</span>
                    <input
                      type="date"
                      value={fecha}
                      onChange={(e) => setFecha(e.target.value)}
                      className="py-0.5 px-1 text-xs border-b border-neutral-200 focus:border-neutral-900 outline-none bg-transparent font-mono text-neutral-900 transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
                  {/* 1. Estado */}
                  <div className="min-w-0 border-b border-neutral-200/70 pb-0.5">
                    <label className="block text-[9px] text-neutral-400 font-mono">1. Estado</label>
                    <EvaluacionDropdown
                      value={estado}
                      options={estadoOptions}
                      onChange={handleEstadoChange}
                      placeholder="Estado..."
                      className="text-xs font-medium text-neutral-900"
                    />
                  </div>

                  {/* 2. Municipio */}
                  <div className="min-w-0 border-b border-neutral-200/70 pb-0.5">
                    <label className="block text-[9px] text-neutral-400 font-mono">2. Municipio</label>
                    <EvaluacionDropdown
                      value={municipio}
                      options={municipioOptions}
                      onChange={handleMunicipioChange}
                      disabled={!estado || municipioOptions.length === 0}
                      placeholder={estado ? "Municipio..." : "Elija estado"}
                      className="text-xs font-medium text-neutral-900"
                    />
                  </div>

                  {/* 3. Parroquia */}
                  <div className="min-w-0 border-b border-neutral-200/70 pb-0.5">
                    <label className="block text-[9px] text-neutral-400 font-mono">3. Parroquia</label>
                    <EvaluacionDropdown
                      value={parroquia}
                      options={parroquiaOptions}
                      onChange={handleParroquiaChange}
                      withSearch
                      disabled={!municipio || parroquiaOptions.length === 0}
                      placeholder={municipio ? "Parroquia..." : "Elija mun."}
                      className="text-xs font-medium text-neutral-900"
                    />
                  </div>

                  {/* 4. Sector */}
                  <div className="min-w-0 border-b border-neutral-200/70 pb-0.5">
                    <label className="block text-[9px] text-neutral-400 font-mono">4. Sector</label>
                    <EvaluacionDropdown
                      value={sector}
                      options={sectorDropdownOptions}
                      onChange={(val) => {
                        setSector(val);
                        setFormError(null);
                      }}
                      withSearch
                      align="right"
                      disabled={!parroquia || sectorDropdownOptions.length === 0}
                      placeholder={parroquia ? "Sector..." : "Elija par."}
                      className="text-xs font-semibold text-neutral-900"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Sticky Score & Filter Bar */}
            <div className="sticky top-0 z-20 px-3 sm:px-6 py-2 bg-white/95 backdrop-blur-md border-b border-neutral-100 flex items-center justify-between gap-2 text-xs select-none">
              {/* Live Scores */}
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono font-bold text-neutral-950 text-sm">
                  {scores.cumplimientoPct}%
                </span>
                <span className="text-[11px] font-mono text-neutral-400">
                  ({scores.promedio}/5)
                </span>
                <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full", level.colorClass, "bg-neutral-50")}>
                  {level.label}
                </span>
              </div>

              {/* Quick bulk actions */}
              <div className="flex items-center gap-3 text-xs shrink-0">
                <button
                  type="button"
                  onClick={() => handleSetAllScores(5)}
                  className="text-neutral-600 hover:text-neutral-950 transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-medium"
                  title="Asignar calificación 5 a todos los ítems"
                >
                  <CheckCheck className="w-3 h-3 text-emerald-600 stroke-[2]" />
                  <span>Todos en 5</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSetAllScores(1)}
                  className="text-neutral-400 hover:text-neutral-800 transition-colors cursor-pointer flex items-center gap-1 text-[11px]"
                  title="Reiniciar todos los ítems a 1"
                >
                  <RotateCcw className="w-3 h-3 stroke-[1.5]" />
                  <span className="hidden sm:inline">Reiniciar</span>
                </button>
              </div>
            </div>

            {/* Subtle live visual progress bar */}
            <div className="w-full h-[2px] bg-neutral-100 shrink-0">
              <div
                className={cn(
                  "h-full transition-all duration-300",
                  scores.cumplimientoPct >= 85
                    ? "bg-emerald-500"
                    : scores.cumplimientoPct >= 70
                    ? "bg-amber-500"
                    : "bg-neutral-800"
                )}
                style={{ width: `${scores.cumplimientoPct}%` }}
              />
            </div>

            {/* Factor Navigation Subtabs - Horizontally scrollable strip on mobile */}
            <div className="px-3 sm:px-6 pt-2 pb-1 border-b border-neutral-100 flex items-center gap-3 text-xs shrink-0 overflow-x-auto no-scrollbar whitespace-nowrap">
              {EVALUACION_FACTORES.map((f) => {
                const fScore = scores.factorScores[f.id];
                const isCurrent = activeFactorTab === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      setActiveFactorTab(f.id);
                      formBodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className={cn(
                      "pb-1.5 transition-colors cursor-pointer select-none flex items-center gap-1 shrink-0 text-xs",
                      isCurrent
                        ? "font-bold text-neutral-950 border-b-2 border-neutral-950"
                        : "text-neutral-400 hover:text-neutral-800"
                    )}
                  >
                    <span>{f.nombre}</span>
                    <span className="text-[10px] font-mono text-neutral-400">
                      {fScore?.promedio}/5
                    </span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  setActiveFactorTab("all");
                  formBodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className={cn(
                  "pb-1.5 transition-colors cursor-pointer select-none shrink-0 text-xs ml-auto",
                  activeFactorTab === "all"
                    ? "font-bold text-neutral-950 border-b-2 border-neutral-950"
                    : "text-neutral-400 hover:text-neutral-800"
                )}
              >
                Ver todos (30)
              </button>
            </div>

            {/* Section 3: The Factors & Items List */}
            <div className="px-4 sm:px-6 py-4 space-y-6">
              {latestAdvisorChecklist && (
                <div className="flex items-center justify-between py-2 border-b border-neutral-100 text-xs font-sans text-neutral-600">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-neutral-900">
                      Última guía declarada por el asesor ({latestAdvisorChecklist.fecha}):
                    </span>
                    <span>
                      {latestAdvisorChecklist.itemsCumplidos} de {latestAdvisorChecklist.itemsTotal} ítems ({latestAdvisorChecklist.cumplimientoPct}%)
                    </span>
                  </div>
                  <span className="text-[11px] text-neutral-400">
                    Comparación activa
                  </span>
                </div>
              )}

              {EVALUACION_FACTORES.filter(
                (f) => activeFactorTab === "all" || activeFactorTab === f.id
              ).map((factor) => {
                const factorScore = scores.factorScores[factor.id];
                return (
                  <div key={factor.id} className="space-y-3">
                    {/* Factor Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-neutral-100 pb-2 gap-1">
                      <div>
                        <h3 className="text-xs font-bold text-neutral-900 font-sans tracking-wide">
                          {factor.titulo}
                        </h3>
                        <p className="text-[11px] text-neutral-400 font-sans">
                          {factor.descripcion}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-mono">
                        <span className="text-neutral-400">
                          {factorScore?.puntos} de {factorScore?.puntosMax} pts
                        </span>
                        <span className="font-semibold text-neutral-950">
                          ({factorScore?.promedio}/5 · {factorScore?.pct}%)
                        </span>
                      </div>
                    </div>

                    {/* Factor Items Rows: Tactile score pills, zero clunky grey calculator boxes */}
                    <div className="divide-y divide-neutral-100 border-b border-neutral-100">
                      {factor.items.map((item) => {
                        const itemState = items[item.id] || { puntuacion: 5, observacion: "" };
                        const currentScore = itemState.puntuacion ?? (itemState.cumple ? 5 : 1);

                        return (
                          <div key={item.id} className="py-3.5 space-y-2.5">
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                              {/* Item description */}
                              <div className="flex-1 min-w-0 pr-2 space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-neutral-900 font-sans">
                                    {item.variable}
                                  </span>
                                  <span className="text-[11px] text-neutral-400 font-sans">
                                    · {item.descripcion}
                                  </span>
                                </div>
                                <p className="text-xs text-neutral-600 font-sans leading-relaxed">
                                  {item.preguntaEvaluador || item.pregunta}
                                </p>
                                {latestAdvisorChecklist?.items?.[item.id] !== undefined && (
                                  <div className="mt-1 flex items-center gap-1 text-[11px]">
                                    <span className="text-neutral-400">Declaró el asesor:</span>
                                    <span
                                      className={cn(
                                        "font-semibold",
                                        latestAdvisorChecklist.items[item.id]
                                          ? "text-emerald-700"
                                          : "text-amber-700"
                                      )}
                                    >
                                      {latestAdvisorChecklist.items[item.id] ? "Sí cumplió" : "No cumplió"}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* 1 to 5 Tactile Rating Selector */}
                              <div className="shrink-0 w-full sm:w-auto">
                                <div className="grid grid-cols-5 gap-1.5 select-none sm:w-[220px]">
                                  {[1, 2, 3, 4, 5].map((val) => {
                                    const isSelected = currentScore === val;
                                    return (
                                      <button
                                        key={val}
                                        type="button"
                                        onClick={() => handleItemScoreChange(item.id, val)}
                                        className={cn(
                                          "h-10 sm:h-8.5 rounded-lg flex flex-col items-center justify-center transition-all cursor-pointer select-none touch-manipulation",
                                          isSelected
                                            ? "bg-neutral-900 text-white font-bold shadow-xs ring-1 ring-neutral-900"
                                            : "border border-neutral-200/90 text-neutral-600 hover:border-neutral-400 hover:text-neutral-900 active:bg-neutral-50 bg-white"
                                        )}
                                        title={`Calificación: ${val} de 5`}
                                        aria-label={`Calificar ${val} de 5`}
                                      >
                                        <span className="font-mono text-sm sm:text-xs leading-none">{val}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>

                            {/* Observation inline field */}
                            <div className="w-full">
                              <input
                                type="text"
                                value={itemState.observacion || ""}
                                onChange={(e) =>
                                  handleItemObservationChange(item.id, e.target.value)
                                }
                                placeholder="Observación o nota opcional..."
                                className="w-full text-xs text-neutral-700 bg-transparent border-b border-neutral-200 focus:border-neutral-900 outline-none py-1.5 placeholder:text-neutral-400 font-sans transition-colors"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Step-by-Step Factor Navigation at the bottom of the questions */}
              {activeFactorTab !== "all" && (
                <div className="flex items-center justify-between pt-3 pb-2 border-t border-neutral-100 text-xs">
                  {prevFactor ? (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveFactorTab(prevFactor.id);
                        formBodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="text-neutral-500 hover:text-neutral-900 font-medium transition-colors cursor-pointer py-1.5 flex items-center gap-1 select-none"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>{prevFactor.nombre}</span>
                    </button>
                  ) : <div />}

                  {nextFactor ? (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveFactorTab(nextFactor.id);
                        formBodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="text-neutral-900 hover:text-neutral-600 font-semibold transition-colors cursor-pointer py-1.5 flex items-center gap-1 ml-auto select-none"
                    >
                      <span>Siguiente: {nextFactor.nombre}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <span className="text-[11px] text-neutral-400 ml-auto">
                      Todos los factores calificados
                    </span>
                  )}
                </div>
              )}

              {/* Section 4: General Observations & Action Plan (Always accessible) */}
              <div className="space-y-2 pt-2 border-t border-neutral-100">
                <label className="block text-xs font-bold text-neutral-900 font-sans">
                  Observaciones generales / Plan de acción
                </label>
                <p className="text-[11px] text-neutral-400 font-sans">
                  Compromisos acordados, fortalezas identificadas y acciones correctivas para el asesor
                </p>
                <textarea
                  rows={2}
                  value={observacionesGenerales}
                  onChange={(e) => setObservacionesGenerales(e.target.value)}
                  placeholder="Escriba el resumen de supervisión, acuerdos y plan de acompañamiento..."
                  className="w-full py-2 bg-transparent border-b border-neutral-200 focus:border-neutral-900 outline-none text-xs text-neutral-800 placeholder:text-neutral-400 resize-none transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Sticky Modal Footer (ALWAYS VISIBLE, never buried below 30 questions!) */}
          <div className="px-4 sm:px-6 py-3 border-t border-neutral-100 bg-white flex items-center justify-between shrink-0 select-none">
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer select-none"
            >
              Cancelar
            </button>

            <div className="flex items-center gap-3">
              {formError && (
                <span className="text-[11px] text-amber-700 font-sans">
                  {formError}
                </span>
              )}
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-900 hover:text-neutral-600 transition-colors cursor-pointer select-none py-1.5 px-2"
              >
                <Save className="w-3.5 h-3.5 stroke-[2]" />
                <span>{saving ? "Guardando..." : "Guardar evaluación"}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
