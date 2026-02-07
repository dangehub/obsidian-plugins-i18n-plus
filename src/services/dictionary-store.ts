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
import { ThemeExtractor } from './theme-extractor';

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

/** Theme Dictionary File Info */
export interface ThemeDictionaryFileInfo {
    themeName: string;
    id?: string;
    locale: string;
    fileName: string;
    filePath: string;
    dictVersion?: string;
    sourceHash?: string;
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
     * Get plugins dictionary base path
     */
    get pluginsBasePath(): string {
        return normalizePath(`${this.basePath}/plugins`);
    }

    /**
     * Get themes dictionary base path
     */
    get themesBasePath(): string {
        return normalizePath(`${this.basePath}/themes`);
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
        return normalizePath(`${this.pluginsBasePath}/${pluginId}`);
    }

    /**
     * Get all installed themes (folder names)
     */
    async listInstalledThemes(): Promise<string[]> {
        // @ts-ignore - configDir is available in newer API
        const configDir = this.app.vault.configDir || '.obsidian';
        const themeDir = normalizePath(`${configDir}/themes`);

        if (!(await this.app.vault.adapter.exists(themeDir))) {
            return [];
        }

        const result = await this.app.vault.adapter.list(themeDir);
        return result.folders.map(p => p.split('/').pop() || '').filter(n => n);
    }

    /**
     * Get theme dictionary directory path
     */
    getThemeDictPath(themeName: string): string {
        return normalizePath(`${this.themesBasePath}/${themeName}`);
    }

    /**
     * Get plugin dictionary file path
     */
    getDictionaryFilePath(pluginId: string, locale: string): string {
        return normalizePath(`${this.pluginsBasePath}/${pluginId}/${locale}.json`);
    }

    /**
     * Get theme dictionary file path
     */
    getThemeDictionaryFilePath(themeName: string, locale: string): string {
        return normalizePath(`${this.themesBasePath}/${themeName}/${locale}.json`);
    }

