import React, { useState, useRef, useEffect } from 'react';
import {
  GitBranch, CloudDownload, ArrowDown, ArrowUp, RefreshCw,
  ChevronDown, Check, Plus, AlertTriangle, X, ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGitStore } from '../../hooks/gitStore';
import { useTheme } from '../../contexts/ThemeContext';
import Tooltip from '../common/Tooltip';

export default function BranchBar() {
  const { isDarkMode } = useTheme();
  const branches = useGitStore(s => s.branches);
  const currentBranch = useGitStore(s => s.currentBranch);
  const remoteStatus = useGitStore(s => s.remoteStatus);
  const loadingState = useGitStore(s => s.loadingState);
  const switchBranch = useGitStore(s => s.switchBranch);
  const createBranch = useGitStore(s => s.createBranch);
  const push = useGitStore(s => s.push);
  const pull = useGitStore(s => s.pull);
  const fetchRemote = useGitStore(s => s.fetchRemote);
  const fetchStatus = useGitStore(s => s.fetchStatus);
  const fetchBranches = useGitStore(s => s.fetchBranches);
  const fetchRemoteStatus = useGitStore(s => s.fetchRemoteStatus);
  const gitStatus = useGitStore(s => s.gitStatus);
  const selectedCommit = useGitStore(s => s.selectedCommit);
  const selectCommit = useGitStore(s => s.selectCommit);
  const hoverBgClass = isDarkMode ? 'hover:bg-[var(--bg-muted)]' : 'hover:bg-slate-200/60';

  const [showDropdown, setShowDropdown] = useState(false);
  const [showNewBranch, setShowNewBranch] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [branchSearch, setBranchSearch] = useState('');
  const [creatingBranch, setCreatingBranch] = useState(false);
  const dropdownRef = useRef(null);

  const isDetachedHead = gitStatus?.branch === 'HEAD' || currentBranch === 'HEAD';

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
        setBranchSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleRefresh = async () => {
    try {
      await Promise.all([fetchStatus(), fetchBranches(), fetchRemoteStatus()]);
    } catch (error) {
      console.error('Failed to refresh:', error);
    }
  };

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) return;
    setCreatingBranch(true);
    try {
      await createBranch(newBranchName.trim());
      setNewBranchName('');
      setShowNewBranch(false);
    } catch (error) {
      // TODO: Consider showing error to user (e.g., via toast or inline message)
      console.error('Failed to create branch:', error);
    } finally {
      setCreatingBranch(false);
    }
  };

  const handleSwitchBranch = async (branch) => {
    if (branch === currentBranch) {
      setShowDropdown(false);
      return;
    }
    try {
      await switchBranch(branch);
      setShowDropdown(false);
      setBranchSearch('');
    } catch (error) {
      console.error('Failed to switch branch:', error);
      // Consider: show error toast, or close dropdown anyway
      setShowDropdown(false);
      setBranchSearch('');
    }
  };

  const handlePull = async () => {
    try { await pull(); } catch (e) { console.error('Pull failed:', e); }
  };

  const handlePush = async () => {
    try { await push(); } catch (e) { console.error('Push failed:', e); }
  };

  const handleFetch = async () => {
    try { await fetchRemote(); } catch (e) { console.error('Fetch failed:', e); }
  };

  const filteredBranches = branchSearch
    ? branches.filter(b => b.toLowerCase().includes(branchSearch.toLowerCase()))
    : branches;

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 h-[3.3rem] bg-[var(--bg-base)] flex-shrink-0 transition-colors border-b border-border">
      {/* Back to Working Tree button */}
      <div 
        className={`flex items-center transition-all duration-300 ease-in-out ${
          selectedCommit 
            ? 'w-20 opacity-100 translate-x-0' 
            : 'w-0 opacity-0 -translate-x-3 pointer-events-none'
        }`}
      >
        <button
          onClick={() => selectCommit(null)}
          tabIndex={selectedCommit ? 0 : -1}
          aria-hidden={!selectedCommit}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-sm bg-transparent text-[10px] font-bold text-[var(--git-accent)] transition-all active:scale-95 whitespace-nowrap uppercase tracking-tighter
            ${hoverBgClass}`}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </button>
      </div>

      {/* Branch selector */}
      <div className="relative flex-1 min-w-0" ref={dropdownRef}>
        <button
          onClick={() => setShowDropdown(v => !v)}
          aria-haspopup="listbox"
          aria-expanded={showDropdown}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-sm max-w-full
            ${hoverBgClass} transition-colors
            ${isDetachedHead ? 'text-orange-400' : 'text-[var(--text-primary)]'}`}
        >
          {isDetachedHead
            ? <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 text-orange-400" />
            : <GitBranch className="w-5 h-5 flex-shrink-0 text-[var(--git-accent)]" />}
          <span className="font-mono text-xs font-semibold truncate max-w-[120px]">
            {isDetachedHead ? `DETACHED HEAD` : currentBranch}
          </span>
          {/* Remote ahead/behind badges */}
          {remoteStatus?.hasRemote && (
            <span className="flex items-center gap-0.5 text-[10px] ml-0.5 mt-0.5">
              {remoteStatus.ahead > 0 && (
                <Tooltip label={`${remoteStatus.ahead} commits ahead of remote`}>
                  <span className="flex items-center gap-1 text-green-500">
                    <ArrowUp className="w-3.5 h-3.5" />
                    <span className="font-mono">{remoteStatus.ahead}</span>
                  </span>
                </Tooltip>
              )}
              {remoteStatus.behind > 0 && (
                <Tooltip label={`${remoteStatus.behind} commits behind remote`}>
                  <span className="flex items-center gap-1 text-blue-500">
                    <ArrowDown className="w-3.5 h-3.5" />
                    <span className="font-mono">{remoteStatus.behind}</span>
                  </span>
                </Tooltip>
              )}
              {remoteStatus.isUpToDate && (
                <Tooltip label="Up to date with remote">
                  <Check className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                </Tooltip>
              )}
            </span>
          )}
          <ChevronDown className={`w-3 h-3 flex-shrink-0 text-[var(--text-secondary)] transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
        </button>

        {/* Branch dropdown */}
        <AnimatePresence>
          {showDropdown && (
            <motion.div 
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              role="listbox"
              id="branch-selector-listbox"
              className="absolute top-full left-0 mt-1 w-64 bg-[var(--bg-surface)] rounded-lg shadow-2xl z-[60] overflow-hidden border border-border/50"
              style={{ filter: "drop-shadow(0px 10px 40px rgba(0, 0, 0, 0.3))" }}
            >
              {/* Search */}
              <div className="p-2 border-b border-border/40">
                <input
                  autoFocus
                  value={branchSearch}
                  onChange={e => setBranchSearch(e.target.value)}
                  placeholder="Search branches..."
                  className="w-full bg-[var(--bg-base)] rounded px-2 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-secondary)] outline-none focus:ring-1 focus:ring-[var(--git-accent)]/30 transition-all font-medium"
                />
              </div>
              <div className="max-h-48 overflow-y-auto py-1">
                {filteredBranches.map(branch => (
                  <button
                    key={branch}
                    role="option"
                    aria-selected={branch === currentBranch}
                    onClick={() => handleSwitchBranch(branch)}
                    disabled={loadingState.isSwitching}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left ${hoverBgClass} transition-colors group disabled:opacity-50
                      ${branch === currentBranch ? 'text-[var(--accent)] bg-[var(--accent)]/5' : 'text-[var(--text-primary)]'}`}
                  >
                    <div className="w-4 flex items-center justify-center">
                      {branch === currentBranch ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <GitBranch className="w-3.5 h-3.5 opacity-0 group-hover:opacity-40" />
                      )}
                    </div>
                    <span className={`font-mono truncate ${branch === currentBranch ? 'font-bold' : ''}`}>{branch}</span>
                  </button>
                ))}
                {filteredBranches.length === 0 && (
                  <p className="px-3 py-4 text-xs text-[var(--text-secondary)] text-center italic">No branches found</p>
                )}
              </div>
              <div className="p-1 border-t border-border/40 bg-[var(--bg-muted)]/30">
                {!showNewBranch ? (
                  <button
                    onClick={() => setShowNewBranch(true)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] ${hoverBgClass} rounded transition-colors group`}
                  >
                    <Plus className="w-3.5 h-3.5 group-hover:text-[var(--git-accent)] transition-colors" />
                    <span>Create new branch</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1 p-1">
                    <input
                      autoFocus
                      value={newBranchName}
                      onChange={e => setNewBranchName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleCreateBranch(); if (e.key === 'Escape') setShowNewBranch(false); }}
                      placeholder="branch-name"
                      className="flex-1 bg-[var(--bg-base)] border border-border/60 rounded px-2 py-1.5 text-xs font-mono text-[var(--text-primary)] placeholder-[var(--text-secondary)] outline-none focus:border-[var(--git-accent)]/50 transition-all font-semibold"
                    />
                    <button
                      onClick={handleCreateBranch}
                      disabled={creatingBranch || !newBranchName.trim()}
                      className="p-1.5 rounded bg-[var(--git-accent)] text-white hover:opacity-90 disabled:opacity-40 transition-colors shadow-lg shadow-[var(--git-accent)]/20"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setShowNewBranch(false)} className={`p-1.5 rounded ${hoverBgClass} transition-colors`}>
                      <X className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Remote action buttons */}
      <div className="flex items-center gap-0.5 ml-auto flex-shrink-0">
        {remoteStatus?.hasRemote && remoteStatus.behind > 0 && (
          <Tooltip label={`Pull ${remoteStatus.behind} commit${remoteStatus.behind !== 1 ? 's' : ''}`}>
            <button
              onClick={handlePull}
              disabled={loadingState.pulling}
              className="p-1.5 rounded text-blue-500 hover:bg-blue-500/10 disabled:opacity-40 transition-colors"
            >
              <ArrowDown className={`w-3.5 h-3.5 ${loadingState.pulling ? 'animate-bounce' : ''}`} />
            </button>
          </Tooltip>
        )}
        {remoteStatus?.hasRemote && remoteStatus.ahead > 0 && (
          <Tooltip label={`Push ${remoteStatus.ahead} commit${remoteStatus.ahead !== 1 ? 's' : ''}`}>
            <button
              onClick={handlePush}
              disabled={loadingState.pushing}
              className="p-1.5 rounded text-green-500 hover:bg-green-500/10 disabled:opacity-40 transition-colors"
            >
              <ArrowUp className={`w-3.5 h-3.5 ${loadingState.pushing ? 'animate-bounce' : ''}`} />
            </button>
          </Tooltip>
        )}
        {remoteStatus?.hasRemote && (
          <Tooltip label="Fetch from remote">
            <button
              onClick={handleFetch}
              disabled={loadingState.fetching}
              className={`p-1.5 rounded text-[var(--text-secondary)] ${hoverBgClass} disabled:opacity-40 transition-colors`}
            >
              <CloudDownload className={`w-3.5 h-3.5 ${loadingState.fetching ? 'animate-pulse' : ''}`} />
            </button>
          </Tooltip>
        )}
        <Tooltip label="Refresh">
          <button
            onClick={handleRefresh}
            disabled={loadingState.status}
            className={`p-1.5 rounded text-[var(--text-secondary)] ${hoverBgClass} disabled:opacity-40 transition-colors`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingState.status ? 'animate-spin' : ''}`} />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
