/**
 * I18n Plus - Dictionary Management Modal
 * 
 * 词典管理界面，提供：
 * - 查看已注册插件列表
 * - 区分内置语言和导入语言
 * - 切换插件语言
 * - 导入/导出词典文件
 * - 卸载词典
 */

import { App, Modal, Setting, Notice } from 'obsidian';
import type I18nPlusPlugin from '../main';
import { getI18nPlusManager } from '../framework/global-api';
import { DictionaryStore, DictionaryFileInfo } from '../services/dictionary-store';
import { OBSIDIAN_LOCALES } from '../framework/locales';

/**
 * 词典管理 Modal
 */
export class DictionaryManagerModal extends Modal {
    private plugin: I18nPlusPlugin;
    private store: DictionaryStore;

    constructor(app: App, plugin: I18nPlusPlugin) {
        super(app);
        this.plugin = plugin;
        this.store = new DictionaryStore(app, plugin);
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('i18n-plus-manager');

        // 标题和刷新按钮
        const headerDiv = contentEl.createDiv({ cls: 'i18n-plus-header' });
        headerDiv.createEl('h2', { text: '📚 词典管理器' });

        // 刷新按钮
        new Setting(headerDiv)
            .addButton(btn => btn
                .setButtonText('🔄 刷新')
                .setTooltip('重新加载词典并刷新界面')
                .onClick(async () => {
                    const count = await this.plugin.dictionaryStore.autoLoadDictionaries();
                    new Notice(`已刷新，加载了 ${count} 个词典`);
                    this.onOpen();
                })
            );

        // 简介
        contentEl.createEl('p', {
            text: '管理已注册插件的翻译词典。',
            cls: 'setting-item-description'
        });

        // 获取数据
        const manager = getI18nPlusManager();
        const registeredPlugins = manager.getRegisteredPlugins();
        const installedDicts = await this.store.listAllDictionaries();

        // 已注册插件部分 - 使用可滚动容器
        contentEl.createEl('h3', { text: `已注册插件 (${registeredPlugins.length})` });

        if (registeredPlugins.length === 0) {
            contentEl.createEl('p', {
                text: '暂无插件注册到 i18n-plus。',
                cls: 'setting-item-description'
            });
        } else {
            const pluginList = contentEl.createDiv({ cls: 'i18n-plus-plugin-list' });
            for (const pluginId of registeredPlugins) {
                await this.renderPluginSection(pluginList, pluginId, installedDicts);
            }
        }

        // 孤立词典
        const orphanDicts = installedDicts.filter(d => !registeredPlugins.includes(d.pluginId));
        if (orphanDicts.length > 0) {
            contentEl.createEl('h3', { text: `⚠️ 孤立词典 (${orphanDicts.length})` });
            contentEl.createEl('p', {
                text: '目标插件未注册',
                cls: 'setting-item-description'
            });
            this.renderOrphanDictsList(contentEl, orphanDicts);
        }
    }

    /**
     * 渲染单个插件的部分
     */
    private async renderPluginSection(
        container: HTMLElement,
        pluginId: string,
        installedDicts: DictionaryFileInfo[]
    ) {
        const manager = getI18nPlusManager();
        const translator = manager.getTranslator(pluginId);
        if (!translator) return;

        const builtinLocales = translator.getBuiltinLocales?.() || [];
        const externalLocales = translator.getExternalLocales?.() || [];
        const currentLocale = translator.getLocale();
        const pluginDicts = installedDicts.filter(d => d.pluginId === pluginId);

        const section = container.createDiv({ cls: 'i18n-plus-plugin-section' });

        // 插件卡片
        const pluginSetting = new Setting(section)
            .setName(pluginId)
            .setDesc(this.buildLocaleDescription(builtinLocales, externalLocales));

        // 语言切换下拉框
        pluginSetting.addDropdown(dropdown => {
            // 添加所有可用语言
            const allLocales = [...new Set([...builtinLocales, ...externalLocales])];
            for (const locale of allLocales) {
                const localeInfo = OBSIDIAN_LOCALES.find(l => l.code === locale);
                const label = localeInfo ? `${localeInfo.nativeName} (${locale})` : locale;
                const isExternal = externalLocales.includes(locale) && !builtinLocales.includes(locale);
                dropdown.addOption(locale, isExternal ? `📥 ${label}` : label);
            }
            dropdown.setValue(currentLocale);
            dropdown.onChange(async (value) => {
                translator.setLocale(value);
                manager.setGlobalLocale(value);
                new Notice(`已切换 ${pluginId} 语言为: ${value}`);
            });
        });

        // 导入按钮
        pluginSetting.addButton(btn => btn
            .setButtonText('📥')
            .setTooltip('导入词典')
            .onClick(() => this.importDictionaryForPlugin(pluginId))
        );

        // 外部词典管理（如果有）
        if (pluginDicts.length > 0) {
            const dictDiv = section.createDiv({ cls: 'i18n-plus-dict-list' });
            dictDiv.createEl('small', {
                text: `已导入 ${pluginDicts.length} 个词典`,
                cls: 'setting-item-description'
            });
            for (const dict of pluginDicts) {
                this.renderDictItem(dictDiv, dict);
            }
        } else {
            section.createEl('small', {
                text: '0 个导入词典',
                cls: 'setting-item-description i18n-plus-no-dict'
            });
        }
    }

