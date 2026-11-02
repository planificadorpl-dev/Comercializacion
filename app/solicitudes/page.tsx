"use client";

import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import {
  Menu,
  X,
  Send,
  MessageSquare,
  MapPin,
  Calendar,
  FileText,
  User,
  History,
  RotateCw,
} from "lucide-react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { SidebarOpenButton } from "@/components/providers/sidebar-provider";
import { useAsesor } from "@/components/providers/asesor-provider";
import { useUser } from "@/components/providers/user-provider";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { ToastPill } from "@/components/ui/toast-pill";
import { geoHierarchy } from "@/lib/geo_hierarchy";
import { getPlanes, getSolicitudes, saveSolicitud, deleteSolicitud } from "@/app/actions/ventas";
import { cn } from "@/lib/utils";

const FUENTES_CAPTACION = [
  "Vía Telefónica",
  "Recorrido Comercial",
  "Punto Fijo / Stand",
  "Visita Puerta a Puerta",
  "Referido",
  "Redes Sociales",
  "Reunión de Condominio",
  "Evento",
];

const CONTRATO_ANTERIOR_OPTIONS = ["NO", "SI"];
const ROUTER_OPTIONS = ["SI", "NO"];

function formatToDDMMYYYY(val: string | null | undefined): string {
  if (!val) return "";
  const clean = String(val).trim();
  const parts = clean.split(/[\/\-]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      const [y, m, d] = parts;
      return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
    } else {
      // DD-MM-YYYY or DD/MM/YYYY
      const [d, m, y] = parts;
      return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
    }
  }
  return clean;
}

function formatFullUbicacion({
  estado,
  municipio,
  parroquia,
  sector,
  direccion,
}: {
  estado?: string | null;
  municipio?: string | null;
  parroquia?: string | null;
  sector?: string | null;
  direccion?: string | null;
}): string {
  const geoParts: string[] = [];

  const est = (estado || "").trim();
  const mun = (municipio || "").trim();
  const par = (parroquia || "").trim();
  const sec = (sector || "").trim();
  const dir = (direccion || "").trim();

  if (est) geoParts.push(est);
  if (mun && mun.toLowerCase() !== est.toLowerCase()) geoParts.push(mun);
  if (
    par &&
    par.toLowerCase() !== mun.toLowerCase() &&
    par.toLowerCase() !== est.toLowerCase()
  ) {
    geoParts.push(par);
  }
  if (
    sec &&
    sec.toUpperCase() !== "N/A" &&
    sec.toLowerCase() !== par.toLowerCase()
  ) {
    geoParts.push(sec);
  }

  if (!dir || dir === "No especificada") {
    return geoParts.join(", ");
  }

  if (geoParts.length === 0) {
    return dir;
  }

  // Deduplicate parts if dir already contains them
  const dirLower = dir.toLowerCase();
  const missingParts = geoParts.filter(
    (p) => !dirLower.includes(p.toLowerCase())
  );

  if (missingParts.length === 0) {
    return dir;
  }

  return `${missingParts.join(", ")}, ${dir}`;
}

