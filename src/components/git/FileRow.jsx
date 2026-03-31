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
import { useTheme } from '../../contexts/ThemeContext';
import Tooltip from '../common/Tooltip';
import MonacoDiffViewer from '../common/MonacoDiffViewer';
import { authenticatedFetch } from '../../utils/api';

const STATUS_CONFIG = (isDark) => ({
  M: { label: 'Modified',
       bg: isDark ? 'bg-yellow-500/20' : 'bg-amber-500',
       text: isDark ? 'text-yellow-500' : 'text-white',
       border: isDark ? 'border-transparent' : 'border border-amber-600/30'
     },
  A: { label: 'Added',
       bg: isDark ? 'bg-green-500/20'  : 'bg-emerald-500',
       text: isDark ? 'text-green-500'  : 'text-white',
       border: isDark ? 'border-transparent' : 'border border-emerald-600/30'
     },
  D: { label: 'Deleted',
       bg: isDark ? 'bg-red-500/20'    : 'bg-rose-500',
       text: isDark ? 'text-red-500'    : 'text-white',
       border: isDark ? 'border-transparent' : 'border border-rose-600/30'
     },
  U: { label: 'Untracked',
       bg: isDark ? 'bg-green-500/20'  : 'bg-emerald-500',
       text: isDark ? 'text-green-500'  : 'text-white',
       border: isDark ? 'border-transparent' : 'border border-emerald-600/30'
     },
  '??': { label: 'Untracked',
          bg: isDark ? 'bg-green-500/20' : 'bg-emerald-500',
          text: isDark ? 'text-green-500' : 'text-white',
          border: isDark ? 'border-transparent' : 'border border-emerald-600/30'
        },
  C: { label: 'Conflict',
       bg: isDark ? 'bg-orange-500/20' : 'bg-orange-500',
       text: isDark ? 'text-orange-500' : 'text-white',
       border: isDark ? 'border-transparent' : 'border border-orange-600/30'
     },
  R: { label: 'Renamed',
       bg: isDark ? 'bg-blue-500/20'   : 'bg-blue-500',
       text: isDark ? 'text-blue-400'   : 'text-white',
       border: isDark ? 'border-transparent' : 'border border-blue-600/30'
     },
});

const DARK_STATUS_CONFIG = STATUS_CONFIG(true);
const LIGHT_STATUS_CONFIG = STATUS_CONFIG(false);



export default function FileRow({ filePath, status, mode = 'changes', section, isFocused, commitHash, oldPath }) {
  const [expanded, setExpanded] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const rowRef = React.useRef(null);
  const [commitFileDiff, setCommitFileDiff] = useState(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState(null);
  const [isSideBySide, setIsSideBySide] = useState(null);
  const abortControllerRef = React.useRef(null);
  const selectedProject = useGitStore(state => state.selectedProject);

  useEffect(() => {
    if (isFocused && rowRef.current) {
      rowRef.current.focus();
      rowRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [isFocused]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  const { isDarkMode } = useTheme();
  const { gitDiff, discardFile, fetchFileDiff, stageFiles, unstageFiles } = useGitStore(
    useShallow(state => ({
      gitDiff: state.gitDiff,
      discardFile: state.discardFile,
      fetchFileDiff: state.fetchFileDiff,
      stageFiles: state.stageFiles,
      unstageFiles: state.unstageFiles,
    }))
  );
  const statusConfig = isDarkMode ? DARK_STATUS_CONFIG : LIGHT_STATUS_CONFIG;
  const cfg = statusConfig[status] || statusConfig['U'];
  const diff = mode === 'commit-view' ? commitFileDiff : gitDiff[filePath];

  const handleExpand = async () => {
    if (!expanded) {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const { signal } = controller;

      if (mode === 'commit-view' && !commitFileDiff && commitHash && selectedProject) {
        setDiffLoading(true);
        setDiffError(null);
        try {
          const res = await authenticatedFetch(
            `/api/git/commit-file-diff?project=${encodeURIComponent(selectedProject.name)}&commit=${commitHash}&file=${encodeURIComponent(filePath)}&oldPath=${encodeURIComponent(oldPath || filePath)}`,
            { signal }
          );
          if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          const data = await res.json();
          if (!signal.aborted) {
            setCommitFileDiff({ original: data.originalContent, modified: data.modifiedContent });
          }
        } catch (e) {
          if (!signal.aborted) {
            console.error('Failed to load file diff:', e);
            setDiffError('Failed to load diff');
          }
        } finally {
          if (!signal.aborted) setDiffLoading(false);
        }
      } else if (!diff && mode !== 'commit-view') {
        setDiffLoading(true);
        setDiffError(null);
        try {
          await fetchFileDiff(filePath, signal);
        } catch (err) {
          if (!signal.aborted) {
            setDiffError('Failed to load diff');
          }
        } finally {
          if (!signal.aborted) setDiffLoading(false);
        }
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

  const rowBgClass = isDarkMode
    ? (expanded ? 'bg-[var(--bg-muted)]/20' : isFocused ? 'bg-[var(--bg-muted)]/40' : '')
    : (expanded ? 'bg-slate-100' : isFocused ? 'bg-slate-200' : '');

  return (
    <div className={`transition-colors truncate border-b border-border/50 ${isFocused ? 'ring-1 ring-inset ring-[var(--git-accent)] bg-[var(--git-accent)]/5' : ''}`}>
      <div
        ref={rowRef}
        className={`flex items-center gap-2 px-3 py-1.5 ${isDarkMode ? 'hover:bg-[var(--bg-muted)]/30' : 'hover:bg-slate-200/60'} group cursor-pointer transition-all duration-200
          ${rowBgClass}`}
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
          <Tooltip label={isSideBySide === true ? 'Switch to Unified View' : 'Switch to Split View'}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsSideBySide(prev => prev === null ? true : !prev);
              }}
              className={`p-1 rounded transition-all text-[var(--text-secondary)] opacity-60 hover:opacity-100
                ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-slate-300/50'}`}
            >
              {isSideBySide === true ? <AlignLeft size={13} /> : <ArrowLeftRight size={13} />}
            </button>
          </Tooltip>

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
          <span className={`flex-shrink-0 w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold rounded transition-all ${cfg.bg} ${cfg.text} ${cfg.border} shadow-sm group-hover:scale-110`}>
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
            className={`overflow-hidden ${isDarkMode ? 'bg-[var(--bg-base)]/30' : 'bg-slate-50 border-t border-border/30'}`}
          >
            <div>
              <div className={`flex items-center gap-2 px-4 py-1.5 ${isDarkMode ? 'bg-[var(--bg-surface)]/30' : 'bg-white border-b border-border/20'}`}>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.text} ${cfg.border}`}>{cfg.label}</span>
                <span className="text-[10px] text-[var(--text-secondary)] font-mono truncate opacity-60">{filePath}</span>
              </div>
              <div className="overflow-hidden">
                {diffLoading || (!diff && mode !== 'commit-view') ? (
                  <div className="p-3 text-[10px] text-[var(--text-secondary)] font-mono animate-pulse">Loading diff...</div>
                ) : diffError ? (
                  <div className="p-3 text-[10px] text-red-500 font-mono">{diffError}</div>
                ) : diff ? (
                  <MonacoDiffViewer
                    original={diff.original || ''}
                    modified={diff.modified || ''}
                    height="300px"
                    renderSideBySide={isSideBySide === null ? undefined : isSideBySide}
                  />
                ) : (
                   <div className="p-3 text-[10px] text-[var(--text-secondary)] font-mono">No diff available</div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
