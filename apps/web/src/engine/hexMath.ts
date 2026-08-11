import type { Point, HexKey } from '../types/hexMap';

export const HEX_DIRECTIONS: HexKey[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 }
];

/**
 * Convert Pointy-Topped Hex axial coordinates (q, r) to pixel (x, y) relative to grid origin (0,0)
 */
export function hexToPixel(q: number, r: number, radius: number): Point {
  const x = radius * Math.sqrt(3) * (q + r / 2);
  const y = radius * (3 / 2) * r;
  return { x, y };
}

/**
 * Convert pixel (x, y) relative to grid origin to nearest Hex axial coordinates (q, r)
 */
export function pixelToHex(x: number, y: number, radius: number): HexKey {
  const q = ((Math.sqrt(3) / 3) * x - (1 / 3) * y) / radius;
  const r = ((2 / 3) * y) / radius;
  return roundHex(q, r);
}

/**
 * Round fractional axial coordinates to nearest integer Hex axial coordinates
 */
export function roundHex(fracQ: number, fracR: number): HexKey {
  const fracS = -fracQ - fracR;

  let q = Math.round(fracQ);
  let r = Math.round(fracR);
  let s = Math.round(fracS);

  const qDiff = Math.abs(q - fracQ);
  const rDiff = Math.abs(r - fracR);
  const sDiff = Math.abs(s - fracS);

  if (qDiff > rDiff && qDiff > sDiff) {
    q = -r - s;
  } else if (rDiff > sDiff) {
    r = -q - s;
  }

  return { q, r };
}

/**
 * Calculate Hex Manhattan Distance between two axial coordinates
 */
export function hexDistance(a: HexKey, b: HexKey): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - (b.q + b.r))) / 2;
}

/**
 * Generate 6 corner points for a pointy-topped hexagon centered at (centerX, centerY)
 */
export function getHexPolygonPoints(centerX: number, centerY: number, radius: number): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < 6; i++) {
    const angleRad = (Math.PI / 180) * (60 * i - 30);
    points.push({
      x: centerX + radius * Math.cos(angleRad),
      y: centerY + radius * Math.sin(angleRad)
    });
  }
  return points;
}

export function hexToKey(q: number, r: number): string {
  return `${q},${r}`;
}

export function keyToHex(key: string): HexKey {
  const [q, r] = key.split(',').map(Number);
  return { q, r };
}
