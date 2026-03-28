  /**
 * FileTree.jsx — Categorized file sections for the left pane.
 * Shows "Working Tree Changes" section for modified files.
 *
 * When selectedCommit is set, renders commit-view mode
 * showing that commit's file diffs (read-only).
 */
import React, { useMemo, useState, useEffect } from 'react';
import { GitBranch, ChevronDown, ChevronRight, File, Folder, Search, Filter } from 'lucide-react';
import Tooltip from '../common/Tooltip';
import { motion, AnimatePresence } from 'framer-motion';
import { useGitStore } from '../../hooks/gitStore';
import FileRow from './FileRow';

function Section({ title, icon, iconClass, count, children, defaultOpen = true, headerActions }) {
  const [open, setOpen] = useState(defaultOpen);
  if (!count) return null;
  return (
    <div className="last:border-0 overflow-hidden border-b border-border/30">
      <div
        role="button"
        tabIndex={0}
        className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-bold tracking-widest uppercase text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]/50 hover:text-[var(--text-primary)] transition-all group cursor-pointer outline-none border-b border-border/10"
        onClick={() => setOpen(v => !v)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(v => !v); } }}
      >
        <div className={`transition-transform duration-300 transform-gpu ${open ? 'rotate-90' : ''}`}>
          <ChevronRight className="w-3.5 h-3.5 text-[var(--text-secondary)] group-hover:text-[var(--git-accent)]" />
        </div>
        {icon && <span className={iconClass}>{icon}</span>}
        <span className="flex-1 text-left tracking-tight">{title}</span>
        <span className="px-1.5 py-0.5 rounded-full bg-[var(--bg-muted)] text-[var(--text-primary)] font-mono text-[9px] group-hover:scale-105 transition-all">
          {count}
        </span>
        {headerActions && <div className="ml-auto flex items-center gap-2" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>{headerActions}</div>}
      </div>
      
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.04, 0.62, 0.23, 0.98] }}
            className="overflow-hidden"
          >
            <div className="pb-2">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Parse a unified diff string into per-file chunks
