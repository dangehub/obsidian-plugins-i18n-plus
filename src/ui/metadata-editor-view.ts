/**
 * I18n Plus - Metadata Editor View
 * 
 * A view component for editing dictionary metadata within the floating widget.
 * Replaces the modal-based MetadataEditorModal for a consistent user experience.
 */

import { App, Setting, Notice } from 'obsidian';
import type I18nPlusPlugin from '../main';
import type { DictionaryMeta } from '../framework/types';
import { t } from '../lang';

export class MetadataEditorView {
    private app: App;
    private plugin: I18nPlusPlugin;
    private meta: Partial<DictionaryMeta>;
    private onSave: (meta: Partial<DictionaryMeta>) => void;
    private onCancel: () => void;
    private container: HTMLElement | null = null;

    constructor(
        app: App,
        plugin: I18nPlusPlugin,
        meta: Partial<DictionaryMeta>,
        onSave: (meta: Partial<DictionaryMeta>) => void,
        onCancel: () => void
    ) {
        this.app = app;
        this.plugin = plugin;
        // Clone meta to avoid direct mutation until save
        this.meta = { ...meta };
        this.onSave = onSave;
        this.onCancel = onCancel;
    }

    /**
     * Render the metadata editor into a container
     * Compatible with I18nFloatingWidget.showView()
     */
    render(container: HTMLElement): void {
        this.container = container;
        container.empty();
        container.addClass('i18n-plus-metadata-view');

        // Header section
        const header = container.createDiv({ cls: 'i18n-plus-metadata-header' });
        header.createEl('h3', { text: t('metadata.title'), cls: 'i18n-plus-metadata-title' });
        header.createEl('p', {
            text: t('metadata.description') || 'Edit dictionary metadata fields below.',
            cls: 'i18n-plus-metadata-desc'
        });

        // Form container
        const form = container.createDiv({ cls: 'i18n-plus-metadata-form' });

        // Read-only fields
        new Setting(form)
            .setName(t('metadata.plugin_id'))
            .setDesc(t('metadata.plugin_id_desc'))
            .addText(text => text
                .setValue(this.meta.pluginId || '')
                .setDisabled(true));

        new Setting(form)
            .setName(t('metadata.locale'))
            .setDesc(t('metadata.locale_desc'))
            .addText(text => text
                .setValue(this.meta.locale || '')
                .setDisabled(true));

        // Editable fields
        new Setting(form)
            .setName(t('metadata.dict_version'))
            .setDesc(t('metadata.dict_version_desc'))
            .addText(text => text
                .setValue(this.meta.dictVersion || '1.0.0')
                .onChange(val => this.meta.dictVersion = val));

        new Setting(form)
            .setName(t('metadata.plugin_version'))
            .setDesc(t('metadata.plugin_version_desc'))
            .addText(text => text
                .setValue(this.meta.pluginVersion || '')
                .onChange(val => this.meta.pluginVersion = val));

        new Setting(form)
            .setName(t('metadata.author'))
            .setDesc(t('metadata.author_desc'))
            .addText(text => text
                .setValue(this.meta.author || '')
                .onChange(val => this.meta.author = val));

        new Setting(form)
            .setName(t('metadata.description'))
            .setDesc(t('metadata.description_desc'))
            .addTextArea(text => text
                .setValue(this.meta.description || '')
                .onChange(val => this.meta.description = val));

        // Footer buttons
        const footer = container.createDiv({ cls: 'i18n-plus-metadata-footer' });

        new Setting(footer)
            .addButton(btn => btn
                .setButtonText(t('action.cancel'))
                .onClick(() => {
                    this.onCancel();
                }))
            .addButton(btn => btn
                .setButtonText(t('metadata.update'))
                .setCta()
                .onClick(() => {
                    this.onSave(this.meta);
                    new Notice(t('notice.metadata_updated'));
                }));
    }
}
