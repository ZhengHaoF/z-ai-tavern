import { Application, Container, Graphics, Sprite, Assets, Texture } from 'pixi.js';
import type { HexKey, MapHexGridConfig } from '../types/hexMap';
import { hexToPixel, pixelToHex, getHexPolygonPoints, hexToKey, keyToHex } from './hexMath';
import { findHexPath } from './hexPathfinding';

export type BrushMode = 'walkable' | 'eraser';

export interface PixiHexEngineCallbacks {
  onWalkableCountChange?: (count: number) => void;
  onHoverHex?: (hex: HexKey | null) => void;
}

export class PixiHexEngine {
  private app: Application | null = null;
  private containerEl: HTMLElement | null = null;

  // Pixi Containers
  private mapContainer: Container | null = null;
  private bgSprite: Sprite | null = null;
  private hexGridGfx: Graphics | null = null;
  private playerTokenGfx: Graphics | null = null;
  private pathGfx: Graphics | null = null;

  // Grid Parameters
  private hexRadius = 32;
  private walkableSet = new Set<string>();
  private brushMode: BrushMode = 'walkable';
  private isTestMode = false;
  private isBrushing = false;

  // Image Info
  private bgImageUrl = '';
  private imgWidth = 1200;
  private imgHeight = 800;

  // Player Test Movement
  private playerHex: HexKey = { q: 0, r: 0 };
  private playerPos = { x: 0, y: 0 };
  private targetPos = { x: 0, y: 0 };
  private movePath: HexKey[] = [];
  private isMoving = false;
  private moveSpeed = 0.08;

  private callbacks: PixiHexEngineCallbacks = {};

