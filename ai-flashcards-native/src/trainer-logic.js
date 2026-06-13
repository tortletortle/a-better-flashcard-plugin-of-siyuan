/**
 * 训练舱纯逻辑模块 (Trainer Logic)
 *
 * 从 index.js 提取的纯函数和简单重构函数。
 * 不包含 DOM 渲染、状态保存、异步 API 调用等副作用。
 */

const { normalizeCardText } = require("./utils");

// ─── 常量 ──────────────────────────────────────────────

const TRAINER_TOPICS = {
  斜面: {
    type: "公式型 / 解题型",
    question: "你想先解决哪一类困难？",
    options: ["看懂受力图", "记住 mg sinθ / mg cosθ", "掌握解题步骤", "避免常见错误"],
    note: "斜面问题的核心，是把重力分解到沿斜面和垂直斜面两个方向，再分别列方程。",
    cards: [
      {
        type: "概念卡",
        front: "斜面受力分析的核心动作是什么？",
        back: "把重力分解为沿斜面方向和垂直斜面方向两个分量。",
      },
      {
        type: "公式卡",
        front: "倾角为 θ 的斜面上，重力沿斜面向下的分量是多少？",
        back: "mg sinθ。垂直斜面方向的分量是 mg cosθ。",
      },
      {
        type: "易错卡",
        front: "斜面受力分析中为什么容易把 sinθ 和 cosθ 搞反？",
        back: "因为 θ 通常对应重力与垂直斜面方向之间的夹角，不是重力与斜面方向之间的夹角。",
      },
    ],
  },
  导数: {
    type: "概念型 / 应用型",
    question: "你更想训练哪一部分？",
    options: ["理解导数含义", "判断函数单调性", "找极值点", "处理含参数题"],
    note: "导数用于描述函数变化率。判断单调性时，关键是研究 f'(x) 的正负。",
    cards: [
      {
        type: "概念卡",
        front: "导数在直观上表示什么？",
        back: "表示函数在某一点附近的瞬时变化率，也可以理解为切线斜率。",
      },
      {
        type: "步骤卡",
        front: "用导数判断函数单调性的基本步骤是什么？",
        back: "求定义域，求 f'(x)，判断 f'(x) 的正负，再写出单调区间。",
      },
      {
        type: "易错卡",
        front: "用导数判断单调性时常见错误是什么？",
        back: "忽略定义域，或者只找 f'(x)=0 的点却不判断导数符号变化。",
      },
    ],
  },
  电容: {
    type: "公式型 / 过程型",
    question: "你想重点理解什么？",
    options: ["电容定义", "充放电过程", "能量公式", "电路题步骤"],
    note: "电容器的核心是储存电荷和电场能量，充放电过程体现电压、电流随时间变化。",
    cards: [
      {
        type: "公式卡",
        front: "电容的定义式是什么？",
        back: "C = Q / U，表示单位电压下能储存多少电荷。",
      },
      {
        type: "概念卡",
        front: "为什么电容器充电时电流会逐渐变小？",
        back: "因为电容两端电压逐渐升高，电源与电容之间的电压差变小，推动电荷流动的作用减弱。",
      },
      {
        type: "易错卡",
        front: "电容题中常见的误区是什么？",
        back: "把电容 C 当成会随 Q 或 U 任意变化；对固定电容器，C 由结构和介质决定。",
      },
    ],
  },
};

// ─── 状态管理 ──────────────────────────────────────────

function defaultTrainerState() {
  return {
    topic: "斜面上物体的受力分析",
    angle: "看懂受力图",
    depth: "日常理解",
    current: null,
    drafts: [],
    accepted: [],
    discarded: 0,
    activeDraftIndex: null,
    mobileView: "input",
    apiStatus: "使用主插件 AI 设置",
    tuneProgress: null,
    writeStatus: "尚未写入思源文档",
    workbenchStatus: "尚未加入当前原生卡包",
    analyzing: false,
    debugVisible: true,
    debugLastAIShape: null,
    debugLog: [],
    debugLastAction: "初始化",
  };
}

