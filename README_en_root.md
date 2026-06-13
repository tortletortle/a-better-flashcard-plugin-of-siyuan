# A Better Flashcard Plugin for SiYuan

![GitHub stars](https://img.shields.io/github/stars/tortletortle/a-better-flashcard-plugin-of-siyuan?style=flat-square)
![GitHub license](https://img.shields.io/github/license/tortletortle/a-better-flashcard-plugin-of-siyuan?style=flat-square)
![SiYuan](https://img.shields.io/badge/SiYuan-3.6.4%2B-brightgreen?style=flat-square)

> AI-powered flashcards + native spaced repetition = your ultimate learning companion for SiYuan

[中文](./README_cn_root.md) | English

## 📦 Project Overview

A flashcard learning plugin for SiYuan Notes, focused on modern and efficient spaced repetition learning experience.

### 🎯 Project Components

| Plugin | Status | Description |
|--------|--------|-------------|
| **ai-flashcards-native** | ✅ Main | Complete AI flashcard system, recommended for all users |
| **science-trainer-plugin** | ⚠️ Deprecated | Compatibility shell for transition, no longer maintained |

### 🚀 Quick Start

**Fastest way**:
1. Open SiYuan Notes
2. Go to **Settings → App Store → Plugins**
3. Search for `AI Flashcards Native`
4. Click Install

**Detailed steps**: See [ai-flashcards-native/README.md](./ai-flashcards-native/README.md)

## ✨ Key Highlights

### 🤖 AI-Powered Generation
- Input learning content, AI auto-generates high-quality flashcards
- Support OpenAI (GPT-4/3.5) and local LLM (Ollama)
- Smart categorization and tagging

### 🧠 Scientific Spaced Repetition
- SM2 algorithm-based interval spacing
- Automatic review interval adjustment
- 50%+ improvement in long-term learning results

### 🏃 Immersive Trainer Mode
- Full-screen review environment for minimal distraction
- Real-time progress tracking
- Learning statistics and analytics

### 📊 Knowledge Graph Visualization
- Concept relationship network visualization
- Learning progress tracking
- Interactive graph manipulation

### 🌍 Complete Internationalization
- English and Chinese bilingual interface
- Support for all SiYuan themes
- Responsive design

## 📁 Project Structure

```
a-better-flashcard-plugin-of-siyuan/
├── ai-flashcards-native/              # Main plugin directory
│   ├── index.js                       # Core code (5000+ lines)
│   ├── index.css                      # Style system (1500+ lines)
│   ├── plugin.json                    # Plugin configuration
│   ├── icon.png                       # Plugin icon
│   ├── README.md                      # Complete English docs
│   ├── README_zh_CN.md                # Complete Chinese docs
│   └── i18n/
│       ├── en_US.json
│       └── zh_CN.json
│
├── science-trainer-plugin/            # Compatibility shell (deprecated)
│   ├── index.js
│   ├── index.css
│   ├── plugin.json
│   └── README.md
│
├── README.md                          # Root English README
└── README_zh_CN.md                    # Root Chinese README
```

## 🔌 Dual Plugin Architecture

### Why Two Plugins?

This is a **progressive architecture migration strategy**:

**Background**:
- Early versions had specialized plugins for different subjects (science-trainer-plugin)
- Found that unified architecture is more flexible, decided to build a universal main plugin (ai-flashcards-native)

**Timeline**:
```
v0.1.0 (Now)     ┌─ ai-flashcards-native (New)
                 ├─ science-trainer-plugin (Old)
                 
v0.3.0 (Planned) ┌─ ai-flashcards-native (Mature)
                 ├─ science-trainer-plugin (No updates)
                 
v1.0.0 (Future)  └─ ai-flashcards-native (Only one)
```

**Recommendations**:
- ✅ **New Users**: Install `ai-flashcards-native` directly
- ⚠️ **Existing Users**: Continue using old plugin, migrate later

### Migration Path

If you're using science-trainer-plugin:

1. **Export Data** (CSV/JSON)
2. **Install New Plugin** (ai-flashcards-native)
3. **Import Data** into new plugin
4. **Uninstall Old Plugin** (optional)

Detailed steps: [ai-flashcards-native/README.md](./ai-flashcards-native/README.md#-dual-plugin-architecture)

## 🔧 AI Service Configuration

### Using OpenAI API (Recommended, International Users)

Simplest option, 3 steps:

1. **Get API Key**
   - Visit https://platform.openai.com/api-keys
   - Click "Create new secret key"
   - Copy the key

2. **Configure in Plugin**
   - SiYuan Settings → AI Flashcards → Settings
   - Select OpenAI
   - Paste API key
   - Click Test Connection

3. **Start Using**
   - Input content in Generation tab
   - Click Generate with AI

**Cost**: GPT-3.5-turbo ~$0.002/1K tokens, monthly ~<$10

### Using Local LLM (Privacy, Offline)

Completely free and private:

1. **Install Ollama**
   - Download: https://ollama.ai
   - Run: `ollama serve`

2. **Download Model**
   ```bash
   ollama pull mistral
   # or
   ollama pull neural-chat
   ```

3. **Configure in Plugin**
   - Select "Local LLM"
   - Enter `http://localhost:11434`
   - Select model name

**Advantages**: Completely offline, free, maximum privacy

## 📚 Feature Details

### Generate Flashcards
```
Input content → AI understanding → Generate multi-dimensional cards → Preview → Save
```

**Example**:
Input: *"What is spaced repetition?"*

Generated cards:
- 🎯 **Concept Card**: Definition and principles
- 💡 **Application Card**: How to use spaced repetition
- ⚠️ **Mistake Card**: Common student misconceptions

### Review Flashcards
```
Start Trainer → Show question → Think → Show answer → Grade
    ↓
Adjust interval: Again(1d) → Hard(1w) → Good(2w) → Easy(1m)
```

### Knowledge Graph
```
All concepts → Build relationship network → Visualize → Interact
        ↓
    Track learning progress
```

## 🛠️ Development & Contribution

### Local Development

```bash
# Clone project
git clone https://github.com/tortletortle/a-better-flashcard-plugin-of-siyuan.git
cd a-better-flashcard-plugin-of-siyuan

# Create symlink to SiYuan plugins directory
# Windows
mklink /D "%AppData%\SiYuan\data\plugins\ai-flashcards-native" "%cd%\ai-flashcards-native"

# macOS/Linux
ln -s $(pwd)/ai-flashcards-native ~/Library/Application\ Support/SiYuan/data/plugins/
```

### Submit Contributions

Pull requests welcome! Process:

1. Fork the repository
2. Create branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -m "Add my feature"`
4. Push branch: `git push origin feature/my-feature`
5. Submit PR

**Code Standards**:
- ES6+ syntax
- Comments in English or Chinese
- Variables: camelCase, CSS: kebab-case
- Single line < 100 characters

### Report Issues

- 🐛 **Bug Reports**: [Submit Issue](https://github.com/tortletortle/a-better-flashcard-plugin-of-siyuan/issues)
- 💬 **Feature Discussions**: [GitHub Discussions](https://github.com/tortletortle/a-better-flashcard-plugin-of-siyuan/discussions)
- 📧 **Other Feedback**: SiYuan built-in feedback

## 📖 Complete Documentation

- **ai-flashcards-native English Docs**: [README.md](./ai-flashcards-native/README.md)
- **ai-flashcards-native Chinese Docs**: [README_zh_CN.md](./ai-flashcards-native/README_zh_CN.md)
- **API Documentation**: Coming in v0.2.0...
- **Wiki**: https://github.com/tortletortle/a-better-flashcard-plugin-of-siyuan/wiki

## 📊 Project Status

| Aspect | Status | Notes |
|--------|--------|-------|
| Core Features | ✅ Complete | Flashcard generation, review, graph complete |
| English/Chinese Localization | ✅ Complete | 100% bilingual interface |
| Documentation | ✅ Complete | Detailed usage and development docs |
| Testing | 🟡 In Progress | User feedback welcome |
| API Documentation | 🟡 In Progress | Planned for v0.2.0 |
| Mobile Support | 🟡 Partial | Desktop priority |

## 📝 Changelog

### v0.1.0 (2026-06-13)
- ✨ Initial release
- 🎴 Complete flashcard system
- 🤖 AI auto-generation
- 📊 Knowledge graph visualization
- 🏃 Trainer immersive mode
- 🌍 English and Chinese localization

## 🙏 Acknowledgments

- Thanks to [SiYuan](https://b3log.org/siyuan/) team for the excellent platform
- Thanks to OpenAI for GPT models
- Thanks to Ollama community for local LLM support
- Thanks to all users and contributors for feedback

## 📄 License

MIT License - Open source and free to use

---

**Start your efficient learning journey now!** 🚀

Have questions? Submit an [Issue](https://github.com/tortletortle/a-better-flashcard-plugin-of-siyuan/issues) or [Discussion](https://github.com/tortletortle/a-better-flashcard-plugin-of-siyuan/discussions).
