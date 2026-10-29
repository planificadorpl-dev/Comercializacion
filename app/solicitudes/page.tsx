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
  "Recorrido Comercial",
  "Punto Fijo / Stand",
  "Visita Puerta a Puerta",
  "Referido",
  "Redes Sociales",
  "Llamada Telefónica",
  "Reunión de Condominio",
  "Evento",
];

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
    const cedulaCompleta = `${cedulaPrefix}${cedulaNumero.trim()}`;

    const newSolicitud = {
      nombres: nombres.trim(),
      apellidos: apellidos.trim(),
      cedula: cedulaCompleta,
      genero: "No especificado",
      telefono_principal: telefonoPrincipal.trim(),
      telefono_secundario: telefonoSecundario.trim() || null,
      correo: correo.trim() || null,
      fecha_disponibilidad: fechaDisponibilidad,
      estado,
      municipio,
      parroquia,
      sector: sector || null,
      direccion: direccion.trim() || "No especificada",
      tipo_servicio: tipoServicio,
      plan: planSeleccionado,
      fuente,
      promotor: effectiveAsesor,
      observaciones: observaciones.trim() || null,
    };

    try {
      await saveSolicitud(newSolicitud);

      // Construct WhatsApp message
      let msg = `*SOLICITUD DE SERVICIO - POWER LINK*\n\n`;
      msg += `*Cliente:* ${newSolicitud.nombres} ${newSolicitud.apellidos}\n`;
      msg += `*Cédula/RIF:* ${newSolicitud.cedula}\n`;
      msg += `*Teléfono:* ${newSolicitud.telefono_principal}\n`;
      if (newSolicitud.telefono_secundario) msg += `*Tel. Secundario:* ${newSolicitud.telefono_secundario}\n`;
      msg += `*Ubicación:* ${estado}, ${municipio}, ${parroquia}${sector ? `, ${sector}` : ""}\n`;
      msg += `*Dirección:* ${newSolicitud.direccion}\n`;
      msg += `*Servicio:* ${tipoServicio} - ${planSeleccionado}\n`;
      msg += `*Disponibilidad:* ${fechaDisponibilidad}\n`;
      msg += `*Fuente:* ${fuente}\n`;
      msg += `*Asesor:* ${effectiveAsesor}\n`;
      if (newSolicitud.observaciones) msg += `*Notas:* ${newSolicitud.observaciones}\n`;

      setToastMsg({ text: "Solicitud registrada con éxito", type: "success" });

      // Reset form
      setNombres("");
      setApellidos("");
      setCedulaNumero("");
      setTelefonoPrincipal("");
      setTelefonoSecundario("");
      setCorreo("");
      setDireccion("");
      setObservaciones("");

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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                  <div className="space-y-1">
                    <label className="text-[11px] text-neutral-500 block">Fecha estimada de disponibilidad</label>
                    <input
                      type="date"
                      value={fechaDisponibilidad}
                      onChange={(e) => setFechaDisponibilidad(e.target.value)}
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
                  3. Servicio comercial y fuente
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
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 text-xs shrink-0 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => {
                              let msg = `*SOLICITUD DE SERVICIO*\n\n`;
                              msg += `Cliente: ${sol.nombres} ${sol.apellidos}\n`;
                              msg += `Cédula: ${sol.cedula}\n`;
                              msg += `Teléfono: ${sol.telefono_principal}\n`;
                              msg += `Plan: ${sol.plan}\n`;
                              msg += `Ubicación: ${loc}\n`;
                              msg += `Dirección: ${sol.direccion}\n`;
                              msg += `Asesor: ${sol.promotor}\n`;
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
