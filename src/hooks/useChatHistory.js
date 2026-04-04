import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { api } from '../utils/api';
const IGNORE_PREFIX_COMMAND = '<command-name>';
const IGNORE_PREFIX_INTERRUPTED = '[Request interrupted';

/**
 * Custom hook to handle loading and converting historical session messages.
 * Extracted from ChatInterface.jsx.
 */
export const useChatHistory = ({
  selectedSession,
  selectedProject,
  isSystemSessionChange,
  setIsSystemSessionChange,
  setChatMessages,
  autoScrollToBottom,
  scrollToBottom,
  setCurrentSessionId
}) => {
  const [sessionMessages, setSessionMessages] = useState([]);
  const [isLoadingSessionMessages, setIsLoadingSessionMessages] = useState(false);
  const lastLoadedSessionIdRef = useRef(null);

  const convertSessionMessages = useCallback((rawMessages) => {
    const converted = [];
    const toolResults = new Map();
    
    // First pass: collect results
    for (const msg of rawMessages) {
      if (msg.message?.role === 'user' && Array.isArray(msg.message?.content)) {
        for (const part of msg.message.content) {
          if (part.type === 'tool_result') {
            toolResults.set(part.tool_use_id, {
              content: part.content,
              isError: part.is_error,
              timestamp: new Date(msg.timestamp || Date.now())
            });
          }
        }
      }
    }
    
    // Second pass: process messages
    for (const msg of rawMessages) {
      if (msg.message?.role === 'user' && msg.message?.content) {
        const content = Array.isArray(msg.message.content)
          ? msg.message.content
              .filter(p => p.type === 'text')
              .map(p => p.text)
              .join('\n')
          : String(msg.message.content);
        
        if (content && !content.startsWith(IGNORE_PREFIX_COMMAND) && !content.startsWith(IGNORE_PREFIX_INTERRUPTED)) {
          converted.push({
            type: 'user',
            content: content,
            timestamp: msg.timestamp || new Date().toISOString()
          });
        }
      } else if (msg.message?.role === 'assistant' && msg.message?.content) {
        if (Array.isArray(msg.message.content)) {
          for (const part of msg.message.content) {
            if (part.type === 'text') {
              converted.push({
                type: 'assistant',
                content: part.text,
                timestamp: msg.timestamp || new Date().toISOString()
              });
            } else if (part.type === 'tool_use') {
              const toolResult = toolResults.get(part.id);
              converted.push({
                type: 'assistant',
                content: '',
                timestamp: msg.timestamp || new Date().toISOString(),
                isToolUse: true,
                toolName: part.name,
                toolInput: JSON.stringify(part.input),
                toolResult: formatToolResultContent(toolResult),
                toolError: toolResult?.isError || false,
                toolResultTimestamp: toolResult?.timestamp || new Date()
              });
            }
          }
        } else if (typeof msg.message.content === 'string') {
          converted.push({
            type: 'assistant',
            content: msg.message.content,
            timestamp: msg.timestamp || new Date().toISOString()
          });
        }
      }
    }
    return converted;
  }, []);

  const convertedMessages = useMemo(() => {
    return convertSessionMessages(sessionMessages);
  }, [sessionMessages, convertSessionMessages]);

  useEffect(() => {
    const controller = new AbortController();

    const loadMessages = async () => {
      if (selectedSession && selectedProject) {
        const isNewSession = lastLoadedSessionIdRef.current !== selectedSession.id;
        if (isNewSession) {
          lastLoadedSessionIdRef.current = selectedSession.id;
          setCurrentSessionId(selectedSession.id);
          
          if (!isSystemSessionChange) {
            setChatMessages([]);
            setSessionMessages([]);
            setIsLoadingSessionMessages(true);
            try {
              const res = await api.sessionMessages(selectedProject.name, selectedSession.id, { signal: controller.signal });
              const messages = await res.json();
              
              setSessionMessages(messages);
              if (autoScrollToBottom) {
                requestAnimationFrame(() => scrollToBottom());
              }
            } catch (error) {
              if (error.name === 'AbortError') return;
              
              console.error('Failed to load session messages:', error);
              setChatMessages([{
                type: 'error',
                content: 'Failed to load session messages. Please try refreshing.',
                timestamp: new Date().toISOString()
              }]);
            } finally {
              if (!controller.signal.aborted) {
                setIsLoadingSessionMessages(false);
              }
            }
          } else {
            setIsSystemSessionChange(false);
          }
        }
      } else {
        setChatMessages([]);
        setSessionMessages([]);
        setCurrentSessionId(null);
        lastLoadedSessionIdRef.current = null;
      }
    };
    
    loadMessages();
    return () => controller.abort();
  }, [selectedSession?.id, selectedProject?.name, scrollToBottom, isSystemSessionChange, autoScrollToBottom, setChatMessages, setCurrentSessionId, setIsSystemSessionChange]);

  useEffect(() => {
    if (sessionMessages.length > 0) {
      setChatMessages(convertedMessages);
    }
  }, [convertedMessages, sessionMessages, setChatMessages]);
  
  return { isLoadingSessionMessages };
};

// Helper to normalize tool result content
const formatToolResultContent = (toolResult) => {
  if (!toolResult) return null;
  return typeof toolResult.content === 'string' ? toolResult.content : JSON.stringify(toolResult.content);
};
