import React from 'react';
import { MessageSquare, Folder, Terminal, GitBranch, Bookmark, Globe } from 'lucide-react';

function MobileNav({ activeTab, setActiveTab, isInputFocused, selectedProject }) {
  // Detect dark mode
  const [isDarkMode, setIsDarkMode] = React.useState(
    () => document.documentElement.classList.contains('dark')
  );

  React.useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.attributeName === 'class') {
          setIsDarkMode(document.documentElement.classList.contains('dark'));
        }
      }
    });
    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);
  const navItems = [
    { id: 'chat', icon: MessageSquare, onClick: () => setActiveTab('chat') },
    { id: 'bookmark', icon: Bookmark, onClick: () => setActiveTab('bookmark') },
    ...(selectedProject ? [
      { id: 'shell', icon: Terminal, onClick: () => setActiveTab('shell') },
      { id: 'ide', icon: Folder, onClick: () => setActiveTab('ide') },
      { id: 'git', icon: GitBranch, onClick: () => setActiveTab('git') }
    ] : [])
  ];

  return (
    <>
      <style>{`
        .mobile-nav-container {
          background-color: ${isDarkMode ? '#1f2937' : '#ffffff'} !important;
        }
        .mobile-nav-container:hover {
          background-color: ${isDarkMode ? '#1f2937' : '#ffffff'} !important;
        }
        @keyframes fadeInSlide {
          from { opacity: 0; transform: translateX(-5px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
      <div 
        className={`mobile-nav-container fixed bottom-0 left-0 right-0 border-t border-gray-200 dark:border-gray-700 z-50 ios-bottom-safe transform transition-transform duration-300 ease-in-out shadow-lg ${
          isInputFocused ? 'translate-y-full' : 'translate-y-0'
        }`}
      >
        <div className="flex items-center justify-around py-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={item.onClick}
                onTouchStart={(e) => {
                  e.preventDefault();
                  item.onClick();
                }}
                className={`flex items-center gap-1.5 justify-center p-2 rounded-full relative touch-manipulation transition-all duration-300 ${
                  isActive
                    ? 'bg-blue-600/10 text-blue-600 dark:bg-blue-400/10 dark:text-blue-400 px-4'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white min-w-[40px]'
                }`}
                aria-label={item.id}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {isActive && (
                  <span className="text-sm font-medium capitalize overflow-hidden whitespace-nowrap" style={{
                    animation: 'fadeInSlide 0.3s ease-out forwards'
                  }}>
                    {item.id}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

export default React.memo(MobileNav);