function parseCommitDiffToFiles(diffStr) {
  if (!diffStr) return [];
  const chunks = [];
  let current = null;
  diffStr.split('\n').forEach(line => {
    if (line.startsWith('diff --git ')) {
      if (current) chunks.push(current);
      // Extract filename robustly from "diff --git a\/.+ b\/.+" (handles greedy matches for " b/")
      const match = line.match(/^diff --git a\/(.+) b\/(.+)$/);
      let filePath;
      if (match) {
        filePath = match[2];
      } else {
        const idx = line.lastIndexOf(' b/');
        filePath = idx >= 0 ? line.slice(idx + 3) : line.replace(/^diff --git /, '');
      }
      filePath = filePath.replace(/^["']|["']$/g, '').trim(); 
      current = { filePath, status: 'M', lines: [] };
    } else if (current) {
      if (line.startsWith('new file')) current.status = 'A';
      else if (line.startsWith('deleted file')) current.status = 'D';
      else if (line.startsWith('rename to')) current.status = 'R';
      current.lines.push(line);
    }
  });
  if (current) chunks.push(current);
  return chunks.map(c => ({ ...c, diff: c.lines.join('\n') }));
}

export default function FileTree() {
  const gitStatus = useGitStore(s => s.gitStatus);
  const selectedCommit = useGitStore(s => s.selectedCommit);
  const commitDiff = useGitStore(s => s.commitDiff);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // ── Hooks must be at the top level, unconditional ────────────────────────
  const commitFiles = useMemo(() => {
    if (!selectedCommit) return [];
    return parseCommitDiffToFiles(commitDiff);
  }, [selectedCommit, commitDiff]);

  const stagedFiles = useMemo(() => {
    if (selectedCommit) return [];
    return gitStatus?.files?.filter(f => f.isStaged) || [];
  }, [selectedCommit, gitStatus]);

  const unstagedFiles = useMemo(() => {
    if (selectedCommit) return [];
    return gitStatus?.files?.filter(f => f.isUnstaged) || [];
  }, [selectedCommit, gitStatus]);

  const filesToRender = useMemo(() => {
    if (selectedCommit) return commitFiles;
    return [...stagedFiles, ...unstagedFiles];
  }, [selectedCommit, commitFiles, stagedFiles, unstagedFiles]);

  // Clamp focusedIndex when filesToRender changes
  useEffect(() => {
    setFocusedIndex(prev => {
      if (filesToRender.length === 0) return -1;
      if (prev >= filesToRender.length) return filesToRender.length - 1;
      return prev;
    });
  }, [filesToRender]);


  const handleKeyDown = (e) => {
    if (filesToRender.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(prev => Math.min(prev + 1, filesToRender.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setFocusedIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setFocusedIndex(filesToRender.length - 1);
    }
  };

  // ── Commit view mode ──────────────────────────────────────────────────────
  if (selectedCommit) {
    return (
      <div 
        className="flex-1 overflow-y-auto min-h-0 bg-[var(--bg-base)] custom-scrollbar outline-none"
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        {/* Simple Label */}
        <div className="px-3 py-2 bg-[var(--accent)]/5 border-b border-border/30">
          <span className="text-[10px] text-[var(--accent)] font-bold uppercase tracking-wider">
            Viewing Commit: <span className="font-mono">
              {(() => {
                const hash = typeof selectedCommit === 'string' 
                  ? selectedCommit 
                  : (selectedCommit?.hash || selectedCommit?.sha || selectedCommit?.id || '');
                return String(hash).slice(0, 7) || 'unknown';
              })()}
            </span>
          </span>
        </div>
        {commitFiles.length === 0 && (
          <div className="p-8 text-xs text-[var(--text-secondary)] font-mono text-center">
            {commitDiff === null ? 'Loading diff…' : 'No file changes in this commit'}
          </div>
        )}
        <div className="">
          {commitFiles.map((f, i) => (
            <FileRow
              key={f.filePath}
              filePath={f.filePath}
              status={f.status}
              mode="commit-view"
              commitDiffChunk={f.diff}
              isFocused={focusedIndex === i}
            />
          ))}
        </div>
      </div>
    );
  }

  // ── Working tree mode ─────────────────────────────────────────────────────
  if (!gitStatus || gitStatus.error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 text-center bg-[var(--bg-base)]">
        <div className="text-4xl mb-3 opacity-20 text-[var(--accent)]">⎇</div>
        <p className="text-sm font-medium text-[var(--text-primary)] mb-1">
          {gitStatus?.error || 'No repository'}
        </p>
        <p className="text-xs text-[var(--text-secondary)] max-w-[200px]">
          {gitStatus?.details || 'Select a project with a git repository'}
        </p>
      </div>
    );
  }

  if (!selectedCommit && filesToRender.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 text-center bg-[var(--bg-base)]">
        <div className="text-3xl mb-3 opacity-30 text-green-500">✓</div>
        <p className="text-sm text-[var(--text-primary)]">Working tree clean</p>
        <p className="text-xs text-[var(--text-secondary)] mt-1">No changes to commit</p>
      </div>
    );
  }

  return (
    <div 
      className="flex-1 overflow-y-auto min-h-0 py-1 bg-[var(--bg-surface)] scrollbar-none outline-none"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <Section
        title="Staged Changes"
        count={stagedFiles.length}
        defaultOpen
      >
        {stagedFiles.map((f, i) => (
          <FileRow 
            key={`staged-${f.path}`} 
            filePath={f.path} 
            status={f.status?.trim() ?? ''}
            mode="changes"
            section="staged"
            isFocused={focusedIndex === i}
          />
        ))}
      </Section>
      <Section
        title="Unstaged Changes"
        count={unstagedFiles.length}
        defaultOpen
      >
        {unstagedFiles.map((f, i) => (
          <FileRow 
            key={`unstaged-${f.path}`} 
            filePath={f.path} 
            status={f.status?.trim() ?? ''}
            mode="changes"
            section="unstaged"
            isFocused={focusedIndex === i + stagedFiles.length}
          />
        ))}
      </Section>
    </div>
  );
}
