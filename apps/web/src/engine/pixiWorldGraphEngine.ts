import { Application, Container, Graphics, Sprite, Assets, Texture, Text, TextStyle } from 'pixi.js';
import type { WorldMapNode, WorldLink, WorldPortal } from '../types/worldMap';
import { gridToPixel, pixelToGrid, gridToKey } from './gridMath';

export type ToolMode = 'walkable' | 'eraser' | 'portal' | 'select';

export interface WorldGraphEngineCallbacks {
  onPortalContextMenu?: (e: MouseEvent, mapId: string, portal: WorldPortal) => void;
  onSelectMapNode?: (mapId: string) => void;
  onMapNodeUpdate?: (mapNodes: WorldMapNode[]) => void;
}

export class PixiWorldGraphEngine {
  private app: Application | null = null;
  private containerEl: HTMLElement | null = null;

  // 图层 Containers
  private worldContainer: Container | null = null;
  private mapNodesLayer: Container | null = null;
  private wireCableLayer: Graphics | null = null;
  private activeWireLayer: Graphics | null = null;

  // 数据映射与纹理缓存
  private mapNodes = new Map<string, WorldMapNode>();
  private textureCache = new Map<string, Texture>();
  private links: WorldLink[] = [];
  private selectedMapId: string | null = null;

  // 工作台平移与缩放
  private zoom = 0.8;
  private isPanning = false;
  private isBrushing = false;
  private isSpacePressed = false;
  private lastPanPos = { x: 0, y: 0 };

  // 节点卡片拖拽重排状态
  private isDraggingNode = false;
  private draggedNodeId: string | null = null;
  private dragNodeOffset = { x: 0, y: 0 };

  // 工具模式与建立连接过程
  private toolMode: ToolMode = 'walkable';
  private activePortalId: string | null = null;
  private currentPortalName = '传送点 #1';
  private currentPortalColor = '#38bdf8';
  private isLinkingMode = false;
  private linkingSource: { mapId: string; portalId: string } | null = null;
  private mouseCanvasPos = { x: 0, y: 0 };

  private callbacks: WorldGraphEngineCallbacks = {};

  async init(element: HTMLElement, callbacks?: WorldGraphEngineCallbacks) {
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

    this.worldContainer = new Container();
    this.mapNodesLayer = new Container();
    this.wireCableLayer = new Graphics();
    this.activeWireLayer = new Graphics();

    this.app.stage.addChild(this.worldContainer);
    this.worldContainer.addChild(this.mapNodesLayer);
    this.worldContainer.addChild(this.wireCableLayer);
    this.worldContainer.addChild(this.activeWireLayer);

    // 设置画布居中初始偏置
    this.worldContainer.x = app.screen.width / 4;
    this.worldContainer.y = app.screen.height / 6;
    this.worldContainer.scale.set(this.zoom);

    this.setupEvents();
    this.app.ticker.add(this.updateTick.bind(this));
  }

  setToolMode(mode: ToolMode) {
    this.toolMode = mode;
  }

  /**
   * 设置当前选中的传送点（多传送点支持）
   */
  setActivePortal(portalId: string | null, name: string, color = '#38bdf8') {
    this.activePortalId = portalId;
    this.currentPortalName = name;
    this.currentPortalColor = color;
  }

