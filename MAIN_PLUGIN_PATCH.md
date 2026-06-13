# 🩹 主插件集成补丁（可选）

**完全可选！** 成就系统不打这个补丁也能工作（通过轮询检测）。

打补丁后体验更好（实时事件响应），**只加3行代码，零侵入！**

---

## 📍 需要修改的位置（ai-flashcards-native/index.js）

### 1. 生成闪卡后（约第 1500 行附近）
在 `addCardsToNativeDeck` 函数成功后添加：

```javascript
// 原有代码
await this.syncNativeDecks().catch(() => null);
this.nativeCardsDeckID = "";
await this.save();
this.renderAll();

// ===== 添加这1行 =====
document.dispatchEvent(new CustomEvent("flashcard-generated", { detail: { count: cards.length, ai: false } }));
```

### 2. AI 生成闪卡后（约第 2200 行附近）
在 AI 生成成功后添加：

```javascript
// 原有代码
showMessage(`成功生成 ${generated.length} 张闪卡`);

// ===== 添加这1行 =====
document.dispatchEvent(new CustomEvent("flashcard-ai-generated", { detail: { count: generated.length } }));
```

### 3. 复习完成后（约第 3000 行附近）
在训练舱复习完成后添加：

```javascript
// 原有代码 - 评分逻辑结束后

// ===== 添加这1行 =====
document.dispatchEvent(new CustomEvent("flashcard-reviewed", { detail: { correct: correctCount, total: totalCount, perfect: correctCount === totalCount } }));
```

### 4. 打开训练舱时
```javascript
// ===== 添加这1行 =====
document.dispatchEvent(new CustomEvent("trainer-session", { detail: {} }));
```

### 5. 查看图谱时
```javascript
// ===== 添加这1行 =====
document.dispatchEvent(new CustomEvent("graph-viewed", { detail: {} }));
```

---

## ✅ 补丁特点

1. **总共只加 5 行代码**
2. **完全不修改原有逻辑**
3. **只是发送事件通知**
4. **没有副作用**
5. **即使成就插件没装也完全不影响**

---

## ❓ 为什么这是"外挂"设计

```
主插件发送事件 → 就像"广播"一样
        ↓ 谁想听谁听
成就插件监听事件 → 独立处理自己的逻辑
        ↓ 不回传，不修改
成就插件自己存数据，自己渲染UI
```

这种设计的好处：
- ✅ 主插件永远稳定
- ✅ 成就插件可以随时更新
- ✅ 用户可以选择装或不装
- ✅ 多个插件可以同时监听同一个事件
