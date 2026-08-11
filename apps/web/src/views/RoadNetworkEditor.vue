<template>
  <div class="editor-page-container">
    <!-- Korean Dark Fantasy Metal Slab Header Console -->
    <header class="editor-header korean-dark-slab">
      <span class="corner-accent corner-tl"></span>
      <span class="corner-accent corner-tr"></span>
      <span class="corner-accent corner-bl"></span>
      <span class="corner-accent corner-br"></span>

      <div class="header-left">
        <router-link to="/" class="korean-btn-metal nav-back-btn" title="返回主页">
          <ArrowLeft :size="15" />
          <span>返回主城</span>
        </router-link>

        <div class="title-group">
          <h1 class="editor-title korean-gold-title">
            <Shield :size="16" class="title-icon" />
            <span>八方向正方形路网编辑器</span>
          </h1>
          <span class="editor-subtitle">TACTICAL SQUARE GRID EDITOR // /editor</span>
        </div>
      </div>

      <div class="header-center">
        <!-- Image Upload (New Map) -->
        <label class="korean-btn-metal btn-file" title="新建地图：选择一张背景图">
          <Upload :size="15" />
          <span>新建 (图片)</span>
          <input type="file" accept="image/*" @change="handleImageUpload" hidden />
        </label>

        <div class="header-divider"></div>

        <!-- Grid Size Slider -->
        <div class="tool-group">
          <Sliders :size="14" class="slider-icon" />
          <span class="tool-label">网格粒度: {{ gridSize }}px</span>
          <input
            type="range"
            min="16"
            max="64"
            step="2"
            v-model.number="gridSize"
            @input="updateGridSize"
            class="korean-slider radius-slider"
          />
        </div>

        <div class="header-divider"></div>

        <!-- Korean Segmented Slot for Brush Modes -->
        <div class="korean-segmented-slot">
          <button
            class="korean-slot-item"
            :class="{ active: brushMode === 'walkable' && !isTestMode }"
            @click="setBrush('walkable')"
          >
            <Paintbrush :size="14" />
            <span>刻印 (通行)</span>
          </button>

          <button
            class="korean-slot-item"
            :class="{ active: brushMode === 'eraser' && !isTestMode }"
            @click="setBrush('eraser')"
          >
            <Eraser :size="14" />
            <span>抹除 (障碍)</span>
          </button>

          <button class="korean-slot-item btn-clear" @click="clearAll" title="重置全阵网格">
            <RotateCcw :size="14" />
            <span>重置</span>
          </button>
        </div>

        <div class="header-divider"></div>

        <!-- Test Mode Toggle -->
        <button
          class="korean-btn-metal btn-test"
          :class="{ active: isTestMode }"
          @click="toggleTestMode"
        >
          <FlaskConical :size="15" />
          <span>{{ isTestMode ? '退出演练' : '试走演练 (WASD 8向)' }}</span>
        </button>
      </div>

      <div class="header-right">
        <label class="korean-btn-metal btn-file" title="打开 .zmap 关卡压缩包继续编辑">
          <FolderOpen :size="15" />
          <span>打开 (.zmap)</span>
          <input type="file" accept=".zmap,.zip,application/json" @change="handleArchiveImport" hidden />
        </label>

        <button class="korean-btn-metal korean-btn-gold" @click="exportZMap" title="导出包含数据与图片的 .zmap 关卡包">
          <Download :size="15" />
          <span>导出关卡包 (.zmap)</span>
        </button>
      </div>
    </header>

    <!-- PixiJS Canvas Viewport -->
    <div ref="pixiContainer" class="pixi-editor-viewport"></div>

    <!-- Floating Korean Dark Fantasy Tactical Compass Status Bar -->
    <div class="status-capsule-wrapper">
      <div class="korean-compass-panel korean-dark-slab">
        <span class="corner-accent corner-tl"></span>
        <span class="corner-accent corner-tr"></span>
        <span class="corner-accent corner-bl"></span>
        <span class="corner-accent corner-br"></span>

        <div class="capsule-item count-item">
          <CheckCircle2 :size="14" class="icon-walkable" />
          <span>打标区域: <strong>{{ walkableCount }}</strong> 格</span>
        </div>

        <div class="capsule-divider" v-if="hoverGrid"></div>

        <div class="capsule-item coord-item" v-if="hoverGrid">
          <MapPin :size="14" class="icon-pin" />
          <span>阵形坐标: (Col: {{ hoverGrid.col }}, Row: {{ hoverGrid.row }})</span>
        </div>

        <div class="capsule-divider"></div>

        <div class="capsule-item hint-item" :class="{ 'test-mode-hint': isTestMode }">
          <span v-if="!isTestMode">按住鼠标左键滑动绘制通路刻印</span>
          <span v-else>演练状态中：点击通行格或 WASD 八方向控制推进</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import {
  Upload,
  Download,
  FolderOpen,
  ArrowLeft,
  Paintbrush,
  Eraser,
  RotateCcw,
  FlaskConical,
  MapPin,
  Shield,
  Sliders,
  CheckCircle2
} from 'lucide-vue-next';
import { PixiGridEngine, type BrushMode } from '../engine/pixiGridEngine';
import type { GridKey, MapGridConfig } from '../types/gridMap';
import { exportZMapArchive, importZMapArchive } from '../engine/zmapArchive';