  /**
   * 异步解析并缓存节点的背景 Image 纹理
   */
  private async fetchTexture(node: WorldMapNode): Promise<Texture | null> {
    if (!node.bgImageUrl) return null;
    if (this.textureCache.has(node.id)) {
      return this.textureCache.get(node.id)!;
    }

    try {
      let texture: Texture;
      if (node.bgImageUrl.startsWith('blob:') || node.bgImageUrl.startsWith('data:')) {
        texture = await new Promise<Texture>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            try {
              resolve(Texture.from(img));
            } catch (err) { reject(err); }
          };
          img.onerror = (e) => reject(e);
          img.src = node.bgImageUrl!;
        });
      } else {
        texture = await Assets.load(node.bgImageUrl);
      }

      if (texture) {
        this.textureCache.set(node.id, texture);
        return texture;
      }
    } catch (err) {
      console.warn(`加载地图节点 [${node.name}] 纹理失败:`, err);
    }
    return null;
  }

  /**
   * 载入全量工程节点与拓扑关系
   */
  async loadWorld(mapNodes: WorldMapNode[], links: WorldLink[]) {
    this.mapNodes.clear();
    this.textureCache.clear();
    mapNodes.forEach((n) => this.mapNodes.set(n.id, n));
    this.links = [...links];

    if (mapNodes.length > 0 && !this.selectedMapId) {
      this.selectedMapId = mapNodes[0].id;
    }

    await Promise.all(mapNodes.map((n) => this.fetchTexture(n)));

    this.redrawAllMapNodes();
    this.redrawWireCables();
  }

  /**
   * 追加新地图节点
   */
  async addMapNode(node: WorldMapNode) {
    this.mapNodes.set(node.id, node);
    this.selectedMapId = node.id;
    await this.fetchTexture(node);
    this.redrawAllMapNodes();
  }

  /**
   * 开始动态建立连线 (Linking Mode)
   */
  startLinking(mapId: string, portalId: string) {
    this.isLinkingMode = true;
    this.linkingSource = { mapId, portalId };
  }

  cancelLinking() {
    this.isLinkingMode = false;
    this.linkingSource = null;
    this.activeWireLayer?.clear();
  }

  /**
   * 绑定建立一条新传送链接
   */
  connectLink(toMapId: string, toPortalId: string) {
    if (!this.linkingSource) return;

    if (this.linkingSource.mapId === toMapId && this.linkingSource.portalId === toPortalId) {
      this.cancelLinking();
      return;
    }

    const newLink: WorldLink = {
      id: `link_${Date.now()}`,
      fromMapId: this.linkingSource.mapId,
      fromPortalId: this.linkingSource.portalId,
      toMapId,
      toPortalId,
      isBidirectional: true
    };

    this.links.push(newLink);
    this.cancelLinking();
    this.redrawWireCables();
  }

  /**
   * 删除某个传送点
   */
  deletePortal(mapId: string, portalId: string) {
    const node = this.mapNodes.get(mapId);
    if (node) {
      node.portals = node.portals.filter((p) => p.id !== portalId);
      this.links = this.links.filter(
        (l) => !(l.fromPortalId === portalId || l.toPortalId === portalId)
      );
      this.redrawAllMapNodes();
      this.redrawWireCables();
    }
  }

  /**
   * 重新绘制所有地图节点及其内部碰撞与传送点
   */
  private redrawAllMapNodes() {
    if (!this.mapNodesLayer) return;
    this.mapNodesLayer.removeChildren();

    this.mapNodes.forEach((node) => {
      const nodeContainer = new Container();
      nodeContainer.x = node.canvasPos.x;
      nodeContainer.y = node.canvasPos.y;

      const isSelected = node.id === this.selectedMapId;

      // 1. 节点背景框
      const frameGfx = new Graphics();
      frameGfx.rect(0, 0, node.imgWidth, node.imgHeight + 40);
      frameGfx.fill({ color: 0x121219, alpha: 0.95 });
      frameGfx.rect(0, 0, node.imgWidth, node.imgHeight + 40);
      frameGfx.stroke({ width: isSelected ? 2.5 : 1, color: isSelected ? 0xe6c280 : 0xc5a059, alpha: isSelected ? 1 : 0.4 });

      nodeContainer.addChild(frameGfx);

      // 2. 节点 Header
      const headerTitleStyle = new TextStyle({
        fontSize: 14,
        fill: isSelected ? '#fef08a' : '#c5a059',
        fontFamily: 'Cinzel, sans-serif',
        fontWeight: 'bold'
      });
      const titleText = new Text({ text: `🗺️ ${node.name}`, style: headerTitleStyle });
      titleText.x = 12;
      titleText.y = 10;
      nodeContainer.addChild(titleText);

      // 3. 内部图片
      const mapContentContainer = new Container();
      mapContentContainer.y = 40;

      const texture = this.textureCache.get(node.id);
      if (texture) {
        const bgSprite = new Sprite(texture);
        bgSprite.width = node.imgWidth;
        bgSprite.height = node.imgHeight;
        mapContentContainer.addChild(bgSprite);
      } else {
        const bgGfx = new Graphics();
        bgGfx.rect(0, 0, node.imgWidth, node.imgHeight);
        bgGfx.fill({ color: 0x08080c, alpha: 0.9 });
        mapContentContainer.addChild(bgGfx);

        if (node.bgImageUrl) {
          this.fetchTexture(node).then((tex) => {
            if (tex) this.redrawAllMapNodes();
          });
        }
      }

      // 4. 通行网格线
      const gridGfx = new Graphics();
      const walkableSet = new Set(node.walkableCells);
      const cols = Math.ceil(node.imgWidth / node.gridSize);
      const rows = Math.ceil(node.imgHeight / node.gridSize);

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const key = gridToKey(c, r);
          const x = c * node.gridSize;
          const y = r * node.gridSize;
          if (walkableSet.has(key)) {
            gridGfx.rect(x, y, node.gridSize, node.gridSize);
            gridGfx.fill({ color: 0xc5a059, alpha: 0.2 });
            gridGfx.rect(x, y, node.gridSize, node.gridSize);
            gridGfx.stroke({ width: 1, color: 0xe6c280, alpha: 0.4 });
          }
        }
      }
      mapContentContainer.addChild(gridGfx);

      // 5. 渲染传送点 (支持多 Portal 分色发光)
      const portalsGfx = new Graphics();
      node.portals.forEach((portal) => {
        const portalColorHex = portal.color || '#38bdf8';
        const numColor = parseInt(portalColorHex.replace('#', ''), 16) || 0x38bdf8;

        const portalSet = new Set(portal.gridKeys);
        portalSet.forEach((key) => {
          const [c, r] = key.split(',').map(Number);
          const x = c * node.gridSize;
          const y = r * node.gridSize;

          portalsGfx.rect(x, y, node.gridSize, node.gridSize);
          portalsGfx.fill({ color: numColor, alpha: 0.45 });
          portalsGfx.rect(x, y, node.gridSize, node.gridSize);
          portalsGfx.stroke({ width: 2, color: numColor, alpha: 0.9 });
        });

        // 绘制传送点名称 Badge
        if (portal.gridKeys.length > 0) {
          const [fc, fr] = portal.gridKeys[0].split(',').map(Number);
          const pPixel = gridToPixel(fc, fr, node.gridSize);
          const pBadgeStyle = new TextStyle({
            fontSize: 11,
            fill: portalColorHex,
            fontWeight: 'bold',
            fontFamily: 'Cinzel, sans-serif',
            dropShadow: { alpha: 0.85, color: '#000', distance: 1 }
          });
          const pText = new Text({ text: `🚪 ${portal.name}`, style: pBadgeStyle });
          pText.anchor.set(0.5, 1);
          pText.x = pPixel.x;
          pText.y = pPixel.y - 4;
          mapContentContainer.addChild(pText);
        }
      });
      mapContentContainer.addChild(portalsGfx);

      nodeContainer.addChild(mapContentContainer);
      this.mapNodesLayer?.addChild(nodeContainer);
    });
  }

  /**
   * 绘制节点之间的固化贝塞尔传送线
   */
  private redrawWireCables() {
    if (!this.wireCableLayer) return;
    this.wireCableLayer.clear();

    this.links.forEach((link) => {
      const fromPos = this.getPortalPixelPos(link.fromMapId, link.fromPortalId);
      const toPos = this.getPortalPixelPos(link.toMapId, link.toPortalId);

      if (fromPos && toPos) {
        this.drawBezierCable(this.wireCableLayer!, fromPos.x, fromPos.y, toPos.x, toPos.y, 0xe6c280);
      }
    });
  }

  private getPortalPixelPos(mapId: string, portalId: string): { x: number; y: number } | null {
    const node = this.mapNodes.get(mapId);
    if (!node) return null;

    const portal = node.portals.find((p) => p.id === portalId);
    if (!portal || portal.gridKeys.length === 0) return null;

    const [c, r] = portal.gridKeys[0].split(',').map(Number);
    const local = gridToPixel(c, r, node.gridSize);

    return {
      x: node.canvasPos.x + local.x,
      y: node.canvasPos.y + 40 + local.y
    };
  }

  private drawBezierCable(g: Graphics, x1: number, y1: number, x2: number, y2: number, color: number) {
    const dx = Math.abs(x2 - x1) * 0.5;
    const cp1x = x1 + dx;
    const cp1y = y1;
    const cp2x = x2 - dx;
    const cp2y = y2;

    g.moveTo(x1, y1);
    g.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x2, y2);
    g.stroke({ width: 5, color, alpha: 0.3 });

    g.moveTo(x1, y1);
    g.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x2, y2);
    g.stroke({ width: 2, color, alpha: 0.9 });

    g.circle(x1, y1, 4);
    g.fill({ color: 0x38bdf8, alpha: 1 });
    g.circle(x2, y2, 4);
    g.fill({ color: 0x38bdf8, alpha: 1 });
  }

  private updateTick() {
    if (this.isLinkingMode && this.linkingSource && this.activeWireLayer) {
      this.activeWireLayer.clear();
      const fromPos = this.getPortalPixelPos(this.linkingSource.mapId, this.linkingSource.portalId);
      if (fromPos) {
        this.drawBezierCable(
          this.activeWireLayer,
          fromPos.x,
          fromPos.y,
          this.mouseCanvasPos.x,
          this.mouseCanvasPos.y,
          0x38bdf8
        );
      }
    }
  }

  private setupEvents() {
    if (!this.app) return;
    const canvas = this.app.canvas;

    window.addEventListener('keydown', (e) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      if (e.code === 'Space' && !this.isSpacePressed) {
        this.isSpacePressed = true;
        canvas.style.cursor = 'grab';
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this.isSpacePressed = false;
        canvas.style.cursor = 'default';
      }
    });

    canvas.addEventListener('pointerdown', (e) => {
      if (e.button === 2) {
        this.handleRightClick(e);
        return;
      }

      if (e.button === 1 || this.isSpacePressed) {
        this.isPanning = true;
        this.lastPanPos = { x: e.clientX, y: e.clientY };
        canvas.style.cursor = 'grabbing';
        return;
      }

      this.handlePointerAction(e);
    });

    canvas.addEventListener('pointermove', (e) => {
      if (this.worldContainer) {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.clientX - rect.left;
        const clientY = e.clientY - rect.top;
        this.mouseCanvasPos.x = (clientX - this.worldContainer.x) / this.worldContainer.scale.x;
        this.mouseCanvasPos.y = (clientY - this.worldContainer.y) / this.worldContainer.scale.y;
      }

      if (this.isPanning && this.worldContainer) {
        const dx = e.clientX - this.lastPanPos.x;
        const dy = e.clientY - this.lastPanPos.y;
        this.worldContainer.x += dx;
        this.worldContainer.y += dy;
        this.lastPanPos = { x: e.clientX, y: e.clientY };
        return;
      }

      if (this.isDraggingNode && this.draggedNodeId) {
        const node = this.mapNodes.get(this.draggedNodeId);
        if (node) {
          node.canvasPos.x = this.mouseCanvasPos.x - this.dragNodeOffset.x;
          node.canvasPos.y = this.mouseCanvasPos.y - this.dragNodeOffset.y;
          this.redrawAllMapNodes();
          this.redrawWireCables();
        }
        return;
      }

      if (this.isBrushing) {
        this.handlePointerAction(e);
      }
    });

    window.addEventListener('pointerup', () => {
      this.isPanning = false;
      this.isBrushing = false;
      this.isDraggingNode = false;
      this.draggedNodeId = null;
      canvas.style.cursor = this.isSpacePressed ? 'grab' : 'default';
    });

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (!this.worldContainer) return;
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      this.zoom = Math.max(0.2, Math.min(2.5, this.zoom * zoomFactor));
      this.worldContainer.scale.set(this.zoom);
    });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private handleRightClick(e: MouseEvent) {
    const hit = this.hitTestPortal(e);
    if (hit && this.callbacks.onPortalContextMenu) {
      this.callbacks.onPortalContextMenu(e, hit.mapId, hit.portal);
    }
  }

  private handlePointerAction(e: MouseEvent) {
    if (!this.worldContainer) return;

    if (this.isLinkingMode) {
      const hit = this.hitTestPortal(e);
      if (hit) {
        this.connectLink(hit.mapId, hit.portal.id);
      } else {
        this.cancelLinking();
      }
      return;
    }

    const mapNode = this.hitTestMapNode(e);
    if (!mapNode) return;

    this.selectedMapId = mapNode.id;
    if (this.callbacks.onSelectMapNode) {
      this.callbacks.onSelectMapNode(mapNode.id);
    }

    const rect = this.app!.canvas.getBoundingClientRect();
    const localCanvasX = (e.clientX - rect.left - this.worldContainer.x) / this.worldContainer.scale.x;
    const localCanvasY = (e.clientY - rect.top - this.worldContainer.y) / this.worldContainer.scale.y;

    const mapLocalX = localCanvasX - mapNode.canvasPos.x;
    const mapLocalY = localCanvasY - mapNode.canvasPos.y;

    // A. 顶部 40px Header ➔ 拖拽卡片
    if (mapLocalY >= 0 && mapLocalY <= 40 && e.type === 'pointerdown') {
      this.isDraggingNode = true;
      this.draggedNodeId = mapNode.id;
      this.dragNodeOffset = {
        x: localCanvasX - mapNode.canvasPos.x,
        y: localCanvasY - mapNode.canvasPos.y
      };
      this.isBrushing = false;
      this.app!.canvas.style.cursor = 'move';
      this.redrawAllMapNodes();
      return;
    }

    // B. 下方地图 ➔ 画地块 / 放置多传送点
    if (mapLocalY > 40) {
      this.isBrushing = true;
      const contentLocalY = mapLocalY - 40;
      const grid = pixelToGrid(mapLocalX, contentLocalY, mapNode.gridSize);
      const key = gridToKey(grid.col, grid.row);

      const walkableSet = new Set(mapNode.walkableCells);

      if (this.toolMode === 'walkable') {
        walkableSet.add(key);
      } else if (this.toolMode === 'eraser') {
        walkableSet.delete(key);
      } else if (this.toolMode === 'portal') {
        // 多传送点精准绑定 (优先通过 activePortalId 寻找)
        let activePortal: WorldPortal | undefined;
        if (this.activePortalId) {
          activePortal = mapNode.portals.find((p) => p.id === this.activePortalId);
        }

        if (!activePortal) {
          activePortal = {
            id: `portal_${Date.now()}`,
            name: this.currentPortalName || '传送点 #1',
            color: this.currentPortalColor || '#38bdf8',
            gridKeys: []
          };
          mapNode.portals.push(activePortal);
          this.activePortalId = activePortal.id;
        }

        if (!activePortal.gridKeys.includes(key)) {
          activePortal.gridKeys.push(key);
        }
      }

      mapNode.walkableCells = Array.from(walkableSet);
      this.redrawAllMapNodes();
    }
  }

  private hitTestMapNode(e: MouseEvent): WorldMapNode | null {
    if (!this.worldContainer || !this.app) return null;
    const rect = this.app.canvas.getBoundingClientRect();
    const cx = (e.clientX - rect.left - this.worldContainer.x) / this.worldContainer.scale.x;
    const cy = (e.clientY - rect.top - this.worldContainer.y) / this.worldContainer.scale.y;

    for (const node of this.mapNodes.values()) {
      if (
        cx >= node.canvasPos.x &&
        cx <= node.canvasPos.x + node.imgWidth &&
        cy >= node.canvasPos.y &&
        cy <= node.canvasPos.y + node.imgHeight + 40
      ) {
        return node;
      }
    }
    return null;
  }

  private hitTestPortal(e: MouseEvent): { mapId: string; portal: WorldPortal } | null {
    const mapNode = this.hitTestMapNode(e);
    if (!mapNode || !this.worldContainer || !this.app) return null;

    const rect = this.app.canvas.getBoundingClientRect();
    const cx = (e.clientX - rect.left - this.worldContainer.x) / this.worldContainer.scale.x;
    const cy = (e.clientY - rect.top - this.worldContainer.y) / this.worldContainer.scale.y;

    const localX = cx - mapNode.canvasPos.x;
    const localY = cy - mapNode.canvasPos.y - 40;
    const grid = pixelToGrid(localX, localY, mapNode.gridSize);
    const key = gridToKey(grid.col, grid.row);

    for (const portal of mapNode.portals) {
      if (portal.gridKeys.includes(key)) {
        return { mapId: mapNode.id, portal };
      }
    }
    return null;
  }

  destroy() {
    if (this.app) {
      this.app.destroy(true, { children: true, texture: true });
      this.app = null;
    }
  }
}
