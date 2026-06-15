// ── trainer-ui 纯函数测试 ───────────────────────────────────────
const { acceptedToMarkdown, acceptedToJSON } = require("./trainer-ui");

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error(`  ❌ FAIL: ${msg}`); } }
function assertEqual(a, b, msg) { if (a === b) passed++; else { failed++; console.error(`  ❌ FAIL: ${msg} (expected ${JSON.stringify(b)}, got ${JSON.stringify(a)})`); } }

// ── acceptedToMarkdown ──────────────────────────────────────────
console.log("▸ acceptedToMarkdown");
{
  assertEqual(acceptedToMarkdown([]), "", "empty returns empty");
  assertEqual(acceptedToMarkdown(null), "", "null returns empty");
}
{
  const cards = [{
    id: "c1", topic: "量子力学", subject: "物理", domain: "基础",
    chapter: "第一章", depth: "考试", knowledgeType: "概念",
    cardType: "选择题", difficulty: "中", angle: "正面",
    createdAt: "2026-06-13", classifiedBy: "ai",
    classifiedAt: "2026-06-13", examUse: "高考",
    prerequisites: ["数学基础", "力学"],
    tags: ["物理", "量子"],
    front: "什么是叠加态？",
    back: "叠加态是量子系统同时处于多个状态的组合。",
  }];
  const md = acceptedToMarkdown(cards);
  assert(md.includes("# 理科训练舱卡片导出"), "has header");
  assert(md.includes("id: c1"), "has id");
  assert(md.includes("topic: 量子力学"), "has topic");
  assert(md.includes("card_type: 选择题"), "has cardType");
  assert(md.includes("Q: 什么是叠加态？"), "has front");
  assert(md.includes("A: 叠加态是量子系统"), "has back");
  assert(md.includes("  - 数学基础"), "has prerequisite");
  assert(md.includes("  - 物理"), "has tag");
}
{
  // card with empty prerequisites
  const cards = [{
    id: "c2", topic: "T", subject: "S", domain: "D",
    depth: "考试", cardType: "判断", angle: "正面",
    createdAt: "2026-06-13",
    prerequisites: [], tags: [],
    front: "Q", back: "A",
  }];
  const md = acceptedToMarkdown(cards);
  assert(md.includes("  - 未整理"), "empty prerequisites fallback");
}

// ── acceptedToJSON ──────────────────────────────────────────────
console.log("▸ acceptedToJSON");
{
  const cards = [{ id: "c1", front: "Q", back: "A" }];
  const json = acceptedToJSON(cards);
  const parsed = JSON.parse(json);
  assertEqual(parsed.length, 1, "valid JSON array");
  assertEqual(parsed[0].id, "c1", "preserves id");
}
{
  const json = acceptedToJSON([]);
  assertEqual(json, "[]", "empty array");
}

// ── 汇总 ─────────────────────────────────────────────────────
console.log("\n" + "═".repeat(40));
console.log(`trainer-ui.test.js: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error("❌ SOME TESTS FAILED");
  process.exit(1);
} else {
  console.log("✅ ALL TESTS PASSED");
}
