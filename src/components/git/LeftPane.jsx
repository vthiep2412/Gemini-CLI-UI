/**
 * LeftPane.jsx — Left pane coordinator.
 * Shows BranchBar on top, then either:
 *   - CommitDetail (when a commit is selected via graph click), or
 *   - FileTree + CommitInput (normal working-tree view)
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import BranchBar from './BranchBar';
import FileTree from './FileTree';
import CommitInput from './CommitInput';
import CommitDetail from './CommitDetail';
import { useGitStore } from '../../hooks/gitStore';
import { useTheme } from '../../contexts/ThemeContext';
import { useMobile } from '../../hooks/useMobile';

export default function LeftPane() {
  const { isDarkMode } = useTheme();
  const isMobile = useMobile();
  const selectedCommit = useGitStore(s => s.selectedCommit);
  const [commitHeight, setCommitHeight] = useState(220);
  const isResizing = useRef(false);
  const containerRef = useRef(null);
  const rafRef = useRef(null);
  const handleMouseMoveRef = useRef(null);
  const stopResizingRef = useRef(null);

  const handleMouseMove = useCallback((e) => {
    if (!isResizing.current || !containerRef.current) return;
    
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newHeight = rect.bottom - e.clientY;
      // Constrain height between 220px and 350px
      const clamped = Math.max(220, Math.min(newHeight, 350));
      setCommitHeight(clamped);
    });
  }, []);

  const stopResizing = useCallback(() => {
    isResizing.current = false;
    document.removeEventListener('mousemove', handleMouseMoveRef.current);
    document.removeEventListener('mouseup', stopResizingRef.current);
    document.body.style.cursor = 'default';
    document.body.style.userSelect = 'auto';
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  const startResizing = useCallback((e) => {
    e.preventDefault();
    isResizing.current = true;
    document.addEventListener('mousemove', handleMouseMoveRef.current);
    document.addEventListener('mouseup', stopResizingRef.current);
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  }, []);

  // Sync refs to avoid stale closures in event listeners
  useEffect(() => {
    handleMouseMoveRef.current = handleMouseMove;
    stopResizingRef.current = stopResizing;
  }, [handleMouseMove, stopResizing]);

  const handleKeyDown = (e) => {
    let step = 0;
    if (e.key === 'ArrowUp') step = 10;
    else if (e.key === 'ArrowDown') step = -10;
    
    if (step !== 0) {
      if (e.shiftKey) step *= 4;
      e.preventDefault();
      setCommitHeight(h => Math.max(220, Math.min(h + step, 350)));
    }
  };

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMoveRef.current);
      document.removeEventListener('mouseup', stopResizingRef.current);
      // Reset global styles if component unmounts during drag
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col h-full bg-(--bg-base) border-r border-border overflow-hidden" ref={containerRef}>
      <BranchBar />
      <div className="flex-1 min-h-0 relative flex flex-col overflow-hidden">
        {selectedCommit ? (
          <CommitDetail />
        ) : (
          <>
            <div className="flex-1 flex flex-col overflow-hidden" style={{ paddingBottom: commitHeight }}>
              <FileTree />
            </div>
            <div 
              className={`absolute left-0 right-0 z-20 border-t border-border flex flex-col transition-all duration-300
                ${isMobile ? 'bottom-20 mx-4 rounded-2xl border shadow-2xl' : 'bottom-0'}
                ${isDarkMode ? 'bg-(--bg-base)/95 backdrop-blur-md' : 'bg-white/98 backdrop-blur-sm shadow-[0_-4px_12px_rgba(0,0,0,0.03)]'}`}
              style={{ height: commitHeight }}
            >
              {/* Resize Handle at the top of the absolute div */}
              <div 
                className="absolute -top-1 left-0 right-0 h-2 cursor-ns-resize z-30 flex 
                items-center justify-center group outline-none focus-visible:ring-2 
                focus-visible:ring-(--git-accent) focus-visible:ring-offset-1 
                focus-visible:ring-offset-(--bg-base)"
                onMouseDown={startResizing}
                role="separator"
                aria-orientation="horizontal"
                aria-valuenow={commitHeight}
                aria-valuemin={220}
                aria-valuemax={350}
                aria-label="Resize commit input holder"
                tabIndex={0}
                onKeyDown={handleKeyDown}
              >
                <div className="w-12 h-1 rounded-full bg-border/40 group-hover:bg-(--git-accent)/50 transition-colors" />
              </div>
              
              <CommitInput />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
