/**
 * I18n Migration Report Generator
 * 
 * Parses codemod output and generates a markdown risk report.
 * 
 * Usage:
 * I18N_GENERATE_LOG=true npx jscodeshift ... 2>&1 | node generate-report.cjs --locale zh-CN
 */

const fs = require('fs');
const path = require('path');

// Load locale templates
function loadTemplate(locale) {
    const templatePath = path.join(__dirname, 'report-templates', `${locale}.json`);
    if (fs.existsSync(templatePath)) {
        return JSON.parse(fs.readFileSync(templatePath, 'utf-8'));
    }
    // Fallback to zh-CN
    const fallbackPath = path.join(__dirname, 'report-templates', 'zh-CN.json');
    if (fs.existsSync(fallbackPath)) {
        return JSON.parse(fs.readFileSync(fallbackPath, 'utf-8'));
    }
    // Inline fallback
    return {
        title: 'I18n 迁移报告',
        stats: { total: '总共转换', low: '低风险', medium: '中风险', high: '高风险' },
        sections: { highRisk: '高风险项 (需人工复核)', mediumRisk: '中风险项', lowRisk: '低风险项' },
        riskTypes: { dom_mixed: 'DOM 混合 + 占位符', string_concat: '字符串拼接' },
        warnings: { innerHTML: '使用 innerHTML 可能影响事件绑定' }
    };
}

// Parse codemod log output from stdin
async function parseInput() {
    const logs = [];
    const rl = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false
    });

    for await (const line of rl) {
        if (line.startsWith('__I18N_LOG__')) {
            try {
                const jsonStr = line.replace('__I18N_LOG__', '');
                logs.push(JSON.parse(jsonStr));
            } catch (e) {
                // Ignore parse errors
            }
        }
    }

    return logs;
}

// Aggregate stats from all files
function aggregateStats(logs) {
    const result = {
        totalReplaced: 0,
        lowRisk: 0,
        mediumRisk: 0,
        highRisk: 0,
        highRiskLocations: [],
        allStrings: new Set()
    };

    for (const log of logs) {
        result.totalReplaced += log.stats.replaced || 0;
        result.lowRisk += log.stats.lowRisk || 0;
        result.highRisk += log.stats.highRisk || 0;
        if (log.stats.highRiskLocations) {
            result.highRiskLocations.push(...log.stats.highRiskLocations);
        }
        for (const str of log.strings || []) {
            result.allStrings.add(str);
        }
    }

    // Estimate medium risk as total - low - high
    result.mediumRisk = result.totalReplaced - result.lowRisk - result.highRisk;
    if (result.mediumRisk < 0) result.mediumRisk = 0;

    return result;
}

// Generate markdown report
function generateReport(stats, template) {
    let md = `# ${template.title}\n\n`;

    md += `## 📊 统计\n\n`;
    md += `- ${template.stats.total}: **${stats.totalReplaced}** 处\n`;
    md += `- ✅ ${template.stats.low}: ${stats.lowRisk} 处 (简单字符串)\n`;
    md += `- ⚠️ ${template.stats.medium}: ${stats.mediumRisk} 处 (字符串拼接)\n`;
    md += `- 🔴 ${template.stats.high}: ${stats.highRisk} 处 (DOM 混合)\n\n`;

    if (stats.highRiskLocations.length > 0) {
        md += `## 🔴 ${template.sections.highRisk}\n\n`;
        stats.highRiskLocations.forEach((loc, index) => {
            md += `### ${index + 1}. ${loc.file}:${loc.line}\n`;
            md += `**类型**: ${template.riskTypes[loc.type] || loc.type}\n`;
            md += `**风险说明**: ${template.warnings.innerHTML}\n\n`;
        });
    }

    if (stats.mediumRisk > 0) {
        md += `## ⚠️ ${template.sections.mediumRisk}\n\n`;
        md += `共 ${stats.mediumRisk} 处字符串拼接已自动合并，建议快速检查。\n\n`;
    }

    md += `## ✅ ${template.sections.lowRisk}\n\n`;
    md += `共 ${stats.lowRisk} 处简单字符串已自动替换，无需复核。\n\n`;

    md += `---\n\n`;
    md += `> 生成时间: ${new Date().toISOString()}\n`;

    return md;
}

// Main
async function main() {
    const args = process.argv.slice(2);
    let locale = 'zh-CN';
    let outputPath = 'MIGRATION_REPORT.md';

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--locale' && args[i + 1]) {
            locale = args[i + 1];
            i++;
        }
        if (args[i] === '--output' && args[i + 1]) {
            outputPath = args[i + 1];
            i++;
        }
    }

    const template = loadTemplate(locale);
    const logs = await parseInput();
    const stats = aggregateStats(logs);
    const report = generateReport(stats, template);

    fs.writeFileSync(outputPath, report, 'utf-8');
    console.log(`Report generated: ${outputPath}`);
    console.log(`Total: ${stats.totalReplaced}, High Risk: ${stats.highRisk}, Medium: ${stats.mediumRisk}, Low: ${stats.lowRisk}`);
}

main().catch(console.error);
