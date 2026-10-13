# z-ai-tavern-web

AI 酒馆奇幻 RPG 的前端应用（Vue 3 + TypeScript + Vite + PixiJS v8）。

## 页面路由

- `/#/` — 游戏主界面：左侧 PixiJS 场景视窗 + 右侧 AI 酒馆控制台 + 底部 HUD Dock
- `/#/editor` — 独立六边形路网编辑器

## 本地开发

```bash
# 在仓库根目录
pnpm dev:web
# 或在本目录
pnpm dev
```

访问 http://localhost:5173 。

## 构建

```bash
pnpm build   # vue-tsc 类型检查 + vite build
pnpm preview # 预览构建产物
```

## 目录说明

```
src/
├── components/   # GameSceneCanvas（主场景画布）、EditorContextMenu
├── engine/       # PixiJS 引擎、网格/六边形数学、A* 寻路、.zmap/.zworld 解析
├── stores/       # mapStore：关卡、角色、世界拓扑状态
├── types/        # gridMap / hexMap / worldMap / character 类型定义
├── views/        # HomeView / RoadNetworkEditor
└── router/       # 路由定义
```

完整项目说明见仓库根目录 [README.md](../../README.md)。
