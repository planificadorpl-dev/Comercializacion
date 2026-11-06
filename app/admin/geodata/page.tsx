"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { ChevronLeft, Plus, X, MapPin, ChevronRight, RotateCw } from "lucide-react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { SidebarOpenButton, SidebarMobileButton } from "@/components/providers/sidebar-provider";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { ToastPill } from "@/components/ui/toast-pill";
import { createClient } from "@/lib/supabase/client";
import { addGeodata, deleteGeodata, syncGeodataFromSheets } from "@/app/actions/ventas";
import { geoHierarchy as defaultGeoHierarchy } from "@/lib/geo_hierarchy";
import { cn } from "@/lib/utils";

// Client module-level cache for instant transitions
let cachedGeodata: any[] = [];
let hasLoadedGeodata = false;

function GeodataAdminContent() {
  const [geodata, setGeodata] = useState<any[]>(() => cachedGeodata);
  const [loading, setLoading] = useState(!hasLoadedGeodata);
  const [syncingSheets, setSyncingSheets] = useState(false);

  // Active navigation
  const [selectedEstado, setSelectedEstado] = useState("Miranda");
  const [selectedMunicipio, setSelectedMunicipio] = useState("");
  const [selectedParroquia, setSelectedParroquia] = useState("");

  // New item modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newSectorName, setNewSectorName] = useState("");
  const [savingItem, setSavingItem] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<any | null>(null);

  const [toastMsg, setToastMsg] = useState<{ text: string; type?: "success" | "error" } | null>(null);

  async function handleSyncSheets() {
    setSyncingSheets(true);
    try {
      const res = await syncGeodataFromSheets();
      if (res.success) {
        setToastMsg({ text: res.message, type: "success" });
        await loadGeodata(false);
      } else {
        setToastMsg({ text: res.message, type: "error" });
      }
    } catch (err: any) {
      setToastMsg({ text: err.message || "Error al sincronizar con Google Sheets", type: "error" });
    } finally {
      setSyncingSheets(false);
    }
  }

  useEffect(() => {
    loadGeodata();
  }, []);

  async function loadGeodata(silent = hasLoadedGeodata) {
    if (!silent) setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("geodata_config")
        .select("*")
        .order("estado")
        .order("municipio")
        .order("parroquia")
        .order("sector");

      if (error || !data || data.length === 0) {
        // Fallback to flatten defaultGeoHierarchy
        const flattened: any[] = [];
        let tempId = 1;
        Object.keys(defaultGeoHierarchy).forEach((est) => {
          Object.keys(defaultGeoHierarchy[est]).forEach((mun) => {
            Object.keys(defaultGeoHierarchy[est][mun]).forEach((parr) => {
              defaultGeoHierarchy[est][mun][parr].forEach((sec) => {
                flattened.push({
                  id: `local_${tempId++}`,
                  estado: est,
                  municipio: mun,
                  parroquia: parr,
                  sector: sec,
                });
              });
            });
          });
        });
        cachedGeodata = flattened;
        hasLoadedGeodata = true;
        setGeodata(flattened);
      } else {
        cachedGeodata = data;
        hasLoadedGeodata = true;
        setGeodata(data);
      }
    } catch {
      setToastMsg({ text: "Error cargando localidades", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  // Hierarchy levels derived from geodata
  const estadosList = useMemo(() => {
    return Array.from(new Set(geodata.map((g) => g.estado))).filter(Boolean).sort();
  }, [geodata]);

  const municipiosList = useMemo(() => {
    return Array.from(
      new Set(
        geodata
          .filter((g) => g.estado === selectedEstado)
          .map((g) => g.municipio)
      )
    )
      .filter(Boolean)
      .sort();
  }, [geodata, selectedEstado]);

  const parroquiasList = useMemo(() => {
    return Array.from(
      new Set(
        geodata
          .filter(
            (g) => g.estado === selectedEstado && g.municipio === selectedMunicipio
          )
          .map((g) => g.parroquia)
      )
    )
      .filter(Boolean)
      .sort();
  }, [geodata, selectedEstado, selectedMunicipio]);

  const sectoresList = useMemo(() => {
    return geodata.filter(
      (g) =>
        g.estado === selectedEstado &&
        g.municipio === selectedMunicipio &&
        g.parroquia === selectedParroquia
    );
  }, [geodata, selectedEstado, selectedMunicipio, selectedParroquia]);

  // Set default selections once data is ready
  useEffect(() => {
    if (estadosList.length > 0 && !estadosList.includes(selectedEstado)) {
      setSelectedEstado(estadosList[0]);
    }
  }, [estadosList, selectedEstado]);

  useEffect(() => {
    if (municipiosList.length > 0 && !municipiosList.includes(selectedMunicipio)) {
      setSelectedMunicipio(municipiosList[0]);
    }
  }, [municipiosList, selectedMunicipio]);

  useEffect(() => {
    if (parroquiasList.length > 0 && !parroquiasList.includes(selectedParroquia)) {
      setSelectedParroquia(parroquiasList[0]);
    }
  }, [parroquiasList, selectedParroquia]);

  const handleAddSector = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSectorName.trim() || !selectedEstado || !selectedMunicipio || !selectedParroquia) {
      return;
    }

    setSavingItem(true);
    try {
      await addGeodata({
        estado: selectedEstado,
        municipio: selectedMunicipio,
        parroquia: selectedParroquia,
        sector: newSectorName.trim(),
      });
      setNewSectorName("");
      setIsAddModalOpen(false);
      setToastMsg({ text: "Sector añadido correctamente", type: "success" });
      await loadGeodata();
    } catch (err: any) {
      setToastMsg({ text: err.message || "Error al añadir sector", type: "error" });
    } finally {
      setSavingItem(false);
    }
  };

  const executeDeleteItem = async () => {
    if (!itemToDelete) return;
    try {
      if (typeof itemToDelete.id === "string" && itemToDelete.id.startsWith("local_")) {
        setGeodata(geodata.filter((g) => g.id !== itemToDelete.id));
      } else {
        await deleteGeodata(itemToDelete.id);
        setGeodata(geodata.filter((g) => g.id !== itemToDelete.id));
      }
      setItemToDelete(null);
      setToastMsg({ text: "Registro eliminado", type: "success" });
    } catch (err: any) {
      setToastMsg({ text: err.message || "Error al eliminar localidad", type: "error" });
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
              Geodata y sectores
            </span>
          </div>
        </header>

        {/* Content */}
        <div className="p-4 sm:p-6 max-w-4xl w-full mx-auto space-y-6">
          {/* Breadcrumb Filter Cascade */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-4 border-b border-neutral-200 text-xs">
            <div className="space-y-1">
              <label className="text-[11px] text-neutral-400 block">1. Estado</label>
              <CustomDropdown
                value={selectedEstado}
                options={estadosList}
                onChange={(val) => {
                  setSelectedEstado(val);
                  setSelectedMunicipio("");
                  setSelectedParroquia("");
                }}
                compact
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-neutral-400 block">2. Municipio</label>
              <CustomDropdown
                value={selectedMunicipio}
                options={municipiosList}
                onChange={(val) => {
                  setSelectedMunicipio(val);
                  setSelectedParroquia("");
                }}
                compact
                disabled={municipiosList.length === 0}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-neutral-400 block">3. Parroquia</label>
              <CustomDropdown
                value={selectedParroquia}
                options={parroquiasList}
                onChange={setSelectedParroquia}
                compact
                disabled={parroquiasList.length === 0}
              />
            </div>
          </div>

          {/* Sectores List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-500 font-medium">
                Sectores en {selectedParroquia || "la zona"} ({sectoresList.length})
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSyncSheets}
                  disabled={syncingSheets || loading}
                  className="p-1 text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer disabled:opacity-40 select-none"
                  title="Sincronizar sectores con Google Sheets"
                  aria-label="Sincronizar sectores con Google Sheets"
                >
                  <RotateCw className={cn("w-4 h-4 stroke-[1.75]", syncingSheets && "animate-spin text-neutral-900")} />
                </button>

                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  disabled={!selectedParroquia}
                  className="p-1 text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer disabled:opacity-40 select-none"
                  title="Añadir nuevo sector"
                  aria-label="Añadir nuevo sector"
                >
                  <Plus className="w-4 h-4 stroke-[2]" />
                </button>
              </div>
            </div>

            {loading ? (
              <div className="py-16 text-center text-xs text-neutral-400">
                Cargando localidades...
              </div>
            ) : sectoresList.length === 0 ? (
              <div className="py-16 text-center text-xs text-neutral-400 space-y-2">
                <p>No hay sectores registrados en esta parroquia.</p>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  className="text-neutral-900 hover:text-neutral-600 font-semibold cursor-pointer"
                >
                  Añadir primer sector
                </button>
              </div>
            ) : (
              <div className="divide-y divide-neutral-100 border-b border-neutral-100">
                {sectoresList.map((item) => (
                  <div
                    key={item.id}
                    className="group p-3 flex items-center justify-between hover:bg-neutral-50/60 transition-colors text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                      <span className="font-medium text-neutral-900">{item.sector}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setItemToDelete(item)}
                      className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-150 text-neutral-400 hover:text-neutral-900 cursor-pointer p-1"
                      title="Eliminar sector"
                    >
                      <X className="w-3.5 h-3.5 stroke-[1.5]" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* MODAL: AÑADIR SECTOR */}
      {isAddModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/40 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => !savingItem && setIsAddModalOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-xl shadow-2xl border border-neutral-200/90 p-5 space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-900 tracking-tight">
                Añadir nuevo sector
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4 stroke-[1.5]" />
              </button>
            </div>

            <p className="text-xs text-neutral-500">
              Se creará en {selectedEstado} &gt; {selectedMunicipio} &gt; {selectedParroquia}.
            </p>

            <form onSubmit={handleAddSector} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] text-neutral-500 block">Nombre del sector / urbanización</label>
                <input
                  type="text"
                  value={newSectorName}
                  onChange={(e) => setNewSectorName(e.target.value)}
                  placeholder="Ej: Casco Central, El Rincón..."
                  className="w-full py-1.5 px-1 border-b border-neutral-200 focus:border-neutral-900 outline-none bg-transparent transition-colors text-neutral-900"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 text-xs">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingItem}
                  className="text-neutral-900 hover:text-neutral-700 font-semibold transition-colors cursor-pointer"
                >
                  {savingItem ? "Guardando..." : "Añadir"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ELIMINAR SECTOR */}
      <DeleteConfirmDialog
        isOpen={itemToDelete !== null}
        title="Eliminar sector"
        itemName={itemToDelete?.sector}
        description={`¿Estás seguro de que deseas eliminar el sector "${itemToDelete?.sector}" del árbol geográfico?`}
        onConfirm={executeDeleteItem}
        onCancel={() => setItemToDelete(null)}
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

export default function GeodataAdminPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#FDFDFD] text-xs font-mono text-neutral-400">
          Cargando localidades...
        </div>
      }
    >
      <GeodataAdminContent />
    </Suspense>
  );
}
