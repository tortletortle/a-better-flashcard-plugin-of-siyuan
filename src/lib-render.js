// ── 卡片库渲染模块 ────────────────────────────────────────────
// renderLib 的纯渲染部分：卡片数据映射 + HTML 生成。
// 事件绑定和异步加载仍保留在 index.js 的 renderLib 方法中。

// ── 卡片数据映射 ─────────────────────────────────────────────

/**
 * 将原生卡片（riff API 返回）+ 本地备份卡片合并为展示用结构。
 * @param {Object[]} nativeCards  - riff API 返回的原生卡片列表
 * @param {Map}      generatedByBlockID - blockID → 本地卡片（state.cards）
 * @param {Object}   opts
 * @param {string}   opts.query       - 搜索关键词（小写），空串不过滤
 * @param {string}   opts.packName    - 当前卡包名称（用作 back 降级）
 * @param {Function} opts.cardBlockID - card → blockID
 * @returns {Object[]} 展示用卡片列表
 */
function mapNativeCards(nativeCards, generatedByBlockID, opts = {}) {
  const { query = "", packName = "", cardBlockID = (c) => c.blockID || "" } = opts;
  return nativeCards
    .map((card) => {
      const blockID = cardBlockID(card);
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
        back: generated?.back || card.deckName || packName || "",
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
}

/**
 * 筛选本地旧卡（无 blockID 的 state.cards），按搜索词过滤。
 */
function mapLocalCards(packCards, query = "") {
  return packCards
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
}

// ── HTML 生成 ────────────────────────────────────────────────

/**
 * 生成移动目标下拉框的 <option> 列表。
 */
function buildMoveOptions(packs, currentDeckID, esc) {
  return packs
    .filter((pack) => pack.id !== currentDeckID)
    .map((pack) => `<option value="${pack.id}">${esc(pack.name)}</option>`)
    .join("");
}

/**
 * 生成卡片库完整 HTML。
 * @param {Object[]} cards        - mapNativeCards + mapLocalCards 合并后的列表
 * @param {string}   moveOptions  - buildMoveOptions 的结果
 * @param {Function} cardContentHTML - card → HTML 字符串
 * @param {Function} esc          - HTML 转义函数
 */
function renderLibHTML(cards, moveOptions, cardContentHTML, esc) {
  if (!cards.length) {
    return `<div class="aiflash-empty">当前原生卡包暂无卡片</div>`;
  }
  return cards
    .map(
      (card) => `
        <div class="aiflash-item aiflash-card-row">
          <div class="aiflash-card-row-main">
            ${cardContentHTML(card)}
          </div>
          <div class="aiflash-card-meta">
            <span>${card.blockID ? "原生闪卡" : "本地旧卡"}</span>
            <span>${card.due ? `到期 ${esc(card.due)}` : card.state !== "" ? `状态 ${esc(card.state)}` : "已加入"}</span>
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
    .join("");
}

// ── 导出 ─────────────────────────────────────────────────────

module.exports = {
  mapNativeCards,
  mapLocalCards,
  buildMoveOptions,
  renderLibHTML,
};
