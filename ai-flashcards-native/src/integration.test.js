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

// ── 测试 4: 非提取方法仍然存在 ──────────────────────
console.log("\nTest 4: Non-extracted methods still exist...");
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
