"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

export interface DropdownOption {
  value: string;
  label: string;
}

interface CustomDropdownProps {
  value: string;
  options: (DropdownOption | string)[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  align?: "left" | "right";
  compact?: boolean;
}

export function CustomDropdown({
  value,
  options,
  onChange,
  placeholder = "Seleccionar...",
  className,
  disabled = false,
  align = "left",
  compact = false,
}: CustomDropdownProps) {
  const [open, setOpen] = useState(false);
  const [resolvedAlign, setResolvedAlign] = useState<"left" | "right">(align);
  const containerRef = useRef<HTMLDivElement>(null);

  // Normalize options to DropdownOption format
  const normalizedOptions: DropdownOption[] = options.map((opt) =>
    typeof opt === "string" ? { value: opt, label: opt } : opt
  );

  useEffect(() => {
    if (!open) return;
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const dropdownEstWidth = 190;
      if (rect.left + dropdownEstWidth > window.innerWidth - 12) {
        setResolvedAlign("right");
      } else if (rect.right - dropdownEstWidth < 12 && align === "right") {
        setResolvedAlign("left");
      } else {
        setResolvedAlign(align);
      }
    }
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [open, align]);

  const currentLabel =
    normalizedOptions.find((o) => o.value === value)?.label || (value ? value : placeholder);

  return (
    <div
      ref={containerRef}
      className={cn("relative inline-block text-left w-full", open ? "z-50" : "z-auto", className)}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        className={cn(
          "w-full flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer select-none group",
          compact ? "py-1" : "min-h-[44px] py-2.5 px-1 border-b border-neutral-200 hover:border-neutral-400",
          open ? "text-neutral-950 font-semibold" : "text-neutral-700 hover:text-neutral-950",
          !value && "text-neutral-400 font-normal",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <span className="truncate">{currentLabel}</span>
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-900 transition-transform duration-150 shrink-0",
            open ? "rotate-180 text-neutral-950" : ""
          )}
        />
      </button>

      {open && (
        <div
          className={cn(
            "absolute mt-1 min-w-[180px] w-full max-w-[calc(100vw-24px)] max-h-64 overflow-y-auto bg-white rounded-lg shadow-xl border border-neutral-200/90 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100",
            resolvedAlign === "right" ? "right-0 left-auto" : "left-0"
          )}
        >
          {normalizedOptions.length === 0 ? (
            <div className="px-3 py-2 text-xs text-neutral-400 italic">No hay opciones disponibles</div>
          ) : (
            normalizedOptions.map((opt) => {
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
                    "w-full text-left px-3.5 py-2.5 min-h-[40px] text-xs transition-colors cursor-pointer flex items-center justify-between",
                    isSelected
                      ? "font-semibold text-neutral-950 bg-neutral-50"
                      : "text-neutral-600 hover:text-neutral-950 hover:bg-neutral-50"
                  )}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-neutral-900 ml-2 shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
