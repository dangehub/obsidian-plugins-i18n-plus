/**
 * I18n Plus Framework - I18nTranslator
 * 
 * 翻译器核心实现
 */

import type {
    Dictionary,
    DictionaryMeta,
    ValidationResult,
    ValidationError,
    TranslatorOptions,
    I18nTranslatorInterface,
} from './types';

/**
 * I18n 翻译器
 * 
 * 负责管理单个插件的国际化翻译，支持：
 * - 动态加载/卸载词典
 * - 词典格式校验
 * - 缺失条目自动回退
 * - 参数插值
 */
export class I18nTranslator<T extends Dictionary = Dictionary> implements I18nTranslatorInterface {
    readonly pluginId: string;
    readonly baseLocale: string;

    private _currentLocale: string;
    private readonly baseDictionary: T;
    private readonly dictionaries: Map<string, Dictionary> = new Map();
    private readonly onValidationError?: (result: ValidationResult) => void;

    constructor(options: TranslatorOptions<T>) {
        this.pluginId = options.pluginId;
        this.baseLocale = options.baseLocale;
        this._currentLocale = options.currentLocale || options.baseLocale;
        this.baseDictionary = options.baseDictionary;
        this.onValidationError = options.onValidationError;

        // 将基准词典也存入 map
        this.dictionaries.set(this.baseLocale, this.baseDictionary);
    }

    get currentLocale(): string {
        return this._currentLocale;
    }

    set currentLocale(locale: string) {
        this._currentLocale = locale;
    }

    /**
     * 翻译函数
     * @param key 翻译 key
     * @param params 插值参数，支持 {name} 格式
     */
    t(key: keyof T | string, params?: Record<string, string | number>): string {
        const k = key as string;

        // 1. 尝试从当前语言的词典获取
        const currentDict = this.dictionaries.get(this._currentLocale);
        let value = currentDict?.[k];

        // 2. 如果当前语言没有，回退到基准词典
        if (value === undefined || typeof value !== 'string') {
            value = (this.baseDictionary as Dictionary)[k];
        }

        // 3. 如果基准词典也没有，返回 key 本身（便于调试）
        if (value === undefined || typeof value !== 'string') {
            console.warn(`[i18n-plus] Missing translation for key: "${k}" in plugin: ${this.pluginId}`);
            return k;
        }

        // 4. 参数插值
        if (params) {
            return this.interpolate(value, params);
        }

        return value;
    }

    /**
     * 参数插值
     * 支持 {name} 和 {{name}} 两种格式
     */
    private interpolate(text: string, params: Record<string, string | number>): string {
        return text.replace(/\{\{?(\w+)\}?\}/g, (match, key) => {
            const value = params[key];
            return value !== undefined ? String(value) : match;
        });
    }

    /**
     * 加载词典
     */
    loadDictionary(locale: string, dict: Dictionary): ValidationResult {
        // 校验词典格式
        const result = this.validateDictionary(dict);

        if (!result.valid) {
            // 触发错误回调
            this.onValidationError?.(result);
            console.error(`[i18n-plus] Dictionary validation failed for ${this.pluginId}/${locale}:`, result.errors);
            return result;
        }

        // 如果有警告，也触发回调但不阻止加载
        if (result.warnings && result.warnings.length > 0) {
            console.warn(`[i18n-plus] Dictionary loaded with warnings for ${this.pluginId}/${locale}:`, result.warnings);
        }

        // 存储词典
        this.dictionaries.set(locale, dict);

        console.info(`[i18n-plus] Loaded dictionary: ${this.pluginId}/${locale}`);
        return result;
    }

    /**
     * 卸载词典
     */
    unloadDictionary(locale: string): void {
        // 不允许卸载基准词典
        if (locale === this.baseLocale) {
            console.warn(`[i18n-plus] Cannot unload base dictionary: ${locale}`);
            return;
        }

        if (this.dictionaries.has(locale)) {
            this.dictionaries.delete(locale);
            console.info(`[i18n-plus] Unloaded dictionary: ${this.pluginId}/${locale}`);

            // 如果卸载的是当前语言，回退到基准语言
            if (this._currentLocale === locale) {
                this._currentLocale = this.baseLocale;
                console.info(`[i18n-plus] Locale reset to base: ${this.baseLocale}`);
            }
        }
    }

    /**
     * 设置当前语言
     */
    setLocale(locale: string): void {
        this._currentLocale = locale;
    }

    /**
     * 获取当前语言
     */
    getLocale(): string {
        return this._currentLocale;
    }

    /**
     * 获取已加载的语言列表（内置 + 外部）
     */
    getLoadedLocales(): string[] {
        return Array.from(this.dictionaries.keys());
    }

    /**
     * 获取内置语言列表（只有 baseLocale）
     */
    getBuiltinLocales(): string[] {
        return [this.baseLocale];
    }

    /**
     * 获取外部导入的语言列表
     */
    getExternalLocales(): string[] {
        return Array.from(this.dictionaries.keys()).filter(l => l !== this.baseLocale);
    }

    /**
     * 校验词典格式
     */
    validateDictionary(dict: unknown): ValidationResult {
        const errors: ValidationError[] = [];
        const warnings: ValidationError[] = [];

        // 1. 基础类型检查
        if (!dict || typeof dict !== 'object') {
            errors.push({ key: '$root', message: 'Dictionary must be an object' });
            return { valid: false, errors };
        }

        const d = dict as Record<string, unknown>;

        // 2. 检查 $meta（如果存在）
        if (d.$meta !== undefined) {
            const meta = d.$meta as Partial<DictionaryMeta>;

            if (typeof meta !== 'object') {
                errors.push({ key: '$meta', message: '$meta must be an object' });
            } else {
                // locale 是加载外部词典时的必填项
                if (!meta.locale || typeof meta.locale !== 'string') {
                    warnings.push({ key: '$meta.locale', message: 'Missing or invalid $meta.locale' });
                }

                if (!meta.dictVersion || typeof meta.dictVersion !== 'string') {
                    warnings.push({ key: '$meta.dictVersion', message: 'Missing or invalid $meta.dictVersion' });
                }
            }
        }

        // 3. 检查翻译条目
        const baseKeys = Object.keys(this.baseDictionary).filter(k => k !== '$meta');
        const dictKeys = Object.keys(d).filter(k => k !== '$meta');

        // 检查是否有未知的 key（可能是拼写错误）
        for (const key of dictKeys) {
            if (!baseKeys.includes(key)) {
                warnings.push({ key, message: `Unknown key "${key}" not in base dictionary` });
            }

            // 值必须是字符串
            if (typeof d[key] !== 'string' && key !== '$meta') {
                errors.push({ key, message: `Value for "${key}" must be a string, got ${typeof d[key]}` });
            }
        }

        // 检查缺失的 key
        for (const key of baseKeys) {
            if (!dictKeys.includes(key)) {
                warnings.push({ key, message: `Missing translation for "${key}"` });
            }
        }

        return {
            valid: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined,
            warnings: warnings.length > 0 ? warnings : undefined,
        };
    }
}

/**
 * 创建翻译器的工厂函数
 */
export function createTranslator<T extends Dictionary>(
    options: TranslatorOptions<T>
): I18nTranslator<T> {
    return new I18nTranslator(options);
}
