// ── 卡片库渲染模块测试 ──────────────────────────────────────────
const { mapNativeCards, mapLocalCards, buildMoveOptions, renderLibHTML } = require("./lib-render");

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error(`  ❌ FAIL: ${msg}`); } }
function assertEqual(a, b, msg) { if (a === b) passed++; else { failed++; console.error(`  ❌ FAIL: ${msg} (expected ${JSON.stringify(b)}, got ${JSON.stringify(a)})`); } }

// ── mapNativeCards ────────────────────────────────────────────
console.log("▸ mapNativeCards");
{
  const native = [
    { blockID: "b1", content: "原生内容1", markdown: "md1", name: "name1" },
    { blockID: "b2", content: "原生内容2", riffCard: { state: "review" }, due: "2026-07-01" },
    { blockID: "b3", content: "被覆盖" },
  ];
  const genMap = new Map([["b3", { front: "覆盖正", back: "覆盖反" }]]);

  const mapped = mapNativeCards(native, genMap, { packName: "测试卡包" });
  assertEqual(mapped.length, 3, "returns 3 cards");
  assertEqual(mapped[0].front, "原生内容1", "falls back to content");
  assertEqual(mapped[0].back, "测试卡包", "falls back to packName");
  assertEqual(mapped[1].state, "review", "reads riffCard.state");
  assertEqual(mapped[1].due, "2026-07-01", "reads due");
  assertEqual(mapped[2].front, "覆盖正", "uses generated.front");
  assertEqual(mapped[2].back, "覆盖反", "uses generated.back");
  assertEqual(mapped[2].nativeHTML, "", "generated card has empty nativeHTML");
}

// search filter
{
  const native = [
    { blockID: "b1", content: "JavaScript基础" },
    { blockID: "b2", content: "Python高级" },
  ];
  const mapped = mapNativeCards(native, new Map(), { query: "python" });
  assertEqual(mapped.length, 1, "search filter matches");
  assertEqual(mapped[0].blockID, "b2", "search filter correct card");
}

// custom cardBlockID
{
  const native = [{ id: "x1", content: "X" }];
  const mapped = mapNativeCards(native, new Map(), { cardBlockID: (c) => c.id });
  assertEqual(mapped[0].blockID, "x1", "custom cardBlockID");
}

// ── mapLocalCards ─────────────────────────────────────────────
console.log("▸ mapLocalCards");
{
  const cards = [
    { blockID: "", front: "Q1", back: "A1" },
    { blockID: "b1", front: "Q2", back: "A2" },
    { blockID: "", front: "Q3", back: "A3" },
  ];
  const local = mapLocalCards(cards);
  assertEqual(local.length, 2, "excludes cards with blockID");
  assertEqual(local[0].front, "Q1", "first local card");
}

// search filter
{
  const cards = [
    { blockID: "", front: "JavaScript", back: "A1" },
    { blockID: "", front: "Python", back: "A2" },
  ];
  const local = mapLocalCards(cards, "python");
  assertEqual(local.length, 1, "search filter local cards");
}

// ── buildMoveOptions ──────────────────────────────────────────
console.log("▸ buildMoveOptions");
{
  const packs = [
    { id: "p1", name: "卡组A" },
    { id: "p2", name: "卡组B" },
    { id: "current", name: "当前" },
  ];
  const html = buildMoveOptions(packs, "current", (t) => t);
  assert(html.includes('value="p1"'), "contains p1 option");
  assert(html.includes("卡组A"), "contains pack A name");
  assert(!html.includes("current"), "excludes current deck");
}

// ── renderLibHTML ────────────────────────────────────────────
console.log("▸ renderLibHTML");
{
  // empty state
  const html = renderLibHTML([], "", () => "", (t) => t);
  assert(html.includes("aiflash-empty"), "empty state shows message");
}
{
  const cards = [
    { blockID: "b1", front: "Q1", back: "A1", state: "review", due: "2026-07-01" },
    { blockID: "", front: "Q2", back: "A2", state: "", due: "" },
  ];
  const moveOpts = '<option value="p2">卡组B</option>';
  const html = renderLibHTML(cards, moveOpts, (c) => `<b>${c.front}</b>`, (t) => t);
  assert(html.includes("aiflash-card-row"), "contains card row");
  assert(html.includes("<b>Q1</b>"), "renders card content");
  assert(html.includes("原生闪卡"), "shows native label");
  assert(html.includes("本地旧卡"), "shows local label");
  assert(html.includes("data-remove-card=\"b1\""), "has remove button for native");
  assert(html.includes("data-move-card=\"b1\""), "has move select for native");
  assert(html.includes("卡组B"), "move options rendered");
  assert(html.includes("到期 2026-07-01"), "due date rendered");
}

// ── 汇总 ─────────────────────────────────────────────────────
console.log("\n" + "═".repeat(40));
console.log(`lib-render.test.js: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error("❌ SOME TESTS FAILED");
  process.exit(1);
} else {
  console.log("✅ ALL TESTS PASSED");
}
