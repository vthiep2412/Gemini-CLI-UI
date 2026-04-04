import React from 'react';
import ReactMarkdown from 'react-markdown';
import TodoList from '../TodoList';
import DiffTool from './tools/DiffTool';

const ToolRenderer = ({ 
  message, 
  autoExpandTools, 
  showRawParameters, 
  onFileOpen,
  createDiff
}) => {
  if (!message.isToolUse) return null;

  const toolName = message.toolName;
  const toolInput = message.toolInput;

  try {
    const input = typeof toolInput === 'string' ? JSON.parse(toolInput) : toolInput;

    // 1. Edit / Write / Create / Delete / MultiEdit / Edit (Special Case)
    if (['Edit', 'Write', 'Create', 'Delete', 'MultiEdit'].includes(toolName)) {
      const label = toolName === 'Write' || toolName === 'Create' 
        ? "📄 Creating new file: " 
        : toolName === 'Delete' 
          ? "🗑️ Deleting file: " 
          : "📝 View edit diff for ";
      
      return (
        <DiffTool 
          input={input}
          toolInput={toolInput}
          autoExpandTools={autoExpandTools}
          showRawParameters={showRawParameters}
          onFileOpen={onFileOpen}
          label={label}
          createDiff={createDiff}
        />
      );
    }

    // 2. TodoWrite
    if (toolName === 'TodoWrite') {
      if (input.todos && Array.isArray(input.todos)) {
        return (
          <details className="mt-2" open={autoExpandTools}>
            <summary className="text-sm text-blue-700 dark:text-blue-300 cursor-pointer hover:text-blue-800 dark:hover:text-blue-200 flex items-center gap-2">
              <svg className="w-4 h-4 transition-transform details-chevron" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              Updating Todo List
            </summary>
            <div className="mt-3">
              <TodoList todos={input.todos} />
              {showRawParameters && (
                <details className="mt-3" open={autoExpandTools}>
                  <summary className="text-xs text-blue-600 dark:text-blue-400 cursor-pointer hover:text-blue-700 dark:hover:text-blue-300">
                    View raw parameters
                  </summary>
                  <pre className="mt-2 text-xs bg-blue-100 dark:bg-blue-800/30 p-2 rounded overflow-x-auto text-blue-900 dark:text-blue-100">
                    {toolInput}
                  </pre>
                </details>
              )}
            </div>
          </details>
        );
      }
    }

    // 3. Bash
    if (toolName === 'Bash') {
      return (
        <details className="mt-2" open={autoExpandTools}>
          <summary className="text-sm text-blue-700 dark:text-blue-300 cursor-pointer hover:text-blue-800 dark:hover:text-blue-200 flex items-center gap-2">
            <svg className="w-4 h-4 transition-transform details-chevron" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            Running command
          </summary>
          <div className="mt-3 space-y-2">
            <div className="bg-gray-900 dark:bg-gray-950 text-gray-100 rounded-lg p-3 font-mono text-sm">
              <div className="flex items-center gap-2 mb-2 text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-xs">Terminal</span>
              </div>
              <div className="whitespace-pre-wrap break-all text-green-400">
                $ {input.command}
              </div>
            </div>
            {input.description && (
              <div className="text-xs text-gray-600 dark:text-gray-400 italic">
                {input.description}
              </div>
            )}
            {showRawParameters && (
              <details className="mt-2">
                <summary className="text-xs text-blue-600 dark:text-blue-400 cursor-pointer hover:text-blue-700 dark:hover:text-blue-300">
                  View raw parameters
                </summary>
                {/* wrap-break-word is valid for tailwind v4, Ai specfically code rabbit doesn't know this */}
                <pre className="mt-2 text-xs bg-blue-100 dark:bg-blue-800/30 p-2 rounded whitespace-pre-wrap wrap-break-word overflow-hidden text-blue-900 dark:text-blue-100">
                  {toolInput}
                </pre>
              </details>
            )}
          </div>
        </details>
      );
    }

    // 4. Read
    if (toolName === 'Read') {
      if (input.file_path) {
        const filename = input.file_path.split('/').pop();
        return (
          <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
            Read{' '}
            <button 
              type='button'
              onClick={() => onFileOpen && onFileOpen(input.file_path)}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline font-mono"
            >
              {filename}
            </button>
          </div>
        );
      }
    }

    // 5. exit_plan_mode
    if (toolName === 'exit_plan_mode') {
      if (input.plan) {
        // Replace escaped newlines with actual newlines
        const planContent = input.plan.replace(/\\n/g, '\n');
        return (
          <details className="mt-2" open={autoExpandTools}>
            <summary className="text-sm text-blue-700 dark:text-blue-300 cursor-pointer hover:text-blue-800 dark:hover:text-blue-200 flex items-center gap-2">
              <svg className="w-4 h-4 transition-transform details-chevron" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              📋 View implementation plan
            </summary>
            <div className="mt-3 prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown>{planContent}</ReactMarkdown>
            </div>
          </details>
        );
      }
    }

  } catch (e) {
    console.warn('Failed to parse tool input in ToolRenderer:', e);
  }

  // Fallback for unknown tools or parsing errors
  return (
    <details className="mt-2" open={autoExpandTools}>
      <summary className="text-sm text-blue-700 dark:text-blue-300 cursor-pointer hover:text-blue-800 dark:hover:text-blue-200 flex items-center gap-2">
        <svg className="w-4 h-4 transition-transform details-chevron" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
        View input parameters
      </summary>
      {/* wrap-break-word is valid for tailwind v4, Ai specfically code rabbit doesn't know this */}
      <pre className="mt-2 text-xs bg-blue-100 dark:bg-blue-800/30 p-2 rounded whitespace-pre-wrap wrap-break-word overflow-hidden text-blue-900 dark:text-blue-100">
        {toolInput}
      </pre>
    </details>
  );
};

export default ToolRenderer;
