/**
 * I18n Plus - Dictionary Editor View
 * 
 * Read-only or Editable dictionary viewer with:
 * - Full dictionary content display
 * - Variable detection and highlighting
 * - Search/filter functionality
 * - Compatible with Floating Widget architecture
 */

import { App, Modal, Setting, setIcon, Notice, setTooltip } from 'obsidian';
import type I18nPlusPlugin from '../main';
import { DictionaryStore } from '../services/dictionary-store';
import { getI18nPlusManager } from '../framework/global-api';
import type { Dictionary, DictionaryMeta } from '../framework/types';
import { t } from '../lang';
import { MetadataEditorView } from './metadata-editor-view';

// ============================================================================
// Data Models DictionaryEntry & EditorState
// ============================================================================

/** Single dictionary entry with variable detection */
export interface DictionaryEntry {
    key: string;
    value: string;              // Current value (may be edited)
    originalValue: string;      // Original value for comparison
    baseValue?: string;         // Reference value from base locale (e.g., English)
    hasVariables: boolean;
    variables: string[];        // Expected variables from original
    isEdited: boolean;          // Has been modified
    validationError?: string;   // Validation error message
}

/** Editor state */
// Editor State
interface EditorState {
    pluginId: string;
    locale: string;
    isBuiltin: boolean;
    entries: DictionaryEntry[];
    filteredEntries: DictionaryEntry[];
    searchQuery: string;
    isReadOnly: boolean;
    hasUnsavedChanges: boolean;
    originalDict?: Dictionary;
    baseDict?: Dictionary;
    baseLocale?: string;
    showMissingOnly: boolean;
    themeName?: string; // Add themeName support
}

// ============================================================================
// Variable Detection Patterns
// ============================================================================

const VARIABLE_PATTERNS: { name: string; regex: RegExp }[] = [
    { name: 'mustache', regex: /\{\{[^}]+\}\}/g },           // {{name}}
    { name: 'indexed', regex: /\{\d+\}/g },                   // {0}, {1}
    { name: 'printf', regex: /%(\d+\$)?[sd]/g },              // %s, %d, %1$s
    { name: 'template', regex: /\$\{[^}]+\}/g },              // ${fn()}
    { name: 'icu', regex: /\{[^,}]+,\s*(plural|select)[^}]*\}/g }, // ICU format
];

/**
 * Detect variables in a translation value
 */
function detectVariables(value: string): { hasVariables: boolean; variables: string[] } {
    const variables: string[] = [];

    for (const pattern of VARIABLE_PATTERNS) {
        const matches = value.match(pattern.regex);
        if (matches) {
            variables.push(...matches);
        }
    }

    return {
        hasVariables: variables.length > 0,
        variables: [...new Set(variables)] // dedupe
    };
}

export class DictionaryEditorView {
    private app: App;
    private plugin: I18nPlusPlugin;
    private store: DictionaryStore;
    private state: EditorState;
    private contentContainer: HTMLElement | null = null;
    private saveButton: HTMLButtonElement | null = null;
    private container: HTMLElement | null = null;

    constructor(
        app: App,
        plugin: I18nPlusPlugin,
        pluginId: string,
        locale: string,
        isBuiltin: boolean,
        themeName?: string
    ) {
        this.app = app;
        this.plugin = plugin;
        this.store = new DictionaryStore(app, plugin);
        this.state = {
            pluginId,
            locale,
            isBuiltin,
            themeName,
            entries: [],
            filteredEntries: [],
            searchQuery: '',
            isReadOnly: !isBuiltin ? false : true, // Builtin = read-only, External = editable
            hasUnsavedChanges: false,
            showMissingOnly: false,
        };
    }

    async render(container: HTMLElement) {
        this.container = container;
        container.empty();
        container.addClass('i18n-plus-editor');

        // Load dictionary
        await this.loadDictionary();

        // Render UI
        this.renderHeader(container);
        this.renderToolbar(container);
        this.contentContainer = container.createDiv({ cls: 'i18n-plus-editor-content' });
        this.renderContent();
        this.renderFooter(container);
    }

