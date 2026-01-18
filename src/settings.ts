/**
 * I18n Plus Settings
 */

import { App, PluginSettingTab, Setting } from 'obsidian';
import type I18nPlusPlugin from './main';

export interface I18nPlusSettings {
	/** 是否显示调试日志 */
	debugMode: boolean;
	/** 当前语言（持久化用户选择） */
	currentLocale: string;
}

export const DEFAULT_SETTINGS: I18nPlusSettings = {
	debugMode: false,
	currentLocale: '',  // 空表示使用 Obsidian 默认语言
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

		containerEl.createEl('h2', { text: 'I18n Plus Settings' });

		new Setting(containerEl)
			.setName('Debug mode')
			.setDesc('Show detailed logs in the console')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.debugMode)
				.onChange(async (value) => {
					this.plugin.settings.debugMode = value;
					await this.plugin.saveSettings();
				}));

		// 显示已注册的插件信息
		containerEl.createEl('h3', { text: 'Registered Plugins' });

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
