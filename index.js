const {
  Plugin,
  showMessage,
  getFrontend,
  openTab,
  fetchSyncPost,
  Constants,
} = require("siyuan");

const _pluginDir = (window.siyuan?.config?.system?.workspaceDir || "").replace(/[\\/]+$/, "") + "/data/plugins/ai-flashcards-native";

const {
  esc,
  day,
  uid,
  firstDefined,
  numberFromApi: _numberFromApi,
  parseTime,
  dueText: _dueText,
  cardMastery: _cardMastery,
  masteryScore: _masteryScore,
  masteryLabel: _masteryLabel,
  cleanBlockMarkdown: _cleanBlockMarkdown,
  cleanFileName: _cleanFileName,
  safeMd: _safeMd,
  extractID: _extractID,
  mdHTML: _mdHTML,
  repairMathSegment,
  repairPlainText,
  repairFormulaText: _repairFormulaText,
  normalizeCardText: _normalizeCardText,
  clean: _clean,
  parse: _parse,
} = require(_pluginDir + "/src/utils");

const tl = require(_pluginDir + "/src/trainer-logic");
const gd = require(_pluginDir + "/src/graph-data");
const gl = require(_pluginDir + "/src/graph-layout");
const { GraphRenderer } = require(_pluginDir + "/src/graph-render");
const chart = require(_pluginDir + "/src/chart");
const sa = require(_pluginDir + "/src/siyuan-api");
const lr = require(_pluginDir + "/src/lib-render");
const tui = require(_pluginDir + "/src/trainer-ui");

const KEY = "flashcard-state";
const DOCK = "ai_flashcards_native_dock";
const TAB_TYPE = "ai_flashcards_native_tab";
const GEN_PREVIEW_LIMIT = 30;
const WRITE_PROGRESS_STEP = 20;
const SAMPLE = [
  ["大脑的两种工作模式是什么？", "专注模式和发散模式。学习需要两者交替使用。"],
  ["什么是组块化？", "把零散知识点练成自动化整体，释放工作记忆。"],
  ["为什么重复阅读低效？", "它只产生熟悉感，不等于真正记住；主动回忆更有效。"],
  ["什么是合意困难？", "费力的学习更能强化记忆，太轻松往往无效。"],
  ["间隔重复为什么好？", "每次间隔后的重新回忆都会强化记忆痕迹。"],
  ["番茄工作法核心是什么？", "25分钟专注+5分钟休息，降低启动门槛。"],
  ["什么是刻意练习？", "在能力边缘、针对弱点、有目标、有反馈。"],
];
const TRAINER_TOPICS = tl.TRAINER_TOPICS;

