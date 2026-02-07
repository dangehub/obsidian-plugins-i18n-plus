/**
 * I18n Plus Framework - Type Definitions
 * 
 * Core type definitions for the internationalization framework
 */

/**
 * Dictionary Meta Information
 */
export interface DictionaryMeta {
    /** Target plugin ID */
    pluginId?: string;
    /** Theme Name (replaces 'id') */
    themeName?: string;
    /** Locale identifier (BCP 47), e.g., "zh-CN", "en" */
    locale: string;
    /** Dictionary version (timestamp) */
    dictVersion: string;
    /** Adapted plugin version range, e.g., ">=1.0.0" */
    pluginVersion?: string;
    /** Theme version */
    themeVersion?: string;
    /** Primary author (single string for simple display) */
    author?: string;
    /** List of authors */
    authors?: string[];
    /** Description */
    description?: string;
    /** Deprecated: Theme ID (alias for themeName) */
    id?: string;
    /** Source file hash (e.g. hash of theme.css) to track updates */
    sourceHash?: string;
}

/**
 * Dictionary Data Structure
 */
export interface Dictionary {
    /** Meta information (required when loading external dictionaries) */
    $meta?: DictionaryMeta;
    /** Translation entries */
    [key: string]: string | DictionaryMeta | undefined;
}

/**
 * Dictionary Validation Error Item
 */
export interface ValidationError {
    /** The key corresponding to the error */
    key: string;
    /** Error message */
    message: string;
}

/**
 * Dictionary Validation Result
 */
export interface ValidationResult {
    /** Whether validation passed */
    valid: boolean;
    /** List of errors */
    errors?: ValidationError[];
    /** List of warnings (non-fatal issues) */
    warnings?: ValidationError[];
}

/**
 * Translator Options
 */
export interface TranslatorOptions<T extends Dictionary = Dictionary> {
    /** Plugin ID */
    pluginId: string;
    /** Base locale identifier */
    baseLocale: string;
    /** Base dictionary (hardcoded default translations in the plugin) */
    baseDictionary: T;
    /** Current locale (defaults to following Obsidian settings) */
    currentLocale?: string;
    /** Callback when dictionary validation fails */
    onValidationError?: (result: ValidationResult) => void;
}

/**
 * I18n Plus Global API
 */
export interface I18nPlusAPI {
    /** API Version */
    readonly version: string;

    /**
     * Register a plugin's translator instance
     * @param pluginId Plugin ID
     * @param translator Translator instance
     */
    register(pluginId: string, translator: I18nTranslatorInterface): void;

    /**
     * Unregister a plugin's translator
     * @param pluginId Plugin ID
     */
    unregister(pluginId: string): void;

    /**
     * Load dictionary for a specific plugin
     * @param pluginId Plugin ID
     * @param locale Locale identifier
     * @param dict Dictionary data
     * @returns Validation result
     */
    loadDictionary(pluginId: string, locale: string, dict: Dictionary): ValidationResult;

    /**
     * Unload dictionary for a specific plugin
     * @param pluginId Plugin ID
     * @param locale Locale identifier
     */
    unloadDictionary(pluginId: string, locale: string): void;

    /**
     * Get list of registered plugins
     */
    getRegisteredPlugins(): string[];

    /**
     * Get list of loaded locales for a specific plugin
     * @param pluginId Plugin ID
     */
    getLoadedLocales(pluginId: string): string[];

    /**
     * Get translator for a specific plugin
     * @param pluginId Plugin ID
     */
    getTranslator(pluginId: string): I18nTranslatorInterface | undefined;

    /**
     * Listen to events
     * @param event Event name
     * @param callback Callback function
     */
    on(event: 'locale-changed' | 'dictionary-loaded' | 'dictionary-unloaded' | 'plugin-registered', callback: (...args: unknown[]) => void): void;

    /**
     * Remove event listener
     */
    off(event: string, callback: (...args: unknown[]) => void): void;

    // ========== Theme Dictionary API (for Style Settings integration) ==========

    /**
     * Load theme dictionary
     * @param themeName Theme name (from manifest.json)
     * @param locale Locale identifier
     * @param dict Dictionary data
     */
    loadThemeDictionary(themeName: string, locale: string, dict: Dictionary): void;

    /**
     * Unload theme dictionary
     * @param themeName Theme name
     * @param locale Locale identifier
     */
    unloadThemeDictionary(themeName: string, locale: string): void;

    /**
     * Get translation for theme/snippet settings (called by Style Settings)
     * @param themeName Theme name
     * @param key Translation key (format: {sectionId}.{settingId}.title/desc)
     * @returns Translated string or undefined
     */
    getTranslation(themeName: string, key: string): string | undefined;

    /**
     * Get list of loaded theme names
     */
    getLoadedThemes(): string[];
}

/**
 * Translator Interface
 */
export interface I18nTranslatorInterface {
    /** Plugin ID */
    readonly pluginId: string;
    /** Base locale */
    readonly baseLocale: string;
    /** Current locale */
    currentLocale: string;

    /**
     * Translation function
     * @param key Translation key
     * @param params Interpolation parameters, or options object containing context
     */
    t(key: string, params?: Record<string, string | number> | { context?: string;[key: string]: string | number | undefined }): string;

    /**
     * Load dictionary
     * @param locale Locale identifier
     * @param dict Dictionary data
     */
    loadDictionary(locale: string, dict: Dictionary): ValidationResult;

    /**
     * Unload dictionary
     * @param locale Locale identifier
     */
    unloadDictionary(locale: string): void;

    /**
     * Set current locale
     * @param locale Locale identifier
     */
    setLocale(locale: string): void;

    /**
     * Get current locale
     */
    getLocale(): string;

    /**
     * Get list of loaded locales (builtin + external)
     */
    getLoadedLocales(): string[];

    /**
     * Get list of builtin locales (translations bundled with the plugin)
     */
    getBuiltinLocales(): string[];

    /**
     * Get list of external imported locales
     */
    getExternalLocales(): string[];

    /**
     * Get builtin dictionary data for specific locale (optional, for editors)
     * @param locale Locale identifier
     */
    getBuiltinDictionary?(locale: string): Dictionary | undefined;

    /**
     * Get dictionary data for specific locale
     * @param locale Locale identifier
     */
    getDictionary(locale: string): Dictionary | undefined;

    /**
     * Validate dictionary format
     * @param dict Dictionary to validate
     */
    validateDictionary(dict: unknown): ValidationResult;
}

// Global type declaration
declare global {
    interface Window {
        i18nPlus?: I18nPlusAPI;
    }
}

export { };
