import { Plugin } from 'obsidian';
import en from './locales/en';
// import zhCN from './locales/zh-CN'; // Add more built-in languages as needed

/**
 * [Unified Adapter v2]
 * 
 * Use cases:
 * 1. Standalone mode: Works without i18n-plus, uses built-in languages only
 * 2. Mixed mode: Works with i18n-plus, external dictionaries can override/extend built-in languages
 * 
 * Priority: External dictionary > Built-in language > English > Raw key
 */

// ═══════════════════════════════════════════════════════════════════════════
// Configuration: Add your built-in languages here
// ═══════════════════════════════════════════════════════════════════════════
const BUILTIN_LOCALES: Record<string, Record<string, string>> = {
    'en': en,
    // 'zh-CN': zhCN,  // Uncomment and import to enable built-in Chinese
};

// ═══════════════════════════════════════════════════════════════════════════

export interface I18nTranslator {
    t(key: string, params?: Record<string, string | number>): string;
    setLocale(locale: string): void;
    getLocale(): string;
}

export class I18nAdapter implements I18nTranslator {
    id: string;
    private _currentLocale: string = 'en';
    private _externalDictionaries: Record<string, Record<string, string>> = {};

    constructor(pluginId: string, initialLocale?: string) {
        this.id = pluginId;
        this._currentLocale = initialLocale || (window as any).moment?.locale() || 'en';
    }

    /**
     * Core translation method
     */
    t(key: string, params?: Record<string, string | number>): string {
        const locale = this._currentLocale;

        // Priority: External > Built-in > English > Raw key
        const text =
            this._externalDictionaries[locale]?.[key] ||
            this._externalDictionaries[locale.split('-')[0]]?.[key] ||
            BUILTIN_LOCALES[locale]?.[key] ||
            BUILTIN_LOCALES[locale.split('-')[0]]?.[key] ||
            BUILTIN_LOCALES['en']?.[key] ||
            key;

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
            baseLocale: 'en',
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
