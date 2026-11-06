"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  FilePlus,
  Save,
} from "lucide-react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { SidebarOpenButton, SidebarMobileButton } from "@/components/providers/sidebar-provider";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { ToastPill } from "@/components/ui/toast-pill";
import { geoHierarchy } from "@/lib/geo_hierarchy";
import { useAsesor } from "@/components/providers/asesor-provider";
import { useUser } from "@/components/providers/user-provider";
import { cn } from "@/lib/utils";

// Exact 7 activity types from the original datapl project
const TIPOS_ACTIVIDAD = [
  { value: "Visita a Condominio", label: "Visita a Condominio" },
  { value: "Recorrido (Solo)", label: "Recorrido (Solo)" },
  { value: "Recorrido con Instaladores", label: "Recorrido con Instaladores" },
  { value: "Recorrido con Distribución", label: "Recorrido con Distribución" },
  { value: "Stand Publicitario", label: "Stand Publicitario" },
  { value: "Iglu Publicitario", label: "Iglu Publicitario" },
  { value: "Caravana", label: "Caravana" },
];

function NuevaActividadContent() {
  const router = useRouter();
  const { currentAsesor, setCurrentAsesor, availableAsesores } = useAsesor();
  const { user, isAdmin } = useUser();

  const [addedCount, setAddedCount] = useState(0);

  const [formData, setFormData] = useState({
    time: "",
    type: "",
    receivedCalls: false,
    phoneInfo: "",
    phoneAgenda: "",
    condominio: "",
    captados: "",
    solicitudes: "",
    volantes: "",
    estado: "",
    municipio: "",
    parroquia: "",
    sector: "",
    notes: "",
  });

  const [toastMsg, setToastMsg] = useState<{ text: string; type?: "success" | "error" } | null>(null);

  // Set time on mount in es-VE format (e.g. 03:45 p. m.)
  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      time: new Date().toLocaleTimeString("es-VE", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }),
    }));
  }, []);

  // Derived Geo Options (exact cascading logic from datapl)
  const estados = useMemo(() => Object.keys(geoHierarchy).sort(), []);

  const municipios = useMemo(() => {
    if (!formData.estado || !geoHierarchy[formData.estado as keyof typeof geoHierarchy]) return [];
    return Object.keys(geoHierarchy[formData.estado as keyof typeof geoHierarchy] || {}).sort();
  }, [formData.estado]);

  const parroquias = useMemo(() => {
    if (!formData.estado || !formData.municipio) return [];
    const obj = (geoHierarchy[formData.estado as keyof typeof geoHierarchy] as any)?.[formData.municipio];
    return obj ? Object.keys(obj).sort() : [];
  }, [formData.estado, formData.municipio]);

  const sectores = useMemo(() => {
    if (!formData.estado || !formData.municipio || !formData.parroquia) return [];
    const arr = (geoHierarchy[formData.estado as keyof typeof geoHierarchy] as any)?.[formData.municipio]?.[formData.parroquia];
    return Array.isArray(arr) ? arr.sort() : [];
  }, [formData.estado, formData.municipio, formData.parroquia]);

  const handleStateChange = (val: string) => {
    setFormData((prev) => ({ ...prev, estado: val, municipio: "", parroquia: "", sector: "" }));
  };

  const handleMunicipioChange = (val: string) => {
    setFormData((prev) => ({ ...prev, municipio: val, parroquia: "", sector: "" }));
  };

  const handleParroquiaChange = (val: string) => {
    setFormData((prev) => ({ ...prev, parroquia: val, sector: "" }));
  };

  const handleSectorChange = (val: string) => {
    setFormData((prev) => ({ ...prev, sector: val }));
  };

  // Submit handling with exact validation & duplicate prevention from datapl
  const handleSubmit = (action: "save_return" | "add_another") => {
    const effectiveAsesor = currentAsesor || (isAdmin ? (user?.nombre || "Administrador") : "");
    if (!effectiveAsesor) {
      setToastMsg({
        text: "Debe seleccionar un Asesor para la actividad.",
        type: "error",
      });
      return;
    }
    if (!currentAsesor && effectiveAsesor) {
      setCurrentAsesor(effectiveAsesor);
    }

    if (!formData.type) {
      setToastMsg({ text: "Seleccione un Tipo de Actividad", type: "error" });
      return;
    }

    if (!formData.estado || !formData.municipio || !formData.parroquia || !formData.sector) {
      setToastMsg({ text: "Por favor complete toda la Ubicación de Actividad", type: "error" });
      return;
    }

    if (formData.type === "Visita a Condominio" && !formData.condominio.trim()) {
      setToastMsg({ text: "El Nombre del Condominio es obligatorio para esta actividad", type: "error" });
      return;
    }

    if (
      formData.captados === "" ||
      formData.captados === undefined ||
      formData.volantes === "" ||
      formData.volantes === undefined ||
      formData.solicitudes === "" ||
      formData.solicitudes === undefined
    ) {
      setToastMsg({
        text: "Debe rellenar los campos de Ventas (Solicitudes), Captados y Volantes Entregados",
        type: "error",
      });
      return;
    }

    const activity = {
      uid: "act_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      time: formData.time,
      date: new Date().toLocaleDateString("es-VE"),
      asesor: currentAsesor,
      activityType: formData.type,
      ubicaciones: {
        estado: formData.estado,
        municipio: formData.municipio,
        parroquia: formData.parroquia,
        sector: formData.sector,
      },
      estado: formData.estado,
      municipio: formData.municipio,
      parroquia: formData.parroquia,
      sector: formData.sector,
      clientesCaptados: Number(formData.captados) || 0,
      solicitudes: Number(formData.solicitudes) || 0,
      condominio: formData.condominio || "",
      volantes: Number(formData.volantes) || 0,
      receivedCalls: formData.receivedCalls,
      llamadasInfo: Number(formData.phoneInfo) || 0,
      llamadasAgenda: Number(formData.phoneAgenda) || 0,
      notes: formData.notes.trim(),
    };

    // Duplicate check in same sector (exact same logic as original datapl)
    let saved: any[] = [];
    try {
      const stored = localStorage.getItem("appState_activities");
      if (stored) saved = JSON.parse(stored);
    } catch (e) {}

    const isDuplicate = saved.some(
      (act: any) =>
        act.activityType === formData.type &&
        act.ubicaciones?.parroquia === formData.parroquia &&
        act.ubicaciones?.sector === formData.sector &&
        act.ubicaciones?.sector !== "N/A"
    );

    if (isDuplicate) {
      setToastMsg({
        text: `Ya registraste "${formData.type}" en: ${formData.parroquia} – ${formData.sector}.`,
        type: "error",
      });
      return;
    }

    saved.push(activity);
    try {
      localStorage.setItem("appState_activities", JSON.stringify(saved));
    } catch {
      setToastMsg({ text: "Error al guardar en almacenamiento local", type: "error" });
      return;
    }

    if (action === "save_return") {
      router.push("/actividades");
    } else {
      setAddedCount((prev) => prev + 1);
      setToastMsg({ text: "Actividad añadida a la jornada", type: "success" });

      // Reset form preserving time in es-VE
      setFormData((prev) => ({
        ...prev,
        type: "",
        receivedCalls: false,
        phoneInfo: "",
        phoneAgenda: "",
        condominio: "",
        captados: "",
        solicitudes: "",
        volantes: "",
        estado: "",
        municipio: "",
        parroquia: "",
        sector: "",
        notes: "",
        time: new Date().toLocaleTimeString("es-VE", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }),
      }));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div className="flex min-h-screen bg-[#FDFDFD] text-neutral-900 font-sans antialiased selection:bg-neutral-900 selection:text-white">
      <Sidebar activeSection="actividades" />

      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-20 h-12 bg-white border-b border-neutral-200/80 px-4 sm:px-6 flex items-center justify-between select-none">
          <div className="flex items-center gap-3">
            <SidebarMobileButton />
            <SidebarOpenButton />
            <Link
              href="/actividades"
              className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900 transition-colors font-medium select-none"
              title="Volver a actividades"
            >
              <ChevronLeft className="w-3.5 h-3.5 stroke-[2]" />
              <span>Volver a actividades</span>
            </Link>
          </div>

          <div className="flex items-center">
            <span className="text-xs sm:text-sm font-normal text-neutral-700 tracking-tight font-sans">
              Nueva actividad
            </span>
          </div>
        </header>

        {/* Content Body */}
        <div className="p-4 sm:p-6 max-w-2xl w-full mx-auto space-y-6">
          {/* Added count indicator */}
          {addedCount > 0 && (
            <div className="py-2.5 flex items-center justify-between border-b border-neutral-100 text-xs animate-in fade-in duration-150">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                <span className="font-semibold text-neutral-900">
                  {addedCount} actividad{addedCount > 1 ? "es" : ""} añadida{addedCount > 1 ? "s" : ""}
                </span>
                <span className="text-neutral-400">· Lista para cerrar al finalizar el día</span>
              </div>
              <Link
                href="/actividades"
                className="text-neutral-500 hover:text-neutral-900 font-medium transition-colors"
              >
                Ver jornada
              </Link>
            </div>
          )}

          {/* BLOCK 1: INFORMACIÓN GENERAL */}
          <div className="space-y-2">
            <div>
              <h2 className="text-xs font-semibold text-neutral-900 font-sans tracking-tight">
                Información general
              </h2>
              <p className="text-[11px] text-neutral-400 font-sans mt-0.5">
                Hora del reporte, asesor en turno y tipo de despliegue operativo
              </p>
            </div>

            <div className="divide-y divide-neutral-100 border-b border-neutral-100 text-xs relative z-20">
              <div className="py-3 flex items-center justify-between">
                <span className="text-neutral-500 font-medium flex items-center gap-1.5">
                  Hora del reporte
                </span>
                <span className="font-mono text-neutral-900 font-semibold">{formData.time}</span>
              </div>

              <div className="py-3 flex items-center justify-between">
                <span className="text-neutral-500 font-medium flex items-center gap-1.5">
                  Asesor en turno
                </span>
                {isAdmin ? (
                  <div className="w-56">
                    <CustomDropdown
                      value={currentAsesor || user?.nombre || "Administrador"}
                      options={[
                        ...(user?.nombre ? [{ value: user.nombre, label: `${user.nombre} (Administrador)` }] : []),
                        ...availableAsesores.map((a) => ({ value: a, label: a })),
                      ]}
                      onChange={(v) => setCurrentAsesor(v)}
                      placeholder="Seleccionar asesor..."
                    />
                  </div>
                ) : currentAsesor ? (
                  <span className="font-semibold text-neutral-900">
                    {currentAsesor}
                  </span>
                ) : (
                  <div className="w-48">
                    <CustomDropdown
                      value={currentAsesor}
                      options={availableAsesores}
                      onChange={(v) => setCurrentAsesor(v)}
                      placeholder="Seleccionar asesor..."
                    />
                  </div>
                )}
              </div>

              <div className="py-3 space-y-1.5">
                <label className="text-neutral-500 font-medium block">
                  Tipo de actividad
                </label>
                <CustomDropdown
                  value={formData.type}
                  options={TIPOS_ACTIVIDAD}
                  onChange={(v) => setFormData((p) => ({ ...p, type: v }))}
                  placeholder="Selecciona el tipo de actividad..."
                />
              </div>
            </div>
          </div>

          {/* PROGRESSIVE DISCLOSURE: THE REST ONLY SHOWS IF TYPE IS SELECTED */}
          {formData.type && (
            <div className="space-y-6 tab-enter-animation">
              {/* BLOCK 2: MÉTRICAS DEL REPORTE */}
              <div className="space-y-2 stagger-1">
                <div>
                  <h2 className="text-xs font-semibold text-neutral-900 font-sans tracking-tight">
                    Métricas del reporte
                  </h2>
                  <p className="text-[11px] text-neutral-400 font-sans mt-0.5">
                    Contactos telefónicos, ventas, prospectos y volantes entregados
                  </p>
                </div>

                <div className="divide-y divide-neutral-100 border-b border-neutral-100 text-xs">
                  {/* Contacto telefónico switch */}
                  <div className="py-3 flex items-center justify-between">
                    <div>
                      <span className="font-medium text-neutral-900 block">Contacto telefónico</span>
                      <span className="text-[11px] text-neutral-400 block font-sans">
                        ¿Recibiste llamadas durante la actividad?
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setFormData((p) => ({
                          ...p,
                          receivedCalls: !p.receivedCalls,
                          phoneInfo: !p.receivedCalls ? p.phoneInfo : "",
                          phoneAgenda: !p.receivedCalls ? p.phoneAgenda : "",
                        }))
                      }
                      className={cn(
                        "text-xs transition-colors cursor-pointer select-none flex items-center gap-1.5 font-medium",
                        formData.receivedCalls
                          ? "text-neutral-950 font-bold"
                          : "text-neutral-400 hover:text-neutral-700"
                      )}
                    >
                      <span>{formData.receivedCalls ? "Sí" : "No"}</span>
                      <span
                        className={cn(
                          "w-1.5 h-1.5 rounded-full transition-colors",
                          formData.receivedCalls ? "bg-emerald-600" : "bg-neutral-300"
                        )}
                      />
                    </button>
                  </div>

                  {/* Sub-inputs when receivedCalls is active */}
                  {formData.receivedCalls && (
                    <div className="py-3 grid grid-cols-2 gap-6 animate-in fade-in duration-100">
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-neutral-500 block">
                          Solo información
                        </label>
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={formData.phoneInfo}
                          onChange={(e) => setFormData((p) => ({ ...p, phoneInfo: e.target.value }))}
                          className="w-full bg-transparent border-b border-neutral-200 hover:border-neutral-400 py-1.5 text-xs font-mono text-neutral-900 focus:outline-none focus:border-neutral-900 transition-colors"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-neutral-500 block">
                          Agendados
                        </label>
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={formData.phoneAgenda}
                          onChange={(e) => setFormData((p) => ({ ...p, phoneAgenda: e.target.value }))}
                          className="w-full bg-transparent border-b border-neutral-200 hover:border-neutral-400 py-1.5 text-xs font-mono text-neutral-900 focus:outline-none focus:border-neutral-900 transition-colors"
                        />
                      </div>
                    </div>
                  )}

                  {/* Conditional Condominio input (Mandatory for Visita a Condominio) */}
                  {formData.type === "Visita a Condominio" && (
                    <div className="py-3 space-y-1">
                      <label className="text-neutral-600 font-medium block">
                        Nombre del condominio <span className="text-neutral-400 text-[11px] font-normal">(Obligatorio)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Ej. Res. Las Rosas"
                        value={formData.condominio}
                        onChange={(e) => setFormData((p) => ({ ...p, condominio: e.target.value }))}
                        className="w-full bg-transparent border-b border-neutral-200 hover:border-neutral-400 py-1.5 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900 transition-colors"
                      />
                    </div>
                  )}

                  {/* Quantitative Metrics Grid */}
                  <div className="py-3 grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div className="space-y-1">
                      <label className="text-neutral-600 font-medium block">
                        Ventas (Solicitudes)
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={formData.solicitudes}
                        onChange={(e) => setFormData((p) => ({ ...p, solicitudes: e.target.value }))}
                        className="w-full bg-transparent border-b border-neutral-200 hover:border-neutral-400 py-2 text-sm sm:text-xs font-mono text-neutral-900 focus:outline-none focus:border-neutral-900 transition-colors"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-neutral-600 font-medium block">
                        Captados
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={formData.captados}
                        onChange={(e) => setFormData((p) => ({ ...p, captados: e.target.value }))}
                        className="w-full bg-transparent border-b border-neutral-200 hover:border-neutral-400 py-2 text-sm sm:text-xs font-mono text-neutral-900 focus:outline-none focus:border-neutral-900 transition-colors"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-neutral-600 font-medium block">
                        Volantes entregados
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={formData.volantes}
                        onChange={(e) => setFormData((p) => ({ ...p, volantes: e.target.value }))}
                        className="w-full bg-transparent border-b border-neutral-200 hover:border-neutral-400 py-2 text-sm sm:text-xs font-mono text-neutral-900 focus:outline-none focus:border-neutral-900 transition-colors"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* BLOCK 3: UBICACIÓN DE ACTIVIDAD (Cascading selectors) */}
              <div className="space-y-2 stagger-2">
                <div>
                  <h2 className="text-xs font-semibold text-neutral-900 font-sans tracking-tight">
                    Ubicación de actividad
                  </h2>
                  <p className="text-[11px] text-neutral-400 font-sans mt-0.5">
                    Selección en cascada por Estado, Municipio, Parroquia y Sector
                  </p>
                </div>

                <div className="py-2 space-y-4 text-xs border-b border-neutral-100 pb-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div className="space-y-1">
                      <label className="text-neutral-500 font-medium block">Estado</label>
                      <CustomDropdown
                        value={formData.estado}
                        options={estados}
                        onChange={handleStateChange}
                        placeholder="Selecciona estado..."
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-neutral-500 font-medium block">Municipio</label>
                      <CustomDropdown
                        value={formData.municipio}
                        options={municipios}
                        onChange={handleMunicipioChange}
                        placeholder="Selecciona municipio..."
                        disabled={!formData.estado}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 pt-1">
                    <div className="space-y-1">
                      <label className="text-neutral-500 font-medium block">Parroquia</label>
                      <CustomDropdown
                        value={formData.parroquia}
                        options={parroquias}
                        onChange={handleParroquiaChange}
                        placeholder="Selecciona parroquia..."
                        disabled={!formData.municipio}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-neutral-500 font-medium block">Sector</label>
                      <CustomDropdown
                        value={formData.sector}
                        options={sectores}
                        onChange={handleSectorChange}
                        placeholder="Selecciona sector..."
                        disabled={!formData.parroquia}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* BLOCK 4: OBSERVACIONES */}
              <div className="space-y-2 stagger-3">
                <div>
                  <h2 className="text-xs font-semibold text-neutral-900 font-sans tracking-tight">
                    Observaciones
                  </h2>
                  <p className="text-[11px] text-neutral-400 font-sans mt-0.5">
                    Detalles, incidencias u oportunidades detectadas en el terreno
                  </p>
                </div>

                <div className="py-2 text-xs border-b border-neutral-100 pb-4">
                  <textarea
                    rows={3}
                    placeholder="Detalles o incidencias del recorrido..."
                    value={formData.notes}
                    onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
                    className="w-full bg-transparent border-b border-neutral-200 hover:border-neutral-400 py-1.5 resize-none text-sm sm:text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900 transition-colors"
                  />
                </div>
              </div>

              {/* BLOCK 5: ACCIONES */}
              <div className="pt-4 pb-12 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 sm:gap-6">
                <button
                  type="button"
                  onClick={() => handleSubmit("add_another")}
                  className="min-h-[44px] inline-flex items-center justify-center sm:justify-start gap-2 text-xs font-medium text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer select-none py-2.5 px-3"
                >
                  <FilePlus className="w-3.5 h-3.5 stroke-[1.5]" />
                  <span>Añadir otra actividad</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSubmit("save_return")}
                  className="min-h-[44px] inline-flex items-center justify-center sm:justify-start gap-2 text-xs font-semibold text-neutral-900 hover:text-neutral-600 transition-colors cursor-pointer select-none py-2.5 px-3"
                >
                  <Save className="w-3.5 h-3.5 stroke-[1.75]" />
                  <span>Guardar actividad</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* TOAST NOTIFICATION */}
      <ToastPill
        message={toastMsg?.text || null}
        type={toastMsg?.type || "success"}
        onClose={() => setToastMsg(null)}
      />
    </div>
  );
}

export default function NuevaActividadPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#FDFDFD] text-xs font-mono text-neutral-400">
          Cargando formulario de actividad...
        </div>
      }
    >
      <NuevaActividadContent />
    </Suspense>
  );
}
