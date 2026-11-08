"use client";

import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import {
  Menu,
  Plus,
  PenLine,
  X,
  Check,
  Tv,
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
import {
  getCompanyPricing,
  saveCompanyPlan,
  deleteCompanyPlan,
  saveCompanyService,
  deleteCompanyService,
  CompanyPlan,
  CompanyService,
  CompanyPricingData,
} from "@/app/actions/company-pricing";
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

  // Active top view
  const [activeView, setActiveView] = useState<"ofertas" | "comparativa" | "tarifario">("ofertas");

  // Operadores & Ofertas
  const [operadores, setOperadores] = useState<any[]>(() => cachedOperadores);
  const [ofertas, setOfertas] = useState<any[]>(() => cachedOfertas);
  const [loadingOfertas, setLoadingOfertas] = useState(!hasInitialLoadedOfertas);

  // Company Pricing State (Power Link plans and services)
  const [companyPricing, setCompanyPricing] = useState<CompanyPricingData | null>(null);
  const [loadingPricing, setLoadingPricing] = useState(false);

  // Comparator Controls
  const [compSegmento, setCompSegmento] = useState<"Domiciliario" | "Empresarial">("Domiciliario");
  const [compTipoPrecio, setCompTipoPrecio] = useState<"promo" | "regular">("promo");

  // Filters
  const [filterEstado, setFilterEstado] = useState("");
  const [filterMunicipio, setFilterMunicipio] = useState("");
  const [filterParroquia, setFilterParroquia] = useState("");
  const [searchOperator, setSearchOperator] = useState("");

  // Modals (Market Offers & Operators)
  const [isNewOfferOpen, setIsNewOfferOpen] = useState(false);
  const [isNewOpOpen, setIsNewOpOpen] = useState(false);
  const [ofertaToDelete, setOfertaToDelete] = useState<number | null>(null);

  // New Market Offer Form State (manually typed)
  const [opId, setOpId] = useState<string>(() => (cachedOperadores.length > 0 ? String(cachedOperadores[0].id) : ""));
  const [nombrePlan, setNombrePlan] = useState("");
  const [velocidadMb, setVelocidadMb] = useState<string>("");
  const [precioMensual, setPrecioMensual] = useState<string>("");
  const [costoInstalacion, setCostoInstalacion] = useState<string>("");
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

  // Company Plan Form State
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planFormNombre, setPlanFormNombre] = useState("");
  const [planFormTipo, setPlanFormTipo] = useState<"Domiciliario" | "Empresarial">("Domiciliario");
  const [planFormVelocidad, setPlanFormVelocidad] = useState("");
  const [planFormPrecioPromo, setPlanFormPrecioPromo] = useState("");
  const [planFormPrecioRegular, setPlanFormPrecioRegular] = useState("");
  const [planFormInstPromo, setPlanFormInstPromo] = useState("0");
  const [planFormInstRegular, setPlanFormInstRegular] = useState("25");
  const [planFormHasTv, setPlanFormHasTv] = useState(false);
  const [planFormNombreTv, setPlanFormNombreTv] = useState("Power Link GO TV");
  const [planFormNotas, setPlanFormNotas] = useState("");
  const [savingPlan, setSavingPlan] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<CompanyPlan | null>(null);

  // Company Service Form State
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [srvFormNombre, setSrvFormNombre] = useState("");
  const [srvFormTipoCobro, setSrvFormTipoCobro] = useState<"unico" | "mensual" | "por_metro">("mensual");
  const [srvFormPrecio, setSrvFormPrecio] = useState("");
  const [srvFormDescripcion, setSrvFormDescripcion] = useState("");
  const [savingService, setSavingService] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<CompanyService | null>(null);

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

  // Load operators & company pricing
  useEffect(() => {
    getOperadores().then((ops) => {
      cachedOperadores = ops;
      setOperadores(ops);
      if (ops.length > 0) setOpId((prev) => prev || String(ops[0].id));
    });

    loadPricingData();
  }, []);

  const loadPricingData = async () => {
    setLoadingPricing(true);
    try {
      const data = await getCompanyPricing();
      setCompanyPricing(data);
    } catch {
      console.warn("Error cargando tarifario de la empresa");
    } finally {
      setLoadingPricing(false);
    }
  };

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

  // Save new operator (admin only)
  const handleSaveOperador = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setToastMsg({ text: "Solo administradores pueden crear operadores", type: "error" });
      return;
    }
    if (!newOpNombre.trim()) return;
    setSavingOp(true);
    try {
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

  // Save market offer
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
        tecnologia: "Fibra Óptica",
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
      setVelocidadMb("");
      setPrecioMensual("");
      setCostoInstalacion("");
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

  // Delete market offer
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

  // Company Plan CRUD handlers
  const handleOpenCreatePlan = () => {
    setEditingPlanId(null);
    setPlanFormNombre("");
    setPlanFormTipo("Domiciliario");
    setPlanFormVelocidad("");
    setPlanFormPrecioPromo("");
    setPlanFormPrecioRegular("");
    setPlanFormInstPromo("0");
    setPlanFormInstRegular("25");
    setPlanFormHasTv(false);
    setPlanFormNombreTv("Power Link GO TV");
    setPlanFormNotas("");
    setIsPlanModalOpen(true);
  };

  const handleOpenEditPlan = (p: CompanyPlan) => {
    setEditingPlanId(p.id);
    setPlanFormNombre(p.nombre);
    setPlanFormTipo(p.tipo);
    setPlanFormVelocidad(String(p.velocidad_mb));
    setPlanFormPrecioPromo(String(p.precio_promo));
    setPlanFormPrecioRegular(String(p.precio_regular));
    setPlanFormInstPromo(String(p.costo_instalacion_promo));
    setPlanFormInstRegular(String(p.costo_instalacion_regular));
    setPlanFormHasTv(p.has_tv);
    setPlanFormNombreTv(p.nombre_tv || "Power Link GO TV");
    setPlanFormNotas(p.notas || "");
    setIsPlanModalOpen(true);
  };

  const handleSaveCompanyPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planFormNombre.trim()) {
      setToastMsg({ text: "Indica el nombre del plan", type: "error" });
      return;
    }
    setSavingPlan(true);
    try {
      const payload: Partial<CompanyPlan> & { id?: string } = {
        id: editingPlanId || undefined,
        nombre: planFormNombre.trim(),
        tipo: planFormTipo,
        velocidad_mb: Number(planFormVelocidad) || 100,
        precio_promo: Number(planFormPrecioPromo) || 0,
        precio_regular: Number(planFormPrecioRegular) || 0,
        costo_instalacion_promo: Number(planFormInstPromo) || 0,
        costo_instalacion_regular: Number(planFormInstRegular) || 0,
        has_tv: planFormHasTv,
        nombre_tv: planFormHasTv ? (planFormNombreTv.trim() || "Power Link GO TV") : null,
        es_simetrico: true,
        activo: true,
        notas: planFormNotas.trim() || null,
      };

      await saveCompanyPlan(payload);
      await loadPricingData();
      setIsPlanModalOpen(false);
      setToastMsg({ text: "Plan de la compañía guardado", type: "success" });
    } catch (err: any) {
      setToastMsg({ text: err.message || "Error al guardar plan", type: "error" });
    } finally {
      setSavingPlan(false);
    }
  };

  const executeDeleteCompanyPlan = async () => {
    if (!planToDelete) return;
    try {
      await deleteCompanyPlan(planToDelete.id);
      await loadPricingData();
      setPlanToDelete(null);
      setToastMsg({ text: "Plan eliminado del tarifario", type: "success" });
    } catch (err: any) {
      setToastMsg({ text: err.message || "Error al eliminar plan", type: "error" });
    }
  };

  // Company Service CRUD handlers
  const handleOpenCreateService = () => {
    setEditingServiceId(null);
    setSrvFormNombre("");
    setSrvFormTipoCobro("mensual");
    setSrvFormPrecio("");
    setSrvFormDescripcion("");
    setIsServiceModalOpen(true);
  };

  const handleOpenEditService = (s: CompanyService) => {
    setEditingServiceId(s.id);
    setSrvFormNombre(s.nombre);
    setSrvFormTipoCobro(s.tipo_cobro);
    setSrvFormPrecio(String(s.precio_usd));
    setSrvFormDescripcion(s.descripcion || "");
    setIsServiceModalOpen(true);
  };

  const handleSaveCompanyService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!srvFormNombre.trim()) {
      setToastMsg({ text: "Indica el nombre del servicio", type: "error" });
      return;
    }
    setSavingService(true);
    try {
      const payload: Partial<CompanyService> & { id?: string } = {
        id: editingServiceId || undefined,
        nombre: srvFormNombre.trim(),
        tipo_cobro: srvFormTipoCobro,
        precio_usd: Number(srvFormPrecio) || 0,
        descripcion: srvFormDescripcion.trim() || null,
        activo: true,
      };

      await saveCompanyService(payload);
      await loadPricingData();
      setIsServiceModalOpen(false);
      setToastMsg({ text: "Servicio guardado exitosamente", type: "success" });
    } catch (err: any) {
      setToastMsg({ text: err.message || "Error al guardar servicio", type: "error" });
    } finally {
      setSavingService(false);
    }
  };

  const executeDeleteCompanyService = async () => {
    if (!serviceToDelete) return;
    try {
      await deleteCompanyService(serviceToDelete.id);
      await loadPricingData();
      setServiceToDelete(null);
      setToastMsg({ text: "Servicio eliminado", type: "success" });
    } catch (err: any) {
      setToastMsg({ text: err.message || "Error al eliminar servicio", type: "error" });
    }
  };

  // Filtered market offers
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

  // Market intelligence metrics
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

  // Dynamic Comparator calculations: Group Power Link plans and match equivalent market offers
  const comparisonData = useMemo(() => {
    if (!companyPricing) return [];
    const activePlans = companyPricing.planes.filter(
      (p) => p.activo && p.tipo === compSegmento
    );

    return activePlans.map((myPlan) => {
      const myPrice = compTipoPrecio === "promo" ? myPlan.precio_promo : myPlan.precio_regular;
      const myInstall = compTipoPrecio === "promo" ? myPlan.costo_instalacion_promo : myPlan.costo_instalacion_regular;
      const mySpeed = myPlan.velocidad_mb;
      const myCostPerMb = mySpeed > 0 ? (myPrice / mySpeed).toFixed(2) : "0.00";

      // Match competitor offers in equivalent speed range
      const matchingCompetitors = filteredOfertas.filter((o) => {
        const cSpeed = Number(o.velocidad_mb ?? o.velocidad_mbps ?? 0);
        if (mySpeed <= 400) return cSpeed <= 450;
        if (mySpeed <= 600) return cSpeed >= 450 && cSpeed <= 650;
        if (mySpeed <= 800) return cSpeed >= 650 && cSpeed <= 850;
        return cSpeed >= 850;
      });

      return {
        myPlan,
        myPrice,
        myInstall,
        myCostPerMb,
        matchingCompetitors,
      };
    });
  }, [companyPricing, compSegmento, compTipoPrecio, filteredOfertas]);

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
          {/* Top View Selector Tabs (strictly typography and clean line indicator) */}
          <div className="flex items-center gap-6 border-b border-neutral-100 text-xs select-none">
            <button
              type="button"
              onClick={() => setActiveView("ofertas")}
              className={cn(
                "py-2.5 transition-colors cursor-pointer font-sans",
                activeView === "ofertas"
                  ? "text-neutral-900 font-semibold border-b-2 border-neutral-900 -mb-px"
                  : "text-neutral-400 hover:text-neutral-700 font-normal"
              )}
            >
              Ofertas del mercado
            </button>

            <button
              type="button"
              onClick={() => setActiveView("comparativa")}
              className={cn(
                "py-2.5 transition-colors cursor-pointer font-sans",
                activeView === "comparativa"
                  ? "text-neutral-900 font-semibold border-b-2 border-neutral-900 -mb-px"
                  : "text-neutral-400 hover:text-neutral-700 font-normal"
              )}
            >
              Comparativa vs Power Link
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={() => setActiveView("tarifario")}
                className={cn(
                  "py-2.5 transition-colors cursor-pointer font-sans",
                  activeView === "tarifario"
                    ? "text-neutral-900 font-semibold border-b-2 border-neutral-900 -mb-px"
                    : "text-neutral-400 hover:text-neutral-700 font-normal"
                )}
              >
                Tarifario de mi compañía
              </button>
            )}
          </div>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* VISTA 1: OFERTAS DEL MERCADO                                      */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {activeView === "ofertas" && (
            <div className="space-y-5 sm:space-y-6 animate-in fade-in duration-150">
              {/* Action Row */}
              <div className="flex flex-wrap items-center justify-between gap-3 py-2 border-b border-neutral-100 text-xs">
                <div className="text-xs text-neutral-500 font-sans">
                  Monitoreo de operadores y planes de telecomunicaciones
                </div>

                <div className="flex items-center gap-2 sm:gap-4 ml-auto">
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

              {/* Market Intelligence Metrics */}
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
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* VISTA 2: COMPARATIVA VS POWER LINK                                */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {activeView === "comparativa" && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Comparator Controls Row */}
              <div className="flex flex-wrap items-center justify-between gap-4 py-2 border-b border-neutral-100 text-xs">
                {/* Segment Selector (Domiciliario / Empresarial) */}
                <div className="flex items-center gap-4">
                  <span className="text-[11px] text-neutral-400 font-sans">Segmento:</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setCompSegmento("Domiciliario")}
                      className={cn(
                        "transition-colors cursor-pointer",
                        compSegmento === "Domiciliario"
                          ? "text-neutral-900 font-semibold underline underline-offset-4"
                          : "text-neutral-400 hover:text-neutral-700"
                      )}
                    >
                      Residencial (Hogar)
                    </button>
                    <button
                      type="button"
                      onClick={() => setCompSegmento("Empresarial")}
                      className={cn(
                        "transition-colors cursor-pointer",
                        compSegmento === "Empresarial"
                          ? "text-neutral-900 font-semibold underline underline-offset-4"
                          : "text-neutral-400 hover:text-neutral-700"
                      )}
                    >
                      Corporativo (Empresas)
                    </button>
                  </div>
                </div>

                {/* Price Mode Selector (Promo vs Regular) */}
                <div className="flex items-center gap-4 ml-auto">
                  <span className="text-[11px] text-neutral-400 font-sans">Tarifa Power Link:</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setCompTipoPrecio("promo")}
                      className={cn(
                        "transition-colors cursor-pointer",
                        compTipoPrecio === "promo"
                          ? "text-neutral-900 font-semibold underline underline-offset-4"
                          : "text-neutral-400 hover:text-neutral-700"
                      )}
                    >
                      Precio Promoción (3 meses)
                    </button>
                    <button
                      type="button"
                      onClick={() => setCompTipoPrecio("regular")}
                      className={cn(
                        "transition-colors cursor-pointer",
                        compTipoPrecio === "regular"
                          ? "text-neutral-900 font-semibold underline underline-offset-4"
                          : "text-neutral-400 hover:text-neutral-700"
                      )}
                    >
                      Precio Regular
                    </button>
                  </div>
                </div>
              </div>

              {/* Geographic filter reminder */}
              <div className="flex items-center justify-between text-xs text-neutral-500 py-1">
                <span>
                  Mostrando comparativa en:{" "}
                  <strong className="text-neutral-900 font-medium">
                    {[filterEstado, filterMunicipio, filterParroquia].filter(Boolean).join(" · ") || "Nacional (todos los sectores)"}
                  </strong>
                </span>
                <span className="text-[11px] text-neutral-400">
                  {filteredOfertas.length} ofertas de competencia activas
                </span>
              </div>

              {/* Head-to-head comparison cards by speed tier */}
              <div className="space-y-8">
                {comparisonData.map(({ myPlan, myPrice, myInstall, myCostPerMb, matchingCompetitors }) => {
                  return (
                    <div key={myPlan.id} className="space-y-3 pb-6 border-b border-neutral-100">
                      {/* Power Link Plan Headline */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2 border-b border-neutral-100">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-neutral-900 font-sans">
                              Power Link · {myPlan.nombre}
                            </span>
                            <span className="text-[11px] font-mono text-neutral-500">
                              ({myPlan.velocidad_mb} Mbps)
                            </span>
                            {myPlan.has_tv && (
                              <span className="text-[10px] text-neutral-600 inline-flex items-center gap-1">
                                · TV Streaming ({myPlan.nombre_tv || "Power Link GO"})
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-neutral-400">
                            Instalación: {myInstall === 0 ? "Gratis" : `$${myInstall}`} · Simétrico · ${myCostPerMb}/Mbps
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="font-mono text-base font-semibold text-neutral-900">
                            ${myPrice.toFixed(2)}
                            <span className="text-[10px] text-neutral-400 font-sans font-normal"> /mes</span>
                          </div>
                          <div className="text-[10px] text-neutral-400">
                            {compTipoPrecio === "promo" ? "Precio Promo" : "Precio Regular"}
                          </div>
                        </div>
                      </div>

                      {/* Matching Competitor Offers */}
                      <div className="space-y-2 pt-1 pl-0 sm:pl-3">
                        <div className="text-[11px] text-neutral-400 font-sans">
                          Competidores en rango equivalente ({myPlan.velocidad_mb} Mbps):
                        </div>

                        {matchingCompetitors.length === 0 ? (
                          <div className="py-4 text-xs text-neutral-400 italic">
                            No hay ofertas de la competencia registradas en este rango de velocidad para la zona seleccionada.
                          </div>
                        ) : (
                          <div className="divide-y divide-neutral-100">
                            {matchingCompetitors.map((comp) => {
                              const cPrice = Number(comp.precio_mensual ?? comp.tarifa_usd ?? 0);
                              const cInstall = Number(comp.costo_instalacion ?? comp.costo_instalacion_usd ?? 0);
                              const cSpeed = Number(comp.velocidad_mb ?? comp.velocidad_mbps ?? 0);
                              const cCostPerMb = cSpeed > 0 ? (cPrice / cSpeed).toFixed(2) : "0.00";
                              const priceDiff = myPrice - cPrice;
                              const installDiff = myInstall - cInstall;

                              return (
                                <div
                                  key={comp.id}
                                  className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                                >
                                  <div className="space-y-0.5 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-neutral-900">
                                        {comp.operador?.nombre || "Competidor"}
                                      </span>
                                      <span className="text-neutral-500">
                                        · {comp.nombre_plan || `${cSpeed} Mbps`}
                                      </span>
                                      <span className="text-[10px] font-mono text-neutral-400">
                                        (${cCostPerMb}/Mbps)
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-2 text-[11px] text-neutral-400">
                                      <span>Instalación: {cInstall === 0 ? "Gratis" : `$${cInstall}`}</span>
                                      {comp.incluye_tv && <span>· Incluye TV</span>}
                                      {comp.municipio && <span>· {comp.municipio}</span>}
                                    </div>
                                  </div>

                                  {/* Pricing & Difference Verdict */}
                                  <div className="flex items-center gap-6 shrink-0 self-end sm:self-center text-right">
                                    <div>
                                      <div className="font-mono font-semibold text-neutral-900">
                                        ${cPrice.toFixed(2)}
                                        <span className="text-[10px] text-neutral-400 font-sans font-normal"> /mes</span>
                                      </div>
                                    </div>

                                    {/* Verdict badge text */}
                                    <div className="min-w-[140px] text-right font-mono text-[11px]">
                                      {priceDiff < 0 ? (
                                        <span className="text-neutral-900 font-semibold">
                                          Power Link -${Math.abs(priceDiff).toFixed(2)} más económico
                                        </span>
                                      ) : priceDiff > 0 ? (
                                        <span className="text-neutral-500">
                                          +${priceDiff.toFixed(2)} mensual
                                        </span>
                                      ) : (
                                        <span className="text-neutral-500">Tarifa idéntica</span>
                                      )}
                                      {installDiff < 0 && (
                                        <div className="text-[10px] text-neutral-400 font-sans">
                                          Ahorro instalación: ${Math.abs(installDiff).toFixed(2)}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Additional Services Table */}
              <div className="space-y-3 pt-4">
                <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                  <span className="text-xs font-semibold text-neutral-900 font-sans">
                    Servicios Adicionales Oficiales (Power Link)
                  </span>
                  <span className="text-[11px] text-neutral-400">
                    Valores vigentes
                  </span>
                </div>

                <div className="divide-y divide-neutral-100 text-xs">
                  {(companyPricing?.servicios || []).map((srv) => (
                    <div key={srv.id} className="py-2.5 flex items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <span className="font-medium text-neutral-900">{srv.nombre}</span>
                        {srv.descripcion && (
                          <p className="text-[11px] text-neutral-500">{srv.descripcion}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-mono font-semibold text-neutral-900">
                          ${srv.precio_usd.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-neutral-400 font-sans ml-1">
                          {srv.tipo_cobro === "mensual" ? "/mes" : srv.tipo_cobro === "por_metro" ? "/metro" : "único"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* VISTA 3: TARIFARIO DE MI COMPAÑÍA (Gestión y Edición en Vivo)     */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {activeView === "tarifario" && isAdmin && (
            <div className="space-y-8 animate-in fade-in duration-150">
              {/* Sección 1: Gestión de Planes */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                  <div className="space-y-0.5">
                    <h3 className="text-xs font-semibold text-neutral-900 font-sans">
                      Planes de Power Link
                    </h3>
                    <p className="text-[11px] text-neutral-500 font-sans">
                      Modifica los megas, precios promo/regular y TV. Se actualizará la comparativa de mercado.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleOpenCreatePlan}
                    className="py-1.5 px-2.5 inline-flex items-center gap-1.5 text-neutral-900 hover:text-neutral-700 font-semibold text-xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2]" />
                    <span>Añadir plan</span>
                  </button>
                </div>

                <div className="divide-y divide-neutral-100 border-b border-neutral-100 text-xs">
                  {(companyPricing?.planes || []).map((p) => (
                    <div
                      key={p.id}
                      className="group py-3.5 px-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-neutral-50/50 transition-colors"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-neutral-900">{p.nombre}</span>
                          <span className="text-[11px] text-neutral-500">· {p.tipo}</span>
                          {p.has_tv && (
                            <span className="text-[10px] text-neutral-500 inline-flex items-center gap-1">
                              · <Tv className="w-3 h-3 stroke-[1.5]" /> {p.nombre_tv || "TV"}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-neutral-500">
                          <span>Velocidad: <strong>{p.velocidad_mb} Mbps</strong></span>
                          <span>· Instalación promo: <strong>${p.costo_instalacion_promo}</strong></span>
                          <span>· Instalación reg.: <strong>${p.costo_instalacion_regular}</strong></span>
                        </div>

                        {p.notas && (
                          <p className="text-[11px] text-neutral-400 italic">{p.notas}</p>
                        )}
                      </div>

                      {/* Pricing & Edit Actions */}
                      <div className="flex items-center gap-6 shrink-0 self-end sm:self-center">
                        <div className="text-right">
                          <div className="font-mono text-xs font-semibold text-neutral-900">
                            ${p.precio_promo.toFixed(2)}
                            <span className="text-[10px] font-sans text-neutral-400 font-normal"> /promo</span>
                          </div>
                          <div className="font-mono text-[11px] text-neutral-400">
                            ${p.precio_regular.toFixed(2)} /regular
                          </div>
                        </div>

                        <div className="flex items-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-150">
                          <button
                            type="button"
                            onClick={() => handleOpenEditPlan(p)}
                            className="p-1 text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
                            title="Editar plan"
                            aria-label="Editar plan"
                          >
                            <PenLine className="w-3.5 h-3.5 stroke-[1.25]" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPlanToDelete(p)}
                            className="p-1 text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
                            title="Eliminar plan"
                            aria-label="Eliminar plan"
                          >
                            <X className="w-3.5 h-3.5 stroke-[1.5]" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sección 2: Gestión de Servicios Adicionales */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                  <div className="space-y-0.5">
                    <h3 className="text-xs font-semibold text-neutral-900 font-sans">
                      Servicios Adicionales de Power Link
                    </h3>
                    <p className="text-[11px] text-neutral-500 font-sans">
                      Configura mudanzas, IP fijas, cable extra o cualquier servicio adicional que ofrezca la empresa.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleOpenCreateService}
                    className="py-1.5 px-2.5 inline-flex items-center gap-1.5 text-neutral-900 hover:text-neutral-700 font-semibold text-xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2]" />
                    <span>Añadir servicio</span>
                  </button>
                </div>

                <div className="divide-y divide-neutral-100 border-b border-neutral-100 text-xs">
                  {(companyPricing?.servicios || []).map((srv) => (
                    <div
                      key={srv.id}
                      className="group py-3.5 px-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-neutral-50/50 transition-colors"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-neutral-900">{srv.nombre}</span>
                          <span className="text-[11px] text-neutral-400">
                            · {srv.tipo_cobro === "mensual" ? "Mensual recurrente" : srv.tipo_cobro === "por_metro" ? "Por metro" : "Pago único"}
                          </span>
                        </div>
                        {srv.descripcion && (
                          <p className="text-[11px] text-neutral-500">{srv.descripcion}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-6 shrink-0 self-end sm:self-center">
                        <div className="font-mono text-xs font-semibold text-neutral-900 text-right">
                          ${srv.precio_usd.toFixed(2)}
                          <span className="text-[10px] font-sans text-neutral-400 font-normal">
                            {" "}{srv.tipo_cobro === "mensual" ? "/mes" : srv.tipo_cobro === "por_metro" ? "/m" : ""}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-150">
                          <button
                            type="button"
                            onClick={() => handleOpenEditService(srv)}
                            className="p-1 text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
                            title="Editar servicio"
                            aria-label="Editar servicio"
                          >
                            <PenLine className="w-3.5 h-3.5 stroke-[1.25]" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setServiceToDelete(srv)}
                            className="p-1 text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
                            title="Eliminar servicio"
                            aria-label="Eliminar servicio"
                          >
                            <X className="w-3.5 h-3.5 stroke-[1.5]" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: REGISTRAR OFERTA COMPETENCIA                                */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
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

              {/* Numeric Inputs: tipeados manualmente */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-neutral-500 block">Velocidad (Mbps)</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    value={velocidadMb}
                    onChange={(e) => setVelocidadMb(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    placeholder="Ej: 400"
                    className="w-full py-1.5 px-1 border-b border-neutral-200 focus:border-neutral-900 outline-none bg-transparent transition-colors font-mono text-neutral-900"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-neutral-500 block">Tarifa mensual ($)</label>
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
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-neutral-500 block">Costo instalación ($)</label>
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

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: NUEVO OPERADOR (Admin only, color picker eliminated)        */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
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

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: CREAR / EDITAR PLAN DE POWER LINK                          */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {isPlanModalOpen && isAdmin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-neutral-900/40 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => !savingPlan && setIsPlanModalOpen(false)}
        >
          <div
            className="w-full max-w-md max-h-[92vh] overflow-y-auto bg-white rounded-xl shadow-2xl border border-neutral-200/90 p-5 sm:p-6 space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-900 tracking-tight font-sans">
                {editingPlanId ? "Editar plan de Power Link" : "Añadir nuevo plan a Power Link"}
              </h3>
              <button
                type="button"
                onClick={() => setIsPlanModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
                aria-label="Cerrar modal"
              >
                <X className="w-4 h-4 stroke-[1.5]" />
              </button>
            </div>

            <form onSubmit={handleSaveCompanyPlan} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-neutral-500 block">Nombre del plan</label>
                  <input
                    type="text"
                    value={planFormNombre}
                    onChange={(e) => setPlanFormNombre(e.target.value)}
                    placeholder="Ej: 400 Megas"
                    className="w-full py-1.5 px-1 border-b border-neutral-200 focus:border-neutral-900 outline-none bg-transparent transition-colors text-neutral-900"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-neutral-500 block">Segmento</label>
                  <CustomDropdown
                    value={planFormTipo}
                    options={[
                      { value: "Domiciliario", label: "Residencial (Hogar)" },
                      { value: "Empresarial", label: "Corporativo (Empresas)" },
                    ]}
                    onChange={(val) => setPlanFormTipo(val as any)}
                    compact
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-neutral-500 block">Velocidad (Mbps)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  value={planFormVelocidad}
                  onChange={(e) => setPlanFormVelocidad(e.target.value)}
                  placeholder="Ej: 400"
                  className="w-full py-1.5 px-1 border-b border-neutral-200 focus:border-neutral-900 outline-none bg-transparent transition-colors font-mono text-neutral-900"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-neutral-500 block">Tarifa Promo (3 meses) $</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={planFormPrecioPromo}
                    onChange={(e) => setPlanFormPrecioPromo(e.target.value)}
                    placeholder="Ej: 15"
                    className="w-full py-1.5 px-1 border-b border-neutral-200 focus:border-neutral-900 outline-none bg-transparent transition-colors font-mono text-neutral-900"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-neutral-500 block">Tarifa Regular $</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={planFormPrecioRegular}
                    onChange={(e) => setPlanFormPrecioRegular(e.target.value)}
                    placeholder="Ej: 29"
                    className="w-full py-1.5 px-1 border-b border-neutral-200 focus:border-neutral-900 outline-none bg-transparent transition-colors font-mono text-neutral-900"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-neutral-500 block">Instalación Promo $</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={planFormInstPromo}
                    onChange={(e) => setPlanFormInstPromo(e.target.value)}
                    placeholder="0"
                    className="w-full py-1.5 px-1 border-b border-neutral-200 focus:border-neutral-900 outline-none bg-transparent transition-colors font-mono text-neutral-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-neutral-500 block">Instalación Regular $</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={planFormInstRegular}
                    onChange={(e) => setPlanFormInstRegular(e.target.value)}
                    placeholder="25"
                    className="w-full py-1.5 px-1 border-b border-neutral-200 focus:border-neutral-900 outline-none bg-transparent transition-colors font-mono text-neutral-900"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-neutral-700">
                  <input
                    type="checkbox"
                    checked={planFormHasTv}
                    onChange={(e) => setPlanFormHasTv(e.target.checked)}
                    className="rounded border-neutral-300 text-neutral-900 focus:ring-0"
                  />
                  <span>Incluye TV / Streaming Digital</span>
                </label>

                {planFormHasTv && (
                  <input
                    type="text"
                    value={planFormNombreTv}
                    onChange={(e) => setPlanFormNombreTv(e.target.value)}
                    placeholder="Nombre del servicio de TV (ej: Power Link GO TV)"
                    className="w-full py-1.5 px-1 border-b border-neutral-200 focus:border-neutral-900 outline-none bg-transparent transition-colors text-neutral-900 text-[11px]"
                  />
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-neutral-500 block">Notas o condiciones</label>
                <input
                  type="text"
                  value={planFormNotas}
                  onChange={(e) => setPlanFormNotas(e.target.value)}
                  placeholder="Detalles de la promoción, tiempo de gracia, etc."
                  className="w-full py-1.5 px-1 border-b border-neutral-200 focus:border-neutral-900 outline-none bg-transparent transition-colors text-neutral-900"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 text-xs">
                <button
                  type="button"
                  onClick={() => setIsPlanModalOpen(false)}
                  className="text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingPlan}
                  className="text-neutral-900 hover:text-neutral-700 font-semibold transition-colors cursor-pointer"
                >
                  {savingPlan ? "Guardando..." : "Guardar plan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: CREAR / EDITAR SERVICIO DE POWER LINK                      */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {isServiceModalOpen && isAdmin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-neutral-900/40 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => !savingService && setIsServiceModalOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-xl shadow-2xl border border-neutral-200/90 p-5 space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-900 tracking-tight font-sans">
                {editingServiceId ? "Editar servicio adicional" : "Añadir servicio adicional"}
              </h3>
              <button
                type="button"
                onClick={() => setIsServiceModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
                aria-label="Cerrar modal"
              >
                <X className="w-4 h-4 stroke-[1.5]" />
              </button>
            </div>

            <form onSubmit={handleSaveCompanyService} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] text-neutral-500 block">Nombre del servicio</label>
                <input
                  type="text"
                  value={srvFormNombre}
                  onChange={(e) => setSrvFormNombre(e.target.value)}
                  placeholder="Ej: Servicio de Mudanza / Traslado"
                  className="w-full py-1.5 px-1 border-b border-neutral-200 focus:border-neutral-900 outline-none bg-transparent transition-colors text-neutral-900"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-neutral-500 block">Tarifa ($ USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={srvFormPrecio}
                    onChange={(e) => setSrvFormPrecio(e.target.value)}
                    placeholder="Ej: 15"
                    className="w-full py-1.5 px-1 border-b border-neutral-200 focus:border-neutral-900 outline-none bg-transparent transition-colors font-mono text-neutral-900"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-neutral-500 block">Modalidad de cobro</label>
                  <CustomDropdown
                    value={srvFormTipoCobro}
                    options={[
                      { value: "mensual", label: "Mensual recurrente" },
                      { value: "unico", label: "Pago único" },
                      { value: "por_metro", label: "Por metro lineal" },
                    ]}
                    onChange={(val) => setSrvFormTipoCobro(val as any)}
                    compact
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-neutral-500 block">Descripción o condiciones</label>
                <input
                  type="text"
                  value={srvFormDescripcion}
                  onChange={(e) => setSrvFormDescripcion(e.target.value)}
                  placeholder="Detalles sobre lo que cubre o requisitos..."
                  className="w-full py-1.5 px-1 border-b border-neutral-200 focus:border-neutral-900 outline-none bg-transparent transition-colors text-neutral-900"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 text-xs">
                <button
                  type="button"
                  onClick={() => setIsServiceModalOpen(false)}
                  className="text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingService}
                  className="text-neutral-900 hover:text-neutral-700 font-semibold transition-colors cursor-pointer"
                >
                  {savingService ? "Guardando..." : "Guardar servicio"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MODALES DE ELIMINACIÓN                                             */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <DeleteConfirmDialog
        isOpen={ofertaToDelete !== null}
        title="Eliminar oferta de competencia"
        description="¿Estás seguro de que deseas eliminar este registro de tarifa del mercado?"
        onConfirm={executeDeleteOferta}
        onCancel={() => setOfertaToDelete(null)}
      />

      <DeleteConfirmDialog
        isOpen={planToDelete !== null}
        title="Eliminar plan de Power Link"
        description={`¿Estás seguro de que deseas eliminar el plan "${planToDelete?.nombre}" de las tarifas de la compañía?`}
        onConfirm={executeDeleteCompanyPlan}
        onCancel={() => setPlanToDelete(null)}
      />

      <DeleteConfirmDialog
        isOpen={serviceToDelete !== null}
        title="Eliminar servicio adicional"
        description={`¿Estás seguro de que deseas eliminar el servicio "${serviceToDelete?.nombre}"?`}
        onConfirm={executeDeleteCompanyService}
        onCancel={() => setServiceToDelete(null)}
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
