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

import { App, Modal, Setting, Notice, setIcon } from 'obsidian';
import type I18nPlusPlugin from '../main';
import { getI18nPlusManager } from '../framework/global-api';
import { DictionaryStore, DictionaryFileInfo } from '../services/dictionary-store';
import { OBSIDIAN_LOCALES } from '../framework/locales';
import { DictionaryEditorModal } from './dictionary-editor-modal';

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
        headerDiv.createEl('h2', { text: 'I18n+ dictionary manager' });

        // Refresh Button
        new Setting(headerDiv)
            .addButton(btn => btn
                .setIcon('refresh-cw')
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
            text: 'Manage and customize translations for your Obsidian plugins.',
            cls: 'setting-item-description'
        });

        // Get Data
        const manager = getI18nPlusManager();
        const registeredPlugins = manager.getRegisteredPlugins();
        const installedDicts = await this.store.listAllDictionaries();

        // Section: Registered Plugins
        const pluginHeader = contentEl.createDiv({ cls: 'i18n-plus-section-header' });
        pluginHeader.createEl('h3', { text: `Registered Plugins (${registeredPlugins.length})` });

        if (registeredPlugins.length === 0) {
            contentEl.createEl('p', {
                text: 'No plugins currently using i18n-plus framework.',
                cls: 'setting-item-description'
            });
        } else {
            const pluginList = contentEl.createDiv({ cls: 'i18n-plus-plugin-list' });
            for (const pluginId of registeredPlugins) {
                this.renderPluginSection(pluginList, pluginId, installedDicts);
            }
        }

        // Section: Orphan Dictionaries
        const orphanDicts = installedDicts.filter(d => !registeredPlugins.includes(d.pluginId));
        if (orphanDicts.length > 0) {
            this.renderOrphanSection(contentEl, orphanDicts);
        }
    }

    /**
     * Render a small badge element
     */
    private renderBadge(container: HTMLElement, text: string, type: 'builtin' | 'external' | 'version'): void {
        container.createSpan({
            text: text.toUpperCase(),
            cls: `i18n-plus-badge i18n-plus-badge-${type}`
        });
    }

    /**
     * Render single plugin section with collapsible functionality
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

        const section = container.createDiv({ cls: 'i18n-plus-plugin-section is-collapsed' });

        // --- Card Header ---
        const cardHeader = section.createDiv({ cls: 'i18n-plus-card-header' });

        const titleArea = cardHeader.createDiv({ cls: 'i18n-plus-card-title' });

        // Collapse Icon (Lucide Chevron)
        const iconSpan = titleArea.createSpan({ cls: 'i18n-plus-collapse-icon' });
        setIcon(iconSpan, 'chevron-down');

        const info = titleArea.createDiv({ cls: 'setting-item-info' });
        info.createDiv({ cls: 'setting-item-name', text: pluginId });
        info.createDiv({
            cls: 'setting-item-description',
            text: `${builtinLocales.length} builtin | ${pluginDicts.length} imported locales`
        });

        const controls = cardHeader.createDiv({ cls: 'setting-item-control' });
        // Prevent header click when interacting with controls
        controls.onClickEvent((e) => e.stopPropagation());

        // Locale Switcher
        const dropdown = controls.createEl('select', { cls: 'dropdown' });
        const allLocales = [...new Set([...builtinLocales, ...externalLocales])];
        for (const locale of allLocales) {
            const localeInfo = OBSIDIAN_LOCALES.find(l => l.code === locale);
            const label = localeInfo ? `${localeInfo.nativeName} (${locale})` : locale;
            const isExternal = externalLocales.includes(locale) && !builtinLocales.includes(locale);

            const option = dropdown.createEl('option', {
                value: locale,
                text: (isExternal ? '📥 ' : '📦 ') + label
            });
            if (locale === currentLocale) option.selected = true;
        }

        dropdown.onchange = () => {
            translator.setLocale(dropdown.value);
            manager.setGlobalLocale(dropdown.value);
            new Notice(`Switched ${pluginId} to ${dropdown.value}`);
        };

        // Import Button
        const importBtn = controls.createEl('button', { cls: 'clickable-icon' });
        importBtn.setAttribute('aria-label', 'Import dictionary');
        setIcon(importBtn, 'file-up');
        importBtn.onclick = () => this.importDictionaryForPlugin(pluginId);

        // --- Card Body ---
        const cardBody = section.createDiv({ cls: 'i18n-plus-card-body' });
        const dictGrid = cardBody.createDiv({ cls: 'i18n-plus-dict-list' });

        // Click to toggle
        cardHeader.onclick = () => {
            section.classList.toggle('is-collapsed');
        };

        // Render Builtin Dictionaries as compact items
        for (const locale of builtinLocales) {
            this.renderBuiltinCompactItem(dictGrid, pluginId, locale);
        }

        // Render External Dictionaries
        for (const dict of pluginDicts) {
            this.renderDictItem(dictGrid, dict);
        }

        if (builtinLocales.length === 0 && pluginDicts.length === 0) {
            cardBody.createEl('div', {
                text: 'No dictionaries available for this plugin.',
                cls: 'i18n-plus-no-dict'
            });
        }
    }

    /**
     * Render a small badge element
     */
    private renderBuiltinCompactItem(container: HTMLElement, pluginId: string, locale: string): void {
        const item = container.createDiv({ cls: 'i18n-plus-dict-item' });
        const inner = item.createDiv({ cls: 'setting-item' });

        const info = inner.createDiv({ cls: 'setting-item-info' });
        const name = info.createDiv({ cls: 'setting-item-name', text: locale });
        this.renderBadge(name, 'Plugin', 'builtin');

        const controls = inner.createDiv({ cls: 'setting-item-control' });

        // Export template only (builtin dictionaries are part of plugin code, cannot be viewed generically)
        const exportBtn = controls.createEl('button', { cls: 'clickable-icon' });
        exportBtn.setAttribute('aria-label', 'Export template');
        setIcon(exportBtn, 'download');
        exportBtn.onclick = () => this.exportBuiltinDictionary(pluginId, locale);
    }

    /**
     * Render single external dictionary item
     */
    private renderDictItem(container: HTMLElement, dict: DictionaryFileInfo) {
        const item = container.createDiv({ cls: 'i18n-plus-dict-item' });
        const inner = item.createDiv({ cls: 'setting-item' });

        const info = inner.createDiv({ cls: 'setting-item-info' });
        const name = info.createDiv({ cls: 'setting-item-name', text: dict.locale });
        this.renderBadge(name, 'Custom', 'external');
        if (dict.dictVersion) {
            this.renderBadge(info.createDiv({ cls: 'setting-item-description' }), `v${dict.dictVersion}`, 'version');
        }

        const controls = inner.createDiv({ cls: 'setting-item-control' });

        // View Content
        const viewBtn = controls.createEl('button', { cls: 'clickable-icon' });
        viewBtn.setAttribute('aria-label', 'View content');
        setIcon(viewBtn, 'eye');
        viewBtn.onclick = (e) => {
            e.stopPropagation();
            new DictionaryEditorModal(this.app, this.plugin, dict.pluginId, dict.locale, false).open();
        };

        // Export
        const exportBtn = controls.createEl('button', { cls: 'clickable-icon' });
        exportBtn.setAttribute('aria-label', 'Export');
        setIcon(exportBtn, 'download');
        exportBtn.onclick = () => this.exportDictionary(dict);

        // Delete - use div instead of button to avoid button.mod-warning red background
        const deleteBtn = controls.createDiv({ cls: 'clickable-icon mod-warning' });
        deleteBtn.setAttribute('aria-label', 'Remove');
        setIcon(deleteBtn, 'trash-2');
        deleteBtn.onclick = () => this.unloadDictionary(dict);
    }

    /**
     * Render Orphan Dictionaries section with collapsible functionality
     */
    private renderOrphanSection(container: HTMLElement, dicts: DictionaryFileInfo[]): void {
        const section = container.createDiv({ cls: 'i18n-plus-plugin-section is-collapsed' });

        // --- Header ---
        const header = section.createDiv({ cls: 'i18n-plus-card-header i18n-plus-orphan-header' });

        const titleArea = header.createDiv({ cls: 'i18n-plus-card-title' });
        const iconSpan = titleArea.createSpan({ cls: 'i18n-plus-collapse-icon' });
        setIcon(iconSpan, 'chevron-down');

        const info = titleArea.createDiv({ cls: 'setting-item-info' });
        info.createDiv({ cls: 'setting-item-name', text: `⚠️ Orphan Dictionaries (${dicts.length})` });
        info.createDiv({
            cls: 'setting-item-description',
            text: 'Dictionaries remaining for uninstalled or disabled plugins.'
        });

        header.onclick = () => {
            section.classList.toggle('is-collapsed');
        };

        // --- Body ---
        const body = section.createDiv({ cls: 'i18n-plus-card-body' });
        const list = body.createDiv({ cls: 'i18n-plus-orphan-list' });

        for (const dict of dicts) {
            const item = new Setting(list)
                .setName(`${dict.pluginId} / ${dict.locale}`)
                .setDesc(dict.dictVersion ? `v${dict.dictVersion}` : '');

            item.addButton(btn => btn
                .setIcon('trash-2')
                .setWarning()
                .onClick(() => {
                    void this.store.deleteDictionary(dict.pluginId, dict.locale).then(() => {
                        new Notice(`Deleted Orphan Dictionary: ${dict.pluginId}-${dict.locale}`);
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
                new Notice(`Imported dictionary for ${pluginId}`);
                void this.onOpen();
            } else {
                const errorMsg = result.errors?.map(e => e.message).join(', ') || 'Unknown validation error';
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
            new Notice('Export failed: could not read file');
            return;
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${dict.pluginId}-${dict.locale}.json`;
        a.click();
        URL.revokeObjectURL(url);

        new Notice(`Exported ${dict.locale} for ${dict.pluginId}`);
    }

    /**
     * Export builtin dictionary (from memory)
     */
    private exportBuiltinDictionary(pluginId: string, locale: string): void {
        const i18nPlusApi = window.i18nPlus;
        const translator = i18nPlusApi?.getTranslator(pluginId);
        if (!translator) {
            new Notice('Unable to get translator instance');
            return;
        }

        const dict = translator.getDictionary(locale) || {};

        const exportData = {
            $meta: {
                pluginId: pluginId,
                pluginVersion: '0.0.0',
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
        new Notice(`Exported builtin template: ${locale}`);
    }

    /**
     * Unload dictionary
     */
    private async unloadDictionary(dict: DictionaryFileInfo) {
        const manager = getI18nPlusManager();
        manager.unloadDictionary(dict.pluginId, dict.locale);
        await this.store.deleteDictionary(dict.pluginId, dict.locale);
        new Notice(`Removed ${dict.locale} dictionary`);
        void this.onOpen();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
