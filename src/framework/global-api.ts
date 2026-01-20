/**
 * I18n Plus Framework - Global API
 * 
 * Global API Implementation, exposed to window.i18nPlus
 */

import type {
    Dictionary,
    ValidationResult,
    I18nPlusAPI,
    I18nTranslatorInterface,
} from './types';

type EventCallback = (...args: unknown[]) => void;

/**
 * I18n Plus Global Manager
 */
export class I18nPlusManager implements I18nPlusAPI {
    readonly version = '0.1.0';

    private readonly translators: Map<string, I18nTranslatorInterface> = new Map();
    private readonly eventListeners: Map<string, Set<EventCallback>> = new Map();

    /**
     * Register a plugin's translator instance
     */
    register(pluginId: string, translator: I18nTranslatorInterface): void {
        if (this.translators.has(pluginId)) {
            console.warn(`[i18n-plus] Plugin "${pluginId}" is already registered, replacing...`);
        }

        this.translators.set(pluginId, translator);
        console.debug(`[i18n-plus] Registered plugin: ${pluginId}`);

        // Trigger registration event so the main plugin can auto-load dictionaries
        this.emit('plugin-registered', pluginId);
    }

    /**
     * Unregister a plugin's translator
     */
    unregister(pluginId: string): void {
        if (this.translators.has(pluginId)) {
            this.translators.delete(pluginId);
            console.debug(`[i18n-plus] Unregistered plugin: ${pluginId}`);
        }
    }

    /**
     * Load dictionary for specific plugin
     */
    loadDictionary(pluginId: string, locale: string, dict: Dictionary): ValidationResult {
        const translator = this.translators.get(pluginId);

        if (!translator) {
            return {
                valid: false,
                errors: [{ key: '$plugin', message: `Plugin "${pluginId}" is not registered` }],
            };
        }

        const result = translator.loadDictionary(locale, dict);

        if (result.valid) {
            this.emit('dictionary-loaded', pluginId, locale);
        }

        return result;
    }

    /**
     * Unload dictionary for specific plugin
     */
    unloadDictionary(pluginId: string, locale: string): void {
        const translator = this.translators.get(pluginId);

        if (translator) {
            translator.unloadDictionary(locale);
            this.emit('dictionary-unloaded', pluginId, locale);
        }
    }

    /**
     * Get registered plugins list
     */
    getRegisteredPlugins(): string[] {
        return Array.from(this.translators.keys());
    }

    /**
     * Get loaded locales list for specific plugin
     */
    getLoadedLocales(pluginId: string): string[] {
        const translator = this.translators.get(pluginId);
        return translator?.getLoadedLocales() || [];
    }

    /**
     * Get translator for specific plugin
     */
    getTranslator(pluginId: string): I18nTranslatorInterface | undefined {
        return this.translators.get(pluginId);
    }

    /**
     * Set locale for all registered plugins
     */
    setGlobalLocale(locale: string): void {
        for (const translator of this.translators.values()) {
            translator.setLocale(locale);
        }
        this.emit('locale-changed', locale);
    }

    /**
     * Listen to events
     */
    on(event: string, callback: EventCallback): void {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }
        this.eventListeners.get(event)!.add(callback);
    }

    /**
     * Remove event listener
     */
    off(event: string, callback: EventCallback): void {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.delete(callback);
        }
    }

    /**
     * Emit event
     */
    private emit(event: string, ...args: unknown[]): void {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            for (const callback of listeners) {
                try {
                    callback(...args);
                } catch (error) {
                    console.error(`[i18n-plus] Error in event listener for "${event}":`, error);
                }
            }
        }
    }
}

// Singleton Instance
let instance: I18nPlusManager | null = null;

/**
 * Get or create I18nPlusManager instance
 */
export function getI18nPlusManager(): I18nPlusManager {
    if (!instance) {
        instance = new I18nPlusManager();
    }
    return instance;
}

/**
 * Initialize Global API (called by i18n-plus plugin)
 */
export function initGlobalAPI(): I18nPlusManager {
    const manager = getI18nPlusManager();

    // Expose to global
    if (typeof window !== 'undefined') {
        window.i18nPlus = manager;
        console.debug(`[i18n-plus] Global API initialized (v${manager.version})`);

        // Broadcast ready event so other plugins can re-register
        window.dispatchEvent(new CustomEvent('i18n-plus:ready', {
            detail: { version: manager.version }
        }));
    }

    return manager;
}

/**
 * Destroy Global API (called when plugin unloaded)
 */
export function destroyGlobalAPI(): void {
    if (typeof window !== 'undefined' && window.i18nPlus) {
        delete window.i18nPlus;
        console.debug('[i18n-plus] Global API destroyed');
    }
    instance = null;
}
