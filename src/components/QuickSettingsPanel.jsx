import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Maximize2, 
  Eye, 
  Settings2,
  Moon,
  Sun,
  ArrowDown,
  Mic,
  Brain,
  Sparkles,
  FileText,
  Settings
} from 'lucide-react';
import DarkModeToggle from './DarkModeToggle';
import { useTheme } from '../contexts/ThemeContext';
import Switch from './ui/Switch';

const QuickSettingsPanel = ({ 
  isOpen, 
  onToggle,
  autoExpandTools,
  onAutoExpandChange,
  showRawParameters,
  onShowRawParametersChange,
  autoScrollToBottom,
  onAutoScrollChange,
  isMobile
}) => {
  const [localIsOpen, setLocalIsOpen] = useState(isOpen);
  const [whisperMode, setWhisperMode] = useState(() => {
    return localStorage.getItem('whisperMode') || 'default';
  });
  const { isDarkMode } = useTheme();

  useEffect(() => {
    setLocalIsOpen(isOpen);
  }, [isOpen]);

  const handleToggle = () => {
    const newState = !localIsOpen;
    setLocalIsOpen(newState);
    onToggle(newState);
  };

  return (
    <>
      {/* Floating Settings Button - Bottom Right */}
      <div
        className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ease-in-out ${
          localIsOpen ? 'opacity-0 scale-90 pointer-events-none' : 'opacity-100 scale-100'
        }`}
      >
        <button
          onClick={handleToggle}
          className="flex items-center justify-center w-12 h-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-all shadow-xl hover:shadow-2xl active:scale-95 group"
          aria-label="Open settings panel"
        >
          <Settings className="h-6 w-6 text-gray-600 dark:text-gray-400 group-hover:rotate-90 transition-transform duration-500" />
        </button>
      </div>

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-72 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-l border-gray-200/50 dark:border-gray-700/50 shadow-2xl transform transition-all duration-300 ease-in-out z-50 ${
          localIsOpen ? 'translate-x-0' : 'translate-x-full'
        } ${isMobile ? 'h-screen w-full sm:w-80' : ''}`}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-gray-200/50 dark:border-gray-700/50 flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Settings2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              Quick Settings
            </h3>
            <button
              onClick={handleToggle}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
            >
              <ChevronRight className="h-6 w-6 text-gray-500" />
            </button>
          </div>

          {/* Settings Content */}
          <div className={`flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-8 ${isMobile ? 'pb-24' : ''}`}>
            {/* Appearance Settings */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500 mb-2">Appearance</h4>
              
              <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50/50 dark:bg-gray-800/50 hover:bg-gray-100/50 dark:hover:bg-gray-750/50 transition-all border border-transparent hover:border-gray-200 dark:hover:border-gray-700 group">
                <span className="flex items-center gap-3 text-sm font-medium text-gray-900 dark:text-white">
                  <div className={`p-1.5 rounded-md transition-colors ${isDarkMode ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'}`}>
                    {isDarkMode ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                  </div>
                  Dark Mode
                </span>
                <DarkModeToggle />
              </div>
            </div>

            {/* Tool Display Settings */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500 mb-2">Tool Display</h4>
              
              <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50/50 dark:bg-gray-800/50 hover:bg-gray-100/50 dark:hover:bg-gray-750/50 transition-all border border-transparent hover:border-gray-200 dark:hover:border-gray-700 group">
                <span className="flex items-center gap-3 text-sm font-medium text-gray-900 dark:text-white">
                  <div className="p-1.5 bg-cyan-100 dark:bg-cyan-900/30 rounded-md text-cyan-600 dark:text-cyan-400">
                    <Maximize2 className="h-4 w-4" />
                  </div>
                  Auto-expand tools
                </span>
                <Switch
                  checked={autoExpandTools}
                  onChange={onAutoExpandChange}
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50/50 dark:bg-gray-800/50 hover:bg-gray-100/50 dark:hover:bg-gray-750/50 transition-all border border-transparent hover:border-gray-200 dark:hover:border-gray-700 group">
                <span className="flex items-center gap-3 text-sm font-medium text-gray-900 dark:text-white">
                  <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-md text-emerald-600 dark:text-emerald-400">
                    <Eye className="h-4 w-4" />
                  </div>
                  Show raw parameters
                </span>
                <Switch
                  checked={showRawParameters}
                  onChange={onShowRawParametersChange}
                />
              </div>
            </div>

            {/* View Options */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500 mb-2">View Options</h4>
              
              <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50/50 dark:bg-gray-800/50 hover:bg-gray-100/50 dark:hover:bg-gray-750/50 transition-all border border-transparent hover:border-gray-200 dark:hover:border-gray-700 group">
                <span className="flex items-center gap-3 text-sm font-medium text-gray-900 dark:text-white">
                  <div className="p-1.5 bg-violet-100 dark:bg-violet-900/30 rounded-md text-violet-600 dark:text-violet-400">
                    <ArrowDown className="h-4 w-4" />
                  </div>
                  Auto-scroll
                </span>
                <Switch
                  checked={autoScrollToBottom}
                  onChange={onAutoScrollChange}
                />
              </div>
            </div>

            {/* Whisper Dictation Settings - HIDDEN */}
            <div className="space-y-2" style={{ display: 'none' }}>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Whisper Dictation</h4>
              
              <div className="space-y-2">
                <label className="flex items-start p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors border border-transparent hover:border-gray-300 dark:hover:border-gray-600">
                  <input
                    type="radio"
                    name="whisperMode"
                    value="default"
                    checked={whisperMode === 'default'}
                    onChange={() => {
                      setWhisperMode('default');
                      localStorage.setItem('whisperMode', 'default');
                      window.dispatchEvent(new Event('whisperModeChanged'));
                    }}
                    className="mt-0.5 h-4 w-4 border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-500 focus:ring-blue-500 dark:focus:ring-blue-400 dark:bg-gray-800 dark:checked:bg-blue-600"
                  />
                  <div className="ml-3 flex-1">
                    <span className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                      <Mic className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                      Default Mode
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Direct transcription of your speech
                    </p>
                  </div>
                </label>

                <label className="flex items-start p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors border border-transparent hover:border-gray-300 dark:hover:border-gray-600">
                  <input
                    type="radio"
                    name="whisperMode"
                    value="prompt"
                    checked={whisperMode === 'prompt'}
                    onChange={() => {
                      setWhisperMode('prompt');
                      localStorage.setItem('whisperMode', 'prompt');
                      window.dispatchEvent(new Event('whisperModeChanged'));
                    }}
                    className="mt-0.5 h-4 w-4 border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-500 focus:ring-blue-500 dark:focus:ring-blue-400 dark:bg-gray-800 dark:checked:bg-blue-600"
                  />
                  <div className="ml-3 flex-1">
                    <span className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                      <Sparkles className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                      Prompt Enhancement
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Transform rough ideas into clear, detailed AI prompts
                    </p>
                  </div>
                </label>

                <label className="flex items-start p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors border border-transparent hover:border-gray-300 dark:hover:border-gray-600">
                  <input
                    type="radio"
                    name="whisperMode"
                    value="vibe"
                    checked={whisperMode === 'vibe' || whisperMode === 'instructions' || whisperMode === 'architect'}
                    onChange={() => {
                      setWhisperMode('vibe');
                      localStorage.setItem('whisperMode', 'vibe');
                      window.dispatchEvent(new Event('whisperModeChanged'));
                    }}
                    className="mt-0.5 h-4 w-4 border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-500 focus:ring-blue-500 dark:focus:ring-blue-400 dark:bg-gray-800 dark:checked:bg-blue-600"
                  />
                  <div className="ml-3 flex-1">
                    <span className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                      <FileText className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                      Vibe Mode
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Format ideas as clear agent instructions with details
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Backdrop */}
      {localIsOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-30 transition-opacity duration-150 ease-out"
          onClick={handleToggle}
        />
      )}
    </>
  );
};

export default QuickSettingsPanel;