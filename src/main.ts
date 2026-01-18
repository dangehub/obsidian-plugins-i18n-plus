/**
 * I18n Plus Plugin for Obsidian
 * 
 * 为 Obsidian 插件生态提供通用国际化框架
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
		console.info('[i18n-plus] Loading plugin...');

		await this.loadSettings();

		// 初始化全局 API
		initGlobalAPI();

		// 初始化词典存储
		this.dictionaryStore = new DictionaryStore(this.app, this);

		// 添加设置面板
		this.addSettingTab(new I18nPlusSettingTab(this.app, this));

		// 添加命令
		this.addCommand({
			id: 'open-dictionary-manager',
			name: '打开词典管理器',
			callback: () => {
				new DictionaryManagerModal(this.app, this).open();
			}
		});

		this.addCommand({
			id: 'show-registered-plugins',
			name: '显示已注册插件',
			callback: () => {
				const manager = getI18nPlusManager();
				const plugins = manager.getRegisteredPlugins();
				if (plugins.length === 0) {
					new Notice('暂无插件注册到 i18n-plus');
				} else {
					new Notice(`已注册: ${plugins.join(', ')}`);
				}
			}
		});

		this.addCommand({
			id: 'reload-dictionaries',
			name: '重新加载所有词典',
			callback: async () => {
				const count = await this.dictionaryStore.autoLoadDictionaries();
				new Notice(`已加载 ${count} 个词典`);
			}
		});

		// 添加 Ribbon 图标 - 点击打开词典管理器
		this.addRibbonIcon('languages', 'I18n Plus 词典管理器', () => {
			new DictionaryManagerModal(this.app, this).open();
		});

		// 监听语言变化事件，保存到设置
		const manager = getI18nPlusManager();
		manager.on('locale-changed', async (locale: unknown) => {
			if (typeof locale === 'string' && locale !== this.settings.currentLocale) {
				this.settings.currentLocale = locale;
				await this.saveSettings();
				console.info(`[i18n-plus] Saved locale preference: ${locale}`);
			}
		});

		// 监听插件注册事件，自动加载该插件的词典并应用语言设置
		manager.on('plugin-registered', async (pluginId: unknown) => {
			if (typeof pluginId === 'string') {
				// 加载该插件的词典
				const count = await this.dictionaryStore.loadDictionariesForPlugin(pluginId);
				if (count > 0) {
					// console.info 这里可以保留，或者仅在 debug 模式输出
				}

				// 如果有全局语言设置，则应用到该插件
				if (this.settings.currentLocale) {
					const translator = manager.getTranslator(pluginId);
					// 仅当插件当前语言与全局设置不一致时才切换，避免重复设置
					if (translator && translator.getLocale() !== this.settings.currentLocale) {
						try {
							translator.setLocale(this.settings.currentLocale);
							console.info(`[i18n-plus] Applied locale preference to ${pluginId}: ${this.settings.currentLocale}`);
						} catch (e) {
							console.warn(`[i18n-plus] Failed to apply locale to ${pluginId}`, e);
						}
					}
				}
			}
		});

		// 延迟自动加载已安装的词典（等待其他插件注册）
		setTimeout(async () => {
			const count = await this.dictionaryStore.autoLoadDictionaries();
			if (count > 0) {
				console.info(`[i18n-plus] Auto-loaded ${count} dictionaries on startup`);
			}

			// 恢复保存的语言设置
			if (this.settings.currentLocale) {
				manager.setGlobalLocale(this.settings.currentLocale);
				console.info(`[i18n-plus] Restored locale: ${this.settings.currentLocale}`);
			}
		}, 3000);

		console.info('[i18n-plus] Plugin loaded successfully');
	}

	onunload() {
		// 销毁全局 API
		destroyGlobalAPI();
		console.info('[i18n-plus] Plugin unloaded');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<I18nPlusSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
