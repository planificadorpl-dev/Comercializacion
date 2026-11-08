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
import { CustomDropdown } from "@/components/ui/custom-dropdown";
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

  // Advanced filter & Batch selection states
  const [filterSquadOrOffice, setFilterSquadOrOffice] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

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

  // Quick summary KPIs of Personnel (Strict Rules 5 & 6: Clean typography, zero boxed frames)
  const stats = useMemo(() => {
    const total = allPersonnelItems.length;
    const advisorsComercial = allPersonnelItems.filter(
      (p) => p.role === "asesor" && p.currentType === "comercial" && p.status !== "ex"
    ).length;
    const advisorsTaquilla = allPersonnelItems.filter(
      (p) => p.role === "asesor" && p.currentType === "taquilla" && p.status !== "ex"
    ).length;
    const technicians = allPersonnelItems.filter(
      (p) => p.role === "tecnico" && p.status !== "ex"
    ).length;
    const exMembers = allPersonnelItems.filter((p) => p.status === "ex").length;
    return { total, advisorsComercial, advisorsTaquilla, technicians, exMembers };
  }, [allPersonnelItems]);

  const squadAndOfficeFilterOptions = useMemo(() => {
    const opts = [{ value: "all", label: "Todas las cuadrillas y sedes" }];
    opts.push(...KNOWN_SQUADS.map((s) => ({ value: `squad:${s}`, label: `Cuadrilla: ${s}` })));
    opts.push(...availableOffices.map((o) => ({ value: `office:${o}`, label: `Sede: ${o}` })));
    return opts;
  }, [availableOffices]);

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

      // 3. Squad or office filter
      if (filterSquadOrOffice !== "all") {
        if (filterSquadOrOffice.startsWith("squad:")) {
          const targetSquad = filterSquadOrOffice.replace("squad:", "");
          if (item.role !== "tecnico" || item.currentTeam !== targetSquad) return false;
        } else if (filterSquadOrOffice.startsWith("office:")) {
          const targetOffice = filterSquadOrOffice.replace("office:", "");
          if (item.role !== "asesor" || item.currentOffice !== targetOffice) return false;
        }
      }

      return true;
    });
  }, [allPersonnelItems, searchQuery, subFilterTab, filterSquadOrOffice]);

  // Reset page & selection when filter/search/pageSize changes
  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, [searchQuery, subFilterTab, filterSquadOrOffice, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredPersonnelItems.length / (pageSize || 1)));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedPersonnelItems = useMemo(() => {
    if (pageSize === 0) return filteredPersonnelItems;
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredPersonnelItems.slice(start, start + pageSize);
  }, [filteredPersonnelItems, safeCurrentPage, pageSize]);

  // Batch actions
  const handleToggleSelectAllVisible = () => {
    const allVisibleSelected =
      paginatedPersonnelItems.length > 0 &&
      paginatedPersonnelItems.every((item) => selectedIds.has(`${item.role}-${item.name}`));
    const next = new Set(selectedIds);
    if (allVisibleSelected) {
      paginatedPersonnelItems.forEach((item) => next.delete(`${item.role}-${item.name}`));
    } else {
      paginatedPersonnelItems.forEach((item) => next.add(`${item.role}-${item.name}`));
    }
    setSelectedIds(next);
  };

  const handleToggleSelectOne = (key: string) => {
    const next = new Set(selectedIds);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelectedIds(next);
  };

  const handleBatchUpdateCondition = (status: MemberStatus) => {
    const isEx = status === "ex";
    selectedIds.forEach((key) => {
      const item = allPersonnelItems.find((p) => `${p.role}-${p.name}` === key);
      if (!item) return;
      if (item.role === "asesor") {
        handleUpdateAdvisor(item.name, { status, isExCollaborator: isEx });
      } else {
        handleUpdateTech(item.name, { status, isExCollaborator: isEx });
      }
    });
    setHasUnsavedChanges(true);
    showToast(`Condición actualizada para ${selectedIds.size} colaborador(es)`);
    setSelectedIds(new Set());
  };

  const handleBatchUpdateSquad = (team: string) => {
    let count = 0;
    selectedIds.forEach((key) => {
      const item = allPersonnelItems.find((p) => `${p.role}-${p.name}` === key);
      if (item && item.role === "tecnico") {
        handleUpdateTech(item.name, { team });
        count++;
      }
    });
    setHasUnsavedChanges(true);
    showToast(`Cuadrilla "${team}" asignada a ${count} técnico(s)`);
    setSelectedIds(new Set());
  };

  // Inline mutations
  const handleUpdateAdvisor = (name: string, patch: Partial<AdvisorCustomConfig>) => {
    setHasUnsavedChanges(true);
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
    setHasUnsavedChanges(true);
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
    setHasUnsavedChanges(true);
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
    setHasUnsavedChanges(true);
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
      setHasUnsavedChanges(false);
      showToast("Configuración de personal guardada exitosamente");
    } catch (err: any) {
      showToast(err.message || "Error al guardar personal", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full space-y-5">
      {/* Resumen tipográfico limpio de Nómina - Cero cuadros perimetrales (Strict Rule 6 & Rule 5) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-6 py-1 sm:py-2">
        <div className="flex flex-col py-0.5">
          <span className="text-[11px] sm:text-xs font-normal text-neutral-500 font-sans">Total colaboradores</span>
          <span className="text-lg sm:text-xl font-bold tracking-tight text-neutral-950 mt-0.5 font-mono">
            {stats.total}
          </span>
        </div>
        <div className="flex flex-col py-0.5">
          <span className="text-[11px] sm:text-xs font-normal text-neutral-500 font-sans">Asesores de campo</span>
          <span className="text-lg sm:text-xl font-bold tracking-tight text-neutral-950 mt-0.5 font-mono">
            {stats.advisorsComercial}
          </span>
        </div>
        <div className="flex flex-col py-0.5">
          <span className="text-[11px] sm:text-xs font-normal text-neutral-500 font-sans">Taquillas presenciales</span>
          <span className="text-lg sm:text-xl font-bold tracking-tight text-neutral-950 mt-0.5 font-mono">
            {stats.advisorsTaquilla}
          </span>
        </div>
        <div className="flex flex-col py-0.5">
          <span className="text-[11px] sm:text-xs font-normal text-neutral-500 font-sans">Técnicos de campo</span>
          <span className="text-lg sm:text-xl font-bold tracking-tight text-neutral-950 mt-0.5 font-mono">
            {stats.technicians}
          </span>
        </div>
        <div className="flex flex-col py-0.5">
          <span className="text-[11px] sm:text-xs font-normal text-neutral-500 font-sans">Ex colaboradores</span>
          <span className="text-lg sm:text-xl font-bold tracking-tight text-neutral-400 mt-0.5 font-mono">
            {stats.exMembers}
          </span>
        </div>
      </div>

      {/* Blurred gradient line separator */}
      <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-neutral-200 to-transparent pointer-events-none" />

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

        {/* Right Action: Squad filter, Search input & Save Button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between sm:justify-end gap-2.5 sm:gap-3 w-full sm:w-auto">
          <div className="w-full sm:w-56 shrink-0">
            <CustomDropdown
              value={filterSquadOrOffice}
              options={squadAndOfficeFilterOptions}
              onChange={setFilterSquadOrOffice}
              placeholder="Filtrar cuadrilla o sede..."
              compact
            />
          </div>

          {onSearchQueryChange && (
            <div className="flex items-center gap-2 text-xs text-neutral-400 border-b border-neutral-200 focus-within:border-neutral-900 py-1 transition-colors flex-1 sm:w-48 sm:flex-initial">
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
            className={cn(
              "min-w-[44px] min-h-[44px] flex items-center justify-center p-2.5 transition-colors cursor-pointer disabled:opacity-40 select-none shrink-0",
              hasUnsavedChanges
                ? "text-emerald-600 hover:text-emerald-700 font-semibold"
                : "text-neutral-400 hover:text-neutral-900"
            )}
            title={hasUnsavedChanges ? "Guardar cambios pendientes" : "Guardar cambios"}
            aria-label="Guardar cambios"
          >
            {saving ? (
              <RotateCw className="w-4 h-4 animate-spin text-neutral-900" />
            ) : (
              <div className="relative">
                <Check className="w-4 h-4 stroke-[2]" />
                {hasUnsavedChanges && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 absolute -top-1 -right-1 animate-pulse" />
                )}
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Centered Modal: Unificar Colaborador (Strict Rule 4: No browser alerts) */}
      {mergingItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/20 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setMergingItem(null)}
        >
          <div
            className="w-full max-w-md bg-white rounded-xl shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150 border border-neutral-100 font-sans"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
              <h3 className="text-sm font-semibold text-neutral-900">
                Unificar colaborador como alias
              </h3>
              <button
                type="button"
                onClick={() => setMergingItem(null)}
                className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4 stroke-[1.5]" />
              </button>
            </div>

            <div className="space-y-1.5 text-xs text-neutral-600">
              <p>
                Estás a punto de unificar a <strong className="text-neutral-950">{formatProperCase(mergingItem.name)}</strong> como alias.
              </p>
              <p className="text-[11px] text-neutral-400">
                Todas sus ventas, visitas e instalaciones se sumarán automáticamente al perfil principal de destino.
              </p>
            </div>

            <div className="space-y-1 pt-1">
              <label className="block text-[11px] font-medium text-neutral-500">
                Seleccionar perfil principal de destino
              </label>
              <AdminDropdown<string>
                value={selectedMergeTarget}
                options={(mergingItem.type === "advisor" ? advisorsList : techniciansList)
                  .filter((i) => i.name !== mergingItem.name)
                  .map((i) => ({ value: i.name, label: formatProperCase(i.name) }))}
                onChange={(val) => setSelectedMergeTarget(val)}
                searchPlaceholder="Buscar por nombre..."
                className="w-full justify-between"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-100 text-xs">
              <button
                type="button"
                onClick={() => setMergingItem(null)}
                className="text-neutral-400 hover:text-neutral-700 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmMerge}
                className="font-semibold text-neutral-950 hover:underline cursor-pointer"
              >
                Confirmar unificación
              </button>
            </div>
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
              <tr className="border-b border-neutral-200/80 text-neutral-400 font-normal text-[11px] select-none">
                <th className="py-3 px-2 font-normal w-7">
                  <input
                    type="checkbox"
                    checked={
                      paginatedPersonnelItems.length > 0 &&
                      paginatedPersonnelItems.every((item) => selectedIds.has(`${item.role}-${item.name}`))
                    }
                    onChange={handleToggleSelectAllVisible}
                    className="rounded border-neutral-300 text-neutral-900 focus:ring-0 cursor-pointer accent-neutral-900 w-3.5 h-3.5"
                    title="Seleccionar visibles"
                  />
                </th>
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
                  <td colSpan={8} className="text-center py-12 text-neutral-400">
                    No se encontraron colaboradores coincidentes
                  </td>
                </tr>
              ) : (
                paginatedPersonnelItems.map((item) => (
                  <tr
                    key={`${item.role}-${item.name}`}
                    className={cn(
                      "transition-colors group",
                      selectedIds.has(`${item.role}-${item.name}`)
                        ? "bg-neutral-50/90"
                        : "hover:bg-neutral-50/50"
                    )}
                  >
                    <td className="py-3.5 px-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(`${item.role}-${item.name}`)}
                        onChange={() => handleToggleSelectOne(`${item.role}-${item.name}`)}
                        className="rounded border-neutral-300 text-neutral-900 focus:ring-0 cursor-pointer accent-neutral-900 w-3.5 h-3.5"
                      />
                    </td>
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
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(`${item.role}-${item.name}`)}
                        onChange={() => handleToggleSelectOne(`${item.role}-${item.name}`)}
                        className="rounded border-neutral-300 text-neutral-900 focus:ring-0 cursor-pointer accent-neutral-900 w-3.5 h-3.5 mt-0.5 shrink-0"
                      />
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

          {/* Floating Batch Action Bar */}
          {selectedIds.size > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-neutral-900 text-white rounded-xl shadow-2xl py-2 px-4 flex flex-wrap items-center gap-3 text-xs font-sans animate-in fade-in slide-in-from-bottom-2 duration-150 border border-neutral-800">
              <span className="font-semibold text-neutral-100">
                {selectedIds.size} seleccionado(s)
              </span>
              <span className="text-neutral-600">·</span>

              <div className="flex items-center gap-3">
                <AdminDropdown<MemberStatus>
                  value="fijo"
                  options={[
                    { value: "fijo", label: "Marcar como Fijo" },
                    { value: "ex", label: "Marcar como Ex Colaborador" },
                    { value: "otro_departamento", label: "Marcar Otro Dpto." },
                  ]}
                  onChange={handleBatchUpdateCondition}
                  className="text-neutral-300 hover:text-white"
                />

                <AdminDropdown<string>
                  value={KNOWN_SQUADS[0]}
                  options={KNOWN_SQUADS.map((s) => ({ value: s, label: `Cuadrilla: ${s}` }))}
                  onChange={handleBatchUpdateSquad}
                  className="text-neutral-300 hover:text-white"
                />
              </div>

              <span className="text-neutral-600">·</span>

              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="text-neutral-400 hover:text-white transition-colors cursor-pointer text-xs"
              >
                Deseleccionar
              </button>

              <button
                type="button"
                onClick={handleSaveAll}
                disabled={saving}
                className="font-semibold text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer text-xs ml-1"
              >
                Guardar cambios
              </button>
            </div>
          )}

          {/* Floating Unsaved Changes Notification (Strict Rule 2: Minimalist indicator) */}
          {hasUnsavedChanges && selectedIds.size === 0 && (
            <div className="fixed bottom-6 right-6 z-40 bg-neutral-900 text-white rounded-lg shadow-xl py-2 px-3.5 flex items-center gap-2.5 text-xs font-sans animate-in fade-in slide-in-from-bottom-2 duration-150">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
              <span>Tienes cambios sin guardar</span>
              <button
                type="button"
                onClick={handleSaveAll}
                disabled={saving}
                className="ml-2 font-semibold text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
              >
                Guardar ahora
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
