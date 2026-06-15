/**
 * ai-flashcards-native/src/graph-layout.js
 *
 * 力导向布局算法 —— Fruchterman-Reingold 变体。
 * 纯函数，无 DOM 依赖，无副作用（除 initPositions 的随机初始化）。
 */

// ── 初始位置 ──────────────────────────────────────────────

/**
 * 在画布 20%-80% 区域内随机散布节点初始位置。
 * @param {Object[]} nodes - 节点数组，每个节点会被添加 x/y/vx/vy 属性
 * @param {number} width - 画布逻辑宽度
 * @param {number} height - 画布逻辑高度
 * @returns {Object[]} 修改后的 nodes
 */
function initPositions(nodes, width = 1200, height = 900) {
  const cx = width / 2;
  const cy = height / 2;
  const rx = width * 0.3;
  const ry = height * 0.3;
  for (const node of nodes) {
    node.x = cx + (Math.random() - 0.5) * 2 * rx;
    node.y = cy + (Math.random() - 0.5) * 2 * ry;
    node.vx = 0;
    node.vy = 0;
  }
  return nodes;
}

// ── 单次力导向迭代 ────────────────────────────────────────

/**
 * 执行一次 Fruchterman-Reingold 力导向迭代。
 *
 * 算法核心：
 * - k = sqrt(W*H/N)  理想弹簧长度
 * - 斥力：任意两节点间 F = k²/d²（库仑力）
 * - 引力：沿边 F = d/k × (1 + weight×0.3)（胡克力）
 * - 中心引力：gravity × (center - pos)
 * - 阻尼 0.85 + 弹性边界
 *
 * @param {Object[]} nodes - 含 x/y/vx/vy 的节点数组
 * @param {Object[]} links - { source: index, target: index, weight } 数组
 * @param {Object} config
 * @param {number} [config.width=1200]
 * @param {number} [config.height=900]
 * @param {number} [config.damping=0.85]
 * @param {number} [config.gravity=0.05]
 * @param {number} [config.temperature=1] - 模拟退火温度
 * @returns {{ nodes: Object[], kineticEnergy: number }}
 */
function forceIteration(nodes, links, config = {}) {
  const {
    width = 1200,
    height = 900,
    damping = 0.85,
    gravity = 0.05,
    temperature = 1,
  } = config;

  const n = nodes.length;
  if (n === 0) return { nodes, kineticEnergy: 0 };

  const k = Math.sqrt((width * height) / n);
  const k2 = k * k;
  const cx = width / 2;
  const cy = height / 2;

  // 斥力：任意两节点间
  for (let i = 0; i < n; i++) {
    let fx = 0;
    let fy = 0;
    const ni = nodes[i];
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const nj = nodes[j];
      let dx = ni.x - nj.x;
      let dy = ni.y - nj.y;
      let d2 = dx * dx + dy * dy;
      if (d2 < 0.01) {
        // 避免除零，随机扰动
        dx = (Math.random() - 0.5) * 0.1;
        dy = (Math.random() - 0.5) * 0.1;
        d2 = dx * dx + dy * dy;
      }
      const d = Math.sqrt(d2);
      const force = k2 / d2;
      fx += (dx / d) * force;
      fy += (dy / d) * force;
    }
    ni.vx += fx;
    ni.vy += fy;
  }

  // 引力：沿边
  for (const link of links) {
    const si = link.source;
    const ti = link.target;
    if (si === ti) continue;
    const ns = nodes[si];
    const nt = nodes[ti];
    if (!ns || !nt) continue;
    const dx = nt.x - ns.x;
    const dy = nt.y - ns.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
    const w = link.weight || 1;
    const force = (d / k) * (1 + w * 0.3);
    const fx = (dx / d) * force;
    const fy = (dy / d) * force;
    ns.vx += fx;
    ns.vy += fy;
    nt.vx -= fx;
    nt.vy -= fy;
  }

  // 中心引力 + 应用速度 + 阻尼 + 边界
  let kineticEnergy = 0;
  const margin = 20;
  for (const node of nodes) {
    // 中心引力
    node.vx += gravity * (cx - node.x);
    node.vy += gravity * (cy - node.y);

    // 如果节点被 pin（拖拽中），跳过位置更新
    if (node.pinned) {
      node.vx = 0;
      node.vy = 0;
      continue;
    }

    // 阻尼
    node.vx *= damping;
    node.vy *= damping;

    // 温度限制最大位移
    const maxDisp = 10 * temperature;
    const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
    if (speed > maxDisp) {
      node.vx = (node.vx / speed) * maxDisp;
      node.vy = (node.vy / speed) * maxDisp;
    }

    // 更新位置
    node.x += node.vx;
    node.y += node.vy;

    // 弹性边界
    if (node.x < margin) { node.x = margin; node.vx *= -0.5; }
    if (node.x > width - margin) { node.x = width - margin; node.vx *= -0.5; }
    if (node.y < margin) { node.y = margin; node.vy *= -0.5; }
    if (node.y > height - margin) { node.y = height - margin; node.vy *= -0.5; }

    kineticEnergy += node.vx * node.vx + node.vy * node.vy;
  }

  return { nodes, kineticEnergy };
}

