/**
 * src/graph-data.js 单元测试
 * 运行: node src/graph-data.test.js
 */

const gd = require("./graph-data");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) { passed++; }
  else { failed++; console.error(`  ❌ FAIL: ${message}`); }
}

function assertEqual(actual, expected, message) {
  if (actual === expected) { passed++; }
  else { failed++; console.error(`  ❌ FAIL: ${message}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`); }
}

function assertDeepEqual(actual, expected, message) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) { passed++; }
  else { failed++; console.error(`  ❌ FAIL: ${message}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`); }
}

function group(name, fn) {
  console.log(`\n▸ ${name}`);
  fn();
}

// ── extractKeywords ────────────────────────────────────────

group("extractKeywords", () => {
  assertDeepEqual(gd.extractKeywords(""), [], "空字符串返回空数组");
  assertDeepEqual(gd.extractKeywords(null), [], "null返回空数组");
  assertDeepEqual(gd.extractKeywords(123), [], "非字符串返回空数组");

  const kw1 = gd.extractKeywords("牛顿第一定律 惯性定律 牛顿 力学");
  assert(kw1.length > 0, "中文文本返回关键词");
  assert(kw1.length <= 5, "最多返回5个");

  // 停用词过滤（需要空格分词，否则连续中文被当成一个token）
  const kw2 = gd.extractKeywords("的 了 在 是 我 有 和 就 不 人");
  assertDeepEqual(kw2, [], "全是停用词返回空");

  // 频率排序
  const kw3 = gd.extractKeywords("数组 数组 数组 链表 链表 栈");
  assert(kw3[0] === "数组", "频率最高的排第一");

  // 英文
  const kw4 = gd.extractKeywords("array array array linked list stack");
  assert(kw4.length > 0, "英文文本也返回关键词");
  assert(kw4[0] === "array", "英文频率最高排第一");
});

// ── conceptFromCard ────────────────────────────────────────

group("conceptFromCard", () => {
  const clean = (t) => String(t || "").replace(/<[^>]*>/g, "");

  // 优先 graphMeta
  const meta = { concepts: ["牛顿力学", "惯性"] };
  assertEqual(
    gd.conceptFromCard({ front: "什么是牛顿第一定律？" }, meta, clean),
    "牛顿力学",
    "优先返回 graphMeta concepts[0]",
  );

  // graphMeta 空时回退
  const result = gd.conceptFromCard({ front: "牛顿第一定律是什么", back: "惯性定律" }, null, clean);
  assert(typeof result === "string", "无 meta 返回字符串");
  assert(result.length > 0, "非空");
  assert(result.length <= 16, "长度不超过16");

  // 空卡片
  assertEqual(gd.conceptFromCard({}, null, clean), "未命名", "空卡片返回未命名");

  // meta.concepts 为空数组
  const r2 = gd.conceptFromCard({ front: "测试卡片" }, { concepts: [] }, clean);
  assert(typeof r2 === "string" && r2.length > 0, "空 concepts 回退到词频");

  // 截断
  const longMeta = { concepts: ["这是一个非常非常长的概念名称超过了限制"] };
  const r3 = gd.conceptFromCard({}, longMeta, clean);
  assert(r3.length <= 18, "meta 概念也截断到18");
});

// ── graphCardConcepts ──────────────────────────────────────

group("graphCardConcepts", () => {
  const clean = (t) => String(t || "");

  // 使用 meta
  const meta = { concepts: ["力", "加速度", "质量"] };
  const r1 = gd.graphCardConcepts({}, meta, clean);
  assertDeepEqual(r1, ["力", "加速度", "质量"], "返回 meta 的三个概念");

  // 去重
  const meta2 = { concepts: ["力", "力", "质量"] };
  const r2 = gd.graphCardConcepts({}, meta2, clean);
  assertDeepEqual(r2, ["力", "质量"], "去重");

  // 截断到3
  const meta3 = { concepts: ["a", "b", "c", "d"] };
  const r3 = gd.graphCardConcepts({}, meta3, clean);
  assertEqual(r3.length, 3, "最多3个");

  // 无 meta 回退
  const r4 = gd.graphCardConcepts({ front: "测试" }, null, clean);
  assert(r4.length >= 1 && r4.length <= 3, "回退也返回1-3个");

  // 过滤空字符串
  const meta4 = { concepts: ["", "力", null, "质量"] };
  const r5 = gd.graphCardConcepts({}, meta4, clean);
  assert(r5.every(Boolean), "过滤空值");
});

// ── graphRelationPairs ─────────────────────────────────────

group("graphRelationPairs", () => {
  assertDeepEqual(gd.graphRelationPairs(["a"]), [], "单个概念无关系");
  assertDeepEqual(
    gd.graphRelationPairs(["a", "b"]),
    [["a", "b", "related"]],
    "两个概念产生一对",
  );
  assertDeepEqual(
    gd.graphRelationPairs(["a", "b", "c"]),
    [["a", "b", "related"], ["b", "c", "related"]],
    "三个概念产生两对",
  );
  assertDeepEqual(gd.graphRelationPairs([]), [], "空数组无关系");
});

// ── buildGraphData ─────────────────────────────────────────

