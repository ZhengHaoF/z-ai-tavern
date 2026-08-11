export interface GridCell {
  col: number;
  row: number;
  walkable: boolean;
  x: number;
  y: number;
}

export interface MapGridConfig {
  mapId: string;
  bgImageName?: string;
  bgImageDataUrl?: string;
  gridSize: number; // Square cell width/height in pixels
  cols: number;
  rows: number;
  walkableCells: string[]; // Set of "col,row" keys
}

export interface Point {
  x: number;
  y: number;
}

export interface GridKey {
  col: number;
  row: number;
}

export interface ZMapManifest {
  version: string;
  mapId: string;
  mapName?: string;
  createdAt: number;
  gridSize: number;
  cols: number;
  rows: number;
  bgImageFile: string;
  walkableCells: string[];
}

