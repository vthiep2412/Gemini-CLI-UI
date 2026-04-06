/*
 * ChatInterface.jsx - Modularized Chat Component with Session Protection Integration
 */

import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { Loader2, AlertCircle, ChevronUp, ChevronDown, CornerDownLeft } from 'lucide-react';
import GeminiLogo from './GeminiLogo.jsx';
import GeminiStatus from './GeminiStatus';
import { api } from '../utils/api';
import { useMessages } from '../contexts/MessageContext';
import MessageItem from './chat/MessageItem';
import { useChatWebSocket } from '../hooks/useChatWebSocket';
import { useChatHistory } from '../hooks/useChatHistory';

const DEFAULT_PERMISSION_MODE = 'default';

// ImageAttachment component for displaying image previews
const ImageAttachment = ({ file, onRemove, uploadProgress, error }) => {
  const [preview, setPreview] = useState(null);
  
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  
  return (
    <div className="relative group">
      <img src={preview} alt={file.name} className="w-20 h-20 object-cover rounded" />
      {uploadProgress !== undefined && uploadProgress < 100 && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
          <div className="text-white text-xs">{uploadProgress}%</div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 bg-red-500/50 flex items-center justify-center">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
      )}
      <button
        onClick={onRemove}
        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

function ChatInterface({ 
  selectedProject, 
  selectedSession, 
  onFileOpen, 
  isInputFocused,
  onInputFocusChange, 
  onSessionActive, 
  onSessionInactive, 
  onReplaceTemporarySession, 
  onNavigateToSession, 
  onShowSettings, 
  autoExpandTools, 
  showRawParameters, 
  autoScrollToBottom 
}) {
  const { sendMessage, messages } = useMessages();
  
  // State Initialization
  const [input, setInput] = useState(() => {
    if (typeof window !== 'undefined' && selectedProject) {
      return localStorage.getItem(`draft_input_${selectedProject.name}`) || '';
    }
    return '';
  });
  
  const [chatMessages, setChatMessages] = useState(() => {
    if (typeof window !== 'undefined' && selectedProject) {
      const saved = localStorage.getItem(`chat_messages_${selectedProject.name}`);
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(null);

  const [selectedModel, setSelectedModel] = useState(() => {
    try {
      const settings = JSON.parse(localStorage.getItem('gemini-tools-settings') || '{}');
      return settings.selectedModel || 'gemini-3.1-pro';
    } catch (e) { 
      return 'gemini-3.1-pro';
    }
  });

  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const modelDropdownRef = useRef(null);

  const MODELS = [
    { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro' },
    { id: 'gemini-3-flash', name: 'Gemini 3 Flash' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' }
  ];

  const handleModelSelect = (modelId) => {
    setSelectedModel(modelId);
    setShowModelDropdown(false);
    try {
      const settings = JSON.parse(localStorage.getItem('gemini-tools-settings') || '{}');
      settings.selectedModel = modelId;
      localStorage.setItem('gemini-tools-settings', JSON.stringify(settings));
    } catch(e) { console.error('Failed to save model preference'); }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target)) {
        setShowModelDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const [isSystemSessionChange, setIsSystemSessionChange] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [attachedImages, setAttachedImages] = useState([]);
  
  // Refs
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const scrollContainerRef = useRef(null);
  
  // File Interaction State
  const [showFileDropdown, setShowFileDropdown] = useState(false);
  const [fileList, setFileList] = useState([]);
  const [filteredFiles, setFilteredFiles] = useState([]);
  const [selectedFileIndex, setSelectedFileIndex] = useState(-1);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [atSymbolPosition, setAtSymbolPosition] = useState(-1);
  const [canAbortSession, setCanAbortSession] = useState(false);
  const [isUserScrolledUp, setIsUserScrolledUp] = useState(false);
  const [visibleMessageCount, setVisibleMessageCount] = useState(100);
  const [geminiStatus, setGeminiStatus] = useState(null);

  // Scroll Utility
  const scrollToBottom = useCallback((instant = false) => {
    if (scrollContainerRef.current) {
      if (instant) {
        scrollContainerRef.current.classList.add('scroll-instant');
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        requestAnimationFrame(() => {
          scrollContainerRef.current?.classList.remove('scroll-instant');
        });
      } else {
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      }
      setIsUserScrolledUp(false);
    }
  }, []);

  const isNearBottom = useCallback(() => {
    if (!scrollContainerRef.current) return false;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    return scrollHeight - scrollTop - clientHeight < 50;
  }, []);

  const handleScroll = useCallback(() => {
    if (scrollContainerRef.current) {
      setIsUserScrolledUp(!isNearBottom());
    }
  }, [isNearBottom]);

  // Modularized Logic Hooks
  const { isLoadingSessionMessages } = useChatHistory({
    selectedSession,
    selectedProject,
    isSystemSessionChange,
    setIsSystemSessionChange,
    setChatMessages,
    autoScrollToBottom,
    scrollToBottom,
    setCurrentSessionId
  });

  useChatWebSocket({
    messages,
    currentSessionId,
    setCurrentSessionId,
    setChatMessages,
    setIsLoading,
    setCanAbortSession,
    setGeminiStatus,
    setIsSystemSessionChange,
    selectedProject,
    onReplaceTemporarySession,
    onNavigateToSession,
    onSessionInactive
  });

  // Effects
  
  // Deterministic Scroll to Bottom when messages change (e.g. after history load)
  useLayoutEffect(() => {
    if (autoScrollToBottom && chatMessages.length > 0 && !isUserScrolledUp) {
      scrollToBottom(true);
    }
  }, [chatMessages, autoScrollToBottom, scrollToBottom, isUserScrolledUp]);

  useEffect(() => {
    if (selectedProject) {
      if (input !== '') localStorage.setItem(`draft_input_${selectedProject.name}`, input);
      else localStorage.removeItem(`draft_input_${selectedProject.name}`);
    }
  }, [input, selectedProject]);

  useEffect(() => {
    if (selectedProject) {
      if (chatMessages.length > 0) {
        localStorage.setItem(`chat_messages_${selectedProject.name}`, JSON.stringify(chatMessages));
      } else {
        localStorage.removeItem(`chat_messages_${selectedProject.name}`);
      }
    }
  }, [chatMessages, selectedProject]);

  useEffect(() => {
    const checkSettings = () => {
      try {
        const settings = JSON.parse(localStorage.getItem('gemini-tools-settings') || '{}');
        setIsYoloMode(settings.skipPermissions || false);
        setSelectedModel(settings.selectedModel || 'gemini-2.5-flash');
      } catch {
        setIsYoloMode(false);
        setSelectedModel('gemini-2.5-flash');
      }
    };
    checkSettings();
    
    const handleStorageChange = (e) => {
      if (e.key === 'gemini-tools-settings') {
        checkSettings();
        setChatMessages(prev => [...prev, {
          id: `system-${Date.now()}`,
          type: 'system',
          content: '⚙️ Settings updated.',
          timestamp: new Date().toISOString()
        }]);
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    const handleFocus = () => checkSettings();
    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Clear upload error after 5 seconds
  useEffect(() => {
    if (uploadError) {
      const timer = setTimeout(() => {
        setUploadError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [uploadError]);

  const fetchProjectFiles = useCallback(async () => {
    if (!selectedProject) return;
    try {
      const response = await api.getFiles(selectedProject.name);
      if (response.ok) {
        const files = await response.json();
        const flatten = (items, basePath = '') => {
          let res = [];
          for (const item of items) {
            const fullPath = basePath ? `${basePath}/${item.name}` : item.name;
            if (item.type === 'directory' && item.children) {
              res = res.concat(flatten(item.children, fullPath));
            } else if (item.type === 'file') {
              res.push({ name: item.name, path: fullPath, relativePath: item.path });
            }
          }
          return res;
        };
        setFileList(flatten(files));
      }
    } catch (error) { console.error('Error fetching files:', error); }
  }, [selectedProject?.name]);

  useEffect(() => {
    fetchProjectFiles();
  }, [fetchProjectFiles]);

  useEffect(() => {
    const textBeforeCursor = input.slice(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      if (!textAfterAt.includes(' ')) {
        setAtSymbolPosition(lastAtIndex);
        setShowFileDropdown(true);
        const filtered = fileList.filter(file => 
          file.name.toLowerCase().includes(textAfterAt.toLowerCase()) ||
          file.path.toLowerCase().includes(textAfterAt.toLowerCase())
        ).slice(0, 10);
        setFilteredFiles(filtered);
        setSelectedFileIndex(-1);
      } else { setShowFileDropdown(false); setAtSymbolPosition(-1); }
    } else { setShowFileDropdown(false); setAtSymbolPosition(-1); }
  }, [input, cursorPosition, fileList]);

  const visibleMessages = useMemo(() => {
    if (chatMessages.length <= visibleMessageCount) return chatMessages;
    return chatMessages.slice(-visibleMessageCount);
  }, [chatMessages, visibleMessageCount]);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
      return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [input]);

  const handleImageFiles = useCallback((files) => {
    const rejected = [];
    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        rejected.push(`${file.name}: not an image`);
        return false;
      }
      if (file.size > 5 * 1024 * 1024) {
        rejected.push(`${file.name}: exceeds 5MB limit`);
        return false;
      }
      return true;
    });

    if (rejected.length > 0) {
      console.warn('Rejected files:', rejected);
    }

    if (validFiles.length > 0) {
      setAttachedImages(prev => [...prev, ...validFiles].slice(0, 5));
    }
  }, []);

  const onDrop = useCallback(acceptedFiles => handleImageFiles(acceptedFiles), [handleImageFiles]);
  const { getRootProps, getInputProps, open } = useDropzone({ onDrop, noClick: true, accept: { 'image/*': [] } });

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    let uploadedImages = [];
    if (attachedImages.length > 0) {
      const formData = new FormData();
      attachedImages.forEach(img => formData.append('images', img));
      setUploadingImages(true);
      setUploadError(null);
      try {
        const response = await api.uploadImages(formData);
        if (!response.ok) throw new Error('Image upload failed');
        const data = await response.json();
        uploadedImages = data.images;
        toast.success(`Successfully uploaded ${attachedImages.length} image(s)`);
      } catch (err) {
        console.error('Image upload failed:', err);
        setUploadError(err.message);
        toast.error(`Failed to upload images: ${err.message}`);
        return;
      } finally {
        setUploadingImages(false);
      }
    }
    
    const userMessage = { type: 'user', content: input, images: uploadedImages, timestamp: new Date() };
    setChatMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setCanAbortSession(true);
    setGeminiStatus({ text: 'Processing', tokens: 0, can_interrupt: true });
    setIsUserScrolledUp(false);
    // Centralized useEffect handles scrolling
    
    const sessionToActivate = currentSessionId || `new-session-${Date.now()}`;
    if (onSessionActive) onSessionActive(sessionToActivate);
    
    const toolsSettings = (() => {
      try {
        const saved = localStorage.getItem('gemini-tools-settings');
        if (saved) {
          const s = JSON.parse(saved);
          return { 
            allowedTools: s.allowedTools || [], 
            disallowedTools: s.disallowedTools || [], 
            skipPermissions: s.skipPermissions || false, 
            selectedModel: s.selectedModel || 'gemini-2.5-flash' 
          };
        }
      } catch (err) { console.error(err); }
      return { allowedTools: [], disallowedTools: [], skipPermissions: false, selectedModel: 'gemini-2.5-flash' };
    })();
    
    sendMessage({ 
      type: 'gemini-command', 
      command: input, 
      options: { 
        projectPath: selectedProject.path, 
        cwd: selectedProject.path, 
        sessionId: currentSessionId, 
        resume: !!currentSessionId, 
        toolsSettings, 
        permissionMode: DEFAULT_PERMISSION_MODE, 
        model: selectedModel, 
        images: uploadedImages 
      } 
    });
    
    setInput('');
    setAttachedImages([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    if (selectedProject) localStorage.removeItem(`draft_input_${selectedProject.name}`);
  };

  const handleKeyDown = (e) => {
    if (showFileDropdown && filteredFiles.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedFileIndex(prev => prev < filteredFiles.length - 1 ? prev + 1 : 0); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedFileIndex(prev => prev > 0 ? prev - 1 : filteredFiles.length - 1); return; }
      if (e.key === 'Tab' || e.key === 'Enter') { 
        e.preventDefault(); 
        if (selectedFileIndex >= 0) selectFile(filteredFiles[selectedFileIndex]); 
        else if (filteredFiles.length > 0) selectFile(filteredFiles[0]); 
        return; 
      }
      if (e.key === 'Escape') { e.preventDefault(); setShowFileDropdown(false); return; }
    }
    if (e.key === 'Enter') {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey) { e.preventDefault(); handleSubmit(e); }
      else if (!e.shiftKey && !e.ctrlKey && !e.metaKey) { e.preventDefault(); handleSubmit(e); }
    }
  };

  const selectFile = (file) => {
    const textBeforeAt = input.slice(0, atSymbolPosition);
    const textAfterAtQuery = input.slice(atSymbolPosition);
    const spaceIndex = textAfterAtQuery.indexOf(' ');
    const textAfterQuery = spaceIndex !== -1 ? textAfterAtQuery.slice(spaceIndex) : '';
    const newInput = textBeforeAt + '@' + file.path + ' ' + textAfterQuery;
    const newCursorPos = textBeforeAt.length + 1 + file.path.length + 1;
    setInput(newInput);
    setCursorPosition(newCursorPos);
    setShowFileDropdown(false);
    setAtSymbolPosition(-1);
    if (textareaRef.current) {
      textareaRef.current.focus();
      requestAnimationFrame(() => {
        if (textareaRef.current) textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      });
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    setCursorPosition(e.target.selectionStart);
  };

  const handleAbortSession = () => {
    if (currentSessionId && canAbortSession) sendMessage({ type: 'abort-session', sessionId: currentSessionId });
  };

  if (!selectedProject) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <p>Select a project to start chatting with Gemini</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="h-full flex flex-col overflow-hidden bg-[#0a101f] text-gray-100">
        <style>{`details[open] .details-chevron { transform: rotate(180deg); }`}</style>
        <div 
          ref={scrollContainerRef} 
          className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-6 scroll-smooth"
          onScroll={handleScroll}
        >
          {isLoadingSessionMessages && chatMessages.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
              <div className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
                <p>Loading session messages...</p>
              </div>
            </div>
          ) : chatMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full -mt-20">
                <h1 className="text-4xl font-bold mb-3 text-white tracking-tight">
                  Good evening, Ben
                </h1>
                <p className="text-[#64748b] text-lg">
                  What would you like to build today?
                </p>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto flex flex-col pb-4">
              {chatMessages.length > visibleMessageCount && (
                <div className="text-center text-gray-500 text-sm py-2 mb-4">
                  Showing last {visibleMessageCount} messages ({chatMessages.length} total) • 
                  <button className="ml-1 text-blue-500 hover:text-blue-400 underline" onClick={() => setVisibleMessageCount(v => v + 100)}>Load earlier</button>
                </div>
              )}
              {visibleMessages.map((message, index) => (
                <MessageItem
                  key={`${message.id || index}-${message.timestamp}`}
                  message={message}
                  index={index}
                  prevMessage={index > 0 ? visibleMessages[index - 1] : null}
                  onFileOpen={onFileOpen}
                  onShowSettings={onShowSettings}
                  autoExpandTools={autoExpandTools}
                  showRawParameters={showRawParameters}
                />
              ))}
              {isLoading && (
                <div className="flex items-center gap-3 mt-8">
                  <div className="w-8 h-8 rounded-lg bg-[#5361fc] flex items-center justify-center shadow-md">
                    <GeminiLogo className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="font-semibold text-sm text-gray-200 tracking-wide">Gemini</span>
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce [animation-delay:-0.3s]"></div>
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce [animation-delay:-0.15s]"></div>
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce"></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} className="h-4" />
            </div>
          )}
        </div>

        <div className="shrink-0 pb-6 px-4 md:px-8 w-full max-w-4xl mx-auto relative z-10 text-center">
          <GeminiStatus status={geminiStatus} isLoading={isLoading} onAbort={handleAbortSession} />

          <div className="relative">
             {showFileDropdown && filteredFiles.length > 0 && (
              <div className="absolute bottom-[calc(100%+16px)] left-0 w-80 bg-[#252f40] rounded-xl shadow-2xl border border-gray-700/50 overflow-hidden z-50 animate-in slide-in-from-bottom-2 fade-in duration-200">
                <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-[#1f2937]">
                  <span className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">Reference Context</span>
                  <div className="flex gap-1.5 text-[10px] text-gray-500 font-medium">
                     <span className="flex items-center gap-1 border border-gray-600 rounded px-1"><svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg><svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg> navigate</span>
                     <span className="flex items-center gap-1 border border-gray-600 rounded px-1"><svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg> select</span>
                  </div>
                </div>
                <div className="max-h-[240px] overflow-y-auto custom-scrollbar">
                  {filteredFiles.map((file, idx) => (
                    <div 
                      key={file.path} 
                      className={`px-4 py-2.5 cursor-pointer flex items-center gap-3 transition-colors ${
                        selectedFileIndex === idx 
                          ? 'bg-[#3b82f6]/20 border-l-2 border-blue-500'
                          : 'hover:bg-white/5 border-l-2 border-transparent'
                      }`}
                      onClick={() => selectFile(file)}
                    >
                      <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div className="flex flex-col overflow-hidden">
                        <span className="text-sm text-gray-200 truncate font-medium">{file.name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {attachedImages.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {attachedImages.map((file, idx) => (
                  <ImageAttachment key={idx} file={file} onRemove={() => setAttachedImages(prev => prev.filter((_, i) => i !== idx))} />
                ))}
              </div>
            )}

            <div
              {...getRootProps()}
              className={`relative bg-[#1a2332] rounded-xl border transition-all duration-200 flex flex-col ${
                isInputFocused ? 'border-[#3b82f6] shadow-[0_0_0_2px_rgba(59,130,246,0.2)]' : 'border-gray-700/50 shadow-md hover:border-gray-600'
              }`}
            >
              <input {...getInputProps()} />

              <textarea 
                ref={textareaRef} 
                value={input} 
                onChange={handleInputChange} 
                onKeyDown={handleKeyDown} 
                onFocus={() => onInputFocusChange && onInputFocusChange(true)} 
                onBlur={() => onInputFocusChange && onInputFocusChange(false)} 
                onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; setCursorPosition(e.target.selectionStart); }}
                placeholder="Message Gemini... (Type @ to reference files)"
                disabled={isLoading} 
                className="w-full pl-4 pr-4 pt-4 pb-12 bg-transparent rounded-xl focus:outline-none text-gray-200 placeholder-gray-500 disabled:opacity-50 resize-none min-h-[5.5rem] max-h-[40vh] overflow-y-auto leading-relaxed custom-scrollbar"
              />

              <div className="absolute bottom-2 left-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={open}
                  className="p-2 text-gray-400 hover:text-gray-200 hover:bg-white/5 rounded-lg transition-colors"
                  title="Attach Image"
                >
                  <svg className="w-[18px] h-[18px] -rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="p-2 text-gray-400 hover:text-gray-200 hover:bg-white/5 rounded-lg transition-colors"
                  title="Voice Input"
                >
                  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </button>
              </div>

              <div className="absolute bottom-2 right-2 flex items-center gap-2" ref={modelDropdownRef}>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowModelDropdown(!showModelDropdown)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-gray-200 transition-colors rounded-lg hover:bg-white/5"
                  >
                    {MODELS.find(m => m.id === selectedModel)?.name || 'Select Model'}
                    <ChevronUp className={`w-3.5 h-3.5 transition-transform duration-200 ${showModelDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {showModelDropdown && (
                    <div className="absolute bottom-[calc(100%+8px)] right-0 w-44 bg-[#1e293b] border border-gray-700/50 rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-200 z-50">
                      <div className="flex flex-col py-1">
                        {MODELS.map((model) => (
                          <button
                            key={model.id}
                            onClick={() => handleModelSelect(model.id)}
                            className={`px-4 py-2 text-left text-sm transition-colors ${
                              selectedModel === model.id
                                ? 'bg-[#3b82f6]/20 text-blue-400'
                                : 'text-gray-300 hover:bg-white/5 hover:text-gray-100'
                            }`}
                          >
                            {model.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  disabled={(!input.trim() && attachedImages.length === 0) || isLoading}
                  onClick={handleSubmit}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                    (!input.trim() && attachedImages.length === 0) || isLoading
                      ? 'bg-white/10 text-gray-500'
                      : 'bg-[#3b82f6] text-white hover:bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.5)]'
                  }`}
                >
                  <svg className="w-4 h-4 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="mt-3 text-center">
              <span className="text-[11px] text-gray-500 font-medium tracking-wide">
                Gemini can make mistakes. Please verify important information.
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default React.memo(ChatInterface);