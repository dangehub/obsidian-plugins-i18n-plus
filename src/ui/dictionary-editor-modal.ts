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
import type { Dictionary } from '../framework/types';

// ============================================================================
// Data Models
// ============================================================================

/** Single dictionary entry with variable detection */
interface DictionaryEntry {
    key: string;
    value: string;
    hasVariables: boolean;
    variables: string[];
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
            isReadOnly: true, // Phase 1: always read-only
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

        // Parse entries with variable detection
        this.state.entries = this.parseEntries(dict);
        this.state.filteredEntries = [...this.state.entries];
    }

    private parseEntries(dict: Dictionary): DictionaryEntry[] {
        const entries: DictionaryEntry[] = [];

        for (const [key, value] of Object.entries(dict)) {
            if (typeof value === 'string') {
                const { hasVariables, variables } = detectVariables(value);
                entries.push({ key, value, hasVariables, variables });
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
        const row = tbody.createEl('tr', { cls: 'i18n-plus-editor-row' });

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

        // Value cell
        const valueCell = row.createEl('td', { cls: 'i18n-plus-editor-cell-value' });

        if (entry.hasVariables) {
            // Highlight variables in value
            this.renderValueWithHighlight(valueCell, entry.value, entry.variables);
        } else {
            valueCell.textContent = entry.value;
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

        // Export button
        new Setting(footer)
            .addButton(btn => btn
                .setButtonText('Export JSON')
                .setIcon('download')
                .onClick(async () => {
                    await this.exportDictionary();
                })
            )
            .addButton(btn => btn
                .setButtonText('Close')
                .onClick(() => {
                    this.close();
                })
            );
    }

    // ========================================================================
    // Actions
    // ========================================================================

    private filterEntries(): void {
        if (!this.state.searchQuery) {
            this.state.filteredEntries = [...this.state.entries];
            return;
        }

        const query = this.state.searchQuery.toLowerCase();
        this.state.filteredEntries = this.state.entries.filter(entry =>
            entry.key.toLowerCase().includes(query) ||
            entry.value.toLowerCase().includes(query)
        );
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
    // Phase 2 Extension Points (not implemented in Phase 1)
    // ========================================================================

    /** Override in Phase 2 to handle entry edits */
    protected onEntryEdit?(key: string, newValue: string): void;

    /** Override in Phase 2 to handle save */
    protected onSave?(): Promise<void>;
}
