"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

interface AdminDropdownProps<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (val: T) => void;
  title?: string;
  className?: string;
  disabled?: boolean;
  align?: "left" | "right";
}

export function AdminDropdown<T extends string>({
  value,
  options,
  onChange,
  title,
  className,
  disabled = false,
  align = "left",
}: AdminDropdownProps<T>) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handleClick = () => setOpen(false);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [open]);

  const currentLabel = options.find((o) => o.value === value)?.label || value;

  return (
    <div
      className="relative inline-block text-left"
      title={title}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        className={cn(
          "inline-flex items-center gap-1.5 text-xs transition-colors cursor-pointer select-none py-1 group",
          open ? "text-neutral-950 font-semibold" : "text-neutral-600 hover:text-neutral-950",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
      >
        <span>{currentLabel}</span>
        <ChevronDown
          className={cn(
            "w-3 h-3 text-neutral-400 group-hover:text-neutral-900 transition-transform duration-150 inline-block",
            open ? "rotate-180 text-neutral-950" : ""
          )}
        />
      </button>

      {open && (
        <div
          className={cn(
            "absolute mt-1.5 min-w-[160px] max-w-[260px] max-h-60 overflow-y-auto bg-white rounded-lg shadow-xl border border-neutral-200/80 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100",
            align === "right" ? "right-0 left-auto" : "left-0"
          )}
        >
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
                  "w-full text-left px-3 py-1.5 text-xs transition-colors cursor-pointer flex items-center justify-between",
                  isSelected
                    ? "font-semibold text-neutral-950 bg-neutral-50"
                    : "text-neutral-600 hover:text-neutral-950 hover:bg-neutral-50"
                )}
              >
                <span>{opt.label}</span>
                {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-neutral-900 ml-2" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
