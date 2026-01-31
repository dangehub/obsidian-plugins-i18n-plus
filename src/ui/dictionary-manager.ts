/**
 * I18n Plus - Dictionary Management View
 * 
 * Dictionary management interface, providing:
 * - Viewing registered plugin list
 * - Distinguishing between builtin and imported locales
 * - Switching plugin languages
 * - Importing/Exporting dictionary files
 * - Unloading dictionaries
 */

import { App, Modal, Setting, Notice, setIcon, SuggestModal } from 'obsidian';
import type I18nPlusPlugin from '../main';
import { getI18nPlusManager } from '../framework/global-api';
import { DictionaryStore, DictionaryFileInfo } from '../services/dictionary-store';
import { OBSIDIAN_LOCALES } from '../framework/locales';
import { t } from '../lang';

/**
 * Dictionary Manager View
 * Renders into a container (Floating Widget) instead of being a Modal itself.
 */
export class DictionaryManagerView {
    private app: App;
    private plugin: I18nPlusPlugin;
    private store: DictionaryStore;

    constructor(app: App, plugin: I18nPlusPlugin) {
        this.app = app;
        this.plugin = plugin;
        this.store = new DictionaryStore(app, plugin);
    }

    async render(container: HTMLElement) {
        container.empty();
        container.addClass('i18n-plus-manager');

        // Header: Compact Layout (Title + Subtitle on Left, Search + Refresh on Right)
        const headerDiv = container.createDiv({ cls: 'i18n-plus-manager-header' });

        // Left side: Title and Stats
        const titleArea = headerDiv.createDiv({ cls: 'i18n-plus-header-left' });
        titleArea.createEl('h2', { text: t('manager.title'), cls: 'i18n-plus-header-title' });
        titleArea.createEl('div', {
            text: 'Manage and customize translations for your Obsidian plugins.',
            cls: 'setting-item-description i18n-plus-header-subtitle'
        });

        // Right side: Controls
        const controlArea = headerDiv.createDiv({ cls: 'i18n-plus-header-right' });

        // Search Input
        const searchContainer = controlArea.createDiv({ cls: 'i18n-plus-search-container' });
        const searchInput = searchContainer.createEl('input', {
            cls: 'i18n-plus-search-input',
            attr: {
                type: 'text',
                placeholder: 'Search plugins...',
            }
        });

        // Refresh Button (Icon Only)
        const refreshBtn = controlArea.createEl('button', {
            cls: 'clickable-icon i18n-plus-refresh-btn'
        });
        setIcon(refreshBtn, 'refresh-cw');
        refreshBtn.setAttribute('aria-label', t('manager.refresh_tooltip'));
        refreshBtn.onclick = () => {
            void this.plugin.dictionaryStore.autoLoadDictionaries().then(count => {
                new Notice(t('notice.refresh_success', { count }));
                void this.render(container);
            });
        };

        // Get Data
        const manager = getI18nPlusManager();
        const registeredPlugins = manager.getRegisteredPlugins();
        const installedDicts = await this.store.listAllDictionaries();

        // Main List Container
        const pluginListContainer = container.createDiv({ cls: 'i18n-plus-plugin-list' });

        const renderFilteredList = (query: string) => {
            pluginListContainer.empty();
            const filteredPlugins = registeredPlugins.filter(id =>
                id.toLowerCase().includes(query.toLowerCase())
            );

            // Section: Registered Plugins Header
            const pluginHeader = pluginListContainer.createDiv({ cls: 'i18n-plus-section-header' });
            pluginHeader.createEl('h3', { text: t('manager.registered_plugins', { count: filteredPlugins.length }) });

            if (filteredPlugins.length === 0) {
                pluginListContainer.createEl('p', {
                    text: query ? 'No plugins matching your search.' : 'No plugins currently using i18n-plus framework.',
                    cls: 'setting-item-description'
                });
            } else {
                for (const pluginId of filteredPlugins) {
                    this.renderPluginSection(pluginListContainer, pluginId, installedDicts);
                }
            }

            // Section: Orphan Dictionaries (only if no search or matches)
            const orphanDicts = installedDicts.filter(d => !registeredPlugins.includes(d.pluginId));
            if (orphanDicts.length > 0) {
                const filteredOrphans = orphanDicts.filter(d =>
                    !query || d.pluginId.toLowerCase().includes(query.toLowerCase())
                );

                if (filteredOrphans.length > 0) {
                    this.renderOrphanSection(pluginListContainer, filteredOrphans);
                }
            }
        };

        // Initial render
        renderFilteredList('');

        // Search event
        searchInput.oninput = () => {
            renderFilteredList(searchInput.value);
        };
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
            text: t('manager.builtin_locales', { count: builtinLocales.length, external: pluginDicts.length })
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
            new Notice(t('notice.switched_locale', { pluginId, locale: dropdown.value }));

            // Hot reload: if switching i18n-plus own language, use FloatingWidget refresh
            if (pluginId === 'i18n-plus') {
                setTimeout(() => {
                    this.plugin.floatingWidget?.refresh();
                }, 50);
            }
        };


