import { Application, Container, Graphics, Sprite, Assets, Texture } from 'pixi.js';
import type { GridKey, MapGridConfig, ZMapManifest } from '../types/gridMap';
import { gridToPixel, pixelToGrid, gridToKey, keyToGrid } from './gridMath';
import { findGridPath } from './gridPathfinding';

export type BrushMode = 'walkable' | 'eraser';

export interface PixiGridEngineCallbacks {
  onWalkableCountChange?: (count: number) => void;
  onHoverGrid?: (grid: GridKey | null) => void;
}

export class PixiGridEngine {
  private app: Application | null = null;
  private containerEl: HTMLElement | null = null;

  // Pixi Containers
  private mapContainer: Container | null = null;
  private bgSprite: Sprite | null = null;
  private gridGfx: Graphics | null = null;
  private playerTokenGfx: Graphics | null = null;
  private pathGfx: Graphics | null = null;

  // Grid Parameters
  private gridSize = 32;
  private walkableSet = new Set<string>();
  private brushMode: BrushMode = 'walkable';
  private isTestMode = false;
  private isBrushing = false;

  // Image Info
  private bgImageUrl = '';
  private currentImageBlob: Blob | null = null;
  private imgWidth = 1200;
  private imgHeight = 800;

  // Player Test Movement
  private playerGrid: GridKey = { col: 0, row: 0 };
  private playerPos = { x: 0, y: 0 };
  private targetPos = { x: 0, y: 0 };
  private movePath: GridKey[] = [];
  private isMoving = false;
  private moveSpeed = 0.12;

  // Keyboard State for WASD Combinations
  private activeKeys = new Set<string>();

  private callbacks: PixiGridEngineCallbacks = {};

  async init(element: HTMLElement, callbacks?: PixiGridEngineCallbacks) {
    this.containerEl = element;
    if (callbacks) this.callbacks = callbacks;

    const app = new Application();
    await app.init({
      resizeTo: element,
      background: '#08080c',
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1
    });

    this.app = app;
    element.appendChild(app.canvas);

    this.mapContainer = new Container();
    this.gridGfx = new Graphics();
    this.pathGfx = new Graphics();
    this.playerTokenGfx = new Graphics();

    this.app.stage.addChild(this.mapContainer);
    this.mapContainer.addChild(this.gridGfx);
    this.mapContainer.addChild(this.pathGfx);
    this.mapContainer.addChild(this.playerTokenGfx);

    if (this.bgImageUrl) {
      await this.loadBackgroundImage(this.bgImageUrl);
    } else {
      this.centerAndScaleMap();
      this.redrawGrid();
    }

    this.setupEvents();
    this.app.ticker.add(this.updatePlayerMovement.bind(this));
  }

