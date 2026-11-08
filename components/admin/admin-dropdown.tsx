"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, Search, X } from "lucide-react";

interface AdminDropdownProps<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (val: T) => void;
  title?: string;
  className?: string;
  disabled?: boolean;
  align?: "left" | "right";
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

export function AdminDropdown<T extends string>({
  value,
  options,
  onChange,
  title,
  className,
  disabled = false,
  align = "left",
  searchable,
  searchPlaceholder = "Buscar...",
}: AdminDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const shouldShowSearch =
    searchable !== undefined ? searchable : options.length > 7;

  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      return;
    }

    if (shouldShowSearch) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }

    const handleClick = () => setOpen(false);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [open, shouldShowSearch]);

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const query = normalizeSearch(searchQuery);
    return options.filter((opt) =>
      normalizeSearch(opt.label).includes(query) || normalizeSearch(opt.value).includes(query)
    );
  }, [options, searchQuery]);

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
          "inline-flex items-center gap-1.5 text-xs transition-colors cursor-pointer select-none py-1 group font-sans",
          open ? "text-neutral-950 font-semibold" : "text-neutral-600 hover:text-neutral-950",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
      >
        <span>{currentLabel}</span>
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
            "absolute mt-1.5 min-w-[170px] max-w-[280px] bg-white rounded-lg shadow-xl border border-neutral-200/80 py-1 z-50 animate-in fade-in zoom-in-95 duration-100 flex flex-col",
            align === "right" ? "right-0 left-auto" : "left-0"
          )}
        >
          {shouldShowSearch && (
            <div className="px-2.5 py-1.5 border-b border-neutral-100 flex items-center gap-2">
              <Search className="w-3 h-3 text-neutral-400 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full bg-transparent text-[11px] text-neutral-900 placeholder:text-neutral-400 focus:outline-none font-sans"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="text-neutral-400 hover:text-neutral-900 transition-colors p-0.5 cursor-pointer"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          )}

          <div className="max-h-56 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-[11px] text-neutral-400 italic font-sans">
                {searchQuery ? "Sin coincidencias" : "Sin opciones"}
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
                      "w-full text-left px-3 py-1.5 text-xs transition-colors cursor-pointer flex items-center justify-between font-sans",
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
