"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
  Search,
  X,
  RotateCcw,
  Save,
  Check,
  AlertCircle,
  GitMerge,
  Unlink,
  ChevronDown,
} from "lucide-react";
import { cn, formatNumber, formatProperCase } from "@/lib/utils";
import {
  AdvisorType,
  AdvisorOverridesMap,
  AdvisorCustomConfig,
  TechnicianOverridesMap,
  TechnicianCustomConfig,
  MemberStatus,
  StaffDepartment,
  KNOWN_OFFICES,
  ADVISOR_TYPE_LABELS,
  classifyAdvisor,
  resolveAdvisorOffice,
  findAdvisorOverride,
  findTechnicianOverride,
  stripAccents,
} from "@/lib/normalization";

export type PersonnelTab = "asesores" | "tecnicos" | "departamentos";

export interface AdvisorConfigItem {
  name: string;
  installations: number;
  solicitudes: number;
  defaultType: AdvisorType;
  defaultOffice?: string;
  currentType: AdvisorType;
  currentOffice?: string;
  isModified: boolean;
  mergedWith?: string;
  isExCollaborator: boolean;
  status: MemberStatus;
  department: StaffDepartment;
}

export interface TechnicianConfigItem {
  name: string;
  installations: number;
  defaultTeam?: string;
  currentTeam?: string;
  isModified: boolean;
  mergedWith?: string;
  isExCollaborator: boolean;
  status: MemberStatus;
  department: StaffDepartment;
}

interface PersonnelConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: PersonnelTab;
  advisorsList: {
    name: string;
    value: number;
    installed?: number;
    tipo_asesor?: AdvisorType;
    es_ex_colaborador?: boolean;
    sede_taquilla?: string;
  }[];
  techniciansList: {
    name: string;
    value: number;
    equipo?: string;
    es_ex_colaborador?: boolean;
    status?: MemberStatus;
    departamento?: StaffDepartment;
  }[];
  currentOverrides: AdvisorOverridesMap;
  currentAliases?: Record<string, string>;
  currentTechOverrides?: TechnicianOverridesMap;
  currentTechAliases?: Record<string, string>;
  onSaveOverrides: (payload: {
    overrides: AdvisorOverridesMap;
    aliases: Record<string, string>;
    technicianOverrides: TechnicianOverridesMap;
    technicianAliases: Record<string, string>;
  }) => Promise<void>;
}

const KNOWN_SQUADS = [
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

// Minimal custom dropdown to completely replace native HTML <select> boxes
interface CustomDropdownProps<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (val: T) => void;
  title?: string;
  className?: string;
}

