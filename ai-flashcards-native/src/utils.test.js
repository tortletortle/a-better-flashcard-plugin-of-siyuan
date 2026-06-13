/**
 * src/utils.js 单元测试
 * 运行: node test/utils.test.js
 */

const u = require("./utils");

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

// ── esc ──────────────────────────────────────────────
console.log("Testing esc()...");
assertEqual(u.esc("<script>"), "&lt;script&gt;", "esc escapes < and >");
assertEqual(u.esc('"hello"'), "&quot;hello&quot;", "esc escapes quotes");
assertEqual(u.esc("a & b"), "a &amp; b", "esc escapes &");
assertEqual(u.esc("normal"), "normal", "esc passes normal text");
assertEqual(u.esc(""), "", "esc handles empty string");
assertEqual(u.esc(null), "null", "esc handles null");

// ── day ──────────────────────────────────────────────
console.log("Testing day()...");
const today = u.day();
assert(/^\d{4}-\d{2}-\d{2}$/.test(today), `day() returns YYYY-MM-DD: ${today}`);

// ── uid ──────────────────────────────────────────────
console.log("Testing uid()...");
const id1 = u.uid();
const id2 = u.uid();
assert(id1 !== id2, "uid() generates unique IDs");
assert(id1.includes("_"), "uid() contains underscore separator");
assert(id1.length > 10, "uid() is long enough");

// ── firstDefined ─────────────────────────────────────
console.log("Testing firstDefined()...");
assertEqual(u.firstDefined(undefined, null, "", "hello"), "hello", "skips undefined/null/empty");
assertEqual(u.firstDefined(0, "x"), 0, "0 is valid");
assertEqual(u.firstDefined(false, "x"), false, "false is valid");
assertEqual(u.firstDefined(undefined), undefined, "all undefined returns undefined");

// ── numberFromApi ────────────────────────────────────
console.log("Testing numberFromApi()...");
assertEqual(u.numberFromApi("42"), 42, "parses string number");
assertEqual(u.numberFromApi(null, "7"), 7, "skips null");
assertEqual(u.numberFromApi("abc"), 0, "returns 0 for NaN");
assertEqual(u.numberFromApi(undefined, null, ""), 0, "returns 0 for all empty");
assertEqual(u.numberFromApi(3.14), 3.14, "passes through number");

// ── parseTime ────────────────────────────────────────
console.log("Testing parseTime()...");
assertEqual(u.parseTime(0), 0, "0 returns 0");
assertEqual(u.parseTime(null), 0, "null returns 0");
assertEqual(u.parseTime(""), 0, "empty string returns 0");
// SiYuan 14-digit timestamp
const ts = u.parseTime("20260101120000");
assert(ts > 0, `parseTime parses 14-digit: ${ts}`);
assertEqual(new Date(ts).getFullYear(), 2026, "year is correct");
// seconds (< 1e12)
assertEqual(u.parseTime(1700000000), 1700000000000, "seconds to ms");
// ms (> 1e12)
assertEqual(u.parseTime(1700000000000), 1700000000000, "ms passes through");

// ── dueText ──────────────────────────────────────────
console.log("Testing dueText()...");
assertEqual(u.dueText({ dueAt: Date.now() - 1000 }), "现在", "past time = now");
const in10min = u.dueText({ dueAt: Date.now() + 10 * 60 * 1000 });
assert(in10min.includes("分钟"), `10 min: ${in10min}`);
const in2h = u.dueText({ dueAt: Date.now() + 2 * 3600 * 1000 });
assert(in2h.includes("小时"), `2 hours: ${in2h}`);
const in3d = u.dueText({ dueAt: Date.now() + 3 * 86400 * 1000 });
assert(in3d.includes("天"), `3 days: ${in3d}`);

// ── cardMastery ──────────────────────────────────────
console.log("Testing cardMastery()...");
assertEqual(u.cardMastery({}), "unknown", "empty card = unknown");
assertEqual(u.cardMastery({ reps: 5, dueAt: Date.now() + 864e5 * 10 }), "good", "high reps + far due = good");
assertEqual(u.cardMastery({ reps: 1, dueAt: Date.now() + 3600000 }), "mid", "1 rep + near due = mid");
assertEqual(u.cardMastery({ lapses: 3, reps: 5, dueAt: Date.now() + 864e5 * 10 }), "weak", "lapses > 0 = weak");
assertEqual(u.cardMastery({ state: "again" }), "weak", "state=again = weak");
assertEqual(u.cardMastery({ state: "new", reps: 1 }), "mid", "state=new = mid");

// ── masteryScore ─────────────────────────────────────
console.log("Testing masteryScore()...");
assertEqual(u.masteryScore("weak"), 0, "weak = 0");
assertEqual(u.masteryScore("mid"), 1, "mid = 1");
assertEqual(u.masteryScore("good"), 2, "good = 2");
assertEqual(u.masteryScore("unknown"), 1, "unknown = 1");
assertEqual(u.masteryScore("other"), 1, "other = 1");

// ── masteryLabel ─────────────────────────────────────
console.log("Testing masteryLabel()...");
assertEqual(u.masteryLabel("weak"), "薄弱", "weak label");
assertEqual(u.masteryLabel("mid"), "中间", "mid label");
assertEqual(u.masteryLabel("good"), "熟悉", "good label");
assertEqual(u.masteryLabel("unknown"), "未知", "unknown label");
assertEqual(u.masteryLabel("xyz"), "未知", "other label");

