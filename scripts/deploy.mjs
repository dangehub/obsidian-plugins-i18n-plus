import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const configPath = path.join(projectRoot, 'deploy.config.local.json');

// Files to copy
const FILES_TO_COPY = ['main.js', 'manifest.json', 'styles.css'];

async function deploy() {
    // Load config
    if (!fs.existsSync(configPath)) {
        console.error('❌ Config file not found: deploy.config.local.json');
        console.error('Please create one with {"targetDir": "path/to/vault/.obsidian/plugins/i18n-plus"}');
        process.exit(1);
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const TARGET_DIR = config.targetDir;

    if (!TARGET_DIR) {
        console.error('❌ targetDir not specified in config');
        process.exit(1);
    }

    console.log(`🚀 Deploying to: ${TARGET_DIR}`);

    // Create target directory if not exists
    if (!fs.existsSync(TARGET_DIR)) {
        fs.mkdirSync(TARGET_DIR, { recursive: true });
        console.log('Created target directory');
    }

    // Copy files
    for (const file of FILES_TO_COPY) {
        const srcPath = path.join(projectRoot, file);
        const destPath = path.join(TARGET_DIR, file);

        if (fs.existsSync(srcPath)) {
            fs.copyFileSync(srcPath, destPath);
            console.log(`✅ Copied: ${file}`);
        } else {
            console.warn(`⚠️ Source file not found: ${file}`);
        }
    }

    // Create versions file if not exists (needed for Obsidian to recognize plugin updates)
    const versionsPath = path.join(TARGET_DIR, '.hotreload');
    if (!fs.existsSync(versionsPath)) {
        fs.writeFileSync(versionsPath, '');
    }

    console.log('✨ Deployment complete!');
}

deploy().catch(err => {
    console.error('❌ Deploy failed:', err);
    process.exit(1);
});
