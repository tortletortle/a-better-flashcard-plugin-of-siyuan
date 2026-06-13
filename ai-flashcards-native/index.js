const {
  Plugin,
  showMessage,
  getFrontend,
  openTab,
  fetchSyncPost,
  Constants,
} = require("siyuan");

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
const TRAINER_TOPICS = {
  斜面: {
    type: "公式型 / 解题型",
    question: "你想先解决哪一类困难？",
    options: ["看懂受力图", "记住 mg sinθ / mg cosθ", "掌握解题步骤", "避免常见错误"],
    note: "斜面问题的核心，是把重力分解到沿斜面和垂直斜面两个方向，再分别列方程。",
    cards: [
      {
        type: "概念卡",
        front: "斜面受力分析的核心动作是什么？",
        back: "把重力分解为沿斜面方向和垂直斜面方向两个分量。",
      },
      {
        type: "公式卡",
        front: "倾角为 θ 的斜面上，重力沿斜面向下的分量是多少？",
        back: "mg sinθ。垂直斜面方向的分量是 mg cosθ。",
      },
      {
        type: "易错卡",
        front: "斜面受力分析中为什么容易把 sinθ 和 cosθ 搞反？",
        back: "因为 θ 通常对应重力与垂直斜面方向之间的夹角，不是重力与斜面方向之间的夹角。",
      },
    ],
  },
  导数: {
    type: "概念型 / 应用型",
    question: "你更想训练哪一部分？",
    options: ["理解导数含义", "判断函数单调性", "找极值点", "处理含参数题"],
    note: "导数用于描述函数变化率。判断单调性时，关键是研究 f'(x) 的正负。",
    cards: [
      {
        type: "概念卡",
        front: "导数在直观上表示什么？",
        back: "表示函数在某一点附近的瞬时变化率，也可以理解为切线斜率。",
      },
      {
        type: "步骤卡",
        front: "用导数判断函数单调性的基本步骤是什么？",
        back: "求定义域，求 f'(x)，判断 f'(x) 的正负，再写出单调区间。",
      },
      {
        type: "易错卡",
        front: "用导数判断单调性时常见错误是什么？",
        back: "忽略定义域，或者只找 f'(x)=0 的点却不判断导数符号变化。",
      },
    ],
  },
  电容: {
    type: "公式型 / 过程型",
    question: "你想重点理解什么？",
    options: ["电容定义", "充放电过程", "能量公式", "电路题步骤"],
    note: "电容器的核心是储存电荷和电场能量，充放电过程体现电压、电流随时间变化。",
    cards: [
      {
        type: "公式卡",
        front: "电容的定义式是什么？",
        back: "C = Q / U，表示单位电压下能储存多少电荷。",
      },
      {
        type: "概念卡",
        front: "为什么电容器充电时电流会逐渐变小？",
        back: "因为电容两端电压逐渐升高，电源与电容之间的电压差变小，推动电荷流动的作用减弱。",
      },
      {
        type: "易错卡",
        front: "电容题中常见的误区是什么？",
        back: "把电容 C 当成会随 Q 或 U 任意变化；对固定电容器，C 由结构和介质决定。",
      },
    ],
  },
};

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
    this.roots = new Set();
    this.addIcons(
      `<symbol id="iconFlashcardsNative" viewBox="0 0 32 32"><path d="M6 7a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-5l-4.8 4.2A1 1 0 0 1 11 25.5V22H9a3 3 0 0 1-3-3V7zm6 3h8v2h-8v-2zm0 4h6v2h-6v-2z"></path></symbol>`,
    );
    this.addTopBar({
      icon: "iconFlashcardsNative",
      title: this.i18n.addTopBarIcon,
      position: "right",
      callback: () => this.openWorkbench(),
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
    const api = {
      version: "1.0.0",
      plugin: this,
      listDecks: () => this.listPublicDecks(),
      setActiveDeck: (deckID) => this.setActiveDeck(deckID),
      createDeck: (name) => this.createNativeDeck(name),
      addCards: (options) => this.addCardsFromAPI(options),
      generateFromText: (options) => this.generateFromTextFromAPI(options),
      addBlocks: (options) => this.addBlocksFromAPI(options),
      openWorkbench: () => this.openWorkbench(),
      openReview: () => this.openNativeReview(),
      openTrainer: () => this.openTrainer(),
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
    return next;
  }

  defaultTrainerState() {
    return {
      topic: "斜面上物体的受力分析",
      angle: "看懂受力图",
      depth: "日常理解",
      current: null,
      drafts: [],
      accepted: [],
      discarded: 0,
      activeDraftIndex: null,
      mobileView: "input",
      apiStatus: "使用主插件 AI 设置",
      tuneProgress: null,
      writeStatus: "尚未写入思源文档",
      workbenchStatus: "尚未加入当前原生卡包",
      analyzing: false,
      debugVisible: true,
      debugLastAIShape: null,
      debugLog: [],
      debugLastAction: "初始化",
    };
  }

  normalizeTrainerState(trainer) {
    const next = trainer && typeof trainer === "object" ? trainer : {};
    const defaults = this.defaultTrainerState();
    const normalized = {
      ...defaults,
      ...next,
      drafts: Array.isArray(next.drafts) ? next.drafts : [],
      accepted: Array.isArray(next.accepted) ? next.accepted : [],
      discarded: Number.isFinite(Number(next.discarded))
        ? Number(next.discarded)
        : 0,
      activeDraftIndex: Number.isInteger(next.activeDraftIndex)
        ? next.activeDraftIndex
        : null,
      mobileView: ["input", "drafts", "library"].includes(next.mobileView)
        ? next.mobileView
        : defaults.mobileView,
      apiStatus: String(next.apiStatus || defaults.apiStatus),
      writeStatus: String(next.writeStatus || defaults.writeStatus),
      workbenchStatus: String(
        next.workbenchStatus || defaults.workbenchStatus,
      ),
      tuneProgress:
        next.tuneProgress && typeof next.tuneProgress === "object"
          ? next.tuneProgress
          : null,
      analyzing: Boolean(next.analyzing),
      debugVisible: next.debugVisible !== false,
      debugLastAIShape:
        next.debugLastAIShape && typeof next.debugLastAIShape === "object"
          ? next.debugLastAIShape
          : null,
      debugLog: Array.isArray(next.debugLog)
        ? next.debugLog.map((item) => String(item || "")).filter(Boolean).slice(0, 12)
        : [],
      debugLastAction: String(next.debugLastAction || defaults.debugLastAction),
    };
    if (trainer && typeof trainer === "object") {
      Object.assign(trainer, normalized);
      return trainer;
    }
    return normalized;
  }

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

  firstDefined(...values) {
    return values.find(
      (value) => value !== undefined && value !== null && value !== "",
    );
  }

  numberFromApi(...values) {
    const value = this.firstDefined(...values);
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  riffDeckID(deck) {
    return String(
      this.firstDefined(deck?.id, deck?.deckID, deck?.deckId, deck?.deck_id) ||
        "",
    );
  }

  quickDeckID() {
    return Constants?.QUICK_DECK_ID || "20230218211946-2kw8jgx";
  }

  isQuickDeckID(deckID) {
    return Boolean(deckID && deckID === this.quickDeckID());
  }

  riffDecksFromApi(data) {
    const source = Array.isArray(data)
      ? data
      : this.firstDefined(
          data?.decks,
          data?.riffDecks,
          data?.deckList,
          data?.list,
          data?.items,
          data?.data,
          [],
        );
    const decks = Array.isArray(source) ? source : [];
    const seen = new Set();
    return decks.filter((deck) => {
      const id = this.riffDeckID(deck);
      if (!id || seen.has(id)) {
        return false;
      }
      seen.add(id);
      return true;
    });
  }

  deckFromApi(deck) {
    const id = this.riffDeckID(deck);
    const cardCount = this.numberFromApi(
      deck.cardCount,
      deck.size,
      deck.count,
      deck.total,
      deck.cardSize,
    );
    return {
      id,
      name: deck.name || deck.title || "未命名卡包",
      cardCount,
      size: cardCount,
      dueCardCount: this.numberFromApi(
        deck.dueCardCount,
        deck.dueCount,
        deck.due,
      ),
      newCardCount: this.numberFromApi(
        deck.newCardCount,
        deck.newCount,
        deck.new,
      ),
      todayReviewedCardCount: this.numberFromApi(
        deck.todayReviewedCardCount,
        deck.reviewedCardCount,
        deck.todayReviewed,
      ),
      created: deck.created || deck.createdAt || "",
      updated: deck.updated || deck.updatedAt || "",
      quick: Boolean(deck.quick),
      native: true,
    };
  }

  createdDeckFromApi(data, fallbackName) {
    const deck = data?.deck || data?.riffDeck || data;
    const id =
      this.riffDeckID(deck) ||
      data?.deckID ||
      data?.deckId ||
      data?.id ||
      (typeof data === "string" ? data : "");
    return this.deckFromApi({
      ...(typeof deck === "object" ? deck : {}),
      id,
      name: deck?.name || fallbackName,
    });
  }

  async quickDeckFromApi() {
    const id = this.quickDeckID();
    if (!id) {
      return null;
    }
    const data = await this.api("/api/riff/getRiffCards", {
      id,
      deckID: id,
      page: 1,
      pageSize: 1,
    });
    const total = this.numberFromApi(
      data?.total,
      data?.count,
      data?.size,
      Array.isArray(data) ? data.length : 0,
    );
    return this.deckFromApi({
      id,
      name: "快速制卡",
      cardCount: total,
      size: total,
      quick: true,
    });
  }

  async syncNativeDecks() {
    const data = await this.api("/api/riff/getRiffDecks");
    const packs = this.riffDecksFromApi(data).map((deck) =>
      this.deckFromApi(deck),
    );
    const quickPack = await this.quickDeckFromApi().catch((e) => {
      console.warn("load quick riff deck failed", e);
      return null;
    });
    if (quickPack?.id && !packs.some((pack) => pack.id === quickPack.id)) {
      packs.unshift(quickPack);
    }
    if (packs.length) {
      this.state.packs = packs;
      if (
        !this.state.activePackId ||
        !packs.some((pack) => pack.id === this.state.activePackId)
      ) {
        this.state.activePackId = packs[0].id;
      }
      this.lastDeckSyncAt = Date.now();
      await this.save();
      return;
    }
    const quickDeckID = this.quickDeckID();
    if (quickDeckID) {
      this.state.packs = [
        {
          id: quickDeckID,
          name: "快速制卡",
          cardCount: 0,
          size: 0,
          quick: true,
          native: true,
        },
      ];
      this.state.activePackId = quickDeckID;
      this.lastDeckSyncAt = Date.now();
      await this.save();
    }
  }

  async listPublicDecks() {
    await this.syncNativeDecks().catch(() => null);
    return this.state.packs.map((pack) => ({
      id: pack.id,
      name: pack.name,
      cardCount: pack.cardCount || 0,
      dueCardCount: pack.dueCardCount || 0,
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

  mdHTML(markdown) {
    const text = String(markdown || "").trim();
    if (!text) {
      return "";
    }
    try {
      const lute = window.Lute?.New?.() || window.Lute;
      if (typeof lute?.Md2HTML === "function") {
        return lute.Md2HTML(text);
      }
      if (typeof lute?.Md2BlockDOM === "function") {
        return lute.Md2BlockDOM(text);
      }
    } catch (e) {
      console.warn("render markdown with Lute failed", e);
    }
    return `<p>${this.esc(text).replace(/\n/g, "<br>")}</p>`;
  }

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

  day() {
    return new Date().toISOString().slice(0, 10);
  }

  uid() {
    return Date.now() + "_" + Math.random().toString(16).slice(2);
  }

  esc(s) {
    return String(s).replace(
      /[&<>"]/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
        })[c],
    );
  }

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
    const dockTab = document.querySelector(`[data-type="${DOCK}"]`);
    if (dockTab) {
      showMessage(this.i18n.openedInDock);
      dockTab.click();
      dockTab.scrollIntoView?.({ block: "nearest", inline: "nearest" });
      return true;
    }
    showMessage(this.i18n.dockNotFound);
    return false;
  }

  openWorkbench() {
    try {
      openTab({
        app: this.app,
        custom: {
          id: this.name + TAB_TYPE,
          title: "AI 闪卡工作台",
          icon: "iconFlashcardsNative",
        },
      });
      showMessage("AI 闪卡工作台已在主界面打开");
    } catch (e) {
      console.error("open AI flashcards tab failed", e);
      showMessage("主界面 Tab 打开失败，已尝试打开右侧 Dock");
      this.openDock();
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

  cleanBlockMarkdown(markdown) {
    return String(markdown || "")
      .replace(/\n?\{:\s+[^}]*id="[^"]+"[^}]*\}/g, "")
      .replace(/\n?\{:\s+[^}]*custom-riff-decks="[^"]+"[^}]*\}/g, "")
      .trim();
  }

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

  dueText(card) {
    const dueAt = card.dueAt || Date.now();
    const diff = dueAt - Date.now();
    if (diff <= 0) {
      return "现在";
    }
    const minutes = Math.ceil(diff / 6e4);
    if (minutes < 60) {
      return `${minutes} 分钟后`;
    }
    const hours = Math.ceil(minutes / 60);
    if (hours < 24) {
      return `${hours} 小时后`;
    }
    return `${Math.ceil(hours / 24)} 天后`;
  }

  parseTime(value) {
    if (!value) {
      return 0;
    }
    if (typeof value === "number") {
      return value > 1e12 ? value : value * 1000;
    }
    const text = String(value).trim();
    if (/^\d{14}$/.test(text)) {
      const year = Number(text.slice(0, 4));
      const month = Number(text.slice(4, 6)) - 1;
      const day = Number(text.slice(6, 8));
      const hour = Number(text.slice(8, 10));
      const minute = Number(text.slice(10, 12));
      const second = Number(text.slice(12, 14));
      return new Date(year, month, day, hour, minute, second).getTime();
    }
    const parsed = Date.parse(text);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  cardMastery(card = {}) {
    const now = Date.now();
    const state = String(card.state ?? card.riffCard?.state ?? "");
    const dueAt = this.parseTime(
      card.due ||
        card.dueTime ||
        card.dueAt ||
        card.riffCard?.due ||
        card.riffCard?.dueTime,
    );
    const reps = Number(card.reps ?? card.riffCard?.reps ?? 0);
    const lapses = Number(card.lapses ?? card.riffCard?.lapses ?? 0);
    if (
      lapses > 0 ||
      (dueAt && dueAt < now - 864e5) ||
      ["1", "again", "forgot"].includes(state)
    ) {
      return "weak";
    }
    if (!dueAt && !reps && !state) {
      return "unknown";
    }
    if (
      (dueAt && dueAt <= now + 2 * 864e5) ||
      reps < 2 ||
      ["2", "hard", "new"].includes(state)
    ) {
      return "mid";
    }
    return "good";
  }

  masteryScore(level) {
    return { weak: 0, mid: 1, unknown: 1, good: 2 }[level] ?? 1;
  }

  masteryLabel(level) {
    return (
      { weak: "薄弱", mid: "中间", good: "熟悉", unknown: "未知" }[level] ||
      "未知"
    );
  }

  conceptFromCard(card = {}) {
    const meta = card.blockID ? this.state.graphMeta?.[card.blockID] : null;
    if (meta?.concepts?.length) {
      return String(meta.concepts[0] || "未命名").slice(0, 18);
    }
    const text = this.clean(
      `${card.front || card.content || card.markdown || card.name || ""} ${card.back || ""}`,
    )
      .replace(/[？?].*$/s, "")
      .replace(
        /^(什么是|如何理解|怎样理解|为什么|请说明|说明|定义|定理|性质|例题)[:：\s]*/i,
        "",
      )
      .replace(/[，,。；;：:、\n\r\t]+/g, " ")
      .trim();
    const parts = text.match(/[\u4e00-\u9fa5A-Za-z0-9_+\-]{2,16}/g) || [];
    return (parts[0] || "未命名").slice(0, 16);
  }

  graphCardConcepts(card = {}) {
    const meta = card.blockID ? this.state.graphMeta?.[card.blockID] : null;
    const concepts = Array.isArray(meta?.concepts)
      ? meta.concepts
      : [this.conceptFromCard(card)];
    return [
      ...new Set(
        concepts.map((item) => String(item || "").trim()).filter(Boolean),
      ),
    ].slice(0, 3);
  }

  graphRelationPairs(concepts) {
    const result = [];
    for (let index = 0; index < concepts.length - 1; index++) {
      result.push([concepts[index], concepts[index + 1], "related"]);
    }
    return result;
  }

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
    const conceptMap = new Map();
    const linkWeights = new Map();
    cards.slice(0, this.graphLimit || 80).forEach((card) => {
      const mastery = this.cardMastery(card);
      const concepts = this.graphCardConcepts(card);
      concepts.forEach((concept) => {
        if (!conceptMap.has(concept)) {
          conceptMap.set(concept, []);
        }
        conceptMap.get(concept).push({ card, mastery });
      });
      this.graphRelationPairs(concepts).forEach(([from, to, type]) => {
        const key = [from, to].sort().join("→");
        const current = linkWeights.get(key) || { from, to, type, weight: 0 };
        current.weight += 1;
        linkWeights.set(key, current);
      });
    });
    const conceptNodes = [...conceptMap.entries()]
      .map(([name, items]) => {
        const avg =
          items.reduce(
            (sum, item) => sum + this.masteryScore(item.mastery),
            0,
          ) / Math.max(items.length, 1);
        const mastery = avg < 0.75 ? "weak" : avg > 1.45 ? "good" : "mid";
        return {
          id: `concept-${name}`,
          type: "concept",
          label: name,
          mastery,
          count: items.length,
          cards: items.map((item) => item.card),
        };
      })
      .filter(
        (node) =>
          !this.graphWeakOnly ||
          node.mastery === "weak" ||
          node.mastery === "mid",
      );
    const visible = new Set(conceptNodes.map((node) => node.label));
    const links = [...linkWeights.values()]
      .filter((link) => visible.has(link.from) && visible.has(link.to))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, Math.max(20, conceptNodes.length * 2))
      .map((link) => ({
        from: `concept-${link.from}`,
        to: `concept-${link.to}`,
        type: link.type,
        weight: link.weight,
      }));
    return {
      nodes: conceptNodes,
      links,
      conceptCount: conceptNodes.length,
      cardCount: cards.length,
    };
  }

  buildGraphCardNodes(cards) {
    return cards.slice(0, this.graphLimit || 80).map((card, index) => {
      const mastery = this.cardMastery(card);
      const concept = this.conceptFromCard(card);
      return {
        id: `card-${card.blockID || index}`,
        type: "card",
        label: this.clean(card.front || "原生闪卡").slice(0, 24),
        mastery,
        blockID: card.blockID || "",
        concept,
        card,
      };
    });
  }

  graphNodePosition(node, index, total) {
    const conceptCount = total.concepts || 1;
    const layerCount = Math.max(2, Math.min(6, Math.ceil(conceptCount / 24)));
    const layer = index % layerCount;
    const slot = Math.floor(index / layerCount);
    const slots = Math.ceil(conceptCount / layerCount);
    const angle =
      (Math.PI * 2 * slot) / Math.max(slots, 1) - Math.PI / 2 + layer * 0.23;
    const rx = 18 + layer * 10;
    const ry = 14 + layer * 8;
    return {
      x: 50 + Math.cos(angle) * rx,
      y: 50 + Math.sin(angle) * ry,
    };
  }

  graphShortLabel(label, zoom, type) {
    const clean = this.clean(label || "未命名");
    const max =
      zoom >= 1.55
        ? type === "concept"
          ? 14
          : 8
        : zoom >= 1.1
          ? type === "concept"
            ? 8
            : 0
          : type === "concept"
            ? 5
            : 0;
    if (!max) {
      return "";
    }
    return clean.length > max ? `${clean.slice(0, max)}...` : clean;
  }

  graphNodeHTML(node, index, totals, zoom = 1) {
    const pos = this.graphNodePosition(node, index, totals);
    const size =
      node.type === "concept" ? Math.min(42, 24 + (node.count || 1) * 2) : 13;
    const label = this.graphShortLabel(node.label, zoom, node.type);
    return `<button class="aiflash-graph-node aiflash-graph-node--${node.type} aiflash-graph-node--${node.mastery}"
      style="left:${pos.x}%;top:${pos.y}%;--node-size:${size}px"
      data-graph-node="${this.esc(node.id)}"
      title="${this.esc(node.label)}">
        <span></span>
        ${label ? `<em>${this.esc(label)}</em>` : ""}
      </button>`;
  }

  graphLinesHTML(nodes, links) {
    const totals = {
      concepts: nodes.filter((item) => item.type === "concept").length,
      cards: nodes.filter((item) => item.type === "card").length,
    };
    const pos = new Map(
      nodes.map((node, index) => {
        return [node.id, this.graphNodePosition(node, index, totals)];
      }),
    );
    return `<svg class="aiflash-graph-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
      ${links
        .map((link) => {
          const from = pos.get(link.from);
          const to = pos.get(link.to);
          if (!from || !to) {
            return "";
          }
          return `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}"></line>`;
        })
        .join("")}
    </svg>`;
  }

  newBlockID() {
    return (
      window.Lute?.NewNodeID?.() || this.uid().replace(/_/g, "-").slice(0, 22)
    );
  }

  safeMd(text) {
    return String(text || "")
      .replace(/^(\s*){{{/gm, "$1&#123;&#123;&#123;")
      .replace(/^(\s*)}}}/gm, "$1&#125;&#125;&#125;")
      .trim();
  }

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

  extractID(data) {
    if (!data) {
      return "";
    }
    if (typeof data === "string") {
      return data;
    }
    if (Array.isArray(data)) {
      for (const item of data) {
        const id = this.extractID(item);
        if (id) {
          return id;
        }
      }
      return "";
    }
    return (
      data.id ||
      data.blockID ||
      this.extractID(data.doOperations) ||
      this.extractID(data.data) ||
      ""
    );
  }

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

  cleanFileName(name) {
    return (
      String(name || "未命名")
        .replace(/[\\/:*?"<>|#\[\]]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 48) || "未命名"
    );
  }

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

  graphAnalyzePrompt(cards) {
    return `请为这些闪卡抽取知识图谱标签。要求：
1. concepts 是规范化知识点名称，最多 3 个，避免“什么是/为什么/如何”等题干词。
2. chapter 是更高层主题或章节。
3. prerequisites 是前置知识点，最多 3 个。
4. confusableWith 是易混知识点，最多 3 个。
5. 不确定就留空数组，不要编造。
只输出 JSON 数组。

闪卡：
${cards
  .map(
    (card, index) => `${index + 1}. blockID=${card.blockID || ""}
front=${this.clean(card.front || "").slice(0, 180)}
back=${this.clean(card.back || "").slice(0, 220)}`,
  )
  .join("\n\n")}

格式：
[{"blockID":"...","chapter":"...","concepts":["..."],"prerequisites":["..."],"confusableWith":["..."],"difficulty":"基础|中等|困难"}]`;
  }

  normalizeGraphMeta(results, cards) {
    const ids = new Set(cards.map((card) => card.blockID).filter(Boolean));
    return (Array.isArray(results) ? results : [])
      .map((item) => ({
        blockID: String(item?.blockID || item?.blockId || "").trim(),
        chapter: String(item?.chapter || "").trim(),
        concepts: Array.isArray(item?.concepts) ? item.concepts : [],
        prerequisites: Array.isArray(item?.prerequisites)
          ? item.prerequisites
          : [],
        confusableWith: Array.isArray(item?.confusableWith)
          ? item.confusableWith
          : [],
        difficulty: String(item?.difficulty || "").trim(),
      }))
      .filter((item) => ids.has(item.blockID))
      .map((item) => ({
        ...item,
        concepts: [
          ...new Set(
            item.concepts
              .map((value) => String(value || "").trim())
              .filter(Boolean),
          ),
        ].slice(0, 3),
        prerequisites: [
          ...new Set(
            item.prerequisites
              .map((value) => String(value || "").trim())
              .filter(Boolean),
          ),
        ].slice(0, 3),
        confusableWith: [
          ...new Set(
            item.confusableWith
              .map((value) => String(value || "").trim())
              .filter(Boolean),
          ),
        ].slice(0, 3),
      }));
  }

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
                <button class="b3-button b3-button--outline" id="af-graph-zoom-out">缩小</button>
                <span class="aiflash-graph-zoom" id="af-graph-zoom">100%</span>
                <button class="b3-button b3-button--outline" id="af-graph-zoom-in">放大</button>
                <button class="b3-button b3-button--outline" id="af-graph-fullscreen">全屏</button>
                <button class="b3-button b3-button--outline" id="af-graph-refresh">刷新图谱</button>
              </div>
            </div>
            <div class="aiflash-graph-layout">
              <div class="aiflash-graph-canvas" id="af-graph"></div>
              <div class="aiflash-graph-detail" id="af-graph-detail"></div>
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
      this.graphZoom = Math.min(3, Number((this.graphZoom + 0.2).toFixed(2)));
      this.renderGraph(root);
    });
    root.querySelector("#af-graph-zoom-out")?.addEventListener("click", () => {
      this.graphZoom = Math.max(
        0.35,
        Number((this.graphZoom - 0.2).toFixed(2)),
      );
      this.renderGraph(root);
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
    const topic = String(card?.topic || this.trainer().topic || "未命名主题").trim();
    const subject = String(card?.subject || "未分类").trim();
    return {
      id: String(card?.id || `trainer-${this.uid()}`),
      topic,
      depth: String(card?.depth || this.trainer().depth || "日常理解"),
      subject,
      domain: String(card?.domain || "待整理").trim(),
      chapter: String(card?.chapter || "").trim(),
      knowledgeType: String(card?.knowledgeType || card?.type || "").trim(),
      cardType: String(card?.cardType || card?.type || "概念卡").trim(),
      difficulty: String(card?.difficulty || "medium").trim(),
      prerequisites: Array.isArray(card?.prerequisites)
        ? card.prerequisites.map((item) => String(item || "").trim()).filter(Boolean)
        : [],
      examUse: String(card?.examUse || "").trim(),
      front: this.normalizeCardText(card?.front),
      back: this.normalizeCardText(card?.back),
      angle: String(card?.angle || this.trainer().angle || "").trim(),
      tags: Array.isArray(card?.tags)
        ? [...new Set(card.tags.map((item) => String(item || "").trim()).filter(Boolean))]
        : [topic, subject, String(card?.cardType || card?.type || "概念卡").trim()].filter(Boolean),
      createdAt: String(card?.createdAt || new Date().toISOString()),
      status: "confirmed",
      classifiedBy: String(card?.classifiedBy || "rule").trim(),
      classifiedAt: String(card?.classifiedAt || "").trim(),
      classificationError: String(card?.classificationError || "").trim(),
    };
  }

  trainerAnalyze(topic, depth) {
    const key = Object.keys(TRAINER_TOPICS).find((item) => topic.includes(item));
    const preset = key ? TRAINER_TOPICS[key] : null;
    if (preset) {
      return { topic, depth, ...preset };
    }
    return {
      topic,
      depth,
      type: "概念型 / 解题型",
      question: "你希望 AI 先从哪个角度帮你拆解？",
      options: ["先讲直觉", "列出前置概念", "生成解题步骤", "指出易错点"],
      note: `“${topic}”可以先被拆成概念、公式/规则、步骤和易错点，再转成少量可复习卡片。`,
      cards: [
        {
          type: "概念卡",
          front: `${topic} 的核心问题是什么？`,
          back: `先用一句话说清 ${topic} 解决了什么问题，再补充适用条件。`,
        },
        {
          type: "步骤卡",
          front: `学习 ${topic} 时应该按什么顺序拆解？`,
          back: "先识别概念，再看公式或规则，最后用例题验证。",
        },
        {
          type: "易错卡",
          front: `学习 ${topic} 时为什么容易产生错觉？`,
          back: "因为只记结论不看条件，遇到变式题时容易套错规则。",
        },
      ],
    };
  }

  trainerGenerateCards(analysis, angle, depth) {
    const cards = (analysis?.cards || []).map((card) => ({ ...card, status: "draft" }));
    if (String(angle || "").includes("步骤") || String(angle || "").includes("解题")) {
      cards.push({
        type: "步骤卡",
        front: `遇到“${analysis.topic}”相关题目时，第一步应该做什么？`,
        back: "先判断题目考的是概念、公式代入、过程分析还是变式迁移，避免直接套模板。",
        status: "draft",
      });
    }
    if (depth === "深入推导") {
      cards.push({
        type: "追问卡",
        front: `如果要深入理解“${analysis.topic}”，应该追问什么？`,
        back: "追问公式从哪里来、每个条件为什么必要、条件改变后结论是否还成立。",
        status: "draft",
      });
    }
    return cards.slice(0, 5);
  }

  trainerBuildPrompt(topic, depth) {
    return `你是一个严格的理科知识制卡教练。请把用户输入的知识点拆成适合复习的结构化结果。\n要求：\n1. 只输出 JSON，不要 Markdown。\n2. 卡片少而精，3 到 5 张，一张卡只考一个点。\n3. 必须包含直觉、公式/规则、适用条件或易错点。\nJSON 结构：{"topic":"主题","type":"概念型 / 公式型 / 应用型","question":"你想先理解哪一层？","options":["建立直觉","理解公式","适用条件","易错点"],"note":"一句话拆解","cards":[{"type":"概念卡","front":"问题","back":"答案"}]}\n用户知识点：${topic}\n目标深度：${depth}`;
  }

  trainerBuildRefinePrompt(action, angle = "") {
    const trainer = this.trainer();
    const current = trainer.current;
    const actionText = {
      easy: "用户觉得太难。请用更简单、更直觉的方式重写，减少抽象术语，保留必要公式。",
      hard: "用户觉得太浅。请增加 1 到 2 张高质量追问卡，强调条件变化、推导来源或反例。",
      example: "用户想换个例子。请给出更具体的例子，并生成适合复习的例子卡。",
      rewrite: "用户标记需要重写。请重新拆解，修正空泛、条件缺失、卡片不可复习等问题。",
      angle: `用户选择新的学习角度：“${angle}”。请围绕这个角度重组卡片。`,
    }[action];
    return `你是一个严格的理科知识制卡教练。下面是当前已有拆解，用户给了新的反馈。\n\n用户反馈：${actionText}\n\n当前拆解 JSON：\n${JSON.stringify(current)}\n\n要求：\n1. 只输出 JSON，不要 Markdown。\n2. 必须保持同一个主题：${current.topic}。\n3. 输出 3 到 5 张卡，一张卡只考一个点。\n4. front 必须是明确问题，back 必须简洁可复习。\n5. 不要编造不存在的公式；不确定时写清条件。\n返回 JSON 结构：{"topic":"主题","type":"概念型 / 公式型 / 应用型","question":"你想先理解哪一层？","options":["建立直觉","理解公式","适用条件","易错点"],"note":"一句话拆解","cards":[{"type":"概念卡","front":"问题","back":"答案"}]}`;
  }

  trainerBuildClassifyPrompt(card) {
    return `你是一个理科知识卡片分类器。请根据卡片内容，为未来检索、复习、思源/Anki 导出生成结构化元数据。\n要求：\n1. 只输出 JSON，不要 Markdown。\n2. 分类要保守、准确；不确定时使用较宽泛类别。\n3. tags 适合做复习标签，3 到 8 个。\n4. difficulty 只能是 easy、medium、hard。\n返回 JSON 结构：{"subject":"数学/物理/化学/生物/计算机/未分类","domain":"更具体的领域","chapter":"具体章节或知识簇","knowledgeType":"概念/公式/条件/步骤/易错/推导/应用","cardType":"卡片类型","difficulty":"easy|medium|hard","tags":["标签1","标签2"],"prerequisites":["前置概念1"],"examUse":"这张卡在解题或理解中的用途"}\n卡片 JSON：\n${JSON.stringify(card)}`;
  }

  trainerExtractJsonCandidate(text) {
    const raw = String(text || "").trim();
    if (!raw) return "";
    const directStart = raw.search(/[\[{]/);
    if (directStart < 0) return raw;
    const open = raw[directStart];
    const close = open === "{" ? "}" : "]";
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = directStart; index < raw.length; index += 1) {
      const char = raw[index];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (char === open) depth += 1;
      if (char === close) depth -= 1;
      if (depth === 0) return raw.slice(directStart, index + 1);
    }
    return raw.slice(directStart);
  }

  trainerParseAIContent(content) {
    const cleaned = String(content || "")
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```$/i, "")
      .trim();
    if (!cleaned) {
      throw Error("AI 文本为空");
    }
    try {
      return JSON.parse(cleaned);
    } catch {
      return JSON.parse(this.trainerExtractJsonCandidate(cleaned));
    }
  }

  trainerFirstText(source, keys) {
    for (const key of keys) {
      const value = source?.[key];
      if (value !== undefined && value !== null && String(value).trim()) {
        return String(value).trim();
      }
    }
    return "";
  }

  trainerNormalizeAICard(card, index = 0) {
    if (!card) return null;
    if (typeof card === "string") {
      const parts = card.split(/\n+/).map((item) => item.trim()).filter(Boolean);
      if (parts.length >= 2) {
        return {
          type: "概念卡",
          front: this.normalizeCardText(parts[0]),
          back: this.normalizeCardText(parts.slice(1).join("\n")),
        };
      }
      return null;
    }
    const front = this.trainerFirstText(card, [
      "front",
      "question",
      "q",
      "prompt",
      "title",
      "term",
      "key",
      "name",
    ]);
    const back = this.trainerFirstText(card, [
      "back",
      "answer",
      "a",
      "explanation",
      "content",
      "detail",
      "definition",
      "value",
      "body",
    ]);
    if (!front || !back) {
      return null;
    }
    return {
      type: this.trainerFirstText(card, ["type", "cardType", "kind", "category"]) || `卡片 ${index + 1}`,
      front: this.normalizeCardText(front),
      back: this.normalizeCardText(back),
    };
  }

  trainerAIShape(value, cardsSource = []) {
    const data = value && typeof value === "object" ? value : {};
    const firstCard = cardsSource[0];
    return {
      valueType: Array.isArray(value) ? "array" : typeof value,
      keys: Array.isArray(value) ? ["<array>"] : Object.keys(data).slice(0, 12),
      cardCount: cardsSource.length,
      firstCardType: Array.isArray(firstCard) ? "array" : typeof firstCard,
      firstCardKeys:
        firstCard && typeof firstCard === "object" && !Array.isArray(firstCard)
          ? Object.keys(firstCard).slice(0, 12)
          : [],
    };
  }

  trainerNormalizeAnalysis(value, fallbackTopic, depth) {
    const data = value && typeof value === "object" ? value : {};
    const cardsSource = Array.isArray(data)
      ? data
      : Array.isArray(data.cards)
        ? data.cards
        : Array.isArray(data.flashcards)
          ? data.flashcards
          : Array.isArray(data.items)
            ? data.items
            : Array.isArray(data.questions)
              ? data.questions
              : [];
    this.trainer().debugLastAIShape = this.trainerAIShape(value, cardsSource);
    if (!cardsSource.length) {
      throw Error("AI 未返回卡片");
    }
    const cards = cardsSource
      .map((card, index) => this.trainerNormalizeAICard(card, index))
      .filter(Boolean)
      .slice(0, 5);
    if (!cards.length) {
      throw Error("AI 返回了卡片数组，但缺少可识别的题面/答案字段");
    }
    return {
      topic: data.topic || data.title || fallbackTopic,
      depth,
      type: data.type || data.category || "概念型 / 公式型 / 应用型",
      question: data.question || data.prompt || "你想先理解哪一层？",
      options:
        Array.isArray(data.options) && data.options.length
          ? data.options.slice(0, 5).map((item) => String(item || "").trim()).filter(Boolean)
          : ["建立直觉", "理解公式", "适用条件", "易错点"],
      note: data.note || data.summary || data.description || `“${fallbackTopic}”的 AI 拆解结果。`,
      cards,
      source: "ai",
    };
  }

  trainerNormalizeClassification(raw, fallbackCard) {
    const allowedDifficulty = ["easy", "medium", "hard"];
    const data = raw && typeof raw === "object" ? raw : {};
    const tags = Array.isArray(data.tags)
      ? data.tags.map(String).map((tag) => tag.trim()).filter(Boolean)
      : fallbackCard.tags || [];
    const prerequisites = Array.isArray(data.prerequisites)
      ? data.prerequisites.map(String).map((item) => item.trim()).filter(Boolean)
      : [];
    return {
      subject: String(data.subject || fallbackCard.subject || "未分类").trim(),
      domain: String(data.domain || fallbackCard.domain || "待整理").trim(),
      chapter: String(
        data.chapter || fallbackCard.chapter || fallbackCard.topic || "",
      ).trim(),
      knowledgeType: String(
        data.knowledgeType || fallbackCard.knowledgeType || "",
      ).trim(),
      cardType: String(data.cardType || fallbackCard.cardType || "概念卡").trim(),
      difficulty: allowedDifficulty.includes(data.difficulty)
        ? data.difficulty
        : fallbackCard.difficulty || "medium",
      tags: Array.from(new Set(tags)).slice(0, 8),
      prerequisites: Array.from(new Set(prerequisites)).slice(0, 8),
      examUse: String(data.examUse || fallbackCard.examUse || "").trim(),
    };
  }

  trainerDiagnoseAIError(error) {
    const message = String(error?.message || error || "未知错误");
    const body = String(error?.body || "");
    const combined = `${message}\n${body}`.toLowerCase();
    const detail = body.replace(/\s+/g, " ").trim().slice(0, 180);
    const suffix = detail ? `（接口返回：${detail}）` : "";
    if (/api key|apikey|authorization|unauthorized|401/.test(combined)) {
      return `API Key 无效或未填写，请检查密钥和 Authorization 权限${suffix}`;
    }
    if (/403|forbidden|permission|access denied/.test(combined)) {
      return `账号没有访问该模型或接口的权限，请检查模型权限${suffix}`;
    }
    if (/402|quota|balance|insufficient|billing|credit/.test(combined)) {
      return `账号额度或余额不足，请检查充值、额度和计费状态${suffix}`;
    }
    if (/429|rate limit|too many requests/.test(combined)) {
      return `请求过于频繁或达到限流，请稍后重试${suffix}`;
    }
    if (/404|not found/.test(combined)) {
      return `接口地址或模型不存在，请检查 Base URL 是否正确，以及模型名是否正确${suffix}`;
    }
    if (/400|invalid_request|model|does not exist|unsupported/.test(combined)) {
      return `请求参数或模型名可能不被支持，请优先检查 model=${this.state.settings?.model || "未配置"}${suffix}`;
    }
    if (/failed to fetch|network|cors|load failed/.test(combined)) {
      return "网络请求失败，可能是网络不可达、CORS 被拦截，或插件环境不允许直接访问该接口";
    }
    if (/空响应|没有文本内容|empty|no text/.test(combined)) {
      return `接口返回为空或没有可解析文本，请检查模型名、额度、权限，或响应格式是否兼容${suffix}`;
    }
    if (/json|parse|unexpected token|not valid/.test(combined)) {
      return `接口响应不是有效 JSON，可能是代理地址、网关错误页或模型输出格式异常${suffix}`;
    }
    if (/timeout|aborted/.test(combined)) {
      return "请求超时，请检查网络或稍后重试";
    }
    return `${message}${suffix}`;
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
    Object.assign(card, classification, {
      classifiedBy: source,
      classifiedAt: new Date().toISOString(),
    });
    if (!card.tags?.length) {
      card.tags = [card.topic, card.cardType].filter(Boolean);
    }
  }

  trainerCreateAcceptedCard(card) {
    const trainer = this.trainer();
    const topic = trainer.current?.topic || trainer.topic || "未命名主题";
    const subject = /导数|函数|积分|级数|泰勒|傅里叶|格林/.test(topic)
      ? "数学"
      : /斜面|电容|力|电路|干涉/.test(topic)
        ? "物理"
        : "未分类";
    return this.normalizeTrainerAcceptedCard({
      id: `trainer-${this.uid()}`,
      topic,
      depth: trainer.depth,
      subject,
      domain: subject === "数学" ? "高等数学" : subject === "物理" ? "物理基础" : "待整理",
      cardType: card.type,
      knowledgeType: card.type,
      difficulty: "medium",
      prerequisites: [],
      examUse: "",
      front: card.front,
      back: card.back,
      angle: trainer.angle,
      tags: [topic, trainer.angle, card.type, subject].filter(Boolean),
      createdAt: new Date().toISOString(),
      status: "confirmed",
    });
  }

  trainerNormalizeActiveDraftIndex() {
    const trainer = this.trainer();
    if (!Number.isInteger(trainer.activeDraftIndex)) return;
    if (!trainer.drafts.length) {
      trainer.activeDraftIndex = null;
      return;
    }
    trainer.activeDraftIndex = Math.min(
      Math.max(trainer.activeDraftIndex, 0),
      trainer.drafts.length - 1,
    );
  }

  trainerFocusDraftAfterRemoval(removedIndex, emptyMobileView) {
    const trainer = this.trainer();
    if (!trainer.drafts.length) {
      trainer.activeDraftIndex = null;
      trainer.mobileView = emptyMobileView;
      return;
    }
    trainer.mobileView = "drafts";
    if (!Number.isInteger(trainer.activeDraftIndex)) return;
    if (trainer.activeDraftIndex === removedIndex) {
      trainer.activeDraftIndex = Math.min(removedIndex, trainer.drafts.length - 1);
      return;
    }
    if (trainer.activeDraftIndex > removedIndex) {
      trainer.activeDraftIndex -= 1;
    }
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
      JSON.stringify(accepted, null, 2),
      "application/json;charset=utf-8",
    );
  }

  trainerExportMarkdown() {
    const accepted = this.trainer().accepted || [];
    if (!accepted.length) {
      showMessage("暂无已确认卡片");
      return;
    }
    const content = `# 理科训练舱卡片导出\n\n${accepted
      .map(
        (card) => `---\nid: ${card.id}\ntopic: ${card.topic}\nsubject: ${card.subject}\ndomain: ${card.domain}\nchapter: ${card.chapter || ""}\ndepth: ${card.depth}\nknowledge_type: ${card.knowledgeType || ""}\ncard_type: ${card.cardType}\ndifficulty: ${card.difficulty || ""}\nangle: ${card.angle}\ncreated_at: ${card.createdAt}\nclassified_by: ${card.classifiedBy || "rule"}\nclassified_at: ${card.classifiedAt || ""}\nexam_use: ${card.examUse || ""}\nprerequisites:\n${(card.prerequisites || []).map((item) => `  - ${item}`).join("\n") || "  - 未整理"}\ntags:\n${(card.tags || []).map((tag) => `  - ${tag}`).join("\n")}\n---\n\n### ${card.cardType}\n\nQ: ${card.front}\n\nA: ${card.back}\n`,
      )
      .join("\n---\n\n")}`;
    this.trainerDownload(
      "science-trainer-siyuan-cards.md",
      content,
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
    const canvas = root.querySelector("#af-graph");
    const detail = root.querySelector("#af-graph-detail");
    if (!canvas || !detail) {
      return;
    }
    const cards = this.graphCards();
    if (!cards.length) {
      canvas.innerHTML = `<div class="aiflash-empty">当前卡包还没有可绘制的闪卡。先生成或刷新卡片后再查看图谱。</div>`;
      detail.innerHTML = `<div class="aiflash-graph-detail-title">知识图谱</div><p>暂无数据。</p>`;
      return;
    }
    const graph = this.buildGraphData(cards);
    const zoom = this.graphZoom || 1;
    const zoomLabel = root.querySelector("#af-graph-zoom");
    if (zoomLabel) {
      zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
    }
    const limitSelect = root.querySelector("#af-graph-limit");
    if (limitSelect) {
      limitSelect.value = String(this.graphLimit || 80);
    }
    const weakOnly = root.querySelector("#af-graph-weak-only");
    if (weakOnly) {
      weakOnly.checked = Boolean(this.graphWeakOnly);
    }
    const graphView = root.querySelector('[data-view="graph"]');
    if (graphView) {
      graphView.classList.toggle(
        "aiflash-graph-fullscreen",
        Boolean(this.graphFullscreen),
      );
    }
    const fullscreenButton = root.querySelector("#af-graph-fullscreen");
    if (fullscreenButton) {
      fullscreenButton.textContent = this.graphFullscreen ? "退出全屏" : "全屏";
    }
    const totals = {
      concepts: graph.nodes.filter((item) => item.type === "concept").length,
      cards: graph.nodes.filter((item) => item.type === "card").length,
    };
    canvas.innerHTML = `
        <div class="aiflash-graph-stage" style="--graph-zoom:${zoom}">
          ${this.graphLinesHTML(graph.nodes, graph.links)}
          ${graph.nodes.map((node, index) => this.graphNodeHTML(node, index, totals, zoom)).join("")}
          <div class="aiflash-graph-hint">滚轮缩放 · 全屏查看更多 · 放大后显示更多文字</div>
        </div>`;
    this.renderGraphDetail(root, null, graph);
    canvas.querySelectorAll("[data-graph-node]").forEach((button) => {
      button.onclick = () => {
        const node = graph.nodes.find(
          (item) => item.id === button.dataset.graphNode,
        );
        canvas
          .querySelectorAll(".aiflash-graph-node")
          .forEach((item) => item.classList.remove("active"));
        button.classList.add("active");
        this.renderGraphDetail(root, node, graph);
      };
    });
    canvas.onwheel = (event) => {
      event.preventDefault();
      const delta = event.deltaY < 0 ? 0.08 : -0.08;
      this.graphZoom = Math.max(
        0.35,
        Math.min(3, Number(((this.graphZoom || 1) + delta).toFixed(2))),
      );
      this.renderGraph(root);
    };
    let drag = null;
    canvas.onpointerdown = (event) => {
      if (event.target.closest?.(".aiflash-graph-node")) {
        return;
      }
      drag = {
        x: event.clientX,
        y: event.clientY,
        left: canvas.scrollLeft,
        top: canvas.scrollTop,
      };
      canvas.classList.add("aiflash-graph-canvas--dragging");
      canvas.setPointerCapture?.(event.pointerId);
    };
    canvas.onpointermove = (event) => {
      if (!drag) {
        return;
      }
      canvas.scrollLeft = drag.left - (event.clientX - drag.x);
      canvas.scrollTop = drag.top - (event.clientY - drag.y);
    };
    canvas.onpointerup = (event) => {
      drag = null;
      canvas.classList.remove("aiflash-graph-canvas--dragging");
      canvas.releasePointerCapture?.(event.pointerId);
    };
    canvas.onpointercancel = () => {
      drag = null;
      canvas.classList.remove("aiflash-graph-canvas--dragging");
    };
  }

  async renderLib(root) {
    const lib = root.querySelector("#af-lib");
    if (!lib) {
      return;
    }
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
      (pack) =>
        pack.id &&
        pack.id !== deckID &&
        !pack.quick &&
        !this.isQuickDeckID(pack.id),
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
        : !targetDeckCount
          ? "需要至少一个普通原生卡组"
          : "";
    }
    if (classifyStatus) {
      classifyStatus.textContent = isQuickDeck
        ? `预设：不确定不移动 · 可分到 ${targetDeckCount} 个卡组`
        : "选择快速制卡后可用";
    }
    const generatedByBlockID = new Map(
      this.state.cards
        .filter((card) => card.blockID)
        .map((card) => [card.blockID, card]),
    );
    const nativeCards = this.nativeCards
      .map((card) => {
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
          back:
            generated?.back || card.deckName || this.activePack()?.name || "",
          state: card.state ?? card.riffCard?.state ?? "",
          due: card.due || card.dueTime || card.riffCard?.due || "",
          nativeHTML: generated ? "" : card.nativeHTML || "",
        };
      })
      .filter(
        (card) =>
          !query ||
          (card.front + card.back + card.blockID).toLowerCase().includes(query),
      );
    const localCards = this.packCards()
      .filter(
        (card) =>
          !card.blockID &&
          (!query || (card.front + card.back).toLowerCase().includes(query)),
      )
      .map((card) => ({
        blockID: "",
        front: card.front,
        back: card.back,
        state: "",
        due: "",
      }));
    const cards = [...nativeCards, ...localCards];
    const moveOptions = this.state.packs
      .filter((pack) => pack.id !== deckID)
      .map(
        (pack) => `<option value="${pack.id}">${this.esc(pack.name)}</option>`,
      )
      .join("");
    lib.innerHTML = cards.length
      ? cards
          .map(
            (card) => `
        <div class="aiflash-item aiflash-card-row">
          <div class="aiflash-card-row-main">
            ${this.cardContentHTML(card)}
          </div>
          <div class="aiflash-card-meta">
            <span>${card.blockID ? "原生闪卡" : "本地旧卡"}</span>
            <span>${card.due ? `到期 ${this.esc(card.due)}` : card.state !== "" ? `状态 ${this.esc(card.state)}` : "已加入"}</span>
            <div class="aiflash-card-actions">
              <button class="b3-button b3-button--outline" data-open-block="${card.blockID || ""}">打开</button>
              ${card.blockID ? `<button class="b3-button b3-button--outline" data-remove-card="${card.blockID}">移除</button>` : ""}
              ${
                card.blockID && moveOptions
                  ? `
                <select class="b3-select" data-move-card="${card.blockID}">
                  <option value="">移动到...</option>
                  ${moveOptions}
                </select>`
                  : ""
              }
            </div>
          </div>
        </div>`,
          )
          .join("")
      : `<div class="aiflash-empty">当前原生卡包暂无卡片</div>`;
    root.querySelectorAll("[data-open-block]").forEach((button) => {
      button.onclick = () => {
        const id = button.dataset.openBlock;
        if (id) {
          openTab({ app: this.app, doc: { id } });
        }
      };
    });
    root.querySelectorAll("[data-remove-card]").forEach((button) => {
      button.onclick = () =>
        this.removeNativeCard(button.dataset.removeCard, deckID);
    });
    root.querySelectorAll("[data-move-card]").forEach((select) => {
      select.onchange = () =>
        this.moveNativeCard(select.dataset.moveCard, select.value, deckID);
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

  normalizeCardText(text) {
    return this.repairFormulaText(text).trim();
  }

  // 公式内部：只还原被错误转义的 $，其余 LaTeX 命令一律保留
  repairMathSegment(math) {
    return String(math || "")
      .replace(/\\\$/g, "$")
      .trim();
  }

  // 公式外的普通文本段：才做 markdown 反转义
  repairPlainText(text) {
    return String(text || "")
      .replace(/\\\$/g, "$")
      .replace(/\\_/g, "_")
      .replace(/\\\*/g, "*")
      .replace(/\\`/g, "`")
      .replace(/\\\{/g, "{")
      .replace(/\\\}/g, "}")
      .replace(/\\\^/g, "^");
  }

  repairFormulaText(text) {
    let s = String(text || "").replace(/\r\n/g, "\n");

    // 第 1 步：定界符归一化，容错 AI 多写一层反斜杠
    // \[ ... \] 或 \\[ ... \\]  →  $$ ... $$
    s = s.replace(/\\{1,2}\[([\s\S]*?)\\{1,2}\]/g, (_, m) => `$$${m}$$`);
    // \( ... \) 或 \\( ... \\)  →  $ ... $
    s = s.replace(/\\{1,2}\(([\s\S]*?)\\{1,2}\)/g, (_, m) => `$${m}$`);

    // 第 2 步：兜底包裹漏了定界符的块级环境
    s = s.replace(
      /(^|[^$])(\\begin\{[a-zA-Z*]+\}[\s\S]*?\\end\{[a-zA-Z*]+\})(?!\$)/g,
      (match, pre, env) => `${pre}$$${env}$$`,
    );

    // 第 3 步：按 $$ 切块级公式段
    const out = [];
    let lastIndex = 0;
    const blockRe = /\$\$([\s\S]*?)\$\$/g;
    let bm;
    while ((bm = blockRe.exec(s)) !== null) {
      out.push({ type: "text", value: s.slice(lastIndex, bm.index) });
      out.push({ type: "block", value: bm[1] });
      lastIndex = blockRe.lastIndex;
    }
    out.push({ type: "text", value: s.slice(lastIndex) });

    // 第 4 步：文本段内再切行内 $...$，公式段原样保留
    const render = [];
    for (const seg of out) {
      if (seg.type === "block") {
        render.push(`$$\n${this.repairMathSegment(seg.value)}\n$$`);
        continue;
      }
      let txt = seg.value;
      let inlineLast = 0;
      const inlineRe = /\$([^$\n]+?)\$/g;
      let im;
      let buf = "";
      while ((im = inlineRe.exec(txt)) !== null) {
        buf += this.repairPlainText(txt.slice(inlineLast, im.index));
        buf += `$${this.repairMathSegment(im[1])}$`;
        inlineLast = inlineRe.lastIndex;
      }
      buf += this.repairPlainText(txt.slice(inlineLast));
      render.push(buf);
    }

    return render.join("").trim();
  }

  clean(text) {
    return this.normalizeCardText(text)
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/^\s{0,3}>\s?/gm, "")
      .replace(/^\s*[-+]\s+/gm, "")
      .replace(/^```[a-zA-Z0-9_-]*\n?/gm, "")
      .replace(/```$/gm, "")
      .trim();
  }

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

  parse(data) {
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
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed
          .filter((item) => item.front && item.back)
          .map((item) => ({
            front: this.normalizeCardText(item.front),
            back: this.normalizeCardText(item.back),
          }))
      : [];
  }

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
