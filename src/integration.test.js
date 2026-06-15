/**
 * 集成测试：验证 index.js 加载 + 薄代理转发
 * 运行: node test/integration.test.js
 */

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual === expected) {
    passed++;
  } else {
    failed++;
    console.error(
      `  ❌ FAIL: ${message}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`,
    );
  }
}

// ── 测试 1: index.js 能否被加载 ──────────────────────
console.log("Test 1: index.js loads without error...");
let PluginClass;
try {
  // Mock window for _pluginDir line — point to actual plugin directory
  const path = require("path");
  const pluginDir = path.resolve(__dirname, "..");
  // workspaceDir = three levels up from plugin dir (siyuan/data/plugins/ai-flashcards-native → siyuan)
  const mockWorkspace = path.resolve(pluginDir, "..", "..", "..").replace(/\\/g, "/");
  if (typeof globalThis.window === "undefined") {
    globalThis.window = { siyuan: { config: { system: { workspaceDir: mockWorkspace } } } };
  }

  // Mock siyuan module so require() doesn't fail
  const Module = require("module");
  const originalResolve = Module._resolveFilename;
  Module._resolveFilename = function (request, parent, ...args) {
    if (request === "siyuan") {
      return "siyuan-mock";
    }
    return originalResolve.call(this, request, parent, ...args);
  };

  // Create mock siyuan module
  require.cache["siyuan-mock"] = {
    id: "siyuan-mock",
    filename: "siyuan-mock",
    loaded: true,
    exports: {
      Plugin: class MockPlugin {
        constructor() {}
        onload() {}
        onunload() {}
        saveData() {}
        loadData() {}
      },
      showMessage: () => {},
      getFrontend: () => "desktop",
      openTab: () => {},
      fetchSyncPost: async () => ({ code: 0, data: {} }),
      Constants: { QUICK_DECK_ID: "mock-id" },
    },
  };

  PluginClass = require("../index");
  Module._resolveFilename = originalResolve;

  assert(PluginClass !== undefined, "PluginClass is defined");
  assert(typeof PluginClass === "function", "PluginClass is a function (class)");
  console.log("  ✅ index.js loaded successfully");
} catch (e) {
  failed++;
  console.error(`  ❌ FAIL: index.js failed to load: ${e.message}`);
  console.error(e.stack);
}

// ── 测试 2: 薄代理方法存在且可调 ─────────────────────
console.log("\nTest 2: Thin wrapper methods exist...");
if (PluginClass) {
  const instance = new PluginClass({} /* mock Plugin context */);

  // 测试纯工具方法（薄代理）
  const methodsToCheck = [
    "esc",
    "day",
    "uid",
    "firstDefined",
    "numberFromApi",
    "parseTime",
    "dueText",
    "cardMastery",
    "masteryScore",
    "masteryLabel",
    "cleanBlockMarkdown",
    "cleanFileName",
    "safeMd",
    "extractID",
    "mdHTML",
    "repairMathSegment",
    "repairPlainText",
    "repairFormulaText",
    "normalizeCardText",
    "clean",
    "parse",
  ];

  for (const method of methodsToCheck) {
    assert(typeof instance[method] === "function", `${method} is a function`);
  }
}

// ── 测试 3: 薄代理返回正确值 ─────────────────────────
console.log("\nTest 3: Thin wrappers return correct values...");
if (PluginClass) {
  const p = new PluginClass({});

  // esc
  assertEqual(p.esc("<b>"), "&lt;b&gt;", "this.esc delegates correctly");

  // day
  assert(/^\d{4}-\d{2}-\d{2}$/.test(p.day()), "this.day() returns date");

  // uid
  assert(p.uid().includes("_"), "this.uid() generates ID");

  // firstDefined
  assertEqual(p.firstDefined(null, "x"), "x", "this.firstDefined works");

  // numberFromApi
  assertEqual(p.numberFromApi("5"), 5, "this.numberFromApi works");

  // parseTime
  assertEqual(p.parseTime(0), 0, "this.parseTime(0) works");
  assert(p.parseTime("20260101120000") > 0, "this.parseTime 14-digit works");

  // dueText
  assertEqual(p.dueText({ dueAt: Date.now() - 1 }), "现在", "this.dueText works");

  // cardMastery
  assertEqual(p.cardMastery({}), "unknown", "this.cardMastery works");

  // masteryScore
  assertEqual(p.masteryScore("good"), 2, "this.masteryScore works");

  // masteryLabel
  assertEqual(p.masteryLabel("weak"), "薄弱", "this.masteryLabel works");

  // cleanBlockMarkdown
  assertEqual(
    p.cleanBlockMarkdown('x\n{: id="a"}'),
    "x",
    "this.cleanBlockMarkdown works",
  );

  // cleanFileName
  assertEqual(p.cleanFileName("a/b"), "a b", "this.cleanFileName works");

  // safeMd
  assert(p.safeMd("{{{").includes("&#123;"), "this.safeMd works");

  // extractID
  assertEqual(p.extractID("abc"), "abc", "this.extractID works");
  assertEqual(p.extractID({ id: "z" }), "z", "this.extractID from object");

  // repairMathSegment
  assertEqual(p.repairMathSegment("a\\$b"), "a$b", "this.repairMathSegment works");

  // repairPlainText
  assertEqual(p.repairPlainText("a\\_b"), "a_b", "this.repairPlainText works");

  // repairFormulaText
  assertEqual(
    p.repairFormulaText("\\(x\\)"),
    "$x$",
    "this.repairFormulaText works",
  );

  // normalizeCardText
  assertEqual(p.normalizeCardText("  \\(a\\)  "), "$a$", "this.normalizeCardText works");

  // clean
  assertEqual(p.clean("# Hi"), "Hi", "this.clean works");

  // parse
  const cards = p.parse([{ front: "Q", back: "A" }]);
  assertEqual(cards.length, 1, "this.parse works");
  assertEqual(cards[0].front, "Q", "this.parse front correct");
}

