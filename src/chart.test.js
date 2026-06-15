// ── chart.js 单元测试 ─────────────────────────────────────────
"use strict";
const assert = require("assert");
const c = require("./chart");

let passed = 0, failed = 0;
function assertEqual(actual, expected, msg) {
  if (actual === expected) { passed++; }
  else { failed++; console.error(`FAIL: ${msg} — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`); }
}
function assertTrue(val, msg) {
  if (val) { passed++; }
  else { failed++; console.error(`FAIL: ${msg}`); }
}

// ── formatDate ────────────────────────────────────────────
console.log("Testing formatDate()...");
assertEqual(c.formatDate(new Date(2026, 5, 13)), "2026-06-13", "format date");
assertEqual(c.formatDate(new Date(2026, 0, 1)), "2026-01-01", "pad month/day");
assertEqual(c.formatDate(new Date(2025, 11, 31)), "2025-12-31", "year end");

// ── niceSteps ────────────────────────────────────────────
console.log("Testing niceSteps()...");
const s10 = c.niceSteps(10, 5);
assertTrue(s10.length >= 2, "niceSteps(10,5) has entries");
assertTrue(s10[0] === 0, "starts at 0");
assertTrue(s10[s10.length - 1] >= 10, "covers max");

const s0 = c.niceSteps(0, 5);
assertEqual(s0.length, 1, "niceSteps(0) = [0]");
assertEqual(s0[0], 0, "niceSteps(0)[0] = 0");

const s100 = c.niceSteps(100, 5);
assertTrue(s100.length >= 3, "niceSteps(100,5) reasonable");
assertTrue(s100[s100.length - 1] >= 100, "covers 100");

const s3 = c.niceSteps(3, 5);
assertTrue(s3.length >= 2, "niceSteps(3,5) has entries");
assertTrue(s3[s3.length - 1] >= 3, "covers 3");

const s50 = c.niceSteps(50, 4);
assertTrue(s50.length >= 2, "niceSteps(50,4)");
for (let i = 1; i < s50.length; i++) {
  assertTrue(s50[i] > s50[i - 1], "monotonically increasing");
}

// ── prepareCurveData ──────────────────────────────────────
console.log("Testing prepareCurveData()...");

// 空输入
const empty = c.prepareCurveData([], 7);
assertEqual(empty.labels.length, 7, "empty: 7 labels");
assertEqual(empty.series.total.length, 7, "empty: 7 total values");
assertTrue(empty.series.total.every(v => v === 0), "empty: all zeros");
assertEqual(empty.max, 1, "empty: max = 1");

// 有数据
const today = new Date(); today.setHours(0, 0, 0, 0);
const todayStr = c.formatDate(today);
const yesterday = new Date(today.getTime() - 864e5);
const yestStr = c.formatDate(yesterday);

const history = [
  { date: todayStr, total: 5, good: 3, mid: 1, weak: 1 },
  { date: todayStr, total: 3, good: 2, mid: 1, weak: 0 }, // 同一天累加
  { date: yestStr, total: 10, good: 6, mid: 2, weak: 2 },
];

const data7 = c.prepareCurveData(history, 7);
assertEqual(data7.labels.length, 7, "7 labels");
assertEqual(data7.series.total[6], 8, "today total = 5+3=8");
assertEqual(data7.series.good[6], 5, "today good = 3+2=5");
assertEqual(data7.series.total[5], 10, "yesterday total = 10");
assertEqual(data7.max, 10, "max = 10");

// 1天
const data1 = c.prepareCurveData(history, 1);
assertEqual(data1.labels.length, 1, "1 label");
assertEqual(data1.series.total[0], 8, "today only");

// 30天默认
const data30 = c.prepareCurveData(history);
assertEqual(data30.labels.length, 30, "default 30 days");

// ── computeCardStats ──────────────────────────────────────
console.log("Testing computeCardStats()...");

// 空
const emptyStats = c.computeCardStats([], []);
assertEqual(emptyStats.total, 0, "empty: 0 total");
assertEqual(emptyStats.good, 0, "empty: 0 good");
assertEqual(emptyStats.avgReps, 0, "empty: avgReps 0");
assertEqual(emptyStats.streak, 0, "empty: streak 0");
assertEqual(emptyStats.totalReviews, 0, "empty: totalReviews 0");

