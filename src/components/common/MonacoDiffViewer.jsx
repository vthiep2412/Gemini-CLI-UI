import React, { useRef, useState, useEffect } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import { useTheme } from '../../contexts/ThemeContext';
import { useMobile } from '../../hooks/useMobile';

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
      } catch (_) {
        // Silently ignore — editor may have already been cleaned up by React
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
    monaco.editor.defineTheme('deep-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: '', background: '0a0f1e' },
      ],
      colors: {
        'editor.background': '#0a0f1e',
      }
    });
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
        }}
      />
    </div>
  );
}
