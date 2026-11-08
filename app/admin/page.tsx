"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Menu,
  Plus,
  PenLine,
  Check,
  X,
  RotateCw,
  Search,
} from "lucide-react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { SidebarOpenButton } from "@/components/providers/sidebar-provider";
import { useUser } from "@/components/providers/user-provider";
import { AdminDropdown } from "@/components/admin/admin-dropdown";
import {
  PersonalTabContent,
  PersonnelItem,
  KNOWN_SQUADS,
} from "@/components/admin/personal-tab-content";
import { UsuariosTabContent } from "@/components/admin/usuarios-tab-content";
import { PanelesTabContent } from "@/components/admin/paneles-tab-content";
import {
  AdvisorType,
  MemberStatus,
  stripAccents,
  KNOWN_OFFICES,
} from "@/lib/normalization";
import { clearDashboardDataCache } from "@/lib/dashboard-data";
import { cn } from "@/lib/utils";

export interface DepartamentoEntity {
  id: string;
  nombre: string;
  descripcion?: string;
  color?: string;
  responsable?: string;
}

export interface SedeTaquillaEntity {
  id: string;
  nombre: string;
  direccion?: string;
  ciudad?: string;
  telefono?: string;
  activo: boolean;
}

export interface CanalComercialEntity {
  id: string;
  nombre: string;
  tipo?: string;
  descripcion?: string;
  comisionPct?: number;
  activo: boolean;
}

interface AdminData {
  departamentos: DepartamentoEntity[];
  sedesTaquilla: SedeTaquillaEntity[];
  canalesComerciales: CanalComercialEntity[];
}

export type AdminTab = "personal" | "usuarios" | "paneles" | "departamentos" | "sedes" | "canales";
export type AdminCategory = "equipo" | "catalogos" | "sistema";

export const getCategoryForTab = (tab: AdminTab): AdminCategory => {
  if (tab === "personal" || tab === "usuarios") return "equipo";
  if (tab === "paneles") return "sistema";
  return "catalogos";
};

function AdminPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Read initial tab from URL query param if present (?tab=personal, etc.)
  const paramTab = searchParams.get("tab") as AdminTab | null;
  const [activeTab, setActiveTab] = useState<AdminTab>(
    paramTab && ["personal", "usuarios", "paneles", "departamentos", "sedes", "canales"].includes(paramTab)
      ? paramTab
      : "personal"
  );
  const [activeCategory, setActiveCategory] = useState<AdminCategory>(() =>
    getCategoryForTab(
      paramTab && ["personal", "usuarios", "paneles", "departamentos", "sedes", "canales"].includes(paramTab)
        ? paramTab
        : "personal"
    )
  );

  // Sync tab and category if URL changes
  useEffect(() => {
    if (paramTab && ["personal", "usuarios", "paneles", "departamentos", "sedes", "canales"].includes(paramTab)) {
      setActiveTab(paramTab);
      setActiveCategory(getCategoryForTab(paramTab));
    }
  }, [paramTab]);

  const [data, setData] = useState<AdminData>({
    departamentos: [],
    sedesTaquilla: [],
    canalesComerciales: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [toastMsg, setToastMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Total count of collaborators reported by PersonalTabContent
  const [personnelCount, setPersonnelCount] = useState<number>(0);
  const [usuariosCount, setUsuariosCount] = useState<number>(0);
  const [personalRefreshTrigger, setPersonalRefreshTrigger] = useState<number>(0);

  // Modal / Form state for creating and editing entities
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // In-app custom confirmation modal for deletions (Strict Rule 4: zero native browser confirms)
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    id: string;
    name: string;
    entityType: "departamento" | "sede" | "canal" | "colaborador";
    role?: "asesor" | "tecnico";
  } | null>(null);

  // Form states
  // 1. Personal
  const [personalForm, setPersonalForm] = useState({
    name: "",
    role: "asesor" as "asesor" | "tecnico",
    status: "fijo" as MemberStatus,
    type: "comercial" as AdvisorType,
    office: "Valle",
    team: "Equipo A",
    department: "ventas",
  });
  // 2. Departamento
  const [deptForm, setDeptForm] = useState({ nombre: "", descripcion: "", color: "emerald", responsable: "" });
  // 3. Sede
  const [sedeForm, setSedeForm] = useState({ nombre: "", direccion: "", ciudad: "Caracas", telefono: "", activo: true });
  // 4. Canal
  const [canalForm, setCanalForm] = useState({ nombre: "", tipo: "comercial", descripcion: "", comisionPct: 0, activo: true });

  const { user, isLoading: userLoading } = useUser();

  const showToast = useCallback((text: string, type: "success" | "error" = "success") => {
    setToastMsg({ text, type });
  }, []);

  useEffect(() => {
    if (!toastMsg) return;
    const timer = setTimeout(() => setToastMsg(null), 3500);
    return () => clearTimeout(timer);
  }, [toastMsg]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/entities?t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      const result = await res.json();
      if (result.success && result.data) {
        setData(result.data);
      }
    } catch (err) {
      console.error("Error loading admin data:", err);
      showToast("Error al cargar los datos de administración", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open modal for Create
  const handleOpenCreate = () => {
    setEditingId(null);
    if (activeTab === "personal") {
      setPersonalForm({
        name: "",
        role: "asesor",
        status: "fijo",
        type: "comercial",
        office: data.sedesTaquilla[0]?.nombre || "Valle",
        team: "Equipo A",
        department: data.departamentos[0]?.id || "ventas",
      });
    } else if (activeTab === "departamentos") {
      setDeptForm({ nombre: "", descripcion: "", color: "emerald", responsable: "" });
    } else if (activeTab === "sedes") {
      setSedeForm({ nombre: "", direccion: "", ciudad: "Caracas", telefono: "", activo: true });
    } else {
      setCanalForm({ nombre: "", tipo: "comercial", descripcion: "", comisionPct: 0, activo: true });
    }
    setIsModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEdit = (id: string) => {
    setEditingId(id);
    if (activeTab === "departamentos") {
      const item = data.departamentos.find((d) => d.id === id);
      if (item) {
        setDeptForm({
          nombre: item.nombre,
          descripcion: item.descripcion || "",
          color: item.color || "emerald",
          responsable: item.responsable || "",
        });
      }
    } else if (activeTab === "sedes") {
      const item = data.sedesTaquilla.find((s) => s.id === id);
      if (item) {
        setSedeForm({
          nombre: item.nombre,
          direccion: item.direccion || "",
          ciudad: item.ciudad || "Caracas",
          telefono: item.telefono || "",
          activo: item.activo,
        });
      }
    } else if (activeTab === "canales") {
      const item = data.canalesComerciales.find((c) => c.id === id);
      if (item) {
        setCanalForm({
          nombre: item.nombre,
          tipo: item.tipo || "comercial",
          descripcion: item.descripcion || "",
          comisionPct: item.comisionPct || 0,
          activo: item.activo,
        });
      }
    }
    setIsModalOpen(true);
  };

  // Open modal for editing a collaborator from PersonalTabContent
  const handleOpenEditPersonal = (item: PersonnelItem) => {
    setEditingId(item.name);
    setPersonalForm({
      name: item.name,
      role: item.role,
      status: item.status,
      type: item.currentType || "comercial",
      office: item.currentOffice || "Valle",
      team: item.currentTeam || "Equipo A",
      department: item.department || (item.role === "asesor" ? "ventas" : "tecnico"),
    });
    setIsModalOpen(true);
  };

  // Handle Save (Create or Update)
  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (activeTab === "personal") {
        if (!personalForm.name.trim()) {
          showToast("El nombre del colaborador es requerido", "error");
          setSaving(false);
          return;
        }

        const normName = personalForm.name.trim();

        // 1. Fetch current server configs to merge cleanly
        const configRes = await fetch(`/api/advisors/config?t=${Date.now()}`, {
          cache: "no-store",
        })
          .then((r) => r.json())
          .catch(() => null);

        const currentAdvOv = configRes?.overrides || {};
        const currentTechOv = configRes?.technicianOverrides || {};
        const currentAdvAl = configRes?.aliases || {};
        const currentTechAl = configRes?.technicianAliases || {};

        if (personalForm.role === "asesor") {
          currentAdvOv[normName] = {
            type: personalForm.type,
            office: personalForm.type === "taquilla" ? personalForm.office : undefined,
            status: personalForm.status,
            isExCollaborator: personalForm.status === "ex",
            department: personalForm.department,
            updatedAt: new Date().toISOString(),
          };
          delete currentTechOv[normName];
        } else {
          currentTechOv[normName] = {
            team: personalForm.team,
            status: personalForm.status,
            isExCollaborator: personalForm.status === "ex",
            department: personalForm.department,
            updatedAt: new Date().toISOString(),
          };
          delete currentAdvOv[normName];
        }

        const saveRes = await fetch("/api/advisors/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            overrides: currentAdvOv,
            aliases: currentAdvAl,
            technicianOverrides: currentTechOv,
            technicianAliases: currentTechAl,
          }),
        });
        const saveJson = await saveRes.json();
        if (saveJson.success) {
          clearDashboardDataCache();
          setPersonalRefreshTrigger((prev) => prev + 1);
          setIsModalOpen(false);
          showToast(
            editingId
              ? `Colaborador "${normName}" actualizado exitosamente`
              : `Colaborador "${normName}" registrado exitosamente`
          );
        } else {
          showToast(saveJson.error || "Error al guardar colaborador", "error");
        }
        return;
      }

      let entityType = "departamento";
      let payloadItem: any = {};

      if (activeTab === "departamentos") {
        entityType = "departamento";
        if (!deptForm.nombre.trim()) {
          showToast("El nombre del departamento es requerido", "error");
          setSaving(false);
          return;
        }
        payloadItem = { ...deptForm };
      } else if (activeTab === "sedes") {
        entityType = "sede";
        if (!sedeForm.nombre.trim()) {
          showToast("El nombre de la sede es requerido", "error");
          setSaving(false);
          return;
        }
        payloadItem = { ...sedeForm };
      } else {
        entityType = "canal";
        if (!canalForm.nombre.trim()) {
          showToast("El nombre del canal es requerido", "error");
          setSaving(false);
          return;
        }
        payloadItem = { ...canalForm };
      }

      const res = await fetch("/api/admin/entities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: editingId ? "update" : "create",
          entity: entityType,
          id: editingId,
          item: payloadItem,
        }),
      });

      const resData = await res.json();
      if (resData.success && resData.data) {
        setData(resData.data);
        setIsModalOpen(false);
        showToast(
          editingId
            ? "Registro actualizado exitosamente"
            : "Nuevo registro creado exitosamente"
        );
      } else {
        showToast(resData.error || "Error al guardar el registro", "error");
      }
    } catch (err: any) {
      console.error("Error saving entity:", err);
      showToast("Error en el servidor al guardar el registro", "error");
    } finally {
      setSaving(false);
    }
  };

  // Prompt custom delete dialog (No browser alert)
  const requestDelete = (
    id: string,
    name: string,
    entityType: "departamento" | "sede" | "canal" | "colaborador" = "departamento",
    role?: "asesor" | "tecnico"
  ) => {
    setDeleteConfirmation({
      isOpen: true,
      id,
      name,
      entityType,
      role,
    });
  };

  // Perform Delete execution
  const executeDelete = async () => {
    if (!deleteConfirmation) return;
    const { id, name, entityType, role } = deleteConfirmation;

    try {
      if (entityType === "colaborador") {
        const configRes = await fetch(`/api/advisors/config?t=${Date.now()}`, {
          cache: "no-store",
        })
          .then((r) => r.json())
          .catch(() => null);

        const currentAdvOv = configRes?.overrides || {};
        const currentTechOv = configRes?.technicianOverrides || {};
        const currentAdvAl = configRes?.aliases || {};
        const currentTechAl = configRes?.technicianAliases || {};

        const lower = id.toLowerCase().trim();
        const stripped = stripAccents(id).trim();

        Object.keys(currentAdvOv).forEach((k) => {
          if (k.toLowerCase().trim() === lower || stripAccents(k).trim() === stripped) {
            delete currentAdvOv[k];
          }
        });
        Object.keys(currentTechOv).forEach((k) => {
          if (k.toLowerCase().trim() === lower || stripAccents(k).trim() === stripped) {
            delete currentTechOv[k];
          }
        });
        delete currentAdvAl[id];
        delete currentAdvAl[lower];
        delete currentTechAl[id];
        delete currentTechAl[lower];

        await fetch("/api/advisors/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            overrides: currentAdvOv,
            aliases: currentAdvAl,
            technicianOverrides: currentTechOv,
            technicianAliases: currentTechAl,
          }),
        });

        clearDashboardDataCache();
        setPersonalRefreshTrigger((prev) => prev + 1);
        showToast(`Colaborador "${name}" desvinculado correctamente`);
        setDeleteConfirmation(null);
        return;
      }

      const res = await fetch("/api/admin/entities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          entity: entityType,
          id,
        }),
      });

      const resData = await res.json();
      if (resData.success && resData.data) {
        setData(resData.data);
        showToast(`"${name}" eliminado correctamente`);
      } else {
        showToast(resData.error || "Error al eliminar", "error");
      }
    } catch (err) {
      showToast("Error de conexión al eliminar", "error");
    } finally {
      setDeleteConfirmation(null);
    }
  };

  // Filter items by search for other tabs
  const filteredDepartamentos = data.departamentos.filter(
    (d) =>
      d.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.descripcion && d.descripcion.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredSedes = data.sedesTaquilla.filter(
    (s) =>
      s.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.ciudad && s.ciudad.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.direccion && s.direccion.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredCanales = data.canalesComerciales.filter(
    (c) =>
      c.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.descripcion && c.descripcion.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.tipo && c.tipo.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleTabChange = (tab: AdminTab) => {
    setActiveTab(tab);
    setActiveCategory(getCategoryForTab(tab));
    setSearchQuery("");
    // Update URL query smoothly
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    router.replace(url.pathname + url.search, { scroll: false });
  };

  const handleCategoryChange = (cat: AdminCategory) => {
    setActiveCategory(cat);
    if (cat === "equipo") {
      if (activeTab !== "personal" && activeTab !== "usuarios") {
        handleTabChange("personal");
      }
    } else if (cat === "catalogos") {
      if (activeTab !== "departamentos" && activeTab !== "sedes" && activeTab !== "canales") {
        handleTabChange("departamentos");
      }
    } else if (cat === "sistema") {
      if (activeTab !== "paneles") {
        handleTabChange("paneles");
      }
    }
  };

  if (userLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6 text-xs text-neutral-400 font-mono">
        <RotateCw className="w-3.5 h-3.5 animate-spin mr-2 text-neutral-900" />
        <span>Verificando credenciales...</span>
      </div>
    );
  }

  if (!user || user.rol !== "admin") {
    return (
      <div className="flex min-h-screen bg-white text-[#09090B] font-sans">
        <Sidebar
          activeSection="admin"
          isMobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
        />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-sm space-y-3">
            <h1 className="text-base font-semibold text-neutral-900 font-sans">
              Acceso restringido
            </h1>
            <p className="text-xs text-neutral-500 font-sans leading-relaxed">
              El panel de administración requiere una cuenta con rol de Administrador.
              {user ? ` Tu sesión actual (${user.email}) tiene rol de ${user.rol}.` : " No has iniciado sesión en este dispositivo."}
            </p>
            <div className="pt-2 flex items-center justify-center gap-4 text-xs font-sans">
              <Link
                href="/login"
                className="font-semibold text-neutral-900 underline hover:text-neutral-600 transition-colors cursor-pointer"
              >
                Iniciar sesión como Administrador
              </Link>
              <Link
                href="/"
                className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
              >
                Volver al inicio
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#FDFDFD] text-[#09090B] font-sans antialiased selection:bg-neutral-900 selection:text-white">
      {/* Sidebar Navigation */}
      <Sidebar
        activeSection="admin"
        isMobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Main Administrative Workspace */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#FDFDFD]">
        {/* Top Header */}
        <header className="sticky top-0 z-20 h-12 bg-white border-b border-neutral-200/80 px-4 sm:px-6 flex items-center justify-between select-none">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="xl:hidden -ml-2 min-w-[44px] min-h-[44px] p-2.5 flex items-center justify-center text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
              aria-label="Abrir menú"
            >
              <Menu className="w-4 h-4 stroke-[1.75]" />
            </button>
            <SidebarOpenButton />
          </div>

          <div className="flex items-center">
            <span className="text-xs sm:text-sm font-normal text-neutral-700 tracking-tight font-sans">
              Panel de administración
            </span>
          </div>
        </header>

        {/* Content Container */}
        <main className="flex-1 px-3 sm:px-8 py-5 pb-20 xl:pb-5 max-w-6xl w-full mx-auto space-y-5">
          {/* Main Title Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-neutral-200/80">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-950 font-sans">
                Panel de Administración
              </h1>
              <p className="text-xs text-neutral-500 mt-1 font-sans">
                Gestión centralizada de colaboradores y catálogos comerciales
              </p>
            </div>

            {/* Action buttons (Basic options: icon only, zero boxes or frames) */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  loadData();
                  setPersonalRefreshTrigger((p) => p + 1);
                }}
                disabled={loading}
                className="min-w-[44px] min-h-[44px] p-2.5 flex items-center justify-center text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer select-none"
                title="Actualizar datos"
                aria-label="Actualizar datos"
              >
                <RotateCw className={cn("w-4 h-4", loading && "animate-spin text-neutral-900")} />
              </button>

              {activeTab !== "usuarios" && activeTab !== "paneles" && (
                <button
                  type="button"
                  onClick={handleOpenCreate}
                  className="min-w-[44px] min-h-[44px] p-2.5 flex items-center justify-center text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer select-none"
                  title={
                    activeTab === "personal"
                      ? "Nuevo colaborador"
                      : activeTab === "departamentos"
                      ? "Nuevo departamento"
                      : activeTab === "sedes"
                      ? "Nueva sede de taquilla"
                      : "Nuevo canal comercial"
                  }
                  aria-label="Nuevo registro"
                >
                  <Plus className="w-4 h-4 stroke-[2]" />
                </button>
              )}
            </div>
          </div>

          {/* Toast Notification: Minimalist Floating Indicator (Strict Rule 2) */}
          {toastMsg && (
            <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-3 py-2 bg-neutral-900 text-white rounded-md shadow-lg text-xs font-mono animate-in fade-in slide-in-from-bottom-2 duration-150">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              <span>{toastMsg.text}</span>
              <button
                type="button"
                onClick={() => setToastMsg(null)}
                className="text-neutral-400 hover:text-white ml-2 transition-colors cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Grouped Administrative Navigation (Strict Rule 1 & 5: Clean typography, no boxed cards, sentence case) */}
          <div className="space-y-2 border-b border-neutral-200/80 pb-1">
            {/* 1. Categorías Principales */}
            <nav className="flex items-center gap-6 text-xs overflow-x-auto no-scrollbar whitespace-nowrap scroll-smooth -mx-4 px-4 sm:mx-0 sm:px-0 select-none">
              <button
                type="button"
                onClick={() => handleCategoryChange("equipo")}
                className={cn(
                  "min-h-[40px] py-2 transition-colors cursor-pointer inline-flex items-center gap-2",
                  activeCategory === "equipo"
                    ? "text-neutral-950 font-semibold border-b-2 border-neutral-950 -mb-[1px]"
                    : "text-neutral-400 hover:text-neutral-900 font-medium"
                )}
              >
                <span>Equipo y accesos</span>
                <span className="font-mono text-[10px] text-neutral-400">
                  ({(personnelCount || 0) + (usuariosCount || 0)})
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleCategoryChange("catalogos")}
                className={cn(
                  "min-h-[40px] py-2 transition-colors cursor-pointer inline-flex items-center gap-2",
                  activeCategory === "catalogos"
                    ? "text-neutral-950 font-semibold border-b-2 border-neutral-950 -mb-[1px]"
                    : "text-neutral-400 hover:text-neutral-900 font-medium"
                )}
              >
                <span>Catálogos comerciales</span>
                <span className="font-mono text-[10px] text-neutral-400">
                  ({data.departamentos.length + data.sedesTaquilla.length + data.canalesComerciales.length})
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleCategoryChange("sistema")}
                className={cn(
                  "min-h-[40px] py-2 transition-colors cursor-pointer inline-flex items-center gap-2",
                  activeCategory === "sistema"
                    ? "text-neutral-950 font-semibold border-b-2 border-neutral-950 -mb-[1px]"
                    : "text-neutral-400 hover:text-neutral-900 font-medium"
                )}
              >
                <span>Sistema y módulos</span>
              </button>
            </nav>

            {/* 2. Sub-pestañas Contextuales */}
            <div className="flex items-center gap-3 sm:gap-4 text-xs overflow-x-auto no-scrollbar whitespace-nowrap pt-1 pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
              {activeCategory === "equipo" && (
                <>
                  <button
                    type="button"
                    onClick={() => handleTabChange("personal")}
                    className={cn(
                      "transition-colors cursor-pointer py-1 select-none inline-flex items-center gap-1.5",
                      activeTab === "personal"
                        ? "text-neutral-950 font-semibold"
                        : "text-neutral-400 hover:text-neutral-800 font-normal"
                    )}
                  >
                    <span>Personal y cuadrillas</span>
                    <span className="font-mono text-[10px] text-neutral-400">({personnelCount || "—"})</span>
                    {activeTab === "personal" && <span className="w-1.5 h-1.5 rounded-full bg-neutral-950 shrink-0" />}
                  </button>

                  <span className="text-neutral-200">·</span>

                  <button
                    type="button"
                    onClick={() => handleTabChange("usuarios")}
                    className={cn(
                      "transition-colors cursor-pointer py-1 select-none inline-flex items-center gap-1.5",
                      activeTab === "usuarios"
                        ? "text-neutral-950 font-semibold"
                        : "text-neutral-400 hover:text-neutral-800 font-normal"
                    )}
                  >
                    <span>Usuarios y accesos</span>
                    <span className="font-mono text-[10px] text-neutral-400">({usuariosCount || "—"})</span>
                    {activeTab === "usuarios" && <span className="w-1.5 h-1.5 rounded-full bg-neutral-950 shrink-0" />}
                  </button>
                </>
              )}

              {activeCategory === "catalogos" && (
                <>
                  <button
                    type="button"
                    onClick={() => handleTabChange("departamentos")}
                    className={cn(
                      "transition-colors cursor-pointer py-1 select-none inline-flex items-center gap-1.5",
                      activeTab === "departamentos"
                        ? "text-neutral-950 font-semibold"
                        : "text-neutral-400 hover:text-neutral-800 font-normal"
                    )}
                  >
                    <span>Departamentos</span>
                    <span className="font-mono text-[10px] text-neutral-400">({data.departamentos.length})</span>
                    {activeTab === "departamentos" && <span className="w-1.5 h-1.5 rounded-full bg-neutral-950 shrink-0" />}
                  </button>

                  <span className="text-neutral-200">·</span>

                  <button
                    type="button"
                    onClick={() => handleTabChange("sedes")}
                    className={cn(
                      "transition-colors cursor-pointer py-1 select-none inline-flex items-center gap-1.5",
                      activeTab === "sedes"
                        ? "text-neutral-950 font-semibold"
                        : "text-neutral-400 hover:text-neutral-800 font-normal"
                    )}
                  >
                    <span>Sedes de taquilla</span>
                    <span className="font-mono text-[10px] text-neutral-400">({data.sedesTaquilla.length})</span>
                    {activeTab === "sedes" && <span className="w-1.5 h-1.5 rounded-full bg-neutral-950 shrink-0" />}
                  </button>

                  <span className="text-neutral-200">·</span>

                  <button
                    type="button"
                    onClick={() => handleTabChange("canales")}
                    className={cn(
                      "transition-colors cursor-pointer py-1 select-none inline-flex items-center gap-1.5",
                      activeTab === "canales"
                        ? "text-neutral-950 font-semibold"
                        : "text-neutral-400 hover:text-neutral-800 font-normal"
                    )}
                  >
                    <span>Canales comerciales</span>
                    <span className="font-mono text-[10px] text-neutral-400">({data.canalesComerciales.length})</span>
                    {activeTab === "canales" && <span className="w-1.5 h-1.5 rounded-full bg-neutral-950 shrink-0" />}
                  </button>

                  <span className="text-neutral-200">·</span>

                  <Link
                    href="/admin/planes"
                    className="text-neutral-400 hover:text-neutral-900 transition-colors py-1 select-none inline-flex items-center gap-1"
                  >
                    <span>Planes de servicio</span>
                  </Link>

                  <span className="text-neutral-200">·</span>

                  <Link
                    href="/admin/geodata"
                    className="text-neutral-400 hover:text-neutral-900 transition-colors py-1 select-none inline-flex items-center gap-1"
                  >
                    <span>Localidades y geodata</span>
                  </Link>
                </>
              )}

              {activeCategory === "sistema" && (
                <div className="text-xs text-neutral-500 py-1 font-sans">
                  <span>Control de visibilidad y disponibilidad de módulos para usuarios</span>
                </div>
              )}
            </div>
          </div>

          {/* ========================================================= */}
          {/* TAB 1: PERSONAL WORKSPACE                                 */}
          {/* ========================================================= */}
          {activeTab === "personal" && (
            <PersonalTabContent
              departamentos={data.departamentos}
              sedes={data.sedesTaquilla}
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              onTotalCountChange={setPersonnelCount}
              onRequestDelete={(name, role) => requestDelete(name, name, "colaborador", role)}
              showToast={showToast}
              onOpenEdit={handleOpenEditPersonal}
              refreshTrigger={personalRefreshTrigger}
            />
          )}

          {/* ========================================================= */}
          {/* TAB: USUARIOS Y ACCESOS                                   */}
          {/* ========================================================= */}
          {activeTab === "usuarios" && (
            <UsuariosTabContent
              showToast={showToast}
              onTotalCountChange={setUsuariosCount}
              refreshTrigger={personalRefreshTrigger}
            />
          )}

          {/* ========================================================= */}
          {/* TAB: PANELES Y MÓDULOS                                    */}
          {/* ========================================================= */}
          {activeTab === "paneles" && (
            <PanelesTabContent showToast={showToast} />
          )}

          {/* ========================================================= */}
          {/* TAB 2: DEPARTAMENTOS                                      */}
          {/* ========================================================= */}
          {activeTab === "departamentos" && (
            <div className="w-full space-y-3">
              <div className="flex items-center justify-between border-b border-neutral-200/80 pb-3 text-xs">
                <span className="text-neutral-400 font-mono text-[11px]">
                  {filteredDepartamentos.length} departamento(s)
                </span>
                <div className="flex items-center gap-2 text-neutral-400 border-b border-neutral-200 focus-within:border-neutral-900 py-0.5 transition-colors w-36 sm:w-52">
                  <Search className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="Buscar departamento..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-transparent text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none w-full font-sans"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="text-neutral-400 hover:text-neutral-900 cursor-pointer p-0.5"
                      title="Limpiar búsqueda"
                      aria-label="Limpiar búsqueda"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
              {/* Desktop Table (hidden on mobile) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-neutral-200/80 text-neutral-400 font-normal text-[11px]">
                      <th className="py-3 pr-4 font-normal">Identificador</th>
                      <th className="py-3 px-4 font-normal">Nombre del Departamento</th>
                      <th className="py-3 px-4 font-normal">Descripción de Funciones</th>
                      <th className="py-3 px-4 font-normal">Responsable</th>
                      <th className="py-3 pl-4 text-right font-normal">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {filteredDepartamentos.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-12 text-neutral-400">
                          No se encontraron departamentos registrados
                        </td>
                      </tr>
                    ) : (
                      filteredDepartamentos.map((dept) => (
                        <tr
                          key={dept.id}
                          className="hover:bg-neutral-50/50 transition-colors group"
                        >
                          <td className="py-3.5 pr-4 text-neutral-500 font-mono text-[11px]">
                            <span className="bg-neutral-100 px-1.5 py-0.5 rounded text-[10px]">
                              {dept.id}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-sans font-medium text-neutral-900">
                            {dept.nombre}
                          </td>
                          <td className="py-3.5 px-4 font-sans text-neutral-500 text-[11px] max-w-xs truncate">
                            {dept.descripcion || "Sin descripción"}
                          </td>
                          <td className="py-3.5 px-4 font-sans text-neutral-600">
                            {dept.responsable || "—"}
                          </td>
                          <td className="py-3.5 pl-4 text-right">
                            <div className="flex items-center justify-end gap-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(dept.id)}
                                className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer p-0.5"
                                title="Editar departamento"
                              >
                                <PenLine className="w-3.5 h-3.5 stroke-[1.25]" />
                              </button>
                              <button
                                type="button"
                                onClick={() => requestDelete(dept.id, dept.nombre, "departamento")}
                                className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer p-0.5"
                                title="Eliminar departamento"
                              >
                                <X className="w-3.5 h-3.5 stroke-[1.5]" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Departamentos Card List (no horizontal scrollbar) */}
              <div className="md:hidden divide-y divide-neutral-100 font-sans text-xs">
                {filteredDepartamentos.length === 0 ? (
                  <div className="text-center py-12 text-neutral-400">
                    No se encontraron departamentos registrados
                  </div>
                ) : (
                  filteredDepartamentos.map((dept) => (
                    <div key={dept.id} className="py-3.5 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold text-neutral-900 text-xs flex items-center gap-1.5">
                            <span>{dept.nombre}</span>
                            <span className="bg-neutral-100 text-neutral-500 font-mono text-[10px] px-1.5 py-0.2 rounded">
                              {dept.id}
                            </span>
                          </div>
                          {dept.responsable && (
                            <span className="text-[11px] text-neutral-500 block mt-0.5">
                              Resp: {dept.responsable}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(dept.id)}
                            className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer p-1"
                            title="Editar departamento"
                          >
                            <PenLine className="w-3.5 h-3.5 stroke-[1.25]" />
                          </button>
                          <button
                            type="button"
                            onClick={() => requestDelete(dept.id, dept.nombre, "departamento")}
                            className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer p-1"
                            title="Eliminar departamento"
                          >
                            <X className="w-3.5 h-3.5 stroke-[1.5]" />
                          </button>
                        </div>
                      </div>

                      {dept.descripcion && (
                        <p className="text-[11px] text-neutral-400">
                          {dept.descripcion}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: SEDES DE TAQUILLAS                                 */}
          {/* ========================================================= */}
          {activeTab === "sedes" && (
            <div className="w-full space-y-3">
              <div className="flex items-center justify-between border-b border-neutral-200/80 pb-3 text-xs">
                <span className="text-neutral-400 font-mono text-[11px]">
                  {filteredSedes.length} sede(s)
                </span>
                <div className="flex items-center gap-2 text-neutral-400 border-b border-neutral-200 focus-within:border-neutral-900 py-0.5 transition-colors w-36 sm:w-52">
                  <Search className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="Buscar sede..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-transparent text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none w-full font-sans"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="text-neutral-400 hover:text-neutral-900 cursor-pointer p-0.5"
                      title="Limpiar búsqueda"
                      aria-label="Limpiar búsqueda"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
              {/* Desktop Table (hidden on mobile) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-neutral-200/80 text-neutral-400 font-normal text-[11px]">
                      <th className="py-3 pr-4 font-normal">Sede / Agencia</th>
                      <th className="py-3 px-4 font-normal">Ciudad / Región</th>
                      <th className="py-3 px-4 font-normal">Dirección Física</th>
                      <th className="py-3 px-4 font-normal">Teléfono / Contacto</th>
                      <th className="py-3 px-4 font-normal">Estado</th>
                      <th className="py-3 pl-4 text-right font-normal">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {filteredSedes.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-neutral-400">
                          No se encontraron sedes de taquillas registradas
                        </td>
                      </tr>
                    ) : (
                      filteredSedes.map((sede) => (
                        <tr
                          key={sede.id}
                          className="hover:bg-neutral-50/50 transition-colors group"
                        >
                          <td className="py-3.5 pr-4 font-sans font-medium text-neutral-900">
                            {sede.nombre}
                          </td>
                          <td className="py-3.5 px-4 font-sans text-neutral-600">
                            {sede.ciudad || "—"}
                          </td>
                          <td className="py-3.5 px-4 font-sans text-neutral-500 text-[11px] max-w-xs truncate">
                            {sede.direccion || "—"}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-neutral-500 text-[11px]">
                            {sede.telefono || "—"}
                          </td>
                          <td className="py-3.5 px-4 font-sans">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 text-[11px]",
                                sede.activo ? "text-emerald-700 font-medium" : "text-neutral-400"
                              )}
                            >
                              <span
                                className={cn(
                                  "w-1.5 h-1.5 rounded-full",
                                  sede.activo ? "bg-emerald-500" : "bg-neutral-300"
                                )}
                              />
                              {sede.activo ? "Operativa" : "Inactiva"}
                            </span>
                          </td>
                          <td className="py-3.5 pl-4 text-right">
                            <div className="flex items-center justify-end gap-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(sede.id)}
                                className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer p-0.5"
                                title="Editar sede"
                              >
                                <PenLine className="w-3.5 h-3.5 stroke-[1.25]" />
                              </button>
                              <button
                                type="button"
                                onClick={() => requestDelete(sede.id, sede.nombre, "sede")}
                                className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer p-0.5"
                                title="Eliminar sede"
                              >
                                <X className="w-3.5 h-3.5 stroke-[1.5]" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Sedes Card List (no horizontal scrollbar) */}
              <div className="md:hidden divide-y divide-neutral-100 font-sans text-xs">
                {filteredSedes.length === 0 ? (
                  <div className="text-center py-12 text-neutral-400">
                    No se encontraron sedes de taquillas registradas
                  </div>
                ) : (
                  filteredSedes.map((sede) => (
                    <div key={sede.id} className="py-3.5 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold text-neutral-900 text-xs flex items-center gap-1.5">
                            <span>{sede.nombre}</span>
                            <span
                              className={cn(
                                "w-1.5 h-1.5 rounded-full",
                                sede.activo ? "bg-emerald-500" : "bg-neutral-300"
                              )}
                              title={sede.activo ? "Operativa" : "Inactiva"}
                            />
                          </div>
                          <div className="text-[11px] text-neutral-500 mt-0.5">
                            {sede.ciudad || "—"} {sede.telefono ? `· ${sede.telefono}` : ""}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(sede.id)}
                            className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer p-1"
                            title="Editar sede"
                          >
                            <PenLine className="w-3.5 h-3.5 stroke-[1.25]" />
                          </button>
                          <button
                            type="button"
                            onClick={() => requestDelete(sede.id, sede.nombre, "sede")}
                            className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer p-1"
                            title="Eliminar sede"
                          >
                            <X className="w-3.5 h-3.5 stroke-[1.5]" />
                          </button>
                        </div>
                      </div>

                      {sede.direccion && (
                        <p className="text-[11px] text-neutral-400">
                          {sede.direccion}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 4: CANALES COMERCIALES                                */}
          {/* ========================================================= */}
          {activeTab === "canales" && (
            <div className="w-full space-y-3">
              <div className="flex items-center justify-between border-b border-neutral-200/80 pb-3 text-xs">
                <span className="text-neutral-400 font-mono text-[11px]">
                  {filteredCanales.length} canal(es)
                </span>
                <div className="flex items-center gap-2 text-neutral-400 border-b border-neutral-200 focus-within:border-neutral-900 py-0.5 transition-colors w-36 sm:w-52">
                  <Search className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="Buscar canal..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-transparent text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none w-full font-sans"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="text-neutral-400 hover:text-neutral-900 cursor-pointer p-0.5"
                      title="Limpiar búsqueda"
                      aria-label="Limpiar búsqueda"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
              {/* Desktop Table (hidden on mobile) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-neutral-200/80 text-neutral-400 font-normal text-[11px]">
                      <th className="py-3 pr-4 font-normal">Canal Comercial</th>
                      <th className="py-3 px-4 font-normal">Tipo Clasificación</th>
                      <th className="py-3 px-4 font-normal">Descripción Operativa</th>
                      <th className="py-3 px-4 font-normal">Comisión (%)</th>
                      <th className="py-3 px-4 font-normal">Estatus</th>
                      <th className="py-3 pl-4 text-right font-normal">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {filteredCanales.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-neutral-400">
                          No se encontraron canales comerciales registrados
                        </td>
                      </tr>
                    ) : (
                      filteredCanales.map((canal) => (
                        <tr
                          key={canal.id}
                          className="hover:bg-neutral-50/50 transition-colors group"
                        >
                          <td className="py-3.5 pr-4 font-sans font-medium text-neutral-900">
                            {canal.nombre}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-neutral-600 text-[11px]">
                            {canal.tipo || "comercial"}
                          </td>
                          <td className="py-3.5 px-4 font-sans text-neutral-500 text-[11px] max-w-xs truncate">
                            {canal.descripcion || "—"}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-neutral-800">
                            {canal.comisionPct ? `${canal.comisionPct}%` : "0%"}
                          </td>
                          <td className="py-3.5 px-4 font-sans">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 text-[11px]",
                                canal.activo ? "text-emerald-700 font-medium" : "text-neutral-400"
                              )}
                            >
                              <span
                                className={cn(
                                  "w-1.5 h-1.5 rounded-full",
                                  canal.activo ? "bg-emerald-500" : "bg-neutral-300"
                                )}
                              />
                              {canal.activo ? "Habilitado" : "Deshabilitado"}
                            </span>
                          </td>
                          <td className="py-3.5 pl-4 text-right">
                            <div className="flex items-center justify-end gap-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(canal.id)}
                                className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer p-0.5"
                                title="Editar canal"
                              >
                                <PenLine className="w-3.5 h-3.5 stroke-[1.25]" />
                              </button>
                              <button
                                type="button"
                                onClick={() => requestDelete(canal.id, canal.nombre, "canal")}
                                className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer p-0.5"
                                title="Eliminar canal"
                              >
                                <X className="w-3.5 h-3.5 stroke-[1.5]" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Canales Card List (no horizontal scrollbar) */}
              <div className="md:hidden divide-y divide-neutral-100 font-sans text-xs">
                {filteredCanales.length === 0 ? (
                  <div className="text-center py-12 text-neutral-400">
                    No se encontraron canales comerciales registrados
                  </div>
                ) : (
                  filteredCanales.map((canal) => (
                    <div key={canal.id} className="py-3.5 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold text-neutral-900 text-xs flex items-center gap-1.5">
                            <span>{canal.nombre}</span>
                            <span
                              className={cn(
                                "w-1.5 h-1.5 rounded-full",
                                canal.activo ? "bg-emerald-500" : "bg-neutral-300"
                              )}
                              title={canal.activo ? "Habilitado" : "Deshabilitado"}
                            />
                          </div>
                          <div className="text-[11px] text-neutral-500 font-mono mt-0.5">
                            <span>{canal.tipo || "comercial"}</span>
                            <span className="mx-1">·</span>
                            <span className="font-semibold text-neutral-800">{canal.comisionPct ? `${canal.comisionPct}% com.` : "0%"}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(canal.id)}
                            className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer p-1"
                            title="Editar canal"
                          >
                            <PenLine className="w-3.5 h-3.5 stroke-[1.25]" />
                          </button>
                          <button
                            type="button"
                            onClick={() => requestDelete(canal.id, canal.nombre, "canal")}
                            className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer p-1"
                            title="Eliminar canal"
                          >
                            <X className="w-3.5 h-3.5 stroke-[1.5]" />
                          </button>
                        </div>
                      </div>

                      {canal.descripcion && (
                        <p className="text-[11px] text-neutral-400">
                          {canal.descripcion}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ============================================================= */}
      {/* MODAL PARA CREAR O EDITAR ENTIDAD                             */}
      {/* ============================================================= */}
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-neutral-950/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-100"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl border border-neutral-200/80 w-full max-w-md max-h-[92vh] overflow-y-auto p-4 sm:p-6 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
              <h2 className="text-base font-bold text-neutral-950">
                {editingId
                  ? `Editar ${
                      activeTab === "personal"
                        ? "Colaborador"
                        : activeTab === "departamentos"
                        ? "Departamento"
                        : activeTab === "sedes"
                        ? "Sede de Taquilla"
                        : "Canal Comercial"
                    }`
                  : `Crear ${
                      activeTab === "personal"
                        ? "Colaborador"
                        : activeTab === "departamentos"
                        ? "Departamento"
                        : activeTab === "sedes"
                        ? "Sede de Taquilla"
                        : "Canal Comercial"
                    }`}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer p-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body / Forms */}
            <form onSubmit={handleSaveForm} className="space-y-4 pt-4 text-xs font-sans">
              {/* FORMS: PERSONAL */}
              {activeTab === "personal" && (
                <>
                  <div>
                    <label className="block text-[11px] font-mono text-neutral-500 mb-1">
                      Nombre Completo del Colaborador *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Daniel Gómez, Gabriela Marrero"
                      value={personalForm.name}
                      onChange={(e) => setPersonalForm({ ...personalForm, name: e.target.value })}
                      className="w-full border-b border-neutral-300 py-1.5 text-neutral-900 focus:outline-none focus:border-neutral-950 transition-colors font-sans"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-mono text-neutral-500 mb-1">
                        Rol / Función
                      </label>
                      <AdminDropdown<"asesor" | "tecnico">
                        value={personalForm.role}
                        options={[
                          { value: "asesor", label: "Asesor Comercial" },
                          { value: "tecnico", label: "Técnico de Campo" },
                        ]}
                        onChange={(val) => setPersonalForm({ ...personalForm, role: val })}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-mono text-neutral-500 mb-1">
                        Condición Laboral
                      </label>
                      <AdminDropdown<MemberStatus>
                        value={personalForm.status}
                        options={[
                          { value: "fijo", label: "Fijo" },
                          { value: "ex", label: "Ex Colaborador" },
                          { value: "otro_departamento", label: "Otro Departamento" },
                        ]}
                        onChange={(val) => setPersonalForm({ ...personalForm, status: val })}
                      />
                    </div>
                  </div>

                  {/* Asesor specific options */}
                  {personalForm.role === "asesor" ? (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[11px] font-mono text-neutral-500 mb-1">
                          Canal Comercial
                        </label>
                        <AdminDropdown<AdvisorType>
                          value={personalForm.type}
                          options={[
                            { value: "comercial", label: "Ventas de Calle" },
                            { value: "taquilla", label: "Taquilla Presencial" },
                            { value: "planificacion", label: "Planificación" },
                            { value: "externo", label: "Externo / Aliado" },
                          ]}
                          onChange={(val) => setPersonalForm({ ...personalForm, type: val })}
                        />
                      </div>

                      {personalForm.type === "taquilla" && (
                        <div>
                          <label className="block text-[11px] font-mono text-neutral-500 mb-1">
                            Sede / Taquilla Asignada
                          </label>
                          <AdminDropdown<string>
                            value={personalForm.office}
                            options={
                              data.sedesTaquilla.length > 0
                                ? data.sedesTaquilla.map((s) => ({ value: s.nombre, label: s.nombre }))
                                : KNOWN_OFFICES.map((o) => ({ value: o, label: o }))
                            }
                            onChange={(val) => setPersonalForm({ ...personalForm, office: val })}
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[11px] font-mono text-neutral-500 mb-1">
                        Cuadrilla / Equipo de Instalaciones
                      </label>
                      <AdminDropdown<string>
                        value={personalForm.team}
                        options={KNOWN_SQUADS.map((s) => ({ value: s, label: s }))}
                        onChange={(val) => setPersonalForm({ ...personalForm, team: val })}
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-mono text-neutral-500 mb-1">
                      Departamento Asignado
                    </label>
                    <AdminDropdown<string>
                      value={personalForm.department}
                      options={
                        data.departamentos.length > 0
                          ? data.departamentos.map((d) => ({ value: d.id, label: d.nombre }))
                          : [
                              { value: "ventas", label: "Comercialización" },
                              { value: "tecnico", label: "Instalaciones" },
                              { value: "planificacion", label: "Planificación" },
                            ]
                      }
                      onChange={(val) => setPersonalForm({ ...personalForm, department: val })}
                    />
                  </div>
                </>
              )}

              {/* FORMS: DEPARTAMENTOS */}
              {activeTab === "departamentos" && (
                <>
                  <div>
                    <label className="block text-[11px] font-mono text-neutral-500 mb-1">
                      Nombre del Departamento *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Comercialización, Soporte Técnico"
                      value={deptForm.nombre}
                      onChange={(e) => setDeptForm({ ...deptForm, nombre: e.target.value })}
                      className="w-full border-b border-neutral-300 py-1.5 text-neutral-900 focus:outline-none focus:border-neutral-950 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono text-neutral-500 mb-1">
                      Descripción de Funciones
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Breve detalle del alcance u operaciones del departamento"
                      value={deptForm.descripcion}
                      onChange={(e) => setDeptForm({ ...deptForm, descripcion: e.target.value })}
                      className="w-full border border-neutral-200 rounded p-2 text-neutral-900 focus:outline-none focus:border-neutral-950 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono text-neutral-500 mb-1">
                      Líder / Responsable
                    </label>
                    <input
                      type="text"
                      placeholder="Nombre del encargado o gerente"
                      value={deptForm.responsable}
                      onChange={(e) => setDeptForm({ ...deptForm, responsable: e.target.value })}
                      className="w-full border-b border-neutral-300 py-1.5 text-neutral-900 focus:outline-none focus:border-neutral-950 transition-colors"
                    />
                  </div>
                </>
              )}

              {/* FORMS: SEDES DE TAQUILLAS */}
              {activeTab === "sedes" && (
                <>
                  <div>
                    <label className="block text-[11px] font-mono text-neutral-500 mb-1">
                      Nombre de la Sede / Taquilla *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Valle, Las Tejerías, Alí Primera"
                      value={sedeForm.nombre}
                      onChange={(e) => setSedeForm({ ...sedeForm, nombre: e.target.value })}
                      className="w-full border-b border-neutral-300 py-1.5 text-neutral-900 focus:outline-none focus:border-neutral-950 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono text-neutral-500 mb-1">
                      Ciudad o Zona
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Caracas, Aragua, Los Teques"
                      value={sedeForm.ciudad}
                      onChange={(e) => setSedeForm({ ...sedeForm, ciudad: e.target.value })}
                      className="w-full border-b border-neutral-300 py-1.5 text-neutral-900 focus:outline-none focus:border-neutral-950 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono text-neutral-500 mb-1">
                      Dirección Física
                    </label>
                    <input
                      type="text"
                      placeholder="Av., Calle, Centro Comercial o Local"
                      value={sedeForm.direccion}
                      onChange={(e) => setSedeForm({ ...sedeForm, direccion: e.target.value })}
                      className="w-full border-b border-neutral-300 py-1.5 text-neutral-900 focus:outline-none focus:border-neutral-950 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono text-neutral-500 mb-1">
                      Teléfono de Atención
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: +58 212-0000000"
                      value={sedeForm.telefono}
                      onChange={(e) => setSedeForm({ ...sedeForm, telefono: e.target.value })}
                      className="w-full border-b border-neutral-300 py-1.5 text-neutral-900 focus:outline-none focus:border-neutral-950 transition-colors"
                    />
                  </div>
                  <div className="pt-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={sedeForm.activo}
                        onChange={(e) => setSedeForm({ ...sedeForm, activo: e.target.checked })}
                        className="rounded border-neutral-300 text-neutral-900 focus:ring-0"
                      />
                      <span className="text-neutral-700 font-medium">Sede Operativa y Abierta</span>
                    </label>
                  </div>
                </>
              )}

              {/* FORMS: CANALES COMERCIALES */}
              {activeTab === "canales" && (
                <>
                  <div>
                    <label className="block text-[11px] font-mono text-neutral-500 mb-1">
                      Nombre del Canal Comercial *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Ventas de Calle, Taquilla / Sede, Aliados"
                      value={canalForm.nombre}
                      onChange={(e) => setCanalForm({ ...canalForm, nombre: e.target.value })}
                      className="w-full border-b border-neutral-300 py-1.5 text-neutral-900 focus:outline-none focus:border-neutral-950 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono text-neutral-500 mb-1">
                      Clasificación Operativa
                    </label>
                    <AdminDropdown<string>
                      value={canalForm.tipo}
                      options={[
                        { value: "comercial", label: "Ventas de Calle / Campo" },
                        { value: "taquilla", label: "Taquilla Presencial" },
                        { value: "planificacion", label: "Planificación / Agenda" },
                        { value: "externo", label: "Aliados Externos" },
                        { value: "virtual", label: "Canal Digital / Remoto" },
                      ]}
                      onChange={(val) => setCanalForm({ ...canalForm, tipo: val })}
                      className="font-medium text-neutral-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono text-neutral-500 mb-1">
                      Descripción del Canal
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Detalles sobre este canal de comercialización"
                      value={canalForm.descripcion}
                      onChange={(e) => setCanalForm({ ...canalForm, descripcion: e.target.value })}
                      className="w-full border border-neutral-200 rounded p-2 text-neutral-900 focus:outline-none focus:border-neutral-950 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono text-neutral-500 mb-1">
                      Porcentaje de Comisión (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      placeholder="0.0"
                      value={canalForm.comisionPct}
                      onChange={(e) =>
                        setCanalForm({ ...canalForm, comisionPct: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full border-b border-neutral-300 py-1.5 text-neutral-900 focus:outline-none focus:border-neutral-950 transition-colors font-mono"
                    />
                  </div>
                  <div className="pt-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={canalForm.activo}
                        onChange={(e) => setCanalForm({ ...canalForm, activo: e.target.checked })}
                        className="rounded border-neutral-300 text-neutral-900 focus:ring-0"
                      />
                      <span className="text-neutral-700 font-medium">Canal Activo en Dashboard</span>
                    </label>
                  </div>
                </>
              )}

              {/* Action Buttons: Strict typographic clean rule (No frames or boxy buttons) */}
              <div className="pt-4 flex items-center justify-end gap-5 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer select-none"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="text-neutral-900 hover:text-neutral-600 font-bold transition-colors cursor-pointer select-none text-xs"
                >
                  {saving ? "Guardando..." : editingId ? "Actualizar" : "Crear"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* CUSTOM IN-APP CONFIRMATION DIALOG (Cero alertas del navegador)  */}
      {/* ============================================================= */}
      {deleteConfirmation && deleteConfirmation.isOpen && (
        <div
          className="fixed inset-0 bg-neutral-950/30 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setDeleteConfirmation(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl border border-neutral-200/80 w-full max-w-sm p-6 animate-in zoom-in-95 fade-in duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <span className="text-xs font-mono tracking-normal text-neutral-400">
                Confirmar eliminación
              </span>
              <button
                type="button"
                onClick={() => setDeleteConfirmation(null)}
                className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4 stroke-[1.5]" />
              </button>
            </div>

            <div className="py-4 space-y-2">
              <p className="text-sm font-medium text-neutral-900">
                ¿Deseas eliminar &quot;{deleteConfirmation.name}&quot;?
              </p>
              <p className="text-xs text-neutral-500 font-sans leading-relaxed">
                {deleteConfirmation.entityType === "colaborador"
                  ? "Esta acción desvinculará sus configuraciones y alias personalizados del catálogo de personal."
                  : "Esta acción eliminará el registro de forma permanente del catálogo de administración."}
              </p>
            </div>

            <div className="pt-3 flex items-center justify-end gap-5 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setDeleteConfirmation(null)}
                className="text-xs text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={executeDelete}
                className="text-xs text-neutral-900 hover:text-red-600 font-bold transition-colors cursor-pointer"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={null}>
      <AdminPageContent />
    </Suspense>
  );
}