    /**
     * Save dictionary to local file (supports overwrite)
     */
    async saveDictionary(pluginId: string, locale: string, dict: Dictionary): Promise<void> {
        const dirPath = this.getPluginDictPath(pluginId);
        const filePath = this.getDictionaryFilePath(pluginId, locale);

        // Ensure directory exists
        await this.ensureDirectory(this.basePath);
        await this.ensureDirectory(this.pluginsBasePath);
        await this.ensureDirectory(dirPath);

        // Auto-update dictVersion to timestamp if meta exists
        if (dict.$meta) {
            dict.$meta.dictVersion = Date.now().toString();
        }

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
     * Create new dictionary (fails if exists)
     */
    async createDictionary(pluginId: string, locale: string, dict: Dictionary): Promise<void> {
        const filePath = this.getDictionaryFilePath(pluginId, locale);

        if (await this.app.vault.adapter.exists(filePath)) {
            throw new Error(`Dictionary already exists for locale: ${locale}`);
        }

        await this.saveDictionary(pluginId, locale, dict);
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
     * List all installed plugin dictionaries
     */
    async listAllDictionaries(): Promise<DictionaryFileInfo[]> {
        const result: DictionaryFileInfo[] = [];

        try {
            if (!(await this.app.vault.adapter.exists(this.pluginsBasePath))) {
                return result;
            }

            const baseList = await this.app.vault.adapter.list(this.pluginsBasePath);
            if (this.plugin.settings.debugMode) {
                console.debug(`[i18n-plus] Scanning plugins path: ${this.pluginsBasePath}`, baseList);
            }

            // Iterate through plugin directories
            for (const pluginFolderPath of baseList.folders) {
                // pluginFolderPath is full path, we need to extract basename for pluginId
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

    // ========== Theme Dictionary Methods ==========

    /**
     * Theme dictionary file info
     */
    async listAllThemeDictionaries(): Promise<ThemeDictionaryFileInfo[]> {
        const result: ThemeDictionaryFileInfo[] = [];

        try {
            if (!(await this.app.vault.adapter.exists(this.themesBasePath))) {
                return result;
            }

            const baseList = await this.app.vault.adapter.list(this.themesBasePath);
            if (this.plugin.settings.debugMode) {
                console.debug(`[i18n-plus] Scanning themes path: ${this.themesBasePath}`, baseList);
            }

            // Iterate through theme directories
            for (const themeFolderPath of baseList.folders) {
                const themeName = themeFolderPath.split('/').pop() || '';
                if (!themeName) continue;

                const themeList = await this.app.vault.adapter.list(themeFolderPath);

                // Iterate through dictionary files
                for (const filePath of themeList.files) {
                    if (!filePath.endsWith('.json')) continue;

                    const fileName = filePath.split('/').pop() || '';
                    if (!fileName) continue;

                    const locale = fileName.replace('.json', '');

                    // Try to read meta info
                    let dictVersion: string | undefined;
                    let dictId: string | undefined;
                    let sourceHash: string | undefined;

                    try {
                        const content = await this.app.vault.adapter.read(filePath);
                        const dict = JSON.parse(content) as Dictionary;
                        dictVersion = dict.$meta?.dictVersion;
                        dictId = dict.$meta?.id;
                        sourceHash = dict.$meta?.sourceHash;
                    } catch (e) {
                        console.warn(`[i18n-plus] Skipped invalid theme dictionary file: ${filePath}`, e);
                    }

                    result.push({
                        themeName,
                        id: dictId,
                        locale,
                        fileName,
                        filePath,
                        dictVersion,
                        sourceHash,
                    });
                }
            }
        } catch (error) {
            console.error('[i18n-plus] Failed to list theme dictionaries', error);
        }

        if (this.plugin.settings.debugMode) {
            console.debug('[i18n-plus] Found theme dictionaries:', result);
        }

        return result;
    }

    /**
     * Load theme dictionary from local file
     */
    async loadThemeDictionary(themeName: string, locale: string): Promise<Dictionary | null> {
        const filePath = this.getThemeDictionaryFilePath(themeName, locale);

        try {
            if (!(await this.app.vault.adapter.exists(filePath))) {
                return null;
            }
            const content = await this.app.vault.adapter.read(filePath);
            return JSON.parse(content) as Dictionary;
        } catch (error) {
            console.error(`[i18n-plus] Failed to load theme dictionary: ${filePath}`, error);
            return null;
        }
    }

    /**
     * Save theme dictionary to local file
     */
    async saveThemeDictionary(themeName: string, locale: string, dict: Dictionary): Promise<void> {
        const dirPath = this.getThemeDictPath(themeName);
        const filePath = this.getThemeDictionaryFilePath(themeName, locale);

        // Ensure directory exists
        await this.ensureDirectory(this.basePath);
        await this.ensureDirectory(this.themesBasePath);
        await this.ensureDirectory(dirPath);

        // Auto-update dictVersion to timestamp if meta exists
        if (dict.$meta) {
            dict.$meta.dictVersion = Date.now().toString();
        }

        const content = JSON.stringify(dict, null, 2);

        try {
            await this.app.vault.adapter.write(filePath, content);
            console.debug(`[i18n-plus] Saved theme dictionary: ${filePath}`);
        } catch (error) {
            console.error(`[i18n-plus] Failed to save theme dictionary: ${filePath}`, error);
            throw error;
        }
    }

    /**
     * Automatically load all installed theme dictionaries at startup
     */
    async autoLoadThemeDictionaries(): Promise<number> {
        const themeDicts = await this.listAllThemeDictionaries();
        const manager = getI18nPlusManager();
        let loadedCount = 0;

        for (const info of themeDicts) {
            const dict = await this.loadThemeDictionary(info.themeName, info.locale);
            if (dict) {
                manager.loadThemeDictionary(info.themeName, info.locale, dict);
                loadedCount++;
            }
        }

        if (loadedCount > 0) {
            console.debug(`[i18n-plus] Auto-loaded ${loadedCount} theme dictionaries`);
        }

        return loadedCount;
    }

    async deleteThemeDictionary(themeName: string, locale: string): Promise<void> {
        const filePath = this.getThemeDictionaryFilePath(themeName, locale);
        try {
            if (await this.app.vault.adapter.exists(filePath)) {
                await this.app.vault.adapter.remove(filePath);
                console.debug(`[i18n-plus] Deleted theme dictionary: ${filePath}`);
            }
        } catch (e) {
            console.error('[i18n-plus] Failed to delete theme dictionary:', e);
            throw e;
        }
    }

    /**
     * Generate base 'en' dictionary for a theme by scanning its CSS
     */
    async generateBaseThemeDictionary(themeName: string): Promise<ThemeDictionaryFileInfo | null> {
        // 1. Locate theme file
        // Note: configDir might be .obsidian or custom.
        // @ts-ignore
        const configDir = this.app.vault.configDir || '.obsidian';
        const themeDir = normalizePath(`${configDir}/themes/${themeName}`);
        const themePath = normalizePath(`${themeDir}/theme.css`);
        const manifestPath = normalizePath(`${themeDir}/manifest.json`);

        if (!await this.app.vault.adapter.exists(themePath)) {
            console.warn(`Theme CSS not found: ${themePath}`);
            return null;
        }

        // 2. Read content
        const cssContent = await this.app.vault.adapter.read(themePath);

        // 3. Extract strings
        const { strings, hash } = ThemeExtractor.extractSettings(cssContent);
        if (Object.keys(strings).length === 0) {
            return null;
        }

        // 4. Read Manifest for Version
        let themeVersion = '0.0.0';
        try {
            if (await this.app.vault.adapter.exists(manifestPath)) {
                const manifestContent = await this.app.vault.adapter.read(manifestPath);
                const manifest = JSON.parse(manifestContent);
                if (manifest.version) {
                    themeVersion = manifest.version;
                }
            }
        } catch (e) {
            console.warn(`[i18n-plus] Failed to read theme manifest for ${themeName}`, e);
        }

        // 5. Create base dictionary object
        const baseDict: Dictionary = {
            $meta: {
                themeName: themeName,
                themeVersion: themeVersion, // From manifest
                dictVersion: Date.now().toString(), // Use timestamp
                locale: 'en',
                description: 'Automatically extracted from theme.css via Style Settings metadata',
                sourceHash: hash
            },
            ...strings
        };

        // 6. Save to dictionaries/themes/{ThemeName}/en.json
        const targetFolder = normalizePath(`${this.themesBasePath}/${themeName}`);
        await this.ensureDirectory(targetFolder);

        const targetFile = normalizePath(`${targetFolder}/en.json`);
        await this.app.vault.adapter.write(targetFile, JSON.stringify(baseDict, null, 2));

        // Reload themes
        await this.autoLoadThemeDictionaries();

        return {
            themeName: themeName,
            locale: 'en',
            fileName: 'en.json',
            filePath: targetFile,
            dictVersion: baseDict.$meta?.dictVersion
        };
    }

    /**
     * Ensure the base theme dictionary is up to date with theme.css
     */
    async ensureThemeBaseDictionaryUpToDate(themeName: string): Promise<boolean> {
        // 1. Get path
        // @ts-ignore
        const configDir = this.app.vault.configDir || '.obsidian';
        const themePath = normalizePath(`${configDir}/themes/${themeName}/theme.css`);

        if (!await this.app.vault.adapter.exists(themePath)) {
            return false;
        }

        // 2. Read CSS and compute hash
        const cssContent = await this.app.vault.adapter.read(themePath);
        const currentHash = ThemeExtractor.computeHash(cssContent);

        // 3. Check existing dictionary
        const dictPath = normalizePath(`${this.themesBasePath}/${themeName}/en.json`);

        // If en.json doesn't exist, we must generate it (if strings exist)
        if (!await this.app.vault.adapter.exists(dictPath)) {
            // Only generate if there are settings to extract
            // This avoids creating empty folders for themes without settings
            const { strings } = ThemeExtractor.extractSettings(cssContent);
            if (Object.keys(strings).length > 0) {
                console.log(`[i18n-plus] Base dictionary missing for ${themeName}, generating...`);
                await this.generateBaseThemeDictionary(themeName);
                return true;
            }
            return false;
        }

        // If it exists, check hash
        try {
            const content = await this.app.vault.adapter.read(dictPath);
            const dict = JSON.parse(content) as Dictionary;

            // Check matching hash
            if (dict.$meta?.sourceHash === currentHash) {
                // Up to date
                return false;
            }

            console.log(`[i18n-plus] Theme ${themeName} changed (hash mismatch), updating base dictionary...`);
            await this.generateBaseThemeDictionary(themeName);
            return true;
        } catch (e) {
            console.error('[i18n-plus] Failed to check theme dictionary hash:', e);
            return false;
        }

    }
}
