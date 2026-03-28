/**
 * FileRow.jsx — Single file row in the file tree.
 * Used in both working-tree mode (with stage/discard actions) and
 * commit-view mode (read-only, with expandable inline diff).
 */
import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Check, Trash2, AlignLeft, ArrowLeftRight, Plus, Minus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGitStore } from '../../hooks/gitStore';
import { useShallow } from 'zustand/react/shallow';
import Tooltip from '../common/Tooltip';
import MonacoDiffViewer from '../common/MonacoDiffViewer';
import { authenticatedFetch } from '../../utils/api';

const STATUS_CONFIG = {
  M: { label: 'Modified', bg: 'bg-yellow-500/20', text: 'text-yellow-500' },
  A: { label: 'Added',    bg: 'bg-green-500/20',  text: 'text-green-500'  },
  D: { label: 'Deleted',  bg: 'bg-red-500/20',    text: 'text-red-500'    },
  U: { label: 'Untracked', bg: 'bg-green-500/20',  text: 'text-green-500'  },
  '??': { label: 'Untracked', bg: 'bg-green-500/20', text: 'text-green-500' },
  C: { label: 'Conflict', bg: 'bg-orange-500/20', text: 'text-orange-500' },
  R: { label: 'Renamed',  bg: 'bg-blue-500/20',   text: 'text-blue-400'   },
};



export default function FileRow({ filePath, status, mode = 'changes', section, commitDiffChunk, isFocused, commitHash, oldPath }) {
  const [expanded, setExpanded] = useState(false);
  const [wrapText, setWrapText] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const confirmTimeoutRef = React.useRef(null);
  const rowRef = React.useRef(null);
  const [commitFileDiff, setCommitFileDiff] = useState(commitDiffChunk);
  const selectedProject = useGitStore(state => state.selectedProject);

  useEffect(() => {
    if (isFocused && rowRef.current) {
      rowRef.current.focus();
      rowRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [isFocused]);

  useEffect(() => {
    if (confirming) {
      confirmTimeoutRef.current = setTimeout(() => setConfirming(false), 3000);
      return () => {
        if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
      };
    }
  }, [confirming]);

  const { gitDiff, discardFile, fetchFileDiff, stageFiles, unstageFiles } = useGitStore(
    useShallow(state => ({
      gitDiff: state.gitDiff,
      discardFile: state.discardFile,
      fetchFileDiff: state.fetchFileDiff,
      stageFiles: state.stageFiles,
      unstageFiles: state.unstageFiles,
    }))
  );
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG['U'];
  const diff = mode === 'commit-view' ? commitFileDiff : gitDiff[filePath];

  const handleExpand = async () => {
    if (!expanded) {
      if (mode === 'commit-view' && !commitFileDiff && commitHash && selectedProject) {
        try {
          const res = await authenticatedFetch(`/api/git/commit-file-diff?project=${encodeURIComponent(selectedProject.name)}&commit=${commitHash}&file=${encodeURIComponent(filePath)}&oldPath=${encodeURIComponent(oldPath || filePath)}`);
          if (res.ok) {
            const data = await res.json();
            setCommitFileDiff({ original: data.originalContent, modified: data.modifiedContent });
          }
        } catch (e) {
          console.error('Failed to load file diff:', e);
        }
      } else if (!diff && mode !== 'commit-view') {
        fetchFileDiff(filePath);
      }
    }
    setExpanded(v => !v);
  };

  const handleDiscard = (e) => {
    e.stopPropagation();
    if (!confirming) { setConfirming(true); return; }
    discardFile(filePath);
    setConfirming(false);
  };

  const parts = filePath.replace(/\\/g, '/').split('/');
  const fileName = parts.pop();
  const dirPart = parts.length > 0 ? parts.join('/') + '/' : '';

  return (
    <div className={`transition-colors truncate border-b border-border/50 ${isFocused ? 'ring-1 ring-inset ring-[var(--git-accent)] bg-[var(--git-accent)]/5' : ''}`}>
      <div
        ref={rowRef}
        className={`flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--bg-muted)]/30 group cursor-pointer transition-all duration-200
          ${expanded ? 'bg-[var(--bg-muted)]/20' : ''} ${isFocused ? 'bg-[var(--bg-muted)]/40' : ''}`}
        onClick={handleExpand}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleExpand();
          }
        }}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
      >
        <ChevronRight
          className={`w-3 h-3 flex-shrink-0 text-[var(--text-secondary)] transition-all duration-300 transform-gpu ${expanded ? 'rotate-90 text-[var(--git-accent)]' : ''}`}
        />
        <span className="flex-1 min-w-0 text-[11px] font-mono truncate">
          <span className="text-[var(--text-secondary)] opacity-70">{dirPart}</span>
          <span className="text-[var(--text-primary)] font-medium">{fileName}</span>
        </span>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">

          {(mode === 'changes') && (
            <>
              {(status === 'M' || status === 'D' || status === 'U') && section !== 'staged' && (
                <Tooltip label={confirming ? (status === 'U' ? 'Permanently delete untracked file — click again to confirm' : 'Click again to confirm discard') : 'Discard changes'}>
                  <button
                    aria-label={confirming ? 'Confirm discard' : 'Discard changes'}
                    onClick={handleDiscard}
                    onBlur={() => setConfirming(false)}
                    className={`p-1 rounded transition-all ${confirming ? 'bg-rose-500 text-white' : 'text-[var(--text-secondary)] hover:bg-rose-500/10 hover:text-rose-400'}`}
                  >
                    {confirming ? <Check className="w-3 h-3" /> : <Trash2 className="w-3 h-3" />}
                  </button>
                </Tooltip>
              )}
              {section === 'unstaged' && (
                <Tooltip label="Stage">
                  <button
                    aria-label="Stage file"
                    onClick={(e) => { e.stopPropagation(); stageFiles([filePath]); }}
                    className="p-1 rounded transition-all text-emerald-400 hover:bg-emerald-500/20"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </Tooltip>
              )}
              {section === 'staged' && (
                <Tooltip label="Unstage">
                  <button
                    aria-label="Unstage file"
                    onClick={(e) => { e.stopPropagation(); unstageFiles([filePath]); }}
                    className="p-1 rounded transition-all text-orange-400 hover:bg-orange-500/20"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                </Tooltip>
              )}
            </>
          )}
        </div>

        <Tooltip label={cfg.label}>
          <span className={`flex-shrink-0 w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold rounded transition-all ${cfg.bg} ${cfg.text} shadow-sm group-hover:scale-110`}>
            {status === '??' ? 'U' : status}
          </span>
        </Tooltip>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.04, 0.62, 0.23, 0.98] }}
            className="overflow-hidden bg-[var(--bg-base)]/30"
          >
            <div>
              <div className="flex items-center gap-2 px-4 py-1.5 bg-[var(--bg-surface)]/30">
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                <span className="text-[10px] text-[var(--text-secondary)] font-mono truncate opacity-60">{filePath}</span>
              </div>
              <div className="overflow-hidden">
                {!diff ? (
                  <div className="p-3 text-[10px] text-[var(--text-secondary)] font-mono animate-pulse">Loading diff...</div>
                ) : (
                  <MonacoDiffViewer
                    original={diff.original || ''}
                    modified={diff.modified || ''}
                    height="300px"
                  />
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
