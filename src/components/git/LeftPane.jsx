/**
 * LeftPane.jsx — Left pane coordinator.
 * Shows BranchBar on top, then either:
 *   - CommitDetail (when a commit is selected via graph click), or
 *   - FileTree + CommitInput (normal working-tree view)
 */
import React from 'react';
import BranchBar from './BranchBar';
import FileTree from './FileTree';
import CommitInput from './CommitInput';
import CommitDetail from './CommitDetail';
import { useGitStore } from '../../hooks/gitStore';

export default function LeftPane() {
  const selectedCommit = useGitStore(s => s.selectedCommit);

  return (
    <div className="flex flex-col h-full bg-[var(--bg-base)] border-r border-border overflow-hidden">
      <BranchBar />
      <div className="flex-1 min-h-0 relative flex flex-col overflow-hidden">
        {selectedCommit ? (
          <CommitDetail />
        ) : (
          <>
            <FileTree />
            <div className="absolute bottom-0 left-0 right-0 z-20 border-t border-border bg-[var(--bg-base)]/95 backdrop-blur-md">
              <CommitInput />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
