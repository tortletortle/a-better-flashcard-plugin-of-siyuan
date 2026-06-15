// ── 训练舱 UI 纯函数 ────────────────────────────────────────────
// 从 index.js 提取的无状态纯函数：导出格式化、markdown 生成等。
// 异步方法（trainerAccept、trainerAnalyzeTopic 等）仍保留在 index.js，
// 因为它们深度耦合 plugin 实例状态（save、renderAll、api、showMessage）。

// ── 训练舱卡片 → Markdown ─────────────────────────────────────

/**
 * 将已确认卡片列表格式化为 Markdown 字符串。
 * @param {Object[]} accepted - trainer.accepted 卡片数组
 * @returns {string} 完整 Markdown 文本
 */
function acceptedToMarkdown(accepted) {
  if (!accepted || !accepted.length) return "";
  const header = "# 理科训练舱卡片导出\n\n";
  const blocks = accepted.map((card) => {
    const prereqs = (card.prerequisites || []).map((item) => `  - ${item}`).join("\n") || "  - 未整理";
    const tags = (card.tags || []).map((tag) => `  - ${tag}`).join("\n");
    return `---
id: ${card.id}
topic: ${card.topic}
subject: ${card.subject}
domain: ${card.domain}
chapter: ${card.chapter || ""}
depth: ${card.depth}
knowledge_type: ${card.knowledgeType || ""}
card_type: ${card.cardType}
difficulty: ${card.difficulty || ""}
angle: ${card.angle}
created_at: ${card.createdAt}
classified_by: ${card.classifiedBy || "rule"}
classified_at: ${card.classifiedAt || ""}
exam_use: ${card.examUse || ""}
prerequisites:
${prereqs}
tags:
${tags}
---

### ${card.cardType}

Q: ${card.front}

A: ${card.back}
`;
  });
  return header + blocks.join("\n---\n\n");
}

// ── 训练舱卡片 → JSON ──────────────────────────────────────────

/**
 * 将已确认卡片列表格式化为 JSON 字符串。
 * @param {Object[]} accepted - trainer.accepted 卡片数组
 * @returns {string} 格式化 JSON
 */
function acceptedToJSON(accepted) {
  return JSON.stringify(accepted, null, 2);
}

// ── 导出 ───────────────────────────────────────────────────────

module.exports = {
  acceptedToMarkdown,
  acceptedToJSON,
};
