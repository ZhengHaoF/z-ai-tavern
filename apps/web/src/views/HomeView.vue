<template>
  <div class="game-homepage">
    <!-- 上方主内容区 (双栏 60% / 40%) -->
    <div class="main-viewport">
      <!-- 左侧 60%：主 PixiJS 场景视窗 -->
      <section class="left-canvas-section korean-dark-slab">
        <div class="corner-accent top-left"></div>
        <div class="corner-accent top-right"></div>
        <div class="corner-accent bottom-left"></div>
        <div class="corner-accent bottom-right"></div>

        <!-- PixiJS 场景画布组件 -->
        <GameSceneCanvas />
      </section>

      <!-- 右侧 40%：AI 酒馆控制台 / 剧情聊天区 -->
      <section class="right-console-section korean-dark-slab">
        <div class="corner-accent top-left"></div>
        <div class="corner-accent top-right"></div>
        <div class="corner-accent bottom-left"></div>
        <div class="corner-accent bottom-right"></div>

        <div class="npc-header">
          <div class="npc-avatar">🧙‍♂️</div>
          <div class="npc-meta">
            <h3 class="gold-text">酒馆老板 · 埃里克</h3>
            <span class="npc-tag">【剧情引导 NPC】</span>
          </div>
        </div>

        <div class="chat-logs">
          <div class="chat-item npc-msg">
            <span class="speaker">埃里克:</span>
            <p>欢迎来到阴影酒吧，冒险者。选择或导入一份 <code>.zmap</code> 关卡地图，在战术图层上迈出第一步吧！</p>
          </div>
          
          <div v-if="mapStore.isLoaded" class="chat-item system-msg">
            <span class="speaker">【系统日志】:</span>
            <p>成功装载关卡 <code>{{ mapStore.manifest?.mapId }}</code>。当前角色坐标为 [{{ mapStore.playerCharacter.gridPos.qOrX }}, {{ mapStore.playerCharacter.gridPos.rOrY }}]。</p>
          </div>
        </div>

        <div class="chat-input-box">
          <input type="text" class="korean-input" placeholder="输入对话指令或与 NPC 交流..." disabled />
          <button class="korean-btn-gold send-btn" disabled>发送</button>
        </div>
      </section>
    </div>

    <!-- 底部固定 HUD Dock (高度 72px) -->
    <footer class="hud-dock-bar">
      <div class="player-info">
        <div class="player-avatar">⚔️</div>
        <div class="player-stats">
          <span class="player-name">{{ mapStore.playerCharacter.name }}</span>
          <div class="bar-group">
            <div class="hp-bar" style="width: 100%;"></div>
            <div class="mp-bar" style="width: 85%;"></div>
          </div>
        </div>
      </div>

      <div class="action-buttons">
        <router-link to="/editor" class="korean-btn-metal">
          🛠️ 离线路网编辑器 (/editor)
        </router-link>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import GameSceneCanvas from '../components/GameSceneCanvas.vue';
import { useMapStore } from '../stores/mapStore';

const mapStore = useMapStore();
</script>

<style scoped>
.game-homepage {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #08080c;
  display: flex;
  flex-direction: column;
  color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, 'Cinzel', serif;
}

/* 双栏主区域 */
.main-viewport {
  flex: 1;
  height: calc(100vh - 72px);
  display: flex;
  padding: 12px;
  gap: 12px;
  box-sizing: border-box;
}

/* 左侧 60% 视窗 */
.left-canvas-section {
  flex: 6;
  position: relative;
  border-radius: 6px;
  overflow: hidden;
  background: linear-gradient(180deg, rgba(22, 22, 30, 0.92) 0%, rgba(12, 12, 17, 0.95) 100%);
  border: 1px solid rgba(197, 160, 89, 0.32);
  box-shadow: inset 0 0 20px rgba(0,0,0,0.8), 0 8px 32px rgba(0,0,0,0.6);
}

