import React from 'react';

const Switch = ({ checked, onChange, disabled = false, className = '' }) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`
        relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full 
        transition-colors duration-200 ease-in-out focus-visible:outline-none 
        focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 
        focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900
        ${checked ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
    >
      <span
        aria-hidden="true"
        className={`
          pointer-events-none inline-block h-5 w-5 transform rounded-full 
          bg-white shadow ring-0 transition duration-200 ease-in-out
          ${checked ? 'translate-x-5' : 'translate-x-1'}
        `}
      />
    </button>
  );
};

export default Switch;
