/**
 * GitPanelV2.jsx — Root orchestrator of the redesigned Git panel.
 *
 * Responsibilities:
 *  1. Initialize the Zustand store with the current project
 *  2. Create and manage the Web Worker (graphWorker.js) for lane layout
 *  3. Subscribe to WebSocket GIT_STATUS_CHANGED events → debounced re-fetch
 *  4. Render: SplitPane(LeftPane, RightPane)
 */
import React, { useEffect, useRef, useCallback } from 'react';
import { useGitStore } from '../../hooks/gitStore';
import SplitPane from './SplitPane';
import LeftPane from './LeftPane';
import RightPane from './RightPane';

export default function GitPanelV2({ project, ws }) {
  // Zustand actions (reference stable across renders)
  const initProject = useGitStore(s => s.initProject);
  const setWorker = useGitStore(s => s.setWorker);
  const setGraphLayout = useGitStore(s => s.setGraphLayout);
  const fetchStatus = useGitStore(s => s.fetchStatus);
  const fetchRemoteStatus = useGitStore(s => s.fetchRemoteStatus);
  const fetchGraph = useGitStore(s => s.fetchGraph);

  const workerRef = useRef(null);
  const debounceRef = useRef(null);

  // ── 1. Init store whenever project changes ───────────────────────────────
  useEffect(() => {
    if (!project) return;
    initProject(project);
  }, [project, initProject]);  // keyed on name to avoid object identity re-init

  // ── 2. Web Worker lifecycle ──────────────────────────────────────────────
  useEffect(() => {
    const worker = new Worker(new URL('../../workers/graphWorker.js', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    setWorker(worker);

    worker.onmessage = ({ data }) => {
      if (data.success) {
        setGraphLayout(data.layout);
      } else {
        console.error('Graph worker error:', data.error);
      }
    };

    worker.onerror = (error) => {
      console.error('Graph worker crashed:', error);
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
      setWorker(null);
    };
  }, [setWorker, setGraphLayout]);

  // ── 3. WebSocket GIT_STATUS_CHANGED listener ─────────────────────────────
  const handleWsMessage = useCallback((event) => {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }

    if (msg.type === 'GIT_STATUS_CHANGED') {
      // Only respond if this event is for our project
      if (project && msg.project !== project.name) return;

      // Debounce to absorb bursts during commits/checkouts
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        fetchStatus();
        fetchRemoteStatus();
        fetchGraph(0);
      }, 500);
    }
  }, [project?.name, fetchStatus, fetchRemoteStatus, fetchGraph]);

  useEffect(() => {
    if (!ws) return;
    ws.addEventListener('message', handleWsMessage);
    return () => {
      ws.removeEventListener('message', handleWsMessage);
      clearTimeout(debounceRef.current);
    };
  }, [ws, handleWsMessage]);

  // ── 4. Render ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full w-full overflow-hidden" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <SplitPane
        left={<LeftPane />}
        right={<RightPane />}
        className="flex-1"
      />
    </div>
  );
}
