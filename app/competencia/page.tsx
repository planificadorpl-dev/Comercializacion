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
  saveCompanyPromotion,
  deleteCompanyPromotion,
  toggleCompanyPromotion,
  CompanyPlan,
  CompanyService,
  CompanyPromotion,
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
  const [activeView, setActiveView] = useState<"ofertas" | "comparativa" | "promociones" | "tarifario">("ofertas");

  // Operadores & Ofertas
  const [operadores, setOperadores] = useState<any[]>(() => cachedOperadores);
  const [ofertas, setOfertas] = useState<any[]>(() => cachedOfertas);
  const [loadingOfertas, setLoadingOfertas] = useState(!hasInitialLoadedOfertas);

  // Company Pricing State (Power Link plans, services, and zone promotions)
  const [companyPricing, setCompanyPricing] = useState<CompanyPricingData | null>(null);
  const [loadingPricing, setLoadingPricing] = useState(false);

  // Comparator Controls
  const [compSegmento, setCompSegmento] = useState<"Domiciliario" | "Empresarial">("Domiciliario");
  const [compTipoPrecio, setCompTipoPrecio] = useState<"promo" | "regular">("promo");
  const [compSelectedPromoId, setCompSelectedPromoId] = useState<string>("auto");

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

  // Company Promotion Form State (Promociones por Zona)
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
  const [editingPromoId, setEditingPromoId] = useState<string | null>(null);
  const [promoFormNombre, setPromoFormNombre] = useState("");
  const [promoFormEstado, setPromoFormEstado] = useState("Aragua");
  const [promoFormMunicipio, setPromoFormMunicipio] = useState("");
  const [promoFormParroquia, setPromoFormParroquia] = useState("");
  const [promoFormSector, setPromoFormSector] = useState("");
  const [promoFormSegmento, setPromoFormSegmento] = useState<"Domiciliario" | "Empresarial" | "Todos">("Domiciliario");
  const [promoFormTipoDesc, setPromoFormTipoDesc] = useState<"mitad_precio" | "porcentaje" | "monto_fijo">("mitad_precio");
  const [promoFormDescValor, setPromoFormDescValor] = useState("50");
  const [promoFormDuracion, setPromoFormDuracion] = useState("3");
  const [promoFormInstGratis, setPromoFormInstGratis] = useState(true);
  const [promoFormCostoInst, setPromoFormCostoInst] = useState("0");
  const [promoFormNotas, setPromoFormNotas] = useState("");
  const [promoFormActivo, setPromoFormActivo] = useState(true);
  const [savingPromo, setSavingPromo] = useState(false);
  const [promoToDelete, setPromoToDelete] = useState<CompanyPromotion | null>(null);

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

  // Form geography (offers)
  const formMunicipiosList = useMemo(() => {
    if (!formEstado || !geoHierarchy[formEstado]) return [];
    return Object.keys(geoHierarchy[formEstado]).sort();
  }, [formEstado]);
  const formParroquiasList = useMemo(() => {
    if (!formEstado || !formMunicipio || !geoHierarchy[formEstado]?.[formMunicipio]) return [];
    return Object.keys(geoHierarchy[formEstado][formMunicipio]).sort();
  }, [formEstado, formMunicipio]);

  // Promo form geography
  const promoMunicipiosList = useMemo(() => {
    if (!promoFormEstado || !geoHierarchy[promoFormEstado]) return [];
    return Object.keys(geoHierarchy[promoFormEstado]).sort();
  }, [promoFormEstado]);
  const promoParroquiasList = useMemo(() => {
    if (!promoFormEstado || !promoFormMunicipio || !geoHierarchy[promoFormEstado]?.[promoFormMunicipio]) return [];
    return Object.keys(geoHierarchy[promoFormEstado][promoFormMunicipio]).sort();
  }, [promoFormEstado, promoFormMunicipio]);

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
      // Handled silently
    } finally {
      setLoadingPricing(false);
    }
  };

  // Load market offers
  const loadOfertas = useCallback(async (silent = false) => {
    if (!silent) setLoadingOfertas(true);
    try {
      const filtros: any = {};
      if (filterEstado) filtros.estado = filterEstado;
      if (filterMunicipio) filtros.municipio = filterMunicipio;
      if (filterParroquia) filtros.parroquia = filterParroquia;

      const data = await getOfertasRecientes(filtros);
      cachedOfertas = data;
      hasInitialLoadedOfertas = true;
      setOfertas(data);
    } catch {
      setToastMsg({ text: "Error al cargar ofertas de mercado", type: "error" });
    } finally {
      setLoadingOfertas(false);
    }
  }, [filterEstado, filterMunicipio, filterParroquia]);

  useEffect(() => {
    loadOfertas(hasInitialLoadedOfertas);
  }, [loadOfertas]);

  // Save new operator
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

  // Company Promotion CRUD handlers
  const handleOpenCreatePromo = () => {
    setEditingPromoId(null);
    setPromoFormNombre("");
    setPromoFormEstado(filterEstado || "Aragua");
    setPromoFormMunicipio(filterMunicipio || "");
    setPromoFormParroquia(filterParroquia || "");
    setPromoFormSector("");
    setPromoFormSegmento("Domiciliario");
    setPromoFormTipoDesc("mitad_precio");
    setPromoFormDescValor("50");
    setPromoFormDuracion("3");
    setPromoFormInstGratis(true);
    setPromoFormCostoInst("0");
    setPromoFormNotas("");
    setPromoFormActivo(true);
    setIsPromoModalOpen(true);
  };

  const handleOpenEditPromo = (p: CompanyPromotion) => {
    setEditingPromoId(p.id);
    setPromoFormNombre(p.nombre);
    setPromoFormEstado(p.estado || "Todos");
    setPromoFormMunicipio(p.municipio || "");
    setPromoFormParroquia(p.parroquia || "");
    setPromoFormSector(p.sector || "");
    setPromoFormSegmento(p.aplica_segmento);
    setPromoFormTipoDesc(p.tipo_descuento_mensual);
    setPromoFormDescValor(String(p.descuento_valor));
    setPromoFormDuracion(String(p.duracion_meses));
    setPromoFormInstGratis(p.instalacion_gratis);
    setPromoFormCostoInst(String(p.costo_instalacion));
    setPromoFormNotas(p.notas || "");
    setPromoFormActivo(p.activo);
    setIsPromoModalOpen(true);
  };

  const handleSaveCompanyPromotion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoFormNombre.trim()) {
      setToastMsg({ text: "Indica el nombre de la promoción", type: "error" });
      return;
    }
    setSavingPromo(true);
    try {
      const payload: Partial<CompanyPromotion> & { id?: string } = {
        id: editingPromoId || undefined,
        nombre: promoFormNombre.trim(),
        estado: promoFormEstado,
        municipio: promoFormMunicipio || null,
        parroquia: promoFormParroquia || null,
        sector: promoFormSector.trim() || null,
        aplica_segmento: promoFormSegmento,
        tipo_descuento_mensual: promoFormTipoDesc,
        descuento_valor: Number(promoFormDescValor) || 50,
        duracion_meses: Number(promoFormDuracion) || 3,
        instalacion_gratis: promoFormInstGratis,
        costo_instalacion: promoFormInstGratis ? 0 : Number(promoFormCostoInst) || 0,
        activo: promoFormActivo,
        notas: promoFormNotas.trim() || null,
      };

      await saveCompanyPromotion(payload);
      await loadPricingData();
      setIsPromoModalOpen(false);
      setToastMsg({ text: "Promoción de zona guardada", type: "success" });
    } catch (err: any) {
      setToastMsg({ text: err.message || "Error al guardar promoción", type: "error" });
    } finally {
      setSavingPromo(false);
    }
  };

  const handleTogglePromoStatus = async (promo: CompanyPromotion) => {
    try {
      await toggleCompanyPromotion(promo.id, !promo.activo);
      await loadPricingData();
      setToastMsg({
        text: !promo.activo ? "Promoción activada" : "Promoción pausada",
        type: "success",
      });
    } catch {
      setToastMsg({ text: "Error al actualizar estado de promoción", type: "error" });
    }
  };

  const executeDeleteCompanyPromotion = async () => {
    if (!promoToDelete) return;
    try {
      await deleteCompanyPromotion(promoToDelete.id);
      await loadPricingData();
      setPromoToDelete(null);
      setToastMsg({ text: "Promoción eliminada", type: "success" });
    } catch (err: any) {
      setToastMsg({ text: err.message || "Error al eliminar promoción", type: "error" });
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

  // Resolve matching active promotion for comparator (by filter or manual override)
  const resolvedPromo = useMemo(() => {
    if (!companyPricing?.promociones) return null;
    const activePromos = companyPricing.promociones.filter((p) => p.activo);
    if (activePromos.length === 0) return null;

    // If manually overridden in comparator
    if (compSelectedPromoId !== "auto") {
      if (compSelectedPromoId === "none") return null;
      return activePromos.find((p) => p.id === compSelectedPromoId) || null;
    }

    // Auto-detect matching promotion by geographic filter (Parroquia > Municipio > Estado)
    if (filterParroquia) {
      const matchParr = activePromos.find(
        (p) => p.parroquia && p.parroquia.toLowerCase() === filterParroquia.toLowerCase()
      );
      if (matchParr) return matchParr;
    }

    if (filterMunicipio) {
      const matchMun = activePromos.find(
        (p) => p.municipio && p.municipio.toLowerCase() === filterMunicipio.toLowerCase()
      );
      if (matchMun) return matchMun;
    }

    if (filterEstado) {
      const matchEst = activePromos.find(
        (p) => p.estado && p.estado.toLowerCase() === filterEstado.toLowerCase()
      );
      if (matchEst) return matchEst;
    }

    return null;
  }, [companyPricing?.promociones, compSelectedPromoId, filterEstado, filterMunicipio, filterParroquia]);

  // Dynamic Comparator calculations: Group Power Link plans and match equivalent market offers
  const comparisonData = useMemo(() => {
    if (!companyPricing) return [];
    const activePlans = companyPricing.planes.filter(
      (p) => p.activo && p.tipo === compSegmento
    );

    return activePlans.map((myPlan) => {
      let myPrice = myPlan.precio_regular;
      let myInstall = myPlan.costo_instalacion_regular;

      if (compTipoPrecio === "promo") {
        const promoApplies = resolvedPromo && (resolvedPromo.aplica_segmento === "Todos" || resolvedPromo.aplica_segmento === compSegmento);

        if (promoApplies) {
          // Calculate price based on active promotion rules
          if (resolvedPromo.tipo_descuento_mensual === "mitad_precio") {
            myPrice = parseFloat((myPlan.precio_regular * 0.5).toFixed(2));
          } else if (resolvedPromo.tipo_descuento_mensual === "porcentaje") {
            myPrice = parseFloat((myPlan.precio_regular * (1 - resolvedPromo.descuento_valor / 100)).toFixed(2));
          } else if (resolvedPromo.tipo_descuento_mensual === "monto_fijo") {
            myPrice = Math.max(0, parseFloat((myPlan.precio_regular - resolvedPromo.descuento_valor).toFixed(2)));
          }

          myInstall = resolvedPromo.instalacion_gratis ? 0 : resolvedPromo.costo_instalacion;
        } else {
          // Fallback to base plan promotional pricing
          myPrice = myPlan.precio_promo;
          myInstall = myPlan.costo_instalacion_promo;
        }
      }

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
  }, [companyPricing, compSegmento, compTipoPrecio, resolvedPromo, filteredOfertas]);

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
          <div className="flex items-center gap-6 border-b border-neutral-100 text-xs select-none overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveView("ofertas")}
              className={cn(
                "py-2.5 transition-colors cursor-pointer font-sans whitespace-nowrap",
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
                "py-2.5 transition-colors cursor-pointer font-sans whitespace-nowrap",
                activeView === "comparativa"
                  ? "text-neutral-900 font-semibold border-b-2 border-neutral-900 -mb-px"
                  : "text-neutral-400 hover:text-neutral-700 font-normal"
              )}
            >
              Comparativa vs Power Link
            </button>

            <button
              type="button"
              onClick={() => setActiveView("promociones")}
              className={cn(
                "py-2.5 transition-colors cursor-pointer font-sans whitespace-nowrap",
                activeView === "promociones"
                  ? "text-neutral-900 font-semibold border-b-2 border-neutral-900 -mb-px"
                  : "text-neutral-400 hover:text-neutral-700 font-normal"
              )}
            >
              Promociones por zona
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={() => setActiveView("tarifario")}
                className={cn(
                  "py-2.5 transition-colors cursor-pointer font-sans whitespace-nowrap",
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
                      Precio Promoción
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

              {/* Geographic filter & Promotion selector bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-neutral-500 py-1 border-b border-neutral-100">
                <div className="flex items-center gap-2">
                  <span>Zona evaluada:</span>
                  <strong className="text-neutral-900 font-medium">
                    {[filterEstado, filterMunicipio, filterParroquia].filter(Boolean).join(" · ") || "Nacional (todas las zonas)"}
                  </strong>
                </div>

                {compTipoPrecio === "promo" && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-neutral-400">Promoción aplicada:</span>
                    <CustomDropdown
                      value={compSelectedPromoId}
                      options={[
                        { value: "auto", label: "Automática (según zona)" },
                        { value: "none", label: "Promoción general estándar" },
                        ...((companyPricing?.promociones || []).map((p) => ({
                          value: p.id,
                          label: `${p.nombre} (${p.instalacion_gratis ? "Inst. $0" : `$${p.costo_instalacion}`})`,
                        }))),
                      ]}
                      onChange={setCompSelectedPromoId}
                      compact
                    />
                  </div>
                )}
              </div>

              {/* Active Zone Promotion Banner */}
              {compTipoPrecio === "promo" && resolvedPromo && (
                <div className="py-2.5 px-3 border-b border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-neutral-900 font-sans">
                        Promoción activa: {resolvedPromo.nombre}
                      </span>
                      <span className="text-[11px] text-neutral-400">
                        · {resolvedPromo.duracion_meses} meses
                      </span>
                    </div>
                    <div className="text-[11px] text-neutral-500">
                      {resolvedPromo.tipo_descuento_mensual === "mitad_precio"
                        ? "Mensualidad a mitad de precio (50% descuento)"
                        : resolvedPromo.tipo_descuento_mensual === "porcentaje"
                        ? `${resolvedPromo.descuento_valor}% de descuento en mensualidad`
                        : `$${resolvedPromo.descuento_valor} de descuento mensual`}
                      {" · "}
                      Instalación:{" "}
                      <strong className="text-neutral-900 font-medium">
                        {resolvedPromo.instalacion_gratis ? "Completamente Gratis ($0)" : `$${resolvedPromo.costo_instalacion}`}
                      </strong>
                      {resolvedPromo.notas && <span> — {resolvedPromo.notas}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[11px] font-mono text-neutral-500">
                      {[resolvedPromo.parroquia, resolvedPromo.municipio, resolvedPromo.estado].filter(Boolean).join(", ")}
                    </span>
                  </div>
                </div>
              )}

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
                            {compTipoPrecio === "promo"
                              ? resolvedPromo
                                ? `Promo ${resolvedPromo.nombre}`
                                : "Precio Promo (3 meses)"
                              : "Precio Regular"}
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
          {/* VISTA 3: PROMOCIONES POR ZONA                                      */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {activeView === "promociones" && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Action Row */}
              <div className="flex flex-wrap items-center justify-between gap-3 py-2 border-b border-neutral-100 text-xs">
                <div className="space-y-0.5">
                  <h3 className="text-xs font-semibold text-neutral-900 font-sans">
                    Promociones regionales de Power Link
                  </h3>
                  <p className="text-[11px] text-neutral-500 font-sans">
                    Configuración de planes a mitad de precio, instalaciones gratis o condiciones especiales por estado, municipio o sector.
                  </p>
                </div>

                {isAdmin && (
                  <button
                    type="button"
                    onClick={handleOpenCreatePromo}
                    className="py-1.5 px-2.5 inline-flex items-center gap-1.5 text-neutral-900 hover:text-neutral-700 font-semibold transition-colors cursor-pointer text-xs"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2]" />
                    <span>Añadir promoción</span>
                  </button>
                )}
              </div>

              {/* Promotions List */}
              <div className="space-y-4">
                {(companyPricing?.promociones || []).length === 0 ? (
                  <div className="py-16 text-center text-xs text-neutral-400 font-sans">
                    No hay promociones por zona registradas.
                  </div>
                ) : (
                  <div className="divide-y divide-neutral-100 border-b border-neutral-100">
                    {(companyPricing?.promociones || []).map((promo) => {
                      const locationParts = [
                        promo.estado !== "Todos" ? promo.estado : null,
                        promo.municipio,
                        promo.parroquia,
                        promo.sector,
                      ].filter(Boolean);

                      return (
                        <div
                          key={promo.id}
                          className="group py-4 px-2 flex flex-col sm:flex-row sm:items-start justify-between gap-4 hover:bg-neutral-50/50 transition-colors"
                        >
                          <div className="space-y-1.5 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-semibold text-neutral-900">
                                {promo.nombre}
                              </span>
                              <span className={cn(
                                "text-[11px] font-sans font-medium",
                                promo.activo ? "text-neutral-900" : "text-neutral-400"
                              )}>
                                · {promo.activo ? "Vigente" : "Pausada"}
                              </span>
                              <span className="text-[11px] text-neutral-500">
                                · {promo.aplica_segmento}
                              </span>
                            </div>

                            <div className="text-[11px] text-neutral-500">
                              {locationParts.length > 0 ? locationParts.join(" ❯ ") : "Aplica a nivel nacional"}
                            </div>

                            <div className="flex items-center gap-3 sm:gap-4 text-[11px] text-neutral-700 flex-wrap pt-0.5">
                              <span>
                                ⚡ Mensualidad:{" "}
                                <strong>
                                  {promo.tipo_descuento_mensual === "mitad_precio"
                                    ? "Mitad de precio (50% desc.)"
                                    : promo.tipo_descuento_mensual === "porcentaje"
                                    ? `${promo.descuento_valor}% de descuento`
                                    : `$${promo.descuento_valor} de descuento`}
                                </strong>{" "}
                                por {promo.duracion_meses} meses
                              </span>

                              <span>
                                🛠️ Instalación:{" "}
                                <strong>
                                  {promo.instalacion_gratis ? "Gratis ($0)" : `$${promo.costo_instalacion}`}
                                </strong>
                              </span>
                            </div>

                            {promo.notas && (
                              <p className="text-[11px] text-neutral-500 italic">
                                &ldquo;{promo.notas}&rdquo;
                              </p>
                            )}
                          </div>

                          {/* Admin Actions */}
                          <div className="flex items-center gap-3 shrink-0 self-end sm:self-start text-xs pt-0.5">
                            {isAdmin && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleTogglePromoStatus(promo)}
                                  className="text-[11px] text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
                                >
                                  {promo.activo ? "Pausar" : "Activar"}
                                </button>

                                <div className="flex items-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-150">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditPromo(promo)}
                                    className="p-1 text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
                                    title="Editar promoción"
                                    aria-label="Editar promoción"
                                  >
                                    <PenLine className="w-3.5 h-3.5 stroke-[1.25]" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setPromoToDelete(promo)}
                                    className="p-1 text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
                                    title="Eliminar promoción"
                                    aria-label="Eliminar promoción"
                                  >
                                    <X className="w-3.5 h-3.5 stroke-[1.5]" />
                                  </button>
                                </div>
                              </>
                            )}
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
          {/* VISTA 4: TARIFARIO DE MI COMPAÑÍA (Gestión y Edición en Vivo)     */}
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
                className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer p-1"
                aria-label="Cerrar modal"
              >
                <X className="w-4 h-4 stroke-[1.5]" />
              </button>
            </div>

            <form onSubmit={handleSaveOferta} className="space-y-4 text-xs font-sans">
              <div className="space-y-1">
                <label className="text-[11px] text-neutral-500 block">Operador</label>
                <CustomDropdown
                  value={opId}
                  options={operadores.map((op) => ({
                    value: String(op.id),
                    label: op.nombre,
                  }))}
                  onChange={setOpId}
                  compact
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-neutral-500 block">Nombre del plan</label>
                <input
                  type="text"
                  value={nombrePlan}
                  onChange={(e) => setNombrePlan(e.target.value)}
                  placeholder="Ej: Plan Fibra Hogar 400"
                  className="w-full py-1.5 px-1 border-b border-neutral-200 focus:border-neutral-900 outline-none bg-transparent transition-colors text-neutral-900"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-neutral-500 block">Velocidad (Mbps)</label>
                  <input
                    type="number"
                    min="1"
                    value={velocidadMb}
                    onChange={(e) => setVelocidadMb(e.target.value)}
                    placeholder="400"
                    className="w-full py-1.5 px-1 border-b border-neutral-200 focus:border-neutral-900 outline-none bg-transparent transition-colors font-mono text-neutral-900"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-neutral-500 block">Tarifa mensual ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={precioMensual}
                    onChange={(e) => setPrecioMensual(e.target.value)}
                    placeholder="25"
                    className="w-full py-1.5 px-1 border-b border-neutral-200 focus:border-neutral-900 outline-none bg-transparent transition-colors font-mono text-neutral-900"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-neutral-500 block">Costo instalación ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={costoInstalacion}
                    onChange={(e) => setCostoInstalacion(e.target.value)}
                    placeholder="0"
                    className="w-full py-1.5 px-1 border-b border-neutral-200 focus:border-neutral-900 outline-none bg-transparent transition-colors font-mono text-neutral-900"
                  />
                </div>
              </div>

              <div className="flex items-center gap-6 pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none text-neutral-700">
                  <input
                    type="checkbox"
                    checked={incluyeTv}
                    onChange={(e) => setIncluyeTv(e.target.checked)}
                    className="rounded text-neutral-900 focus:ring-0"
                  />
                  <span>Incluye TV / Streaming</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none text-neutral-700">
                  <input
                    type="checkbox"
                    checked={esSimetrico}
                    onChange={(e) => setEsSimetrico(e.target.checked)}
                    className="rounded text-neutral-900 focus:ring-0"
                  />
                  <span>Velocidad simétrica</span>
                </label>
              </div>

              <div className="space-y-2 pt-1 border-t border-neutral-100">
                <div className="text-[11px] text-neutral-400">Ubicación de la oferta (opcional)</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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

                  <CustomDropdown
                    value={formMunicipio}
                    options={[{ value: "", label: "Municipio" }, ...formMunicipiosList.map((m) => ({ value: m, label: m }))]}
                    onChange={(val) => {
                      setFormMunicipio(val);
                      setFormParroquia("");
                    }}
                    compact
                    disabled={!formEstado || formMunicipiosList.length === 0}
                  />

                  <CustomDropdown
                    value={formParroquia}
                    options={[{ value: "", label: "Parroquia" }, ...formParroquiasList.map((p) => ({ value: p, label: p }))]}
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
      {/* MODAL: NUEVO OPERADOR (SOLO ADMIN)                                 */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {isNewOpOpen && isAdmin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-neutral-900/40 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => !savingOp && setIsNewOpOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-xl shadow-2xl border border-neutral-200/90 p-5 sm:p-6 space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-900 tracking-tight font-sans">
                Registrar nuevo operador
              </h3>
              <button
                type="button"
                onClick={() => setIsNewOpOpen(false)}
                className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer p-1"
                aria-label="Cerrar modal"
              >
                <X className="w-4 h-4 stroke-[1.5]" />
              </button>
            </div>

            <form onSubmit={handleSaveOperador} className="space-y-4 text-xs font-sans">
              <div className="space-y-1">
                <label className="text-[11px] text-neutral-500 block">Nombre de la empresa u operador</label>
                <input
                  type="text"
                  value={newOpNombre}
                  onChange={(e) => setNewOpNombre(e.target.value)}
                  placeholder="Ej: NetUno, Cantv, Thundernet..."
                  className="w-full py-1.5 px-1 border-b border-neutral-200 focus:border-neutral-900 outline-none bg-transparent transition-colors text-neutral-900"
                  required
                  autoFocus
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
      {/* MODAL: GESTIÓN DE PLAN DE POWER LINK                                */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {isPlanModalOpen && isAdmin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-neutral-900/40 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => !savingPlan && setIsPlanModalOpen(false)}
        >
          <div
            className="w-full max-w-lg max-h-[92vh] overflow-y-auto bg-white rounded-xl shadow-2xl border border-neutral-200/90 p-5 sm:p-6 space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-900 tracking-tight font-sans">
                {editingPlanId ? "Editar plan de Power Link" : "Nuevo plan de Power Link"}
              </h3>
              <button
                type="button"
                onClick={() => setIsPlanModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer p-1"
                aria-label="Cerrar modal"
              >
                <X className="w-4 h-4 stroke-[1.5]" />
              </button>
            </div>

            <form onSubmit={handleSaveCompanyPlan} className="space-y-4 text-xs font-sans">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-neutral-500 block">Nombre del plan</label>
                  <input
                    type="text"
                    value={planFormNombre}
                    onChange={(e) => setPlanFormNombre(e.target.value)}
                    placeholder="Ej: 600 Megas + TV"
                    className="w-full py-1.5 px-1 border-b border-neutral-200 focus:border-neutral-900 outline-none bg-transparent transition-colors text-neutral-900"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-neutral-500 block">Segmento</label>
                  <CustomDropdown
                    value={planFormTipo}
                    options={[
                      { value: "Domiciliario", label: "Domiciliario (Hogar)" },
                      { value: "Empresarial", label: "Empresarial (Corporativo)" },
                    ]}
                    onChange={(val) => setPlanFormTipo(val as any)}
                    compact
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-neutral-500 block">Velocidad (Mbps)</label>
                  <input
                    type="number"
                    min="1"
                    value={planFormVelocidad}
                    onChange={(e) => setPlanFormVelocidad(e.target.value)}
                    placeholder="600"
                    className="w-full py-1.5 px-1 border-b border-neutral-200 focus:border-neutral-900 outline-none bg-transparent transition-colors font-mono text-neutral-900"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-neutral-500 block">Precio Promo ($ USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={planFormPrecioPromo}
                    onChange={(e) => setPlanFormPrecioPromo(e.target.value)}
                    placeholder="22"
                    className="w-full py-1.5 px-1 border-b border-neutral-200 focus:border-neutral-900 outline-none bg-transparent transition-colors font-mono text-neutral-900"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-neutral-500 block">Precio Regular ($ USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={planFormPrecioRegular}
                    onChange={(e) => setPlanFormPrecioRegular(e.target.value)}
                    placeholder="36"
                    className="w-full py-1.5 px-1 border-b border-neutral-200 focus:border-neutral-900 outline-none bg-transparent transition-colors font-mono text-neutral-900"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-neutral-500 block">Instalación Promo ($)</label>
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
                  <label className="text-[11px] text-neutral-500 block">Instalación Regular ($)</label>
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

              <div className="space-y-2 pt-1 border-t border-neutral-100">
                <label className="flex items-center gap-2 cursor-pointer select-none text-neutral-700">
                  <input
                    type="checkbox"
                    checked={planFormHasTv}
                    onChange={(e) => setPlanFormHasTv(e.target.checked)}
                    className="rounded text-neutral-900 focus:ring-0"
                  />
                  <span>Incluye televisión digital (Streaming)</span>
                </label>

                {planFormHasTv && (
                  <div className="pl-6 space-y-1">
                    <label className="text-[11px] text-neutral-500 block">Nombre del servicio de TV</label>
                    <input
                      type="text"
                      value={planFormNombreTv}
                      onChange={(e) => setPlanFormNombreTv(e.target.value)}
                      placeholder="Power Link GO TV"
                      className="w-full py-1.5 px-1 border-b border-neutral-200 focus:border-neutral-900 outline-none bg-transparent transition-colors text-neutral-900"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-neutral-500 block">Notas o condiciones del plan</label>
                <input
                  type="text"
                  value={planFormNotas}
                  onChange={(e) => setPlanFormNotas(e.target.value)}
                  placeholder="Ej: Precio especial primeros 3 meses..."
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
      {/* MODAL: GESTIÓN DE SERVICIO ADICIONAL DE POWER LINK                 */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {isServiceModalOpen && isAdmin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-neutral-900/40 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => !savingService && setIsServiceModalOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-xl shadow-2xl border border-neutral-200/90 p-5 sm:p-6 space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-900 tracking-tight font-sans">
                {editingServiceId ? "Editar servicio adicional" : "Nuevo servicio adicional"}
              </h3>
              <button
                type="button"
                onClick={() => setIsServiceModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer p-1"
                aria-label="Cerrar modal"
              >
                <X className="w-4 h-4 stroke-[1.5]" />
              </button>
            </div>

            <form onSubmit={handleSaveCompanyService} className="space-y-4 text-xs font-sans">
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
      {/* MODAL: GESTIÓN DE PROMOCIONES POR ZONA                             */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {isPromoModalOpen && isAdmin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-neutral-900/40 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => !savingPromo && setIsPromoModalOpen(false)}
        >
          <div
            className="w-full max-w-lg max-h-[92vh] overflow-y-auto bg-white rounded-xl shadow-2xl border border-neutral-200/90 p-5 sm:p-6 space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-900 tracking-tight font-sans">
                {editingPromoId ? "Editar promoción por zona" : "Nueva promoción por zona"}
              </h3>
              <button
                type="button"
                onClick={() => setIsPromoModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer p-1"
                aria-label="Cerrar modal"
              >
                <X className="w-4 h-4 stroke-[1.5]" />
              </button>
            </div>

            <form onSubmit={handleSaveCompanyPromotion} className="space-y-4 text-xs font-sans">
              <div className="space-y-1">
                <label className="text-[11px] text-neutral-500 block">Nombre de la promoción</label>
                <input
                  type="text"
                  value={promoFormNombre}
                  onChange={(e) => setPromoFormNombre(e.target.value)}
                  placeholder="Ej: Promoción Las Tejerías (Mitad de precio + Instalación Gratis)"
                  className="w-full py-1.5 px-1 border-b border-neutral-200 focus:border-neutral-900 outline-none bg-transparent transition-colors text-neutral-900"
                  required
                />
              </div>

              {/* Geographic targeting */}
              <div className="space-y-2 pt-1 border-t border-neutral-100">
                <div className="text-[11px] text-neutral-500 font-medium">Ubicación geográfica de la promoción</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] text-neutral-400 block">Estado</label>
                    <CustomDropdown
                      value={promoFormEstado}
                      options={[{ value: "Todos", label: "Todos los estados" }, ...estadosList.map((e) => ({ value: e, label: e }))]}
                      onChange={(val) => {
                        setPromoFormEstado(val);
                        setPromoFormMunicipio("");
                        setPromoFormParroquia("");
                      }}
                      compact
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-neutral-400 block">Municipio</label>
                    <CustomDropdown
                      value={promoFormMunicipio}
                      options={[{ value: "", label: "Todos los municipios" }, ...promoMunicipiosList.map((m) => ({ value: m, label: m }))]}
                      onChange={(val) => {
                        setPromoFormMunicipio(val);
                        setPromoFormParroquia("");
                      }}
                      compact
                      disabled={promoFormEstado === "Todos" || promoMunicipiosList.length === 0}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-neutral-400 block">Parroquia</label>
                    <CustomDropdown
                      value={promoFormParroquia}
                      options={[{ value: "", label: "Todas las parroquias" }, ...promoParroquiasList.map((p) => ({ value: p, label: p }))]}
                      onChange={setPromoFormParroquia}
                      compact
                      disabled={!promoFormMunicipio || promoParroquiasList.length === 0}
                    />
                  </div>
                </div>

                <div className="space-y-1 pt-1">
                  <label className="text-[11px] text-neutral-500 block">Sector o alcance específico (opcional)</label>
                  <input
                    type="text"
                    value={promoFormSector}
                    onChange={(e) => setPromoFormSector(e.target.value)}
                    placeholder="Ej: General / Toda la zona, Casco Central, Sectores seleccionados..."
                    className="w-full py-1.5 px-1 border-b border-neutral-200 focus:border-neutral-900 outline-none bg-transparent transition-colors text-neutral-900"
                  />
                </div>
              </div>

              {/* Discount and terms */}
              <div className="space-y-2 pt-1 border-t border-neutral-100">
                <div className="text-[11px] text-neutral-500 font-medium">Condiciones del beneficio</div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] text-neutral-500 block">Descuento en mensualidad</label>
                    <CustomDropdown
                      value={promoFormTipoDesc}
                      options={[
                        { value: "mitad_precio", label: "Mitad de precio (50% desc.)" },
                        { value: "porcentaje", label: "Porcentaje personalizado" },
                        { value: "monto_fijo", label: "Descuento en dólares ($)" },
                      ]}
                      onChange={(val) => {
                        setPromoFormTipoDesc(val as any);
                        if (val === "mitad_precio") setPromoFormDescValor("50");
                      }}
                      compact
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-neutral-500 block">
                      {promoFormTipoDesc === "monto_fijo" ? "Monto descontado ($)" : "Porcentaje (%)"}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      value={promoFormDescValor}
                      onChange={(e) => setPromoFormDescValor(e.target.value)}
                      placeholder="50"
                      disabled={promoFormTipoDesc === "mitad_precio"}
                      className="w-full py-1.5 px-1 border-b border-neutral-200 focus:border-neutral-900 outline-none bg-transparent transition-colors font-mono text-neutral-900 disabled:opacity-50"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <label className="text-[11px] text-neutral-500 block">Duración de la tarifa (meses)</label>
                    <input
                      type="number"
                      min="1"
                      value={promoFormDuracion}
                      onChange={(e) => setPromoFormDuracion(e.target.value)}
                      placeholder="3"
                      className="w-full py-1.5 px-1 border-b border-neutral-200 focus:border-neutral-900 outline-none bg-transparent transition-colors font-mono text-neutral-900"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-neutral-500 block">Segmento aplicable</label>
                    <CustomDropdown
                      value={promoFormSegmento}
                      options={[
                        { value: "Domiciliario", label: "Solo Domiciliario (Hogar)" },
                        { value: "Empresarial", label: "Solo Empresarial" },
                        { value: "Todos", label: "Todos los segmentos" },
                      ]}
                      onChange={(val) => setPromoFormSegmento(val as any)}
                      compact
                    />
                  </div>
                </div>

                {/* Installation cost */}
                <div className="pt-2 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-neutral-700">
                    <input
                      type="checkbox"
                      checked={promoFormInstGratis}
                      onChange={(e) => {
                        setPromoFormInstGratis(e.target.checked);
                        if (e.target.checked) setPromoFormCostoInst("0");
                      }}
                      className="rounded text-neutral-900 focus:ring-0"
                    />
                    <span className="font-medium text-neutral-900">Instalación Gratis ($0)</span>
                  </label>

                  {!promoFormInstGratis && (
                    <div className="pl-6 space-y-1">
                      <label className="text-[11px] text-neutral-500 block">Costo de instalación en esta zona ($ USD)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={promoFormCostoInst}
                        onChange={(e) => setPromoFormCostoInst(e.target.value)}
                        placeholder="25"
                        className="w-full py-1.5 px-1 border-b border-neutral-200 focus:border-neutral-900 outline-none bg-transparent transition-colors font-mono text-neutral-900"
                        required
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1 pt-1 border-t border-neutral-100">
                <label className="text-[11px] text-neutral-500 block">Notas o condiciones de la promoción</label>
                <input
                  type="text"
                  value={promoFormNotas}
                  onChange={(e) => setPromoFormNotas(e.target.value)}
                  placeholder="Ej: Plan a mitad de precio por 3 meses con costo de instalación $0..."
                  className="w-full py-1.5 px-1 border-b border-neutral-200 focus:border-neutral-900 outline-none bg-transparent transition-colors text-neutral-900"
                />
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none text-neutral-700">
                  <input
                    type="checkbox"
                    checked={promoFormActivo}
                    onChange={(e) => setPromoFormActivo(e.target.checked)}
                    className="rounded text-neutral-900 focus:ring-0"
                  />
                  <span>Promoción vigente y activa</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 text-xs">
                <button
                  type="button"
                  onClick={() => setIsPromoModalOpen(false)}
                  className="text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingPromo}
                  className="text-neutral-900 hover:text-neutral-700 font-semibold transition-colors cursor-pointer"
                >
                  {savingPromo ? "Guardando..." : "Guardar promoción"}
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
        description="¿Estás seguro de que deseas eliminar este registro de la competencia? Esta acción no se puede deshacer."
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

      <DeleteConfirmDialog
        isOpen={promoToDelete !== null}
        title="Eliminar promoción por zona"
        description={`¿Estás seguro de que deseas eliminar la promoción "${promoToDelete?.nombre}"?`}
        onConfirm={executeDeleteCompanyPromotion}
        onCancel={() => setPromoToDelete(null)}
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
    <Suspense fallback={<div className="min-h-screen bg-[#FDFDFD]" />}>
      <CompetenciaContent />
    </Suspense>
  );
}
