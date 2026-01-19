# i18n-plus Plugin Internationalization Migration Guide

This guide details how to migrate an Obsidian plugin without any internationalization support (using Dataview as an example) to the `i18n-plus` framework, achieving a fully automated, zero-runtime-dependency, hot-reloadable internationalization solution.

## 🎯 Goals
- **Zero External Dependencies**: The plugin itself does not need to install `npm install i18n-plus`, just paste a single `i18n.ts` file.
- **Automated Extraction**: No more manual collection of Keys; automatically generate dictionaries by scanning source code via scripts.
- **Complete Developer Experience**: Support exporting built-in dictionaries for translators.

## 🛠️ Preparation

Ensure you have the following scripts (usually located in `obsidian-plugins-i18n-plus/scripts/`):
1.  **Codemod Script** (`i18n-codemod.cjs`): Used for automatically replacing hardcoded strings in source code.
2.  **Extractor Script** (`extract-keys.cjs`): Used for extracting Keys from source code and generating `en.ts`.

---

## 🚀 Migration Process (The Golden Path)

### Step 1: Inject Adapter (Zero-Dependency Adapter)

Create `i18n.ts` in the target plugin source directory (e.g., `src/lang/`). This is a **self-contained** adapter responsible for:
- Acting as a proxy for `i18n-plus`.
- Returning English Keys directly when `i18n-plus` is not installed.
- Maintaining local state (current locale, loaded dictionaries).

**Key Code References**:
- Must implement the `I18nAdapter` class.
- Must include the `initI18n(plugin)` function.
- Must implement complete `getLocale`, `setLocale`, `loadDictionary` logic in `register`.

> 💡 **AI Tip**: Copy the latest `Dataview/src/lang/i18n.ts` as a template. It already contains the state management logic.

### Step 2: Initialize Plugin (Main Entry)

Modify the plugin's entry file (usually `main.ts`):

1.  **Import Adapter**:
    ```typescript
    import { initI18n } from './lang/i18n';
    ```

2.  **Initialize**:
    At the very beginning of the `onload()` method:
    ```typescript
    this.i18n = initI18n(this);
    this.t = this.i18n.t; // Mount shortcut method
    ```

3.  **Declare Types**:
    Add to the `Plugin` class declaration:
    ```typescript
    i18n: any;
    t: (key: string, params?: any) => string;
    ```

### Step 3: Automated Code Transformation (Codemod)

Run the `jscodeshift` script to automatically replace `"Hello"` in the source code with `this.t("Hello")`.

```bash
# Run in i18n-plus project root
npx jscodeshift -t scripts/i18n-codemod.cjs <target_plugin_path>/src/main.ts --parser=ts
```

> ⚠️ **Note**: Codemod only handles common UI methods (like `setText`, `setDesc`, `Notice`). It supports simple string concatenation (`"A" + "B"`) via `flattenBinaryString`, but cannot handle complex logic.

### Step 4: Static Key Extraction (Static Extraction)

Run the extraction script to scan all `t("Key")` calls and generate the default dictionary.

```bash
# Run in target plugin root directory
node <path>/extract-keys.cjs src
```

This will generate `src/lang/locales/en.ts`.
**Important**: Modify the adapter `i18n.ts` to statically import this `en.ts` and return it when `getDictionary('en')` is called. This guarantees that the plugin exports a complete English dictionary even if the user has not enabled any translations.

### Step 5: Build and Export

1.  **Build Plugin**: `npm run build`.
2.  **Reload Plugin**: Reload the plugin in Obsidian.
3.  **Export Dictionary**: Open `i18n-plus` Settings -> Dictionary Manager -> Find Plugin -> Click Export (en).
    *   You should now get a `pluginid.en.json` containing all extracted Keys.

---

## ⚙️ Configuration Options

The adapter provides several configuration options in the configuration section at the top of `adapter.ts`:

### Built-in Locales

Add your built-in languages to the `BUILTIN_LOCALES` object:

```typescript
const BUILTIN_LOCALES: Record<string, Record<string, string>> = {
    'en': en,
    'zh': zh,      // Simplified Chinese
    'ja': ja,      // Japanese
};
```

> **Important**: Use Obsidian standard locale codes (e.g., `zh` for Simplified Chinese, not `zh-CN`). See `src/framework/locales.ts` for the full list.

### Base Locale (Fallback Language)

Configure the final fallback language by modifying `BASE_LOCALE`:

