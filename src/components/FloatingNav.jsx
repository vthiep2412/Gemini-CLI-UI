import React from 'react';
import { MessageSquare, Terminal, FolderTree, GitBranch, Bookmark } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMobile } from '../hooks/useMobile';

const FloatingNav = React.memo(({ activeTab, setActiveTab, selectedProject }) => {
  const isMobile = useMobile();
  const tabs = [
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'bookmark', label: 'Bookmark', icon: Bookmark },
    ...(selectedProject ? [
      { id: 'shell', label: 'Shell', icon: Terminal },
      { id: 'ide', label: 'IDE', icon: FolderTree },
      { id: 'git', label: 'Git', icon: GitBranch },
    ] : []),
  ];

  return (
    <nav className={`
      flex items-center backdrop-blur-md border border-white/20 dark:border-white/10 rounded-full
      ${isMobile 
        ? 'gap-1.5 bg-white/80 dark:bg-[#0a0f1e]/80 p-1 shadow-[0_8px_32px_rgba(0,0,0,0.2)]' 
        : 'gap-1 bg-white/70 dark:bg-white/5 p-1 shadow-[0_8px_32px_rgba(0,0,0,0.12)]'}
    `}>
      <AnimatePresence mode="popLayout">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <motion.button
              key={tab.id}
              layout
              initial={{ opacity: 0, scale: 0.5, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.5, y: -15 }}
              whileHover={{ 
                scale: 1.02,
                backgroundColor: "rgba(59, 130, 246, 0.12)",
                filter: "drop-shadow(0 0 2px rgba(59, 130, 246, 0.15))",
                transition: { duration: 0.1 }
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
                relative flex items-center transition-all duration-300 ease-in-out rounded-full text-sm
                ${isMobile ? 'px-3 py-2 font-bold' : 'gap-2 px-3 sm:px-4 py-1.5 sm:py-2 font-medium'}
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
              <Icon className={`${isMobile ? 'w-[18px] h-[18px]' : 'w-4 h-4'} ${isActive ? 'text-white' : ''}`} />
              
              {isMobile ? (
                <AnimatePresence mode="wait">
                  {isActive && (
                    <motion.span
                      key={`label-${tab.id}`}
                      layout
                      initial={{ width: 0, opacity: 0, marginLeft: 0 }}
                      animate={{ width: "auto", opacity: 1, marginLeft: 4 }}
                      exit={{ width: 0, opacity: 0, marginLeft: 0 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                      className="relative overflow-hidden whitespace-nowrap text-[13px] font-black tracking-tight"
                    >
                      {tab.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              ) : (
                <span className={`relative ${tabs.length > 2 ? 'hidden sm:inline-block' : 'inline-block'}`}>
                  {tab.label}
                </span>
              )}
            </motion.button>
          );
        })}
      </AnimatePresence>
    </nav>
  );
});

export default FloatingNav;
