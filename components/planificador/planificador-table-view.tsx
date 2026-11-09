"use client";

import { useState, useMemo } from "react";
import { Search, X, PenLine, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { PlanningSheetRecord, PlanningMetadata } from "@/lib/planificacion-types";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";

interface PlanificadorTableViewProps {
  records: PlanningSheetRecord[];
  metadata: PlanningMetadata;
  selectedMonth: string;
  onEditRecord: (record: PlanningSheetRecord) => void;
  onDeleteRecord: (record: PlanningSheetRecord) => Promise<boolean>;
}

const ITEMS_PER_PAGE = 25;

export function PlanificadorTableView({
  records,
  metadata,
  selectedMonth,
  onEditRecord,
  onDeleteRecord,
}: PlanificadorTableViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterEstado, setFilterEstado] = useState("all");
  const [filterActivity, setFilterActivity] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  const [deletingRecord, setDeletingRecord] = useState<PlanningSheetRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filter records
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      // Month filter (if month is selected)
      if (selectedMonth && (r.mes || "").trim().toUpperCase() !== selectedMonth.trim().toUpperCase()) {
        return false;
      }

      // Estado filter
      if (filterEstado !== "all" && r.estado !== filterEstado) {
        return false;
      }

      // Activity filter
      if (filterActivity !== "all" && r.tipo_actividad !== filterActivity) {
        return false;
      }

      // Status filter
      if (filterStatus !== "all" && r.estatus !== filterStatus) {
        return false;
      }

      // Search query (matches asesor, sector, parroquia, municipio)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesAdv = r.asesor.toLowerCase().includes(q);
        const matchesSec = r.sector.toLowerCase().includes(q);
        const matchesPar = r.parroquia.toLowerCase().includes(q);
        const matchesMun = r.municipio.toLowerCase().includes(q);
        const matchesAct = r.tipo_actividad.toLowerCase().includes(q);
        const matchesFecha = r.fecha.toLowerCase().includes(q);
        return matchesAdv || matchesSec || matchesPar || matchesMun || matchesAct || matchesFecha;
      }

      return true;
    });
  }, [records, selectedMonth, filterEstado, filterActivity, filterStatus, searchQuery]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / ITEMS_PER_PAGE));
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRecords.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredRecords, currentPage]);

  // Reset page when filters change
  useMemo(() => {
    setCurrentPage(1);
  }, [searchQuery, filterEstado, filterActivity, filterStatus, selectedMonth]);

  const confirmDelete = async () => {
    if (!deletingRecord) return;
    setIsDeleting(true);
    try {
      await onDeleteRecord(deletingRecord);
    } finally {
      setIsDeleting(false);
      setDeletingRecord(null);
    }
  };

  // CSV export function
  const handleExportCsv = () => {
    if (filteredRecords.length === 0) return;
    const headers = [
      "Fila Sheet",
      "Mes",
      "Fecha",
      "Asesor",
      "Estado",
      "Municipio",
      "Parroquia",
      "Sector",
      "Tipo de Actividad",
      "Estatus",
    ];

    const rows = filteredRecords.map((r) => [
      r.sheetRowIndex,
      r.mes,
      r.fecha,
      `"${r.asesor.replace(/"/g, '""')}"`,
      `"${r.estado.replace(/"/g, '""')}"`,
      `"${r.municipio.replace(/"/g, '""')}"`,
      `"${r.parroquia.replace(/"/g, '""')}"`,
      `"${r.sector.replace(/"/g, '""')}"`,
      `"${r.tipo_actividad.replace(/"/g, '""')}"`,
      `"${r.estatus.replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `planificacion_${(selectedMonth || "general").toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 pt-4">
      {/* Filters row */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pb-3 border-b border-neutral-100">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Search input */}
          <div className="relative w-full sm:w-60">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar asesor, sector o parroquia..."
              className="w-full text-xs border-b border-neutral-200 focus:border-neutral-900 bg-transparent py-1.5 pl-6 pr-2 transition-colors outline-hidden placeholder:text-neutral-400"
            />
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-0 top-2 stroke-[1.25]" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-0 top-2 text-neutral-400 hover:text-neutral-700 cursor-pointer"
              >
                <X className="w-3 h-3 stroke-[1.5]" />
              </button>
            )}
          </div>

          {/* Filter Estado */}
          <CustomDropdown
            value={filterEstado}
            options={[
              { value: "all", label: "Todos los estados" },
              ...Object.keys(metadata.geoHierarchy).map((e) => ({ value: e, label: e })),
            ]}
            onChange={(val) => setFilterEstado(val)}
            compact
            className="w-36"
          />

          {/* Filter Activity */}
          <CustomDropdown
            value={filterActivity}
            options={[
              { value: "all", label: "Todas las actividades" },
              ...metadata.activities.map((a) => ({ value: a, label: a })),
            ]}
            onChange={(val) => setFilterActivity(val)}
            compact
            className="w-44"
          />

          {/* Filter Status */}
          <CustomDropdown
            value={filterStatus}
            options={[
              { value: "all", label: "Todos los estatus" },
              ...metadata.statuses.map((s) => ({ value: s, label: s })),
            ]}
            onChange={(val) => setFilterStatus(val)}
            compact
            className="w-32"
          />
        </div>

        {/* Counter and Export */}
        <div className="flex items-center gap-4 text-xs text-neutral-400 shrink-0 self-end md:self-center">
          <span className="font-mono">
            {filteredRecords.length} {filteredRecords.length === 1 ? "registro" : "registros"}
          </span>
          <button
            type="button"
            onClick={handleExportCsv}
            className="hover:text-neutral-900 transition-colors flex items-center gap-1 cursor-pointer"
            title="Exportar registros filtrados a CSV"
          >
            <Download className="w-3 h-3 stroke-[1.25]" />
            <span>Exportar</span>
          </button>
        </div>
      </div>

      {/* TABLE */}
      <div className="overflow-x-auto pb-4">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-neutral-200 text-neutral-400 font-normal">
              <th className="py-2.5 pr-2 font-normal w-12 font-mono">Fila</th>
              <th className="py-2.5 px-2 font-normal">Fecha</th>
              <th className="py-2.5 px-2 font-normal">Asesor</th>
              <th className="py-2.5 px-2 font-normal">Sector</th>
              <th className="py-2.5 px-2 font-normal">Parroquia</th>
              <th className="py-2.5 px-2 font-normal">Municipio</th>
              <th className="py-2.5 px-2 font-normal">Estado</th>
              <th className="py-2.5 px-2 font-normal">Actividad</th>
              <th className="py-2.5 px-2 font-normal">Estatus</th>
              <th className="py-2.5 pl-2 font-normal text-right w-16">Acciones</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-neutral-100">
            {paginatedRecords.length > 0 ? (
              paginatedRecords.map((r) => (
                <tr key={r.id} className="hover:bg-neutral-50/60 transition-colors group">
                  <td className="py-2.5 pr-2 font-mono text-[11px] text-neutral-400">
                    {r.sheetRowIndex}
                  </td>
                  <td className="py-2.5 px-2 font-mono text-neutral-900 whitespace-nowrap">
                    {r.fecha}
                  </td>
                  <td className="py-2.5 px-2 font-medium text-neutral-900 whitespace-nowrap">
                    {r.asesor}
                  </td>
                  <td className="py-2.5 px-2 text-neutral-900 font-medium">
                    {r.sector}
                  </td>
                  <td className="py-2.5 px-2 text-neutral-500">
                    {r.parroquia}
                  </td>
                  <td className="py-2.5 px-2 text-neutral-400">
                    {r.municipio}
                  </td>
                  <td className="py-2.5 px-2 text-neutral-400">
                    {r.estado}
                  </td>
                  <td className="py-2.5 px-2 text-neutral-600 whitespace-nowrap">
                    {r.tipo_actividad}
                  </td>
                  <td className="py-2.5 px-2 text-neutral-500">
                    {r.estatus}
                  </td>
                  <td className="py-2.5 pl-2 text-right whitespace-nowrap">
                    {/* Hover actions: PenLine for edit, X for remove */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onEditRecord(r)}
                        className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
                        title="Editar fila en Sheet Data"
                      >
                        <PenLine className="w-3.5 h-3.5 stroke-[1.25]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingRecord(r)}
                        className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
                        title="Eliminar fila de Sheet Data"
                      >
                        <X className="w-3.5 h-3.5 stroke-[1.5]" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={10} className="py-8 text-center text-xs text-neutral-400 font-normal">
                  No se encontraron jornadas planificadas con los filtros seleccionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Minimalist Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 border-t border-neutral-100 text-xs text-neutral-400">
          <span className="font-mono">
            Página {currentPage} de {totalPages}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer disabled:opacity-30 p-1"
              title="Página anterior"
            >
              <ChevronLeft className="w-4 h-4 stroke-[1.25]" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer disabled:opacity-30 p-1"
              title="Página siguiente"
            >
              <ChevronRight className="w-4 h-4 stroke-[1.25]" />
            </button>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM DIALOG */}
      <DeleteConfirmDialog
        isOpen={Boolean(deletingRecord)}
        title="Eliminar registro de la hoja Data"
        description={
          deletingRecord
            ? `¿Confirmas eliminar la fila ${deletingRecord.sheetRowIndex} (${deletingRecord.asesor} · ${deletingRecord.sector} · ${deletingRecord.fecha}) de la hoja Data?`
            : undefined
        }
        onConfirm={confirmDelete}
        onCancel={() => setDeletingRecord(null)}
      />
    </div>
  );
}

