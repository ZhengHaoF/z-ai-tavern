<template>
  <div class="editor-container" @click="closeContextMenu">
    <!-- 顶部玻璃拟物化控制栏 -->
    <header class="editor-header">
      <div class="left-group">
        <router-link to="/" class="back-link">⚔️ 返回游戏</router-link>
        <span class="divider">|</span>
        <h2 class="title gold-text">🕸️ 节点式世界网编辑器 (.zworld)</h2>
      </div>

      <!-- 操作面板组 -->
      <div class="tools-group">
        <label class="btn-tool gold-btn">
          🖼️ 上传图片创建地图底层
          <input
            type="file"
            accept="image/*"
            multiple
            class="hidden-input"
            @change="onAddMapImages"
          />
        </label>

        <label v-if="activeMapId" class="btn-tool dark-btn">
          🔄 替换所选底图
          <input
            type="file"
            accept="image/*"
            class="hidden-input"
            @change="onReplaceBgImage"
          />
        </label>

        <span class="divider">|</span>

        <!-- 刷子模式切换 -->
        <div class="brush-selector">
          <button
            class="btn-brush"
            :class="{ active: currentTool === 'walkable' }"
            @click="setTool('walkable')"
          >
            🖌️ 通行区
          </button>
          <button
            class="btn-brush"
            :class="{ active: currentTool === 'eraser' }"
            @click="setTool('eraser')"
          >
            🧼 障碍区
          </button>
          <button
            class="btn-brush"
            :class="{ active: currentTool === 'portal' }"
            @click="setTool('portal')"
          >
            🚪 传送点
          </button>
        </div>

        <!-- 多传送点管理栏 (当选择传送点刷子时呈现) -->
        <div v-if="currentTool === 'portal' && currentMapNode" class="portal-panel">
          <button class="btn-tool dark-btn add-portal-btn" @click="addNewPortal">
            ➕ 新建传送点
          </button>

          <!-- 传送点 Chip 标签组 -->
          <div class="portal-chips">
            <span
              v-for="portal in currentMapNode.portals"
              :key="portal.id"
              class="portal-chip"
              :class="{ active: portal.id === activePortalId }"
              :style="{ borderColor: portal.color || '#38bdf8', color: portal.color || '#38bdf8' }"
              @click="selectPortal(portal)"
            >
              🚪 {{ portal.name }}
            </span>
          </div>

          <input
            v-if="activePortal"
            v-model="activePortal.name"
            type="text"
            class="portal-name-input"
            placeholder="传送点名称(如:酒馆前门)"
            @change="onPortalNameChange"
          />
        </div>
      </div>

      <!-- 右侧 IO 操作区 -->
      <div class="io-group">
        <button class="btn-io gold-btn" @click="exportZWorld">
          💾 导出 .zworld 世界工程
        </button>
        <label class="btn-io metal-btn">
          📂 读取 .zworld / .zmap
          <input
            type="file"
            accept=".zworld,.zmap,.zip"
            class="hidden-input"
            @change="onImportFile"
          />
        </label>
      </div>
    </header>

    <!-- 工作台操作提示浮条 -->
    <div class="canvas-hint">
      💡 提示：按 [🖼️ 上传图片创建地图底层] | [🚪传送点 ➔ ➕新建传送点] 支持单图放多个传送点 | [Space/中键] 平移画布 | 右键 [传送点] “🔌 建立传送链接”
    </div>

    <!-- 主 PixiJS 工作台 Viewport Container -->
    <main ref="viewportContainer" class="viewport-canvas"></main>

    <!-- 右键传送点上下文菜单 -->
    <EditorContextMenu
      :visible="contextMenuVisible"
      :position="contextMenuPos"
      :portal-name="contextMenuPortal?.name || ''"
      @start-link="onStartLink"
      @delete-portal="onDeletePortal"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import type { WorldMapNode, WorldLink, WorldPortal } from '../types/worldMap';
