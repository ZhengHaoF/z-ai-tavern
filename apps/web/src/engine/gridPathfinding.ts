import type { GridKey } from '../types/gridMap';
import { SQUARE_8_DIRECTIONS, octileDistance, gridToKey, keyToGrid } from './gridMath';

export interface PathfindingNode {
  col: number;
  row: number;
  g: number;
  h: number;
  f: number;
  parent: PathfindingNode | null;
}

/**
 * A* Pathfinding on Square 8-Direction Grid
 */
export function findGridPath(
  startKey: GridKey,
  targetKey: GridKey,
  walkableSet: Set<string>
): GridKey[] {
  const startStr = gridToKey(startKey.col, startKey.row);
  const targetStr = gridToKey(targetKey.col, targetKey.row);

  if (!walkableSet.has(startStr) || !walkableSet.has(targetStr)) {
    return [];
  }

  const openList: PathfindingNode[] = [];
  const closedList = new Set<string>();
  const openDict = new Map<string, PathfindingNode>();

  const startNode: PathfindingNode = {
    col: startKey.col,
    row: startKey.row,
    g: 0,
    h: octileDistance(startKey, targetKey),
    f: octileDistance(startKey, targetKey),
    parent: null
  };

  openList.push(startNode);
  openDict.set(startStr, startNode);

  while (openList.length > 0) {
    // Sort to find lowest F score
    openList.sort((a, b) => a.f - b.f);
    const current = openList.shift()!;
    const currKey = gridToKey(current.col, current.row);

    openDict.delete(currKey);
    closedList.add(currKey);

    // Reached destination!
    if (current.col === targetKey.col && current.row === targetKey.row) {
      const path: GridKey[] = [];
      let temp: PathfindingNode | null = current;
      while (temp) {
        path.unshift({ col: temp.col, row: temp.row });
        temp = temp.parent;
      }
      return path;
    }

    // Explore 8 directions
    for (const dir of SQUARE_8_DIRECTIONS) {
      const ncol = current.col + dir.col;
      const nrow = current.row + dir.row;
      const neighborStr = gridToKey(ncol, nrow);

      if (!walkableSet.has(neighborStr) || closedList.has(neighborStr)) {
        continue;
      }

      // Check diagonal corner cutting (prevent clipping through adjacent wall corners)
      if (dir.col !== 0 && dir.row !== 0) {
        const side1 = gridToKey(current.col + dir.col, current.row);
        const side2 = gridToKey(current.col, current.row + dir.row);
        if (!walkableSet.has(side1) && !walkableSet.has(side2)) {
          continue;
        }
      }

      const gScore = current.g + dir.cost;
      const hScore = octileDistance({ col: ncol, row: nrow }, targetKey);
      const fScore = gScore + hScore;

      const existingOpen = openDict.get(neighborStr);
      if (!existingOpen) {
        const neighborNode: PathfindingNode = {
          col: ncol,
          row: nrow,
          g: gScore,
          h: hScore,
          f: fScore,
          parent: current
        };
        openList.push(neighborNode);
        openDict.set(neighborStr, neighborNode);
      } else if (gScore < existingOpen.g) {
        existingOpen.g = gScore;
        existingOpen.f = fScore;
        existingOpen.parent = current;
      }
    }
  }

  return []; // Path not found
}
