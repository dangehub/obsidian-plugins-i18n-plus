# Obsidian 第三方生态国际化白皮书（中文版）

> **倡议者**：DangeHub  
> **组织**：Open Obsidian i18n  
> **版本**：1.1.0  
> **日期**：2026-02-02

---

## 摘要

Obsidian 是一款功能强大的本地知识管理软件，其本体已具备多语言支持。然而，在插件、主题及其他可配置扩展的第三方生态层面，国际化几乎为空。这导致非英语用户在使用第三方扩展时面临明显语言障碍。

本白皮书旨在：

1. 阐明问题的根源与影响范围  
2. 提出**非侵入式、社区驱动**的国际化解决方案  
3. 呼吁开发者、译者与用户共同参与，构建开放、可持续的多语言生态

---

## 第一章：问题陈述

### 1.1 现状

Obsidian 官方提供多语言界面，但对于第三方插件、主题及其他可配置扩展：

- **官方无约束或支持**：缺乏标准化 i18n API，无法贡献翻译  
- **开发者各自为战**：少数扩展自行实现多语言，但方案不统一  
- **社区难以参与**：热心译者无法在不修改源码的情况下贡献翻译

### 1.2 用户影响

| 用户群体 | 影响 |
|----------|------|
| 非英语母语用户 | 扩展界面全英文，使用门槛高 |
| 扩展开发者 | 想做国际化但精力有限，缺乏标准方案 |
| 社区译者 | 有翻译意愿但无贡献途径 |

### 1.3 官方态度

官方曾明确表示：

> *“我们不允许通过修改其他插件源代码或操作 DOM 的方式实现翻译。”*

这种立场合理，因为“Hack”式翻译存在兼容性和安全隐患。但同时，官方并未提供替代方案，问题虽被承认，却被搁置。

---

## 第二章：解决方案

### 2.1 核心理念

我们提出**非侵入式、协作式**的国际化方案：

```
插件/主题/可配置扩展开发者
├── 内置轻量 i18n 适配器（约 150 行，零依赖）
└── 使用 t("key") 替代硬编码字符串
        ↓
i18n-plus 框架
├── 全局词典管理器（用户可导入/导出翻译）
├── 热重载（切换语言无需重启）
└── 云端词典分发（社区翻译自动同步）
        ↓
社区译者（通过 Crowdin 等平台协作翻译）
```


### 2.2 i18n-plus 插件

i18n-plus 既是 **框架**，也是 **Obsidian 插件**：

- **开发者端**：  
  - 只需提供原始词典，即可发布扩展  
  - 翻译与扩展解耦，无需等待翻译完成即可上线  

- **用户端**：  
  - 可视化管理已适配扩展  
  - 动态加载/卸载云端或本地词典  
  - 内置本地词典编辑器  
  - 检测已安装扩展的云端词典（接口已预留）  

- **验证**：已在 Blur Mode 和 Better Plugins Manager 插件上进行测试

### 2.3 技术架构

#### 适配器模式

```typescript
// 插件/主题独立运行时，使用内置翻译
this.t("Hello, {name}!", { name: "World" });

// 当 i18n-plus 存在时，自动注册到全局管理器
// 支持外部词典覆盖、热重载等高级功能
```


#### 翻译优先级

```
1. 外部词典（用户导入或云端下载）
2. 内置翻译（扩展自带）
3. 上一次成功语言（智能回退）
4. 基础语言（通常是英文）
5. 原始 Key（最后防线）
```


#### 云端词典分发

```
扩展作者提交基础词典
        ↓
Crowdin 社区翻译
        ↓
GitHub 仓库生成清单
        ↓
i18n-plus 一键下载/更新
```


特性：

- **版本自动化**：文件 Hash 判定更新，无需人工维护  
- **进度可视**：显示翻译完成度  
- **贡献者致谢**：自动获取 Crowdin 数据

---

## 第三章：社区驱动的重要性

### 3.1 官方不做的原因

可能原因：

1. 优先级：核心功能优先，i18n 不是“刚需”  
2. 复杂性：需协调数千个第三方扩展  
3. 资源有限：官方团队精力有限

### 3.2 社区能做什么

