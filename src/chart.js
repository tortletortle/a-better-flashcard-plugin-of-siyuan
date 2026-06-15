// ── 学习曲线图表 · Canvas 2D 纯函数 ─────────────────────────────
// 所有绘图函数均为纯函数：接受 canvas context + data，返回绘制结果。
// 数据聚合函数（prepareCurveData / computeCardStats）也是纯函数。

const DAY_MS = 864e5;

// ── 数据聚合 ───────────────────────────────────────────────

/**
 * 将 reviewHistory 聚合为按天的折线图数据。
 * history: [{ date: "2026-06-01", total, good, mid, weak }, …]
 * days:    最近多少天（默认 30）
 * 返回: { labels: string[], series: { total: number[], good: number[], mid: number[], weak: number[] }, max: number }
 */
function prepareCurveData(history = [], days = 30) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const map = new Map(); // "YYYY-MM-DD" → { total, good, mid, weak }
  for (const entry of history) {
    const key = entry.date;
    if (!map.has(key)) map.set(key, { total: 0, good: 0, mid: 0, weak: 0 });
    const bucket = map.get(key);
    bucket.total += entry.total || 0;
    bucket.good += entry.good || 0;
    bucket.mid += entry.mid || 0;
    bucket.weak += entry.weak || 0;
  }
  const labels = [];
  const series = { total: [], good: [], mid: [], weak: [] };
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * DAY_MS);
    const key = formatDate(d);
    labels.push(key.slice(5)); // "MM-DD"
    const bucket = map.get(key) || { total: 0, good: 0, mid: 0, weak: 0 };
    series.total.push(bucket.total);
    series.good.push(bucket.good);
    series.mid.push(bucket.mid);
    series.weak.push(bucket.weak);
  }
  let max = 0;
  for (const v of series.total) if (v > max) max = v;
  max = Math.max(max, 1); // 避免除 0
  return { labels, series, max };
}

/**
 * 从卡片数组计算统计概览。
 * 返回: { total, good, mid, weak, unknown, avgReps, avgEase, avgInterval, streak, totalReviews }
 */
function computeCardStats(cards = [], history = []) {
  let good = 0, mid = 0, weak = 0, unknown = 0;
  let totalReps = 0, totalEase = 0, totalInterval = 0, count = 0;
  for (const card of cards) {
    count++;
    const now = Date.now();
    const state = String(card.state ?? card.riffCard?.state ?? "");
    const dueAt = Number(card.due || card.dueAt || card.riffCard?.due || 0);
    const reps = Number(card.reps ?? card.riffCard?.reps ?? 0);
    const lapses = Number(card.lapses ?? card.riffCard?.lapses ?? 0);
    const ease = Number(card.ease ?? card.riffCard?.ease ?? 2.5);
    const interval = Number(card.interval ?? card.riffCard?.interval ?? 0);
    totalReps += reps;
    totalEase += ease;
    totalInterval += interval;
    if (lapses > 0 || (dueAt && dueAt < now - DAY_MS) || ["1", "again", "forgot"].includes(state)) {
      weak++;
    } else if (!dueAt && !reps && !state) {
      unknown++;
    } else if ((dueAt && dueAt <= now + 2 * DAY_MS) || reps < 2 || ["2", "hard", "new"].includes(state)) {
      mid++;
    } else {
      good++;
    }
  }
  const totalReviews = history.reduce((sum, e) => sum + (e.total || 0), 0);
  // 计算连续打卡天数
  const reviewDays = new Set(history.map(e => e.date));
  let streak = 0;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 365; i++) {
    const d = new Date(today.getTime() - i * DAY_MS);
    if (reviewDays.has(formatDate(d))) streak++;
    else break;
  }
  return {
    total: count, good, mid, weak, unknown,
    avgReps: count ? +(totalReps / count).toFixed(1) : 0,
    avgEase: count ? +(totalEase / count).toFixed(2) : 0,
    avgInterval: count ? Math.round(totalInterval / count) : 0,
    streak,
    totalReviews,
  };
}

// ── 折线图绘制 ───────────────────────────────────────────────

const DARK_COLORS = {
  total: "#5b8def",
  good:  "#2f9e44",
  mid:   "#f2b705",
  weak:  "#d64545",
  grid:  "rgba(255,255,255,0.06)",
  axis:  "rgba(255,255,255,0.3)",
  text:  "rgba(255,255,255,0.5)",
  bg:    "#1a1a2e",
  title: "rgba(255,255,255,0.85)",
  hover: "rgba(255,255,255,0.25)",
  tipBg: "rgba(30,30,50,0.92)",
  tipBorder: "rgba(255,255,255,0.15)",
  tipText: "rgba(255,255,255,0.85)",
  cardBg: "rgba(255,255,255,0.04)",
  accent: "#c084fc",
  dim:   "rgba(255,255,255,0.45)",
  kpi:   "rgba(255,255,255,0.92)",
  ringCenter: "rgba(255,255,255,0.9)",
  unknown: "rgba(255,255,255,0.2)",
};

