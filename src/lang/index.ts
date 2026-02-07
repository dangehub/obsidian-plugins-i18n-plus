/**
 * i18n+ Self-Internationalization Module
 * 
 * This module provides internationalization for the i18n+ plugin itself.
 * It uses the same framework it provides to other plugins.
 */

import type { Dictionary, DictionaryMeta } from '../framework/types';
import { I18nTranslator } from '../framework/translator';
import type I18nPlusPlugin from '../main';

// Built-in translations
import zhDict from './zh.json';

// ============================================================================
// Base Dictionary (English - Default)
// ============================================================================

export const baseDictionary = {
    "$meta": {
        pluginId: "i18n-plus",
        locale: "en",
        dictVersion: "1.0.0",
        pluginVersion: ">=1.0.0",
        author: "i18n+ Team",
        description: "i18n+ plugin default English strings"
    } as DictionaryMeta,

    // === Manager Modal ===
    "manager.title": "I18n+ Dictionary Manager",
    "manager.registered_plugins": "Registered Plugins ({count})",
    "manager.themes_title": "Themes ({count})",
    "manager.dictionaries_suffix": "dictionaries",
    "manager.refresh_tooltip": "Reload dictionaries and refresh interface",
    "manager.orphan_section_title": "⚠️ Orphan Dictionaries ({count})",
    "manager.orphan_section_desc": "Dictionaries remaining for uninstalled or disabled plugins.",
    "manager.builtin_locales": "{count} builtin | {external} imported locales",
    "manager.delete_confirm_title": "Delete Dictionary",
    "manager.delete_confirm_message": "Are you sure you want to delete the {locale} dictionary for {pluginId}?",
    "manager.delete_confirm_warning": "This cannot be undone.",
    "manager.registered_plugins_tab": "Plugins",
    "manager.themes_tab": "Themes",
    "label.builtin": "BUILT-IN",
    "label.external": "EXTERNAL",
    "label.overlay": "OVERLAY",
    "label.theme_builtin": "THEME BASE",

    // === Manager Search ===
    "manager.search_plugins_placeholder": "Search plugins...",
    "manager.search_themes_placeholder": "Search themes...",

    // === Manager Actions ===
    "action.import_dictionary": "Import dictionary",
    "action.add_translation": "Add translation",
    "action.export_template": "Export template",
    "action.view_content": "View content",
    "action.export": "Export",
    "action.remove": "Remove",
    "action.cancel": "Cancel",
    "action.delete": "Delete",
    "action.update_available": "Update available: v{version}",
    "action.download_locale": "Download {locale}",

    // === Editor Modal ===
    "editor.search_placeholder": "Search keys or values...",
    "editor.show_missing_only": "Show missing only",
    "editor.save": "Save",
    "editor.export_json": "Export JSON",
    "editor.metadata": "Metadata",
    "editor.close": "Close",
    "editor.title": "Dictionary Editor",
    "editor.table_key": "Key",
    "editor.table_value": "Value",
    "editor.table_source": "Source",
    "editor.table_translation": "Translation",
    "editor.no_match": "No entries match your search.",
    "editor.no_entries": "No entries in this dictionary.",
    "editor.unsaved_changes_title": "You have unsaved changes.",
    "editor.unsaved_changes_message": "Click OK to save and close, or Cancel to discard changes.",


    // === Metadata Modal ===
    "metadata.title": "Dictionary Metadata",
    "metadata.plugin_id": "Plugin ID",
    "metadata.plugin_id_desc": "Target plugin identifier (Read-only)",
    "metadata.locale": "Locale",
    "metadata.locale_desc": "Target language code (Read-only)",
    "metadata.dict_version": "Dictionary Version",
    "metadata.dict_version_desc": "Version of this translation",
    "metadata.plugin_version": "Plugin Version",
    "metadata.plugin_version_desc": "Target plugin version compatibility",
    "metadata.author": "Author",
    "metadata.author_desc": "Translator name or credit",
    "metadata.description": "Description",
    "metadata.description_desc": "Optional notes or description",
    "metadata.update": "Update Metadata",

    // === Locale Suggest Modal ===
    "locale_suggest.placeholder": "Select language...",

    // === Notices ===
    "notice.refresh_success": "Refreshed. Loaded {count} dictionaries",
    "notice.switched_locale": "Switched {pluginId} to {locale}",
    "notice.deleted_orphan": "Deleted Orphan Dictionary: {pluginId}-{locale}",
    "notice.import_success": "Imported dictionary for {pluginId}",
    "notice.import_failed": "❌ Import Failed: {error}",
    "notice.export_failed": "Export failed: could not read file",
    "notice.export_success": "Exported {locale} for {pluginId}",
    "notice.translator_not_found": "Unable to get translator instance",
    "notice.export_builtin_success": "Exported builtin template: {locale}",
    "notice.removed_dict": "Removed {locale} dictionary",
    "notice.base_dict_not_found": "Error: Base dictionary ({locale}) not found",
    "notice.created_dict": "Created dictionary: {locale}",
    "notice.create_failed": "Failed to create dictionary: {error}",
    "notice.metadata_updated": "Metadata updated (pending save)",
    "notice.editor_export_success": "Exported {locale} dictionary",
    "notice.validation_errors": "Cannot save: {count} entries have validation errors",
    "notice.save_success": "Saved and refreshed {locale} dictionary",
    "notice.save_failed": "Failed to save dictionary",
    "notice.no_plugins": "No plugins registered to i18n-plus",
    "notice.registered_plugins": "Registered: {plugins}",
    "notice.loaded_dicts": "Loaded {count} dictionaries",
    "notice.theme_generated": "Generated base dictionary for {theme}",
    "notice.theme_updated": "Updated base dictionary for {theme}",

    // === Settings ===
    "settings.debug_mode": "Debug mode",
    "settings.debug_mode_desc": "Show detailed logs in the console",
    "settings.registered_plugins": "Registered plugins",
    "settings.loaded_locales": "Loaded locales: {locales}",
} as const satisfies Dictionary;

