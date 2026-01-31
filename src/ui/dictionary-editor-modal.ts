/**
 * I18n Plus - Dictionary Editor Modal
 * 
 * Read-only dictionary viewer with:
 * - Full dictionary content display
 * - Variable detection and highlighting
 * - Search/filter functionality
 * - Extensible architecture for future editing
 */

import { App, Modal, Setting, setIcon, Notice } from 'obsidian';
import type I18nPlusPlugin from '../main';
import { DictionaryStore } from '../services/dictionary-store';
import { getI18nPlusManager } from '../framework/global-api';
import type { Dictionary, DictionaryMeta } from '../framework/types';

// ============================================================================
// Data Models
// ============================================================================

/** Single dictionary entry with variable detection */
interface DictionaryEntry {
    key: string;
    value: string;              // Current value (may be edited)
    originalValue: string;      // Original value for comparison
    hasVariables: boolean;
    variables: string[];        // Expected variables from original
    isEdited: boolean;          // Has been modified
    validationError?: string;   // Validation error message
}

/** Editor state */
interface EditorState {
    pluginId: string;
    locale: string;
    isBuiltin: boolean;
    entries: DictionaryEntry[];
    filteredEntries: DictionaryEntry[];
    searchQuery: string;
    isReadOnly: boolean;
    hasUnsavedChanges: boolean;  // Track if any entry is edited
    originalDict?: Dictionary;   // Keep original to preserve $meta and other fields
    showMissingOnly: boolean;    // Filter: Show only missing translations
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

// ============================================================================
// Dictionary Editor Modal
// ============================================================================

export class DictionaryEditorModal extends Modal {
    private plugin: I18nPlusPlugin;
    private store: DictionaryStore;
    private state: EditorState;
    private contentContainer: HTMLElement | null = null;
    private saveButton: HTMLButtonElement | null = null;  // Reference for dynamic updates

