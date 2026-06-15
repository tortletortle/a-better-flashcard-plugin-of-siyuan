// ── siyuan-api 纯函数测试 ────────────────────────────────────
// mock siyuan module
const Module = require("module");
const origResolve = Module._resolveFilename;
Module._resolveFilename = function(request, ...args) {
  if (request === "siyuan") return require.resolve("./mock-siyuan-tmp.js");
  return origResolve.call(this, request, ...args);
};
require("fs").writeFileSync(
  __dirname + "/mock-siyuan-tmp.js",
  'module.exports = { Constants: { QUICK_DECK_ID: "test-quick-id" }, fetchSyncPost: async () => ({ code: 0, data: {} }) };',
);

const { riffDeckID, quickDeckID, isQuickDeckID, numberFrom, riffDecksFromApi, deckFromApi, createdDeckFromApi } = require("./siyuan-api");

require("fs").unlinkSync(__dirname + "/mock-siyuan-tmp.js");
Module._resolveFilename = origResolve;

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error(`  ❌ FAIL: ${msg}`); } }
function assertEqual(a, b, msg) { if (a === b) passed++; else { failed++; console.error(`  ❌ FAIL: ${msg} (expected ${JSON.stringify(b)}, got ${JSON.stringify(a)})`); } }

// ── riffDeckID ────────────────────────────────────────────────
console.log("▸ riffDeckID");
assertEqual(riffDeckID({ id: "abc" }), "abc", "reads id");
assertEqual(riffDeckID({ deckID: "d1" }), "d1", "reads deckID");
assertEqual(riffDeckID({ deckId: "d2" }), "d2", "reads deckId");
assertEqual(riffDeckID({ deck_id: "d3" }), "d3", "reads deck_id");
assertEqual(riffDeckID({}), "", "empty for no fields");
assertEqual(riffDeckID(null), "", "empty for null");
assertEqual(riffDeckID({ id: "" }), "", "empty for empty string");

// ── quickDeckID ───────────────────────────────────────────────
console.log("▸ quickDeckID");
const qid = quickDeckID();
assert(typeof qid === "string", "returns string");
assert(qid.length > 0, "non-empty");
assertEqual(qid, "test-quick-id", "reads from mocked Constants");

// ── isQuickDeckID ─────────────────────────────────────────────
console.log("▸ isQuickDeckID");
assert(isQuickDeckID(quickDeckID()), "matches quickDeckID");
assert(!isQuickDeckID(""), "false for empty");
assert(!isQuickDeckID("other-id"), "false for other");

// ── numberFrom ────────────────────────────────────────────────
console.log("▸ numberFrom");
assertEqual(numberFrom([5]), 5, "direct number");
assertEqual(numberFrom(["7"]), 7, "string number");
assertEqual(numberFrom([null, 3]), 3, "skips null");
assertEqual(numberFrom([undefined, null]), 0, "returns 0 for no valid");
assertEqual(numberFrom([-1, 5]), 5, "skips negative");
assertEqual(numberFrom([]), 0, "empty array");

// ── riffDecksFromApi ──────────────────────────────────────────
console.log("▸ riffDecksFromApi");
{
  const data = [{ id: "a", name: "A" }, { id: "b", name: "B" }];
  const result = riffDecksFromApi(data);
  assertEqual(result.length, 2, "array input: 2 decks");
}
{
  const data = { decks: [{ id: "x" }, { id: "y" }] };
  const result = riffDecksFromApi(data);
  assertEqual(result.length, 2, "object.decks: 2 decks");
}
{
  const data = { list: [{ id: "z" }] };
  const result = riffDecksFromApi(data);
  assertEqual(result.length, 1, "object.list: 1 deck");
}
{
  // dedup
  const data = [{ id: "a" }, { id: "a" }, { id: "b" }];
  const result = riffDecksFromApi(data);
  assertEqual(result.length, 2, "deduplicates by id");
}
{
  const result = riffDecksFromApi(null);
  assertEqual(result.length, 0, "null input: empty");
}

// ── deckFromApi ───────────────────────────────────────────────
console.log("▸ deckFromApi");
{
  const deck = deckFromApi({ id: "d1", name: "测试", cardCount: 42, dueCardCount: 5 });
  assertEqual(deck.id, "d1", "id");
  assertEqual(deck.name, "测试", "name");
  assertEqual(deck.cardCount, 42, "cardCount");
  assertEqual(deck.dueCardCount, 5, "dueCardCount");
  assertEqual(deck.native, true, "native flag");
  assertEqual(deck.quick, false, "quick flag default");
}
{
  const deck = deckFromApi({ deckID: "d2", size: 10, due: 3, quick: true });
  assertEqual(deck.id, "d2", "reads deckID");
  assertEqual(deck.cardCount, 10, "reads size");
  assertEqual(deck.dueCardCount, 3, "reads due");
  assertEqual(deck.quick, true, "quick true");
}
{
  const deck = deckFromApi({});
  assertEqual(deck.name, "未命名卡包", "default name");
  assertEqual(deck.cardCount, 0, "default cardCount");
}

// ── createdDeckFromApi ────────────────────────────────────────
console.log("▸ createdDeckFromApi");
{
  const result = createdDeckFromApi({ deck: { id: "new1", name: "新卡包" } }, "降级名");
  assertEqual(result.id, "new1", "reads deck.id");
  assertEqual(result.name, "新卡包", "reads deck.name");
}
{
  const result = createdDeckFromApi({ deckID: "new2" }, "降级名");
  assertEqual(result.id, "new2", "falls back to deckID");
  assertEqual(result.name, "降级名", "uses fallback name");
}
{
  const result = createdDeckFromApi("string-id", "名称");
  assertEqual(result.id, "string-id", "string data");
}

// ── 汇总 ─────────────────────────────────────────────────────
console.log("\n" + "═".repeat(40));
console.log(`siyuan-api.test.js: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error("❌ SOME TESTS FAILED");
  process.exit(1);
} else {
  console.log("✅ ALL TESTS PASSED");
}
