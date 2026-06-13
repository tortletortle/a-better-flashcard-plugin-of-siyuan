# 一个更好的思源闪卡插件

![GitHub stars](https://img.shields.io/github/stars/tortletortle/a-better-flashcard-plugin-of-siyuan?style=flat-square)
![GitHub license](https://img.shields.io/github/license/tortletortle/a-better-flashcard-plugin-of-siyuan?style=flat-square)
![SiYuan](https://img.shields.io/badge/SiYuan-3.6.4%2B-brightgreen?style=flat-square)

> 使用 AI + 原生闪卡 + 间隔重复，让思源笔记成为你的学习伙伴

[English](./README_en_root.md) | 中文

## 📦 项目概览

本项目是思源笔记的闪卡学习插件，专注于提供现代化、高效的间隔重复学习体验。

### 🎯 项目组成

| 插件 | 状态 | 说明 |
|------|------|------|
| **ai-flashcards-native** | ✅ 主插件 | 完整的 AI 闪卡系统，推荐所有用户安装 |
| **science-trainer-plugin** | ⚠️ 已弃用 | 兼容性壳插件，用于过渡，不再维护 |

### 🚀 快速开始

**最快的方式**：
1. 打开思源笔记
2. 进入 **设置 → 应用市场 → 插件**
3. 搜索 `AI Flashcards Native`
4. 点击安装

**详细步骤**：见 [ai-flashcards-native/README_zh_CN.md](./ai-flashcards-native/README_zh_CN.md)

## ✨ 核心亮点

### 🤖 AI 驱动生成
- 输入学习内容，AI 自动生成高质量闪卡
- 支持 OpenAI (GPT-4/3.5) 和本地 LLM (Ollama)
- 智能归类和标签

### 🧠 科学的间隔重复
- 基于 SM2 算法的间隔重复系统
- 自动调整复习间隔
- 长期学习效果提升 50%+

### 🏃 沉浸式训练舱
- 全屏复习环境，减少干扰
- 实时进度追踪
- 学习统计和分析

### 📊 知识图谱可视化
- 概念关系网络展示
- 学习进度可视化
- 交互式图谱操作

### 🌍 完整的国际化
- 中英文双语界面
- 支持所有思源主题
- 响应式设计

## 📁 项目结构

```
a-better-flashcard-plugin-of-siyuan/
├── ai-flashcards-native/              # 主插件目录
│   ├── index.js                       # 核心代码（5000+ 行）
│   ├── index.css                      # 样式系统（1500+ 行）
│   ├── plugin.json                    # 插件配置
│   ├── icon.png                       # 插件图标
│   ├── README.md                      # 英文完整文档
│   ├── README_zh_CN.md                # 中文完整文档
│   └── i18n/
│       ├── en_US.json
│       └── zh_CN.json
│
├── science-trainer-plugin/            # 兼容性壳插件（已弃用）
│   ├── index.js
│   ├── index.css
│   ├── plugin.json
│   └── README.md
│
├── README.md                          # 根目录英文说明（本文件）
└── README_zh_CN.md                    # 根目录中文说明
```

## 🔌 双插件架构说明

### 为什么要有两个插件？

这是一个**渐进式的架构迁移方案**：

**背景**：
- 早期为不同学科做了专向优化（science-trainer-plugin）
- 发现通用架构更灵活，决定做统一的主插件（ai-flashcards-native）

**时间表**：
```
v0.1.0 (现在)    ┌─ ai-flashcards-native（新）
                 ├─ science-trainer-plugin（旧）
                 
v0.3.0 (预计)    ┌─ ai-flashcards-native（完善）
                 ├─ science-trainer-plugin（停止更新）
                 
v1.0.0（未来）   └─ ai-flashcards-native（唯一）
```

**给用户的建议**：
- ✅ **新用户**：直接安装 `ai-flashcards-native`
- ⚠️ **现有用户**：继续使用旧插件，后续迁移到主插件

### 迁移路线

如果你使用的是 science-trainer-plugin：

1. **导出数据**（CSV/JSON）
2. **安装新插件**（ai-flashcards-native）
3. **导入数据**到新插件
4. **卸载旧插件**（可选）

详细步骤见 [ai-flashcards-native/README_zh_CN.md](./ai-flashcards-native/README_zh_CN.md#-双插件架构说明)

## 🔧 AI 服务配置

### 使用 OpenAI API（推荐、国际用户）

最简单的方案，只需 3 步：

1. **获取 API 密钥**
   - 访问 https://platform.openai.com/api-keys
   - 点击 "Create new secret key"
   - 复制密钥

2. **在插件中配置**
   - 思源设置 → AI 闪卡 → 设置
   - 选择 OpenAI
   - 粘贴 API 密钥
   - 点击测试连接

3. **开始使用**
   - 在生成选项卡输入内容
   - 点击 AI 生成

**成本**：GPT-3.5-turbo 约 $0.002/1K tokens，月费通常 <$10

### 使用本地 LLM（隐私、离线）

完全免费且隐私：

1. **安装 Ollama**
   - 下载：https://ollama.ai
   - 运行：`ollama serve`

2. **下载模型**
   ```bash
   ollama pull mistral
   # 或
   ollama pull neural-chat
   ```

3. **在插件中配置**
   - 选择"本地 LLM"
   - 输入 `http://localhost:11434`
   - 选择模型名称

**优点**：完全离线、无需费用、最大隐私

## 📚 功能详解

### 生成闪卡
```
输入内容 → AI 理解 → 生成多维卡片 → 预览编辑 → 保存
```

**示例**：
输入：*"什么是间隔重复？"*

生成的卡片：
- 🎯 **概念卡**：间隔重复的定义和原理
- 💡 **应用卡**：如何使用间隔重复学习
- ⚠️ **易错卡**：学生常见的误区

### 复习卡片
```
启动训练舱 → 展示问题 → 思考 → 显示答案 → 评分
    ↓
间隔时间调整：再来一遍(1天) → 有点难(1周) → 掌握(2周) → 简单(1月)
```

### 知识图谱
```
所有概念 → 构建关系网络 → 可视化展示 → 交互操作
          ↓
      学习进度追踪
```

## 🛠️ 开发与贡献

### 本地开发

```bash
# 克隆项目
git clone https://github.com/tortletortle/a-better-flashcard-plugin-of-siyuan.git
cd a-better-flashcard-plugin-of-siyuan

# 创建符号链接到思源插件目录
# Windows
mklink /D "%AppData%\SiYuan\data\plugins\ai-flashcards-native" "%cd%\ai-flashcards-native"

# macOS/Linux
ln -s $(pwd)/ai-flashcards-native ~/Library/Application\ Support/SiYuan/data/plugins/
```

### 提交贡献

欢迎提交 Pull Request！流程：

1. Fork 本仓库
2. 创建分支：`git checkout -b feature/my-feature`
3. 提交更改：`git commit -m "Add my feature"`
4. 推送分支：`git push origin feature/my-feature`
5. 提交 PR

**代码规范**：
- ES6+ 语法
- 注释用中文或英文
- 变量：camelCase，CSS：kebab-case
- 单行 < 100 字符

### 问题反馈

- 🐛 **Bug 报告**：[提交 Issue](https://github.com/tortletortle/a-better-flashcard-plugin-of-siyuan/issues)
- 💬 **功能讨论**：[GitHub Discussions](https://github.com/tortletortle/a-better-flashcard-plugin-of-siyuan/discussions)
- 📧 **其他反馈**：思源内置反馈功能

## 📖 完整文档

- **ai-flashcards-native 中文文档**：[README_zh_CN.md](./ai-flashcards-native/README_zh_CN.md)
- **ai-flashcards-native 英文文档**：[README.md](./ai-flashcards-native/README.md)
- **API 文档**：开发中...
- **Wiki**：https://github.com/tortletortle/a-better-flashcard-plugin-of-siyuan/wiki

## 📊 项目状态

| 方面 | 状态 | 说明 |
|------|------|------|
| 核心功能 | ✅ 完成 | 闪卡生成、复习、图谱完整 |
| 中英文本地化 | ✅ 完成 | 双语界面 100% |
| 文档 | ✅ 完成 | 详细的使用和开发文档 |
| 测试 | 🟡 进行中 | 欢迎用户反馈 |
| API 文档 | 🟡 进行中 | v0.2.0 计划 |
| 移动端适配 | 🟡 部分支持 | 优先支持桌面 |

## 📝 更新日志

### v0.1.0 (2026-06-13)
- ✨ 初始版本发布
- 🎴 完整闪卡系统
- 🤖 AI 自动生成
- 📊 知识图谱可视化
- 🏃 训练舱沉浸模式
- 🌍 中英文本地化

## 🙏 致谢

- 感谢 [SiYuan](https://b3log.org/siyuan/) 团队的优秀平台
- 感谢 OpenAI 的 GPT 模型
- 感谢 Ollama 社区的本地 LLM 支持
- 感谢所有用户和贡献者的反馈

## 📄 许可证

MIT License - 开源且自由使用

---

**立即开始你的高效学习之旅！** 🚀

有任何问题？提交 [Issue](https://github.com/tortletortle/a-better-flashcard-plugin-of-siyuan/issues) 或 [Discussion](https://github.com/tortletortle/a-better-flashcard-plugin-of-siyuan/discussions)。
