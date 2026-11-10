/**
 * Timezone and Date Utilities for America/Caracas (UTC-4)
 * Client-safe and server-safe (pure JavaScript, no Node/fs/db dependencies)
 */

export function getCaracasTodayIso(): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Caracas",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
}

export function getCaracasDateIso(d: Date): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Caracas",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
}

export function normalizeDateToIso(dateStr?: string | Date | null): string {
  if (!dateStr) return "";
  if (dateStr instanceof Date) {
    return getCaracasDateIso(dateStr);
  }
  const clean = String(dateStr).trim();

  // If already YYYY-MM-DD or contains T
  if (clean.includes("T")) {
    return clean.split("T")[0];
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean;
  }
  // If locale string like "Mon Nov 09 2026..."
  if (/^[a-z]{3}\s+[a-z]{3}\s+\d{1,2}\s+\d{4}/i.test(clean)) {
    const parsed = new Date(clean);
    if (!isNaN(parsed.getTime())) {
      return getCaracasDateIso(parsed);
    }
  }
  // If DD/MM/YYYY or YYYY/MM/DD
  if (clean.includes("/")) {
    const parts = clean.split("/");
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
      }
      return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
    }
  }
  // If DD-MM-YYYY
  if (clean.includes("-")) {
    const parts = clean.split("-");
    if (parts.length === 3 && parts[0].length <= 2 && parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
    }
  }
  return clean;
}

