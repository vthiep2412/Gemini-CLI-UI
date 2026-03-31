import React, { useState, useEffect, useRef } from 'react';
import { Editor } from '@monaco-editor/react';
import { X, Save, Download, Maximize2, Minimize2, ChevronLeft } from 'lucide-react';
import FileTree from './FileTree';
import { api } from '../utils/api';

function IDETab({ selectedProject, isMobile }) {
  const [openFiles, setOpenFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [fileContents, setFileContents] = useState({});
  const [fileLoading, setFileLoading] = useState({});
  const [saving, setSaving] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [showEditorOnMobile, setShowEditorOnMobile] = useState(false);

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
      } catch (error) {
        console.error('Error loading file:', error);
        setFileContents(prev => ({ ...prev, [file.path]: `// Error loading file: ${error.message}` }));
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

  const handleSave = async () => {
    if (!activeFile) return;

    setSaving(true);
    try {
      const response = await api.saveFile(activeFile.projectName, activeFile.path, fileContents[activeFile.path]);
      if (!response.ok) throw new Error('Failed to save file');
      // Could show a toast notification here
    } catch (error) {
      console.error('Error saving file:', error);
      alert(`Error saving file: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Handle Ctrl+S / Cmd+S
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFile, fileContents]);

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

  // Determine layout classes
  const showSidebar = !isMobile || !showEditorOnMobile;
  const showEditor = !isMobile || showEditorOnMobile;

  return (
    <div className="flex h-full w-full bg-background overflow-hidden">
      {/* Sidebar / File Tree */}
      {showSidebar && (
        <div className={`flex flex-col border-r border-border bg-card ${isMobile ? 'w-full' : 'w-64 min-w-[250px]'}`}>
          <div className="flex-1 overflow-hidden">
            <FileTree
              selectedProject={selectedProject}
              onFileSelect={handleFileSelect}
              activeFilePath={activeFile?.path}
              ideMode={true}
            />
          </div>
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
                {openFiles.map((file) => (
                  <div
                    key={file.path}
                    onClick={() => setActiveFile(file)}
                    className={`group flex items-center gap-2 px-3 py-2 min-w-max border-r border-border cursor-pointer select-none text-sm transition-colors ${
                      activeFile?.path === file.path
                        ? 'bg-background text-foreground border-t-2 border-t-primary'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground border-t-2 border-t-transparent'
                    }`}
                  >
                    <span>{file.name}</span>
                    <button
                      onClick={(e) => handleCloseFile(e, file)}
                      className="p-0.5 rounded-sm opacity-0 group-hover:opacity-100 hover:bg-accent/50 transition-opacity"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
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
                ) : activeFile && (
                  <Editor
                    height="100%"
                    language={getLanguage(activeFile.name)}
                    theme={isDarkMode ? 'vs-dark' : 'light'}
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
