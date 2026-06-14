const { Plugin, showMessage, getFrontend } = require("siyuan");

const KEY = "flashcard-state";
const DOCK = "ai_flashcards_dock";

const SAMPLE = [
  ["大脑的两种工作模式是什么？", "专注模式和发散模式。学习需要两者交替使用。"],
  ["什么是组块化？", "把零散知识点练成自动化整体，释放工作记忆。"],
  ["为什么重复阅读低效？", "它只产生熟悉感，不等于真正记住；主动回忆更有效。"],
  ["什么是合意困难？", "费力的学习更能强化记忆，太轻松往往无效。"],
  ["间隔重复为什么好？", "每次间隔后的重新回忆都会强化记忆痕迹。"],
  ["番茄工作法核心是什么？", "25分钟专注+5分钟休息，降低启动门槛。"],
  ["什么是刻意练习？", "在能力边缘、针对弱点、有目标、有反馈。"],
];

module.exports = class AIFlashcardsPlugin extends Plugin {
  async onload() {
    this.isMobile = ["mobile", "browser-mobile"].includes(getFrontend());
    this.state = (await this.loadData(KEY).catch(() => null)) || this.def();
    this.gen = [];
    this.q = [];
    this.cur = null;
    this.done = 0;

    this.addIcons(`
      <symbol id="iconFlashcardsAI" viewBox="0 0 32 32">
        <path d="M6 7a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-5l-4.8 4.2A1 1 0 0 1 11 25.5V22H9a3 3 0 0 1-3-3V7zm6 3h8v2h-8v-2zm0 4h6v2h-6v-2z"></path>
      </symbol>`);

    this.addTopBar({
      icon: "iconFlashcardsAI",
      title: this.i18n.addTopBarIcon,
      position: "right",
      callback: () => this.openDock(),
    });

    this.addDock({
      config: {
        position: "RightBottom",
        size: { width: 450, height: 0 },
        icon: "iconFlashcardsAI",
        title: this.i18n.dockTitle,
      },
      data: {},
      type: DOCK,
      init: (d) => {
        d.element.innerHTML = this.shell();
        this.bind(d.element);
        this.render(d.element);
      },
      update: (d) => this.render(d.element),
      destroy() {},
    });
  }

  def() {
    return {
      reviewedToday: 0,
      lastDay: this.day(),
      settings: { provider: "offline", baseUrl: "", apiKey: "", model: "gpt-4o-mini" },
      cards: [],
    };
  }

  day() {
    return new Date().toISOString().slice(0, 10);
  }

  uid() {
    return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  esc(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  fixDay() {
    if (this.state.lastDay !== this.day()) {
      this.state.lastDay = this.day();
      this.state.reviewedToday = 0;
    }
  }

  async save() {
    this.fixDay();
    await this.saveData(KEY, this.state);
  }

  openDock() {
    document.querySelector(`[data-type="${DOCK}"]`)?.click();
  }

  due() {
    const n = Date.now();
    return this.state.cards.filter((c) => (c.dueAt || 0) <= n).sort((a, b) => (a.dueAt || 0) - (b.dueAt || 0));
  }

  resetQ() {
    this.q = this.due();
    this.cur = this.q.shift() || null;
    this.done = 0;
  }

  card(f, b) {
    return { id: this.uid(), front: f, back: b, dueAt: Date.now(), interval: 0, ease: 2.5, reps: 0, lapses: 0 };
  }

  shell() {
    return `
      <div class="aiflash-wrap">
        <div class="aiflash-head">
          <h3>${this.i18n.dockTitle}</h3>
          <span class="aiflash-badge">Pro</span>
        </div>
        <div class="aiflash-tabs">
          <button class="b3-button b3-button--outline aiflash-tab active" data-tab="review">复习</button>
          <button class="b3-button b3-button--outline aiflash-tab" data-tab="gen">生成</button>
          <button class="b3-button b3-button--outline aiflash-tab" data-tab="lib">卡片</button>
          <button class="b3-button b3-button--outline aiflash-tab" data-tab="set">设置</button>
        </div>
        <div class="aiflash-view active" data-view="review"><div id="af-review"></div></div>
        <div class="aiflash-view" data-view="gen">
          <textarea class="b3-text-field fn__block aiflash-textarea" id="af-src" placeholder="粘贴笔记内容..."></textarea>
          <div class="fn__flex aiflash-gap">
            <select class="b3-select" id="af-count"><option>5</option><option selected>10</option><option>15</option></select>
            <select class="b3-select" id="af-level"><option>基础</option><option selected>考试</option><option>深度理解</option></select>
          </div>
          <div class="fn__flex aiflash-gap">
            <button class="b3-button b3-button--outline" id="af-gen">生成闪卡</button>
            <button class="b3-button b3-button--outline" id="af-add">加入复习</button>
            <button class="b3-button b3-button--outline" id="af-clear">清空</button>
          </div>
          <div class="aiflash-result" id="af-result"></div>
        </div>
        <div class="aiflash-view" data-view="lib">
          <input class="b3-text-field fn__block" id="af-search" placeholder="搜索卡片">
          <div id="af-lib"></div>
        </div>
        <div class="aiflash-view" data-view="set">
          <select class="b3-select fn__block" id="af-provider">
            <option value="offline">离线规则</option>
            <option value="openai">OpenAI 官方</option>
            <option value="openai_compatible">OpenAI 兼容</option>
            <option value="custom">自定义 HTTP</option>
          </select>
          <input class="b3-text-field fn__block" id="af-url" placeholder="接口地址，如 https://api.openai.com/v1/chat/completions">
          <input class="b3-text-field fn__block" id="af-key" placeholder="API Key，可留空">
          <input class="b3-text-field fn__block" id="af-model" placeholder="模型名">
          <div class="fn__flex aiflash-gap">
            <button class="b3-button b3-button--outline" id="af-test">测试连接</button>
            <button class="b3-button b3-button--outline" id="af-save">保存</button>
            <button class="b3-button b3-button--outline" id="af-sample">导入示例</button>
          </div>
        </div>
      </div>`;
  }

  bind(r) {
    r.querySelectorAll(".aiflash-tab").forEach((t) =>
      t.onclick = () => {
        r.querySelectorAll(".aiflash-tab").forEach((x) => x.classList.remove("active"));
        r.querySelectorAll(".aiflash-view").forEach((x) => x.classList.remove("active"));
        t.classList.add("active");
        r.querySelector(`[data-view="${t.dataset.tab}"]`).classList.add("active");
      }
    );

    r.querySelector("#af-gen").onclick = async () => {
      const text = r.querySelector("#af-src").value.trim();
      if (!text) return showMessage("请先粘贴内容");
      try {
        this.gen = await this.ai(text, +r.querySelector("#af-count").value, r.querySelector("#af-level").value);
        showMessage("生成完成");
      } catch (e) {
        this.gen = this.offline(text, +r.querySelector("#af-count").value, r.querySelector("#af-level").value);
        showMessage("AI失败，已用离线规则");
      }
      this.renderGen(r);
    };

    r.querySelector("#af-add").onclick = async () => {
      if (!this.gen.length) return showMessage("没有可加入的卡片");
      const n = this.gen.length;
      this.gen.forEach((c) => this.state.cards.push(this.card(c.front, c.back)));
      this.gen = [];
      r.querySelector("#af-src").value = "";
      this.resetQ();
      await this.save();
      this.render(r);
      showMessage(`已加入 ${n} 张卡片，并清空生成区`);
    };

    r.querySelector("#af-clear").onclick = () => {
      this.gen = [];
      r.querySelector("#af-src").value = "";
      this.renderGen(r);
      showMessage("已清空");
    };

    r.querySelector("#af-save").onclick = async () => {
      this.readSet(r);
      await this.save();
      showMessage("设置已保存");
    };

    r.querySelector("#af-test").onclick = async () => {
      this.readSet(r);
      try {
        const x = await this.ai("苹果是一种常见水果，富含膳食纤维。", 1, "基础");
        showMessage(x.length ? "AI 连接成功" : "接口响应异常");
      } catch (e) {
        showMessage("AI 连接失败：" + e.message);
      }
    };

    r.querySelector("#af-sample").onclick = async () => {
      SAMPLE.forEach(([f, b]) => this.state.cards.push(this.card(f, b)));
      this.resetQ();
      await this.save();
      this.render(r);
      showMessage("已导入示例");
    };

    r.querySelector("#af-search").oninput = () => this.renderLib(r);
  }

  readSet(r) {
    this.state.settings = {
      provider: r.querySelector("#af-provider").value,
      baseUrl: r.querySelector("#af-url").value.trim(),
      apiKey: r.querySelector("#af-key").value.trim(),
      model: r.querySelector("#af-model").value.trim() || "gpt-4o-mini",
    };
  }

  render(r) {
    this.fixDay();
    this.resetQ();
    const s = this.state.settings;
    r.querySelector("#af-provider").value = s.provider || "offline";
    r.querySelector("#af-url").value = s.baseUrl || "";
    r.querySelector("#af-key").value = s.apiKey || "";
    r.querySelector("#af-model").value = s.model || "gpt-4o-mini";
    this.renderReview(r);
    this.renderGen(r);
    this.renderLib(r);
  }

  renderReview(r) {
    const box = r.querySelector("#af-review");
    const total = this.done + this.q.length + (this.cur ? 1 : 0);
    if (!this.cur) {
      box.innerHTML = `<div class="aiflash-empty">今天没有待复习卡片。总卡片：${this.state.cards.length}，今日已学：${this.state.reviewedToday || 0}</div>`;
      return;
    }
    box.innerHTML = `
      <div class="aiflash-stat">今日已学 ${this.state.reviewedToday || 0} · 当前轮次 ${this.done}/${total}</div>
      <div class="aiflash-review-card">
        <div class="aiflash-q">${this.esc(this.cur.front)}</div>
        <details>
          <summary>显示答案</summary>
          <div class="aiflash-a">${this.esc(this.cur.back)}</div>
          <div class="aiflash-grade-row">
            <button class="b3-button b3-button--outline" data-g="0">重来</button>
            <button class="b3-button b3-button--outline" data-g="3">困难</button>
            <button class="b3-button b3-button--outline" data-g="4">良好</button>
            <button class="b3-button b3-button--outline" data-g="5">简单</button>
          </div>
        </details>
      </div>`;
    box.querySelectorAll("[data-g]").forEach((b) =>
      b.onclick = async () => {
        this.grade(+b.dataset.g);
        await this.save();
        this.render(r);
      }
    );
  }

  renderGen(r) {
    r.querySelector("#af-result").innerHTML = this.gen.length
      ? this.gen.map((c, i) => `<div class="aiflash-item"><strong>${i + 1}. ${this.esc(c.front)}</strong><div>${this.esc(c.back)}</div></div>`).join("")
      : `<div class="aiflash-empty">生成结果会显示在这里</div>`;
  }

  renderLib(r) {
    const q = (r.querySelector("#af-search")?.value || "").toLowerCase();
    const cs = this.state.cards.filter((c) => !q || (c.front + c.back).toLowerCase().includes(q));
    r.querySelector("#af-lib").innerHTML = cs.length
      ? cs.map((c) => `<div class="aiflash-item"><strong>${this.esc(c.front)}</strong><div>${this.esc(c.back)}</div><small>间隔 ${c.interval} 天 · 复习 ${c.reps} 次</small></div>`).join("")
      : `<div class="aiflash-empty">暂无卡片</div>`;
  }

  grade(g) {
    const c = this.cur;
    if (!c) return;
    if (g < 3) {
      c.reps = 0;
      c.interval = 0;
      c.lapses++;
      c.ease = Math.max(1.3, c.ease - 0.2);
      c.dueAt = Date.now() + 6e4;
    } else {
      c.interval = c.reps === 0 ? 1 : c.reps === 1 ? 6 : Math.round(c.interval * c.ease);
      c.ease = Math.max(1.3, c.ease + (0.1 - (5 - g) * (0.08 + (5 - g) * 0.02)));
      if (g === 3) c.interval = Math.max(1, Math.round(c.interval * 0.6));
      if (g === 5) c.interval = Math.round(c.interval * 1.35 + 1);
      c.reps++;
      c.dueAt = Date.now() + c.interval * 864e5;
    }
    this.state.reviewedToday = (this.state.reviewedToday || 0) + 1;
    this.done++;
    this.cur = this.q.shift() || null;
  }

  clean(t) {
    return t.replace(/^#{1,6}\s*/gm, "").replace(/[*_`>#-]/g, "").trim();
  }

  offline(text, count, level) {
    const a = [];
    text.split(/\n(?=#{1,6}\s*)/).forEach((b) => {
      const m = b.trim().match(/^(?:#{1,6}\s*)?(.+?[？?])\s*\n+([\s\S]+)/);
      if (m) a.push({ front: this.clean(m[1]), back: this.clean(m[2]) });
    });
    const ps = text
      .split(/\n{2,}|(?<=。)|(?<=？)|(?<=！)/)
      .map((x) => this.clean(x))
      .filter((x) => x.length > 12);
    for (const p of ps) {
      if (a.length >= count) break;
      const k = (p.match(/什么是(.+?)[？?，。]/) || p.match(/(.+?)是指/) || [])[1] || p.slice(0, 18);
      a.push({ front: level === "深度理解" ? `为什么“${k}”重要？` : `什么是“${k}”？`, back: p });
    }
    return a.slice(0, count);
  }

  prompt(t, c, l) {
    return `根据材料制作${c}张中文闪卡，难度${l}。每张卡只考一个点。只输出JSON数组[{"front":"问题","back":"答案"}]。材料：\n${t}`;
  }

  parse(d) {
    const x = d?.choices?.[0]?.message?.content ?? d?.text ?? d?.content ?? d?.result ?? d?.output ?? d;
    const raw = typeof x === "string" ? x.replace(/```json|```/g, "").trim() : JSON.stringify(x);
    const y = JSON.parse(raw);
    return Array.isArray(y) ? y.filter((z) => z.front && z.back) : [];
  }

  async ai(text, count, level) {
    const s = this.state.settings;
    if ((s.provider || "offline") === "offline") return this.offline(text, count, level);
    let url = (s.baseUrl || "").trim();
    if (!url && s.provider === "openai") url = "https://api.openai.com/v1/chat/completions";
    if (!url) throw Error("未配置接口地址");
    const h = { "Content-Type": "application/json" };
    if (s.apiKey) h.Authorization = `Bearer ${s.apiKey}`;
    const body = { model: s.model || "gpt-4o-mini", temperature: 0.3, messages: [{ role: "user", content: this.prompt(text, count, level) }] };
    const res = await fetch(url, { method: "POST", headers: h, body: JSON.stringify(body) });
    if (!res.ok) throw Error(`HTTP ${res.status}`);
    return this.parse(await res.json()).slice(0, count);
  }
};