| 角色 | 贡献方式 |
|------|----------|
| 扩展开发者 | 引入 i18n 适配器，使用 `t()` |
| 译者 | 通过 Crowdin 翻译，无需代码能力 |
| 用户 | 使用 i18n-plus 管理词典，反馈问题 |
| 组织者 | 维护框架、托管词典、协调社区 |

### 3.3 可持续性

- **开源协议**：MIT，任何人可使用或修改  
- **去中心化**：词典托管在公开仓库  
- **标准化**：适配器模板化，降低接入门槛

---

## 第四章：路线图

### 已完成

- i18n-plus 核心框架（适配器、管理器、热重载）  
- 自动化迁移工具（codemod、key 提取）  
- 可视化词典管理器 UI  

### 进行中

- 云端词典仓库搭建（GitHub 组织 + Crowdin 集成）  
- 清单自动生成脚本（GitHub Actions）  
- 插件端云端下载/更新集成  

### 未来规划

- 翻译进度徽章（Shields.io 集成）  
- 批量更新功能  
- 插件市场联动（显示多语言支持情况）  

---

## 第五章：行动呼吁

**开发者**：

- 集成 i18n-plus 适配器  
- 提供基础词典  
- 发布扩展，社区将持续贡献翻译

**译者**：

- 参与 Crowdin 协作翻译  
- 改进术语一致性

**用户**：

- 安装 i18n-plus  
- 管理云端/本地词典  
- 提交问题与建议

---

## 附录

### A. 相关链接

- [i18n-plus 插件仓库](https://github.com/open-obsidian-i18n/obsidian-i18n-plus)  
- [云端词典仓库](https://github.com/open-obsidian-i18n/dictionaries)  
- [社区讨论区](https://github.com/open-obsidian-i18n/community)  

### B. 词典元数据规范

所有词典文件均为标准 JSON 格式，其中 `$meta` 字段为必需。

#### 插件词典 (Plugins)

```json
{
  "$meta": {
    "pluginId": "dataview",
    "pluginVersion": "0.5.0",
    "dictVersion": "1706760000000",
    "locale": "zh",
    "description": "Dataview 插件中文翻译"
  },
  
**字段说明：**
- `pluginId`: 目标插件 ID (提取自插件的manifest.json)
- `pluginVersion`: 适配的插件版本范围 (提取自插件的manifest.json)
- `dictVersion`: 词典版本 (时间戳) 
- `locale`: 语言代码
- `description`: 描述信息

#### 主题词典 (Themes)

```json
{
  "$meta": {
    "themeName": "Blue Topaz",
    "themeVersion": "20240101",
    "dictVersion": "1706760000000",
    "locale": "zh",
    "description": "从 theme.css 自动提取的基础词典",
    "sourceHash": "a1b2c3d4e5f6" 
  },
  "key": "翻译内容"
}
```

**字段说明：**
- `themeName`: 目标主题名称 (提取自主题的manifest.json)
- `themeVersion`: 主题版本 (提取自主题的manifest.json)
- `dictVersion`: 词典版本 (时间戳)
- `locale`: 语言代码
- `description`: 描述信息
- `sourceHash`: 源文件哈希 (自动生成时用于校验更新)


### C. 清单文件规范

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

**字段说明：**
- `lastUpdated`: 整个清单的最后生成时间 (ISO 8601格式)
- `contributors`: 所有参与贡献的译者列表 (通过Crowdin api获取)
- `plugins` / `themes`: 对应的扩展列表
  - `pluginId` / `themeName`: 扩展的唯一标识 (对应元数据)
  - `locale`: 语言代码
  - `dictVersion`: 词典版本 (时间戳，用于检测更新)
  - `progress`: 翻译进度百分比 (0-100，通过Crowdin api获取)
  - `downloadUrl`: 词典文件的直接下载链接 (CDN 或 GitHub Raw)


---

## 结语

Obsidian 的第三方生态是其核心竞争力之一。让这个生态说更多语言，不只是技术问题，更是**包容性**和**可及性**的体现。  

官方可能有自己的考虑，但社区不必等待。**让我们一起，为 Obsidian 的多语言未来，写下第一行代码。**

---

*本白皮书遵循 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) 协议，欢迎转载与引用。*
