"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  PenLine,
  X,
  RotateCw,
  Search,
  Check,
} from "lucide-react";
import { AdminDropdown } from "@/components/admin/admin-dropdown";
import {
  AdvisorType,
  AdvisorOverridesMap,
  AdvisorCustomConfig,
  TechnicianOverridesMap,
  TechnicianCustomConfig,
  MemberStatus,
  StaffDepartment,
  classifyAdvisor,
  resolveAdvisorOffice,
  findAdvisorOverride,
  findTechnicianOverride,
  stripAccents,
  KNOWN_OFFICES,
} from "@/lib/normalization";
import {
  fetchInstallations,
  clearDashboardDataCache,
  Installation,
  Solicitud,
} from "@/lib/dashboard-data";
import { cn, formatNumber, formatProperCase } from "@/lib/utils";

export const KNOWN_SQUADS = [
  "Equipo A",
  "Equipo B",
  "Equipo C",
  "Equipo D",
  "Equipo E",
  "Equipo F",
  "Equipo G",
  "Equipo H",
  "Equipo I",
  "Equipo J",
  "Equipo K",
  "Equipo L",
  "Equipo M",
  "Sin Equipo / Flotante",
] as const;

export interface PersonnelItem {
  name: string;
  role: "asesor" | "tecnico";
  roleLabel: "Asesor" | "Técnico";
  currentType?: AdvisorType;
  currentOffice?: string;
  currentTeam?: string;
  status: MemberStatus;
  department: string;
  installations: number;
  mergedWith?: string;
  isModified: boolean;
  assignmentLabel: string;
}

interface DepartamentoRef {
  id: string;
  nombre: string;
}

interface SedeRef {
  id: string;
  nombre: string;
}

interface PersonalTabContentProps {
  departamentos: DepartamentoRef[];
  sedes: SedeRef[];
  searchQuery: string;
  onSearchQueryChange?: (q: string) => void;
  onTotalCountChange?: (count: number) => void;
  onRequestDelete: (name: string, role: "asesor" | "tecnico") => void;
  showToast: (text: string, type?: "success" | "error") => void;
  onOpenEdit?: (item: PersonnelItem) => void;
  refreshTrigger?: number;
  externalSaving?: boolean;
}

