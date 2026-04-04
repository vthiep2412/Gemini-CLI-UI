import React from 'react';
import { createDiff } from '../../../utils/diff';

const DiffTool = ({ 
  input, 
  toolInput, 
  autoExpandTools, 
  showRawParameters, 
  onFileOpen,
  label = "View edit diff for " 
}) => {
  if (!input?.file_path) return null;

  const filename = input.file_path.split('/').pop();
  const oldStr = input.old_string || '';
  const newStr = input.new_string || input.content || '';

  return (
    <details className="mt-2" open={autoExpandTools}>
      <summary className="text-sm text-blue-700 dark:text-blue-300 cursor-pointer hover:text-blue-800 dark:hover:text-blue-200 flex items-center gap-2">
        <svg className="w-4 h-4 transition-transform details-chevron" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
        {label}
        <span 
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (onFileOpen) {
              onFileOpen(input.file_path, {
                old_string: oldStr,
                new_string: newStr
              });
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              if (onFileOpen) {
                onFileOpen(input.file_path, {
                  old_string: oldStr,
                  new_string: newStr
                });
              }
            }
          }}
          className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline font-mono cursor-pointer"
        >
          {filename}
        </span>
      </summary>
      <div className="mt-3">
        <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <button 
              onClick={() => onFileOpen && onFileOpen(input.file_path, {
                old_string: oldStr,
                new_string: newStr
              })}
              className="text-xs font-mono text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate underline cursor-pointer"
            >
              {input.file_path}
            </button>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {input.content !== undefined ? 'New File' : 'Diff'}
            </span>
          </div>
          <div className="text-xs font-mono">
            {createDiff(oldStr, newStr).map((diffLine, i) => (
              <div key={i} className="flex">
                <span className={`w-8 text-center border-r ${
                  diffLine.type === 'removed' 
                    ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800'
                    : 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800'
                }`}>
                  {diffLine.type === 'removed' ? '-' : '+'}
                </span>
                <span className={`px-2 py-0.5 flex-1 whitespace-pre-wrap ${
                  diffLine.type === 'removed'
                    ? 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
                    : 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
                }`}>
                  {diffLine.content}
                </span>
              </div>
            ))}
          </div>
        </div>
        {showRawParameters && (
          <details className="mt-2" open={autoExpandTools}>
            <summary className="text-xs text-blue-600 dark:text-blue-400 cursor-pointer hover:text-blue-700 dark:hover:text-blue-300">
              View raw parameters
            </summary>
            <pre className="mt-2 text-xs bg-blue-100 dark:bg-blue-800/30 p-2 rounded whitespace-pre-wrap wrap-break-word overflow-hidden text-blue-900 dark:text-blue-100">
              {typeof toolInput === 'string' ? toolInput : JSON.stringify(toolInput, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </details>
  );
};

export default DiffTool;
