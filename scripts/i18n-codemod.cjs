/**
 * i18n-plus Codemod Script
 * 
 * Automatically identify and replace hardcoded strings with t() function calls using jscodeshift.
 * 
 * Usage:
 * npx jscodeshift -t scripts/i18n-codemod.js src/ --parser=ts --dry --print
 * (Remove --dry --print to actually execute the write)
 */

module.exports = function (file, api) {
    const j = api.jscodeshift;
    const root = j(file.source);

    // Statistics
    const stats = {
        replaced: 0,
        strings: {} // Record occurrences of each string to detect ambiguity
    };

    // Helper: Determine if string should be ignored
    function shouldIgnore(text) {
        if (!text) return true;
        // Ignore empty strings, pure numbers, special symbols, CSS class names (usually lowercase with hyphens)
        if (/^[\d\s\W]+$/.test(text)) return true;
        if (/^[a-z0-9-]+$/.test(text) && !text.includes(' ')) return true; // Suspected CSS class or ID
        if (text.startsWith('http')) return true;
        if (text.startsWith('./') || text.startsWith('../')) return true;
        return false;
    }

    // Helper: Track statistics
    function trackString(text) {
        if (!stats.strings[text]) {
            stats.strings[text] = 0;
        }
        stats.strings[text]++;
    }

    // Helper: Generate t() call node
    // Assumes usages within class methods, using this.t()
    // If not in a class (e.g. function), might need plugin.t(), here simplified to default this.t()
    function createTCall(text) {
        return j.callExpression(
            j.memberExpression(j.thisExpression(), j.identifier('t')),
            [j.stringLiteral(text)]
        );
    }

    // Helper: Recursively flatten string concatenation expressions
    function flattenBinaryString(node) {
        if (node.type === 'StringLiteral') {
            return node.value;
        }
        if (node.type === 'BinaryExpression' && node.operator === '+') {
            const left = flattenBinaryString(node.left);
            const right = flattenBinaryString(node.right);
            if (left !== null && right !== null) {
                return left + right;
            }
        }
        return null;
    }

    // 1. Replace new Notice("...")
    root.find(j.NewExpression, {
        callee: { name: 'Notice' }
    }).forEach(path => {
        const args = path.value.arguments;
        if (args.length > 0) {
            const text = flattenBinaryString(args[0]);
            if (text !== null && !shouldIgnore(text)) {
                trackString(text);
                args[0] = createTCall(text);
                stats.replaced++;
            }
        }
    });

    // 2. Replace common UI methods like .setText("...") and .setButtonText("...")
    const UI_METHODS = ['setText', 'setButtonText', 'setTooltip', 'setName', 'setDesc', 'setPlaceholder'];

    UI_METHODS.forEach(methodName => {
        root.find(j.CallExpression, {
            callee: { property: { name: methodName } }
        }).forEach(path => {
            const args = path.value.arguments;
            if (args.length > 0) {
                const text = flattenBinaryString(args[0]);
                if (text !== null && !shouldIgnore(text)) {
                    trackString(text);
                    if (args.length <= 1) { // Only replace when there are no extra arguments (avoid setDesc(text, frag) etc.)
                        args[0] = createTCall(text);
                        stats.replaced++;
                    }
                }
            }
        });
    });

    // 3. Replace createEl('tag', { text: "..." })
    root.find(j.CallExpression, {
        callee: { property: { name: 'createEl' } }
    }).forEach(path => {
        const args = path.value.arguments;
        // Second argument is the properties object
        if (args.length > 1 && args[1].type === 'ObjectExpression') {
            const props = args[1].properties;
            props.forEach(prop => {
                if (prop.key && (prop.key.name === 'text' || prop.key.name === 'title' || prop.key.name === 'placeholder')) {
                    const text = flattenBinaryString(prop.value);
                    if (text !== null && !shouldIgnore(text)) {
                        trackString(text);
                        prop.value = createTCall(text);
                        stats.replaced++;
                    }
                }
            });
        }
    });

    // 4. Replace .appendText("...")
    root.find(j.CallExpression, {
        callee: { property: { name: 'appendText' } }
    }).forEach(path => {
        const args = path.value.arguments;
        if (args.length > 0) {
            const text = flattenBinaryString(args[0]);
            if (text !== null && !shouldIgnore(text)) {
                trackString(text);
                args[0] = createTCall(text);
                stats.replaced++;
            }
        }
    });

    return root.toSource();
};