export function PersonalTabContent({
  departamentos,
  sedes,
  searchQuery,
  onSearchQueryChange,
  onTotalCountChange,
  onRequestDelete,
  showToast,
  onOpenEdit,
  refreshTrigger = 0,
}: PersonalTabContentProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [subFilterTab, setSubFilterTab] = useState<
    "all" | "asesores" | "tecnicos" | "fijos" | "ex" | "unificados"
  >("all");

  // Raw dataset counts
  const [advisorsList, setAdvisorsList] = useState<{ name: string; value: number }[]>([]);
  const [techniciansList, setTechniciansList] = useState<{ name: string; value: number; equipo?: string }[]>([]);

  // Configurations
  const [advisorOverrides, setAdvisorOverrides] = useState<AdvisorOverridesMap>({});
  const [advisorAliases, setAdvisorAliases] = useState<Record<string, string>>({});
  const [techOverrides, setTechOverrides] = useState<TechnicianOverridesMap>({});
  const [techAliases, setTechAliases] = useState<Record<string, string>>({});

  // Merge alias inline state
  const [mergingItem, setMergingItem] = useState<{ type: "advisor" | "tech"; name: string } | null>(null);
  const [selectedMergeTarget, setSelectedMergeTarget] = useState<string>("");

  // Pagination states
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Load config and sheet data
  const loadPersonalData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch server configurations
      const configRes = await fetch(`/api/advisors/config?t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      }).then((r) => r.json()).catch(() => null);

      let currentAdvOverrides: AdvisorOverridesMap = configRes?.success ? (configRes.overrides || {}) : {};
      let currentAdvAliases: Record<string, string> = configRes?.success ? (configRes.aliases || {}) : {};
      let currentTechOv: TechnicianOverridesMap = configRes?.success ? (configRes.technicianOverrides || {}) : {};
      let currentTechAl: Record<string, string> = configRes?.success ? (configRes.technicianAliases || {}) : {};

      if (typeof window !== "undefined" && (!configRes?.success || Object.keys(currentAdvOverrides).length === 0)) {
        try {
          const o = localStorage.getItem("buildly_advisor_overrides");
          const a = localStorage.getItem("buildly_advisor_aliases");
          const to = localStorage.getItem("buildly_tech_overrides");
          const ta = localStorage.getItem("buildly_tech_aliases");
          if (o && Object.keys(currentAdvOverrides).length === 0) currentAdvOverrides = JSON.parse(o);
          if (a && Object.keys(currentAdvAliases).length === 0) currentAdvAliases = JSON.parse(a);
          if (to && Object.keys(currentTechOv).length === 0) currentTechOv = JSON.parse(to);
          if (ta && Object.keys(currentTechAl).length === 0) currentTechAl = JSON.parse(ta);
        } catch (e) {}
      }

      setAdvisorOverrides(currentAdvOverrides);
      setAdvisorAliases(currentAdvAliases);
      setTechOverrides(currentTechOv);
      setTechAliases(currentTechAl);

      // 2. Fetch sheet dataset to extract advisors and technicians
      const dataRes = await fetchInstallations(currentAdvOverrides, currentAdvAliases, currentTechOv, currentTechAl);
      if (dataRes && "raw" in dataRes) {
        const raw = (dataRes.raw || []) as Installation[];
        const rawSolicitudes = (dataRes.rawSolicitudes || []) as Solicitud[];

        // Build unique advisors with totals
        const advMap = new Map<string, number>();
        raw.forEach((item) => {
          if (item.asesor) advMap.set(item.asesor, (advMap.get(item.asesor) || 0) + 1);
        });
        rawSolicitudes.forEach((item) => {
          if (item.asesor && !advMap.has(item.asesor)) advMap.set(item.asesor, 0);
        });
        // Ensure all configured advisors exist in the map even with 0 volume
        Object.keys(currentAdvOverrides).forEach((name) => {
          if (!advMap.has(name)) advMap.set(name, 0);
        });

        const advArray = Array.from(advMap.entries()).map(([name, value]) => ({ name, value }));
        advArray.sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
        setAdvisorsList(advArray);

        // Build unique technicians with totals
        const techMap = new Map<string, { value: number; equipo?: string }>();
        raw.forEach((item) => {
          if (item.tecnico_1) {
            const cur = techMap.get(item.tecnico_1) || { value: 0 };
            techMap.set(item.tecnico_1, { value: cur.value + 1, equipo: item.equipo });
          }
          if (item.tecnico_2) {
            const cur = techMap.get(item.tecnico_2) || { value: 0 };
            techMap.set(item.tecnico_2, { value: cur.value + 1, equipo: item.equipo });
          }
        });
        // Ensure all configured technicians exist in the map even with 0 volume
        Object.keys(currentTechOv).forEach((name) => {
          if (!techMap.has(name)) techMap.set(name, { value: 0, equipo: currentTechOv[name]?.team });
        });

        const techArray = Array.from(techMap.entries()).map(([name, stats]) => ({
          name,
          value: stats.value,
          equipo: stats.equipo,
        }));
        techArray.sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
        setTechniciansList(techArray);
      }
    } catch (err: any) {
      console.error("Error cargando personal:", err);
      showToast("Error al sincronizar datos de personal", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadPersonalData();
  }, [loadPersonalData, refreshTrigger]);

  // Combined available office list (from dynamic sedes and known offices)
  const availableOffices = useMemo(() => {
    const list = new Set<string>();
    sedes.forEach((s) => s.nombre && list.add(s.nombre));
    KNOWN_OFFICES.forEach((o) => list.add(o));
    return Array.from(list);
  }, [sedes]);

  // Combined available departments
  const availableDepartments = useMemo(() => {
    if (departamentos && departamentos.length > 0) {
      return departamentos.map((d) => ({ value: d.id, label: d.nombre }));
    }
    return [
      { value: "ventas", label: "Comercialización" },
      { value: "tecnico", label: "Instalaciones" },
      { value: "planificacion", label: "Planificación" },
      { value: "soporte", label: "Soporte Técnico" },
      { value: "administracion", label: "Administración" },
      { value: "atencion_cliente", label: "Atención al Cliente" },
    ];
  }, [departamentos]);

  // Prepare unified personnel items
  const allPersonnelItems: PersonnelItem[] = useMemo(() => {
    // 1. Advisors
    const advisorItems: PersonnelItem[] = advisorsList.map((adv) => {
      const defaultType = classifyAdvisor(adv.name);
      const defaultOffice = resolveAdvisorOffice(adv.name);
      const overrideMatch = findAdvisorOverride(adv.name, advisorOverrides);
      const cfg = overrideMatch?.config;
      const isEx = cfg?.isExCollaborator !== undefined ? Boolean(cfg.isExCollaborator) : cfg?.status === "ex";
      const status: MemberStatus = cfg?.status || (isEx ? "ex" : "fijo");
      const department: string = cfg?.department || "ventas";
      const currentType: AdvisorType = cfg?.type || defaultType;
      const currentOffice = cfg?.office || defaultOffice || (currentType === "taquilla" ? "Valle" : undefined);
      const isModified = Boolean(overrideMatch);
      const mergedWith = advisorAliases[adv.name] || advisorAliases[adv.name.toLowerCase()];

      const assignmentLabel =
        currentType === "taquilla"
          ? `Taquilla (${currentOffice || "Valle"})`
          : currentType === "comercial"
          ? "Ventas de Calle"
          : currentType === "planificacion"
          ? "Planificación"
          : "Externo";

      return {
        name: adv.name,
        role: "asesor" as const,
        roleLabel: "Asesor" as const,
        currentType,
        currentOffice,
        status,
        department,
        installations: adv.value,
        mergedWith,
        isModified,
        assignmentLabel,
        defaultType,
        defaultOffice,
      };
    });

    // 2. Technicians
    const techItems: PersonnelItem[] = techniciansList.map((tech) => {
      const defaultTeam = tech.equipo || "Equipo A";
      const overrideMatch = findTechnicianOverride(tech.name, techOverrides);
      const cfg = overrideMatch?.config;
      const isEx = cfg?.isExCollaborator !== undefined ? Boolean(cfg.isExCollaborator) : cfg?.status === "ex";
      const status: MemberStatus = cfg?.status || (isEx ? "ex" : "fijo");
      const department: string = cfg?.department || "tecnico";
      const currentTeam = cfg?.team || defaultTeam;
      const isModified = Boolean(overrideMatch);
      const mergedWith = techAliases[tech.name] || techAliases[tech.name.toLowerCase()];

      return {
        name: tech.name,
        role: "tecnico" as const,
        roleLabel: "Técnico" as const,
        currentTeam,
        status,
        department,
        installations: tech.value,
        mergedWith,
        isModified,
        assignmentLabel: currentTeam || "Equipo A",
      };
    });

    return [...advisorItems, ...techItems].sort(
      (a, b) => b.installations - a.installations || a.name.localeCompare(b.name)
    );
  }, [advisorsList, techniciansList, advisorOverrides, advisorAliases, techOverrides, techAliases]);

  // Report count to parent
  useEffect(() => {
    if (onTotalCountChange) {
      onTotalCountChange(allPersonnelItems.length);
    }
  }, [allPersonnelItems.length, onTotalCountChange]);

  // Filtered personnel items
  const filteredPersonnelItems = useMemo(() => {
    return allPersonnelItems.filter((item) => {
      // 1. Search filter
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matchName = item.name.toLowerCase().includes(q);
        const matchRole = item.roleLabel.toLowerCase().includes(q);
        const matchAssignment = item.assignmentLabel.toLowerCase().includes(q);
        const matchDept = item.department.toLowerCase().includes(q);
        if (!matchName && !matchRole && !matchAssignment && !matchDept) return false;
      }

      // 2. Category / condition tab filter
      if (subFilterTab === "asesores" && item.role !== "asesor") return false;
      if (subFilterTab === "tecnicos" && item.role !== "tecnico") return false;
      if (subFilterTab === "fijos" && item.status !== "fijo") return false;
      if (subFilterTab === "ex" && item.status !== "ex") return false;
      if (subFilterTab === "unificados" && !item.mergedWith) return false;

      return true;
    });
  }, [allPersonnelItems, searchQuery, subFilterTab]);

  // Reset page when filter/search/pageSize changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, subFilterTab, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredPersonnelItems.length / (pageSize || 1)));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedPersonnelItems = useMemo(() => {
    if (pageSize === 0) return filteredPersonnelItems;
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredPersonnelItems.slice(start, start + pageSize);
  }, [filteredPersonnelItems, safeCurrentPage, pageSize]);

  // Inline mutations
  const handleUpdateAdvisor = (name: string, patch: Partial<AdvisorCustomConfig>) => {
    setAdvisorOverrides((prev) => {
      const match = findAdvisorOverride(name, prev);
      const targetKey = match ? match.key : name;
      const base: AdvisorCustomConfig = match?.config || {
        type: classifyAdvisor(name),
        office: resolveAdvisorOffice(name),
        status: "fijo",
        department: "ventas",
        updatedAt: new Date().toISOString(),
      };
      return {
        ...prev,
        [targetKey]: { ...base, ...patch, updatedAt: new Date().toISOString() },
      };
    });
  };

  const handleUpdateTech = (name: string, patch: Partial<TechnicianCustomConfig>) => {
    setTechOverrides((prev) => {
      const match = findTechnicianOverride(name, prev);
      const targetKey = match ? match.key : name;
      const base: TechnicianCustomConfig = match?.config || {
        team: "Equipo A",
        status: "fijo",
        department: "tecnico",
        updatedAt: new Date().toISOString(),
      };
      return {
        ...prev,
        [targetKey]: { ...base, ...patch, updatedAt: new Date().toISOString() },
      };
    });
  };

  const handleResetSingleAdvisor = (name: string) => {
    setAdvisorOverrides((prev) => {
      const next = { ...prev };
      const lower = name.toLowerCase().trim();
      const stripped = stripAccents(name).trim();
      Object.keys(next).forEach((k) => {
        if (k.toLowerCase().trim() === lower || stripAccents(k).trim() === stripped) {
          delete next[k];
        }
      });
      return next;
    });
    showToast(`Configuración de "${formatProperCase(name)}" restablecida`);
  };

  const handleResetSingleTech = (name: string) => {
    setTechOverrides((prev) => {
      const next = { ...prev };
      const lower = name.toLowerCase().trim();
      const stripped = stripAccents(name).trim();
      Object.keys(next).forEach((k) => {
        if (k.toLowerCase().trim() === lower || stripAccents(k).trim() === stripped) {
          delete next[k];
        }
      });
      return next;
    });
    showToast(`Configuración de "${formatProperCase(name)}" restablecida`);
  };

  // Merge alias actions
  const handleOpenMerge = (type: "advisor" | "tech", name: string) => {
    setMergingItem({ type, name });
    const pool = type === "advisor" ? advisorsList.map((a) => a.name) : techniciansList.map((t) => t.name);
    setSelectedMergeTarget(pool.find((n) => n !== name) || "");
  };

  const handleConfirmMerge = async () => {
    if (!mergingItem || !selectedMergeTarget || selectedMergeTarget === mergingItem.name) return;

    let updatedAliases = { ...advisorAliases };
    let updatedTechAliases = { ...techAliases };

    if (mergingItem.type === "advisor") {
      updatedAliases[mergingItem.name] = selectedMergeTarget;
      setAdvisorAliases(updatedAliases);
    } else {
      updatedTechAliases[mergingItem.name] = selectedMergeTarget;
      setTechAliases(updatedTechAliases);
    }

    setMergingItem(null);
    setSelectedMergeTarget("");
    showToast(`"${formatProperCase(mergingItem.name)}" unificado como alias`);

    // Auto persist merge
    try {
      await fetch("/api/advisors/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overrides: advisorOverrides,
          aliases: updatedAliases,
          technicianOverrides: techOverrides,
          technicianAliases: updatedTechAliases,
        }),
      });
      clearDashboardDataCache();
    } catch (e) {
      console.error(e);
    }
  };

  const handleUnmerge = async (type: "advisor" | "tech", name: string) => {
    let updatedAliases = { ...advisorAliases };
    let updatedTechAliases = { ...techAliases };

    if (type === "advisor") {
      delete updatedAliases[name];
      delete updatedAliases[name.toLowerCase()];
      setAdvisorAliases(updatedAliases);
    } else {
      delete updatedTechAliases[name];
      delete updatedTechAliases[name.toLowerCase()];
      setTechAliases(updatedTechAliases);
    }

    showToast(`Desvinculado alias de "${formatProperCase(name)}"`);

    try {
      await fetch("/api/advisors/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overrides: advisorOverrides,
          aliases: updatedAliases,
          technicianOverrides: techOverrides,
          technicianAliases: updatedTechAliases,
        }),
      });
      clearDashboardDataCache();
    } catch (e) {
      console.error(e);
    }
  };

  // Save all personnel modifications
  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const payload = {
        overrides: advisorOverrides,
        aliases: advisorAliases,
        technicianOverrides: techOverrides,
        technicianAliases: techAliases,
      };

      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("buildly_advisor_overrides", JSON.stringify(payload.overrides));
          localStorage.setItem("buildly_advisor_aliases", JSON.stringify(payload.aliases));
          localStorage.setItem("buildly_tech_overrides", JSON.stringify(payload.technicianOverrides));
          localStorage.setItem("buildly_tech_aliases", JSON.stringify(payload.technicianAliases));
        } catch (e) {}
      }

      const res = await fetch("/api/advisors/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const resJson = await res.json();
      if (!resJson.success) throw new Error(resJson.error || "Error al guardar personal");

      clearDashboardDataCache();
      showToast("Configuración de personal guardada exitosamente");
    } catch (err: any) {
      showToast(err.message || "Error al guardar personal", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Quick category tabs and Save button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-neutral-200/80 pb-3">
        {/* Category condition tabs */}
        <div className="flex items-center gap-4 text-xs font-mono text-neutral-400 overflow-x-auto no-scrollbar whitespace-nowrap scroll-smooth shrink-0 -mx-4 px-4 sm:mx-0 sm:px-0">
          <button
            type="button"
            onClick={() => setSubFilterTab("all")}
            className={cn(
              "shrink-0 min-h-[40px] py-2 px-1 cursor-pointer transition-colors inline-flex items-center gap-1.5 select-none",
              subFilterTab === "all" ? "text-neutral-950 font-semibold" : "hover:text-neutral-800"
            )}
          >
            <span>Todos</span>
            <span className="text-[10px] text-neutral-400">({allPersonnelItems.length})</span>
            {subFilterTab === "all" && <span className="w-1.5 h-1.5 rounded-full bg-neutral-950 shrink-0" />}
          </button>

          <button
            type="button"
            onClick={() => setSubFilterTab("asesores")}
            className={cn(
              "shrink-0 min-h-[40px] py-2 px-1 cursor-pointer transition-colors inline-flex items-center gap-1.5 select-none",
              subFilterTab === "asesores" ? "text-neutral-950 font-semibold" : "hover:text-neutral-800"
            )}
          >
            <span>Asesores</span>
            <span className="text-[10px] text-neutral-400">({advisorsList.length})</span>
            {subFilterTab === "asesores" && <span className="w-1.5 h-1.5 rounded-full bg-neutral-950 shrink-0" />}
          </button>

          <button
            type="button"
            onClick={() => setSubFilterTab("tecnicos")}
            className={cn(
              "shrink-0 min-h-[40px] py-2 px-1 cursor-pointer transition-colors inline-flex items-center gap-1.5 select-none",
              subFilterTab === "tecnicos" ? "text-neutral-950 font-semibold" : "hover:text-neutral-800"
            )}
          >
            <span>Técnicos</span>
            <span className="text-[10px] text-neutral-400">({techniciansList.length})</span>
            {subFilterTab === "tecnicos" && <span className="w-1.5 h-1.5 rounded-full bg-neutral-950 shrink-0" />}
          </button>

          <button
            type="button"
            onClick={() => setSubFilterTab("fijos")}
            className={cn(
              "shrink-0 min-h-[40px] py-2 px-1 cursor-pointer transition-colors inline-flex items-center gap-1.5 select-none",
              subFilterTab === "fijos" ? "text-neutral-950 font-semibold" : "hover:text-neutral-800"
            )}
          >
            <span>Fijos</span>
            {subFilterTab === "fijos" && <span className="w-1.5 h-1.5 rounded-full bg-neutral-950 shrink-0" />}
          </button>

          <button
            type="button"
            onClick={() => setSubFilterTab("ex")}
            className={cn(
              "shrink-0 min-h-[40px] py-2 px-1 cursor-pointer transition-colors inline-flex items-center gap-1.5 select-none",
              subFilterTab === "ex" ? "text-neutral-950 font-semibold" : "hover:text-neutral-800"
            )}
          >
            <span>Ex colaboradores</span>
            {subFilterTab === "ex" && <span className="w-1.5 h-1.5 rounded-full bg-neutral-950 shrink-0" />}
          </button>

          <button
            type="button"
            onClick={() => setSubFilterTab("unificados")}
            className={cn(
              "shrink-0 min-h-[40px] py-2 px-1 cursor-pointer transition-colors inline-flex items-center gap-1.5 select-none",
              subFilterTab === "unificados" ? "text-neutral-950 font-semibold" : "hover:text-neutral-800"
            )}
          >
            <span>Unificados</span>
            {subFilterTab === "unificados" && <span className="w-1.5 h-1.5 rounded-full bg-neutral-950 shrink-0" />}
          </button>
        </div>

        {/* Right Action: Search input & Minimalist Save Button (Clean, unboxed, icon-only) */}
        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
          {onSearchQueryChange && (
            <div className="flex items-center gap-2 text-xs text-neutral-400 border-b border-neutral-200 focus-within:border-neutral-900 py-1 transition-colors flex-1 sm:w-52 sm:flex-initial">
              <Search className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              <input
                type="text"
                placeholder="Buscar colaborador..."
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                className="bg-transparent text-sm sm:text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none w-full font-sans"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchQueryChange("")}
                  className="text-neutral-400 hover:text-neutral-900 cursor-pointer p-1 -m-0.5"
                  title="Limpiar búsqueda"
                  aria-label="Limpiar búsqueda"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={handleSaveAll}
            disabled={saving}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2.5 text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer disabled:opacity-40 select-none shrink-0"
            title="Guardar cambios"
            aria-label="Guardar cambios"
          >
            {saving ? (
              <RotateCw className="w-4 h-4 animate-spin text-neutral-900" />
            ) : (
              <Check className="w-4 h-4 stroke-[2]" />
            )}
          </button>
        </div>
      </div>

      {/* Inline Unification Banner (Minimalist Typographic) */}
      {mergingItem && (
        <div className="py-2.5 px-1 border-b border-neutral-200/80 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
          <div>
            <span className="font-semibold text-neutral-900">
              Unificar &quot;{mergingItem.name}&quot; como alias de:
            </span>
            <span className="text-neutral-400 block text-[11px] pt-0.5">
              Todos sus registros se atribuirán al personal seleccionado.
            </span>
          </div>
          <div className="flex items-center gap-4">
            <AdminDropdown<string>
              value={selectedMergeTarget}
              options={(mergingItem.type === "advisor" ? advisorsList : techniciansList)
                .filter((i) => i.name !== mergingItem.name)
                .map((i) => ({ value: i.name, label: formatProperCase(i.name) }))}
              onChange={(val) => setSelectedMergeTarget(val)}
              searchPlaceholder="Buscar por nombre..."
            />
            <button
              type="button"
              onClick={handleConfirmMerge}
              className="text-neutral-900 font-semibold hover:underline cursor-pointer"
            >
              Confirmar
            </button>
            <button
              type="button"
              onClick={() => setMergingItem(null)}
              className="text-neutral-400 hover:text-neutral-700 cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Main Personnel Table */}
      {loading ? (
        <div className="py-20 text-center text-xs font-mono text-neutral-400 flex items-center justify-center gap-2">
          <RotateCw className="w-3.5 h-3.5 animate-spin" />
          <span>Cargando colaboradores y asignaciones...</span>
        </div>
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-neutral-200/80 text-neutral-400 font-normal text-[11px]">
                <th className="py-3 pr-4 font-normal">Colaborador</th>
                <th className="py-3 px-4 font-normal">Rol</th>
                <th className="py-3 px-4 font-normal">Canal / Cuadrilla / Sede</th>
                <th className="py-3 px-4 font-normal">Condición Laboral</th>
                <th className="py-3 px-4 font-normal">Departamento</th>
                <th className="py-3 px-4 text-right font-normal">Volumen</th>
                <th className="py-3 pl-4 text-right font-normal">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredPersonnelItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-neutral-400">
                    No se encontraron colaboradores coincidentes
                  </td>
                </tr>
              ) : (
                paginatedPersonnelItems.map((item) => (
                  <tr
                    key={`${item.role}-${item.name}`}
                    className="hover:bg-neutral-50/50 transition-colors group"
                  >
                    {/* Name & Alias subtitle */}
                    <td className="py-3.5 pr-4 font-sans">
                      <div className="font-medium text-neutral-900 flex items-center gap-2">
                        <span>{formatProperCase(item.name)}</span>
                        {item.isModified && (
                          <span
                            className="w-1.5 h-1.5 rounded-full bg-neutral-900 shrink-0"
                            title="Personalizado"
                          />
                        )}
                      </div>
                      {item.mergedWith && (
                        <div className="text-[10px] font-mono text-neutral-400 flex items-center gap-1.5 pt-0.5">
                          <span>↳ unificado con {formatProperCase(item.mergedWith)}</span>
                          <button
                            type="button"
                            onClick={() =>
                              handleUnmerge(item.role === "asesor" ? "advisor" : "tech", item.name)
                            }
                            className="text-neutral-400 hover:text-neutral-900 underline cursor-pointer"
                            title="Separar alias"
                          >
                            deshacer
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Role label */}
                    <td className="py-3.5 px-4 font-sans">
                      <span className="text-[11px] font-mono font-medium px-1.5 py-0.5 rounded text-neutral-700 bg-neutral-100">
                        {item.roleLabel}
                      </span>
                    </td>

                    {/* Channel / Cuadrilla / Sede */}
                    <td className="py-3.5 px-4">
                      {item.role === "asesor" ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <AdminDropdown<AdvisorType>
                            value={item.currentType || "comercial"}
                            options={[
                              { value: "comercial", label: "Ventas de Calle" },
                              { value: "taquilla", label: "Taquilla Presencial" },
                              { value: "planificacion", label: "Planificación" },
                              { value: "externo", label: "Externo / Aliado" },
                            ]}
                            onChange={(val) => handleUpdateAdvisor(item.name, { type: val })}
                          />
                          {item.currentType === "taquilla" && (
                            <AdminDropdown<string>
                              value={item.currentOffice || "Valle"}
                              options={availableOffices.map((s) => ({ value: s, label: s }))}
                              onChange={(val) => handleUpdateAdvisor(item.name, { office: val })}
                              className="text-neutral-500 font-normal"
                            />
                          )}
                        </div>
                      ) : (
                        <AdminDropdown<string>
                          value={item.currentTeam || "Equipo A"}
                          options={KNOWN_SQUADS.map((s) => ({ value: s, label: s }))}
                          onChange={(val) => handleUpdateTech(item.name, { team: val })}
                        />
                      )}
                    </td>

                    {/* Labor condition */}
                    <td className="py-3.5 px-4">
                      <AdminDropdown<MemberStatus>
                        value={item.status}
                        options={[
                          { value: "fijo", label: "Fijo" },
                          { value: "ex", label: "Ex Colaborador" },
                          { value: "otro_departamento", label: "Otro Departamento" },
                        ]}
                        onChange={(val) => {
                          if (item.role === "asesor") {
                            handleUpdateAdvisor(item.name, {
                              status: val,
                              isExCollaborator: val === "ex",
                            });
                          } else {
                            handleUpdateTech(item.name, {
                              status: val,
                              isExCollaborator: val === "ex",
                            });
                          }
                        }}
                      />
                    </td>

                    {/* Department */}
                    <td className="py-3.5 px-4">
                      <AdminDropdown<string>
                        value={item.department}
                        options={availableDepartments}
                        onChange={(val) => {
                          if (item.role === "asesor") {
                            handleUpdateAdvisor(item.name, {
                              department: val as StaffDepartment,
                            });
                          } else {
                            handleUpdateTech(item.name, {
                              department: val as StaffDepartment,
                            });
                          }
                        }}
                        className="text-neutral-600"
                      />
                    </td>

                    {/* Volume */}
                    <td className="py-3.5 px-4 text-right font-mono text-neutral-600">
                      {formatNumber(item.installations)}
                    </td>

                    {/* Row Actions: Reveal on hover with fine icons and text */}
                    <td className="py-3.5 pl-4 text-right">
                      <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                        {onOpenEdit && (
                          <button
                            type="button"
                            onClick={() => onOpenEdit(item)}
                            className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer p-0.5"
                            title="Editar colaborador"
                          >
                            <PenLine className="w-3.5 h-3.5 stroke-[1.25]" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            handleOpenMerge(item.role === "asesor" ? "advisor" : "tech", item.name)
                          }
                          className="text-[11px] text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
                          title="Unificar este nombre como alias"
                        >
                          Unificar
                        </button>
                        {item.isModified && (
                          <button
                            type="button"
                            onClick={() =>
                              item.role === "asesor"
                                ? handleResetSingleAdvisor(item.name)
                                : handleResetSingleTech(item.name)
                            }
                            className="text-[11px] text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
                            title="Restablecer valores por defecto"
                          >
                            Revertir
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onRequestDelete(item.name, item.role)}
                          className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer p-0.5"
                          title="Eliminar o desvincular colaborador"
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

          {/* Mobile Personnel Card List - No horizontal scrollbar */}
          <div className="md:hidden divide-y divide-neutral-100 font-sans">
            {filteredPersonnelItems.length === 0 ? (
              <div className="text-center py-12 text-neutral-400 text-xs">
                No se encontraron colaboradores coincidentes
              </div>
            ) : (
              paginatedPersonnelItems.map((item) => (
                <div key={`${item.role}-${item.name}`} className="py-3.5 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-neutral-900 text-xs flex items-center gap-1.5">
                        <span>{formatProperCase(item.name)}</span>
                        {item.isModified && (
                          <span className="w-1.5 h-1.5 rounded-full bg-neutral-900 shrink-0" title="Personalizado" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-neutral-100 text-neutral-700">
                          {item.roleLabel}
                        </span>
                        <span className="text-[10px] font-mono text-neutral-400">
                          {formatNumber(item.installations)} inst.
                        </span>
                      </div>
                      {item.mergedWith && (
                        <div className="text-[10px] font-mono text-neutral-400 flex items-center gap-1 mt-0.5">
                          <span>↳ unificado con {formatProperCase(item.mergedWith)}</span>
                          <button
                            type="button"
                            onClick={() => handleUnmerge(item.role === "asesor" ? "advisor" : "tech", item.name)}
                            className="text-neutral-500 underline cursor-pointer"
                          >
                            deshacer
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Touch Action Buttons */}
                    <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                      {onOpenEdit && (
                        <button
                          type="button"
                          onClick={() => onOpenEdit(item)}
                          className="min-w-[36px] min-h-[36px] p-2 flex items-center justify-center text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
                          title="Editar"
                        >
                          <PenLine className="w-3.5 h-3.5 stroke-[1.25]" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleOpenMerge(item.role === "asesor" ? "advisor" : "tech", item.name)}
                        className="min-h-[36px] px-2 flex items-center justify-center text-[11px] text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
                      >
                        Unificar
                      </button>
                      {item.isModified && (
                        <button
                          type="button"
                          onClick={() =>
                            item.role === "asesor"
                              ? handleResetSingleAdvisor(item.name)
                              : handleResetSingleTech(item.name)
                          }
                          className="min-h-[36px] px-2 flex items-center justify-center text-[11px] text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
                        >
                          Revertir
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onRequestDelete(item.name, item.role)}
                        className="min-w-[36px] min-h-[36px] p-2 flex items-center justify-center text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
                        title="Eliminar"
                      >
                        <X className="w-3.5 h-3.5 stroke-[1.5]" />
                      </button>
                    </div>
                  </div>

                  {/* Dropdowns in responsive grid */}
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-neutral-50 text-xs">
                    {item.role === "asesor" ? (
                      <div>
                        <span className="text-[10px] text-neutral-400 block mb-0.5 font-mono">Tipo</span>
                        <AdminDropdown<AdvisorType>
                          value={item.currentType || "comercial"}
                          options={[
                            { value: "comercial", label: "Ventas Calle" },
                            { value: "taquilla", label: "Taquilla" },
                            { value: "planificacion", label: "Planif." },
                            { value: "externo", label: "Externo" },
                          ]}
                          onChange={(val) => {
                            handleUpdateAdvisor(item.name, {
                              type: val,
                              office: val === "taquilla" ? item.currentOffice || KNOWN_OFFICES[0] : undefined,
                            });
                          }}
                        />
                      </div>
                    ) : (
                      <div>
                        <span className="text-[10px] text-neutral-400 block mb-0.5 font-mono">Cuadrilla</span>
                        <AdminDropdown<string>
                          value={item.currentTeam || KNOWN_SQUADS[0]}
                          options={KNOWN_SQUADS.map((s) => ({ value: s, label: s }))}
                          onChange={(val) => handleUpdateTech(item.name, { team: val })}
                        />
                      </div>
                    )}

                    <div>
                      <span className="text-[10px] text-neutral-400 block mb-0.5 font-mono">Condición</span>
                      <AdminDropdown<MemberStatus>
                        value={item.status}
                        options={[
                          { value: "fijo", label: "Fijo" },
                          { value: "ex", label: "Ex Colab." },
                          { value: "otro_departamento", label: "Otro Dpto" },
                        ]}
                        onChange={(val) => {
                          if (item.role === "asesor") {
                            handleUpdateAdvisor(item.name, { status: val, isExCollaborator: val === "ex" });
                          } else {
                            handleUpdateTech(item.name, { status: val, isExCollaborator: val === "ex" });
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Subtle Typographic Pagination (Strict Rule 1: No boxed buttons) */}
          {filteredPersonnelItems.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-neutral-100 text-xs font-sans text-neutral-500">
              <div className="flex items-center gap-3">
                <span>
                  Mostrando {pageSize === 0 ? 1 : (safeCurrentPage - 1) * pageSize + 1}–
                  {pageSize === 0
                    ? filteredPersonnelItems.length
                    : Math.min(safeCurrentPage * pageSize, filteredPersonnelItems.length)}{" "}
                  de {filteredPersonnelItems.length}
                </span>

                <div className="flex items-center gap-1.5 text-neutral-400">
                  <span>·</span>
                  <span>Ver:</span>
                  {[25, 50, 0].map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setPageSize(size)}
                      className={cn(
                        "cursor-pointer transition-colors p-0.5 select-none",
                        pageSize === size
                          ? "text-neutral-950 font-semibold underline"
                          : "text-neutral-400 hover:text-neutral-800"
                      )}
                    >
                      {size === 0 ? "Todos" : size}
                    </button>
                  ))}
                </div>
              </div>

              {pageSize > 0 && totalPages > 1 && (
                <div className="flex items-center gap-4 select-none">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={safeCurrentPage <= 1}
                    className="cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:text-neutral-950 font-medium"
                  >
                    Anterior
                  </button>

                  <span className="font-mono text-[11px] text-neutral-400">
                    {safeCurrentPage} / {totalPages}
                  </span>

                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safeCurrentPage >= totalPages}
                    className="cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:text-neutral-950 font-medium"
                  >
                    Siguiente
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