    // Logic to switch back to manager view
    private close() {
        this.plugin.showDictionaryManager();
    }

    /**
     * Confirm close with unsaved changes
     */
    private async confirmClose(): Promise<void> {
        if (!this.state.hasUnsavedChanges) {
            this.close();
            return;
        }

        // Simple confirmation using browser confirm
        const saveFirst = confirm(
            'You have unsaved changes.\n\n' +
            'Click OK to save and close, or Cancel to discard changes.'
        );

        if (saveFirst) {
            const saved = await this.saveDictionary();
            if (saved) {
                this.close();
            }
        } else {
            // Discard changes and close
            this.close();
        }
    }

    // ... render methods ...

    // Data Loading
    private async loadDictionary(): Promise<void> {
        let dict: Dictionary | null = null;

        if (this.state.themeName) {
            // Theme Dictionary Loading
            // Themes don't have "builtin" concept in the same way, always load from file
            dict = await this.store.loadThemeDictionary(this.state.themeName, this.state.locale);

            // For themes, base dict is always English (en) from the same theme if available
            // We try to load 'en' as base
            if (this.state.locale !== 'en') {
                const baseDict = await this.store.loadThemeDictionary(this.state.themeName, 'en');
                if (baseDict) {
                    this.state.baseDict = baseDict;
                    this.state.baseLocale = 'en';
                }
            }
        } else {
            // Plugin Dictionary Loading
            const manager = getI18nPlusManager();
            const translator = manager.getTranslator(this.state.pluginId);

            // Load base dictionary for reference
            if (translator) {
                this.state.baseLocale = translator.baseLocale;
                if (typeof translator.getBuiltinDictionary === 'function') {
                    this.state.baseDict = translator.getBuiltinDictionary(translator.baseLocale) as Dictionary ?? undefined;
                } else {
                    this.state.baseDict = translator.getDictionary(translator.baseLocale) ?? undefined;
                }
            }

            if (this.state.isBuiltin && translator) {
                if (typeof translator.getBuiltinDictionary === 'function') {
                    dict = translator.getBuiltinDictionary(this.state.locale) as Dictionary ?? null;
                } else {
                    dict = translator.getDictionary(this.state.locale) ?? null;
                }
            } else {
                dict = await this.store.loadDictionary(this.state.pluginId, this.state.locale);
            }
        }

        if (!dict) {
            this.state.entries = [];
            this.state.filteredEntries = [];
            return;
        }

        this.state.originalDict = dict;
        this.state.entries = this.parseEntries(dict);
        this.state.filteredEntries = [...this.state.entries];
    }

    private parseEntries(dict: Dictionary): DictionaryEntry[] {
        const entries: DictionaryEntry[] = [];
        const baseDict = this.state.baseDict;

        for (const [key, value] of Object.entries(dict)) {
            if (typeof value === 'string') {
                // Get base value from base dictionary (for reference)
                const baseValue = baseDict && typeof baseDict[key] === 'string'
                    ? baseDict[key] as string
                    : undefined;

                // Use base value for variable detection if current value is empty
                const sourceForVars = value || baseValue || '';
                const { hasVariables, variables } = detectVariables(sourceForVars);

                entries.push({
                    key,
                    value,
                    originalValue: value,
                    baseValue,
                    hasVariables,
                    variables,
                    isEdited: false,
                });
            }
        }

        // Sort by key
        entries.sort((a, b) => a.key.localeCompare(b.key));
        return entries;
    }

    // ... parseEntries ...

