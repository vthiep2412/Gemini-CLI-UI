import React, { useState, useEffect, useRef, memo, useMemo } from 'react';
import clsx from 'clsx';
import ReactMarkdown from 'react-markdown';
import TodoList from '../TodoList';
import GeminiLogo from '../GeminiLogo.jsx';
import { EnhancedMessageRenderer } from '../EnhancedMessageRenderer';
import { useAuth } from '../../contexts/AuthContext';
import Avatar from '../common/Avatar';
import ToolRenderer from './ToolRenderer';
import { useTheme } from '../../contexts/ThemeContext';

const MessageItem = memo(({ 
  message, 
  prevMessage, 
  onFileOpen, 
  onShowSettings, 
  autoExpandTools, 
  showRawParameters
}) => {
  const { user } = useAuth();
  const { isDarkMode } = useTheme();
  const isGrouped = prevMessage && prevMessage.type === message.type && 
                   prevMessage.type === 'assistant' && 
                   !prevMessage.isToolUse && !message.isToolUse;
  const messageRef = useRef(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const isExpandedRef = useRef(isExpanded);

  // Sync ref with state
  useEffect(() => {
    isExpandedRef.current = isExpanded;
  }, [isExpanded]);

  useEffect(() => {
    if (!autoExpandTools || !messageRef.current || !message.isToolUse) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !isExpandedRef.current && messageRef.current) {
            setIsExpanded(true);
            isExpandedRef.current = true;
            const details = messageRef.current.querySelectorAll('details');
            details.forEach(detail => {
              detail.open = true;
            });
          }
        });
      },
      { threshold: 0.1 }
    );
    
    observer.observe(messageRef.current);
    return () => observer.disconnect();
  }, [autoExpandTools, message.isToolUse]);

  const promptData = useMemo(() => {
    if (!message.isInteractivePrompt) return null;
    const lines = message.content.split('\n').filter(line => line.trim());
    const questionLine = lines.find(line => line.includes('?')) || lines[0] || '';
    const options = [];
    
    lines.forEach(line => {
      const optionMatch = line.match(/[❯\s]*(\d+)\.\s+(.+)/);
      if (optionMatch) {
        options.push({
          number: optionMatch[1],
          text: optionMatch[2].trim(),
          isSelected: line.includes('❯')
        });
      }
    });
    
    return { questionLine, options };
  }, [message.isInteractivePrompt, message.content]);

  const bubbleClasses = useMemo(() => {
    const isUser = message.type === 'user';
    const isTool = message.isToolUse;
    
    return clsx(
      "relative px-4 py-3 sm:px-6 sm:py-4 rounded-2xl sm:rounded-3xl shadow-sm",
      {
        "bg-blue-600 text-white rounded-tr-none": isUser,
        "bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-tl-none": isTool,
        "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-100 dark:border-gray-700 rounded-tl-none": !isUser && !isTool
      }
    );
  }, [message.type, message.isToolUse]);

  return (
    <div 
      ref={messageRef}
      className={`group w-full flex flex-col ${isGrouped ? 'mt-1' : 'mt-6 sm:mt-8'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
    >
      {!isGrouped && (
        <div className={`flex items-center gap-3 mb-2 ${message.type === 'user' ? 'flex-row-reverse self-end pr-1 sm:pr-2' : 'pl-1 sm:pl-2'}`}>
          <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 shadow-sm border border-gray-100 dark:border-gray-800">
            {message.type === 'user' ? (
              <Avatar user={user} size="sm" />
            ) : (
              <div className="w-full h-full bg-linear-to-br from-blue-600 to-indigo-700 flex items-center justify-center">
                <GeminiLogo className="w-5 h-5 text-white" />
              </div>
            )}
          </div>
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {message.type === 'user' ? (user?.name || 'You') : 'Gemini'}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500 font-normal">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      )}

      <div className={`flex flex-col max-w-[92%] sm:max-w-[85%] ${message.type === 'user' ? 'self-end' : 'self-start'}`}>
        <div className={bubbleClasses}>
              {message.isToolUse && (
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-blue-100 dark:border-blue-800">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-blue-100 dark:bg-blue-800 rounded-lg flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                      </svg>
                    </div>
                    <span className="font-medium text-blue-900 dark:text-blue-100">Using {message.toolName}</span>
                    <span className="text-xs text-blue-600 dark:text-blue-400 font-mono">{message.toolId}</span>
                  </div>
                  {onShowSettings && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onShowSettings();
                      }}
                      className="p-1 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                      title="Tool Settings"
                    >
                      <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </button>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-2">
                {message.isToolUse ? (
                  <ToolRenderer 
                    message={message}
                    autoExpandTools={autoExpandTools}
                    showRawParameters={showRawParameters}
                    onFileOpen={onFileOpen}
                  />
                ) : message.isInteractivePrompt ? (
                   <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                     <div className="flex items-start gap-3">
                       <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                         <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                         </svg>
                       </div>
                       <div className="flex-1">
                         <h4 className="font-semibold text-amber-900 dark:text-amber-100 text-base mb-3">Interactive Prompt</h4>
                         {promptData && (
                           <>
                             <p className="text-sm text-amber-800 dark:text-amber-200 mb-4">{promptData.questionLine}</p>
                             <div className="space-y-2 mb-4">
                               {promptData.options.map((option) => (
                                 <button
                                   key={option.number}
                                   className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                                     option.isSelected
                                       ? 'bg-amber-600 dark:bg-amber-700 text-white border-amber-600 dark:border-amber-700 shadow-md'
                                       : 'bg-white dark:bg-gray-800 text-amber-900 dark:text-amber-100 border-amber-300 dark:border-amber-700'
                                   } cursor-not-allowed opacity-75`}
                                   disabled
                                 >
                                   <div className="flex items-center gap-3">
                                     <span className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                       option.isSelected ? 'bg-white/20' : 'bg-amber-100 dark:bg-amber-800/50'
                                     }`}>{option.number}</span>
                                     <span className="text-sm sm:text-base font-medium flex-1">{option.text}</span>
                                     {option.isSelected && <span className="text-lg">❯</span>}
                                   </div>
                                 </button>
                               ))}
                             </div>
                           </>
                         )}
                         <div className="bg-amber-100 dark:bg-amber-800/30 rounded-lg p-3">
                           <p className="text-amber-900 dark:text-amber-100 text-sm font-medium mb-1">⏳ Waiting for your response in the CLI</p>
                           <p className="text-amber-800 dark:text-amber-200 text-xs">Please select an option in your terminal where Gemini is running.</p>
                         </div>
                       </div>
                     </div>
                   </div>
                ) : (
                  <div className={`text-sm ${message.type === 'error' ? 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800 relative' : 'text-gray-700 dark:text-gray-300'}`}>
                    {message.type === 'error' && (
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(message.content).catch(() => {});
                        }}
                        className="absolute top-2 right-2 px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                      >Copy</button>
                    )}
                    {message.type === 'assistant' ? (
                      <EnhancedMessageRenderer 
                        content={message.content} 
                        isDarkMode={isDarkMode}
                      />
                    ) : (
                      <div className={`whitespace-pre-wrap ${message.type === 'error' ? 'select-all cursor-text pr-16' : ''}`}>
                        {message.content}
                      </div>
                    )}
                  </div>
                )}

                {message.toolResult && (
                  <div className="mt-3 border-t border-blue-200 dark:border-blue-700 pt-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-4 h-4 rounded flex items-center justify-center ${message.toolResult.isError ? 'bg-red-500' : 'bg-green-500'}`}>
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {message.toolResult.isError ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          )}
                        </svg>
                      </div>
                      <span className={`text-sm font-medium ${message.toolResult.isError ? 'text-red-700 dark:text-red-300' : 'text-green-700 dark:text-green-300'}`}>
                        {message.toolResult.isError ? 'Tool Error' : 'Tool Result'}
                      </span>
                    </div>
                    
                    <div className={`text-sm ${message.toolResult.isError ? 'text-red-800 dark:text-red-200' : 'text-green-800 dark:text-green-200'}`}>
                      {(() => {
                        const content = String(message.toolResult.content || '');
                        
                        const isJsonArray = content.trim().startsWith('[');
                        
                        if (message.toolName === 'TodoWrite' || message.toolName === 'TodoRead') {
                          try {
                            let todos = null;
                            if (isJsonArray) {
                              todos = JSON.parse(content.trim());
                            } else if (content.includes('Todos')) {
                              // Locate the start of the JSON array after the "Todos" marker
                              const markerIndex = content.indexOf('Todos');
                              const startIndex = content.indexOf('[', markerIndex);
                              if (startIndex !== -1) {
                                const jsonPart = content.substring(startIndex);
                                // Find the matching closing bracket to extract the JSON array
                                const lastBracketIndex = jsonPart.lastIndexOf(']');
                                if (lastBracketIndex !== -1) {
                                  const finalJson = jsonPart.substring(0, lastBracketIndex + 1);
                                  todos = JSON.parse(finalJson);
                                }
                              }
                            }

                            if (todos && Array.isArray(todos)) {
                              return (
                                <div>
                                  <div className="font-medium mb-2">Current Todo List</div>
                                  <TodoList todos={todos} isResult={true} />
                                </div>
                              );
                            }
                          } catch (e) { 
                            console.error('Error parsing todo list:', e);
                          }
                        }

                        if (message.toolName === 'exit_plan_mode') {
                          try {
                            const parsed = JSON.parse(content);
                            if (parsed.plan) {
                              const planContent = parsed.plan.replace(/\\n/g, '\n');
                              return (
                                <div>
                                  <div className="font-medium mb-2">Implementation Plan</div>
                                  <div className="prose prose-sm max-w-none dark:prose-invert">
                                    <ReactMarkdown>{planContent}</ReactMarkdown>
                                  </div>
                                </div>
                              );
                            }
                          } catch (e) {
                             console.error('Error parsing plan result:', e);
                          }
                        }

                        if (content.includes('Do you want to proceed?') && message.toolName === 'Bash') {
                          return <div className="font-mono text-xs p-2 bg-gray-900 text-gray-100 rounded break-all whitespace-pre-wrap">{content}</div>;
                        }

                        return <div className="whitespace-pre-wrap break-all">{content}</div>;
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>
      </div>
    </div>
  );
});

MessageItem.displayName = 'MessageItem';
export default MessageItem;
