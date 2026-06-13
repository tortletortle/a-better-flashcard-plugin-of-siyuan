/**
 * ai-flashcards-native/src/utils.js
 *
 * 纯工具函数集合 —— 不依赖插件实例 (this) 或思源运行时状态。
 * 从 index.js 中提取，方便单元测试和复用。
 */

// ── 基础工具 ───────────────────────────────────────────────

/** HTML 转义 */
function esc(s) {
  return String(s).replace(
    /[&<>"]/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
      })[c],
  );
}

/** 当前日期 YYYY-MM-DD */
function day() {
  return new Date().toISOString().slice(0, 10);
}

/** 简易唯一 ID */
function uid() {
  return Date.now() + "_" + Math.random().toString(16).slice(2);
}

/** 取第一个非空值 */
function firstDefined(...values) {
  return values.find(
    (value) => value !== undefined && value !== null && value !== "",
  );
}

/** 将多个候选值转为有限数字，否则返回 0 */
function numberFromApi(...values) {
  const value = firstDefined(...values);
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

// ── 时间解析 ───────────────────────────────────────────────

/** 将思源多种时间格式统一解析为毫秒时间戳 */
function parseTime(value) {
  if (!value) {
    return 0;
  }
  if (typeof value === "number") {
    return value > 1e12 ? value : value * 1000;
  }
  const text = String(value).trim();
  if (/^\d{14}$/.test(text)) {
    const year = Number(text.slice(0, 4));
    const month = Number(text.slice(4, 6)) - 1;
    const d = Number(text.slice(6, 8));
    const hour = Number(text.slice(8, 10));
    const minute = Number(text.slice(10, 12));
    const second = Number(text.slice(12, 14));
    return new Date(year, month, d, hour, minute, second).getTime();
  }
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** 卡片到期时间的人类可读文本 */
function dueText(card) {
  const dueAt = card.dueAt || Date.now();
  const diff = dueAt - Date.now();
  if (diff <= 0) {
    return "现在";
  }
  const minutes = Math.ceil(diff / 6e4);
  if (minutes < 60) {
    return `${minutes} 分钟后`;
  }
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) {
    return `${hours} 小时后`;
  }
  return `${Math.ceil(hours / 24)} 天后`;
}

// ── 卡片掌握度 ─────────────────────────────────────────────

/** 根据卡片状态返回掌握度等级 */
function cardMastery(card = {}) {
  const now = Date.now();
  const state = String(card.state ?? card.riffCard?.state ?? "");
  const dueAt = parseTime(
    card.due ||
      card.dueTime ||
      card.dueAt ||
      card.riffCard?.due ||
      card.riffCard?.dueTime,
  );
  const reps = Number(card.reps ?? card.riffCard?.reps ?? 0);
  const lapses = Number(card.lapses ?? card.riffCard?.lapses ?? 0);
  if (
    lapses > 0 ||
    (dueAt && dueAt < now - 864e5) ||
    ["1", "again", "forgot"].includes(state)
  ) {
    return "weak";
  }
  if (!dueAt && !reps && !state) {
    return "unknown";
  }
  if (
    (dueAt && dueAt <= now + 2 * 864e5) ||
    reps < 2 ||
    ["2", "hard", "new"].includes(state)
  ) {
    return "mid";
  }
  return "good";
}

/** 掌握度等级 → 数值 */
function masteryScore(level) {
  return { weak: 0, mid: 1, unknown: 1, good: 2 }[level] ?? 1;
}

/** 掌握度等级 → 中文标签 */
function masteryLabel(level) {
  return (
    { weak: "薄弱", mid: "中间", good: "熟悉", unknown: "未知" }[level] ||
    "未知"
  );
}

// ── Markdown / 文本处理 ────────────────────────────────────

/** 移除块属性中的 riff-decks 等自定义标记 */
function cleanBlockMarkdown(markdown) {
  return String(markdown || "")
    .replace(/\n?\{:\s+[^}]*id="[^"]+"[^}]*\}/g, "")
    .replace(/\n?\{:\s+[^}]*custom-riff-decks="[^"]+"[^}]*\}/g, "")
    .trim();
}

/** 清理文件名中的非法字符 */
function cleanFileName(name) {
  return (
    String(name || "未命名")
      .replace(/[\\/:*?"<>|#\[\]]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 48) || "未命名"
  );
}

/** 转义超级块标记，防止思源解析冲突 */
function safeMd(text) {
  return String(text || "")
    .replace(/^(\s*){{{/gm, "$1&#123;&#123;&#123;")
    .replace(/^(\s*)}}}/gm, "$1&#125;&#125;&#125;")
    .trim();
}

/** 递归提取思源 API 返回数据中的 block ID */
function extractID(data) {
  if (!data) {
    return "";
  }
  if (typeof data === "string") {
    return data;
  }
  if (Array.isArray(data)) {
    for (const item of data) {
      const id = extractID(item);
      if (id) {
        return id;
      }
    }
    return "";
  }
  return (
    data.id ||
    data.blockID ||
    extractID(data.doOperations) ||
    extractID(data.data) ||
    ""
  );
}

/** 使用思源内置 Lute 将 Markdown 转为 HTML，失败时降级为纯文本 */
function mdHTML(markdown) {
  const text = String(markdown || "").trim();
  if (!text) {
    return "";
  }
  try {
    const lute =
      typeof window !== "undefined"
        ? window.Lute?.New?.() || window.Lute
        : null;
    if (typeof lute?.Md2HTML === "function") {
      return lute.Md2HTML(text);
    }
    if (typeof lute?.Md2BlockDOM === "function") {
      return lute.Md2BlockDOM(text);
    }
  } catch (e) {
    console.warn("render markdown with Lute failed", e);
  }
  return `<p>${esc(text).replace(/\n/g, "<br>")}</p>`;
}

// ── 公式修复 ───────────────────────────────────────────────

/** 公式内部：还原被错误转义的 $ */
function repairMathSegment(math) {
  return String(math || "")
    .replace(/\\\$/g, "$")
    .trim();
}

/** 公式外普通文本：做 Markdown 反转义 */
function repairPlainText(text) {
  return String(text || "")
    .replace(/\\\$/g, "$")
    .replace(/\\_/g, "_")
    .replace(/\\\*/g, "*")
    .replace(/\\`/g, "`")
    .replace(/\\\{/g, "{")
    .replace(/\\\}/g, "}")
    .replace(/\\\^/g, "^");
}

/**
 * 规范化 LaTeX 公式定界符：
 * \\(…\\) → $…$，\\[…\\] → $$…$$
 * 并修复段落中的转义字符。
 */
function repairFormulaText(text) {
  let s = String(text || "").replace(/\r\n/g, "\n");

  // 第 1 步：定界符归一化
  s = s.replace(/\\{1,2}\[([\s\S]*?)\\{1,2}\]/g, (_, m) => `$$${m}$$`);
  s = s.replace(/\\{1,2}\(([\s\S]*?)\\{1,2}\)/g, (_, m) => `$${m}$`);

  // 第 2 步：兜底包裹漏了定界符的块级环境
  s = s.replace(
    /(^|[^$])(\\begin\{[a-zA-Z*]+\}[\s\S]*?\\end\{[a-zA-Z*]+\})(?!\$)/g,
    (match, pre, env) => `${pre}$$${env}$$`,
  );

  // 第 3 步：按 $$ 切块级公式段
  const out = [];
  let lastIndex = 0;
  const blockRe = /\$\$([\s\S]*?)\$\$/g;
  let bm;
  while ((bm = blockRe.exec(s)) !== null) {
    out.push({ type: "text", value: s.slice(lastIndex, bm.index) });
    out.push({ type: "block", value: bm[1] });
    lastIndex = blockRe.lastIndex;
  }
  out.push({ type: "text", value: s.slice(lastIndex) });

  // 第 4 步：文本段内再切行内公式
  const render = [];
  for (const seg of out) {
    if (seg.type === "block") {
      render.push(`$$\n${repairMathSegment(seg.value)}\n$$`);
      continue;
    }
    let txt = seg.value;
    let inlineLast = 0;
    const inlineRe = /\$([^$\n]+?)\$/g;
    let im;
    let buf = "";
    while ((im = inlineRe.exec(txt)) !== null) {
      buf += repairPlainText(txt.slice(inlineLast, im.index));
      buf += `$${repairMathSegment(im[1])}$`;
      inlineLast = inlineRe.lastIndex;
    }
    buf += repairPlainText(txt.slice(inlineLast));
    render.push(buf);
  }

  return render.join("").trim();
}

/** 对卡片文本做公式规范化 + trim */
function normalizeCardText(text) {
  return repairFormulaText(text).trim();
}

/** 规范化文本：公式修复 + 去除 Markdown 标记 */
function clean(text) {
  return normalizeCardText(text)
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s*[-+]\s+/gm, "")
    .replace(/^```[a-zA-Z0-9_-]*\n?/gm, "")
    .replace(/```$/gm, "")
    .trim();
}

/** 解析 AI 返回的 JSON 响应为卡片数组 */
function parse(data) {
  const content =
    data?.choices?.[0]?.message?.content ??
    data?.text ??
    data?.content ??
    data?.result ??
    data?.output ??
    data;
  const raw =
    typeof content === "string"
      ? content.replace(/```json|```/g, "").trim()
      : JSON.stringify(content);
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed)
    ? parsed
        .filter((item) => item.front && item.back)
        .map((item) => ({
          front: normalizeCardText(item.front),
          back: normalizeCardText(item.back),
        }))
    : [];
}

// ── 导出 ───────────────────────────────────────────────────

module.exports = {
  // 基础工具
  esc,
  day,
  uid,
  firstDefined,
  numberFromApi,
  // 时间
  parseTime,
  dueText,
  // 卡片掌握度
  cardMastery,
  masteryScore,
  masteryLabel,
  // Markdown / 文本
  cleanBlockMarkdown,
  cleanFileName,
  safeMd,
  extractID,
  mdHTML,
  // 公式修复
  repairMathSegment,
  repairPlainText,
  repairFormulaText,
  normalizeCardText,
  clean,
  parse,
};
