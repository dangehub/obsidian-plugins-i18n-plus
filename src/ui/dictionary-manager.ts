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
import { DictionaryStore, DictionaryFileInfo, ThemeDictionaryFileInfo } from '../services/dictionary-store';
import { RemoteDictionaryInfo } from '../services/cloud-manager';
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
    private containerEl: HTMLElement;

    constructor(app: App, plugin: I18nPlusPlugin) {
        this.app = app;
        this.plugin = plugin;
        this.store = new DictionaryStore(app, plugin);
    }

    private activeTab: 'plugins' | 'themes' = 'plugins';

    async render(container: HTMLElement) {
        this.containerEl = container;
        container.empty();
        container.addClass('i18n-plus-manager');

        // Ensure cloud manifest is loaded or loading
        if (!this.plugin.cloudManager.hasLoaded) {
            void this.plugin.cloudManager.fetchRemoteManifest().then(() => {
                if (container && container.isConnected) {
                    this.render(container);
                }
            });
        }

        this.lastContainer = container;

        // Header: Tabs on Left, Search + Refresh on Right
        const headerDiv = container.createDiv({ cls: 'i18n-plus-manager-header' });

        // Left side: Tabs
        const leftArea = headerDiv.createDiv({ cls: 'i18n-plus-header-left' });

        const tabsContainer = leftArea.createDiv({ cls: 'i18n-plus-tabs' });

        const pluginTab = tabsContainer.createEl('button', {
            text: t('manager.registered_plugins_tab') || 'Plugins', // Fallback if key missing
            cls: `i18n-plus-tab-btn ${this.activeTab === 'plugins' ? 'active' : ''}`
        });
        pluginTab.onclick = () => {
            if (this.activeTab !== 'plugins') {
                this.activeTab = 'plugins';
                this.render(container);
            }
        };

        const themeTab = tabsContainer.createEl('button', {
            text: t('manager.themes_tab') || 'Themes', // Fallback
            cls: `i18n-plus-tab-btn ${this.activeTab === 'themes' ? 'active' : ''}`
        });
        themeTab.onclick = () => {
            if (this.activeTab !== 'themes') {
                this.activeTab = 'themes';
                this.render(container);
            }
        };

        // Right side: Controls
        const controlArea = headerDiv.createDiv({ cls: 'i18n-plus-header-right' });

        // Search Input
        const searchContainer = controlArea.createDiv({ cls: 'i18n-plus-search-container' });
        const searchInput = searchContainer.createEl('input', {
            cls: 'i18n-plus-search-input',
            attr: {
                type: 'text',
                placeholder: this.activeTab === 'plugins'
                    ? (t('manager.search_plugins_placeholder') || 'Search plugins...')
                    : (t('manager.search_themes_placeholder') || 'Search themes...'),
            }
        });

        // Progress Bar (Cloud Fetching)
        if (this.plugin.cloudManager.isFetching) {
            const progressDiv = container.createDiv({ cls: 'i18n-plus-cloud-progress' });
            progressDiv.style.padding = '4px 16px';
            progressDiv.style.background = 'var(--background-secondary)';
            progressDiv.style.borderBottom = '1px solid var(--background-modifier-border)';
            progressDiv.style.display = 'flex';
            progressDiv.style.alignItems = 'center';
            progressDiv.style.gap = '10px';

            progressDiv.createEl('span', { text: '☁️ Syncing cloud data...', cls: 'i18n-plus-loading-text' });
            const progressBar = progressDiv.createEl('progress');
            progressBar.style.flex = '1';
            progressBar.style.height = '6px';
        }

        // Refresh Button (Icon Only)
        const refreshBtn = controlArea.createEl('button', {
            cls: 'clickable-icon i18n-plus-refresh-btn'
        });
        setIcon(refreshBtn, 'refresh-cw');
        refreshBtn.setAttribute('aria-label', t('manager.refresh_tooltip'));
        refreshBtn.onclick = () => {
            refreshBtn.addClass('is-loading');

            // Trigger fetch (force refresh)
            const fetchPromise = this.plugin.cloudManager.fetchRemoteManifest(true);

            // Re-render immediately to show progress bar
            this.render(container);

            void fetchPromise.then(() => {
                void this.plugin.dictionaryStore.autoLoadDictionaries().then(pluginCount => {
                    void this.plugin.dictionaryStore.autoLoadThemeDictionaries().then(themeCount => {
                        refreshBtn.removeClass('is-loading');
                        new Notice(t('notice.refresh_success', { count: pluginCount + themeCount }));
                        // Re-render to hide progress bar and show new data
                        if (container && container.isConnected) {
                            void this.render(container);
                        }
                    });
                });
            });
        };

        // Get Data
        const manager = getI18nPlusManager();
        const registeredPlugins = manager.getRegisteredPlugins();
        const installedDicts = await this.store.listAllDictionaries();
        const installedThemeDicts = await this.store.listAllThemeDictionaries();

        // Theme List Logic
        const installedThemes = await this.store.listInstalledThemes();
        const loadedThemeIds = manager.getLoadedThemes();

        const idToFolderMap = new Map<string, string>();
        for (const dict of installedThemeDicts) {
            if (dict.id && dict.themeName) {
                idToFolderMap.set(dict.id, dict.themeName);
            }
        }

        const themesToShow = new Set<string>();
        // Add installed folders
        installedThemes.forEach(t => themesToShow.add(t));

        // Only add loaded IDs if they map to a known folder or are a known folder
        for (const id of loadedThemeIds) {
            const folder = idToFolderMap.get(id) || id;
            if (installedThemes.includes(folder)) {
                themesToShow.add(folder);
            }
        }
        const allThemes = Array.from(themesToShow).sort((a, b) => a.localeCompare(b));

        // Main List Container
        const contentContainer = container.createDiv({ cls: 'i18n-plus-content-list' });

        const renderFilteredList = (query: string) => {
            contentContainer.empty();
            const lowerQuery = query.toLowerCase();

            if (this.activeTab === 'plugins') {
                // Filter Plugins
                const filteredPlugins = registeredPlugins.filter(id =>
                    id.toLowerCase().includes(lowerQuery)
                );

                if (filteredPlugins.length > 0 || !query) {
                    if (filteredPlugins.length === 0) {
                        contentContainer.createEl('div', {
                            text: 'No plugins found.',
                            cls: 'setting-item-description i18n-plus-list-empty-msg'
                        });
                    }
                    for (const pluginId of filteredPlugins) {
                        this.renderPluginSection(contentContainer, pluginId, installedDicts);
                    }
                }

                // Section: Orphan Dictionaries
                const orphanDicts = installedDicts.filter(d => !registeredPlugins.includes(d.pluginId));
                if (orphanDicts.length > 0) {
                    const filteredOrphans = orphanDicts.filter(d =>
                        !query || d.pluginId.toLowerCase().includes(lowerQuery)
                    );

                    if (filteredOrphans.length > 0) {
                        this.renderOrphanSection(contentContainer, filteredOrphans);
                    }
                }

                if (filteredPlugins.length === 0 && (!orphanDicts.length || orphanDicts.every(d => !d.pluginId.toLowerCase().includes(lowerQuery)))) {
                    contentContainer.createEl('p', {
                        text: query ? 'No plugins matching your search.' : 'No plugins registered.',
                        cls: 'setting-item-description'
                    });
                }

            } else {
                // Filter Themes
                const filteredThemes = allThemes.filter(id =>
                    id.toLowerCase().includes(lowerQuery)
                );

                if (filteredThemes.length > 0) {
                    for (const themeId of filteredThemes) {
                        this.renderThemeSection(contentContainer, themeId, installedThemeDicts);
                    }
                } else {
                    contentContainer.createEl('p', {
                        text: query ? 'No themes matching your search.' : 'No themes found.',
                        cls: 'setting-item-description'
                    });
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
     * Handle cloud dictionary download and installation
     */
    private async handleCloudDownload(remote: RemoteDictionaryInfo, isTheme: boolean = false): Promise<void> {
        try {
            // Simple visual feedback could be added here
            const dict = await this.plugin.cloudManager.downloadDictionary(remote.downloadUrl);

            const manager = getI18nPlusManager();
            const id = isTheme ? (remote.themeName || remote.pluginId) : remote.pluginId; // Fallback

            if (!id) throw new Error("Missing ID in remote info");

            if (isTheme) {
                // Save and Load Theme Dictionary
                await this.store.saveThemeDictionary(id, remote.locale, dict);
                manager.loadThemeDictionary(id, remote.locale, dict);
            } else {
                // Save and Load Plugin Dictionary
                await this.store.saveDictionary(id, remote.locale, dict);
                manager.loadDictionary(id, remote.locale, dict);
            }

            new Notice(t('notice.save_success', { locale: remote.locale }));

            // Refresh current view if possible
            if (this.lastContainer) {
                void this.render(this.lastContainer);
            }
        } catch (error) {
            new Notice(`Download failed: ${error instanceof Error ? error.message : String(error)}`);
            console.error(error);
        }
    }

    private lastContainer: HTMLElement | null = null;

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
            // Use Overlay status if both exist? The translator.getExternalLocales() just lists folders.
            // But manager knows if it's overlay.

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

        // Smart Recommendation: Check if current locale is missing locally but available in cloud
        const currentGlobalLocale = manager.getGlobalLocale() || 'en';

        // Handle zh/zh-CN ambiguity
        const targetLocales = [currentGlobalLocale];
        if (currentGlobalLocale === 'zh') targetLocales.push('zh-CN');
        if (currentGlobalLocale === 'zh-CN') targetLocales.push('zh');

        const isLocallyAvailable = builtinLocales.some(l => targetLocales.includes(l)) ||
            pluginDicts.some(d => targetLocales.includes(d.locale));

        if (!isLocallyAvailable) {
            const cloudDicts = this.plugin.cloudManager.getCloudDictsForPlugin(pluginId);
            const cloudMatch = cloudDicts.find(d => targetLocales.includes(d.locale));

            if (cloudMatch) {
                const downloadBtn = controls.createEl('button', { cls: 'mod-cta' });
                // Prominent button style
                downloadBtn.textContent = t('action.download_locale', { locale: currentGlobalLocale }) || `Download ${currentGlobalLocale}`;
                downloadBtn.style.marginRight = '8px';
                setIcon(downloadBtn, 'cloud-download');
                downloadBtn.onclick = async (e) => {
                    e.stopPropagation();
                    await this.handleCloudDownload(cloudMatch);
                };
            }
        }

        // Cloud Controls
        // this.renderCloudControls(controls, pluginId, pluginDicts);

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

        // Unified Dictionary Rendering
        const allDictLocales = new Set([...builtinLocales, ...pluginDicts.map(d => d.locale)]);
        // Sort locales
        const sortedLocales = Array.from(allDictLocales).sort();

        for (const locale of sortedLocales) {
            const isBuiltin = builtinLocales.includes(locale);
            const externalFile = pluginDicts.find(d => d.locale === locale);

            let type: 'builtin' | 'external' | 'overlay' = 'external';
            if (isBuiltin && externalFile) type = 'overlay';
            else if (isBuiltin) type = 'builtin';
            else type = 'external';

            this.renderUnifiedDictItem(dictGrid, locale, type, externalFile, pluginId);
        }

        if (allDictLocales.size === 0) {
            cardBody.createEl('div', {
                text: 'No dictionaries available for this plugin.',
                cls: 'i18n-plus-no-dict'
            });
        }
    }

    /**
     * Render a unified dictionary item (handling builtin, external, overlay)
     */
    private renderUnifiedDictItem(
        container: HTMLElement,
        locale: string,
        type: 'builtin' | 'external' | 'overlay',
        dictFile: DictionaryFileInfo | undefined,
        pluginId: string
    ) {
        const item = container.createDiv({ cls: 'i18n-plus-dict-item' });
        const inner = item.createDiv({ cls: 'setting-item' });

        const info = inner.createDiv({ cls: 'setting-item-info' });
        const name = info.createDiv({ cls: 'setting-item-name', text: locale });

        // Badges
        let labelKey = '';
        let badgeClass = '';
        if (type === 'builtin') { labelKey = 'label.builtin'; badgeClass = 'builtin'; }
        else if (type === 'external') { labelKey = 'label.external'; badgeClass = 'external'; }
        else { labelKey = 'label.overlay'; badgeClass = 'external'; } // Overlay uses external style but different text

        this.renderBadge(name, t(labelKey as any) || labelKey, badgeClass as any);

        // Version badge (from external file)
        if (dictFile && dictFile.dictVersion) {
            this.renderBadge(info.createDiv({ cls: 'setting-item-description' }), `v${dictFile.dictVersion}`, 'version');
        }

        // Check for Cloud Update
        // We only check for external files (or overlay which implies underlying external). 
        // Built-in theoretically updates with plugin, but if we support "cloud override" later, we might check there too.
        // For now, let's check for all, but only enable update action for external/overlay?
        // Actually, if built-in is outdated compared to cloud, we CAN download cloud version as an external override.
        // But for simplicity in this pass, let's stick to updating existing external files or adding new ones via UI.
        // If it's built-in, downloading cloud version essentially creates an "Overlay"/"External" file.

        let updateAvailable: RemoteDictionaryInfo | null = null;
        if (pluginId) {
            const cloudDicts = this.plugin.cloudManager.getCloudDictsForPlugin(pluginId);
            const remote = cloudDicts.find(d => d.locale === locale);
            if (remote) {
                // If dictFile exists, check version. If not (shouldn't happen here as this renders existing), treat as logic error or ignore.
                if (dictFile && this.plugin.cloudManager.isUpdateAvailable(dictFile.dictVersion || '0.0.0', remote.dictVersion)) {
                    updateAvailable = remote;
                }
            }
        }

        const controls = inner.createDiv({ cls: 'setting-item-control' });

        if (updateAvailable) {
            const updateBtn = controls.createEl('button', { cls: 'clickable-icon is-update' });
            updateBtn.setAttribute('aria-label', t('action.update_available', { version: updateAvailable.dictVersion }) || `Update to v${updateAvailable.dictVersion}`);
            setIcon(updateBtn, 'refresh-ccw-dot');
            updateBtn.onclick = () => this.handleCloudDownload(updateAvailable!);
        }

        // View Content
        const viewBtn = controls.createEl('button', { cls: 'clickable-icon' });
        viewBtn.setAttribute('aria-label', t('action.view_content'));
        setIcon(viewBtn, 'eye');
        viewBtn.onclick = (e) => {
            e.stopPropagation();
            // If overlay or external, treat as external (editable).
            // If builtin, treat as builtin (read-only).
            // Note: Overlay effectively edits the external file, so isBuiltin=false.
            const isBuiltinForEdit = (type === 'builtin');
            this.plugin.showDictionaryEditor(pluginId, locale, undefined, isBuiltinForEdit);
        };

        // Export
        const exportBtn = controls.createEl('button', { cls: 'clickable-icon' });
        exportBtn.setAttribute('aria-label', type === 'builtin' ? t('action.export_template') : t('action.export'));
        setIcon(exportBtn, 'download');
        exportBtn.onclick = () => {
            if (type === 'builtin') {
                this.exportBuiltinDictionary(pluginId, locale);
            } else if (dictFile) {
                this.exportDictionary(dictFile);
            }
        };

        // Delete
        // Only show for External or Overlay (deleting overlay removes external file)
        if (type !== 'builtin') {
            const deleteBtn = controls.createDiv({ cls: 'clickable-icon mod-warning' });
            deleteBtn.setAttribute('aria-label', t('action.remove'));
            setIcon(deleteBtn, 'trash-2');
            deleteBtn.onclick = () => {
                if (dictFile) this.unloadDictionary(dictFile);
            };
        } else {
            // Placeholder to keep alignment? No need, flexbox handles it.
            // Or maybe a disabled icon to indicate undeletable? User requested "Built-in cannot be deleted"
            // Just not showing the button is standard behavior.
        }
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
        const fullDict = await this.store.loadDictionary(dict.pluginId, dict.locale);
        if (!fullDict) {
            new Notice(t('notice.export_failed'));
            return;
        }

        // Clone and clean metadata
        const exportDict = JSON.parse(JSON.stringify(fullDict));
        if (exportDict.$meta) {
            // Reconstruct meta to enforce order
            const oldMeta = exportDict.$meta;
            exportDict.$meta = {
                pluginId: oldMeta.pluginId,
                pluginVersion: oldMeta.pluginVersion,
                dictVersion: oldMeta.dictVersion,
                locale: oldMeta.locale,
                description: oldMeta.description
            };
        }

        const json = JSON.stringify(exportDict, null, 2);
        const blob = new Blob([json], { type: 'application/json' });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${dict.pluginId}_${dict.locale}.json`;
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

        // Try to get plugin version
        // @ts-ignore - accessing internal API
        const pluginManifest = (this.app as any).plugins?.manifests?.[pluginId];

        if (!pluginManifest || !pluginManifest.version) {
            new Notice(`Failed to export: Version not found for plugin ${pluginId}`);
            return;
        }

        const pluginVersion = pluginManifest.version;
        const dict = translator.getDictionary(locale) || {};

        const exportData = {
            $meta: {
                pluginId: pluginId,
                pluginVersion: pluginVersion,
                dictVersion: Date.now().toString(),
                locale: locale,
                // author: 'I18n Plus Export', // Removed
                description: `Exported builtin dictionary for ${locale}`
            },
            ...dict
        };

        const json = JSON.stringify(exportData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${pluginId}_${locale}.json`;
        a.click();
        URL.revokeObjectURL(url);
        new Notice(t('notice.export_builtin_success', { locale }));
    }

    /**
     * Unload dictionary
     */
    private unloadDictionary(dict: DictionaryFileInfo) {
        this.showConfirm(
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
        );
    }

    /**
     * Create new dictionary for plugin
     */
    /**
     * Create new dictionary for plugin
     */
    private createNewDictionary(pluginId: string): void {
        const manager = getI18nPlusManager();
        const translator = manager.getTranslator(pluginId);
        if (!translator) return;

        // Get existing locales to exclude (locally installed)
        const existingLocales = new Set([...translator.getBuiltinLocales(), ...translator.getExternalLocales()]);

        // Get cloud dicts
        const cloudDicts = this.plugin.cloudManager.getCloudDictsForPlugin(pluginId);

        // Prepare options: Filter out existing locally, but map remainder to cloud info
        const options: LocaleOption[] = OBSIDIAN_LOCALES
            .filter(l => !existingLocales.has(l.code))
            .map(l => {
                const remote = cloudDicts.find(d => d.locale === l.code);
                return { ...l, cloudInfo: remote };
            });

        this.showLocaleSelector(options, async (selectedLocale) => {
            // 1. Check Cloud
            if (selectedLocale.cloudInfo) {
                await this.handleCloudDownload(selectedLocale.cloudInfo);
                return;
            }

            try {
                // 2. Prepare new dictionary from base content
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

                // 3. Create file
                await this.store.createDictionary(pluginId, selectedLocale.code, newDict);

                // 4. Load into manager
                manager.loadDictionary(pluginId, selectedLocale.code, newDict);

                // 5. Update UI
                new Notice(t('notice.created_dict', { locale: selectedLocale.code }));

                // 6. Open Editor immediately
                // We show editor for the newly created file (external, so isBuiltin=false)
                this.plugin.showDictionaryEditor(pluginId, selectedLocale.code, undefined, false);

                // Refresh list
                this.plugin.floatingWidget?.refresh();

            } catch (error) {
                console.error('[i18n-plus] Failed to create dictionary:', error);
                new Notice(t('notice.create_failed', { error: String(error) }));
            }
        });
    }



    /**
     * Render single theme section with collapsible functionality
     */
    private renderThemeSection(
        container: HTMLElement,
        themeName: string,
        themeDicts: ThemeDictionaryFileInfo[]
    ): void {
        const currentDicts = themeDicts.filter(d => d.themeName === themeName || d.id === themeName);
        const section = container.createDiv({ cls: 'i18n-plus-plugin-section is-collapsed' });

        // --- Card Header ---
        const cardHeader = section.createDiv({ cls: 'i18n-plus-card-header' });
        const titleArea = cardHeader.createDiv({ cls: 'i18n-plus-card-title' });

        // Collapse Icon
        const iconSpan = titleArea.createSpan({ cls: 'i18n-plus-collapse-icon' });
        setIcon(iconSpan, 'chevron-down');

        const info = titleArea.createDiv({ cls: 'setting-item-info' });
        info.createDiv({ cls: 'setting-item-name', text: themeName });
        info.createDiv({
            cls: 'setting-item-description',
            text: `${currentDicts.length} ${t('manager.dictionaries_suffix') || 'dictionaries'}`
        });

        const controls = cardHeader.createDiv({ cls: 'setting-item-control' });
        controls.onClickEvent((e) => e.stopPropagation());
        controls.addEventListener('mousedown', (e) => e.stopPropagation()); // Prevent header drag or other mouse interactions

        // Locale Switcher for Theme (actually switches global locale as themes are context-dependent)
        const dropdown = controls.createEl('select', { cls: 'dropdown' });
        // Gather locales: 'en', installed dicts, and current locale
        // We don't have 'builtin' list for themes, so we assume 'en' is base.
        const manager = getI18nPlusManager();
        // Since getLocale() isn't exposed on manager directly (it is private currentLocale), we can assume
        // we should track it or pass it. But wait, Plugin section uses `manager.setGlobalLocale`.
        // To GET current locale, we might need manager.currentLocale (private) or just rely on what we passed?
        // Actually Plugin section does NOT get it from manager, it gets it from `translator.getLocale()`.
        // For themes, we don't have a translator. 
        // We need `manager.currentLocale`. Let's check `I18nPlusManager` again. 
        // Ref: global-api.ts shows `private currentLocale`. It doesn't seem to expose a getter?
        // Wait, `getGlobalLocale` is missing?
        // Let's assume we can add it or it exists and I check logic later.
        // Or since `DictionaryManagerView` renders, it might know?
        // Wait, `render` doesn't receive locale.
        // Let's check `I18nPlusManager` again.

        // Let's try to access it via `(manager as any).currentLocale` temporary or better: 
        // `manager.getTranslator('i18n-plus')?.getLocale()` as a proxy for global? 
        // Since setGlobalLocale sets all translators.
        // Let's use 'en' as default if unknown.

        const currentGlobalLocale = manager.getGlobalLocale() || 'en';

        const installedLocales = themeDicts
            .filter(d => d.themeName === themeName)
            .map(d => d.locale);

        const optionLocales = new Set(['en', ...installedLocales, currentGlobalLocale]);

        // Convert to array and sort
        const sortedLocales = Array.from(optionLocales).sort();

        for (const locale of sortedLocales) {
            const localeInfo = OBSIDIAN_LOCALES.find(l => l.code === locale);
            const label = localeInfo ? `${localeInfo.nativeName} (${locale})` : locale;
            const isExternal = installedLocales.includes(locale); // Installed dicts are "external" in this context

            const option = dropdown.createEl('option', {
                value: locale,
                text: (isExternal ? '📄 ' : '🌐 ') + label // Icon diff: File vs Web/Global
            });
            if (locale === currentGlobalLocale) option.selected = true;
        }

        dropdown.onchange = () => {
            manager.setGlobalLocale(dropdown.value);
            new Notice(t('notice.switched_locale', { pluginId: 'Global', locale: dropdown.value }));
            // Refresh UI handled by event listener in main.ts? or standard refresh?
            // Plugin switcher does NOT call render(), relies on notice.
            // But if we want to see the dropdown update? Dropdown updates itself.
        };

        // Smart Recommendation: Check if current global locale is missing locally but available in cloud
        // Theme logic uses currentGlobalLocale (which maps to Obsidian language usually)
        const isThemeLocallyAvailable = installedLocales.includes(currentGlobalLocale);
        if (!isThemeLocallyAvailable) {
            const cloudDicts = this.plugin.cloudManager.getCloudDictsForTheme(themeName);
            const cloudMatch = cloudDicts.find(d => d.locale === currentGlobalLocale);

            if (cloudMatch) {
                const downloadBtn = controls.createEl('button', { cls: 'mod-cta' });
                downloadBtn.textContent = t('action.download_locale', { locale: currentGlobalLocale }) || `Download ${currentGlobalLocale}`;
                downloadBtn.style.marginRight = '8px';
                setIcon(downloadBtn, 'cloud-download');
                downloadBtn.onclick = async (e) => {
                    e.stopPropagation();
                    await this.handleCloudDownload(cloudMatch, true);
                };
            }
        }

        // Cloud Controls
        // this.renderCloudControls(controls, themeName, currentDicts, true);

        // Import Button
        const importBtn = controls.createEl('button', { cls: 'clickable-icon' });
        importBtn.setAttribute('aria-label', t('action.import_dictionary'));
        setIcon(importBtn, 'file-up');
        importBtn.onclick = () => this.importDictionaryForTheme(themeName);

        // Auto Extract Button
        // Check if 'en' dictionary exists
        const hasEn = currentDicts.some(d => d.locale === 'en');

        // Auto-check for theme dictionary updates (async)
        this.checkThemeUpdate(themeName, hasEn);

        // Add Button
        const addBtn = controls.createEl('button', { cls: 'clickable-icon' });
        addBtn.setAttribute('aria-label', t('action.add_translation'));
        setIcon(addBtn, 'plus');
        addBtn.onclick = () => this.createNewThemeDictionary(themeName);

        // --- Card Body ---
        const cardBody = section.createDiv({ cls: 'i18n-plus-card-body' });
        const dictGrid = cardBody.createDiv({ cls: 'i18n-plus-dict-list' });

        // Click to toggle
        cardHeader.onclick = () => {
            section.classList.toggle('is-collapsed');
        };

        // Render Dictionaries
        for (const dict of currentDicts) {
            this.renderThemeDictItem(dictGrid, dict);
        }

        if (currentDicts.length === 0) {
            cardBody.createEl('div', {
                text: 'No dictionaries available for this theme.', // TODO: Add lang key
                cls: 'i18n-plus-no-dict'
            });
        }
    }

    /**
     * Check for theme updates and auto-refresh
     */
    private checkThemeUpdate(themeName: string, hasEn: boolean) {
        // If we don't have base dict, or we want to ensure it's up to date
        // We run this asynchronously to avoid blocking UI rendering
        setTimeout(async () => {
            try {
                const updated = await this.store.ensureThemeBaseDictionaryUpToDate(themeName);
                if (updated) {
                    new Notice(hasEn ? t('notice.theme_updated', { theme: themeName }) || `Updated base dictionary for ${themeName}` : t('notice.theme_generated', { theme: themeName }) || `Generated base dictionary for ${themeName}`);
                    // Refresh view to show updated version/content
                    this.plugin.showDictionaryManager();
                    // Or better: re-render just this section? 
                    // Since layout can change, full re-render is safer but might close potential other open sections?
                    // Currently showDictionaryManager() clears and rebuilds.
                }
            } catch (e) {
                console.error(`[i18n-plus] Auto-update check failed for ${themeName}`, e);
            }
        }, 100);
    }

    /**
     * Render single theme dictionary item
     */
    /**
     * Render single theme dictionary item
     */
    private renderThemeDictItem(container: HTMLElement, dict: ThemeDictionaryFileInfo) {
        const item = container.createDiv({ cls: 'i18n-plus-dict-item' });
        const inner = item.createDiv({ cls: 'setting-item' });

        const info = inner.createDiv({ cls: 'setting-item-info' });
        const name = info.createDiv({ cls: 'setting-item-name', text: dict.locale });

        const isBuiltin = !!dict.sourceHash;

        if (isBuiltin) {
            this.renderBadge(name, t('label.theme_builtin') || 'THEME BASE', 'builtin');
        } else {
            this.renderBadge(name, t('label.external') || 'EXTERNAL', 'external');
        }

        if (dict.dictVersion) {
            this.renderBadge(info.createDiv({ cls: 'setting-item-description' }), `v${dict.dictVersion}`, 'version');
        }

        const controls = inner.createDiv({ cls: 'setting-item-control' });

        // View Content (Editor)
        const viewBtn = controls.createEl('button', { cls: 'clickable-icon' });
        viewBtn.setAttribute('aria-label', t('action.view_content'));
        setIcon(viewBtn, 'eye');
        viewBtn.onclick = (e) => {
            e.stopPropagation();
            this.plugin.showDictionaryEditor(null, dict.locale, dict.themeName, isBuiltin);
        };

        // Export
        const exportBtn = controls.createEl('button', { cls: 'clickable-icon' });
        exportBtn.setAttribute('aria-label', t('action.export'));
        setIcon(exportBtn, 'download');
        exportBtn.onclick = () => this.exportThemeDictionary(dict);

        // Delete (Only for non-builtin)
        if (!isBuiltin) {
            const deleteBtn = controls.createDiv({ cls: 'clickable-icon mod-warning' });
            deleteBtn.setAttribute('aria-label', t('action.remove'));
            setIcon(deleteBtn, 'trash-2');
            deleteBtn.onclick = () => this.unloadThemeDictionary(dict);
        }
    }

    /**
     * Create new theme dictionary
     */
    private createNewThemeDictionary(themeName: string): void {
        const manager = getI18nPlusManager();
        const cloudDicts = this.plugin.cloudManager.getCloudDictsForTheme(themeName);

        // We need existing locales to exclude them from "New" list if desirable, 
        // OR we just show all and let the overwrite check handle it.
        // Existing implementation just checked overwrites. Let's stick to that but maybe mark existing?
        // Actually, listing ALL locales is better if we want to support "Re-download" functionality via this menu?
        // But "Update" handles re-download.
        // Let's filter out existing ones to avoid confusion, or show them as disabled?
        // For consistency with plugin flow, let's TRY to filter if we knew them. 
        // We can get them from store (async) or pass them in. 
        // For now, let's just map all and let check handle it.

        const options: LocaleOption[] = OBSIDIAN_LOCALES.map(l => {
            const remote = cloudDicts.find(d => d.locale === l.code);
            return { ...l, cloudInfo: remote };
        });

        this.showLocaleSelector(options, async (selectedLocale) => {
            // 1. Cloud Download
            if (selectedLocale.cloudInfo) {
                await this.handleCloudDownload(selectedLocale.cloudInfo, true);
                return;
            }

            try {
                // Check if exists
                const exists = await this.store.loadThemeDictionary(themeName, selectedLocale.code);
                if (exists) {
                    new Notice(`Dictionary for ${selectedLocale.code} already exists.`);
                    return;
                }

                // Create new basic dict
                const newDict: any = {
                    $meta: {
                        themeName: themeName,
                        themeVersion: '0.0.0', // Placeholder
                        dictVersion: Date.now().toString(),
                        locale: selectedLocale.code,
                        description: `User created dictionary for ${themeName}`
                    }
                };

                await this.store.saveThemeDictionary(themeName, selectedLocale.code, newDict);
                manager.loadThemeDictionary(themeName, selectedLocale.code, newDict);

                new Notice(t('notice.created_dict', { locale: selectedLocale.code }));
                this.plugin.floatingWidget?.refresh();

            } catch (error) {
                console.error('[i18n-plus] Failed to create theme dictionary:', error);
                new Notice(t('notice.create_failed', { error: String(error) }));
            }
        });
    }

    /**
     * Import dictionary for theme
     */
    private importDictionaryForTheme(themeName: string) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) return;

            try {
                const text = await file.text();
                const dict = JSON.parse(text);
                // Validate minimal requirements
                if (!dict.$meta?.locale) {
                    new Notice("Invalid dictionary: missing $meta.locale");
                    return;
                }
                const locale = dict.$meta.locale;

                await this.store.saveThemeDictionary(themeName, locale, dict);
                getI18nPlusManager().loadThemeDictionary(themeName, locale, dict);

                new Notice(t('notice.import_success', { pluginId: themeName }));
                this.plugin.floatingWidget?.refresh();
            } catch (e) {
                new Notice("Import failed: " + e);
            }
        };
        input.click();
    }

    /**
     * Export theme dictionary
     */
    private async exportThemeDictionary(dict: ThemeDictionaryFileInfo) {
        try {
            const content = await this.app.vault.adapter.read(dict.filePath);
            const exportDict = JSON.parse(content);

            // Clean metadata
            if (exportDict.$meta) {
                // Reconstruct meta to enforce order
                const oldMeta = exportDict.$meta;
                exportDict.$meta = {
                    themeName: oldMeta.themeName,
                    themeVersion: oldMeta.themeVersion,
                    dictVersion: oldMeta.dictVersion,
                    locale: oldMeta.locale,
                    description: oldMeta.description
                };
            }

            const json = JSON.stringify(exportDict, null, 2);
            const blob = new Blob([json], { type: 'application/json' });

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${dict.themeName}_${dict.locale}.json`;
            a.click();
            URL.revokeObjectURL(url);
            new Notice(t('notice.export_success', { locale: dict.locale, pluginId: dict.themeName }));
        } catch (e) {
            new Notice(t('notice.export_failed'));
        }
    }

    /**
     * Unload theme dictionary
     */
    private unloadThemeDictionary(dict: ThemeDictionaryFileInfo) {
        this.showConfirm(
            t('manager.delete_confirm_title'),
            t('manager.delete_confirm_message', { pluginId: dict.themeName, locale: dict.locale }), // Reuse keys
            t('action.delete'),
            async () => {
                const manager = getI18nPlusManager();
                // Let's try to unload.
                manager.unloadThemeDictionary(dict.themeName, dict.locale); // Try folder name

                // Better approach: just delete file and let user refresh/restart if memory unload fails.
                await this.store.deleteThemeDictionary(dict.themeName, dict.locale);

                new Notice(t('notice.removed_dict', { locale: dict.locale }));
                this.plugin.floatingWidget?.refresh();
            }
        );
    }
    /**
     * Render a generic overlay
     */
    private renderOverlay(className?: string): { overlay: HTMLElement, modal: HTMLElement } {
        const overlay = this.containerEl.createDiv({ cls: 'i18n-plus-overlay' });
        if (className) overlay.addClass(className);

        // Close on background click
        overlay.onclick = (e) => {
            if (e.target === overlay) overlay.remove();
        };

        const modal = overlay.createDiv({ cls: 'i18n-plus-modal' });
        return { overlay, modal };
    }

    /**
     * Show custom confirmation overlay
     */
    private showConfirm(title: string, message: string, ctaText: string, onConfirm: () => void): void {
        const { overlay, modal } = this.renderOverlay();
        modal.addClass('i18n-plus-confirm-overlay');

        // Header
        const header = modal.createDiv({ cls: 'i18n-plus-modal-header' });
        header.createSpan({ text: title });
        const closeBtn = header.createDiv({ cls: 'clickable-icon' });
        setIcon(closeBtn, 'x');
        closeBtn.onclick = () => overlay.remove();

        // Content
        const content = modal.createDiv({ cls: 'i18n-plus-modal-content' });
        content.createEl('p', { text: message });

        // Footer
        const footer = modal.createDiv({ cls: 'i18n-plus-modal-footer' });

        const btnCancel = footer.createEl('button', { text: t('action.cancel') });
        btnCancel.onclick = () => overlay.remove();

        const btnConfirm = footer.createEl('button', { text: ctaText, cls: 'mod-warning' });
        btnConfirm.onclick = () => {
            onConfirm();
            overlay.remove();
        };

        btnCancel.focus();
    }

    /**
     * Show custom locale selector overlay
     */
    private showLocaleSelector(
        options: LocaleOption[],
        onSelect: (locale: LocaleOption) => void
    ): void {
        const { overlay, modal } = this.renderOverlay();

        // Header with search
        const header = modal.createDiv({ cls: 'i18n-plus-modal-header' });
        const searchInput = header.createEl('input', {
            type: 'text',
            cls: 'i18n-plus-modal-search',
            attr: { placeholder: t('locale_suggest.placeholder') }
        });

        setTimeout(() => searchInput.focus(), 50);

        // List container
        const list = modal.createDiv({ cls: 'i18n-plus-modal-content i18n-plus-locale-list' });
        list.style.padding = '0';

        const renderList = (filter = '') => {
            list.empty();
            const lowerFilter = filter.toLowerCase();
            const filtered = options.filter(opt =>
                opt.code.toLowerCase().includes(lowerFilter) ||
                opt.name.toLowerCase().includes(lowerFilter) ||
                opt.nativeName.toLowerCase().includes(lowerFilter)
            );

            for (const opt of filtered) {
                const item = list.createDiv({ cls: 'i18n-plus-locale-item' });
                const nameDiv = item.createDiv({ text: `${opt.nativeName} (${opt.name})` });

                if (opt.cloudInfo) {
                    const cloudBadge = nameDiv.createSpan({ cls: 'i18n-plus-cloud-badge' });
                    setIcon(cloudBadge, 'cloud-download');
                    cloudBadge.setAttribute('aria-label', 'Available in Cloud');
                    cloudBadge.style.marginLeft = '8px';
                    cloudBadge.style.color = 'var(--text-accent)';
                }

                item.createEl('small', { text: opt.code });
                item.onclick = () => {
                    onSelect(opt);
                    overlay.remove();
                };
            }

            if (filtered.length === 0) {
                list.createDiv({ text: 'No matches', cls: 'i18n-plus-no-dict', attr: { style: 'padding: 10px; text-align: center;' } });
            }
        };

        searchInput.oninput = (e) => renderList((e.target as HTMLInputElement).value);

        searchInput.onkeydown = (e) => {
            if (e.key === 'Escape') {
                overlay.remove();
                e.stopPropagation();
            }
        };

        renderList();
    }
}




interface LocaleOption {
    code: string;
    name: string;
    nativeName: string;
    cloudInfo?: RemoteDictionaryInfo;
}


