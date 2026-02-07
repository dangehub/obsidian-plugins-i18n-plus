# Whitepaper on Internationalization of Obsidian Third-Parties

> **Initiator**: DangeHub  
> **Organization**: Open Obsidian i18n  
> **Version**: 1.1.0  
> **Date**: 2026-02-02

---

## Abstract

Obsidian is a powerful local knowledge management software, and its core already has multi-language support. However, at the level of the third-party ecosystem of plugins, themes, and other configurable extensions, internationalization is almost non-existent. This creates significant language barriers for non-English users when using third-party extensions.

This whitepaper aims to:

1.  Clarify the root causes and scope of the problem
2.  Propose a **non-intrusive, community-driven** internationalization solution
3.  Call on developers, translators, and users to participate in building an open and sustainable multi-language ecosystem

---

## Chapter 1: Problem Statement

### 1.1 Current Status

Obsidian officially provides a multi-language interface, but for third-party plugins, themes, and other configurable extensions:

-   **No official constraints or support**: Lack of standardized i18n APIs, making it impossible to contribute translations.
-   **Developers fighting alone**: A few extensions implement multi-language support on their own, but solutions are inconsistent.
-   **Community difficulty in participating**: Enthusiastic translators cannot contribute translations without modifying the source code.

### 1.2 Impact on Users

| User Group | Impact |
| :--- | :--- |
| Non-native English Users | Extension interfaces are all in English, setting a high barrier to entry |
| Extension Developers | Want to do internationalization but have limited energy and lack standard solutions |
| Community Translators | Willing to translate but have no way to contribute |

### 1.3 Official Attitude

The official team has clearly stated:

> *"We do not allow implementing translations by modifying other plugins' source code or manipulating the DOM."*

This position is reasonable because "Hack" style translations have compatibility and security risks. However, at the same time, the official team has not provided an alternative solution, and although the problem is acknowledged, it has been shelved.

---

## Chapter 2: Solution

### 2.1 Core Concept

We propose a **non-intrusive, collaborative** internationalization solution:

```
Plugin/Theme/Configurable Extension Developers
├── Built-in lightweight i18n adapter (~150 lines, zero dependency)
└── Use t("key") to replace hardcoded strings
        ↓
i18n-plus Framework
├── Global Dictionary Manager (Users can import/export translations)
├── Hot Reload (Switch languages without restarting)
└── Cloud Dictionary Distribution (Community translations automatically synced)
        ↓
Community Translators (Collaborate via platforms like Crowdin)
```

### 2.2 i18n-plus Plugin

i18n-plus is both a **framework** and an **Obsidian plugin**:

-   **Developer Side**:
    -   Only need to provide the original dictionary to publish the extension.
    -   Translation is decoupled from the extension, so there is no need to wait for translations to be completed before going live.

-   **User Side**:
    -   Visually manage adapted extensions.
    -   Dynamically load/unload cloud or local dictionaries.
    -   Built-in local dictionary editor.
    -   Detect cloud dictionaries for installed extensions (interface reserved).

-   **Verification**: Tested on *Blur Mode* and *Better Plugins Manager* plugins.

### 2.3 Technical Architecture

#### Adapter Pattern

```typescript
// When the plugin/theme runs independently, use built-in translation
this.t("Hello, {name}!", { name: "World" });

// When i18n-plus exists, automatically register to the global manager
// Supports advanced features like external dictionary override, hot reload, etc.
```

#### Translation Priority

```
1. External Dictionary (Imported by user or downloaded from cloud)
2. Built-in Language (Current locale)
3. Last Successful Locale (Smart fallback to the previously working language)
4. Base Locale (Configurable, defaults to English)
5. Raw Key (Last line of defense)
```

#### Cloud Dictionary Distribution

```
Extension author submits base dictionary
        ↓
Crowdin community translation
        ↓
GitHub repository generates manifest
        ↓
i18n-plus one-click download/update
```

Features:

-   **Automated Versioning**: File Hash determines updates, no manual maintenance required.
-   **Visible Progress**: Displays translation completion percentage.
-   **Contributor Acknowledgement**: Automatically fetches Crowdin data.

---

## Chapter 3: Importance of Community Drive

### 3.1 Why the Official Team Doesn't Do It

Possible reasons:

1.  **Priority**: Core features come first; i18n is not a "must-have".
2.  **Complexity**: Needs to coordinate thousands of third-party extensions.
3.  **Limited Resources**: The official team has limited energy.

### 3.2 What the Community Can Do

| Role | Contribution Method |
| :--- | :--- |
| Extension Developers | Introduce i18n adapter, use `t()` |
| Translators | Translate via Crowdin, no coding skills required |
| Users | Use i18n-plus to manage dictionaries, report issues |
| Organizers | Maintain framework, host dictionaries, coordinate community |

