import React from 'react';
import clsx from 'clsx';
import ChevronIcon from '../../common/ChevronIcon';

const BashTool = ({ command, description, autoExpandTools, showRawParameters, toolInput }) => {
  const [copyStatus, setCopyStatus] = React.useState('idle'); // 'idle', 'success', 'error'
  const copyTimeoutRef = React.useRef(null);

  React.useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const handleCopy = () => {
    if (!command) return;
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);

    navigator.clipboard.writeText(command)
      .then(() => {
        setCopyStatus('success');
        copyTimeoutRef.current = setTimeout(() => setCopyStatus('idle'), 1500);
      })
      .catch((err) => {
        console.error('Failed to copy to clipboard:', err);
        setCopyStatus('error');
        copyTimeoutRef.current = setTimeout(() => setCopyStatus('idle'), 2000);
      });
  };

  const getCopyTitle = () => {
    if (!command) return "No command to copy";
    if (copyStatus === 'success') return "Copied!";
    if (copyStatus === 'error') return "Failed to copy";
    return "Copy command";
  };

  return (
    <details className="mt-2" open={autoExpandTools}>
      <summary className="text-sm text-blue-700 dark:text-blue-300 cursor-pointer hover:text-blue-800 dark:hover:text-blue-200 flex items-center gap-2">
        <ChevronIcon />
        Running command
      </summary>
      <div className="mt-3 space-y-2">
        <div className="bg-gray-900 dark:bg-gray-950 text-gray-100 rounded-lg p-3 font-mono text-sm relative group">
          <div className="flex items-center justify-between mb-2 text-gray-400">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-xs">Terminal</span>
            </div>
            <button
               onClick={handleCopy}
               disabled={!command}
               className={clsx(
                 "p-1 rounded transition-all flex items-center justify-center",
                 command ? "opacity-0 group-hover:opacity-100 hover:bg-gray-800 text-gray-400" : "opacity-30 cursor-not-allowed text-gray-500",
                 copyStatus === 'success' && "opacity-100! text-green-400",
                 copyStatus === 'error' && "opacity-100! text-red-400"
               )}
               title={getCopyTitle()}
            >
              {copyStatus === 'success' ? (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : copyStatus === 'error' ? (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
              )}
            </button>
          </div>
          <div className="whitespace-pre-wrap break-all text-green-400">
            $ {command || '(no command)'}
          </div>
        </div>
        {description && (
          <div className="text-xs text-gray-600 dark:text-gray-400 italic">
            {description}
          </div>
        )}
        {showRawParameters && (
          <details className="mt-2">
            <summary className="text-xs text-blue-600 dark:text-blue-400 cursor-pointer hover:text-blue-700 dark:hover:text-blue-300">
              View raw parameters
            </summary>
            {/* wrap-break-word is valid for tailwind v4, Ai specifically code rabbit doesn't know this */}
            <pre className="mt-2 text-xs bg-blue-100 dark:bg-blue-800/30 p-2 rounded whitespace-pre-wrap wrap-break-word overflow-hidden text-blue-900 dark:text-blue-100">
              {typeof toolInput === 'string' ? toolInput : JSON.stringify(toolInput, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </details>
  );
};

export default BashTool;
