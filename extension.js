const vscode = require('vscode');

function activate(context) {

    // Fonction commune pour récupérer les infos du fichier
    function getFileInfo(editor) {
        const document        = editor.document;
        const langId          = document.languageId;
        const fileName        = document.fileName;
        const extension       = fileName.split('.').pop().toLowerCase();
        const effectiveLangId = (extension === 'sass') ? 'sass' : langId;
        const cssLangs        = ['css', 'scss', 'sass', 'less'];

        let separator;
        if (cssLangs.includes(effectiveLangId))                             separator = ':';
        else if (effectiveLangId === 'json' || effectiveLangId === 'jsonc') separator = ':';
        else if (effectiveLangId === 'yaml' || effectiveLangId === 'yml')   separator = ':';
        else {
            vscode.window.showWarningMessage('Type de fichier non supporté pour l\'alignement.');
            return null;
        }

        return { document, effectiveLangId, separator };
    }

    // ALT+G => Fichier entier
    const disposableAll = vscode.commands.registerCommand('alignement-codes.align', function () {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const info = getFileInfo(editor);
        if (!info) return;

        const { document, effectiveLangId, separator } = info;
        const lastLine = document.lineCount - 1;
        const range    = new vscode.Range(0, 0, lastLine, document.lineAt(lastLine).text.length);
        const lines    = document.getText(range).split('\n');

        const result = alignBlocks(lines, separator, effectiveLangId).join('\n');
        editor.edit(editBuilder => editBuilder.replace(range, result));
    });

    // ALT+C => Bloc au curseur
    const disposableBlock = vscode.commands.registerCommand('alignement-codes.alignBlock', function () {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const info = getFileInfo(editor);
        if (!info) return;

        const { document, effectiveLangId, separator } = info;
        const cursorLine = editor.selection.active.line;

        // Remonte pour trouver le début du bloc
        let startLine = cursorLine;
        while (startLine > 0 && isPropertyLine(document.lineAt(startLine - 1).text, effectiveLangId)) {
            startLine--;
        }

        // Descend pour trouver la fin du bloc
        let endLine = cursorLine;
        while (endLine < document.lineCount - 1 && isPropertyLine(document.lineAt(endLine + 1).text, effectiveLangId)) {
            endLine++;
        }

        const range = new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length);
        const lines = document.getText(range).split('\n');

        const result = alignBlocks(lines, separator, effectiveLangId).join('\n');
        editor.edit(editBuilder => editBuilder.replace(range, result));
    });

    context.subscriptions.push(disposableAll);
    context.subscriptions.push(disposableBlock);
}

function isPropertyLine(line, langId) {
    const cssLangs = ['css', 'scss', 'sass', 'less'];
    const trimmed  = line.trim();

    if (cssLangs.includes(langId))
        return /^\s*[\w-]+\s*:/.test(line) && !trimmed.endsWith('{') && !trimmed.startsWith('//');
    if (langId === 'json' || langId === 'jsonc')
        return /^\s*"[^"]+"\s*:/.test(line);
    if (langId === 'yaml' || langId === 'yml')
        return /^\s*[\w-]+\s*:/.test(line) && !trimmed.startsWith('#');

    return false;
}

function alignBlocks(lines, separator, langId) {
    const cssLangs    = ['css', 'scss', 'sass', 'less'];
    const result      = [];
    let block         = [];
    let indices       = [];
    let currentIndent = -1;

    for (let i = 0; i < lines.length; i++) {
        const line    = lines[i];
        const trimmed = line.trim();
        const indent  = line.search(/\S/);

        const isCSSProperty = cssLangs.includes(langId)
            && /^\s*[\w-]+\s*:/.test(line)
            && !trimmed.endsWith('{')
            && !trimmed.startsWith('//');

        const isJSONProperty = (langId === 'json' || langId === 'jsonc')
            && /^\s*"[^"]+"\s*:/.test(line);

        const isYAMLProperty = (langId === 'yaml' || langId === 'yml')
            && /^\s*[\w-]+\s*:/.test(line)
            && !trimmed.startsWith('#');

        const isProperty = isCSSProperty || isJSONProperty || isYAMLProperty;

        if (isProperty && (currentIndent === -1 || indent === currentIndent)) {
            block.push(line);
            indices.push(i);
            currentIndent = indent;
        } else {
            if (block.length > 0) {
                const aligned = alignBlock(block, separator);
                aligned.forEach((l, j) => result[indices[j]] = l);
                block         = [];
                indices       = [];
                currentIndent = -1;
            }
            result[i] = line;

            if (isProperty) {
                block.push(line);
                indices.push(i);
                currentIndent = indent;
            }
        }
    }

    if (block.length > 0) {
        const aligned = alignBlock(block, separator);
        aligned.forEach((l, j) => result[indices[j]] = l);
    }

    return result;
}

function alignBlock(lines, separator) {
    let maxPos = 0;

    lines.forEach(line => {
        const idx    = line.indexOf(separator);
        const before = line.substring(0, idx).trimEnd();
        if (before.length > maxPos) maxPos = before.length;
    });

    return lines.map(line => {
        const idx    = line.indexOf(separator);
        const before = line.substring(0, idx).trimEnd();
        const after  = line.substring(idx + 1).trimStart();
        const spaces = ' '.repeat(maxPos - before.length);
        return `${before}${spaces} ${separator} ${after}`;
    });
}

function deactivate() {}

module.exports = { activate, deactivate };