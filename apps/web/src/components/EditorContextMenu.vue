<template>
  <div
    v-if="visible"
    class="context-menu korean-dark-slab"
    :style="{ left: position.x + 'px', top: position.y + 'px' }"
  >
    <div class="corner-accent top-left"></div>
    <div class="corner-accent top-right"></div>
    <div class="corner-accent bottom-left"></div>
    <div class="corner-accent bottom-right"></div>

    <div class="menu-header">
      <span class="portal-name">🚪 {{ portalName }}</span>
    </div>

    <ul class="menu-list">
      <li class="menu-item link-item" @click="$emit('start-link')">
        <span>🔌 建立传送链接</span>
      </li>
      <li class="menu-item delete-item" @click="$emit('delete-portal')">
        <span>🗑️ 删除此传送点</span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  visible: boolean;
  position: { x: number; y: number };
  portalName: string;
}>();

defineEmits(['start-link', 'delete-portal', 'close']);
</script>

<style scoped>
.context-menu {
  position: fixed;
  z-index: 1000;
  min-width: 160px;
  background: linear-gradient(180deg, rgba(22, 22, 30, 0.95) 0%, rgba(12, 12, 17, 0.98) 100%);
  border: 1px solid rgba(197, 160, 89, 0.5);
  box-shadow: inset 0 0 15px rgba(0,0,0,0.8), 0 8px 24px rgba(0,0,0,0.7);
  border-radius: 6px;
  padding: 6px 0;
}

.menu-header {
  padding: 6px 12px;
  border-bottom: 1px solid rgba(197, 160, 89, 0.2);
  font-size: 0.78rem;
  color: #38bdf8;
  font-weight: bold;
}

.menu-list {
  list-style: none;
  margin: 0;
  padding: 4px 0;
}

.menu-item {
  padding: 8px 14px;
  font-size: 0.82rem;
  color: #fef08a;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.15s ease;
}

.menu-item:hover {
  background: rgba(197, 160, 89, 0.2);
  color: #fff;
}

.delete-item:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

/* Corner Ornaments */
.corner-accent {
  position: absolute;
  width: 4px;
  height: 4px;
  border: 1px solid #c5a059;
}
.top-left { top: -1px; left: -1px; border-right: none; border-bottom: none; }
.top-right { top: -1px; right: -1px; border-left: none; border-bottom: none; }
.bottom-left { bottom: -1px; left: -1px; border-right: none; border-top: none; }
.bottom-right { bottom: -1px; right: -1px; border-left: none; border-top: none; }
</style>
