import { useState, useLayoutEffect } from 'react';

/**
 * useResizeObserver.js — Simple, performant hook to get numeric dimensions
 * of a DOM element using the native ResizeObserver API.
 * Used for virtualized components (like react-window) that require pixel widths.
 */
export function useResizeObserver(ref) {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    if (!ref.current || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver((entries) => {
      if (!entries[0]) return;
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });

    observer.observe(ref.current);

    return () => {
      observer.disconnect();
    };
  }, [ref]);

  return dimensions;
}