  async init(element: HTMLElement, callbacks?: PixiHexEngineCallbacks) {
    this.containerEl = element;
    if (callbacks) this.callbacks = callbacks;

    const app = new Application();
    await app.init({
      resizeTo: element,
      background: '#090710',
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1
    });

    this.app = app;
    element.appendChild(app.canvas);

    this.mapContainer = new Container();
    this.hexGridGfx = new Graphics();
    this.pathGfx = new Graphics();
    this.playerTokenGfx = new Graphics();

    this.app.stage.addChild(this.mapContainer);
    this.mapContainer.addChild(this.hexGridGfx);
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

  async loadBackgroundImage(imageUrl: string) {
    this.bgImageUrl = imageUrl;
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

  setHexRadius(radius: number) {
    this.hexRadius = Math.max(16, Math.min(80, radius));
    this.redrawGrid();
  }

  getHexRadius(): number {
    return this.hexRadius;
  }

  setBrushMode(mode: BrushMode) {
    this.brushMode = mode;
  }

  setTestMode(enabled: boolean) {
    this.isTestMode = enabled;
    if (enabled) {
      // Set initial player hex to first walkable hex if available
      if (this.walkableSet.size > 0 && !this.walkableSet.has(hexToKey(this.playerHex.q, this.playerHex.r))) {
        const firstKey = Array.from(this.walkableSet)[0];
        this.playerHex = keyToHex(firstKey);
      }
      const pixel = hexToPixel(this.playerHex.q, this.playerHex.r, this.hexRadius);
      this.playerPos = { ...pixel };
      this.targetPos = { ...pixel };
    } else {
      this.movePath = [];
      this.isMoving = false;
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

  exportConfig(mapId = 'custom_map'): MapHexGridConfig {
    return {
      mapId,
      bgImageDataUrl: this.bgImageUrl,
      hexSize: this.hexRadius,
      cols: Math.ceil(this.imgWidth / (Math.sqrt(3) * this.hexRadius)),
      rows: Math.ceil(this.imgHeight / (1.5 * this.hexRadius)),
      walkableCells: Array.from(this.walkableSet)
    };
  }

  importConfig(config: MapHexGridConfig) {
    if (config.hexSize) this.hexRadius = config.hexSize;
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
    if (!this.hexGridGfx || !this.pathGfx || !this.playerTokenGfx) return;

    this.hexGridGfx.clear();
    this.pathGfx.clear();
    this.playerTokenGfx.clear();

    // Draw dark map canvas container frame if no background image is present
    if (!this.bgSprite) {
      this.hexGridGfx.rect(0, 0, this.imgWidth, this.imgHeight);
      this.hexGridGfx.fill({ color: 0x0c0c14, alpha: 0.95 });
      this.hexGridGfx.rect(0, 0, this.imgWidth, this.imgHeight);
      this.hexGridGfx.stroke({ width: 1.5, color: 0xc5a059, alpha: 0.35 });
    }

    const maxQ = Math.ceil(this.imgWidth / (Math.sqrt(3) * this.hexRadius));
    const maxR = Math.ceil(this.imgHeight / (1.5 * this.hexRadius));

    // Draw all Hex Cells
    for (let r = 0; r <= maxR; r++) {
      for (let q = -Math.floor(maxQ / 2); q <= maxQ; q++) {
        const center = hexToPixel(q, r, this.hexRadius);
        // Only draw cells within image boundaries
        if (center.x < -this.hexRadius || center.x > this.imgWidth + this.hexRadius ||
            center.y < -this.hexRadius || center.y > this.imgHeight + this.hexRadius) {
          continue;
        }

        const key = hexToKey(q, r);
        const isWalkable = this.walkableSet.has(key);
        const corners = getHexPolygonPoints(center.x, center.y, this.hexRadius);

        const poly: number[] = [];
        corners.forEach(p => poly.push(p.x, p.y));

        if (isWalkable) {
          this.hexGridGfx.poly(poly);
          this.hexGridGfx.fill({ color: 0xc5a059, alpha: 0.32 }); // Gold rune fill
          this.hexGridGfx.poly(poly);
          this.hexGridGfx.stroke({ width: 1.5, color: 0xe6c280, alpha: 0.85 });
        } else {
          this.hexGridGfx.poly(poly);
          this.hexGridGfx.stroke({ width: 1, color: 0xffffff, alpha: 0.06 });
        }
      }
    }

    // Draw Rune Path line and waypoints if in test mode
    if (this.isTestMode && this.movePath.length > 0) {
      // Ice blue outer glow path
      this.pathGfx.moveTo(this.playerPos.x, this.playerPos.y);
      for (let i = 0; i < this.movePath.length; i++) {
        const p = hexToPixel(this.movePath[i].q, this.movePath[i].r, this.hexRadius);
        this.pathGfx.lineTo(p.x, p.y);
      }
      this.pathGfx.stroke({ width: 6, color: 0x38bdf8, alpha: 0.35 });

      // Core gold rune path line
      this.pathGfx.moveTo(this.playerPos.x, this.playerPos.y);
      for (let i = 0; i < this.movePath.length; i++) {
        const p = hexToPixel(this.movePath[i].q, this.movePath[i].r, this.hexRadius);
        this.pathGfx.lineTo(p.x, p.y);

        // Rune Waypoint dots
        this.pathGfx.circle(p.x, p.y, i === this.movePath.length - 1 ? 5 : 3.5);
        this.pathGfx.fill({ color: i === this.movePath.length - 1 ? 0x38bdf8 : 0xe6c280, alpha: 0.95 });
      }
      this.pathGfx.stroke({ width: 2.5, color: 0xe6c280, alpha: 0.95 });
    }

    // Draw Player Token with Dark Fantasy Crest & Gold Ring if in test mode
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
        this.handleWASDInput(e.key.toLowerCase());
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

    const hex = pixelToHex(localX, localY, this.hexRadius);
    const key = hexToKey(hex.q, hex.r);

    if (this.callbacks.onHoverHex) {
      this.callbacks.onHoverHex(hex);
    }

    if (this.isTestMode) {
      if (e.type === 'pointerdown' && this.walkableSet.has(key)) {
        const path = findHexPath(this.playerHex, hex, this.walkableSet);
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

  private handleWASDInput(key: string) {
    let dq = 0;
    let dr = 0;

    if (key === 'w') { dq = 0; dr = -1; }
    else if (key === 's') { dq = 0; dr = 1; }
    else if (key === 'a') { dq = -1; dr = 0; }
    else if (key === 'd') { dq = 1; dr = 0; }
    else return;

    const nextHex: HexKey = { q: this.playerHex.q + dq, r: this.playerHex.r + dr };
    const nextKeyStr = hexToKey(nextHex.q, nextHex.r);

    if (this.walkableSet.has(nextKeyStr)) {
      this.movePath = [nextHex];
      this.isMoving = true;
    }
  }

  private updatePlayerMovement() {
    if (!this.isMoving || this.movePath.length === 0) return;

    const targetHex = this.movePath[0];
    const targetPixel = hexToPixel(targetHex.q, targetHex.r, this.hexRadius);

    const dx = targetPixel.x - this.playerPos.x;
    const dy = targetPixel.y - this.playerPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 3) {
      this.playerPos = { ...targetPixel };
      this.playerHex = targetHex;
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
