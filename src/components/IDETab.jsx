import React, { useState, useEffect, useRef } from 'react';
import { Editor } from '@monaco-editor/react';
import { toast } from 'sonner';
import { X, ChevronLeft } from 'lucide-react';
import FileTree from './FileTree';
import { api } from '../utils/api';

function IDETab({ selectedProject, isMobile, openFileFromChat }) {
  const [openFiles, setOpenFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [fileContents, setFileContents] = useState({});
  const [initialFileContents, setInitialFileContents] = useState({});
  const [fileLoading, setFileLoading] = useState({});
  const [fileErrors, setFileErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [showEditorOnMobile, setShowEditorOnMobile] = useState(false);

  // Resize logic
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('ide-sidebar-width');
    return saved ? parseInt(saved, 10) : 260;
  });
  const isResizing = useRef(false);
  const containerRef = useRef(null);

  // Handle files opened externally (e.g. from chat)
  useEffect(() => {
    if (openFileFromChat) {
      handleFileSelect(openFileFromChat);
    }
  }, [openFileFromChat]);

  // Monitor system dark mode setting
  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark');
    setIsDarkMode(isDark);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          setIsDarkMode(document.documentElement.classList.contains('dark'));
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });

    return () => observer.disconnect();
  }, []);

  const handleFileSelect = async (file) => {
    // Check if file is already open
    const existingFile = openFiles.find(f => f.path === file.path);

    if (!existingFile) {
      setOpenFiles(prev => [...prev, file]);
    }

    setActiveFile(file);
    if (isMobile) {
      setShowEditorOnMobile(true);
    }

    // Load content if we don't have it
    if (!fileContents[file.path]) {
      setFileLoading(prev => ({ ...prev, [file.path]: true }));
      try {
        const response = await api.readFile(file.projectName, file.path);
        if (!response.ok) throw new Error('Failed to read file');
        const data = await response.json();
        setFileContents(prev => ({ ...prev, [file.path]: data.content }));
        setInitialFileContents(prev => ({ ...prev, [file.path]: data.content }));
      } catch (error) {
        console.error('Error loading file:', error);
        setFileErrors(prev => ({ ...prev, [file.path]: error.message }));
      } finally {
        setFileLoading(prev => ({ ...prev, [file.path]: false }));
      }
    }
  };

  const handleCloseFile = (e, fileToClose) => {
    e.stopPropagation(); // Prevent tab click from firing
    const newOpenFiles = openFiles.filter(f => f.path !== fileToClose.path);
    setOpenFiles(newOpenFiles);

    // Cleanup file content from memory
    setFileContents(prev => {
      const newContents = { ...prev };
      delete newContents[fileToClose.path];
      return newContents;
    });
    setInitialFileContents(prev => {
      const newContents = { ...prev };
      delete newContents[fileToClose.path];
      return newContents;
    });

    if (activeFile?.path === fileToClose.path) {
      if (newOpenFiles.length > 0) {
        // Switch to the last opened tab
        setActiveFile(newOpenFiles[newOpenFiles.length - 1]);
      } else {
        setActiveFile(null);
        if (isMobile) {
          setShowEditorOnMobile(false);
        }
      }
    }
  };

  const handleEditorChange = (value) => {
    if (activeFile) {
      setFileContents(prev => ({ ...prev, [activeFile.path]: value }));
    }
  };

  // Use refs to avoid stale closures in event listeners without re-binding
  const activeFileRef = useRef(activeFile);
  const fileContentsRef = useRef(fileContents);
  const fileErrorsRef = useRef(fileErrors);
  const isSavingRef = useRef(saving);

  useEffect(() => {
    activeFileRef.current = activeFile;
    fileContentsRef.current = fileContents;
    fileErrorsRef.current = fileErrors;
    isSavingRef.current = saving;
  }, [activeFile, fileContents, fileErrors, saving]);

  const handleSave = async () => {
    const currentActive = activeFileRef.current;
    if (!currentActive) return;

    // Don't save if there was a load error or already saving
    if (fileErrorsRef.current[currentActive.path]) {
      toast.error('Cannot save file that failed to load');
      return;
    }

    if (isSavingRef.current) return;

    setSaving(true);
    try {
      const contentToSave = fileContentsRef.current[currentActive.path] || '';
      const response = await api.saveFile(currentActive.projectName, currentActive.path, contentToSave);
      if (!response.ok) throw new Error('Failed to save file');
      setInitialFileContents(prev => ({ ...prev, [currentActive.path]: contentToSave }));
      toast.success(`${currentActive.name} saved successfully`);
    } catch (error) {
      console.error('Error saving file:', error);
      toast.error(`Error saving file: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Handle Ctrl+S / Cmd+S globally, but safely using refs
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only capture save if we have an active file open in the IDE
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        if (activeFileRef.current) {
          e.preventDefault();
          handleSave();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []); // Empty deps, uses refs inside

  const getLanguage = (filename) => {
    const ext = filename?.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'js': case 'jsx': return 'javascript';
      case 'ts': case 'tsx': return 'typescript';
      case 'py': return 'python';
      case 'html': case 'htm': return 'html';
      case 'css': case 'scss': case 'less': return 'css';
      case 'json': return 'json';
      case 'md': case 'markdown': return 'markdown';
      case 'java': return 'java';
      case 'cpp': case 'c': return 'cpp';
      case 'rs': return 'rust';
      case 'go': return 'go';
      case 'php': return 'php';
      case 'rb': return 'ruby';
      default: return 'plaintext';
    }
  };

  const handleBeforeMount = (monaco) => {
    monaco.editor.defineTheme('deep-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [{ token: '', background: '0a0f1e' }],
      colors: {
        'editor.background': '#0a0f1e',
      }
    });
  };

  const startResizing = (e) => {
    e.preventDefault();
    isResizing.current = true;
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', stopResizing);
    document.body.style.cursor = 'ew-resize';
  };

  const handlePointerMove = (e) => {
    if (!isResizing.current || !containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newWidth = Math.max(160, Math.min(e.clientX - containerRect.left, containerRect.width * 0.5));
    setSidebarWidth(newWidth);
    localStorage.setItem('ide-sidebar-width', newWidth.toString());
  };

  const stopResizing = () => {
    isResizing.current = false;
    document.removeEventListener('pointermove', handlePointerMove);
    document.removeEventListener('pointerup', stopResizing);
    document.body.style.cursor = 'default';
  };

  // Determine layout classes
  const showSidebar = !isMobile || !showEditorOnMobile;
  const showEditor = !isMobile || showEditorOnMobile;

  return (
    <div className="flex h-full w-full bg-background overflow-hidden" ref={containerRef}>
      {/* Sidebar / File Tree */}
      {showSidebar && (
        <div 
          className={`flex flex-col border-r border-border relative ${isMobile ? 'w-full' : ''}`}
          style={{ width: isMobile ? '100%' : sidebarWidth, backgroundColor: '#0a0f1e' }}
        >
          <div className="flex-1 overflow-hidden">
            <FileTree
              selectedProject={selectedProject}
              onFileSelect={handleFileSelect}
              activeFilePath={activeFile?.path}
              ideMode={true}
            />
          </div>

          {/* Resize Handle */}
          {!isMobile && (
            <div
              onPointerDown={startResizing}
              className="absolute top-0 right-0 w-1 h-full cursor-ew-resize hover:bg-primary/40 active:bg-primary transition-colors z-20 group"
            >
              <div className="absolute inset-y-0 -left-1 -right-1 cursor-ew-resize" />
            </div>
          )}
        </div>
      )}

      {/* Editor Area */}
      {showEditor && (
        <div className={`flex flex-col flex-1 min-w-0 bg-background ${isMobile ? 'w-full' : ''}`}>
          {openFiles.length > 0 ? (
            <>
              {/* Tabs Bar */}
              <div className="flex bg-muted/50 border-b border-border overflow-x-auto no-scrollbar">
                {isMobile && (
                  <button
                    onClick={() => setShowEditorOnMobile(false)}
                    className="flex items-center justify-center px-3 py-2 text-muted-foreground hover:bg-accent hover:text-foreground border-r border-border"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}
                {openFiles.map((file) => {
                  const isDirty = initialFileContents[file.path] !== fileContents[file.path];
                  const isActive = activeFile?.path === file.path;

                  return (
                    <div
                      key={file.path}
                      onClick={() => setActiveFile(file)}
                      className={`group flex items-center gap-2 px-3 py-2 min-w-max border-r border-border cursor-pointer select-none text-sm transition-colors relative ${
                        isActive
                          ? 'bg-background text-foreground border-t-2 border-t-primary'
                          : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground border-t-2 border-t-transparent'
                      }`}
                    >
                      <span className={isDirty ? 'italic' : ''}>{file.name}</span>
                      
                      <div className="flex items-center justify-center w-4 h-4">
                        {isDirty ? (
                          <div className="relative">
                            {/* Circle for unsaved state */}
                            <div className="w-2 h-2 rounded-full bg-foreground/40 group-hover:opacity-0 transition-opacity" />
                            {/* X for closing, hidden behind circle unless hovered or active */}
                            <button
                              onClick={(e) => handleCloseFile(e, file)}
                              className={`absolute inset-0 flex items-center justify-center p-0.5 rounded-sm transition-opacity ${
                                isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                              }`}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => handleCloseFile(e, file)}
                            className={`flex items-center justify-center p-0.5 rounded-sm transition-opacity ${
                              isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                            }`}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Editor Content */}
              <div className="flex-1 relative">
                {activeFile && fileLoading[activeFile.path] ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
                    <div className="flex items-center gap-3">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                      <span className="text-muted-foreground">Loading {activeFile.name}...</span>
                    </div>
                  </div>
                ) : activeFile && fileErrors[activeFile.path] ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-background z-10 p-4">
                    <div className="text-center text-destructive max-w-md">
                      <div className="w-12 h-12 mb-3 mx-auto bg-destructive/10 rounded-full flex items-center justify-center">
                        <X className="w-6 h-6" />
                      </div>
                      <h3 className="font-semibold mb-1">Failed to load file</h3>
                      <p className="text-sm opacity-80">{fileErrors[activeFile.path]}</p>
                    </div>
                  </div>
                ) : activeFile && (
                  <Editor
                    height="100%"
                    language={getLanguage(activeFile.name)}
                    theme={isDarkMode ? 'deep-dark' : 'vs'}
                    beforeMount={handleBeforeMount}
                    value={fileContents[activeFile.path] || ''}
                    onChange={handleEditorChange}
                    options={{
                      minimap: { enabled: !isMobile },
                      fontSize: isMobile ? 12 : 14,
                      wordWrap: 'on',
                      automaticLayout: true,
                      padding: { top: 16 },
                      scrollBeyondLastLine: false,
                      tabSize: 2,
                    }}
                    loading={<div className="h-full w-full flex items-center justify-center">Loading editor...</div>}
                  />
                )}
              </div>
            </>
          ) : (
            /* Empty State */
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <div className="w-16 h-16 mb-4 rounded-xl bg-muted flex items-center justify-center">
                <svg className="w-8 h-8 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                </svg>
              </div>
              <p>Select a file to start editing</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default React.memo(IDETab);