    /**
     * 构建语言描述
     */
    private buildLocaleDescription(builtinLocales: string[], externalLocales: string[]): string {
        const parts: string[] = [];
        if (builtinLocales.length > 0) {
            parts.push(`内置: ${builtinLocales.join(', ')}`);
        }
        if (externalLocales.length > 0) {
            const uniqueExternal = externalLocales.filter(l => !builtinLocales.includes(l));
            if (uniqueExternal.length > 0) {
                parts.push(`导入: ${uniqueExternal.join(', ')}`);
            }
        }
        return parts.join(' | ');
    }

    /**
     * 渲染单个词典条目
     */
    private renderDictItem(container: HTMLElement, dict: DictionaryFileInfo) {
        const item = container.createDiv({ cls: 'i18n-plus-dict-item' });

        new Setting(item)
            .setName(`📥 ${dict.locale}`)
            .setDesc(`v${dict.dictVersion || '?'}`)
            .addButton(btn => btn
                .setIcon('download')
                .setTooltip('导出')
                .onClick(() => this.exportDictionary(dict))
            )
            .addButton(btn => btn
                .setIcon('trash')
                .setTooltip('卸载')
                .setWarning()
                .onClick(() => this.unloadDictionary(dict))
            );
    }

    /**
     * 渲染孤立词典列表
     */
    private renderOrphanDictsList(container: HTMLElement, dicts: DictionaryFileInfo[]) {
        const list = container.createDiv({ cls: 'i18n-plus-orphan-list' });
        for (const dict of dicts) {
            new Setting(list)
                .setName(`${dict.pluginId} / ${dict.locale}`)
                .addButton(btn => btn
                    .setIcon('trash')
                    .setWarning()
                    .onClick(async () => {
                        await this.store.deleteDictionary(dict.pluginId, dict.locale);
                        new Notice(`已删除`);
                        this.onOpen();
                    })
                );
        }
    }

    /**
     * 为指定插件导入词典
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
                new Notice(`✅ 导入成功`);
                this.onOpen();
            } else {
                const errorMsg = result.errors?.map(e => e.message).join(', ') || '未知错误';
                new Notice(`❌ 导入失败: ${errorMsg}`);
            }
        };

        input.click();
    }

    /**
     * 导出词典
     */
    private async exportDictionary(dict: DictionaryFileInfo) {
        const blob = await this.store.exportToBlob(dict.pluginId, dict.locale);
        if (!blob) {
            new Notice('导出失败');
            return;
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${dict.pluginId}-${dict.locale}.json`;
        a.click();
        URL.revokeObjectURL(url);

        new Notice(`已导出`);
    }

    /**
     * 卸载词典
     */
    private async unloadDictionary(dict: DictionaryFileInfo) {
        const manager = getI18nPlusManager();
        manager.unloadDictionary(dict.pluginId, dict.locale);
        await this.store.deleteDictionary(dict.pluginId, dict.locale);
        new Notice(`已卸载`);
        this.onOpen();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