function normalizeTrainerState(trainer) {
  const next = trainer && typeof trainer === "object" ? trainer : {};
  const defaults = defaultTrainerState();
  const normalized = {
    ...defaults,
    ...next,
    drafts: Array.isArray(next.drafts) ? next.drafts : [],
    accepted: Array.isArray(next.accepted) ? next.accepted : [],
    discarded: Number.isFinite(Number(next.discarded))
      ? Number(next.discarded)
      : 0,
    activeDraftIndex: Number.isInteger(next.activeDraftIndex)
      ? next.activeDraftIndex
      : null,
    mobileView: ["input", "drafts", "library"].includes(next.mobileView)
      ? next.mobileView
      : defaults.mobileView,
    apiStatus: String(next.apiStatus || defaults.apiStatus),
    writeStatus: String(next.writeStatus || defaults.writeStatus),
    workbenchStatus: String(
      next.workbenchStatus || defaults.workbenchStatus,
    ),
    tuneProgress:
      next.tuneProgress && typeof next.tuneProgress === "object"
        ? next.tuneProgress
        : null,
    analyzing: Boolean(next.analyzing),
    debugVisible: next.debugVisible !== false,
    debugLastAIShape:
      next.debugLastAIShape && typeof next.debugLastAIShape === "object"
        ? next.debugLastAIShape
        : null,
    debugLog: Array.isArray(next.debugLog)
      ? next.debugLog.map((item) => String(item || "")).filter(Boolean).slice(0, 12)
      : [],
    debugLastAction: String(next.debugLastAction || defaults.debugLastAction),
  };
  if (trainer && typeof trainer === "object") {
    Object.assign(trainer, normalized);
    return trainer;
  }
  return normalized;
}

// ─── 文本工具 ─────────────────────────────────────────

function trainerFirstText(source, keys) {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return "";
}

