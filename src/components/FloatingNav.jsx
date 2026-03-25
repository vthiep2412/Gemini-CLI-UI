import React from 'react';
import { MessageSquare, Terminal, FolderTree, GitBranch, Bookmark } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const FloatingNav = React.memo(({ activeTab, setActiveTab, selectedProject }) => {
  const tabs = [
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'bookmark', label: 'Bookmark', icon: Bookmark },
    ...(selectedProject ? [
      { id: 'shell', label: 'Shell', icon: Terminal },
      { id: 'files', label: 'Files', icon: FolderTree },
      { id: 'git', label: 'Git', icon: GitBranch },
    ] : []),
  ];

  return (
    <nav className="flex items-center gap-1 bg-white/70 dark:bg-gray-900/70 backdrop-blur-md border border-white/20 dark:border-gray-700/50 p-1 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
      <AnimatePresence mode="popLayout">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <motion.button
              key={tab.id}
              initial={{ opacity: 0, scale: 0.5, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.5, y: -15 }}
              whileHover={{ 
                scale: 1.02,
                backgroundColor: "rgba(59, 130, 246, 0.12)",
                filter: "drop-shadow(0 0 2px rgba(59, 130, 246, 0.15))",
                transition: { duration: 0.2 }
              }}
              whileTap={{ 
                scale: 0.98,
                transition: { duration: 0.1 }
              }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 28,
                mass: 1
              }}
              onClick={() => setActiveTab(tab.id)}
              className={`
                relative flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-sm font-medium transition-all duration-300 ease-in-out
                ${isActive 
                  ? 'text-white' 
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}
              `}
            >
              {isActive && (
                <motion.div
                  layoutId="active-pill"
                  className="absolute inset-0 bg-blue-600 rounded-full -z-10 shadow-[0_2px_6px_rgba(37,99,235,0.15)]"
                  transition={{
                    type: "spring",
                    stiffness: 350, // Smoother jump
                    damping: 30,    // More damping for less "boing"
                    mass: 1.2       // Slightly heavier for a premium feel
                  }}
                />
              )}
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : ''}`} />
              <span className={`relative ${tabs.length > 2 ? 'hidden sm:inline-block' : 'inline-block'}`}>
                {tab.label}
              </span>
            </motion.button>
          );
        })}
      </AnimatePresence>
    </nav>
  );
});

export default FloatingNav;
