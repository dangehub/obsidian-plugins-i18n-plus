/**
 * I18n Plus Framework - Type Definitions
 * 
 * 国际化框架核心类型定义
 */

/**
 * 词典元信息
 */
export interface DictionaryMeta {
    /** 语言标识 (BCP 47)，如 "zh-CN", "en" */
    locale: string;
    /** 词典版本（翻译迭代版本） */
    dictVersion: string;
    /** 适配的插件版本范围，如 ">=1.0.0" */
    pluginVersion?: string;
    /** 贡献者列表 */
    authors?: string[];
}

/**
 * 词典数据结构
 */
export interface Dictionary {
    /** 元信息（加载外部词典时必填） */
    $meta?: DictionaryMeta;
    /** 翻译条目 */
    [key: string]: string | DictionaryMeta | undefined;
}

/**
 * 词典校验错误项
 */
export interface ValidationError {
    /** 错误对应的 key */
    key: string;
    /** 错误信息 */
    message: string;
}

/**
 * 词典校验结果
 */
export interface ValidationResult {
    /** 是否通过校验 */
    valid: boolean;
    /** 错误列表 */
    errors?: ValidationError[];
    /** 警告列表（非致命问题） */
    warnings?: ValidationError[];
}

/**
 * 翻译器配置选项
 */
export interface TranslatorOptions<T extends Dictionary = Dictionary> {
    /** 插件 ID */
    pluginId: string;
    /** 基准语言标识 */
    baseLocale: string;
    /** 基准词典（硬编码在插件中的默认翻译） */
    baseDictionary: T;
    /** 当前语言（默认跟随 Obsidian 设置） */
    currentLocale?: string;
    /** 词典校验失败时的回调 */
    onValidationError?: (result: ValidationResult) => void;
}

/**
 * I18n Plus 全局 API
 */
export interface I18nPlusAPI {
    /** API 版本 */
    readonly version: string;

    /**
     * 注册插件的翻译器实例
     * @param pluginId 插件 ID
     * @param translator 翻译器实例
     */
    register(pluginId: string, translator: I18nTranslatorInterface): void;

    /**
     * 注销插件的翻译器
     * @param pluginId 插件 ID
     */
    unregister(pluginId: string): void;

    /**
     * 为指定插件加载词典
     * @param pluginId 插件 ID
     * @param locale 语言标识
     * @param dict 词典数据
     * @returns 校验结果
     */
    loadDictionary(pluginId: string, locale: string, dict: Dictionary): ValidationResult;

    /**
     * 卸载指定插件的词典
     * @param pluginId 插件 ID
     * @param locale 语言标识
     */
    unloadDictionary(pluginId: string, locale: string): void;

    /**
     * 获取已注册的插件列表
     */
    getRegisteredPlugins(): string[];

    /**
     * 获取指定插件已加载的语言列表
     * @param pluginId 插件 ID
     */
    getLoadedLocales(pluginId: string): string[];

    /**
     * 获取指定插件的翻译器
     * @param pluginId 插件 ID
     */
    getTranslator(pluginId: string): I18nTranslatorInterface | undefined;

    /**
     * 监听事件
     * @param event 事件名
     * @param callback 回调函数
     */
    on(event: 'locale-changed' | 'dictionary-loaded' | 'dictionary-unloaded' | 'plugin-registered', callback: (...args: unknown[]) => void): void;

    /**
     * 移除事件监听
     */
    off(event: string, callback: (...args: unknown[]) => void): void;
}

/**
 * 翻译器接口
 */
export interface I18nTranslatorInterface {
    /** 插件 ID */
    readonly pluginId: string;
    /** 基准语言 */
    readonly baseLocale: string;
    /** 当前语言 */
    currentLocale: string;

    /**
     * 翻译函数
     * @param key 翻译 key
     * @param params 插值参数
     */
    t(key: string, params?: Record<string, string | number>): string;

    /**
     * 加载词典
     * @param locale 语言标识
     * @param dict 词典数据
     */
    loadDictionary(locale: string, dict: Dictionary): ValidationResult;

    /**
     * 卸载词典
     * @param locale 语言标识
     */
    unloadDictionary(locale: string): void;

    /**
     * 设置当前语言
     * @param locale 语言标识
     */
    setLocale(locale: string): void;

    /**
     * 获取当前语言
     */
    getLocale(): string;

    /**
     * 获取已加载的语言列表（内置 + 外部）
     */
    getLoadedLocales(): string[];

    /**
     * 获取内置语言列表（插件自带的翻译）
     */
    getBuiltinLocales(): string[];

    /**
     * 获取外部导入的语言列表
     */
    getExternalLocales(): string[];

    /**
     * 校验词典格式
     * @param dict 待校验的词典
     */
    validateDictionary(dict: unknown): ValidationResult;
}

// 全局类型声明
declare global {
    interface Window {
        i18nPlus?: I18nPlusAPI;
    }
}

export { };
