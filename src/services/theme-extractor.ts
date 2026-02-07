
import { parseYaml } from 'obsidian';

export class ThemeExtractor {
    /**
     * Compute simple hash of content
     */
    static computeHash(content: string): string {
        let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
        for (let i = 0, ch; i < content.length; i++) {
            ch = content.charCodeAt(i);
            h1 = Math.imul(h1 ^ ch, 2654435761);
            h2 = Math.imul(h2 ^ ch, 1597334677);
        }
        h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
        h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
        return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
    }

    /**
     * Parse Style Settings configuration from CSS content
     * @param cssContent The content of the CSS file
     * @returns A map of English strings to themselves (as initial values) and the content hash
     */
    static extractSettings(cssContent: string): { strings: Record<string, string>, hash: string } {
        // Compute hash first
        const hash = this.computeHash(cssContent);

        // Style Settings uses /* @settings ... */ blocks
        // Regex to capture content between /* @settings and */
        const regex = /\/\*\s*@settings([\s\S]*?)\*\//g;
        const strings: Record<string, string> = {};
        const ids: string[] = [];
        let match;

        while ((match = regex.exec(cssContent)) !== null) {
            let yamlContent = match[1];
            if (!yamlContent) continue;

            // Fix: Style Settings often uses tabs, which YAML forbids. Replace tabs with 2 spaces.
            yamlContent = yamlContent.replace(/\t/g, '  ');

            try {
                const config = parseYaml(yamlContent);
                // Capture the Theme ID defined in Style Settings
                if (config && config.id) {
                    ids.push(config.id);
                }
                this.traverseConfig(config, strings);
            } catch (e) {
                console.error('[i18n-plus] Failed to parse settings YAML from CSS', e);
                console.debug('[i18n-plus] Failed YAML content:', yamlContent);
            }
        }

        if (ids.length > 0) {
            strings['@@ids'] = JSON.stringify(ids);
        }

        console.log(`[i18n-plus] Extracted ${Object.keys(strings).length} strings from theme CSS. Hash: ${hash}`);
        return { strings, hash };
    }

    private static traverseConfig(node: any, strings: Record<string, string>) {
        if (!node) return;

        // Top level fields
        if (node.name) strings[node.name] = node.name;
        // Description at top level
        if (node.description) strings[node.description] = node.description;

        if (Array.isArray(node.settings)) {
            for (const item of node.settings) {
                this.traverseItem(item, strings);
            }
        }
    }

    private static traverseItem(item: any, strings: Record<string, string>) {
        if (!item) return;

        // Title / Label
        if (item.title) strings[item.title] = item.title;
        if (item.label) strings[item.label] = item.label;

        // Description
        if (item.description) strings[item.description] = item.description;

        // Placeholder
        if (item.placeholder) strings[item.placeholder] = item.placeholder;

        // Options (Dropdowns)
        if (item.options) {
            if (Array.isArray(item.options)) {
                // list of {label: string, value: string}
                for (const opt of item.options) {
                    if (opt.label) strings[opt.label] = opt.label;
                }
            } else if (typeof item.options === 'object') {
                // map value: label
                for (const key in item.options) {
                    const label = item.options[key];
                    if (label && typeof label === 'string') {
                        strings[label] = label;
                    }
                }
            }
        }

        // Nested settings
        if (Array.isArray(item.settings)) {
            for (const subItem of item.settings) {
                this.traverseItem(subItem, strings);
            }
        }
    }
}