    private renderHeader(container: HTMLElement): void {
        const header = container.createDiv({ cls: 'i18n-plus-editor-header' });

        const backBtn = header.createDiv({ cls: 'clickable-icon i18n-plus-editor-back-btn' });
        setIcon(backBtn, 'arrow-left');
        setTooltip(backBtn, 'Back');
        backBtn.onclick = async () => {
            if (!this.state.isReadOnly && this.state.hasUnsavedChanges) {
                await this.confirmClose();
            } else {
                this.close();
            }
        };

        const titleContainer = header.createDiv({ cls: 'i18n-plus-editor-title' });

        const titleText = this.state.themeName
            ? `${this.state.themeName} / ${this.state.locale}`
            : `${this.state.pluginId} / ${this.state.locale}`;

        titleContainer.createSpan({
            text: titleText,
            cls: 'i18n-plus-editor-title-text'
        });

        const badges = header.createDiv({ cls: 'i18n-plus-editor-badges' });

        const typeBadge = badges.createSpan({
            cls: `i18n-plus-badge ${this.state.isBuiltin ? 'i18n-plus-badge-builtin' : 'i18n-plus-badge-custom'}`
        });
        typeBadge.textContent = this.state.isBuiltin ? 'Builtin' : (this.state.themeName ? 'Theme' : 'Custom');

        if (this.state.isReadOnly) {
            const readOnlyBadge = badges.createSpan({ cls: 'i18n-plus-badge i18n-plus-badge-readonly' });
            readOnlyBadge.textContent = 'Read-only';
        }
    }

    private renderToolbar(container: HTMLElement): void {
        const toolbar = container.createDiv({ cls: 'i18n-plus-editor-toolbar' });

        // Search input
        const searchContainer = toolbar.createDiv({ cls: 'i18n-plus-editor-search' });
        const searchIcon = searchContainer.createSpan({ cls: 'i18n-plus-editor-search-icon' });
        setIcon(searchIcon, 'search');

        const searchInput = searchContainer.createEl('input', {
            type: 'text',
            placeholder: t('editor.search_placeholder'),
            cls: 'i18n-plus-editor-search-input'
        });
        searchInput.value = this.state.searchQuery;

        searchInput.addEventListener('input', () => {
            this.state.searchQuery = searchInput.value.toLowerCase();
            this.filterEntries();
            this.renderContent();
            this.updateStats(stats);
        });

        // Filter: Show Missing
        const filterContainer = toolbar.createDiv({ cls: 'i18n-plus-editor-filter' });
        const cb = filterContainer.createEl('input', {
            type: 'checkbox',
            cls: 'i18n-plus-checkbox'
        });
        cb.id = 'i18n-plus-filter-missing';
        cb.checked = this.state.showMissingOnly;

        filterContainer.createEl('label', {
            text: t('editor.show_missing_only'),
            attr: { for: 'i18n-plus-filter-missing' }
        });

        cb.addEventListener('change', () => {
            this.state.showMissingOnly = cb.checked;
            this.filterEntries();
            this.renderContent();
            this.updateStats(stats);
        });

        // Stats
        const stats = toolbar.createDiv({ cls: 'i18n-plus-editor-stats' });
        this.updateStats(stats);
    }

    private updateStats(container: HTMLElement): void {
        container.empty();
        const total = this.state.entries.length;
        const withVars = this.state.entries.filter(e => e.hasVariables).length;
        const shown = this.state.filteredEntries.length;

        if (this.state.searchQuery) {
            container.textContent = `Showing ${shown} of ${total} entries`;
        } else {
            container.textContent = `${total} entries | ${withVars} with variables`;
        }
    }

