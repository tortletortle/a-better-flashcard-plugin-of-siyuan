const { Plugin, showMessage } = require("siyuan");

const DOCK_TYPE = "flashcard_achievements_dock";
const DOCK_TITLE = "闪卡成就系统";

// ==================== 成就定义 ====================
const ACHIEVEMENTS = {
  first_card: {
    id: "first_card",
    name: "初次记忆",
    description: "生成第一张闪卡",
    icon: "🎯",
    xp: 10,
    condition: (stats) => stats.totalCardsGenerated >= 1,
  },
  card_master_10: {
    id: "card_master_10",
    name: "闪卡新手",
    description: "累计生成10张闪卡",
    icon: "📚",
    xp: 50,
    condition: (stats) => stats.totalCardsGenerated >= 10,
  },
  card_master_50: {
    id: "card_master_50",
    name: "闪卡达人",
    description: "累计生成50张闪卡",
    icon: "📖",
    xp: 200,
    condition: (stats) => stats.totalCardsGenerated >= 50,
  },
  card_master_100: {
    id: "card_master_100",
    name: "闪卡大师",
    description: "累计生成100张闪卡",
    icon: "🏆",
    xp: 500,
    condition: (stats) => stats.totalCardsGenerated >= 100,
  },
  first_review: {
    id: "first_review",
    name: "复习开始",
    description: "完成第一次复习",
    icon: "🔄",
    xp: 10,
    condition: (stats) => stats.totalReviews >= 1,
  },
  review_10: {
    id: "review_10",
    name: "温故知新",
    description: "完成10次复习",
    icon: "📝",
    xp: 50,
    condition: (stats) => stats.totalReviews >= 10,
  },
  review_100: {
    id: "review_100",
    name: "记忆高手",
    description: "完成100次复习",
    icon: "🧠",
    xp: 300,
    condition: (stats) => stats.totalReviews >= 100,
  },
  streak_3: {
    id: "streak_3",
    name: "三天坚持",
    description: "连续3天复习",
    icon: "🔥",
    xp: 100,
    condition: (stats) => stats.currentStreak >= 3,
  },
  streak_7: {
    id: "streak_7",
    name: "一周达人",
    description: "连续7天复习",
    icon: "⭐",
    xp: 300,
    condition: (stats) => stats.currentStreak >= 7,
  },
  streak_30: {
    id: "streak_30",
    name: "月度冠军",
    description: "连续30天复习",
    icon: "👑",
    xp: 1000,
    condition: (stats) => stats.currentStreak >= 30,
  },
  ai_first: {
    id: "ai_first",
    name: "AI先驱",
    description: "首次使用AI生成闪卡",
    icon: "🤖",
    xp: 20,
    condition: (stats) => stats.aiGeneratedCards >= 1,
  },
  ai_10: {
    id: "ai_10",
    name: "AI助手",
    description: "AI生成10张闪卡",
    icon: "✨",
    xp: 100,
    condition: (stats) => stats.aiGeneratedCards >= 10,
  },
  perfect_session: {
    id: "perfect_session",
    name: "完美表现",
    description: "一次复习全部答对",
    icon: "💯",
    xp: 150,
    condition: (stats) => stats.perfectSessions >= 1,
  },
  trainer_first: {
    id: "trainer_first",
    name: "训练舱入门",
    description: "首次使用训练舱",
    icon: "⚡",
    xp: 30,
    condition: (stats) => stats.trainerSessions >= 1,
  },
  explorer: {
    id: "explorer",
    name: "知识探索者",
    description: "查看知识图谱",
    icon: "🌐",
    xp: 20,
    condition: (stats) => stats.graphViews >= 1,
  },
};