const LIGHT_COLORS = {
  total: "#3b6fd9",
  good:  "#2b8a3e",
  mid:   "#e67700",
  weak:  "#c92a2a",
  grid:  "rgba(0,0,0,0.06)",
  axis:  "rgba(0,0,0,0.2)",
  text:  "rgba(0,0,0,0.45)",
  bg:    "#ffffff",
  title: "rgba(0,0,0,0.8)",
  hover: "rgba(0,0,0,0.15)",
  tipBg: "rgba(255,255,255,0.95)",
  tipBorder: "rgba(0,0,0,0.12)",
  tipText: "rgba(0,0,0,0.8)",
  cardBg: "rgba(0,0,0,0.03)",
  accent: "#7c3aed",
  dim:   "rgba(0,0,0,0.4)",
  kpi:   "rgba(0,0,0,0.85)",
  ringCenter: "rgba(0,0,0,0.85)",
  unknown: "rgba(0,0,0,0.12)",
};

const COLORS = DARK_COLORS; // backward compat

/**
 * 根据 canvas 父元素的主题判断深色/浅色。
 * 读取 SiYuan 的 --b3-theme-background CSS 变量，计算亮度。
 * @param {HTMLCanvasElement} [canvasEl]
 * @returns {object} 颜色配置
 */
function getThemeColors(canvasEl) {
  try {
    const el = canvasEl?.parentElement || canvasEl;
    if (el && typeof getComputedStyle === "function") {
      const bg = getComputedStyle(el).getPropertyValue("--b3-theme-background").trim();
      if (bg) {
        // 解析颜色判断亮度
        const temp = document.createElement("div");
        temp.style.color = bg;
        document.body.appendChild(temp);
        const computed = getComputedStyle(temp).color;
        document.body.removeChild(temp);
        const match = computed.match(/(\d+)/g);
        if (match && match.length >= 3) {
          const luminance = (parseInt(match[0]) * 299 + parseInt(match[1]) * 587 + parseInt(match[2]) * 114) / 1000;
          if (luminance > 128) return LIGHT_COLORS;
        }
      }
    }
  } catch (_) { /* ignore */ }
  return DARK_COLORS;
}

const LINE_NAMES = ["total", "good", "mid", "weak"];
const LINE_LABELS = { total: "总复习", good: "熟悉", mid: "中间", weak: "薄弱" };

/**
 * 绘制学习曲线折线图。
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ width: number, height: number }} rect
 * @param {{ labels: string[], series: object, max: number }} data
 * @param {{ hoverIndex?: number|null }} opts
 * @returns {{ plotX: number[], plotY: number, plotW: number, plotH: number }} — 用于鼠标命中计算
 */
