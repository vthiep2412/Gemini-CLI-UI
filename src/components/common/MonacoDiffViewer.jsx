import React, { useRef, useState, useEffect } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import { useTheme } from '../../contexts/ThemeContext';
import { useMobile } from '../../hooks/useMobile';
import { deepDarkTheme } from '../../utils/theme';

export default function MonacoDiffViewer({ original, modified, language = 'javascript', height = '300px', renderSideBySide: controlledSideBySide }) {
  const containerRef = useRef(null);
  const [autoSideBySide, setAutoSideBySide] = useState(true);
  const { isDarkMode } = useTheme();
  const isMobile = useMobile();
  // Holds { editor, monaco } after mount — used for imperative updates & safe disposal
  const editorRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let timeoutId = null;
    const observer = new ResizeObserver((entries) => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const entry = entries[0];
        if (entry) {
          const width = entry.contentRect.width;
          const shouldSideBySide = width >= 640;
          setAutoSideBySide(shouldSideBySide);
        }
      }, 100);
    });

    observer.observe(containerRef.current);
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, []);

  // Safe, ordered disposal on unmount — detach model BEFORE disposing to avoid the race
  useEffect(() => {
    return () => {
      const ref = editorRef.current;
      if (!ref) return;
      try {
        const model = ref.editor.getModel();
        // Detach first so the DiffEditorWidget stops referencing the models
        ref.editor.setModel(null);
        // Then safely dispose each model
        model?.original?.dispose();
        model?.modified?.dispose();
        ref.editor.dispose();
      } catch (e) {
        // Expected if editor already cleaned up by React; log others in dev
        if (process.env.NODE_ENV === 'development') {
          console.debug('MonacoDiffViewer cleanup:', e);
        }
      }
      editorRef.current = null;
    };
  }, []);

  // Update theme imperatively — avoids full remount on theme toggle
  useEffect(() => {
    if (!editorRef.current) return;
    editorRef.current.monaco.editor.setTheme(isDarkMode ? 'deep-dark' : 'vs');
  }, [isDarkMode]);

  const renderSideBySide = controlledSideBySide !== undefined ? controlledSideBySide : autoSideBySide;

  // Update renderSideBySide imperatively — avoids full remount on layout change
  useEffect(() => {
    if (!editorRef.current) return;
    editorRef.current.editor.updateOptions({ renderSideBySide });
  }, [renderSideBySide]);

  const handleBeforeMount = (monaco) => {
    // Specialize JavaScript/TypeScript tokenization to match VS Code "Pink" keywords and "Yellow" functions
    ['javascript', 'typescript'].forEach(langId => {
      const controlKeywords = [
        'break', 'case', 'catch', 'continue', 'debugger', 'default', 'do', 'else',
        'finally', 'for', 'if', 'return', 'switch', 'throw', 'try', 'while', 'async', 'await'
      ];
      
      const otherKeywords = [
        'class', 'const', 'constructor', 'delete', 'export', 'extends', 'false',
        'from', 'function', 'get', 'import', 'in', 'instanceof', 'let', 'new',
        'null', 'set', 'static', 'super', 'symbol', 'this', 'true', 'typeof',
        'undefined', 'var', 'void', 'with', 'yield', 'of'
      ];

      monaco.languages.setMonarchTokensProvider(langId, {
        keywords: otherKeywords,
        controlKeywords: controlKeywords,
        tokenizer: {
          root: [
            // Identifiers and keywords (including function calls with keyword protection)
            [/[a-zA-Z_$][\w$]*(?=\s*\()/, {
              cases: {
                '@controlKeywords': 'keyword.control',
                '@keywords': 'keyword',
                '@default': 'function'
              }
            }],
            [/[a-zA-Z_$][\w$]*/, {
              cases: {
                '@controlKeywords': 'keyword.control',
                '@keywords': 'keyword',
                '@default': 'identifier'
              }
            }],
            { include: '@whitespace' },
            [/@symbols/, { cases: { '@default': 'operator' } }],
            [/[{}()[\]<>]/, '@brackets'],
            [/\d*\.\d+([eE][-+]?\d+)?/, 'number.float'],
            [/0[xX][0-9a-fA-F]+/, 'number.hex'],
            [/\d+/, 'number'],
            [/"([^"\\]|\\.)*$/, 'string.invalid'],
            [/'([^'\\]|\\.)*$/, 'string.invalid'],
            [/"/, 'string', '@string_double'],
            [/'/, 'string', '@string_single'],
            [/`/, 'string', '@string_backtick'],
          ],
          whitespace: [
            [/[ \t\r\n]+/, ''],
            [/\/\*\*/, 'comment.doc', '@jsdoc'],
            [/\/\*/, 'comment', '@comment'],
            [/\/\/.*$/, 'comment'],
          ],
          comment: [[/[^/*]+/, 'comment'], [/\*\//, 'comment', '@pop'], [/[/*]/, 'comment']],
          jsdoc: [[/[^/*]+/, 'comment.doc'], [/\*\//, 'comment.doc', '@pop'], [/[/*]/, 'comment.doc']],
          string_double: [[/[^\\"]+/, 'string'], [/@escapes/, 'string.escape'], [/\\./, 'string.escape.invalid'], [/"/, 'string', '@pop']],
          string_single: [[/[^\\']+/, 'string'], [/@escapes/, 'string.escape'], [/\\./, 'string.escape.invalid'], [/'/, 'string', '@pop']],
          string_backtick: [
            [/\$\{/, { token: 'delimiter.bracket', next: '@bracketCounting' }],
            [/[^\\`$]+/, 'string'], [/@escapes/, 'string.escape'], [/\\./, 'string.escape.invalid'], [/`/, 'string', '@pop']
          ],
          bracketCounting: [[/\{/, 'delimiter.bracket', '@push'], [/\}/, 'delimiter.bracket', '@pop'], { include: 'root' }],
        },
        symbols: /[=!~?:&|+\-*/^%<>]+/,
        escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
      });
    });

    monaco.editor.defineTheme('deep-dark', deepDarkTheme);
  };

  const handleMount = (editor, monaco) => {
    editorRef.current = { editor, monaco };
  };

  return (
    <div
      ref={containerRef}
      style={{ height, width: '100%' }}
      onContextMenu={isMobile ? (e) => e.preventDefault() : undefined}
    >
      <DiffEditor
        original={original}
        modified={modified}
        language={language}
        theme={isDarkMode ? 'deep-dark' : 'vs'}
        beforeMount={handleBeforeMount}
        onMount={handleMount}
        options={{
          renderSideBySide,
          useInlineViewWhenSpaceIsLimited: false,
          readOnly: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: true,
          wordWrap: 'on',
          lineNumbersMinChars: 4,
          renderIndicators: true,
          // semanticHighlighting: true, // Placeholder requires a semantic tokens provider
          'bracketPairColorization.enabled': true,
          fontFamily: "'Cascadia Code', 'JetBrains Mono', 'Fira Code', 'Menlo', 'Monaco', 'Courier New', monospace",
          fontSize: isMobile ? 12 : 13,
          fontLigatures: false, // User prefers separate characters for ===
        }}
      />
    </div>
  );
}
