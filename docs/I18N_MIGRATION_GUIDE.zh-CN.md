# i18n-plus 插件国际化迁移指南

这份指南详细记录了如何将一个没有任何国际化支持的 Obsidian 插件（以 Dataview 为例）迁移到 `i18n-plus` 框架，实现全自动化、零运行依赖、支持热重载的国际化方案。

## 🎯 目标
- **零外部依赖**：插件本身不需要安装 `npm install i18n-plus`，仅粘贴一个 `i18n.ts` 文件即可。
- **自动化提取**：不再人工收集 Key，通过脚本扫描源码自动生成词典。
- **完整的开发体验**：支持导出内置词典已供翻译人员使用。

## 🛠️ 准备工作

确保你拥有以下脚本（通常位于 `obsidian-plugins-i18n-plus/scripts/`）：
1.  **Codemod 脚本** (`i18n-codemod.cjs`): 用于自动替换源码中的硬编码字符串。
2.  **Extractor 脚本** (`extract-keys.cjs`): 用于从源码中提取 Key 并生成 `en.ts`。

---

## 🚀 迁移流程 (The Golden Path)

### Step 1: 注入适配器 (Zero-Dependency Adapter)

在目标插件源码目录（如 `src/lang/`）创建 `i18n.ts`。这是一个**自包含**的适配器，负责：
- 充当 `i18n-plus` 的代理。
- 在 `i18n-plus` 未安装时直接返回英文 Key。
- 维护本地状态（当前语言、已加载词典）。

**关键代码参考**:
- 必须实现 `I18nAdapter` 类。
- 必须包含 `initI18n(plugin)` 函数。
- 必须在 `register` 中实现完整的 `getLocale`, `setLocale`, `loadDictionary` 逻辑。

> 💡 **AI 提示**: 复制最新的 `Dataview/src/lang/i18n.ts` 作为模板。它已经包含了状态管理逻辑。

### Step 2: 初始化插件 (Main Entry)

修改插件的入口文件（通常是 `main.ts`）：

1.  **引入适配器**:
    ```typescript
    import { initI18n } from './lang/i18n';
    ```

2.  **初始化**:
    在 `onload()` 方法的最开始：
    ```typescript
    this.i18n = initI18n(this);
    this.t = this.i18n.t; // 挂载快捷方法
    ```

3.  **声明类型**:
    在 `Plugin` 类声明中添加：
    ```typescript
    i18n: any;
    t: (key: string, params?: any) => string;
    ```

### Step 3: 自动化代码转换 (Codemod)

运行 `jscodeshift` 脚本，将源码中的 `"Hello"` 自动替换为 `this.t("Hello")`。

```bash
# 在 i18n-plus 项目根目录运行
npx jscodeshift -t scripts/i18n-codemod.cjs <目标插件路径>/src/main.ts --parser=ts
```

> ⚠️ **注意**: Codemod 只能处理常见的 UI 方法（如 `setText`, `setDesc`, `Notice`）。它通过 `flattenBinaryString` 支持简单的字符串拼接（`"A" + "B"`），但无法处理复杂的逻辑。

### Step 4: 静态 Key 提取 (Static Extraction)

运行提取脚本，扫描所有 `t("Key")` 调用，生成默认词典。

```bash
# 在目标插件根目录运行
node <路径>/extract-keys.cjs src
```

这将生成 `src/lang/locales/en.ts`。
**重要**: 修改适配器 `i18n.ts`，使其静态 import 这个 `en.ts` 并在 `getDictionary('en')` 时返回它。这保证了即使用户没有打开任何翻译，插件也能导出完整的英文词典。

### Step 5: 构建与导出

1.  **构建插件**: `npm run build`。
2.  **重载插件**: 在 Obsidian 中重载插件。
3.  **导出词典**: 打开 `i18n-plus` 设置 -> 词典管理器 -> 找到插件 -> 点击导出 (en)。
    *   此时你应该能得到一个 `pluginid.en.json`，包含了所有提取到的 Key。

---

## ⚙️ 配置选项

适配器在 `adapter.ts` 顶部的配置区域提供了多个可配置选项：

### 内置语言

在 `BUILTIN_LOCALES` 对象中添加你的内置语言：

```typescript
const BUILTIN_LOCALES: Record<string, Record<string, string>> = {
    'en': en,
    'zh': zh,      // 简体中文
    'ja': ja,      // 日语
};
```

> **重要**：请使用 Obsidian 标准语言代码（如简体中文用 `zh` 而非 `zh-CN`）。完整列表见 `src/framework/locales.ts`。

### 基础语言（回退语言）

通过修改 `BASE_LOCALE` 配置最终回退语言：

