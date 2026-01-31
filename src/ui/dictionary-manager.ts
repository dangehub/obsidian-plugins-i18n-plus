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
        headerDiv.createEl('h2', { text: 'I18n+ Dictionary Manager' });

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
        iconSpan.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down"><path d="m6 9 6 6 6-6"/></svg>';

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
        importBtn.setAttribute('aria-label', 'Import Dictionary');
        importBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-file-up"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M12 12v6"/><path d="m15 15-3-3-3 3"/></svg>';
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
        const exportBtn = controls.createEl('button', { cls: 'clickable-icon' });
        exportBtn.setAttribute('aria-label', 'Export Template');
        exportBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-download"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
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

        // Export
        const exportBtn = controls.createEl('button', { cls: 'clickable-icon' });
        exportBtn.setAttribute('aria-label', 'Export');
        exportBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-download"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
        exportBtn.onclick = () => this.exportDictionary(dict);

        // Delete
        const deleteBtn = controls.createEl('button', { cls: 'clickable-icon mod-warning' });
        deleteBtn.setAttribute('aria-label', 'Remove');
        deleteBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash-2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';
        deleteBtn.onclick = () => this.unloadDictionary(dict);
    }

    /**
     * Render Orphan Dictionaries section with collapsible functionality
     */
    private renderOrphanSection(container: HTMLElement, dicts: DictionaryFileInfo[]): void {
        const section = container.createDiv({ cls: 'i18n-plus-plugin-section is-collapsed' });

        // --- Header ---
        const header = section.createDiv({ cls: 'i18n-plus-card-header' });
        header.style.borderLeft = '4px solid var(--color-red)';

        const titleArea = header.createDiv({ cls: 'i18n-plus-card-title' });
        const iconSpan = titleArea.createSpan({ cls: 'i18n-plus-collapse-icon' });
        iconSpan.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down"><path d="m6 9 6 6 6-6"/></svg>';

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
            new Notice('Export failed: Could not read file');
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
