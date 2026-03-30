import React, { useRef, useState, useEffect } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import { useTheme } from '../../contexts/ThemeContext';

export default function MonacoDiffViewer({ original, modified, language = 'javascript', height = '300px', renderSideBySide: controlledSideBySide }) {
  const containerRef = useRef(null);
  const [autoSideBySide, setAutoSideBySide] = useState(true);
  const { isDarkMode } = useTheme();

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

  const renderSideBySide = controlledSideBySide !== undefined ? controlledSideBySide : autoSideBySide;

  const handleBeforeMount = (monaco) => {
    // Define the theme once
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

  return (
    <div ref={containerRef} style={{ height, width: '100%' }}>
      <DiffEditor
        key={`${original.length}-${modified.length}-${isDarkMode}-${renderSideBySide}`}
        original={original}
        modified={modified}
        language={language}
        theme={isDarkMode ? 'deep-dark' : 'vs'}
        beforeMount={handleBeforeMount}
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