    private renderContent(): void {
        if (!this.contentContainer) return;
        this.contentContainer.empty();

        if (this.state.filteredEntries.length === 0) {
            const empty = this.contentContainer.createDiv({ cls: 'i18n-plus-editor-empty' });
            if (this.state.searchQuery) {
                empty.textContent = t('editor.no_match');
            } else {
                empty.textContent = t('editor.no_entries');
            }
            return;
        }

        // Create table with new layout
        const tableContainer = this.contentContainer.createDiv({ cls: 'i18n-plus-editor-table-container' });
        const table = tableContainer.createEl('table', { cls: 'i18n-plus-editor-table' });

        // Header row - only show SOURCE and TRANSLATION for editable mode
        if (!this.state.isReadOnly) {
            const thead = table.createEl('thead');
            const headerRow = thead.createEl('tr');
            headerRow.createEl('th', { text: t('editor.table_source'), cls: 'i18n-plus-editor-th-source' });
            headerRow.createEl('th', { text: t('editor.table_translation'), cls: 'i18n-plus-editor-th-translation' });
        } else {
            // Read-only mode: KEY and VALUE
            const thead = table.createEl('thead');
            const headerRow = thead.createEl('tr');
            headerRow.createEl('th', { text: t('editor.table_key'), cls: 'i18n-plus-editor-th-key' });
            headerRow.createEl('th', { text: t('editor.table_value'), cls: 'i18n-plus-editor-th-value' });
        }

        // Body
        const tbody = table.createEl('tbody');
        for (const entry of this.state.filteredEntries) {
            this.renderEntryRow(tbody, entry);
        }
    }

    private renderEntryRow(tbody: HTMLElement, entry: DictionaryEntry): void {
        // For editable mode: use row header layout
        if (!this.state.isReadOnly) {
            // Row 1: Key header row (spans 2 columns)
            const keyRow = tbody.createEl('tr', { cls: 'i18n-plus-editor-key-row' });
            const keyCell = keyRow.createEl('td', {
                cls: 'i18n-plus-editor-cell-key-header',
                attr: { colspan: '2' }
            });

            // Key name
            keyCell.createSpan({ text: entry.key, cls: 'i18n-plus-editor-key' });

            // Variable warning icon
            if (entry.hasVariables) {
                const warning = keyCell.createSpan({ cls: 'i18n-plus-editor-var-warning' });
                setIcon(warning, 'alert-triangle');
                warning.setAttribute('aria-label', `Variables: ${entry.variables.join(', ')}`);
                warning.setAttribute('title', `Contains variables: ${entry.variables.join(', ')}\nDo not translate these placeholders.`);
            }

            // Validation error icon
            if (entry.validationError) {
                const errorIcon = keyCell.createSpan({ cls: 'i18n-plus-editor-error-icon' });
                setIcon(errorIcon, 'x-circle');
                errorIcon.setAttribute('title', entry.validationError);
            }

            // Row 2: Source + Translation content row
            const contentRow = tbody.createEl('tr', {
                cls: `i18n-plus-editor-content-row ${entry.isEdited ? 'is-edited' : ''} ${entry.validationError ? 'has-error' : ''}`
            });

            // Source cell (read-only, shows base/English value)
            const sourceCell = contentRow.createEl('td', { cls: 'i18n-plus-editor-cell-source' });
            if (entry.baseValue) {
                if (entry.hasVariables) {
                    this.renderValueWithHighlight(sourceCell, entry.baseValue, entry.variables);
                } else {
                    sourceCell.textContent = entry.baseValue;
                }
            } else {
                sourceCell.createSpan({ text: '—', cls: 'i18n-plus-editor-no-source' });
            }

            // Translation cell (editable textarea)
            const translationCell = contentRow.createEl('td', { cls: 'i18n-plus-editor-cell-translation' });
            const textarea = translationCell.createEl('textarea', {
                cls: 'i18n-plus-editor-textarea',
                text: entry.value
            });
            textarea.rows = Math.min(6, Math.max(1, (entry.value || entry.baseValue || '').split('\n').length));

            // Placeholder shows base value if current value is empty
            if (!entry.value && entry.baseValue) {
                textarea.placeholder = entry.baseValue;
            }

            textarea.addEventListener('input', () => {
                this.handleEntryEdit(entry, textarea.value);
                contentRow.className = `i18n-plus-editor-content-row ${entry.isEdited ? 'is-edited' : ''} ${entry.validationError ? 'has-error' : ''}`;
            });

            // Auto resize
            textarea.addEventListener('input', () => {
                textarea.rows = Math.min(6, Math.max(1, textarea.value.split('\n').length));
            });

        } else {
            // Read-only mode: original two-column layout (KEY | VALUE)
            const row = tbody.createEl('tr', { cls: 'i18n-plus-editor-row' });

            // Key cell
            const keyCell = row.createEl('td', { cls: 'i18n-plus-editor-cell-key' });
            keyCell.createSpan({ text: entry.key, cls: 'i18n-plus-editor-key' });

            if (entry.hasVariables) {
                const warning = keyCell.createSpan({ cls: 'i18n-plus-editor-var-warning' });
                setIcon(warning, 'alert-triangle');
                warning.setAttribute('aria-label', `Variables: ${entry.variables.join(', ')}`);
                warning.setAttribute('title', `Contains variables: ${entry.variables.join(', ')}\nDo not translate these placeholders.`);
            }

            // Value cell
            const valueCell = row.createEl('td', { cls: 'i18n-plus-editor-cell-value' });
            if (entry.hasVariables) {
                this.renderValueWithHighlight(valueCell, entry.value, entry.variables);
            } else {
                valueCell.textContent = entry.value;
            }
        }
    }

