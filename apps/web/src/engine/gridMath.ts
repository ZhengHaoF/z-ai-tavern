import type { Point, GridKey } from '../types/gridMap';

export interface GridDirection extends GridKey {
  cost: number;
}

export const SQUARE_8_DIRECTIONS: GridDirection[] = [
  { col: 0, row: -1, cost: 1.0 },   // N
  { col: 1, row: 0, cost: 1.0 },    // E
  { col: 0, row: 1, cost: 1.0 },    // S
  { col: -1, row: 0, cost: 1.0 },   // W
  { col: 1, row: -1, cost: 1.414 }, // NE
  { col: 1, row: 1, cost: 1.414 },  // SE
  { col: -1, row: 1, cost: 1.414 }, // SW
  { col: -1, row: -1, cost: 1.414 } // NW
];

/**
 * Convert Square Grid coordinates (col, row) to pixel (x, y) center relative to grid origin (0,0)
 */
export function gridToPixel(col: number, row: number, size: number): Point {
  return {
    x: col * size + size / 2,
    y: row * size + size / 2
  };
}

/**
 * Convert pixel (x, y) relative to grid origin to nearest Square Grid coordinates (col, row)
 */
export function pixelToGrid(x: number, y: number, size: number): GridKey {
  return {
    col: Math.floor(x / size),
    row: Math.floor(y / size)
  };
}

/**
 * Calculate Octile Distance for 8-direction grid pathfinding heuristic
 */
export function octileDistance(a: GridKey, b: GridKey): number {
  const dx = Math.abs(a.col - b.col);
  const dy = Math.abs(a.row - b.row);
  const min = Math.min(dx, dy);
  const max = Math.max(dx, dy);
  return min * 1.414 + (max - min);
}

export function gridToKey(col: number, row: number): string {
  return `${col},${row}`;
}

export function keyToGrid(key: string): GridKey {
  const [col, row] = key.split(',').map(Number);
  return { col, row };
}
