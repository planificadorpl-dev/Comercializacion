"use client";

import { useState, useEffect, useMemo, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  RotateCcw,
  CheckCheck,
  ArrowLeft,
  ArrowRight,
  Check,
} from "lucide-react";
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
import { EvaluacionDropdown } from "@/components/evaluaciones/evaluacion-dropdown";
import { useUser } from "@/components/providers/user-provider";
import { useAsesor } from "@/components/providers/asesor-provider";
import { getCaracasTodayIso } from "@/lib/caracas-time";
import { areSameAdvisorName } from "@/lib/normalization";
import { cn } from "@/lib/utils";

function NuevaEvaluacionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAdmin } = useUser();
  const { availableAsesores } = useAsesor();

  const editId = searchParams.get("id");
  const preselectedAsesor = searchParams.get("asesor") || "";
  const preselectedFecha = searchParams.get("fecha") || "";
  const preselectedEstado = searchParams.get("estado") || "";
  const preselectedMunicipio = searchParams.get("municipio") || "";
  const preselectedParroquia = searchParams.get("parroquia") || "";
  const preselectedSector = searchParams.get("sector") || "";
  const returnTo = searchParams.get("returnTo") || "";

  // Helper for administrator testing
  const handlePrefillTestData = () => {
    if (!asesor && advisorsList.length > 0) {
      setAsesor(advisorsList[0]);
    }
    setEstado("Carabobo");
    setMunicipio("Valencia");
    setParroquia("San José");
    setSector("El Viñedo");
    setFormError(null);
  };

  // Form State
  const [asesor, setAsesor] = useState(preselectedAsesor);
  const [frecuencia, setFrecuencia] = useState<EvaluacionFrecuencia>("Diaria");
  const [fecha, setFecha] = useState(() => preselectedFecha || getCaracasTodayIso());
  const [observacionesGenerales, setObservacionesGenerales] = useState("");

  // Evaluator from session
  const currentEvaluador = useMemo(() => {
    return user?.nombre?.trim() || user?.email || "Supervisor";
  }, [user?.nombre, user?.email]);

  const currentEvaluadorRol = useMemo<EvaluadorRol>(() => {
    return formatEvaluadorRol(user?.rol);
  }, [user?.rol]);

  // Geographic Territory
  const [estado, setEstado] = useState(preselectedEstado);
  const [municipio, setMunicipio] = useState(preselectedMunicipio);
  const [parroquia, setParroquia] = useState(preselectedParroquia);
  const [sector, setSector] = useState(preselectedSector);

  // Items State (default all items to 5: cumple = true)
  const [items, setItems] = useState<Record<string, EvaluacionItemState>>(() => {
    const defaultItems: Record<string, EvaluacionItemState> = {};
    EVALUACION_FACTORES.forEach((f) => {
      f.items.forEach((it) => {
        defaultItems[it.id] = { puntuacion: 5, cumple: true, observacion: "" };
      });
    });
    return defaultItems;
  });

  // Active factor: defaults to first factor "territorial"
  const [activeFactorTab, setActiveFactorTab] = useState<string>("territorial");
  const [advisorsList, setAdvisorsList] = useState<string[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(Boolean(editId));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Latest advisor checklist for cross-check
  const [latestAdvisorChecklist, setLatestAdvisorChecklist] = useState<AdvisorChecklistRecord | null>(null);

  const factorSectionRef = useRef<HTMLDivElement>(null);

  // Load advisors & optional editing record
  useEffect(() => {
    fetch(`/api/evaluaciones?t=${Date.now()}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          const fetchedAdvisors = Array.isArray(data.advisors) ? data.advisors : [];
          let combined = Array.from(new Set([...fetchedAdvisors, ...availableAsesores])).sort();
          if (preselectedAsesor) {
            const matched = combined.find((adv) => areSameAdvisorName(adv, preselectedAsesor));
            if (matched) {
              setAsesor(matched);
            } else {
              combined = Array.from(new Set([...combined, preselectedAsesor])).sort();
              setAsesor(preselectedAsesor);
            }
          }
          setAdvisorsList(combined);

          if (editId && Array.isArray(data.evaluaciones)) {
            const found = data.evaluaciones.find((e: EvaluacionRecord) => e.id === editId);
            if (found) {
              setAsesor(found.asesor || "");
              setFrecuencia(found.frecuencia || "Diaria");
              setFecha(found.fecha || getCaracasTodayIso());
              setEstado(found.estado || "");
              setMunicipio(found.municipio || "");
              setParroquia(found.parroquia || "");
              setSector(found.sector || "");
              setObservacionesGenerales(found.observacionesGenerales || "");
              if (found.items) {
                setItems(found.items);
              }
            }
          }
        }
      })
      .catch((err) => console.error("Error loading initial data:", err))
      .finally(() => setLoadingInitial(false));
  }, [editId, availableAsesores]);

  // Load advisor's self-reported checklist (prioritizing the selected date)
  useEffect(() => {
    if (!asesor) {
      setLatestAdvisorChecklist(null);
      return;
    }
    let active = true;
    const url = fecha
      ? `/api/advisor-checklists?asesor=${encodeURIComponent(asesor)}&fecha=${encodeURIComponent(fecha)}`
      : `/api/advisor-checklists?asesor=${encodeURIComponent(asesor)}&latest=true`;

    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (active && data.success && data.checklist) {
          setLatestAdvisorChecklist(data.checklist);
        } else if (active && data.success && Array.isArray(data.checklists) && data.checklists.length > 0) {
          setLatestAdvisorChecklist(data.checklists[0]);
        } else if (active) {
          // Fallback to latest
          fetch(`/api/advisor-checklists?asesor=${encodeURIComponent(asesor)}&latest=true`)
            .then((r) => r.json())
            .then((fallbackData) => {
              if (active && fallbackData.success && fallbackData.checklist) {
                setLatestAdvisorChecklist(fallbackData.checklist);
              } else if (active) {
                setLatestAdvisorChecklist(null);
              }
            });
        }
      })
      .catch(() => {
        if (active) setLatestAdvisorChecklist(null);
      });
    return () => {
      active = false;
    };
  }, [asesor, fecha]);

  // Geographic Cascading Options
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

  const sectorDropdownOptions = useMemo(() => {
    if (!currentParroquiaObj) return [];
    return currentParroquiaObj.sectores.map((s) => ({
      value: s,
      label: s,
    }));
  }, [currentParroquiaObj]);

  const handleEstadoChange = (newEstado: string) => {
    setEstado(newEstado);
    setMunicipio("");
    setParroquia("");
    setSector("");
  };

  const handleMunicipioChange = (newMunicipio: string) => {
    setMunicipio(newMunicipio);
    setParroquia("");
    setSector("");
  };

  const handleParroquiaChange = (newParroquia: string) => {
    setParroquia(newParroquia);
    setSector("");
  };

  // Scores
  const scores = useMemo(() => {
    return calculateEvaluationScores(items);
  }, [items]);

  const level = useMemo(() => {
    return getCumplimientoLevel(scores.cumplimientoPct);
  }, [scores.cumplimientoPct]);

  // Bulk score actions
  const handleSetAllScores = (val: number) => {
    const updated: Record<string, EvaluacionItemState> = {};
    EVALUACION_FACTORES.forEach((f) => {
      f.items.forEach((it) => {
        const cur = items[it.id] || { observacion: "" };
        updated[it.id] = {
          puntuacion: val,
          cumple: val >= 3,
          observacion: cur.observacion || "",
        };
      });
    });
    setItems(updated);
  };

  const handleItemScoreChange = (itemId: string, puntuacion: number) => {
    setItems((prev) => ({
      ...prev,
      [itemId]: {
        puntuacion,
        cumple: puntuacion >= 3,
        observacion: prev[itemId]?.observacion || "",
      },
    }));
  };

  const handleItemObservationChange = (itemId: string, observacion: string) => {
    setItems((prev) => ({
      ...prev,
      [itemId]: {
        puntuacion: prev[itemId]?.puntuacion ?? 5,
        cumple: prev[itemId]?.cumple ?? true,
        observacion,
      },
    }));
  };

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!asesor || asesor.trim() === "") {
      setFormError("Por favor seleccione el asesor de ventas a evaluar.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (!sector || sector.trim() === "") {
      setFormError("Por favor complete la ubicación evaluada (Estado, Municipio, Parroquia y Sector).");
      window.scrollTo({ top: 150, behavior: "smooth" });
      return;
    }

    setSaving(true);
    try {
      const payload: Partial<EvaluacionRecord> = {
        ...(editId ? { id: editId } : {}),
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

      const res = await fetch("/api/evaluaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then((r) => r.json());

      if (res.success) {
        setSaveSuccess(true);
        setTimeout(() => {
          router.push(returnTo || "/evaluaciones");
        }, 600);
      } else {
        setFormError(res.error || "Ocurrió un error al guardar la evaluación");
      }
    } catch (err: any) {
      setFormError(err.message || "Error de conexión con el servidor");
    } finally {
      setSaving(false);
    }
  };

  const advisorOptions = useMemo(() => {
    return advisorsList.map((adv) => ({
      value: adv,
      label: adv,
    }));
  }, [advisorsList]);

  // Factor Stepper index
  const currentFactorIdx = EVALUACION_FACTORES.findIndex((f) => f.id === activeFactorTab);
  const prevFactor = currentFactorIdx > 0 ? EVALUACION_FACTORES[currentFactorIdx - 1] : null;
  const nextFactor =
    currentFactorIdx >= 0 && currentFactorIdx < EVALUACION_FACTORES.length - 1
      ? EVALUACION_FACTORES[currentFactorIdx + 1]
      : null;

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-neutral-900 font-sans antialiased selection:bg-neutral-900 selection:text-white">
      {/* Top Sticky Header */}
      <header className="sticky top-0 z-20 h-14 bg-white/95 backdrop-blur-md border-b border-neutral-200/80 px-4 sm:px-6 flex items-center justify-between select-none">
        <div className="flex items-center gap-3">
          <Link
            href={returnTo || "/evaluaciones"}
            className="min-w-[40px] min-h-[40px] -ml-2 p-2 text-neutral-500 hover:text-neutral-900 transition-colors flex items-center justify-center cursor-pointer"
            title={returnTo ? "Volver" : "Volver a Registro de Evaluaciones"}
          >
            <ChevronLeft className="w-5 h-5 stroke-[2]" />
          </Link>
          <div>
            <h1 className="text-sm font-bold text-neutral-950 font-sans leading-tight">
              {editId ? "Editar evaluación" : "Nueva evaluación"}
            </h1>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="text-xs font-semibold text-neutral-900 hover:text-neutral-500 transition-colors cursor-pointer select-none py-1 px-1"
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </header>

      {/* Main Page Container */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-5 pb-32 space-y-6">
        {/* Subheader when responding directly to an activity report */}
        {returnTo && (
          <div className="flex items-center justify-between text-xs text-neutral-500 border-b border-neutral-100 pb-2">
            <span>
              Respondiendo al reporte de <strong className="text-neutral-900 font-medium">{asesor || preselectedAsesor}</strong> ({fecha})
            </span>
            <Link
              href={returnTo}
              className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer select-none"
            >
              Cancelar
            </Link>
          </div>
        )}

        {formError && (
          <div className="py-2 flex items-center gap-2 text-xs text-neutral-900 border-b border-neutral-100 animate-in fade-in">
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-900 shrink-0" />
            <span className="leading-relaxed">{formError}</span>
          </div>
        )}

        {/* ─── SECCIÓN 1: ASESOR EVALUADO (AMPLIO Y DESTACADO) ─── */}
        <section className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs sm:text-sm font-semibold text-neutral-900 font-sans">
              Asesor de ventas evaluado *
            </label>
            <p className="text-[11px] text-neutral-400">
              Seleccione el colaborador al que se le realiza la supervisión en campo
            </p>

            {/* Selector de Asesor Amplio y Cómodo */}
            <div className="pt-1 border-b-2 border-neutral-300 focus-within:border-neutral-950 transition-colors pb-1">
              <EvaluacionDropdown
                value={asesor}
                options={advisorOptions}
                onChange={(val) => {
                  setAsesor(val);
                  setFormError(null);
                }}
                withSearch
                placeholder="Seleccionar asesor de ventas..."
                className="text-base sm:text-lg font-bold text-neutral-950 py-1"
              />
            </div>
          </div>

          {/* Evaluador & Frecuencia: 2 columnas bien distribuidas */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            {/* Evaluador */}
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-neutral-500 font-sans">
                Evaluador
              </label>
              <div className="py-1.5 border-b border-neutral-200/80 truncate">
                <span className="font-semibold text-neutral-900 text-xs sm:text-sm truncate block">
                  {currentEvaluador}
                </span>
                <span className="text-[10px] text-neutral-400 font-mono truncate block mt-0.5">
                  · {currentEvaluadorRol}
                </span>
              </div>
            </div>

            {/* Frecuencia de Evaluación */}
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-neutral-500 font-sans">
                Frecuencia
              </label>
              <div className="border-b border-neutral-200/80 pb-0.5">
                <EvaluacionDropdown
                  value={frecuencia}
                  options={EVALUACION_FRECUENCIAS_OPTIONS}
                  onChange={(val) => setFrecuencia(val)}
                  align="right"
                  className="text-xs sm:text-sm font-semibold text-neutral-900 py-1.5"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Separador sutil */}
        <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-neutral-200 to-transparent" />

        {/* ─── SECCIÓN 2: FECHA Y UBICACIÓN EN CAMPO (DISTRIBUCIÓN 2X2) ─── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <h2 className="text-xs sm:text-sm font-semibold text-neutral-900 font-sans">
                Ubicación en campo *
              </h2>
              {isAdmin && (
                <button
                  type="button"
                  onClick={handlePrefillTestData}
                  className="text-[10px] text-neutral-400 hover:text-neutral-900 transition-colors font-mono cursor-pointer select-none"
                  title="Autocompletar datos de prueba para agilizar la prueba de evaluación"
                >
                  [Autocompletar prueba]
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-neutral-400 font-mono">Fecha:</span>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="py-1 px-1.5 text-xs border-b border-neutral-200 focus:border-neutral-900 outline-none bg-transparent font-mono text-neutral-900 transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            {/* 1. Estado */}
            <div className="space-y-1 border-b border-neutral-200/80 pb-1">
              <label className="block text-[10px] text-neutral-400 font-mono">1. Estado</label>
              <EvaluacionDropdown
                value={estado}
                options={estadoOptions}
                onChange={handleEstadoChange}
                placeholder="Seleccionar..."
                className="text-xs sm:text-sm font-medium text-neutral-900"
              />
            </div>

            {/* 2. Municipio */}
            <div className="space-y-1 border-b border-neutral-200/80 pb-1">
              <label className="block text-[10px] text-neutral-400 font-mono">2. Municipio</label>
              <EvaluacionDropdown
                value={municipio}
                options={municipioOptions}
                onChange={handleMunicipioChange}
                disabled={!estado || municipioOptions.length === 0}
                placeholder={estado ? "Seleccionar..." : "Elija estado"}
                className="text-xs sm:text-sm font-medium text-neutral-900"
              />
            </div>

            {/* 3. Parroquia */}
            <div className="space-y-1 border-b border-neutral-200/80 pb-1">
              <label className="block text-[10px] text-neutral-400 font-mono">3. Parroquia</label>
              <EvaluacionDropdown
                value={parroquia}
                options={parroquiaOptions}
                onChange={handleParroquiaChange}
                withSearch
                disabled={!municipio || parroquiaOptions.length === 0}
                placeholder={municipio ? "Seleccionar..." : "Elija municipio"}
                className="text-xs sm:text-sm font-medium text-neutral-900"
              />
            </div>

            {/* 4. Sector */}
            <div className="space-y-1 border-b border-neutral-200/80 pb-1">
              <label className="block text-[10px] text-neutral-400 font-mono">4. Sector</label>
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
                placeholder={parroquia ? "Seleccionar..." : "Elija parroquia"}
                className="text-xs sm:text-sm font-semibold text-neutral-900"
              />
            </div>
          </div>
        </section>

        {/* Separador sutil */}
        <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-neutral-200 to-transparent" />

        {/* ─── SECCIÓN 3: FACTORES Y CALIFICACIÓN ─── */}
        <section ref={factorSectionRef} className="space-y-4">
          {/* Métricas de cumplimiento en vivo y acciones rápidas */}
          <div className="space-y-3 py-3 border-b border-neutral-100">
            {/* Cumplimiento general */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-neutral-500 font-sans block">
                  Cumplimiento en vivo
                </span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-2xl sm:text-3xl font-extrabold font-mono text-neutral-950">
                    {scores.cumplimientoPct}%
                  </span>
                  <span className="text-xs font-mono text-neutral-400">
                    ({scores.puntuacionTotal} / {scores.puntuacionMaxima} pts · Promedio: {scores.promedio}/5)
                  </span>
                </div>
              </div>
              <span className={cn("text-xs font-medium px-2 py-0.5", level.colorClass)}>
                {level.label}
              </span>
            </div>

            {/* Barra de progreso sutil */}
            <div className="w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-300 rounded-full",
                  scores.cumplimientoPct >= 85
                    ? "bg-neutral-900"
                    : scores.cumplimientoPct >= 70
                    ? "bg-neutral-600"
                    : "bg-neutral-400"
                )}
                style={{ width: `${scores.cumplimientoPct}%` }}
              />
            </div>

            {/* BOTONES DE ACCIÓN AMPLIOS (Fin al botón minúsculo) */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => handleSetAllScores(5)}
                className="min-h-[46px] py-2.5 px-3 rounded-lg bg-neutral-100/70 hover:bg-neutral-200/70 transition-colors flex items-center justify-center gap-2 cursor-pointer select-none text-xs font-semibold text-neutral-900"
                title="Asignar calificación 5 a todos los ítems de la evaluación"
              >
                <CheckCheck className="w-4 h-4 text-emerald-600 stroke-[2]" />
                <span>Todos en 5</span>
              </button>

              <button
                type="button"
                onClick={() => handleSetAllScores(1)}
                className="min-h-[46px] py-2.5 px-3 rounded-lg bg-neutral-100/70 hover:bg-neutral-200/70 transition-colors flex items-center justify-center gap-2 cursor-pointer select-none text-xs font-semibold text-neutral-700"
                title="Reiniciar todos los ítems a 1"
              >
                <RotateCcw className="w-4 h-4 stroke-[1.75] text-neutral-500" />
                <span>Reiniciar a 1</span>
              </button>
            </div>
          </div>

          {/* ─── SELECTOR DE FACTORES EN CUADRÍCULA (CERO ARRASTRES DE LADO A LADO) ─── */}
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-neutral-500 font-sans block">
              Seleccionar factor a evaluar (visibles sin arrastrar)
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 select-none">
              {EVALUACION_FACTORES.map((f, idx) => {
                const fScore = scores.factorScores[f.id];
                const isCurrent = activeFactorTab === f.id;

                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      setActiveFactorTab(f.id);
                    }}
                    className={cn(
                      "py-2 px-1.5 rounded-lg text-center flex flex-col items-center justify-center transition-all cursor-pointer min-h-[50px]",
                      isCurrent
                        ? "bg-neutral-900 text-white font-bold shadow-xs ring-1 ring-neutral-900"
                        : "bg-neutral-100/60 text-neutral-700 hover:bg-neutral-200/60 hover:text-neutral-950"
                    )}
                  >
                    <span className="text-[11px] font-semibold leading-tight truncate w-full">
                      {idx + 1}. {f.nombre}
                    </span>
                    <span className={cn("text-[10px] font-mono mt-0.5", isCurrent ? "text-neutral-300" : "text-neutral-400")}>
                      {fScore?.promedio}/5
                    </span>
                  </button>
                );
              })}

              {/* Botón Ver todos */}
              <button
                type="button"
                onClick={() => setActiveFactorTab("all")}
                className={cn(
                  "py-2 px-1.5 rounded-lg text-center flex flex-col items-center justify-center transition-all cursor-pointer min-h-[50px]",
                  activeFactorTab === "all"
                    ? "bg-neutral-900 text-white font-bold shadow-xs ring-1 ring-neutral-900"
                    : "bg-neutral-100/60 text-neutral-600 hover:bg-neutral-200/60 hover:text-neutral-950"
                )}
              >
                <span className="text-[11px] font-semibold leading-tight">
                  Ver todos
                </span>
                <span className={cn("text-[10px] font-mono mt-0.5", activeFactorTab === "all" ? "text-neutral-300" : "text-neutral-400")}>
                  (30)
                </span>
              </button>
            </div>
          </div>

          {/* Preguntas del Factor Activo */}
          <div className="space-y-6 pt-2">
            {latestAdvisorChecklist && (
              <div className="py-2.5 px-3 bg-neutral-50 rounded-lg border border-neutral-200/60 text-xs text-neutral-600 flex items-center justify-between">
                <span>
                  Declarado por el asesor ({latestAdvisorChecklist.fecha}):{" "}
                  <strong>{latestAdvisorChecklist.itemsCumplidos} de {latestAdvisorChecklist.itemsTotal} ítems</strong> ({latestAdvisorChecklist.cumplimientoPct}%)
                </span>
                <span className="text-[10px] text-neutral-400 font-mono">Comparativa</span>
              </div>
            )}

            {EVALUACION_FACTORES.filter(
              (f) => activeFactorTab === "all" || activeFactorTab === f.id
            ).map((factor) => {
              const factorScore = scores.factorScores[factor.id];
              return (
                <div key={factor.id} className="space-y-3">
                  {/* Encabezado del Factor */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-neutral-200 pb-2 gap-1">
                    <div>
                      <h3 className="text-sm font-bold text-neutral-950 font-sans">
                        {factor.titulo}
                      </h3>
                      <p className="text-xs text-neutral-500 font-sans mt-0.5">
                        {factor.descripcion}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-mono shrink-0">
                      <span className="text-neutral-400">
                        {factorScore?.puntos} de {factorScore?.puntosMax} pts
                      </span>
                      <span className="font-bold text-neutral-950">
                        ({factorScore?.promedio}/5 · {factorScore?.pct}%)
                      </span>
                    </div>
                  </div>

                  {/* Lista de preguntas */}
                  <div className="divide-y divide-neutral-100">
                    {factor.items.map((item) => {
                      const itemState = items[item.id] || { puntuacion: 5, observacion: "" };
                      const currentScore = itemState.puntuacion ?? (itemState.cumple ? 5 : 1);

                      return (
                        <div key={item.id} className="py-4 space-y-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs sm:text-sm font-bold text-neutral-950 font-sans">
                                {item.variable}
                              </span>
                              <span className="text-[11px] text-neutral-400 font-sans">
                                · {item.descripcion}
                              </span>
                            </div>
                            <p className="text-xs sm:text-sm text-neutral-600 font-sans leading-relaxed">
                              {item.preguntaEvaluador || item.pregunta}
                            </p>
                          </div>

                          {/* Botones de Calificación 1 al 5 táctiles y amplios */}
                          <div className="space-y-1">
                            <div className="grid grid-cols-5 gap-2 select-none max-w-sm">
                              {[1, 2, 3, 4, 5].map((val) => {
                                const isSelected = currentScore === val;
                                return (
                                  <button
                                    key={val}
                                    type="button"
                                    onClick={() => handleItemScoreChange(item.id, val)}
                                    className={cn(
                                      "h-12 sm:h-10 rounded-lg flex flex-col items-center justify-center transition-all cursor-pointer select-none touch-manipulation",
                                      isSelected
                                        ? "bg-neutral-950 text-white font-bold shadow-xs scale-102"
                                        : "bg-neutral-100/70 hover:bg-neutral-200/70 text-neutral-800 active:bg-neutral-200"
                                    )}
                                    title={`Calificación: ${val} de 5`}
                                  >
                                    <span className="font-mono text-base sm:text-sm leading-none">{val}</span>
                                  </button>
                                );
                              })}
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-neutral-400 max-w-sm px-1 font-sans">
                              <span>1: Deficiente</span>
                              <span>3: Regular</span>
                              <span>5: Excelente</span>
                            </div>
                          </div>

                          {/* Campo de observación */}
                          <div>
                            <input
                              type="text"
                              value={itemState.observacion || ""}
                              onChange={(e) =>
                                handleItemObservationChange(item.id, e.target.value)
                              }
                              placeholder="Observación o nota opcional para este ítem..."
                              className="w-full text-xs text-neutral-800 bg-transparent border-b border-neutral-200 focus:border-neutral-900 outline-none py-1.5 placeholder:text-neutral-400 font-sans transition-colors"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Navegación al final del factor */}
            {activeFactorTab !== "all" && (
              <div className="flex items-center justify-between pt-4 border-t border-neutral-200 text-xs">
                {prevFactor ? (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFactorTab(prevFactor.id);
                      factorSectionRef.current?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="min-h-[44px] py-2 px-3 text-neutral-600 hover:text-neutral-950 font-medium transition-colors cursor-pointer flex items-center gap-1.5 select-none"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>{prevFactor.nombre}</span>
                  </button>
                ) : <div />}

                {nextFactor ? (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFactorTab(nextFactor.id);
                      factorSectionRef.current?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="min-h-[44px] py-2 px-3 text-neutral-950 hover:text-neutral-600 font-bold transition-colors cursor-pointer flex items-center gap-1.5 ml-auto select-none"
                  >
                    <span>Siguiente: {nextFactor.nombre}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <span className="text-[11px] text-neutral-400 font-medium ml-auto">
                    Último factor calificado
                  </span>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Separador sutil */}
        <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-neutral-200 to-transparent" />

        {/* ─── SECCIÓN 4: OBSERVACIONES GENERALES Y PLAN DE ACCIÓN ─── */}
        <section className="space-y-2">
          <label className="block text-xs sm:text-sm font-semibold text-neutral-950 font-sans">
            Observaciones generales y plan de acción
          </label>
          <p className="text-[11px] text-neutral-400 font-sans">
            Compromisos acordados, fortalezas identificadas y acciones correctivas para el asesor
          </p>
          <textarea
            rows={3}
            value={observacionesGenerales}
            onChange={(e) => setObservacionesGenerales(e.target.value)}
            placeholder="Escriba el resumen de supervisión, acuerdos y compromisos acordados..."
            className="w-full py-2 bg-transparent border-b border-neutral-200 focus:border-neutral-900 outline-none text-xs text-neutral-800 placeholder:text-neutral-400 resize-none transition-colors"
          />
        </section>
      </main>

      {/* ─── BARRA INFERIOR FIJA: ACCIÓN DE GUARDAR SIEMPRE VISIBLE ─── */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-neutral-100 px-4 sm:px-6 py-3 select-none">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <Link
            href="/evaluaciones"
            className="text-xs text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer py-1"
          >
            Cancelar
          </Link>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-semibold font-mono text-neutral-900">
                {scores.cumplimientoPct}% ({scores.promedio}/5)
              </span>
              <span className="text-[10px] text-neutral-400">{level.label}</span>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className={cn(
                "text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 py-1 px-1",
                saveSuccess
                  ? "text-neutral-900"
                  : "text-neutral-900 hover:text-neutral-500 disabled:text-neutral-300 disabled:cursor-not-allowed"
              )}
            >
              {saveSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[1.5]" />
                  <span>Evaluación guardada</span>
                </>
              ) : (
                <span>{saving ? "Guardando..." : "Guardar evaluación"}</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NuevaEvaluacionPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#FDFDFD] text-xs font-mono text-neutral-400">
          Cargando formulario de evaluación...
        </div>
      }
    >
      <NuevaEvaluacionContent />
    </Suspense>
  );
}
