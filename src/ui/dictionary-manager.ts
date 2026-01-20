/**
 * I18n Plus - Dictionary Management Modal
 * 
 * Dictionary management interface, providing:
 * - Viewing registered plugin list
 * - Distinguishing between builtin and imported locales
 * - Switching plugin languages
 * - Importing/Exporting dictionary files
 * - Unloading dictionaries
 */

import { App, Modal, Setting, Notice } from 'obsidian';
import type I18nPlusPlugin from '../main';
import { getI18nPlusManager } from '../framework/global-api';
import { DictionaryStore, DictionaryFileInfo } from '../services/dictionary-store';
import { OBSIDIAN_LOCALES } from '../framework/locales';

/**
 * Dictionary Manager Modal
 */
export class DictionaryManagerModal extends Modal {
    private plugin: I18nPlusPlugin;
    private store: DictionaryStore;

    constructor(app: App, plugin: I18nPlusPlugin) {
        super(app);
        this.plugin = plugin;
        this.store = new DictionaryStore(app, plugin);
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('i18n-plus-manager');

        // Header and Refresh Button
        const headerDiv = contentEl.createDiv({ cls: 'i18n-plus-header' });
        headerDiv.createEl('h2', { text: '📚 Dictionary manager' });

        // Refresh Button
        new Setting(headerDiv)
            .addButton(btn => btn
                .setButtonText('🔄 Refresh')
                .setTooltip('Reload dictionaries and refresh interface')
                .onClick(() => {
                    void this.plugin.dictionaryStore.autoLoadDictionaries().then(count => {
                        new Notice(`Refreshed. Loaded ${count} dictionaries`);
                        void this.onOpen();
                    });
                })
            );

        // Intro
        contentEl.createEl('p', {
            text: 'Manage translation dictionaries for registered plugins.',
            cls: 'setting-item-description'
        });

        // Get Data
        const manager = getI18nPlusManager();
        const registeredPlugins = manager.getRegisteredPlugins();
        const installedDicts = await this.store.listAllDictionaries();

        console.debug('[i18n-plus UI] Registered plugins:', registeredPlugins);
        console.debug('[i18n-plus UI] Installed dicts:', installedDicts);

        // Registered Plugins Section - Use scrollable container
        contentEl.createEl('h3', { text: `Registered Plugins (${registeredPlugins.length})` });

        if (registeredPlugins.length === 0) {
            contentEl.createEl('p', {
                text: 'No plugins registered to i18n-plus.',
                cls: 'setting-item-description'
            });
        } else {
            const pluginList = contentEl.createDiv({ cls: 'i18n-plus-plugin-list' });
            for (const pluginId of registeredPlugins) {
                await this.renderPluginSection(pluginList, pluginId, installedDicts);
            }
        }

        // Orphan Dictionaries
        const orphanDicts = installedDicts.filter(d => !registeredPlugins.includes(d.pluginId));
        if (orphanDicts.length > 0) {
            contentEl.createEl('h3', { text: `⚠️ Orphan Dictionaries (${orphanDicts.length})` });
            contentEl.createEl('p', {
                text: 'Metrics for target plugin not registered',
                cls: 'setting-item-description'
            });
            this.renderOrphanDictsList(contentEl, orphanDicts);
        }
    }

    /**
     * Render single plugin section
     */
    private renderPluginSection(
        container: HTMLElement,
        pluginId: string,
        installedDicts: DictionaryFileInfo[]
    ): void {
        const manager = getI18nPlusManager();
        const translator = manager.getTranslator(pluginId);
        if (!translator) return;

        const builtinLocales = translator.getBuiltinLocales?.() || [];
        const externalLocales = translator.getExternalLocales?.() || [];
        const currentLocale = translator.getLocale();
        const pluginDicts = installedDicts.filter(d => d.pluginId === pluginId);

        const section = container.createDiv({ cls: 'i18n-plus-plugin-section' });

        // Plugin Card
        const pluginSetting = new Setting(section)
            .setName(pluginId)
            .setDesc(this.buildLocaleDescription(builtinLocales, externalLocales));

        // Locale Switcher Dropdown
        pluginSetting.addDropdown(dropdown => {
            // Add all available locales
            const allLocales = [...new Set([...builtinLocales, ...externalLocales])];
            for (const locale of allLocales) {
                const localeInfo = OBSIDIAN_LOCALES.find(l => l.code === locale);
                const label = localeInfo ? `${localeInfo.nativeName} (${locale})` : locale;
                const isExternal = externalLocales.includes(locale) && !builtinLocales.includes(locale);
                dropdown.addOption(locale, isExternal ? `📥 ${label}` : label);
            }
            dropdown.setValue(currentLocale);
            dropdown.onChange((value) => {
                translator.setLocale(value);
                manager.setGlobalLocale(value);
                new Notice(`Switched ${pluginId} locale to: ${value}`);
            });
        });

        // Import Button
        pluginSetting.addButton(btn => btn
            .setButtonText('📥')
            .setTooltip('Import dictionary')
            .onClick(() => this.importDictionaryForPlugin(pluginId))
        );

        // Builtin Dictionary Management
        if (builtinLocales.length > 0) {
            const builtinDiv = section.createDiv({ cls: 'i18n-plus-dict-list' });

            for (const locale of builtinLocales) {
                const item = builtinDiv.createDiv({ cls: 'i18n-plus-dict-item' });
                new Setting(item)
                    .setName(`📦 ${locale} (Builtin)`)
                    .setDesc('Source')
                    .addButton(btn => btn
                        .setIcon('download')
                        .setTooltip('Export (as translation template)')
                        .onClick(() => this.exportBuiltinDictionary(pluginId, locale))
                    );
            }
        }

        // External Dictionary Management (if any)
        if (pluginDicts.length > 0) {
            const dictDiv = section.createDiv({ cls: 'i18n-plus-dict-list' });
            dictDiv.createEl('small', {
                text: `Imported ${pluginDicts.length} dictionaries`,
                cls: 'setting-item-description'
            });
            for (const dict of pluginDicts) {
                this.renderDictItem(dictDiv, dict);
            }
        } else {
            section.createEl('small', {
                text: '0 imported dictionaries',
                cls: 'setting-item-description i18n-plus-no-dict'
            });
        }
    }

