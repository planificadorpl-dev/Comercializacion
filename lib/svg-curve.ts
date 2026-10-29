export interface Point {
  x: number;
  y: number;
}

/**
 * Normalizes an array of numerical values into coordinates within an SVG bounding box.
 */
export function calculatePointsFromValues(
  values: number[],
  width: number,
  height: number,
  paddingX: number = 8,
  paddingY: number = 8
): Point[] {
  if (!values || values.length === 0) return [];
  
  // If only 1 value or all values are equal, create a gentle smooth trajectory
  const nonZero = values.filter((v) => v > 0);
  if (values.length < 3 || nonZero.length <= 1) {
    const val = Math.max(...values, 1);
    const usableW = Math.max(1, width - 2 * paddingX);
    const usableH = Math.max(1, height - 2 * paddingY);
    // 5-point graceful curve
    const ratios = [0.35, 0.5, 0.72, 0.88, 0.75];
    return ratios.map((r, i) => ({
      x: Number((paddingX + (i / 4) * usableW).toFixed(1)),
      y: Number((height - paddingY - r * usableH).toFixed(1)),
    }));
  }

  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const usableWidth = Math.max(1, width - 2 * paddingX);
  const usableHeight = Math.max(1, height - 2 * paddingY);

  return values.map((val, idx) => {
    const x = paddingX + (idx / (values.length - 1)) * usableWidth;
    const normalized = (val - min) / range;
    const y = height - paddingY - normalized * usableHeight;
    return {
      x: Number(x.toFixed(1)),
      y: Number(Math.max(paddingY, Math.min(height - paddingY, y)).toFixed(1)),
    };
  });
}

/**
 * Computes a smooth cubic Bezier curve through a series of 2D points.
 */
export function generateSmoothPath(points: Point[], tension: number = 0.25): string {
  if (!points || points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const pPrev = points[Math.max(0, i - 1)];
    const pCurr = points[i];
    const pNext = points[i + 1];
    const pAfter = points[Math.min(points.length - 1, i + 2)];

    const cp1x = pCurr.x + (pNext.x - pPrev.x) * tension;
    const cp1y = pCurr.y + (pNext.y - pPrev.y) * tension;
    const cp2x = pNext.x - (pAfter.x - pCurr.x) * tension;
    const cp2y = pNext.y - (pAfter.y - pCurr.y) * tension;

    path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${pNext.x.toFixed(1)} ${pNext.y.toFixed(1)}`;
  }

  return path;
}

/**
 * Creates a closed area path for SVG gradient fills.
 */
export function generateAreaPath(points: Point[], height: number, tension: number = 0.25): string {
  if (!points || points.length === 0) return "";
  const curve = generateSmoothPath(points, tension);
  const first = points[0];
  const last = points[points.length - 1];
  return `${curve} L ${last.x} ${height} L ${first.x} ${height} Z`;
}
