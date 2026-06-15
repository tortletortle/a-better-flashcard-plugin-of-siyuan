/**
 * ai-flashcards-native/src/graph-render.js
 *
 * Canvas 2D 知识图谱渲染器。
 * GraphRenderer 类封装 Canvas 生命周期、绘制管线、交互处理。
 * 依赖 graph-layout.js 进行布局和命中测试。
 */

const gl = require("./graph-layout");

// ── 常量 ──────────────────────────────────────────────────

const MASTERY_COLORS = {
  good: "#2f9e44",
  mid: "#f2b705",
  weak: "#d64545",
  unknown: "#8a8f98",
};

const EDGE_COLOR = "rgba(120,130,145,0.35)";
const EDGE_HIGHLIGHT = "rgba(100,140,255,0.7)";
const BG_COLOR = "#1e1e2e";
const LABEL_COLOR = "#d4d4d8";
const SEARCH_INFO_COLOR = "#a0a0b0";

// ── 辅助纯函数 ────────────────────────────────────────────

/** 节点半径 */
function nodeRadius(node) {
  if (node.type === "concept") {
    return Math.min(28, 8 + (node.count || 1) * 1.5);
  }
  return 6;
}

/** 屏幕坐标 → 逻辑坐标 */
function screenToWorld(sx, sy, transform) {
  return {
    x: (sx - transform.offsetX) / transform.scale,
    y: (sy - transform.offsetY) / transform.scale,
  };
}

/** 逻辑坐标 → 屏幕坐标 */
function worldToScreen(wx, wy, transform) {
  return {
    x: wx * transform.scale + transform.offsetX,
    y: wy * transform.scale + transform.offsetY,
  };
}

// ── GraphRenderer 类 ──────────────────────────────────────

class GraphRenderer {
  /**
   * @param {HTMLCanvasElement} canvasEl
   * @param {Object} graphData - { nodes, links }
   * @param {Object} options
   * @param {Function} [options.onNodeSelect] - (node) => void
   * @param {Function} [options.onNodeDblClick] - (node) => void
   * @param {string} [options.searchQuery]
   */
  constructor(canvasEl, graphData, options = {}) {
    this.canvas = canvasEl;
    this.ctx = canvasEl.getContext("2d");
    this.graphData = graphData || { nodes: [], links: [] };
    this.options = options;
    this.searchQuery = options.searchQuery || "";

    // 视图变换
    this.viewTransform = { offsetX: 0, offsetY: 0, scale: 1 };

    // 交互状态
    this.hoveredNode = null;
    this.selectedNode = null;
    this.dragNode = null;
    this.panStart = null;
    this.rafId = null;
    this.destroyed = false;

    // 布局状态
    this.layoutNodes = [];
    this.layoutLinks = [];
    this.layoutFrame = 0;
    this.layoutMaxFrames = 200;
    this.layoutDone = false;

    // 事件处理器引用（用于移除）
    this._onWheel = this.handleWheel.bind(this);
    this._onPointerDown = this.handlePointerDown.bind(this);
    this._onPointerMove = this.handlePointerMove.bind(this);
    this._onPointerUp = this.handlePointerUp.bind(this);
    this._onDblClick = this.handleDblClick.bind(this);
    this._onResize = this._handleResize.bind(this);
  }

  // ── 生命周期 ────────────────────────────────────────────

  mount() {
    this._setupCanvas();
    this._initLayout();
    this._bindEvents();
    this._startLayoutAnimation();
  }

  destroy() {
    this.destroyed = true;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.canvas.removeEventListener("wheel", this._onWheel);
    this.canvas.removeEventListener("pointerdown", this._onPointerDown);
    this.canvas.removeEventListener("pointermove", this._onPointerMove);
    this.canvas.removeEventListener("pointerup", this._onPointerUp);
    this.canvas.removeEventListener("dblclick", this._onDblClick);
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
  }

