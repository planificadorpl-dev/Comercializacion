"use client";

import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import {
  Menu,
  Plus,
  PenLine,
  X,
  Search,
  Filter,
  DollarSign,
  TrendingUp,
  Layers,
  Check,
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
import { scrapeBCVRate, ExchangeRate } from "@/app/actions/bcv-scraper";
import { scrapeBinanceRate, BinanceRate } from "@/app/actions/binance-scraper";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useUser } from "@/components/providers/user-provider";
import { useModules } from "@/components/providers/modules-provider";

// Client module-level cache for instantaneous panel transitions
let cachedBcvRate: ExchangeRate | null = {
  moneda: "USD",
  fuente: "BCV",
  nombre: "Dólar BCV",
  valor: 36.5,
  fechaActualizacion: new Date().toISOString(),
};
let cachedBinanceRate: BinanceRate | null = {
  price: 38.5,
  asset: "USDT",
  fiat: "VES",
  merchantName: "Mercado P2P",
  tradeType: "BUY",
};
let cachedOperadores: any[] = [];
let cachedOfertas: any[] = [];
let hasInitialLoadedOfertas = false;

function CompetenciaContent() {
  const { user, isAdmin } = useUser();
  const { isModuleEnabledForUser } = useModules();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Exchange Rates (initialized with cached values for instant 0ms render)
  const [bcvRate, setBcvRate] = useState<ExchangeRate | null>(() => cachedBcvRate);
  const [binanceRate, setBinanceRate] = useState<BinanceRate | null>(() => cachedBinanceRate);

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

  // New Offer Form State
  const [opId, setOpId] = useState<string>(() => (cachedOperadores.length > 0 ? String(cachedOperadores[0].id) : ""));
  const [nombrePlan, setNombrePlan] = useState("");
  const [velocidadMb, setVelocidadMb] = useState<number>(100);
  const [precioMensual, setPrecioMensual] = useState<number>(25);
  const [costoInstalacion, setCostoInstalacion] = useState<number>(0);
  const [incluyeTv, setIncluyeTv] = useState(false);
  const [esSimetrico, setEsSimetrico] = useState(true);
  const [formEstado, setFormEstado] = useState("Miranda");
  const [formMunicipio, setFormMunicipio] = useState("");
  const [formParroquia, setFormParroquia] = useState("");
  const [notas, setNotas] = useState("");
  const [savingOffer, setSavingOffer] = useState(false);

  // New Operator Form State
  const [newOpNombre, setNewOpNombre] = useState("");
  const [newOpColor, setNewOpColor] = useState("#3b82f6");
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
    scrapeBCVRate().then((r) => {
      if (r) {
        cachedBcvRate = r;
        setBcvRate(r);
      }
    });
    scrapeBinanceRate().then((r) => {
      if (r) {
        cachedBinanceRate = r;
        setBinanceRate(r);
      }
    });

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
    if (!newOpNombre.trim()) return;
    setSavingOp(true);
    try {
      const op = await saveOperador(newOpNombre.trim(), newOpColor);
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
        velocidad_mb: Number(velocidadMb) || 0,
        precio_mensual: Number(precioMensual) || 0,
        costo_instalacion: Number(costoInstalacion) || 0,
        incluye_tv: incluyeTv,
        es_simetrico: esSimetrico,
        estado: formEstado,
        municipio: formMunicipio || "General",
        parroquia: formParroquia || "General",
        notas: notas.trim() || null,
        asesor_nombre: "Sistema",
      };

      await saveOferta(payload);
      setNombrePlan("");
      setNotas("");
      setIsNewOfferOpen(false);
      setToastMsg({ text: "Oferta registrada exitosamente", type: "success" });
      loadOfertas();
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
    if (!searchOperator) return ofertas;
    return ofertas.filter((o) =>
      o.operador?.nombre?.toLowerCase().includes(searchOperator.toLowerCase()) ||
      o.nombre_plan?.toLowerCase().includes(searchOperator.toLowerCase())
    );
  }, [ofertas, searchOperator]);

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
          {/* Financial Rates Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 py-2 px-1 sm:px-3 border-b border-neutral-100 text-xs">
            <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
              <div className="flex items-center gap-1.5 text-neutral-600">
                <span className="text-neutral-400">Tasa BCV:</span>
                <span className="font-mono font-semibold text-neutral-900">
                  {bcvRate ? `${bcvRate.valor.toFixed(2)} Bs/USD` : "Cargando..."}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-neutral-600">
                <span className="text-neutral-400">Binance P2P:</span>
                <span className="font-mono font-semibold text-neutral-900">
                  {binanceRate ? `${binanceRate.price.toFixed(2)} Bs/USDT` : "Cargando..."}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4 ml-auto">
              <span className="text-[11px] text-neutral-400 hidden sm:inline">
                {ofertas.length} ofertas
              </span>
              <button
                type="button"
                onClick={() => setIsNewOpOpen(true)}
                className="min-h-[44px] py-2 px-2 text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer flex items-center"
              >
                Nuevo operador
              </button>
              <button
                type="button"
                onClick={() => setIsNewOfferOpen(true)}
                className="min-h-[44px] py-2 px-2.5 inline-flex items-center gap-1.5 text-neutral-900 hover:text-neutral-700 font-semibold transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2]" />
                <span>Registrar oferta</span>
              </button>
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
                className="w-full py-2 px-2 text-sm sm:text-xs border-b border-neutral-200 focus:border-neutral-900 outline-none bg-transparent transition-colors text-neutral-900 placeholder:text-neutral-400"
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
              <div className="py-16 text-center text-xs text-neutral-400">
                Cargando registros de mercado...
              </div>
            ) : filteredOfertas.length === 0 ? (
              <div className="py-16 text-center text-xs text-neutral-400">
                No se encontraron ofertas con los filtros seleccionados.
              </div>
            ) : (
              <div className="divide-y divide-neutral-100 border-b border-neutral-100">
                {filteredOfertas.map((of) => {
                  const bcvPrice = bcvRate ? (of.precio_mensual * bcvRate.valor).toFixed(2) : null;
                  const loc = [of.estado, of.municipio, of.parroquia]
                    .filter((s) => s && s !== "General")
                    .join(", ");

                  return (
                    <div
                      key={of.id}
                      className="group p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-neutral-50/60 transition-colors"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: of.operador?.color_hex || "#3b82f6" }}
                          />
                          <span className="text-xs font-semibold text-neutral-900">
                            {of.operador?.nombre || "Operador"}
                          </span>
                          <span className="text-[11px] text-neutral-500">
                            · {of.nombre_plan || `${of.velocidad_mb} Mbps`}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-neutral-500">
                          <span>
                            <strong>{of.velocidad_mb} Mbps</strong>
                            {of.es_simetrico ? " simétricos" : ""}
                          </span>
                          {of.incluye_tv && <span>· Incluye TV/Streaming</span>}
                          {loc && <span className="text-neutral-400">· {loc}</span>}
                        </div>

                        {of.notas && (
                          <p className="text-[11px] text-neutral-500 italic line-clamp-1">
                            &ldquo;{of.notas}&rdquo;
                          </p>
                        )}
                      </div>

                      {/* Pricing & Actions */}
                      <div className="flex items-center gap-6 text-xs shrink-0 self-end sm:self-center">
                        <div className="text-right">
                          <div className="font-mono font-semibold text-neutral-900">
                            ${of.precio_mensual}
                            <span className="text-[10px] text-neutral-400 font-sans"> /mes</span>
                          </div>
                          {bcvPrice && (
                            <div className="text-[10px] font-mono text-neutral-400">
                              ~ {bcvPrice} Bs
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => setOfertaToDelete(of.id)}
                          className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-150 text-neutral-400 hover:text-neutral-900 cursor-pointer p-1"
                          title="Eliminar oferta"
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
            className="w-full max-w-md max-h-[92vh] overflow-y-auto bg-white rounded-xl shadow-2xl border border-neutral-200/90 p-5 sm:p-6 space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-900 tracking-tight">
                Registrar oferta de la competencia
              </h3>
              <button
                type="button"
                onClick={() => setIsNewOfferOpen(false)}
                className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
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
                  <label className="text-[11px] text-neutral-500 block">Velocidad (Mbps)</label>
                  <input
                    type="number"
                    min="1"
                    value={velocidadMb}
                    onChange={(e) => setVelocidadMb(parseInt(e.target.value, 10) || 0)}
                    className="w-full py-1.5 px-1 border-b border-neutral-200 focus:border-neutral-900 outline-none bg-transparent transition-colors font-mono text-neutral-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-neutral-500 block">Precio mensual ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={precioMensual}
                    onChange={(e) => setPrecioMensual(parseFloat(e.target.value) || 0)}
                    className="w-full py-1.5 px-1 border-b border-neutral-200 focus:border-neutral-900 outline-none bg-transparent transition-colors font-mono text-neutral-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-neutral-500 block">Costo instalación ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={costoInstalacion}
                    onChange={(e) => setCostoInstalacion(parseFloat(e.target.value) || 0)}
                    className="w-full py-1.5 px-1 border-b border-neutral-200 focus:border-neutral-900 outline-none bg-transparent transition-colors font-mono text-neutral-900"
                  />
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
                  <span>Incluye TV / IPTV</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-neutral-700">
                  <input
                    type="checkbox"
                    checked={esSimetrico}
                    onChange={(e) => setEsSimetrico(e.target.checked)}
                    className="rounded border-neutral-300 text-neutral-900 focus:ring-0"
                  />
                  <span>Simétrico</span>
                </label>
              </div>

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
                <label className="text-[11px] text-neutral-500 block">Notas adicionales</label>
                <input
                  type="text"
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder="Detalles sobre promoción, meses gratis, etc."
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

      {/* MODAL: NUEVO OPERADOR */}
      {isNewOpOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/40 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => !savingOp && setIsNewOpOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-xl shadow-2xl border border-neutral-200/90 p-5 space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-900 tracking-tight">
                Nuevo operador de competencia
              </h3>
              <button
                type="button"
                onClick={() => setIsNewOpOpen(false)}
                className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
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

              <div className="space-y-1">
                <label className="text-[11px] text-neutral-500 block">Color identificador</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={newOpColor}
                    onChange={(e) => setNewOpColor(e.target.value)}
                    className="w-8 h-8 rounded border-none cursor-pointer bg-transparent"
                  />
                  <span className="font-mono text-neutral-600">{newOpColor}</span>
                </div>
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
