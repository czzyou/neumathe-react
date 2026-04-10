# 📚 Mathreact Workspace (Root / 根目录)

本项目是题库管理工作区的**根目录**，这里存放了整个项目的周边工具、数据来源以及打包结构。

如果你只想查看和浏览前端题目，请直接查阅子系统文档：[`mathreact/README.md`](mathreact/README.md)

---

## 📂 项目结构 (Root Structure)

- **`mathreact/`**: 核心的前端展示项目，基于 React 和 Vite（**详见内部子级 README**）。
- **`data/`**: 题库的原始结构化数据源。
  - `chapters/`: 每章节的具体题目数据 (JSON)。
  - `meta/`: 章节树结构、元数据等 (JSON)。
- **`reports/`**: 统计或检查脚本生成的分析报告。
- **`scripts/`**: 用于数据扫描、清洗等任务的 Python 实用脚本。
- **`legacy/`**: 早期的 HTML 导出文件和相关的静态资产。
- **`archive/`**: 压缩包、打包的历史数据。

---

## 🚀 快速启动前端

**查看题库**直接前往子目录 `mathreact` 即可启动前端服务器：

```bash
cd mathreact
npm install
npm run dev
```

> ⚠️ 注意：这只是根目录的概述。如需了解前端项目详细配置或代码结构，请一定要参见前端专属文档：`mathreact/README.md`
