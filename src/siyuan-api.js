// ── 思源原生卡片 API 纯函数封装 ──────────────────────────────
// 封装 riff/deck 数据转换的纯函数（无 this 依赖，可独立测试）。
// 异步方法（syncNativeDecks、addCardsToNativeDeck 等）仍保留在 index.js，
// 因为它们深度耦合 plugin 实例状态（nativeCards、showMessage、renderAll）。

const { Constants } = require("siyuan");

// ── ID 提取 ────────────────────────────────────────────

function riffDeckID(deck) {
  return String(
    [deck?.id, deck?.deckID, deck?.deckId, deck?.deck_id]
      .find((v) => v != null && v !== "") || "",
  );
}

function quickDeckID() {
  return Constants?.QUICK_DECK_ID || "20230218211946-2kw8jgx";
}

function isQuickDeckID(deckID) {
  return Boolean(deckID && deckID === quickDeckID());
}

// ── 数值提取 ───────────────────────────────────────────

function numberFrom(values) {
  for (const v of values) {
    if (v === undefined || v === null || v === "") continue;
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return 0;
}

// ── API 响应转换 ───────────────────────────────────────

function riffDecksFromApi(data) {
  const source = Array.isArray(data)
    ? data
    : [data?.decks, data?.riffDecks, data?.deckList, data?.list, data?.items, data?.data]
        .find((v) => Array.isArray(v)) || [];
  const decks = Array.isArray(source) ? source : [];
  const seen = new Set();
  return decks.filter((deck) => {
    const id = riffDeckID(deck);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function deckFromApi(deck) {
  const id = riffDeckID(deck);
  const cardCount = numberFrom([
    deck.cardCount, deck.size, deck.count, deck.total, deck.cardSize,
  ]);
  return {
    id,
    name: deck.name || deck.title || "未命名卡包",
    cardCount,
    size: cardCount,
    dueCardCount: numberFrom([deck.dueCardCount, deck.dueCount, deck.due]),
    newCardCount: numberFrom([deck.newCardCount, deck.newCount, deck.new]),
    todayReviewedCardCount: numberFrom([
      deck.todayReviewedCardCount, deck.reviewedCardCount, deck.todayReviewed,
    ]),
    created: deck.created || deck.createdAt || "",
    updated: deck.updated || deck.updatedAt || "",
    quick: Boolean(deck.quick),
    native: true,
  };
}

function createdDeckFromApi(data, fallbackName) {
  const deck = data?.deck || data?.riffDeck || data;
  const id =
    riffDeckID(deck) ||
    data?.deckID ||
    data?.deckId ||
    data?.id ||
    (typeof data === "string" ? data : "");
  return deckFromApi({
    ...(typeof deck === "object" ? deck : {}),
    id,
    name: deck?.name || fallbackName,
  });
}

// ── 导出 ───────────────────────────────────────────────

module.exports = {
  riffDeckID, quickDeckID, isQuickDeckID, numberFrom,
  riffDecksFromApi, deckFromApi, createdDeckFromApi,
};
