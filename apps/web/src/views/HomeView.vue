<template>
  <div class="home-container">
    <div class="welcome-card">
      <h1>⚔️ AI 酒馆奇幻 RPG</h1>
      <p class="subtitle">全栈 Monorepo (Vue 3 + PixiJS v8 + NestJS AI 后端)</p>
      
      <div class="action-box">
        <router-link to="/editor" class="btn-editor">
          🛠️ 进入战术八方向路网编辑器 (/editor)
        </router-link>
      </div>

      <div class="info-footer">
        <span>支持背景图载入、正方形八方向刷涂、A* 寻路演练与地图 JSON 导出</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.home-container {
  min-height: 100vh;
  background: #090710;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-family: sans-serif;
}

.welcome-card {
  background: rgba(18, 14, 34, 0.8);
  border: 1px solid rgba(139, 92, 246, 0.3);
  padding: 40px;
  border-radius: 16px;
  text-align: center;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  max-width: 540px;
}

h1 {
  font-size: 2rem;
  color: #f59e0b;
  margin-bottom: 8px;
}

.subtitle {
  color: #9ca3af;
  font-size: 0.9rem;
  margin-bottom: 24px;
}

.action-box {
  margin: 20px 0;
}

.btn-editor {
  display: inline-block;
  background: linear-gradient(135deg, #8b5cf6, #d97706);
  color: #fff;
  text-decoration: none;
  font-weight: 700;
  padding: 14px 28px;
  border-radius: 10px;
  box-shadow: 0 0 15px rgba(245, 158, 11, 0.3);
  transition: all 0.25s ease;
}

.btn-editor:hover {
  transform: translateY(-2px);
  box-shadow: 0 0 25px rgba(245, 158, 11, 0.6);
}

.info-footer {
  font-size: 0.75rem;
  color: #6b7280;
  margin-top: 16px;
}
</style>
