/**
 * src/trainer-logic.js 单元测试
 * 运行: node test/trainer-logic.test.js
 */

const tl = require("./trainer-logic");

let passed = 0;
let failed = 0;

function assert(cond, msg) { cond ? passed++ : (failed++, console.error(`  ❌ FAIL: ${msg}`)); }
function eq(a, b, msg) { a === b ? passed++ : (failed++, console.error(`  ❌ FAIL: ${msg}\n    expected: ${JSON.stringify(b)}\n    actual:   ${JSON.stringify(a)}`)); }
function deepEq(a, b, msg) { JSON.stringify(a) === JSON.stringify(b) ? passed++ : (failed++, console.error(`  ❌ FAIL: ${msg}\n    expected: ${JSON.stringify(b)}\n    actual:   ${JSON.stringify(a)}`)); }

// ── TRAINER_TOPICS ─────────────────────────────────
console.log("Testing TRAINER_TOPICS...");
assert(typeof tl.TRAINER_TOPICS === "object", "is object");
assert("斜面" in tl.TRAINER_TOPICS, "has 斜面");
assert("导数" in tl.TRAINER_TOPICS, "has 导数");
assert("电容" in tl.TRAINER_TOPICS, "has 电容");
eq(tl.TRAINER_TOPICS["斜面"].cards.length, 3, "斜面 has 3 cards");

// ── defaultTrainerState ────────────────────────────
console.log("Testing defaultTrainerState()...");
const def = tl.defaultTrainerState();
eq(def.topic, "斜面上物体的受力分析", "default topic");
eq(def.depth, "日常理解", "default depth");
eq(def.discarded, 0, "default discarded");
assert(Array.isArray(def.drafts) && def.drafts.length === 0, "drafts is empty array");
assert(Array.isArray(def.accepted) && def.accepted.length === 0, "accepted is empty array");
eq(def.debugVisible, true, "debugVisible true");

// ── normalizeTrainerState ──────────────────────────
console.log("Testing normalizeTrainerState()...");
const norm1 = tl.normalizeTrainerState(null);
eq(norm1.topic, def.topic, "null → defaults");
const norm2 = tl.normalizeTrainerState({ topic: "自定义", discarded: "abc" });
eq(norm2.topic, "自定义", "preserves topic");
eq(norm2.discarded, 0, "invalid discarded → 0");
const existing = { topic: "旧", drafts: "not-array" };
tl.normalizeTrainerState(existing);
assert(Array.isArray(existing.drafts), "mutates existing object");

// ── trainerFirstText ───────────────────────────────
console.log("Testing trainerFirstText()...");
eq(tl.trainerFirstText({ front: "A", q: "B" }, ["front", "q"]), "A", "first key");
eq(tl.trainerFirstText({ q: "B" }, ["front", "q"]), "B", "second key");
eq(tl.trainerFirstText({}, ["a", "b"]), "", "no match");
eq(tl.trainerFirstText(null, ["a"]), "", "null source");

// ── trainerExtractJsonCandidate ────────────────────
console.log("Testing trainerExtractJsonCandidate()...");
eq(tl.trainerExtractJsonCandidate('{"a":1}'), '{"a":1}', "simple object");
eq(tl.trainerExtractJsonCandidate('[1,2]'), '[1,2]', "simple array");
eq(tl.trainerExtractJsonCandidate('prefix {"a":1} suffix'), '{"a":1}', "extract from text");
eq(tl.trainerExtractJsonCandidate('{"nested":{"b":[1]}}'), '{"nested":{"b":[1]}}', "nested");
eq(tl.trainerExtractJsonCandidate(""), "", "empty");

// ── trainerParseAIContent ──────────────────────────
console.log("Testing trainerParseAIContent()...");
const p1 = tl.trainerParseAIContent('{"topic":"test"}');
eq(p1.topic, "test", "parses JSON");
const p2 = tl.trainerParseAIContent('```json\n{"topic":"code"}\n```');
eq(p2.topic, "code", "parses code fence");
try { tl.trainerParseAIContent(""); assert(false, "empty throws"); } catch(e) { assert(e.message === "AI 文本为空", "empty throws correct error"); }

// ── trainerNormalizeAICard ─────────────────────────
console.log("Testing trainerNormalizeAICard()...");
const c1 = tl.trainerNormalizeAICard({ front: "Q", back: "A" });
eq(c1.front, "Q", "card front");
eq(c1.back, "A", "card back");
const c2 = tl.trainerNormalizeAICard({ question: "Q2", answer: "A2" });
eq(c2.front, "Q2", "question → front");
eq(c2.back, "A2", "answer → back");
const c3 = tl.trainerNormalizeAICard("Q line\nA line");
eq(c3.front, "Q line", "string split front");
eq(c3.back, "A line", "string split back");
eq(tl.trainerNormalizeAICard(null), null, "null → null");
eq(tl.trainerNormalizeAICard({ front: "", back: "" }), null, "empty front/back → null");

