# I18n Plus

[![GitHub release](https://img.shields.io/github/v/release/dangehub/obsidian-plugins-i18n-plus)](https://github.com/dangehub/obsidian-plugins-i18n-plus/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[中文文档](docs/README.zh-CN.md)

A universal internationalization (i18n) framework for the Obsidian plugin ecosystem. Provides zero-dependency adapters, automated migration tools, and seamless multi-language support.

## ✨ Features

- **Zero Runtime Dependency**: Plugins work perfectly without I18n Plus installed
- **Standalone + Mixed Mode**: Built-in languages work independently; external dictionaries can override/extend them
- **Automated Migration**: Transform hardcoded strings to `t()` calls with one command
- **Hot Reload**: Switch languages instantly without restarting plugins
- **Community Translations**: Users can import third-party translations without code changes

## 🚀 Quick Start

### For Plugin Developers

1. **Copy the adapter** to your plugin:
   ```bash
   cp templates/adapter.ts your-plugin/src/lang/i18n.ts
   ```

2. **Initialize in main.ts**:
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

3. **Use translations**:
   ```typescript
   new Notice(this.t("Hello, {name}!", { name: "World" }));
   ```

### Automated Migration

Run the codemod to automatically replace hardcoded strings:

```bash
# Install jscodeshift
npm install -g jscodeshift

# Run codemod on your plugin
npx jscodeshift -t scripts/i18n-codemod.cjs your-plugin/src/ --parser=ts

# Extract keys to generate en.ts
node scripts/extract-keys.cjs your-plugin/src
```

## 📦 How It Works

### Priority System

When `t("key")` is called, the adapter searches in this order:

1. **External Dictionary** (loaded via I18n Plus)
2. **Built-in Language** (shipped with the plugin)
3. **English Fallback**
4. **Raw Key**

This means:
- Users can override built-in translations with custom JSON files
- New languages can be added without modifying plugin code
- Plugins work offline without I18n Plus installed

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Your Plugin                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │  adapter.ts (self-contained, ~100 lines)        │    │
│  │  ├── BUILTIN_LOCALES: { en, zh-CN, ... }        │    │
│  │  └── _externalDictionaries: { de, fr, ... }     │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                          ▲
                          │ (optional)
                          ▼
┌─────────────────────────────────────────────────────────┐
│               I18n Plus Plugin (optional)                │
│  ├── Dictionary Manager UI                               │
│  ├── Global Locale Sync                                  │
│  └── External .json Import/Export                        │
└─────────────────────────────────────────────────────────┘
```

## 🛠️ Scripts

| Script | Description |
|--------|-------------|
| `i18n-codemod.cjs` | Transform hardcoded strings to `t()` calls |
| `extract-keys.cjs` | Extract all keys and generate `en.ts` |
| `inject-i18n.cjs` | Auto-inject adapter into `main.ts` |
| `generate-report.cjs` | Generate migration report |

## 📁 Project Structure

```
templates/
  └── adapter.ts          # Copy this to your plugin
scripts/
  ├── i18n-codemod.cjs    # String replacement codemod
  ├── extract-keys.cjs    # Key extraction script
  └── inject-i18n.cjs     # Auto-injection script
examples/
  └── auto-migrate-workflow.yml  # GitHub Action template
docs/
  ├── README.zh-CN.md     # Chinese documentation
  └── I18N_MIGRATION_GUIDE.zh-CN.md  # Migration guide
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.
