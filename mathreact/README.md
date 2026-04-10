# 💻 Mathreact Frontend App (Subfolder / 子目录前端服务)

这是题库系统**核心的前端展示项目**的独立 README 文件。位于工作区的 `mathreact/`。

它基于 Vite 和 React 19 构建，作用是解析外层（现在已复制到 `public/data/` 内）的 JSON 题库结构，并用 KaTeX 原生渲染公式以提供流畅的题库浏览体验。

---

## 🛠️ 技术栈 (Tech Stack)

- **框架**: Fast, native Vite + React 19.
- **语言**: TypeScript (强类型支持).
- **渲染工具**:
  - `KaTeX`: 数学公式的高性能渲染器
  - `React Markdown`: 解析结构化原数据为可视文档

---

## 📂 前端内部结构 (Frontend Structure)

- **`public/data/`**: （当前项目的数据源位置。结构需保持 `chapters/`、`meta/` 存在 JSON，前端通过 `/data/...` 请求读取）
- **`src/`**: React 所有界面与逻辑代码。
  - `components/`: UI 小组件（如各类筛选、提示）。
  - `App.tsx`: 核心的阅读器布局主页。
  - `main.tsx`: React 入口。

---

## 🏃 启动命令 (Commands)

```bash
# 1. 下载依赖
npm install

# 2. 运行开发环境 (http://localhost:5173)
npm run dev

# 3. 生产环境打包
npm run build
```

> **返回根目录了解更多:** 请查看外面父文件夹层的 [`../README.md`](../README.md) 了解本项目整体的设计脚本构成。
