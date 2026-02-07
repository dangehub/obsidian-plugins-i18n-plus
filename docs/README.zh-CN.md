# i18n+

[![GitHub release](https://img.shields.io/github/v/release/dangehub/obsidian-plugins-i18n-plus)](https://github.com/dangehub/obsidian-plugins-i18n-plus/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[English](../README.md)

**I18n Plus** 是一个强大的 Obsidian 国际化 (i18n) 管理插件，同时也是插件生态的通用开发框架。

对于 **普通用户**，它是一个直观的翻译管理工具，让你轻松汉化/修正插件翻译；
对于 **开发者**，它提供了零依赖的 i18n 适配器和自动化迁移工具。

> **阅读白皮书**：深入了解 Obsidian 第三方生态国际化的理念、架构与未来路线图，请阅读 [白皮书](WHITEPAPER.zh-CN.md)。

## 特性

### 对于用户
- **可视化管理**：在统一的面板中查看和管理所有插件的翻译状态
- **热重载**：切换插件语言无需重启 Obsidian，即时生效
- **增量汉化**：通过 "覆盖 (Overlay)" 模式，仅修改不满意的译文，而不影响原插件
- **社区共享**：支持导入/导出 `.json` 翻译文件，方便在社区分享汉化包
- **云端同步**：从云端直接下载最新的社区翻译包

### 对于开发者
- **零运行时依赖**：即使不安装 I18n Plus，插件也能正常工作
- **独立 + 混合模式**：内置语言独立运行；外部词典可覆盖/扩展内置语言
- **自动化迁移**：一条命令将硬编码字符串转换为 `t()` 调用
- **类型安全**：基于 TypeScript 的智能提示

## 快速开始

### 普通用户

1. **安装插件**：在 Obsidian 社区插件中搜索并安装 `i18n-plus`。
2. **打开管理器**：点击左侧边栏的 `🌐` 图标，或使用命令 `Open Dictionary Manager`。
3. **切换语言**：
   - 在列表中找到目标插件
   - 在下拉菜单中选择 `zh` 或其他语言
   - 界面将立即更新（支持热重载的插件）
4. **修正翻译**：
   - 点击插件旁的 `👁️` (查看内容) 按钮
   - 在编辑器中修改译文
   - 点击 `Save` 保存，修改即刻生效

---

### 插件开发者

> 请查看完整的 [迁移指南](I18N_MIGRATION_GUIDE.zh-CN.md) 获取详细集成说明。

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

## 工作原理

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

## 脚本工具

| 脚本 | 描述 |
|------|------|
| `i18n-codemod.cjs` | 将硬编码字符串转换为 `t()` 调用 |
| `extract-keys.cjs` | 提取所有 key 并生成 `en.ts` |
| `inject-i18n.cjs` | 自动注入适配器到 `main.ts` |
| `generate-report.cjs` | 生成迁移报告 |

## 开发

### 可用命令

| 命令 | 描述 |
|------|------|
| `npm run dev` | 启动开发模式（热重载） |
| `npm run build` | 构建插件（输出到项目根目录） |
| `npm run deploy` | 构建并复制到 Obsidian 测试库 |
| `npm run lint` | 运行 ESLint 检查 |

### 部署到测试库

`deploy` 命令会自动将构建产物复制到你本地的 Obsidian 库中进行测试。

**配置步骤：**

1. 在项目根目录创建 `deploy.config.local.json`：
   ```json
   {
       "targetDir": "C:\\你的路径\\.obsidian\\plugins\\i18n-plus"
   }
   ```

2. 运行：
   ```bash
   npm run deploy
   ```

> **注意**：`deploy.config.local.json` 已加入 gitignore，你的本地路径不会被上传。

## 项目结构

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

## Vibe Coding Warning

本项目使用了Vibe Coding，我已尽我所能确保代码的可靠性。但如果你感到介意，请不要使用本项目。

## 贡献

欢迎贡献！请随时提交 Pull Request。

## 许可证

MIT 许可证 - 详见 [LICENSE](../LICENSE)。
