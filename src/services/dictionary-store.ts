/**
 * I18n Plus - Dictionary Store
 * 
 * 本地词典存储服务，负责：
 * - 词典文件的持久化存储
 * - 词典的 CRUD 操作
 * - 启动时自动加载已安装的词典
 */

import { App, TFolder, TFile, normalizePath } from 'obsidian';
import type { Dictionary, ValidationResult } from '../framework/types';
import type I18nPlusPlugin from '../main';
import { getI18nPlusManager } from '../framework/global-api';

/** 词典文件元信息 */
export interface DictionaryFileInfo {
    pluginId: string;
    locale: string;
    fileName: string;
    filePath: string;
    dictVersion?: string;
    pluginVersion?: string;
}

/** 词典存储配置 */
export interface DictionaryStoreConfig {
    /** 词典存储根目录（相对于 vault） */
    basePath: string;
}

const DEFAULT_CONFIG: DictionaryStoreConfig = {
    basePath: '.obsidian/plugins/i18n-plus/dictionaries',
};

/**
 * 词典存储服务
 */
export class DictionaryStore {
    private app: App;
    private plugin: I18nPlusPlugin;

    constructor(app: App, plugin: I18nPlusPlugin) {
        this.app = app;
        this.plugin = plugin;
    }

    /**
     * 获取词典存储根目录路径
     */
    get basePath(): string {
        return normalizePath(this.plugin.settings.dictionaryPath || 'dictionaries');
    }

    /**
     * 确保存储目录存在
     */
    async ensureDirectory(path: string): Promise<void> {
        const normalizedPath = normalizePath(path);
        const folder = this.app.vault.getAbstractFileByPath(normalizedPath);

        if (!folder) {
            try {
                await this.app.vault.createFolder(normalizedPath);
            } catch (error) {
                // 忽略"文件夹已存在"错误（可能由并发创建引起）
                if (!(error instanceof Error && error.message.includes('Folder already exists'))) {
                    throw error;
                }
            }
        }
    }

    /**
     * 获取插件的词典目录路径
     */
    getPluginDictPath(pluginId: string): string {
        return normalizePath(`${this.basePath}/${pluginId}`);
    }

    /**
     * 获取词典文件路径
     */
    getDictionaryFilePath(pluginId: string, locale: string): string {
        return normalizePath(`${this.basePath}/${pluginId}/${locale}.json`);
    }

    /**
     * 保存词典到本地文件（支持覆盖）
     */
    async saveDictionary(pluginId: string, locale: string, dict: Dictionary): Promise<void> {
        const dirPath = this.getPluginDictPath(pluginId);
        const filePath = this.getDictionaryFilePath(pluginId, locale);

        // 确保目录存在
        await this.ensureDirectory(this.basePath);
        await this.ensureDirectory(dirPath);

        // 写入文件（使用 adapter API 支持覆盖）
        const content = JSON.stringify(dict, null, 2);

        try {
            // 直接使用 adapter.write 覆盖文件
            await this.app.vault.adapter.write(filePath, content);
            console.info(`[i18n-plus] Saved dictionary: ${filePath}`);
        } catch (error) {
            console.error(`[i18n-plus] Failed to save dictionary: ${filePath}`, error);
            throw error;
        }
    }

    /**
     * 从本地文件加载词典
     */
    async loadDictionary(pluginId: string, locale: string): Promise<Dictionary | null> {
        const filePath = this.getDictionaryFilePath(pluginId, locale);
        const file = this.app.vault.getAbstractFileByPath(filePath);

        if (!(file instanceof TFile)) {
            return null;
        }

        try {
            const content = await this.app.vault.read(file);
            return JSON.parse(content) as Dictionary;
        } catch (error) {
            console.error(`[i18n-plus] Failed to load dictionary: ${filePath}`, error);
            return null;
        }
    }

    /**
     * 删除本地词典文件
     */
    async deleteDictionary(pluginId: string, locale: string): Promise<boolean> {
        const filePath = this.getDictionaryFilePath(pluginId, locale);
        const file = this.app.vault.getAbstractFileByPath(filePath);

        if (file instanceof TFile) {
            await this.app.vault.delete(file);
            console.info(`[i18n-plus] Deleted dictionary: ${filePath}`);
            return true;
        }

        return false;
    }