// ── cleanBlockMarkdown ───────────────────────────────
console.log("Testing cleanBlockMarkdown()...");
assertEqual(
  u.cleanBlockMarkdown('text\n{: id="abc123"}'),
  "text",
  "removes id attribute",
);
assertEqual(
  u.cleanBlockMarkdown('text\n{: custom-riff-decks="xyz"}'),
  "text",
  "removes riff-decks attribute",
);
assertEqual(
  u.cleanBlockMarkdown("normal text"),
  "normal text",
  "passes normal text",
);

// ── cleanFileName ────────────────────────────────────
console.log("Testing cleanFileName()...");
assertEqual(u.cleanFileName("hello"), "hello", "normal name");
assertEqual(u.cleanFileName('a\\b/c:d*e'), "a b c d e", "removes special chars");
assertEqual(u.cleanFileName(""), "未命名", "empty = default");
assertEqual(u.cleanFileName(null), "未命名", "null = default");
assertEqual(
  u.cleanFileName("a".repeat(100)).length,
  48,
  "truncates to 48 chars",
);

// ── safeMd ───────────────────────────────────────────
console.log("Testing safeMd()...");
assertEqual(
  u.safeMd("{{{col"),
  "&#123;&#123;&#123;col",
  "escapes opening superblock",
);
assertEqual(
  u.safeMd("}}}"),
  "&#125;&#125;&#125;",
  "escapes closing superblock",
);
assertEqual(u.safeMd("normal"), "normal", "passes normal text");

// ── extractID ────────────────────────────────────────
console.log("Testing extractID()...");
assertEqual(u.extractID("abc"), "abc", "string passthrough");
assertEqual(u.extractID(null), "", "null returns empty");
assertEqual(u.extractID({ id: "123" }), "123", "extracts from object.id");
assertEqual(u.extractID({ blockID: "456" }), "456", "extracts from blockID");
assertEqual(
  u.extractID([{ id: "a" }, { id: "b" }]),
  "a",
  "extracts from array",
);
assertEqual(
  u.extractID({ data: { id: "nested" } }),
  "nested",
  "extracts nested",
);

// ── repairMathSegment ────────────────────────────────
console.log("Testing repairMathSegment()...");
assertEqual(u.repairMathSegment("x\\$y"), "x$y", "unescapes dollar in math");
assertEqual(u.repairMathSegment("a+b"), "a+b", "passes normal math");

// ── repairPlainText ──────────────────────────────────
console.log("Testing repairPlainText()...");
assertEqual(u.repairPlainText("a\\$b"), "a$b", "unescapes dollar");
assertEqual(u.repairPlainText("a\\_b"), "a_b", "unescapes underscore");
assertEqual(u.repairPlainText("a\\*b"), "a*b", "unescapes asterisk");
assertEqual(u.repairPlainText("a\\`b"), "a`b", "unescapes backtick");

// ── repairFormulaText ────────────────────────────────
console.log("Testing repairFormulaText()...");
assertEqual(
  u.repairFormulaText("\\(x+1\\)"),
  "$x+1$",
  "converts inline delimiters",
);
assertEqual(
  u.repairFormulaText("\\[x^2\\]"),
  "$$\nx^2\n$$",
  "converts block delimiters",
);
assertEqual(
  u.repairFormulaText("text $x$ more"),
  "text $x$ more",
  "preserves existing $...$",
);
assertEqual(u.repairFormulaText("plain text"), "plain text", "passes plain text");

// ── normalizeCardText ────────────────────────────────
console.log("Testing normalizeCardText()...");
assertEqual(
  u.normalizeCardText("  \\(a\\)  "),
  "$a$",
  "normalizes and trims",
);

// ── clean ────────────────────────────────────────────
console.log("Testing clean()...");
assertEqual(u.clean("# Title"), "Title", "removes heading");
assertEqual(u.clean("> quote"), "quote", "removes blockquote");
assertEqual(u.clean("- list"), "list", "removes list marker");
assertEqual(
  u.clean("```js\ncode\n```"),
  "code",
  "removes code fence",
);
assertEqual(u.clean("plain"), "plain", "passes plain text");

// ── parse ────────────────────────────────────────────
console.log("Testing parse()...");
const cards1 = u.parse([
  { front: "Q1", back: "A1" },
  { front: "Q2", back: "A2" },
]);
assertEqual(cards1.length, 2, "parses array of cards");
assertEqual(cards1[0].front, "Q1", "card front correct");
assertEqual(cards1[1].back, "A2", "card back correct");

const cards2 = u.parse({
  choices: [{ message: { content: '[{"front":"Q","back":"A"}]' } }],
});
assertEqual(cards2.length, 1, "parses OpenAI response");
assertEqual(cards2[0].front, "Q", "OpenAI card front");

const cards3 = u.parse("```json\n[{\"front\":\"X\",\"back\":\"Y\"}]\n```");
assertEqual(cards3.length, 1, "parses JSON string with code fence");

const cards4 = u.parse([{ front: "", back: "A" }]);
assertEqual(cards4.length, 0, "filters cards without front");

let cards5Result;
try {
  cards5Result = u.parse("not json");
} catch (_e) {
  cards5Result = [];
}
assertEqual(cards5Result.length, 0, "invalid JSON returns empty (via catch)");

// ── 汇总 ─────────────────────────────────────────────
console.log("\n" + "=".repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failed > 0) {
  console.error("\n❌ SOME TESTS FAILED");
  process.exit(1);
} else {
  console.log("\n✅ ALL TESTS PASSED");
}
