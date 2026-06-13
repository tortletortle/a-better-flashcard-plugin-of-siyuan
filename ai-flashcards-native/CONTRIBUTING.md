# 贡献指南 / Contributing Guide

感谢你对 AI Flashcards Native 插件的关注！我们欢迎所有形式的贡献。

## 🚀 快速开始

### 环境要求
- Node.js 14+
- SiYuan 笔记 3.6.4+
- Git

### 开发环境设置

1. **Fork 本仓库**
   - 在 GitHub 上点击 Fork

2. **克隆你的 Fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/a-better-flashcard-plugin-of-siyuan.git
   cd a-better-flashcard-plugin-of-siyuan/ai-flashcards-native
   ```

3. **安装依赖**
   ```bash
   npm install
   ```

4. **创建符号链接到思源插件目录**

   **Windows (管理员 PowerShell)**:
   ```powershell
   mklink /D "$env:APPDATA\SiYuan\data\plugins\ai-flashcards-native" "path\to\repo\ai-flashcards-native"
   ```

   **macOS**:
   ```bash
   ln -s $(pwd) ~/Library/Application\ Support/SiYuan/data/plugins/ai-flashcards-native
   ```

   **Linux**:
   ```bash
   ln -s $(pwd) ~/.config/SiYuan/data/plugins/ai-flashcards-native
   ```

5. **开始开发**
   - 修改代码后，在思源中按 `F5` 刷新
   - 打开开发者工具（F12）查看控制台日志

## 📝 代码规范

### JavaScript
- 使用 ES6+ 语法
- 优先使用 `const`，其次 `let`
- 变量和函数命名使用 camelCase
- 单行不超过 100 字符
- 提交前运行 `npm run lint`

### CSS
- 使用 `aiflash-` 前缀避免冲突
- 优先使用思源 CSS 变量（`--b3-theme-*`）
- 类名使用 kebab-case

### 国际化
- 用户可见的字符串必须走 i18n
- 开发内部日志可以用中文
- 添加新功能时同时更新 `en_US.json` 和 `zh_CN.json`

## 🔀 提交 Pull Request

### 工作流程

1. **创建分支**
   ```bash
   git checkout -b feature/your-feature-name
   # 或
   git checkout -b fix/your-fix-name
   ```

2. **进行更改**
   - 保持改动范围尽量小
   - 一次 PR 只做一件事

3. **提交代码**
   ```bash
   git add .
   git commit -m "feat: add new feature"
   git push origin feature/your-feature-name
   ```

   **提交信息格式**（推荐）：
   - `feat:` 新功能
   - `fix:` 修复 Bug
   - `docs:` 文档更新
   - `style:` 代码格式
   - `refactor:` 重构
   - `test:` 测试
   - `chore:` 构建/工具

4. **提交 PR**
   - 在 GitHub 上创建 Pull Request
   - 填写清晰的描述
   - 关联相关的 Issue（如果有）

## 🐛 报告 Bug

提交 Issue 时请提供：
- SiYuan 版本
- 插件版本
- 操作系统
- 复现步骤
- 预期行为 vs 实际行为
- 控制台错误（如果有）

## 💡 建议新功能

在提交 Issue 前请检查：
- 是否已有类似的 Issue
- 是否符合项目的核心功能定位
- 是否可以通过配置实现而不需要改代码

## 📋 检查清单

提交 PR 前请确认：
- [ ] 代码符合项目规范
- [ ] 新功能有对应的文档更新
- [ ] 中英文 i18n 都已更新
- [ ] 没有引入新的 console 错误
- [ ] 测试了桌面端和移动端（如适用）

## ❓ 有问题？

- 查看 [README_zh_CN.md](./README_zh_CN.md) 了解完整功能
- 在 [Discussions](https://github.com/tortletortle/a-better-flashcard-plugin-of-siyuan/discussions) 讨论
