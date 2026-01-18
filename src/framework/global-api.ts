/**
 * I18n Plus Framework - Global API
 * 
 * 全局 API 实现，暴露到 window.i18nPlus
 */

import type {
    Dictionary,
    ValidationResult,
    I18nPlusAPI,
    I18nTranslatorInterface,
} from './types';

type EventCallback = (...args: unknown[]) => void;

/**
 * I18n Plus 全局管理器
 */
export class I18nPlusManager implements I18nPlusAPI {
    readonly version = '0.1.0';

    private readonly translators: Map<string, I18nTranslatorInterface> = new Map();
    private readonly eventListeners: Map<string, Set<EventCallback>> = new Map();

    /**
     * 注册插件的翻译器实例
     */
    register(pluginId: string, translator: I18nTranslatorInterface): void {
        if (this.translators.has(pluginId)) {
            console.warn(`[i18n-plus] Plugin "${pluginId}" is already registered, replacing...`);
        }

        this.translators.set(pluginId, translator);
        console.info(`[i18n-plus] Registered plugin: ${pluginId}`);

        // 触发注册事件，让主插件可以自动加载词典
        this.emit('plugin-registered', pluginId);
    }

    /**
     * 注销插件的翻译器
     */
    unregister(pluginId: string): void {
        if (this.translators.has(pluginId)) {
            this.translators.delete(pluginId);
            console.info(`[i18n-plus] Unregistered plugin: ${pluginId}`);
        }
    }

    /**
     * 为指定插件加载词典
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
     * 卸载指定插件的词典
     */
    unloadDictionary(pluginId: string, locale: string): void {
        const translator = this.translators.get(pluginId);

        if (translator) {
            translator.unloadDictionary(locale);
            this.emit('dictionary-unloaded', pluginId, locale);
        }
    }

    /**
     * 获取已注册的插件列表
     */
    getRegisteredPlugins(): string[] {
        return Array.from(this.translators.keys());
    }

    /**
     * 获取指定插件已加载的语言列表
     */
    getLoadedLocales(pluginId: string): string[] {
        const translator = this.translators.get(pluginId);
        return translator?.getLoadedLocales() || [];
    }

    /**
     * 获取指定插件的翻译器
     */
    getTranslator(pluginId: string): I18nTranslatorInterface | undefined {
        return this.translators.get(pluginId);
    }

    /**
     * 为所有已注册插件设置语言
     */
    setGlobalLocale(locale: string): void {
        for (const translator of this.translators.values()) {
            translator.setLocale(locale);
        }
        this.emit('locale-changed', locale);
    }

    /**
     * 监听事件
     */
    on(event: string, callback: EventCallback): void {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }
        this.eventListeners.get(event)!.add(callback);
    }

    /**
     * 移除事件监听
     */
    off(event: string, callback: EventCallback): void {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.delete(callback);
        }
    }

    /**
     * 触发事件
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

// 单例实例
let instance: I18nPlusManager | null = null;

/**
 * 获取或创建 I18nPlusManager 实例
 */
export function getI18nPlusManager(): I18nPlusManager {
    if (!instance) {
        instance = new I18nPlusManager();
    }
    return instance;
}

/**
 * 初始化全局 API（由 i18n-plus 插件调用）
 */
export function initGlobalAPI(): I18nPlusManager {
    const manager = getI18nPlusManager();

    // 暴露到全局
    if (typeof window !== 'undefined') {
        window.i18nPlus = manager;
        console.info(`[i18n-plus] Global API initialized (v${manager.version})`);

        // 广播 ready 事件，让其他插件可以重新注册
        window.dispatchEvent(new CustomEvent('i18n-plus:ready', {
            detail: { version: manager.version }
        }));
    }

    return manager;
}

/**
 * 销毁全局 API（插件卸载时调用）
 */
export function destroyGlobalAPI(): void {
    if (typeof window !== 'undefined' && window.i18nPlus) {
        delete window.i18nPlus;
        console.info('[i18n-plus] Global API destroyed');
    }
    instance = null;
}
