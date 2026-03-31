import React, { useEffect, useState, useRef } from 'react';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

export default function DynamicSyntaxHighlighter({ language, code, isDarkMode, showLineNumbers, wrapLines, wrapLongLines }) {
  const [Highlighter, setHighlighter] = useState(null);
  const loadedLangs = useRef(new Set());

  // Load core highlighter once on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const prism = await import('react-syntax-highlighter/dist/esm/prism');
        if (mounted) {
          setHighlighter(() => prism.PrismLight || prism.Prism);
        }
      } catch (err) {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Register language dynamically as needed
  useEffect(() => {
    if (!Highlighter || !language) return;

    const lang = language.toLowerCase();
    if (loadedLangs.current.has(lang)) return;

    let mounted = true;

    (async () => {
      try {
        if (Highlighter.registerLanguage) {
          let loaded = false;
          try {
            // Using package-resolved path for Vite compatibility
            const langModule = await import(/* @vite-ignore */ `react-syntax-highlighter/dist/esm/languages/prism/${lang}.js`);
            Highlighter.registerLanguage(lang, langModule.default || langModule);
            loaded = true;
          } catch (err) {
            // Fallback for HTML (Prism uses 'markup' name)
            if (lang === 'html') {
              try {
                const langModule = await import(/* @vite-ignore */ 'react-syntax-highlighter/dist/esm/languages/prism/markup.js');
                Highlighter.registerLanguage('html', langModule.default || langModule);
                loaded = true;
              } catch (innerErr) {
                console.warn(`[SyntaxHighlighter] Failed to load HTML fallback:`, innerErr);
              }
            } else {
                console.warn(`[SyntaxHighlighter] Failed to load language: ${lang}`, err);
            }
          }
          if (mounted && loaded) {
            loadedLangs.current.add(lang);
            // Trigger re-render to apply the newly registered language
            setHighlighter(prev => prev);
          }
        }
      } catch (err) {
        console.warn('[SyntaxHighlighter] Failed to load language:', err);
      }
    })();

    return () => { mounted = false; };
  }, [language, Highlighter]);

  if (!Highlighter) {
    return (
      <pre style={{ margin: 0, padding: '1rem', background: isDarkMode ? '#1e1e2e' : '#fff' }}><code>{code}</code></pre>
    );
  }

  return (
    <Highlighter
      language={language || 'text'}
      style={isDarkMode ? oneDark : oneLight}
      showLineNumbers={showLineNumbers}
      wrapLines={wrapLines}
      wrapLongLines={wrapLongLines}
      customStyle={{
        margin: 0,
        padding: '1rem',
        background: isDarkMode ? '#1e1e2e' : '#ffffff',
        fontSize: '0.8125rem',
        lineHeight: '1.6',
        fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace',
      }}
    >
      {code}
    </Highlighter>
  );
}