// ==================== AI 鼓励语模板 ====================
const ENCOURAGEMENT_TEMPLATES = {
  review_complete: [
    "太棒了！又完成了一次复习，你的记忆在不断强化！💪",
    "坚持就是胜利！每一次复习都是向成功迈进！🎯",
    "你的大脑正在变得更强大，继续保持！🧠",
    "知识就是力量，你正在积累自己的力量宝库！📚",
    "今天的努力，明天的收获！为你点赞！👍",
  ],
  card_generated: [
    "新的知识卡片诞生了！又向知识海洋迈进一步！🌊",
    "又一张闪卡！积少成多，聚沙成塔！✨",
    "你的知识库又丰富了一点！继续加油！📖",
    "记录知识，就是积累财富！💰",
  ],
  achievement_unlocked: [
    "恭喜解锁成就！你的努力得到了认可！🏆",
    "里程碑达成！这是你坚持的见证！⭐",
    "太棒了！又一个成就收入囊中！🎊",
    "你做到了！这个成就属于你！🎉",
  ],
  streak: [
    "连续打卡！你的坚持令人敬佩！🔥",
    "又一天！好习惯正在养成！🌟",
    "坚持的力量！你正在超越昨天的自己！💫",
  ],
  perfect: [
    "完美！全部答对，你就是记忆之王！👑",
    "太厉害了！100%正确率！💯",
    "知识已经牢牢掌握！为你骄傲！🎖️",
  ],
};

