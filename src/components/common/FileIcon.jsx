import React, { useMemo } from 'react';
import { getIcon } from 'material-file-icons';
import { Folder, FolderOpen } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

/**
 * Renders a material-style file icon OR a filled Lucide folder icon.
 * Colors adapt based on theme: Gold/Amber (Light) vs Gray (Dark).
 */
export default function FileIcon({ filename = '', isFolder = false, isOpen = false, className = '', size = 18 }) {
  const { isDarkMode } = useTheme();
  
  const iconMarkup = useMemo(() => {
    if (isFolder) return null;
    return getIcon(filename);
  }, [filename, isFolder]);

  if (isFolder) {
    const LucideIcon = isOpen ? FolderOpen : Folder;
    
    // Light Mode: Golden/Amber with high contrast (#d97706)
    // Dark Mode: True Gray (Zinc/Neutral)
    const color = isDarkMode ? '#71717a' : '#d97706'; 
    
    return (
      <LucideIcon 
        size={size} 
        className={className} 
        aria-hidden="true"
        style={{ 
          color, 
          fill: isDarkMode ? `${color}33` : `${color}22` // Slightly lighter fill for high contrast outline in light mode
        }} 
        strokeWidth={2} 
      />
    );
  }

  return (
    <span
      className={`inline-flex flex-shrink-0 items-center justify-center [&>svg]:w-full [&>svg]:h-full ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: iconMarkup?.svg || '' }}
    />
  );
}