// ── trainerAIShape ─────────────────────────────────
console.log("Testing trainerAIShape()...");
const s1 = tl.trainerAIShape({ topic: "x", cards: [] }, [{ front: "Q" }]);
eq(s1.valueType, "object", "object type");
assert(s1.keys.includes("topic"), "has topic key");
eq(s1.cardCount, 1, "cardCount 1");

// ── trainerNormalizeAnalysis ───────────────────────
console.log("Testing trainerNormalizeAnalysis()...");
const a1 = tl.trainerNormalizeAnalysis(
  { topic: "T", cards: [{ front: "Q", back: "A" }] },
  "fallback", "日常理解",
);
eq(a1.topic, "T", "topic from data");
eq(a1.cards.length, 1, "1 card");
eq(a1.source, "ai", "source is ai");

const a2 = tl.trainerNormalizeAnalysis(
  [{ front: "Q", back: "A" }],
  "fallback", "深入推导",
);
eq(a2.topic, "fallback", "fallback topic");
eq(a2.cards.length, 1, "array input → 1 card");

try { tl.trainerNormalizeAnalysis({}, "f", "d"); assert(false, "no cards throws"); } catch(e) { passed++; }

// ── trainerNormalizeClassification ─────────────────
console.log("Testing trainerNormalizeClassification()...");
const cl1 = tl.trainerNormalizeClassification(
  { subject: "数学", difficulty: "hard", tags: ["a", "b"] },
  { subject: "物理", cardType: "概念卡" },
);
eq(cl1.subject, "数学", "from data");
eq(cl1.difficulty, "hard", "valid difficulty");
deepEq(cl1.tags, ["a", "b"], "tags");

const cl2 = tl.trainerNormalizeClassification({}, { cardType: "步骤卡", difficulty: "easy" });
eq(cl2.cardType, "步骤卡", "fallback cardType");
eq(cl2.difficulty, "easy", "fallback difficulty");

// ── trainerApplyClassification ─────────────────────
console.log("Testing trainerApplyClassification()...");
const card = { front: "Q", topic: "T", cardType: "概念卡" };
tl.trainerApplyClassification(card, { subject: "数学" }, "ai");
eq(card.subject, "数学", "applied subject");
eq(card.classifiedBy, "ai", "classifiedBy");
assert(!!card.classifiedAt, "has classifiedAt");

// ── trainerAnalyze ─────────────────────────────────
console.log("Testing trainerAnalyze()...");
const an1 = tl.trainerAnalyze("斜面上物体的受力分析", "日常理解");
eq(an1.topic, "斜面上物体的受力分析", "topic preserved");
assert(Array.isArray(an1.cards) && an1.cards.length > 0, "has preset cards for 斜面");

const an2 = tl.trainerAnalyze("量子纠缠的非局域性", "深入推导");
eq(an2.type, "概念型 / 解题型", "generic type for unknown");
assert(an2.cards.length === 3, "3 generic cards");

// ── trainerGenerateCards ───────────────────────────
console.log("Testing trainerGenerateCards()...");
const gen1 = tl.trainerGenerateCards({ cards: [{ type: "概念卡", front: "Q", back: "A" }] }, "理解公式", "日常理解");
eq(gen1.length, 1, "1 card");
eq(gen1[0].status, "draft", "status is draft");

const gen2 = tl.trainerGenerateCards({ topic: "T", cards: [] }, "解题步骤", "考试应对");
assert(gen2.some(c => c.type === "步骤卡"), "步骤 angle adds step card");

const gen3 = tl.trainerGenerateCards({ topic: "T", cards: [] }, "理解", "深入推导");
assert(gen3.some(c => c.type === "追问卡"), "深入推导 adds 追问卡");

// ── trainerBuildPrompt ─────────────────────────────
console.log("Testing trainerBuildPrompt()...");
const pr1 = tl.trainerBuildPrompt("导数", "日常理解");
assert(pr1.includes("导数"), "prompt contains topic");
assert(pr1.includes("日常理解"), "prompt contains depth");
assert(pr1.includes("JSON"), "prompt mentions JSON");