```typescript
// 最终回退的基础语言（由插件开发者配置）
const BASE_LOCALE = 'en';  // 如果你的插件面向中文用户，可以改为 'zh'
```

此语言在以下情况使用：
1. 当前语言没有某个 key 的翻译
2. 上一个成功语言也没有该翻译

### 智能回退系统

适配器使用 5 级回退优先级：

1. **外部词典**（通过 I18n Plus 加载）
2. **内置语言**（当前语言）
3. **上一个成功语言**（自动追踪）
4. **基础语言**（上面配置的）
5. **原始 Key**

**示例场景**：
- 插件内置：`en`、`zh`
- 用户 Obsidian 使用中文 → 自动使用 `zh`
- 用户通过 I18n Plus 导入日语词典
- 日语词典缺少部分 key → 回退到 `zh`（而非硬编码的英文！）

---

## 🧩 手动修复 (The "Human in the Loop")

Codemod 并非万能。以下情况需要人工（或 AI）介入：

### 1. 动态插值 (Interpolation)
**现象**: 代码如 `DateTime.now().toFormat(...)` 无法被静态提取。
**修复**:
- **源码修改**:
  ```typescript
  // Before
  .setDesc("Time: " + DateTime.now())
  
  // After
  .setDesc(this.t("Time: {time}", { time: DateTime.now() }))
  ```
- **重新提取**: 运行 `extract-keys.cjs`。

### 2. 数组中的字符串
**现象**: `let lines = ["Line 1", "Line 2"]`。
**修复**:
  虽然 Codemod 不会处理数组，但你可以手动包裹：
  ```typescript
  let lines = [this.t("Line 1"), this.t("Line 2")]
  ```
  这样 `extract-keys.cjs` 依然能通过正则找到它们。

### 3. 链接与复杂 DOM
**现象**: `createFragment` 中混合了 `appendText` 和 `createEl('a')`。
**策略**:
  拆分为多个 Key 翻译，或者重构为 innerHTML（不推荐）。通常将其拆分为碎片化的 Key（"Click ", "here", " for more"）是可以接受的。

---

## 🌍 翻译与验证流程

1.  **准备翻译文件**: 复制导出的 `en.json`，重命名为 `zh-CN.json`（或其他语言）。
2.  **修改 Metadata**: 确保 `$meta.locale` 设置为 `zh-CN`。
3.  **翻译**: 将 Value 翻译为中文。
    *   注意保留插值占位符 `{date}`。
4.  **导入测试**:
    *   在 `i18n-plus` 中导入该 JSON。
    *   **验证**: 插件界面是否变为中文？
    *   **验证**: 切换语言是否即时生效？（依赖适配器中的 `setLocale` 实现）。

---

## 🤖 AI 协作 Prompt 建议

如果你让 AI 帮你做这件事，可以使用以下 Prompt：

> "请帮我把 [插件名] 接入 i18n-plus。
> 1. 请先读取最新的 `obsidian-dataview/src/lang/i18n.ts` 作为适配器模板。
> 2. 帮我修改 `main.ts` 初始化适配器。
> 3. 运行 Codemod 替换字符串。
> 4. 手动检查并修复 Codemod 遗漏的动态字符串（使用 parameterized t function）。
> 5. 运行 Extractor 生成 en.ts。
> 6. 最终生成一份 zh-CN.json 给我。"


---

## ⚡ 进阶：GitHub Action 自动化迁移

我们提供了一套自动化方案，你可以通过 Fork 仓库并运行 GitHub Action 来完成 90% 的迁移工作。

### 准备工作

1.  **Fork** 目标插件仓库。
2.  将 [`templates/auto-migrate-workflow.yml`](../templates/auto-migrate-workflow.yml) 复制到你仓库的 `.github/workflows/i18n-migrate.yml`。
3.  **配置 GitHub Actions 权限**：
    - 进入仓库 **Settings → Actions → General**
    - 在 **Workflow permissions** 下选择 **Read and write permissions**
    - 勾选 **Allow GitHub Actions to create and approve pull requests**
    - 点击 **Save**

> **注意**：始终参考仓库中的最新工作流文件，本文档可能滞后。

### 工作原理

1.  **Inject Script (`inject-i18n.cjs`)**:
    *   自动解析 `main.ts` AST。
    *   注入 `import { initI18n }`。
    *   在类中添加 `i18n` 和 `t` 属性。
    *   在 `onload()` 方法首行插入初始化代码。
2.  **Codemod Script**: 转换 `src/` 下的所有硬编码字符串。
3.  **Create PR**: 将所有更改提交为一个 Pull Request，方便你进行最终的人工审查。

---

此指南由 Antigravity 总结于 Dataview 汉化实战。
