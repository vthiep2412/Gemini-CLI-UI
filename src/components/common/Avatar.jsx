import React from 'react';

/**
 * Common Avatar Component
 * Displays a GitHub profile picture with an initial-based fallback.
 * @param {string} name - The name or username to use for the avatar.
 * @param {string} email - Email address for fallback avatar URL derivation.
 * @param {string} className - Additional CSS classes.
 */
function Avatar({ name, email, className = "" }) {  
  const initial = (name || '?').charAt(0).toUpperCase();

  // Avatar URL derivation priority:
  // 1. Use git username (name) directly — most likely to match a GitHub handle
  // 2. Fall back to email local-part (remove GitHub ID prefix e.g. 12345+username)
  // 3. Last resort: first word of name (handles "First Last" display names)
  let candidate = '';
  if (name && name.trim()) {
    // Use the raw git username; if it's a display name (contains spaces),
    // strip spaces so it can still be tried as a GitHub slug
    candidate = name.trim().replace(/\s+/g, '');
  }

  if (!candidate && email) {
    // Fall back to email local-part
    candidate = email.split('@')[0];
    // Remove the "12345678+" prefix found in GitHub noreply addresses
    candidate = candidate.replace(/^\d+\+/, '');
  }
  
  const username = candidate.toLowerCase().trim() || null;

  const src = username ? `https://github.com/${username}.png` : '';

  return (
    <div className={`w-8 h-8 rounded-full overflow-hidden bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-[14px] shrink-0 relative group/avatar shadow-sm ${className}`}>
      {username && (
        <img
          key={src}
          src={src}
          alt={name || 'User avatar'}
          className="absolute inset-0 w-full h-full object-cover z-10 transition-opacity duration-300"
          onError={(e) => {
            e.target.style.opacity = '0';
            e.target.style.pointerEvents = 'none';
          }}
        />
      )}
      <div className="flex w-full h-full items-center justify-center bg-emerald-500/5">
        {initial}
      </div>
    </div>
  );
}

export default Avatar;