// Type for translation keys
export type LangKey = keyof typeof baseDictionary;

// ============================================================================
// Translator Instance
// ============================================================================

let translator: I18nTranslator<typeof baseDictionary> | null = null;
let plugin: I18nPlusPlugin | null = null;

/**
 * Initialize self-i18n for the i18n+ plugin.
 * This MUST be called at the very beginning of onload(), before any UI rendering.
 */
export function initSelfI18n(pluginInstance: I18nPlusPlugin): void {
    plugin = pluginInstance;

    // Create translator for i18n-plus itself
    translator = new I18nTranslator({
        pluginId: 'i18n-plus',
        baseLocale: 'en',
        baseDictionary: baseDictionary,
        currentLocale: undefined, // Will follow Obsidian's locale
    });

    // Load built-in translations (only zh, framework handles fallback for zh-CN/zh-TW)
    if (typeof translator.loadBuiltinDictionary === 'function') {
        translator.loadBuiltinDictionary('zh', zhDict as Dictionary);
    } else {
        // Fallback for older interface
        translator.loadDictionary('zh', zhDict as Dictionary);
    }

    // Register with global API if available
    if (window.i18nPlus) {
        window.i18nPlus.register('i18n-plus', translator);
    }
}

/**
 * Get the translator instance (for advanced use cases)
 */
export function getTranslator(): I18nTranslator<typeof baseDictionary> | null {
    return translator;
}

/**
 * Translation function for i18n+ UI strings.
 * 
 * @param key - Translation key from baseDictionary
 * @param vars - Optional interpolation variables
 * @returns Translated string, or key if translator not initialized
 */
export function t(key: LangKey, vars?: Record<string, string | number>): string {
    // Skip $meta key
    if (key === '$meta') return key;

    if (!translator) {
        // Graceful degradation: return key with variable substitution
        let result = String(baseDictionary[key] ?? key);
        if (vars) {
            for (const [k, v] of Object.entries(vars)) {
                result = result.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
            }
        }
        return result;
    }

    return translator.t(key, vars);
}
