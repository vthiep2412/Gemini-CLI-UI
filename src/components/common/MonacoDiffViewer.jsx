import React, { useRef, useState, useEffect } from 'react';
import { DiffEditor } from '@monaco-editor/react';

export default function MonacoDiffViewer({ original, modified, language = 'javascript', height = '300px' }) {
  const containerRef = useRef(null);
  const [renderSideBySide, setRenderSideBySide] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        // If container width is less than 800px, use unified diff (inline)
        // Otherwise, use split diff (side-by-side)
        if (entry.contentRect.width < 800) {
          setRenderSideBySide(false);
        } else {
          setRenderSideBySide(true);
        }
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} style={{ height, width: '100%' }}>
      <DiffEditor
        original={original}
        modified={modified}
        language={language}
        theme="hc-black"
        options={{
          renderSideBySide,
          readOnly: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          lineNumbersMinChars: 3,
        }}
      />
    </div>
  );
}
