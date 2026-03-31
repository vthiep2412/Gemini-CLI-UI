import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Copy, AlignLeft, ArrowLeftRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import Tooltip from '../common/Tooltip';

import { useGitStore } from '../../hooks/gitStore';
import MonacoDiffViewer from '../common/MonacoDiffViewer';
import { useTheme } from '../../contexts/ThemeContext';
import { authenticatedFetch } from '../../utils/api';
import Avatar from '../common/Avatar';

async function copyToClipboard(text) {
  if (!text) return false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    }
  } catch (err) {
    console.error('[Clipboard] Copy failed:', err);
    return false;
  }
}

function FileDiffRow({ file, commitHash, selectedProject }) {
  const { isDarkMode } = useTheme();
  const [diffData, setDiffData] = useState(null);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [diffError, setDiffError] = useState(null);
  const [open, setOpen] = useState(false);
  const [isUnified, setIsUnified] = useState(null);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);
  
  const STATUS_CONFIG = useMemo(() => ({ 
    M: isDarkMode ? 'bg-yellow-500/20 text-yellow-500' : 'bg-amber-500 text-white border border-amber-600/30', 
    A: isDarkMode ? 'bg-green-500/20 text-green-500'  : 'bg-emerald-500 text-white border border-emerald-600/30', 
    D: isDarkMode ? 'bg-red-500/20 text-red-500'    : 'bg-rose-500 text-white border border-rose-600/30', 
    R: isDarkMode ? 'bg-blue-500/20 text-blue-400'   : 'bg-blue-500 text-white border border-blue-600/30' 
  }), [isDarkMode]);

  const handleExpand = async () => {
    if (!open && !diffData && commitHash && selectedProject) {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const { signal } = controller;

      setLoadingDiff(true);
      setDiffError(null);
      try {
        const res = await authenticatedFetch(
          `/api/git/commit-file-diff?project=${encodeURIComponent(selectedProject.name)}&commit=${commitHash}&file=${encodeURIComponent(file.filePath)}&oldPath=${encodeURIComponent(file.oldPath || file.filePath)}`,
          { signal }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        const data = await res.json();
        if (!signal.aborted) {
          setDiffData(data);
        }
      } catch (e) {
        if (!signal.aborted) {
          console.error('Failed to load file diff:', e);
          setDiffError('Error loading diff');
        }
      } finally {
        if (!signal.aborted) {
          setLoadingDiff(false);
        }
      }
    }
    setOpen(v => !v);
  };

  const parts = file.filePath.replace(/\\/g, '/').split('/');
  const fname = parts.pop();
  const dir = parts.length ? parts.join('/') + '/' : '';

  return (
    <div className="border-b border-border/30 last:border-0">
      <button
        type="button"
        className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[var(--bg-muted)]/40 text-xs cursor-pointer transition-all
          ${open ? 'bg-[var(--bg-muted)]/40' : ''}`}
        onClick={handleExpand}
      >
        <span className={`flex-shrink-0 w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold rounded shadow-sm ${STATUS_CONFIG[file.status] || ''}`}>
          {file.status}
        </span>
        <span className="flex-1 font-mono text-left truncate min-w-0">
          <span className="text-[var(--text-secondary)] opacity-70 text-[11px]">{dir}</span>
          <span className="text-[var(--text-primary)] font-semibold opacity-85">{fname}</span>
        </span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {file.adds > 0 && <span className="text-green-500/80 text-[12px] font-mono font-bold">+{file.adds}</span>}
          {file.dels > 0 && <span className="text-red-500/80 text-[12px] font-mono font-bold">-{file.dels}</span>}
          
          <Tooltip label={isUnified === null ? 'Toggle View Mode' : isUnified ? 'Switch to Split View' : 'Switch to Unified View'}>
            <button
              onClick={(e) => { 
                e.stopPropagation(); 
                // If it's currently null, it means we're in auto mode. Let's force it to unified on first click
                // Or try to toggle from the standard wider default.
                setIsUnified(prev => prev === null ? true : !prev); 
              }}
              className={`p-1.5 rounded transition-all ml-1 flex items-center justify-center
                ${isDarkMode ? 'hover:bg-white/10 text-white/40 hover:text-white/80' : 'hover:bg-slate-200 text-slate-400 hover:text-slate-700'}`}
            >
              {/* Show the icon for the state it will switch TO */}
              {isUnified === true ? <ArrowLeftRight size={13} /> : <AlignLeft size={13} />}
            </button>
          </Tooltip>

          <div className={`ml-1 transition-transform duration-300 ${open ? 'rotate-90 text-[var(--git-accent)]' : 'opacity-40'}`}>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className={`overflow-hidden ${isDarkMode ? 'bg-[var(--bg-base)]/30' : 'bg-slate-50'}`}
          >
            <div className="border-t border-border/40">
              <div className={`flex items-center justify-between px-4 py-2 border-b border-border/20 ${isDarkMode ? 'bg-[var(--bg-surface)]/10' : 'bg-white'}`}>
                <span className="text-[9px] text-[var(--text-secondary)] font-mono truncate opacity-60 tracking-wider uppercase">{file.filePath}</span>
              </div>
              <div className="overflow-hidden shadow-inner">
                {loadingDiff ? (
                  <div className="p-4 text-center text-xs text-[var(--text-secondary)] animate-pulse">Loading diff...</div>
                ) : diffError ? (
                  <div className="p-4 text-center text-xs text-red-500 font-mono">{diffError}</div>
                ) : diffData ? (
                  <MonacoDiffViewer
                    original={diffData.originalContent || ''}
                    modified={diffData.modifiedContent || ''}
                    height="400px"
                    renderSideBySide={isUnified === null ? undefined : !isUnified}
                  />
                ) : (
                  <div className="p-4 text-center text-xs text-[var(--text-secondary)]">No diff available</div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function CommitDetail() {
  const [msgExpanded, setMsgExpanded] = useState(false);
  const selectedCommit = useGitStore(s => s.selectedCommit);
  const commitDiff = useGitStore(s => s.commitDiff);
  const graphLayout = useGitStore(s => s.graphLayout);
  const error = useGitStore(s => s.error);
  const selectedProject = useGitStore(s => s.selectedProject);

  const commitMeta = useMemo(
    () => graphLayout?.find(c => c.hash === selectedCommit) ?? null,
    [graphLayout, selectedCommit]
  );

  const files = useMemo(() => commitDiff?.files || [], [commitDiff]);

  const { totalAdds, totalDels } = useMemo(() => ({
    totalAdds: files.reduce((a, f) => a + f.adds, 0),
    totalDels: files.reduce((a, f) => a + f.dels, 0)
  }), [files]);

  if (!selectedCommit) return null;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[var(--bg-base)]">
      {/* Header / Metadata */}
      {commitMeta && (
        <div className="p-4 flex-shrink-0 space-y-4 bg-[var(--bg-surface)]/20 border-b border-border">
          <div className="space-y-2">
            <motion.div
              layout
              className="relative overflow-hidden"
              animate={{ height: msgExpanded || (commitMeta.message?.length ?? 0) <= 160 ? 'auto' : 48 }}
            >
              <h1 className="text-[15.5px] font-bold text-[var(--text-primary)] opacity-90 leading-snug whitespace-pre-wrap selection:bg-[var(--git-accent)]/30">
                {commitMeta.message || ''}
              </h1>
              {!msgExpanded && (commitMeta.message?.length ?? 0) > 160 && (
                <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-[var(--bg-base)] to-transparent pointer-events-none" />
              )}
            </motion.div>
            
            {(commitMeta.message?.length ?? 0) > 160 && (
              <button
                onClick={() => setMsgExpanded(!msgExpanded)}
                className="text-[10px] font-bold text-[var(--git-accent)] hover:underline uppercase tracking-widest"
              >
                {msgExpanded ? 'Collapse' : 'Expand full message'}
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-y-3 gap-x-6 pt-2">
            <div className="flex items-center gap-2.5">
              <Avatar name={commitMeta.author} email={commitMeta.email} />
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-[var(--text-primary)] opacity-90 truncate leading-none">{commitMeta.author}</p>
                <div className="flex items-center min-w-0">
                  <Tooltip label={commitMeta.email || ''}>
                    <p className="text-[12px] text-[var(--text-secondary)] leading-normal opacity-60 truncate">
                      {(() => {
                        if (!commitMeta.email) return '—';
                        const clean = commitMeta.email.replace(/^\d+\+/, '');
                        if (clean.length <= 24) return clean;
                        
                        const atIdx = clean.indexOf('@');
                        if (atIdx === -1) return clean.slice(0, 21) + '...';
                        
                        const local = clean.slice(0, atIdx);
                        const domain = clean.slice(atIdx);
                        const maxLocal = 24 - domain.length - 3;
                        
                        if (maxLocal > 0) {
                          return local.slice(0, maxLocal) + '...' + domain;
                        }
                        return clean.slice(0, 22) + '...';
                      })()}
                    </p>
                  </Tooltip>
                  {commitMeta.email && (
                    <Tooltip label="Copy email">
                      <button 
                        onClick={() => copyToClipboard(commitMeta.email.replace(/^\d+\+/, ''))} 
                        className="p-1.5 hover:text-[var(--git-accent)] transition-colors opacity-40 hover:opacity-100"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </Tooltip>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 ml-auto">
              <div className="text-right">
                {(() => {
                  const dateStr = commitMeta.date || '';
                  const d = new Date(dateStr);
                  const isValid = !isNaN(d.getTime());
                  
                  if (!isValid) return <p className="text-[13px] font-mono text-[var(--text-secondary)] leading-none mb-1">—</p>;
                  
                  const now = new Date();
                  const diffMs = now - d;
                  const isRecent = diffMs < 24 * 60 * 60 * 1000;
                  
                  // Extract timezone from raw string (e.g. "+0700" -> "U+7")
                  const tzMatch = dateStr.match(/([+-])(\d{2})(\d{1,2})$/);
                  const tz = tzMatch ? `U${tzMatch[1]}${parseInt(tzMatch[2])}` : 'U+0';
                  
                  const formatClean = (date) => {
                    return date.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false
                    }) + ` ${tz}`;
                  };
                  
                  const getRelative = (ms) => {
                    const sec = Math.floor(ms / 1000);
                    if (sec < 60) return 'just now';
                    const min = Math.floor(sec / 60);
                    if (min < 60) return `${min}m ago`;
                    const hr = Math.floor(min / 60);
                    if (hr < 24) return `${hr}h ago`;
                    const days = Math.floor(hr / 24);
                    return `${days}d ago`;
                  };
                  
                  const display = isRecent ? getRelative(diffMs) : formatClean(d);
                  const tooltip = isRecent ? formatClean(d) : getRelative(diffMs);
                  
                  return (
                    <Tooltip label={tooltip} contentClassName="text-[12px] px-3 py-2">
                      <p className="text-[13px] font-mono text-[var(--text-secondary)] leading-none mb-1">
                        {display}
                      </p>
                    </Tooltip>
                  );
                })()}
                <div className="flex items-center justify-end gap-1.5 text-[12px] font-mono opacity-80">
                  <Tooltip label={selectedCommit} contentClassName="font-mono text-[11px]">
                    <span className="text-[var(--git-accent)]">{selectedCommit.slice(0, 8)}</span>
                  </Tooltip>
                  <Tooltip label="Copy hash">
                    <button onClick={() => copyToClipboard(selectedCommit)} className="p-1.5 hover:text-[var(--git-accent)] transition-colors">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </Tooltip>
                </div>
              </div>
            </div>
          </div>

          {files.length > 0 && (
            <div className="flex items-center gap-3 pt-2 text-[10px] font-bold uppercase tracking-widest border-t border-border/20 mt-2 text-[var(--text-secondary)]">
              <span>{files.length} Changed File{files.length !== 1 ? 's' : ''}</span>
              <div className="flex gap-2 ml-auto">
                {totalAdds > 0 && <span className="text-green-500 text-[12px]">+{totalAdds}</span>}
                {totalDels > 0 && <span className="text-red-500 text-[12px]">-{totalDels}</span>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* File List */}
      <div className="flex-1 overflow-y-auto min-h-0 scrollbar-none">
        {error?.action === 'commit-diff' ? (
          <div className="h-40 flex flex-col items-center justify-center gap-2">
            <div className="text-[10px] font-bold tracking-[0.2em] text-red-500 uppercase">Error loading commit</div>
            <div className="text-[9px] text-[var(--text-secondary)] font-mono px-6 text-center">{error.message}</div>
          </div>
        ) : commitDiff === null ? (
          <div className="h-40 flex items-center justify-center">
            <div className="text-[10px] font-bold tracking-[0.2em] text-[var(--text-secondary)] uppercase animate-pulse opacity-40">Loading changes…</div>
          </div>
        ) : files.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center gap-4 text-center opacity-40">
             <div className="w-12 h-12 rounded-full border-2 border-dashed border-[var(--text-secondary)] flex items-center justify-center text-xl font-thin">∅</div>
             <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-[0.2em]">No lines were modified</p>
          </div>
        ) : (
          <div className="pb-12">
            {files.map(f => (
              <FileDiffRow key={`${selectedCommit}-${f.filePath}`} file={f} commitHash={selectedCommit} selectedProject={selectedProject} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
