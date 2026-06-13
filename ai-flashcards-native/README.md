# AI Flashcards Native - SiYuan Plugin

A powerful AI-driven flashcard learning plugin with native dock integration and efficient spaced repetition system for SiYuan Notes.

[中文文档](./README_zh_CN.md) | English

## ✨ Core Features

### 🎴 Flashcard Management
- **Native Spaced Repetition**: SM2 and Riff algorithm-based interval spacing
- **Multiple Card Types**:
  - 📝 Concept Cards: Understanding core concepts
  - 📐 Formula Cards: Memorizing important formulas
  - ⚠️ Common Mistake Cards: Avoiding typical errors
  - 🔗 Relationship Cards: Building knowledge connections
  - 💡 Application Cards: Solving practical problems

### 🏃 Trainer Mode
- Immersive full-screen review experience
- Real-time progress tracking
- Intelligent card scheduling
- Learning session statistics

### 📚 Card Library
- Subject-based classification
- Quick search and filtering
- Import/export functionality
- Card editing and version control

### 📊 Knowledge Graph
- Visualized learning progress
- Concept relationship networks
- Real-time node status (Mastered/Medium/Weak/Unknown)
- Interactive graph manipulation

### ⚙️ Advanced Features
- 🤖 **AI Generation**: Automatically generate high-quality flashcards from notes
- 📐 **Math Formula Adaptation**: Auto-normalize LaTeX format (`\(\)` `\[\]` → `$ $$`)
- 🔧 **Intelligent Segment Repair**: Ensure formulas render correctly in paragraphs
- 🎨 **Theme Integration**: Full support for SiYuan native themes
- 🌍 **Multilingual**: Complete English and Chinese localization

## 📦 Installation

### Method 1: From SiYuan App Store (Recommended)
1. Open SiYuan Notes
2. Go to **Settings → App Store → Plugins**
3. Search for `AI Flashcards Native`
4. Click **Install**

### Method 2: From Source (Developer)
1. Clone the repository:
   ```bash
   git clone https://github.com/tortletortle/a-better-flashcard-plugin-of-siyuan.git
   cd a-better-flashcard-plugin-of-siyuan/ai-flashcards-native
   ```

2. Copy to SiYuan plugin directory:
   - Windows: `%AppData%\SiYuan\data\plugins\`
   - macOS: `~/Library/Application Support/SiYuan/data/plugins/`
   - Linux: `~/.config/SiYuan/data/plugins/`

3. Restart SiYuan Notes

4. Go to **Settings → About → Plugins** to enable `AI Flashcards Native`

## 🚀 Quick Start

### First Time Setup
1. After enabling the plugin, an **AI Flashcards** panel appears in the right sidebar
2. Or click the **flashcard icon** in the top toolbar for quick access

### Creating Flashcards

#### Method 1: AI Auto-generation
1. Go to the **Generate** tab
2. Input or paste learning content
3. Select generation parameters:
   - **Subject Category**: Choose discipline (Math, Physics, Programming, etc.)
   - **Card Count**: Generate 5-50 cards
4. Click **Generate with AI** button
5. Wait for processing (requires API key configuration)
6. Preview generated cards and confirm before **saving**

#### Method 2: Manual Creation
1. Switch to **Edit** tab
2. Fill in card information:
   - **Question** (front)
   - **Answer** (back)
   - **Category Tags**
   - **Card Type** (Concept/Formula/Mistake, etc.)
3. Click **Save Card**

### Reviewing Flashcards

#### Trainer Mode (Recommended)
1. Select a subject in the **Library** tab
2. Click **Start Training**
3. Enter immersive full-screen review environment
4. Read the question, think of the answer, then click **Show Answer**
5. Grade your response:
   - **😤 Again**: Add to review queue, retry tomorrow
   - **😐 Hard**: Mark as medium difficulty, review in 1 week
   - **😊 Good**: Interval upgrade, review in 2 weeks
   - **🎉 Easy**: Maximum interval, review in 1 month

#### Quick Review in Sidebar
1. Select **Review** tab in the right sidebar
2. Browse cards due for review
3. Click card to see details
4. Grade and continue

### Viewing Knowledge Graph
1. Switch to **Knowledge Graph** tab
2. Visualize all concepts and their learning status
3. Hover over nodes to see card details
4. Click nodes to see related cards list

### Managing Settings
1. Open **Settings** tab
2. Configure:
   - AI service API keys
   - Spaced repetition parameters
   - Review reminders
   - Card import/export paths

## 🔧 AI Service Configuration

### Using OpenAI API (Recommended)

#### Step 1: Get API Key
1. Visit [OpenAI Platform](https://platform.openai.com/)
2. Login or register
3. Go to **API Keys** page
4. Click **Create new secret key**
5. Copy the generated key (shown only once)

#### Step 2: Configure in Plugin
1. Open SiYuan → Plugins → **AI Flashcards** → **Settings**
2. Under **AI Service** section:
   - Select **OpenAI**
   - Paste your API key
   - Configure model: `gpt-4` or `gpt-3.5-turbo`
   - Set temperature (0.3-0.7 recommended)
3. Click **Test Connection** to verify
4. Save settings

#### Step 3: Start Using
- Enter content in **Generate** tab
- Click **Generate with AI**, system calls OpenAI API

### Using Local LLM (Offline Mode)

For privacy and offline usage, configure a local LLM:

1. Install **Ollama** or **LM Studio**
2. Download a local model (e.g., `Mistral` or `Neural Chat`)
3. Start local LLM service (default localhost:11434)
4. In plugin settings:
   - Select **Local LLM**
   - Input service address
   - Select model name
5. Save and use offline

### Cost Estimation

| Model | Cost | Quality | Speed |
|-------|------|---------|-------|
| GPT-4 | $0.03/1K tokens | ⭐⭐⭐⭐⭐ | Medium |
| GPT-3.5 Turbo | $0.002/1K tokens | ⭐⭐⭐⭐ | Fast |
| Mistral 7B | Free (Local) | ⭐⭐⭐ | Fast |
| Ollama | Free (Local) | ⭐⭐⭐ | Medium |

**Tip**: Small-scale usage typically costs $5-20 per month.

## 📖 Detailed Usage Guide

### Spaced Repetition Algorithm

This plugin uses an improved SM2 algorithm with the following mechanism:

- **Initial Interval**: First review → 1 day later
- **Dynamic Adjustment**:
  - Correct → Interval × 2.5
  - Wrong → Interval reset to 1 day
  - Medium → Interval × 1.2

**Learning Curve Example**:
```
Day 1: Learn new card
Day 2: Review (1-day interval)
Day 5: Review (3-day interval)
Day 12: Review (7-day interval)
Day 31: Review (19-day interval)
... (interval keeps growing until mastery)
```

### Card Type Best Practices

#### 🎯 Concept Card
```
Q: What is spaced repetition?
A: Learning through strategic review at optimal time points 
   based on the forgetting curve, ensuring long-term retention.
