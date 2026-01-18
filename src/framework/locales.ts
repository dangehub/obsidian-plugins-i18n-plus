/**
 * I18n Plus Framework - Obsidian Standard Locales
 * 
 * Obsidian 官方支持的语言列表
 * 来源：https://github.com/obsidianmd/obsidian-translations
 * 
 * 所有引入 i18n plus 的插件都应使用此标准表
 */

export interface LocaleInfo {
    /** 语言代码 (BCP 47) */
    code: string;
    /** 英文名称 */
    name: string;
    /** 本地名称 */
    nativeName: string;
}

/**
 * Obsidian 官方支持的所有语言
 */
export const OBSIDIAN_LOCALES: LocaleInfo[] = [
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'af', name: 'Afrikaans', nativeName: 'Afrikaans' },
    { code: 'am', name: 'Amharic', nativeName: 'አማርኛ' },
    { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
    { code: 'az', name: 'Azerbaijani', nativeName: 'Azərbaycan' },
    { code: 'be', name: 'Belarusian', nativeName: 'Беларуская мова' },
    { code: 'bg', name: 'Bulgarian', nativeName: 'български език' },
    { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
    { code: 'ca', name: 'Catalan', nativeName: 'català' },
    { code: 'cs', name: 'Czech', nativeName: 'čeština' },
    { code: 'da', name: 'Danish', nativeName: 'Dansk' },
    { code: 'de', name: 'German', nativeName: 'Deutsch' },
    { code: 'dv', name: 'Dhivehi', nativeName: 'ދިވެހި' },
    { code: 'el', name: 'Greek', nativeName: 'Ελληνικά' },
    { code: 'en-gb', name: 'English (GB)', nativeName: 'English (GB)' },
    { code: 'eo', name: 'Esperanto', nativeName: 'Esperanto' },
    { code: 'es', name: 'Spanish', nativeName: 'Español' },
    { code: 'eu', name: 'Basque', nativeName: 'Euskara' },
    { code: 'fa', name: 'Persian', nativeName: 'فارسی' },
    { code: 'fi', name: 'Finnish', nativeName: 'suomi' },
    { code: 'fr', name: 'French', nativeName: 'français' },
    { code: 'ga', name: 'Irish', nativeName: 'Gaeilge' },
    { code: 'gl', name: 'Galician', nativeName: 'Galego' },
    { code: 'he', name: 'Hebrew', nativeName: 'עברית' },
    { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
    { code: 'hr', name: 'Croatian', nativeName: 'Hrvatski' },
    { code: 'hu', name: 'Hungarian', nativeName: 'Magyar' },
    { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia' },
    { code: 'it', name: 'Italian', nativeName: 'Italiano' },
    { code: 'ja', name: 'Japanese', nativeName: '日本語' },
    { code: 'ka', name: 'Georgian', nativeName: 'ქართული' },
    { code: 'kh', name: 'Khmer', nativeName: 'ខេមរភាសា' },
    { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
    { code: 'ko', name: 'Korean', nativeName: '한국어' },
    { code: 'ky', name: 'Kyrgyz', nativeName: 'Кыргызча' },
    { code: 'la', name: 'Latin', nativeName: 'Latina' },
    { code: 'lt', name: 'Lithuanian', nativeName: 'Lietuvių' },
    { code: 'lv', name: 'Latvian', nativeName: 'Latviešu' },
    { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം' },
    { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu' },
    { code: 'nan-tw', name: 'Taiwanese (Min Nan)', nativeName: '閩南語' },
    { code: 'ne', name: 'Nepali', nativeName: 'नेपाली' },
    { code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
    { code: 'nn', name: 'Norwegian Nynorsk', nativeName: 'Nynorsk' },
    { code: 'no', name: 'Norwegian', nativeName: 'Norsk' },
    { code: 'oc', name: 'Occitan', nativeName: 'Occitan' },
    { code: 'or', name: 'Odia', nativeName: 'ଓଡ଼ିଆ' },
    { code: 'pl', name: 'Polish', nativeName: 'język polski' },
    { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
    { code: 'pt-br', name: 'Brazilian Portuguese', nativeName: 'Português do Brasil' },
    { code: 'ro', name: 'Romanian', nativeName: 'Română' },
    { code: 'ru', name: 'Russian', nativeName: 'Русский' },
    { code: 'sa', name: 'Sanskrit', nativeName: 'संस्कृतम्' },
    { code: 'si', name: 'Sinhalese', nativeName: 'සිංහල' },
    { code: 'sk', name: 'Slovak', nativeName: 'Slovenčina' },
    { code: 'sl', name: 'Slovenian', nativeName: 'Slovenščina' },
    { code: 'sq', name: 'Albanian', nativeName: 'Shqip' },
    { code: 'sr', name: 'Serbian', nativeName: 'српски језик' },
    { code: 'sv', name: 'Swedish', nativeName: 'Svenska' },
    { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili' },
    { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
    { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
    { code: 'th', name: 'Thai', nativeName: 'ไทย' },
    { code: 'tl', name: 'Filipino (Tagalog)', nativeName: 'Tagalog' },
    { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
    { code: 'tt', name: 'Tatar', nativeName: 'Татарча' },
    { code: 'uk', name: 'Ukrainian', nativeName: 'Українська' },
    { code: 'ur', name: 'Urdu', nativeName: 'اردو' },
    { code: 'uz', name: 'Uzbek', nativeName: 'oʻzbekcha' },
    { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt' },
    { code: 'zh', name: 'Chinese (Simplified)', nativeName: '简体中文' },
    { code: 'zh-tw', name: 'Chinese (Traditional)', nativeName: '繁體中文' },
];

/**
 * 语言代码到 LocaleInfo 的映射
 */
export const LOCALE_MAP: Map<string, LocaleInfo> = new Map(
    OBSIDIAN_LOCALES.map(locale => [locale.code, locale])
);

/**
 * 所有有效的语言代码集合
 */
export const VALID_LOCALE_CODES: Set<string> = new Set(
    OBSIDIAN_LOCALES.map(locale => locale.code)
);

/**
 * 检查语言代码是否是 Obsidian 支持的语言
 */
export function isValidLocale(code: string): boolean {
    return VALID_LOCALE_CODES.has(code.toLowerCase());
}

/**
 * 获取语言信息
 */
export function getLocaleInfo(code: string): LocaleInfo | undefined {
    return LOCALE_MAP.get(code.toLowerCase());
}

/**
 * 规范化语言代码（小写化，将下划线转为连字符）
 */
export function normalizeLocaleCode(code: string): string {
    return code.toLowerCase().replace('_', '-');
}

/**
 * 语言别名映射（用于处理旧版代码或变体）
 */
export const LOCALE_ALIASES: Record<string, string> = {
    'zh-cn': 'zh',
    'zh-hans': 'zh',
    'zh-hant': 'zh-tw',
    'pt-pt': 'pt',
};

/**
 * 解析语言代码（处理别名）
 */
export function resolveLocale(code: string): string {
    const normalized = normalizeLocaleCode(code);
    return LOCALE_ALIASES[normalized] || normalized;
}