function trainerExtractJsonCandidate(text) {
  const raw = String(text || "").trim();
  if (!raw) return "";
  const directStart = raw.search(/[\[{]/);
  if (directStart < 0) return raw;
  const open = raw[directStart];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = directStart; index < raw.length; index += 1) {
    const char = raw[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === open) depth += 1;
    if (char === close) depth -= 1;
    if (depth === 0) return raw.slice(directStart, index + 1);
  }
  return raw.slice(directStart);
}

function trainerParseAIContent(content) {
  const cleaned = String(content || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  if (!cleaned) {
    throw Error("AI 文本为空");
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    return JSON.parse(trainerExtractJsonCandidate(cleaned));
  }
}

// ─── 卡片规范化 ────────────────────────────────────────

function trainerNormalizeAICard(card, index = 0) {
  if (!card) return null;
  if (typeof card === "string") {
    const parts = card.split(/\n+/).map((item) => item.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return {
        type: "概念卡",
        front: normalizeCardText(parts[0]),
        back: normalizeCardText(parts.slice(1).join("\n")),
      };
    }
    return null;
  }
  const front = trainerFirstText(card, [
    "front", "question", "q", "prompt",
    "title", "term", "key", "name",
  ]);
  const back = trainerFirstText(card, [
    "back", "answer", "a", "explanation",
    "content", "detail", "definition", "value", "body",
  ]);
  if (!front || !back) {
    return null;
  }
  return {
    type: trainerFirstText(card, ["type", "cardType", "kind", "category"]) || `卡片 ${index + 1}`,
    front: normalizeCardText(front),
    back: normalizeCardText(back),
  };
}

function trainerAIShape(value, cardsSource = []) {
  const data = value && typeof value === "object" ? value : {};
  const firstCard = cardsSource[0];
  return {
    valueType: Array.isArray(value) ? "array" : typeof value,
    keys: Array.isArray(value) ? ["<array>"] : Object.keys(data).slice(0, 12),
    cardCount: cardsSource.length,
    firstCardType: Array.isArray(firstCard) ? "array" : typeof firstCard,
    firstCardKeys:
      firstCard && typeof firstCard === "object" && !Array.isArray(firstCard)
        ? Object.keys(firstCard).slice(0, 12)
        : [],
  };
}

function trainerNormalizeAnalysis(value, fallbackTopic, depth, trainer) {
  const data = value && typeof value === "object" ? value : {};
  const cardsSource = Array.isArray(data)
    ? data
    : Array.isArray(data.cards)
      ? data.cards
      : Array.isArray(data.flashcards)
        ? data.flashcards
        : Array.isArray(data.items)
          ? data.items
          : Array.isArray(data.questions)
            ? data.questions
            : [];
  if (trainer && typeof trainer === "object") {
    trainer.debugLastAIShape = trainerAIShape(value, cardsSource);
  }
  if (!cardsSource.length) {
    throw Error("AI 未返回卡片");
  }
  const cards = cardsSource
    .map((card, index) => trainerNormalizeAICard(card, index))
    .filter(Boolean)
    .slice(0, 5);
  if (!cards.length) {
    throw Error("AI 返回了卡片数组，但缺少可识别的题面/答案字段");
  }
  return {
    topic: data.topic || data.title || fallbackTopic,
    depth,
    type: data.type || data.category || "概念型 / 公式型 / 应用型",
    question: data.question || data.prompt || "你想先理解哪一层？",
    options:
      Array.isArray(data.options) && data.options.length
        ? data.options.slice(0, 5).map((item) => String(item || "").trim()).filter(Boolean)
        : ["建立直觉", "理解公式", "适用条件", "易错点"],
    note: data.note || data.summary || data.description || `"${fallbackTopic}"的 AI 拆解结果。`,
    cards,
    source: "ai",
  };
}

function trainerNormalizeClassification(raw, fallbackCard) {
  const allowedDifficulty = ["easy", "medium", "hard"];
  const data = raw && typeof raw === "object" ? raw : {};
  const tags = Array.isArray(data.tags)
    ? data.tags.map(String).map((tag) => tag.trim()).filter(Boolean)
    : fallbackCard.tags || [];
  const prerequisites = Array.isArray(data.prerequisites)
    ? data.prerequisites.map(String).map((item) => item.trim()).filter(Boolean)
    : [];
  return {
    subject: String(data.subject || fallbackCard.subject || "未分类").trim(),
    domain: String(data.domain || fallbackCard.domain || "待整理").trim(),
    chapter: String(
      data.chapter || fallbackCard.chapter || fallbackCard.topic || "",
    ).trim(),
    knowledgeType: String(
      data.knowledgeType || fallbackCard.knowledgeType || "",
    ).trim(),
    cardType: String(data.cardType || fallbackCard.cardType || "概念卡").trim(),
    difficulty: allowedDifficulty.includes(data.difficulty)
      ? data.difficulty
      : fallbackCard.difficulty || "medium",
    tags: Array.from(new Set(tags)).slice(0, 8),
    prerequisites: Array.from(new Set(prerequisites)).slice(0, 8),
    examUse: String(data.examUse || fallbackCard.examUse || "").trim(),
  };
}

// ─── 分类应用 ──────────────────────────────────────────

function trainerApplyClassification(card, classification, source = "ai") {
  Object.assign(card, classification, {
    classifiedBy: source,
    classifiedAt: new Date().toISOString(),
  });
  if (!card.tags?.length) {
    card.tags = [card.topic, card.cardType].filter(Boolean);
  }
}

// ─── 离线分析 ──────────────────────────────────────────

function trainerAnalyze(topic, depth) {
  const key = Object.keys(TRAINER_TOPICS).find((item) => topic.includes(item));
  const preset = key ? TRAINER_TOPICS[key] : null;
  if (preset) {
    return { topic, depth, ...preset };
  }
  return {
    topic,
    depth,
    type: "概念型 / 解题型",
    question: "你希望 AI 先从哪个角度帮你拆解？",
    options: ["先讲直觉", "列出前置概念", "生成解题步骤", "指出易错点"],
    note: `"${topic}"可以先被拆成概念、公式/规则、步骤和易错点，再转成少量可复习卡片。`,
    cards: [
      {
        type: "概念卡",
        front: `${topic} 的核心问题是什么？`,
        back: `先用一句话说清 ${topic} 解决了什么问题，再补充适用条件。`,
      },
      {
        type: "步骤卡",
        front: `学习 ${topic} 时应该按什么顺序拆解？`,
        back: "先识别概念，再看公式或规则，最后用例题验证。",
      },
      {
        type: "易错卡",
        front: `学习 ${topic} 时为什么容易产生错觉？`,
        back: "因为只记结论不看条件，遇到变式题时容易套错规则。",
      },
    ],
  };
}

function trainerGenerateCards(analysis, angle, depth) {
  const cards = (analysis?.cards || []).map((card) => ({ ...card, status: "draft" }));
  if (String(angle || "").includes("步骤") || String(angle || "").includes("解题")) {
    cards.push({
      type: "步骤卡",
      front: `遇到"${analysis.topic}"相关题目时，第一步应该做什么？`,
      back: "先判断题目考的是概念、公式代入、过程分析还是变式迁移，避免直接套模板。",
      status: "draft",
    });
  }
  if (depth === "深入推导") {
    cards.push({
      type: "追问卡",
      front: `如果要深入理解"${analysis.topic}"，应该追问什么？`,
      back: "追问公式从哪里来、每个条件为什么必要、条件改变后结论是否还成立。",
      status: "draft",
    });
  }
  return cards.slice(0, 5);
}

// ─── Prompt 构建 ───────────────────────────────────────

function trainerBuildPrompt(topic, depth) {
  return `你是一个严格的理科知识制卡教练。请把用户输入的知识点拆成适合复习的结构化结果。\n要求：\n1. 只输出 JSON，不要 Markdown。\n2. 卡片少而精，3 到 5 张，一张卡只考一个点。\n3. 必须包含直觉、公式/规则、适用条件或易错点。\nJSON 结构：{"topic":"主题","type":"概念型 / 公式型 / 应用型","question":"你想先理解哪一层？","options":["建立直觉","理解公式","适用条件","易错点"],"note":"一句话拆解","cards":[{"type":"概念卡","front":"问题","back":"答案"}]}\n用户知识点：${topic}\n目标深度：${depth}`;
}

function trainerBuildRefinePrompt(current, action, angle = "") {
  const actionText = {
    easy: "用户觉得太难。请用更简单、更直觉的方式重写，减少抽象术语，保留必要公式。",
    hard: "用户觉得太浅。请增加 1 到 2 张高质量追问卡，强调条件变化、推导来源或反例。",
    example: "用户想换个例子。请给出更具体的例子，并生成适合复习的例子卡。",
    rewrite: "用户标记需要重写。请重新拆解，修正空泛、条件缺失、卡片不可复习等问题。",
    angle: `用户选择新的学习角度："${angle}"。请围绕这个角度重组卡片。`,
  }[action];
  return `你是一个严格的理科知识制卡教练。下面是当前已有拆解，用户给了新的反馈。\n\n用户反馈：${actionText}\n\n当前拆解 JSON：\n${JSON.stringify(current)}\n\n要求：\n1. 只输出 JSON，不要 Markdown。\n2. 必须保持同一个主题：${current.topic}。\n3. 输出 3 到 5 张卡，一张卡只考一个点。\n4. front 必须是明确问题，back 必须简洁可复习。\n5. 不要编造不存在的公式；不确定时写清条件。\n返回 JSON 结构：{"topic":"主题","type":"概念型 / 公式型 / 应用型","question":"你想先理解哪一层？","options":["建立直觉","理解公式","适用条件","易错点"],"note":"一句话拆解","cards":[{"type":"概念卡","front":"问题","back":"答案"}]}`;
}

function trainerBuildClassifyPrompt(card) {
  return `你是一个理科知识卡片分类器。请根据卡片内容，为未来检索、复习、思源/Anki 导出生成结构化元数据。\n要求：\n1. 只输出 JSON，不要 Markdown。\n2. 分类要保守、准确；不确定时使用较宽泛类别。\n3. tags 适合做复习标签，3 到 8 个。\n4. difficulty 只能是 easy、medium、hard。\n返回 JSON 结构：{"subject":"数学/物理/化学/生物/计算机/未分类","domain":"更具体的领域","chapter":"具体章节或知识簇","knowledgeType":"概念/公式/条件/步骤/易错/推导/应用","cardType":"卡片类型","difficulty":"easy|medium|hard","tags":["标签1","标签2"],"prerequisites":["前置概念1"],"examUse":"这张卡在解题或理解中的用途"}\n卡片 JSON：\n${JSON.stringify(card)}`;
}

// ─── 错误诊断 ──────────────────────────────────────────

function trainerDiagnoseAIError(error, modelName) {
  const message = String(error?.message || error || "未知错误");
  const body = String(error?.body || "");
  const combined = `${message}\n${body}`.toLowerCase();
  const detail = body.replace(/\s+/g, " ").trim().slice(0, 180);
  const suffix = detail ? `（接口返回：${detail}）` : "";
  if (/api key|apikey|authorization|unauthorized|401/.test(combined)) {
    return `API Key 无效或未填写，请检查密钥和 Authorization 权限${suffix}`;
  }
  if (/403|forbidden|permission|access denied/.test(combined)) {
    return `账号没有访问该模型或接口的权限，请检查模型权限${suffix}`;
  }
  if (/402|quota|balance|insufficient|billing|credit/.test(combined)) {
    return `账号额度或余额不足，请检查充值、额度和计费状态${suffix}`;
  }
  if (/429|rate limit|too many requests/.test(combined)) {
    return `请求过于频繁或达到限流，请稍后重试${suffix}`;
  }
  if (/404|not found/.test(combined)) {
    return `接口地址或模型不存在，请检查 Base URL 是否正确，以及模型名是否正确${suffix}`;
  }
  if (/400|invalid_request|model|does not exist|unsupported/.test(combined)) {
    return `请求参数或模型名可能不被支持，请优先检查 model=${modelName || "未配置"}${suffix}`;
  }
  if (/failed to fetch|network|cors|load failed/.test(combined)) {
    return "网络请求失败，可能是网络不可达、CORS 被拦截，或插件环境不允许直接访问该接口";
  }
  if (/空响应|没有文本内容|empty|no text/.test(combined)) {
    return `接口返回为空或没有可解析文本，请检查模型名、额度、权限，或响应格式是否兼容${suffix}`;
  }
  if (/json|parse|unexpected token|not valid/.test(combined)) {
    return `接口响应不是有效 JSON，可能是代理地址、网关错误页或模型输出格式异常${suffix}`;
  }
  if (/timeout|aborted/.test(combined)) {
    return "请求超时，请检查网络或稍后重试";
  }
  return `${message}${suffix}`;
}

// ─── 卡片规范化 ────────────────────────────────────────

function normalizeTrainerAcceptedCard(card, context = {}) {
  const topic = String(card?.topic || context.topic || "未命名主题").trim();
  const subject = String(card?.subject || "未分类").trim();
  return {
    id: String(card?.id || context.uid || `trainer-unknown`),
    topic,
    depth: String(card?.depth || context.depth || "日常理解"),
    subject,
    domain: String(card?.domain || "待整理").trim(),
    chapter: String(card?.chapter || "").trim(),
    knowledgeType: String(card?.knowledgeType || card?.type || "").trim(),
    cardType: String(card?.cardType || card?.type || "概念卡").trim(),
    difficulty: String(card?.difficulty || "medium").trim(),
    prerequisites: Array.isArray(card?.prerequisites)
      ? card.prerequisites.map((item) => String(item || "").trim()).filter(Boolean)
      : [],
    examUse: String(card?.examUse || "").trim(),
    front: normalizeCardText(card?.front),
    back: normalizeCardText(card?.back),
    angle: String(card?.angle || context.angle || "").trim(),
    tags: Array.isArray(card?.tags)
      ? [...new Set(card.tags.map((item) => String(item || "").trim()).filter(Boolean))]
      : [topic, subject, String(card?.cardType || card?.type || "概念卡").trim()].filter(Boolean),
    createdAt: String(card?.createdAt || new Date().toISOString()),
    status: "confirmed",
    classifiedBy: String(card?.classifiedBy || "rule").trim(),
    classifiedAt: String(card?.classifiedAt || "").trim(),
    classificationError: String(card?.classificationError || "").trim(),
  };
}

function trainerCreateAcceptedCard(card, trainer, uid) {
  const topic = trainer.current?.topic || trainer.topic || "未命名主题";
  const subject = /导数|函数|积分|级数|泰勒|傅里叶|格林/.test(topic)
    ? "数学"
    : /斜面|电容|力|电路|干涉/.test(topic)
      ? "物理"
      : "未分类";
  return normalizeTrainerAcceptedCard({
    id: `trainer-${uid}`,
    topic,
    depth: trainer.depth,
    subject,
    domain: subject === "数学" ? "高等数学" : subject === "物理" ? "物理基础" : "待整理",
    cardType: card.type,
    knowledgeType: card.type,
    difficulty: "medium",
    prerequisites: [],
    examUse: "",
    front: card.front,
    back: card.back,
    angle: trainer.angle,
    tags: [topic, trainer.angle, card.type, subject].filter(Boolean),
    createdAt: new Date().toISOString(),
    status: "confirmed",
  }, { topic, depth: trainer.depth, angle: trainer.angle });
}

// ─── 草稿索引管理 ──────────────────────────────────────

function trainerNormalizeActiveDraftIndex(trainer) {
  if (!Number.isInteger(trainer.activeDraftIndex)) return;
  if (!trainer.drafts.length) {
    trainer.activeDraftIndex = null;
    return;
  }
  trainer.activeDraftIndex = Math.min(
    Math.max(trainer.activeDraftIndex, 0),
    trainer.drafts.length - 1,
  );
}

function trainerFocusDraftAfterRemoval(trainer, removedIndex, emptyMobileView) {
  if (!trainer.drafts.length) {
    trainer.activeDraftIndex = null;
    trainer.mobileView = emptyMobileView;
    return;
  }
  trainer.mobileView = "drafts";
  if (!Number.isInteger(trainer.activeDraftIndex)) return;
  if (trainer.activeDraftIndex === removedIndex) {
    trainer.activeDraftIndex = Math.min(removedIndex, trainer.drafts.length - 1);
    return;
  }
  if (trainer.activeDraftIndex > removedIndex) {
    trainer.activeDraftIndex -= 1;
  }
}

// ─── 导出 ──────────────────────────────────────────────

module.exports = {
  TRAINER_TOPICS,
  defaultTrainerState,
  normalizeTrainerState,
  trainerFirstText,
  trainerExtractJsonCandidate,
  trainerParseAIContent,
  trainerNormalizeAICard,
  trainerAIShape,
  trainerNormalizeAnalysis,
  trainerNormalizeClassification,
  trainerApplyClassification,
  trainerAnalyze,
  trainerGenerateCards,
  trainerBuildPrompt,
  trainerBuildRefinePrompt,
  trainerBuildClassifyPrompt,
  trainerDiagnoseAIError,
  normalizeTrainerAcceptedCard,
  trainerCreateAcceptedCard,
  trainerNormalizeActiveDraftIndex,
  trainerFocusDraftAfterRemoval,
};