group("buildGraphData", () => {
  const clean = (t) => String(t || "");
  const opts = {
    clean,
    cardMastery: () => "unknown",
    masteryScore: () => 1,
    graphMeta: {},
    limit: 80,
  };

  // 空输入
  const r1 = gd.buildGraphData([], opts);
  assertEqual(r1.nodes.length, 0, "空卡片无节点");
  assertEqual(r1.links.length, 0, "空卡片无边");
  assertEqual(r1.cardCount, 0, "cardCount=0");

  // 正常
  const cards = [
    { blockID: "b1", front: "牛顿力学第一定律", back: "惯性定律" },
    { blockID: "b2", front: "牛顿力学第二定律", back: "F=ma" },
  ];
  const r2 = gd.buildGraphData(cards, opts);
  assert(r2.nodes.length > 0, "有节点");
  assertEqual(r2.cardCount, 2, "cardCount=2");

  // limit 限制
  const manyCards = Array.from({ length: 100 }, (_, i) => ({
    blockID: `b${i}`, front: `卡片${i} 物理`, back: "内容",
  }));
  const r3 = gd.buildGraphData(manyCards, { ...opts, limit: 10 });
  assertEqual(r3.cardCount, 100, "cardCount 是总数");
  // 但只有前10张参与构建

  // weakOnly 过滤
  const weakOpts = {
    ...opts,
    graphWeakOnly: true,
    masteryScore: () => 0.5, // 全部 weak
  };
  const r4 = gd.buildGraphData(cards, weakOpts);
  assert(r4.nodes.every(n => n.mastery === "weak" || n.mastery === "mid"), "weakOnly 过滤");
});

// ── buildGraphCardNodes ────────────────────────────────────

group("buildGraphCardNodes", () => {
  const opts = {
    clean: (t) => String(t || ""),
    cardMastery: () => "good",
    conceptFn: () => "概念A",
    limit: 80,
  };

  const cards = [
    { blockID: "b1", front: "卡片一" },
    { blockID: "b2", front: "卡片二" },
  ];
  const r = gd.buildGraphCardNodes(cards, opts);
  assertEqual(r.length, 2, "两个卡片节点");
  assertEqual(r[0].type, "card", "type=card");
  assertEqual(r[0].blockID, "b1", "blockID 正确");
  assertEqual(r[0].concept, "概念A", "conceptFn 被调用");

  // limit
  const many = Array.from({ length: 10 }, (_, i) => ({ blockID: `b${i}`, front: `卡${i}` }));
  const r2 = gd.buildGraphCardNodes(many, { ...opts, limit: 3 });
  assertEqual(r2.length, 3, "limit 截断");
});

// ── normalizeGraphMeta ─────────────────────────────────────

group("normalizeGraphMeta", () => {
  const cards = [{ blockID: "b1" }, { blockID: "b2" }];

  // 正常
  const r1 = gd.normalizeGraphMeta(
    [{ blockID: "b1", concepts: ["力", "质量"], chapter: "物理" }],
    cards,
  );
  assertEqual(r1.length, 1, "只返回匹配的");
  assertEqual(r1[0].blockID, "b1", "blockID 正确");
  assertDeepEqual(r1[0].concepts, ["力", "质量"], "concepts 保留");

  // 过滤无效 blockID
  const r2 = gd.normalizeGraphMeta(
    [{ blockID: "unknown", concepts: ["x"] }],
    cards,
  );
  assertEqual(r2.length, 0, "过滤不匹配的 blockID");

  // 去重
  const r3 = gd.normalizeGraphMeta(
    [{ blockID: "b1", concepts: ["力", "力", "质量"] }],
    cards,
  );
  assertDeepEqual(r3[0].concepts, ["力", "质量"], "概念去重");

  // 截断到3
  const r4 = gd.normalizeGraphMeta(
    [{ blockID: "b1", concepts: ["a", "b", "c", "d"] }],
    cards,
  );
  assertEqual(r4[0].concepts.length, 3, "概念截断到3");

  // 畸形输入
  const r5 = gd.normalizeGraphMeta(null, cards);
  assertDeepEqual(r5, [], "null 返回空数组");
  const r6 = gd.normalizeGraphMeta("bad", cards);
  assertDeepEqual(r6, [], "非数组返回空数组");

  // blockId 别名
  const r7 = gd.normalizeGraphMeta(
    [{ blockId: "b1", concepts: ["x"] }],
    cards,
  );
  assertEqual(r7.length, 1, "blockId 别名也能匹配");
});

// ── graphAnalyzePrompt ─────────────────────────────────────

group("graphAnalyzePrompt", () => {
  const clean = (t) => String(t || "");
  const cards = [
    { blockID: "b1", front: "问题1", back: "答案1" },
    { blockID: "b2", front: "问题2", back: "答案2" },
  ];
  const prompt = gd.graphAnalyzePrompt(cards, clean);
  assert(prompt.includes("blockID=b1"), "包含 blockID");
  assert(prompt.includes("JSON"), "包含 JSON 格式说明");
  assert(prompt.includes("concepts"), "包含 concepts 要求");
  assert(typeof prompt === "string" && prompt.length > 50, "prompt 足够长");
});

// ── STOP_WORDS ─────────────────────────────────────────────

group("STOP_WORDS", () => {
  assert(gd.STOP_WORDS instanceof Set, "是 Set");
  assert(gd.STOP_WORDS.size > 50, "包含 50+ 停用词");
  assert(gd.STOP_WORDS.has("的"), "包含中文停用词");
  assert(gd.STOP_WORDS.has("the"), "包含英文停用词");
});

// ── 总结 ───────────────────────────────────────────────────

console.log(`\n${"═".repeat(40)}`);
console.log(`graph-data.test.js: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
