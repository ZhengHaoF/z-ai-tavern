import { Application, Container, Graphics, Sprite, Assets, Texture, Text, TextStyle } from 'pixi.js';
import type { ZMapManifest, GridKey } from '../types/gridMap';
import type { CharacterEntity } from '../types/character';
import { gridToPixel, pixelToGrid, gridToKey } from './gridMath';
import { findGridPath } from './gridPathfinding';

export interface GameSceneCallbacks {
  onGridHover?: (grid: GridKey | null) => void;
  onCharacterMoveStart?: (character: CharacterEntity) => void;
  onCharacterMoveEnd?: (character: CharacterEntity, pos: GridKey) => void;
  onGridClick?: (grid: GridKey, isWalkable: boolean) => void;
}

export class GameSceneEngine {
  private app: Application | null = null;
  private containerEl: HTMLElement | null = null;

  // 图层 Containers
  private mapContainer: Container | null = null;
  private bgSprite: Sprite | null = null;
  private gridGfx: Graphics | null = null;
  private pathGfx: Graphics | null = null;
  private characterContainer: Container | null = null;

  // 地图配置数据
  private gridSize = 32;
  private imgWidth = 1200;
  private imgHeight = 800;
  private walkableSet = new Set<string>();
  private bgImageUrl = '';
  private showGridOverlay = true; // 是否显式叠加软金线条网格

  // 人物实体容器映射
  private characterSprites = new Map<string, Container>();
  private characters = new Map<string, CharacterEntity>();
  private playerCharacterId = 'player-hero';

  // 人物寻路与移动状态
  private movePath: GridKey[] = [];
  private isMoving = false;
  private moveSpeed = 220; // 像素 / 秒匀速移动物理速度
  private currentPixelPos = { x: 0, y: 0 };
  private playerGrid: GridKey = { col: 0, row: 0 };

  private callbacks: GameSceneCallbacks = {};

  async init(element: HTMLElement, callbacks?: GameSceneCallbacks) {
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
    this.characterContainer = new Container();

    this.app.stage.addChild(this.mapContainer);
    this.mapContainer.addChild(this.gridGfx);
    this.mapContainer.addChild(this.pathGfx);
    this.mapContainer.addChild(this.characterContainer);

    this.setupEvents();
    this.app.ticker.add(this.updateTick.bind(this));
  }