// ── 测试 4: trainer 薄代理方法存在 ─────────────────
console.log("\nTest 4: Trainer thin wrapper methods exist...");
if (PluginClass) {
  const p = new PluginClass({});
  const trainerMethods = [
    "defaultTrainerState", "normalizeTrainerState", "trainer",
    "trainerDebug", "trainerAnalyze", "trainerGenerateCards",
    "trainerBuildPrompt", "trainerBuildRefinePrompt", "trainerBuildClassifyPrompt",
    "trainerExtractJsonCandidate", "trainerParseAIContent", "trainerFirstText",
    "trainerNormalizeAICard", "trainerAIShape", "trainerNormalizeAnalysis",
    "trainerNormalizeClassification", "trainerDiagnoseAIError",
    "normalizeTrainerAcceptedCard", "trainerCreateAcceptedCard",
    "trainerApplyClassification", "trainerNormalizeActiveDraftIndex",
    "trainerFocusDraftAfterRemoval",
  ];
  for (const m of trainerMethods) {
    assert(typeof p[m] === "function", `trainer method: ${m}`);
  }
}

// ── 测试 5: trainer 薄代理正确转发 ─────────────────
console.log("\nTest 5: Trainer thin wrappers delegate correctly...");
if (PluginClass) {
  const p = new PluginClass({});

  // defaultTrainerState
  const def = p.defaultTrainerState();
  assertEqual(def.topic, "斜面上物体的受力分析", "this.defaultTrainerState → tl");

  // normalizeTrainerState
  const norm = p.normalizeTrainerState(null);
  assertEqual(norm.topic, def.topic, "this.normalizeTrainerState → tl");

  // trainerAnalyze
  const an = p.trainerAnalyze("斜面", "日常理解");
  assertEqual(an.topic, "斜面", "this.trainerAnalyze → tl");
  assert(an.cards.length > 0, "preset cards exist");

  // trainerGenerateCards
  const gen = p.trainerGenerateCards({ cards: [] }, "理解", "日常理解");
  assertEqual(gen.length, 0, "this.trainerGenerateCards empty");

  // trainerBuildPrompt
  const bp = p.trainerBuildPrompt("导数", "日常理解");
  assert(bp.includes("导数"), "this.trainerBuildPrompt → tl");

  // trainerBuildClassifyPrompt
  const bcp = p.trainerBuildClassifyPrompt({ front: "Q" });
  assert(bcp.includes("分类器"), "this.trainerBuildClassifyPrompt → tl");

  // trainerExtractJsonCandidate
  assertEqual(p.trainerExtractJsonCandidate('{"a":1}'), '{"a":1}', "this.trainerExtractJsonCandidate → tl");

  // trainerParseAIContent
  const pa = p.trainerParseAIContent('{"topic":"test"}');
  assertEqual(pa.topic, "test", "this.trainerParseAIContent → tl");

  // trainerFirstText
  assertEqual(p.trainerFirstText({ front: "X" }, ["front"]), "X", "this.trainerFirstText → tl");

  // trainerNormalizeAICard
  const nc = p.trainerNormalizeAICard({ front: "Q", back: "A" });
  assertEqual(nc.front, "Q", "this.trainerNormalizeAICard → tl");

  // trainerAIShape
  const sh = p.trainerAIShape({}, []);
  assertEqual(sh.valueType, "object", "this.trainerAIShape → tl");

  // trainerNormalizeClassification
  const ncl = p.trainerNormalizeClassification({}, { cardType: "概念卡" });
  assertEqual(ncl.cardType, "概念卡", "this.trainerNormalizeClassification → tl");

  // trainerDiagnoseAIError
  const de = p.trainerDiagnoseAIError(new Error("401 Unauthorized"));
  assert(de.includes("API Key"), "this.trainerDiagnoseAIError → tl");

  // trainerApplyClassification
  const testCard = { front: "Q", topic: "T", cardType: "概念卡" };
  p.trainerApplyClassification(testCard, { subject: "数学" }, "ai");
  assertEqual(testCard.classifiedBy, "ai", "this.trainerApplyClassification → tl");
}

