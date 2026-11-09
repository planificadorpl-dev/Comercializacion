"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, Search, X } from "lucide-react";

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
  searchable?: boolean;
  searchPlaceholder?: string;
}

function normalizeSearch(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
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
  searchable,
  searchPlaceholder = "Buscar...",
}: CustomDropdownProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [resolvedAlign, setResolvedAlign] = useState<"left" | "right">(align);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Normalize options to DropdownOption format
  const normalizedOptions: DropdownOption[] = useMemo(() => {
    return options.map((opt) =>
      typeof opt === "string" ? { value: opt, label: opt } : opt
    );
  }, [options]);

  const shouldShowSearch =
    searchable !== undefined ? searchable : normalizedOptions.length > 7;

  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      return;
    }
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const dropdownEstWidth = 220;
      if (rect.left + dropdownEstWidth > window.innerWidth - 12) {
        setResolvedAlign("right");
      } else if (rect.right - dropdownEstWidth < 12 && align === "right") {
        setResolvedAlign("left");
      } else {
        setResolvedAlign(align);
      }
    }

    if (shouldShowSearch) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [open, align, shouldShowSearch]);

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return normalizedOptions;
    const query = normalizeSearch(searchQuery);
    return normalizedOptions.filter((opt) =>
      normalizeSearch(opt.label).includes(query) || normalizeSearch(opt.value).includes(query)
    );
  }, [normalizedOptions, searchQuery]);

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
          compact
            ? "py-1.5 px-0.5 border-b border-neutral-200 hover:border-neutral-500 focus:border-neutral-900"
            : "min-h-[44px] py-2.5 px-1 border-b border-neutral-200 hover:border-neutral-400",
          open ? "text-neutral-950 font-semibold border-neutral-900" : "text-neutral-700 hover:text-neutral-950",
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
            "absolute mt-1 min-w-[200px] w-full max-w-[calc(100vw-24px)] bg-white rounded-lg shadow-xl border border-neutral-200/90 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 flex flex-col",
            resolvedAlign === "right" ? "right-0 left-auto" : "left-0"
          )}
        >
          {shouldShowSearch && (
            <div className="px-2.5 py-1.5 border-b border-neutral-100 flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full bg-transparent text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none font-sans"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="text-neutral-400 hover:text-neutral-900 transition-colors p-0.5 cursor-pointer"
                  title="Limpiar"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          <div className="max-h-60 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-3.5 py-2.5 text-xs text-neutral-400 italic font-sans">
                {searchQuery ? "Sin coincidencias" : "No hay opciones disponibles"}
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
                      "w-full text-left px-3.5 py-2 min-h-[36px] text-xs transition-colors cursor-pointer flex items-center justify-between font-sans",
                      isSelected
                        ? "font-semibold text-neutral-950 bg-neutral-50"
                        : "text-neutral-600 hover:text-neutral-950 hover:bg-neutral-50/80"
                    )}
                  >
                    <span className="truncate">{opt.label}</span>
                    {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-neutral-900 ml-2 shrink-0" />}
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
