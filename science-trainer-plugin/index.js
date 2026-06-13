const { Plugin, showMessage } = require("siyuan");

const DOCK_TYPE = "science_trainer_compat_dock";
const TITLE = "理科训练舱（兼容入口）";
const MOVED_MESSAGE =
  "理科训练舱已迁移到 ai-flashcards-native 的“训练舱”标签。";
const MISSING_MESSAGE =
  "未检测到 ai-flashcards-native，请先启用主插件后再使用训练舱。";

module.exports = class ScienceTrainerCompatPlugin extends Plugin {
  onload() {
    this.lastRedirectAt = 0;
    this.autoRedirected = false;
    this.addIcons(
      `<symbol id="iconScienceTrainer" viewBox="0 0 32 32"><path d="M14 3h4v7.2l7.7 12.9A4 4 0 0 1 22.3 29H9.7a4 4 0 0 1-3.4-5.9L14 10.2V3zm2 10.1L8 26.1a2 2 0 0 0 1.7 2.9h12.6a2 2 0 0 0 1.7-2.9l-8-13zM11 24h10v2H11v-2zm2-4h6v2h-6v-2z"></path></symbol>`,
    );
    this.addTopBar({
      icon: "iconScienceTrainer",
      title: TITLE,
      position: "right",
      callback: () => this.redirectToTrainer(),
    });
    this.addDock({
      config: {
        position: "RightBottom",
        size: { width: 360, height: 0 },
        icon: "iconScienceTrainer",
        title: TITLE,
      },
      data: {},
      type: DOCK_TYPE,
      init: (dock) => {
        dock.element.innerHTML = this.shell();
        this.bind(dock.element);
        this.render(dock.element);
      },
      update: (dock) => {
        this.render(dock.element);
        if (!this.autoRedirected) {
          this.autoRedirected = true;
          this.redirectToTrainer({ source: "dock", throttle: true, silent: true });
        }
      },
      destroy() {},
    });
  }

  shell() {
    return `
      <div class="fn__flex-column" style="height:100%;padding:16px;gap:12px;background:var(--b3-theme-background);color:var(--b3-theme-on-background);overflow:auto;">
        <div class="b3-card" style="padding:16px;display:grid;gap:10px;">
          <div style="font-size:12px;color:var(--b3-theme-primary);font-weight:700;letter-spacing:.04em;text-transform:uppercase;">Compatibility Shell</div>
          <div>
            <div style="font-size:20px;font-weight:700;line-height:1.3;">理科训练舱已迁移</div>
            <div style="margin-top:6px;color:var(--b3-theme-on-surface-light);line-height:1.6;">完整功能现在位于 ai-flashcards-native 的“训练舱”标签。这个旧插件只保留跳转入口，避免已有使用习惯中断。</div>
          </div>
          <div id="science-trainer-compat-status" class="b3-label" style="white-space:normal;"></div>
          <div class="fn__flex" style="gap:8px;flex-wrap:wrap;">
            <button id="science-trainer-compat-open" class="b3-button">打开新训练舱</button>
            <button id="science-trainer-compat-open-workbench" class="b3-button b3-button--outline">打开主工作台</button>
          </div>
        </div>
      </div>`;
  }

  bind(root) {
    root.querySelector("#science-trainer-compat-open")?.addEventListener("click", () => {
      this.redirectToTrainer();
    });
    root
      .querySelector("#science-trainer-compat-open-workbench")
      ?.addEventListener("click", () => {
        this.redirectToWorkbench();
      });
  }

  render(root) {
    const status = root.querySelector("#science-trainer-compat-status");
    if (!status) return;
    status.textContent = globalThis.aiFlashcardsNativeAPI
      ? "已检测到 ai-flashcards-native，可直接跳转。"
      : "尚未检测到 ai-flashcards-native；请先启用主插件。";
  }

  async waitForMainAPI(timeout = 1500) {
    if (globalThis.aiFlashcardsNativeAPI) {
      return globalThis.aiFlashcardsNativeAPI;
    }
    return new Promise((resolve) => {
      let done = false;
      const finish = (api) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        globalThis.removeEventListener?.(
          "ai-flashcards-native-api-ready",
          onReady,
        );
        resolve(api || null);
      };
      const onReady = (event) => finish(event?.detail || globalThis.aiFlashcardsNativeAPI);
      const timer = setTimeout(() => finish(null), timeout);
      globalThis.addEventListener?.(
        "ai-flashcards-native-api-ready",
        onReady,
        { once: true },
      );
    });
  }

  canRedirect(throttle) {
    if (!throttle) return true;
    const now = Date.now();
    if (now - this.lastRedirectAt < 1200) {
      return false;
    }
    this.lastRedirectAt = now;
    return true;
  }

  async redirectToTrainer(options = {}) {
    if (!this.canRedirect(options.throttle)) {
      return false;
    }
    if (!options.silent) {
      showMessage(MOVED_MESSAGE);
    }
    const api = await this.waitForMainAPI();
    if (!api) {
      showMessage(MISSING_MESSAGE);
      return false;
    }
    if (typeof api.openTrainer === "function") {
      api.openTrainer();
      return true;
    }
    if (typeof api.openWorkbench === "function") {
      api.openWorkbench();
      return true;
    }
    showMessage("检测到主插件，但未找到训练舱入口，请升级 ai-flashcards-native。");
    return false;
  }

  async redirectToWorkbench() {
    const api = await this.waitForMainAPI();
    if (!api?.openWorkbench) {
      showMessage(MISSING_MESSAGE);
      return false;
    }
    showMessage("已打开 ai-flashcards-native 主工作台。");
    api.openWorkbench();
    return true;
  }
};
