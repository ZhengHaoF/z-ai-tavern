# z-ai-tavern

> AI 酒馆奇幻 RPG 探索游戏 —— 基于 PixiJS v8 的战术网格世界 + LLM 驱动的酒馆剧情叙事。

前端为 **Vue 3 + TypeScript + Vite**，渲染层使用 **PixiJS v8**；后端为 **NestJS**，作为 DeepSeek 及兼容 OpenAI Chat Completions API 的 LLM 代理服务。整体采用 pnpm monorepo 管理。

---

## ✨ 功能特性

- 🎮 **韩式暗黑写实风游戏主界面**（`/`）
  - 左侧 60%：PixiJS v8 主场景视窗（背景图 + 通行网格 + 角色行走渲染）
  - 右侧 40%：AI 酒馆控制台 / 剧情聊天区（NPC「酒馆老板 · 埃里克」引导）
  - 底部 72px：沉浸式玩家 HUD Dock（头像、HP/MP 条、关卡切换入口）
- 🗺️ **关卡包即开即玩**：拖入 `.zmap`（单关卡）或 `.zworld`（多关卡世界包）即可载入探索
- 🛠️ **独立六边形路网编辑器**（`/editor`）：上传背景图、调整网格粒度、刷涂通行区域、试走测试、导出 JSON
- 🧭 **多场景世界拓扑**：`.zworld` 支持传送门（portals）与跨场景连线（links），角色踏入传送格自动跳转关卡
- 🤖 **LLM 代理后端**：`/api/ai/chat` 透传对话请求，`/api/ai/health` 一键检测模型连通性，支持 `reasoning_effort` 推理强度调节

## 🧱 技术栈

| 端 | 技术 |
| --- | --- |
| 前端 `apps/web` | Vue 3.5 · TypeScript 5.7 · Vite 6 · PixiJS 8 · Pinia 3 · Vue Router 4 · idb-keyval · JSZip |
| 后端 `apps/server` | NestJS 10 · OpenAI SDK · class-validator |

## 📁 项目结构

```
z-ai-tavern/
├── apps/
│   ├── web/                     # Vue 3 前端应用
│   │   ├── src/
│   │   │   ├── components/      # GameSceneCanvas / EditorContextMenu
│   │   │   ├── engine/          # PixiJS 渲染引擎、网格数学、A* 寻路、关卡包解析
│   │   │   ├── stores/          # Pinia 状态（mapStore：关卡/角色/世界）
│   │   │   ├── types/           # gridMap / hexMap / worldMap / character 类型
│   │   │   ├── views/           # HomeView（主界面）/ RoadNetworkEditor（编辑器）
│   │   │   ├── router/          # 路由：/ 与 /editor
│   │   │   ├── App.vue · main.ts
│   │   └── vite.config.ts
│   └── server/                  # NestJS 后端服务
│       ├── src/
│       │   ├── ai/              # AI 模块：controller / service / llm.client
│       │   ├── app.module.ts
│       │   └── main.ts          # 全局前缀 api、CORS、ValidationPipe
│       └── .env.example         # 环境变量模板
├── doc/                         # 设计文档
│   ├── 视觉设计文档.md
│   └── 路网与移动系统设计文档.md
├── AGENTS.md                    # 项目规范与 Agent 规则
├── package.json                 # 根脚本（pnpm workspace）
└── pnpm-workspace.yaml
```

## 🚀 快速开始

### 环境要求

- Node.js **20 LTS** 及以上
- pnpm（仓库使用 `pnpm-lock.yaml`，请勿混用 npm/yarn）

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置后端环境变量

```bash
# Windows (PowerShell)
Copy-Item apps/server/.env.example apps/server/.env
# macOS / Linux
cp apps/server/.env.example apps/server/.env
```

编辑 `apps/server/.env`，填写 LLM 配置：

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `PORT` | 后端端口 | `3001` |
| `CORS_ORIGIN` | 允许的前端来源（多个用逗号分隔） | `http://localhost:5173` |
| `LLM_API_KEY` | API Key（**必填**） | — |
| `LLM_BASE_URL` | API 地址（**必填**，兼容 OpenAI 协议即可） | `https://api.deepseek.com/v1` |
| `LLM_MODEL` | 模型名称（**必填**） | `deepseek-chat` |
| `LLM_REASONING_EFFORT` | 推理强度 `low` / `medium` / `high` | `low` |

> 未配置 `LLM_API_KEY` 等服务仍可启动，但 `POST /api/ai/chat` 会返回 503，启动日志中会有相应警告。

### 3. 启动开发服务

```bash
pnpm dev          # 前后端并行启动（推荐）
```

或分端启动：

```bash
pnpm dev:web      # 仅前端  → http://localhost:5173
pnpm dev:server   # 仅后端  → http://localhost:3001
```

启动后访问：

- `http://localhost:5173/#/` — 游戏主界面
- `http://localhost:5173/#/editor` — 六边形路网编辑器

## 📜 可用脚本

根目录（`pnpm <script>`）：

| 脚本 | 说明 |
| --- | --- |
| `dev` | 并行启动所有子应用的 dev |
| `build` | 依次构建所有子应用 |
| `dev:web` | 仅启动前端 |
| `dev:server` | 仅启动后端 |

子应用内（`pnpm --filter z-ai-tavern-web <script>` 等）：

- web：`dev` / `build` / `preview`
- server：`dev`（watch）/ `build` / `start:prod` / `lint` / `format`

## 🔌 后端 API

服务全局前缀为 `/api`：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 服务存活检查 |
| GET | `/api/ai/health` | LLM 连通性检查，返回 `{ ok, model, latencyMs, error? }` |
| POST | `/api/ai/chat` | 对话代理，透传 Chat Completions 参数 |

`POST /api/ai/chat` 请求体示例：

```json
{
  "messages": [{ "role": "user", "content": "以酒馆老板的口吻说一句欢迎词" }],
  "reasoning_effort": "medium"
}
```

`model` 缺省时使用环境变量 `LLM_MODEL`；`reasoning_effort` 缺省时使用 `LLM_REASONING_EFFORT`（请求体可临时覆盖）。

## 🗂️ 关卡文件格式

- **`.zmap`**（单关卡包，zip）：包含背景图与 `walkableCells`（通行格 `"col,row"` 键集合），由路网编辑器导出。
- **`.zworld`**（多关卡世界包，zip）：包含多个地图节点 `maps`、传送门 `portals` 与场景连线 `links`，支持跨场景传送跳转。

主界面支持直接拖入或选择上述文件载入；未载入时会显示空状态引导。

## 📖 相关文档

- [AGENTS.md](./AGENTS.md) — 项目开发规范与 Agent 规则
- [doc/视觉设计文档.md](./doc/视觉设计文档.md) — 韩式暗黑写实风 UI 设计规范与布局架构
- [doc/路网与移动系统设计文档.md](./doc/路网与移动系统设计文档.md) — 六边形路网编辑器与 A\* 寻路设计方案
