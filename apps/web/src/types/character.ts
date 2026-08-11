export interface CharacterEntity {
  id: string;
  name: string;
  avatarUrl?: string;
  // 网格物理坐标 (六边形用 q,r / 正方形用 x,y)
  gridPos: {
    qOrX: number;
    rOrY: number;
  };
  // 像素物理坐标
  pixelPos?: {
    x: number;
    y: number;
  };
  facing?: 'down' | 'left' | 'right' | 'up';
  moveSpeed?: number; // 像素/秒
}