// ── 测试 4: 非提取方法仍然存在 ──────────────────────
console.log("\nTest 6: Non-extracted methods still exist...");
if (PluginClass) {
  const p = new PluginClass({});
  const preservedMethods = [
    "onload",
    "onunload",
    "normalize",
    "api",
    "riffDeckID",
    "quickDeckID",
    "isQuickDeckID",
    "card",
    "fixDay",
    "save",
    "grade",
    "offline",
    "prompt",
    "ai",
  ];

  for (const method of preservedMethods) {
    assert(typeof p[method] === "function", `preserved method: ${method}`);
  }
}

// ── 测试 7: 图谱薄代理方法存在 + 转发 ─────────────────
console.log("\nTest 7: Graph thin wrapper methods...");
if (PluginClass) {
  const p = new PluginClass({});
  p.state = { graphMeta: {} };

  // 方法存在
  const graphMethods = [
    "conceptFromCard", "graphCardConcepts", "graphRelationPairs",
    "buildGraphData", "buildGraphCardNodes", "graphCards",
    "graphAnalyzePrompt", "normalizeGraphMeta", "renderGraph",
    "renderGraphDetail", "analyzeGraphWithAI",
  ];
  for (const m of graphMethods) {
    assert(typeof p[m] === "function", `graph method: ${m}`);
  }

  // conceptFromCard 转发
  const c1 = p.conceptFromCard({ front: "牛顿第一定律是什么", back: "惯性定律" });
  assert(typeof c1 === "string" && c1.length > 0, "conceptFromCard returns string");

  // conceptFromCard 优先 meta
  p.state.graphMeta = { b1: { concepts: ["力学定律"] } };
  const c2 = p.conceptFromCard({ blockID: "b1", front: "test" });
  assertEqual(c2, "力学定律", "conceptFromCard uses graphMeta");

  // graphCardConcepts
  const gc = p.graphCardConcepts({ blockID: "b1", front: "test" });
  assert(Array.isArray(gc) && gc.length >= 1, "graphCardConcepts returns array");

  // graphRelationPairs
  const rp = p.graphRelationPairs(["力", "质量", "加速度"]);
  assertEqual(rp.length, 2, "graphRelationPairs returns 2 pairs");
  assertEqual(rp[0][2], "related", "relation type is 'related'");

  // buildGraphData
  const cards = [{ blockID: "b1", front: "力与运动", back: "F=ma" }];
  const gd = p.buildGraphData(cards);
  assert(gd.nodes.length > 0, "buildGraphData returns nodes");
  assert(typeof gd.conceptCount === "number", "buildGraphData has conceptCount");

  // normalizeGraphMeta
  const nm = p.normalizeGraphMeta(
    [{ blockID: "b1", concepts: ["力"] }],
    [{ blockID: "b1" }],
  );
  assertEqual(nm.length, 1, "normalizeGraphMeta returns 1");

  // graphAnalyzePrompt
  const prompt = p.graphAnalyzePrompt([{ blockID: "b1", front: "Q", back: "A" }]);
  assert(prompt.includes("JSON"), "graphAnalyzePrompt contains JSON");

  // graphCards 依赖 this.nativeCards/this.packCards
  p.nativeCards = [];
  p.state.cards = [];
  p.state.activePackId = "";
  const gcards = p.graphCards();
  assert(Array.isArray(gcards), "graphCards returns array");

  // graphRenderer 在 onload 中初始化为 null
  // 在 onload 之前是 undefined
  assert(p.graphRenderer == null, "graphRenderer is null/undefined before onload");
  assert(p.graphSearchQuery == null || p.graphSearchQuery === "", "graphSearchQuery is empty before onload");
}

