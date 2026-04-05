/**
 * SplitPane.jsx — Resizable horizontal split container.
 * Drag the divider between left (source control) and right (graph) panes.
 * Ratio is persisted to localStorage.
 */
import React, { useRef, useState, useEffect, useCallback } from 'react';

import Tooltip from '../common/Tooltip';

const STORAGE_KEY = 'git-split-ratio';
const DEFAULT_RATIO = 0.38; // 38% left
const MIN_LEFT_PX = 260;
const MAX_LEFT_RATIO = 0.58;

export default function SplitPane({ left, right, className = '' }) {
  const containerRef = useRef(null);
  const rafRef = useRef(null);
  const dragging = useRef(false);
  const hasLoggedStorageError = useRef(false);

  const [ratio, setRatio] = useState(() => {
    try {
      if (typeof window === 'undefined') return DEFAULT_RATIO;
      const saved = localStorage.getItem(STORAGE_KEY);
      const parsed = saved ? parseFloat(saved) : DEFAULT_RATIO;
      // Validate ratio is within safe bounds
      return isNaN(parsed) ? DEFAULT_RATIO : Math.max(0.1, Math.min(parsed, MAX_LEFT_RATIO));
    } catch (e) {
      console.warn('Failed to read split ratio from localStorage:', e);
      return DEFAULT_RATIO;
    }
  });

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const onPointerDown = useCallback((e) => {
    e.preventDefault();
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e) => {
    if (!dragging.current || !containerRef.current) return;
    
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    
    rafRef.current = requestAnimationFrame(() => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newLeft = e.clientX - rect.left;
      const totalWidth = rect.width;
      
      // Guard against tiny containers to avoid ratios > 1 or divide by zero
      if (totalWidth < MIN_LEFT_PX) return;
      
      const clampedLeft = Math.max(MIN_LEFT_PX, Math.min(newLeft, totalWidth * MAX_LEFT_RATIO));
      const newRatio = clampedLeft / totalWidth;
      
      setRatio(newRatio);
      try {
        localStorage.setItem(STORAGE_KEY, String(newRatio));
      } catch (err) {
        // Log only the first occurrence to avoid flooding the console
        if (!hasLoggedStorageError.current) {
          console.warn('Failed to write split ratio to localStorage (further warnings suppressed):', err);
          hasLoggedStorageError.current = true;
        }
      }
    });
  }, []);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  return (
    <div
      ref={containerRef}
      className={`flex flex-row h-full overflow-hidden ${className}`}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      {/* Left pane */}
      <div
        style={{ flex: `0 0 ${(ratio * 100).toFixed(2)}%`, minWidth: MIN_LEFT_PX, overflow: 'hidden' }}
        className="flex flex-col h-full"
      >
        {left}
      </div>

      {/* Divider */}
      <Tooltip label="Drag to resize">
        <div
          onPointerDown={onPointerDown}
          style={{
            width: '1px',
            margin: '0 1px',
            cursor: 'ew-resize',
            flexShrink: 0,
            background: 'transparent',
            opacity: 0,
            transition: 'all 0.2s',
            userSelect: 'none',
            touchAction: 'none',
            position: 'relative',
            height: '100%'
          }}
          className="hover:opacity-40 hover:bg-(--git-accent) active:bg-(--git-accent) active:opacity-100 group transition-all"
        >
          {/* Invisible hit area for easier grabbing */}
          <div className="absolute inset-y-0 -left-1.5 -right-1.5 cursor-ew-resize" />
        </div>
      </Tooltip>

      {/* Right pane */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {right}
      </div>
    </div>
  );
}