import { PixiWorldGraphEngine, type ToolMode } from '../engine/pixiWorldGraphEngine';
import { exportZWorldArchive, importZWorldArchive } from '../engine/zworldArchive';
import { importZMapArchive } from '../engine/zmapArchive';
import EditorContextMenu from '../components/EditorContextMenu.vue';

const viewportContainer = ref<HTMLElement | null>(null);
let engine: PixiWorldGraphEngine | null = null;

const currentTool = ref<ToolMode>('walkable');
const activePortalId = ref<string | null>(null);

// 预设传送点色号列表
const PORTAL_COLORS = ['#38bdf8', '#c084fc', '#34d399', '#facc15', '#fb923c'];

// 右键菜单状态
const contextMenuVisible = ref(false);
const contextMenuPos = ref({ x: 0, y: 0 });
const contextMenuTarget = ref<{ mapId: string; portal: WorldPortal } | null>(null);
const contextMenuPortal = ref<WorldPortal | null>(null);

const mapNodes = ref<WorldMapNode[]>([]);
const links = ref<WorldLink[]>([]);
const activeMapId = ref<string | null>(null);

const currentMapNode = computed(() => mapNodes.value.find((n) => n.id === activeMapId.value));
const activePortal = computed(() => currentMapNode.value?.portals.find((p) => p.id === activePortalId.value));

onMounted(async () => {
  if (viewportContainer.value) {
    engine = new PixiWorldGraphEngine();
    await engine.init(viewportContainer.value, {
      onPortalContextMenu: (e, mapId, portal) => {
        contextMenuPos.value = { x: e.clientX, y: e.clientY };
        contextMenuTarget.value = { mapId, portal };
        contextMenuPortal.value = portal;
        contextMenuVisible.value = true;
      },
      onSelectMapNode: (mapId) => {
        activeMapId.value = mapId;
        syncActivePortalForMapNode(mapId);
      }
    });

    if (engine && mapNodes.value.length > 0) {
      engine.loadWorld(mapNodes.value, links.value);
    }
  }
});

onUnmounted(() => {
  if (engine) {
    engine.destroy();
    engine = null;
  }
});

function setTool(tool: ToolMode) {
  currentTool.value = tool;
  if (engine) {
    engine.setToolMode(tool);
  }
  if (tool === 'portal' && currentMapNode.value) {
    if (currentMapNode.value.portals.length === 0) {
      addNewPortal();
    } else if (!activePortalId.value) {
      selectPortal(currentMapNode.value.portals[0]);
    }
  }
}

function syncActivePortalForMapNode(mapId: string) {
  const node = mapNodes.value.find((n) => n.id === mapId);
  if (!node) return;

  // 检查当前选中的 activePortalId 是否已经属于该地图
  const exists = node.portals.some((p) => p.id === activePortalId.value);
  if (!exists) {
    if (node.portals.length > 0) {
      selectPortal(node.portals[0]);
    } else {
      activePortalId.value = null;
    }
  }
}

function addNewPortal() {
  if (!currentMapNode.value) return;

  const color = PORTAL_COLORS[currentMapNode.value.portals.length % PORTAL_COLORS.length];
  const newPortal: WorldPortal = {
    id: `portal_${Date.now()}`,
    name: `传送点 #${currentMapNode.value.portals.length + 1}`,
    color,
    gridKeys: []
  };

  currentMapNode.value.portals.push(newPortal);
  selectPortal(newPortal);
}

function selectPortal(portal: WorldPortal) {
  activePortalId.value = portal.id;
  if (engine) {
    engine.setActivePortal(portal.id, portal.name, portal.color || '#38bdf8');
  }
}

function onPortalNameChange() {
  if (activePortal.value && engine) {
    engine.setActivePortal(activePortal.value.id, activePortal.value.name, activePortal.value.color || '#38bdf8');
  }
}