function buildWhatsAppSolicitudMessage(data: {
  fechaSolicitud?: string;
  fechaDisponibilidad?: string;
  nombreCompleto: string;
  cedula: string;
  telefonoPrincipal: string;
  telefonoSecundario?: string | null;
  ubicacion: string;
  tipoServicio: string;
  asesor: string;
  correo?: string | null;
  fechaNacimiento?: string | null;
  contratoAnterior?: string | null;
  fuente: string;
  router?: string | boolean | null;
  observaciones?: string | null;
}): string {
  const fSol = formatToDDMMYYYY(data.fechaSolicitud || new Date().toISOString().split("T")[0]);
  const fDisp = formatToDDMMYYYY(data.fechaDisponibilidad || data.fechaSolicitud || new Date().toISOString().split("T")[0]);
  const fNac = formatToDDMMYYYY(data.fechaNacimiento);
  const cleanCed = String(data.cedula || "").replace(/^[VEJGvejg]-/, "").trim();
  const rtr = (data.router && (data.router === "SI" || data.router === "si" || data.router === true)) ? "si" : "no";
  const cont = (data.contratoAnterior && String(data.contratoAnterior).toUpperCase() === "SI") ? "SI" : "NO";

  let msg = `Nueva Solicitud de Servicio\n\n`;
  msg += `Fecha de Solicitud: ${fSol}\n`;
  msg += `Disponibilidad: ${fDisp}\n`;
  msg += `Nombre y Apellido: ${data.nombreCompleto}\n`;
  msg += `Cédula/RIF: ${cleanCed || data.cedula}\n`;
  msg += `Contacto 1: ${data.telefonoPrincipal}\n`;
  msg += `Contacto 2: ${data.telefonoSecundario || ""}\n`;
  msg += `Ubicación: ${data.ubicacion}\n`;
  msg += `Tipo de Servicio: ${data.tipoServicio}\n`;
  msg += `Asesor: ${data.asesor}\n`;
  msg += `Correo: ${data.correo || ""}\n`;
  msg += `Fecha de Nacimiento: ${fNac}\n`;
  msg += `¿Posee contrato anterior?: ${cont}\n`;
  msg += `Fuente: ${data.fuente}\n`;
  msg += `Router: ${rtr}\n`;

  if (data.observaciones && data.observaciones.trim()) {
    msg += `Notas: ${data.observaciones.trim()}\n`;
  }

  return msg;
}

const TIPOS_SERVICIO = ["Domiciliario", "Empresarial"];
const CEDULA_PREFIXES = ["V-", "E-", "J-", "G-"];

type TabMode = "registro" | "historial";

// Client module-level cache for instant transitions
let cachedPlanesList: any[] = [
  { id: 1, nombre: "Fibra 100 Mbps", tipo: "Domiciliario", activo: true },
  { id: 2, nombre: "Fibra 200 Mbps", tipo: "Domiciliario", activo: true },
  { id: 3, nombre: "Fibra 300 Mbps + TV", tipo: "Domiciliario", activo: true },
  { id: 4, nombre: "Fibra 500 Mbps Corporativo", tipo: "Empresarial", activo: true },
];
let cachedSolicitudesHistory: any[] = [];
let hasInitialLoadedSolicitudes = false;

