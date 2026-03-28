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
  Settings,
  X,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
  isMobile,
  activeTab = 'chat'
}) => {
  const [localIsOpen, setLocalIsOpen] = useState(isOpen);
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
      {/* Floating Settings Button */}
      <AnimatePresence>
        {!localIsOpen && activeTab === 'chat' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            className="fixed bottom-6 right-6 z-50 pointer-events-auto"
          >
            <button
              onClick={handleToggle}
              className="flex items-center justify-center w-12 h-12 bg-background/80 dark:bg-card/70 backdrop-blur-xl border border-border/50 rounded-full hover:bg-muted/50 transition-all shadow-xl hover:shadow-2xl active:scale-95 group"
              aria-label="Open settings panel"
            >
              <Settings className="h-5 w-5 text-muted-foreground group-hover:rotate-90 group-hover:text-blue-500 transition-all duration-500" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Side Panel */}
      <AnimatePresence>
        {localIsOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleToggle}
              className="fixed inset-0 bg-black/10 backdrop-blur-[2px] z-[100] pointer-events-auto"
            />

            {/* Panel Content */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={`fixed top-0 right-0 h-full w-72 bg-background/80 dark:bg-card/70 backdrop-blur-2xl border-l border-border/50 shadow-2xl z-[101] flex flex-col pointer-events-auto ${
                isMobile ? 'w-full' : ''
              }`}
            >
              <div className="p-6 border-b border-border/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-600/10 rounded-xl">
                    <Settings2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-cyan-500 dark:from-blue-400 dark:to-cyan-400">
                    Quick Access
                  </h3>
                </div>
                <button
                  onClick={handleToggle}
                  className="p-2 hover:bg-muted rounded-full transition-colors group"
                >
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* Theme Section */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">Theme</h4>
                  <div className="p-4 rounded-2xl bg-muted/30 border border-border/50 hover:bg-muted/40 transition-all group flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 rounded-lg ${isDarkMode ? 'bg-indigo-500/10 text-indigo-500' : 'bg-orange-500/10 text-orange-500'}`}>
                        {isDarkMode ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                      </div>
                      <span className="text-sm font-medium">Dark Mode</span>
                    </div>
                    <DarkModeToggle />
                  </div>
                </div>

                {/* Preference Section */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">Display Preferences</h4>
                  
                  <div className="p-4 rounded-2xl bg-muted/30 border border-border/50 hover:bg-muted/40 transition-all space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-cyan-500/10 rounded-lg text-cyan-500">
                          <Maximize2 className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-medium">Auto-expand</span>
                      </div>
                      <Switch
                        checked={autoExpandTools}
                        onChange={onAutoExpandChange}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-500">
                          <Eye className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-medium">Raw Params</span>
                      </div>
                      <Switch
                        checked={showRawParameters}
                        onChange={onShowRawParametersChange}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-violet-500/10 rounded-lg text-violet-500">
                          <ArrowDown className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-medium">Auto-scroll</span>
                      </div>
                      <Switch
                        checked={autoScrollToBottom}
                        onChange={onAutoScrollChange}
                      />
                    </div>
                  </div>
                </div>

                {/* Footer Link */}
                <div className="pt-4 border-t border-border/50">
                  <button 
                    onClick={() => {
                        handleToggle();
                    }}
                    className="w-full flex items-center justify-between p-4 rounded-2xl bg-blue-600/5 border border-blue-600/10 hover:bg-blue-600/10 transition-all group"
                  >
                    <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">Advanced Settings</span>
                    <ChevronRight className="h-4 w-4 text-blue-600 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default QuickSettingsPanel;