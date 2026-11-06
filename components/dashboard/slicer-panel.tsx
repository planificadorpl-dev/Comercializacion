"use client";

import { useState } from "react";
import { Check, ChevronDown, Filter, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuCheckboxItem,
    DropdownMenuTrigger,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

interface FilterDropdownProps {
    title: string;
    items: string[];
    selectedItems: string[];
    onChange: (item: string) => void;
}

function FilterDropdown({ title, items, selectedItems, onChange }: FilterDropdownProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const count = selectedItems.length;
    const isActive = count > 0;

    const filteredItems = items.filter(item =>
        item.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant={isActive ? "secondary" : "outline"}
                    size="sm"
                    className={cn(
                        "h-8 rounded-lg px-3 text-xs transition-all font-medium gap-1 shadow-none",
                        isActive
                            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                            : "bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] text-[#9CA3AF] hover:text-white"
                    )}
                >
                    {title}
                    {count > 0 && (
                        <span className="ml-1 flex h-4 min-w-[1rem] items-center justify-center rounded-md bg-emerald-500/20 text-[10px] text-emerald-300 font-bold px-1 font-mono">
                            {count}
                        </span>
                    )}
                    <ChevronDown className={cn("ml-1 h-3.5 w-3.5 opacity-50 transition-transform", isActive && "opacity-100")} />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[220px] bg-[#141414]/95 backdrop-blur-xl border border-white/[0.08] shadow-2xl rounded-xl custom-scrollbar" onCloseAutoFocus={(e) => e.preventDefault()}>
                <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06] sticky top-0 bg-[#141414] z-10">
                    <Search className="w-4 h-4 text-[#6B7280] shrink-0" />
                    <input
                        type="text"
                        placeholder={`Buscar...`}
                        className="flex-1 bg-transparent text-xs text-white placeholder:text-[#4B5563] focus:outline-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()}
                    />
                </div>

                <div className="max-h-[250px] overflow-y-auto p-1.5 custom-scrollbar">
                    {filteredItems.length === 0 ? (
                        <div className="p-3 text-xs text-center text-[#6B7280]">No se encontraron resultados</div>
                    ) : (
                        filteredItems.map((item) => (
                            <DropdownMenuCheckboxItem
                                key={item}
                                checked={selectedItems.includes(item)}
                                onCheckedChange={() => onChange(item)}
                                onSelect={(e) => e.preventDefault()}
                                className="text-xs cursor-pointer rounded-lg text-[#D1D5DB] focus:bg-white/[0.06] focus:text-white pl-8 py-1.5"
                            >
                                <span className="truncate">{item}</span>
                            </DropdownMenuCheckboxItem>
                        ))
                    )}
                </div>

                {isActive && (
                    <div className="p-2 border-t border-white/[0.06] bg-white/[0.02] sticky bottom-0 z-10">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-xs h-7 justify-center text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg"
                            onClick={(e) => {
                                e.preventDefault();
                                selectedItems.forEach(i => onChange(i)); // Deselect all
                                setSearchTerm("");
                            }}
                        >
                            <X className="w-3 h-3 mr-1" />
                            Limpiar seleccion
                        </Button>
                    </div>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export interface FilterState {
    advisors: string[];
    zones: string[];
    statuses: string[];
    months: string[];
    sectors: string[];
    technicians: string[];
    oficinas: string[];
    dateFrom: string;
    dateTo: string;
}

interface SlicerPanelProps {
    advisors: string[];
    zones: string[];
    sectors: string[];
    statuses?: string[];
    months?: string[];
    technicians?: string[];
    oficinas?: string[];
    currentFilters: FilterState;
    onFilterChange: (type: keyof FilterState, value: string) => void;
    onDateChange: (type: 'dateFrom' | 'dateTo', value: string) => void;
    onResetFilters?: () => void;
}

export function SlicerPanel({ advisors, zones, sectors, statuses = [], months = [], technicians = [], oficinas = [], currentFilters, onFilterChange, onDateChange, onResetFilters }: SlicerPanelProps) {

    const handleToggle = (type: keyof FilterState, item: string) => {
        onFilterChange(type, item);
    };

    const hasActiveFilters = Object.values(currentFilters).some(v => Array.isArray(v) ? v.length > 0 : !!v);

    return (
        <div className="w-full flex flex-wrap items-center gap-2 py-2">
            {/* Date Range Filter */}
            <div className="flex items-center gap-1.5 shrink-0 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-1 text-xs">
                <span className="text-[#6B7280] font-medium text-[11px] mr-1">Rango:</span>
                <input
                    type="date"
                    value={currentFilters.dateFrom}
                    onChange={(e) => onDateChange('dateFrom', e.target.value)}
                    className="h-7 w-28 px-1.5 text-xs rounded-md border border-white/[0.06] bg-black/30 text-white focus:outline-none focus:border-emerald-500/50"
                    placeholder="Desde"
                />
                <span className="text-[#4B5563]">—</span>
                <input
                    type="date"
                    value={currentFilters.dateTo}
                    onChange={(e) => onDateChange('dateTo', e.target.value)}
                    className="h-7 w-28 px-1.5 text-xs rounded-md border border-white/[0.06] bg-black/30 text-white focus:outline-none focus:border-emerald-500/50"
                    placeholder="Hasta"
                />
            </div>

            <FilterDropdown
                title="Mes"
                items={months.length > 0 ? months : ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"]}
                selectedItems={currentFilters.months}
                onChange={(item) => handleToggle('months', item)}
            />

            <FilterDropdown
                title="Estatus"
                items={statuses.length > 0 ? statuses : ["INSTALACION", "MIGRACION", "CONVENIO", "EMPLEADO", "MUDANZA"].sort()}
                selectedItems={currentFilters.statuses}
                onChange={(item) => handleToggle('statuses', item)}
            />

            <FilterDropdown
                title="Asesor"
                items={advisors}
                selectedItems={currentFilters.advisors}
                onChange={(item) => handleToggle('advisors', item)}
            />

            <FilterDropdown
                title="Técnico"
                items={technicians}
                selectedItems={currentFilters.technicians}
                onChange={(item) => handleToggle('technicians', item)}
            />

            <FilterDropdown
                title="Zona"
                items={zones}
                selectedItems={currentFilters.zones}
                onChange={(item) => handleToggle('zones', item)}
            />

            <FilterDropdown
                title="Sector"
                items={sectors}
                selectedItems={currentFilters.sectors}
                onChange={(item) => handleToggle('sectors', item)}
            />

            <FilterDropdown
                title="Oficina"
                items={oficinas}
                selectedItems={currentFilters.oficinas}
                onChange={(item) => handleToggle('oficinas', item)}
            />

            {hasActiveFilters && onResetFilters && (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onResetFilters}
                    className="h-8 px-2.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg font-medium gap-1 shrink-0 ml-auto"
                >
                    <X className="w-3.5 h-3.5" />
                    Limpiar filtros
                </Button>
            )}
        </div>
    );
}
