# i18n+

[![GitHub release](https://img.shields.io/github/v/release/dangehub/obsidian-plugins-i18n-plus)](https://github.com/dangehub/obsidian-plugins-i18n-plus/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[English](../README.md)

为 Obsidian 插件生态提供的通用国际化 (i18n) 框架。提供零依赖适配器、自动化迁移工具和无缝多语言支持。

## ✨ 特性

- **零运行时依赖**：即使不安装 I18n Plus，插件也能正常工作
- **独立 + 混合模式**：内置语言独立运行；外部词典可覆盖/扩展内置语言
- **自动化迁移**：一条命令将硬编码字符串转换为 `t()` 调用
- **热重载**：无需重启插件即可切换语言
- **社区翻译**：用户可导入第三方翻译，无需修改代码

## 🚀 快速开始

> **插件开发者**：请查看完整的 [迁移指南](I18N_MIGRATION_GUIDE.zh-CN.md) 获取详细集成说明。

### 插件开发者

1. **复制适配器**到你的插件：
   ```bash
   cp templates/adapter.ts your-plugin/src/lang/i18n.ts
   ```

2. **在 main.ts 中初始化**：
   ```typescript
   import { initI18n } from './lang/i18n';
   
   export default class MyPlugin extends Plugin {
       i18n: I18nAdapter;
       t: (key: string, params?: any) => string;
       
       async onload() {
           this.i18n = initI18n(this);
           this.t = this.i18n.t.bind(this.i18n);
       }
   }
   ```

3. **使用翻译**：
   ```typescript
   new Notice(this.t("你好，{name}！", { name: "世界" }));
   ```

### 自动化迁移

运行 codemod 自动替换硬编码字符串：

```bash
# 安装 jscodeshift
npm install -g jscodeshift

# 在你的插件上运行 codemod
npx jscodeshift -t scripts/i18n-codemod.cjs your-plugin/src/ --parser=ts

# 提取 key 生成 en.ts
node scripts/extract-keys.cjs your-plugin/src
```

## 📦 工作原理

### 优先级系统

当调用 `t("key")` 时，适配器按以下顺序搜索：

1. **外部词典**（通过 I18n Plus 加载）
2. **内置语言**（当前语言）
3. **上一个成功语言**（智能回退到之前正常工作的语言）
4. **基础语言**（可配置，默认为英文）
5. **原始 Key**

这意味着：
- 用户可以用自定义 JSON 文件覆盖内置翻译
- 无需修改插件代码即可添加新语言
- 如果新语言加载失败，会回退到上一个使用的语言（而非硬编码英文）
- 不安装 I18n Plus 也能离线使用

### 架构

```
┌─────────────────────────────────────────────────────────┐
│                     你的插件                              │
│  ┌─────────────────────────────────────────────────┐    │
│  │  adapter.ts（自包含，约 150 行）                    │    │
│  │  ├── BUILTIN_LOCALES: { en, zh, ... }           │    │
│  │  └── _externalDictionaries: { de, fr, ... }     │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                          ▲
                          │（可选）
                          ▼
┌─────────────────────────────────────────────────────────┐
│               I18n Plus 插件（可选）                      │
│  ├── 词典管理器 UI                                       │
│  ├── 全局语言同步                                        │
│  └── 外部 .json 导入/导出                                │
└─────────────────────────────────────────────────────────┘
```

## 🛠️ 脚本工具

| 脚本 | 描述 |
|------|------|
| `i18n-codemod.cjs` | 将硬编码字符串转换为 `t()` 调用 |
| `extract-keys.cjs` | 提取所有 key 并生成 `en.ts` |
| `inject-i18n.cjs` | 自动注入适配器到 `main.ts` |
| `generate-report.cjs` | 生成迁移报告 |

## 📁 项目结构

```
templates/
  └── adapter.ts          # 复制此文件到你的插件
scripts/
  ├── i18n-codemod.cjs    # 字符串替换 codemod
  ├── extract-keys.cjs    # Key 提取脚本
  └── inject-i18n.cjs     # 自动注入脚本
examples/
  └── auto-migrate-workflow.yml  # GitHub Action 模板
docs/
  ├── README.zh-CN.md     # 中文文档
  └── I18N_MIGRATION_GUIDE.zh-CN.md  # 迁移指南
```

## 🚨 Vibe Coding Warning

本项目使用了Vibe Coding，我已尽我所能确保代码的可靠性。但如果你感到介意，请不要使用本项目。

## 🤝 贡献

欢迎贡献！请随时提交 Pull Request。

## 📄 许可证

MIT 许可证 - 详见 [LICENSE](../LICENSE)。
