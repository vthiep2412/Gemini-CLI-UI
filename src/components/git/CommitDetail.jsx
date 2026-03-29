import React, { useMemo, useState } from 'react';
import { ChevronRight, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import Tooltip from '../common/Tooltip';

import { useGitStore } from '../../hooks/gitStore';
import MonacoDiffViewer from '../common/MonacoDiffViewer';
import { authenticatedFetch } from '../../utils/api';



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

function Avatar({ name }) {
  const initial = (name || '?').charAt(0).toUpperCase();
  return (
    <div className="w-8 h-8 rounded bg-[var(--git-accent)]/20 text-[var(--git-accent)] flex items-center justify-center font-bold text-[14px] flex-shrink-0">
      {initial}
    </div>
  );
}

function FileDiffRow({ file, commitHash, selectedProject }) {
  const [diffData, setDiffData] = useState(null);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [open, setOpen] = useState(false);
  
  const STATUS_CONFIG = { 
    M: 'bg-yellow-500/20 text-yellow-500', 
    A: 'bg-green-500/20 text-green-500', 
    D: 'bg-red-500/20 text-red-500', 
    R: 'bg-blue-500/20 text-blue-400' 
  };

  const handleExpand = async () => {
    if (!open && !diffData && commitHash && selectedProject) {
      setLoadingDiff(true);
      try {
        const res = await authenticatedFetch(`/api/git/commit-file-diff?project=${encodeURIComponent(selectedProject.name)}&commit=${commitHash}&file=${encodeURIComponent(file.filePath)}&oldPath=${encodeURIComponent(file.oldPath || file.filePath)}`);
        if (res.ok) {
          const data = await res.json();
          setDiffData(data);
        }
      } catch (e) {
        console.error('Failed to load file diff:', e);
      } finally {
        setLoadingDiff(false);
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
        className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[var(--bg-muted)]/40 text-xs transition-all
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
          <div className={`ml-2 transition-transform duration-300 ${open ? 'rotate-90 text-[var(--git-accent)]' : 'opacity-40'}`}>
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
            className="overflow-hidden bg-[var(--bg-base)]/30"
          >
            <div className="border-t border-border/40">
              <div className="flex items-center justify-between px-4 py-2 bg-[var(--bg-surface)]/10 border-b border-border/20">
                <span className="text-[9px] text-[var(--text-secondary)] font-mono truncate opacity-60 tracking-wider uppercase">{file.filePath}</span>
              </div>
              <div className="overflow-hidden shadow-inner">
                {loadingDiff ? (
                  <div className="p-4 text-center text-xs text-[var(--text-secondary)] animate-pulse">Loading diff...</div>
                ) : diffData ? (
                  <MonacoDiffViewer
                    original={diffData.originalContent || ''}
                    modified={diffData.modifiedContent || ''}
                    height="400px"
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
              <Avatar name={commitMeta.author} />
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-[var(--text-primary)] opacity-90 truncate leading-none mb-1">{commitMeta.author}</p>
                <p className="text-[11px] text-[var(--text-secondary)] truncate leading-normal opacity-60">{commitMeta.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 ml-auto">
              <div className="text-right">
                <p className="text-[13px] font-mono text-[var(--text-secondary)] leading-none mb-1">
                  {commitMeta.date || '—'}
                </p>
                <div className="flex items-center justify-end gap-1.5 text-[12px] font-mono opacity-80">
                  <span className="text-[var(--git-accent)]">{selectedCommit.slice(0, 8)}</span>
                  <Tooltip label="Copy commit hash">
                    <button onClick={() => copyToClipboard(selectedCommit)} className="p-0.5 hover:text-[var(--git-accent)] transition-colors">
                      <Copy className="w-3 h-3" />
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
        {commitDiff === null ? (
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
