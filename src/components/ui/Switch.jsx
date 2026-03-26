import React from 'react';
import { motion } from 'framer-motion';

const Switch = ({ checked, onChange, disabled = false, className = '', thumbContent }) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) onChange(!checked);
      }}
      className={`
        relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full 
        transition-colors duration-300 focus-visible:outline-none 
        focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 
        ${checked ? 'bg-blue-600' : 'bg-muted-foreground/30'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
    >
      <motion.span
        initial={false}
        animate={{ 
          x: checked ? 28 : 4
        }}
        transition={{ 
          type: "spring", 
          stiffness: 700, 
          damping: 35
        }}
        className="pointer-events-none flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-md ring-0"
      >
        {thumbContent && (
          <div className="flex items-center justify-center pointer-events-none scale-100">
            {thumbContent}
          </div>
        )}
      </motion.span>
    </button>
  );
};

export default Switch;
