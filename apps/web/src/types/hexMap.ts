export interface HexCell {
  q: number;
  r: number;
  walkable: boolean;
  x: number;
  y: number;
}

export interface MapHexGridConfig {
  mapId: string;
  bgImageName?: string;
  bgImageDataUrl?: string;
  hexSize: number; // Hexagon radius in pixels
  cols: number;
  rows: number;
  walkableCells: string[]; // Set of "q,r" keys
}

export interface Point {
  x: number;
  y: number;
}

export interface HexKey {
  q: number;
  r: number;
}
