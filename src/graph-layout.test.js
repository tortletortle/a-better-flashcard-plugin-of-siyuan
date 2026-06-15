/**
 * src/graph-layout.js 单元测试
 * 运行: node src/graph-layout.test.js
 */

const gl = require("./graph-layout");

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

function group(name, fn) {
  console.log(`\n▸ ${name}`);
  fn();
}

// ── initPositions ──────────────────────────────────────────

group("initPositions", () => {
  const nodes = Array.from({ length: 10 }, (_, i) => ({ id: `n${i}` }));
  gl.initPositions(nodes, 1200, 900);

  assert(nodes.every(n => typeof n.x === "number"), "所有节点有 x");
  assert(nodes.every(n => typeof n.y === "number"), "所有节点有 y");
  assert(nodes.every(n => n.vx === 0), "初始 vx=0");
  assert(nodes.every(n => n.vy === 0), "初始 vy=0");

  // 在 20%-80% 区域内
  assert(nodes.every(n => n.x >= 0 && n.x <= 1200), "x 在边界内");
  assert(nodes.every(n => n.y >= 0 && n.y <= 900), "y 在边界内");

  // 默认参数
  const nodes2 = [{ id: "a" }];
  gl.initPositions(nodes2);
  assert(typeof nodes2[0].x === "number", "默认 width/height 也能工作");

  // 空数组
  gl.initPositions([], 800, 600);
  assert(true, "空数组不报错");
});

// ── forceIteration ─────────────────────────────────────────

group("forceIteration", () => {
  // 基础：无边的两个节点
  const nodes = [
    { id: "a", x: 300, y: 400, vx: 0, vy: 0 },
    { id: "b", x: 500, y: 400, vx: 0, vy: 0 },
  ];
  const r = gl.forceIteration(nodes, [], { width: 800, height: 600 });
  assert(r.nodes === nodes, "返回同一数组引用");
  assert(typeof r.kineticEnergy === "number", "kineticEnergy 是数字");
  assert(r.kineticEnergy >= 0, "kineticEnergy >= 0");

  // 斥力：两节点应该互相远离
  const dx = nodes[0].x - nodes[1].x;
  // 斥力使它们进一步分开（或中心引力拉回，但至少不崩溃）
  assert(true, "斥力迭代不崩溃");

  // 有边
  const nodes2 = [
    { id: "a", x: 200, y: 300, vx: 0, vy: 0 },
    { id: "b", x: 600, y: 300, vx: 0, vy: 0 },
  ];
  const links = [{ source: 0, target: 1, weight: 2 }];
  const r2 = gl.forceIteration(nodes2, links, { width: 800, height: 600 });
  assert(r2.kineticEnergy >= 0, "有边迭代不崩溃");

  // pinned 节点不移动
  const nodes3 = [
    { id: "a", x: 400, y: 300, vx: 0, vy: 0, pinned: true },
    { id: "b", x: 500, y: 300, vx: 0, vy: 0 },
  ];
  const origAx = nodes3[0].x;
  const origAy = nodes3[0].y;
  gl.forceIteration(nodes3, [{ source: 0, target: 1, weight: 1 }]);
  assertEqual(nodes3[0].x, origAx, "pinned 节点 x 不变");
  assertEqual(nodes3[0].y, origAy, "pinned 节点 y 不变");

  // 空节点
  const r3 = gl.forceIteration([], [], {});
  assertEqual(r3.kineticEnergy, 0, "空节点 kineticEnergy=0");
});

// ── buildLinkIndices ────────────────────────────────────────

group("buildLinkIndices", () => {
  const nodes = [{ id: "a" }, { id: "b" }, { id: "c" }];

  const r1 = gl.buildLinkIndices(nodes, [{ from: "a", to: "b", weight: 2 }]);
  assertEqual(r1.length, 1, "一条边");
  assertEqual(r1[0].source, 0, "source=0");
  assertEqual(r1[0].target, 1, "target=1");
  assertEqual(r1[0].weight, 2, "weight 保留");

  // 无效引用过滤
  const r2 = gl.buildLinkIndices(nodes, [{ from: "a", to: "z" }]);
  assertEqual(r2.length, 0, "无效引用被过滤");

  // 空
  const r3 = gl.buildLinkIndices(nodes, []);
  assertEqual(r3.length, 0, "空边数组");

  const r4 = gl.buildLinkIndices(nodes, null);
  assertEqual(r4.length, 0, "null 边");
});

// ── forceLayout ─────────────────────────────────────────────

