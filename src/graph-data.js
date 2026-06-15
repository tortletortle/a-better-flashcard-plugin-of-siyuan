/**
 * ai-flashcards-native/src/graph-data.js
 *
 * 知识图谱数据处理层 —— 纯函数，无 DOM 依赖。
 * 负责概念提取、节点/边构建、AI prompt 生成、元数据规范化。
 */

// ── 停用词表 ──────────────────────────────────────────────

const STOP_WORDS = new Set([
  // 中文高频停用词
  "的", "了", "在", "是", "我", "有", "和", "就", "不", "人",
  "都", "一", "一个", "上", "也", "很", "到", "说", "要", "去",
  "你", "会", "着", "没有", "看", "好", "自己", "这", "他", "她",
  "什么", "怎么", "为什么", "如何", "哪些", "哪个", "怎样", "请问",
  "可以", "可以", "下列", "以下", "关于", "其中", "属于", "对于",
  "以及", "或者", "但是", "因为", "所以", "如果", "虽然", "而且",
  // 英文高频停用词
  "the", "a", "an", "is", "are", "was", "were", "be", "been",
  "being", "have", "has", "had", "do", "does", "did", "will",
  "would", "shall", "should", "may", "might", "must", "can",
  "could", "of", "in", "to", "for", "with", "on", "at", "by",
  "from", "as", "into", "about", "it", "its", "this", "that",
  "and", "or", "but", "not", "no", "if", "then", "else", "when",
]);

// ── 离线词频提取 ─────────────────────────────────────────

/**
 * 从文本中提取关键词（词频分析）。
 * 分词 → 过滤停用词 → 统计频率 → 返回 top-5。
 * @param {string} text
 * @returns {string[]}
 */
function extractKeywords(text) {
  if (!text || typeof text !== "string") return [];

  // 分词：中文 2-8 字连续 + 英文/数字 2+ 字符
  const tokens = text
    .toLowerCase()
    .match(/[\u4e00-\u9fa5]{2,8}|[a-zA-Z0-9_+\-]{2,}/g) || [];

  // 统计词频（过滤停用词和单字符）
  const freq = new Map();
  for (const token of tokens) {
    if (STOP_WORDS.has(token) || token.length < 2) continue;
    freq.set(token, (freq.get(token) || 0) + 1);
  }

  // 按频率降序，取 top 5
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
}

// ── 概念提取 ──────────────────────────────────────────────

/**
 * 从单张卡片提取主概念。
 * 优先使用 graphMeta 缓存（AI 分析结果），回退用词频分析。
 * @param {Object} card
 * @param {Object|null} graphMeta - 该卡片的 AI 元数据
 * @param {Function} cleanFn - 清洗函数
 * @returns {string}
 */
function conceptFromCard(card = {}, graphMeta, cleanFn) {
  if (graphMeta?.concepts?.length) {
    return String(graphMeta.concepts[0] || "未命名").slice(0, 18);
  }
  const clean = cleanFn || ((t) => String(t || ""));
  const text = clean(
    `${card.front || card.content || card.markdown || card.name || ""} ${card.back || ""}`,
  )
    .replace(/[？?].*$/s, "")
    .replace(
      /^(什么是|如何理解|怎样理解|为什么|请说明|说明|定义|定理|性质|例题)[:：\s]*/i,
      "",
    )
    .replace(/[，,。；;：:、\n\r\t]+/g, " ")
    .trim();

  // 用词频分析替代简单正则取第一个词
  const keywords = extractKeywords(text);
  return (keywords[0] || "未命名").slice(0, 16);
}

/**
 * 从卡片提取 1-3 个去重概念。
 * @param {Object} card
 * @param {Object|null} graphMeta
 * @param {Function} cleanFn
 * @returns {string[]}
 */
function graphCardConcepts(card = {}, graphMeta, cleanFn) {
  const concepts = Array.isArray(graphMeta?.concepts)
    ? graphMeta.concepts
    : [conceptFromCard(card, graphMeta, cleanFn)];
  return [
    ...new Set(
      concepts.map((item) => String(item || "").trim()).filter(Boolean),
    ),
  ].slice(0, 3);
}

/**
 * 从概念列表生成相邻关系对。
 * @param {string[]} concepts
 * @returns {Array<[string, string, string]>}
 */
function graphRelationPairs(concepts) {
  const result = [];
  for (let i = 0; i < concepts.length - 1; i++) {
    result.push([concepts[i], concepts[i + 1], "related"]);
  }
  return result;
}

// ── 图谱数据构建 ──────────────────────────────────────────

/**
 * 构建知识图谱数据（节点 + 边）。
 * @param {Object[]} cards
 * @param {Object} options
 * @param {Object} [options.graphMeta] - blockID → meta 映射
 * @param {boolean} [options.graphWeakOnly] - 只显示薄弱
 * @param {number} [options.limit] - 最大卡片数
 * @param {Function} [options.cardMastery] - (card) => mastery string
 * @param {Function} [options.masteryScore] - (mastery) => number
 * @param {Function} [options.clean] - 清洗函数
 * @returns {{ nodes: Object[], links: Object[], conceptCount: number, cardCount: number }}
 */
