import { useEffect, useRef } from 'react';
import { playNotificationSound } from '../utils/notificationSound';

/**
 * Custom hook to handle WebSocket messages and chat session lifecycle.
 * Extracted from ChatInterface.jsx to reduce complexity.
 */
export const useChatWebSocket = ({
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
}) => {
  const activeTimeoutsRef = useRef([]);
  const lastProcessedIndexRef = useRef(-1);

  useEffect(() => {
    return () => {
      activeTimeoutsRef.current.forEach(clearTimeout);
      activeTimeoutsRef.current = [];
    };
  }, []);
  useEffect(() => {
    if (messages.length > 0) {
      const latestIndex = messages.length - 1;
      if (latestIndex <= lastProcessedIndexRef.current) return;
      
      const latestMessage = messages[latestIndex];
      lastProcessedIndexRef.current = latestIndex;
      
      switch (latestMessage.type) {
        case 'session-created':
          if (latestMessage.sessionId && !currentSessionId) {
            sessionStorage.setItem('pendingSessionId', latestMessage.sessionId);
            if (onReplaceTemporarySession) {
              onReplaceTemporarySession(latestMessage.sessionId);
            }
          }
          break;
          
        case 'gemini-response': {
          if (!latestMessage.data) break;
          const messageData = latestMessage.data.message || latestMessage.data;
          // Detect session duplication bug
          if (latestMessage.data.type === 'system' && 
              latestMessage.data.subtype === 'init' && 
              latestMessage.data.session_id && 
              currentSessionId && 
              latestMessage.data.session_id !== currentSessionId) {
            
            setIsSystemSessionChange(true);
            if (onNavigateToSession) {
              onNavigateToSession(latestMessage.data.session_id);
            }
            return;
          }
          
          // Handle initial session assignment
          if (latestMessage.data.type === 'system' && 
              latestMessage.data.subtype === 'init' && 
              latestMessage.data.session_id && 
              !currentSessionId) {
            
            setIsSystemSessionChange(true);
            if (onNavigateToSession) {
              onNavigateToSession(latestMessage.data.session_id);
            }
            return;
          }
          
          // Ignore init messages for existing sessions
          if (latestMessage.data.type === 'system' && 
              latestMessage.data.subtype === 'init' && 
              latestMessage.data.session_id && 
              currentSessionId && 
              latestMessage.data.session_id === currentSessionId) {
            return;
          }
          
          // Process message data
          if (Array.isArray(messageData.content)) {
            for (const part of messageData.content) {
              if (part.type === 'tool_use') {
                let toolInput = '';
                try {
                  toolInput = part.input ? JSON.stringify(part.input, null, 2) : '';
                } catch {
                  toolInput = '[Unable to serialize input]';
                }
                setChatMessages(prev => [...prev, {
                  type: 'assistant',
                  content: '',
                  timestamp: new Date(),
                  isToolUse: true,
                  toolName: part.name,
                  toolInput: toolInput,
                  toolId: part.id,
                  toolResult: null
                }]);
                
                // File operation events
                if (['Write', 'write_file', 'Edit', 'MultiEdit', 'Create', 'Delete'].includes(part.name)) {
                  const timeoutId = setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('file-operation', {
                      detail: { 
                        toolName: part.name,
                        projectName: selectedProject?.name
                      }
                    }));
                    activeTimeoutsRef.current = activeTimeoutsRef.current.filter(id => id !== timeoutId);
                  }, 500);
                  activeTimeoutsRef.current.push(timeoutId);
                }
              } else if (part.type === 'text' && part.text?.trim()) {
                setChatMessages(prev => [...prev, {
                  type: 'assistant',
                  content: part.text,
                  timestamp: new Date()
                }]);
              }
            }
          } else if (typeof messageData.content === 'string' && messageData.content.trim()) {
            setChatMessages(prev => [...prev, {
              type: 'assistant',
              content: messageData.content,
              timestamp: new Date()
            }]);
          }
          
          // Attach tool results
          if (messageData.role === 'user' && Array.isArray(messageData.content)) {
            for (const part of messageData.content) {
              if (part.type === 'tool_result') {
                setChatMessages(prev => prev.map(msg => {
                  if (msg.isToolUse && msg.toolId === part.tool_use_id) {
                    return {
                      ...msg,
                      toolResult: {
                        content: part.content,
                        isError: part.is_error,
                        timestamp: new Date()
                      }
                    };
                  }
                  return msg;
                }));
              }
            }
          }
          break;
        }
          
        case 'gemini-output':
          setChatMessages(prev => [...prev, {
            type: 'assistant',
            content: latestMessage.data,
            timestamp: new Date()
          }]);
          break;

        case 'gemini-interactive-prompt':
          setChatMessages(prev => [...prev, {
            type: 'assistant',
            content: latestMessage.data,
            timestamp: new Date(),
            isInteractivePrompt: true
          }]);
          break;

        case 'gemini-error':
          setChatMessages(prev => [...prev, {
            type: 'error',
            content: `Error: ${latestMessage.error || 'An unknown error occurred'}`,
            timestamp: new Date()
          }]);
          setIsLoading(false);
          setCanAbortSession(false);
          setGeminiStatus(null);
          break;
          
        case 'gemini-complete': {
          setIsLoading(false);
          setCanAbortSession(false);
          setGeminiStatus(null);
          playNotificationSound();
          
          const activeSessionId = currentSessionId || sessionStorage.getItem('pendingSessionId');
          if (activeSessionId && onSessionInactive) {
            onSessionInactive(activeSessionId);
          }
          
          const pendingSessionId = sessionStorage.getItem('pendingSessionId');
          if (pendingSessionId && !currentSessionId && latestMessage.exitCode === 0) {
            setCurrentSessionId(pendingSessionId);
            sessionStorage.removeItem('pendingSessionId');
          }
          
          if (selectedProject && latestMessage.exitCode === 0) {
            localStorage.removeItem(`chat_messages_${selectedProject.name}`);
          }
          break;
        }
          
        case 'session-aborted':
          setIsLoading(false);
          setCanAbortSession(false);
          setGeminiStatus(null);
          
          if (currentSessionId && onSessionInactive) {
            onSessionInactive(currentSessionId);
          }
          
          setChatMessages(prev => [...prev, {
            type: 'assistant',
            content: 'Session interrupted by user.',
            timestamp: new Date()
          }]);
          break;

        case 'gemini-status': {
          const statusData = latestMessage.data;
          if (statusData) {
            let statusInfo = {
              text: 'Working...',
              tokens: 0,
              can_interrupt: true
            };
            
            if (statusData.message) statusInfo.text = statusData.message;
            else if (statusData.status) statusInfo.text = statusData.status;
            else if (typeof statusData === 'string') statusInfo.text = statusData;
            
            if (statusData.tokens) statusInfo.tokens = statusData.tokens;
            else if (statusData.token_count) statusInfo.tokens = statusData.token_count;
            
            if (statusData.can_interrupt !== undefined) {
              statusInfo.can_interrupt = statusData.can_interrupt;
            }
            
            setGeminiStatus(statusInfo);
            setIsLoading(true);
            setCanAbortSession(statusInfo.can_interrupt);
          }
          break;
        }
      }
    }
  }, [messages, currentSessionId, setCurrentSessionId, setChatMessages, setIsLoading, setCanAbortSession, setGeminiStatus, setIsSystemSessionChange, selectedProject, onReplaceTemporarySession, onNavigateToSession, onSessionInactive]);
};