    constructor(
        app: App,
        plugin: I18nPlusPlugin,
        pluginId: string,
        locale: string,
        isBuiltin: boolean
    ) {
        super(app);
        this.plugin = plugin;
        this.store = new DictionaryStore(app, plugin);
        this.state = {
            pluginId,
            locale,
            isBuiltin,
            entries: [],
            filteredEntries: [],
            searchQuery: '',
            isReadOnly: !isBuiltin ? false : true, // Builtin = read-only, External = editable
            hasUnsavedChanges: false,
            showMissingOnly: false,
        };
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('i18n-plus-editor');

        // Load dictionary
        await this.loadDictionary();

        // Render UI
        this.renderHeader(contentEl);
        this.renderToolbar(contentEl);
        this.contentContainer = contentEl.createDiv({ cls: 'i18n-plus-editor-content' });
        this.renderContent();
        this.renderFooter(contentEl);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
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

    // ========================================================================
    // Data Loading
    // ========================================================================

    private async loadDictionary(): Promise<void> {
        let dict: Dictionary | null = null;

        const manager = getI18nPlusManager();
        const translator = manager.getTranslator(this.state.pluginId);

        if (this.state.isBuiltin && translator) {
            // Try getBuiltinDictionary first (new interface), fallback to getDictionary
            if (typeof translator.getBuiltinDictionary === 'function') {
                dict = translator.getBuiltinDictionary(this.state.locale) as Dictionary ?? null;
            } else {
                dict = translator.getDictionary(this.state.locale) ?? null;
            }
        } else {
            // Load from external dictionary store
            dict = await this.store.loadDictionary(this.state.pluginId, this.state.locale);
        }

        if (!dict) {
            this.state.entries = [];
            this.state.filteredEntries = [];
            return;
        }

        // Store original dict for preserving metadata
        this.state.originalDict = dict;

        // Parse entries with variable detection
        this.state.entries = this.parseEntries(dict);
        this.state.filteredEntries = [...this.state.entries];
    }

    private parseEntries(dict: Dictionary): DictionaryEntry[] {
        const entries: DictionaryEntry[] = [];

        for (const [key, value] of Object.entries(dict)) {
            if (typeof value === 'string') {
                const { hasVariables, variables } = detectVariables(value);
                entries.push({
                    key,
                    value,
                    originalValue: value,
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

    // ========================================================================
    // Rendering
    // ========================================================================

    private renderHeader(container: HTMLElement): void {
        const header = container.createDiv({ cls: 'i18n-plus-editor-header' });

        // Title with plugin name and locale
        const titleContainer = header.createDiv({ cls: 'i18n-plus-editor-title' });
        const icon = titleContainer.createSpan({ cls: 'i18n-plus-editor-icon' });
        setIcon(icon, 'book-open');

        titleContainer.createSpan({
            text: `${this.state.pluginId} - ${this.state.locale}`,
            cls: 'i18n-plus-editor-title-text'
        });

        // Badges
        const badges = header.createDiv({ cls: 'i18n-plus-editor-badges' });

        // Type badge
        const typeBadge = badges.createSpan({
            cls: `i18n-plus-badge ${this.state.isBuiltin ? 'i18n-plus-badge-builtin' : 'i18n-plus-badge-custom'}`
        });
        typeBadge.textContent = this.state.isBuiltin ? 'Builtin' : 'Custom';

        // Read-only badge
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
            placeholder: 'Search entries...',
            cls: 'i18n-plus-editor-search-input'
        });

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
            text: 'Missing only',
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
                empty.textContent = 'No entries match your search.';
            } else {
                empty.textContent = 'No entries in this dictionary.';
            }
            return;
        }

        // Create table
        const table = this.contentContainer.createEl('table', { cls: 'i18n-plus-editor-table' });

        // Header row
        const thead = table.createEl('thead');
        const headerRow = thead.createEl('tr');
        headerRow.createEl('th', { text: 'Key', cls: 'i18n-plus-editor-th-key' });
        headerRow.createEl('th', { text: 'Value', cls: 'i18n-plus-editor-th-value' });

        // Body
        const tbody = table.createEl('tbody');
        for (const entry of this.state.filteredEntries) {
            this.renderEntryRow(tbody, entry);
        }
    }

    private renderEntryRow(tbody: HTMLElement, entry: DictionaryEntry): void {
        const row = tbody.createEl('tr', {
            cls: `i18n-plus-editor-row ${entry.isEdited ? 'is-edited' : ''} ${entry.validationError ? 'has-error' : ''}`
        });

        // Key cell
        const keyCell = row.createEl('td', { cls: 'i18n-plus-editor-cell-key' });
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

        // Value cell
        const valueCell = row.createEl('td', { cls: 'i18n-plus-editor-cell-value' });

        if (this.state.isReadOnly) {
            // Read-only mode: display text with variable highlighting
            if (entry.hasVariables) {
                this.renderValueWithHighlight(valueCell, entry.value, entry.variables);
            } else {
                valueCell.textContent = entry.value;
            }
        } else {
            // Editable mode: textarea
            const textarea = valueCell.createEl('textarea', {
                cls: 'i18n-plus-editor-textarea',
                text: entry.value
            });
            textarea.rows = Math.min(3, Math.max(1, entry.value.split('\n').length));

            textarea.addEventListener('input', () => {
                this.handleEntryEdit(entry, textarea.value);
                row.className = `i18n-plus-editor-row ${entry.isEdited ? 'is-edited' : ''} ${entry.validationError ? 'has-error' : ''}`;
            });

            textarea.addEventListener('blur', () => {
                // Adjust row height after editing
                textarea.rows = Math.min(3, Math.max(1, textarea.value.split('\n').length));
            });
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
            .setButtonText('Export JSON')
            .setIcon('download')
            .onClick(async () => {
                await this.exportDictionary();
            })
        );

        // Metadata Button
        if (!this.state.isReadOnly) {
            setting.addButton(btn => btn
                .setButtonText('Metadata')
                .setTooltip('Edit dictionary metadata')
                .onClick(() => {
                    if (this.state.originalDict && this.state.originalDict.$meta) {
                        new MetadataEditorModal(
                            this.app,
                            this.state.originalDict.$meta,
                            (newMeta) => {
                                if (this.state.originalDict && this.state.originalDict.$meta) {
                                    this.state.originalDict.$meta = {
                                        ...this.state.originalDict.$meta,
                                        ...newMeta
                                    } as DictionaryMeta;
                                    this.state.hasUnsavedChanges = true; // Mark as dirty ensuring save picks it up
                                    this.updateSaveButtonState();
                                    new Notice('Metadata updated (pending save)');
                                }
                            }
                        ).open();
                    } else {
                        // Initialize meta if missing?
                        if (this.state.originalDict) {
                            this.state.originalDict.$meta = {
                                pluginId: this.state.pluginId,
                                locale: this.state.locale,
                                pluginVersion: '0.0.0',
                                dictVersion: '1.0.0'
                            };
                            // Recursive call to open it now
                            (btn as any).buttonEl.click();
                        }
                    }
                })
            );
        }

        // Close button
        setting.addButton(btn => btn
            .setButtonText('Close')
            .onClick(async () => {
                if (!this.state.isReadOnly && this.state.hasUnsavedChanges) {
                    await this.confirmClose();
                } else {
                    this.close();
                }
            })
        );
    }

    // ========================================================================
    // Actions
    // ========================================================================

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
            this.downloadBlob(exportBlob, `${this.state.pluginId}.${this.state.locale}.json`);
        } else {
            this.downloadBlob(blob, `${this.state.pluginId}.${this.state.locale}.json`);
        }
        new Notice(`Exported ${this.state.locale} dictionary`);
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

    // ========================================================================
    // Edit Handling (Phase 2)
    // ========================================================================

    /**
     * Handle entry edit: update value, validate variables, track changes
     */
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
        const toolbar = this.contentEl.querySelector('.i18n-plus-editor-toolbar');
        if (toolbar) {
            const stats = toolbar.querySelector('.i18n-plus-editor-stats');
            if (stats) this.updateStats(stats as HTMLElement);
        }

        // Trigger optional callback
        if (this.onEntryEdit) {
            this.onEntryEdit(entry.key, newValue);
        }
    }

