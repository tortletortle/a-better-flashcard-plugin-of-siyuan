# 🎮 Flashcard Achievements Plugin

A gamification enhancement system for AI Flashcards — standalone add-on, **zero-intrusive, does not modify the main program**

## ✨ Features

### 🎯 Fully Independent
- ✅ **Does not modify a single line of the main plugin**
- ✅ Communicates via event system (read-only)
- ✅ Can be enabled / disabled / uninstalled at any time
- ✅ Does not affect main plugin stability

### 🏆 Achievement Badge System (15 Achievements)
| Badge | Achievement | Description | XP Reward |
|------|-------------|-------------|-----------|
| 🎯 | First Memory | Generate your first flashcard | +10 |
| 📚 | Card Novice | Generate 10 flashcards | +50 |
| 📖 | Card Expert | Generate 50 flashcards | +200 |
| 🏆 | Card Master | Generate 100 flashcards | +500 |
| 🔄 | Review Starter | Complete your first review | +10 |
| 📝 | Review Habit | Complete 10 reviews | +50 |
| 🧠 | Memory Pro | Complete 100 reviews | +300 |
| 🔥 | 3-Day Streak | Review for 3 consecutive days | +100 |
| ⭐ | Week Warrior | Review for 7 consecutive days | +300 |
| 👑 | Monthly Champion | Review for 30 consecutive days | +1000 |
| 🤖 | AI Pioneer | First AI-generated flashcard | +20 |
| ✨ | AI Assistant | AI-generated 10 flashcards | +100 |
| 💯 | Perfect Session | Get all answers correct in one review | +150 |
| ⚡ | Trainer Entry | First use of the training room | +30 |
| 🌐 | Knowledge Explorer | View the knowledge graph | +20 |

### 💬 AI Smart Encouragement
- 5 scenarios × 5 phrases = 25 random encouragements
- Review complete, card generated, achievement unlocked, streak, perfect session
- Extensible: supports calling LLM for personalized encouragement

### 📊 Level & XP System
- Each level requires `100 × level` XP
- Visual progress bar
- Level titles: Lv.1 Memory Scholar → Lv.100 Memory God

### 📈 Comprehensive Data Tracking
- Flashcards generated
- Reviews completed
- AI-generated cards
- Consecutive review days
- Perfect review sessions
- Training room usage
- Graph views

## 🚀 Installation & Usage

### 1. Install the Plugin
Place the `flashcard-achievements` folder into the SiYuan plugins directory.

### 2. Enable the Plugin
Go to SiYuan Settings → Plugins → enable "Flashcard Achievements".

### 3. Start Using
- Click the 🏆 icon in the top bar to open the achievements panel
- Use the AI Flashcards plugin normally — **no extra steps required**
- The achievement system will automatically track your activity

## 🔧 How It Works

```
[Main Plugin ai-flashcards-native]
        ↓ Sends CustomEvent (read-only)
[Achievement System Plugin (standalone)]
        ↓ Listens to events + tracks behavior
        ↓ Checks achievement conditions
        ↓ Awards rewards + shows encouragement
        ↓ Persists data
```

### Main Plugin Integration (Optional)

To have the main plugin send events, simply add the following at key points:
```javascript
// After generating a flashcard
document.dispatchEvent(new CustomEvent("flashcard-generated", { detail: {...} }));

// After completing a review
document.dispatchEvent(new CustomEvent("flashcard-reviewed", { detail: {...} }));
```

**Even without modifying the main plugin, the achievement system works normally via polling detection!**

## 🎨 UI Preview

```
┌─────────────────────────────┐
│ 🏆 Lv.3 Memory Scholar 450 XP│
│ ━━━━━━━━━━━━━━━━━━━━━ 75%   │
│                             │
│  📝 25  🔄 18  🔥 5  🏆 8/15 │
│                             │
│  💬 Encouragement Messages  │
│  "Persistence is victory!"  │
│                             │
│  🎖️ Achievement Badges      │
│  🎯📚📖🏆🔄📝🧠🔥⭐👑🤖✨...   │
└─────────────────────────────┘
```

## 🔮 Future Plans

- [ ] More achievements (hidden, rare)
- [ ] Personalized AI encouragement (LLM calls)
- [ ] Achievement share screenshot generation
- [ ] Weekly / monthly leaderboards
- [ ] More gamification elements (quests, events)

## 📄 License

MIT License — free to use and modify
