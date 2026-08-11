<template>
  <div class="game-scene-viewport">
    <div ref="canvasContainer" class="canvas-container"></div>
    
    <!-- 未选择关卡时的空状态引导 -->
    <div v-if="!mapStore.isLoaded" class="empty-overlay">
      <div class="empty-box korean-dark-slab">
        <div class="corner-accent top-left"></div>
        <div class="corner-accent top-right"></div>
        <div class="corner-accent bottom-left"></div>
        <div class="corner-accent bottom-right"></div>

        <h3 class="gold-title">🛡️ 请载入战术 .zmap 关卡包</h3>
        <p class="desc">您可以在路网编辑器中绘制并导出关卡，拖入或选择文件以开启探索</p>
        
        <label class="korean-btn-metal load-btn">
          📂 载入 .zmap 关卡文件
          <input type="file" accept=".zmap,.zip" class="hidden-input" @change="onFileChange" />
        </label>
      </div>
    </div>

    <!-- 图层控制悬浮栏 -->
    <div v-else class="toolbar-overlay">
      <button class="korean-btn-metal toggle-btn" @click="toggleGrid">
        {{ showGrid ? '👁️ 隐藏栅格网格' : '🕸️ 显示通行网格' }}
      </button>
      <label class="korean-btn-metal toggle-btn">
        🔄 切换 .zmap 关卡
        <input type="file" accept=".zmap,.zip" class="hidden-input" @change="onFileChange" />
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useMapStore } from '../stores/mapStore';
import { GameSceneEngine } from '../engine/gameSceneEngine';

const mapStore = useMapStore();
const canvasContainer = ref<HTMLElement | null>(null);

let engine: GameSceneEngine | null = null;
const showGrid = ref(true);

onMounted(async () => {
  if (canvasContainer.value) {
    engine = new GameSceneEngine();
    await engine.init(canvasContainer.value, {
      onCharacterMoveEnd: (char, gridPos) => {
        mapStore.setPlayerGridPos(gridPos.col, gridPos.row);
      }
    });

    // 如果 Store 中已有加载好的关卡，直接进行渲染
    if (mapStore.manifest && mapStore.bgImageUrl) {
      await engine.loadZMap(mapStore.manifest, mapStore.bgImageUrl);
      engine.upsertCharacter(mapStore.playerCharacter, true);
    }
  }
});

onUnmounted(() => {
  if (engine) {
    engine.destroy();
    engine = null;
  }
});

// 监听 Store 地图更新
watch(
  () => [mapStore.manifest, mapStore.bgImageUrl],
  async ([newManifest, newBgUrl]) => {
    if (engine && newManifest && newBgUrl) {
      await engine.loadZMap(newManifest as any, newBgUrl as string);
      engine.upsertCharacter(mapStore.playerCharacter, true);
    }
  }
);

// 监听玩家角色更新
watch(
  () => mapStore.playerCharacter,
  (newChar) => {
    if (engine && newChar) {
      engine.upsertCharacter(newChar, true);
    }
  },
  { deep: true }
);

function toggleGrid() {
  showGrid.value = !showGrid.value;
  if (engine) {
    engine.toggleGridOverlay(showGrid.value);
  }
}

async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  if (input.files && input.files[0]) {
    try {
      await mapStore.loadZMapArchive(input.files[0]);
    } catch (err) {
      alert('解析关卡文件失败：' + (err as Error).message);
    }
  }
}
</script>

<style scoped>
.game-scene-viewport {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #08080c;
}

.canvas-container {
  width: 100%;
  height: 100%;
}

.empty-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(8, 8, 12, 0.85);
  backdrop-filter: blur(8px);
}

.empty-box {
  position: relative;
  padding: 36px 48px;
  text-align: center;
  max-width: 480px;
  background: linear-gradient(180deg, rgba(22, 22, 30, 0.95) 0%, rgba(12, 12, 17, 0.98) 100%);
  border: 1px solid rgba(197, 160, 89, 0.35);
  box-shadow: inset 0 0 20px rgba(0,0,0,0.8), 0 16px 40px rgba(0,0,0,0.7);
  border-radius: 8px;
}

.gold-title {
  font-family: 'Cinzel', serif;
  font-size: 1.4rem;
  color: #fef08a;
  margin-bottom: 12px;
  text-shadow: 0 0 10px rgba(226, 194, 128, 0.3);
}

.desc {
  font-size: 0.88rem;
  color: #9ca3af;
  margin-bottom: 24px;
  line-height: 1.5;
}

.hidden-input {
  display: none;
}

.korean-btn-metal {
  display: inline-block;
  cursor: pointer;
  padding: 10px 20px;
  font-family: 'Cinzel', sans-serif;
  font-weight: bold;
  font-size: 0.88rem;
  color: #fef08a;
  background: linear-gradient(180deg, #2a2a3a 0%, #161622 100%);
  border: 1px solid rgba(197, 160, 89, 0.5);
  border-radius: 4px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 12px rgba(0,0,0,0.4);
  transition: all 0.2s ease;
}

.korean-btn-metal:hover {
  border-color: #e6c280;
  box-shadow: 0 0 14px rgba(226,194,128,0.35);
  transform: translateY(-1px);
}

.toolbar-overlay {
  position: absolute;
  top: 16px;
  left: 16px;
  display: flex;
  gap: 12px;
  z-index: 10;
}

.toggle-btn {
  font-size: 0.8rem;
  padding: 6px 14px;
  background: rgba(18, 18, 25, 0.8);
  backdrop-filter: blur(4px);
}

/* Corner ornaments */
.corner-accent {
  position: absolute;
  width: 6px;
  height: 6px;
  border: 1px solid #c5a059;
}
.top-left { top: -1px; left: -1px; border-right: none; border-bottom: none; }
.top-right { top: -1px; right: -1px; border-left: none; border-bottom: none; }
.bottom-left { bottom: -1px; left: -1px; border-right: none; border-top: none; }
.bottom-right { bottom: -1px; right: -1px; border-left: none; border-top: none; }
</style>