async function onAddMapImages(e: Event) {
  const input = e.target as HTMLInputElement;
  if (!input.files || input.files.length === 0) return;

  const files = Array.from(input.files);

  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    const blobUrl = URL.createObjectURL(file);
    const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
    const mapId = `map_${Date.now()}_${index}`;

    await new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        const newNode: WorldMapNode = {
          id: mapId,
          name: fileNameWithoutExt || `地图底层 #${mapNodes.value.length + 1}`,
          canvasPos: {
            x: 80 + mapNodes.value.length * 550,
            y: 80
          },
          gridType: 'square',
          gridSize: 32,
          imgWidth: img.width,
          imgHeight: img.height,
          bgFileName: `bg_${mapId}.png`,
          walkableCells: [],
          portals: [],
          bgImageBlob: file,
          bgImageUrl: blobUrl
        };

        mapNodes.value.push(newNode);
        activeMapId.value = newNode.id;
        resolve();
      };
      img.src = blobUrl;
    });
  }

  if (engine) {
    await engine.loadWorld(mapNodes.value, links.value);
  }

  input.value = '';
}

async function onReplaceBgImage(e: Event) {
  const input = e.target as HTMLInputElement;
  if (input.files && input.files[0] && activeMapId.value) {
    const file = input.files[0];
    const blobUrl = URL.createObjectURL(file);

    const node = mapNodes.value.find((n) => n.id === activeMapId.value);
    if (node) {
      node.bgImageBlob = file;
      node.bgImageUrl = blobUrl;

      await new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          node.imgWidth = img.width;
          node.imgHeight = img.height;
          resolve();
        };
        img.src = blobUrl;
      });

      if (engine) {
        await engine.loadWorld(mapNodes.value, links.value);
      }
    }
  }
}

function onStartLink() {
  if (contextMenuTarget.value && engine) {
    engine.startLinking(contextMenuTarget.value.mapId, contextMenuTarget.value.portal.id);
  }
  closeContextMenu();
}

function onDeletePortal() {
  if (contextMenuTarget.value && engine) {
    engine.deletePortal(contextMenuTarget.value.mapId, contextMenuTarget.value.portal.id);
  }
  closeContextMenu();
}

function closeContextMenu() {
  contextMenuVisible.value = false;
}

