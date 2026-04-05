/**
 * Simple line-based diff algorithm with internal caching.
 * Used for rendering tool-use diffs and file previews.
 */

const cache = new Map();
const MAX_CACHE_SIZE = 100;

export const createDiff = (oldStr, newStr) => {
  // Use full content for cache key to avoid collisions
  const cacheKey = `${oldStr || ''}\x00${newStr || ''}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey).map(entry => ({ ...entry }));
  
  // Clean up cache if too large
  if (cache.size >= MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
  
  const diff = [];
  const oldLines = (oldStr || '').split('\n');
  const newLines = (newStr || '').split('\n');
  
  // Dynamic Programming approach for LCS (Longest Common Subsequence)
  const n = oldLines.length;
  const m = newLines.length;
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to build the diff
  let i = n, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      // Lines are equal - we skip them in our simplified tool diff,
      // but LCS usually keeps them. 
      // For this specific UI, we're building a "changes only" list.
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diff.unshift({ type: 'added', content: newLines[j - 1] });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      diff.unshift({ type: 'removed', content: oldLines[i - 1] });
      i--;
    }
  }
  
  cache.set(cacheKey, diff);
  return diff.map(entry => ({ ...entry }));
};
