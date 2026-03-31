/**
 * gitStore.js — Zustand atomic state manager for Git panel
 *
 * Components subscribe to ONLY their slice:
 *   const gitStatus = useGitStore(s => s.gitStatus);   // FileTree
 *   const commitMessage = useGitStore(s => s.commitMessage); // CommitInput
 *   const graphLayout = useGitStore(s => s.graphLayout);  // GraphRenderer
 *
 * This prevents catastrophic cross-component re-renders on every keystroke.
 */
import { create } from 'zustand';
import { authenticatedFetch } from '../utils/api';
import { toast } from 'sonner';

export const useGitStore = create((set, get) => ({
  // ── State slices ────────────────────────────────────────────────────────────
  selectedProject: null,      // Set externally by parent
  gitStatus: null,            // { branch, modified[], added[], deleted[], untracked[], conflicts[] }
  branches: [],               // string[]
  currentBranch: '',
  remoteStatus: null,         // { hasRemote, ahead, behind, isUpToDate, remoteName }
  stagedFiles: new Set(),     // Set<string> — files checked for staging
  selectedFiles: new Set(),   // Set<string> — tracks expanded/active files locally
  gitDiff: {},                // { [filePath]: { original: string, modified: string } }
  graphData: [],              // raw commits from /api/git/graph
  graphLayout: [],            // computed by Web Worker
  graphTotal: 0,              // total commit count (for infinite scroll)
  graphSkip: 0,               // current skip offset
  selectedCommit: null,       // null = working tree, hash = viewing commit
  commitDiff: null,           // diff data for selectedCommit
  commitMessage: '',
  loadingState: {             // per-action booleans
    status: false,
    committing: false,
    pushing: false,
    pulling: false,
    fetching: false,
    generatingMessage: false,
    loadingGraph: false,
    isSwitching: false,
    isCreatingBranch: false,
    isRefreshing: false,
    discarding: false,
  },
  error: null,                // { action, message } for toast notifications

  // ── Helper to update loading flags atomically ────────────────────────────
  setLoading: (key, val) =>
    set(s => ({ loadingState: { ...s.loadingState, [key]: val } })),

  setError: (action, message) => set({ error: message ? { action, message } : null }),

  // ── Initialize for a project ────────────────────────────────────────────
  initProject: (project) => {
    set({ selectedProject: project, selectedCommit: null, commitMessage: '', graphData: [], graphLayout: [], graphSkip: 0, gitDiff: {}, error: null });
    const { fetchStatus, fetchBranches, fetchRemoteStatus, fetchGraph } = get();
    fetchStatus();
    fetchBranches();
    fetchRemoteStatus();
    fetchGraph(0);
  },

  // ── Fetch git status ─────────────────────────────────────────────────────
  fetchStatus: async () => {
    const { selectedProject, setLoading, setError } = get();
    if (!selectedProject) return;
    setLoading('status', true);
    try {
      const res = await authenticatedFetch(`/api/git/status?project=${encodeURIComponent(selectedProject.name)}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      if (data.error) {
        set({ gitStatus: { error: data.error, details: data.details } });
      } else {
        set({ gitStatus: data, currentBranch: data.branch || 'main' });

        // Sync stagedFiles Set with actual Git index status
        const actuallyStaged = new Set(
          (data.files || [])
            .filter(f => f.isStaged)
            .map(f => f.path)
        );
        set({ stagedFiles: actuallyStaged });

        // Sync selectedFiles: remove files that are no longer in the change list
        const currentFiles = new Set((data.files || []).map(f => f.path));
        const nextSelected = new Set(get().selectedFiles);
        nextSelected.forEach(f => { if (!currentFiles.has(f)) nextSelected.delete(f); });
        set({ selectedFiles: nextSelected });

        // Pre-fetch diffs for all changed files in small batches to avoid overloading the browser/server
        const files = data.files || [];
        const BATCH_SIZE = 5;
        (async () => {
          for (let i = 0; i < files.length; i += BATCH_SIZE) {
            const batch = files.slice(i, i + BATCH_SIZE);
            await Promise.allSettled(batch.map(f => get().fetchFileDiff(f.path)));
          }
        })();
      }
    } catch (e) {
      setError('status', e.message);
    } finally {
      setLoading('status', false);
    }
  },

  fetchBranches: async () => {
    const { selectedProject } = get();
    if (!selectedProject) return;
    try {
      const res = await authenticatedFetch(`/api/git/branches?project=${encodeURIComponent(selectedProject.name)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const data = await res.json();
      if (!data.error) set({ branches: data.branches || [] });
    } catch (e) { console.warn('fetchBranches failed:', e); }
  },

  fetchRemoteStatus: async () => {
    const { selectedProject } = get();
    if (!selectedProject) return;
    try {
      const res = await authenticatedFetch(`/api/git/remote-status?project=${encodeURIComponent(selectedProject.name)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const data = await res.json();
      set({ remoteStatus: data.error ? null : data });
    } catch (_) {}
  },

  fetchFileDiff: async (filePath, signal) => {
    const { selectedProject } = get();
    if (!selectedProject) return;
    const projAtStart = selectedProject.name;
    try {
      const res = await authenticatedFetch(
        `/api/git/diff?project=${encodeURIComponent(selectedProject.name)}&file=${encodeURIComponent(filePath)}`,
        { signal }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const data = await res.json();

      // Stale check: ensure project hasn't changed since we started fetching
      if (!data.error && get().selectedProject?.name === projAtStart) {
        set(s => ({ gitDiff: { ...s.gitDiff, [filePath]: { original: data.originalContent, modified: data.modifiedContent } } }));
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.warn('fetchFileDiff failed:', e);
      }
    }
  },

  // ── Commit graph ─────────────────────────────────────────────────────────
  fetchGraph: async (skip = 0) => {
    const { selectedProject, setLoading } = get();
    if (!selectedProject) return;
    const projAtStart = selectedProject.name;
    setLoading('loadingGraph', true);
    try {
      const res = await authenticatedFetch(
        `/api/git/graph?project=${encodeURIComponent(selectedProject.name)}&limit=200&skip=${skip}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const data = await res.json();

      // Stale check
      if (!data.error && get().selectedProject?.name === projAtStart) {
        const combined = skip === 0 ? data.commits : [...get().graphData, ...data.commits];
        set({ graphData: combined, graphTotal: data.total, graphSkip: skip });
        // Dispatch to Web Worker for layout
        get()._dispatchToWorker(combined);
      }
    } catch (_) {}
    finally { setLoading('loadingGraph', false); }
  },

  // Worker reference — set once by GitPanelV2
  _worker: null,
  setWorker: (worker) => set({ _worker: worker }),
  _dispatchToWorker: (commits) => {
    const { _worker } = get();
    if (_worker) _worker.postMessage(commits);
  },
  setGraphLayout: (layout) => set({ graphLayout: layout }),

  // ── Select a commit in the graph ─────────────────────────────────────────
  selectCommit: async (hash) => {
    // Clear state when deselecting or selecting a new commit
    set({ selectedCommit: hash, commitDiff: null });
    if (!hash) return;

    const { selectedProject, setError } = get();
    if (!selectedProject) return;

    try {
      const res = await authenticatedFetch(
        `/api/git/commit-diff?project=${encodeURIComponent(selectedProject.name)}&commit=${hash}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const data = await res.json();

      if (data.error) {
        set({ commitDiff: null });
        setError('commit-diff', data.error);
      } else {
        set({ commitDiff: data });
      }
    } catch (e) {
      set({ commitDiff: null });
      setError('commit-diff', e.message);
    }
  },

  // ── Stage / Unstage ──────────────────────────────────────────────────────
  toggleFileStaged: (filePath) =>
    set(s => {
      const next = new Set(s.stagedFiles);
      next.has(filePath) ? next.delete(filePath) : next.add(filePath);
      return { stagedFiles: next };
    }),

  stageFiles: async (files) => {
    const { selectedProject, fetchStatus, setError, setLoading, loadingState } = get();
    if (!selectedProject) return;
    if (loadingState.staging) return;
    setLoading('staging', true);
    try {
      const res = await authenticatedFetch('/api/git/stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: selectedProject.name, files })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      fetchStatus();
    } catch (e) {
      setError('stage', e.message);
    } finally {
      setLoading('staging', false);
    }
  },

  unstageFiles: async (files) => {
    const { selectedProject, fetchStatus, setError, setLoading, loadingState } = get();
    if (!selectedProject) return;
    if (loadingState.unstaging) return;
    setLoading('unstaging', true);
    try {
      const res = await authenticatedFetch('/api/git/unstage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: selectedProject.name, files })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      fetchStatus();
    } catch (e) {
      setError('unstage', e.message);
    } finally {
      setLoading('unstaging', false);
    }
  },

  // ── Commit ───────────────────────────────────────────────────────────────
  setCommitMessage: (msg) => set({ commitMessage: msg }),

  commit: async () => {
    const { selectedProject, commitMessage, stagedFiles, setLoading, setError, fetchStatus, fetchRemoteStatus, fetchGraph } = get();
    if (!commitMessage.trim() || stagedFiles.size === 0) return false;
    setLoading('committing', true);
    try {
      const res = await authenticatedFetch('/api/git/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: selectedProject.name, message: commitMessage, files: [...stagedFiles] })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const data = await res.json();
      if (data.success) {
        set({ commitMessage: '', stagedFiles: new Set() });
        fetchStatus(); fetchRemoteStatus(); fetchGraph(0);
        return true;
      }
      return false;
    } catch (e) {
      setError('commit', e.message);
      return false;
    }
    finally { setLoading('committing', false); }
  },

  getQuickCommitMessage: () => {
    const { gitStatus } = get();
    if (!gitStatus?.files?.length) return '';

    const hasStaged = gitStatus.files.some(f => f.isStaged);
    const filesToCommit = hasStaged
      ? gitStatus.files.filter(f => f.isStaged)
      : gitStatus.files;

    const added = filesToCommit.filter(f => f.status.includes('A') || f.status === '??' || f.status.includes('U'));
    const deleted = filesToCommit.filter(f => f.status.includes('D'));
    const changed = filesToCommit.filter(f => !f.status.includes('A') && f.status !== '??' && !f.status.includes('U') && !f.status.includes('D'));

    let summaryParts = [];
    if (changed.length) summaryParts.push(`Changed ${changed.length} file${changed.length > 1 ? 's' : ''}`);
    if (added.length) summaryParts.push(`add ${added.length} file${added.length > 1 ? 's' : ''}`);
    if (deleted.length) summaryParts.push(`delete ${deleted.length} file${deleted.length > 1 ? 's' : ''}`);

    if (summaryParts.length === 0) summaryParts.push(`update ${filesToCommit.length} files`);

    if (summaryParts.length > 0) {
      summaryParts[0] = summaryParts[0].charAt(0).toUpperCase() + summaryParts[0].slice(1);
    }

    const title = `feat: ${summaryParts.join(', and ')}.`;

    let body = [];
    if (changed.length) {
      body.push(`\nChanged File${changed.length > 1 ? 's' : ''}:`);
      changed.forEach(f => body.push(f.path));
    }
    if (added.length) {
      body.push(`\nAdded File${added.length > 1 ? 's' : ''}:`);
      added.forEach(f => body.push(f.path));
    }
    if (deleted.length) {
      body.push(`\nDeleted File${deleted.length > 1 ? 's' : ''}:`);
      deleted.forEach(f => body.push(f.path));
    }

    return `${title}\n${body.join('\n')}`.trim();
  },

  generateQuickCommitMessage: () => {
    const msg = get().getQuickCommitMessage();
    if (msg) set({ commitMessage: msg });
  },

  generateAICommitMessage: async () => {
    const { selectedProject, gitStatus, setLoading, setError } = get();
    const hasStaged = gitStatus?.files?.some(f => f.isStaged);
    const files = hasStaged
      ? gitStatus.files.filter(f => f.isStaged).map(f => f.path)
      : gitStatus?.files?.map(f => f.path) || [];
    if (!selectedProject || files.length === 0) return;
    setLoading('generatingMessage', true);
    try {
      const res = await authenticatedFetch('/api/git/generate-commit-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: selectedProject.name, files })
      });
      if (!res.ok) {
        let errMsg = `HTTP ${res.status}: ${res.statusText}`;
        try {
          const errData = await res.json();
          if (errData.error) errMsg = errData.error;
        } catch (_) {}
        throw new Error(errMsg);
      }
      const data = await res.json();
      if (data.message) set({ commitMessage: data.message });
    } catch (e) {
      setError('generateMessage', e.message);
      console.error('AI Commit Generation Error:', e);
      toast.error('AI commit generation failed (see console)');
    }
    finally { setLoading('generatingMessage', false); }
  },

  // ── Push / Pull / Fetch ───────────────────────────────────────────────────
  push: async () => {
    const { selectedProject, setLoading, fetchStatus, fetchRemoteStatus, loadingState, setError } = get();
    if (!selectedProject || loadingState.pushing) return { error: 'Operation in progress' };

    setLoading('pushing', true);
    setError('push', null);
    try {
      const res = await authenticatedFetch('/api/git/push', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: selectedProject.name })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const data = await res.json();
      if (data.success) {
        fetchStatus();
        fetchRemoteStatus();
      } else {
        setError('push', data.error || 'Push failed');
      }
      return data;
    } catch (e) {
      setError('push', e.message);
      return { error: e.message };
    }
    finally { setLoading('pushing', false); }
  },

  pull: async () => {
    const { selectedProject, setLoading, fetchStatus, fetchRemoteStatus, fetchGraph, loadingState, setError } = get();
    if (!selectedProject || loadingState.pulling) return { error: 'Operation in progress' };
    setLoading('pulling', true);
    setError('pull', null);
    try {
      const res = await authenticatedFetch('/api/git/pull', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: selectedProject.name })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const data = await res.json();
      if (data.success) {
        fetchStatus();
        fetchRemoteStatus();
        fetchGraph(0);
      } else {
        setError('pull', data.error || 'Pull failed');
      }
      return data;
    } catch (e) {
      setError('pull', e.message);
      return { error: e.message };
    }
    finally { setLoading('pulling', false); }
  },

  fetchRemote: async () => {
    const { selectedProject, setLoading, fetchRemoteStatus, loadingState, setError } = get();
    if (!selectedProject || loadingState.fetching) return { error: 'Operation in progress' };
    setLoading('fetching', true);
    setError('fetch', null);
    try {
      const res = await authenticatedFetch('/api/git/fetch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: selectedProject.name })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const data = await res.json();
      if (data.success) {
        fetchRemoteStatus();
      } else {
        setError('fetch', data.error || 'Fetch failed');
      }
      return data;
    } catch (e) {
      setError('fetch', e.message);
      return { error: e.message };
    }
    finally { setLoading('fetching', false); }
  },

  // ── Branch operations ─────────────────────────────────────────────────────
  switchBranch: async (branch) => {
    const { selectedProject, fetchStatus, fetchBranches, setLoading, loadingState, setError } = get();
    if (!selectedProject || loadingState.isSwitching) return { error: 'Operation in progress' };
    setLoading('isSwitching', true);
    setError('switchBranch', null);
    try {
      const res = await authenticatedFetch('/api/git/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: selectedProject.name, branch })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const data = await res.json();
      if (data.success) {
        set({ currentBranch: branch });
        fetchStatus();
        fetchBranches();
      } else {
        setError('switchBranch', data.error || 'Switch failed');
      }
      return data;
    } catch (e) {
      setError('switchBranch', e.message);
      return { error: e.message };
    } finally {
      setLoading('isSwitching', false);
    }
  },

  createBranch: async (branch) => {
    const { selectedProject, fetchStatus, fetchBranches, setLoading, loadingState, setError } = get();
    if (!selectedProject || loadingState.isCreatingBranch) return { error: 'Operation in progress' };
    setLoading('isCreatingBranch', true);
    setError('createBranch', null);
    try {
      const res = await authenticatedFetch('/api/git/create-branch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: selectedProject.name, branch })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const data = await res.json();
      if (data.success) {
        set({ currentBranch: branch });
        fetchStatus();
        fetchBranches();
      } else {
        setError('createBranch', data.error || 'Create branch failed');
      }
      return data;
    } catch (e) {
      setError('createBranch', e.message);
      return { error: e.message };
    } finally {
      setLoading('isCreatingBranch', false);
    }
  },

  // ── Discard changes ───────────────────────────────────────────────────────
  discardFile: async (filePath) => {
    const { selectedProject, fetchStatus, loadingState, setLoading } = get();
    if (!selectedProject) return { error: 'No project selected' };
    if (loadingState.discarding) return { error: 'Operation in progress' };

    setLoading('discarding', true);
    try {
      const res = await authenticatedFetch('/api/git/discard', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: selectedProject.name, file: filePath })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const data = await res.json();
      if (data.success) fetchStatus();
      return data;
    } catch (e) {
      return { error: e.message };
    } finally {
      setLoading('discarding', false);
    }
  },

  // ── Unified Sync & Commit ──────────────────────────────────────────────
  syncAndCommit: async (overrideMessage) => {
    let { selectedProject, commitMessage, gitStatus, setLoading, fetchStatus, fetchRemoteStatus, fetchGraph } = get();
    if (!selectedProject || !gitStatus?.files?.length) return false;

    // Auto-generate quick message if empty
    let finalMessage = overrideMessage || commitMessage;
    if (!finalMessage || !finalMessage.trim()) {
      finalMessage = get().getQuickCommitMessage();
    }

    setLoading('committing', true);
    try {
      // 1. Determine staging strategy
      const hasStaged = gitStatus.files.some(f => f.isStaged);
      const allFilePaths = gitStatus.files.map(f => f.path);

      // If there are staged files, we DO NOT send files to /api/git/commit,
      // as providing files there triggers a forced `git add`. We want to simply commit the index.
      // If no staged files exist, we supply allFilePaths to auto-stage them before commit.
      const filesToCommit = hasStaged ? [] : allFilePaths;

      // 2. Commit
      const commitRes = await authenticatedFetch('/api/git/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: selectedProject.name, message: finalMessage, files: filesToCommit })
      });
      if (!commitRes.ok) throw new Error('Commit request failed');
      const commitData = await commitRes.json();
      if (!commitData.success) throw new Error(commitData.error || 'Commit failed');

      // 3. Pull
      setLoading('pulling', true);
      const pullRes = await authenticatedFetch('/api/git/pull', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: selectedProject.name })
      });
      if (pullRes.ok) {
        const pullData = await pullRes.json();
        if (pullData.error) console.warn('Pull warning during sync:', pullData.error);
      }

      // 4. Push
      setLoading('pushing', true);
      const pushRes = await authenticatedFetch('/api/git/push', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: selectedProject.name })
      });
      let pushWarning = null;
      if (!pushRes.ok) {
        pushWarning = 'Commit succeeded but push failed - changes are local only';
        console.warn('Push failed during sync');
      }

      set({ commitMessage: '', stagedFiles: new Set() });
      fetchStatus(); fetchRemoteStatus(); fetchGraph(0);
      return { success: true, warning: pushWarning };
    } catch (e) {
      set({ error: { action: 'syncAndCommit', message: e.message } });
      return false;
    } finally {
      setLoading('committing', false);
      setLoading('pulling', false);
      setLoading('pushing', false);
    }
  },
}));
