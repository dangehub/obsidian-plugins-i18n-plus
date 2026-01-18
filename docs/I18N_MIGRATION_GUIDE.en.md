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

This guide was summarized by Antigravity from the Dataview localization practice.
