/**
 * I18n Plus Framework - I18nTranslator
 * 
 * Translator core implementation
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
 * I18n Translator
 * 
 * Responsible for managing internationalization translations for a single plugin, supports:
 * - Dynamic dictionary loading/unloading
 * - Dictionary format validation
 * - Automatic fallback for missing entries
 * - Parameter interpolation
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

        // Store base dictionary in map
        this.dictionaries.set(this.baseLocale, this.baseDictionary);
    }

    get currentLocale(): string {
        return this._currentLocale;
    }

    set currentLocale(locale: string) {
        this._currentLocale = locale;
    }

    /**
     * Translation function
     * @param key Translation key
     * @param params Interpolation parameters, supports {name} format
     */
    t(key: keyof T | string, params?: Record<string, string | number> | { context?: string;[key: string]: any }): string {
        const k = key as string;
        const context = params?.context;

        // Context lookup logic
        // If context exists, prioritize "Key_Context"
        const lookupKeys: string[] = [];
        if (context) {
            lookupKeys.push(`${k}_${context}`);
        }
        lookupKeys.push(k);

        const currentDict = this.dictionaries.get(this._currentLocale);
        const baseDict = this.baseDictionary as Dictionary;

        let template: string | undefined;

        // 1. Iterate to find Key
        for (const lookupKey of lookupKeys) {
            // Try current locale
            if (currentDict && typeof currentDict[lookupKey] === 'string') {
                template = currentDict[lookupKey];
                break;
            }
            // Try base locale
            if (baseDict && typeof baseDict[lookupKey] === 'string') {
                template = baseDict[lookupKey];
                break;
            }
        }

        // 2. If not found in any locale
        // If context exists, fallback to the original key without context suffix
        // Note: If no translation found, we return the original key directly
        if (template === undefined) {
            console.warn(`[i18n-plus] Missing translation for key: "${k}"${context ? ` (context: ${context})` : ''} in plugin: ${this.pluginId}`);
            return k;
        }

        // 3. Parameter Interpolation
        if (params) {
            // Filter out context parameter to avoid pollution
            const { context: _ctx, ...interpolationParams } = params as any;
            if (Object.keys(interpolationParams).length > 0) {
                return this.interpolate(template, interpolationParams);
            }
        }

        return template;
    }

    /**
     * Parameter Interpolation
     * Supports {name} and {{name}} formats
     */
    private interpolate(text: string, params: Record<string, string | number>): string {
        return text.replace(/\{\{?(\w+)\}?\}/g, (match, key) => {
            const value = params[key];
            return value !== undefined ? String(value) : match;
        });
    }

    /**
     * Load dictionary
     */
    loadDictionary(locale: string, dict: Dictionary): ValidationResult {
        // Validate dictionary format
        const result = this.validateDictionary(dict);

        if (!result.valid) {
            // Trigger error callback
            this.onValidationError?.(result);
            console.error(`[i18n-plus] Dictionary validation failed for ${this.pluginId}/${locale}:`, result.errors);
            return result;
        }

        // Trigger callback for warnings if any, but do not block loading
        if (result.warnings && result.warnings.length > 0) {
            console.warn(`[i18n-plus] Dictionary loaded with warnings for ${this.pluginId}/${locale}:`, result.warnings);
        }

        // Store dictionary
        this.dictionaries.set(locale, dict);

        console.info(`[i18n-plus] Loaded dictionary: ${this.pluginId}/${locale}`);
        return result;
    }

    /**
     * Unload dictionary
     */
    unloadDictionary(locale: string): void {
        // Cannot unload base dictionary
        if (locale === this.baseLocale) {
            console.warn(`[i18n-plus] Cannot unload base dictionary: ${locale}`);
            return;
        }

        if (this.dictionaries.has(locale)) {
            this.dictionaries.delete(locale);
            console.info(`[i18n-plus] Unloaded dictionary: ${this.pluginId}/${locale}`);

            // If unloading current locale, revert to base locale
            if (this._currentLocale === locale) {
                this._currentLocale = this.baseLocale;
                console.info(`[i18n-plus] Locale reset to base: ${this.baseLocale}`);
            }
        }
    }

    /**
     * Set current locale
     */
    setLocale(locale: string): void {
        this._currentLocale = locale;
    }

    /**
     * Get current locale
     */
    getLocale(): string {
        return this._currentLocale;
    }

    /**
     * Get loaded locales list (builtin + external)
     */
    getLoadedLocales(): string[] {
        return Array.from(this.dictionaries.keys());
    }

    /**
     * Get builtin locales list (only baseLocale)
     */
    getBuiltinLocales(): string[] {
        return [this.baseLocale];
    }

    /**
     * Get external locales list
     */
    getExternalLocales(): string[] {
        return Array.from(this.dictionaries.keys()).filter(l => l !== this.baseLocale);
    }

    getDictionary(locale: string): Dictionary | undefined {
        if (locale === this.baseLocale) {
            return this.baseDictionary;
        }
        return this.dictionaries.get(locale);
    }


    /**
     * Validate dictionary format
     */
    validateDictionary(dict: unknown): ValidationResult {
        const errors: ValidationError[] = [];
        const warnings: ValidationError[] = [];

        // 1. Basic type check
        if (!dict || typeof dict !== 'object') {
            errors.push({ key: '$root', message: 'Dictionary must be an object' });
            return { valid: false, errors };
        }

        const d = dict as Record<string, unknown>;

        // 2. Check $meta (if exists)
        if (d.$meta !== undefined) {
            const meta = d.$meta as Partial<DictionaryMeta>;

            if (typeof meta !== 'object') {
                errors.push({ key: '$meta', message: '$meta must be an object' });
            } else {
                // locale is required when loading external dictionaries
                if (!meta.locale || typeof meta.locale !== 'string') {
                    warnings.push({ key: '$meta.locale', message: 'Missing or invalid $meta.locale' });
                }

                if (!meta.dictVersion || typeof meta.dictVersion !== 'string') {
                    warnings.push({ key: '$meta.dictVersion', message: 'Missing or invalid $meta.dictVersion' });
                }
            }
        }

        // 3. Check translation entries
        const baseKeys = Object.keys(this.baseDictionary).filter(k => k !== '$meta');
        const dictKeys = Object.keys(d).filter(k => k !== '$meta');

        // Check for unknown keys (typos)
        for (const key of dictKeys) {
            if (!baseKeys.includes(key)) {
                warnings.push({ key, message: `Unknown key "${key}" not in base dictionary` });
            }

            // Value must be a string
            if (typeof d[key] !== 'string' && key !== '$meta') {
                errors.push({ key, message: `Value for "${key}" must be a string, got ${typeof d[key]}` });
            }
        }

        // Check for missing keys
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
 * Factory function to create translator
 */
export function createTranslator<T extends Dictionary>(
    options: TranslatorOptions<T>
): I18nTranslator<T> {
    return new I18nTranslator(options);
}
