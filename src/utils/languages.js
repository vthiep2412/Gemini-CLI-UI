/**
 * Maps file names or extensions to Monaco-supported language identifiers.
 * @param {string} filename The name of the file (e.g. index.js, .env.local)
 * @returns {string} The Monaco language identifier
 */
export const getLanguage = (filename) => {
  const lower = filename?.toLowerCase() || '';
  
  // Specific filename prefix/match cases
  if (lower.startsWith('.env')) return 'ini';
  if (lower === '.gitignore' || lower === '.npmignore') return 'shell';
  if (lower === '.dockerignore') return 'shell';
  if (lower === 'dockerfile') return 'dockerfile';
  if (lower === 'makefile') return 'makefile';

  // Extension-based mapping
  const ext = filename?.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'js': case 'jsx': case 'cjs': case 'mjs': return 'javascript';
    case 'ts': case 'tsx': case 'cts': case 'mts': return 'typescript';
    case 'py': return 'python';
    case 'html': case 'htm': return 'html';
    case 'css': return 'css';
    case 'scss': return 'scss';
    case 'less': return 'less';
    case 'json': return 'json';
    case 'md': case 'markdown': return 'markdown';
    case 'yml': case 'yaml': return 'yaml';
    case 'sql': return 'sql';
    case 'sh': case 'bash': return 'shell';
    case 'toml': return 'toml';
    case 'ini': case 'env': return 'ini';
    case 'xml': case 'svg': return 'xml';
    case 'java': return 'java';
    case 'cpp': return 'cpp';
    case 'c': return 'c';
    case 'rs': return 'rust';
    case 'go': return 'go';
    case 'php': return 'php';
    case 'rb': return 'ruby';
    case 'dockerfile': return 'dockerfile';
    default: return 'plaintext';
  }
};