function drawLearningCurve(ctx, rect, data, opts = {}) {
  const { width: W, height: H } = rect;
  const dpr = ctx.canvas.width / W || 1;
  const C = opts.colors || COLORS;
  ctx.save();
  ctx.scale(dpr, dpr);

  // 清除
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  const PAD = { top: 32, right: 20, bottom: 40, left: 48 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const n = data.labels.length;

  // 标题
  ctx.fillStyle = C.title;
  ctx.font = "bold 13px system-ui";
  ctx.textAlign = "left";
  ctx.fillText("学习曲线（近 " + n + " 天）", PAD.left, 20);

  // 图例
  let legendX = W - PAD.right;
  ctx.font = "11px system-ui";
  ctx.textAlign = "right";
  for (let i = LINE_NAMES.length - 1; i >= 0; i--) {
    const name = LINE_NAMES[i];
    const label = LINE_LABELS[name];
    ctx.fillStyle = C[name];
    ctx.fillText(label, legendX, 20);
    legendX -= ctx.measureText(label).width + 6;
    ctx.fillRect(legendX - 10, 13, 8, 8);
    legendX -= 18;
  }

  // Y 轴网格
  const ySteps = niceSteps(data.max, 5);
  ctx.font = "10px system-ui";
  ctx.textAlign = "right";
  ctx.fillStyle = C.text;
  for (const v of ySteps) {
    const y = PAD.top + plotH - (v / data.max) * plotH;
    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD.left, y);
    ctx.lineTo(PAD.left + plotW, y);
    ctx.stroke();
    ctx.fillText(String(Math.round(v)), PAD.left - 6, y + 3);
  }

  // X 轴标签（每隔 5 天显示）
  ctx.textAlign = "center";
  ctx.fillStyle = C.text;
  const plotX = [];
  for (let i = 0; i < n; i++) {
    const x = PAD.left + (i / (n - 1 || 1)) * plotW;
    plotX.push(x);
    if (i % 5 === 0 || i === n - 1) {
      ctx.fillText(data.labels[i], x, H - PAD.bottom + 16);
    }
  }

  // 绘制每条折线
  for (const name of LINE_NAMES) {
    const values = data.series[name];
    ctx.strokeStyle = C[name];
    ctx.lineWidth = name === "total" ? 2.5 : 1.5;
    ctx.lineJoin = "round";
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = plotX[i];
      const y = PAD.top + plotH - (values[i] / data.max) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // 数据点
    if (name === "total") {
      ctx.fillStyle = C[name];
      for (let i = 0; i < n; i++) {
        const x = plotX[i];
        const y = PAD.top + plotH - (values[i] / data.max) * plotH;
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Hover 竖线 + 气泡
  const hi = opts.hoverIndex;
  if (hi != null && hi >= 0 && hi < n) {
    const hx = plotX[hi];
    ctx.strokeStyle = C.hover;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(hx, PAD.top);
    ctx.lineTo(hx, PAD.top + plotH);
    ctx.stroke();
    ctx.setLineDash([]);

    // 数据点高亮
    for (const name of LINE_NAMES) {
      const val = data.series[name][hi];
      const y = PAD.top + plotH - (val / data.max) * plotH;
      ctx.fillStyle = C[name];
      ctx.beginPath();
      ctx.arc(hx, y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // 气泡
    drawTooltip(ctx, hx, PAD.top - 4, data.labels[hi], {
      total: data.series.total[hi],
      good: data.series.good[hi],
      mid: data.series.mid[hi],
      weak: data.series.weak[hi],
    }, C);
  }

  // 坐标轴线
  ctx.strokeStyle = C.axis;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD.left, PAD.top);
  ctx.lineTo(PAD.left, PAD.top + plotH);
  ctx.lineTo(PAD.left + plotW, PAD.top + plotH);
  ctx.stroke();

  ctx.restore();
  return { plotX, plotY: PAD.top, plotW, plotH };
}

// ── 掌握度环形图 ───────────────────────────────────────────────

/**
 * 绘制掌握度环形图。
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ width, height }} rect
 * @param {{ good, mid, weak, unknown }} counts
 */
function drawMasteryDonut(ctx, rect, counts, opts = {}) {
  const { width: W, height: H } = rect;
  const dpr = ctx.canvas.width / W || 1;
  const C = opts.colors || COLORS;
  ctx.save();
  ctx.scale(dpr, dpr);

  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  const cx = W * 0.35, cy = H * 0.52;
  const outerR = Math.min(cx - 12, cy - 28) * 0.85;
  const innerR = outerR * 0.58;
  const total = counts.good + counts.mid + counts.weak + counts.unknown || 1;

  // 标题
  ctx.fillStyle = C.title;
  ctx.font = "bold 13px system-ui";
  ctx.textAlign = "left";
  ctx.fillText("掌握度分布", 12, 20);

  const slices = [
    { label: "熟悉", value: counts.good, color: C.good },
    { label: "中间", value: counts.mid, color: C.mid },
    { label: "薄弱", value: counts.weak, color: C.weak },
    { label: "未知", value: counts.unknown, color: C.unknown },
  ];

  let angle = -Math.PI / 2;
  for (const slice of slices) {
    const sweep = (slice.value / total) * Math.PI * 2;
    if (sweep <= 0) continue;
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, angle, angle + sweep);
    ctx.arc(cx, cy, innerR, angle + sweep, angle, true);
    ctx.closePath();
    ctx.fillStyle = slice.color;
    ctx.fill();
    angle += sweep;
  }

  // 中心文字
  ctx.fillStyle = C.ringCenter;
  ctx.font = "bold 18px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(total), cx, cy - 6);
  ctx.font = "10px system-ui";
  ctx.fillStyle = C.text;
  ctx.fillText("卡片总数", cx, cy + 12);

  // 右侧图例
  const lx = W * 0.65;
  let ly = H * 0.22;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  for (const slice of slices) {
    ctx.fillStyle = slice.color;
    ctx.fillRect(lx, ly, 10, 10);
    ctx.fillStyle = C.text;
    ctx.font = "12px system-ui";
    ctx.fillText(`${slice.label}`, lx + 16, ly);
    ctx.fillStyle = C.dim;
    ctx.font = "11px system-ui";
    ctx.fillText(`${slice.value} (${Math.round(slice.value / total * 100)}%)`, lx + 16, ly + 15);
    ly += 38;
  }

  ctx.restore();
}

// ── 统计概览面板 ───────────────────────────────────────────────

/**
 * 绘制统计 KPI 卡片。
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ width, height }} rect
 * @param {object} stats — computeCardStats 返回值
 */
function drawStatsOverview(ctx, rect, stats, opts = {}) {
  const { width: W, height: H } = rect;
  const dpr = ctx.canvas.width / W || 1;
  const C = opts.colors || COLORS;
  ctx.save();
  ctx.scale(dpr, dpr);

  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  const kpis = [
    { label: "总复习次数", value: stats.totalReviews, color: C.total },
    { label: "连续打卡", value: `${stats.streak} 天`, color: "#f59f00" },
    { label: "平均复习次数", value: stats.avgReps, color: C.good },
    { label: "平均间隔(天)", value: stats.avgInterval, color: C.mid },
    { label: "平均 Ease", value: stats.avgEase, color: C.accent },
    { label: "卡片总数", value: stats.total, color: C.dim },
  ];

  const cols = 3;
  const rows = 2;
  const cardW = (W - 24) / cols;
  const cardH = (H - 16) / rows;

  for (let i = 0; i < kpis.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = 8 + col * (cardW + 4);
    const y = 8 + row * (cardH + 4);
    const kpi = kpis[i];

    // 卡片背景
    ctx.fillStyle = C.cardBg;
    roundRect(ctx, x, y, cardW - 4, cardH - 4, 8);
    ctx.fill();

    // 顶部色条
    ctx.fillStyle = kpi.color;
    ctx.fillRect(x + 8, y + 4, 24, 3);

    // 数值
    ctx.fillStyle = C.kpi;
    ctx.font = "bold 20px system-ui";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(String(kpi.value), x + 8, y + 14);

    // 标签
    ctx.fillStyle = C.dim;
    ctx.font = "10px system-ui";
    ctx.fillText(kpi.label, x + 8, y + cardH - 22);
  }

  ctx.restore();
}

// ── 辅助函数 ───────────────────────────────────────────────

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function niceSteps(max, approxCount) {
  if (max <= 0) return [0];
  const raw = max / approxCount;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  let step;
  if (norm <= 1) step = 1 * mag;
  else if (norm <= 2) step = 2 * mag;
  else if (norm <= 5) step = 5 * mag;
  else step = 10 * mag;
  const steps = [];
  for (let v = 0; v <= max; v += step) {
    steps.push(Math.round(v * 100) / 100);
  }
  if (steps[steps.length - 1] < max) steps.push(Math.ceil(max / step) * step);
  return steps;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawTooltip(ctx, x, y, dateLabel, values, C) {
  C = C || COLORS;
  ctx.save();
  const lines = [
    dateLabel,
    `总: ${values.total}  熟: ${values.good}`,
    `中: ${values.mid}  薄: ${values.weak}`,
  ];
  ctx.font = "11px system-ui";
  let maxW = 0;
  for (const line of lines) {
    const w = ctx.measureText(line).width;
    if (w > maxW) maxW = w;
  }
  const padH = 8, padV = 5;
  const lineH = 16;
  const tipW = maxW + padH * 2;
  const tipH = lines.length * lineH + padV * 2;
  let tx = x - tipW / 2;
  let ty = y - tipH - 8;
  // 边界修正
  const canvasW = ctx.canvas.width / (ctx.canvas.width / ctx.canvas.getBoundingClientRect().width || 1);
  if (tx < 4) tx = 4;
  if (tx + tipW > canvasW - 4) tx = canvasW - tipW - 4;
  if (ty < 4) ty = y + 8;

  ctx.fillStyle = C.tipBg;
  ctx.strokeStyle = C.tipBorder;
  ctx.lineWidth = 1;
  roundRect(ctx, tx, ty, tipW, tipH, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = C.tipText;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], tx + padH, ty + padV + i * lineH);
  }
  ctx.restore();
}

/**
 * 根据鼠标 X 坐标计算 hover 的日期索引。
 * @param {number} mouseX — CSS 像素坐标
 * @param {{ plotX: number[] }} layout — drawLearningCurve 返回值
 * @returns {number|null}
 */
function hitTestCurve(mouseX, layout) {
  if (!layout?.plotX?.length) return null;
  let best = -1, bestDist = Infinity;
  for (let i = 0; i < layout.plotX.length; i++) {
    const d = Math.abs(layout.plotX[i] - mouseX);
    if (d < bestDist) { bestDist = d; best = i; }
  }
  return bestDist < 30 ? best : null;
}

// ── 导出 ───────────────────────────────────────────────

module.exports = {
  prepareCurveData,
  computeCardStats,
  drawLearningCurve,
  drawMasteryDonut,
  drawStatsOverview,
  hitTestCurve,
  formatDate,
  niceSteps,
  getThemeColors,
  COLORS,
  DARK_COLORS,
  LIGHT_COLORS,
  LINE_NAMES,
  LINE_LABELS,
};