    private renderValueWithHighlight(container: HTMLElement, value: string, variables: string[]): void {
        // Create a regex that matches any of the variables
        const escapedVars = variables.map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        const regex = new RegExp(`(${escapedVars.join('|')})`, 'g');

        const parts = value.split(regex);
        for (const part of parts) {
            if (variables.includes(part)) {
                container.createSpan({ text: part, cls: 'i18n-plus-editor-var-highlight' });
            } else {
                container.createSpan({ text: part });
            }
        }
    }

    private renderFooter(container: HTMLElement): void {
        const footer = container.createDiv({ cls: 'i18n-plus-editor-footer' });

        const setting = new Setting(footer);

        // Save button (only in editable mode)
        if (!this.state.isReadOnly) {
            setting.addButton(btn => {
                btn.setButtonText('Save')
                    .setIcon('save')
                    .setCta();

                // Manual event listener to ensure it fires reliably
                btn.buttonEl.addEventListener('click', async () => {
                    if (!btn.buttonEl.disabled) {
                        await this.saveDictionary();
                        // Update button state after save
                        this.updateSaveButtonState();
                    }
                });

                // Disable if no changes (initial state)
                btn.setDisabled(!this.state.hasUnsavedChanges);
                // Store reference for dynamic updates
                this.saveButton = btn.buttonEl;
            });
        }

        // Export button
        setting.addButton(btn => btn
            .setButtonText(t('editor.export_json'))
            .setIcon('download')
            .onClick(async () => {
                await this.exportDictionary();
            })
        );

        // Metadata Button
        if (!this.state.isReadOnly) {
            setting.addButton(btn => btn
                .setButtonText(t('editor.metadata'))
                .setTooltip(t('editor.metadata'))
                .onClick(() => {
                    if (this.state.originalDict && this.state.originalDict.$meta) {
                        const metaView = new MetadataEditorView(
                            this.app,
                            this.plugin,
                            this.state.originalDict.$meta,
                            (newMeta) => {
                                if (this.state.originalDict && this.state.originalDict.$meta) {
                                    this.state.originalDict.$meta = {
                                        ...this.state.originalDict.$meta,
                                        ...newMeta
                                    } as DictionaryMeta;
                                    this.state.hasUnsavedChanges = true;
                                    this.updateSaveButtonState();
                                }
                                // Return to editor view after save
                                this.plugin.floatingWidget?.showView(
                                    (container) => this.render(container),
                                    t('editor.title')
                                );
                            },
                            () => {
                                // Cancel - return to editor view
                                this.plugin.floatingWidget?.showView(
                                    (container) => this.render(container),
                                    t('editor.title')
                                );
                            }
                        );
                        // Show metadata view in floating widget
                        this.plugin.floatingWidget?.showView(
                            (container) => metaView.render(container),
                            t('metadata.title')
                        );
                    } else {
                        // Initialize meta if missing
                        if (this.state.originalDict) {
                            this.state.originalDict.$meta = {
                                pluginId: this.state.pluginId,
                                locale: this.state.locale,
                                pluginVersion: '0.0.0',
                                dictVersion: '1.0.0'
                            };
                            // Trigger click again now that meta exists
                            (btn as any).buttonEl.click();
                        }
                    }
                })
            );
        }

        // Close button
        setting.addButton(btn => btn
            .setButtonText(t('editor.close'))
            .onClick(async () => {
                if (!this.state.isReadOnly && this.state.hasUnsavedChanges) {
                    await this.confirmClose();
                } else {
                    this.close();
                }
            })
        );
    }