function CustomDropdown<T extends string>({
  value,
  options,
  onChange,
  title,
  className,
}: CustomDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const currentLabel = options.find((o) => o.value === value)?.label || value;

  return (
    <div ref={ref} className="relative inline-block text-left" title={title}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "inline-flex items-center gap-1 text-xs font-mono transition-colors cursor-pointer select-none py-0.5",
          open ? "text-neutral-950 font-semibold" : "text-neutral-600 hover:text-neutral-950",
          className
        )}
      >
        <span>{currentLabel}</span>
        <ChevronDown className="w-2.5 h-2.5 opacity-50 transition-transform duration-150" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 min-w-[150px] max-w-[240px] bg-white/95 backdrop-blur-md border border-neutral-150 shadow-[0_8px_24px_-4px_rgba(0,0,0,0.06)] rounded-lg py-1 z-50 animate-in fade-in zoom-in-95 duration-100 max-h-56 overflow-y-auto">
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={cn(
                  "w-full text-left px-2.5 py-1.5 text-xs transition-colors flex items-center justify-between cursor-pointer",
                  isSelected
                    ? "text-neutral-950 font-semibold"
                    : "text-neutral-500 hover:text-neutral-950 hover:bg-neutral-50/70"
                )}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-neutral-950 ml-2 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AdvisorConfigModal({
  isOpen,
  onClose,
  initialTab = "asesores",
  advisorsList = [],
  techniciansList = [],
  currentOverrides = {},
  currentAliases = {},
  currentTechOverrides = {},
  currentTechAliases = {},
  onSaveOverrides,
}: PersonnelConfigModalProps) {
  const [activeMainTab, setActiveMainTab] = useState<PersonnelTab>(initialTab);
  const [searchQuery, setSearchQuery] = useState("");
  const [subFilterTab, setSubFilterTab] = useState<string>("all");

  // Draft state for Advisors
  const [draftAdvisorOverrides, setDraftAdvisorOverrides] = useState<AdvisorOverridesMap>({});
  const [draftAdvisorAliases, setDraftAdvisorAliases] = useState<Record<string, string>>({});

  // Draft state for Technicians
  const [draftTechOverrides, setDraftTechOverrides] = useState<TechnicianOverridesMap>({});
  const [draftTechAliases, setDraftTechAliases] = useState<Record<string, string>>({});

  // Merge modal dialog states
  const [mergingItem, setMergingItem] = useState<{ type: "advisor" | "tech"; name: string } | null>(null);
  const [selectedMergeTarget, setSelectedMergeTarget] = useState<string>("");
  const [showManualAliasForm, setShowManualAliasForm] = useState(false);
  const [manualAliasSource, setManualAliasSource] = useState("");
  const [manualAliasTarget, setManualAliasTarget] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const wasOpenRef = useRef(false);

  // Sync draft overrides & aliases ONLY when modal transitions from closed to open
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setDraftAdvisorOverrides({ ...currentOverrides });
      setDraftAdvisorAliases({ ...(currentAliases || {}) });
      setDraftTechOverrides({ ...(currentTechOverrides || {}) });
      setDraftTechAliases({ ...(currentTechAliases || {}) });
      setSaveSuccess(false);
      setErrorMsg(null);
      setSearchQuery("");
      setSubFilterTab("all");
      setMergingItem(null);
      setShowManualAliasForm(false);
      setManualAliasSource("");
      setManualAliasTarget("");
      if (initialTab) setActiveMainTab(initialTab);
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, initialTab, currentOverrides, currentAliases, currentTechOverrides, currentTechAliases]);

  // Lock body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (mergingItem) {
          setMergingItem(null);
        } else if (showManualAliasForm) {
          setShowManualAliasForm(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, mergingItem, showManualAliasForm]);

  // ==========================================
  // 1. ADVISORS DATA MAPPING
  // ==========================================
  const allAdvisorItems: AdvisorConfigItem[] = useMemo(() => {
    const existingNames = new Set<string>();
    const safeAdvisors = Array.isArray(advisorsList) ? advisorsList : [];

    const items: AdvisorConfigItem[] = safeAdvisors.map((adv) => {
      existingNames.add(adv.name);
      const defaultType = classifyAdvisor(adv.name);
      const defaultOffice = resolveAdvisorOffice(adv.name);

      const match = findAdvisorOverride(adv.name, draftAdvisorOverrides);
      const override = match?.config;
      const currentType = override ? override.type : defaultType;
      const currentOffice = override?.office !== undefined ? override.office : defaultOffice;

      const isEx = override?.isExCollaborator !== undefined
        ? Boolean(override.isExCollaborator)
        : override?.status === "ex"
        ? true
        : Boolean(adv.es_ex_colaborador);

      const status: MemberStatus = override?.status || (isEx ? "ex" : "fijo");
      const department: StaffDepartment = override?.department || "ventas";

      const isModified =
        override !== undefined &&
        (override.type !== defaultType ||
          (override.office || "") !== (defaultOffice || "") ||
          override.isExCollaborator !== undefined ||
          override.status !== undefined ||
          override.department !== undefined);

      const mergedWith = draftAdvisorAliases[adv.name] || draftAdvisorAliases[adv.name.toLowerCase()];

      return {
        name: adv.name,
        installations: adv.value || 0,
        solicitudes: adv.installed || 0,
        defaultType,
        defaultOffice,
        currentType,
        currentOffice,
        isModified,
        mergedWith,
        isExCollaborator: isEx,
        status,
        department,
      };
    });

    for (const [aliasSource, aliasTarget] of Object.entries(draftAdvisorAliases)) {
      if (!existingNames.has(aliasSource)) {
        items.push({
          name: aliasSource,
          installations: 0,
          solicitudes: 0,
          defaultType: "comercial",
          currentType: "comercial",
          isModified: true,
          mergedWith: aliasTarget,
          isExCollaborator: false,
          status: "fijo",
          department: "ventas",
        });
      }
    }

    return items;
  }, [advisorsList, draftAdvisorOverrides, draftAdvisorAliases]);

  // ==========================================
  // 2. TECHNICIANS DATA MAPPING
  // ==========================================
  const allTechItems: TechnicianConfigItem[] = useMemo(() => {
    const existingNames = new Set<string>();
    const safeTechs = Array.isArray(techniciansList) ? techniciansList : [];

    const items: TechnicianConfigItem[] = safeTechs.map((tech) => {
      existingNames.add(tech.name);
      const defaultTeam = tech.equipo || "Sin Equipo";

      const match = findTechnicianOverride(tech.name, draftTechOverrides);
      const override = match?.config;
      const currentTeam = override?.team !== undefined ? override.team : defaultTeam;

      const isEx = override?.isExCollaborator !== undefined
        ? Boolean(override.isExCollaborator)
        : override?.status === "ex"
        ? true
        : Boolean(tech.es_ex_colaborador);

      const status: MemberStatus = override?.status || (isEx ? "ex" : "fijo");
      const department: StaffDepartment = override?.department || "tecnico";

      const isModified =
        override !== undefined &&
        ((override.team || "") !== (defaultTeam || "") ||
          override.isExCollaborator !== undefined ||
          override.status !== undefined ||
          override.department !== undefined);

      const mergedWith = draftTechAliases[tech.name] || draftTechAliases[tech.name.toLowerCase()];

      return {
        name: tech.name,
        installations: tech.value || 0,
        defaultTeam,
        currentTeam,
        isModified,
        mergedWith,
        isExCollaborator: isEx,
        status,
        department,
      };
    });

    for (const [aliasSource, aliasTarget] of Object.entries(draftTechAliases)) {
      if (!existingNames.has(aliasSource)) {
        items.push({
          name: aliasSource,
          installations: 0,
          defaultTeam: "Sin Equipo",
          currentTeam: "Sin Equipo",
          isModified: true,
          mergedWith: aliasTarget,
          isExCollaborator: false,
          status: "fijo",
          department: "tecnico",
        });
      }
    }

    return items;
  }, [techniciansList, draftTechOverrides, draftTechAliases]);

  // Targets for Aliasing
  const availableTargetAdvisors = useMemo(() => {
    return Array.from(new Set(allAdvisorItems.map((i) => i.name)))
      .filter((n) => !draftAdvisorAliases[n])
      .sort();
  }, [allAdvisorItems, draftAdvisorAliases]);

  const availableTargetTechs = useMemo(() => {
    return Array.from(new Set(allTechItems.map((i) => i.name)))
      .filter((n) => !draftTechAliases[n])
      .sort();
  }, [allTechItems, draftTechAliases]);

  // Filtered Advisors
  const filteredAdvisorItems = useMemo(() => {
    let result = [...allAdvisorItems];

    if (subFilterTab === "modified") {
      result = result.filter((i) => i.isModified);
    } else if (subFilterTab === "merged") {
      result = result.filter((i) => Boolean(i.mergedWith));
    } else if (subFilterTab === "fijo") {
      result = result.filter((i) => i.status === "fijo" && !i.isExCollaborator);
    } else if (subFilterTab === "ex") {
      result = result.filter((i) => i.status === "ex" || i.isExCollaborator);
    } else if (subFilterTab === "otro_departamento") {
      result = result.filter((i) => i.status === "otro_departamento");
    } else if (subFilterTab !== "all") {
      result = result.filter((i) => i.currentType === subFilterTab);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((i) => {
        const matchName = i.name.toLowerCase().includes(q);
        const matchOffice = i.currentOffice ? i.currentOffice.toLowerCase().includes(q) : false;
        const matchMerged = i.mergedWith ? i.mergedWith.toLowerCase().includes(q) : false;
        return matchName || matchOffice || matchMerged;
      });
    }

    return result.sort((a, b) => b.installations - a.installations);
  }, [allAdvisorItems, subFilterTab, searchQuery]);

  // Filtered Technicians
  const filteredTechItems = useMemo(() => {
    let result = [...allTechItems];

    if (subFilterTab === "modified") {
      result = result.filter((i) => i.isModified);
    } else if (subFilterTab === "merged") {
      result = result.filter((i) => Boolean(i.mergedWith));
    } else if (subFilterTab === "fijo") {
      result = result.filter((i) => i.status === "fijo" && !i.isExCollaborator);
    } else if (subFilterTab === "ex") {
      result = result.filter((i) => i.status === "ex" || i.isExCollaborator);
    } else if (subFilterTab === "otro_departamento") {
      result = result.filter((i) => i.status === "otro_departamento");
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((i) => {
        const matchName = i.name.toLowerCase().includes(q);
        const matchTeam = i.currentTeam ? i.currentTeam.toLowerCase().includes(q) : false;
        const matchMerged = i.mergedWith ? i.mergedWith.toLowerCase().includes(q) : false;
        return matchName || matchTeam || matchMerged;
      });
    }

    return result.sort((a, b) => b.installations - a.installations);
  }, [allTechItems, subFilterTab, searchQuery]);

  // Department Overview stats
  const departmentStats = useMemo(() => {
    return {
      ventasTotal: allAdvisorItems.length,
      ventasFijos: allAdvisorItems.filter((a) => a.status === "fijo" && !a.isExCollaborator).length,
      ventasEx: allAdvisorItems.filter((a) => a.status === "ex" || a.isExCollaborator).length,
      ventasOtros: allAdvisorItems.filter((a) => a.status === "otro_departamento").length,
      tecnicosTotal: allTechItems.length,
      tecnicosFijos: allTechItems.filter((t) => t.status === "fijo" && !t.isExCollaborator).length,
      tecnicosEx: allTechItems.filter((t) => t.status === "ex" || t.isExCollaborator).length,
      tecnicosOtros: allTechItems.filter((t) => t.status === "otro_departamento").length,
    };
  }, [allAdvisorItems, allTechItems]);

  // Advisor Counts
  const advisorCounts = useMemo(() => {
    const c = {
      all: allAdvisorItems.length,
      fijos: 0,
      ex: 0,
      otro_departamento: 0,
      comercial: 0,
      taquilla: 0,
      planificacion: 0,
      externo: 0,
      modified: 0,
      merged: Object.keys(draftAdvisorAliases).length,
    };
    allAdvisorItems.forEach((i) => {
      if (i.status === "ex" || i.isExCollaborator) c.ex++;
      else if (i.status === "otro_departamento") c.otro_departamento++;
      else c.fijos++;

      if (i.currentType in c) c[i.currentType as keyof typeof c]++;
      if (i.isModified) c.modified++;
    });
    return c;
  }, [allAdvisorItems, draftAdvisorAliases]);

  // Technician Counts
  const techCounts = useMemo(() => {
    const c = {
      all: allTechItems.length,
      fijos: 0,
      ex: 0,
      otro_departamento: 0,
      modified: 0,
      merged: Object.keys(draftTechAliases).length,
    };
    allTechItems.forEach((i) => {
      if (i.status === "ex" || i.isExCollaborator) c.ex++;
      else if (i.status === "otro_departamento") c.otro_departamento++;
      else c.fijos++;

      if (i.isModified) c.modified++;
    });
    return c;
  }, [allTechItems, draftTechAliases]);

  // ==========================================
  // ADVISOR DRAFT MUTATIONS
  // ==========================================
  const updateAdvisorDraft = (
    advisorName: string,
    updater: (curr: AdvisorCustomConfig) => AdvisorCustomConfig
  ) => {
    setDraftAdvisorOverrides((prev) => {
      const next = { ...prev };
      const match = findAdvisorOverride(advisorName, next);
      const targetKey = match ? match.key : advisorName;
      const defaultType = classifyAdvisor(advisorName);
      const defaultOffice = resolveAdvisorOffice(advisorName);

      const current: AdvisorCustomConfig = match?.config || {
        type: defaultType,
        office: defaultOffice,
        status: "fijo",
        department: "ventas",
        updatedAt: new Date().toISOString(),
      };

      const updated = updater(current);

      const lower = advisorName.toLowerCase().trim();
      const stripped = stripAccents(advisorName).trim();
      Object.keys(next).forEach((k) => {
        if (
          k !== targetKey &&
          (k.toLowerCase().trim() === lower || stripAccents(k).trim() === stripped)
        ) {
          delete next[k];
        }
      });

      next[targetKey] = updated;
      return next;
    });
    setSaveSuccess(false);
  };

  const handleChangeAdvisorType = (advisorName: string, newType: AdvisorType) => {
    updateAdvisorDraft(advisorName, (current) => ({
      ...current,
      type: newType,
      office: newType === "taquilla" ? current.office || "Valle" : undefined,
      updatedAt: new Date().toISOString(),
    }));
  };

  const handleChangeAdvisorOffice = (advisorName: string, newOffice: string) => {
    updateAdvisorDraft(advisorName, (current) => ({
      ...current,
      office: newOffice,
      updatedAt: new Date().toISOString(),
    }));
  };

  const handleChangeAdvisorStatus = (advisorName: string, newStatus: MemberStatus) => {
    updateAdvisorDraft(advisorName, (current) => ({
      ...current,
      status: newStatus,
      isExCollaborator: newStatus === "ex",
      updatedAt: new Date().toISOString(),
    }));
  };

  const handleChangeAdvisorDepartment = (advisorName: string, newDept: StaffDepartment) => {
    updateAdvisorDraft(advisorName, (current) => ({
      ...current,
      department: newDept,
      status: newDept !== "ventas" ? "otro_departamento" : current.status,
      updatedAt: new Date().toISOString(),
    }));
  };

  const handleRevertAdvisorSingle = (advisorName: string) => {
    setDraftAdvisorOverrides((prev) => {
      const next = { ...prev };
      const lower = advisorName.toLowerCase().trim();
      const stripped = stripAccents(advisorName).trim();
      Object.keys(next).forEach((k) => {
        if (k.toLowerCase().trim() === lower || stripAccents(k).trim() === stripped) {
          delete next[k];
        }
      });
      return next;
    });
    setSaveSuccess(false);
  };

  // ==========================================
  // TECHNICIAN DRAFT MUTATIONS
  // ==========================================
  const updateTechDraft = (
    techName: string,
    updater: (curr: TechnicianCustomConfig) => TechnicianCustomConfig
  ) => {
    setDraftTechOverrides((prev) => {
      const next = { ...prev };
      const match = findTechnicianOverride(techName, next);
      const targetKey = match ? match.key : techName;

      const current: TechnicianCustomConfig = match?.config || {
        team: "Equipo A",
        status: "fijo",
        department: "tecnico",
        updatedAt: new Date().toISOString(),
      };

      const updated = updater(current);

      const lower = techName.toLowerCase().trim();
      const stripped = stripAccents(techName).trim();
      Object.keys(next).forEach((k) => {
        if (
          k !== targetKey &&
          (k.toLowerCase().trim() === lower || stripAccents(k).trim() === stripped)
        ) {
          delete next[k];
        }
      });

      next[targetKey] = updated;
      return next;
    });
    setSaveSuccess(false);
  };

  const handleChangeTechTeam = (techName: string, newTeam: string) => {
    updateTechDraft(techName, (current) => ({
      ...current,
      team: newTeam,
      updatedAt: new Date().toISOString(),
    }));
  };

  const handleChangeTechStatus = (techName: string, newStatus: MemberStatus) => {
    updateTechDraft(techName, (current) => ({
      ...current,
      status: newStatus,
      isExCollaborator: newStatus === "ex",
      updatedAt: new Date().toISOString(),
    }));
  };

  const handleChangeTechDepartment = (techName: string, newDept: StaffDepartment) => {
    updateTechDraft(techName, (current) => ({
      ...current,
      department: newDept,
      status: newDept !== "tecnico" ? "otro_departamento" : current.status,
      updatedAt: new Date().toISOString(),
    }));
  };

  const handleRevertTechSingle = (techName: string) => {
    setDraftTechOverrides((prev) => {
      const next = { ...prev };
      const lower = techName.toLowerCase().trim();
      const stripped = stripAccents(techName).trim();
      Object.keys(next).forEach((k) => {
        if (k.toLowerCase().trim() === lower || stripAccents(k).trim() === stripped) {
          delete next[k];
        }
      });
      return next;
    });
    setSaveSuccess(false);
  };

  // ==========================================
  // UNIFY / MERGE ALIAS ACTIONS
  // ==========================================
  const handleOpenMerge = (type: "advisor" | "tech", name: string) => {
    setMergingItem({ type, name });
    const targetPool = type === "advisor" ? availableTargetAdvisors : availableTargetTechs;
    const candidate = targetPool.find((n) => n !== name) || "";
    setSelectedMergeTarget(candidate);
  };

  const handleConfirmMerge = () => {
    if (!mergingItem || !selectedMergeTarget || selectedMergeTarget === mergingItem.name) return;

    if (mergingItem.type === "advisor") {
      setDraftAdvisorAliases((prev) => ({
        ...prev,
        [mergingItem.name]: selectedMergeTarget,
      }));
    } else {
      setDraftTechAliases((prev) => ({
        ...prev,
        [mergingItem.name]: selectedMergeTarget,
      }));
    }

    setMergingItem(null);
    setSelectedMergeTarget("");
    setSaveSuccess(false);
  };

  const handleUnmerge = (type: "advisor" | "tech", sourceName: string) => {
    if (type === "advisor") {
      setDraftAdvisorAliases((prev) => {
        const next = { ...prev };
        delete next[sourceName];
        delete next[sourceName.toLowerCase()];
        return next;
      });
    } else {
      setDraftTechAliases((prev) => {
        const next = { ...prev };
        delete next[sourceName];
        delete next[sourceName.toLowerCase()];
        return next;
      });
    }
    setSaveSuccess(false);
  };

  const handleAddManualAlias = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualAliasSource.trim() || !manualAliasTarget.trim()) return;

    if (activeMainTab === "tecnicos") {
      setDraftTechAliases((prev) => ({
        ...prev,
        [manualAliasSource.trim()]: manualAliasTarget.trim(),
      }));
    } else {
      setDraftAdvisorAliases((prev) => ({
        ...prev,
        [manualAliasSource.trim()]: manualAliasTarget.trim(),
      }));
    }

    setManualAliasSource("");
    setShowManualAliasForm(false);
    setSaveSuccess(false);
  };

  const handleRevertAll = () => {
    if (confirm("¿Estás seguro de restablecer todas las configuraciones a sus valores por defecto?")) {
      setDraftAdvisorOverrides({});
      setDraftAdvisorAliases({});
      setDraftTechOverrides({});
      setDraftTechAliases({});
      setSaveSuccess(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg(null);
    try {
      await onSaveOverrides({
        overrides: draftAdvisorOverrides,
        aliases: draftAdvisorAliases,
        technicianOverrides: draftTechOverrides,
        technicianAliases: draftTechAliases,
      });
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (err: any) {
      setErrorMsg(err.message || "Error al guardar la configuración");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-neutral-900/40 backdrop-blur-xs transition-opacity duration-200"
        onClick={onClose}
      />

      {/* Modal Container: Clean, Minimalist, Frameless Vercel-like Aesthetic */}
      <div className="relative bg-white border border-neutral-200/80 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col z-10 overflow-hidden font-sans">
        
        {/* Header: Pure Typography & Micro Action */}
        <div className="px-6 pt-6 pb-4 border-b border-neutral-100 flex items-start justify-between">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-neutral-900 tracking-tight">
              Gestión de Personal
            </h2>
            <p className="text-xs text-neutral-400 font-mono">
              Configura vinculación laboral, sedes, cuadrillas y unifica errores de tipeo.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer p-1 -mr-1"
            title="Cerrar modal (Esc)"
          >
            <X className="w-4 h-4 stroke-[1.75]" />
          </button>
        </div>

        {/* Primary Liquid Nav Bar (No heavy pill badges) */}
        <div className="px-6 pt-3 border-b border-neutral-100 flex items-center justify-between text-xs font-mono select-none">
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => {
                setActiveMainTab("asesores");
                setSubFilterTab("all");
                setMergingItem(null);
              }}
              className={cn(
                "pb-2.5 transition-colors cursor-pointer relative font-medium",
                activeMainTab === "asesores"
                  ? "text-neutral-900 font-semibold"
                  : "text-neutral-400 hover:text-neutral-700"
              )}
            >
              <span>Fuerza de Ventas</span>
              <span className="ml-1.5 text-[10px] text-neutral-400">
                {allAdvisorItems.length}
              </span>
              {activeMainTab === "asesores" && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-neutral-900 rounded-full" />
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveMainTab("tecnicos");
                setSubFilterTab("all");
                setMergingItem(null);
              }}
              className={cn(
                "pb-2.5 transition-colors cursor-pointer relative font-medium",
                activeMainTab === "tecnicos"
                  ? "text-neutral-900 font-semibold"
                  : "text-neutral-400 hover:text-neutral-700"
              )}
            >
              <span>Técnicos de Campo</span>
              <span className="ml-1.5 text-[10px] text-neutral-400">
                {allTechItems.length}
              </span>
              {activeMainTab === "tecnicos" && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-neutral-900 rounded-full" />
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveMainTab("departamentos");
                setSubFilterTab("all");
                setMergingItem(null);
              }}
              className={cn(
                "pb-2.5 transition-colors cursor-pointer relative font-medium",
                activeMainTab === "departamentos"
                  ? "text-neutral-900 font-semibold"
                  : "text-neutral-400 hover:text-neutral-700"
              )}
            >
              <span>Estructura Departamental</span>
              {activeMainTab === "departamentos" && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-neutral-900 rounded-full" />
              )}
            </button>
          </div>

          {/* Sutil micro-status monocromático */}
          <div className="hidden sm:flex items-center gap-3 text-[11px] text-neutral-400 pb-2.5">
            {activeMainTab === "asesores" && (
              <>
                <span>{advisorCounts.fijos} fijos</span>
                <span>•</span>
                <span>{advisorCounts.ex} ex</span>
                {advisorCounts.modified > 0 && (
                  <>
                    <span>•</span>
                    <span className="text-neutral-900 font-medium">{advisorCounts.modified} con regla</span>
                  </>
                )}
              </>
            )}
            {activeMainTab === "tecnicos" && (
              <>
                <span>{techCounts.fijos} fijos</span>
                <span>•</span>
                <span>{techCounts.ex} ex</span>
                {techCounts.modified > 0 && (
                  <>
                    <span>•</span>
                    <span className="text-neutral-900 font-medium">{techCounts.modified} con regla</span>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Filter and Search Bar: Pure fluid line */}
        {activeMainTab !== "departamentos" && (
          <div className="px-6 py-2.5 border-b border-neutral-100 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            {/* Search Input without borders */}
            <div className="flex items-center gap-2 flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={activeMainTab === "asesores" ? "Filtrar por nombre, sede..." : "Filtrar por nombre, equipo..."}
                className="w-full bg-transparent text-xs font-mono text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="text-neutral-400 hover:text-neutral-900 cursor-pointer p-0.5"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Quick Unify button and subfilters */}
            <div className="flex items-center gap-4 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setShowManualAliasForm(!showManualAliasForm);
                  const pool = activeMainTab === "asesores" ? availableTargetAdvisors : availableTargetTechs;
                  if (!manualAliasTarget && pool.length > 0) {
                    setManualAliasTarget(pool[0]);
                  }
                }}
                className={cn(
                  "flex items-center gap-1.5 text-xs transition-colors cursor-pointer",
                  showManualAliasForm
                    ? "text-neutral-900 font-semibold"
                    : "text-neutral-400 hover:text-neutral-900"
                )}
                title="Vincular un nombre mal escrito a su nombre canónico"
              >
                <GitMerge className="w-3 h-3 stroke-[2]" />
                <span>Unificar duplicado</span>
              </button>

              <span className="text-neutral-200 hidden sm:inline">|</span>

              {/* Sub-Filters: Pure fluid typography */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                {(activeMainTab === "asesores"
                  ? [
                      { id: "all", label: "Todos", count: advisorCounts.all },
                      { id: "fijo", label: "Fijos", count: advisorCounts.fijos },
                      { id: "ex", label: "Ex", count: advisorCounts.ex },
                      { id: "comercial", label: "Ventas", count: advisorCounts.comercial },
                      { id: "taquilla", label: "Taquilla", count: advisorCounts.taquilla },
                      { id: "planificacion", label: "Planif.", count: advisorCounts.planificacion },
                      { id: "modified", label: "Modificados", count: advisorCounts.modified },
                    ]
                  : [
                      { id: "all", label: "Todos", count: techCounts.all },
                      { id: "fijo", label: "Fijos", count: techCounts.fijos },
                      { id: "ex", label: "Ex", count: techCounts.ex },
                      { id: "modified", label: "Modificados", count: techCounts.modified },
                    ]
                ).map((tab) => {
                  const isActive = subFilterTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setSubFilterTab(tab.id)}
                      className={cn(
                        "transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1",
                        isActive
                          ? "text-neutral-950 font-bold"
                          : "text-neutral-400 hover:text-neutral-800"
                      )}
                    >
                      <span>{tab.label}</span>
                      <span className="text-[9px] text-neutral-400 opacity-80">
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Minimal Drawer: Manual Unify Form */}
        {showManualAliasForm && (
          <form
            onSubmit={handleAddManualAlias}
            className="px-6 py-3 bg-neutral-50/60 border-b border-neutral-100 flex flex-wrap items-center gap-3 text-xs font-mono animate-in fade-in duration-150"
          >
            <span className="text-neutral-500 font-medium">
              Texto con error:
            </span>

            <input
              type="text"
              required
              value={manualAliasSource}
              onChange={(e) => setManualAliasSource(e.target.value)}
              placeholder={activeMainTab === "asesores" ? "Ej: Dayhomy Vivas Albornoz" : "Ej: Douglas Mayobre M."}
              className="px-2.5 py-1 bg-white border-b border-neutral-300 focus:border-neutral-900 text-xs font-mono text-neutral-900 placeholder:text-neutral-400 outline-none transition-colors min-w-[200px]"
            />

            <span className="text-neutral-400">→</span>

            <CustomDropdown
              value={manualAliasTarget}
              options={(activeMainTab === "asesores" ? availableTargetAdvisors : availableTargetTechs).map((t) => ({
                value: t,
                label: t,
              }))}
              onChange={(val) => setManualAliasTarget(val)}
              title="Seleccionar colaborador canónico"
            />

            <div className="flex items-center gap-3 ml-auto">
              <button
                type="submit"
                className="text-xs font-semibold text-neutral-900 hover:underline cursor-pointer"
              >
                Vincular
              </button>
              <button
                type="button"
                onClick={() => setShowManualAliasForm(false)}
                className="text-xs text-neutral-400 hover:text-neutral-900 cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {/* Content Body: Clean Minimalist Rows */}
        <div className="flex-1 overflow-y-auto px-6 py-2 divide-y divide-neutral-100/70">
          
          {/* ========================================================= */}
          {/* TAB 1: ASESORES */}
          {/* ========================================================= */}
          {activeMainTab === "asesores" && (
            <>
              {filteredAdvisorItems.length === 0 ? (
                <div className="text-center py-16 text-neutral-400 text-xs font-mono">
                  No se encontraron asesores con los criterios especificados.
                </div>
              ) : (
                filteredAdvisorItems.map((item, idx) => {
                  const isMerged = Boolean(item.mergedWith);
                  const isMergingThis = mergingItem?.type === "advisor" && mergingItem.name === item.name;

                  return (
                    <div
                      key={`adv-${item.name}-${idx}`}
                      className="py-2.5 flex flex-col gap-1.5 transition-colors group"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        {/* Left: Rank & Name */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <span className="w-5 text-[10px] font-mono text-neutral-300 text-right shrink-0">
                            {idx + 1}
                          </span>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={cn(
                                  "text-xs font-medium",
                                  isMerged
                                    ? "line-through text-neutral-400"
                                    : item.status === "ex"
                                    ? "text-neutral-400 line-through decoration-neutral-300"
                                    : item.status === "otro_departamento"
                                    ? "text-neutral-600 italic"
                                    : "text-neutral-900"
                                )}
                              >
                                {formatProperCase(item.name)}
                              </span>

                              <span className="text-[10px] font-mono text-neutral-400">
                                {formatNumber(item.installations)} inst.
                              </span>

                              {isMerged && (
                                <span className="text-[10px] font-mono text-neutral-400 italic">
                                  ↳ {item.mergedWith}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right: Custom Clean Floating Popovers */}
                        <div className="flex items-center gap-4 flex-wrap shrink-0 text-xs font-mono">
                          {isMerged ? (
                            <button
                              type="button"
                              onClick={() => handleUnmerge("advisor", item.name)}
                              className="text-neutral-400 hover:text-neutral-900 transition-colors flex items-center gap-1 text-[11px] cursor-pointer"
                              title="Deshacer unificación"
                            >
                              <Unlink className="w-3 h-3" />
                              <span>Separar</span>
                            </button>
                          ) : (
                            <>
                              {/* Custom Role Dropdown */}
                              <CustomDropdown<AdvisorType>
                                value={item.currentType}
                                onChange={(val) => handleChangeAdvisorType(item.name, val)}
                                options={[
                                  { value: "comercial", label: "Ventas de Calle" },
                                  { value: "taquilla", label: "Taquilla / Sede" },
                                  { value: "planificacion", label: "Planificación" },
                                  { value: "externo", label: "Externo" },
                                ]}
                                title="Canal o rol"
                              />

                              {/* Custom Sede Dropdown (If Taquilla) */}
                              {item.currentType === "taquilla" && (
                                <CustomDropdown<string>
                                  value={item.currentOffice || "Valle"}
                                  onChange={(val) => handleChangeAdvisorOffice(item.name, val)}
                                  options={KNOWN_OFFICES.map((off) => ({ value: off, label: off }))}
                                  title="Sucursal asignada"
                                />
                              )}

                              {/* Custom Status Dropdown */}
                              <CustomDropdown<MemberStatus>
                                value={item.status}
                                onChange={(val) => handleChangeAdvisorStatus(item.name, val)}
                                options={[
                                  { value: "fijo", label: "Fijo" },
                                  { value: "ex", label: "Ex Colaborador" },
                                  { value: "otro_departamento", label: "Otro Departamento" },
                                ]}
                                className={item.status === "ex" ? "text-neutral-400 italic" : item.status === "otro_departamento" ? "text-amber-800 font-medium" : ""}
                                title="Estado de vinculación laboral"
                              />

                              {/* Department Selector if transferred */}
                              {item.status === "otro_departamento" && (
                                <CustomDropdown<StaffDepartment>
                                  value={item.department}
                                  onChange={(val) => handleChangeAdvisorDepartment(item.name, val)}
                                  options={[
                                    { value: "tecnico", label: "Operaciones / Técnicos" },
                                    { value: "ventas", label: "Ventas / Comercial" },
                                    { value: "otro", label: "Otro Departamento" },
                                  ]}
                                  className="text-amber-700"
                                  title="Departamento destino"
                                />
                              )}

                              {/* Pure Icon Action: Unificar */}
                              <button
                                type="button"
                                onClick={() =>
                                  isMergingThis
                                    ? setMergingItem(null)
                                    : handleOpenMerge("advisor", item.name)
                                }
                                className={cn(
                                  "transition-colors cursor-pointer p-1",
                                  isMergingThis
                                    ? "text-neutral-950 font-bold"
                                    : "text-neutral-300 hover:text-neutral-900 group-hover:text-neutral-400"
                                )}
                                title="Unificar duplicado"
                              >
                                <GitMerge className="w-3.5 h-3.5" />
                              </button>

                              {/* Revert Single Rule (Icon only) */}
                              {item.isModified && (
                                <button
                                  type="button"
                                  onClick={() => handleRevertAdvisorSingle(item.name)}
                                  className="text-neutral-300 hover:text-neutral-900 transition-colors cursor-pointer p-1"
                                  title="Restablecer regla por defecto"
                                >
                                  <RotateCcw className="w-3 h-3 stroke-[1.75]" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {/* Clean Inline Merge Target Selector */}
                      {isMergingThis && (
                        <div className="py-2 px-3 bg-neutral-50/70 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs font-mono animate-in fade-in duration-100">
                          <div className="flex items-center gap-2">
                            <span className="text-neutral-500">
                              Unificar "{item.name}" dentro de:
                            </span>
                            <CustomDropdown<string>
                              value={selectedMergeTarget}
                              onChange={(val) => setSelectedMergeTarget(val)}
                              options={availableTargetAdvisors
                                .filter((t) => t !== item.name)
                                .map((target) => ({ value: target, label: target }))}
                              title="Asesor destino"
                            />
                          </div>

                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={handleConfirmMerge}
                              disabled={!selectedMergeTarget}
                              className="text-xs font-semibold text-neutral-900 hover:underline cursor-pointer disabled:opacity-40"
                            >
                              Confirmar
                            </button>
                            <button
                              type="button"
                              onClick={() => setMergingItem(null)}
                              className="text-xs text-neutral-400 hover:text-neutral-900 cursor-pointer"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </>
          )}

          {/* ========================================================= */}
          {/* TAB 2: TÉCNICOS DE CAMPO */}
          {/* ========================================================= */}
          {activeMainTab === "tecnicos" && (
            <>
              {filteredTechItems.length === 0 ? (
                <div className="text-center py-16 text-neutral-400 text-xs font-mono">
                  No se encontraron técnicos con los criterios especificados.
                </div>
              ) : (
                filteredTechItems.map((tech, idx) => {
                  const isMerged = Boolean(tech.mergedWith);
                  const isMergingThis = mergingItem?.type === "tech" && mergingItem.name === tech.name;

                  return (
                    <div
                      key={`tech-${tech.name}-${idx}`}
                      className="py-2.5 flex flex-col gap-1.5 transition-colors group"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        {/* Left: Rank & Name */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <span className="w-5 text-[10px] font-mono text-neutral-300 text-right shrink-0">
                            {idx + 1}
                          </span>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={cn(
                                  "text-xs font-medium",
                                  isMerged
                                    ? "line-through text-neutral-400"
                                    : tech.status === "ex"
                                    ? "text-neutral-400 line-through decoration-neutral-300"
                                    : tech.status === "otro_departamento"
                                    ? "text-neutral-600 italic"
                                    : "text-neutral-900"
                                )}
                              >
                                {formatProperCase(tech.name)}
                              </span>

                              <span className="text-[10px] font-mono text-neutral-400">
                                {formatNumber(tech.installations)} inst.
                              </span>

                              {isMerged && (
                                <span className="text-[10px] font-mono text-neutral-400 italic">
                                  ↳ {tech.mergedWith}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right: Custom Clean Floating Popovers */}
                        <div className="flex items-center gap-4 flex-wrap shrink-0 text-xs font-mono">
                          {isMerged ? (
                            <button
                              type="button"
                              onClick={() => handleUnmerge("tech", tech.name)}
                              className="text-neutral-400 hover:text-neutral-900 transition-colors flex items-center gap-1 text-[11px] cursor-pointer"
                              title="Deshacer unificación"
                            >
                              <Unlink className="w-3 h-3" />
                              <span>Separar</span>
                            </button>
                          ) : (
                            <>
                              {/* Custom Squad Dropdown */}
                              <CustomDropdown<string>
                                value={tech.currentTeam || "Equipo A"}
                                onChange={(val) => handleChangeTechTeam(tech.name, val)}
                                options={KNOWN_SQUADS.map((sq) => ({ value: sq, label: sq }))}
                                title="Cuadrilla asignada"
                              />

                              {/* Custom Status Dropdown */}
                              <CustomDropdown<MemberStatus>
                                value={tech.status}
                                onChange={(val) => handleChangeTechStatus(tech.name, val)}
                                options={[
                                  { value: "fijo", label: "Fijo" },
                                  { value: "ex", label: "Ex Colaborador" },
                                  { value: "otro_departamento", label: "Otro Departamento" },
                                ]}
                                className={tech.status === "ex" ? "text-neutral-400 italic" : tech.status === "otro_departamento" ? "text-amber-800 font-medium" : ""}
                                title="Estado laboral"
                              />

                              {/* Department Selector if transferred */}
                              {tech.status === "otro_departamento" && (
                                <CustomDropdown<StaffDepartment>
                                  value={tech.department}
                                  onChange={(val) => handleChangeTechDepartment(tech.name, val)}
                                  options={[
                                    { value: "ventas", label: "Ventas / Comercial" },
                                    { value: "tecnico", label: "Operaciones / Técnicos" },
                                    { value: "otro", label: "Otro Departamento" },
                                  ]}
                                  className="text-amber-700"
                                  title="Departamento destino"
                                />
                              )}

                              {/* Pure Icon Action: Unificar */}
                              <button
                                type="button"
                                onClick={() =>
                                  isMergingThis
                                    ? setMergingItem(null)
                                    : handleOpenMerge("tech", tech.name)
                                }
                                className={cn(
                                  "transition-colors cursor-pointer p-1",
                                  isMergingThis
                                    ? "text-neutral-950 font-bold"
                                    : "text-neutral-300 hover:text-neutral-900 group-hover:text-neutral-400"
                                )}
                                title="Unificar duplicado"
                              >
                                <GitMerge className="w-3.5 h-3.5" />
                              </button>

                              {/* Revert Single Rule (Icon only) */}
                              {tech.isModified && (
                                <button
                                  type="button"
                                  onClick={() => handleRevertTechSingle(tech.name)}
                                  className="text-neutral-300 hover:text-neutral-900 transition-colors cursor-pointer p-1"
                                  title="Restablecer regla por defecto"
                                >
                                  <RotateCcw className="w-3 h-3 stroke-[1.75]" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {/* Clean Inline Merge Target Selector */}
                      {isMergingThis && (
                        <div className="py-2 px-3 bg-neutral-50/70 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs font-mono animate-in fade-in duration-100">
                          <div className="flex items-center gap-2">
                            <span className="text-neutral-500">
                              Unificar técnico "{tech.name}" dentro de:
                            </span>
                            <CustomDropdown<string>
                              value={selectedMergeTarget}
                              onChange={(val) => setSelectedMergeTarget(val)}
                              options={availableTargetTechs
                                .filter((t) => t !== tech.name)
                                .map((target) => ({ value: target, label: target }))}
                              title="Técnico destino"
                            />
                          </div>

                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={handleConfirmMerge}
                              disabled={!selectedMergeTarget}
                              className="text-xs font-semibold text-neutral-900 hover:underline cursor-pointer disabled:opacity-40"
                            >
                              Confirmar
                            </button>
                            <button
                              type="button"
                              onClick={() => setMergingItem(null)}
                              className="text-xs text-neutral-400 hover:text-neutral-900 cursor-pointer"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </>
          )}

          {/* ========================================================= */}
          {/* TAB 3: VISIÓN DEPARTAMENTAL */}
          {/* ========================================================= */}
          {activeMainTab === "departamentos" && (
            <div className="space-y-6 py-6 text-xs font-mono">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Ventas */}
                <div className="space-y-3">
                  <div className="flex items-baseline justify-between border-b border-neutral-100 pb-2">
                    <span className="font-semibold text-neutral-900 text-sm">
                      Comercialización y Ventas
                    </span>
                    <span className="text-neutral-400">{departmentStats.ventasTotal} colaboradores</span>
                  </div>

                  <div className="space-y-2 text-neutral-500">
                    <div className="flex justify-between">
                      <span>Fijos activos:</span>
                      <span className="font-semibold text-neutral-900">{departmentStats.ventasFijos}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Ex colaboradores:</span>
                      <span>{departmentStats.ventasEx}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Transferidos a otra área:</span>
                      <span>{departmentStats.ventasOtros}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveMainTab("asesores");
                      setSubFilterTab("all");
                    }}
                    className="text-neutral-900 hover:underline font-semibold text-[11px] pt-1 cursor-pointer block"
                  >
                    Ver fuerza de ventas →
                  </button>
                </div>

                {/* Técnicos */}
                <div className="space-y-3">
                  <div className="flex items-baseline justify-between border-b border-neutral-100 pb-2">
                    <span className="font-semibold text-neutral-900 text-sm">
                      Operaciones e Instalaciones
                    </span>
                    <span className="text-neutral-400">{departmentStats.tecnicosTotal} técnicos</span>
                  </div>

                  <div className="space-y-2 text-neutral-500">
                    <div className="flex justify-between">
                      <span>Técnicos fijos:</span>
                      <span className="font-semibold text-neutral-900">{departmentStats.tecnicosFijos}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Ex colaboradores:</span>
                      <span>{departmentStats.tecnicosEx}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Transferidos a otra área:</span>
                      <span>{departmentStats.tecnicosOtros}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveMainTab("tecnicos");
                      setSubFilterTab("all");
                    }}
                    className="text-neutral-900 hover:underline font-semibold text-[11px] pt-1 cursor-pointer block"
                  >
                    Ver técnicos de campo →
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer: Fluid, Frameless Actions */}
        <div className="px-6 py-4 border-t border-neutral-100 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleRevertAll}
              disabled={
                Object.keys(draftAdvisorOverrides).length === 0 &&
                Object.keys(draftAdvisorAliases).length === 0 &&
                Object.keys(draftTechOverrides).length === 0 &&
                Object.keys(draftTechAliases).length === 0
              }
              className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Restablecer todo
            </button>

            {saveSuccess && (
              <span className="text-emerald-600 flex items-center gap-1 font-semibold">
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                Cambios guardados
              </span>
            )}

            {errorMsg && (
              <span className="text-rose-600 flex items-center gap-1 font-semibold">
                <AlertCircle className="w-3.5 h-3.5 stroke-[2]" />
                {errorMsg}
              </span>
            )}
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onClose}
              className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
            >
              Cerrar
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="text-neutral-900 hover:text-black font-semibold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5 stroke-[2]" />
              <span>{saving ? "Guardando..." : "Guardar cambios"}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
