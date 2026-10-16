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
        const lines    = document.getText(range).split(/\r?\n/);

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
        const lines      = document.getText().split(/\r?\n/);

        // Blocs contenant le curseur (et ayant au moins une propriété)
        const candidates = findBlocks(lines, effectiveLangId).filter(block =>
            block.props.length > 0 && block.start <= cursorLine && cursorLine <= block.end
        );

        if (candidates.length === 0) {
            vscode.window.showInformationMessage('Aucun bloc à aligner au curseur.');
            return;
        }

        // Le bloc le plus proche du curseur = le plus imbriqué = le plus court
        const block = candidates.reduce((best, current) =>
            (current.end - current.start < best.end - best.start) ? current : best
        );

        const result = lines.slice();
        alignProps(result, block, separator);

        const range = new vscode.Range(block.start, 0, block.end, document.lineAt(block.end).text.length);
        const text  = result.slice(block.start, block.end + 1).join('\n');
        editor.edit(editBuilder => editBuilder.replace(range, text));
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

function isCommentLine(line, langId) {
    const trimmed = line.trim();

    if (langId === 'yaml' || langId === 'yml') return trimmed.startsWith('#');
    return trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*');
}

// Langages où un bloc est délimité par des accolades { }
function usesBraces(langId) {
    return ['css', 'scss', 'less', 'json', 'jsonc'].includes(langId);
}

// Retire commentaires et chaînes d'une ligne pour ne compter que les vraies accolades
// state.inComment conserve l'état d'un commentaire /* */ sur plusieurs lignes
function stripCommentsAndStrings(line, langId, state) {
    const lineComments = langId !== 'css';
    let code  = '';
    let quote = null;

    for (let k = 0; k < line.length; k++) {
        const char = line[k];
        const next = line[k + 1];

        if (state.inComment) {
            if (char === '*' && next === '/') {
                state.inComment = false;
                k++;
            }
            continue;
        }
        if (quote) {
            if (char === '\\')       k++;
            else if (char === quote) quote = null;
            continue;
        }
        if (char === '/' && next === '*') {
            state.inComment = true;
            k++;
            continue;
        }
        if (char === '/' && next === '/' && lineComments) break;
        if (char === '"' || char === '\'') {
            quote = char;
            continue;
        }
        code += char;
    }

    return code;
}

// Retourne la liste des blocs : { start, end, props } (props = indices des lignes de propriétés)
function findBlocks(lines, langId) {
    return usesBraces(langId) ? findBraceBlocks(lines, langId) : findIndentBlocks(lines, langId);
}

// CSS / SCSS / LESS / JSON : un bloc = tout ce qui est entre { et }
// Chaque niveau d'imbrication est un bloc indépendant
function findBraceBlocks(lines, langId) {
    const blocks    = [];
    const stack     = [];
    const rootBlock = { start: 0, end: lines.length - 1, props: [] };
    const state     = { inComment: false };

    for (let i = 0; i < lines.length; i++) {
        const line            = lines[i];
        const startsInComment = state.inComment;
        const code            = stripCommentsAndStrings(line, langId, state);

        // La propriété appartient au bloc ouvert le plus imbriqué
        if (!startsInComment && isPropertyLine(line, langId)) {
            const current = stack.length > 0 ? stack[stack.length - 1] : rootBlock;
            current.props.push(i);
        }

        for (const char of code) {
            if (char === '{') {
                stack.push({ start: i, end: -1, props: [] });
            } else if (char === '}' && stack.length > 0) {
                const block = stack.pop();
                block.end   = i;
                blocks.push(block);
            }
        }
    }

    // Blocs non fermés (fichier incomplet) : fermés en fin de fichier
    while (stack.length > 0) {
        const block = stack.pop();
        block.end   = lines.length - 1;
        blocks.push(block);
    }

    if (rootBlock.props.length > 0) blocks.push(rootBlock);

    return blocks;
}

// YAML / SASS : un bloc = clés de même indentation dans un même parent,
// y compris celles placées après un sous-bloc
// Les commentaires et lignes vides ne cassent pas le bloc
function findIndentBlocks(lines, langId) {
    const blocks = [];
    const stack  = [];

    // Ferme les blocs ouverts plus indentés que indent (ou d'indentation égale si inclusive)
    function closeBlocks(indent, inclusive) {
        while (stack.length > 0) {
            const top = stack[stack.length - 1];
            if (top.indent < indent || (!inclusive && top.indent === indent)) break;
            blocks.push(stack.pop());
        }
    }

    for (let i = 0; i < lines.length; i++) {
        const line   = lines[i];
        const indent = line.search(/\S/);

        if (line.trim() === '' || isCommentLine(line, langId)) continue;

        // Ligne autre qu'une propriété (sélecteur SASS, élément de liste YAML...) : ferme les blocs de ce niveau
        if (!isPropertyLine(line, langId)) {
            closeBlocks(indent, true);
            continue;
        }

        closeBlocks(indent, false);

        const top = stack[stack.length - 1];
        if (top && top.indent === indent) {
            top.props.push(i);
            top.end = i;
        } else {
            stack.push({ start: i, end: i, indent, props: [i] });
        }
    }

    closeBlocks(0, true);

    return blocks;
}

// Aligne les propriétés d'un bloc dans result (commentaires et lignes vides intacts)
function alignProps(result, block, separator) {
    if (block.props.length === 0) return;

    const aligned = alignBlock(block.props.map(i => result[i]), separator);
    aligned.forEach((l, j) => result[block.props[j]] = l);
}

function alignBlocks(lines, separator, langId) {
    const result = lines.slice();

    findBlocks(lines, langId).forEach(block => alignProps(result, block, separator));

    return result;
}

function alignBlock(lines, separator) {
    let maxPos = 0;

    // Les clés sans valeur (clé parente YAML) ne comptent pas dans le calcul de colonne
    lines.forEach(line => {
        const idx    = line.indexOf(separator);
        const before = line.substring(0, idx).trimEnd();
        const after  = line.substring(idx + 1).trim();
        if (after !== '' && before.length > maxPos) maxPos = before.length;
    });

    return lines.map(line => {
        const idx    = line.indexOf(separator);
        const before = line.substring(0, idx).trimEnd();
        const after  = line.substring(idx + 1).trimStart();

        // Clé sans valeur : sortie en "cle:" sans espace parasite
        if (after.trim() === '') return `${before}${separator}`;

        const spaces = ' '.repeat(maxPos - before.length);
        return `${before}${spaces} ${separator} ${after}`;
    });
}

function deactivate() {}

module.exports = { activate, deactivate };