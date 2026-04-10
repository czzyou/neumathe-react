# mathreact: Math Question Management & Viewing Platform

This project is a high-performance platform for organizing, managing, and viewing math questions. It provides a structured viewer to browse questions with rich mathematical typesetting.

本项目是一个高性能的数学题目管理与展示平台，提供结构化的查看器，支持丰富的数学公式渲染。

---

## 📂 Project Structure / 项目结构

- **`mathreact/`**: The core frontend application built with React, Vite, and TypeScript.
  - React 前端应用，基于 Vite 和 TypeScript 构建。
- **`data/`**: Structured data storage.
  - **`chapters/`**: Data files for each chapter's questions. (每个章节题目的数据文件)
  - **`meta/`**: Metadata including chapter trees and leaf IDs. (包括章节树和叶子节点 ID 的元数据)
- **`reports/`**: Generated analysis reports and scan outputs.
  - 生成的分析报告和扫描结果。
- **`legacy/`**: Old HTML exports and supporting static assets.
  - 旧版 HTML 导出文件及静态资源。
- **`archive/`**: Compressed archives of data and older versions.
  - 数据和旧版本的压缩归档。

---

## 🛠️ Tech Stack / 技术栈

### Frontend / 前端
- **Framework**: React 19 (Vite)
- **Language**: TypeScript
- **Styling & UI**: Vanilla CSS / Custom Components
- **Rendering**:
  - **KaTeX**: High-performance math typesetting.
  - **React Markdown**: Rendering structured question content.
  - **React Router**: Client-side routing.

---

## 🚀 Getting Started / 快速开始

### Running the Viewer / 运行查看器

To start the React frontend:
要启动 React 前端：

1. Navigate to the project directory:
   ```bash
   cd mathreact
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open the displayed URL (usually `http://localhost:5173`) in your browser.

---

## 📝 Configuration / 配置

- **Data Path**: The frontend reads data from `mathreact/public/data/`. Ensure the data directory is populated with valid JSON question files.
