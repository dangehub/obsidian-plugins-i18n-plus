import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const configPath = path.join(projectRoot, 'deploy.config.local.json');

async function install() {
    if (!fs.existsSync(configPath)) {
        console.error('Config file not found');
        return;
    }
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const TARGET_DIR = config.targetDir;

    // Create theme dict dir
    const themeDir = path.join(TARGET_DIR, 'dictionaries', 'themes', 'Minimal');
    if (!fs.existsSync(themeDir)) {
        fs.mkdirSync(themeDir, { recursive: true });
    }

    // Write dict file
    const dictPath = path.join(themeDir, 'zh-CN.json');
    const dictContent = {
        "$meta": {
            "id": "minimal-style",
            "themeName": "Minimal",
            "locale": "zh-CN",
            "dictVersion": "1738543800000"
        },
        "minimal-style.instructions.title": "文档",
        "minimal-style.instructions.desc": "使用 Minimal Theme Settings 插件进行高级配置 (CN)"
    };

    fs.writeFileSync(dictPath, JSON.stringify(dictContent, null, 2));
    console.log(`Created test dictionary: ${dictPath}`);
}

install().catch(console.error);
