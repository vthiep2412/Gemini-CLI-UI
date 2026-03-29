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

export default function LeftPane() {
  const selectedCommit = useGitStore(s => s.selectedCommit);
  const [commitHeight, setCommitHeight] = useState(220);
  const isResizing = useRef(false);
  const containerRef = useRef(null);
  const rafRef = useRef(null);

  const startResizing = useCallback((e) => {
    e.preventDefault();
    isResizing.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResizing);
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const stopResizing = useCallback(() => {
    isResizing.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', stopResizing);
    document.body.style.cursor = 'default';
    document.body.style.userSelect = 'auto';
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', stopResizing);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [handleMouseMove, stopResizing]);

  return (
    <div className="flex flex-col h-full bg-[var(--bg-base)] border-r border-border overflow-hidden" ref={containerRef}>
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
              className="absolute bottom-0 left-0 right-0 z-20 border-t border-border bg-[var(--bg-base)]/95 backdrop-blur-md flex flex-col"
              style={{ height: commitHeight }}
            >
              {/* Resize Handle at the top of the absolute div */}
              <div 
                className="absolute -top-1 left-0 right-0 h-2 cursor-ns-resize z-30 flex items-center justify-center group"
                onMouseDown={startResizing}
              >
                <div className="w-12 h-1 rounded-full bg-border/40 group-hover:bg-[var(--git-accent)]/50 transition-colors" />
              </div>
              
              <CommitInput />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
