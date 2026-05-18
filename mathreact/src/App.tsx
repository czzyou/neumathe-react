import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

type ChapterNode = {
  id: number;
  parent_id?: number | null;
  chapter_name: string;
  count: number;
};

type RawChoice = {
  choice_id: string;
  choice: string;
  is_answer: boolean;
};

type RawQuestion = {
  id: number;
  question_id: string;
  chapter_id: number;
  difficulty: string;
  accuracy_rate?: number;
  difficulty_score?: number;
  avg_time_spent?: number;
  tags?: string;
  answer: string;
  question: string;
  analysis: string;
  analysis_image?: string;
  ai_tags?: string;
  choices: RawChoice[];
};

type RawPage = {
  data?: {
    questions?: RawQuestion[];
  };
};

type TreePayload = {
  data?: {
    data?: ChapterNode[];
  };
};

type UiChapter = {
  id: number;
  name: string;
  count: number;
};

type ChapterTreeNode = {
  id: number;
  name: string;
  count: number;
  isLeaf: boolean;
  selectable: boolean;
  children: ChapterTreeNode[];
};

type ViewMode = "chapter" | "favorites";
type ThemeMode = "light" | "dark";
type HardTag = "mistake" | "slow" | "high";
type SortMode =
  | "default"
  | "accuracy-asc"
  | "difficulty-desc"
  | "difficulty-asc";

const QUESTIONS_PER_PAGE = 10;
const FAVORITES_STORAGE_KEY = "mathreact:favorites";
const THEME_STORAGE_KEY = "mathreact:theme";
const PROGRESS_STORAGE_KEY = "mathreact:progress";
const LOW_ACCURACY_THRESHOLD = 0.67;
const LONG_TIME_THRESHOLD = 121711;
const HIGH_DIFFICULTY_THRESHOLD = 0.43;
const DATA_VERSION = import.meta.env.VITE_DATA_VERSION ?? "dev";
const DATA_FETCH_OPTIONS: RequestInit = { cache: "no-store" };
const dataUrl = (path: string) =>
  `${path}?v=${encodeURIComponent(DATA_VERSION)}`;
const HARD_TAG_META: Record<HardTag, { label: string; chipClass: string }> = {
  mistake: { label: "L1 易错题", chipClass: "hard-mistake" },
  slow: { label: "L2 耗时题", chipClass: "hard-slow" },
  high: { label: "L3 高难题", chipClass: "hard-high" },
};
const HARD_TAG_ORDER: HardTag[] = ["mistake", "slow", "high"];

function loadTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "light";
  }

  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "dark" || stored === "light") {
    return stored;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function loadFavorites(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function loadProgress(): { chapterId: number | null; pageIndex: number } {
  try {
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (!raw) {
      return { chapterId: null, pageIndex: 0 };
    }
    const parsed = JSON.parse(raw);
    return {
      chapterId: typeof parsed.chapterId === "number" ? parsed.chapterId : null,
      pageIndex: typeof parsed.pageIndex === "number" ? parsed.pageIndex : 0,
    };
  } catch {
    return { chapterId: null, pageIndex: 0 };
  }
}

function normalizeMathText(text: string): string {
  if (!text) return "";
  // 有些 JSON 中的 LaTeX `\right` 被错误写成了 `\r...` 转义，
  // 解析后会变成真实回车 + `ight`，导致 KaTeX 看到半截命令。
  let result = text.replace(/\r(?=[A-Za-z])/g, "\\r");

  // 将短划线 \bar 替换为全宽的 \overline（包括 \bar{A} 和 \bar A，以及两层 \bar{\bar{A}}）
  // 这样渲染逻辑非、集合补集等「a的反」时会更好看。
  result = result.replace(/\\bar(?![a-zA-Z])/g, "\\overline");

  // 修复 \begin{tabular} 在 KaTeX 中不支持且排版错乱的问题
  // 替换为 KaTeX 支持的 \begin{array}，包裹在 $$ 中成为公式块，并去除内部 $ 避免语法破坏
  result = result.replace(
    /\\begin\{tabular\}([\s\S]*?)\\end\{tabular\}/g,
    (_match, inner) => {
      const noMathInner = inner.replace(/\$/g, " ");
      return `\n$$\n\\begin{array}${noMathInner}\\end{array}\n$$\n`;
    },
  );

  // 修复极端错乱的题库数据：有些题目的公式裸露在外，而用 "$$ $$" 作为公式间的分隔符。
  // 例如：`P\{X=0\}=... $$ $$ P\{X=1\}=...`
  // 这类文本应拆成多个独立 display math 块，而不是把整段再包一层 $$。
  if (/\$\$\s+\$\$/.test(result)) {
    const trimmed = result.trim();
    if (!trimmed.startsWith("$$") && !trimmed.endsWith("$$")) {
      result = trimmed
        .split(/\s*\$\$\s+\$\$\s*/)
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => `$$\n${part}\n$$`)
        .join("\n\n");
    }
  }

  // 修复同行紧邻的 $$...$$ 块（如 "$$ ... $$ $$ ... $$"）无法被 remark-math 识别的问题。
  // remark-math 要求每个 display math 块前后都有空行（段落边界），
  // 因此将 $$ 结束符与下一个 $$ 开始符之间的空白替换为双换行。
  result = result.replace(/(\$\$)\s+(\$\$)/g, "$1\n\n$2");

  // 修复同行 display math（如 `$$P(...)=...$$`）被 remark-math 当成 inline math，
  // 甚至在连续公式解析中退回原文的问题。统一改成独立块。
  result = result.replace(
    /\$\$([^\n][\s\S]*?[^\n])\$\$/g,
    (_match, inner) => `\n$$\n${inner.trim()}\n$$\n`,
  );

  return result;
}

function MarkdownMath({ text, isAnalysis }: { text: string; isAnalysis?: boolean }) {
  let prettierText = normalizeMathText(text);
  if (isAnalysis) {
    prettierText = normalizeAnalysisText(prettierText);
  }

  return (
    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
      {prettierText}
    </ReactMarkdown>
  );
}

function formatRate(rate?: number): string {
  if (rate == null || Number.isNaN(rate)) {
    return "--";
  }
  return `${(rate * 100).toFixed(0)}%`;
}

function formatDifficultyScore(score?: number): string {
  if (score == null || Number.isNaN(score)) {
    return "--";
  }
  return score.toFixed(2);
}

function formatAvgTimeSpent(time?: number): string {
  if (time == null || Number.isNaN(time)) {
    return "--";
  }
  if (time >= 1000) {
    return `${(time / 1000).toFixed(1)}s`;
  }
  return `${time}ms`;
}

function shouldUseSingleColumnChoices(choices: RawChoice[]): boolean {
  return choices.some((choice) => {
    const compact = choice.choice
      .replace(/\$\$?/g, "")
      .replace(/\\[a-zA-Z]+/g, "")
      .replace(/\s+/g, "");

    return (
      compact.length > 30 ||
      choice.choice.includes("\n") ||
      choice.choice.includes("$$")
    );
  });
}

function getChoiceLabel(choiceId: string, index: number): string {
  const normalized = choiceId.trim().toUpperCase();
  if (normalized.length === 1 && normalized >= "A" && normalized <= "Z") {
    return normalized;
  }

  // 数字型 choice_id（如 "1","2","3","4"）不能直接换算字母，
  // 因为洗牌后位置已变，必须用渲染索引来决定 A/B/C/D。
  return String.fromCharCode(65 + index);
}

function getHardTags(question: RawQuestion): HardTag[] {
  const tags: HardTag[] = [];

  if (
    question.accuracy_rate != null &&
    Number.isFinite(question.accuracy_rate) &&
    question.accuracy_rate <= LOW_ACCURACY_THRESHOLD
  ) {
    tags.push("mistake");
  }

  if (
    question.avg_time_spent != null &&
    Number.isFinite(question.avg_time_spent) &&
    question.avg_time_spent >= LONG_TIME_THRESHOLD
  ) {
    tags.push("slow");
  }

  if (
    question.difficulty_score != null &&
    Number.isFinite(question.difficulty_score) &&
    question.difficulty_score >= HIGH_DIFFICULTY_THRESHOLD
  ) {
    tags.push("high");
  }

  return tags;
}

function normalizeAnalysisText(text: string): string {
  const BEGIN_ALIGNED = "\\begin{aligned}";
  const END_ALIGNED = "\\end{aligned}";

  const splitTopLevelAlignedRows = (inner: string): string[] => {
    const rows: string[] = [];
    let rowStart = 0;
    let nestedEnvironmentDepth = 0;

    for (let i = 0; i < inner.length; i++) {
      if (inner.startsWith("\\begin{", i)) {
        nestedEnvironmentDepth += 1;
        continue;
      }

      if (inner.startsWith("\\end{", i)) {
        nestedEnvironmentDepth = Math.max(0, nestedEnvironmentDepth - 1);
        continue;
      }

      if (
        nestedEnvironmentDepth === 0 &&
        inner[i] === "\\" &&
        inner[i + 1] === "\\"
      ) {
        rows.push(inner.slice(rowStart, i));
        i += 1;
        rowStart = i + 1;
      }
    }

    rows.push(inner.slice(rowStart));
    return rows;
  };

  const splitAligned = (_whole: string, inner: string): string => {
    const removeTopLevelAlignmentMarkers = (line: string): string => {
      let nestedEnvironmentDepth = 0;
      let result = "";

      for (let i = 0; i < line.length; i++) {
        if (line.startsWith("\\begin{", i)) {
          nestedEnvironmentDepth += 1;
          result += line[i];
          continue;
        }

        if (line.startsWith("\\end{", i)) {
          nestedEnvironmentDepth = Math.max(0, nestedEnvironmentDepth - 1);
          result += line[i];
          continue;
        }

        if (line[i] === "&" && nestedEnvironmentDepth === 0) {
          continue;
        }

        result += line[i];
      }

      return result;
    };

    const lines = splitTopLevelAlignedRows(inner)
      .map((line) =>
        removeTopLevelAlignmentMarkers(line.replace(/^\s*&\s*/, "")).trim(),
      )
      .filter(Boolean);

    if (lines.length === 0) {
      return _whole;
    }

    // 将超宽 aligned 公式拆成多个独立公式块，避免单行过长产生难以拖动的横条。
    return lines.map((line) => `$$\n${line}\n$$`).join("\n\n");
  };

  const findMatchingAlignedEnd = (
    source: string,
    beginIndex: number,
  ): { innerStart: number; innerEnd: number; blockEnd: number } | null => {
    let depth = 0;
    let cursor = beginIndex;

    while (cursor < source.length) {
      const nextBegin = source.indexOf("\\begin{", cursor);
      const nextEnd = source.indexOf("\\end{", cursor);

      if (nextBegin === -1 && nextEnd === -1) {
        return null;
      }

      if (nextBegin !== -1 && (nextEnd === -1 || nextBegin < nextEnd)) {
        depth += 1;
        cursor = nextBegin + "\\begin{".length;
        continue;
      }

      depth = Math.max(0, depth - 1);
      if (depth === 0 && source.startsWith(END_ALIGNED, nextEnd)) {
        return {
          innerStart: beginIndex + BEGIN_ALIGNED.length,
          innerEnd: nextEnd,
          blockEnd: nextEnd + END_ALIGNED.length,
        };
      }

      cursor = nextEnd + "\\end{".length;
    }

    return null;
  };

  const getWrappedRange = (
    source: string,
    beginIndex: number,
    blockEnd: number,
  ): { start: number; end: number } => {
    let before = beginIndex;
    while (before > 0 && /\s/.test(source[before - 1])) {
      before -= 1;
    }

    let after = blockEnd;
    while (after < source.length && /\s/.test(source[after])) {
      after += 1;
    }

    if (before >= 2 && source.slice(before - 2, before) === "$$") {
      if (source.slice(after, after + 2) === "$$") {
        return { start: before - 2, end: after + 2 };
      }
    }

    if (
      before >= 1 &&
      source[before - 1] === "$" &&
      source[before - 2] !== "$" &&
      source[after] === "$" &&
      source[after + 1] !== "$"
    ) {
      return { start: before - 1, end: after + 1 };
    }

    return { start: beginIndex, end: blockEnd };
  };

  let result = "";
  let cursor = 0;

  while (cursor < text.length) {
    const beginIndex = text.indexOf(BEGIN_ALIGNED, cursor);
    if (beginIndex === -1) {
      result += text.slice(cursor);
      break;
    }

    const match = findMatchingAlignedEnd(text, beginIndex);
    if (!match) {
      result += text.slice(cursor);
      break;
    }

    const wrappedRange = getWrappedRange(text, beginIndex, match.blockEnd);
    result += text.slice(cursor, wrappedRange.start);
    result += splitAligned(
      text.slice(wrappedRange.start, wrappedRange.end),
      text.slice(match.innerStart, match.innerEnd),
    );
    cursor = wrappedRange.end;
  }

  return result;
}

function getCorrectAnswerLabel(question: RawQuestion): string {
  const matchedIndex = question.choices.findIndex(
    (choice) => choice.choice_id === question.answer,
  );
  if (matchedIndex >= 0) {
    return getChoiceLabel(
      question.choices[matchedIndex].choice_id,
      matchedIndex,
    );
  }

  const answerByFlagIndex = question.choices.findIndex(
    (choice) => choice.is_answer,
  );
  if (answerByFlagIndex >= 0) {
    return getChoiceLabel(
      question.choices[answerByFlagIndex].choice_id,
      answerByFlagIndex,
    );
  }

  return question.answer.trim();
}

function shuffleChoices(questions: RawQuestion[]): RawQuestion[] {
  return questions.map((question) => {
    const choices = [...question.choices];
    for (let i = choices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [choices[i], choices[j]] = [choices[j], choices[i]];
    }
    return { ...question, choices };
  });
}

function getFullImageUrl(url?: string): string {
  if (!url) return "";
  if (url.startsWith("/")) {
    return `https://mathreact.local${url}`;
  }
  return url;
}

function getLeafChapters(nodes: ChapterNode[]): UiChapter[] {
  const parentSet = new Set(
    nodes
      .filter((node) => node.parent_id != null)
      .map((node) => node.parent_id as number),
  );

  return nodes
    .filter((node) => !parentSet.has(node.id))
    .filter((node) => node.count > 0)
    .filter((node) => node.id >= 256 && node.id <= 400)
    .sort((a, b) => a.id - b.id)
    .map((node) => ({
      id: node.id,
      name: node.chapter_name,
      count: node.count,
    }));
}

function buildChapterTree(
  nodes: ChapterNode[],
  selectableLeafIds: Set<number>,
): ChapterTreeNode[] {
  const nodeMap = new Map<number, ChapterNode>();
  nodes.forEach((node) => nodeMap.set(node.id, node));

  const included = new Set<number>();

  selectableLeafIds.forEach((leafId) => {
    let cursor = nodeMap.get(leafId);
    while (cursor) {
      if (included.has(cursor.id)) {
        break;
      }
      included.add(cursor.id);
      if (cursor.parent_id == null) {
        break;
      }
      cursor = nodeMap.get(cursor.parent_id);
    }
  });

  const childrenMap = new Map<number, number[]>();
  included.forEach((id) => childrenMap.set(id, []));

  included.forEach((id) => {
    const node = nodeMap.get(id);
    if (!node || node.parent_id == null) {
      return;
    }
    if (included.has(node.parent_id)) {
      childrenMap.get(node.parent_id)?.push(id);
    }
  });

  childrenMap.forEach((list) => list.sort((a, b) => a - b));

  let roots = Array.from(included).filter((id) => {
    const node = nodeMap.get(id);
    if (!node || node.parent_id == null) {
      return true;
    }
    return !included.has(node.parent_id);
  });

  roots = roots.sort((a, b) => a - b);

  const toTree = (id: number): ChapterTreeNode => {
    const node = nodeMap.get(id)!;
    const childIds = childrenMap.get(id) ?? [];
    return {
      id: node.id,
      name: node.chapter_name,
      count: node.count,
      isLeaf: childIds.length === 0,
      selectable: selectableLeafIds.has(node.id),
      children: childIds.map(toTree),
    };
  };

  let tree = roots.map(toTree);

  // 目录通常有一层“学科根节点”，这里直接展开到章节层，方便左侧直接看到 1/2/3... 结构。
  if (tree.length === 1 && !tree[0].isLeaf) {
    tree = tree[0].children;
  }

  return tree;
}

// ─── Obsidian 导出工具 ────────────────────────────────────────────────────────

function generateObsidianMarkdown(
  favoriteQuestions: RawQuestion[],
  chapterNameById: Map<number, string>,
): string {
  const today = new Date().toISOString().slice(0, 10);
  const total = favoriteQuestions.length;

  const frontmatter = [
    "---",
    "title: 数学概率统计 - 收藏题库",
    "tags:",
    "  - 数学",
    "  - 概率统计",
    "  - 收藏题库",
    `created: ${today}`,
    `total: ${total}`,
    "---",
  ].join("\n");

  // 按 chapter_id 分组，保留题目在各章的原始顺序
  const groupOrder: number[] = [];
  const groups = new Map<number, RawQuestion[]>();
  for (const q of favoriteQuestions) {
    if (!groups.has(q.chapter_id)) {
      groupOrder.push(q.chapter_id);
      groups.set(q.chapter_id, []);
    }
    groups.get(q.chapter_id)!.push(q);
  }

  let questionNo = 0;

  const sections = groupOrder.map((chapterId) => {
    const chapterName = chapterNameById.get(chapterId) ?? `章节 ${chapterId}`;
    const qs = groups.get(chapterId)!;

    const questionBlocks = qs.map((q) => {
      questionNo++;
      const label = getCorrectAnswerLabel(q);
      const hardTags = getHardTags(q);
      const hardTagStr = hardTags
        .map((t) => HARD_TAG_META[t].label)
        .join(" · ");

      const metaParts = [
        `正确率：${formatRate(q.accuracy_rate)}`,
        `难度分：${formatDifficultyScore(q.difficulty_score)}`,
        `平均用时：${formatAvgTimeSpent(q.avg_time_spent)}`,
        `难度：${q.difficulty}`,
      ];
      if (hardTagStr) metaParts.push(hardTagStr);

      // 选项：A/B/C/D 列表
      const choiceLines = q.choices
        .map((c, i) => `- **${getChoiceLabel(c.choice_id, i)}.** ${c.choice}`)
        .join("\n");

      // 题干 & 解析同样替换，与 MarkdownMath 保持一致
      const questionText = normalizeMathText(q.question);

      const analysisRaw = normalizeAnalysisText(
        normalizeMathText(q.analysis || "暂无解析"),
      );
      // Obsidian Callout 要求每行都以 "> " 开头（空行也需要 ">"）
      const analysisCallout = analysisRaw
        .split("\n")
        .map((line) => (line.trim() === "" ? ">" : `> ${line}`))
        .join("\n");

      const parts: string[] = [
        `### 题目 ${questionNo}`,
        "",
        "> [!info] 题目信息",
        `> ${metaParts.join(" | ")}`,
        "",
        questionText,
        "",
        choiceLines,
        "",
        "> [!success] 正确答案",
        `> **答案：${label}**`,
        "",
        "> [!note] 题目解析",
        analysisCallout,
      ];

      if (q.analysis_image) {
        parts.push("");
        parts.push(
          `> 参考解析图：[查看原图](${getFullImageUrl(q.analysis_image)})`,
        );
      }

      parts.push("");
      parts.push("---");

      return parts.join("\n");
    });

    return [`## ${chapterName}`, "", ...questionBlocks].join("\n");
  });

  return [
    frontmatter,
    "",
    "# 📚 数学概率统计 - 收藏题库",
    "",
    `> 共收藏 **${total}** 道题目，导出时间：${today}`,
    "",
    "---",
    "",
    sections.join("\n\n"),
  ].join("\n");
}

function downloadMarkdownFile(content: string, filename: string): void {
  // 加 UTF-8 BOM，保证 Windows 下打开不乱码
  const blob = new Blob(["\ufeff" + content], {
    type: "text/markdown;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────────

function App() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => loadTheme());
  const [viewMode, setViewMode] = useState<ViewMode>("chapter");
  const [chapters, setChapters] = useState<UiChapter[]>([]);
  const [chapterTree, setChapterTree] = useState<ChapterTreeNode[]>([]);
  const [expandedIds, setExpandedIds] = useState<Record<number, boolean>>({});
  const [chapterId, setChapterId] = useState<number | null>(
    () => loadProgress().chapterId,
  );
  const [allAnalysisOpen, setAllAnalysisOpen] = useState(false);
  const [allAnswerOpen, setAllAnswerOpen] = useState(false);
  const [questions, setQuestions] = useState<RawQuestion[]>([]);
  const [allQuestions, setAllQuestions] = useState<RawQuestion[]>([]);
  const [pageIndex, setPageIndex] = useState(() => loadProgress().pageIndex);
  const [selectedChoices, setSelectedChoices] = useState<
    Record<string, string>
  >({});
  const [analysisOpenMap, setAnalysisOpenMap] = useState<
    Record<string, boolean>
  >({});
  const [favoriteMap, setFavoriteMap] = useState<Record<string, boolean>>(() =>
    loadFavorites(),
  );
  const [selectedHardTags, setSelectedHardTags] = useState<
    Record<HardTag, boolean>
  >({
    mistake: false,
    slow: false,
    high: false,
  });
  const [sortMode, setSortMode] = useState<SortMode>("default");
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [loading, setLoading] = useState(false);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [error, setError] = useState<string>("");
  // 当 allQuestions 还未加载时点击导出，先切换视图触发加载，加载完成后自动触发下载
  const [exportPending, setExportPending] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", themeMode);
    localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favoriteMap));
  }, [favoriteMap]);

  useEffect(() => {
    localStorage.setItem(
      PROGRESS_STORAGE_KEY,
      JSON.stringify({ chapterId, pageIndex }),
    );
  }, [chapterId, pageIndex]);

  useEffect(() => {
    const run = async () => {
      try {
        setError("");
        const res = await fetch(
          dataUrl("/data/meta/neumathe_chapter_tree.json"),
          DATA_FETCH_OPTIONS,
        );
        if (!res.ok) {
          throw new Error("目录树文件读取失败");
        }
        const payload = (await res.json()) as TreePayload;
        const nodes = payload.data?.data ?? [];
        const leafChapters = getLeafChapters(nodes);
        const leafIdSet = new Set(leafChapters.map((chapter) => chapter.id));
        const tree = buildChapterTree(nodes, leafIdSet);

        setChapters(leafChapters);
        setChapterTree(tree);
        setExpandedIds({});

        if (leafChapters.length > 0 && chapterId === null) {
          setChapterId(leafChapters[0].id);
        }
      } catch {
        setError(
          "加载目录失败，请确认 public/data/meta 下有 neumathe_chapter_tree.json",
        );
      }
    };

    void run();
  }, []);

  useEffect(() => {
    if (chapterId == null) {
      return;
    }

    const run = async () => {
      try {
        setLoading(true);
        setError("");
        const res = await fetch(
          dataUrl(`/data/chapters/neumathe_chapter_${chapterId}_raw.json`),
          DATA_FETCH_OPTIONS,
        );
        if (!res.ok) {
          throw new Error("章节题库读取失败");
        }
        const payload = (await res.json()) as RawPage[];
        const mergedQuestions = shuffleChoices(
          payload.flatMap((page) => page.data?.questions ?? []),
        );
        setQuestions(mergedQuestions);
        // 只有当切换了章节时才归零页码（如果刷新页面，chapterId相同则保留pageIndex）
        const lastProgress = loadProgress();
        if (lastProgress.chapterId !== chapterId) {
          setPageIndex(0);
        }
        setSelectedChoices({});
        setAnalysisOpenMap({});
      } catch {
        setQuestions([]);
        setError(`加载章节 ${chapterId} 失败，请确认对应 raw 文件已复制`);
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [chapterId]);

  useEffect(() => {
    if (
      viewMode !== "favorites" ||
      allQuestions.length > 0 ||
      chapters.length === 0
    ) {
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        setFavoritesLoading(true);
        setError("");
        const batches = await Promise.all(
          chapters.map(async (chapter) => {
            try {
              const res = await fetch(
                dataUrl(
                  `/data/chapters/neumathe_chapter_${chapter.id}_raw.json`,
                ),
                DATA_FETCH_OPTIONS,
              );
              if (!res.ok) {
                return [] as RawQuestion[];
              }
              const payload = (await res.json()) as RawPage[];
              return shuffleChoices(
                payload.flatMap((page) => page.data?.questions ?? []),
              );
            } catch {
              return [] as RawQuestion[];
            }
          }),
        );

        if (!cancelled) {
          setAllQuestions(batches.flat());
        }
      } catch {
        if (!cancelled) {
          setError("加载收藏题夹失败，请稍后重试");
        }
      } finally {
        if (!cancelled) {
          setFavoritesLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [viewMode, allQuestions.length, chapters]);

  const questionSource = useMemo(() => {
    return viewMode === "favorites" ? allQuestions : questions;
  }, [viewMode, allQuestions, questions]);

  const activeHardTagSet = useMemo(() => {
    return new Set(HARD_TAG_ORDER.filter((tag) => selectedHardTags[tag]));
  }, [selectedHardTags]);

  const displayQuestions = useMemo(() => {
    const baseQuestions =
      viewMode === "favorites"
        ? questionSource.filter((question) => favoriteMap[question.question_id])
        : onlyFavorites
          ? questionSource.filter(
              (question) => favoriteMap[question.question_id],
            )
          : questionSource;

    if (activeHardTagSet.size === 0) {
      return baseQuestions;
    }

    return baseQuestions.filter((question) => {
      const hardTags = getHardTags(question);
      return hardTags.some((tag) => activeHardTagSet.has(tag));
    });
  }, [viewMode, questionSource, favoriteMap, onlyFavorites, activeHardTagSet]);

  const sortedQuestions = useMemo(() => {
    if (sortMode === "default") {
      return displayQuestions;
    }

    const copy = [...displayQuestions];
    if (sortMode === "accuracy-asc") {
      return copy.sort(
        (a, b) => (a.accuracy_rate ?? 1) - (b.accuracy_rate ?? 1),
      );
    }
    if (sortMode === "difficulty-desc") {
      return copy.sort(
        (a, b) => (b.difficulty_score ?? 0) - (a.difficulty_score ?? 0),
      );
    }
    if (sortMode === "difficulty-asc") {
      return copy.sort(
        (a, b) => (a.difficulty_score ?? 0) - (b.difficulty_score ?? 0),
      );
    }
    return copy;
  }, [displayQuestions, sortMode]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(sortedQuestions.length / QUESTIONS_PER_PAGE)),
    [sortedQuestions.length],
  );

  useEffect(() => {
    if (sortedQuestions.length === 0) return;
    const maxPage = Math.max(
      0,
      Math.ceil(sortedQuestions.length / QUESTIONS_PER_PAGE) - 1,
    );
    if (pageIndex > maxPage) {
      setPageIndex(0);
    }
  }, [sortedQuestions.length, pageIndex]);

  const pageQuestions = useMemo(() => {
    const start = pageIndex * QUESTIONS_PER_PAGE;
    const end = start + QUESTIONS_PER_PAGE;
    return sortedQuestions.slice(start, end);
  }, [sortedQuestions, pageIndex]);

  const pageTitle = useMemo(() => {
    if (viewMode === "favorites") {
      return "收藏题夹";
    }
    if (chapterId == null) {
      return "概率统计 256-400 章节练习";
    }
    const found = chapters.find((chapter) => chapter.id === chapterId);
    return found?.name ?? "概率统计 256-400 章节练习";
  }, [viewMode, chapterId, chapters]);

  const selectedChapterLabel = useMemo(() => {
    if (viewMode === "favorites") {
      return "收藏题夹（跨章节）";
    }
    if (chapterId == null) {
      return "";
    }
    const found = chapters.find((chapter) => chapter.id === chapterId);
    return found ? `${found.id} · ${found.name}` : "";
  }, [viewMode, chapterId, chapters]);

  const favoritesInChapter = useMemo(
    () =>
      questions.filter((question) => favoriteMap[question.question_id]).length,
    [questions, favoriteMap],
  );

  const favoriteTotal = useMemo(
    () => Object.values(favoriteMap).filter(Boolean).length,
    [favoriteMap],
  );

  const chapterNameById = useMemo(() => {
    return new Map(chapters.map((chapter) => [chapter.id, chapter.name]));
  }, [chapters]);

  // 导出挂起 effect：在此处定义是因为依赖 chapterNameById（定义于上方）
  useEffect(() => {
    if (!exportPending || allQuestions.length === 0 || favoritesLoading) return;

    setExportPending(false);

    const favoriteQuestions = allQuestions
      .filter((q) => favoriteMap[q.question_id])
      .sort((a, b) => a.chapter_id - b.chapter_id);

    if (favoriteQuestions.length === 0) return;

    const content = generateObsidianMarkdown(
      favoriteQuestions,
      chapterNameById,
    );
    const date = new Date().toISOString().slice(0, 10);
    downloadMarkdownFile(content, `数学收藏题库_${date}.md`);
  }, [
    exportPending,
    allQuestions,
    favoritesLoading,
    favoriteMap,
    chapterNameById,
  ]);

  const movePage = (direction: -1 | 1) => {
    const nextPage = pageIndex + direction;
    if (nextPage < 0 || nextPage >= totalPages) {
      return;
    }
    setPageIndex(nextPage);
  };

  const toggleTreeNode = (id: number) => {
    setExpandedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleExportToObsidian = () => {
    if (favoriteTotal === 0) return;

    // 若全题库数据尚未加载（未进入过收藏题夹），先切换过去触发加载，挂起导出意图
    if (allQuestions.length === 0) {
      setViewMode("favorites");
      setPageIndex(0);
      setError("");
      setExportPending(true);
      return;
    }

    const favoriteQuestions = allQuestions
      .filter((q) => favoriteMap[q.question_id])
      .sort((a, b) => a.chapter_id - b.chapter_id);

    if (favoriteQuestions.length === 0) return;

    const content = generateObsidianMarkdown(
      favoriteQuestions,
      chapterNameById,
    );
    const date = new Date().toISOString().slice(0, 10);
    downloadMarkdownFile(content, `数学收藏题库_${date}.md`);
  };

  const renderTreeNode = (
    node: ChapterTreeNode,
    depth = 0,
  ): React.ReactNode => {
    const expanded = expandedIds[node.id] ?? false;
    const isActive = node.selectable && chapterId === node.id;

    return (
      <li key={node.id} className="tree-item">
        <button
          type="button"
          className={`tree-button ${node.isLeaf ? "leaf" : "branch"} ${isActive ? "active" : ""}`}
          style={{ paddingLeft: `${depth * 14 + 10}px` }}
          onClick={() => {
            if (node.isLeaf && node.selectable) {
              setViewMode("chapter");
              setChapterId(node.id);
              setPageIndex(0);
              setError("");
              return;
            }
            toggleTreeNode(node.id);
          }}
        >
          {!node.isLeaf && (
            <span className="tree-arrow">{expanded ? "▾" : "▸"}</span>
          )}
          {node.isLeaf && <span className="tree-dot">•</span>}
          <span className="tree-label">{node.name}</span>
          <span className="tree-count">{node.count}</span>
        </button>

        {!node.isLeaf && expanded && (
          <ul className="tree-list">
            {node.children.map((child) => renderTreeNode(child, depth + 1))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <div className="app-shell">
      <header className="hero">
        <p className="kicker">mathreact 练习站</p>
        <h1>{pageTitle}</h1>
        <p className="sub">
          章节覆盖以目录树叶子节点为准，数据来自本地题库文件。
        </p>
      </header>

      <main className="layout">
        <section className="panel settings-panel">
          <h2>练习设置</h2>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={allAnalysisOpen}
              onChange={(e) => setAllAnalysisOpen(e.target.checked)}
              disabled={displayQuestions.length === 0}
            />
            <span>解析全部展开</span>
          </label>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={allAnswerOpen}
              onChange={(e) => setAllAnswerOpen(e.target.checked)}
              disabled={displayQuestions.length === 0}
            />
            <span>展开答案</span>
          </label>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={themeMode === "dark"}
              onChange={(e) =>
                setThemeMode(e.target.checked ? "dark" : "light")
              }
            />
            <span>暗夜模式</span>
          </label>

          <div className="field">
            <span>题目排序方式</span>
            <select
              className="sort-select"
              value={sortMode}
              onChange={(e) => {
                setSortMode(e.target.value as SortMode);
                setPageIndex(0);
              }}
            >
              <option value="default">默认顺序</option>
              <option value="accuracy-asc">正确率：从低到高</option>
              <option value="difficulty-desc">难度：从高到低</option>
              <option value="difficulty-asc">难度：从低到高</option>
            </select>
          </div>

          <div className="field">
            <span>难题等级筛选（勾选后只显示对应题目）</span>
            <div className="hard-filter-grid">
              {HARD_TAG_ORDER.map((tag) => {
                const meta = HARD_TAG_META[tag];

                return (
                  <label
                    key={tag}
                    className={`hard-filter-item ${selectedHardTags[tag] ? "active" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedHardTags[tag]}
                      onChange={(e) => {
                        setSelectedHardTags((prev) => ({
                          ...prev,
                          [tag]: e.target.checked,
                        }));
                        setPageIndex(0);
                      }}
                    />
                    <span>{meta.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="folder-switch">
            <button
              type="button"
              className={`folder-btn ${viewMode === "chapter" ? "active" : ""}`}
              onClick={() => {
                setViewMode("chapter");
                setPageIndex(0);
                setError("");
              }}
            >
              章节题库
            </button>
            <button
              type="button"
              className={`folder-btn ${viewMode === "favorites" ? "active" : ""}`}
              onClick={() => {
                setViewMode("favorites");
                setPageIndex(0);
                setError("");
              }}
            >
              收藏题夹
            </button>
          </div>

          <div className="field">
            <span>选择章节（树形目录，默认收起）</span>
            <div className="chapter-tree-wrap">
              {chapterTree.length > 0 ? (
                <ul className="tree-list">
                  {chapterTree.map((node) => renderTreeNode(node))}
                </ul>
              ) : (
                <p className="hint">章节目录加载中...</p>
              )}
            </div>
          </div>

          {viewMode === "favorites" && (
            <p className="folder-tip">
              收藏题夹会汇总不同章节的收藏题，统一刷题。
            </p>
          )}

          {viewMode === "chapter" && (
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={onlyFavorites}
                onChange={(e) => {
                  setOnlyFavorites(e.target.checked);
                  setPageIndex(0);
                }}
              />
              <span>只看收藏题</span>
            </label>
          )}

          <div className="chapter-meta">
            <div>可练章节：{chapters.length}</div>
            <div>当前题量：{questionSource.length}</div>
            <div>筛选后题量：{sortedQuestions.length}</div>
            <div>收藏总数：{favoriteTotal}</div>
            {viewMode === "chapter" && (
              <div>当前章节收藏：{favoritesInChapter}</div>
            )}
            <div>每页题量：{QUESTIONS_PER_PAGE}</div>
            {selectedChapterLabel && (
              <div>当前章节：{selectedChapterLabel}</div>
            )}
          </div>

          <button
            type="button"
            className="export-obsidian-btn"
            disabled={
              favoriteTotal === 0 || (exportPending && favoritesLoading)
            }
            onClick={handleExportToObsidian}
            title={
              favoriteTotal === 0
                ? "暂无收藏题目"
                : "将收藏题库导出为 Obsidian Markdown 文件"
            }
          >
            {exportPending && favoritesLoading
              ? "⏳ 加载中，请稍候..."
              : `📤 导出 Obsidian（${favoriteTotal} 题）`}
          </button>
        </section>

        <section className="panel question-panel">
          {(viewMode === "chapter" ? loading : favoritesLoading) && (
            <p className="hint">
              {viewMode === "chapter"
                ? "正在加载章节题目..."
                : "正在汇总收藏题夹..."}
            </p>
          )}
          {!!error && <p className="error">{error}</p>}

          {!(viewMode === "chapter" ? loading : favoritesLoading) &&
            !error &&
            pageQuestions.length > 0 && (
              <>
                <div className="page-toolbar">
                  <span className="badge">
                    第 {pageIndex + 1} / {totalPages} 页
                  </span>
                  <span className="badge subtle">
                    {viewMode === "favorites"
                      ? `收藏题夹本页 ${pageQuestions.length} 题`
                      : `本页 ${pageQuestions.length} 题，可上下滚动`}
                  </span>
                  <button
                    type="button"
                    onClick={() => movePage(-1)}
                    disabled={pageIndex === 0}
                  >
                    上一页
                  </button>
                  <button
                    type="button"
                    onClick={() => movePage(1)}
                    disabled={pageIndex === totalPages - 1}
                  >
                    下一页
                  </button>
                </div>

                <div className="question-list">
                  {pageQuestions.map((question, index) => {
                    const key = question.question_id;
                    const selectedChoice = selectedChoices[key] ?? "";
                    const hasSelected = selectedChoice !== "";
                    const isCorrect =
                      hasSelected && selectedChoice === question.answer;
                    const isAnalysisOpen =
                      allAnalysisOpen || analysisOpenMap[key] === true;
                    const isFavorite = favoriteMap[key] === true;
                    const correctAnswerLabel = getCorrectAnswerLabel(question);
                    const hardTags = getHardTags(question);
                    const chapterName =
                      chapterNameById.get(question.chapter_id) ??
                      `章节 ${question.chapter_id}`;
                    const globalNo = pageIndex * QUESTIONS_PER_PAGE + index + 1;
                    const useSingleColumnChoices = shouldUseSingleColumnChoices(
                      question.choices,
                    );

                    return (
                      <article key={key} className="question-card">
                        <div className="question-head">
                          <span className="question-index-circle">
                            {globalNo}
                          </span>
                          <div className="question-stats">
                            <span
                              className="stat-chip icon-chip accuracy-chip"
                              title="正确率"
                            >
                              {formatRate(question.accuracy_rate)}
                            </span>
                            <span
                              className="stat-chip icon-chip difficulty-chip"
                              title="难度分"
                            >
                              {formatDifficultyScore(question.difficulty_score)}
                            </span>
                            <span
                              className="stat-chip icon-chip time-chip"
                              title="平均用时"
                            >
                              {formatAvgTimeSpent(question.avg_time_spent)}
                            </span>
                            {hardTags.map((tag) => {
                              const meta = HARD_TAG_META[tag];
                              return (
                                <span
                                  key={`${key}-${tag}`}
                                  className={`stat-chip hard-tag-chip ${meta.chipClass}`}
                                >
                                  {meta.label}
                                </span>
                              );
                            })}
                            {question.tags && (
                              <span className="stat-chip hot-tag-chip">
                                {question.tags}
                              </span>
                            )}
                          </div>
                          {viewMode === "favorites" && (
                            <span className="badge chapter">
                              章节：{question.chapter_id} · {chapterName}
                            </span>
                          )}
                        </div>

                        <div className="question-body markdown-body">
                          <MarkdownMath text={question.question} />
                        </div>

                        <div
                          className={`choices ${useSingleColumnChoices ? "one-col" : "two-col"}`}
                        >
                          {question.choices.map((choice, choiceIndex) => {
                            const checked = selectedChoice === choice.choice_id;
                            const showRight =
                              checked && choice.choice_id === question.answer;
                            const showWrong =
                              checked && choice.choice_id !== question.answer;
                            const choiceLabel = getChoiceLabel(
                              choice.choice_id,
                              choiceIndex,
                            );

                            return (
                              <label
                                key={choice.choice_id}
                                className={`choice ${checked ? "selected" : ""} ${showRight ? "right" : ""} ${showWrong ? "wrong" : ""}`}
                              >
                                <input
                                  type="radio"
                                  name={`choice-${key}`}
                                  value={choice.choice_id}
                                  checked={checked}
                                  onChange={() =>
                                    setSelectedChoices((prev) => ({
                                      ...prev,
                                      [key]: choice.choice_id,
                                    }))
                                  }
                                />
                                <span className="choice-id">
                                  {choiceLabel}.
                                </span>
                                <span className="markdown-body">
                                  <MarkdownMath text={choice.choice} />
                                </span>
                              </label>
                            );
                          })}
                        </div>

                        <div className="toolbar">
                          <button
                            type="button"
                            className="analysis-toggle"
                            disabled={allAnalysisOpen}
                            onClick={() =>
                              setAnalysisOpenMap((prev) => ({
                                ...prev,
                                [key]: !prev[key],
                              }))
                            }
                          >
                            {allAnalysisOpen
                              ? "已全部展开"
                              : isAnalysisOpen
                                ? "收起解析"
                                : "展开解析"}
                          </button>
                          <button
                            type="button"
                            className={`favorite-toggle ${isFavorite ? "active" : ""}`}
                            onClick={() =>
                              setFavoriteMap((prev) => ({
                                ...prev,
                                [key]: !prev[key],
                              }))
                            }
                          >
                            {isFavorite ? "★ 已收藏" : "☆ 收藏"}
                          </button>
                        </div>

                        {hasSelected && (
                          <p className={`judge ${isCorrect ? "ok" : "bad"}`}>
                            {isCorrect ? "回答正确" : "回答错误"}
                          </p>
                        )}

                        {allAnswerOpen && (
                          <div className="answer-line markdown-body">
                            正确答案：
                            <MarkdownMath text={correctAnswerLabel} />
                          </div>
                        )}

                        {isAnalysisOpen && (
                          <section className="analysis markdown-body">
                            <h3>题目解析</h3>
                            <MarkdownMath
                              text={question.analysis || "暂无解析"}
                              isAnalysis={true}
                            />
                            {question.analysis_image && (
                              <div className="analysis-image-container">
                                <p className="image-hint">参考解析图：</p>
                                <img
                                  src={getFullImageUrl(question.analysis_image)}
                                  alt="解析图片"
                                  className="analysis-img"
                                  loading="lazy"
                                  onError={(e) => {
                                    (
                                      e.target as HTMLImageElement
                                    ).style.display = "none";
                                  }}
                                />
                                <a
                                  href={getFullImageUrl(
                                    question.analysis_image,
                                  )}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="image-link"
                                >
                                  查看原图
                                </a>
                              </div>
                            )}
                          </section>
                        )}
                      </article>
                    );
                  })}
                </div>

                <div className="page-toolbar bottom">
                  <span className="badge">
                    第 {pageIndex + 1} / {totalPages} 页
                  </span>
                  <button
                    type="button"
                    onClick={() => movePage(-1)}
                    disabled={pageIndex === 0}
                  >
                    上一页
                  </button>
                  <button
                    type="button"
                    onClick={() => movePage(1)}
                    disabled={pageIndex === totalPages - 1}
                  >
                    下一页
                  </button>
                </div>
              </>
            )}

          {!(viewMode === "chapter" ? loading : favoritesLoading) &&
            !error &&
            pageQuestions.length === 0 && (
              <p className="hint">
                {viewMode === "favorites"
                  ? "收藏题夹暂无题目，请先在题目中点击收藏。"
                  : "当前章节暂无可用题目。"}
              </p>
            )}
        </section>
      </main>
    </div>
  );
}

export default App;
