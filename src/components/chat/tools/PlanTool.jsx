import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import ChevronIcon from '../../common/ChevronIcon';

const PlanTool = ({ plan, autoExpandTools }) => {
  const [isOpen, setIsOpen] = useState(autoExpandTools);
  if (!plan) return null;

  // Replace escaped newlines with actual newlines
  const planContent = plan.replace(/\\n/g, '\n');

  return (
    <details 
      className="mt-2" 
      open={isOpen}
      onToggle={(e) => setIsOpen(e.currentTarget.open)}
    >
      <summary className="text-sm text-blue-700 dark:text-blue-300 cursor-pointer hover:text-blue-800 dark:hover:text-blue-200 flex items-center gap-2">
        <ChevronIcon className={isOpen ? 'rotate-0' : '-rotate-90'} />
        📋 View implementation plan
      </summary>
      <div className="mt-3 prose prose-sm max-w-none dark:prose-invert">
        <ReactMarkdown>{planContent}</ReactMarkdown>
      </div>
    </details>
  );
};

export default PlanTool;
