import type { HexKey } from '../types/hexMap';
import { HEX_DIRECTIONS, hexDistance, hexToKey, keyToHex } from './hexMath';

export interface PathfindingNode {
  q: number;
  r: number;
  g: number;
  h: number;
  f: number;
  parent: PathfindingNode | null;
}

/**
 * A* Pathfinding on Hexagonal Grid
 */
export function findHexPath(
  startKey: HexKey,
  targetKey: HexKey,
  walkableSet: Set<string>
): HexKey[] {
  const startStr = hexToKey(startKey.q, startKey.r);
  const targetStr = hexToKey(targetKey.q, targetKey.r);

  if (!walkableSet.has(startStr) || !walkableSet.has(targetStr)) {
    return [];
  }

  const openList: PathfindingNode[] = [];
  const closedList = new Set<string>();
  const openDict = new Map<string, PathfindingNode>();

  const startNode: PathfindingNode = {
    q: startKey.q,
    r: startKey.r,
    g: 0,
    h: hexDistance(startKey, targetKey),
    f: hexDistance(startKey, targetKey),
    parent: null
  };

  openList.push(startNode);
  openDict.set(startStr, startNode);

  while (openList.length > 0) {
    // Sort to find lowest F score
    openList.sort((a, b) => a.f - b.f);
    const current = openList.shift()!;
    const currKey = hexToKey(current.q, current.r);

    openDict.delete(currKey);
    closedList.add(currKey);

    // Reached destination!
    if (current.q === targetKey.q && current.r === targetKey.r) {
      const path: HexKey[] = [];
      let temp: PathfindingNode | null = current;
      while (temp) {
        path.unshift({ q: temp.q, r: temp.r });
        temp = temp.parent;
      }
      return path;
    }

    // Explore 6 neighbors
    for (const dir of HEX_DIRECTIONS) {
      const nq = current.q + dir.q;
      const nr = current.r + dir.r;
      const neighborStr = hexToKey(nq, nr);

      if (!walkableSet.has(neighborStr) || closedList.has(neighborStr)) {
        continue;
      }

      const gScore = current.g + 1;
      const hScore = hexDistance({ q: nq, r: nr }, targetKey);
      const fScore = gScore + hScore;

      const existingOpen = openDict.get(neighborStr);
      if (!existingOpen) {
        const neighborNode: PathfindingNode = {
          q: nq,
          r: nr,
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