    /**
     * 为指定插件加载所有本地词典
     * @returns 加载成功的词典数量
     */
    async loadDictionariesForPlugin(pluginId: string): Promise<number> {
        let count = 0;
        const manager = getI18nPlusManager();

        // 确保插件已注册
        if (!manager.getTranslator(pluginId)) {
            return 0;
        }

        const dicts = await this.listAllDictionaries();
        const pluginDicts = dicts.filter(d => d.pluginId === pluginId);

        for (const info of pluginDicts) {
            try {
                const file = this.app.vault.getAbstractFileByPath(info.filePath);
                if (file instanceof TFile) {
                    const content = await this.app.vault.read(file);
                    const dict = JSON.parse(content);
                    manager.loadDictionary(pluginId, info.locale, dict);
                    count++;
                }
            } catch (e) {
                console.error(`[i18n-plus] Failed to load dictionary for ${pluginId}: ${info.filePath}`, e);
            }
        }

        if (count > 0) {
            console.info(`[i18n-plus] Loaded ${count} dictionaries for plugin: ${pluginId}`);
        }

        return count;
    }

    /**
     * 列出所有已安装的词典
     */
    async listAllDictionaries(): Promise<DictionaryFileInfo[]> {
        const result: DictionaryFileInfo[] = [];
        const baseFolder = this.app.vault.getAbstractFileByPath(this.basePath);

        if (!(baseFolder instanceof TFolder)) {
            return result;
        }

        // 遍历插件目录
        for (const pluginFolder of baseFolder.children) {
            if (!(pluginFolder instanceof TFolder)) continue;

            const pluginId = pluginFolder.name;

            // 遍历词典文件
            for (const file of pluginFolder.children) {
                if (!(file instanceof TFile) || !file.name.endsWith('.json')) continue;

                const locale = file.name.replace('.json', '');

                // 尝试读取元信息
                let dictVersion: string | undefined;
                let pluginVersion: string | undefined;

                try {
                    const content = await this.app.vault.read(file);
                    const dict = JSON.parse(content) as Dictionary;
                    dictVersion = dict.$meta?.dictVersion;
                    pluginVersion = dict.$meta?.pluginVersion;
                } catch {
                    // 忽略解析错误
                }

                result.push({
                    pluginId,
                    locale,
                    fileName: file.name,
                    filePath: file.path,
                    dictVersion,
                    pluginVersion,
                });
            }
        }

        return result;
    }

    /**
     * 列出指定插件的所有词典
     */
    async listPluginDictionaries(pluginId: string): Promise<DictionaryFileInfo[]> {
        const all = await this.listAllDictionaries();
        return all.filter(d => d.pluginId === pluginId);
    }

    /**
     * 从 JSON 文件导入词典
     * 导入成功后自动切换到该语言
     */
    async importFromFile(file: File, pluginId: string): Promise<ValidationResult> {
        try {
            const content = await file.text();
            const dict = JSON.parse(content) as Dictionary;

            // 获取语言标识
            const locale = dict.$meta?.locale;
            if (!locale) {
                return {
                    valid: false,
                    errors: [{ key: '$meta.locale', message: 'Dictionary must have $meta.locale field' }],
                };
            }

            // 通过 i18n-plus API 加载到插件
            const manager = getI18nPlusManager();
            const result = manager.loadDictionary(pluginId, locale, dict);

            if (result.valid) {
                // 保存到本地
                await this.saveDictionary(pluginId, locale, dict);

                // 自动切换到该语言，触发 UI 刷新
                manager.setGlobalLocale(locale);
                console.info(`[i18n-plus] Auto-switched to locale: ${locale}`);
            }

            return result;
        } catch (error) {
            return {
                valid: false,
                errors: [{ key: '$parse', message: `Failed to parse JSON: ${error}` }],
            };
        }
    }

    /**
     * 导出词典为 JSON 文件
     */
    async exportToBlob(pluginId: string, locale: string): Promise<Blob | null> {
        const dict = await this.loadDictionary(pluginId, locale);
        if (!dict) return null;

        const content = JSON.stringify(dict, null, 2);
        return new Blob([content], { type: 'application/json' });
    }

    /**
     * 启动时自动加载所有已安装的词典
     */
    async autoLoadDictionaries(): Promise<number> {
        const dictionaries = await this.listAllDictionaries();
        const manager = getI18nPlusManager();
        let loadedCount = 0;

        for (const info of dictionaries) {
            const dict = await this.loadDictionary(info.pluginId, info.locale);
            if (dict) {
                const result = manager.loadDictionary(info.pluginId, info.locale, dict);
                if (result.valid) {
                    loadedCount++;
                }
            }
        }

        if (loadedCount > 0) {
            console.info(`[i18n-plus] Auto-loaded ${loadedCount} dictionaries`);
        }

        return loadedCount;
    }
}
