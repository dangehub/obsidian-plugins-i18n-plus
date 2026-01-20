/**
 * I18n Plus - Dictionary Store
 * 
 * Local dictionary storage service, responsible for:
 * - Persistent storage of dictionary files
 * - Dictionary CRUD operations
 * - Automatically loading installed dictionaries at startup
 */

import { App, normalizePath } from 'obsidian';
import type { Dictionary, ValidationResult } from '../framework/types';
import type I18nPlusPlugin from '../main';
import { getI18nPlusManager } from '../framework/global-api';

/** Dictionary File Info */
export interface DictionaryFileInfo {
    pluginId: string;
    locale: string;
    fileName: string;
    filePath: string;
    dictVersion?: string;
    pluginVersion?: string;
}

/** Dictionary Store Config */
export interface DictionaryStoreConfig {
    /** Dictionary storage root path (relative to vault) */
    basePath: string;
}



/**
 * Dictionary Store Service
 */
export class DictionaryStore {
    private app: App;
    private plugin: I18nPlusPlugin;

    constructor(app: App, plugin: I18nPlusPlugin) {
        this.app = app;
        this.plugin = plugin;
    }

    /**
     * Get dictionary storage root path
     */
    get basePath(): string {
        // Enforce storage in plugin directory: .obsidian/plugins/i18n-plus/dictionaries
        return normalizePath(`${this.plugin.manifest.dir}/dictionaries`);
    }

    /**
     * Ensure storage directory exists
     */
    async ensureDirectory(path: string): Promise<void> {
        const normalizedPath = normalizePath(path);
        const exists = await this.app.vault.adapter.exists(normalizedPath);

        if (!exists) {
            try {
                await this.app.vault.adapter.mkdir(normalizedPath);
            } catch (error) {
                // Ignore "Folder already exists" error
                if (!(error instanceof Error && error.message.includes('Folder already exists'))) {
                    throw error;
                }
            }
        }
    }

    /**
     * Get plugin dictionary directory path
     */
    getPluginDictPath(pluginId: string): string {
        return normalizePath(`${this.basePath}/${pluginId}`);
    }

    /**
     * Get dictionary file path
     */
    getDictionaryFilePath(pluginId: string, locale: string): string {
        return normalizePath(`${this.basePath}/${pluginId}/${locale}.json`);
    }

    /**
     * Save dictionary to local file (supports overwrite)
     */
    async saveDictionary(pluginId: string, locale: string, dict: Dictionary): Promise<void> {
        const dirPath = this.getPluginDictPath(pluginId);
        const filePath = this.getDictionaryFilePath(pluginId, locale);

        // Ensure directory exists
        await this.ensureDirectory(this.basePath);
        await this.ensureDirectory(dirPath);

        // Write file (using adapter API to support overwrite)
        const content = JSON.stringify(dict, null, 2);

        try {
            await this.app.vault.adapter.write(filePath, content);
            console.debug(`[i18n-plus] Saved dictionary: ${filePath}`);
        } catch (error) {
            console.error(`[i18n-plus] Failed to save dictionary: ${filePath}`, error);
            throw error;
        }
    }

    /**
     * Load dictionary from local file
     */
    async loadDictionary(pluginId: string, locale: string): Promise<Dictionary | null> {
        const filePath = this.getDictionaryFilePath(pluginId, locale);

        try {
            if (!(await this.app.vault.adapter.exists(filePath))) {
                return null;
            }
            const content = await this.app.vault.adapter.read(filePath);
            return JSON.parse(content) as Dictionary;
        } catch (error) {
            console.error(`[i18n-plus] Failed to load dictionary: ${filePath}`, error);
            return null;
        }
    }

    /**
     * Delete local dictionary file
     */
    async deleteDictionary(pluginId: string, locale: string): Promise<boolean> {
        const filePath = this.getDictionaryFilePath(pluginId, locale);

        try {
            if (await this.app.vault.adapter.exists(filePath)) {
                await this.app.vault.adapter.remove(filePath);
                console.debug(`[i18n-plus] Deleted dictionary: ${filePath}`);
                return true;
            }
        } catch (error) {
            console.error(`[i18n-plus] Failed to delete dictionary: ${filePath}`, error);
        }

        return false;
    }

