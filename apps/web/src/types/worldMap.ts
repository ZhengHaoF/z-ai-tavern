export interface WorldPortal {
  id: string;
  name: string;
  gridKeys: string[]; // 占用的地块 "col,row" 组合
  color?: string; // 专属视觉发光调色盘 (HEX 字符串，如 #38bdf8, #c084fc, #34d399, #e6c280)
}

export interface WorldMapNode {
  id: string;
  name: string;
  canvasPos: { x: number; y: number }; // 节点在 ComfyUI 工作台上的坐标
  gridType: 'square' | 'hex';
  gridSize: number;
  imgWidth: number;
  imgHeight: number;
  bgFileName: string;
  walkableCells: string[];
  portals: WorldPortal[];
  // 运行时内存字段
  bgImageBlob?: Blob;
  bgImageUrl?: string;
}

export interface WorldLink {
  id: string;
  fromMapId: string;
  fromPortalId: string;
  toMapId: string;
  toPortalId: string;
  isBidirectional: boolean;
}

export interface ZWorldManifest {
  version: string;
  worldId: string;
  worldName: string;
  createdAt: number;
  maps: Array<{
    id: string;
    name: string;
    canvasPos: { x: number; y: number };
    gridType: 'square' | 'hex';
    gridSize: number;
    imgWidth: number;
    imgHeight: number;
    bgFileName: string;
    walkableCells: string[];
    portals: WorldPortal[];
  }>;
  links: WorldLink[];
}
