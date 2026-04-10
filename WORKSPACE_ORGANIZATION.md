# Workspace Organization / 工作区目录说明

## Top-Level Folders / 顶层目录

- `neumathe-react/`
	- EN: React app source code and frontend assets.
	- 中文：React 前端项目源码与静态资源。

- `data/raw/`
	- EN: Raw chapter question files (`neumathe_chapter_*_raw.json`).
	- 中文：章节题目原始数据文件（`neumathe_chapter_*_raw.json`）。

- `data/meta/`
	- EN: Metadata files (`neumathe_chapter_tree.json`, `neumathe_leaf_ids.json`).
	- 中文：题库元数据文件（`neumathe_chapter_tree.json`、`neumathe_leaf_ids.json`）。

- `scripts/`
	- EN: Utility scripts (`1.py`, `scan_js.py`).
	- 中文：辅助脚本（`1.py`、`scan_js.py`）。

- `reports/`
	- EN: Scan outputs and text reports.
	- 中文：扫描结果与文本报告。

- `legacy/`
	- EN: Old HTML export and static support folder.
	- 中文：旧版 HTML 导出文件及配套静态资源目录。

- `archive/`
	- EN: Compressed archive files.
	- 中文：压缩归档文件。

## Notes / 说明

- EN: Frontend runtime data is still in `neumathe-react/public/data/` (unchanged).
- 中文：前端运行时读取的数据仍在 `neumathe-react/public/data/`（未改动）。

- EN: If old shell commands assumed raw files at workspace root, update paths to `data/raw/` and `data/meta/`.
- 中文：如果旧命令默认在根目录读取数据，请改为从 `data/raw/` 和 `data/meta/` 读取。
