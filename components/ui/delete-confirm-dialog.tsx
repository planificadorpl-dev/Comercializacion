"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DeleteConfirmDialogProps {
  isOpen: boolean;
  title?: string;
  description?: string;
  itemName?: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
}

export function DeleteConfirmDialog({
  isOpen,
  title = "Confirmar eliminación",
  description,
  itemName,
  onConfirm,
  onCancel,
  confirmLabel = "Eliminar",
  cancelLabel = "Cancelar",
}: DeleteConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/40 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm bg-white rounded-xl shadow-2xl border border-neutral-200/90 p-5 space-y-4 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h3 className="text-sm font-semibold text-neutral-900 tracking-tight">
            {title}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="w-4 h-4 stroke-[1.5]" />
          </button>
        </div>

        <p className="text-xs text-neutral-500 leading-relaxed">
          {description ? (
            description
          ) : (
            <>
              ¿Estás seguro de que deseas eliminar este registro
              {itemName ? (
                <>
                  {" "}
                  <strong className="text-neutral-800 font-medium">{itemName}</strong>
                </>
              ) : null}
              ? Esta acción no se puede deshacer.
            </>
          )}
        </p>

        <div className="flex items-center justify-end gap-4 pt-2 text-xs">
          <button
            type="button"
            onClick={onCancel}
            className="text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer select-none"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="text-red-600 hover:text-red-700 font-medium transition-colors cursor-pointer select-none"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
