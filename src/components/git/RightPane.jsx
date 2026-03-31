/**
 * RightPane.jsx — Right pane coordinator.
 * Contains the GraphRenderer with a header showing the repo name and graph controls.
 */
import React from 'react';
import { GitGraph } from 'lucide-react';
import GraphRenderer from './GraphRenderer';
import { useGitStore } from '../../hooks/gitStore';
import { useMobile } from '../../hooks/useMobile';
import { FileStack } from 'lucide-react';

export default function RightPane() {
  const loadingGraph = useGitStore(s => s.loadingState?.loadingGraph);
  const setMobileView = useGitStore(s => s.setMobileView);
  const isMobile = useMobile();

  return (
    <div className="flex flex-col h-full bg-[var(--bg-surface)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 h-[3.3rem] flex-shrink-0 bg-[var(--bg-surface)] border-b border-border shadow-sm">
        <div className="flex items-center gap-3">
          <GitGraph className="w-6 h-6 text-[var(--git-accent)]" />
          <span className={`text-[var(--text-primary)] opacity-90 uppercase tracking-[0.12em] ${isMobile ? 'text-xs font-bold' : 'text-sm font-black'}`}>
            {isMobile ? 'Graph View' : 'Source Control Graph'}
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
            <span>Change View</span>
          </button>
        ) : (
          <div className="text-[11px] text-[var(--text-secondary)] font-mono uppercase tracking-widest opacity-80 font-bold pr-2">
            Click commit to inspect changes
          </div>
        )}
      </div>

      {/* Graph */}
      <GraphRenderer />
    </div>
  );
}