```

#### 📐 Formula Card
```
Q: What is the area formula of a circle?
A: A = πr², where r is the radius of the circle.
```

#### ⚠️ Common Mistake Card
```
Q: Why is √4 = ±2 incorrect?
A: The √ symbol defines the non-negative square root, 
   so √4 = 2, not ±2. ±2 are the two solutions to x²=4.
```

### Batch Operations

#### Import Cards
1. Prepare CSV or JSON file (see format below)
2. Click **Import** in **Library** tab
3. Select file
4. Preview import content
5. Click **Confirm Import**

**CSV Format**:
```csv
Question,Answer,Category,Type
What is Git?,Distributed version control system,Programming,Concept Card
What is git init command?,git init,Programming,Formula Card
```

**JSON Format**:
```json
{
  "cards": [
    {
      "front": "What is Git?",
      "back": "Distributed version control system",
      "category": "Programming",
      "type": "Concept Card"
    }
  ]
}
```

#### Export Cards
1. Select cards in **Library** tab
2. Click **Export**
3. Choose format (CSV / JSON / Anki)
4. Auto download

### Anki Interoperability

While using independent interval algorithms, the plugin supports Anki data exchange:

1. Export `.apkg` file from Anki
2. **Import Anki Cards** in this plugin
3. Card progress reinitializes (using plugin's learning curve)
4. Export back auto-converts format

## 🔌 Dual Plugin Architecture

This project includes two plugins:

### 1. `ai-flashcards-native` (Main Plugin)
- **Functionality**: Complete AI flashcard system
- **UI Type**: Native dock panel + tabs
- **Recommendation**: All new users

### 2. `science-trainer-plugin` (Compatibility Shell)
- **Functionality**: Optimized for science subjects (Physics, Math, etc.)
- **Purpose**: Migration support, transitioning to main plugin
- **Status**: **Deprecated** (no longer maintained)

#### Why Two Plugins?

This is a **progressive architecture migration strategy**:

| Phase | Timeline | Status |
|-------|----------|--------|
| **Phase 1** | v0.1.0 | Both plugins active |
| **Phase 2** | v0.3.0 | Main plugin mature, shell stops updating |
| **Phase 3** | v1.0.0 | Complete deprecation of shell, user migration |

#### Migration Guide
If using `science-trainer-plugin`:

1. **Backup Data**:
   ```bash
   Export existing flashcards (CSV/JSON format)
   ```

2. **Install Main Plugin**:
   ```bash
   Follow installation steps above
   ```

3. **Import Data**:
   ```bash
   Import backed-up cards into ai-flashcards-native
   ```

4. **Uninstall Old Plugin** (optional):
   ```bash
   Disable science-trainer-plugin from plugin management
   ```

## 🛠️ Development Guide

### Project Structure
```
ai-flashcards-native/
├── index.js          # Core plugin code (5000+ lines)
├── index.css         # Stylesheet (1500+ lines)
├── plugin.json       # Plugin configuration
├── icon.png          # Plugin icon
├── README.md         # English documentation
├── README_zh_CN.md   # Chinese documentation
└── i18n/
    ├── en_US.json
    └── zh_CN.json