    /**
     * Update save button disabled state based on hasUnsavedChanges
     */
    private updateSaveButtonState(): void {
        if (this.saveButton) {
            this.saveButton.disabled = !this.state.hasUnsavedChanges;
        }
    }

    /**
     * Validate that all expected variables are preserved in the edited value
     */
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

    /**
     * Save edited entries back to dictionary file
     */
    private async saveDictionary(): Promise<boolean> {
        if (!this.state.hasUnsavedChanges) {
            return true;
        }

        // Check for validation errors
        const errors = this.state.entries.filter(e => e.validationError);
        if (errors.length > 0) {
            new Notice(`Cannot save: ${errors.length} entries have validation errors`);
            return false;
        }

        // Build dictionary from entries
        const dict: Dictionary = {};

        // Preserve metadata
        if (this.state.originalDict && this.state.originalDict.$meta) {
            dict.$meta = { ...this.state.originalDict.$meta };
        }

        for (const entry of this.state.entries) {
            dict[entry.key] = entry.value;
        }

        try {
            await this.store.saveDictionary(this.state.pluginId, this.state.locale, dict);

            // Hot reload: update memory in Global Manager so changes are applied immediately
            // without needing a full plugin reload
            const manager = getI18nPlusManager();
            manager.loadDictionary(this.state.pluginId, this.state.locale, dict);

            // Reset edited state
            for (const entry of this.state.entries) {
                entry.originalValue = entry.value;
                entry.isEdited = false;
            }
            this.state.hasUnsavedChanges = false;

            new Notice(`Saved and refreshed ${this.state.locale} dictionary`);
            this.renderContent();
            return true;
        } catch (error) {
            console.error('[i18n-plus] Failed to save dictionary:', error);
            new Notice('Failed to save dictionary');
            return false;
        }
    }

    /** Override callback for entry edits */
    protected onEntryEdit?(key: string, newValue: string): void;
}

/**
 * Modal to edit dictionary metadata
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

        contentEl.createEl('h2', { text: 'Dictionary Metadata' });

        // Read-only fields
        new Setting(contentEl)
            .setName('Plugin ID')
            .setDesc('Target plugin identifier (Read-only)')
            .addText(text => text.setValue(this.meta.pluginId || '').setDisabled(true));

        new Setting(contentEl)
            .setName('Locale')
            .setDesc('Target language code (Read-only)')
            .addText(text => text.setValue(this.meta.locale || '').setDisabled(true));

        // Editable fields
        new Setting(contentEl)
            .setName('Dictionary Version')
            .setDesc('Version of this translation')
            .addText(text => text
                .setValue(this.meta.dictVersion || '1.0.0')
                .onChange(val => this.meta.dictVersion = val));

        new Setting(contentEl)
            .setName('Plugin Version')
            .setDesc('Target plugin version compatibility')
            .addText(text => text
                .setValue(this.meta.pluginVersion || '')
                .onChange(val => this.meta.pluginVersion = val));

        new Setting(contentEl)
            .setName('Author')
            .setDesc('Translator name or credit')
            .addText(text => text
                .setValue(this.meta.author || '')
                .onChange(val => this.meta.author = val));

        new Setting(contentEl)
            .setName('Description')
            .setDesc('Optional notes or description')
            .addTextArea(text => text
                .setValue(this.meta.description || '')
                .onChange(val => this.meta.description = val));

        const div = contentEl.createDiv({
            cls: 'modal-button-container',
            attr: { style: 'margin-top: 20px; display: flex; justify-content: flex-end; gap: 10px;' }
        });

        new Setting(div)
            .addButton(btn => btn
                .setButtonText('Cancel')
                .onClick(() => this.close()))
            .addButton(btn => btn
                .setButtonText('Update Metadata')
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
