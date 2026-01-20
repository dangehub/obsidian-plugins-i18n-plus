/**
 * I18n Plus Plugin for Obsidian
 * 
 * A universal internationalization framework for the Obsidian plugin ecosystem
 */

import { Notice, Plugin } from 'obsidian';
import { initGlobalAPI, destroyGlobalAPI, getI18nPlusManager } from './framework';
import { DEFAULT_SETTINGS, I18nPlusSettings, I18nPlusSettingTab } from './settings';
import { DictionaryStore } from './services/dictionary-store';
import { DictionaryManagerModal } from './ui/dictionary-manager';

export default class I18nPlusPlugin extends Plugin {
	settings: I18nPlusSettings;
	dictionaryStore: DictionaryStore;

	async onload() {
		if (this.settings?.debugMode) console.debug('[i18n-plus] Loading plugin...');

		await this.loadSettings();

		// Initialize dictionary store (must be before initGlobalAPI as event listeners need it)
		this.dictionaryStore = new DictionaryStore(this.app, this);

		// Get manager instance and set up event listeners first
		// This ensures we capture plugin registrations when initGlobalAPI triggers i18n-plus:ready
		const manager = getI18nPlusManager();

		// Listen to plugin registration events, auto-load dictionaries and apply locale settings
		manager.on('plugin-registered', (pluginId: unknown) => {
			if (typeof pluginId === 'string') {
				if (this.settings.debugMode) {
					console.debug(`[i18n-plus] plugin-registered event for: ${pluginId}`);
				}
				// Load dictionaries for this plugin
				void this.dictionaryStore.loadDictionariesForPlugin(pluginId).then(count => {
					if (this.settings.debugMode && count > 0) {
						console.debug(`[i18n-plus] Loaded ${count} dictionaries for plugin: ${pluginId}`);
					}

					// Apply global locale setting to this plugin if set
					if (this.settings.currentLocale) {
						const translator = manager.getTranslator(pluginId);
						// Only switch if plugin's current locale differs from global setting
						if (translator && translator.getLocale() !== this.settings.currentLocale) {
							try {
								translator.setLocale(this.settings.currentLocale);
								if (this.settings.debugMode) {
									console.debug(`[i18n-plus] Applied locale preference to ${pluginId}: ${this.settings.currentLocale}`);
								}
							} catch (e) {
								console.warn(`[i18n-plus] Failed to apply locale to ${pluginId}`, e);
							}
						}
					}
				});
			}
		});

		// Listen to locale change events and persist to settings
		manager.on('locale-changed', (locale: unknown) => {
			if (typeof locale === 'string' && locale !== this.settings.currentLocale) {
				this.settings.currentLocale = locale;
				void this.saveSettings().then(() => {
					if (this.settings.debugMode) {
						console.debug(`[i18n-plus] Saved locale preference: ${locale}`);
					}
				});
			}
		});

		// Initialize global API (this triggers i18n-plus:ready event, causing other plugins to register)
		initGlobalAPI();

		// Add settings tab
		this.addSettingTab(new I18nPlusSettingTab(this.app, this));

		// Add commands
		this.addCommand({
			id: 'open-dictionary-manager',
			name: 'Open dictionary manager',
			callback: () => {
				new DictionaryManagerModal(this.app, this).open();
			}
		});

		this.addCommand({
			id: 'show-registered-plugins',
			name: 'Show registered plugins',
			callback: () => {
				const manager = getI18nPlusManager();
				const plugins = manager.getRegisteredPlugins();
				if (plugins.length === 0) {
					new Notice('No plugins registered to i18n-plus');
				} else {
					new Notice(`Registered: ${plugins.join(', ')}`);
				}
			}
		});

		this.addCommand({
			id: 'reload-dictionaries',
			name: 'Reload all dictionaries',
			callback: () => {
				void this.dictionaryStore.autoLoadDictionaries().then(count => {
					new Notice(`Loaded ${count} dictionaries`);
				});
			}
		});

		// Add ribbon icon - click to open dictionary manager
		this.addRibbonIcon('languages', 'I18n plus dictionary manager', () => {
			new DictionaryManagerModal(this.app, this).open();
		});

		// Delayed auto-load of installed dictionaries (wait for other plugins to register)
		setTimeout(() => {
			void this.dictionaryStore.autoLoadDictionaries().then(count => {
				if (count > 0 && this.settings.debugMode) {
					console.debug(`[i18n-plus] Auto-loaded ${count} dictionaries on startup`);
				}

				// Restore saved locale setting
				if (this.settings.currentLocale) {
					manager.setGlobalLocale(this.settings.currentLocale);
					if (this.settings.debugMode) {
						console.debug(`[i18n-plus] Restored locale: ${this.settings.currentLocale}`);
					}
				}
			});
		}, 3000);

		if (this.settings.debugMode) console.debug('[i18n-plus] Plugin loaded successfully');
	}

	onunload() {
		destroyGlobalAPI();
		if (this.settings.debugMode) console.debug('[i18n-plus] Plugin unloaded');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<I18nPlusSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
