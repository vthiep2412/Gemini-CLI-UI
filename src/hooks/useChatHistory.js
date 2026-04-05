import { useState, useEffect, useRef } from 'react';
import { api } from '../utils/api';
import { convertSessionMessages } from '../utils/messageConverter';

/**
 * Custom hook to handle loading and converting historical session messages.
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
  const [isLoadingSessionMessages, setIsLoadingSessionMessages] = useState(false);
  const lastLoadedSessionIdRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();

    const loadMessages = async () => {
      // Basic validation
      if (!selectedSession || !selectedProject) {
        setChatMessages([]);
        setCurrentSessionId(null);
        lastLoadedSessionIdRef.current = null;
        return;
      }

      const isNewSession = lastLoadedSessionIdRef.current !== selectedSession.id;

      if (isNewSession) {
        lastLoadedSessionIdRef.current = selectedSession.id;
        setCurrentSessionId(selectedSession.id);
        
        // Don't clear if it's a "system" session update (one that we triggered locally for switching)
        if (!isSystemSessionChange) {
          setChatMessages([]);
          setIsLoadingSessionMessages(true);

          try {
            const res = await api.sessionMessages(selectedProject.name, selectedSession.id, { signal: controller.signal });
            if (!res.ok) {
              throw new Error(`Failed to fetch messages: ${res.status}`);
            }
            
            const rawMessages = await res.json();
            const converted = convertSessionMessages(rawMessages);
            
            // Set the converted messages directly in one stroke
            setChatMessages(converted);

            if (autoScrollToBottom) {
              // Ensure we wait for DOM rendering after state change
              requestAnimationFrame(() => {
                setTimeout(() => scrollToBottom('instant'), 50);
              });
            }
          } catch (error) {
            if (error.name === 'AbortError') return;
            
            console.error('Failed to load session messages:', error);
            setChatMessages([{
              type: 'error',
              content: `Failed to load session history: ${error.message}. Please try refreshing.`,
              timestamp: new Date().toISOString()
            }]);
          } finally {
            if (!controller.signal.aborted) {
              setIsLoadingSessionMessages(false);
            }
          }
        } else {
          // Reset system trigger flag
          setIsSystemSessionChange(false);
        }
      }
    };
    
    loadMessages();
    return () => controller.abort();
  }, [
    selectedSession?.id, 
    selectedProject?.name, 
    scrollToBottom, 
    isSystemSessionChange, 
    autoScrollToBottom, 
    setChatMessages, 
    setCurrentSessionId, 
    setIsSystemSessionChange
  ]);

  return { isLoadingSessionMessages };
};