function SolicitudesContent() {
  const { currentAsesor, availableAsesores, setCurrentAsesor } = useAsesor();
  const { user, isAdmin } = useUser();
  const [selectedAsesor, setSelectedAsesor] = useState("");
  const [activeTab, setActiveTab] = useState<TabMode>("registro");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (currentAsesor) {
      setSelectedAsesor(currentAsesor);
    } else if (isAdmin && user?.nombre) {
      setSelectedAsesor(user.nombre);
    }
  }, [currentAsesor, isAdmin, user?.nombre]);

  // Form state
  const [fechaSolicitud, setFechaSolicitud] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [cedulaPrefix, setCedulaPrefix] = useState("V-");
  const [cedulaNumero, setCedulaNumero] = useState("");
  const [telefonoPrincipal, setTelefonoPrincipal] = useState("");
  const [telefonoSecundario, setTelefonoSecundario] = useState("");
  const [correo, setCorreo] = useState("");
  const [fechaDisponibilidad, setFechaDisponibilidad] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [fechaNacimiento, setFechaNacimiento] = useState("");

  // Geography cascade
  const [estado, setEstado] = useState("Miranda");
  const [municipio, setMunicipio] = useState("");
  const [parroquia, setParroquia] = useState("");
  const [sector, setSector] = useState("");
  const [direccion, setDireccion] = useState("");

  // Commercial service
  const [tipoServicio, setTipoServicio] = useState("Domiciliario");
  const [planesList, setPlanesList] = useState<any[]>(() => cachedPlanesList);
  const [planSeleccionado, setPlanSeleccionado] = useState("");
  const [contratoAnterior, setContratoAnterior] = useState("NO");
  const [router, setRouter] = useState("SI");
  const [fuente, setFuente] = useState(FUENTES_CAPTACION[0]);
  const [observaciones, setObservaciones] = useState("");

  const [saving, setSaving] = useState(false);

  // History state
  const [history, setHistory] = useState<any[]>(() => cachedSolicitudesHistory);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [solicitudToDelete, setSolicitudToDelete] = useState<string | null>(null);

  const [toastMsg, setToastMsg] = useState<{ text: string; type?: "success" | "error" } | null>(null);

  // Load available plans from Supabase or fallback
  useEffect(() => {
    getPlanes()
      .then((data) => {
        if (data && data.length > 0) {
          cachedPlanesList = data;
          setPlanesList(data);
        }
      })
      .catch(() => {});
  }, []);

  // Filter plans based on service type
  const availablePlanNames = useMemo(() => {
    return planesList
      .filter((p) => p.tipo.toLowerCase() === tipoServicio.toLowerCase() && p.activo !== false)
      .map((p) => p.nombre);
  }, [planesList, tipoServicio]);

  useEffect(() => {
    if (availablePlanNames.length > 0 && !availablePlanNames.includes(planSeleccionado)) {
      setPlanSeleccionado(availablePlanNames[0]);
    }
  }, [availablePlanNames, planSeleccionado]);

  // Geography options
  const estadosList = useMemo(() => Object.keys(geoHierarchy).sort(), []);
  const municipiosList = useMemo(() => {
    if (!estado || !geoHierarchy[estado]) return [];
    return Object.keys(geoHierarchy[estado]).sort();
  }, [estado]);
  const parroquiasList = useMemo(() => {
    if (!estado || !municipio || !geoHierarchy[estado]?.[municipio]) return [];
    return Object.keys(geoHierarchy[estado][municipio]).sort();
  }, [estado, municipio]);
  const sectoresList = useMemo(() => {
    if (!estado || !municipio || !parroquia || !geoHierarchy[estado]?.[municipio]?.[parroquia]) return [];
    return geoHierarchy[estado][municipio][parroquia].sort();
  }, [estado, municipio, parroquia]);

  // Fetch History
  const loadHistory = useCallback(async (silent = hasInitialLoadedSolicitudes) => {
    if (!silent) setLoadingHistory(true);
    try {
      const data = await getSolicitudes(currentAsesor ? { promotor: currentAsesor } : undefined);
      cachedSolicitudesHistory = data;
      hasInitialLoadedSolicitudes = true;
      setHistory(data);
    } catch {
      setToastMsg({ text: "Error al cargar historial de solicitudes", type: "error" });
    } finally {
      setLoadingHistory(false);
    }
  }, [currentAsesor]);

  useEffect(() => {
    if (activeTab === "historial") {
      loadHistory();
    }
  }, [activeTab, loadHistory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const effectiveAsesor = selectedAsesor || currentAsesor || (isAdmin ? (user?.nombre || "Administrador") : "");

    if (!effectiveAsesor) {
      setToastMsg({ text: "Debes seleccionar un asesor responsable de la solicitud", type: "error" });
      return;
    }
    if (!nombres.trim() || !apellidos.trim() || !cedulaNumero.trim() || !telefonoPrincipal.trim()) {
      setToastMsg({ text: "Completa los campos obligatorios del cliente", type: "error" });
      return;
    }

    setSaving(true);
    const cleanCedula = cedulaNumero.trim();
    const cedulaCompleta = `${cedulaPrefix}${cleanCedula}`;
    const nombreCompleto = `${nombres.trim()} ${apellidos.trim()}`;

    const fullUbicacion = formatFullUbicacion({
      estado,
      municipio,
      parroquia,
      sector,
      direccion,
    });

    const newSolicitud = {
      nombres: nombres.trim(),
      apellidos: apellidos.trim(),
      nombre_cliente: nombreCompleto,
      cedula: cedulaCompleta,
      genero: "No especificado",
      telefono_principal: telefonoPrincipal.trim(),
      telefono_secundario: telefonoSecundario.trim() || null,
      telefono: telefonoPrincipal.trim(),
      correo: correo.trim() || null,
      fecha_solicitud: fechaSolicitud,
      fecha_disponibilidad: fechaDisponibilidad,
      fecha_nacimiento: fechaNacimiento || null,
      contrato_anterior: contratoAnterior,
      power_go: router === "SI",
      estado,
      municipio,
      parroquia,
      sector: sector || null,
      direccion: direccion.trim() || "No especificada",
      ubicacion: fullUbicacion,
      tipo_servicio: tipoServicio,
      plan: planSeleccionado,
      tipo_operacion: "Instalación",
      fuente,
      promotor: effectiveAsesor,
      asesor_normalizado: effectiveAsesor,
      observaciones: observaciones.trim() || null,
      estatus: "Pendiente",
    };

    try {
      await saveSolicitud(newSolicitud);

      const msg = buildWhatsAppSolicitudMessage({
        fechaSolicitud,
        fechaDisponibilidad,
        nombreCompleto,
        cedula: cleanCedula,
        telefonoPrincipal: telefonoPrincipal.trim(),
        telefonoSecundario: telefonoSecundario.trim() || null,
        ubicacion: fullUbicacion,
        tipoServicio: planSeleccionado,
        asesor: effectiveAsesor,
        correo: correo.trim() || null,
        fechaNacimiento: fechaNacimiento || null,
        contratoAnterior,
        fuente,
        router,
        observaciones: observaciones.trim() || null,
      });

      setToastMsg({ text: "Solicitud registrada con éxito", type: "success" });

      // Reset form
      setNombres("");
      setApellidos("");
      setCedulaNumero("");
      setTelefonoPrincipal("");
      setTelefonoSecundario("");
      setCorreo("");
      setFechaNacimiento("");
      setDireccion("");
      setObservaciones("");
      setContratoAnterior("NO");
      setRouter("SI");

      // Open WhatsApp
      const waUrl = `https://wa.me/?text=${encodeURIComponent(msg)}`;
      window.open(waUrl, "_blank");
    } catch (err: any) {
      setToastMsg({ text: err.message || "Error al guardar la solicitud", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const executeDeleteSolicitud = async () => {
    if (!solicitudToDelete) return;
    try {
      await deleteSolicitud(solicitudToDelete);
      setHistory(history.filter((s) => s.id !== solicitudToDelete));
      setSolicitudToDelete(null);
      setToastMsg({ text: "Solicitud eliminada", type: "success" });
    } catch (err: any) {
      setToastMsg({ text: err.message || "Error al eliminar solicitud", type: "error" });
    }
  };

  return (
    <div className="flex min-h-screen bg-[#FDFDFD] text-neutral-900 font-sans antialiased selection:bg-neutral-900 selection:text-white">
      <Sidebar
        activeSection="solicitudes"
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
              Solicitudes de servicio
            </span>
          </div>
        </header>

        {/* Content Body */}
        <div className="p-3 sm:p-6 pb-20 xl:pb-6 max-w-4xl w-full mx-auto space-y-5 sm:space-y-6">
          {/* Sub Navigation Tabs */}
          <div className="flex items-center gap-4 sm:gap-6 border-b border-neutral-200 text-xs overflow-x-auto no-scrollbar scroll-smooth whitespace-nowrap -mx-3 px-3 sm:mx-0 sm:px-0">
            <button
              type="button"
              onClick={() => setActiveTab("registro")}
              className={cn(
                "min-h-[44px] py-2.5 transition-colors cursor-pointer flex items-center gap-2",
                activeTab === "registro"
                  ? "text-neutral-950 font-semibold border-b-2 border-neutral-950 -mb-[1px]"
                  : "text-neutral-500 hover:text-neutral-900"
              )}
            >
              <FileText className="w-3.5 h-3.5 stroke-[1.5]" />
              <span>Registro de solicitud</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("historial")}
              className={cn(
                "min-h-[44px] py-2.5 transition-colors cursor-pointer flex items-center gap-2",
                activeTab === "historial"
                  ? "text-neutral-950 font-semibold border-b-2 border-neutral-950 -mb-[1px]"
                  : "text-neutral-500 hover:text-neutral-900"
              )}
            >
              <History className="w-3.5 h-3.5 stroke-[1.5]" />
              <span>Historial registrado</span>
            </button>
          </div>

          {/* TAB 1: FORMULARIO */}
          {activeTab === "registro" && (
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Sección 1: Datos del Cliente */}
              <div className="space-y-4">
                <h2 className="text-xs font-semibold text-neutral-900 pb-2 border-b border-neutral-200">
                  1. Datos del cliente
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] text-neutral-500 block">Nombres</label>
                    <input
                      type="text"
                      value={nombres}
                      onChange={(e) => setNombres(e.target.value)}
                      placeholder="Ej: Carlos Eduardo"
                      className="w-full py-2 px-1 text-xs border-b border-neutral-200 focus:border-neutral-900 outline-none bg-transparent transition-colors text-neutral-900"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-neutral-500 block">Apellidos</label>
                    <input
                      type="text"
                      value={apellidos}
                      onChange={(e) => setApellidos(e.target.value)}
                      placeholder="Ej: Mendoza Pérez"
                      className="w-full py-2 px-1 text-xs border-b border-neutral-200 focus:border-neutral-900 outline-none bg-transparent transition-colors text-neutral-900"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1 sm:col-span-1">
                    <label className="text-[11px] text-neutral-500 block">Cédula o RIF</label>
                    <div className="flex items-center gap-1">
                      <div className="w-16 shrink-0">
                        <CustomDropdown
                          value={cedulaPrefix}
                          options={CEDULA_PREFIXES}
                          onChange={setCedulaPrefix}
                          compact
                        />
                      </div>
                      <input
                        type="text"
                        value={cedulaNumero}
                        onChange={(e) => setCedulaNumero(e.target.value.replace(/[^0-9]/g, ""))}
                        placeholder="12345678"
                        className="w-full py-2 px-1 text-xs border-b border-neutral-200 focus:border-neutral-900 outline-none bg-transparent transition-colors font-mono text-neutral-900"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-neutral-500 block">Teléfono principal</label>
                    <input
                      type="tel"
                      value={telefonoPrincipal}
                      onChange={(e) => setTelefonoPrincipal(e.target.value)}
                      placeholder="0414-1234567"
                      className="w-full py-2 px-1 text-xs border-b border-neutral-200 focus:border-neutral-900 outline-none bg-transparent transition-colors font-mono text-neutral-900"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-neutral-500 block">Teléfono secundario (opcional)</label>
                    <input
                      type="tel"
                      value={telefonoSecundario}
                      onChange={(e) => setTelefonoSecundario(e.target.value)}
                      placeholder="0412-7654321"
                      className="w-full py-2 px-1 text-xs border-b border-neutral-200 focus:border-neutral-900 outline-none bg-transparent transition-colors font-mono text-neutral-900"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-neutral-500 block">Correo electrónico (opcional)</label>
                  <input
                    type="email"
                    value={correo}
                    onChange={(e) => setCorreo(e.target.value)}
                    placeholder="cliente@gmail.com"
                    className="w-full py-2 px-1 text-xs border-b border-neutral-200 focus:border-neutral-900 outline-none bg-transparent transition-colors text-neutral-900"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] text-neutral-500 block">Fecha de solicitud</label>
                    <input
                      type="date"
                      value={fechaSolicitud}
                      onChange={(e) => setFechaSolicitud(e.target.value)}
                      className="w-full py-2 px-1 text-xs border-b border-neutral-200 focus:border-neutral-900 outline-none bg-transparent transition-colors text-neutral-900"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-neutral-500 block">Disponibilidad</label>
                    <input
                      type="date"
                      value={fechaDisponibilidad}
                      onChange={(e) => setFechaDisponibilidad(e.target.value)}
                      className="w-full py-2 px-1 text-xs border-b border-neutral-200 focus:border-neutral-900 outline-none bg-transparent transition-colors text-neutral-900"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-neutral-500 block">Fecha de nacimiento (opcional)</label>
                    <input
                      type="date"
                      value={fechaNacimiento}
                      onChange={(e) => setFechaNacimiento(e.target.value)}
                      className="w-full py-2 px-1 text-xs border-b border-neutral-200 focus:border-neutral-900 outline-none bg-transparent transition-colors text-neutral-900"
                    />
                  </div>
                </div>
              </div>

              {/* Sección 2: Ubicación Geográfica */}
              <div className="space-y-4">
                <h2 className="text-xs font-semibold text-neutral-900 pb-2 border-b border-neutral-200">
                  2. Dirección de instalación
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] text-neutral-500 block">Estado</label>
                    <CustomDropdown
                      value={estado}
                      options={estadosList}
                      onChange={(val) => {
                        setEstado(val);
                        setMunicipio("");
                        setParroquia("");
                        setSector("");
                      }}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-neutral-500 block">Municipio</label>
                    <CustomDropdown
                      value={municipio}
                      options={municipiosList}
                      onChange={(val) => {
                        setMunicipio(val);
                        setParroquia("");
                        setSector("");
                      }}
                      placeholder={estado ? "Seleccione municipio..." : "Elige un estado primero"}
                      disabled={!estado || municipiosList.length === 0}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-neutral-500 block">Parroquia</label>
                    <CustomDropdown
                      value={parroquia}
                      options={parroquiasList}
                      onChange={(val) => {
                        setParroquia(val);
                        setSector("");
                      }}
                      placeholder={municipio ? "Seleccione parroquia..." : "Elige un municipio primero"}
                      disabled={!municipio || parroquiasList.length === 0}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-neutral-500 block">Sector</label>
                    <CustomDropdown
                      value={sector}
                      options={sectoresList}
                      onChange={setSector}
                      placeholder={parroquia ? "Seleccione sector..." : "Elige una parroquia primero"}
                      disabled={!parroquia || sectoresList.length === 0}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-neutral-500 block">
                    Dirección detallada (Calle, edificio, piso, número de casa, punto de referencia)
                  </label>
                  <input
                    type="text"
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                    placeholder="Ej: Av. Bolívar, Res. Mirador, Torre A, Apto 4-B"
                    className="w-full py-2 px-1 text-xs border-b border-neutral-200 focus:border-neutral-900 outline-none bg-transparent transition-colors text-neutral-900"
                    required
                  />
                </div>
              </div>

              {/* Sección 3: Plan y Servicio */}
              <div className="space-y-4">
                <h2 className="text-xs font-semibold text-neutral-900 pb-2 border-b border-neutral-200">
                  3. Servicio comercial y condiciones
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] text-neutral-500 block">Tipo de servicio</label>
                    <CustomDropdown
                      value={tipoServicio}
                      options={TIPOS_SERVICIO}
                      onChange={setTipoServicio}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-neutral-500 block">Plan solicitado</label>
                    <CustomDropdown
                      value={planSeleccionado}
                      options={availablePlanNames}
                      onChange={setPlanSeleccionado}
                      placeholder="Seleccionar plan..."
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-neutral-500 block">¿Posee contrato anterior?</label>
                    <CustomDropdown
                      value={contratoAnterior}
                      options={CONTRATO_ANTERIOR_OPTIONS}
                      onChange={setContratoAnterior}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-neutral-500 block">Router</label>
                    <CustomDropdown
                      value={router}
                      options={ROUTER_OPTIONS}
                      onChange={setRouter}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] text-neutral-500 block">Fuente de captación</label>
                    <CustomDropdown
                      value={fuente}
                      options={FUENTES_CAPTACION}
                      onChange={setFuente}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-neutral-500 block">Asesor responsable</label>
                    {isAdmin ? (
                      <CustomDropdown
                        value={selectedAsesor || currentAsesor || user?.nombre || "Administrador"}
                        options={[
                          ...(user?.nombre ? [{ value: user.nombre, label: `${user.nombre} (Administrador)` }] : []),
                          ...availableAsesores.map((a) => ({ value: a, label: a })),
                        ]}
                        onChange={(val) => {
                          setSelectedAsesor(val);
                          setCurrentAsesor(val);
                        }}
                        placeholder="Seleccionar asesor..."
                      />
                    ) : (
                      <div className="py-2 px-1 text-xs font-semibold text-neutral-900 border-b border-neutral-200 truncate">
                        {currentAsesor || user?.nombre || "Asesor en sesión"}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-neutral-500 block">Notas y observaciones</label>
                  <textarea
                    rows={2}
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    placeholder="Comentarios sobre la instalación, router solicitado, etc..."
                    className="w-full py-2 px-1 text-xs border-b border-neutral-200 focus:border-neutral-900 outline-none bg-transparent transition-colors text-neutral-900 resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end text-xs pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-[44px] py-2.5 px-4 text-sm sm:text-xs text-neutral-900 hover:text-neutral-700 font-semibold transition-colors cursor-pointer w-full sm:w-auto text-center"
                >
                  {saving ? "Registrando..." : "Guardar y abrir en WhatsApp"}
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: HISTORIAL */}
          {activeTab === "historial" && (
            <div className="space-y-4">
              {loadingHistory ? (
                <div className="py-16 text-center text-xs text-neutral-400">
                  Cargando solicitudes registradas...
                </div>
              ) : history.length === 0 ? (
                <div className="py-16 text-center text-xs text-neutral-400">
                  No hay solicitudes registradas para este asesor.
                </div>
              ) : (
                <div className="divide-y divide-neutral-100 border-b border-neutral-100">
                  {history.map((sol) => {
                    const loc = [sol.estado, sol.municipio, sol.parroquia, sol.sector]
                      .filter(Boolean)
                      .join(", ");

                    return (
                      <div
                        key={sol.id}
                        className="group p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-neutral-50/60 transition-colors"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-neutral-900">
                              {sol.nombres} {sol.apellidos}
                            </span>
                            <span className="text-[11px] font-mono text-neutral-400">
                              {sol.cedula}
                            </span>
                            <span className="text-[11px] text-neutral-500">
                              · {sol.telefono_principal}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-neutral-500 flex-wrap">
                            <span>
                              <strong className="text-neutral-900">{sol.plan}</strong> ({sol.tipo_servicio})
                            </span>
                            {loc && <span className="text-neutral-400 truncate max-w-xs">{loc}</span>}
                            {sol.direccion && sol.direccion !== "No especificada" && (
                              <span className="text-neutral-400 truncate max-w-xs">· {sol.direccion}</span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 text-xs shrink-0 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => {
                              const fullUbicacion = formatFullUbicacion({
                                estado: sol.estado,
                                municipio: sol.municipio,
                                parroquia: sol.parroquia,
                                sector: sol.sector,
                                direccion: sol.direccion || sol.ubicacion,
                              });
                              const msg = buildWhatsAppSolicitudMessage({
                                fechaSolicitud: sol.fecha_solicitud || sol.created_at,
                                fechaDisponibilidad: sol.fecha_disponibilidad || sol.fecha_solicitud,
                                nombreCompleto: sol.nombre_cliente || `${sol.nombres || ""} ${sol.apellidos || ""}`.trim(),
                                cedula: sol.cedula,
                                telefonoPrincipal: sol.telefono_principal || sol.telefono || "",
                                telefonoSecundario: sol.telefono_secundario || "",
                                ubicacion: fullUbicacion,
                                tipoServicio: sol.plan || sol.tipo_servicio || "",
                                asesor: sol.promotor || sol.asesor_normalizado || "",
                                correo: sol.correo || "",
                                fechaNacimiento: sol.fecha_nacimiento || "",
                                contratoAnterior: sol.contrato_anterior || "NO",
                                fuente: sol.fuente || "",
                                router: (sol.power_go === true || String(sol.power_go).toUpperCase() === "SI") ? "SI" : "NO",
                                observaciones: sol.observaciones || "",
                              });
                              const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
                              window.open(url, "_blank");
                            }}
                            className="min-w-[40px] min-h-[40px] p-2 text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer flex items-center justify-center"
                            title="Reenviar por WhatsApp"
                            aria-label="Reenviar por WhatsApp"
                          >
                            <MessageSquare className="w-3.5 h-3.5 stroke-[1.5]" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setSolicitudToDelete(sol.id)}
                            className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-150 min-w-[40px] min-h-[40px] p-2 text-neutral-400 hover:text-neutral-900 cursor-pointer flex items-center justify-center"
                            title="Eliminar solicitud"
                            aria-label="Eliminar solicitud"
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
          )}
        </div>
      </main>

      {/* MODAL: ELIMINAR SOLICITUD */}
      <DeleteConfirmDialog
        isOpen={solicitudToDelete !== null}
        title="Eliminar solicitud"
        description="¿Estás seguro de que deseas eliminar este registro de solicitud?"
        onConfirm={executeDeleteSolicitud}
        onCancel={() => setSolicitudToDelete(null)}
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

export default function SolicitudesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#FDFDFD] text-xs font-mono text-neutral-400">
          Cargando módulo de solicitudes...
        </div>
      }
    >
      <SolicitudesContent />
    </Suspense>
  );
}
