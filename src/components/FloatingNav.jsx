import React from 'react';
import { MessageSquare, Terminal, FolderTree, GitBranch, Bookmark } from 'lucide-react';
import { motion } from 'framer-motion';
import { useMobile } from '../hooks/useMobile';
import { cn } from '../lib/utils';

const FloatingNav = React.memo(({ activeTab, setActiveTab, selectedProject, forceCollapsed = false }) => {
  const isMobile = useMobile();
  const shouldCollapse = isMobile || forceCollapsed;
  const [hoveredTab, setHoveredTab] = React.useState(null);

  const tabs = React.useMemo(() => [
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'bookmark', label: 'Bookmark', icon: Bookmark },
    ...(selectedProject ? [
      { id: 'shell', label: 'Shell', icon: Terminal },
      { id: 'ide', label: 'IDE', icon: FolderTree },
      { id: 'git', label: 'Git', icon: GitBranch },
    ] : []),
  ], [selectedProject]);

  // Track hover history to decide between "Float Out" and "Fade In"
  const lastHoveredTab = React.useRef(null);
  const [isLinked, setIsLinked] = React.useState(false);

  const activeIndex = tabs.findIndex(t => t.id === activeTab);
  const hoverIndex = tabs.findIndex(t => t.id === hoveredTab);
  const isNeighbor = hoveredTab && activeIndex >= 0 && Math.abs(activeIndex - hoverIndex) === 1;
  const springConfig = {
    type: "spring",
    stiffness: 700, // Faster for 'magnetic' feel
    damping: 45,
    mass: 0.8
  };

  const handleHoverEnter = (id) => {
    // If we're starting a hover (from null) and it's a neighbor of active, link it to float out
    const isStartingHover = lastHoveredTab.current === null;
    const isTargetNeighbor = activeIndex >= 0 && Math.abs(tabs.findIndex(t => t.id === id) - activeIndex) === 1;
    
    if (isStartingHover && isTargetNeighbor) {
      setIsLinked(true);
    } else if (isStartingHover && !isTargetNeighbor) {
      setIsLinked(false);
    } else {
      // Already hovering, keep it linked for the "follow-mouse" feel
      setIsLinked(true);
    }
    
    setHoveredTab(id);
    lastHoveredTab.current = id;
  };

  const handleNavLeave = () => {
    setHoveredTab(null);
    lastHoveredTab.current = null;
    setIsLinked(false);
  };

  return (
    <nav 
      onMouseLeave={handleNavLeave}
      className={cn(
        "flex items-center backdrop-blur-md border border-white/20 dark:border-white/10 rounded-full transition-all duration-300 isolate",
        shouldCollapse 
          ? 'gap-1 bg-white/80 dark:bg-[#0a0f1e]/80 p-1 shadow-[0_8px_32px_rgba(0,0,0,0.2)]' 
          : 'gap-0.5 bg-white/70 dark:bg-white/5 p-1 shadow-[0_12px_40px_rgba(0,0,0,0.15)]'
      )}
    >
      {tabs.map((tab, idx) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        const isHovered = hoveredTab === tab.id;
        
        // Neighbor docking logic
        const isLeftNeighbor = isHovered && idx === activeIndex - 1;
        const isRightNeighbor = isHovered && idx === activeIndex + 1;

        return (
          <motion.button
            key={tab.id}
            layout
            onMouseEnter={() => handleHoverEnter(tab.id)}
            whileTap={{ scale: 0.94 }}
            transition={springConfig}
            onClick={() => setActiveTab(tab.id)}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'relative flex items-center rounded-full text-sm transition-colors duration-200 isolate',
              shouldCollapse ? 'px-3 py-2 font-bold' : 'gap-2 px-3.5 sm:px-4.5 py-1.5 sm:py-2.5 font-medium',
              isActive 
                ? 'text-white z-10' 
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white z-0'
            )}
          >
            {/* Active Pill Indicator */}
            {isActive && (
              <>
                <motion.div
                  layoutId="nav-selection"
                  className="absolute inset-0 bg-blue-600 rounded-full -z-10 shadow-[0_4px_12px_rgba(37,99,235,0.45)]"
                  transition={springConfig}
                />
                {/* Hidden "Source" Pill for neighbors to float out of */}
                <motion.div
                  layoutId="nav-hover"
                  className="absolute inset-0 bg-transparent opacity-0 -z-20"
                />
              </>
            )}

            {/* Fluid Hover Pill (Docks into active) */}
            {isHovered && !isActive && (
              <motion.div
                layoutId={isLinked ? "nav-hover" : undefined}
                initial={isLinked ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                className={cn(
                  "absolute bg-blue-500/15 dark:bg-blue-400/20 -z-20",
                  // Basic rounded if not neighbor
                  !isNeighbor && "inset-0 rounded-full",
                  // Docking logic: stretch past gap and cover corner
                  isLeftNeighbor && "inset-y-0 left-0 -right-4 rounded-l-full rounded-r-none",
                  isRightNeighbor && "inset-y-0 right-0 -left-4 rounded-r-full rounded-l-none"
                )}
                transition={springConfig}
              />
            )}

            <Icon className={cn(
              shouldCollapse ? 'w-4.5 h-4.5' : 'w-4.25 h-4.25',
              isActive ? 'text-white' : 'transition-transform duration-200'
            )} />
            
            {(!shouldCollapse || isActive) && (
              <motion.span
                layout
                transition={springConfig}
                className={cn(
                  "relative overflow-hidden whitespace-nowrap",
                  shouldCollapse ? 'text-[13px] font-black tracking-tight ml-1' : 'text-[14px] font-medium'
                )}
              >
                {tab.label}
              </motion.span>
            )}
          </motion.button>
        );
      })}
    </nav>
  );
});

FloatingNav.displayName = 'FloatingNav';

export default FloatingNav;
