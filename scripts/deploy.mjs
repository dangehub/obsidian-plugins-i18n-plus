/**
 * Deploy script: Copy build artifacts to Obsidian test vault
 * Usage: npm run deploy
 * 
 * Configuration: Create `deploy.config.local.json` in project root:
 * {
 *     "targetDir": "C:\\path\\to\\your\\.obsidian\\plugins\\i18n-plus"
 * }
 */

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
        console.error('');
        console.error('Please create it in the project root with:');
        console.error('{');
        console.error('    "targetDir": "C:\\\\path\\\\to\\\\your\\\\.obsidian\\\\plugins\\\\i18n-plus"');
        console.error('}');
        process.exit(1);
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const TARGET_DIR = config.targetDir;

    if (!TARGET_DIR) {
        console.error('❌ "targetDir" not specified in deploy.config.local.json');
        process.exit(1);
    }

    console.log('\n🚀 Deploying to Obsidian test vault...');
    console.log(`   Target: ${TARGET_DIR}\n`);

    // Ensure target directory exists
    if (!fs.existsSync(TARGET_DIR)) {
        fs.mkdirSync(TARGET_DIR, { recursive: true });
        console.log('📁 Created target directory');
    }

    let copied = 0;
    for (const file of FILES_TO_COPY) {
        const src = path.join(projectRoot, file);
        const dest = path.join(TARGET_DIR, file);

        if (fs.existsSync(src)) {
            fs.copyFileSync(src, dest);
            console.log(`   ✓ ${file}`);
            copied++;
        } else {
            console.log(`   ⚠ ${file} not found, skipping`);
        }
    }

    console.log(`\n✅ Deployed ${copied} files successfully!`);
    console.log('💡 Reload the plugin in Obsidian to see changes.\n');
}

deploy().catch(err => {
    console.error('❌ Deploy failed:', err);
    process.exit(1);
});