  async loadBackgroundImage(imageUrl: string, imageBlob?: Blob) {
    this.bgImageUrl = imageUrl;
    if (imageBlob) {
      this.currentImageBlob = imageBlob;
    }

    if (!this.app || !this.mapContainer) return;

    try {
      let texture: Texture;
      if (imageUrl.startsWith('blob:') || imageUrl.startsWith('data:')) {
        texture = await new Promise<Texture>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            try {
              const tex = Texture.from(img);
              resolve(tex);
            } catch (err) {
              reject(err);
            }
          };
          img.onerror = (err) => reject(err);
          img.src = imageUrl;
        });
      } else {
        try {
          texture = await Assets.load({ src: imageUrl, loadParser: 'loadTextures' });
        } catch {
          texture = await Assets.load(imageUrl);
        }
      }

      if (!texture) {
        throw new Error('Texture creation returned null');
      }

      if (this.bgSprite) {
        this.mapContainer.removeChild(this.bgSprite);
        this.bgSprite.destroy();
      }

      this.bgSprite = new Sprite(texture);
      this.imgWidth = texture.width;
      this.imgHeight = texture.height;

      // Center & scale background
      this.centerAndScaleMap();
      this.mapContainer.addChildAt(this.bgSprite, 0);
      this.redrawGrid();
    } catch (err) {
      console.warn('Failed to load background image:', err);
    }
  }

  async getBackgroundImageBlob(): Promise<Blob | null> {
    if (this.currentImageBlob) {
      return this.currentImageBlob;
    }
    if (this.bgImageUrl.startsWith('data:') || this.bgImageUrl.startsWith('blob:')) {
      try {
        const res = await fetch(this.bgImageUrl);
        return await res.blob();
      } catch {
        return null;
      }
    }
    return null;
  }

  setGridSize(size: number) {
    this.gridSize = Math.max(16, Math.min(80, size));
    this.redrawGrid();
  }

  getGridSize(): number {
    return this.gridSize;
  }

  setBrushMode(mode: BrushMode) {
    this.brushMode = mode;
  }

  setTestMode(enabled: boolean) {
    this.isTestMode = enabled;
    if (enabled) {
      // Set initial player grid to first walkable cell if available
      if (this.walkableSet.size > 0 && !this.walkableSet.has(gridToKey(this.playerGrid.col, this.playerGrid.row))) {
        const firstKey = Array.from(this.walkableSet)[0];
        this.playerGrid = keyToGrid(firstKey);
      }
      const pixel = gridToPixel(this.playerGrid.col, this.playerGrid.row, this.gridSize);
      this.playerPos = { ...pixel };
      this.targetPos = { ...pixel };
    } else {
      this.movePath = [];
      this.isMoving = false;
      this.activeKeys.clear();
    }
    this.redrawGrid();
  }

  clearGrid() {
    this.walkableSet.clear();
    this.redrawGrid();
    if (this.callbacks.onWalkableCountChange) {
      this.callbacks.onWalkableCountChange(0);
    }
  }

  exportZMapManifest(mapId = `map_${Date.now()}`): ZMapManifest {
    return {
      version: '1.0',
      mapId,
      createdAt: Date.now(),
      gridSize: this.gridSize,
      cols: Math.ceil(this.imgWidth / this.gridSize),
      rows: Math.ceil(this.imgHeight / this.gridSize),
      bgImageFile: 'background.png',
      walkableCells: Array.from(this.walkableSet)
    };
  }

  async importZMapConfig(manifest: ZMapManifest, imageBlob: Blob) {
    if (manifest.gridSize) this.gridSize = manifest.gridSize;
    if (manifest.walkableCells) {
      this.walkableSet = new Set(manifest.walkableCells);
    }
    this.currentImageBlob = imageBlob;
    const blobUrl = URL.createObjectURL(imageBlob);
    await this.loadBackgroundImage(blobUrl, imageBlob);

    if (this.callbacks.onWalkableCountChange) {
      this.callbacks.onWalkableCountChange(this.walkableSet.size);
    }
  }

  exportConfig(mapId = 'custom_map'): MapGridConfig {
    return {
      mapId,
      bgImageDataUrl: this.bgImageUrl,
      gridSize: this.gridSize,
      cols: Math.ceil(this.imgWidth / this.gridSize),
      rows: Math.ceil(this.imgHeight / this.gridSize),
      walkableCells: Array.from(this.walkableSet)
    };
  }

  importConfig(config: MapGridConfig) {
    if (config.gridSize) this.gridSize = config.gridSize;
    if (config.walkableCells) {
      this.walkableSet = new Set(config.walkableCells);
    }
    if (config.bgImageDataUrl) {
      this.loadBackgroundImage(config.bgImageDataUrl);
    } else {
      this.redrawGrid();
    }
    if (this.callbacks.onWalkableCountChange) {
      this.callbacks.onWalkableCountChange(this.walkableSet.size);
    }
  }

  private centerAndScaleMap() {
    if (!this.app || !this.mapContainer) return;

    const screenW = this.app.screen.width;
    const screenH = this.app.screen.height;

    const scaleX = (screenW * 0.9) / this.imgWidth;
    const scaleY = (screenH * 0.9) / this.imgHeight;
    const scale = Math.min(scaleX, scaleY, 1.2);

    this.mapContainer.scale.set(scale);
    this.mapContainer.x = (screenW - this.imgWidth * scale) / 2;
    this.mapContainer.y = (screenH - this.imgHeight * scale) / 2;
  }

  private redrawGrid() {
    if (!this.gridGfx || !this.pathGfx || !this.playerTokenGfx) return;

    this.gridGfx.clear();
    this.pathGfx.clear();
    this.playerTokenGfx.clear();

    // Draw dark map canvas frame if no background image is present
    if (!this.bgSprite) {
      this.gridGfx.rect(0, 0, this.imgWidth, this.imgHeight);
      this.gridGfx.fill({ color: 0x0c0c14, alpha: 0.95 });
      this.gridGfx.rect(0, 0, this.imgWidth, this.imgHeight);
      this.gridGfx.stroke({ width: 1.5, color: 0xc5a059, alpha: 0.35 });
    }

    const maxCols = Math.ceil(this.imgWidth / this.gridSize);
    const maxRows = Math.ceil(this.imgHeight / this.gridSize);

    // Draw Square Grid Cells
    for (let r = 0; r < maxRows; r++) {
      for (let c = 0; c < maxCols; c++) {
        const x = c * this.gridSize;
        const y = r * this.gridSize;
        const key = gridToKey(c, r);
        const isWalkable = this.walkableSet.has(key);

        if (isWalkable) {
          this.gridGfx.rect(x, y, this.gridSize, this.gridSize);
          this.gridGfx.fill({ color: 0xc5a059, alpha: 0.35 }); // Korean Gold Rune fill
          this.gridGfx.rect(x, y, this.gridSize, this.gridSize);
          this.gridGfx.stroke({ width: 1.5, color: 0xe6c280, alpha: 0.85 });
        } else {
          this.gridGfx.rect(x, y, this.gridSize, this.gridSize);
          this.gridGfx.stroke({ width: 1, color: 0xffffff, alpha: 0.06 });
        }
      }
    }

    // Draw Path line and waypoints if in test mode
    if (this.isTestMode && this.movePath.length > 0) {
      // Ice blue outer glow path
      this.pathGfx.moveTo(this.playerPos.x, this.playerPos.y);
      for (let i = 0; i < this.movePath.length; i++) {
        const p = gridToPixel(this.movePath[i].col, this.movePath[i].row, this.gridSize);
        this.pathGfx.lineTo(p.x, p.y);
      }
      this.pathGfx.stroke({ width: 6, color: 0x38bdf8, alpha: 0.35 });

      // Core gold rune path line
      this.pathGfx.moveTo(this.playerPos.x, this.playerPos.y);
      for (let i = 0; i < this.movePath.length; i++) {
        const p = gridToPixel(this.movePath[i].col, this.movePath[i].row, this.gridSize);
        this.pathGfx.lineTo(p.x, p.y);

        // Waypoint dots
        this.pathGfx.circle(p.x, p.y, i === this.movePath.length - 1 ? 5 : 3.5);
        this.pathGfx.fill({ color: i === this.movePath.length - 1 ? 0x38bdf8 : 0xe6c280, alpha: 0.95 });
      }
      this.pathGfx.stroke({ width: 2.5, color: 0xe6c280, alpha: 0.95 });
    }

    // Draw Player Token with Dark Fantasy Crest if in test mode
    if (this.isTestMode) {
      // Outer gold halo ring
      this.playerTokenGfx.circle(this.playerPos.x, this.playerPos.y, 18);
      this.playerTokenGfx.stroke({ width: 1.5, color: 0xc5a059, alpha: 0.7 });

      // Pulsing rune glow
      this.playerTokenGfx.circle(this.playerPos.x, this.playerPos.y, 14);
      this.playerTokenGfx.fill({ color: 0x38bdf8, alpha: 0.3 });

      // Inner token core
      this.playerTokenGfx.circle(this.playerPos.x, this.playerPos.y, 10);
      this.playerTokenGfx.fill({ color: 0x0284c7, alpha: 0.95 });
      this.playerTokenGfx.circle(this.playerPos.x, this.playerPos.y, 10);
      this.playerTokenGfx.stroke({ width: 2, color: 0xfef08a, alpha: 1 });

      // Center gold core
      this.playerTokenGfx.circle(this.playerPos.x, this.playerPos.y, 3);
      this.playerTokenGfx.fill({ color: 0xfef08a, alpha: 1 });
    }
  }

  private setupEvents() {
    if (!this.app) return;

    const canvas = this.app.canvas;

    canvas.addEventListener('pointerdown', (e) => {
      this.isBrushing = true;
      this.handlePointerAction(e);
    });

    canvas.addEventListener('pointermove', (e) => {
      if (this.isBrushing) {
        this.handlePointerAction(e);
      }
    });

    window.addEventListener('pointerup', () => {
      this.isBrushing = false;
    });

    window.addEventListener('keydown', (e) => {
      if (this.isTestMode) {
        const k = e.key.toLowerCase();
        if (['w', 'a', 's', 'd'].includes(k)) {
          this.activeKeys.add(k);
          this.handleWASDMovment();
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      if (this.isTestMode) {
        const k = e.key.toLowerCase();
        this.activeKeys.delete(k);
      }
    });
  }

  private handlePointerAction(e: PointerEvent) {
    if (!this.app || !this.mapContainer) return;

    const rect = this.app.canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    // Convert screen coordinates to mapContainer local coordinates
    const localX = (clientX - this.mapContainer.x) / this.mapContainer.scale.x;
    const localY = (clientY - this.mapContainer.y) / this.mapContainer.scale.y;

    const grid = pixelToGrid(localX, localY, this.gridSize);
    const key = gridToKey(grid.col, grid.row);

    if (this.callbacks.onHoverGrid) {
      this.callbacks.onHoverGrid(grid);
    }

    if (this.isTestMode) {
      if (e.type === 'pointerdown' && this.walkableSet.has(key)) {
        const path = findGridPath(this.playerGrid, grid, this.walkableSet);
        if (path.length > 0) {
          this.movePath = path;
          this.isMoving = true;
        }
      }
      return;
    }

    // Brush Paint Mode
    if (this.brushMode === 'walkable') {
      this.walkableSet.add(key);
    } else if (this.brushMode === 'eraser') {
      this.walkableSet.delete(key);
    }

    if (this.callbacks.onWalkableCountChange) {
      this.callbacks.onWalkableCountChange(this.walkableSet.size);
    }

    this.redrawGrid();
  }

  private handleWASDMovment() {
    let dcol = 0;
    let drow = 0;

    if (this.activeKeys.has('w')) drow -= 1;
    if (this.activeKeys.has('s')) drow += 1;
    if (this.activeKeys.has('a')) dcol -= 1;
    if (this.activeKeys.has('d')) dcol += 1;

    if (dcol === 0 && drow === 0) return;

    const nextGrid: GridKey = { col: this.playerGrid.col + dcol, row: this.playerGrid.row + drow };
    const nextKeyStr = gridToKey(nextGrid.col, nextGrid.row);

    if (this.walkableSet.has(nextKeyStr)) {
      this.movePath = [nextGrid];
      this.isMoving = true;
    }
  }

  private updatePlayerMovement() {
    if (!this.isMoving || this.movePath.length === 0) return;

    const targetGrid = this.movePath[0];
    const targetPixel = gridToPixel(targetGrid.col, targetGrid.row, this.gridSize);

    const dx = targetPixel.x - this.playerPos.x;
    const dy = targetPixel.y - this.playerPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 4) {
      this.playerPos = { ...targetPixel };
      this.playerGrid = targetGrid;
      this.movePath.shift();
      if (this.movePath.length === 0) {
        this.isMoving = false;
      }
    } else {
      this.playerPos.x += dx * this.moveSpeed;
      this.playerPos.y += dy * this.moveSpeed;
    }

    this.redrawGrid();
  }

  destroy() {
    if (this.app) {
      this.app.destroy(true, { children: true, texture: true });
      this.app = null;
    }
  }
}
