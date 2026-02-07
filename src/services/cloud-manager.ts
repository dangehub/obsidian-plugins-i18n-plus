/**
 * I18n Plus - Cloud Dictionary Manager
 * 
 * Responsible for:
 * - Fetching remote dictionary manifest
 * - Downloading dictionary files from cloud
 * - Version comparison between local and remote dictionaries
 */

import { requestUrl } from 'obsidian';
import { Dictionary } from '../framework/types';

/**
 * Remote Dictionary Metadata (from Manifest)
 */
export interface RemoteDictionaryInfo {
    pluginId?: string;
    themeName?: string;
    locale: string;
    dictVersion: string;
    downloadUrl: string;
    author?: string;
    description?: string;
    fileSize?: number;
}

/**
 * Cloud Manager Service
 */
export class CloudManager {
    /** 
     * Remote Manifest URL 
     */
    /** 
     * Remote Manifest URL 
     */
    private manifestUrl: string = 'https://cdn.jsdelivr.net/gh/open-obsidian-i18n/dictionaries@main/manifest.json';
    private remoteManifest: RemoteDictionaryInfo[] = [];
    private fetchPromise: Promise<RemoteDictionaryInfo[]> | null = null;
    public hasLoaded: boolean = false;

    public get isFetching(): boolean {
        return this.fetchPromise !== null;
    }

    /**
     * Fetch the remote manifest to see what's available in the cloud
     */
    async fetchRemoteManifest(force = false): Promise<RemoteDictionaryInfo[]> {
        if (this.fetchPromise && !force) return this.fetchPromise;

        this.fetchPromise = (async () => {
            try {
                console.debug('[i18n-plus] Fetching remote dictionary manifest...');
                const response = await requestUrl({
                    url: this.manifestUrl,
                    method: 'GET',
                    headers: {
                        'Cache-Control': 'no-cache'
                    }
                });

                if (response.status !== 200) {
                    throw new Error(`Failed to fetch manifest: ${response.status}`);
                }

                const manifest = response.json;
                let plugins = (manifest.plugins || []) as RemoteDictionaryInfo[];
                let themes = (manifest.themes || []) as RemoteDictionaryInfo[];

                // URL Rewrite for Connectivity (GitHub Raw -> jsDelivr)
                const rewriteUrl = (url: string) => {
                    if (url && url.startsWith('https://raw.githubusercontent.com/open-obsidian-i18n/dictionaries/main/')) {
                        return url.replace(
                            'https://raw.githubusercontent.com/open-obsidian-i18n/dictionaries/main/',
                            'https://cdn.jsdelivr.net/gh/open-obsidian-i18n/dictionaries@main/'
                        );
                    }
                    return url;
                };

                plugins = plugins.map(p => ({ ...p, downloadUrl: rewriteUrl(p.downloadUrl) }));
                themes = themes.map(t => ({ ...t, downloadUrl: rewriteUrl(t.downloadUrl) }));

                this.remoteManifest = [...plugins, ...themes];
                this.hasLoaded = true;
                console.debug(`[i18n-plus] Found ${this.remoteManifest.length} dictionaries in cloud (Plugins: ${plugins.length}, Themes: ${themes.length}).`);
                return this.remoteManifest;
            } catch (error) {
                console.warn('[i18n-plus] Cloud manifest fetch failed.', error);
                this.remoteManifest = [];
                return [];
            } finally {
                this.fetchPromise = null;
            }
        })();
        return this.fetchPromise;
    }

    /**
     * Get available cloud dictionaries for a specific plugin
     */
    getCloudDictsForPlugin(pluginId: string): RemoteDictionaryInfo[] {
        return this.remoteManifest.filter(d => d.pluginId === pluginId);
    }

    /**
     * Get available cloud dictionaries for a specific theme
     */
    getCloudDictsForTheme(themeName: string): RemoteDictionaryInfo[] {
        return this.remoteManifest.filter(d => d.themeName === themeName);
    }

    /**
     * Download a dictionary from a specific URL
     */
    async downloadDictionary(url: string): Promise<Dictionary> {
        try {
            console.debug(`[i18n-plus] Downloading dictionary from: ${url}`);
            const response = await requestUrl({ url });

            if (response.status !== 200) {
                throw new Error(`Download failed with status ${response.status}`);
            }

            // Simple validation: it must be a valid JSON dictionary
            const dict = response.json as Dictionary;
            if (!dict || !dict.$meta || !dict.$meta.locale) {
                throw new Error('Invalid dictionary format: missing $meta.locale');
            }

            return dict;
        } catch (error) {
            console.error('[i18n-plus] Dictionary download failed:', error);
            throw error;
        }
    }

    /**
     * Compare semantic versions (simple version)
     * Returns true if remote is newer than local
     */
    isUpdateAvailable(localVersion: string, remoteVersion: string): boolean {
        if (!localVersion) return true;

        // Simple string comparison for timestamps or versions
        // If versions are purely numeric timestamps, string comparison works if lengths are same, 
        // but better to parse if possible.
        // Assuming semver or timestamp.

        // Check if both are timestamps (only digits)
        const isLocalTimestamp = /^\d+$/.test(localVersion);
        const isRemoteTimestamp = /^\d+$/.test(remoteVersion);

        if (isLocalTimestamp && isRemoteTimestamp) {
            return Number(remoteVersion) > Number(localVersion);
        }

        const localParts = localVersion.split('.').map(Number);
        const remoteParts = remoteVersion.split('.').map(Number);

        for (let i = 0; i < Math.max(localParts.length, remoteParts.length); i++) {
            const v1 = localParts[i] || 0;
            const v2 = remoteParts[i] || 0;
            if (v2 > v1) return true;
            if (v2 < v1) return false;
        }
        return false;
    }
}