// ── 完整布局 ──────────────────────────────────────────────

/**
 * 构建 links 的 source/target 索引映射。
 * @param {Object[]} nodes
 * @param {Object[]} links - { from: id, to: id } 数组
 * @returns {Object[]} 含 source/target 索引的 links
 */
function buildLinkIndices(nodes, links) {
  const indexMap = new Map(nodes.map((n, i) => [n.id, i]));
  return (links || [])
    .map((link) => ({
      ...link,
      source: indexMap.get(link.from),
      target: indexMap.get(link.to),
    }))
    .filter((l) => l.source != null && l.target != null);
}

/**
 * 运行完整的力导向布局（N 次迭代）。
 * @param {Object[]} nodes - 节点数组（需含 id）
 * @param {Object[]} links - { from: id, to: id, weight? }
 * @param {Object} config
 * @param {number} [config.iterations=200]
 * @param {number} [config.width=1200]
 * @param {number} [config.height=900]
 * @returns {Map<string, {x: number, y: number}>}
 */
function forceLayout(nodes, links, config = {}) {
  const { iterations = 200, ...rest } = config;

  initPositions(nodes, rest.width, rest.height);
  const indexedLinks = buildLinkIndices(nodes, links);

  let temp = 1;
  for (let i = 0; i < iterations; i++) {
    temp = 1 - i / iterations; // 线性退火
    forceIteration(nodes, indexedLinks, { ...rest, temperature: temp });
  }

  return new Map(nodes.map((n) => [n.id, { x: n.x, y: n.y }]));
}

// ── 视图适配 ──────────────────────────────────────────────

/**
 * 计算自适应视图变换（将所有节点缩放到画布内）。
 * @param {Object[]} nodes - 含 x/y 的节点数组
 * @param {number} canvasWidth
 * @param {number} canvasHeight
 * @param {number} padding
 * @returns {{ offsetX: number, offsetY: number, scale: number }}
 */
function fitToView(nodes, canvasWidth, canvasHeight, padding = 40) {
  if (!nodes.length) {
    return { offsetX: 0, offsetY: 0, scale: 1 };
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    if (n.x < minX) minX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.x > maxX) maxX = n.x;
    if (n.y > maxY) maxY = n.y;
  }
  const w = maxX - minX || 1;
  const h = maxY - minY || 1;
  const availW = canvasWidth - padding * 2;
  const availH = canvasHeight - padding * 2;
  const scale = Math.min(availW / w, availH / h, 2.5);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const offsetX = canvasWidth / 2 - centerX * scale;
  const offsetY = canvasHeight / 2 - centerY * scale;
  return { offsetX, offsetY, scale };
}

// ── 命中测试 ──────────────────────────────────────────────

/**
 * 鼠标命中测试（逆序遍历，上层优先）。
 * @param {number} mx - 逻辑坐标 x
 * @param {number} my - 逻辑坐标 y
 * @param {Object[]} nodes - 含 x/y 的节点数组
 * @param {Function|number} nodeRadius - 半径函数或固定半径
 * @returns {Object|null} 命中的节点
 */
function hitTest(mx, my, nodes, nodeRadius) {
  const getRadius =
    typeof nodeRadius === "function" ? nodeRadius : () => nodeRadius || 10;
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];
    const r = getRadius(n);
    const dx = mx - n.x;
    const dy = my - n.y;
    if (dx * dx + dy * dy <= r * r) {
      return n;
    }
  }
  return null;
}

// ── 导出 ──────────────────────────────────────────────────

module.exports = {
  initPositions,
  forceIteration,
  forceLayout,
  buildLinkIndices,
  fitToView,
  hitTest,
};
