import React, { useEffect, useState, useRef } from 'react';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

export default function DynamicSyntaxHighlighter({ language, code, isDarkMode, showLineNumbers, wrapLines, wrapLongLines }) {
  const [Highlighter, setHighlighter] = useState(null);
  const loadedLangs = useRef(new Set());

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const prism = await import('react-syntax-highlighter/dist/esm/prism');
        const HighlighterComponent = prism.PrismLight || prism.Prism;
        const lang = language || '';
        if (lang && !loadedLangs.current.has(lang) && HighlighterComponent?.registerLanguage) {
          try {
            let langModule = await import(`react-syntax-highlighter/dist/esm/languages/prism/${lang}`);
            HighlighterComponent.registerLanguage(lang, langModule.default || langModule);
          } catch {
            // Fallback for HTML: Prism names HTML as 'markup'
            if (lang === 'html') {
              try {
                let langModule = await import('react-syntax-highlighter/dist/esm/languages/prism/markup');
                HighlighterComponent.registerLanguage('html', langModule.default || langModule);
              } catch {
                // ignore
              }
            }
          }
          loadedLangs.current.add(lang);
        }
        if (mounted) setHighlighter(() => HighlighterComponent);
      } catch {
        // ignore
      }
    };
    if (!Highlighter) load();
    return () => { mounted = false; };
  }, [language]);

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