    /**
     * Build locale description string
     */
    private buildLocaleDescription(builtinLocales: string[], externalLocales: string[]): string {
        const parts: string[] = [];
        if (builtinLocales.length > 0) {
            parts.push(`Builtin: ${builtinLocales.join(', ')}`);
        }
        if (externalLocales.length > 0) {
            const uniqueExternal = externalLocales.filter(l => !builtinLocales.includes(l));
            if (uniqueExternal.length > 0) {
                parts.push(`Imported: ${uniqueExternal.join(', ')}`);
            }
        }
        return parts.join(' | ');
    }

    /**
     * Render single dictionary item
     */
    private renderDictItem(container: HTMLElement, dict: DictionaryFileInfo) {
        const item = container.createDiv({ cls: 'i18n-plus-dict-item' });

        new Setting(item)
            .setName(`📥 ${dict.locale}`)
            .setDesc(`v${dict.dictVersion || '?'}`)
            .addButton(btn => btn
                .setIcon('download')
                .setTooltip('Export')
                .onClick(() => this.exportDictionary(dict))
            )
            .addButton(btn => btn
                .setIcon('trash')
                .setTooltip('Unload')
                .setWarning()
                .onClick(() => this.unloadDictionary(dict))
            );
    }

    /**
     * Render orphan dictionary list
     */
    private renderOrphanDictsList(container: HTMLElement, dicts: DictionaryFileInfo[]) {
        const list = container.createDiv({ cls: 'i18n-plus-orphan-list' });
        for (const dict of dicts) {
            new Setting(list)
                .setName(`${dict.pluginId} / ${dict.locale}`)
                .addButton(btn => btn
                    .setIcon('trash')
                    .setWarning()
                    .onClick(() => {
                        void this.store.deleteDictionary(dict.pluginId, dict.locale).then(() => {
                            new Notice(`Deleted`);
                            void this.onOpen();
                        });
                    })
                );
        }
    }

    /**
     * Import dictionary for specific plugin
     */
    private importDictionaryForPlugin(pluginId: string) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';

        input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) return;

            const result = await this.store.importFromFile(file, pluginId);

            if (result.valid) {
                new Notice(`✅ Import successful`);
                void this.onOpen();
            } else {
                const errorMsg = result.errors?.map(e => e.message).join(', ') || 'Unknown error';
                new Notice(`❌ Import Failed: ${errorMsg}`);
            }
        };

        input.click();
    }

    /**
     * Export dictionary
     */
    private async exportDictionary(dict: DictionaryFileInfo) {
        const blob = await this.store.exportToBlob(dict.pluginId, dict.locale);
        if (!blob) {
            new Notice('Export failed');
            return;
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${dict.pluginId}-${dict.locale}.json`;
        a.click();
        URL.revokeObjectURL(url);

        new Notice(`Exported`);
    }

    /**
     * Export builtin dictionary (from memory)
     */
    private exportBuiltinDictionary(pluginId: string, locale: string): void {
        // Get translator via global API
        const i18nPlusApi = window.i18nPlus;
        const translator = i18nPlusApi?.getTranslator(pluginId);
        if (!translator) {
            new Notice('Unable to get translator instance');
            return;
        }

        const dict = translator.getDictionary(locale) || {};

        // Construct standard dictionary format (flat structure with $meta)
        const exportData = {
            $meta: {
                pluginId: pluginId,
                pluginVersion: '0.0.0', // Placeholder as we can't get plugin version
                dictVersion: '1.0.0',
                locale: locale,
                author: 'I18n Plus Export',
                description: `Exported builtin dictionary for ${locale}`
            },
            ...dict
        };

        const json = JSON.stringify(exportData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${pluginId}.${locale}.json`;
        a.click();
        URL.revokeObjectURL(url);
        new Notice(`Exported builtin dictionary: ${locale}`);
    }

    /**
     * Unload dictionary
     */
    private async unloadDictionary(dict: DictionaryFileInfo) {
        const manager = getI18nPlusManager();
        manager.unloadDictionary(dict.pluginId, dict.locale);
        await this.store.deleteDictionary(dict.pluginId, dict.locale);
        new Notice(`Unloaded`);
        this.onOpen();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