  update(graphData) {
    this.graphData = graphData || { nodes: [], links: [] };
    this._initLayout();
    this.layoutFrame = 0;
    this.layoutDone = false;
    this._startLayoutAnimation();
  }

  setSearchQuery(query) {
    this.searchQuery = query || "";
    this.draw();
  }

  applyFitToView() {
    if (!this.layoutNodes.length) return;
    const rect = this.canvas.getBoundingClientRect();
    const fit = gl.fitToView(
      this.layoutNodes,
      rect.width,
      rect.height,
      40,
    );
    this.viewTransform = { ...fit };
    this.draw();
  }

  // ── Canvas 设置 ─────────────────────────────────────────

  _setupCanvas() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (typeof ResizeObserver !== "undefined") {
      this._resizeObserver = new ResizeObserver(() => this._onResize());
      this._resizeObserver.observe(this.canvas);
    }
  }

  _handleResize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.draw();
  }

  // ── 布局初始化 ──────────────────────────────────────────

  _initLayout() {
    const { nodes, links } = this.graphData;
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width || 1200;
    const h = rect.height || 900;

    // 复制节点用于布局（不修改原数据）
    this.layoutNodes = nodes.map((n) => ({
      ...n,
      x: 0, y: 0, vx: 0, vy: 0,
    }));
    this.layoutLinks = gl.buildLinkIndices(this.layoutNodes, links);

    gl.initPositions(this.layoutNodes, w, h);

    // 初始适配视图
    this.viewTransform = gl.fitToView(this.layoutNodes, w, h, 40);
  }

  _bindEvents() {
    this.canvas.addEventListener("wheel", this._onWheel, { passive: false });
    this.canvas.addEventListener("pointerdown", this._onPointerDown);
    this.canvas.addEventListener("pointermove", this._onPointerMove);
    this.canvas.addEventListener("pointerup", this._onPointerUp);
    this.canvas.addEventListener("dblclick", this._onDblClick);
  }

  _startLayoutAnimation() {
    if (this.destroyed) return;
    const step = () => {
      if (this.destroyed) return;
      if (!this.layoutDone && this.layoutFrame < this.layoutMaxFrames) {
        const temp = 1 - this.layoutFrame / this.layoutMaxFrames;
        const { kineticEnergy } = gl.forceIteration(
          this.layoutNodes,
          this.layoutLinks,
          {
            width: this.canvas.getBoundingClientRect().width || 1200,
            height: this.canvas.getBoundingClientRect().height || 900,
            temperature: temp,
          },
        );
        this.layoutFrame++;
        if (kineticEnergy < 0.01) {
          this.layoutDone = true;
        }
        // 同步位置到原始节点
        this._syncPositions();
        this.draw();
        this.rafId = requestAnimationFrame(step);
      } else {
        this.layoutDone = true;
        this._syncPositions();
        this.draw();
      }
    };
    this.rafId = requestAnimationFrame(step);
  }

  _syncPositions() {
    const nodes = this.graphData.nodes;
    for (let i = 0; i < nodes.length && i < this.layoutNodes.length; i++) {
      nodes[i].x = this.layoutNodes[i].x;
      nodes[i].y = this.layoutNodes[i].y;
    }
  }

  // ── 绘制管线 ────────────────────────────────────────────

  draw() {
    const ctx = this.ctx;
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    // 清空
    ctx.save();
    ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // 应用视图变换
    ctx.translate(this.viewTransform.offsetX, this.viewTransform.offsetY);
    ctx.scale(this.viewTransform.scale, this.viewTransform.scale);

    this._drawEdges(ctx);
    this._drawNodes(ctx);
    this._drawLabels(ctx);

    ctx.restore();

    // HUD 层（不受视图变换影响）
    this._drawHover(ctx, rect);
    this._drawSearchInfo(ctx, rect);
  }

  _drawEdges(ctx) {
    const { nodes, links } = this.graphData;
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    for (const link of links) {
      const from = nodeMap.get(link.from);
      const to = nodeMap.get(link.to);
      if (!from || !to || from.x == null || to.x == null) continue;

      const isHighlight =
        this.hoveredNode &&
        (link.from === this.hoveredNode.id || link.to === this.hoveredNode.id);

      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.strokeStyle = isHighlight ? EDGE_HIGHLIGHT : EDGE_COLOR;
      ctx.lineWidth = (0.5 + (link.weight || 1) * 0.8) / this.viewTransform.scale;
      ctx.stroke();
    }
  }

  _drawNodes(ctx) {
    const { nodes } = this.graphData;
    const scale = this.viewTransform.scale;

    for (const node of nodes) {
      if (node.x == null) continue;
      const r = nodeRadius(node);
      const color = MASTERY_COLORS[node.mastery] || MASTERY_COLORS.unknown;

      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // hover/selected 光晕
      if (node === this.hoveredNode || node === this.selectedNode) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, r + 3 / scale, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,255,255,0.6)";
        ctx.lineWidth = 2 / scale;
        ctx.stroke();
      }

      // 搜索高亮
      if (this.searchQuery && node.label &&
        node.label.toLowerCase().includes(this.searchQuery.toLowerCase())) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, r + 5 / scale, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(100,200,255,0.8)";
        ctx.lineWidth = 2 / scale;
        ctx.stroke();
      }
    }
  }

  _drawLabels(ctx) {
    const scale = this.viewTransform.scale;
    if (scale < 0.4) return; // 太缩小不显示标签

    const { nodes } = this.graphData;
    const showCard = scale >= 1.2;
    const fontSize = Math.max(10, Math.min(14, 12 / scale));

    ctx.font = `${fontSize}px "Microsoft YaHei", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = LABEL_COLOR;

    for (const node of nodes) {
      if (node.x == null) continue;
      if (node.type === "card" && !showCard) continue;

      const r = nodeRadius(node);
      const maxLen = scale >= 1.5 ? 14 : scale >= 0.8 ? 8 : 5;
      let label = node.label || "";
      if (label.length > maxLen) label = label.slice(0, maxLen) + "…";
      if (!label) continue;

      ctx.fillText(label, node.x, node.y + r + 2 / scale);
    }
  }

  _drawHover(ctx, rect) {
    if (!this.hoveredNode) return;
    const node = this.hoveredNode;
    const screenPos = worldToScreen(node.x || 0, node.y || 0, this.viewTransform);
    const label = node.label || "";
    const info = node.type === "concept"
      ? `${label} (${node.count || 0} 张卡)`
      : `${label} [${node.mastery}]`;

    ctx.save();
    ctx.font = "13px sans-serif";
    const tw = ctx.measureText(info).width + 16;
    const tx = Math.min(screenPos.x + 12, rect.width - tw - 4);
    const ty = Math.max(screenPos.y - 30, 4);

    ctx.fillStyle = "rgba(30,30,50,0.9)";
    ctx.beginPath();
    ctx.roundRect(tx, ty, tw, 24, 4);
    ctx.fill();
    ctx.fillStyle = "#e0e0e0";
    ctx.fillText(info, tx + 8, ty + 6);
    ctx.restore();
  }

  _drawSearchInfo(ctx, rect) {
    if (!this.searchQuery) return;
    const count = (this.graphData.nodes || []).filter(
      (n) => n.label && n.label.toLowerCase().includes(this.searchQuery.toLowerCase()),
    ).length;
    ctx.save();
    ctx.font = "12px sans-serif";
    ctx.fillStyle = SEARCH_INFO_COLOR;
    ctx.textAlign = "left";
    ctx.fillText(`搜索: "${this.searchQuery}" — 匹配 ${count} 个节点`, 8, rect.height - 8);
    ctx.restore();
  }

  // ── 交互处理 ────────────────────────────────────────────

  _getMousePos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  handleWheel(e) {
    e.preventDefault();
    const pos = this._getMousePos(e);
    const worldBefore = screenToWorld(pos.x, pos.y, this.viewTransform);

    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const newScale = Math.max(0.2, Math.min(5.0, this.viewTransform.scale * factor));

    // 以鼠标为中心缩放
    this.viewTransform.scale = newScale;
    this.viewTransform.offsetX = pos.x - worldBefore.x * newScale;
    this.viewTransform.offsetY = pos.y - worldBefore.y * newScale;

    this.draw();
  }

  handlePointerDown(e) {
    const pos = this._getMousePos(e);
    const worldPos = screenToWorld(pos.x, pos.y, this.viewTransform);

    // 检测节点命中
    const hit = gl.hitTest(worldPos.x, worldPos.y, this.layoutNodes, (n) =>
      nodeRadius(this.graphData.nodes.find((gn) => gn.id === n.id) || n),
    );

    if (hit) {
      // 节点拖拽
      this.dragNode = hit;
      hit.pinned = true;
      const origNode = this.graphData.nodes.find((n) => n.id === hit.id);
      this.selectedNode = origNode || hit;
      if (this.options.onNodeSelect) {
        this.options.onNodeSelect(this.selectedNode);
      }
    } else {
      // 画布平移
      this.panStart = {
        x: pos.x,
        y: pos.y,
        offsetX: this.viewTransform.offsetX,
        offsetY: this.viewTransform.offsetY,
      };
    }
    this.canvas.setPointerCapture?.(e.pointerId);
  }

  handlePointerMove(e) {
    const pos = this._getMousePos(e);
    const worldPos = screenToWorld(pos.x, pos.y, this.viewTransform);

    if (this.dragNode) {
      // 更新拖拽节点位置
      this.dragNode.x = worldPos.x;
      this.dragNode.y = worldPos.y;
      this.dragNode.vx = 0;
      this.dragNode.vy = 0;
      // 同步到原始数据
      const orig = this.graphData.nodes.find((n) => n.id === this.dragNode.id);
      if (orig) { orig.x = worldPos.x; orig.y = worldPos.y; }
      this.draw();
      return;
    }

    if (this.panStart) {
      this.viewTransform.offsetX =
        this.panStart.offsetX + (pos.x - this.panStart.x);
      this.viewTransform.offsetY =
        this.panStart.offsetY + (pos.y - this.panStart.y);
      this.draw();
      return;
    }

    // hover 检测
    const hit = gl.hitTest(worldPos.x, worldPos.y, this.layoutNodes, (n) =>
      nodeRadius(this.graphData.nodes.find((gn) => gn.id === n.id) || n),
    );
    const newHovered = hit
      ? this.graphData.nodes.find((n) => n.id === hit.id) || null
      : null;
    if (newHovered !== this.hoveredNode) {
      this.hoveredNode = newHovered;
      this.canvas.style.cursor = newHovered ? "pointer" : "grab";
      this.draw();
    }
  }

  handlePointerUp(e) {
    if (this.dragNode) {
      this.dragNode.pinned = false;
      this.dragNode = null;
    }
    this.panStart = null;
    this.canvas.releasePointerCapture?.(e.pointerId);
  }

  handleDblClick(e) {
    const pos = this._getMousePos(e);
    const worldPos = screenToWorld(pos.x, pos.y, this.viewTransform);
    const hit = gl.hitTest(worldPos.x, worldPos.y, this.layoutNodes, (n) =>
      nodeRadius(this.graphData.nodes.find((gn) => gn.id === n.id) || n),
    );
    if (hit) {
      const orig = this.graphData.nodes.find((n) => n.id === hit.id);
      if (orig && this.options.onNodeDblClick) {
        this.options.onNodeDblClick(orig);
      }
    }
  }
}

// ── 导出 ──────────────────────────────────────────────────

module.exports = {
  GraphRenderer,
  MASTERY_COLORS,
  nodeRadius,
  screenToWorld,
  worldToScreen,
};