module.exports = class AIFlashcardsNativePlugin extends Plugin {
  async onload() {
    const plugin = this;
    this.isMobile = ["mobile", "browser-mobile"].includes(getFrontend());
    this.state = this.normalize(
      (await this.loadData(KEY).catch(() => null)) || this.def(),
    );
    await this.importLegacyTrainerState().catch((e) =>
      console.warn("import legacy trainer state failed", e),
    );
    await this.syncNativeDecks().catch((e) =>
      console.error("sync native riff decks failed", e),
    );
    this.gen = [];
    this.q = [];
    this.cur = null;
    this.done = 0;
    this.nativeCards = [];
    this.nativeCardsDeckID = "";
    this.nativeCardsPartial = false;
    this.graphZoom = 1;
    this.graphLimit = 80;
    this.graphFullscreen = false;
    this.graphWeakOnly = false;
    this.graphRenderer = null;
    this.graphSearchQuery = "";
    this.chartCurveLayout = null;
    this.roots = new Set();
    this.addIcons(
      `<symbol id="iconFlashcardsNative" viewBox="0 0 32 32"><path d="M6 7a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-5l-4.8 4.2A1 1 0 0 1 11 25.5V22H9a3 3 0 0 1-3-3V7zm6 3h8v2h-8v-2zm0 4h6v2h-6v-2z"></path></symbol>`,
    );
    this.addTopBar({
      icon: "iconFlashcardsNative",
      title: this.i18n.addTopBarIcon,
      position: "right",
      callback: () => this.openDock() || this.openWorkbench(),
    });
    this.addCommand({
      langKey: "aiFlashcardsNativeOpenReview",
      langText: "打开思源原生闪卡复习",
      hotkey: "",
      callback: () => this.openNativeReview(),
    });
    this.addCommand({
      langKey: "aiFlashcardsNativeAddSelectedBlocks",
      langText: "选中块加入当前原生闪卡卡包",
      hotkey: "",
      editorCallback: (protyle) => this.addSelectedBlocksToNativeDeck(protyle),
    });
    this.addCommand({
      langKey: "aiFlashcardsNativeGenerateSelected",
      langText: "选中内容生成并加入当前原生闪卡卡包",
      hotkey: "",
      editorCallback: (protyle) => this.generateSelectedToNativeDeck(protyle),
    });
    this.eventBus.on("open-menu-content", ({ detail }) =>
      this.addNativeBlockMenu(detail),
    );
    this.addTab({
      type: TAB_TYPE,
      init() {
        plugin.mount(this.element, "tab");
      },
      destroy() {
        plugin.roots?.delete(this.element);
      },
    });
    this.addDock({
      config: {
        position: "RightBottom",
        size: { width: 460, height: 0 },
        icon: "iconFlashcardsNative",
        title: this.i18n.dockTitle,
      },
      data: {},
      type: DOCK,
      init: (d) => this.mount(d.element, "dock"),
      update: (d) => this.render(d.element),
      destroy: (d) => d?.element && this.roots?.delete(d.element),
    });
    this.exposePublicAPI();
    console.log(this.i18n.helloPlugin);
  }

  onunload() {
    if (globalThis.aiFlashcardsNativeAPI?.plugin === this) {
      delete globalThis.aiFlashcardsNativeAPI;
    }
  }

  exposePublicAPI() {
    const plugin = this;
    const api = {
      version: "1.0.0",
      plugin: this,

      // ── 导航 & 操作 ──────────────────────────
      listDecks: () => this.listPublicDecks(),
      setActiveDeck: (deckID) => this.setActiveDeck(deckID),
      createDeck: (name) => this.createNativeDeck(name),
      addCards: (options) => this.addCardsFromAPI(options),
      generateFromText: (options) => this.generateFromTextFromAPI(options),
      addBlocks: (options) => this.addBlocksFromAPI(options),
      openWorkbench: () => this.openWorkbench(),
      openReview: () => this.openNativeReview(),
      openTrainer: () => this.openTrainer(),

      // ── 数据读取 ──────────────────────────────

      /** 获取所有卡包列表 */
      getPacks: () => (plugin.state.packs || []).map(p => ({
        id: p.id, name: p.name, cardCount: p.cardCount ?? 0,
        dueCardCount: p.dueCardCount ?? 0, quick: Boolean(p.quick),
      })),

      /** 获取指定卡包的卡片列表（默认当前卡包） */
      getCards: (packId) => {
        const id = packId || plugin.state.activePackId;
        return (plugin.state.cards || [])
          .filter(c => c.packId === id)
          .map(c => ({
            blockID: c.blockID, front: c.front, back: c.back,
            reps: c.reps ?? 0, lapses: c.lapses ?? 0,
            ease: c.ease ?? 2.5, interval: c.interval ?? 0,
            dueAt: c.dueAt, mastery: plugin.cardMastery(c),
          }));
      },

      /** 获取复习历史（最近 days 天，默认 30） */
      getReviewHistory: (days = 30) => {
        const history = plugin.state.reviewHistory || [];
        if (!days || days >= history.length) return [...history];
        return history.slice(-days);
      },

      /** 获取统计概览 */
      getStats: () => {
        const cards = plugin.state.cards || [];
        const history = plugin.state.reviewHistory || [];
        return {
          totalCards: cards.length,
          reviewedToday: plugin.state.reviewedToday || 0,
          activePackId: plugin.state.activePackId,
          activePackName: (plugin.activePack() || {}).name || "",
          ...require(_pluginDir + "/src/chart").computeCardStats(cards, history),
        };
      },

      /** 获取单张卡片掌握度 */
      getCardMastery: (cardOrBlockID) => {
        if (typeof cardOrBlockID === "string") {
          const card = (plugin.state.cards || []).find(c => c.blockID === cardOrBlockID);
          return card ? plugin.cardMastery(card) : "unknown";
        }
        return plugin.cardMastery(cardOrBlockID);
      },

      /** 获取知识图谱数据（节点+边） */
      getGraphData: (packId) => {
        const id = packId || plugin.state.activePackId;
        const cards = (plugin.state.cards || []).filter(c => c.packId === id);
        return plugin.buildGraphData(cards);
      },
    };
    globalThis.aiFlashcardsNativeAPI = api;
    window.dispatchEvent?.(
      new CustomEvent("ai-flashcards-native-api-ready", { detail: api }),
    );
  }

  def() {
    return {
      reviewedToday: 0,
      lastDay: this.day(),
      settings: {
        provider: "offline",
        baseUrl: "",
        apiKey: "",
        model: "gpt-4o-mini",
        autoDedupe: false,
      },
      activePackId: "default",
      packs: [{ id: "default", name: "默认卡包", createdAt: Date.now() }],
      storageNotebookID: "",
      storageDocID: "",
      storageDocsByDeck: {},
      cards: [],
      graphMeta: {},
      trainer: this.defaultTrainerState(),
      reviewHistory: [],
    };
  }

  normalize(state) {
    const next = state || this.def();
    if (!Array.isArray(next.packs) || !next.packs.length) {
      next.packs = [{ id: "default", name: "默认卡包", createdAt: Date.now() }];
    }
    if (
      !next.activePackId ||
      !next.packs.some((pack) => pack.id === next.activePackId)
    ) {
      next.activePackId = next.packs[0].id;
    }
    next.cards = Array.isArray(next.cards) ? next.cards : [];
    next.cards.forEach((card) => {
      if (!card.packId) {
        card.packId = next.activePackId;
      }
    });
    next.settings = next.settings || {};
    next.settings.autoDedupe = Boolean(next.settings.autoDedupe);
    next.storageNotebookID = next.storageNotebookID || "";
    next.storageDocID = next.storageDocID || "";
    next.storageDocsByDeck =
      next.storageDocsByDeck && typeof next.storageDocsByDeck === "object"
        ? next.storageDocsByDeck
        : {};
    next.graphMeta =
      next.graphMeta && typeof next.graphMeta === "object"
        ? next.graphMeta
        : {};
    next.trainer = this.normalizeTrainerState(next.trainer);
    next.reviewHistory = Array.isArray(next.reviewHistory) ? next.reviewHistory : [];
    return next;
  }

  defaultTrainerState() { return tl.defaultTrainerState(); }

  normalizeTrainerState(trainer) { return tl.normalizeTrainerState(trainer); }

  trainer() {
    if (!this.state.trainer) {
      this.state.trainer = this.defaultTrainerState();
    }
    return this.state.trainer;
  }

  trainerDebug(action, detail = "") {
    const trainer = this.trainer();
    const stamp = new Date().toLocaleTimeString();
    const line = `[${stamp}] ${action}${detail ? `：${detail}` : ""}`;
    trainer.debugLastAction = action;
    trainer.debugLog = [line, ...(Array.isArray(trainer.debugLog) ? trainer.debugLog : [])]
      .slice(0, 12);
  }

  syncTrainerInputs(sourceRoot = null) {
    const trainer = this.trainer();
    const active = document.activeElement;
    this.roots.forEach((root) => {
      if (!root?.isConnected || root === sourceRoot) {
        return;
      }
      if (
        root.contains?.(active) &&
        ["af-trainer-topic", "af-trainer-depth"].includes(active?.id)
      ) {
        return;
      }
      const topicInput = root.querySelector("#af-trainer-topic");
      if (topicInput && topicInput.value !== String(trainer.topic || "")) {
        topicInput.value = String(trainer.topic || "");
      }
      const depthSelect = root.querySelector("#af-trainer-depth");
      if (depthSelect && depthSelect.value !== String(trainer.depth || "日常理解")) {
        depthSelect.value = String(trainer.depth || "日常理解");
      }
    });
  }

  async importLegacyTrainerState() {
    if (this.state.trainerImportedAt) {
      return;
    }
    const legacy = await this.loadData("science-trainer-demo-state").catch(
      () => null,
    );
    if (!legacy || typeof legacy !== "object") {
      this.state.trainerImportedAt = this.day();
      await this.save();
      return;
    }
    const trainer = this.trainer();
    if (
      !this.state.settings?.baseUrl &&
      !this.state.settings?.apiKey &&
      !this.state.settings?.model &&
      legacy.api &&
      typeof legacy.api === "object"
    ) {
      this.state.settings.baseUrl = String(legacy.api.baseUrl || "").trim();
      this.state.settings.apiKey = String(legacy.api.apiKey || "").trim();
      this.state.settings.model =
        String(legacy.api.model || "").trim() || this.state.settings.model;
      if (this.state.settings.baseUrl) {
        this.state.settings.provider = "custom";
      }
    }
    if (!trainer.accepted.length && Array.isArray(legacy.accepted)) {
      trainer.accepted = legacy.accepted.map((card) => ({ ...card }));
    }
    if (!trainer.drafts.length && Array.isArray(legacy.drafts)) {
      trainer.drafts = legacy.drafts.map((card) => ({ ...card }));
    }
    if (!trainer.current && legacy.current && typeof legacy.current === "object") {
      trainer.current = { ...legacy.current };
    }
    trainer.topic = String(legacy.topic || trainer.topic);
    trainer.angle = String(legacy.angle || trainer.angle);
    trainer.depth = String(legacy.depth || trainer.depth);
    trainer.mobileView = ["input", "drafts", "library"].includes(
      legacy.mobileView,
    )
      ? legacy.mobileView
      : trainer.mobileView;
    trainer.apiStatus = legacy.apiStatus || trainer.apiStatus;
    trainer.writeStatus = legacy.writeStatus || trainer.writeStatus;
    trainer.workbenchStatus = legacy.workbenchStatus || trainer.workbenchStatus;
    this.state.trainerImportedAt = this.day();
    await this.save();
  }

  async api(path, data = {}) {
    const response = await fetchSyncPost(path, data);
    if (!response || response.code !== 0) {
      throw Error(response?.msg || `${path} 调用失败`);
    }
    return response.data;
  }

  riffDeckID(deck) { return sa.riffDeckID(deck); }
  quickDeckID() { return sa.quickDeckID(); }
  isQuickDeckID(deckID) { return sa.isQuickDeckID(deckID); }
  riffDecksFromApi(data) { return sa.riffDecksFromApi(data); }
  deckFromApi(deck) { return sa.deckFromApi(deck); }
  createdDeckFromApi(data, name) { return sa.createdDeckFromApi(data, name); }

  firstDefined(...values) { return firstDefined(...values); }
  numberFromApi(...values) { return _numberFromApi(...values); }

  async quickDeckFromApi() {
    const id = this.quickDeckID();
    if (!id) return null;
    const data = await this.api("/api/riff/getRiffCards", {
      id, deckID: id, page: 1, pageSize: 1,
    });
    const total = sa.numberFrom([data?.total, data?.count, data?.size, Array.isArray(data) ? data.length : 0]);
    return this.deckFromApi({ id, name: "快速制卡", cardCount: total, size: total, quick: true });
  }

  async syncNativeDecks() {
    const data = await this.api("/api/riff/getRiffDecks");
    const packs = this.riffDecksFromApi(data).map((deck) => this.deckFromApi(deck));
    const quickPack = await this.quickDeckFromApi().catch((e) => {
      console.warn("load quick riff deck failed", e);
      return null;
    });
    if (quickPack?.id && !packs.some((pack) => pack.id === quickPack.id)) {
      packs.unshift(quickPack);
    }
    if (packs.length) {
      this.state.packs = packs;
      if (!this.state.activePackId || !packs.some((pack) => pack.id === this.state.activePackId)) {
        this.state.activePackId = packs[0].id;
      }
      this.lastDeckSyncAt = Date.now();
      await this.save();
      return;
    }
    const qid = this.quickDeckID();
    if (qid) {
      this.state.packs = [{ id: qid, name: "快速制卡", cardCount: 0, size: 0, quick: true, native: true }];
      this.state.activePackId = qid;
      this.lastDeckSyncAt = Date.now();
      await this.save();
    }
  }

  async listPublicDecks() {
    await this.syncNativeDecks().catch(() => null);
    return this.state.packs.map((pack) => ({
      id: pack.id, name: pack.name,
      cardCount: pack.cardCount || 0, dueCardCount: pack.dueCardCount || 0,
      active: pack.id === this.state.activePackId,
    }));
  }

  async setActiveDeck(deckID) {
    await this.syncNativeDecks().catch(() => null);
    const deck = this.state.packs.find((pack) => pack.id === deckID);
    if (!deck) {
      throw Error(`未找到卡包：${deckID}`);
    }
    this.state.activePackId = deck.id;
    await this.save();
    this.renderAll();
    return deck;
  }

  async createNativeDeck(name) {
    const deckName = String(name || "").trim();
    if (!deckName) {
      throw Error("卡包名称不能为空");
    }
    const data = await this.api("/api/riff/createRiffDeck", { name: deckName });
    const deck = this.createdDeckFromApi(data, deckName);
    await this.syncNativeDecks().catch(() => null);
    if (!this.state.packs.some((pack) => pack.id === deck.id)) {
      this.state.packs.push(deck);
    }
    this.state.activePackId = deck.id;
    await this.save();
    this.renderAll();
    return deck;
  }

  async resolveDeck(options = {}) {
    await this.syncNativeDecks().catch(() => null);
    const deckID = String(options.deckID || options.deckId || "").trim();
    if (deckID) {
      const deck = this.state.packs.find((pack) => pack.id === deckID);
      if (!deck) {
        throw Error(`未找到卡包：${deckID}`);
      }
      return deck;
    }
    const deckName = String(options.deckName || options.packName || "").trim();
    if (deckName) {
      const deck = this.state.packs.find((pack) => pack.name === deckName);
      if (deck) {
        return deck;
      }
      if (options.createDeck !== false) {
        return this.createNativeDeck(deckName);
      }
      throw Error(`未找到卡包：${deckName}`);
    }
    const active = this.activePack();
    if (!active?.id) {
      throw Error("请先选择一个思源原生卡包");
    }
    return active;
  }

  async addCardsFromAPI(options = {}) {
    const cards = Array.isArray(options.cards) ? options.cards : [];
    if (!cards.length) {
      throw Error("cards 不能为空");
    }
    const deck = await this.resolveDeck(options);
    const result = await this.addCardsToNativeDeck(cards, deck.id);
    if (options.openWorkbench) {
      this.openWorkbench();
    }
    showMessage(`Copilot 已加入 ${result.count} 张原生闪卡`);
    return { ...result, deck };
  }

  async generateFromTextFromAPI(options = {}) {
    const text = String(options.text || options.source || "").trim();
    if (!text) {
      throw Error("text 不能为空");
    }
    const deck = await this.resolveDeck(options);
    const count = this.normalizeGenerateCount(
      options.count,
      options.countMode || (options.autoCount ? "auto" : ""),
    );
    const level = String(options.level || "考试");
    const style = String(options.style || options.cardStyle || "knowledge");
    let cards;
    try {
      cards = await this.ai(text, count, level, style);
    } catch (e) {
      console.warn("Copilot flashcard generation fallback to offline rules", e);
      cards = this.offline(text, count, level, style);
    }
    const result = await this.addCardsToNativeDeck(cards, deck.id);
    if (options.openWorkbench) {
      this.openWorkbench();
    }
    showMessage(`Copilot 已生成并加入 ${result.count} 张原生闪卡`);
    return { ...result, deck };
  }

  async addBlocksFromAPI(options = {}) {
    const blockIDs = (options.blockIDs || options.blockIds || [])
      .map((id) => String(id || "").trim())
      .filter(Boolean);
    if (!blockIDs.length) {
      throw Error("blockIDs 不能为空");
    }
    const deck = await this.resolveDeck(options);
    await this.api("/api/riff/addRiffCards", {
      blockIDs,
      deckID: deck.id,
      id: deck.id,
    });
    this.nativeCardsDeckID = "";
    await this.syncNativeDecks().catch(() => null);
    this.renderAll();
    showMessage(`Copilot 已将 ${blockIDs.length} 个思源块加入原生卡包`);
    return { success: true, count: blockIDs.length, blockIDs, deck };
  }

  async getNativeDeckCards(deckID = this.state.activePackId) {
    if (!deckID) {
      return [];
    }
    const all = [];
    for (let page = 1; page < 100; page++) {
      const data = await this.api("/api/riff/getRiffCards", {
        id: deckID,
        deckID,
        page,
        pageSize: 100,
      });
      const blocks = Array.isArray(data)
        ? data
        : data?.blocks || data?.cards || data?.items || data?.list || [];
      all.push(...blocks);
      if (
        !data?.pageCount ||
        page >= data.pageCount ||
        all.length >= (data.total || all.length)
      ) {
        break;
      }
    }
    return all;
  }

  cardBlockID(card) {
    return card?.blockID || card?.id || card?.block?.id || "";
  }

  async blockDOM(id) {
    if (!id) {
      return "";
    }
    const data = await this.api("/api/block/getBlockDOM", { id });
    return this.cleanNativeDOM(data?.dom || "");
  }

  async blockExists(id) {
    if (!id) {
      return false;
    }
    try {
      const data = await this.api("/api/block/getBlockDOM", { id });
      return Boolean(data?.dom);
    } catch (e) {
      return false;
    }
  }

  cleanNativeDOM(html) {
    const raw = String(html || "").trim();
    if (!raw) {
      return "";
    }
    const wrap = document.createElement("div");
    wrap.innerHTML = raw;
    wrap
      .querySelectorAll("[contenteditable]")
      .forEach((element) => element.removeAttribute("contenteditable"));
    wrap
      .querySelectorAll(
        ".protyle-attr, .protyle-action, .protyle-gutters, .av__cursor",
      )
      .forEach((element) => element.remove());
    return this.nativePreviewHTML(wrap) || wrap.innerHTML;
  }

  nativePreviewHTML(wrap) {
    const root =
      wrap.querySelector(
        '[custom-ai-flashcard-native], [data-sb-layout="col"], [data-sb-layout="row"]',
      ) || wrap.firstElementChild;
    if (!root) {
      return "";
    }
    const blocks = Array.from(root.children || []).filter((element) => {
      if (
        element.matches?.(
          ".protyle-attr, .protyle-action, .protyle-gutters, .av__cursor",
        )
      ) {
        return false;
      }
      const text = element.textContent?.trim();
      return (
        text ||
        element.querySelector?.(
          "img, video, table, svg, .katex, [data-subtype]",
        )
      );
    });
    if (blocks.length < 2) {
      return "";
    }
    return `
      <div class="aiflash-native-card-preview">
        <div class="aiflash-native-card-front">${blocks[0].outerHTML}</div>
        <div class="aiflash-native-card-back">${blocks
          .slice(1)
          .map((block) => block.outerHTML)
          .join("")}</div>
      </div>`;
  }

  async hydrateNativeCardDOM(cards) {
    const ids = [
      ...new Set(cards.map((card) => this.cardBlockID(card)).filter(Boolean)),
    ];
    const pairs = await Promise.all(
      ids.map(async (id) => [id, await this.blockDOM(id).catch(() => "")]),
    );
    const domByID = new Map(pairs);
    return cards.map((card) => ({
      ...card,
      nativeHTML: domByID.get(this.cardBlockID(card)) || "",
    }));
  }

  mdHTML(markdown) { return _mdHTML(markdown); }

  cardContentHTML(card) {
    if (card.nativeHTML) {
      return `<div class="aiflash-card-render aiflash-card-render--native protyle-wysiwyg">${card.nativeHTML}</div>`;
    }
    const front = this.mdHTML(card.front);
    const back = this.mdHTML(card.back);
    return `
      <div class="aiflash-card-render aiflash-card-render--local protyle-wysiwyg">
        <div class="aiflash-card-front">${front}</div>
        ${back ? `<div class="aiflash-card-back">${back}</div>` : ""}
      </div>`;
  }

  day() { return day(); }

  uid() { return uid(); }

  esc(s) { return esc(s); }

  fixDay() {
    this.state = this.normalize(this.state);
    if (this.state.lastDay !== this.day()) {
      this.state.lastDay = this.day();
      this.state.reviewedToday = 0;
    }
  }

  async save() {
    this.fixDay();
    await this.saveData(KEY, this.state);
  }

  mount(root, mode) {
    root.classList.toggle("aiflash-tab-page", mode === "tab");
    root.innerHTML = this.shell(mode);
    this.roots.add(root);
    this.bind(root);
    this.render(root);
  }

  switchWorkbenchTab(root, tabName) {
    root
      .querySelectorAll(".aiflash-tab")
      .forEach((item) => item.classList.toggle("active", item.dataset.tab === tabName));
    root
      .querySelectorAll(".aiflash-view")
      .forEach((item) => item.classList.toggle("active", item.dataset.view === tabName));
    // 切换到统计/图谱 tab 时延迟渲染（等 display 生效后）
    if (tabName === "stats") {
      requestAnimationFrame(() => this.renderStats(root));
    }
  }

  renderAll() {
    this.roots.forEach((root) => {
      if (root?.isConnected) {
        this.render(root);
      } else {
        this.roots.delete(root);
      }
    });
  }

  openDock() {
    const dockTab =
      document.querySelector(`[data-type="${DOCK}"]`) ||
      document.querySelector(`[data-type="${this.name}${DOCK}"]`) ||
      document.querySelector(`[aria-label="${this.i18n.dockTitle}"]`) ||
      document.querySelector(`[title="${this.i18n.dockTitle}"]`);
    if (dockTab) {
      dockTab.click();
      dockTab.scrollIntoView?.({ block: "nearest", inline: "nearest" });
      showMessage(this.i18n.openedInDock);
      return true;
    }
    return false;
  }

  openWorkbench() {
    try {
      openTab({
        app: this.app,
        custom: {
          id: TAB_TYPE,
          title: "AI 闪卡工作台",
          icon: "iconFlashcardsNative",
        },
      });
      showMessage("AI 闪卡工作台已在主界面打开");
      return true;
    } catch (e) {
      console.error("open AI flashcards tab failed", e);
      showMessage(this.i18n.dockNotFound || "没有找到 AI 闪卡界面，请重启思源后重试");
      return false;
    }
  }

  openTrainer() {
    this.openWorkbench();
    setTimeout(() => {
      this.roots.forEach((root) => {
        if (root?.isConnected) {
          this.switchWorkbenchTab(root, "trainer");
        }
      });
    }, 0);
  }

  openNativeReview() {
    openTab({
      app: this.app,
      card: { type: "all" },
    });
    showMessage("已打开思源原生闪卡复习");
  }

  openStorageDoc() {
    const docID =
      this.state.storageDocsByDeck?.[this.state.activePackId] ||
      this.state.storageDocID;
    if (!docID) {
      showMessage("还没有创建闪卡存放文档");
      return;
    }
    openTab({
      app: this.app,
      doc: { id: docID },
    });
  }

  addNativeBlockMenu(detail) {
    const menu = detail?.menu;
    if (!menu?.addItem) {
      return;
    }
    menu.addItem({
      iconHTML: "🧠",
      label: "加入当前原生闪卡卡包",
      click: () => this.addSelectedBlocksToNativeDeck(detail.protyle),
    });
    const selectedText = this.selectedText();
    if (selectedText) {
      menu.addItem({
        iconHTML: "✦",
        label: "用选中文本生成闪卡",
        click: () => this.generateFromTextToWorkbench(selectedText),
      });
      menu.addItem({
        iconHTML: "✦",
        label: "用选中文本生成并加入原生卡包",
        click: () => this.generateTextToNativeDeck(selectedText),
      });
    } else {
      menu.addItem({
        iconHTML: "✦",
        label: "用选中块生成并加入原生卡包",
        click: () => this.generateSelectedToNativeDeck(detail.protyle),
      });
    }
  }

  blockIconEvent(detail) {
    this.addNativeBlockMenu(detail);
  }

  selectedText() {
    return String(window.getSelection?.()?.toString() || "").trim();
  }

  selectedBlockIDs(protyle) {
    const ids = new Set();
    const root = protyle?.element || document;
    root.querySelectorAll(".protyle-wysiwyg--select").forEach((element) => {
      const id =
        element.getAttribute("data-node-id") ||
        element.closest("[data-node-id]")?.getAttribute("data-node-id");
      if (id) {
        ids.add(id);
      }
    });
    const selection = window.getSelection?.();
    const anchor =
      selection?.anchorNode?.nodeType === Node.ELEMENT_NODE
        ? selection.anchorNode
        : selection?.anchorNode?.parentElement;
    const id = anchor
      ?.closest?.("[data-node-id]")
      ?.getAttribute("data-node-id");
    if (id) {
      ids.add(id);
    }
    if (!ids.size && protyle?.block?.id) {
      ids.add(protyle.block.id);
    }
    return [...ids];
  }

  cleanBlockMarkdown(markdown) { return _cleanBlockMarkdown(markdown); }

  async blockMarkdown(id) {
    const data = await this.api("/api/block/getBlockKramdown", {
      id,
      mode: "textmark",
    });
    return this.cleanBlockMarkdown(
      data?.kramdown || data?.markdown || data?.content || "",
    );
  }

  async rawBlockMarkdown(id) {
    const data = await this.api("/api/block/getBlockKramdown", {
      id,
      mode: "textmark",
    });
    return String(data?.kramdown || data?.markdown || data?.content || "");
  }

  async selectedSourceText(protyle) {
    const text = this.selectedText();
    if (text) {
      return text;
    }
    const ids = this.selectedBlockIDs(protyle);
    if (!ids.length) {
      return "";
    }
    const parts = [];
    for (const id of ids) {
      const markdown = await this.blockMarkdown(id).catch(() => "");
      if (markdown) {
        parts.push(markdown);
      }
    }
    return parts.join("\n\n").trim();
  }

  async addSelectedBlocksToNativeDeck(protyle) {
    const deckID = this.activePack()?.id;
    if (!deckID) {
      showMessage("请先选择一个原生卡包");
      return;
    }
    const blockIDs = this.selectedBlockIDs(protyle);
    if (!blockIDs.length) {
      showMessage("没有找到选中的思源块");
      return;
    }
    try {
      await this.api("/api/riff/addRiffCards", {
        blockIDs,
        deckID,
        id: deckID,
      });
      this.nativeCardsDeckID = "";
      await this.syncNativeDecks().catch(() => null);
      this.renderAll();
      showMessage(`已将 ${blockIDs.length} 个思源块加入当前原生卡包`);
    } catch (e) {
      showMessage("加入原生闪卡失败：" + e.message);
    }
  }

  async generateFromTextToWorkbench(text) {
    this.gen = this.offline(text, 10, "考试");
    this.openWorkbench();
    this.renderAll();
    showMessage(`已从选中文本生成 ${this.gen.length} 张候选闪卡`);
  }

  async generateTextToNativeDeck(text, options = {}) {
    const source = String(text || "").trim();
    if (!source) {
      showMessage("没有可用于制卡的内容");
      return;
    }
    const count = this.normalizeGenerateCount(
      options.count,
      options.countMode || (options.autoCount ? "auto" : ""),
    );
    const level = String(options.level || "考试");
    const style = String(options.style || options.cardStyle || "knowledge");
    try {
      this.gen = await this.ai(source, count, level, style);
    } catch (e) {
      console.warn(
        "AI generate selected text failed, fallback to offline rules",
        e,
      );
      this.gen = this.offline(source, count, level, style);
    }
    if (!this.gen.length) {
      showMessage("没有生成可加入的闪卡");
      return;
    }
    const addedCount = await this.addGeneratedToNativeDeck(
      options.deckID || options.deckId,
    );
    this.renderAll();
    showMessage(`已生成并加入 ${addedCount} 张原生闪卡`);
  }

  async generateSelectedToNativeDeck(protyle) {
    try {
      const text = await this.selectedSourceText(protyle);
      await this.generateTextToNativeDeck(text);
    } catch (e) {
      showMessage("生成并加入原生闪卡失败：" + e.message);
    }
  }

  due() {
    const now = Date.now();
    return this.packCards()
      .filter((card) => (card.dueAt || 0) <= now)
      .sort((a, b) => (a.dueAt || 0) - (b.dueAt || 0));
  }

  activePack() {
    return (
      this.state.packs.find((pack) => pack.id === this.state.activePackId) ||
      this.state.packs[0]
    );
  }

  packCards(packId = this.state.activePackId) {
    return this.state.cards.filter((card) => card.packId === packId);
  }

  dueText(card) { return _dueText(card); }

  parseTime(value) { return parseTime(value); }

  cardMastery(card = {}) { return _cardMastery(card); }

  masteryScore(level) { return _masteryScore(level); }

  masteryLabel(level) { return _masteryLabel(level); }

  conceptFromCard(card = {}) {
    const meta = card.blockID ? this.state.graphMeta?.[card.blockID] : null;
    return gd.conceptFromCard(card, meta, (t) => this.clean(t));
  }

  graphCardConcepts(card = {}) {
    const meta = card.blockID ? this.state.graphMeta?.[card.blockID] : null;
    return gd.graphCardConcepts(card, meta, (t) => this.clean(t));
  }

  graphRelationPairs(concepts) { return gd.graphRelationPairs(concepts); }

  graphCards() {
    const generatedByBlockID = new Map(
      this.state.cards
        .filter((card) => card.blockID)
        .map((card) => [card.blockID, card]),
    );
    const native = this.nativeCards.map((card) => {
      const blockID = this.cardBlockID(card);
      const generated = generatedByBlockID.get(blockID);
      return {
        blockID,
        front:
          generated?.front ||
          card.content ||
          card.markdown ||
          card.name ||
          card.block?.content ||
          "原生闪卡",
        back: generated?.back || "",
        state: card.state ?? card.riffCard?.state ?? "",
        due: card.due || card.dueTime || card.riffCard?.due || "",
        reps: card.reps ?? card.riffCard?.reps ?? 0,
        lapses: card.lapses ?? card.riffCard?.lapses ?? 0,
      };
    });
    const local = this.packCards()
      .filter(
        (card) =>
          !card.blockID ||
          !native.some((item) => item.blockID === card.blockID),
      )
      .map((card) => ({ ...card, due: card.dueAt || "" }));
    return [...native, ...local].filter((card) => card.front || card.blockID);
  }

  buildGraphData(cards) {
    return gd.buildGraphData(cards, {
      graphMeta: this.state.graphMeta,
      graphWeakOnly: this.graphWeakOnly,
      limit: this.graphLimit,
      cardMastery: (c) => this.cardMastery(c),
      masteryScore: (m) => this.masteryScore(m),
      clean: (t) => this.clean(t),
    });
  }

  buildGraphCardNodes(cards) {
    return gd.buildGraphCardNodes(cards, {
      limit: this.graphLimit,
      cardMastery: (c) => this.cardMastery(c),
      conceptFn: (c) => this.conceptFromCard(c),
      clean: (t) => this.clean(t),
    });
  }

  newBlockID() {
    return (
      window.Lute?.NewNodeID?.() || uid().replace(/_/g, "-").slice(0, 22)
    );
  }

  safeMd(text) { return _safeMd(text); }

  nativeCardMarkdown(front, back, blockID) {
    const questionID = this.newBlockID();
    const answerID = this.newBlockID();
    return `{{{row
${this.safeMd(front)}
{: id="${questionID}"}

${this.safeMd(back)}
{: id="${answerID}"}
}}}
{: id="${blockID}" custom-ai-flashcard-native="1"}`;
  }

  extractID(data) { return _extractID(data); }

  async ensureStorageDoc() {
    return this.ensureDeckStorageDoc(this.state.activePackId);
  }

  async ensureDeckStorageDoc(deckID = this.state.activePackId) {
    const key = String(deckID || "default");
    if (
      this.state.storageDocsByDeck?.[key] &&
      (await this.blockExists(this.state.storageDocsByDeck[key]))
    ) {
      return this.state.storageDocsByDeck[key];
    }
    const notebooksData = await this.api("/api/notebook/lsNotebooks");
    const notebooks = notebooksData?.notebooks || [];
    const notebook = notebooks.find((item) => !item.closed) || notebooks[0];
    if (!notebook?.id) {
      throw Error("没有可用笔记本");
    }
    const pack = this.state.packs.find((item) => item.id === key);
    const deckName = this.cleanFileName(pack?.name || "未分类卡包");
    const path = `/AI 闪卡原生版/${deckName}-${this.day()}`;
    const docData = await this.api("/api/filetree/createDocWithMd", {
      notebook: notebook.id,
      path,
      markdown: `# ${deckName}\n\n这个文档用于按卡包存放插件生成并加入思源原生闪卡的块。\n`,
    });
    const docID = this.extractID(docData);
    if (!docID) {
      throw Error("创建闪卡存放文档失败");
    }
    this.state.storageNotebookID = notebook.id;
    this.state.storageDocID = docID;
    this.state.storageDocsByDeck[key] = docID;
    await this.save();
    return docID;
  }

  cleanFileName(name) { return _cleanFileName(name); }

  async appendNativeCardBlock(front, back, deckID = this.state.activePackId) {
    const blockID = this.newBlockID();
    const append = async () =>
      this.api("/api/block/appendBlock", {
        dataType: "markdown",
        data: this.nativeCardMarkdown(front, back, blockID),
        parentID: await this.ensureDeckStorageDoc(deckID),
      });
    let data;
    try {
      data = await append();
    } catch (e) {
      this.state.storageDocsByDeck[String(deckID || "default")] = "";
      await this.save();
      data = await append();
    }
    return this.extractID(data) || blockID;
  }

  async addGeneratedToNativeDeck(deckID = this.activePack()?.id) {
    if (!deckID) {
      throw Error("请先选择一个思源原生卡包");
    }
    const cards = this.gen.map((card) => ({
      front: this.normalizeCardText(card.front),
      back: this.normalizeCardText(card.back),
    }));
    const result = await this.addCardsToNativeDeck(cards, deckID, {
      onProgress: (done, total, phase = "write") =>
        this.roots.forEach((root) => {
          if (root?.isConnected) {
            const action = phase === "riff" ? "正在加入卡包" : "正在写入思源";
            this.setGenerateStatus(
              root,
              `${action} ${done}/${total} 张...`,
              "running",
            );
          }
        }),
    });
    this.gen = [];
    return result.count;
  }

  async addCardsToNativeDeck(
    cards,
    deckID = this.activePack()?.id,
    options = {},
  ) {
    if (!deckID) {
      throw Error("请先选择一个思源原生卡包");
    }
    const normalized = (cards || [])
      .map((card) => ({
        front: this.normalizeCardText(card.front || card.question || card.q),
        back: this.normalizeCardText(card.back || card.answer || card.a),
      }))
      .filter((card) => card.front && card.back);
    if (!normalized.length) {
      throw Error("没有可加入的闪卡");
    }
    const deduped = this.state.settings?.autoDedupe
      ? await this.filterDuplicateCards(normalized, deckID)
      : { cards: normalized, skipped: 0 };
    if (deduped.skipped) {
      showMessage(
        `发现 ${deduped.skipped} 张完全相同的闪卡，已跳过/删除重复加入`,
      );
    }
    if (!deduped.cards.length) {
      throw Error(`发现 ${deduped.skipped} 张完全相同的闪卡，已全部跳过`);
    }
    const blockIDs = [];
    const total = deduped.cards.length;
    let pendingBlockIDs = [];
    let pendingCards = [];
    let addedCount = 0;
    const flushBatch = async () => {
      if (!pendingBlockIDs.length) {
        return;
      }
      await this.api("/api/riff/addRiffCards", {
        blockIDs: pendingBlockIDs,
        deckID,
        id: deckID,
      });
      pendingCards.forEach((card, index) => {
        this.state.cards.push(
          this.card(card.front, card.back, deckID, pendingBlockIDs[index]),
        );
      });
      addedCount += pendingBlockIDs.length;
      if (typeof options.onProgress === "function") {
        options.onProgress(addedCount, total, "riff");
      }
      pendingBlockIDs = [];
      pendingCards = [];
    };
    for (let index = 0; index < deduped.cards.length; index++) {
      const card = deduped.cards[index];
      const blockID = await this.appendNativeCardBlock(
        card.front,
        card.back,
        deckID,
      );
      blockIDs.push(blockID);
      pendingBlockIDs.push(blockID);
      pendingCards.push(card);
      if (pendingBlockIDs.length >= WRITE_PROGRESS_STEP) {
        await flushBatch();
      }
      if (
        typeof options.onProgress === "function" &&
        ((index + 1) % WRITE_PROGRESS_STEP === 0 || index + 1 === total)
      ) {
        options.onProgress(index + 1, total);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
    await flushBatch();
    this.nativeCardsDeckID = "";
    this.nativeCardsPartial = false;
    await this.syncNativeDecks().catch(() => null);
    if (deckID === this.state.activePackId) {
      const addedIDs = new Set(blockIDs);
      this.nativeCards = [
        ...this.nativeCards.filter(
          (card) => !addedIDs.has(this.cardBlockID(card)),
        ),
        ...this.state.cards.filter(
          (card) => card.packId === deckID && addedIDs.has(card.blockID),
        ),
      ];
      this.nativeCardsDeckID = deckID;
      this.nativeCardsPartial = true;
    }
    await this.save();
    this.renderAll();
    return {
      success: true,
      count: blockIDs.length,
      skipped: deduped.skipped,
      blockIDs,
      cards: deduped.cards,
      deckID,
    };
  }

  duplicateKey(front, back = "") {
    const normalize = (text) =>
      this.normalizeCardText(text)
        .replace(/\n?\{:\s+[^}]*\}/g, "")
        .replace(/^\s*\{\{\{(?:row|col)\b/gm, "")
        .replace(/^\s*}}}\s*$/gm, "")
        .replace(/\s+/g, " ")
        .trim();
    return `${normalize(front)}\n---\n${normalize(back)}`;
  }

  duplicateKeyFromNativeCard(card, generatedByBlockID) {
    const blockID = this.cardBlockID(card);
    const generated = generatedByBlockID.get(blockID);
    if (generated) {
      return this.duplicateKey(generated.front, generated.back);
    }
    const markdown = String(card.markdown || "").trim();
    if (markdown) {
      return this.duplicateKey(markdown);
    }
    return this.duplicateKey(card.content || card.fcontent || card.name || "");
  }

  async filterDuplicateCards(cards, deckID) {
    const kept = [];
    const seenIncoming = new Set();
    let skipped = 0;
    for (const card of cards) {
      const key = this.duplicateKey(card.front, card.back);
      if (seenIncoming.has(key)) {
        skipped++;
        continue;
      }
      seenIncoming.add(key);
      kept.push({ ...card, duplicateKey: key });
    }
    const existingCards = await this.getNativeDeckCards(deckID).catch((e) => {
      console.warn("dedupe load native cards failed", e);
      return [];
    });
    const generatedByBlockID = new Map(
      this.state.cards
        .filter((card) => card.blockID && card.packId === deckID)
        .map((card) => [card.blockID, card]),
    );
    const existingKeys = new Set(
      existingCards
        .map((card) =>
          this.duplicateKeyFromNativeCard(card, generatedByBlockID),
        )
        .filter(Boolean),
    );
    const result = kept
      .filter((card) => {
        if (existingKeys.has(card.duplicateKey)) {
          skipped++;
          return false;
        }
        existingKeys.add(card.duplicateKey);
        return true;
      })
      .map(({ duplicateKey, ...card }) => card);
    return { cards: result, skipped };
  }

  async cleanupDuplicateCards(deckID = this.state.activePackId) {
    if (!this.state.settings?.autoDedupe) {
      showMessage("请先在设置里开启“自动检测完全重复闪卡”");
      return;
    }
    if (!deckID) {
      showMessage("请先选择一个原生卡包");
      return;
    }
    const cards = await this.getNativeDeckCards(deckID);
    const generatedByBlockID = new Map(
      this.state.cards
        .filter((card) => card.blockID && card.packId === deckID)
        .map((card) => [card.blockID, card]),
    );
    const seen = new Map();
    const duplicates = [];
    for (const card of cards) {
      const blockID = this.cardBlockID(card);
      const key = this.duplicateKeyFromNativeCard(card, generatedByBlockID);
      if (!blockID || !key) {
        continue;
      }
      if (seen.has(key)) {
        duplicates.push(blockID);
      } else {
        seen.set(key, blockID);
      }
    }
    const blockIDs = [...new Set(duplicates)];
    if (!blockIDs.length) {
      showMessage("当前卡组没有发现完全相同的闪卡");
      return;
    }
    const ok = window.confirm?.(
      `发现 ${blockIDs.length} 张完全相同的重复闪卡。\n将从当前卡组移除重复项，保留每组第一张。继续？`,
    );
    if (!ok) {
      return;
    }
    for (let index = 0; index < blockIDs.length; index += 100) {
      const batch = blockIDs.slice(index, index + 100);
      await this.api("/api/riff/removeRiffCards", {
        deckID,
        id: deckID,
        blockIDs: batch,
      });
    }
    this.state.cards = this.state.cards.filter(
      (card) => !(card.packId === deckID && blockIDs.includes(card.blockID)),
    );
    this.nativeCardsDeckID = "";
    await this.syncNativeDecks().catch(() => null);
    await this.save();
    this.renderAll();
    showMessage(`已移除 ${blockIDs.length} 张完全相同的重复闪卡`);
  }

  async findMissingGeneratedCards(deckID = this.state.activePackId) {
    const cards = this.state.cards.filter(
      (card) => card.packId === deckID && card.blockID,
    );
    const missing = [];
    for (let index = 0; index < cards.length; index++) {
      const card = cards[index];
      if (!(await this.blockExists(card.blockID))) {
        missing.push(card);
      }
      if ((index + 1) % 30 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
    return missing;
  }

  async checkMissingGeneratedCards(deckID = this.state.activePackId) {
    const missing = await this.findMissingGeneratedCards(deckID);
    this.missingCards = missing;
    if (!missing.length) {
      showMessage("没有发现插件状态里的失效卡片");
      return;
    }
    showMessage(
      `发现 ${missing.length} 张失效卡片：思源块已不存在，但插件仍有备份`,
    );
  }

  async cleanupMissingGeneratedCards(deckID = this.state.activePackId) {
    const missing = this.missingCards?.length
      ? this.missingCards
      : await this.findMissingGeneratedCards(deckID);
    if (!missing.length) {
      showMessage("没有可清理的失效卡片");
      return;
    }
    const ok = window.confirm?.(
      `将从插件状态中删除 ${missing.length} 张失效卡片记录。\n这不会恢复思源块，也不会删除其他笔记。继续？`,
    );
    if (!ok) {
      return;
    }
    const missingIDs = new Set(missing.map((card) => card.blockID));
    this.state.cards = this.state.cards.filter(
      (card) => !(card.packId === deckID && missingIDs.has(card.blockID)),
    );
    missingIDs.forEach((id) => delete this.state.graphMeta[id]);
    this.nativeCards = this.nativeCards.filter(
      (card) => !missingIDs.has(this.cardBlockID(card)),
    );
    await this.save();
    this.renderAll();
    showMessage(`已清理 ${missing.length} 张失效卡片记录`);
  }

  async restoreMissingGeneratedCards(deckID = this.state.activePackId) {
    const missing = this.missingCards?.length
      ? this.missingCards
      : await this.findMissingGeneratedCards(deckID);
    const restorable = missing.filter((card) => card.front && card.back);
    if (!restorable.length) {
      showMessage("失效记录里没有足够的正反面内容，无法恢复");
      return;
    }
    const ok = window.confirm?.(
      `将根据插件备份恢复 ${restorable.length} 张卡片到新的按卡包存放文档。\n复习历史可能无法保留，会作为新原生闪卡重新加入当前卡包。继续？`,
    );
    if (!ok) {
      return;
    }
    const oldIDs = new Set(restorable.map((card) => card.blockID));
    const restored = [];
    for (const card of restorable) {
      const blockID = await this.appendNativeCardBlock(
        card.front,
        card.back,
        deckID,
      );
      restored.push({ ...card, blockID });
      if (restored.length % WRITE_PROGRESS_STEP === 0) {
        await this.api("/api/riff/addRiffCards", {
          deckID,
          id: deckID,
          blockIDs: restored
            .slice(-WRITE_PROGRESS_STEP)
            .map((item) => item.blockID),
        });
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
    const tail = restored.length % WRITE_PROGRESS_STEP;
    if (tail) {
      await this.api("/api/riff/addRiffCards", {
        deckID,
        id: deckID,
        blockIDs: restored.slice(-tail).map((item) => item.blockID),
      });
    }
    this.state.cards = this.state.cards.filter(
      (card) => !(card.packId === deckID && oldIDs.has(card.blockID)),
    );
    restored.forEach((card) => this.state.cards.push(card));
    oldIDs.forEach((id) => delete this.state.graphMeta[id]);
    this.nativeCardsDeckID = "";
    await this.syncNativeDecks().catch(() => null);
    await this.save();
    this.renderAll();
    showMessage(`已恢复 ${restored.length} 张卡片`);
  }

  async renameActiveNativeDeck() {
    const pack = this.activePack();
    if (!pack?.id) {
      showMessage("请先选择一个原生卡包");
      return;
    }
    if (pack.quick || this.isQuickDeckID(pack.id)) {
      showMessage("快速制卡是思源内置卡组，不能重命名");
      return;
    }
    const name = String(
      window.prompt?.("重命名原生卡包", pack.name) || "",
    ).trim();
    if (!name || name === pack.name) {
      return;
    }
    try {
      await this.api("/api/riff/renameRiffDeck", {
        deckID: pack.id,
        id: pack.id,
        name,
      });
      pack.name = name;
      await this.syncNativeDecks().catch(() => null);
      this.renderAll();
      showMessage(`已重命名卡包：${name}`);
    } catch (e) {
      showMessage("重命名原生卡包失败：" + e.message);
    }
  }

  async removeActiveNativeDeck() {
    const pack = this.activePack();
    if (!pack?.id) {
      showMessage("请先选择一个原生卡包");
      return;
    }
    if (pack.quick || this.isQuickDeckID(pack.id)) {
      showMessage("快速制卡是思源内置卡组，不能删除");
      return;
    }
    const ok = window.confirm?.(
      `确定删除原生卡包“${pack.name}”？\n卡包内闪卡关系会被删除，思源块本身不会删除。`,
    );
    if (!ok) {
      return;
    }
    try {
      await this.api("/api/riff/removeRiffDeck", {
        deckID: pack.id,
        id: pack.id,
      });
      this.state.packs = this.state.packs.filter((item) => item.id !== pack.id);
      this.state.activePackId = this.state.packs[0]?.id || "";
      this.nativeCards = [];
      this.nativeCardsDeckID = "";
      await this.syncNativeDecks().catch(() => null);
      await this.save();
      this.renderAll();
      showMessage(`已删除原生卡包：${pack.name}`);
    } catch (e) {
      showMessage("删除原生卡包失败：" + e.message);
    }
  }

  async removeNativeCard(blockID, deckID = this.state.activePackId) {
    if (!blockID || !deckID) {
      showMessage("没有找到可移除的原生卡片");
      return;
    }
    try {
      await this.api("/api/riff/removeRiffCards", {
        deckID,
        id: deckID,
        blockIDs: [blockID],
      });
      this.state.cards = this.state.cards.filter(
        (card) => card.blockID !== blockID || card.packId !== deckID,
      );
      this.nativeCards = this.nativeCards.filter(
        (card) => (card.blockID || card.id || card.block?.id) !== blockID,
      );
      await this.syncNativeDecks().catch(() => null);
      await this.save();
      this.renderAll();
      showMessage("已从当前原生卡包移除");
    } catch (e) {
      showMessage("移除原生闪卡失败：" + e.message);
    }
  }

  async moveNativeCard(
    blockID,
    targetDeckID,
    sourceDeckID = this.state.activePackId,
  ) {
    if (
      !blockID ||
      !sourceDeckID ||
      !targetDeckID ||
      sourceDeckID === targetDeckID
    ) {
      return;
    }
    try {
      await this.api("/api/riff/removeRiffCards", {
        deckID: sourceDeckID,
        id: sourceDeckID,
        blockIDs: [blockID],
      });
      await this.api("/api/riff/addRiffCards", {
        deckID: targetDeckID,
        id: targetDeckID,
        blockIDs: [blockID],
      });
      this.state.cards.forEach((card) => {
        if (card.blockID === blockID && card.packId === sourceDeckID) {
          card.packId = targetDeckID;
        }
      });
      this.nativeCards = this.nativeCards.filter(
        (card) => (card.blockID || card.id || card.block?.id) !== blockID,
      );
      await this.syncNativeDecks().catch(() => null);
      await this.save();
      this.renderAll();
      showMessage("已移动到目标原生卡包");
    } catch (e) {
      showMessage("移动原生闪卡失败：" + e.message);
    }
  }

  async addNativeDeckToActive(sourceDeckID) {
    const targetDeckID = this.state.activePackId;
    if (!sourceDeckID) {
      showMessage("请选择要移动的思源原生卡组");
      return;
    }
    if (!targetDeckID) {
      showMessage("请先选择或新建目标卡组");
      return;
    }
    if (sourceDeckID === targetDeckID) {
      showMessage("来源卡组和当前卡组相同");
      return;
    }
    try {
      const sourcePack = this.state.packs.find(
        (pack) => pack.id === sourceDeckID,
      );
      const targetPack = this.activePack();
      const sourceCards = await this.getNativeDeckCards(sourceDeckID);
      const blockIDs = [
        ...new Set(
          sourceCards.map((card) => this.cardBlockID(card)).filter(Boolean),
        ),
      ];
      if (!blockIDs.length) {
        showMessage("来源原生卡组没有可加入的卡片");
        return;
      }
      for (let index = 0; index < blockIDs.length; index += 100) {
        const batch = blockIDs.slice(index, index + 100);
        await this.api("/api/riff/addRiffCards", {
          deckID: targetDeckID,
          id: targetDeckID,
          blockIDs: batch,
        });
        await this.api("/api/riff/removeRiffCards", {
          deckID: sourceDeckID,
          id: sourceDeckID,
          blockIDs: batch,
        });
      }
      const movedIDs = new Set(blockIDs);
      this.state.cards.forEach((card) => {
        if (movedIDs.has(card.blockID) && card.packId === sourceDeckID) {
          card.packId = targetDeckID;
        }
      });
      this.nativeCardsDeckID = "";
      await this.syncNativeDecks().catch(() => null);
      await this.save();
      this.renderAll();
      showMessage(
        `已将“${sourcePack?.name || "原生卡组"}”的 ${blockIDs.length} 张卡片移动到“${targetPack?.name || "当前卡组"}”`,
      );
    } catch (e) {
      showMessage("移动思源原生卡组失败：" + e.message);
    }
  }

  cardClassifyText(card) {
    const generated = this.state.cards.find(
      (item) => item.blockID && item.blockID === this.cardBlockID(card),
    );
    const raw = generated
      ? `${generated.front}\n${generated.back}`
      : card.markdown || card.content || card.fcontent || card.name || "";
    return this.clean(String(raw || ""))
      .replace(/\s+/g, " ")
      .slice(0, 900);
  }

  resolveAIEndpoint(settings = this.state.settings || {}) {
    if ((settings.provider || "offline") === "offline") {
      return "";
    }
    let url = String(settings.baseUrl || "").trim().replace(/\/+$/, "");
    if (!url && settings.provider === "openai") {
      return "https://api.openai.com/v1/chat/completions";
    }
    if (
      url &&
      !/\/chat\/completions$/i.test(url) &&
      settings.provider !== "custom"
    ) {
      return url.endsWith("/v1") ? `${url}/chat/completions` : `${url}/v1/chat/completions`;
    }
    return url;
  }

  async aiJSON(prompt, temperature = 0.1) {
    const settings = this.state.settings || {};
    if ((settings.provider || "offline") === "offline") {
      throw Error("请先在设置里配置 AI 接口，离线规则不能判断卡组分类");
    }
    const url = this.resolveAIEndpoint(settings);
    if (!url) {
      throw Error("未配置接口地址");
    }
    const headers = { "Content-Type": "application/json" };
    if (settings.apiKey) {
      headers.Authorization = `Bearer ${settings.apiKey}`;
    }
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: settings.model || "gpt-4o-mini",
        temperature,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!response.ok) {
      throw Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    const content =
      data?.choices?.[0]?.message?.content ??
      data?.text ??
      data?.content ??
      data?.result ??
      data?.output ??
      data;
    const raw =
      typeof content === "string"
        ? content.replace(/```json|```/g, "").trim()
        : JSON.stringify(content);
    return JSON.parse(raw);
  }

  classifyPrompt(cards, targets) {
    return `请把这些思源快速制卡闪卡分到已有卡组中。只能使用给定卡组的 id；不能新建卡组；不确定就返回空字符串。

目标卡组：
${targets.map((deck) => `- ${deck.id}: ${deck.name}`).join("\n")}

闪卡：
${cards.map((card, index) => `${index + 1}. blockID=${card.blockID}\n${card.text}`).join("\n\n")}

只输出 JSON 数组，格式：
[{"blockID":"块ID","deckID":"目标卡组ID或空字符串","reason":"极短理由"}]`;
  }

  graphAnalyzePrompt(cards) { return gd.graphAnalyzePrompt(cards, (t) => this.clean(t)); }

  normalizeGraphMeta(results, cards) { return gd.normalizeGraphMeta(results, cards); }

  async analyzeGraphWithAI(root) {
    const cards = this.graphCards()
      .filter((card) => card.blockID)
      .slice(0, Math.min(this.graphLimit || 80, 120));
    if (!cards.length) {
      showMessage("当前卡包没有可分析的原生闪卡");
      return;
    }
    const button = root.querySelector("#af-graph-ai");
    if (button) {
      button.disabled = true;
      button.textContent = "分析中...";
    }
    try {
      const meta = this.normalizeGraphMeta(
        await this.aiJSON(this.graphAnalyzePrompt(cards), 0.1),
        cards,
      );
      meta.forEach((item) => {
        this.state.graphMeta[item.blockID] = item;
      });
      await this.save();
      this.renderGraph(root);
      showMessage(`AI 已分析 ${meta.length} 张卡片的知识点关系`);
    } catch (e) {
      showMessage("AI 分析关系失败：" + e.message);
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = "AI 分析关系";
      }
    }
  }

  normalizeClassifyResults(results, cards, targets) {
    const cardIDs = new Set(cards.map((card) => card.blockID));
    const targetIDs = new Set(targets.map((deck) => deck.id));
    return (Array.isArray(results) ? results : [])
      .map((item) => ({
        blockID: String(item?.blockID || item?.id || "").trim(),
        deckID: String(
          item?.deckID || item?.deckId || item?.targetDeckID || "",
        ).trim(),
        reason: String(item?.reason || "").trim(),
      }))
      .filter((item) => cardIDs.has(item.blockID))
      .map((item) =>
        targetIDs.has(item.deckID) ? item : { ...item, deckID: "" },
      );
  }

  async applyClassifyMoves(assignments, sourceDeckID) {
    const grouped = new Map();
    assignments
      .filter((item) => item.deckID)
      .forEach((item) => {
        if (!grouped.has(item.deckID)) {
          grouped.set(item.deckID, []);
        }
        grouped.get(item.deckID).push(item.blockID);
      });
    let moved = 0;
    for (const [targetDeckID, blockIDs] of grouped) {
      for (let index = 0; index < blockIDs.length; index += 100) {
        const batch = blockIDs.slice(index, index + 100);
        await this.api("/api/riff/addRiffCards", {
          deckID: targetDeckID,
          id: targetDeckID,
          blockIDs: batch,
        });
        await this.api("/api/riff/removeRiffCards", {
          deckID: sourceDeckID,
          id: sourceDeckID,
          blockIDs: batch,
        });
        moved += batch.length;
      }
    }
    return moved;
  }

  async classifyQuickCards(root) {
    const sourceDeckID = this.state.activePackId;
    if (!this.isQuickDeckID(sourceDeckID)) {
      showMessage("请先在卡包下拉框选择“快速制卡”");
      return;
    }
    const targets = this.state.packs.filter(
      (pack) =>
        pack.id &&
        pack.id !== sourceDeckID &&
        !pack.quick &&
        !this.isQuickDeckID(pack.id),
    );
    if (!targets.length) {
      showMessage("请先创建或刷新至少一个普通原生卡组");
      return;
    }
    const limit = Math.max(
      1,
      Math.min(
        100,
        Number(root.querySelector("#af-classify-limit")?.value) || 20,
      ),
    );
    const query = (root.querySelector("#af-search")?.value || "").toLowerCase();
    if (this.nativeCardsDeckID !== sourceDeckID) {
      await this.loadNativeCards(sourceDeckID);
    }
    const cards = this.nativeCards
      .map((card) => ({
        blockID: this.cardBlockID(card),
        text: this.cardClassifyText(card),
      }))
      .filter((card) => card.blockID && card.text)
      .filter(
        (card) =>
          !query || (card.text + card.blockID).toLowerCase().includes(query),
      )
      .slice(0, limit);
    if (!cards.length) {
      showMessage("当前没有可分类的快速制卡卡片");
      return;
    }
    const ok = window.confirm?.(
      `将用 AI 分析 ${cards.length} 张快速制卡卡片。\nAI 判断为“不确定”的卡片会保持不动。确定继续？`,
    );
    if (!ok) {
      return;
    }
    const status = root.querySelector("#af-classify-status");
    if (status) {
      status.textContent = "AI 正在分类...";
    }
    try {
      const results = this.normalizeClassifyResults(
        await this.aiJSON(this.classifyPrompt(cards, targets)),
        cards,
        targets,
      );
      const moved = await this.applyClassifyMoves(results, sourceDeckID);
      const uncertain = cards.length - moved;
      this.nativeCardsDeckID = "";
      await this.syncNativeDecks().catch(() => null);
      await this.loadNativeCards(sourceDeckID).catch(() => null);
      this.renderAll();
      showMessage(`AI 分类完成：移动 ${moved} 张，保留不确定 ${uncertain} 张`);
    } catch (e) {
      if (status) {
        status.textContent = "";
      }
      showMessage("AI 分类失败：" + e.message);
    }
  }

  async repairNativeMathEscapes() {
    const deckID = this.state.activePackId;
    if (!deckID) {
      showMessage("请先选择一个原生卡包");
      return;
    }
    try {
      if (this.nativeCardsDeckID !== deckID) {
        await this.loadNativeCards(deckID);
      }
      let changed = 0;
      let layoutChanged = 0;
      const ids = [
        ...new Set(
          this.nativeCards
            .map((card) => this.cardBlockID(card))
            .filter(Boolean),
        ),
      ];
      for (const id of ids) {
        const markdown = await this.rawBlockMarkdown(id).catch(() => "");
        if (!markdown) {
          continue;
        }
        let next = this.normalizeCardText(markdown);
        if (/^\s*\{\{\{col\b/m.test(next)) {
          next = next.replace(/^(\s*)\{\{\{col\b/m, "$1{{{row");
          layoutChanged++;
        }
        if (next !== markdown) {
          await this.api("/api/block/updateBlock", {
            id,
            dataType: "markdown",
            data: next,
          });
          changed++;
        }
      }
      this.nativeCardsDeckID = "";
      await this.loadNativeCards(deckID).catch(() => null);
      this.renderAll();
      showMessage(
        changed
          ? `已修复 ${changed} 张卡片，其中 ${layoutChanged} 张转为纵向超级块`
          : "没有发现需要修复的卡片",
      );
    } catch (e) {
      showMessage("修复卡片失败：" + e.message);
    }
  }

  resetQ() {
    this.q = this.due();
    this.cur = this.q.shift() || null;
    this.done = 0;
  }

  card(front, back, packId = this.state.activePackId, blockID = "") {
    return {
      id: this.uid(),
      packId,
      blockID,
      native: Boolean(blockID),
      front,
      back,
      dueAt: Date.now(),
      interval: 0,
      ease: 2.5,
      reps: 0,
      lapses: 0,
    };
  }

  normalizeGenerateCount(value, mode = "") {
    if (mode === "outline" || String(value || "").toLowerCase() === "outline") {
      return "outline";
    }
    if (mode === "auto" || String(value || "").toLowerCase() === "auto") {
      return "auto";
    }
    const count = Number(value);
    return Math.max(1, Number.isFinite(count) ? Math.round(count) : 10);
  }

  readGenerateCount(root) {
    const mode = root.querySelector("#af-count-mode")?.value || "manual";
    return this.normalizeGenerateCount(
      root.querySelector("#af-count")?.value,
      mode,
    );
  }

  syncGenerateCountMode(root) {
    const input = root.querySelector("#af-count");
    const mode = root.querySelector("#af-count-mode")?.value || "manual";
    if (!input) {
      return;
    }
    input.disabled = mode === "auto" || mode === "outline";
    input.title =
      mode === "outline"
        ? "按 Markdown 标题逐条生成，不使用数量限制"
        : mode === "auto"
          ? "AI 会按材料信息密度自动决定张数，不设插件上限"
          : "最多生成张数，不设插件上限";
  }

  setGenerateStatus(root, text, type = "idle") {
    const status = root.querySelector("#af-gen-status");
    if (!status) {
      return;
    }
    status.textContent = `状态：${text}`;
    status.dataset.type = type;
  }

  setGenerateCount(root, count = this.gen?.length || 0) {
    const counter = root.querySelector("#af-gen-count");
    if (counter) {
      counter.textContent = `本次生成：${count} 张`;
    }
  }

  setGenerateBusy(root, busy) {
    ["#af-gen", "#af-add", "#af-clear"].forEach((selector) => {
      const button = root.querySelector(selector);
      if (button) {
        button.disabled = Boolean(busy);
      }
    });
  }

  estimateGenerateCount(text) {
    const cleanText = this.clean(text);
    const sections = (
      cleanText.match(/^#{1,6}\s+|^\*\*[^*\n]{2,80}\*\*/gm) || []
    ).length;
    const paragraphs = cleanText
      .split(/\n{2,}|(?<=。)|(?<=？)|(?<=！)/)
      .filter((item) => item.trim().length > 18).length;
    const byLength = Math.ceil(cleanText.length / 260);
    return Math.max(1, Math.max(sections, Math.min(paragraphs, byLength || 1)));
  }

  structuredTitleQuestion(title, level) {
    const text = String(title || "")
      .replace(/^#+\s*/, "")
      .trim();
    if (!text) {
      return "";
    }
    if (/[？?]$/.test(text)) {
      return text;
    }
    if (/^定义\s+/u.test(text)) {
      return `${text}是什么？`;
    }
    if (/^(定理|性质|推论|公式|结论|法则|注意)\s+/u.test(text)) {
      return level === "深度理解"
        ? `如何理解${text}？`
        : `${text}的内容是什么？`;
    }
    return level === "深度理解" ? `如何理解${text}？` : `${text}是什么？`;
  }

  structuredCards(text, level = "考试") {
    const raw = String(text || "").trim();
    if (!raw) {
      return [];
    }
    if (/^[\[{]/.test(raw)) {
      const jsonCards = this.structuredCardsFromJSON(raw, level);
      if (jsonCards.length) {
        return jsonCards;
      }
    }
    const lines = raw.replace(/\r\n/g, "\n").split("\n");
    const qaCards = this.structuredCardsFromQAList(lines);
    if (qaCards.length) {
      return qaCards;
    }
    const headingLevels = lines
      .map((line) => line.match(/^(#{1,6})\s+(.+?)\s*$/)?.[1].length)
      .filter(Boolean);
    const targetLevel = headingLevels.includes(4)
      ? 4
      : headingLevels.includes(5)
        ? 5
        : Math.max(...headingLevels, 0);
    if (!targetLevel) {
      return [];
    }
    const cards = [];
    let current = null;
    const flush = () => {
      if (!current) {
        return;
      }
      const back = current.body.join("\n").trim();
      const front = this.structuredTitleQuestion(current.title, level);
      if (front && back) {
        cards.push({
          front: this.normalizeCardText(front),
          back: this.normalizeCardText(back),
        });
      }
    };
    for (const line of lines) {
      const match = line.match(/^(#{1,6})\s+(.+?)\s*$/);
      if (match && match[1].length >= targetLevel) {
        flush();
        current = { level: match[1].length, title: match[2], body: [] };
        continue;
      }
      if (match && current && match[1].length < targetLevel) {
        continue;
      }
      if (current) {
        current.body.push(line);
      }
    }
    flush();
    return cards;
  }

  structuredCardsFromQAList(lines) {
    const cards = [];
    let current = null;
    const flush = () => {
      if (!current) {
        return;
      }
      const back = current.body.join("\n").trim();
      if (current.front && back) {
        cards.push({
          front: this.normalizeCardText(current.front),
          back: this.normalizeCardText(back),
        });
      }
    };
    for (const line of lines) {
      const text = String(line || "").trim();
      const question = text.match(/^(?:[-*+]\s*)?(.+[？?])\s*$/);
      if (question) {
        flush();
        current = { front: question[1].trim(), body: [] };
        continue;
      }
      if (current && text) {
        current.body.push(text.replace(/^(?:[-*+]\s*)/, ""));
      }
    }
    flush();
    return cards.length >= 2 ? cards : [];
  }

  structuredCardsFromJSON(text, level = "考试") {
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return [];
    }
    const cards = [];
    const titleKeys = [
      "front",
      "question",
      "title",
      "name",
      "term",
      "concept",
      "key",
      "label",
    ];
    const backKeys = [
      "back",
      "answer",
      "definition",
      "description",
      "content",
      "explanation",
      "detail",
      "details",
      "notes",
    ];
    const pick = (object, keys) =>
      keys
        .map((key) => object?.[key])
        .find((value) => typeof value === "string" && value.trim());
    const visit = (value, path = []) => {
      if (Array.isArray(value)) {
        value.forEach((item, index) =>
          visit(item, [...path, String(index + 1)]),
        );
        return;
      }
      if (!value || typeof value !== "object") {
        return;
      }
      const title = pick(value, titleKeys);
      const back = pick(value, backKeys);
      if (title && back) {
        cards.push({
          front: this.normalizeCardText(
            this.structuredTitleQuestion(title, level),
          ),
          back: this.normalizeCardText(back),
        });
        return;
      }
      Object.entries(value).forEach(([key, item]) => {
        if (
          typeof item === "string" &&
          item.trim().length > 8 &&
          !titleKeys.includes(key)
        ) {
          cards.push({
            front: this.normalizeCardText(
              this.structuredTitleQuestion(
                [...path, key].filter(Boolean).join(" / "),
                level,
              ),
            ),
            back: this.normalizeCardText(item),
          });
        } else {
          visit(item, [...path, key]);
        }
      });
    };
    visit(data);
    return cards;
  }

  shell(mode = "dock") {
    const isTab = mode === "tab";
    return `
      <div class="aiflash-wrap ${isTab ? "aiflash-wrap--tab" : "aiflash-wrap--dock"}">
        <div class="aiflash-head">
          <div>
            <h3>${isTab ? "AI 闪卡工作台" : this.i18n.dockTitle}</h3>
            <p class="aiflash-subtitle">生成超级块并加入思源原生闪卡卡包</p>
          </div>
          <div class="aiflash-head-actions">
            <span class="aiflash-badge">Native</span>
            ${isTab ? `<button class="b3-button b3-button--outline" id="af-open-dock">打开 Dock</button>` : ""}
          </div>
        </div>
        <div class="aiflash-tabs">
          <button class="b3-button b3-button--outline aiflash-tab ${isTab ? "" : "active"}" data-tab="review">复习</button>
          <button class="b3-button b3-button--outline aiflash-tab" data-tab="gen">生成</button>
          <button class="b3-button b3-button--outline aiflash-tab" data-tab="trainer">训练舱</button>
          <button class="b3-button b3-button--outline aiflash-tab" data-tab="lib">卡片</button>
          <button class="b3-button b3-button--outline aiflash-tab ${isTab ? "active" : ""}" data-tab="graph">图谱</button>
          <button class="b3-button b3-button--outline aiflash-tab" data-tab="stats">统计</button>
          <button class="b3-button b3-button--outline aiflash-tab" data-tab="set">设置</button>
        </div>
        <div class="aiflash-packbar">
          <select class="b3-select" id="af-pack"></select>
          <input class="b3-text-field" id="af-pack-name" placeholder="新卡包名">
          <button class="b3-button b3-button--outline" id="af-pack-add">创建</button>
          <div class="aiflash-pack-actions">
            <button class="b3-button b3-button--outline" id="af-pack-refresh">刷新</button>
            <button class="b3-button b3-button--outline" id="af-pack-rename">重命名</button>
            <button class="b3-button b3-button--outline" id="af-pack-remove">删除</button>
          </div>
          <div class="aiflash-pack-import">
            <select class="b3-select" id="af-pack-import-source"></select>
            <button class="b3-button b3-button--outline" id="af-pack-import">移动原生卡组</button>
          </div>
        </div>
        <div class="aiflash-main">
          <div class="aiflash-view ${isTab ? "" : "active"}" data-view="review">
            <div id="af-review"></div>
          </div>
          <div class="aiflash-view" data-view="gen">
            <textarea class="b3-text-field fn__block aiflash-textarea" id="af-src" placeholder="粘贴笔记内容..."></textarea>
            <div class="fn__flex aiflash-gap">
              <select class="b3-select" id="af-count-mode">
                <option value="manual" selected>手动张数</option>
                <option value="auto">AI 自动识别</option>
                <option value="outline">按标题逐条</option>
              </select>
              <input class="b3-text-field aiflash-count-input" id="af-count" type="number" min="1" value="10" title="最多生成张数">
              <select class="b3-select" id="af-level">
                <option>基础</option>
                <option selected>考试</option>
                <option>深度理解</option>
              </select>
              <select class="b3-select" id="af-card-style">
                <option value="knowledge" selected>知识卡</option>
                <option value="quiz">检测题</option>
              </select>
            </div>
            <div class="fn__flex aiflash-gap">
              <button class="b3-button b3-button--outline" id="af-gen">生成闪卡</button>
              <button class="b3-button b3-button--outline" id="af-add">写入思源并加入卡包</button>
              <button class="b3-button b3-button--outline" id="af-clear">清空</button>
            </div>
            <div class="aiflash-gen-meta">
              <div class="aiflash-gen-status" id="af-gen-status">状态：空闲</div>
              <div class="aiflash-gen-count" id="af-gen-count">本次生成：0 张</div>
            </div>
            <div class="aiflash-result" id="af-result"></div>
          </div>
          <div class="aiflash-view" data-view="trainer">
            <div id="af-trainer"></div>
          </div>
          <div class="aiflash-view" data-view="lib">
            <input class="b3-text-field fn__block" id="af-search" placeholder="搜索卡片">
            <div class="fn__flex aiflash-gap aiflash-lib-actions">
              <button class="b3-button b3-button--outline" id="af-refresh-cards">刷新原生卡片</button>
              <button class="b3-button b3-button--outline" id="af-repair-math">修复公式/纵向</button>
              <button class="b3-button b3-button--outline" id="af-clean-duplicates">清理重复</button>
              <button class="b3-button b3-button--outline" id="af-check-missing">检查失效</button>
              <button class="b3-button b3-button--outline" id="af-restore-missing">恢复失效</button>
              <button class="b3-button b3-button--outline" id="af-clean-missing">删除失效记录</button>
            </div>
            <div class="aiflash-classify">
              <div class="aiflash-classify-main">
                <input class="b3-text-field" id="af-classify-limit" type="number" min="1" max="100" value="20" title="每次处理数量">
                <button class="b3-button b3-button--outline" id="af-ai-classify">AI 分组快速制卡</button>
              </div>
              <span id="af-classify-status">预设：不确定不移动</span>
            </div>
            <div id="af-lib"></div>
          </div>
          <div class="aiflash-view ${isTab ? "active" : ""}" data-view="graph">
            <div class="aiflash-graph-toolbar">
              <div class="aiflash-graph-legend">
                <span><i class="aiflash-dot aiflash-dot--good"></i>熟悉</span>
                <span><i class="aiflash-dot aiflash-dot--mid"></i>中间</span>
                <span><i class="aiflash-dot aiflash-dot--weak"></i>薄弱</span>
                <span><i class="aiflash-dot aiflash-dot--unknown"></i>未知</span>
              </div>
              <div class="aiflash-graph-actions">
                <select class="b3-select aiflash-graph-limit" id="af-graph-limit" title="控制图上显示的闪卡数量">
                  <option value="50">显示 50</option>
                  <option value="80" selected>显示 80</option>
                  <option value="120">显示 120</option>
                  <option value="200">显示 200</option>
                  <option value="9999">显示全部</option>
                </select>
                <label class="aiflash-graph-toggle">
                  <input type="checkbox" id="af-graph-weak-only">
                  <span>只看薄弱</span>
                </label>
                <button class="b3-button b3-button--outline" id="af-graph-ai">AI 分析关系</button>
<input class="b3-text-field aiflash-graph-search" id="af-graph-search" type="text" placeholder="搜索概念…" title="输入关键字高亮匹配节点">
<button class="b3-button b3-button--outline" id="af-graph-fit" title="自适应缩放">适配</button>
                <button class="b3-button b3-button--outline" id="af-graph-zoom-out">缩小</button>
                <span class="aiflash-graph-zoom" id="af-graph-zoom">100%</span>
                <button class="b3-button b3-button--outline" id="af-graph-zoom-in">放大</button>
                <button class="b3-button b3-button--outline" id="af-graph-fullscreen">全屏</button>
                <button class="b3-button b3-button--outline" id="af-graph-refresh">刷新图谱</button>
              </div>
            </div>
            <div class="aiflash-graph-layout">
              <div class="aiflash-graph-canvas" id="af-graph"><canvas id="af-graph-canvas"></canvas></div>
              <div class="aiflash-graph-detail" id="af-graph-detail"></div>
            </div>
          </div>
          <div class="aiflash-view" data-view="stats">
            <div class="aiflash-stats-toolbar">
              <select class="b3-select aiflash-stats-range" id="af-stats-range">
                <option value="7">近 7 天</option>
                <option value="14">近 14 天</option>
                <option value="30" selected>近 30 天</option>
                <option value="60">近 60 天</option>
              </select>
              <button class="b3-button b3-button--outline" id="af-stats-export">导出 PNG</button>
            </div>
            <div class="aiflash-stats-grid">
              <div class="aiflash-stats-card">
                <canvas id="af-stats-overview"></canvas>
              </div>
              <div class="aiflash-stats-card">
                <canvas id="af-stats-mastery"></canvas>
              </div>
            </div>
            <div class="aiflash-stats-chart">
              <canvas id="af-stats-curve"></canvas>
            </div>
          </div>
          <div class="aiflash-view" data-view="set">
            <select class="b3-select fn__block" id="af-provider">
              <option value="offline">离线规则</option>
              <option value="openai">OpenAI 官方</option>
              <option value="openai_compatible">OpenAI 兼容</option>
              <option value="custom">自定义 HTTP</option>
            </select>
            <input class="b3-text-field fn__block" id="af-url" placeholder="接口地址，例如 https://api.openai.com/v1/chat/completions">
            <input class="b3-text-field fn__block" id="af-key" placeholder="API Key，可留空">
            <input class="b3-text-field fn__block" id="af-model" placeholder="模型名">
            <label class="aiflash-setting-line">
              <input type="checkbox" id="af-auto-dedupe">
              <span>自动检测完全重复闪卡</span>
            </label>
            <div class="fn__flex aiflash-gap">
              <button class="b3-button b3-button--outline" id="af-test">测试连接</button>
              <button class="b3-button b3-button--outline" id="af-save">保存</button>
              <button class="b3-button b3-button--outline" id="af-sample">导入示例</button>
            </div>
            <div style="margin-top:16px;border-top:1px solid var(--b3-border-color);padding-top:14px;">
              <div class="sci-row" style="justify-content:space-between;margin-bottom:6px;">
                <div class="sci-section-title" style="font-size:12px;opacity:.7;">训练舱诊断日志</div>
                <button class="b3-button b3-button--outline" type="button" id="af-trainer-debug-toggle" style="padding:2px 8px;font-size:12px;">展开日志</button>
              </div>
              <div id="af-trainer-debug-panel" class="sci-debug-collapsed">
                <div id="af-trainer-debug"></div>
              </div>
            </div>
          </div>
        </div>
      </div>`;
  }

  bind(root) {
    root.querySelectorAll(".aiflash-tab").forEach((tab) => {
      tab.onclick = () => this.switchWorkbenchTab(root, tab.dataset.tab);
    });
    root
      .querySelector("#af-open-dock")
      ?.addEventListener("click", () => this.openDock());
    root.querySelector("#af-trainer-debug-toggle")?.addEventListener("click", async () => {
      const trainer = this.trainer();
      trainer.debugVisible = !trainer.debugVisible;
      await this.save();
      this.renderTrainerAll();
      this.renderTrainerDebugPanel(root, this.trainer());
    });
    root.querySelector("#af-count-mode").onchange = () =>
      this.syncGenerateCountMode(root);
    this.syncGenerateCountMode(root);
    root.querySelector("#af-pack").onchange = async () => {
      this.state.activePackId = root.querySelector("#af-pack").value;
      this.nativeCardsDeckID = "";
      this.resetQ();
      await this.save();
      this.renderAll();
    };
    root.querySelector("#af-pack-add").onclick = async () => {
      const input = root.querySelector("#af-pack-name");
      const name = input.value.trim();
      if (!name) {
        return showMessage("请输入卡包名");
      }
      try {
        await this.createNativeDeck(name);
        input.value = "";
        showMessage(`已创建思源原生卡包：${name}`);
      } catch (e) {
        showMessage("创建原生卡包失败：" + e.message);
      }
    };
    root.querySelector("#af-pack-refresh").onclick = async () => {
      try {
        await this.syncNativeDecks();
        this.nativeCardsDeckID = "";
        this.renderAll();
        showMessage("已刷新全部思源原生卡包");
      } catch (e) {
        showMessage("刷新原生卡包失败：" + e.message);
      }
    };
    root.querySelector("#af-pack-rename").onclick = () =>
      this.renameActiveNativeDeck();
    root.querySelector("#af-pack-remove").onclick = () =>
      this.removeActiveNativeDeck();
    root.querySelector("#af-pack-import").onclick = () => {
      this.addNativeDeckToActive(
        root.querySelector("#af-pack-import-source")?.value || "",
      );
    };
    root.querySelector("#af-gen").onclick = async () => {
      const text = root.querySelector("#af-src").value.trim();
      if (!text) {
        this.setGenerateStatus(root, "等待输入材料", "warn");
        return showMessage("请先粘贴内容");
      }
      this.setGenerateBusy(root, true);
      this.setGenerateStatus(root, "正在生成闪卡...", "running");
      try {
        const count = this.readGenerateCount(root);
        const style =
          root.querySelector("#af-card-style")?.value || "knowledge";
        this.gen = await this.ai(
          text,
          count,
          root.querySelector("#af-level").value,
          style,
        );
        this.setGenerateCount(root);
        if (count === "outline" && !this.gen.length) {
          this.setGenerateStatus(root, "按标题逐条未识别到可拆分结构", "warn");
          showMessage("未识别到 Markdown 标题或可用 JSON 字段");
        } else {
          this.setGenerateStatus(
            root,
            `生成完成，共 ${this.gen.length} 张`,
            "success",
          );
          showMessage("生成完成");
        }
      } catch (e) {
        const style =
          root.querySelector("#af-card-style")?.value || "knowledge";
        this.gen = this.offline(
          text,
          this.readGenerateCount(root),
          root.querySelector("#af-level").value,
          style,
        );
        this.setGenerateCount(root);
        this.setGenerateStatus(
          root,
          `AI 失败，已用离线规则生成 ${this.gen.length} 张`,
          "warn",
        );
        showMessage("AI失败，已用离线规则");
      } finally {
        this.setGenerateBusy(root, false);
      }
      this.renderGen(root);
    };
    root.querySelector("#af-add").onclick = async () => {
      if (!this.gen.length) {
        this.setGenerateStatus(root, "没有可写入的卡片", "warn");
        return showMessage("没有可加入的卡片");
      }
      this.setGenerateBusy(root, true);
      this.setGenerateStatus(
        root,
        `正在写入 ${this.gen.length} 张到思源...`,
        "running",
      );
      try {
        const count = await this.addGeneratedToNativeDeck();
        root.querySelector("#af-src").value = "";
        this.renderAll();
        this.roots.forEach((item) => {
          if (item?.isConnected) {
            this.setGenerateStatus(item, `写入完成，共 ${count} 张`, "success");
            this.setGenerateCount(item, 0);
          }
        });
        showMessage(`已写入思源并加入 ${count} 张原生闪卡`);
      } catch (e) {
        this.setGenerateStatus(root, `写入失败：${e.message}`, "error");
        showMessage("加入原生闪卡失败：" + e.message);
      } finally {
        this.setGenerateBusy(root, false);
      }
    };
    root.querySelector("#af-clear").onclick = () => {
      this.gen = [];
      root.querySelector("#af-src").value = "";
      this.renderGen(root);
      this.setGenerateCount(root, 0);
      this.setGenerateStatus(root, "已清空，空闲", "idle");
      showMessage("已清空");
    };
    root.querySelector("#af-save").onclick = async () => {
      this.readSet(root);
      await this.save();
      this.renderAll();
      showMessage("设置已保存");
    };
    root.querySelector("#af-test").onclick = async () => {
      this.readSet(root);
      try {
        const result = await this.ai(
          "苹果是一种常见水果，富含膳食纤维。",
          1,
          "基础",
          "knowledge",
        );
        showMessage(result.length ? "AI 连接成功" : "接口响应异常");
      } catch (e) {
        showMessage("AI 连接失败：" + e.message);
      }
    };
    root.querySelector("#af-sample").onclick = async () => {
      this.gen = SAMPLE.map(([front, back]) => ({ front, back }));
      try {
        const count = await this.addGeneratedToNativeDeck();
        this.renderAll();
        showMessage(`已导入 ${count} 张示例到思源原生闪卡`);
      } catch (e) {
        showMessage("导入示例失败：" + e.message);
      }
    };
    root.querySelector("#af-search").oninput = () => this.renderLib(root);
    root.querySelector("#af-refresh-cards").onclick = async () => {
      await this.loadNativeCards();
      this.renderLib(root);
      showMessage("已刷新原生卡片列表");
    };
    root.querySelector("#af-repair-math").onclick = () =>
      this.repairNativeMathEscapes();
    root.querySelector("#af-clean-duplicates").onclick = () =>
      this.cleanupDuplicateCards();
    root.querySelector("#af-check-missing").onclick = () =>
      this.checkMissingGeneratedCards();
    root.querySelector("#af-restore-missing").onclick = () =>
      this.restoreMissingGeneratedCards();
    root.querySelector("#af-clean-missing").onclick = () =>
      this.cleanupMissingGeneratedCards();
    root.querySelector("#af-ai-classify").onclick = () =>
      this.classifyQuickCards(root);
    root
      .querySelector("#af-graph-refresh")
      ?.addEventListener("click", async () => {
        await this.loadNativeCards().catch(() => null);
        this.renderGraph(root);
        showMessage("已刷新知识图谱");
      });
    root.querySelector("#af-graph-zoom-in")?.addEventListener("click", () => {
      if (this.graphRenderer) {
        const t = this.graphRenderer.viewTransform;
        const newScale = Math.min(5, t.scale * 1.2);
        const rect = this.graphRenderer.canvas.getBoundingClientRect();
        const cx = rect.width / 2, cy = rect.height / 2;
        const wx = (cx - t.offsetX) / t.scale, wy = (cy - t.offsetY) / t.scale;
        t.scale = newScale;
        t.offsetX = cx - wx * newScale;
        t.offsetY = cy - wy * newScale;
        this.graphRenderer.draw();
        const zoomLabel = root.querySelector("#af-graph-zoom");
        if (zoomLabel) zoomLabel.textContent = `${Math.round(newScale * 100)}%`;
      }
    });
    root.querySelector("#af-graph-zoom-out")?.addEventListener("click", () => {
      if (this.graphRenderer) {
        const t = this.graphRenderer.viewTransform;
        const newScale = Math.max(0.2, t.scale / 1.2);
        const rect = this.graphRenderer.canvas.getBoundingClientRect();
        const cx = rect.width / 2, cy = rect.height / 2;
        const wx = (cx - t.offsetX) / t.scale, wy = (cy - t.offsetY) / t.scale;
        t.scale = newScale;
        t.offsetX = cx - wx * newScale;
        t.offsetY = cy - wy * newScale;
        this.graphRenderer.draw();
        const zoomLabel = root.querySelector("#af-graph-zoom");
        if (zoomLabel) zoomLabel.textContent = `${Math.round(newScale * 100)}%`;
      }
    });
    root.querySelector("#af-graph-fit")?.addEventListener("click", () => {
      if (this.graphRenderer) this.graphRenderer.applyFitToView();
    });
    root.querySelector("#af-graph-search")?.addEventListener("input", (event) => {
      this.graphSearchQuery = event.target.value || "";
      if (this.graphRenderer) this.graphRenderer.setSearchQuery(this.graphSearchQuery);
    });
    root
      .querySelector("#af-graph-limit")
      ?.addEventListener("change", (event) => {
        this.graphLimit = Number(event.target.value) || 80;
        this.renderGraph(root);
      });
    root
      .querySelector("#af-graph-weak-only")
      ?.addEventListener("change", (event) => {
        this.graphWeakOnly = Boolean(event.target.checked);
        this.renderGraph(root);
      });
    root
      .querySelector("#af-graph-ai")
      ?.addEventListener("click", () => this.analyzeGraphWithAI(root));
    root
      .querySelector("#af-graph-fullscreen")
      ?.addEventListener("click", () => {
        this.graphFullscreen = !this.graphFullscreen;
        root
          .querySelector('[data-view="graph"]')
          ?.classList.toggle("aiflash-graph-fullscreen", this.graphFullscreen);
        this.renderGraph(root);
      });
    // 统计 tab 事件
    root.querySelector("#af-stats-range")?.addEventListener("change", () => {
      this.renderStats(root);
    });
    root.querySelector("#af-stats-export")?.addEventListener("click", () => {
      const curveCanvas = root.querySelector("#af-stats-curve");
      if (!curveCanvas) return showMessage("请先生成图表");
      try {
        const link = document.createElement("a");
        link.download = `学习曲线_${chart.formatDate(new Date())}.png`;
        link.href = curveCanvas.toDataURL("image/png");
        link.click();
        showMessage("图表已导出");
      } catch (e) {
        showMessage("导出失败：" + e.message);
      }
    });
    root.querySelector("#af-stats-curve")?.addEventListener("mousemove", (event) => {
      const curveCanvas = root.querySelector("#af-stats-curve");
      if (!curveCanvas || !this.chartCurveLayout) return;
      const rect = curveCanvas.getBoundingClientRect();
      const mx = event.clientX - rect.left;
      const days = Number(root.querySelector("#af-stats-range")?.value || 30);
      const history = this.state.reviewHistory || [];
      const curveData = chart.prepareCurveData(history, days);
      const hoverIndex = chart.hitTestCurve(mx, this.chartCurveLayout);
      const ctx = curveCanvas.getContext("2d");
      chart.drawLearningCurve(ctx, { width: rect.width, height: rect.height }, curveData, { hoverIndex, colors: chart.getThemeColors(curveCanvas) });
    });
    root.querySelector("#af-stats-curve")?.addEventListener("mouseleave", () => {
      const curveCanvas = root.querySelector("#af-stats-curve");
      if (!curveCanvas || !this.chartCurveLayout) return;
      const rect = curveCanvas.getBoundingClientRect();
      const days = Number(root.querySelector("#af-stats-range")?.value || 30);
      const history = this.state.reviewHistory || [];
      const curveData = chart.prepareCurveData(history, days);
      const ctx = curveCanvas.getContext("2d");
      chart.drawLearningCurve(ctx, { width: rect.width, height: rect.height }, curveData, { colors: chart.getThemeColors(curveCanvas) });
    });
  }

  readSet(root) {
    this.state.settings = {
      provider: root.querySelector("#af-provider").value,
      baseUrl: root.querySelector("#af-url").value.trim(),
      apiKey: root.querySelector("#af-key").value.trim(),
      model: root.querySelector("#af-model").value.trim() || "gpt-4o-mini",
      autoDedupe: Boolean(root.querySelector("#af-auto-dedupe")?.checked),
    };
  }

  trainerSupportsDirectAI() {
    return (this.state.settings?.provider || "offline") !== "offline";
  }

  normalizeTrainerAcceptedCard(card) {
    const t = this.trainer();
    return tl.normalizeTrainerAcceptedCard(card, {
      topic: t.topic, depth: t.depth, angle: t.angle,
      uid: `trainer-${this.uid()}`,
    });
  }

  trainerAnalyze(topic, depth) { return tl.trainerAnalyze(topic, depth); }

  trainerGenerateCards(analysis, angle, depth) { return tl.trainerGenerateCards(analysis, angle, depth); }

  trainerBuildPrompt(topic, depth) { return tl.trainerBuildPrompt(topic, depth); }

  trainerBuildRefinePrompt(action, angle = "") {
    return tl.trainerBuildRefinePrompt(this.trainer().current, action, angle);
  }

  trainerBuildClassifyPrompt(card) { return tl.trainerBuildClassifyPrompt(card); }

  trainerExtractJsonCandidate(text) { return tl.trainerExtractJsonCandidate(text); }
  
  trainerParseAIContent(content) { return tl.trainerParseAIContent(content); }
  
  trainerFirstText(source, keys) { return tl.trainerFirstText(source, keys); }
  
  trainerNormalizeAICard(card, index = 0) { return tl.trainerNormalizeAICard(card, index); }
  
  trainerAIShape(value, cardsSource = []) { return tl.trainerAIShape(value, cardsSource); }
  
  trainerNormalizeAnalysis(value, fallbackTopic, depth) {
    return tl.trainerNormalizeAnalysis(value, fallbackTopic, depth, this.trainer());
  }
  
  trainerNormalizeClassification(raw, fallbackCard) {
    return tl.trainerNormalizeClassification(raw, fallbackCard);
  }
  
  trainerDiagnoseAIError(error) {
    return tl.trainerDiagnoseAIError(error, this.state?.settings?.model);
  }

  async trainerRequestAIContent(prompt) {
    const settings = this.state.settings || {};
    if ((settings.provider || "offline") === "offline") {
      throw Error("当前为离线规则模式");
    }
    const url = this.resolveAIEndpoint(settings);
    if (!url) {
      throw Error("未配置接口地址");
    }
    const headers = { "Content-Type": "application/json" };
    if (settings.apiKey) {
      headers.Authorization = `Bearer ${settings.apiKey}`;
    }
    let response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: settings.model || "gpt-4o-mini",
          temperature: 0.35,
          top_p: 0.7,
          max_tokens: 1600,
          stream: false,
          messages: [{ role: "user", content: prompt }],
        }),
      });
    } catch (error) {
      throw Error(`网络请求失败：${error.message}`);
    }
    const body = await response.text();
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`);
      error.status = response.status;
      error.body = body.slice(0, 800);
      throw error;
    }
    const raw = String(body || "").trim();
    if (!raw) {
      throw Error("接口返回空响应");
    }
    if (raw.startsWith("data:")) {
      const chunks = raw
        .split(/\n+/)
        .map((line) => line.trim())
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .filter((line) => line && line !== "[DONE]");
      const text = chunks
        .map((line) => {
          try {
            const parsed = JSON.parse(line);
            const content =
              parsed?.choices?.[0]?.message?.content ||
              parsed?.choices?.[0]?.delta?.content ||
              parsed?.message?.content ||
              parsed?.result ||
              parsed?.text ||
              parsed?.content ||
              "";
            return typeof content === "string" ? content : JSON.stringify(content);
          } catch {
            return "";
          }
        })
        .join("")
        .trim();
      if (text) {
        return text;
      }
      throw Error("SSE 响应中没有文本内容，请检查模型名、额度或权限");
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw Error(`接口返回的不是有效 JSON：${error.message}`);
    }
    if (parsed?.error) {
      const apiError = new Error(parsed.error.message || "接口返回错误");
      apiError.body = JSON.stringify(parsed.error).slice(0, 800);
      throw apiError;
    }
    const content =
      parsed?.choices?.[0]?.message?.content ||
      parsed?.choices?.[0]?.delta?.content ||
      parsed?.message?.content ||
      parsed?.data?.choices?.[0]?.message?.content ||
      parsed?.result ||
      parsed?.text ||
      parsed?.content ||
      parsed;
    const text = typeof content === "string" ? content : JSON.stringify(content);
    if (!text.trim()) {
      throw Error("JSON 响应中没有文本内容");
    }
    return text;
  }

  async trainerCallAI(topic, depth) {
    const content = await this.trainerRequestAIContent(
      this.trainerBuildPrompt(topic, depth),
    );
    return this.trainerNormalizeAnalysis(
      this.trainerParseAIContent(content),
      topic,
      depth,
    );
  }

  async trainerCallRefineAI(action, angle = "") {
    const trainer = this.trainer();
    if (!trainer.current) {
      return null;
    }
    const content = await this.trainerRequestAIContent(
      this.trainerBuildRefinePrompt(action, angle),
    );
    return this.trainerNormalizeAnalysis(
      this.trainerParseAIContent(content),
      trainer.current.topic,
      trainer.current.depth,
    );
  }

  async trainerCallClassifyAI(card) {
    const content = await this.trainerRequestAIContent(
      this.trainerBuildClassifyPrompt(card),
    );
    return this.trainerNormalizeClassification(
      this.trainerParseAIContent(content),
      card,
    );
  }

  trainerApplyClassification(card, classification, source = "ai") {
    tl.trainerApplyClassification(card, classification, source);
  }

  trainerCreateAcceptedCard(card) {
    return tl.trainerCreateAcceptedCard(card, this.trainer(), this.uid());
  }

  trainerNormalizeActiveDraftIndex() {
    tl.trainerNormalizeActiveDraftIndex(this.trainer());
  }

  trainerFocusDraftAfterRemoval(removedIndex, emptyMobileView) {
    tl.trainerFocusDraftAfterRemoval(this.trainer(), removedIndex, emptyMobileView);
  }

  async trainerSetAngle(root, angle) {
    let refined = null;
    try {
      refined = await this.trainerCallRefineAI("angle", angle);
      const trainer = this.trainer();
      trainer.current = refined || trainer.current;
      trainer.apiStatus = "AI 已按新角度重组";
    } catch (error) {
      const trainer = this.trainer();
      trainer.apiStatus = `AI 角度重组失败，已使用本地规则：${this.trainerDiagnoseAIError(error)}`;
    }
    const trainer = this.trainer();
    trainer.angle = angle;
    trainer.drafts = this.trainerGenerateCards(
      trainer.current,
      angle,
      trainer.depth,
    );
    trainer.mobileView = "drafts";
    await this.save();
    this.renderTrainerAll();
  }

  trainerApplyLocalTune(action) {
    const trainer = this.trainer();
    const current = trainer.current;
    if (!current) return;
    if (action === "easy") {
      trainer.drafts = trainer.drafts.map((card) => ({
        ...card,
        back: `简单版：${card.back}`,
      }));
      showMessage("已降级为更直观的表达");
    }
    if (action === "hard") {
      trainer.drafts.push({
        type: "追问卡",
        front: `“${current.topic}”的适用条件改变时，结论可能如何变化？`,
        back: "先找出原结论依赖的条件，再逐个改变条件观察公式、方向或判断标准是否变化。",
        status: "draft",
      });
      showMessage("已增加一张高阶追问卡");
    }
    if (action === "example") {
      trainer.drafts.push({
        type: "例子卡",
        front: `用一个生活或考试例子解释“${current.topic}”。`,
        back: current.note,
        status: "draft",
      });
      showMessage("已补充例子卡");
    }
    if (action === "rewrite") {
      trainer.drafts = this.trainerGenerateCards(
        current,
        trainer.angle || current.options?.[0],
        current.depth,
      );
      showMessage("已本地重组卡片");
    }
    trainer.drafts = trainer.drafts.slice(0, 5);
  }

  async trainerTune(root, action) {
    const trainer = this.trainer();
    const current = trainer.current;
    if (!current) return;
    const progressText =
      {
        easy: "正在改成更直观的表达...",
        hard: "正在增加高质量追问...",
        example: "正在更换例子...",
        rewrite: "正在重写卡片...",
        angle: "正在切换学习角度...",
      }[action] || "正在改写卡片...";
    trainer.tuneProgress = {
      action,
      text: progressText,
      startedAt: new Date().toISOString(),
    };
    await this.save();
    this.renderTrainerAll();
    try {
      const refined = await this.trainerCallRefineAI(action);
      const liveTrainer = this.trainer();
      if (refined) {
        liveTrainer.current = refined;
        liveTrainer.angle = liveTrainer.angle || refined.options?.[0] || liveTrainer.angle;
        liveTrainer.drafts = this.trainerGenerateCards(refined, liveTrainer.angle, refined.depth);
        liveTrainer.mobileView = "drafts";
        liveTrainer.apiStatus = "AI 已按反馈改写";
        showMessage("AI 已按反馈改写");
      } else {
        this.trainerApplyLocalTune(action);
        this.trainer().apiStatus = "未配置 AI 接口，已使用本地反馈规则";
      }
    } catch (error) {
      this.trainerApplyLocalTune(action);
      this.trainer().apiStatus = `AI 反馈改写失败，已使用本地规则：${this.trainerDiagnoseAIError(error)}`;
    }
    const finalTrainer = this.trainer();
    if (finalTrainer.drafts.length) finalTrainer.mobileView = "drafts";
    this.trainerNormalizeActiveDraftIndex();
    finalTrainer.tuneProgress = null;
    await this.save();
    this.renderTrainerAll();
  }

  trainerOpenDraft(root, index) {
    this.trainer().activeDraftIndex = index;
    this.renderTrainerAll();
  }

  trainerCloseDraft(root) {
    this.trainer().activeDraftIndex = null;
    this.renderTrainerAll();
  }

  async trainerAccept(root, index) {
    const trainer = this.trainer();
    const card = trainer.drafts[index];
    if (!card) return;
    const acceptedCard = this.trainerCreateAcceptedCard(card);
    trainer.accepted.unshift(acceptedCard);
    trainer.drafts.splice(index, 1);
    this.trainerFocusDraftAfterRemoval(index, "library");
    await this.save();
    this.renderTrainerAll();
    showMessage("已确认 1 张卡片，正在尝试 AI 分类");
    if (!this.trainerSupportsDirectAI()) {
      this.trainer().apiStatus = "当前为离线规则模式，跳过 AI 分类";
      await this.save();
      this.renderTrainerAll();
      return;
    }
    try {
      const classification = await this.trainerCallClassifyAI(acceptedCard);
      const liveTrainer = this.trainer();
      if (classification) {
        this.trainerApplyClassification(acceptedCard, classification, "ai");
        liveTrainer.apiStatus = "AI 分类完成";
      }
    } catch (error) {
      this.trainerApplyClassification(
        acceptedCard,
        {
          subject: acceptedCard.subject,
          domain: acceptedCard.domain,
          chapter: acceptedCard.topic,
          knowledgeType: acceptedCard.cardType,
          cardType: acceptedCard.cardType,
          difficulty: "medium",
          tags: acceptedCard.tags,
          prerequisites: [],
          examUse: "",
        },
        "rule",
      );
      acceptedCard.classificationError = this.trainerDiagnoseAIError(error);
      this.trainer().apiStatus = `AI 分类失败，已保留规则分类：${acceptedCard.classificationError}`;
    }
    await this.save();
    this.renderTrainerAll();
  }

  async trainerDiscard(root, index) {
    const trainer = this.trainer();
    const card = trainer.drafts[index];
    if (!card) return;
    trainer.drafts.splice(index, 1);
    trainer.discarded += 1;
    this.trainerFocusDraftAfterRemoval(index, "input");
    await this.save();
    this.renderTrainerAll();
    showMessage("已丢弃低价值卡片");
  }

  async trainerAnalyzeTopic(root) {
    const trainer = this.trainer();
    const topic = String(root.querySelector("#af-trainer-topic")?.value || "").trim();
    if (!topic) {
      showMessage("先输入一个理科知识点或题目");
      return;
    }
    trainer.topic = topic;
    trainer.depth = root.querySelector("#af-trainer-depth")?.value || "日常理解";
    trainer.analyzing = true;
    this.trainerDebug("点击拆解", `topic=${topic}, depth=${trainer.depth}`);
    this.renderTrainerAll();
    try {
      this.trainerDebug(
        "开始拆解",
        this.trainerSupportsDirectAI() ? "调用 AI" : "离线规则",
      );
      this.renderTrainerAll();
      const analysis = this.trainerSupportsDirectAI()
        ? (await this.trainerCallAI(topic, trainer.depth)) || this.trainerAnalyze(topic, trainer.depth)
        : this.trainerAnalyze(topic, trainer.depth);
      const liveTrainer = this.trainer();
      liveTrainer.current = analysis;
      liveTrainer.apiStatus = liveTrainer.current.source === "ai" ? "AI 生成成功" : "使用本地规则生成";
      this.trainerDebug(
        "拆解完成",
        `source=${liveTrainer.current.source || "local"}, cards=${(liveTrainer.current.cards || []).length}`,
      );
    } catch (error) {
      const liveTrainer = this.trainer();
      liveTrainer.current = this.trainerAnalyze(topic, liveTrainer.depth || trainer.depth);
      liveTrainer.apiStatus = `AI 生成失败，已回退本地规则：${this.trainerDiagnoseAIError(error)}`;
      this.trainerDebug("拆解失败回退", this.trainerDiagnoseAIError(error));
      showMessage("AI 生成失败，已使用本地规则");
    } finally {
      this.trainer().analyzing = false;
    }
    const finalTrainer = this.trainer();
    finalTrainer.angle = finalTrainer.current.options?.[0] || finalTrainer.angle;
    finalTrainer.drafts = this.trainerGenerateCards(
      finalTrainer.current,
      finalTrainer.angle,
      finalTrainer.depth,
    );
    this.trainerDebug("草稿生成", `drafts=${finalTrainer.drafts.length}`);
    if (!finalTrainer.drafts.length) {
      const fallback = this.trainerAnalyze(topic, finalTrainer.depth);
      finalTrainer.current = fallback;
      finalTrainer.angle = fallback.options?.[0] || finalTrainer.angle;
      finalTrainer.drafts = this.trainerGenerateCards(fallback, finalTrainer.angle, finalTrainer.depth);
      finalTrainer.apiStatus = "AI 已响应，但没有生成可显示卡片，已使用本地规则兜底";
      this.trainerDebug("草稿为空兜底", `fallbackDrafts=${finalTrainer.drafts.length}`);
    }
    finalTrainer.mobileView = "drafts";
    await this.save();
    this.renderTrainerAll();
    showMessage("已拆解为训练卡片草稿");
  }

  async trainerWriteAcceptedToCurrentDocument() {
    const trainer = this.trainer();
    const cards = trainer.accepted || [];
    if (!cards.length) {
      showMessage("暂无已确认卡片");
      return;
    }
    const sql = await this.api("/api/query/sql", {
      stmt: "select root_id as rootID from blocks where type = 'd' order by updated desc limit 1",
    }).catch(() => []);
    const parentID = Array.isArray(sql) ? sql[0]?.rootID || sql[0]?.id || "" : "";
    if (!parentID) {
      trainer.writeStatus = "写入失败：未找到当前思源文档，请先激活一个文档页签";
      await this.save();
      throw Error("未找到当前打开的思源文档，请先激活一个文档页签");
    }
    const markdown = `## 理科训练舱卡片\n\n${cards
      .map((card) => {
        const tags = (card.tags || []).map((tag) => `#${tag}`).join(" ");
        const prerequisites = (card.prerequisites || []).join("、") || "未整理";
        return `### ${card.cardType || "理科卡片"}：${this.normalizeCardText(card.front)}\n\n**答案**：${this.normalizeCardText(card.back)}\n\n**主题**：${card.topic}\n\n**分类**：${card.subject || "未分类"} / ${card.domain || "待整理"}${card.chapter ? ` / ${card.chapter}` : ""}\n\n**难度**：${card.difficulty || "medium"}\n\n**前置概念**：${prerequisites}\n\n**用途**：${card.examUse || "复习巩固"}\n\n${tags}`;
      })
      .join("\n\n---\n\n")}`;
    await this.api("/api/block/insertBlock", {
      dataType: "markdown",
      data: markdown,
      parentID,
    });
    trainer.writeStatus = `已写入当前文档：${cards.length} 张卡片`;
    await this.save();
    showMessage(trainer.writeStatus);
  }

  async trainerAddAcceptedToDeck() {
    const trainer = this.trainer();
    const cards = trainer.accepted || [];
    if (!cards.length) {
      showMessage("暂无已确认卡片");
      return;
    }
    const result = await this.addCardsToNativeDeck(
      cards.map((card) => ({
        front: this.normalizeCardText(card.front),
        back: this.normalizeCardText(card.back),
      })),
      this.activePack()?.id,
    );
    const addedCount = result?.count || cards.length;
    const deckName = this.activePack()?.name ? `「${this.activePack().name}」` : "当前卡包";
    trainer.accepted = [];
    trainer.mobileView = "library";
    trainer.workbenchStatus = `已加入 ${deckName}：${addedCount} 张卡片；已清空训练舱卡片库`;
    await this.save();
    this.renderTrainerAll();
    showMessage(trainer.workbenchStatus);
    return result;
  }

  trainerDownload(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    showMessage(`已导出 ${filename}`);
  }

  trainerExportJSON() {
    const accepted = this.trainer().accepted || [];
    if (!accepted.length) {
      showMessage("暂无已确认卡片");
      return;
    }
    this.trainerDownload(
      "science-trainer-siyuan-cards.json",
      tui.acceptedToJSON(accepted),
      "application/json;charset=utf-8",
    );
  }

  trainerExportMarkdown() {
    const accepted = this.trainer().accepted || [];
    if (!accepted.length) {
      showMessage("暂无已确认卡片");
      return;
    }
    this.trainerDownload(
      "science-trainer-siyuan-cards.md",
      tui.acceptedToMarkdown(accepted),
      "text/markdown;charset=utf-8",
    );
  }

  render(root) {
    this.fixDay();
    this.resetQ();
    const settings = this.state.settings;
    this.renderPacks(root);
    root.querySelector("#af-provider").value = settings.provider || "offline";
    root.querySelector("#af-url").value = settings.baseUrl || "";
    root.querySelector("#af-key").value = settings.apiKey || "";
    root.querySelector("#af-model").value = settings.model || "gpt-4o-mini";
    const autoDedupe = root.querySelector("#af-auto-dedupe");
    if (autoDedupe) {
      autoDedupe.checked = Boolean(settings.autoDedupe);
    }
    this.renderReview(root);
    this.renderGen(root);
    this.renderTrainer(root);
    this.renderLib(root);
    this.renderGraph(root);
    this.renderStats(root);
  }

  async loadNativeCards(deckID = this.state.activePackId) {
    if (!deckID) {
      this.nativeCards = [];
      this.nativeCardsDeckID = "";
      this.nativeCardsPartial = false;
      return [];
    }
    this.nativeCards = await this.hydrateNativeCardDOM(
      await this.getNativeDeckCards(deckID),
    );
    this.nativeCardsDeckID = deckID;
    this.nativeCardsPartial = false;
    return this.nativeCards;
  }

  renderPacks(root) {
    const select = root.querySelector("#af-pack");
    if (!select) {
      return;
    }
    select.innerHTML = this.state.packs
      .map((pack) => {
        const cards = this.packCards(pack.id);
        const total = pack.cardCount ?? cards.length;
        const due =
          pack.dueCardCount ??
          cards.filter((card) => (card.dueAt || 0) <= Date.now()).length;
        const name =
          pack.quick || this.isQuickDeckID(pack.id)
            ? `快速制卡 · ${total} 张`
            : `${pack.name} · ${total} 张 · ${due} 待复习`;
        return `<option value="${pack.id}">${this.esc(name)}</option>`;
      })
      .join("");
    select.value = this.activePack()?.id || "";
    const activePack = this.activePack();
    const isQuick = Boolean(
      activePack?.quick || this.isQuickDeckID(activePack?.id),
    );
    const renameButton = root.querySelector("#af-pack-rename");
    const removeButton = root.querySelector("#af-pack-remove");
    if (renameButton) {
      renameButton.disabled = isQuick;
      renameButton.title = isQuick ? "快速制卡是思源内置卡组，不能重命名" : "";
    }
    if (removeButton) {
      removeButton.disabled = isQuick;
      removeButton.title = isQuick ? "快速制卡是思源内置卡组，不能删除" : "";
    }
    const importSelect = root.querySelector("#af-pack-import-source");
    if (importSelect) {
      const activeID = activePack?.id || "";
      const sources = this.state.packs.filter((pack) => pack.id !== activeID);
      importSelect.innerHTML = sources.length
        ? `<option value="">选择要移动的原生卡组</option>` +
          sources
            .map((pack) => {
              const total = pack.cardCount ?? 0;
              const name =
                pack.quick || this.isQuickDeckID(pack.id)
                  ? "快速制卡"
                  : pack.name;
              return `<option value="${pack.id}">${this.esc(name)} · ${total} 张</option>`;
            })
            .join("")
        : `<option value="">没有其他原生卡组</option>`;
      importSelect.disabled = !sources.length;
      const importButton = root.querySelector("#af-pack-import");
      if (importButton) {
        importButton.disabled = !sources.length;
      }
    }
  }

  renderReview(root) {
    const box = root.querySelector("#af-review");
    const pack = this.activePack() || {
      name: "未选择",
      cardCount: 0,
      dueCardCount: 0,
    };
    box.innerHTML = `
      <div class="aiflash-stat-grid">
        <div><span>当前卡包</span><strong>${this.esc(pack.name)}</strong></div>
        <div><span>卡片总数</span><strong>${pack.cardCount ?? this.packCards().length}</strong></div>
        <div><span>待复习</span><strong>${pack.dueCardCount ?? 0}</strong></div>
      </div>
      <div class="aiflash-review-card">
        <div class="aiflash-card-label">思源原生复习</div>
        <div class="aiflash-q">卡片已经写入思源块，并通过 riff 接口加入原生闪卡。复习、评分、调度由思源接管。</div>
        <div class="aiflash-grade-row">
          <button class="b3-button b3-button--outline" id="af-open-native-review">打开原生复习</button>
          <button class="b3-button b3-button--outline" id="af-open-storage-doc">打开存放文档</button>
          <button class="b3-button b3-button--outline" id="af-refresh-decks">刷新卡包</button>
        </div>
      </div>`;
    box.querySelector("#af-open-native-review").onclick = () =>
      this.openNativeReview();
    box.querySelector("#af-open-storage-doc").onclick = () =>
      this.openStorageDoc();
    box.querySelector("#af-refresh-decks").onclick = async () => {
      await this.syncNativeDecks();
      this.renderAll();
      showMessage("已刷新思源原生卡包");
    };
  }

  renderGen(root) {
    this.setGenerateCount(root);
    const total = this.gen.length;
    const previewCards = this.gen.slice(0, GEN_PREVIEW_LIMIT);
    root.querySelector("#af-result").innerHTML = total
      ? `${total > GEN_PREVIEW_LIMIT ? `<div class="aiflash-preview-note">共生成 ${total} 张，仅预览前 ${GEN_PREVIEW_LIMIT} 张；写入时会写入全部。</div>` : ""}
        ${previewCards
          .map(
            (card, index) => `
          <div class="aiflash-item aiflash-item--preview aiflash-item--compact">
            <small>生成结果 ${index + 1}</small>
            <strong>${this.esc(card.front)}</strong>
            <div>${this.esc(String(card.back || "").slice(0, 220))}${String(card.back || "").length > 220 ? "..." : ""}</div>
          </div>`,
          )
          .join("")}`
      : `<div class="aiflash-empty">生成结果会显示在这里</div>`;
  }

  trainerShellReady(root) {
    return Boolean(
      root.querySelector(".aiflash-trainer-wrap") &&
        root.querySelector("#af-trainer-topic") &&
        root.querySelector("#af-trainer-depth") &&
        root.querySelector("#af-trainer-analysis") &&
        root.querySelector("#af-trainer-cards") &&
        root.querySelector("#af-trainer-library") &&
        root.querySelector("#af-trainer-detail"),
    );
  }

  ensureTrainerShell(root) {
    const box = root.querySelector("#af-trainer");
    if (!box || (box.dataset.mounted === "1" && this.trainerShellReady(root))) {
      return;
    }
    delete box.dataset.staticBound;
    box.innerHTML = `
      <div class="sci-wrap aiflash-trainer-wrap" data-mobile-view="input">
        <div class="sci-hero">
          <div><div class="sci-kicker">Guided Science Trainer</div><h2>理科训练舱</h2><p>输入一个复杂知识点，让 AI 先拆解、追问，再生成少量高质量卡片。</p></div>
          <div class="sci-score"><strong id="af-trainer-confirmed-count">0</strong><span>已确认</span></div>
        </div>
        <div class="sci-mobile-tabs" aria-label="手机主视图">
          <button class="sci-mobile-tab" type="button" data-mobile-view="input">输入</button>
          <button class="sci-mobile-tab" type="button" data-mobile-view="drafts">草稿 <span id="af-trainer-draft-count">0</span></button>
          <button class="sci-mobile-tab" type="button" data-mobile-view="library">卡库 <span id="af-trainer-library-count">0</span></button>
        </div>
        <div class="sci-panel" data-mobile-panel="input">
          <label>信息种子 / 题目</label>
          <textarea class="b3-text-field sci-input" id="af-trainer-topic" placeholder="例如：斜面上物体的受力分析、导数判断单调性、电容器充放电"></textarea>
          <div class="sci-row"><select class="b3-select" id="af-trainer-depth"><option>日常理解</option><option>考试应对</option><option>深入推导</option></select><button class="b3-button" id="af-trainer-analyze">拆解这个知识点</button></div>
          <div id="af-trainer-input-status"></div>
        </div>
        <div class="sci-panel" id="af-trainer-analysis" data-mobile-panel="input"></div>
        <div class="sci-panel" id="af-trainer-cards" data-mobile-panel="drafts"></div>
        <div class="sci-panel" id="af-trainer-library" data-mobile-panel="library"></div>
        <div id="af-trainer-detail"></div>
      </div>`;
    box.dataset.mounted = "1";
    this.bindTrainerStaticEvents(root);
  }

  bindTrainerStaticEvents(root) {
    const box = root.querySelector("#af-trainer");
    if (!box || box.dataset.staticBound === "1") {
      return;
    }
    box.dataset.staticBound = "1";
    box.querySelector("#af-trainer-topic")?.addEventListener("input", (event) => {
      this.trainer().topic = event.target.value;
      this.syncTrainerInputs(root);
    });
    box.querySelector("#af-trainer-depth")?.addEventListener("change", (event) => {
      this.trainer().depth = event.target.value;
      this.syncTrainerInputs(root);
    });
    box.querySelector("#af-trainer-analyze")?.addEventListener("click", () =>
      this.trainerAnalyzeTopic(root),
    );
    box.querySelectorAll("[data-mobile-view]").forEach((button) => {
      button.onclick = async () => {
        const trainer = this.trainer();
        trainer.mobileView = button.dataset.mobileView;
        await this.save();
        this.renderTrainerAll();
      };
    });
  }

  updateTrainerShell(root, trainer) {
    const mobileView = trainer.mobileView || (trainer.drafts.length ? "drafts" : "input");
    trainer.mobileView = mobileView;
    const wrap = root.querySelector(".aiflash-trainer-wrap");
    if (wrap) {
      wrap.dataset.mobileView = mobileView;
    }
    root.querySelector("#af-trainer-confirmed-count").textContent = String(
      trainer.accepted.length,
    );
    root.querySelector("#af-trainer-draft-count").textContent = String(
      trainer.drafts.length,
    );
    root.querySelector("#af-trainer-library-count").textContent = String(
      trainer.accepted.length,
    );
    root.querySelectorAll("[data-mobile-view]").forEach((button) => {
      button.classList.toggle(
        "sci-mobile-tab--active",
        button.dataset.mobileView === mobileView,
      );
    });
    const topicInput = root.querySelector("#af-trainer-topic");
    if (topicInput && document.activeElement !== topicInput) {
      const nextValue = String(trainer.topic || "");
      if (topicInput.value !== nextValue) {
        topicInput.value = nextValue;
      }
    }
    const depthSelect = root.querySelector("#af-trainer-depth");
    if (depthSelect && document.activeElement !== depthSelect) {
      const nextValue = String(trainer.depth || "日常理解");
      if (depthSelect.value !== nextValue) {
        depthSelect.value = nextValue;
      }
    }
    const inputStatus = root.querySelector("#af-trainer-input-status");
    const analyzeButton = root.querySelector("#af-trainer-analyze");
    if (analyzeButton) {
      analyzeButton.disabled = Boolean(trainer.analyzing);
      analyzeButton.textContent = trainer.analyzing ? "正在拆解..." : "拆解这个知识点";
    }
    if (inputStatus) {
      inputStatus.innerHTML = `
        <div class="sci-write-status">${this.esc(trainer.apiStatus || "使用主插件 AI 设置")}</div>
        ${this.trainerSupportsDirectAI() ? "" : `<div class="sci-write-status">当前是离线规则模式；如需更强拆解/分类，请先在“设置”标签中配置 AI 接口。</div>`}`;
    }
  }

  renderTrainerDebugPanel(root, trainer) {
    const panel = root.querySelector("#af-trainer-debug-panel");
    const box = root.querySelector("#af-trainer-debug");
    const toggle = root.querySelector("#af-trainer-debug-toggle");
    if (!box) {
      return;
    }
    const collapsed = trainer.debugVisible === false || trainer.debugVisible === undefined;
    if (toggle) {
      toggle.textContent = collapsed ? "展开日志" : "收起日志";
    }
    if (panel) {
      panel.classList.toggle("sci-debug-collapsed", collapsed);
    }
    if (collapsed) {
      box.innerHTML = "";
      return;
    }
    const shape = trainer.debugLastAIShape || {};
    const rows = [
      ["代码版本", "trainer-debug-2026-06-13-2"],
      ["lastAction", trainer.debugLastAction || ""],
      ["topic", trainer.topic || ""],
      ["depth", trainer.depth || ""],
      ["analyzing", trainer.analyzing ? "yes" : "no"],
      ["current", trainer.current ? "yes" : "no"],
      ["drafts", String((trainer.drafts || []).length)],
      ["accepted", String((trainer.accepted || []).length)],
      ["mobileView", trainer.mobileView || ""],
      ["roots", String(this.roots?.size || 0)],
      ["apiStatus", trainer.apiStatus || ""],
      ["AI valueType", shape.valueType || ""],
      ["AI keys", Array.isArray(shape.keys) ? shape.keys.join(", ") : ""],
      ["AI cardCount", shape.cardCount === undefined ? "" : String(shape.cardCount)],
      ["AI firstCardKeys", Array.isArray(shape.firstCardKeys) ? shape.firstCardKeys.join(", ") : ""],
    ];
    box.innerHTML = `
      <div class="sci-api-status">
        ${rows.map(([key, value]) => `<div><strong>${this.esc(key)}</strong>：${this.esc(value)}</div>`).join("")}
        <div style="margin-top:8px"><strong>最近日志</strong></div>
        ${(trainer.debugLog || []).map((line) => `<div>${this.esc(line)}</div>`).join("") || "<div>暂无日志</div>"}
      </div>`;
  }

  renderTrainerAnalysisPanel(root, trainer, current, tuneDisabled) {
    const panel = root.querySelector("#af-trainer-analysis");
    if (!panel) {
      return;
    }
    panel.innerHTML = !current
      ? `<div class="sci-empty">输入一个理科知识点，先体验“拆解 → 追问 → 制卡”的小闭环。</div>`
      : `
          <div class="sci-section-title">AI 拆解结果</div>
          ${trainer.tuneProgress ? `<div class="sci-progress" role="status" aria-live="polite"><div class="sci-progress-head"><span>${this.esc(trainer.tuneProgress.text || "正在改写卡片...")}</span><strong>处理中</strong></div><div class="sci-progress-bar"><i></i></div></div>` : ""}
          <div class="sci-meta"><span>${this.esc(current.type)}</span><span>${this.esc(trainer.depth)}</span></div>
          <div class="sci-note">${this.esc(current.note)}</div>
          <div class="sci-question">${this.esc(current.question)}</div>
          <div class="sci-options">${(current.options || []).map((option) => `<button class="b3-button b3-button--outline ${option === trainer.angle ? "sci-active" : ""}" data-angle="${this.esc(option)}">${this.esc(option)}</button>`).join("")}</div>
          <div class="sci-row sci-actions"><button class="b3-button b3-button--outline" data-trainer-tune="easy" ${tuneDisabled}>太难，讲简单点</button><button class="b3-button b3-button--outline" data-trainer-tune="hard" ${tuneDisabled}>太浅，增加追问</button><button class="b3-button b3-button--outline" data-trainer-tune="example" ${tuneDisabled}>换个例子</button></div>`;
    panel.querySelectorAll("[data-angle]").forEach((button) => {
      button.onclick = () => this.trainerSetAngle(root, button.dataset.angle);
    });
    panel.querySelectorAll("[data-trainer-tune]").forEach((button) => {
      button.onclick = () => this.trainerTune(root, button.dataset.trainerTune);
    });
  }

  renderTrainerCardsPanel(root, trainer) {
    const panel = root.querySelector("#af-trainer-cards");
    if (!panel) {
      return;
    }
    panel.innerHTML = !trainer.drafts.length
      ? `<div class="sci-section-title">卡片草稿</div><div class="sci-empty">暂无草稿。拆解一个知识点后会在这里出现卡片。</div>`
      : `<div class="sci-section-title">卡片草稿</div><div class="sci-cards-hint"><span>左右滑动浏览</span><strong>${trainer.drafts.length} 张待处理</strong></div><div class="sci-card-track">${trainer.drafts.map((card, cardIndex) => `<div class="sci-card" data-open-draft="${cardIndex}"><div class="sci-card-type">${this.esc(card.type)} · ${cardIndex + 1}/${trainer.drafts.length}</div><strong>${this.esc(card.front)}</strong><p>${this.esc(card.back)}</p><button class="b3-button b3-button--outline" data-view-draft="${cardIndex}">查看详情</button><div class="sci-row"><button class="b3-button" data-accept-draft="${cardIndex}">确认入库</button><button class="b3-button b3-button--outline" data-discard-draft="${cardIndex}">不需要</button></div></div>`).join("")}</div>`;
    panel.querySelectorAll("[data-open-draft]").forEach((card) => {
      card.onclick = (event) => {
        if (event.target.closest("button")) return;
        this.trainerOpenDraft(root, Number(card.dataset.openDraft));
      };
    });
    panel.querySelectorAll("[data-view-draft]").forEach((button) => {
      button.onclick = () => this.trainerOpenDraft(root, Number(button.dataset.viewDraft));
    });
    panel.querySelectorAll("[data-accept-draft]").forEach((button) => {
      button.onclick = () => this.trainerAccept(root, Number(button.dataset.acceptDraft));
    });
    panel.querySelectorAll("[data-discard-draft]").forEach((button) => {
      button.onclick = () => this.trainerDiscard(root, Number(button.dataset.discardDraft));
    });
  }

  renderTrainerLibraryPanel(root, trainer) {
    const panel = root.querySelector("#af-trainer-library");
    if (!panel) {
      return;
    }
    panel.innerHTML = `
      <div class="sci-section-title">已确认卡片库</div>
      <div class="sci-row"><span class="sci-pill">已入库 ${trainer.accepted.length}</span><button class="b3-button" id="af-trainer-add-workbench">加入当前原生卡包</button><button class="b3-button b3-button--outline" id="af-trainer-write-doc">写入当前文档</button><button class="b3-button b3-button--outline" id="af-trainer-export-md">导出 Markdown</button><button class="b3-button b3-button--outline" id="af-trainer-export-json">导出 JSON</button></div>
      <div class="sci-write-status">${this.esc(trainer.workbenchStatus || "尚未加入当前原生卡包")}</div>
      <div class="sci-write-status">${this.esc(trainer.writeStatus || "尚未写入思源文档")}</div>
      ${trainer.accepted.length ? `<div class="sci-library-list">${trainer.accepted.slice(0, 6).map((card) => `<div class="sci-library-item"><strong>${this.esc(card.front)}</strong><p>${this.esc(card.topic)} · ${this.esc(card.subject)} / ${this.esc(card.domain)} · ${this.esc(card.cardType)}${card.classifiedBy ? ` · ${this.esc(card.classifiedBy)}` : ""}</p></div>`).join("")}</div>` : `<div class="sci-empty sci-empty--small">确认卡片后会出现在这里。</div>`}`;
    panel.querySelector("#af-trainer-add-workbench")?.addEventListener("click", async () => {
      const button = panel.querySelector("#af-trainer-add-workbench");
      button.disabled = true;
      button.textContent = "正在加入...";
      try {
        await this.trainerAddAcceptedToDeck();
      } catch (error) {
        trainer.workbenchStatus = `加入失败：${error.message}`;
        await this.save();
        showMessage("加入当前原生卡包失败");
      } finally {
        this.renderTrainerAll();
      }
    });
    panel.querySelector("#af-trainer-write-doc")?.addEventListener("click", async () => {
      const button = panel.querySelector("#af-trainer-write-doc");
      button.disabled = true;
      button.textContent = "正在写入...";
      try {
        await this.trainerWriteAcceptedToCurrentDocument();
      } catch (error) {
        trainer.writeStatus = `写入失败：${error.message}`;
        await this.save();
        showMessage("写入当前文档失败");
      } finally {
        this.renderTrainerAll();
      }
    });
    panel.querySelector("#af-trainer-export-md")?.addEventListener("click", () =>
      this.trainerExportMarkdown(),
    );
    panel.querySelector("#af-trainer-export-json")?.addEventListener("click", () =>
      this.trainerExportJSON(),
    );
  }

  renderTrainerDetailPanel(root, trainer, current, detailCard, index) {
    const panel = root.querySelector("#af-trainer-detail");
    if (!panel) {
      return;
    }
    panel.innerHTML = !detailCard
      ? ""
      : `<div class="sci-detail-backdrop sci-detail-backdrop--fullscreen"><div class="sci-detail sci-detail--fullscreen"><div class="sci-detail-head"><div><div class="sci-card-type">${this.esc(detailCard.type)} · ${index + 1}/${trainer.drafts.length}</div><h3>卡片详情</h3></div><button class="b3-button b3-button--outline" data-close-detail="1">关闭</button></div>${trainer.tuneProgress ? `<div class="sci-progress" role="status" aria-live="polite"><div class="sci-progress-head"><span>${this.esc(trainer.tuneProgress.text || "正在改写卡片...")}</span><strong>处理中</strong></div><div class="sci-progress-bar"><i></i></div></div>` : ""}<div class="sci-detail-body"><section class="sci-detail-block sci-detail-block--front"><span>题面</span><p>${this.esc(detailCard.front)}</p></section><section class="sci-detail-block sci-detail-block--back"><span>答案</span><p>${this.esc(detailCard.back)}</p></section><section class="sci-detail-block"><span>主题</span><p>${this.esc(current?.topic || trainer.topic)}</p></section></div><button class="sci-detail-side sci-detail-side--prev" type="button" data-detail-prev="1" ${trainer.tuneProgress || index <= 0 ? "disabled" : ""}>上一张</button><button class="sci-detail-side sci-detail-side--next" type="button" data-detail-next="1" ${trainer.tuneProgress || index >= trainer.drafts.length - 1 ? "disabled" : ""}>下一张</button><div class="sci-detail-nav"><button class="b3-button b3-button--outline" data-detail-prev="1" ${trainer.tuneProgress || index <= 0 ? "disabled" : ""}>上一张</button><span>${index + 1} / ${trainer.drafts.length}</span><button class="b3-button b3-button--outline" data-detail-next="1" ${trainer.tuneProgress || index >= trainer.drafts.length - 1 ? "disabled" : ""}>下一张</button></div><div class="sci-detail-actions"><button class="b3-button" data-detail-accept="${index}" ${trainer.tuneProgress ? "disabled" : ""}>确认入库</button><button class="b3-button b3-button--outline" data-detail-rewrite="1" ${trainer.tuneProgress ? "disabled" : ""}>重写</button><button class="b3-button b3-button--outline" data-detail-discard="${index}" ${trainer.tuneProgress ? "disabled" : ""}>不需要</button></div></div></div>`;
    panel.querySelectorAll("[data-close-detail]").forEach((button) => {
      button.onclick = () => this.trainerCloseDraft(root);
    });
    panel.querySelectorAll("[data-detail-prev]").forEach((button) => {
      button.onclick = () => {
        trainer.activeDraftIndex = Math.max(0, index - 1);
        this.renderTrainerAll();
      };
    });
    panel.querySelectorAll("[data-detail-next]").forEach((button) => {
      button.onclick = () => {
        trainer.activeDraftIndex = Math.min(trainer.drafts.length - 1, index + 1);
        this.renderTrainerAll();
      };
    });
    panel.querySelector("[data-detail-accept]")?.addEventListener("click", () =>
      this.trainerAccept(root, index),
    );
    panel.querySelector("[data-detail-discard]")?.addEventListener("click", () =>
      this.trainerDiscard(root, index),
    );
    panel.querySelector("[data-detail-rewrite]")?.addEventListener("click", () =>
      this.trainerTune(root, "rewrite"),
    );
  }

  renderTrainer(root) {
    const box = root.querySelector("#af-trainer");
    if (!box) {
      return;
    }
    this.ensureTrainerShell(root);
    const trainer = this.trainer();
    const current = trainer.current;
    const index = trainer.activeDraftIndex;
    const detailCard = Number.isInteger(index) ? trainer.drafts[index] : null;
    const tuneDisabled = trainer.tuneProgress ? "disabled" : "";
    this.updateTrainerShell(root, trainer);
    this.renderTrainerDebugPanel(root, trainer);
    this.renderTrainerAnalysisPanel(root, trainer, current, tuneDisabled);
    this.renderTrainerCardsPanel(root, trainer);
    this.renderTrainerLibraryPanel(root, trainer);
    this.renderTrainerDetailPanel(root, trainer, current, detailCard, index);
  }

  renderTrainerAll() {
    this.roots.forEach((root) => {
      if (root?.isConnected) {
        this.renderTrainer(root);
      } else {
        this.roots.delete(root);
      }
    });
  }

  renderGraphDetail(root, node, graph) {
    const detail = root.querySelector("#af-graph-detail");
    if (!detail) {
      return;
    }
    if (!node) {
      detail.innerHTML = `
        <div class="aiflash-graph-detail-title">知识图谱</div>
        <p>当前显示 ${graph.conceptCount} 个知识点，来自 ${graph.cardCount} 张闪卡。</p>
        <p>图上只显示知识点，点击节点后在这里查看关联闪卡。</p>`;
      return;
    }
    if (node.type === "concept") {
      const counts = { weak: 0, mid: 0, good: 0, unknown: 0 };
      node.cards.forEach((card) => {
        counts[this.cardMastery(card)] += 1;
      });
      detail.innerHTML = `
        <div class="aiflash-graph-detail-title">${this.esc(node.label)}</div>
        <div class="aiflash-graph-state aiflash-graph-state--${node.mastery}">${this.masteryLabel(node.mastery)}</div>
        <div class="aiflash-graph-kpis">
          <span>关联 ${node.count} 张</span>
          <span>红 ${counts.weak}</span>
          <span>黄 ${counts.mid}</span>
          <span>绿 ${counts.good}</span>
        </div>
        <div class="aiflash-graph-card-list">
          ${node.cards
            .slice(0, 12)
            .map(
              (card) => `
            <button class="aiflash-graph-card-link" data-open-block="${card.blockID || ""}">
              ${this.esc(this.clean(card.front || "原生闪卡").slice(0, 42))}
            </button>`,
            )
            .join("")}
        </div>`;
    } else {
      detail.innerHTML = `
        <div class="aiflash-graph-detail-title">${this.esc(node.label)}</div>
        <div class="aiflash-graph-state aiflash-graph-state--${node.mastery}">${this.masteryLabel(node.mastery)}</div>
        <p>知识点：${this.esc(node.concept)}</p>
        <div class="aiflash-graph-card-answer">${this.esc(this.clean(node.card?.back || "").slice(0, 240))}</div>
        ${node.blockID ? `<button class="b3-button b3-button--outline" data-open-block="${node.blockID}">打开思源块</button>` : ""}`;
    }
    detail.querySelectorAll("[data-open-block]").forEach((button) => {
      button.onclick = () => {
        const id = button.dataset.openBlock;
        if (id) {
          openTab({ app: this.app, doc: { id } });
        }
      };
    });
  }

  renderGraph(root) {
    const container = root.querySelector("#af-graph");
    const canvasEl = root.querySelector("#af-graph-canvas");
    const detail = root.querySelector("#af-graph-detail");
    if (!container || !canvasEl || !detail) return;

    const cards = this.graphCards();
    if (!cards.length) {
      container.innerHTML = `<div class="aiflash-empty">当前卡包还没有可绘制的闪卡。先生成或刷新卡片后再查看图谱。</div>`;
      detail.innerHTML = `<div class="aiflash-graph-detail-title">知识图谱</div><p>暂无数据。</p>`;
      return;
    }

    // 确保 canvas 元素在 container 内
    if (!canvasEl.parentElement || canvasEl.parentElement !== container) {
      container.innerHTML = "";
      container.appendChild(canvasEl);
    }

    const graph = this.buildGraphData(cards);
    const zoomLabel = root.querySelector("#af-graph-zoom");
    if (zoomLabel) zoomLabel.textContent = "100%";
    const limitSelect = root.querySelector("#af-graph-limit");
    if (limitSelect) limitSelect.value = String(this.graphLimit || 80);
    const weakOnly = root.querySelector("#af-graph-weak-only");
    if (weakOnly) weakOnly.checked = Boolean(this.graphWeakOnly);
    const graphView = root.querySelector('[data-view="graph"]');
    if (graphView) graphView.classList.toggle("aiflash-graph-fullscreen", Boolean(this.graphFullscreen));
    const fullscreenButton = root.querySelector("#af-graph-fullscreen");
    if (fullscreenButton) fullscreenButton.textContent = this.graphFullscreen ? "退出全屏" : "全屏";

    // 销毁旧渲染器
    if (this.graphRenderer) { this.graphRenderer.destroy(); this.graphRenderer = null; }

    this.graphRenderer = new GraphRenderer(canvasEl, graph, {
      searchQuery: this.graphSearchQuery || "",
      onNodeSelect: (node) => {
        this.renderGraphDetail(root, node, graph);
        if (zoomLabel && this.graphRenderer) {
          zoomLabel.textContent = `${Math.round(this.graphRenderer.viewTransform.scale * 100)}%`;
        }
      },
      onNodeDblClick: (node) => {
        const blockID = node.blockID || node.cards?.[0]?.blockID;
        if (blockID) openTab({ app: this.app, doc: { id: blockID } });
      },
    });
    this.graphRenderer.mount();
    this.renderGraphDetail(root, null, graph);
  }

  renderStats(root) {
    // 统计 tab 不可见时跳过渲染（canvas 父元素 clientWidth=0）
    const statsView = root.querySelector('[data-view="stats"]');
    if (statsView && !statsView.classList.contains("active")) return;
    const days = Number(root.querySelector("#af-stats-range")?.value || 30);
    const cards = this.state.cards || [];
    const history = this.state.reviewHistory || [];
    const curveData = chart.prepareCurveData(history, days);
    const cardStats = chart.computeCardStats(cards, history);
    const colors = chart.getThemeColors(root.querySelector("#af-stats-curve"));

    // 统计概览 KPI
    const overviewCanvas = root.querySelector("#af-stats-overview");
    if (overviewCanvas) {
      const rect = { width: overviewCanvas.parentElement.clientWidth || 400, height: 160 };
      overviewCanvas.width = rect.width * devicePixelRatio;
      overviewCanvas.height = rect.height * devicePixelRatio;
      overviewCanvas.style.width = rect.width + "px";
      overviewCanvas.style.height = rect.height + "px";
      chart.drawStatsOverview(overviewCanvas.getContext("2d"), rect, cardStats, { colors });
    }

    // 掌握度环形图
    const masteryCanvas = root.querySelector("#af-stats-mastery");
    if (masteryCanvas) {
      const rect = { width: masteryCanvas.parentElement.clientWidth || 400, height: 160 };
      masteryCanvas.width = rect.width * devicePixelRatio;
      masteryCanvas.height = rect.height * devicePixelRatio;
      masteryCanvas.style.width = rect.width + "px";
      masteryCanvas.style.height = rect.height + "px";
      chart.drawMasteryDonut(masteryCanvas.getContext("2d"), rect, {
        good: cardStats.good, mid: cardStats.mid, weak: cardStats.weak, unknown: cardStats.unknown,
      }, { colors });
    }

    // 学习曲线
    const curveCanvas = root.querySelector("#af-stats-curve");
    if (curveCanvas) {
      const rect = { width: curveCanvas.parentElement.clientWidth || 800, height: 280 };
      curveCanvas.width = rect.width * devicePixelRatio;
      curveCanvas.height = rect.height * devicePixelRatio;
      curveCanvas.style.width = rect.width + "px";
      curveCanvas.style.height = rect.height + "px";
      this.chartCurveLayout = chart.drawLearningCurve(
        curveCanvas.getContext("2d"), rect, curveData, { colors },
      );
    }
  }

  async renderLib(root) {
    const lib = root.querySelector("#af-lib");
    if (!lib) return;
    const deckID = this.state.activePackId;
    if (deckID && this.nativeCardsDeckID !== deckID) {
      lib.innerHTML = `<div class="aiflash-empty">正在读取思源原生卡片...</div>`;
      await this.loadNativeCards(deckID).catch((e) => {
        console.error("load native riff cards failed", e);
        this.nativeCards = [];
        this.nativeCardsDeckID = deckID;
      });
    }
    const query = (root.querySelector("#af-search")?.value || "").toLowerCase();
    const isQuickDeck = this.isQuickDeckID(deckID);
    const targetDeckCount = this.state.packs.filter(
      (pack) => pack.id && pack.id !== deckID && !pack.quick && !this.isQuickDeckID(pack.id),
    ).length;
    const classifyButton = root.querySelector("#af-ai-classify");
    const classifyStatus = root.querySelector("#af-classify-status");
    const cleanDuplicateButton = root.querySelector("#af-clean-duplicates");
    if (cleanDuplicateButton) {
      cleanDuplicateButton.disabled = !this.state.settings?.autoDedupe;
      cleanDuplicateButton.title = this.state.settings?.autoDedupe
        ? "清理当前卡组完全相同的重复闪卡"
        : "请先在设置中开启自动检测完全重复闪卡";
    }
    if (classifyButton) {
      classifyButton.disabled = !isQuickDeck || !targetDeckCount;
      classifyButton.title = !isQuickDeck
        ? "选择快速制卡后可用"
        : !targetDeckCount ? "需要至少一个普通原生卡组" : "";
    }
    if (classifyStatus) {
      classifyStatus.textContent = isQuickDeck
        ? `预设：不确定不移动 · 可分到 ${targetDeckCount} 个卡组`
        : "选择快速制卡后可用";
    }
    const generatedByBlockID = new Map(
      this.state.cards.filter((card) => card.blockID).map((card) => [card.blockID, card]),
    );
    const nativeCards = lr.mapNativeCards(this.nativeCards, generatedByBlockID, {
      query, packName: this.activePack()?.name || "",
      cardBlockID: (c) => this.cardBlockID(c),
    });
    const localCards = lr.mapLocalCards(this.packCards(), query);
    const cards = [...nativeCards, ...localCards];
    const moveOptions = lr.buildMoveOptions(this.state.packs, deckID, (t) => this.esc(t));
    lib.innerHTML = lr.renderLibHTML(cards, moveOptions, (c) => this.cardContentHTML(c), (t) => this.esc(t));
    root.querySelectorAll("[data-open-block]").forEach((button) => {
      button.onclick = () => {
        const id = button.dataset.openBlock;
        if (id) openTab({ app: this.app, doc: { id } });
      };
    });
    root.querySelectorAll("[data-remove-card]").forEach((button) => {
      button.onclick = () => this.removeNativeCard(button.dataset.removeCard, deckID);
    });
    root.querySelectorAll("[data-move-card]").forEach((select) => {
      select.onchange = () => this.moveNativeCard(select.dataset.moveCard, select.value, deckID);
    });
  }

  grade(score) {
    const card = this.cur;
    if (!card) {
      return;
    }
    if (score < 3) {
      card.reps = 0;
      card.interval = 0;
      card.lapses++;
      card.ease = Math.max(1.3, card.ease - 0.2);
      card.dueAt = Date.now() + 6e4;
    } else {
      card.interval =
        card.reps === 0
          ? 1
          : card.reps === 1
            ? 6
            : Math.round(card.interval * card.ease);
      card.ease = Math.max(
        1.3,
        card.ease + (0.1 - (5 - score) * (0.08 + (5 - score) * 0.02)),
      );
      if (score === 3) {
        card.interval = Math.max(1, Math.round(card.interval * 0.6));
      }
      if (score === 5) {
        card.interval = Math.round(card.interval * 1.35 + 1);
      }
      card.reps++;
      card.dueAt = Date.now() + card.interval * 864e5;
    }
    this.state.reviewedToday = (this.state.reviewedToday || 0) + 1;
    // 记录复习历史
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const dateKey = chart.formatDate(today);
    const mastery = this.cardMastery(card);
    const entry = this.state.reviewHistory.find(e => e.date === dateKey);
    if (entry) {
      entry.total = (entry.total || 0) + 1;
      entry[mastery] = (entry[mastery] || 0) + 1;
    } else {
      const newEntry = { date: dateKey, total: 1, good: 0, mid: 0, weak: 0 };
      newEntry[mastery] = 1;
      this.state.reviewHistory.push(newEntry);
      // 保留最近 90 天
      if (this.state.reviewHistory.length > 90) {
        this.state.reviewHistory = this.state.reviewHistory.slice(-90);
      }
    }
    this.done++;
    this.cur = this.q.shift() || null;
  }

  async updateCards(options) {
    await this.syncNativeDecks().catch(() => null);
    if (!options?.cards?.length) {
      return options;
    }
    const generatedBlockIDs = new Set(
      this.state.cards.map((card) => card.blockID).filter(Boolean),
    );
    options.cards.sort((a, b) => {
      const aGenerated = generatedBlockIDs.has(a.blockID) ? 1 : 0;
      const bGenerated = generatedBlockIDs.has(b.blockID) ? 1 : 0;
      return bGenerated - aGenerated;
    });
    return options;
  }

  normalizeCardText(text) { return _normalizeCardText(text); }

  repairMathSegment(math) { return repairMathSegment(math); }

  repairPlainText(text) { return repairPlainText(text); }

  repairFormulaText(text) { return _repairFormulaText(text); }

  clean(text) { return _clean(text); }

  offline(text, count, level, style = "knowledge") {
    if (count === "outline") {
      const structured = this.structuredCards(text, level);
      if (structured.length) {
        return structured;
      }
      return [];
    }
    const targetCount =
      count === "auto" || count === "outline"
        ? this.estimateGenerateCount(text)
        : this.normalizeGenerateCount(count);
    const cards = [];
    text.split(/\n(?=#{1,6}\s*)/).forEach((block) => {
      const match = block
        .trim()
        .match(/^(?:#{1,6}\s*)?(.+?[？?])\s*\n+([\s\S]+)/);
      if (match) {
        cards.push({ front: this.clean(match[1]), back: this.clean(match[2]) });
      }
    });
    const paragraphs = text
      .split(/\n{2,}|(?<=。)|(?<=？)|(?<=！)/)
      .map((item) => this.clean(item))
      .filter((item) => item.length > 12);
    for (const paragraph of paragraphs) {
      if (cards.length >= targetCount) {
        break;
      }
      const key =
        (paragraph.match(/什么是(.+?)[？?，。]/) ||
          paragraph.match(/(.+?)是指/) ||
          [])[1] || paragraph.slice(0, 18);
      if (style === "quiz") {
        cards.push({
          front: `【检测题】围绕“${key}”，请根据材料回答它的核心结论或判断方法是什么？`,
          back: `答案：${paragraph}\n\n解析：这张卡用于检测你能否主动回忆并说明“${key}”的关键内容。\n\n考点：${key}\n\n易错点：不要只记住名词，要能说出条件、结论或适用场景。`,
        });
      } else {
        cards.push({
          front:
            level === "深度理解" ? `为什么“${key}”重要？` : `什么是“${key}”？`,
          back: paragraph,
        });
      }
    }
    return cards.slice(0, targetCount);
  }

  prompt(text, count, level, style = "knowledge") {
    const countRule =
      count === "auto"
        ? "请先判断材料的信息密度，自行选择最合适的闪卡数量；宁少勿滥，不要为了凑数量重复或拆碎同一个知识点。"
        : count === "outline"
          ? "材料是结构化 Markdown 或 JSON，请按结构逐条制卡；不要合并相邻定义、定理、性质或概念。"
          : `最多制作 ${this.normalizeGenerateCount(count)} 张中文闪卡；如果材料不足，不要硬凑，可以少于这个数量。`;
    if (style === "quiz") {
      return `根据材料制作中文“检测题型闪卡”，难度${level}。${countRule}
目标：生成像题目一样的闪卡，用来检测我是否真正会用知识点，而不是只背定义。

要求：
1. 每张卡只检测一个知识点。
2. front 必须是题目或检测任务，不能只是“什么是……”。可以使用判断题、简答题、辨析题、计算题、条件判断题、应用题。
3. back 必须包含：答案、解析、考点、易错点。
4. 题目要尽量贴近考试或自测，不要问得太空泛。
5. 如果材料适合出计算题或判断题，优先出检测题；如果不适合，就出概念辨析题。
6. 保留 Markdown 和 LaTeX 公式语法，尤其不要删除下标 _、上标 ^、反斜杠 \\、花括号 {}。
7. 只输出 JSON 数组，不要输出解释文字。

输出格式：
[{"front":"题目","back":"答案：...\\n\\n解析：...\\n\\n考点：...\\n\\n易错点：..."}]

材料：
${text}`;
    }
    return `根据材料制作中文闪卡，难度${level}。${countRule}每张卡只考一个点。只输出JSON数组[{"front":"问题","back":"答案"}]。
保留原文中的 Markdown 和 LaTeX 公式语法，尤其不要删除下标 _、上标 ^、反斜杠 \\、花括号 {}。数学公式请使用 $...$ 或 $$...$$。
材料：
${text}`;
  }

  parse(data) { return _parse(data); }

  async ai(text, count, level, style = "knowledge") {
    if (count === "outline") {
      const structured = this.structuredCards(text, level);
      if (structured.length) {
        return structured;
      }
      return [];
    }
    const maxCount =
      count === "auto" || count === "outline"
        ? Infinity
        : this.normalizeGenerateCount(count);
    const settings = this.state.settings;
    if ((settings.provider || "offline") === "offline") {
      return this.offline(text, count, level, style);
    }
    const url = this.resolveAIEndpoint(settings);
    if (!url) {
      throw Error("未配置接口地址");
    }
    const headers = { "Content-Type": "application/json" };
    if (settings.apiKey) {
      headers.Authorization = `Bearer ${settings.apiKey}`;
    }
    const body = {
      model: settings.model || "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        { role: "user", content: this.prompt(text, count, level, style) },
      ],
    };
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw Error(`HTTP ${response.status}`);
    }
    const cards = this.parse(await response.json());
    return Number.isFinite(maxCount) ? cards.slice(0, maxCount) : cards;
  }
};