const pixiContainer = ref<HTMLElement | null>(null);
const gridSize = ref(32);
const brushMode = ref<BrushMode>('walkable');
const isTestMode = ref(false);
const walkableCount = ref(0);
const hoverGrid = ref<GridKey | null>(null);

let engine: PixiGridEngine | null = null;

onMounted(async () => {
  if (pixiContainer.value) {
    engine = new PixiGridEngine();
    await engine.init(pixiContainer.value, {
      onWalkableCountChange: (count) => {
        walkableCount.value = count;
      },
      onHoverGrid: (grid) => {
        hoverGrid.value = grid;
      }
    });
    gridSize.value = engine.getGridSize();
  }
});

function updateGridSize() {
  if (engine) {
    engine.setGridSize(gridSize.value);
  }
}

function setBrush(mode: BrushMode) {
  if (isTestMode.value) {
    isTestMode.value = false;
    if (engine) engine.setTestMode(false);
  }
  brushMode.value = mode;
  if (engine) {
    engine.setBrushMode(mode);
  }
}

function toggleTestMode() {
  isTestMode.value = !isTestMode.value;
  if (engine) {
    engine.setTestMode(isTestMode.value);
  }
}

function clearAll() {
  if (engine) {
    engine.clearGrid();
  }
}

function handleImageUpload(e: Event) {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file && engine) {
    engine.clearGrid();
    const blobUrl = URL.createObjectURL(file);
    engine.loadBackgroundImage(blobUrl, file);
  }
}

async function exportZMap() {
  if (!engine) return;

  try {
    const manifest = engine.exportZMapManifest();
    let imageBlob = await engine.getBackgroundImageBlob();

    if (!imageBlob) {
      // Create a small 1x1 transparent fallback PNG if no image loaded
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      imageBlob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
    }

    const zmapBlob = await exportZMapArchive(manifest, imageBlob);
    const url = URL.createObjectURL(zmapBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `map_archive_${Date.now()}.zmap`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert('导出关卡包失败: ' + (err as Error).message);
  }
}

async function handleArchiveImport(e: Event) {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file || !engine) return;

  try {
    if (file.name.endsWith('.zmap') || file.name.endsWith('.zip')) {
      const { manifest, imageBlob } = await importZMapArchive(file);
      await engine.importZMapConfig(manifest, imageBlob);
      if (manifest.gridSize) gridSize.value = manifest.gridSize;
    } else if (file.name.endsWith('.json')) {
      const text = await file.text();
      const config = JSON.parse(text) as MapGridConfig;
      engine.importConfig(config);
      if (config.gridSize) gridSize.value = config.gridSize;
    }
  } catch (err) {
    alert('解析关卡包失败: ' + (err as Error).message);
  }
}

onUnmounted(() => {
  if (engine) {
    engine.destroy();
    engine = null;
  }
});
</script>

<style scoped>
.editor-page-container {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  background: #08080c;
  color: #f3f4f6;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Outfit', sans-serif;
  overflow: hidden;
}

.editor-header {
  position: absolute;
  top: 14px;
  left: 20px;
  right: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  z-index: 100;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.title-group {
  display: flex;
  flex-direction: column;
}

.editor-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 0.98rem;
  margin: 0;
}

.title-icon {
  color: #c5a059;
}

.editor-subtitle {
  font-size: 0.65rem;
  color: #9ca3af;
  font-family: 'Cinzel', serif;
  letter-spacing: 0.1em;
}

.header-center {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-divider {
  width: 1px;
  height: 22px;
  background: rgba(197, 160, 89, 0.25);
}

.tool-group {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(8, 8, 12, 0.85);
  padding: 5px 12px;
  border-radius: 3px;
  border: 1px solid rgba(197, 160, 89, 0.25);
  font-size: 0.78rem;
  color: #e6c280;
}

.slider-icon {
  color: #c5a059;
}

.radius-slider {
  width: 85px;
}

.btn-file {
  position: relative;
}

.btn-test {
  color: #a7f3d0;
}

.btn-test.active {
  background: linear-gradient(180deg, rgba(16, 185, 129, 0.25) 0%, rgba(6, 95, 70, 0.4) 100%);
  border-color: #34d399;
  color: #6ee7b7;
  box-shadow: 0 0 16px rgba(16, 185, 129, 0.4);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.pixi-editor-viewport {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
}

/* Floating Korean Tactical Compass Status Bar */
.status-capsule-wrapper {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  pointer-events: none;
}

.korean-compass-panel {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 8px 22px;
  font-size: 0.78rem;
  color: #e5e7eb;
}

.capsule-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.capsule-divider {
  width: 1px;
  height: 14px;
  background: rgba(197, 160, 89, 0.3);
}

.icon-walkable {
  color: #e6c280;
}

.icon-pin {
  color: #38bdf8;
}

.hint-item {
  color: #e6c280;
  font-size: 0.75rem;
}

.test-mode-hint {
  color: #34d399;
}
</style>