    private filterEntries(): void {
        let entries = this.state.entries;

        // 1. Filter by "Show Missing"
        if (this.state.showMissingOnly) {
            entries = entries.filter(e => !e.value || e.value.trim() === '');
        }

        // 2. Filter by Search
        if (this.state.searchQuery) {
            const query = this.state.searchQuery.toLowerCase();
            entries = entries.filter(entry =>
                entry.key.toLowerCase().includes(query) ||
                entry.value.toLowerCase().includes(query)
            );
        }

        this.state.filteredEntries = entries;
    }

    private async exportDictionary(): Promise<void> {
        const blob = await this.store.exportToBlob(this.state.pluginId, this.state.locale);
        if (!blob) {
            // If not in store, build from current entries
            const dict: Dictionary = {};
            for (const entry of this.state.entries) {
                dict[entry.key] = entry.value;
            }
            const json = JSON.stringify(dict, null, 2);
            const exportBlob = new Blob([json], { type: 'application/json' });
            this.downloadBlob(exportBlob, `${this.state.pluginId}_${this.state.locale}.json`);
        } else {
            this.downloadBlob(blob, `${this.state.pluginId}_${this.state.locale}.json`);
        }
        new Notice(t('notice.editor_export_success', { locale: this.state.locale }));
    }

    private downloadBlob(blob: Blob, filename: string): void {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    private handleEntryEdit(entry: DictionaryEntry, newValue: string): void {
        entry.value = newValue;

        // Check if edited (different from original)
        entry.isEdited = newValue !== entry.originalValue;

        // Validate variables if original had any
        if (entry.hasVariables) {
            entry.validationError = this.validateVariables(entry.variables, newValue);
        } else {
            entry.validationError = undefined;
        }

        // Update global unsaved changes state
        this.state.hasUnsavedChanges = this.state.entries.some(e => e.isEdited);

        // Update save button state
        this.updateSaveButtonState();

        // Update stats
        if (this.container) {
            const stats = this.container.querySelector('.i18n-plus-editor-stats');
            if (stats) this.updateStats(stats as HTMLElement);
        }

        // Trigger optional callback
        if (this.onEntryEdit) {
            this.onEntryEdit(entry.key, newValue);
        }
    }

    private updateSaveButtonState(): void {
        if (this.saveButton) {
            this.saveButton.disabled = !this.state.hasUnsavedChanges;
        }
    }

    private validateVariables(expectedVars: string[], newValue: string): string | undefined {
        const { variables: actualVars } = detectVariables(newValue);

        // Check for missing variables
        const missing = expectedVars.filter(v => !actualVars.includes(v));
        if (missing.length > 0) {
            return `Missing variables: ${missing.join(', ')}`;
        }

        // Check for extra variables (added ones that weren't in original)
        const extra = actualVars.filter(v => !expectedVars.includes(v));
        if (extra.length > 0) {
            return `Unexpected variables: ${extra.join(', ')}`;
        }

        return undefined;
    }

    // ... renderToolbar, updateStats, renderContent, renderEntryRow, renderValueWithHighlight, renderFooter ...

    // Save Dictionary
    private async saveDictionary(): Promise<boolean> {
        if (!this.state.hasUnsavedChanges) {
            return true;
        }

        const errors = this.state.entries.filter(e => e.validationError);
        if (errors.length > 0) {
            new Notice(t('notice.validation_errors', { count: errors.length }));
            return false;
        }

        const dict: Dictionary = {};

        if (this.state.originalDict && this.state.originalDict.$meta) {
            dict.$meta = { ...this.state.originalDict.$meta };
        }

        for (const entry of this.state.entries) {
            dict[entry.key] = entry.value;
        }

        try {
            if (this.state.themeName) {
                // Save Theme Dictionary
                await this.store.saveThemeDictionary(this.state.themeName, this.state.locale, dict);

                // Hot reload for theme
                const manager = getI18nPlusManager();
                manager.loadThemeDictionary(this.state.themeName, this.state.locale, dict);

            } else {
                // Save Plugin Dictionary
                await this.store.saveDictionary(this.state.pluginId, this.state.locale, dict);

                // Hot reload for plugin
                const manager = getI18nPlusManager();
                manager.loadDictionary(this.state.pluginId, this.state.locale, dict);
            }

            for (const entry of this.state.entries) {
                entry.originalValue = entry.value;
                entry.isEdited = false;
            }
            this.state.hasUnsavedChanges = false;

            new Notice(t('notice.save_success', { locale: this.state.locale }));
            this.renderContent();
            return true;
        } catch (error) {
            console.error('[i18n-plus] Failed to save dictionary:', error);
            new Notice(t('notice.save_failed'));
            return false;
        }
    }

    /** Override callback for entry edits */
    protected onEntryEdit?(key: string, newValue: string): void;
}

/**
 * Modal to edit dictionary metadata
 * Included here as helper
 */
class MetadataEditorModal extends Modal {
    private meta: Partial<DictionaryMeta>;
    private onSave: (meta: Partial<DictionaryMeta>) => void;