// ── trainerBuildRefinePrompt ───────────────────────
console.log("Testing trainerBuildRefinePrompt()...");
const cur = { topic: "T", cards: [{ front: "Q", back: "A" }] };
const rp = tl.trainerBuildRefinePrompt(cur, "easy");
assert(rp.includes("太难"), "easy action text");
assert(rp.includes("JSON"), "mentions JSON");

// ── trainerBuildClassifyPrompt ─────────────────────
console.log("Testing trainerBuildClassifyPrompt()...");
const cp = tl.trainerBuildClassifyPrompt({ front: "Q", back: "A" });
assert(cp.includes("分类器"), "mentions classifier");
assert(cp.includes("front"), "includes card data");

// ── trainerDiagnoseAIError ─────────────────────────
console.log("Testing trainerDiagnoseAIError()...");
const d1 = tl.trainerDiagnoseAIError(new Error("401 Unauthorized"));
assert(d1.includes("API Key"), "401 → API Key error");
const d2 = tl.trainerDiagnoseAIError(new Error("404 Not Found"));
assert(d2.includes("不存在"), "404 → not found");
const d3 = tl.trainerDiagnoseAIError(new Error("429 Too Many Requests"));
assert(d3.includes("频繁"), "429 → rate limit");
const d4 = tl.trainerDiagnoseAIError(new Error("failed to fetch"));
assert(d4.includes("网络"), "network error");
const d5 = tl.trainerDiagnoseAIError({ message: "400 Bad Request" }, "gpt-4");
assert(d5.includes("gpt-4"), "includes model name");

// ── normalizeTrainerAcceptedCard ───────────────────
console.log("Testing normalizeTrainerAcceptedCard()...");
const ac1 = tl.normalizeTrainerAcceptedCard({ front: "Q", back: "A", topic: "T" }, { uid: "test-1" });
eq(ac1.id, "test-1", "uses context uid");
eq(ac1.front, "Q", "front normalized");
eq(ac1.status, "confirmed", "status confirmed");
assert(Array.isArray(ac1.tags), "tags is array");

// ── trainerCreateAcceptedCard ──────────────────────
console.log("Testing trainerCreateAcceptedCard()...");
const trainer = { topic: "导数", depth: "日常理解", angle: "理解公式" };
const ac2 = tl.trainerCreateAcceptedCard({ type: "概念卡", front: "Q", back: "A" }, trainer, "uid-123");
eq(ac2.id, "trainer-uid-123", "id with uid");
eq(ac2.subject, "数学", "导数 → 数学");
eq(ac2.status, "confirmed", "status confirmed");

const trainer2 = { topic: "斜面", depth: "考试应对", angle: "解题" };
const ac3 = tl.trainerCreateAcceptedCard({ type: "公式卡", front: "Q", back: "A" }, trainer2, "u2");
eq(ac3.subject, "物理", "斜面 → 物理");

// ── trainerNormalizeActiveDraftIndex ───────────────
console.log("Testing trainerNormalizeActiveDraftIndex()...");
const t1 = { activeDraftIndex: 5, drafts: [1, 2, 3] };
tl.trainerNormalizeActiveDraftIndex(t1);
eq(t1.activeDraftIndex, 2, "clamped to max");

const t2 = { activeDraftIndex: 0, drafts: [] };
tl.trainerNormalizeActiveDraftIndex(t2);
eq(t2.activeDraftIndex, null, "empty → null");

const t3 = { activeDraftIndex: null, drafts: [1] };
tl.trainerNormalizeActiveDraftIndex(t3);
eq(t3.activeDraftIndex, null, "null stays null");

// ── trainerFocusDraftAfterRemoval ──────────────────
console.log("Testing trainerFocusDraftAfterRemoval()...");
const f1 = { activeDraftIndex: 2, drafts: [1, 2, 3], mobileView: "input" };
tl.trainerFocusDraftAfterRemoval(f1, 2, "input");
eq(f1.activeDraftIndex, 2, "same index → min(2, 2)");
eq(f1.mobileView, "drafts", "set to drafts");

const f2 = { activeDraftIndex: 3, drafts: [1, 2, 3], mobileView: "input" };
tl.trainerFocusDraftAfterRemoval(f2, 1, "library");
eq(f2.activeDraftIndex, 2, "decremented");

const f3 = { activeDraftIndex: 0, drafts: [], mobileView: "drafts" };
tl.trainerFocusDraftAfterRemoval(f3, 0, "library");
eq(f3.mobileView, "library", "empty → library");

// ── 汇总 ──────────────────────────────────────────
console.log("\n" + "=".repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failed > 0) {
  console.error("\n❌ SOME TESTS FAILED");
  process.exit(1);
} else {
  console.log("\n✅ ALL TESTS PASSED");
}
