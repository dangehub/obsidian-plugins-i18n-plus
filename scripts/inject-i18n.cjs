/**
 * i18n-plus Injection Codemod
 * 
 * Automatically injects i18n adapter code into the main plugin file.
 * 
 * Operations:
 * 1. Add import statement: `import { initI18n } from './lang/i18n';`
 * 2. Add class properties: `i18n` and `t`
 * 3. Add initialization in `onload()`
 * 
 * Usage:
 * npx jscodeshift -t scripts/inject-i18n.cjs <path/to/main.ts> --parser=ts
 */

module.exports = function (file, api) {
    const j = api.jscodeshift;
    const root = j(file.source);

    // 1. Add Import
    const importDeclaration = j.importDeclaration(
        [j.importSpecifier(j.identifier('initI18n'))],
        j.literal('./lang/i18n')
    );

    const existingImport = root.find(j.ImportDeclaration, {
        source: { value: './lang/i18n' }
    });

    if (existingImport.size() === 0) {
        // Insert at the top, after other imports if possible
        const lastImport = root.find(j.ImportDeclaration).at(-1);
        if (lastImport.size() > 0) {
            lastImport.insertAfter(importDeclaration);
        } else {
            root.get().node.program.body.unshift(importDeclaration);
        }
    }

    // Find the Plugin class
    // We assume the class extends 'Plugin' (from 'obsidian')
    const pluginClass = root.find(j.ClassDeclaration).filter(path => {
        return path.node.superClass &&
            path.node.superClass.name === 'Plugin';
    });

    if (pluginClass.size() === 0) {
        console.warn('Could not find class extending "Plugin". Skipping injection.');
        return root.toSource();
    }

    const classBody = pluginClass.get().node.body;

    // 2. Add Properties
    // i18n: any;
    // t: (key: string, params?: any) => string;

    const hasI18nProp = classBody.body.some(node =>
        node.type === 'ClassProperty' && node.key.name === 'i18n'
    );

    if (!hasI18nProp) {
        const i18nProp = j.classProperty(
            j.identifier('i18n'),
            null,
            j.tsTypeAnnotation(j.tsAnyKeyword())
        );

        // Insert at the beginning of the class body
        classBody.body.unshift(i18nProp);
    }

    const hasTProp = classBody.body.some(node =>
        node.type === 'ClassProperty' && node.key.name === 't'
    );

    if (!hasTProp) {
        // (key: string, params?: any) => string
        const tType = j.tsFunctionType([
            Object.assign(j.identifier('key'), { typeAnnotation: j.tsTypeAnnotation(j.tsStringKeyword()) }),
            Object.assign(j.identifier('params'), { typeAnnotation: j.tsTypeAnnotation(j.tsAnyKeyword()), optional: true })
        ]);
        tType.typeAnnotation = j.tsTypeAnnotation(j.tsStringKeyword());

        const tProp = j.classProperty(
            j.identifier('t'),
            null,
            j.tsTypeAnnotation(tType)
        );

        // Insert after i18n if possible
        classBody.body.splice(1, 0, tProp);
    }

    // 3. Inject init code in onload()
    const onloadMethod = pluginClass.find(j.MethodDefinition, {
        key: { name: 'onload' }
    });

    if (onloadMethod.size() > 0) {
        const block = onloadMethod.get().node.value.body;

        // Check if already initialized
        const alreadyInit = j(block).find(j.CallExpression, {
            callee: { name: 'initI18n' }
        }).size() > 0;

        if (!alreadyInit) {
            // this.i18n = initI18n(this);
            const initStmt = j.expressionStatement(
                j.assignmentExpression(
                    '=',
                    j.memberExpression(j.thisExpression(), j.identifier('i18n')),
                    j.callExpression(j.identifier('initI18n'), [j.thisExpression()])
                )
            );

            // this.t = this.i18n.t;
            const bindStmt = j.expressionStatement(
                j.assignmentExpression(
                    '=',
                    j.memberExpression(j.thisExpression(), j.identifier('t')),
                    j.memberExpression(
                        j.memberExpression(j.thisExpression(), j.identifier('i18n')),
                        j.identifier('t')
                    )
                )
            );

            // Insert at the beginning of onload
            block.body.unshift(bindStmt);
            block.body.unshift(initStmt);
        }
    } else {
        console.warn('Could not find "onload" method.');
    }

    return root.toSource();
};
