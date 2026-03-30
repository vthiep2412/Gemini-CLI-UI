import React from 'react';

/**
 * Common Avatar Component
 * Displays a GitHub profile picture with an initial-based fallback.
 * @param {string} name - The name or username to use for the avatar.
 * @param {string} className - Additional CSS classes.
 */
function Avatar({ name, className = "" }) {
  const initial = (name || '?').charAt(0).toUpperCase();
  // Assume the first part of the 'name' might be the github username or close to it
  const username = (name || '').split(' ')[0].toLowerCase().trim() || null;

  return (
    <div className={`w-8 h-8 rounded overflow-hidden bg-[var(--git-accent,theme(colors.blue.600))]/20 text-[var(--git-accent,theme(colors.blue.600))] flex items-center justify-center font-bold text-[14px] flex-shrink-0 relative group/avatar ${className}`}>
      <img
        src={`https://github.com/${username}.png`}
        alt={name || 'User avatar'}
        className="absolute inset-0 w-full h-full object-cover z-10 transition-opacity duration-300"
        onError={(e) => {
          e.target.style.opacity = '0';
          e.target.style.pointerEvents = 'none';
        }}
      />
      <div className="flex w-full h-full items-center justify-center bg-current/10">
        {initial}
      </div>
    </div>
  );
}

export default Avatar;