```typescript
// Base locale for final fallback (configurable by developer)
const BASE_LOCALE = 'en';  // Change to 'zh' if your plugin targets Chinese users
```

This is the language used when:
1. The current locale has no translation for a key
2. The last successful locale also has no translation

### Smart Fallback System

The adapter uses a 5-level fallback priority:

1. **External Dictionary** (loaded via I18n Plus)
2. **Built-in Language** (current locale)
3. **Last Successful Locale** (automatically tracked)
4. **Base Locale** (configured above)
5. **Raw Key**

**Example Scenario**:
- Plugin has built-in: `en`, `zh`
- User's Obsidian is in Chinese → automatically uses `zh`
- User imports a Japanese dictionary via I18n Plus
- Japanese dictionary is missing some keys → falls back to `zh` (not hardcoded English!)

---

## 🧩 Manual Fixes (The "Human in the Loop")

Codemod is not a silver bullet. Human (or AI) intervention is required in the following cases:

### 1. Dynamic Interpolation
**Issue**: Code like `DateTime.now().toFormat(...)` cannot be statically extracted.
**Fix**:
- **Source Modification**:
  ```typescript
  // Before
  .setDesc("Time: " + DateTime.now())
  
  // After
  .setDesc(this.t("Time: {time}", { time: DateTime.now() }))
  ```
- **Re-extraction**: Run `extract-keys.cjs`.

### 2. Strings in Arrays
**Issue**: `let lines = ["Line 1", "Line 2"]`.
**Fix**:
  Although Codemod does not handle arrays, you can wrap them manually:
  ```typescript
  let lines = [this.t("Line 1"), this.t("Line 2")]
  ```
  This way, `extract-keys.cjs` can still find them via regex.

### 3. Links and Complex DOM
**Issue**: `createFragment` mixed with `appendText` and `createEl('a')`.
**Strategy**:
  Split into multiple Key translations, or refactor to innerHTML (not recommended). Usually, splitting it into fragmented Keys ("Click ", "here", " for more") is acceptable.

---

## 🌍 Translation and Verification Process

1.  **Prepare Translation File**: Copy the exported `en.json` and rename it to `zh-CN.json` (or other languages).
2.  **Modify Metadata**: Ensure `$meta.locale` is set to `zh-CN`.
3.  **Translate**: Translate Values to Chinese.
    *   Note to keep interpolation placeholders like `{date}`.
4.  **Import Test**:
    *   Import this JSON in `i18n-plus`.
    *   **Verify**: Does the plugin interface change to Chinese?
    *   **Verify**: Does switching languages take effect immediately? (Depends on `setLocale` implementation in the adapter).

---

## 🤖 AI Collaboration Prompt Suggestions

If you ask AI to help you with this, you can use the following Prompt:

> "Please help me integrate [Plugin Name] into i18n-plus.
> 1. First, read the latest `obsidian-dataview/src/lang/i18n.ts` as an adapter template.
> 2. Help me modify `main.ts` to initialize the adapter.
> 3. Run Codemod to replace strings.
> 4. Manually check and fix dynamic strings missed by Codemod (using parameterized t function).
> 5. Run Extractor to generate en.ts.
> 6. Finally, generate a zh-CN.json for me."

---

## ⚡ Advanced: GitHub Action Automated Migration

We provide an automated solution where you can complete 90% of the migration work by forking the repository and running a GitHub Action.

### Preparation

1.  **Fork** the target plugin repository.
2.  Copy [`templates/auto-migrate-workflow.yml`](../templates/auto-migrate-workflow.yml) to `.github/workflows/i18n-migrate.yml` in your repository.
3.  **Configure GitHub Actions Permissions**:
    - Go to repository **Settings → Actions → General**
    - Under **Workflow permissions**, select **Read and write permissions**
    - Check **Allow GitHub Actions to create and approve pull requests**
    - Click **Save**

> **Note**: Always refer to the latest workflow file in the repository; this documentation may be outdated.

### How It Works

1.  **Inject Script (`inject-i18n.cjs`)**:
    *   Automatically parses `main.ts` AST.
    *   Injects `import { initI18n }`.
    *   Adds `i18n` and `t` properties to the class.
    *   Inserts initialization code at the beginning of the `onload()` method.
2.  **Codemod Script**: Transforms all hardcoded strings under `src/`.
3.  **Create PR**: Submits all changes as a Pull Request for your final manual review.

---

This guide was summarized by Antigravity from the Dataview localization practice.