    constructor(app: App, meta: Partial<DictionaryMeta>, onSave: (meta: Partial<DictionaryMeta>) => void) {
        super(app);
        // Clone meta to avoid direct mutation until save
        this.meta = { ...meta };
        this.onSave = onSave;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.addClass('i18n-plus-metadata-modal');

        contentEl.createEl('h2', { text: t('metadata.title') });

        // Read-only fields
        new Setting(contentEl)
            .setName(t('metadata.plugin_id'))
            .setDesc(t('metadata.plugin_id_desc'))
            .addText(text => text.setValue(this.meta.pluginId || '').setDisabled(true));

        new Setting(contentEl)
            .setName(t('metadata.locale'))
            .setDesc(t('metadata.locale_desc'))
            .addText(text => text.setValue(this.meta.locale || '').setDisabled(true));

        // Editable fields
        new Setting(contentEl)
            .setName(t('metadata.dict_version'))
            .setDesc(t('metadata.dict_version_desc'))
            .addText(text => text
                .setValue(this.meta.dictVersion || '1.0.0')
                .onChange(val => this.meta.dictVersion = val));

        new Setting(contentEl)
            .setName(t('metadata.plugin_version'))
            .setDesc(t('metadata.plugin_version_desc'))
            .addText(text => text
                .setValue(this.meta.pluginVersion || '')
                .onChange(val => this.meta.pluginVersion = val));

        new Setting(contentEl)
            .setName(t('metadata.author'))
            .setDesc(t('metadata.author_desc'))
            .addText(text => text
                .setValue(this.meta.author || '')
                .onChange(val => this.meta.author = val));

        new Setting(contentEl)
            .setName(t('metadata.description'))
            .setDesc(t('metadata.description_desc'))
            .addTextArea(text => text
                .setValue(this.meta.description || '')
                .onChange(val => this.meta.description = val));

        // Footer buttons
        const footer = contentEl.createDiv({ cls: 'modal-button-container' });

        new Setting(footer)
            .addButton(btn => btn
                .setButtonText(t('action.cancel'))
                .onClick(() => this.close()))
            .addButton(btn => btn
                .setButtonText(t('metadata.update'))
                .setCta()
                .onClick(() => {
                    this.onSave(this.meta);
                    this.close();
                }));
    }

    onClose() {
        this.contentEl.empty();
    }
}
