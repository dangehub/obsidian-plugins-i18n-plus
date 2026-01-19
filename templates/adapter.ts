import { Plugin } from 'obsidian';
import en from './locales/en';
// import zh from './locales/zh'; // Add more built-in languages as needed

/**
 * [Unified Adapter v2]
 * 
 * Use cases:
 * 1. Standalone mode: Works without i18n-plus, uses built-in languages only
 * 2. Mixed mode: Works with i18n-plus, external dictionaries can override/extend built-in languages
 * 
 * Priority: External dictionary > Built-in language > Last successful locale > Base locale > Raw key
 */

// ═══════════════════════════════════════════════════════════════════════════
// Configuration: Add your built-in languages here
// Use Obsidian standard locale codes (e.g., 'zh' for Simplified Chinese, not 'zh-CN')
// ═══════════════════════════════════════════════════════════════════════════
const BUILTIN_LOCALES: Record<string, Record<string, string>> = {
    'en': en,
    // 'zh': zh,  // Uncomment and import to enable built-in Chinese
};

// Base locale for final fallback (configurable by developer)
const BASE_LOCALE = 'en';

// ═══════════════════════════════════════════════════════════════════════════

export interface I18nTranslator {
    t(key: string, params?: Record<string, string | number>): string;
    setLocale(locale: string): void;
    getLocale(): string;
}

export class I18nAdapter implements I18nTranslator {
    id: string;
    private _currentLocale: string = 'en';
    private _lastSuccessfulLocale: string = 'en';  // Track last successful built-in locale
    private _externalDictionaries: Record<string, Record<string, string>> = {};

    constructor(pluginId: string, initialLocale?: string) {
        this.id = pluginId;
        this._currentLocale = initialLocale || (window as any).moment?.locale() || 'en';

        // Initialize last successful locale to current if it's a built-in
        if (BUILTIN_LOCALES[this._currentLocale]) {
            this._lastSuccessfulLocale = this._currentLocale;
        }
    }

    /**
     * Core translation method with smart fallback
     * 
     * Fallback chain:
     * 1. External dictionary (current locale)
     * 2. Built-in dictionary (current locale)
     * 3. Built-in dictionary (last successful locale) - NEW!
     * 4. Built-in dictionary (base locale)
     * 5. Raw key
     */
    t(key: string, params?: Record<string, string | number>): string {
        const locale = this._currentLocale;

        // Try external dictionary first
        let text = this._externalDictionaries[locale]?.[key];

        // Try built-in dictionary for current locale
        if (!text) {
            text = BUILTIN_LOCALES[locale]?.[key];
            if (text) {
                // Update last successful locale when built-in lookup succeeds
                this._lastSuccessfulLocale = locale;
            }
        }

        // Fallback to last successful built-in locale
        if (!text && this._lastSuccessfulLocale !== locale) {
            text = BUILTIN_LOCALES[this._lastSuccessfulLocale]?.[key];
        }

        // Fallback to base locale
        if (!text && BASE_LOCALE !== locale && BASE_LOCALE !== this._lastSuccessfulLocale) {
            text = BUILTIN_LOCALES[BASE_LOCALE]?.[key];
        }

        // Final fallback: raw key
        if (!text) {
            text = key;
        }

        // Parameter interpolation
        if (params) {
            let res = text;
            for (const k in params) {
                res = res.replace(new RegExp(`\\{${k}\\}`, 'g'), String(params[k]));
            }
            return res;
        }
        return text;
    }

    setLocale(locale: string) {
        this._currentLocale = locale;
    }

    getLocale(): string {
        return this._currentLocale;
    }

    // Called by i18n-plus to inject external dictionaries
    loadDictionary(locale: string, dict: Record<string, string>) {
        this._externalDictionaries[locale] = dict;
    }

    unloadDictionary(locale: string) {
        delete this._externalDictionaries[locale];
    }
}

/**
 * Initialization entry point
 */
export function initI18n(plugin: Plugin): I18nAdapter {
    const adapter = new I18nAdapter(
        plugin.manifest.id,
        (plugin as any).settings?.locale
    );

    // Register with i18n-plus if available
    const register = () => {
        const i18n = (window as any).i18nPlus;
        if (!i18n) return;

        i18n.register(plugin.manifest.id, {
            pluginId: plugin.manifest.id,
            baseLocale: BASE_LOCALE,
            getLocale: () => adapter.getLocale(),
            setLocale: (l: string) => adapter.setLocale(l),
            t: (k: string, p?: any) => adapter.t(k, p),
            loadDictionary: (locale: string, dict: Record<string, string>) => {
                adapter.loadDictionary(locale, dict);
                return { valid: true };
            },
            unloadDictionary: (locale: string) => adapter.unloadDictionary(locale),
            getBuiltinLocales: () => Object.keys(BUILTIN_LOCALES),
            getExternalLocales: () => Object.keys(adapter['_externalDictionaries']),
            getLoadedLocales: () => [...new Set([
                ...Object.keys(BUILTIN_LOCALES),
                ...Object.keys(adapter['_externalDictionaries'])
            ])],
            getDictionary: (locale: string) =>
                adapter['_externalDictionaries'][locale] || BUILTIN_LOCALES[locale],
            validateDictionary: () => ({ valid: true }),
        });
    };

    register();
    window.addEventListener('i18n-plus:ready', register);

    return adapter;
}
