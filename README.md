# NeuMathe: Math Question Scraping & Viewing Platform

This project is a dedicated platform for scraping math question data from [NeuMathe](https://neumathe.cn) and providing a high-quality viewer for these questions.

本项目是一个专门用于从 [NeuMathe](https://neumathe.cn) 抓取数学题目数据并提供高质量查看器的平台。

---

## 📂 Project Structure / 项目结构

- **`neumathe-react/`**: The core frontend application built with React, Vite, and TypeScript.
  - React 前端应用，基于 Vite 和 TypeScript 构建。
- **`scripts/`**: Python utility scripts for data scraping and analysis.
  - 用于数据抓取和分析的 Python 辅助脚本。
- **`data/`**: Structured data storage.
  - **`raw/`**: Raw JSON files for each chapter's questions. (每个章节题目的原始 JSON 文件)
  - **`meta/`**: Metadata including chapter trees and leaf IDs. (包括章节树和叶子节点 ID 的元数据)
- **`reports/`**: Generated reports and scan outputs.
  - 生成的报告和扫描结果。
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

### Scripts & Scraping / 脚本与抓取
- **Language**: Python 3
- **Libraries**:
  - `curl_cffi`: Advanced HTTP client for bypassing anti-bot measures (impersonating Chrome TLS fingerprints).
  - `json`, `re`: Data processing.

---

## 🚀 Getting Started / 快速开始

### 1. Data Scraping / 数据抓取

To fetch the latest questions from NeuMathe:
要从 NeuMathe 获取最新题目：

1. Ensure you have Python installed.
2. Install dependencies:
   ```bash
   pip install curl_cffi
   ```
3. Run the main scraper:
   ```bash
   python scripts/1.py
   ```
   *Note: This script uses a high-precision strategy to minimize requests and avoid detection.*

### 2. Running the Viewer / 运行查看器

To start the React frontend:
要启动 React 前端：

1. Navigate to the project directory:
   ```bash
   cd neumathe-react
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

- **Authentication**: The scraper requires a valid `x-auth-token` in `scripts/1.py` to access the API.
- **Data Path**: The frontend reads data from `neumathe-react/public/data/`. Ensure scraped files are synced if modified.

---

## 🛡️ Anti-Detection Strategy / 反爬策略

The `1.py` script implements several human-like behaviors:
`1.py` 脚本实现了多种拟人化行为：
- **TLS Fingerprinting**: Using `curl_cffi` to mimic Chrome 110.
- **Random Delays**: 5-15 second intervals between requests.
- **Zero-Waste Requests**: Pre-calculating pages from the chapter tree to avoid "probing" non-existent pages.
