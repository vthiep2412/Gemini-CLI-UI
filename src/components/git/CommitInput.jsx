/**
 * CommitInput.jsx — Bottom area of the left pane.
 * Textarea for commit message + AI generate + Commit / Commit & Push buttons.
 */
import React, { useRef, useEffect } from 'react';
import { Sparkles, Upload, Loader2 } from 'lucide-react';
import Tooltip from '../common/Tooltip';
import { useGitStore } from '../../hooks/gitStore';

export default function CommitInput() {
  const commitMessage = useGitStore(s => s.commitMessage);
  const setCommitMessage = useGitStore(s => s.setCommitMessage);
  const syncAndCommit = useGitStore(s => s.syncAndCommit);
  const generateCommitMessage = useGitStore(s => s.generateCommitMessage);
  const gitStatus = useGitStore(s => s.gitStatus);
  const loadingState = useGitStore(s => s.loadingState);

  const textareaRef = useRef(null);
  const changeCount = gitStatus?.files?.length || 0;

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  }, [commitMessage]);

  const handleSyncAndCommit = async () => {
    try {
      await syncAndCommit();
    } catch (error) {
      console.error('Sync and commit failed:', error);
      // TODO: Add toast sonner
      // For all purpose toast, and in this case notify error.
    }
  };

  const canCommit = commitMessage.trim().length > 0 && changeCount > 0;

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (canCommit) {
        handleSyncAndCommit();
      }
    }
  };

  return (
    <div className="bg-transparent p-2.5 flex-shrink-0 transition-colors">
      {/* Staged file count hint */}
      <div className="flex items-center justify-between mb-2 px-0.5">
        <span className="text-[10px] text-[var(--text-secondary)] font-bold tracking-tight uppercase opacity-80">
          {changeCount > 0
            ? `${changeCount} file${changeCount !== 1 ? 's' : ''} to sync`
            : 'No changes to sync'}
        </span>
        {/* AI generate button */}
        <Tooltip label="Generate commit message with AI">
          <button
            onClick={generateCommitMessage}
            disabled={(loadingState?.generatingMessage ?? false) || changeCount === 0}
            className="p-1.5 rounded-md hover:bg-[var(--bg-muted)] text-[var(--git-accent)] transition-all disabled:opacity-50"
          >
            {loadingState?.generatingMessage
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Sparkles className="w-4 h-4" />}
          </button>
        </Tooltip>
      </div>

      {/* Message textarea */}
      <div className="relative group">
        <textarea
          ref={textareaRef}
          value={commitMessage}
          onChange={e => setCommitMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Commit message (Ctrl/⌘ + Enter to commit)"
          aria-label="Commit message"
          rows={2}
          className="w-full bg-[var(--bg-surface)] rounded-md px-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-secondary)]/40
            font-sans resize-none outline-none focus:bg-[var(--bg-muted)] transition-all leading-relaxed
            min-h-[60px] max-h-[120px] overflow-y-auto custom-scrollbar shadow-sm"
        />
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 mt-2">
        <button
          onClick={handleSyncAndCommit}
          disabled={!canCommit || loadingState?.committing || loadingState?.pushing || loadingState?.pulling}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-xs font-bold
            bg-[var(--git-accent)] hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed
            text-white transition-all shadow-md hover:shadow-lg shadow-[var(--git-accent)]/20 active:scale-[0.98] uppercase tracking-wide"
        >
          {loadingState?.committing || loadingState?.pushing || loadingState?.pulling ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Synchronizing...</>
          ) : (
            <><Upload className="w-3.5 h-3.5" /> Sync and Commit</>
          )}
        </button>
      </div>
    </div>
  );
}
