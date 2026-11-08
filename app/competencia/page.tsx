"use client";

import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import {
  Menu,
  Plus,
  X,
} from "lucide-react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { SidebarOpenButton } from "@/components/providers/sidebar-provider";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { ToastPill } from "@/components/ui/toast-pill";
import { geoHierarchy } from "@/lib/geo_hierarchy";
import {
  getOperadores,
  getOfertasRecientes,
  saveOferta,
  deleteOferta,
  saveOperador,
} from "@/app/actions/competencia";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useUser } from "@/components/providers/user-provider";
import { useModules } from "@/components/providers/modules-provider";

// Client module-level cache for instantaneous panel transitions
let cachedOperadores: any[] = [];
let cachedOfertas: any[] = [];
let hasInitialLoadedOfertas = false;

function CompetenciaContent() {
  const { user, isAdmin } = useUser();
  const { isModuleEnabledForUser } = useModules();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Operadores & Ofertas
  const [operadores, setOperadores] = useState<any[]>(() => cachedOperadores);
  const [ofertas, setOfertas] = useState<any[]>(() => cachedOfertas);
  const [loadingOfertas, setLoadingOfertas] = useState(!hasInitialLoadedOfertas);

  // Filters
  const [filterEstado, setFilterEstado] = useState("");
  const [filterMunicipio, setFilterMunicipio] = useState("");
  const [filterParroquia, setFilterParroquia] = useState("");
  const [searchOperator, setSearchOperator] = useState("");

  // Modals
  const [isNewOfferOpen, setIsNewOfferOpen] = useState(false);
  const [isNewOpOpen, setIsNewOpOpen] = useState(false);
  const [ofertaToDelete, setOfertaToDelete] = useState<number | null>(null);

  // New Offer Form State (strings for effortless numeric typing and instant 1-tap presets)
  const [opId, setOpId] = useState<string>(() => (cachedOperadores.length > 0 ? String(cachedOperadores[0].id) : ""));
  const [nombrePlan, setNombrePlan] = useState("");
  const [tecnologia, setTecnologia] = useState("Fibra Óptica");
  const [velocidadMb, setVelocidadMb] = useState<string>("400");
  const [precioMensual, setPrecioMensual] = useState<string>("25");
  const [costoInstalacion, setCostoInstalacion] = useState<string>("0");
  const [incluyeTv, setIncluyeTv] = useState(false);
  const [esSimetrico, setEsSimetrico] = useState(true);
  const [formEstado, setFormEstado] = useState("Miranda");
  const [formMunicipio, setFormMunicipio] = useState("");
  const [formParroquia, setFormParroquia] = useState("");
  const [notas, setNotas] = useState("");
  const [savingOffer, setSavingOffer] = useState(false);

  // New Operator Form State (admin only, color indicator eliminated)
  const [newOpNombre, setNewOpNombre] = useState("");
  const [savingOp, setSavingOp] = useState(false);

  const [toastMsg, setToastMsg] = useState<{ text: string; type?: "success" | "error" } | null>(null);

  // Geographic calculations for filters
  const estadosList = useMemo(() => Object.keys(geoHierarchy).sort(), []);
  const municipiosList = useMemo(() => {
    if (!filterEstado || !geoHierarchy[filterEstado]) return [];
    return Object.keys(geoHierarchy[filterEstado]).sort();
  }, [filterEstado]);
  const parroquiasList = useMemo(() => {
    if (!filterEstado || !filterMunicipio || !geoHierarchy[filterEstado]?.[filterMunicipio]) return [];
    return Object.keys(geoHierarchy[filterEstado][filterMunicipio]).sort();
  }, [filterEstado, filterMunicipio]);

  // Form geography
  const formMunicipiosList = useMemo(() => {
    if (!formEstado || !geoHierarchy[formEstado]) return [];
    return Object.keys(geoHierarchy[formEstado]).sort();
  }, [formEstado]);
  const formParroquiasList = useMemo(() => {
    if (!formEstado || !formMunicipio || !geoHierarchy[formEstado]?.[formMunicipio]) return [];
    return Object.keys(geoHierarchy[formEstado][formMunicipio]).sort();
  }, [formEstado, formMunicipio]);

  // Load initial data
  useEffect(() => {
    getOperadores().then((ops) => {
      cachedOperadores = ops;
      setOperadores(ops);
      if (ops.length > 0) setOpId((prev) => prev || String(ops[0].id));
    });
  }, []);

  const loadOfertas = useCallback(async (silent = hasInitialLoadedOfertas) => {
    if (!silent) setLoadingOfertas(true);
    try {
      const data = await getOfertasRecientes(
        filterEstado || undefined,
        filterMunicipio || undefined,
        filterParroquia || undefined
      );
      cachedOfertas = data;
      hasInitialLoadedOfertas = true;
      setOfertas(data);
    } catch {
      setToastMsg({ text: "Error al cargar ofertas de la competencia", type: "error" });
    } finally {
      setLoadingOfertas(false);
    }
  }, [filterEstado, filterMunicipio, filterParroquia]);

  useEffect(() => {
    loadOfertas();
  }, [loadOfertas]);

  const handleSaveOperador = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setToastMsg({ text: "Solo administradores pueden crear operadores", type: "error" });
      return;
    }
    if (!newOpNombre.trim()) return;
    setSavingOp(true);
    try {
      // Color indicator eliminated: default neutral slate hex used for DB consistency
      const op = await saveOperador(newOpNombre.trim(), "#64748b");
      setOperadores([...operadores, op]);
      setOpId(String(op.id));
      setNewOpNombre("");
      setIsNewOpOpen(false);
      setToastMsg({ text: "Operador registrado", type: "success" });
    } catch (err: any) {
      setToastMsg({ text: err.message || "Error al crear operador", type: "error" });
    } finally {
      setSavingOp(false);
    }
  };

  const handleSaveOferta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!opId || !nombrePlan.trim()) {
      setToastMsg({ text: "Completa los campos obligatorios", type: "error" });
      return;
    }
    setSavingOffer(true);
    try {
      const payload = {
        operador_id: parseInt(opId, 10),
        nombre_plan: nombrePlan.trim(),
        plan_nombre: nombrePlan.trim(),
        tecnologia: tecnologia.trim() || "Fibra Óptica",
        velocidad_mb: Number(velocidadMb) || 0,
        velocidad_mbps: Number(velocidadMb) || 0,
        precio_mensual: Number(precioMensual) || 0,
        tarifa_usd: Number(precioMensual) || 0,
        costo_instalacion: Number(costoInstalacion) || 0,
        costo_instalacion_usd: Number(costoInstalacion) || 0,
        incluye_tv: incluyeTv,
        es_simetrico: esSimetrico,
        estado: formEstado || null,
        municipio: formMunicipio || null,
        parroquia: formParroquia || null,
        notas: notas.trim() || null,
        promocion: notas.trim() || null,
        tipo_novedad: "nueva_oferta",
        asesor_nombre: user?.nombre || "Sistema",
        fuente: "panel",
      };

      await saveOferta(payload);
      setNombrePlan("");
      setNotas("");
      setIsNewOfferOpen(false);
      setToastMsg({ text: "Oferta registrada exitosamente", type: "success" });
      loadOfertas(false);
    } catch (err: any) {
      setToastMsg({ text: err.message || "Error al registrar oferta", type: "error" });
    } finally {
      setSavingOffer(false);
    }
  };

  const executeDeleteOferta = async () => {
    if (!ofertaToDelete) return;
    try {
      await deleteOferta(ofertaToDelete);
      setOfertas(ofertas.filter((o) => o.id !== ofertaToDelete));
      setOfertaToDelete(null);
      setToastMsg({ text: "Oferta eliminada", type: "success" });
    } catch (err: any) {
      setToastMsg({ text: err.message || "Error al eliminar oferta", type: "error" });
    }
  };

  const filteredOfertas = useMemo(() => {
    let result = ofertas;
    if (searchOperator.trim()) {
      const q = searchOperator.toLowerCase();
      result = result.filter((o) => {
        const opName = (o.operador?.nombre || "").toLowerCase();
        const planName = (o.nombre_plan || o.plan_nombre || "").toLowerCase();
        const promo = (o.notas || o.promocion || "").toLowerCase();
        return opName.includes(q) || planName.includes(q) || promo.includes(q);
      });
    }
    return result;
  }, [ofertas, searchOperator]);

  // Market intelligence metrics (pure typography, strictly adhering to AGENTS.md)
  const marketMetrics = useMemo(() => {
    const total = filteredOfertas.length;
    if (total === 0) {
      return {
        total: 0,
        avgPrice: "0.00",
        avgSpeed: 0,
        avgPricePerMb: "0.00",
        topOperator: "Sin datos",
      };
    }

    let sumPrice = 0;
    let sumSpeed = 0;
    let sumPricePerMb = 0;
    let validSpeedCount = 0;
    const operatorCounts: Record<string, number> = {};

    filteredOfertas.forEach((of) => {
      const price = Number(of.precio_mensual ?? of.tarifa_usd ?? 0);
      const speed = Number(of.velocidad_mb ?? of.velocidad_mbps ?? 0);
      sumPrice += price;

      if (speed > 0) {
        sumSpeed += speed;
        sumPricePerMb += price / speed;
        validSpeedCount++;
      }

      const opName = of.operador?.nombre || "Otro";
      operatorCounts[opName] = (operatorCounts[opName] || 0) + 1;
    });

    let topOp = "Sin datos";
    let maxCount = 0;
    Object.entries(operatorCounts).forEach(([name, count]) => {
      if (count > maxCount) {
        maxCount = count;
        topOp = name;
      }
    });

    return {
      total,
      avgPrice: (sumPrice / total).toFixed(2),
      avgSpeed: validSpeedCount > 0 ? Math.round(sumSpeed / validSpeedCount) : 0,
      avgPricePerMb: validSpeedCount > 0 ? (sumPricePerMb / validSpeedCount).toFixed(2) : "0.00",
      topOperator: topOp,
    };
  }, [filteredOfertas]);

  if (user && !isAdmin && !isModuleEnabledForUser("competencia", false)) {
    return (
      <div className="flex min-h-screen bg-[#FDFDFD] text-[#09090B]">
        <Sidebar activeSection="competencia" />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="max-w-md space-y-3">
            <h1 className="text-lg font-bold text-neutral-900 font-sans">
              Panel en preparación
            </h1>
            <p className="text-xs text-neutral-500 font-sans leading-relaxed">
              El panel de Estudio de Mercado no está disponible actualmente para usuarios generales.
            </p>
            <div className="pt-2">
              <Link
                href="/actividades"
                className="text-xs font-medium text-neutral-900 hover:text-neutral-600 transition-colors cursor-pointer"
              >
                Ir a Registro de Actividades
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#FDFDFD] text-neutral-900 font-sans antialiased selection:bg-neutral-900 selection:text-white">
      <Sidebar
        activeSection="competencia"
        isMobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-20 h-12 bg-white border-b border-neutral-200/80 px-3 sm:px-6 flex items-center justify-between select-none">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="xl:hidden -ml-2 min-w-[44px] min-h-[44px] p-2.5 text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer flex items-center justify-center"
              title="Abrir menú"
              aria-label="Abrir menú"
            >
              <Menu className="w-4 h-4 stroke-[1.75]" />
            </button>
            <SidebarOpenButton />
          </div>

          <div className="flex items-center">
            <span className="text-xs sm:text-sm font-normal text-neutral-700 tracking-tight font-sans">
              Estudio de mercado
            </span>
          </div>
        </header>

        {/* Content Body */}
        <div className="p-3 sm:p-6 pb-20 xl:pb-6 max-w-5xl w-full mx-auto space-y-5 sm:space-y-6">
          {/* Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 py-2 border-b border-neutral-100 text-xs">
            <div className="text-xs text-neutral-500 font-sans">
              Monitoreo de operadores y planes de telecomunicaciones
            </div>

            <div className="flex items-center gap-2 sm:gap-4 ml-auto">
              {/* Only administrators can create new operators */}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setIsNewOpOpen(true)}
                  className="py-1.5 px-2 text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer flex items-center"
                >
                  Nuevo operador
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsNewOfferOpen(true)}
                className="py-1.5 px-2.5 inline-flex items-center gap-1.5 text-neutral-900 hover:text-neutral-700 font-semibold transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2]" />
                <span>Registrar oferta</span>
              </button>
            </div>
          </div>

          {/* Market Intelligence Metrics (Strictly adhering to AGENTS.md: no cards, no uppercase, no decorative icons) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-3 border-b border-neutral-100 text-xs">
            <div className="space-y-0.5">
              <div className="text-[11px] text-neutral-400 font-sans">Ofertas analizadas</div>
              <div className="text-base sm:text-lg font-semibold font-mono text-neutral-900 tracking-tight">
                {marketMetrics.total}{" "}
                <span className="text-[11px] font-sans font-normal text-neutral-400">planes</span>
              </div>
            </div>

            <div className="space-y-0.5">
              <div className="text-[11px] text-neutral-400 font-sans">Tarifa mensual promedio</div>
              <div className="text-base sm:text-lg font-semibold font-mono text-neutral-900 tracking-tight">
                ${marketMetrics.avgPrice}{" "}
                <span className="text-[11px] font-sans font-normal text-neutral-400">/mes</span>
              </div>
            </div>

            <div className="space-y-0.5">
              <div className="text-[11px] text-neutral-400 font-sans">Costo medio por Mbps</div>
              <div className="text-base sm:text-lg font-semibold font-mono text-neutral-900 tracking-tight">
                ${marketMetrics.avgPricePerMb}{" "}
                <span className="text-[11px] font-sans font-normal text-neutral-400">/Mbps</span>
              </div>
            </div>

            <div className="space-y-0.5">
              <div className="text-[11px] text-neutral-400 font-sans">Operador con más presencia</div>
              <div className="text-base sm:text-lg font-semibold text-neutral-900 tracking-tight truncate">
                {marketMetrics.topOperator}
              </div>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <input
                type="text"
                value={searchOperator}
                onChange={(e) => setSearchOperator(e.target.value)}
                placeholder="Buscar operador o plan..."
                className="w-full py-1.5 px-1 text-xs border-b border-neutral-200 focus:border-neutral-900 outline-none bg-transparent transition-colors text-neutral-900 placeholder:text-neutral-400"
              />
            </div>

            <div>
              <CustomDropdown
                value={filterEstado}
                options={[{ value: "", label: "Todos los estados" }, ...estadosList.map((e) => ({ value: e, label: e }))]}
                onChange={(val) => {
                  setFilterEstado(val);
                  setFilterMunicipio("");
                  setFilterParroquia("");
                }}
                compact
              />
            </div>

            <div>
              <CustomDropdown
                value={filterMunicipio}
                options={[{ value: "", label: "Todos los municipios" }, ...municipiosList.map((m) => ({ value: m, label: m }))]}
                onChange={(val) => {
                  setFilterMunicipio(val);
                  setFilterParroquia("");
                }}
                compact
                disabled={!filterEstado || municipiosList.length === 0}
              />
            </div>

            <div>
              <CustomDropdown
                value={filterParroquia}
                options={[{ value: "", label: "Todas las parroquias" }, ...parroquiasList.map((p) => ({ value: p, label: p }))]}
                onChange={setFilterParroquia}
                compact
                disabled={!filterMunicipio || parroquiasList.length === 0}
              />
            </div>
          </div>

          {/* Offers Table / List */}
          <div className="space-y-4">
            {loadingOfertas ? (
              <div className="py-16 text-center text-xs text-neutral-400 font-sans">
                Cargando registros de mercado...
              </div>
            ) : filteredOfertas.length === 0 ? (
              <div className="py-16 text-center text-xs text-neutral-400 font-sans">
                No se encontraron ofertas con los filtros seleccionados.
              </div>
            ) : (
              <div className="divide-y divide-neutral-100 border-b border-neutral-100">
                {filteredOfertas.map((of) => {
                  const planName = of.nombre_plan || of.plan_nombre || "Plan estándar";
                  const speed = Number(of.velocidad_mb ?? of.velocidad_mbps ?? 0);
                  const price = Number(of.precio_mensual ?? of.tarifa_usd ?? 0);
                  const installCost = Number(of.costo_instalacion ?? of.costo_instalacion_usd ?? 0);
                  const promo = of.notas || of.promocion;
                  const isSymmetric = of.es_simetrico !== false;
                  const hasTv = of.incluye_tv === true;
                  const costPerMb = speed > 0 ? (price / speed).toFixed(2) : null;
                  const loc = [of.estado, of.municipio, of.parroquia]
                    .filter((s) => s && s !== "General")
                    .join(", ");

                  return (
                    <div
                      key={of.id}
                      className="group py-3.5 px-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-neutral-50/50 transition-colors"
                    >
                      <div className="space-y-1 min-w-0">
                        {/* Operator Name without color indicator */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-neutral-900">
                            {of.operador?.nombre || "Operador"}
                          </span>
                          <span className="text-[11px] text-neutral-500">
                            · {planName}
                          </span>
                          {costPerMb && (
                            <span className="text-[10px] font-mono text-neutral-400">
                              (${costPerMb}/Mbps)
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 sm:gap-3 text-[11px] text-neutral-500 flex-wrap">
                          <span>
                            <strong>{speed} Mbps</strong>
                            {isSymmetric ? " simétricos" : ""}
                          </span>
                          {hasTv && <span>· Con TV/Streaming</span>}
                          {installCost > 0 ? (
                            <span>· Instalación: ${installCost}</span>
                          ) : (
                            <span className="text-neutral-400">· Instalación gratis</span>
                          )}
                          {loc && <span className="text-neutral-400">· {loc}</span>}
                        </div>

                        {promo && (
                          <p className="text-[11px] text-neutral-500 italic line-clamp-1">
                            &ldquo;{promo}&rdquo;
                          </p>
                        )}
                      </div>

                      {/* Pricing & Actions */}
                      <div className="flex items-center gap-4 text-xs shrink-0 self-end sm:self-center">
                        <div className="text-right">
                          <div className="font-mono font-semibold text-neutral-900">
                            ${price.toFixed(2)}
                            <span className="text-[10px] text-neutral-400 font-sans"> /mes</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setOfertaToDelete(of.id)}
                          className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-150 text-neutral-400 hover:text-neutral-900 cursor-pointer p-1"
                          title="Eliminar oferta"
                          aria-label="Eliminar oferta"
                        >
                          <X className="w-3.5 h-3.5 stroke-[1.5]" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* MODAL: REGISTRAR OFERTA */}
      {isNewOfferOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-neutral-900/40 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => !savingOffer && setIsNewOfferOpen(false)}
        >
          <div
            className="w-full max-w-lg max-h-[92vh] overflow-y-auto bg-white rounded-xl shadow-2xl border border-neutral-200/90 p-5 sm:p-6 space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-900 tracking-tight font-sans">
                Registrar oferta de la competencia
              </h3>
              <button
                type="button"
                onClick={() => setIsNewOfferOpen(false)}
                className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
                aria-label="Cerrar modal"
              >
                <X className="w-4 h-4 stroke-[1.5]" />
              </button>
            </div>

            <form onSubmit={handleSaveOferta} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] text-neutral-500 block">Operador</label>
                <CustomDropdown
                  value={opId}
                  options={operadores.map((op) => ({ value: String(op.id), label: op.nombre }))}
                  onChange={setOpId}
                  placeholder="Seleccionar operador..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-neutral-500 block">Nombre del plan</label>
                  <input
                    type="text"
                    value={nombrePlan}
                    onChange={(e) => setNombrePlan(e.target.value)}
                    placeholder="Ej: Plan Fibra 200"
                    className="w-full py-1.5 px-1 border-b border-neutral-200 focus:border-neutral-900 outline-none bg-transparent transition-colors text-neutral-900"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-neutral-500 block">Tecnología</label>
                  <input
                    type="text"
                    value={tecnologia}
                    onChange={(e) => setTecnologia(e.target.value)}
                    placeholder="Ej: Fibra Óptica, Radioenlace..."
                    className="w-full py-1.5 px-1 border-b border-neutral-200 focus:border-neutral-900 outline-none bg-transparent transition-colors text-neutral-900"
                  />
                </div>
              </div>

              {/* Numeric Inputs with 1-Tap Presets & onFocus Auto-Select */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Velocidad */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] text-neutral-500 block">Velocidad (Mbps)</label>
                    {velocidadMb && (
                      <span className="text-[10px] font-mono text-neutral-400">
                        {Number(velocidadMb) >= 1000
                          ? `${(Number(velocidadMb) / 1000).toFixed(0)}G`
                          : `${velocidadMb}M`}
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    value={velocidadMb}
                    onChange={(e) => setVelocidadMb(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    placeholder="Ej: 400"
                    className="w-full py-1.5 px-1 border-b border-neutral-200 focus:border-neutral-900 outline-none bg-transparent transition-colors font-mono text-neutral-900"
                  />
                  <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                    {[100, 200, 300, 400, 500, 600, 1000].map((mb) => (
                      <button
                        key={mb}
                        type="button"
                        onClick={() => setVelocidadMb(String(mb))}
                        className={cn(
                          "text-[10px] font-mono transition-colors cursor-pointer py-0.5",
                          velocidadMb === String(mb)
                            ? "text-neutral-900 font-bold underline underline-offset-4"
                            : "text-neutral-400 hover:text-neutral-700"
                        )}
                      >
                        {mb >= 1000 ? "1G" : mb}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tarifa mensual */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] text-neutral-500 block">Tarifa mensual ($)</label>
                    {precioMensual && (
                      <span className="text-[10px] font-mono text-neutral-400">
                        ${precioMensual}
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={precioMensual}
                    onChange={(e) => setPrecioMensual(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    placeholder="Ej: 25"
                    className="w-full py-1.5 px-1 border-b border-neutral-200 focus:border-neutral-900 outline-none bg-transparent transition-colors font-mono text-neutral-900"
                  />
                  <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                    {[15, 20, 25, 30, 35, 40, 50].map((usd) => (
                      <button
                        key={usd}
                        type="button"
                        onClick={() => setPrecioMensual(String(usd))}
                        className={cn(
                          "text-[10px] font-mono transition-colors cursor-pointer py-0.5",
                          precioMensual === String(usd)
                            ? "text-neutral-900 font-bold underline underline-offset-4"
                            : "text-neutral-400 hover:text-neutral-700"
                        )}
                      >
                        ${usd}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Costo instalación */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] text-neutral-500 block">Costo instalación ($)</label>
                    {costoInstalacion !== "" && (
                      <span className="text-[10px] font-mono text-neutral-400">
                        {Number(costoInstalacion) === 0 ? "Gratis" : `$${costoInstalacion}`}
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={costoInstalacion}
                    onChange={(e) => setCostoInstalacion(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    placeholder="Ej: 0"
                    className="w-full py-1.5 px-1 border-b border-neutral-200 focus:border-neutral-900 outline-none bg-transparent transition-colors font-mono text-neutral-900"
                  />
                  <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                    {[0, 10, 15, 20, 30, 50].map((inst) => (
                      <button
                        key={inst}
                        type="button"
                        onClick={() => setCostoInstalacion(String(inst))}
                        className={cn(
                          "text-[10px] font-mono transition-colors cursor-pointer py-0.5",
                          costoInstalacion === String(inst)
                            ? "text-neutral-900 font-bold underline underline-offset-4"
                            : "text-neutral-400 hover:text-neutral-700"
                        )}
                      >
                        {inst === 0 ? "Gratis" : `$${inst}`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-neutral-700">
                  <input
                    type="checkbox"
                    checked={incluyeTv}
                    onChange={(e) => setIncluyeTv(e.target.checked)}
                    className="rounded border-neutral-300 text-neutral-900 focus:ring-0"
                  />
                  <span>Incluye TV / Streaming</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-neutral-700">
                  <input
                    type="checkbox"
                    checked={esSimetrico}
                    onChange={(e) => setEsSimetrico(e.target.checked)}
                    className="rounded border-neutral-300 text-neutral-900 focus:ring-0"
                  />
                  <span>Velocidad simétrica</span>
                </label>
              </div>

              {/* Geographic hierarchy selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-[11px] text-neutral-500 block">Estado</label>
                  <CustomDropdown
                    value={formEstado}
                    options={estadosList}
                    onChange={(val) => {
                      setFormEstado(val);
                      setFormMunicipio("");
                      setFormParroquia("");
                    }}
                    compact
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-neutral-500 block">Municipio</label>
                  <CustomDropdown
                    value={formMunicipio}
                    options={[{ value: "", label: "General" }, ...formMunicipiosList.map((m) => ({ value: m, label: m }))]}
                    onChange={(val) => {
                      setFormMunicipio(val);
                      setFormParroquia("");
                    }}
                    compact
                    disabled={!formEstado || formMunicipiosList.length === 0}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-neutral-500 block">Parroquia</label>
                  <CustomDropdown
                    value={formParroquia}
                    options={[{ value: "", label: "General" }, ...formParroquiasList.map((p) => ({ value: p, label: p }))]}
                    onChange={setFormParroquia}
                    compact
                    disabled={!formMunicipio || formParroquiasList.length === 0}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-neutral-500 block">Promoción o notas adicionales</label>
                <input
                  type="text"
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder="Detalles sobre promoción, meses de gracia, equipo incluido..."
                  className="w-full py-1.5 px-1 border-b border-neutral-200 focus:border-neutral-900 outline-none bg-transparent transition-colors text-neutral-900"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 text-xs">
                <button
                  type="button"
                  onClick={() => setIsNewOfferOpen(false)}
                  className="text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingOffer}
                  className="text-neutral-900 hover:text-neutral-700 font-semibold transition-colors cursor-pointer"
                >
                  {savingOffer ? "Guardando..." : "Guardar oferta"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NUEVO OPERADOR (Admin only, color picker eliminated) */}
      {isNewOpOpen && isAdmin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/40 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => !savingOp && setIsNewOpOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-xl shadow-2xl border border-neutral-200/90 p-5 space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-900 tracking-tight font-sans">
                Nuevo operador de competencia
              </h3>
              <button
                type="button"
                onClick={() => setIsNewOpOpen(false)}
                className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
                aria-label="Cerrar modal"
              >
                <X className="w-4 h-4 stroke-[1.5]" />
              </button>
            </div>

            <form onSubmit={handleSaveOperador} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] text-neutral-500 block">Nombre de la empresa</label>
                <input
                  type="text"
                  value={newOpNombre}
                  onChange={(e) => setNewOpNombre(e.target.value)}
                  placeholder="Ej: Fibex, Inter, NetUno..."
                  className="w-full py-1.5 px-1 border-b border-neutral-200 focus:border-neutral-900 outline-none bg-transparent transition-colors text-neutral-900"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 text-xs">
                <button
                  type="button"
                  onClick={() => setIsNewOpOpen(false)}
                  className="text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingOp}
                  className="text-neutral-900 hover:text-neutral-700 font-semibold transition-colors cursor-pointer"
                >
                  {savingOp ? "Guardando..." : "Crear operador"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ELIMINAR OFERTA */}
      <DeleteConfirmDialog
        isOpen={ofertaToDelete !== null}
        title="Eliminar oferta de competencia"
        description="¿Estás seguro de que deseas eliminar este registro de tarifa del mercado?"
        onConfirm={executeDeleteOferta}
        onCancel={() => setOfertaToDelete(null)}
      />

      {/* TOAST PILL */}
      <ToastPill
        message={toastMsg?.text || null}
        type={toastMsg?.type || "success"}
        onClose={() => setToastMsg(null)}
      />
    </div>
  );
}

export default function CompetenciaPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#FDFDFD] text-xs font-mono text-neutral-400">
          Cargando estudio de mercado...
        </div>
      }
    >
      <CompetenciaContent />
    </Suspense>
  );
}
