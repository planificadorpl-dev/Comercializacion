"use client";

import { X } from "lucide-react";

interface ToastPillProps {
  message: string | null;
  onClose: () => void;
  type?: "success" | "error" | "info";
}

export function ToastPill({ message, onClose, type = "success" }: ToastPillProps) {
  if (!message) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-3 py-2 bg-neutral-900 text-white rounded-md shadow-lg text-xs font-mono animate-in fade-in slide-in-from-bottom-2 duration-150">
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
          type === "error" ? "bg-red-400" : "bg-emerald-400"
        }`}
      />
      <span>{message}</span>
      <button
        type="button"
        onClick={onClose}
        className="text-neutral-400 hover:text-white ml-2 transition-colors cursor-pointer"
        title="Cerrar notificación"
      >
        <X className="w-3 h-3 stroke-[1.5]" />
      </button>
    </div>
  );
}
