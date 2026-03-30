/**
 * CommitInput.jsx — Bottom area of the left pane.
 * Textarea for commit message + AI generate + Commit / Commit & Push buttons.
 */
import React, { useRef, useEffect } from 'react';
import { Sparkles, Zap, Upload, Loader2 } from 'lucide-react';
import Tooltip from '../common/Tooltip';
import { useGitStore } from '../../hooks/gitStore';
import { useTheme } from '../../contexts/ThemeContext';
import { toast } from 'sonner';

export default function CommitInput() {
  const { isDarkMode } = useTheme();
  const commitMessage = useGitStore(s => s.commitMessage);
  const setCommitMessage = useGitStore(s => s.setCommitMessage);
  const syncAndCommit = useGitStore(s => s.syncAndCommit);
  const generateQuickCommitMessage = useGitStore(s => s.generateQuickCommitMessage);
  const getQuickCommitMessage = useGitStore(s => s.getQuickCommitMessage);
  const generateAICommitMessage = useGitStore(s => s.generateAICommitMessage);
  const gitStatus = useGitStore(s => s.gitStatus);
  const loadingState = useGitStore(s => s.loadingState);

  const textareaRef = useRef(null);
  const changeCount = gitStatus?.files?.length || 0;

  const memoizedQuickCommit = React.useMemo(() => getQuickCommitMessage(), [gitStatus, changeCount]);


  const handleSyncAndCommit = async () => {
    if (changeCount === 0) return;

    let msgToUse = commitMessage;
    if (!msgToUse || !msgToUse.trim()) {
      const fallbackMsg = getQuickCommitMessage();
      if (!fallbackMsg || !fallbackMsg.trim()) {
        toast.error('Please enter a commit message');
        textareaRef.current?.focus();
        return;
      }
      setCommitMessage(fallbackMsg);
      msgToUse = fallbackMsg;
    }

    try {
      const result = await syncAndCommit(msgToUse);
      if (result && result.success) {
        toast.success('Changes committed and synchronized');
        if (result.warning) {
          toast.warning(result.warning);
        }
      } else if (result === false) {
        // User is notified via store error usually, but let's be safe
        toast.error('Commit failed. Check for conflicts or unstaged changes.');
      }
    } catch (error) {
      console.error('Sync and commit failed:', error);
      toast.error(error.message || 'Operation failed');
    }
  };

  const canCommit = changeCount > 0;

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (canCommit) {
        handleSyncAndCommit();
      }
    }
  };

  return (
    <div className="bg-transparent flex-1 min-h-0 p-2.5 transition-colors flex flex-col">
      {/* Staged file count hint */}
      <div className="flex items-center justify-between mb-2 px-0.5">
        <span className="text-[10px] text-[var(--text-secondary)] font-bold tracking-tight uppercase opacity-80">
          {changeCount > 0
            ? `${changeCount} file${changeCount !== 1 ? 's' : ''} to sync`
            : 'No changes to sync'}
        </span>
        {/* Action buttons group */}
        <div className="flex items-center gap-1">
          <Tooltip label="Generate Commit Message With AI">
            <button
              onClick={generateAICommitMessage}
              disabled={(loadingState?.generatingMessage ?? false) || changeCount === 0}
              className="p-1.5 rounded-md hover:bg-[var(--bg-muted)] text-[var(--git-accent)] transition-all disabled:opacity-50"
            >
              {loadingState?.generatingMessage
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Sparkles className="w-4 h-4" />}
            </button>
          </Tooltip>
          {/* Quick generate button */}
          <Tooltip label="Quick Commit Message">
            <button
              onClick={generateQuickCommitMessage}
              disabled={changeCount === 0 || (loadingState?.generatingMessage ?? false)}
              className="p-1.5 rounded-md hover:bg-[var(--bg-muted)] text-emerald-400 transition-all disabled:opacity-50"
            >
              <Zap className="w-4 h-4" />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Message textarea */}
      <div className="relative group flex-1 flex flex-col min-h-0">
        <textarea
          ref={textareaRef}
          value={commitMessage}
          onChange={e => setCommitMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={memoizedQuickCommit || 'Commit message'}

          aria-label="Commit message"
          rows={2}
          className={`w-full rounded-md border px-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-secondary)]/40
            font-sans resize-none outline-none transition-all leading-relaxed
            flex-1 min-h-[60px] overflow-y-auto custom-scrollbar shadow-sm
            ${isDarkMode 
              ? 'bg-white/10 border-white/5 focus:bg-white/20 focus:border-[var(--git-accent)]/30' 
              : 'bg-white border-slate-200 focus:border-[var(--git-accent)]/50 focus:ring-1 focus:ring-[var(--git-accent)]/10'
            }`}
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