### 3.3 Sustainability

-   **Open Source License**: MIT, anyone can use or modify.
-   **Decentralization**: Dictionaries hosted in public repositories.
-   **Standardization**: Templated adapters reduce the barrier to entry.

---

## Chapter 4: Roadmap

### Completed

-   i18n-plus core framework (adapter, manager, hot reload)
-   Automated migration tools (codemod, key extraction)
-   Visual Dictionary Manager UI

### In Progress

-   Cloud dictionary repository setup (GitHub Organization + Crowdin integration)
-   Manifest automatic generation script (GitHub Actions)
-   Plugin-side cloud download/update integration

### Future Planning

-   Translation progress badges (Shields.io integration)
-   Batch update function
-   Plugin market linkage (Display multi-language support status)

---

## Chapter 5: Call to Action

**Developers**:

-   Integrate i18n-plus adapter
-   Provide base dictionary
-   Publish extensions, community will continue to contribute translations

**Translators**:

-   Participate in Crowdin collaborative translation
-   Improve terminology consistency

**Users**:

-   Install i18n-plus
-   Manage cloud/local dictionaries
-   Submit issues and suggestions

---

## Appendix

### A. Related Links

-   [i18n-plus Plugin Repository](https://github.com/open-obsidian-i18n/obsidian-i18n-plus)
-   [Cloud Dictionary Repository](https://github.com/open-obsidian-i18n/dictionaries)
-   [Community Discussion](https://github.com/open-obsidian-i18n/community)

### B. Dictionary Metadata Specification

All dictionary files are in standard JSON format, where the `$meta` field is required.

#### Plugin Dictionaries

```json
{
  "$meta": {
    "pluginId": "dataview",
    "pluginVersion": "0.5.0",
    "dictVersion": "1706760000000",
    "locale": "zh",
    "description": "Dataview Plugin Chinese Translation"
  },
  "key": "Translation Content"
}
```

**Field Description:**
- `pluginId`: Target plugin ID (extracted from plugin's manifest.json)
- `pluginVersion`: Adapted plugin version range (extracted from plugin's manifest.json)
- `dictVersion`: Dictionary version (timestamp)
- `locale`: Language code
- `description`: Description information

#### Theme Dictionaries

```json
{
  "$meta": {
    "themeName": "Blue Topaz",
    "themeVersion": "20240101",
    "dictVersion": "1706760000000",
    "locale": "zh",
    "description": "Base dictionary automatically extracted from theme.css",
    "sourceHash": "a1b2c3d4e5f6"
  },
  "key": "Translation Content"
}
```

**Field Description:**
- `themeName`: Target theme name (extracted from theme's manifest.json)
- `themeVersion`: Theme version (extracted from theme's manifest.json)
- `dictVersion`: Dictionary version (timestamp)
- `locale`: Language code
- `description`: Description information
- `sourceHash`: Source file hash (used for verifying updates when automatically generated)


### C. Manifest File Specification

```json
{
  "lastUpdated": "2026-02-01T12:00:00Z",
  "contributors": ["Alice", "Bob"],
  "plugins": [
    {
      "pluginId": "dataview",
      "locale": "zh",
      "dictVersion": "1706760000000",
      "progress": 85,
      "downloadUrl": "https://raw.githubusercontent.com/..."
    }
  ],
  "themes": [
    {
      "themeName": "Blue Topaz",
      "locale": "zh",
      "dictVersion": "1706760000000",
      "progress": 90,
      "downloadUrl": "https://raw.githubusercontent.com/..."
    }
  ]
}
```

**Field Description:**
- `lastUpdated`: Last generation time of the entire manifest (ISO 8601 format)
- `contributors`: List of all contributing translators (fetched via Crowdin API)
- `plugins` / `themes`: Corresponding extension lists
  - `pluginId` / `themeName`: Unique identifier of the extension (corresponds to metadata)
  - `locale`: Language code
  - `dictVersion`: Dictionary version (timestamp, used for update detection)
  - `progress`: Translation progress percentage (0-100, fetched via Crowdin API)
  - `downloadUrl`: Direct download link for the dictionary file (CDN or GitHub Raw)


---

## Conclusion

Obsidian's third-party ecosystem is one of its core competencies. Making this ecosystem speak more languages is not just a technical issue, but a reflection of **inclusivity** and **accessibility**.

The official team may have their own considerations, but the community doesn't have to wait. **Let's write the first line of code for Obsidian's multi-language future together.**

---

*This whitepaper is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Reposting and citing are welcome.*