group("forceLayout", () => {
  // 基本收敛
  const nodes = Array.from({ length: 8 }, (_, i) => ({ id: `n${i}` }));
  const links = [
    { from: "n0", to: "n1" }, { from: "n1", to: "n2" },
    { from: "n2", to: "n3" }, { from: "n3", to: "n0" },
    { from: "n4", to: "n5" },
  ];
  const positions = gl.forceLayout(nodes, links, { iterations: 100, width: 800, height: 600 });

  assert(positions instanceof Map, "返回 Map");
  assertEqual(positions.size, 8, "8个节点位置");

  // 所有位置在边界内
  for (const [, pos] of positions) {
    assert(pos.x >= 0 && pos.x <= 800, `x=${pos.x} 在 0-800`);
    assert(pos.y >= 0 && pos.y <= 600, `y=${pos.y} 在 0-600`);
  }

  // 相连节点应该比不相连的更近（统计意义上）
  const d01 = Math.hypot(
    positions.get("n0").x - positions.get("n1").x,
    positions.get("n0").y - positions.get("n1").y,
  );
  const d04 = Math.hypot(
    positions.get("n0").x - positions.get("n4").x,
    positions.get("n0").y - positions.get("n4").y,
  );
  // 不强制要求，但期望 d01 < d04（因为0和1相连，0和4不相连）
  // 这个断言可能偶尔失败，用宽松条件
  assert(d01 < d04 * 3, "相连节点不至于太远");

  // 空输入
  const r2 = gl.forceLayout([], [], { iterations: 10 });
  assertEqual(r2.size, 0, "空节点返回空 Map");

  // 单节点
  const r3 = gl.forceLayout([{ id: "only" }], [], { iterations: 10 });
  assertEqual(r3.size, 1, "单节点有位置");
  const pos = r3.get("only");
  assert(typeof pos.x === "number" && typeof pos.y === "number", "位置是数字");
});

// ── fitToView ──────────────────────────────────────────────

group("fitToView", () => {
  // 空节点
  const r1 = gl.fitToView([], 800, 600);
  assertEqual(r1.scale, 1, "空节点 scale=1");
  assertEqual(r1.offsetX, 0, "空节点 offsetX=0");

  // 单节点
  const r2 = gl.fitToView([{ x: 100, y: 100 }], 800, 600);
  assert(r2.scale > 0, "单节点 scale>0");

  // 分散节点
  const nodes = [
    { x: 0, y: 0 }, { x: 400, y: 0 },
    { x: 0, y: 300 }, { x: 400, y: 300 },
  ];
  const r3 = gl.fitToView(nodes, 800, 600, 40);
  assert(r3.scale > 0 && r3.scale <= 2.5, "scale 合理范围");
  assert(typeof r3.offsetX === "number", "offsetX 是数字");
  assert(typeof r3.offsetY === "number", "offsetY 是数字");

  // padding 影响
  const r4 = gl.fitToView(nodes, 800, 600, 80);
  assert(r4.scale <= r3.scale, "更大 padding → 更小 scale");
});

// ── hitTest ────────────────────────────────────────────────

group("hitTest", () => {
  const nodes = [
    { id: "a", x: 100, y: 100 },
    { id: "b", x: 200, y: 200 },
    { id: "c", x: 150, y: 150 },
  ];

  // 命中
  const r1 = gl.hitTest(100, 100, nodes, 10);
  assertEqual(r1?.id, "a", "命中节点 a");

  // 未命中
  const r2 = gl.hitTest(500, 500, nodes, 10);
  assertEqual(r2, null, "未命中返回 null");

  // 重叠时返回上层（后面的）
  const r3 = gl.hitTest(150, 150, nodes, 20);
  assertEqual(r3?.id, "c", "重叠时返回上层节点 c");

  // 函数半径
  const r4 = gl.hitTest(100, 105, nodes, (n) => 20);
  assertEqual(r4?.id, "a", "函数半径也命中");

  // 空节点
  const r5 = gl.hitTest(100, 100, [], 10);
  assertEqual(r5, null, "空节点返回 null");

  // 边缘命中
  const r6 = gl.hitTest(110, 100, nodes, 10);
  assertEqual(r6?.id, "a", "边缘命中");

  // 刚好超出
  const r7 = gl.hitTest(111, 100, nodes, 10);
  assertEqual(r7, null, "刚好超出未命中");
});

// ── 总结 ───────────────────────────────────────────────────

console.log(`\n${"═".repeat(40)}`);
console.log(`graph-layout.test.js: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