async function exportZWorld() {
  if (mapNodes.value.length === 0) {
    alert('工作台为空，请先上传图片创建地图底层！');
    return;
  }
  try {
    const blob = await exportZWorldArchive('我的奇幻世界网', mapNodes.value, links.value);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fantasy_world_${Date.now()}.zworld`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert('导出 .zworld 失败：' + (err as Error).message);
  }
}

async function onImportFile(e: Event) {
  const input = e.target as HTMLInputElement;
  if (input.files && input.files[0]) {
    const file = input.files[0];
    try {
      if (file.name.endsWith('.zworld') || file.name.endsWith('.zip')) {
        try {
          const { manifest, mapBlobs } = await importZWorldArchive(file);
          mapNodes.value = manifest.maps.map((m) => {
            const blob = mapBlobs.get(m.id);
            return {
              ...m,
              bgImageBlob: blob,
              bgImageUrl: blob ? URL.createObjectURL(blob) : undefined
            };
          });
          links.value = manifest.links || [];
          if (mapNodes.value.length > 0) {
            activeMapId.value = mapNodes.value[0].id;
          }
          if (engine) {
            engine.loadWorld(mapNodes.value, links.value);
          }
          return;
        } catch {
          // 尝试以经典单图 .zmap 解析
        }
      }

      // 单图兼容解析
      const { manifest: zmap, imageBlob } = await importZMapArchive(file);
      const singleNode: WorldMapNode = {
        id: zmap.mapId || `map_${Date.now()}`,
        name: zmap.mapName || '导入的单图关卡',
        canvasPos: { x: 100, y: 100 },
        gridType: 'square',
        gridSize: zmap.gridSize || 32,
        imgWidth: 1000,
        imgHeight: 700,
        bgFileName: zmap.bgImageFile || 'background.png',
        walkableCells: zmap.walkableCells || [],
        portals: [],
        bgImageBlob: imageBlob,
        bgImageUrl: URL.createObjectURL(imageBlob)
      };

      mapNodes.value = [singleNode];
      links.value = [];
      activeMapId.value = singleNode.id;
      if (engine) {
        engine.loadWorld(mapNodes.value, links.value);
      }
    } catch (err) {
      alert('导入失败：' + (err as Error).message);
    }
  }
}
</script>

<style scoped>
.editor-container {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #08080c;
  display: flex;
  flex-direction: column;
  position: relative;
  font-family: -apple-system, BlinkMacSystemFont, 'Cinzel', sans-serif;
  color: #fff;
}

.editor-header {
  height: 56px;
  background: rgba(18, 18, 25, 0.92);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid rgba(197, 160, 89, 0.35);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  z-index: 10;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6);
}

.left-group, .tools-group, .io-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.back-link {
  color: #c5a059;
  text-decoration: none;
  font-weight: bold;
  font-size: 0.85rem;
}

.title {
  margin: 0;
  font-size: 1.05rem;
  font-family: 'Cinzel', serif;
}

.gold-text {
  color: #fef08a;
  text-shadow: 0 0 8px rgba(226, 194, 128, 0.3);
}

.divider {
  color: rgba(197, 160, 89, 0.3);
}

.btn-tool, .btn-io, .btn-brush {
  padding: 6px 14px;
  font-size: 0.82rem;
  font-weight: bold;
  border-radius: 4px;
  cursor: pointer;
  border: 1px solid rgba(197, 160, 89, 0.4);
  transition: all 0.2s ease;
}

.dark-btn {
  background: linear-gradient(180deg, #2a2a3a 0%, #161622 100%);
  color: #fef08a;
}

.gold-btn {
  background: linear-gradient(180deg, #c5a059 0%, #8c6827 100%);
  color: #fff;
  border-color: #e6c280;
}

.metal-btn {
  background: linear-gradient(180deg, #374151 0%, #1f2937 100%);
  color: #d1d5db;
}

.brush-selector {
  display: flex;
  gap: 4px;
  background: rgba(8, 8, 12, 0.8);
  padding: 3px;
  border-radius: 4px;
  border: 1px solid rgba(197, 160, 89, 0.3);
}

.btn-brush {
  background: transparent;
  border: none;
  color: #9ca3af;
}

.btn-brush.active {
  background: rgba(197, 160, 89, 0.25);
  color: #fef08a;
  border: 1px solid #c5a059;
}

.portal-panel {
  display: flex;
  align-items: center;
  gap: 8px;
}

.add-portal-btn {
  padding: 4px 10px;
  font-size: 0.78rem;
}

.portal-chips {
  display: flex;
  gap: 6px;
}

.portal-chip {
  padding: 4px 10px;
  font-size: 0.78rem;
  font-weight: bold;
  border: 1px solid #38bdf8;
  border-radius: 12px;
  background: rgba(8, 8, 12, 0.7);
  cursor: pointer;
  transition: all 0.2s ease;
}

.portal-chip.active {
  background: rgba(56, 189, 248, 0.2);
  box-shadow: 0 0 10px currentColor;
}

.portal-name-input {
  background: rgba(8, 8, 12, 0.9);
  border: 1px solid #38bdf8;
  color: #38bdf8;
  padding: 5px 10px;
  font-size: 0.8rem;
  border-radius: 4px;
  outline: none;
  width: 130px;
}

.hidden-input {
  display: none;
}

.canvas-hint {
  position: absolute;
  bottom: 12px;
  left: 20px;
  z-index: 5;
  background: rgba(18, 18, 25, 0.85);
  backdrop-filter: blur(4px);
  border: 1px solid rgba(197, 160, 89, 0.3);
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 0.78rem;
  color: #d1d5db;
}

.viewport-canvas {
  flex: 1;
  width: 100%;
  height: calc(100vh - 56px);
}
</style>
