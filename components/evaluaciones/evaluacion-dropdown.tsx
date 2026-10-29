"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, Search } from "lucide-react";

interface EvaluacionDropdownProps<T extends string> {
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (val: T) => void;
  title?: string;
  className?: string;
  disabled?: boolean;
  align?: "left" | "right";
  placeholder?: string;
  withSearch?: boolean;
}

export function EvaluacionDropdown<T extends string>({
  value,
  options,
  onChange,
  title,
  className,
  disabled = false,
  align = "left",
  placeholder = "Seleccionar...",
  withSearch = false,
}: EvaluacionDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [resolvedAlign, setResolvedAlign] = useState<"left" | "right">(align);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setSearch("");
      return;
    }
    if (dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      const dropdownEstWidth = 200;
      if (rect.left + dropdownEstWidth > window.innerWidth - 12) {
        setResolvedAlign("right");
      } else if (rect.right - dropdownEstWidth < 12 && align === "right") {
        setResolvedAlign("left");
      } else {
        setResolvedAlign(align);
      }
    }
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [open, align]);

  const currentOption = options.find((o) => o.value === value);
  const currentLabel = currentOption ? currentOption.label : value || placeholder;

  const filteredOptions = withSearch && search.trim()
    ? options.filter((o) =>
        o.label.toLowerCase().includes(search.toLowerCase()) ||
        o.value.toLowerCase().includes(search.toLowerCase()) ||
        (o.hint && o.hint.toLowerCase().includes(search.toLowerCase()))
      )
    : options;

  return (
    <div
      ref={dropdownRef}
      className="relative w-full min-w-0 max-w-full text-left"
      title={title}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        title={currentLabel}
        className={cn(
          "w-full max-w-full inline-flex items-center justify-between gap-1.5 text-xs transition-colors cursor-pointer select-none py-1 group overflow-hidden min-w-0",
          open ? "text-neutral-950 font-semibold" : "text-neutral-600 hover:text-neutral-950",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
      >
        <span className="truncate flex-1 text-left min-w-0">{currentLabel}</span>
        <ChevronDown
          className={cn(
            "w-3 h-3 text-neutral-400 group-hover:text-neutral-900 transition-transform duration-150 inline-block shrink-0",
            open ? "rotate-180 text-neutral-950" : ""
          )}
        />
      </button>

      {open && (
        <div
          className={cn(
            "absolute mt-1.5 min-w-[180px] max-w-[calc(100vw-24px)] bg-white rounded-lg shadow-xl border border-neutral-200/80 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100",
            resolvedAlign === "right" ? "right-0 left-auto" : "left-0"
          )}
        >
          {withSearch && (
            <div className="px-2.5 pb-1.5 pt-0.5 border-b border-neutral-100 flex items-center gap-1.5">
              <Search className="w-3 h-3 text-neutral-400 shrink-0" />
              <input
                type="text"
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar opción..."
                className="w-full text-xs bg-transparent border-none outline-none text-neutral-900 placeholder:text-neutral-400 py-0.5 font-sans"
              />
            </div>
          )}

          <div className="max-h-56 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-xs text-neutral-400 italic">
                Sin resultados
              </div>
            ) : (
              filteredOptions.map((opt) => {
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
                    <div className="flex flex-col truncate pr-2">
                      <span className="truncate">{opt.label}</span>
                      {opt.hint && (
                        <span className="text-[10px] text-neutral-400 font-mono">
                          {opt.hint}
                        </span>
                      )}
                    </div>
                    {isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-neutral-900 ml-2 shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