module.exports = class FlashcardAchievementsPlugin extends Plugin {
  onload() {
    console.log("闪卡成就系统已加载");

    // 初始化状态
    this.stats = {
      totalCardsGenerated: 0,
      totalReviews: 0,
      aiGeneratedCards: 0,
      trainerSessions: 0,
      graphViews: 0,
      perfectSessions: 0,
      currentStreak: 0,
      longestStreak: 0,
      lastReviewDate: null,
      reviewDates: [],
      totalXP: 0,
      level: 1,
    };

    this.unlockedAchievements = new Set();
    this.recentEncouragements = [];

    // 加载保存的数据
    this._loadStats();

    // 添加图标
    this.addIcons(`<symbol id="iconAchievement" viewBox="0 0 32 32">
      <path d="M16 2L6 8v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V8l-10-6zm0 2.18L22 7.5v6.5c0 4.52-2.98 8.68-6 9.92-3.02-1.24-6-5.4-6-9.92V7.5l6-3.32zM11 12h2v6h-2v-6zm8 0h2v6h-2v-6z"/>
    </symbol>`);

    // 添加顶栏按钮
    this.addTopBar({
      icon: "iconAchievement",
      title: DOCK_TITLE,
      position: "right",
      callback: () => this.openDock(),
    });

    // 添加停靠面板
    this.addDock({
      config: {
        position: "RightBottom",
        size: { width: 320, height: 0 },
        icon: "iconAchievement",
        title: DOCK_TITLE,
      },
      data: {},
      type: DOCK_TYPE,
      init: (dock) => {
        dock.element.innerHTML = this.renderDock();
        this.bindDockEvents(dock.element);
      },
      update: (dock) => {
        dock.element.innerHTML = this.renderDock();
        this.bindDockEvents(dock.element);
      },
      destroy() {},
    });

    // 监听主插件事件
    this.setupEventListeners();
  }

  onunload() {
    this._saveStats();

    // 移除事件监听
    document.removeEventListener("flashcard-generated", this._onFlashcardGenerated);
    document.removeEventListener("flashcard-reviewed", this._onFlashcardReviewed);
    document.removeEventListener("flashcard-ai-generated", this._onAIGenerated);
    document.removeEventListener("trainer-session", this._onTrainerSession);
    document.removeEventListener("graph-viewed", this._onGraphViewed);

    // 清除定时器
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
    }

    console.log("闪卡成就系统已卸载");
  }

  // ==================== 数据持久化 ====================
  async _loadStats() {
    try {
      const data = await this.loadData("stats.json");
      if (data) {
        this.stats = data.stats || this.stats;
        this.unlockedAchievements = new Set(data.unlockedAchievements || []);
      }
    } catch (e) {
      console.log("无存档数据，使用默认值");
    }
  }

  async _saveStats() {
    await this.saveData("stats.json", {
      stats: this.stats,
      unlockedAchievements: Array.from(this.unlockedAchievements),
    });
    this._refreshDock();
  }

  _refreshDock() {
    const dockEl = document.querySelector(`[data-type="${DOCK_TYPE}"] .fn__flex-column`);
    if (dockEl) {
      const parent = dockEl.parentNode;
      parent.innerHTML = this.renderDock();
      this.bindDockEvents(parent);
    }
  }

  // ==================== 事件监听 ====================
  setupEventListeners() {
    // 监听闪卡生成
    this._onFlashcardGenerated = (e) => this.trackCardGenerated(e.detail);
    document.addEventListener("flashcard-generated", this._onFlashcardGenerated);

    // 监听复习完成
    this._onFlashcardReviewed = (e) => this.trackReview(e.detail);
    document.addEventListener("flashcard-reviewed", this._onFlashcardReviewed);

    // 监听AI生成
    this._onAIGenerated = (e) => this.trackAIGenerated(e.detail);
    document.addEventListener("flashcard-ai-generated", this._onAIGenerated);

    // 监听训练舱使用
    this._onTrainerSession = (e) => this.trackTrainerSession(e.detail);
    document.addEventListener("trainer-session", this._onTrainerSession);

    // 监听图谱查看
    this._onGraphViewed = () => this.trackGraphView();
    document.addEventListener("graph-viewed", this._onGraphViewed);

    // 也可以通过轮询检测主插件状态
    this.startMainPluginDetection();
  }

  startMainPluginDetection() {
    // 检测主插件API并注入钩子
    this._pollTimer = setInterval(() => {
      if (globalThis.aiFlashcardsNativeAPI && !this.hooked) {
        this.hookIntoMainPlugin();
      }
    }, 1000);
  }

  hookIntoMainPlugin() {
    this.hooked = true;
    console.log("成就系统已连接到主插件");

    // 注入监控钩子（只读，不修改原功能）
    const api = globalThis.aiFlashcardsNativeAPI;
    
    // 这里可以添加更多钩子逻辑
    // 完全只读，不干扰主程序
  }

  // ==================== 行为追踪 ====================
  trackCardGenerated(detail = {}) {
    this.stats.totalCardsGenerated++;
    this.checkAchievements();
    this.showEncouragement("card_generated");
    this._saveStats();
  }

  trackReview(detail = {}) {
    this.stats.totalReviews++;
    this.updateStreak();
    
    if (detail.perfect) {
      this.stats.perfectSessions++;
      this.showEncouragement("perfect");
    } else {
      this.showEncouragement("review_complete");
    }
    
    this.checkAchievements();
    this._saveStats();
  }

  trackAIGenerated(detail = {}) {
    this.stats.aiGeneratedCards++;
    this.stats.totalCardsGenerated++;
    this.checkAchievements();
    this._saveStats();
  }

  trackTrainerSession(detail = {}) {
    this.stats.trainerSessions++;
    this.checkAchievements();
    this._saveStats();
  }

  trackGraphView() {
    this.stats.graphViews++;
    this.checkAchievements();
    this._saveStats();
  }

  updateStreak() {
    const today = new Date().toDateString();
    
    if (this.stats.lastReviewDate === today) {
      return; // 今天已经算过了
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (this.stats.lastReviewDate === yesterday.toDateString()) {
      this.stats.currentStreak++;
      this.showEncouragement("streak");
    } else {
      this.stats.currentStreak = 1;
    }

    this.stats.lastReviewDate = today;
    this.stats.longestStreak = Math.max(this.stats.longestStreak, this.stats.currentStreak);
    this.stats.reviewDates.push(today);
  }

  // ==================== 成就检测 ====================
  checkAchievements() {
    Object.values(ACHIEVEMENTS).forEach((achievement) => {
      if (!this.unlockedAchievements.has(achievement.id) && achievement.condition(this.stats)) {
        this.unlockAchievement(achievement);
      }
    });
  }

  unlockAchievement(achievement) {
    this.unlockedAchievements.add(achievement.id);
    this.stats.totalXP += achievement.xp;
    this.updateLevel();

    // 显示成就解锁弹窗动画
    this.showAchievementPopup(achievement);
    this.showEncouragement("achievement_unlocked");

    this._saveStats();
  }

  showAchievementPopup(achievement) {
    const overlay = document.createElement("div");
    overlay.className = "achievement-overlay";
    overlay.innerHTML = `
      <div class="achievement-card">
        <div class="icon">${achievement.icon}</div>
        <div style="font-size:13px;font-weight:600;color:#667eea;letter-spacing:1px;margin-bottom:8px;">成就解锁！</div>
        <div class="name">${achievement.name}</div>
        <div class="desc">${achievement.description}</div>
        <div class="xp">+${achievement.xp} XP</div>
      </div>
    `;
    document.body.appendChild(overlay);

    // 点击可提前关闭
    overlay.addEventListener("click", () => this._removeOverlay(overlay));

    // 3秒后淡出并移除
    setTimeout(() => this._removeOverlay(overlay), 3000);
  }

  _removeOverlay(overlay) {
    if (!overlay.parentNode) return;
    overlay.classList.add("fade-out");
    setTimeout(() => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 500);
  }

  updateLevel() {
    // 等级公式：每级需要 100 * level XP（累加制）
    // Lv.1: 0~99, Lv.2: 100~299(需200), Lv.3: 300~599(需300)
    const xp = this.stats.totalXP;
    let level = 1;
    let accumulated = 0;
    while (xp >= accumulated + 100 * level) {
      accumulated += 100 * level;
      level++;
    }
    this.stats.level = level;
  }

  // ==================== AI 鼓励 ====================
  showEncouragement(type) {
    const templates = ENCOURAGEMENT_TEMPLATES[type] || ENCOURAGEMENT_TEMPLATES.review_complete;
    const message = templates[Math.floor(Math.random() * templates.length)];

    this.recentEncouragements.unshift({
      message,
      time: new Date().toLocaleTimeString(),
      type,
    });

    // 只保留最近10条
    if (this.recentEncouragements.length > 10) {
      this.recentEncouragements.pop();
    }

    // 显示浮动通知
    this._showEncouragementFloat(message);
  }

  _showEncouragementFloat(message) {
    const el = document.createElement("div");
    el.className = "encouragement-float encouragement-msg";
    el.textContent = message;
    document.body.appendChild(el);

    setTimeout(() => {
      el.classList.add("fade-out");
      setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 500);
    }, 2500);
  }

  // ==================== AI 智能鼓励生成 ====================
  async generateAIEncouragement(context) {
    // 如果用户配置了API Key，可以生成个性化鼓励
    // 这里可以调用主插件的AI设置
    // 完全可选，不影响基础功能
    return "继续加油！你做得很棒！";
  }

  // ==================== UI 渲染 ====================
  renderDock() {
    const progress = this.getLevelProgress();
    const unlockedCount = this.unlockedAchievements.size;
    const totalCount = Object.keys(ACHIEVEMENTS).length;

    return `
      <div class="fn__flex-column" style="height:100%;padding:16px;gap:16px;background:var(--b3-theme-background);color:var(--b3-theme-on-background);overflow:auto;">
        <!-- 等级和经验 -->
        <div class="b3-card" style="padding:16px;">
          <div class="fn__flex" style="align-items:center;gap:12px;margin-bottom:12px;">
            <div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#667eea,#764ba2);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:white;">
              ${this.stats.level}
            </div>
            <div style="flex:1;">
              <div style="font-weight:700;font-size:16px;">Lv.${this.stats.level} 记忆学者</div>
              <div style="font-size:12px;color:var(--b3-theme-on-surface-light);">${this.stats.totalXP} XP 总经验</div>
            </div>
          </div>
          <div style="height:8px;background:var(--b3-theme-surface);border-radius:4px;overflow:hidden;">
            <div class="xp-bar-animate" style="height:100%;width:${progress}%;background:linear-gradient(90deg,#667eea,#764ba2);transition:width .3s;"></div>
          </div>
          <div style="font-size:12px;color:var(--b3-theme-on-surface-light);margin-top:4px;text-align:right;">
            升级还需 ${(() => { let a = 0; for (let i = 1; i < this.stats.level; i++) a += 100 * i; return a + 100 * this.stats.level - this.stats.totalXP; })()} XP
          </div>
        </div>

        <!-- 统计数据 -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          ${this.renderStatCard("📝", "生成闪卡", this.stats.totalCardsGenerated)}
          ${this.renderStatCard("🔄", "完成复习", this.stats.totalReviews)}
          ${this.renderStatCard("🔥", "连续天数", this.stats.currentStreak)}
          ${this.renderStatCard("🏆", "成就解锁", `${unlockedCount}/${totalCount}`)}
        </div>

        <!-- 最近鼓励 -->
        <div class="b3-card" style="padding:16px;">
          <div style="font-weight:700;margin-bottom:8px;display:flex;align-items:center;gap:6px;">
            <span>💬</span> 鼓励消息
          </div>
          <div style="display:grid;gap:8px;">
            ${this.recentEncouragements.slice(0, 3).map(e => `
              <div style="padding:8px 12px;background:var(--b3-theme-surface);border-radius:8px;font-size:13px;">
                ${e.message}
              </div>
            `).join("") || '<div style="color:var(--b3-theme-on-surface-light);font-size:13px;">开始复习后这里会显示鼓励消息~</div>'}
          </div>
        </div>

        <!-- 成就列表 -->
        <div class="b3-card" style="padding:16px;">
          <div style="font-weight:700;margin-bottom:12px;display:flex;align-items:center;gap:6px;">
            <span>🎖️</span> 成就徽章
          </div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">
            ${Object.values(ACHIEVEMENTS).map(a => this.renderAchievementBadge(a)).join("")}
          </div>
        </div>
      </div>
    `;
  }

  renderStatCard(icon, label, value) {
    return `
      <div style="padding:12px;background:var(--b3-theme-surface);border-radius:8px;text-align:center;">
        <div style="font-size:20px;margin-bottom:4px;">${icon}</div>
        <div style="font-size:18px;font-weight:700;">${value}</div>
        <div style="font-size:11px;color:var(--b3-theme-on-surface-light);">${label}</div>
      </div>
    `;
  }

  renderAchievementBadge(achievement) {
    const unlocked = this.unlockedAchievements.has(achievement.id);
    return `
      <div 
        class="badge-hover"
        style="padding:8px;text-align:center;border-radius:8px;cursor:pointer;${unlocked ? 'background:var(--b3-theme-primary-light);' : 'background:var(--b3-theme-surface);opacity:0.5;'}"
        title="${achievement.name}: ${achievement.description} (+${achievement.xp} XP)"
      >
        <div style="font-size:24px;">${achievement.icon}</div>
        <div style="font-size:10px;margin-top:2px;${unlocked ? '' : 'filter:grayscale(1);'}">${achievement.name}</div>
      </div>
    `;
  }

  getLevelProgress() {
    // 计算当前等级的XP起点和下一级的XP要求
    // Lv.1: 0~99, Lv.2: 100~299(需200), Lv.3: 300~599(需300)
    let accumulatedXP = 0;
    for (let i = 1; i < this.stats.level; i++) {
      accumulatedXP += 100 * i;
    }
    const currentLevelRequired = 100 * this.stats.level;
    const progressInLevel = this.stats.totalXP - accumulatedXP;
    return Math.min(100, Math.max(0, (progressInLevel / currentLevelRequired) * 100));
  }

  bindDockEvents(element) {
    // 点击成就徽章显示详情
    const badges = element.querySelectorAll("[title]");
    badges.forEach(badge => {
      badge.addEventListener("click", () => {
        const title = badge.getAttribute("title");
        if (title) {
          showMessage(title, 3000);
        }
      });
    });
  }

  openDock() {
    // 通过 SiYuan 内置方法打开 dock 面板
    const dockElement = document.querySelector(`[data-type="${DOCK_TYPE}"]`);
    if (dockElement) {
      dockElement.click();
    } else {
      showMessage("请在右下方停靠面板中查看成就系统 🏆", 3000);
    }
  }
};
