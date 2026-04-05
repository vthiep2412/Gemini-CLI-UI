import React from 'react';
import ChevronIcon from '../../common/ChevronIcon';
import TodoList from '../../TodoList';

const TodoTool = ({ input, toolInput, autoExpandTools, showRawParameters }) => {
  if (!input?.todos || !Array.isArray(input.todos)) return null;

  const safeStringify = (obj) => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return '<unserializable>';
    }
  };

  return (
    <details className="mt-2" open={autoExpandTools}>
      <summary className="text-sm text-blue-700 dark:text-blue-300 cursor-pointer hover:text-blue-800 dark:hover:text-blue-200 flex items-center gap-2">
        <ChevronIcon />
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
              {typeof toolInput === 'string' ? toolInput : safeStringify(toolInput)}
            </pre>
          </details>
        )}
      </div>
    </details>
  );
};

export default TodoTool;
