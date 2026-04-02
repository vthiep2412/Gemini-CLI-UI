/**
 * RightPane.jsx — Right pane coordinator.
 * Contains the GraphRenderer with a header showing the repo name and graph controls.
 */
import React from 'react';
import GraphRenderer from './GraphRenderer';
import { useGitStore } from '../../hooks/gitStore';
import { useMobile } from '../../hooks/useMobile';
import { GitGraph, FileStack } from 'lucide-react';

export default function RightPane() {
  const loadingGraph = useGitStore(s => s.loadingState?.loadingGraph);
  const setMobileView = useGitStore(s => s.setMobileView);
  const isMobile = useMobile();

  // Task: Implement the "nav and title touching gap check" algorithm
  const titleRef = React.useRef(null);
  const helperRef = React.useRef(null);
  const headerRef = React.useRef(null);
  const [isTitleCondensed, setIsTitleCondensed] = React.useState(false);

  // Algorithm: Check if title and helper text are physicaly touching or too close
  const checkOverlap = React.useCallback(() => {
    if (!titleRef.current || !helperRef.current || isMobile) {
      if (isMobile) setIsTitleCondensed(false);
      return;
    }

    const titleRect = titleRef.current.getBoundingClientRect();
    const helperRect = helperRef.current.getBoundingClientRect();
    
    // Gap: Helper's left edge - Title's right edge
    const gap = helperRect.left - titleRect.right;
    
    // Threshold: collapse if gap < 20px, expand if gap > 120px
    if (gap < 24) {
      setIsTitleCondensed(true);
    } else if (gap > 180) {
      setIsTitleCondensed(false);
    }
  }, [isMobile]);

  React.useLayoutEffect(() => {
    if (!headerRef.current) return;
    
    const observer = new ResizeObserver(() => checkOverlap());
    observer.observe(headerRef.current);
    checkOverlap(); // Initial check

    return () => observer.disconnect();
  }, [checkOverlap]);

  let titleText = isMobile ? 'Graph View' : 'Source Control Graph';
  if (!isMobile && isTitleCondensed) {
    titleText = 'History Graph';
  }

  return (
    <div className="flex flex-col h-full bg-[var(--bg-surface)] overflow-hidden">
      {/* Header */}
      <div 
        ref={headerRef}
        className="flex items-center justify-between px-5 h-[3.3rem] flex-shrink-0 bg-[var(--bg-surface)] border-b border-border shadow-sm"
      >
        <div className="flex items-center gap-3">
          <GitGraph className="w-6 h-6 text-[var(--git-accent)]" />
          <span 
            ref={titleRef}
            className={`text-[var(--text-primary)] opacity-90 uppercase tracking-[0.12em] whitespace-nowrap transition-all duration-300 ${isMobile ? 'text-xs font-bold' : 'text-sm font-black'}`}
          >
            {titleText}
          </span>
          {loadingGraph && (
            <span className="text-xs text-[var(--text-secondary)] animate-pulse ml-3 font-mono font-bold">Syncing...</span>
          )}
        </div>
        
        {isMobile ? (
          <button
            onClick={() => setMobileView('diff')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20 active:scale-95 transition-all text-[10px] font-bold uppercase tracking-tight shadow-sm"
          >
            <FileStack className="w-3 h-3" />
            <span>Diff File View</span>
          </button>
        ) : (
          <div 
            ref={helperRef}
            className="text-[11px] text-[var(--text-secondary)] font-mono uppercase tracking-widest opacity-80 font-bold pr-2 whitespace-nowrap"
          >
            Click commit to inspect changes
          </div>
        )}
      </div>

      {/* Graph */}
      <GraphRenderer />
    </div>
  );
}
