import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useWebSocket } from '../utils/websocket';

const MessageContext = createContext();

export const MessageProvider = ({ children }) => {
  const { ws, sendMessage, messages, isConnected } = useWebSocket();
  
  // We can add additional message processing logic here if needed
  
  const value = {
    ws,
    sendMessage,
    messages,
    isConnected
  };

  return (
    <MessageContext.Provider value={value}>
      {children}
    </MessageContext.Provider>
  );
};

export const useMessages = () => {
  const context = useContext(MessageContext);
  if (!context) {
    throw new Error('useMessages must be used within a MessageProvider');
  }
  return context;
};
