"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { ChevronLeft, Plus, PenLine, X, Tv, Check } from "lucide-react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { SidebarOpenButton, SidebarMobileButton } from "@/components/providers/sidebar-provider";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { ToastPill } from "@/components/ui/toast-pill";
import { getPlanes, addPlan, updatePlan, deletePlan } from "@/app/actions/ventas";
import { cn } from "@/lib/utils";

const TIPOS_PLAN = ["Domiciliario", "Empresarial"];

// Client module-level cache for instant transitions
let cachedPlanesAdmin: any[] = [];
let hasLoadedPlanesAdmin = false;

function PlanesAdminContent() {
  const [planes, setPlanes] = useState<any[]>(() => cachedPlanesAdmin);
  const [loading, setLoading] = useState(!hasLoadedPlanesAdmin);

  // New plan modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formNombre, setFormNombre] = useState("");
  const [formTipo, setFormTipo] = useState("Domiciliario");
  const [formActivo, setFormActivo] = useState(true);
  const [formHasTv, setFormHasTv] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);

  // Delete modal
  const [planToDelete, setPlanToDelete] = useState<{ id: number; nombre: string } | null>(null);

  const [toastMsg, setToastMsg] = useState<{ text: string; type?: "success" | "error" } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData(silent = hasLoadedPlanesAdmin) {
    if (!silent) setLoading(true);
    try {
      const p = await getPlanes();
      cachedPlanesAdmin = p;
      hasLoadedPlanesAdmin = true;
      setPlanes(p);
    } catch {
      setToastMsg({ text: "Error al cargar los planes", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormNombre("");
    setFormTipo("Domiciliario");
    setFormActivo(true);
    setFormHasTv(false);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (plan: any) => {
    setEditingId(plan.id);
    setFormNombre(plan.nombre);
    setFormTipo(plan.tipo);
    setFormActivo(plan.activo ?? true);
    setFormHasTv(plan.has_tv ?? false);
    setIsModalOpen(true);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNombre.trim()) return;

    setSavingPlan(true);
    try {
      if (editingId) {
        await updatePlan(editingId, {
          nombre: formNombre.trim(),
          tipo: formTipo,
          activo: formActivo,
          has_tv: formHasTv,
        });
        setToastMsg({ text: "Plan actualizado correctamente", type: "success" });
      } else {
        await addPlan({
          nombre: formNombre.trim(),
          tipo: formTipo,
          activo: formActivo,
          has_tv: formHasTv,
        });
        setToastMsg({ text: "Plan registrado con éxito", type: "success" });
      }
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      setToastMsg({ text: err.message || "Error al guardar el plan", type: "error" });
    } finally {
      setSavingPlan(false);
    }
  };

  const executeDeletePlan = async () => {
    if (!planToDelete) return;
    try {
      await deletePlan(planToDelete.id);
      setPlanes(planes.filter((p) => p.id !== planToDelete.id));
      setPlanToDelete(null);
      setToastMsg({ text: "Plan eliminado", type: "success" });
    } catch (err: any) {
      setToastMsg({ text: err.message || "Error al eliminar plan", type: "error" });
    }
  };

  return (
    <div className="flex min-h-screen bg-[#FDFDFD] text-neutral-900 font-sans antialiased selection:bg-neutral-900 selection:text-white">
      <Sidebar activeSection="admin" />

      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-20 h-12 bg-white border-b border-neutral-200/80 px-4 sm:px-6 flex items-center justify-between select-none">
          <div className="flex items-center gap-3">
            <SidebarMobileButton />
            <SidebarOpenButton />
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900 transition-colors font-medium select-none"
              title="Volver a administración"
            >
              <ChevronLeft className="w-3.5 h-3.5 stroke-[2]" />
              <span>Volver a administración</span>
            </Link>
          </div>

          <div className="flex items-center">
            <span className="text-xs sm:text-sm font-normal text-neutral-700 tracking-tight font-sans">
              Gestión de planes
            </span>
          </div>
        </header>

        {/* Content */}
        <div className="p-4 sm:p-6 max-w-4xl w-full mx-auto space-y-6">
          <div className="flex items-center justify-between border-b border-neutral-200 pb-3 text-xs">
            <span className="text-neutral-500 font-medium">Planes registrados ({planes.length})</span>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="p-1 text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer select-none"
              title="Nuevo plan"
              aria-label="Nuevo plan"
            >
              <Plus className="w-4 h-4 stroke-[2]" />
            </button>
          </div>

          {loading ? (
            <div className="py-16 text-center text-xs text-neutral-400">
              Cargando planes de servicio...
            </div>
          ) : planes.length === 0 ? (
            <div className="py-16 text-center text-xs text-neutral-400 space-y-2">
              <p>No hay planes configurados en el sistema.</p>
              <button
                type="button"
                onClick={handleOpenCreate}
                className="text-neutral-900 hover:text-neutral-600 font-semibold cursor-pointer"
              >
                Crear primer plan
              </button>
            </div>
          ) : (
            <div className="divide-y divide-neutral-100 border-b border-neutral-100">
              {planes.map((plan) => (
                <div
                  key={plan.id}
                  className="group p-4 flex items-center justify-between gap-3 hover:bg-neutral-50/60 transition-colors text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-neutral-900">{plan.nombre}</span>
                      <span className="text-[11px] text-neutral-500">· {plan.tipo}</span>
                      {plan.has_tv && (
                        <span className="text-[11px] text-neutral-400">· Incluye TV</span>
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-[10px] block",
                        plan.activo !== false ? "text-neutral-400" : "text-neutral-400 italic"
                      )}
                    >
                      {plan.activo !== false ? "Activo para ventas" : "Inactivo"}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(plan)}
                      className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-150 text-neutral-400 hover:text-neutral-900 cursor-pointer p-1"
                      title="Editar plan"
                    >
                      <PenLine className="w-3.5 h-3.5 stroke-[1.25]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlanToDelete({ id: plan.id, nombre: plan.nombre })}
                      className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-150 text-neutral-400 hover:text-neutral-900 cursor-pointer p-1"
                      title="Eliminar plan"
                    >
                      <X className="w-3.5 h-3.5 stroke-[1.5]" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* MODAL: CREAR / EDITAR PLAN */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/40 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => !savingPlan && setIsModalOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-xl shadow-2xl border border-neutral-200/90 p-5 space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-900 tracking-tight">
                {editingId ? "Editar plan" : "Nuevo plan comercial"}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4 stroke-[1.5]" />
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] text-neutral-500 block">Nombre del plan</label>
                <input
                  type="text"
                  value={formNombre}
                  onChange={(e) => setFormNombre(e.target.value)}
                  placeholder="Ej: Fibra 200 Mbps"
                  className="w-full py-1.5 px-1 border-b border-neutral-200 focus:border-neutral-900 outline-none bg-transparent transition-colors text-neutral-900"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-neutral-500 block">Tipo de plan</label>
                <CustomDropdown
                  value={formTipo}
                  options={TIPOS_PLAN}
                  onChange={setFormTipo}
                  compact
                />
              </div>

              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-neutral-700">
                  <input
                    type="checkbox"
                    checked={formHasTv}
                    onChange={(e) => setFormHasTv(e.target.checked)}
                    className="rounded border-neutral-300 text-neutral-900 focus:ring-0"
                  />
                  <span>Incluye servicio de TV / Streaming</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-neutral-700">
                  <input
                    type="checkbox"
                    checked={formActivo}
                    onChange={(e) => setFormActivo(e.target.checked)}
                    className="rounded border-neutral-300 text-neutral-900 focus:ring-0"
                  />
                  <span>Plan activo en formularios de venta</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 text-xs">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingPlan}
                  className="text-neutral-900 hover:text-neutral-700 font-semibold transition-colors cursor-pointer"
                >
                  {savingPlan ? "Guardando..." : editingId ? "Actualizar" : "Crear plan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ELIMINAR PLAN */}
      <DeleteConfirmDialog
        isOpen={planToDelete !== null}
        title="Eliminar plan"
        itemName={planToDelete?.nombre}
        description={`¿Estás seguro de que deseas eliminar el plan "${planToDelete?.nombre}" del catálogo?`}
        onConfirm={executeDeletePlan}
        onCancel={() => setPlanToDelete(null)}
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

export default function PlanesAdminPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#FDFDFD] text-xs font-mono text-neutral-400">
          Cargando configuración de planes...
        </div>
      }
    >
      <PlanesAdminContent />
    </Suspense>
  );
}
