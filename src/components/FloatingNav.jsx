import React from 'react';
import { MessageSquare, Terminal, FolderTree, GitBranch, Play } from 'lucide-react';

const FloatingNav = ({ activeTab, setActiveTab, isMobile }) => {
  const tabs = [
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'shell', label: 'Shell', icon: Terminal },
    { id: 'files', label: 'Files', icon: FolderTree },
    { id: 'git', label: 'Git', icon: GitBranch },
  ];

  if (isMobile) return null; // Use mobile-specific nav if needed, but for now we'll stick to this for desktop

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-40">
      <nav className="flex items-center gap-1 bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 p-1.5 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                relative flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300
                ${isActive 
                  ? 'text-white shadow-lg' 
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-gray-800/50'}
              `}
            >
              {isActive && (
                <div className="absolute inset-0 bg-blue-600 rounded-full -z-10 animate-in fade-in zoom-in duration-300" />
              )}
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : ''}`} />
              <span className="relative">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default FloatingNav;