        // Import Button
        const importBtn = controls.createEl('button', { cls: 'clickable-icon' });
        importBtn.setAttribute('aria-label', t('action.import_dictionary'));
        setIcon(importBtn, 'file-up');
        importBtn.onclick = () => this.importDictionaryForPlugin(pluginId);

        // Add Button
        const addBtn = controls.createEl('button', { cls: 'clickable-icon' });
        addBtn.setAttribute('aria-label', t('action.add_translation'));
        setIcon(addBtn, 'plus');
        addBtn.onclick = () => this.createNewDictionary(pluginId);

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
        exportBtn.setAttribute('aria-label', t('action.export_template'));
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
        viewBtn.setAttribute('aria-label', t('action.view_content'));
        setIcon(viewBtn, 'eye');
        viewBtn.onclick = (e) => {
            e.stopPropagation();
            this.plugin.showDictionaryEditor(dict.pluginId, dict.locale);
        };

        // Export
        const exportBtn = controls.createEl('button', { cls: 'clickable-icon' });
        exportBtn.setAttribute('aria-label', t('action.export'));
        setIcon(exportBtn, 'download');
        exportBtn.onclick = () => this.exportDictionary(dict);

        // Delete - use div instead of button to avoid button.mod-warning red background
        const deleteBtn = controls.createDiv({ cls: 'clickable-icon mod-warning' });
        deleteBtn.setAttribute('aria-label', t('action.remove'));
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
        info.createDiv({ cls: 'setting-item-name', text: t('manager.orphan_section_title', { count: dicts.length }) });
        info.createDiv({
            cls: 'setting-item-description',
            text: t('manager.orphan_section_desc')
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
                        new Notice(t('notice.deleted_orphan', { pluginId: dict.pluginId, locale: dict.locale }));
                        this.plugin.floatingWidget?.refresh();
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
                new Notice(t('notice.import_success', { pluginId }));
                this.plugin.floatingWidget?.refresh();
            } else {
                const errorMsg = result.errors?.map(e => e.message).join(', ') || 'Unknown validation error';
                new Notice(t('notice.import_failed', { error: errorMsg }));
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
            new Notice(t('notice.export_failed'));
            return;
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${dict.pluginId}-${dict.locale}.json`;
        a.click();
        URL.revokeObjectURL(url);

        new Notice(t('notice.export_success', { locale: dict.locale, pluginId: dict.pluginId }));
    }

    /**
     * Export builtin dictionary (from memory)
     */
    private exportBuiltinDictionary(pluginId: string, locale: string): void {
        const i18nPlusApi = window.i18nPlus;
        const translator = i18nPlusApi?.getTranslator(pluginId);
        if (!translator) {
            new Notice(t('notice.translator_not_found'));
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
        new Notice(t('notice.export_builtin_success', { locale }));
    }

    /**
     * Unload dictionary
     */
    private unloadDictionary(dict: DictionaryFileInfo) {
        new ConfirmModal(this.app,
            t('manager.delete_confirm_title'),
            t('manager.delete_confirm_message', { pluginId: dict.pluginId, locale: dict.locale }),
            t('action.delete'),
            async () => {
                const manager = getI18nPlusManager();
                manager.unloadDictionary(dict.pluginId, dict.locale);
                await this.store.deleteDictionary(dict.pluginId, dict.locale);
                new Notice(t('notice.removed_dict', { locale: dict.locale }));
                this.plugin.floatingWidget?.refresh();
            }
        ).open();
    }

    /**
     * Create new dictionary for plugin
     */
    private createNewDictionary(pluginId: string): void {
        const manager = getI18nPlusManager();
        const translator = manager.getTranslator(pluginId);
        if (!translator) return;

        // Get existing locales to exclude
        const existingLocales = new Set([...translator.getBuiltinLocales(), ...translator.getExternalLocales()]);

        // Filter options
        const options = OBSIDIAN_LOCALES.filter(l => !existingLocales.has(l.code));

        new LocaleSuggestModal(this.app, options, async (selectedLocale) => {
            try {
                // 1. Prepare new dictionary from base content
                const baseLocale = translator.baseLocale;
                const baseDict = translator.getDictionary(baseLocale);

                if (!baseDict) {
                    new Notice(t('notice.base_dict_not_found', { locale: baseLocale }));
                    return;
                }

                // Try to get plugin version
                // @ts-ignore - accessing internal API
                const pluginManifest = (this.app as any).plugins?.manifests?.[pluginId];
                const pluginVersion = pluginManifest?.version || '0.0.0';

                const newDict: any = {
                    $meta: {
                        pluginId: pluginId,
                        pluginVersion: pluginVersion,
                        dictVersion: '1.0.0',
                        locale: selectedLocale.code,
                        author: 'User'
                    }
                };

                // Copy keys with empty values
                for (const key of Object.keys(baseDict)) {
                    if (key !== '$meta') {
                        newDict[key] = "";
                    }
                }

                // 2. Create file
                await this.store.createDictionary(pluginId, selectedLocale.code, newDict);

                // 3. Load into manager
                manager.loadDictionary(pluginId, selectedLocale.code, newDict);

                // 4. Update UI
                new Notice(t('notice.created_dict', { locale: selectedLocale.code }));

                // 5. Open Editor immediately
                this.plugin.showDictionaryEditor(pluginId, selectedLocale.code);

            } catch (error) {
                console.error('[i18n-plus] Failed to create dictionary:', error);
                new Notice(t('notice.create_failed', { error: error instanceof Error ? error.message : String(error) }));
            }
        }).open();
    }
}

interface LocaleOption {
    code: string;
    name: string;
    nativeName: string;
}

/**
 * Modal to select a locale
 * This remains a Modal because it's a short-lived interaction over the top of UI.
 */
class LocaleSuggestModal extends SuggestModal<LocaleOption> {
    private options: LocaleOption[];
    private onSelect: (locale: LocaleOption) => void;

    constructor(app: App, options: LocaleOption[], onSelect: (locale: LocaleOption) => void) {
        super(app);
        this.options = options;
        this.onSelect = onSelect;
        this.setPlaceholder(t('locale_suggest.placeholder'));
    }

    getSuggestions(query: string): LocaleOption[] {
        const lowerQuery = query.toLowerCase();
        return this.options.filter(opt =>
            opt.code.toLowerCase().includes(lowerQuery) ||
            opt.name.toLowerCase().includes(lowerQuery) ||
            opt.nativeName.toLowerCase().includes(lowerQuery)
        );
    }

    renderSuggestion(opt: LocaleOption, el: HTMLElement) {
        el.createDiv({ text: `${opt.nativeName} (${opt.name})` });
        el.createEl('small', { text: opt.code, cls: 'i18n-plus-locale-code' });
    }

    onChooseSuggestion(opt: LocaleOption, evt: MouseEvent | KeyboardEvent) {
        this.onSelect(opt);
    }
}

/**
 * Simple Confirmation Modal
 * This remains a Modal for blocking confirmation.
 */
class ConfirmModal extends Modal {
    private title: string;
    private message: string;
    private ctaText: string;
    private onConfirm: () => void;

    constructor(app: App, title: string, message: string, ctaText: string, onConfirm: () => void) {
        super(app);
        this.title = title;
        this.message = message;
        this.ctaText = ctaText;
        this.onConfirm = onConfirm;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.addClass('i18n-plus-confirm-modal');

        contentEl.createEl('h2', { text: this.title });
        contentEl.createEl('p', { text: this.message });

        const div = contentEl.createDiv({ cls: 'modal-button-container' });

        const btnCancel = div.createEl('button', { text: t('action.cancel') });
        btnCancel.onclick = () => this.close();

        const btnConfirm = div.createEl('button', { text: this.ctaText, cls: 'mod-warning' });
        btnConfirm.onclick = () => {
            this.onConfirm();
            this.close();
        };
    }

    onClose() {
        this.contentEl.empty();
    }
}