function buildGraphData(cards, options = {}) {
  const {
    graphMeta = {},
    graphWeakOnly = false,
    limit = 80,
    cardMastery = () => "unknown",
    masteryScore = () => 1,
    clean = (t) => String(t || ""),
  } = options;

  const conceptMap = new Map();
  const linkWeights = new Map();

  cards.slice(0, limit).forEach((card) => {
    const mastery = cardMastery(card);
    const meta = card.blockID ? graphMeta?.[card.blockID] : null;
    const concepts = graphCardConcepts(card, meta, clean);
    concepts.forEach((concept) => {
      if (!conceptMap.has(concept)) {
        conceptMap.set(concept, []);
      }
      conceptMap.get(concept).push({ card, mastery });
    });
    graphRelationPairs(concepts).forEach(([from, to, type]) => {
      const key = [from, to].sort().join("→");
      const current = linkWeights.get(key) || { from, to, type, weight: 0 };
      current.weight += 1;
      linkWeights.set(key, current);
    });
  });

  const conceptNodes = [...conceptMap.entries()]
    .map(([name, items]) => {
      const avg =
        items.reduce((sum, item) => sum + masteryScore(item.mastery), 0) /
        Math.max(items.length, 1);
      const mastery = avg < 0.75 ? "weak" : avg > 1.45 ? "good" : "mid";
      return {
        id: `concept-${name}`,
        type: "concept",
        label: name,
        mastery,
        count: items.length,
        cards: items.map((item) => item.card),
      };
    })
    .filter(
      (node) =>
        !graphWeakOnly ||
        node.mastery === "weak" ||
        node.mastery === "mid",
    );

  const visible = new Set(conceptNodes.map((node) => node.label));
  const links = [...linkWeights.values()]
    .filter((link) => visible.has(link.from) && visible.has(link.to))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, Math.max(20, conceptNodes.length * 2))
    .map((link) => ({
      from: `concept-${link.from}`,
      to: `concept-${link.to}`,
      type: link.type,
      weight: link.weight,
    }));

  return {
    nodes: conceptNodes,
    links,
    conceptCount: conceptNodes.length,
    cardCount: cards.length,
  };
}

/**
 * 构建卡片级节点（用于卡片视图）。
 * @param {Object[]} cards
 * @param {Object} options
 * @returns {Object[]}
 */
function buildGraphCardNodes(cards, options = {}) {
  const {
    limit = 80,
    cardMastery = () => "unknown",
    conceptFn = () => "未命名",
    clean = (t) => String(t || ""),
  } = options;

  return cards.slice(0, limit).map((card, index) => {
    const mastery = cardMastery(card);
    const concept = conceptFn(card);
    return {
      id: `card-${card.blockID || index}`,
      type: "card",
      label: clean(card.front || "原生闪卡").slice(0, 24),
      mastery,
      blockID: card.blockID || "",
      concept,
      card,
    };
  });
}

// ── AI 元数据处理 ──────────────────────────────────────────

/**
 * 规范化 AI 返回的图谱元数据。
 * @param {Object[]} results - AI 返回的 JSON 数组
 * @param {Object[]} cards - 原始卡片列表
 * @returns {Object[]}
 */
function normalizeGraphMeta(results, cards) {
  const ids = new Set(cards.map((card) => card.blockID).filter(Boolean));
  return (Array.isArray(results) ? results : [])
    .map((item) => ({
      blockID: String(item?.blockID || item?.blockId || "").trim(),
      chapter: String(item?.chapter || "").trim(),
      concepts: Array.isArray(item?.concepts) ? item.concepts : [],
      prerequisites: Array.isArray(item?.prerequisites)
        ? item.prerequisites
        : [],
      confusableWith: Array.isArray(item?.confusableWith)
        ? item.confusableWith
        : [],
      difficulty: String(item?.difficulty || "").trim(),
    }))
    .filter((item) => ids.has(item.blockID))
    .map((item) => ({
      ...item,
      concepts: [
        ...new Set(
          item.concepts
            .map((v) => String(v || "").trim())
            .filter(Boolean),
        ),
      ].slice(0, 3),
      prerequisites: [
        ...new Set(
          item.prerequisites
            .map((v) => String(v || "").trim())
            .filter(Boolean),
        ),
      ].slice(0, 3),
      confusableWith: [
        ...new Set(
          item.confusableWith
            .map((v) => String(v || "").trim())
            .filter(Boolean),
        ),
      ].slice(0, 3),
    }));
}

/**
 * 生成 AI 分析图谱的 prompt。
 * @param {Object[]} cards
 * @param {Function} cleanFn
 * @returns {string}
 */
function graphAnalyzePrompt(cards, cleanFn) {
  const clean = cleanFn || ((t) => String(t || ""));
  return `请为这些闪卡抽取知识图谱标签。要求：
1. concepts 是规范化知识点名称，最多 3 个，避免"什么是/为什么/如何"等题干词。
2. chapter 是更高层主题或章节。
3. prerequisites 是前置知识点，最多 3 个。
4. confusableWith 是易混知识点，最多 3 个。
5. 不确定就留空数组，不要编造。
只输出 JSON 数组。

闪卡：
${cards
  .map(
    (card, index) => `${index + 1}. blockID=${card.blockID || ""}
front=${clean(card.front || "").slice(0, 180)}
back=${clean(card.back || "").slice(0, 220)}`,
  )
  .join("\n\n")}

格式：
[{"blockID":"...","chapter":"...","concepts":["..."],"prerequisites":["..."],"confusableWith":["..."],"difficulty":"基础|中等|困难"}]`;
}

// ── 导出 ──────────────────────────────────────────────────

module.exports = {
  STOP_WORDS,
  extractKeywords,
  conceptFromCard,
  graphCardConcepts,
  graphRelationPairs,
  buildGraphData,
  buildGraphCardNodes,
  normalizeGraphMeta,
  graphAnalyzePrompt,
};
