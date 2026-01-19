/**
 * I18n Plus Settings
 */

import { App, PluginSettingTab, Setting } from 'obsidian';
import type I18nPlusPlugin from './main';

export interface I18nPlusSettings {
	/** Whether to show debug logs */
	debugMode: boolean;
	/** Current locale (persisted user preference) */
	currentLocale: string;
}

export const DEFAULT_SETTINGS: I18nPlusSettings = {
	debugMode: false,
	currentLocale: '',  // Empty means use Obsidian's default language
};

export class I18nPlusSettingTab extends PluginSettingTab {
	plugin: I18nPlusPlugin;

	constructor(app: App, plugin: I18nPlusPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Debug mode')
			.setDesc('Show detailed logs in the console')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.debugMode)
				.onChange(async (value) => {
					this.plugin.settings.debugMode = value;
					await this.plugin.saveSettings();
				}));

		// Display registered plugins info
		new Setting(containerEl).setName('Registered plugins').setHeading();

		const pluginListEl = containerEl.createDiv({ cls: 'i18n-plus-plugin-list' });

		if (window.i18nPlus) {
			const plugins = window.i18nPlus.getRegisteredPlugins();
			if (plugins.length === 0) {
				pluginListEl.createEl('p', {
					text: 'No plugins registered yet. Plugins need to integrate i18n-plus framework.',
					cls: 'setting-item-description'
				});
			} else {
				for (const pluginId of plugins) {
					const locales = window.i18nPlus.getLoadedLocales(pluginId);
					new Setting(pluginListEl)
						.setName(pluginId)
						.setDesc(`Loaded locales: ${locales.join(', ') || 'none'}`);
				}
			}
		} else {
			pluginListEl.createEl('p', {
				text: 'i18n-plus API not initialized',
				cls: 'setting-item-description'
			});
		}
	}
}