// ── Test 8: Stats / Chart integration ───────────────────
console.log("\nTest 8: Stats / Chart integration...");
{
  const p = new PluginClass({});
  // def() 包含 reviewHistory
  const def = p.def();
  assert(Array.isArray(def.reviewHistory), "def().reviewHistory is array");
  assertEqual(def.reviewHistory.length, 0, "def().reviewHistory is empty");

  // normalize 处理 reviewHistory
  const s1 = p.normalize({});
  assert(Array.isArray(s1.reviewHistory), "normalize({}).reviewHistory is array");
  const s2 = p.normalize({ reviewHistory: [{ date: "2026-01-01", total: 5, good: 3, mid: 1, weak: 1 }] });
  assertEqual(s2.reviewHistory.length, 1, "normalize preserves reviewHistory");
  assertEqual(s2.reviewHistory[0].total, 5, "normalize preserves history data");

  // normalize 处理非数组
  const s3 = p.normalize({ reviewHistory: "bad" });
  assert(Array.isArray(s3.reviewHistory), "normalize fixes non-array reviewHistory");
  assertEqual(s3.reviewHistory.length, 0, "normalize resets to empty");

  // chart module 已导入
  assert(typeof p.renderStats === "function", "renderStats method exists");

  // chartCurveLayout 在 onload 之前是 null/undefined
  assert(p.chartCurveLayout == null, "chartCurveLayout is null/undefined before onload");
}

// ── Test 9: Public data API ───────────────────────────
console.log("\nTest 9: Public data API methods...");
{
  const p = new PluginClass({});
  p.state = p.normalize({
    packs: [{ id: "test", name: "测试卡包", cardCount: 5 }],
    activePackId: "test",
    cards: [
      { blockID: "b1", packId: "test", front: "Q1", back: "A1", reps: 5, lapses: 0, ease: 2.5, interval: 7, dueAt: Date.now() + 864e5 * 10 },
      { blockID: "b2", packId: "test", front: "Q2", back: "A2", reps: 1, lapses: 0, ease: 2.3, interval: 1, dueAt: Date.now() + 3600000 },
    ],
    reviewHistory: [
      { date: "2026-06-12", total: 5, good: 3, mid: 1, weak: 1 },
      { date: "2026-06-13", total: 8, good: 5, mid: 2, weak: 1 },
    ],
  });

  // exposePublicAPI
  p.exposePublicAPI();
  const api = globalThis.aiFlashcardsNativeAPI;
  assert(api != null, "globalThis.aiFlashcardsNativeAPI exists");

  // getPacks
  const packs = api.getPacks();
  assert(Array.isArray(packs), "getPacks returns array");
  assertEqual(packs.length, 1, "getPacks: 1 pack");
  assertEqual(packs[0].name, "测试卡包", "getPacks: pack name");

  // getCards
  const cards = api.getCards();
  assert(Array.isArray(cards), "getCards returns array");
  assertEqual(cards.length, 2, "getCards: 2 cards");
  assertEqual(cards[0].blockID, "b1", "getCards: first card blockID");
  assert(cards[0].mastery != null, "getCards: card has mastery");

  // getCards with specific packId
  const cardsEmpty = api.getCards("nonexistent");
  assertEqual(cardsEmpty.length, 0, "getCards: empty for unknown pack");

  // getReviewHistory
  const history = api.getReviewHistory();
  assert(Array.isArray(history), "getReviewHistory returns array");
  assertEqual(history.length, 2, "getReviewHistory: 2 entries");
  assertEqual(history[0].total, 5, "getReviewHistory: first entry total");

  const historyLimited = api.getReviewHistory(1);
  assertEqual(historyLimited.length, 1, "getReviewHistory(1): 1 entry");

  // getStats
  const stats = api.getStats();
  assert(stats != null, "getStats returns object");
  assertEqual(stats.totalCards, 2, "getStats: totalCards");
  assert(stats.good != null, "getStats: has good count");
  assert(stats.totalReviews != null, "getStats: has totalReviews");

  // getCardMastery
  assertEqual(api.getCardMastery("b1"), "good", "getCardMastery by blockID");
  assertEqual(api.getCardMastery("unknown-id"), "unknown", "getCardMastery unknown blockID");
  assertEqual(api.getCardMastery({ reps: 1, dueAt: Date.now() + 3600000, lapses: 0 }), "mid", "getCardMastery by card object");

  // getGraphData
  const graph = api.getGraphData();
  assert(graph != null, "getGraphData returns object");
  assert(Array.isArray(graph.nodes), "getGraphData: has nodes");
  assert(Array.isArray(graph.links), "getGraphData: has links");
}

// ── 汇总 ─────────────────────────────────────────────
console.log("\n" + "=".repeat(50));
console.log(
  `Integration Results: ${passed} passed, ${failed} failed, ${passed + failed} total`,
);
if (failed > 0) {
  console.error("\n❌ SOME INTEGRATION TESTS FAILED");
  process.exit(1);
} else {
  console.log("\n✅ ALL INTEGRATION TESTS PASSED");
}