// 有卡片
const cards = [
  { reps: 5, dueAt: Date.now() + 864e5 * 10, ease: 2.5, interval: 7, lapses: 0 },
  { reps: 1, dueAt: Date.now() + 3600000, ease: 2.3, interval: 1, lapses: 0 },
  { reps: 3, dueAt: Date.now() + 864e5 * 10, ease: 2.8, interval: 5, lapses: 2 },
  { reps: 0, ease: 2.5, interval: 0 },
];
const cardStats = c.computeCardStats(cards, history);
assertEqual(cardStats.total, 4, "4 cards");
assertEqual(cardStats.good, 1, "1 good (high reps, far due, 0 lapses)");
assertEqual(cardStats.weak, 1, "1 weak (lapses > 0)");
assertEqual(cardStats.unknown, 1, "1 unknown (no dueAt, no reps)");
assertEqual(cardStats.mid, 1, "1 mid (near due, low reps)");
assertEqual(cardStats.totalReviews, 18, "totalReviews from history");
assertTrue(cardStats.avgEase > 0, "avgEase > 0");
assertTrue(cardStats.avgReps > 0, "avgReps > 0");

// streak 计算
const streakHistory = [
  { date: todayStr, total: 1, good: 1, mid: 0, weak: 0 },
  { date: yestStr, total: 1, good: 1, mid: 0, weak: 0 },
];
const twoDayAgo = new Date(today.getTime() - 2 * 864e5);
const streakStats = c.computeCardStats([], [...streakHistory, { date: c.formatDate(twoDayAgo), total: 1, good: 0, mid: 1, weak: 0 }]);
assertEqual(streakStats.streak, 3, "3-day streak");

// streak 断裂
const gapDate = new Date(today.getTime() - 3 * 864e5);
const gapStats = c.computeCardStats([], [
  { date: todayStr, total: 1 },
  { date: c.formatDate(gapDate), total: 1 }, // yesterday missing
]);
assertEqual(gapStats.streak, 1, "streak broken at yesterday");

// ── hitTestCurve ──────────────────────────────────────────
console.log("Testing hitTestCurve()...");

assertEqual(c.hitTestCurve(100, null), null, "null layout → null");
assertEqual(c.hitTestCurve(100, { plotX: [] }), null, "empty plotX → null");

const layout = { plotX: [50, 100, 150, 200, 250] };
assertEqual(c.hitTestCurve(50, layout), 0, "hit first point");
assertEqual(c.hitTestCurve(100, layout), 1, "hit second point");
assertEqual(c.hitTestCurve(152, layout), 2, "near third point (within 30px)");
assertEqual(c.hitTestCurve(250, layout), 4, "hit last point");
assertEqual(c.hitTestCurve(500, layout), null, "far away → null");
// 70 is |70-50|=20, |70-100|=30 → best is index 0 with dist 20 < 30
assertEqual(c.hitTestCurve(70, layout), 0, "closest to first point");

// ── 绘图函数（mock context 不报错）────────────────────────
console.log("Testing draw functions (no throw)...");

function mockCtx() {
  return {
    canvas: { width: 800, height: 400, getBoundingClientRect: () => ({ width: 800, height: 400 }) },
    save: () => {},
    restore: () => {},
    scale: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    clearRect: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    arcTo: () => {},
    fill: () => {},
    stroke: () => {},
    fillText: () => {},
    strokeText: () => {},
    measureText: (t) => ({ width: t.length * 7 }),
    setLineDash: () => {},
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    font: "",
    textAlign: "",
    textBaseline: "",
  };
}

const data = c.prepareCurveData(history, 7);

// drawLearningCurve
const curveResult = c.drawLearningCurve(mockCtx(), { width: 800, height: 300 }, data);
assertTrue(Array.isArray(curveResult.plotX), "curve returns plotX array");
assertTrue(curveResult.plotX.length === 7, "curve 7 x positions");
assertTrue(curveResult.plotH > 0, "curve has plotH");

// drawLearningCurve with hover
const curveResult2 = c.drawLearningCurve(mockCtx(), { width: 800, height: 300 }, data, { hoverIndex: 3 });
assertTrue(Array.isArray(curveResult2.plotX), "curve with hover returns plotX");

// drawMasteryDonut
c.drawMasteryDonut(mockCtx(), { width: 400, height: 300 }, { good: 10, mid: 5, weak: 3, unknown: 2 });
assertTrue(true, "drawMasteryDonut no throw");

// drawStatsOverview
c.drawStatsOverview(mockCtx(), { width: 600, height: 200 }, cardStats);
assertTrue(true, "drawStatsOverview no throw");

// ── 汇总 ──────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
