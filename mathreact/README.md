# mathreact: Interactive Math Question Viewer

An interactive, high-performance web application for browsing and studying math questions.

## 🚀 Features

- **Rich Typesetting**: High-quality math rendering via KaTeX.
- **Smart Organization**: Chapter-based navigation with tree structure.
- **Study Aids**: Support for favorites, difficulty filtering, and performance stats.
- **Adaptive UI**: Responsive design with light/dark theme support.

## 📂 Project Structure

- `src/`: React source code (TypeScript).
- `public/data/`: JSON data store for questions and metadata.
- `App.tsx`: Core logic and UI components.

## 🛠️ Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start development server:
   ```bash
   npm run dev
   ```
3. Build for production:
   ```bash
   npm run build
   ```

## 📝 Data Source

The application expects question data in the `public/data/` directory. Each chapter's data should follow the structured JSON format as seen in existing files.

For updates, ensure that the `mathreact_chapter_tree.json` (metadata) and individual chapter files (e.g., `mathreact_chapter_256_raw.json`) are correctly placed.
