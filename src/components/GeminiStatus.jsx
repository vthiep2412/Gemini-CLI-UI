import React, { useState, useEffect } from 'react';

function GeminiStatus({ status, onAbort, isLoading }) {
  const [elapsedTime, setElapsedTime] = useState(0);

  // Update elapsed time every second
  useEffect(() => {
    if (!isLoading) {
      setElapsedTime(0);
      return;
    }
    
    const startTime = Date.now();
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setElapsedTime(elapsed);
    }, 1000);
    
    return () => clearInterval(timer);
  }, [isLoading]);
  
  if (!isLoading) return null;
  
  // Clever action words that cycle
  const actionWords = ['Thinking', 'Processing', 'Analyzing', 'Working', 'Computing', 'Reasoning'];
  const actionIndex = Math.floor(elapsedTime / 3) % actionWords.length;
  
  // Parse status data
  const statusText = status?.text || actionWords[actionIndex];
  const canInterrupt = status?.can_interrupt !== false;
  
  return (
    <div className="w-full mb-6 animate-in slide-in-from-bottom-4 duration-500 ease-out fill-mode-both">
      <div className="flex items-center justify-between max-w-4xl mx-auto glass dark:glass-dark text-gray-900 dark:text-white rounded-2xl shadow-xl px-5 py-3.5 border border-white/20 dark:border-gray-700/50">
        <div className="flex items-center gap-4 flex-1">
          {/* Animated Pulse Indicator */}
          <div className="relative flex items-center justify-center">
            <div className="w-3 h-3 bg-cyan-500 rounded-full shadow-[0_0_10px_rgba(6,182,212,0.5)]" />
            <div className="absolute inset-0 w-3 h-3 bg-cyan-400 rounded-full animate-ping motion-reduce:animate-none opacity-60" />
            <div className="absolute -inset-1 w-5 h-5 bg-cyan-500/20 rounded-full animate-pulse motion-reduce:animate-none" />
          </div>
          
          <div className="flex flex-col">
            <div className="flex items-center gap-2.5">
              <span className="font-semibold text-sm tracking-tight">{statusText}</span>
              <div className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600 shadow-sm" />
              <span className="text-[11px] font-mono text-gray-500 dark:text-gray-400 opacity-80">{elapsedTime}s</span>
            </div>
            {status?.tokens > 0 && (
              <div className="text-[10px] text-gray-400 dark:text-gray-500 font-medium tabular-nums mt-0.5">
                Processed {status.tokens} tokens
              </div>
            )}
          </div>
        </div>
        
        {/* Interrupt button */}
        {canInterrupt && onAbort && (
          <button
            onClick={onAbort}
            className="group ml-4 px-3.5 py-1.5 bg-red-500/10 hover:bg-red-500 text-red-600 dark:text-red-400 hover:text-white border border-red-500/20 hover:border-red-500 rounded-full transition-all duration-300 flex items-center gap-1.5 shrink-0 text-xs font-bold uppercase tracking-wider"
            title="Abort Generation"
            aria-label="Abort Generation"
          >
            <svg className="w-3.5 h-3.5 transition-transform group-hover:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span className="hidden sm:inline">Abort</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default GeminiStatus;