    /**
     * Load all local dictionaries for a specific plugin
     * @returns Number of successfully loaded dictionaries
     */
    async loadDictionariesForPlugin(pluginId: string): Promise<number> {
        let count = 0;
        const manager = getI18nPlusManager();

        // Ensure plugin is registered
        if (!manager.getTranslator(pluginId)) {
            return 0;
        }

        const dicts = await this.listAllDictionaries();
        const pluginDicts = dicts.filter(d => d.pluginId === pluginId);

        for (const info of pluginDicts) {
            try {
                if (await this.app.vault.adapter.exists(info.filePath)) {
                    const content = await this.app.vault.adapter.read(info.filePath);
                    const dict = JSON.parse(content);
                    manager.loadDictionary(pluginId, info.locale, dict);
                    count++;
                }
            } catch (e) {
                console.error(`[i18n-plus] Failed to load dictionary for ${pluginId}: ${info.filePath}`, e);
            }
        }

        if (count > 0) {
            console.debug(`[i18n-plus] Loaded ${count} dictionaries for plugin: ${pluginId}`);
        }

        return count;
    }

    /**
     * List all installed dictionaries
     */
    async listAllDictionaries(): Promise<DictionaryFileInfo[]> {
        const result: DictionaryFileInfo[] = [];

        try {
            if (!(await this.app.vault.adapter.exists(this.basePath))) {
                return result;
            }

            const baseList = await this.app.vault.adapter.list(this.basePath);
            if (this.plugin.settings.debugMode) {
                console.debug(`[i18n-plus] Scanning base path: ${this.basePath}`, baseList);
            }

            // Iterate through plugin directories
            for (const pluginFolderPath of baseList.folders) {
                // pluginFolderPath is full path, we need to extract basename for pluginId
                // But normalizePath logic suggests paths are what we expect. 
                // Let's safe extract pluginId
                const pluginId = pluginFolderPath.split('/').pop() || '';
                if (!pluginId) continue;

                const pluginList = await this.app.vault.adapter.list(pluginFolderPath);
                if (this.plugin.settings.debugMode) {
                    console.debug(`[i18n-plus] Scanning plugin folder: ${pluginId}`, pluginList);
                }

                // Iterate through dictionary files
                for (const filePath of pluginList.files) {
                    if (!filePath.endsWith('.json')) continue;

                    const fileName = filePath.split('/').pop() || '';
                    if (!fileName) continue;

                    const locale = fileName.replace('.json', '');

                    // Try to read meta info
                    let dictVersion: string | undefined;
                    let pluginVersion: string | undefined;

                    try {
                        const content = await this.app.vault.adapter.read(filePath);
                        const dict = JSON.parse(content) as Dictionary;
                        dictVersion = dict.$meta?.dictVersion;
                        pluginVersion = dict.$meta?.pluginVersion;
                    } catch (e) {
                        console.warn(`[i18n-plus] Skipped invalid dictionary file: ${filePath}`, e);
                    }

                    result.push({
                        pluginId,
                        locale,
                        fileName: fileName,
                        filePath: filePath,
                        dictVersion,
                        pluginVersion,
                    });
                }
            }
        } catch (error) {
            console.error('[i18n-plus] Failed to list dictionaries', error);
        }

        if (this.plugin.settings.debugMode) {
            console.debug('[i18n-plus] Found dictionaries:', result);
        }

        return result;
    }

    /**
     * List all dictionaries for a specific plugin
     */
    async listPluginDictionaries(pluginId: string): Promise<DictionaryFileInfo[]> {
        const all = await this.listAllDictionaries();
        return all.filter(d => d.pluginId === pluginId);
    }

    /**
     * Import dictionary from JSON file
     * Automatically switch to that locale upon successful import
     */
    async importFromFile(file: File, pluginId: string): Promise<ValidationResult> {
        try {
            const content = await file.text();
            const dict = JSON.parse(content) as Dictionary;

            // Get locale identifier
            const locale = dict.$meta?.locale;
            if (!locale) {
                return {
                    valid: false,
                    errors: [{ key: '$meta.locale', message: 'Dictionary must have $meta.locale field' }],
                };
            }

            // Load into plugin via i18n-plus API
            const manager = getI18nPlusManager();
            const result = manager.loadDictionary(pluginId, locale, dict);

            if (result.valid) {
                // Save to local storage
                await this.saveDictionary(pluginId, locale, dict);

                // Auto-switch to that locale, triggering UI refresh
                manager.setGlobalLocale(locale);
                console.debug(`[i18n-plus] Auto-switched to locale: ${locale}`);
            }

            return result;
        } catch (error) {
            return {
                valid: false,
                errors: [{ key: '$parse', message: `Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}` }],
            };
        }
    }

    /**
     * Export dictionary as JSON file
     */
    async exportToBlob(pluginId: string, locale: string): Promise<Blob | null> {
        const dict = await this.loadDictionary(pluginId, locale);
        if (!dict) return null;

        const content = JSON.stringify(dict, null, 2);
        return new Blob([content], { type: 'application/json' });
    }

    /**
     * Automatically load all installed dictionaries at startup
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
            console.debug(`[i18n-plus] Auto-loaded ${loadedCount} dictionaries`);
        }

        return loadedCount;
    }
}
