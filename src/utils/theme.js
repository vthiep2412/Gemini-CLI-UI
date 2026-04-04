/**
 * High-Fidelity Deep Dark Monaco Theme
 * Optimized for standard Monaco Monarch tokens (keyword, string, identifier, etc.)
 * Matches VS Code Dark Plus colors with the premium #0a0f1e background.
 */
export const deepDarkTheme = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: '', foreground: 'd4d4d4', background: '0a0f1e' },
    
    // Core Syntax - VS Code Dark+ Official
    { token: 'keyword', foreground: '569cd6' },
    { token: 'keyword.control', foreground: 'c586c0' }, // try, catch, return, if, etc.
    { token: 'keyword.operator', foreground: 'cccccc' },
    { token: 'operator', foreground: 'cccccc' },
    { token: 'delimiter', foreground: 'cccccc' },
    
    // Identifiers & Variables - VS Code Dark+ Official (#9CDCFE)
    { token: 'identifier', foreground: '9cdcfe' },
    { token: 'variable', foreground: '9cdcfe' },
    { token: 'variable.parameter', foreground: '9cdcfe' },
    { token: 'variable.name', foreground: '9cdcfe' },
    { token: 'meta.object-literal.key', foreground: '9cdcfe' },
    
    // Functions & Methods - VS Code Dark+ Official (#DCDCAA)
    { token: 'function', foreground: 'dcdcaa' },
    { token: 'method', foreground: 'dcdcaa' },
    { token: 'predefined', foreground: 'dcdcaa' },
    { token: 'support.function', foreground: 'dcdcaa' },
    { token: 'entity.name.function', foreground: 'dcdcaa' },
    { token: 'identifier.function', foreground: 'dcdcaa' },
    { token: 'keyword.operator.or.regexp', foreground: 'dcdcaa' },
    { token: 'keyword.control.anchor.regexp', foreground: 'dcdcaa' },
    
    // Types & Classes - VS Code Dark+ Official (#4EC9B0)
    { token: 'type', foreground: '4ec9b0' },
    { token: 'class', foreground: '4ec9b0' },
    { token: 'interface', foreground: '4ec9b0' },
    { token: 'support.type', foreground: '4ec9b0' },
    { token: 'support.class', foreground: '4ec9b0' },
    { token: 'entity.name.type', foreground: '4ec9b0' },
    { token: 'tag', foreground: '569cd6' },
    
    // Literals - VS Code Dark+ Official
    { token: 'string', foreground: 'ce9178' },
    { token: 'string.escape', foreground: 'd7ba7d' },
    { token: 'punctuation.definition.group.regexp', foreground: 'ce9178' },
    { token: 'number', foreground: 'b5cea8' },
    { token: 'number.hex', foreground: 'b5cea8' },
    { token: 'regexp', foreground: 'd16969' },
    { token: 'constant.character.character-class.regexp', foreground: 'd16969' },
    { token: 'keyword.operator.quantifier.regexp', foreground: 'd7ba7d' },
    
    // Others
    { token: 'comment', foreground: '6a9955', fontStyle: 'italic' },
    { token: 'annotation', foreground: '4ec9b0' },
    { token: 'constant', foreground: '4fc1ff' },
    { token: 'variable.other.constant', foreground: '4fc1ff' },
    { token: 'variable.other.enummember', foreground: '4fc1ff' },
    { token: 'invalid', foreground: 'f44747' },
  ],
  colors: {
    'editor.background': '#0a0f1e',
    'editor.foreground': '#cccccc',
    'editorLineNumber.foreground': '#6e7681',
    'editorLineNumber.activeForeground': '#cccccc',
    'editorCursor.foreground': '#aeafad',
    'editorIndentGuide.background': '#404040',
    'editor.selectionBackground': '#264f7866',
    'editor.inactiveSelectionBackground': '#3a3d4144',
    'editor.lineHighlightBackground': '#2f333d31', 
    'editorWhitespace.foreground': '#3b3b3b',
    'editorIndentGuide.activeBackground': '#707070',
    'editor.selectionHighlightBackground': '#add6ff26',
    'editorBracketMatch.background': '#00d4ff1a',
    'editorBracketMatch.border': '#888888',
    'editor.wordHighlightBackground': '#57575740',
    'editor.wordHighlightStrongBackground': '#00497233',
  }
};
