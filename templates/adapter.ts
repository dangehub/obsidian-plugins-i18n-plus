import { Plugin } from 'obsidian';
import en from './locales/en';

// 1. 定义翻译器接口
export interface I18nTranslator {
    t(key: string, params?: Record<string, string | number> | { context?: string;[key: string]: any }): string;
}

// 2. 简单的适配器实现
export class I18nAdapter {
    id: string;

    constructor(id: string) {
        this.id = id;
    }

    t(key: string, params?: Record<string, string | number> | { context?: string;[key: string]: any }): string {
        // 如果 i18n-plus 存在，委托给它
        if ((window as any).i18nPlus) {
            const translator = (window as any).i18nPlus.getTranslator(this.id);
            if (translator) {
                return translator.t(key, params);
            }
        }
        // 否则直接返回原文
        let text = key;
        if (params) {
            const { context: _ctx, ...interpolationParams } = params as any;
            for (const k in interpolationParams) {
                text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(interpolationParams[k]));
            }
        }
        return text;
    }
}

// 3. 初始化并注册
export function initI18n(plugin: Plugin): I18nAdapter {
    const adapter = new I18nAdapter(plugin.manifest.id);

    // 闭包状态管理
    let currentLocale = (window as any).moment?.locale() || 'en';
    const dictionaries: Record<string, Record<string, string>> = {};

    const register = () => {
        const i18n = (window as any).i18nPlus;
        if (i18n) {
            i18n.register(plugin.manifest.id, {
                pluginId: plugin.manifest.id,
                baseLocale: 'en',

                getLocale: () => currentLocale,

                setLocale: (locale: string) => {
                    currentLocale = locale;
                    // Dataview 设置页可能需要刷新才能看到效果，或者我们可以通过事件通知
                    // 这里我们尝试触发一个全局重绘事件，或者什么都不做等待用户刷新
                },

                t: (k: string, params?: any) => {
                    // 1. 尝试从当前语言获取
                    const val = dictionaries[currentLocale]?.[k];

                    // 2. 否则回退到 en (静态)
                    const text = val || en[k as keyof typeof en] || k;

                    // 3. 参数插值
                    if (params) {
                        let res = text;
                        const { context: _ctx, ...interpolationParams } = params;
                        for (const key in interpolationParams) {
                            res = res.replace(new RegExp(`\\{${key}\\}`, 'g'), String(interpolationParams[key]));
                        }
                        return res;
                    }
                    return text;
                },

                loadDictionary: (locale: string, dict: Record<string, string>) => {
                    dictionaries[locale] = dict;
                    return { valid: true };
                },

                validateDictionary: () => ({ valid: true }),

                unloadDictionary: (locale: string) => {
                    delete dictionaries[locale];
                },

                getLoadedLocales: () => ['en', ...Object.keys(dictionaries)],

                getBuiltinLocales: () => ['en'],

                getExternalLocales: () => Object.keys(dictionaries),

                // 实现 getDictionary，返回静态生成的词典
                getDictionary: (locale: string) => {
                    if (locale === 'en') {
                        return en;
                    }
                    return dictionaries[locale];
                }
            });
        }
    };

    register();
    window.addEventListener('i18n-plus:ready', register);

    return adapter;
}