/* 右侧 40% 控制台 */
.right-console-section {
  flex: 4;
  position: relative;
  display: flex;
  flex-direction: column;
  border-radius: 6px;
  background: linear-gradient(180deg, rgba(22, 22, 30, 0.92) 0%, rgba(12, 12, 17, 0.95) 100%);
  border: 1px solid rgba(197, 160, 89, 0.32);
  box-shadow: inset 0 0 20px rgba(0,0,0,0.8), 0 8px 32px rgba(0,0,0,0.6);
  padding: 16px;
  box-sizing: border-box;
}

.npc-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(197, 160, 89, 0.2);
}

.npc-avatar {
  font-size: 1.8rem;
  background: rgba(8, 8, 12, 0.8);
  border: 1px solid #c5a059;
  border-radius: 50%;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.gold-text {
  color: #fef08a;
  margin: 0;
  font-size: 1.05rem;
}

.npc-tag {
  font-size: 0.72rem;
  color: #c5a059;
}

.chat-logs {
  flex: 1;
  overflow-y: auto;
  margin: 12px 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chat-item {
  background: rgba(8, 8, 12, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.05);
  padding: 10px 14px;
  border-radius: 6px;
  font-size: 0.88rem;
  line-height: 1.4;
}

.speaker {
  font-weight: bold;
  color: #e6c280;
  margin-right: 6px;
}

.system-msg {
  border-color: rgba(56, 189, 248, 0.3);
  color: #38bdf8;
}

.chat-input-box {
  display: flex;
  gap: 8px;
}

.korean-input {
  flex: 1;
  background: rgba(8, 8, 12, 0.9);
  border: 1px solid rgba(197, 160, 89, 0.4);
  border-radius: 4px;
  color: #fff;
  padding: 8px 12px;
  font-size: 0.85rem;
  outline: none;
}

.korean-btn-gold {
  background: linear-gradient(180deg, #c5a059 0%, #8c6827 100%);
  color: #fff;
  border: 1px solid #e6c280;
  padding: 8px 16px;
  border-radius: 4px;
  font-weight: bold;
  cursor: pointer;
}

/* 底部 HUD Dock */
.hud-dock-bar {
  height: 72px;
  background: linear-gradient(180deg, #121219 0%, #08080c 100%);
  border-top: 1px solid rgba(197, 160, 89, 0.35);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  box-shadow: 0 -4px 20px rgba(0,0,0,0.8);
}

.player-info {
  display: flex;
  align-items: center;
  gap: 14px;
}

.player-avatar {
  width: 44px;
  height: 44px;
  background: #1e1b2e;
  border: 1.5px solid #c5a059;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.4rem;
}

.player-stats {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.player-name {
  font-size: 0.9rem;
  font-weight: bold;
  color: #fef08a;
}

.bar-group {
  width: 140px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.hp-bar {
  height: 6px;
  background: #ef4444;
  border-radius: 2px;
}

.mp-bar {
  height: 4px;
  background: #38bdf8;
  border-radius: 2px;
}

.korean-btn-metal {
  display: inline-block;
  color: #fef08a;
  text-decoration: none;
  background: linear-gradient(180deg, #2a2a3a 0%, #161622 100%);
  border: 1px solid rgba(197, 160, 89, 0.5);
  padding: 8px 18px;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: bold;
  transition: all 0.2s ease;
}

.korean-btn-metal:hover {
  border-color: #e6c280;
  box-shadow: 0 0 12px rgba(226,194,128,0.35);
}

/* Corner Ornaments */
.corner-accent {
  position: absolute;
  width: 6px;
  height: 6px;
  border: 1px solid #c5a059;
  z-index: 5;
}
.top-left { top: -1px; left: -1px; border-right: none; border-bottom: none; }
.top-right { top: -1px; right: -1px; border-left: none; border-bottom: none; }
.bottom-left { bottom: -1px; left: -1px; border-right: none; border-top: none; }
.bottom-right { bottom: -1px; right: -1px; border-left: none; border-top: none; }
</style>