```

### Local Development

#### Requirements
- Node.js 14+
- SiYuan 3.6.4+
- Text Editor (VSCode recommended)

#### Development Workflow

1. **Clone Repository**:
   ```bash
   git clone https://github.com/tortletortle/a-better-flashcard-plugin-of-siyuan.git
   cd a-better-flashcard-plugin-of-siyuan
   ```

2. **Create Development Symlink**:
   ```bash
   # Windows
   mklink /D "C:\Users\{username}\AppData\Roaming\SiYuan\data\plugins\ai-flashcards-native" "path\to\repo\ai-flashcards-native"
   
   # macOS/Linux
   ln -s $(pwd)/ai-flashcards-native ~/Library/Application\ Support/SiYuan/data/plugins/
   ```

3. **Start Development**:
   - Modify code
   - Press `F5` in SiYuan to reload (or restart)
   - Open Developer Tools (F12) to check logs

### Contributing

Welcome to submit PRs and Issues!

#### Submitting Pull Requests
1. Fork the repository
2. Create feature branch: `git checkout -b feature/your-feature`
3. Commit changes: `git commit -m "Add your feature"`
4. Push to branch: `git push origin feature/your-feature`
5. Submit PR with description

#### Code Style
- Use ES6+ syntax
- Comments in English for external use, Chinese for internal
- Variable naming: camelCase (JS), kebab-case (CSS)
- Single line < 100 characters
- Run ESLint before committing

### Known Limitations

- 🎯 **Current Version (v0.1.0)** is beta, actively developing
- 📱 **Mobile Support** incomplete (desktop priority)
- 🌐 **Offline AI Models** require 8GB+ memory
- 📊 **Knowledge Graph** may slow down with 1000+ nodes

## ❓ FAQ

### Q1: Where is my flashcard data stored?
**A**: Card data stored in SiYuan local database:
- Windows: `%AppData%\SiYuan\data\`
- macOS: `~/Library/Application Support/SiYuan/data/`
- Linux: `~/.config/SiYuan/data/`

### Q2: How do I backup my learning progress?
**A**: 
1. Export cards as JSON or CSV
2. Backup entire `data` directory
3. Use SiYuan's built-in backup feature

### Q3: AI-generated cards have poor quality. What to do?
**A**: 
- Adjust API temperature parameter (lower for stability)
- Provide more detailed learning content
- Manually edit generated cards
- Try different AI models

### Q4: Does it support offline usage?
**A**: 
- Card review: ✅ Completely offline
- AI generation: ❌ Requires local LLM (Ollama)
- Knowledge graph: ✅ Completely offline

### Q5: Can I sync across multiple devices?
**A**: 
- Use SiYuan's built-in sync (requires cloud setup)
- Or manually export/import cards

## 📞 Get Help

- 📖 **Documentation**: See this README or visit [Wiki](https://github.com/tortletortle/a-better-flashcard-plugin-of-siyuan/wiki)
- 🐛 **Bug Reports**: [Submit Issue](https://github.com/tortletortle/a-better-flashcard-plugin-of-siyuan/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/tortletortle/a-better-flashcard-plugin-of-siyuan/discussions)
- 📧 **Feedback**: Via SiYuan built-in feedback

## 📝 Changelog

### v0.1.0 (2026-06-13) - Initial Release
- ✨ Core features completed
  - AI flashcard generation
  - Spaced repetition review
  - Knowledge graph visualization
  - Trainer immersive mode
- 🌍 English and Chinese localization
- 📚 Built-in learning content examples

### Planned Features
- 🎯 v0.2.0: Complete API docs + plugin extension system
- 🎯 v0.3.0: WebSocket sync + team collaboration
- 🎯 v1.0.0: Full stable version + extensive user testing

## 📄 License

MIT License - See [LICENSE](LICENSE) file

## 🙏 Acknowledgments

- Thanks to [SiYuan](https://b3log.org/siyuan/) for the excellent note-taking platform
- Thanks to OpenAI for GPT models
- Thanks to all contributors and users for feedback

---

**Start your efficient learning journey!** 🚀

For any questions or suggestions, please visit [GitHub](https://github.com/tortletortle/a-better-flashcard-plugin-of-siyuan).
