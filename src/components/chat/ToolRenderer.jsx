import React from 'react';
import DiffTool from './tools/DiffTool';
import BashTool from './tools/BashTool';
import TodoTool from './tools/TodoTool';
import PlanTool from './tools/PlanTool';
import ChevronIcon from '../common/ChevronIcon';

const ToolRenderer = ({ 
  message, 
  autoExpandTools, 
  showRawParameters, 
  onFileOpen
}) => {
  if (!message.isToolUse) return null;

  const toolName = message.toolName;
  const toolInput = message.toolInput;

  try {
    const input = typeof toolInput === 'string' ? JSON.parse(toolInput) : toolInput;
    if (!input) {
      throw new Error('Tool input is empty');
    }

    // 1. Edit / Write / Create / Delete / MultiEdit
    if (['Edit', 'Write', 'Create', 'Delete', 'MultiEdit'].includes(toolName)) {
      const label = ['Write', 'Create'].includes(toolName)
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
        />
      );
    }

    // 2. TodoWrite
    if (toolName === 'TodoWrite') {
      return (
        <TodoTool 
          input={input}
          toolInput={toolInput}
          autoExpandTools={autoExpandTools}
          showRawParameters={showRawParameters}
        />
      );
    }

    // 3. Bash
    if (toolName === 'Bash') {
      return (
        <BashTool 
          command={input.command}
          description={input.description}
          autoExpandTools={autoExpandTools}
          showRawParameters={showRawParameters}
          toolInput={toolInput}
        />
      );
    }

    // 4. Read
    if (toolName === 'Read') {
      if (input.file_path) {
        const filename = input.file_path.split(/[/\\]/).pop();
        return (
          <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
            Read{' '}
            <button 
              type='button'
              onClick={() => onFileOpen && onFileOpen(input.file_path)}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline font-mono cursor-pointer"
            >
              {filename}
            </button>
          </div>
        );
      }
    }

    // 5. exit_plan_mode
    if (toolName === 'exit_plan_mode') {
      return (
        <PlanTool 
          plan={input.plan}
          autoExpandTools={autoExpandTools}
          showRawParameters={showRawParameters}
          toolInput={toolInput}
        />
      );
    }

  } catch (e) {
    console.warn('Failed to parse tool input in ToolRenderer:', e);
  }

  // Fallback for unknown tools or parsing errors
  return (
    <details className="mt-2" open={autoExpandTools}>
      <summary className="text-sm text-blue-700 dark:text-blue-300 cursor-pointer hover:text-blue-800 dark:hover:text-blue-200 flex items-center gap-2">
        <ChevronIcon />
        View input parameters
      </summary>
      <pre className="mt-2 text-xs bg-blue-100 dark:bg-blue-800/30 p-2 rounded whitespace-pre-wrap break-all overflow-hidden text-blue-900 dark:text-blue-100">
        {toolInput}
      </pre>
    </details>
  );
};

export default ToolRenderer;
