import {
  FactibilidadBox,
  getFastFactibilidadBoxes,
  getFastFactibilidadBoxesInRadius,
  syncBoxesWithOzmap,
} from "./factibilidad-store";

export type OzBox = FactibilidadBox;

/**
 * Get all feasibility boxes using high-speed multi-tier caching:
 * Memory (0ms) -> Disk Cache (~15ms) -> PostgreSQL / Supabase (~40ms) -> OZmap background sync
 */
export async function getFactibilidadBoxes(forceRefresh = false): Promise<OzBox[]> {
  return getFastFactibilidadBoxes(forceRefresh);
}

/**
 * Get boxes in radius for point evaluation
 */
export async function getFactibilidadBoxesInRadius(
  lat: number,
  lng: number,
  radiusMeters = 1000,
  forceRefresh = false
): Promise<{ boxes: OzBox[]; totalInRadius: number; availableInRadius: number }> {
  return getFastFactibilidadBoxesInRadius(lat, lng, radiusMeters, forceRefresh);
}

export { syncBoxesWithOzmap };