  /**
   * 载入并装载 ZMap 关卡配置与背景图片
   */
  async loadZMap(manifest: ZMapManifest, bgImageUrl: string) {
    this.gridSize = manifest.gridSize || 32;
    this.walkableSet = new Set(manifest.walkableCells || []);
    this.bgImageUrl = bgImageUrl;

    if (!this.app || !this.mapContainer) return;

    try {
      let texture: Texture;
      if (bgImageUrl.startsWith('blob:') || bgImageUrl.startsWith('data:')) {
        texture = await new Promise<Texture>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            try {
              resolve(Texture.from(img));
            } catch (err) {
              reject(err);
            }
          };
          img.onerror = (e) => reject(e);
          img.src = bgImageUrl;
        });
      } else {
        texture = await Assets.load(bgImageUrl);
      }

      if (this.bgSprite) {
        this.mapContainer.removeChild(this.bgSprite);
        this.bgSprite.destroy();
      }

      this.bgSprite = new Sprite(texture);
      this.imgWidth = texture.width;
      this.imgHeight = texture.height;

      // 居中适配缩放
      this.centerAndScaleMap();
      this.mapContainer.addChildAt(this.bgSprite, 0);

      this.redrawGridOverlay();
    } catch (err) {
      console.warn('GameSceneEngine: 载入关卡背景图失败', err);
    }
  }

  /**
   * 切换碰撞网格 Overlay 的隐藏/显示
   */
  toggleGridOverlay(visible?: boolean) {
    this.showGridOverlay = visible !== undefined ? visible : !this.showGridOverlay;
    this.redrawGridOverlay();
  }

  /**
   * 添加或更新地图上的人物实体
   */
  upsertCharacter(char: CharacterEntity, isPlayer = false) {
    this.characters.set(char.id, char);
    if (isPlayer) {
      this.playerCharacterId = char.id;
      this.playerGrid = { col: char.gridPos.qOrX, row: char.gridPos.rOrY };
      const pixel = gridToPixel(this.playerGrid.col, this.playerGrid.row, this.gridSize);
      this.currentPixelPos = { ...pixel };
    }

    let charSpriteContainer = this.characterSprites.get(char.id);
    if (!charSpriteContainer) {
      charSpriteContainer = new Container();
      this.characterSprites.set(char.id, charSpriteContainer);
      this.characterContainer?.addChild(charSpriteContainer);
    }

    this.renderCharacterSprite(charSpriteContainer, char, isPlayer);
  }

  /**
   * 绘制韩式暗黑风人物 Token 图像与名字 Badge
   */
  private renderCharacterSprite(container: Container, char: CharacterEntity, isPlayer: boolean) {
    container.removeChildren();

    const g = new Graphics();
    const pixelPos = gridToPixel(char.gridPos.qOrX, char.gridPos.rOrY, this.gridSize);

    // 1. 底部外围发光金环
    g.circle(0, 0, 20);
    g.stroke({ width: 2, color: isPlayer ? 0xe6c280 : 0x9333ea, alpha: 0.9 });

    // 2. 战术半透阴影底色
    g.circle(0, 0, 16);
    g.fill({ color: isPlayer ? 0x38bdf8 : 0x7e22ce, alpha: 0.35 });

    // 3. 核心实体按钮
    g.circle(0, 0, 12);
    g.fill({ color: isPlayer ? 0x0284c7 : 0x581c87, alpha: 0.95 });
    g.stroke({ width: 1.5, color: 0xffffff, alpha: 0.9 });

    // 4. 英雄心点高光
    g.circle(0, 0, 4);
    g.fill({ color: 0xfef08a, alpha: 1 });

    container.addChild(g);

    // 5. 渲染人物浮动头顶名称 Tag
    const nameStyle = new TextStyle({
      fontSize: 11,
      fill: isPlayer ? '#fef08a' : '#e9d5ff',
      fontFamily: 'Cinzel, sans-serif',
      fontWeight: 'bold',
      dropShadow: {
        alpha: 0.8,
        color: '#000000',
        blur: 3,
        distance: 1
      }
    });
    const nameText = new Text({ text: char.name, style: nameStyle });
    nameText.anchor.set(0.5, 1);
    nameText.y = -22;
    container.addChild(nameText);

    container.x = pixelPos.x;
    container.y = pixelPos.y;
  }

  /**
   * 控制角色移动到目标网格 (A* 寻路)
   */
  movePlayerToGrid(targetCol: number, targetRow: number) {
    const targetGrid: GridKey = { col: targetCol, row: targetRow };
    const key = gridToKey(targetCol, targetRow);

    if (!this.walkableSet.has(key)) return;

    const path = findGridPath(this.playerGrid, targetGrid, this.walkableSet);
    if (path.length > 0) {
      if (path[0].col === this.playerGrid.col && path[0].row === this.playerGrid.row) {
        path.shift();
      }
      if (path.length > 0) {
        this.movePath = path;
        this.isMoving = true;

        const player = this.characters.get(this.playerCharacterId);
        if (player && this.callbacks.onCharacterMoveStart) {
          this.callbacks.onCharacterMoveStart(player);
        }
      }
    }
  }

  private updateTick() {
    if (!this.isMoving || this.movePath.length === 0 || !this.app) return;

    // 根据真实帧率增量（秒）计算本帧物理可移动的像素预算
    const deltaSec = (this.app.ticker.deltaMS || 16.6) / 1000;
    let moveBudget = this.moveSpeed * deltaSec;

    while (moveBudget > 0 && this.movePath.length > 0) {
      const targetGrid = this.movePath[0];
      const targetPixel = gridToPixel(targetGrid.col, targetGrid.row, this.gridSize);

      const dx = targetPixel.x - this.currentPixelPos.x;
      const dy = targetPixel.y - this.currentPixelPos.y;
      const dist = Math.hypot(dx, dy);

      if (dist <= moveBudget) {
        // 本帧能够完全到达/超过当前 Path 节点，无缝接力到下一节点
        this.currentPixelPos = { ...targetPixel };
        this.playerGrid = targetGrid;
        moveBudget -= dist;
        this.movePath.shift();

        const player = this.characters.get(this.playerCharacterId);
        if (player) {
          player.gridPos = { qOrX: targetGrid.col, rOrY: targetGrid.row };
        }

        if (this.movePath.length === 0) {
          this.isMoving = false;
          if (player && this.callbacks.onCharacterMoveEnd) {
            this.callbacks.onCharacterMoveEnd(player, this.playerGrid);
          }
          break;
        }
      } else {
        // 本帧尚未到达节点，按方向向量推进剩余步长
        const ratio = moveBudget / dist;
        this.currentPixelPos.x += dx * ratio;
        this.currentPixelPos.y += dy * ratio;
        moveBudget = 0;
      }
    }

    // 更新玩家角色 Sprite 容器渲染坐标
    const playerSprite = this.characterSprites.get(this.playerCharacterId);
    if (playerSprite) {
      playerSprite.x = this.currentPixelPos.x;
      playerSprite.y = this.currentPixelPos.y;
    }

    this.redrawPathLine();
  }

  private centerAndScaleMap() {
    if (!this.app || !this.mapContainer) return;

    const screenW = this.app.screen.width;
    const screenH = this.app.screen.height;

    const scaleX = screenW / this.imgWidth;
    const scaleY = screenH / this.imgHeight;
    const scale = Math.min(scaleX, scaleY);

    this.mapContainer.scale.set(scale);
    this.mapContainer.x = (screenW - this.imgWidth * scale) / 2;
    this.mapContainer.y = (screenH - this.imgHeight * scale) / 2;
  }

  private redrawGridOverlay() {
    if (!this.gridGfx) return;
    this.gridGfx.clear();

    if (!this.showGridOverlay) return;

    const maxCols = Math.ceil(this.imgWidth / this.gridSize);
    const maxRows = Math.ceil(this.imgHeight / this.gridSize);

    for (let r = 0; r < maxRows; r++) {
      for (let c = 0; c < maxCols; c++) {
        const key = gridToKey(c, r);
        if (this.walkableSet.has(key)) {
          const x = c * this.gridSize;
          const y = r * this.gridSize;
          this.gridGfx.rect(x, y, this.gridSize, this.gridSize);
          this.gridGfx.fill({ color: 0xc5a059, alpha: 0.12 });
          this.gridGfx.rect(x, y, this.gridSize, this.gridSize);
          this.gridGfx.stroke({ width: 1, color: 0xe6c280, alpha: 0.3 });
        }
      }
    }
  }

  private redrawPathLine() {
    if (!this.pathGfx) return;
    this.pathGfx.clear();

    if (this.movePath.length === 0) return;

    // 绘制寻路金蓝连线
    this.pathGfx.moveTo(this.currentPixelPos.x, this.currentPixelPos.y);
    for (let i = 0; i < this.movePath.length; i++) {
      const p = gridToPixel(this.movePath[i].col, this.movePath[i].row, this.gridSize);
      this.pathGfx.lineTo(p.x, p.y);
    }
    this.pathGfx.stroke({ width: 3, color: 0x38bdf8, alpha: 0.8 });

    for (let i = 0; i < this.movePath.length; i++) {
      const p = gridToPixel(this.movePath[i].col, this.movePath[i].row, this.gridSize);
      this.pathGfx.circle(p.x, p.y, 3.5);
      this.pathGfx.fill({ color: 0xe6c280, alpha: 0.9 });
    }
  }

  private setupEvents() {
    if (!this.app) return;

    const canvas = this.app.canvas;

    canvas.addEventListener('pointerdown', (e) => {
      if (!this.mapContainer) return;
      const rect = canvas.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;

      const localX = (clientX - this.mapContainer.x) / this.mapContainer.scale.x;
      const localY = (clientY - this.mapContainer.y) / this.mapContainer.scale.y;

      const grid = pixelToGrid(localX, localY, this.gridSize);
      const key = gridToKey(grid.col, grid.row);
      const isWalkable = this.walkableSet.has(key);

      if (this.callbacks.onGridClick) {
        this.callbacks.onGridClick(grid, isWalkable);
      }

      if (isWalkable) {
        this.movePlayerToGrid(grid.col, grid.row);
      }
    });
  }

  destroy() {
    if (this.app) {
      this.app.destroy(true, { children: true, texture: true });
      this.app = null;
    }
  }
}
