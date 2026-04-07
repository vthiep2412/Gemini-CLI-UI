import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { ScrollArea } from './ui/scroll-area';
import { List, TableProperties, Eye, Pencil, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

import { api } from '../utils/api';
import ImageViewer from './ImageViewer';
import FileIcon from './common/FileIcon';
import { toast } from 'sonner';

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp', 'avif']);
const isImageFile = (filename) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
};

const formatFileSize = (bytes) => {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const formatRelativeTime = (date) => {
  if (!date) return '—';
  const diffInSeconds = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return new Date(date).toLocaleDateString();
};

// ─── Shared Item Row ─────────────────────────────────────────────────────────
const FileRow = React.memo(function FileRow({
  item, 
  level, 
  isExpanded, 
  activeFilePath, 
  viewMode, 
  onClickItem, 
  onContextMenu,
  isRenaming,
  onRenameSubmit,
  onRenameCancel
}) {
  const isDir = item.type === 'directory';
  const indent = level * 18 + 12;
  const [tempName, setTempName] = useState(item.name);

  useEffect(() => { if (isRenaming) setTempName(item.name); }, [isRenaming, item.name]);

  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter') onRenameSubmit(item, tempName);
    if (e.key === 'Escape') onRenameCancel();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onContextMenu={(e) => onContextMenu(e, item)}
      className={cn(
        'flex items-center gap-2.5 py-[4.5px] pr-2 rounded-sm cursor-pointer select-none group',
        'hover:bg-(--bg-muted)/40 transition-colors duration-100',
        activeFilePath === item.path && 'bg-(--bg-muted)/60 text-(--text-primary)',
        isRenaming && 'bg-(--bg-muted)/80 ring-1 ring-(--git-accent)/50'
      )}
      style={{ paddingLeft: `${indent}px` }}
      onClick={() => !isRenaming && onClickItem(item)}
    >
      <FileIcon filename={item.name} isFolder={isDir} isOpen={isExpanded} size={19} className="shrink-0" />

      <div className="flex-1 min-w-0 flex items-center gap-2">
        {isRenaming ? (
          <div className="flex items-center gap-1 w-full mr-2">
            <input
              autoFocus
              className="flex-1 bg-(--bg-base) border border-(--git-accent)/50 rounded px-1.5 py-0.5 text-[14.5px] outline-none focus:ring-2 focus:ring-(--git-accent)/20"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onKeyDown={handleInputKeyDown}
              onBlur={(e) => {
                if (e.relatedTarget?.closest('[data-rename-action]')) return;
                onRenameCancel();
              }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        ) : (
          <>
            <span className="text-[14.5px] truncate text-(--text-primary) opacity-85 flex-1">
              {item.name}
            </span>
            
            {viewMode === 'compact' && !isDir && (
              <span className="text-[11px] text-(--text-secondary) opacity-50 shrink-0 font-mono pr-2">
                {formatFileSize(item.size)}
              </span>
            )}

            {viewMode === 'detailed' && (
              <>
                <span className="text-[12px] text-(--text-secondary) opacity-50 font-mono shrink-0" style={{ width: 64 }}>
                  {isDir ? '—' : formatFileSize(item.size)}
                </span>
                <span className="text-[12px] text-(--text-secondary) opacity-50 shrink-0" style={{ width: 88 }}>
                  {formatRelativeTime(item.modified)}
                </span>
                <span className="text-[12px] text-(--text-secondary) opacity-40 font-mono shrink-0" style={{ width: 68 }}>
                  {item.permissionsRwx || '—'}
                </span>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
});

// ─── Custom Context Menu ──────────────────────────────────────────────────
function ContextMenu({ x, y, item, onClose, onRename, onDelete }) {
  const menuRef = useRef(null);
  const [adjustedPos, setAdjustedPos] = useState({ x, y });
  const [isVisible, setIsVisible] = useState(false);

  useLayoutEffect(() => {
    if (menuRef.current) {
      const menuWidth = menuRef.current.offsetWidth;
      const menuHeight = menuRef.current.offsetHeight;
      const margin = 12;
      
      const adjustedX = Math.min(x, window.innerWidth - menuWidth - margin);
      const adjustedY = Math.min(y, window.innerHeight - menuHeight - margin);
      
      setAdjustedPos({ 
        x: Math.max(margin, adjustedX), 
        y: Math.max(margin, adjustedY) 
      });
      setIsVisible(true);
    }
  }, [x, y]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <motion.div
      ref={menuRef}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: isVisible ? 1 : 0, scale: isVisible ? 1 : 0.95 }}
      className="fixed z-9999 min-w-40 p-1.5 rounded-lg shadow-2xl border border-white/5 backdrop-blur-md"
      style={{ 
        left: adjustedPos.x, 
        top: adjustedPos.y,
        // Deep Dark Blue inspired by VS Code "Activity Bar" but stays themed
        backgroundColor: 'rgba(10, 20, 40, 0.95)', 
        color: '#e2e8f0'
      }}
    >
      <button
        onClick={() => { onRename(item); onClose(); }}
        data-rename-action="true"
        className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium hover:bg-white/10 rounded-md transition-colors text-left"
      >
        <Pencil className="w-3.5 h-3.5 opacity-60" /> Rename
      </button>
      <div className="h-px bg-white/5 my-1" />
      <button
        onClick={() => { onDelete(item); onClose(); }}
        data-rename-action="true"
        className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium hover:bg-red-500/20 text-red-400 rounded-md transition-colors text-left"
      >
        <Trash2 className="w-3.5 h-3.5 opacity-60" /> Delete
      </button>
    </motion.div>
  );
}

const TreeNodes = React.memo(function TreeNodes({ items, level = 0, expandedDirs, activeFilePath, viewMode, onClickItem, onContextMenu, renamingPath, onRenameSubmit, onRenameCancel }) {
  return items.map((item) => (
    <div key={item.path}>
      <FileRow
        item={item}
        level={level}
        isExpanded={expandedDirs.has(item.path)}
        activeFilePath={activeFilePath}
        viewMode={viewMode}
        onClickItem={onClickItem}
        onContextMenu={onContextMenu}
        isRenaming={renamingPath === item.path}
        onRenameSubmit={onRenameSubmit}
        onRenameCancel={onRenameCancel}
      />
      <AnimatePresence initial={false}>
        {item.type === 'directory' && expandedDirs.has(item.path) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
             {item.children?.length > 0 && (
               <TreeNodes
                items={item.children}
                level={level + 1}
                expandedDirs={expandedDirs}
                activeFilePath={activeFilePath}
                viewMode={viewMode}
                onClickItem={onClickItem}
                onContextMenu={onContextMenu}
                renamingPath={renamingPath}
                onRenameSubmit={onRenameSubmit}
                onRenameCancel={onRenameCancel}
              />
             )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  ));
});

function FileTree({ selectedProject, onFileSelect, activeFilePath }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedDirs, setExpandedDirs] = useState(new Set());
  const [selectedImage, setSelectedImage] = useState(null);
  const [viewMode, setViewMode] = useState(() => {
    try { return localStorage.getItem('file-tree-view-mode') || 'simple'; } catch { return 'simple'; }
  });

  // Context Menu State
  const [ctxMenu, setCtxMenu] = useState(null);
  const [renamingPath, setRenamingPath] = useState(null);

  const selectedProjectRef = useRef(selectedProject);
  useEffect(() => { selectedProjectRef.current = selectedProject; }, [selectedProject]);

  const fetchFiles = useCallback(async (isSilent = false) => {
    const project = selectedProjectRef.current;
    if (!project) return;
    if (!isSilent) setLoading(true);
    try {
      const response = await api.getFiles(project.name);
      if (!response.ok) { setFiles([]); return; }
      const data = await response.json();
      setFiles(data);
    } catch (err) {
      console.error('❌ Error fetching files:', err);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedProject) fetchFiles(false);
    else setFiles([]);
  }, [selectedProject, fetchFiles]);

  useEffect(() => {
    if (!selectedProject) return;
    const onRefresh = () => fetchFiles(true);
    window.addEventListener('refresh-file-tree', onRefresh);
    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchFiles(true);
      }
    }, 12000);
    return () => {
      window.removeEventListener('refresh-file-tree', onRefresh);
      clearInterval(intervalId);
    };
  }, [selectedProject, fetchFiles]);

  const toggleDirectory = useCallback((path) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path); else next.add(path);
      return next;
    });
  }, []);

  const handleContextMenu = useCallback((e, item) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, item });
  }, []);

  const startRename = useCallback((item) => {
    setRenamingPath(item.path);
  }, []);

  const handleRenameSubmit = useCallback(async (item, newName) => {
    if (!newName || newName === item.name) {
      setRenamingPath(null);
      return;
    }

    const oldPath = item.path;
    const parent = oldPath.substring(0, oldPath.lastIndexOf(item.name));
    const newPath = parent + newName;

    try {
      const res = await api.renameFile(selectedProjectRef.current?.name, oldPath, newPath);
      if (!res.ok) throw new Error('Failed to rename');
      toast.success('Renamed successfully');
      fetchFiles(true);
    } catch (err) {
      console.error('Rename failed:', err);
      toast.error('Error renaming file');
    } finally {
      setRenamingPath(null);
    }
  }, [fetchFiles]);

  const handleDelete = useCallback(async (item) => {
    if (!window.confirm(`Delete ${item.name}? This cannot be undone.`)) return;

    try {
      const res = await api.deleteFile(selectedProjectRef.current?.name, item.path);
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Deleted successfully');
      fetchFiles(true);
    } catch (err) {
      console.error('Delete failed:', err);
      toast.error('Error deleting file');
    }
  }, [fetchFiles]);

  const handleClickItem = useCallback((item) => {
    if (item.type === 'directory') toggleDirectory(item.path);
    else if (isImageFile(item.name)) {
      setSelectedImage({
        name: item.name,
        path: item.path,
        projectPath: selectedProjectRef.current?.path,
        projectName: selectedProjectRef.current?.name,
      });
    } else {
      onFileSelect?.({
        name: item.name,
        path: item.path,
        projectPath: selectedProjectRef.current?.path,
        projectName: selectedProjectRef.current?.name,
      });
    }
  }, [toggleDirectory, onFileSelect]);

  const changeViewMode = (mode) => {
    setViewMode(mode);
    try { localStorage.setItem('file-tree-view-mode', mode); } catch { /* noop */ }
  };

  const handleRenameCancel = useCallback(() => setRenamingPath(null), []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-(--text-secondary) text-[14px] animate-pulse">Loading files…</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-(--bg-base) transition-colors duration-300 relative overflow-hidden">
      {/* Toolbar */}
      <div className="px-3 py-3 border-b border-border flex items-center justify-between shrink-0">
        <h3 className="text-[13px] font-bold uppercase tracking-widest text-(--text-secondary) opacity-60">Files</h3>
        <div className="flex gap-1">
          {[
            { mode: 'simple',   Icon: List,            title: 'Simple view' },
            { mode: 'compact',  Icon: Eye,             title: 'Compact view' },
            { mode: 'detailed', Icon: TableProperties, title: 'Detailed view' },
          ].map(({ mode, Icon, title }) => (
            <button
              key={mode}
              title={title}
              onClick={() => changeViewMode(mode)}
              className={cn(
                'p-1.5 rounded transition-all',
                viewMode === mode
                  ? 'bg-(--git-accent)/15 text-(--git-accent)'
                  : 'text-(--text-secondary) opacity-40 hover:opacity-80',
              )}
            >
              <Icon className="w-4 h-4" />
            </button>
          ))}
        </div>
      </div>

      {viewMode === 'detailed' && files.length > 0 && (
        <div className="px-3 py-1.5 border-b border-border/50 flex items-center shrink-0">
          <span className="text-[11px] font-bold uppercase tracking-wider text-(--text-secondary) opacity-40" style={{ flex: '5 1 0', paddingLeft: 30 }}>Name</span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-(--text-secondary) opacity-40 shrink-0" style={{ width: 64 }}>Size</span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-(--text-secondary) opacity-40 shrink-0" style={{ width: 88 }}>Modified</span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-(--text-secondary) opacity-40 shrink-0" style={{ width: 68 }}>Perms</span>
        </div>
      )}

      <ScrollArea className="flex-1 py-2 pr-1 ml-0.5">
        {files.length === 0 ? (
          <div className="text-center py-10 px-4">
            <FileIcon filename="folder" isFolder size={48} className="mx-auto mb-3 opacity-30" />
            <p className="text-[14px] font-semibold text-(--text-secondary) opacity-50">No files found</p>
          </div>
        ) : (
          <div className="pb-8">
            <TreeNodes
              items={files}
              expandedDirs={expandedDirs}
              activeFilePath={activeFilePath}
              viewMode={viewMode}
              onClickItem={handleClickItem}
              onContextMenu={handleContextMenu}
              renamingPath={renamingPath}
              onRenameSubmit={handleRenameSubmit}
              onRenameCancel={handleRenameCancel}
            />
          </div>
        )}
      </ScrollArea>

      {/* Context Menu Overlay */}
      {ctxMenu && (
        <ContextMenu
          {...ctxMenu}
          onRename={startRename}
          onDelete={handleDelete}
          onClose={() => setCtxMenu(null)}
        />
      )}

      {selectedImage && (
        <ImageViewer file={selectedImage} onClose={() => setSelectedImage(null)} />
      )}
    </div>
  );
}

export default React.memo(FileTree);