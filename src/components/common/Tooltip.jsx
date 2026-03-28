import React, { useState, useRef, useId, useCallback, memo, forwardRef } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Tooltip.jsx — Premium, high-performance tooltip with smooth animations.
 * Refactored to use Portals: renders into document.body to bypass overflow-hidden.
 */
const Tooltip = forwardRef((props, ref) => {
  const children = props?.children;
  const label = props?.label || '';
  const delay = props?.delay || 0;
  const [visible, setVisible] = useState(false);
  const triggerRef = useRef(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, bottom: 'auto' });
  const timeoutRef = useRef(null);
  const id = useId();

  const updatePosition = useCallback(() => {
    if (!visible || !triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    
    // Position the tooltip 8px below or above the trigger in absolute screen coordinates
    const isTooLow = rect.bottom + 40 > window.innerHeight;
    
    setCoords({
      top: isTooLow ? 'auto' : rect.bottom + 8,
      bottom: isTooLow ? (window.innerHeight - rect.top) + 8 : 'auto',
      left: rect.left + (rect.width / 2)
    });
  }, [visible]);

  const show = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (delay) {
      timeoutRef.current = setTimeout(() => setVisible(true), delay);
    } else {
      setVisible(true);
    }
  };

  const hide = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setVisible(false);
  };

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  React.useLayoutEffect(() => {
    if (visible) {
      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
    }
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [visible, updatePosition]);

  return (
    <>
      <div 
        className="relative flex items-center"
        ref={(node) => {
          triggerRef.current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        }}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        aria-describedby={visible ? id : undefined}
        tabIndex={0}
      >
        {children}
      </div>

      {ReactDOM.createPortal(
        <AnimatePresence mode="wait">
          {visible && (
            <motion.div 
              key="tooltip-content"
              id={id}
              role="tooltip"
              initial={{ opacity: 0, scale: 0.95, y: coords.bottom !== 'auto' ? 4 : -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: coords.bottom !== 'auto' ? 4 : -4 }}
              transition={{ duration: 0.08, ease: 'easeOut' }}
              className="pointer-events-none fixed px-2.5 py-1.5 rounded-md text-[10px] font-bold tracking-tight whitespace-nowrap
                bg-[var(--bg-surface)] text-[var(--text-primary)] border border-border/60 z-[9999]"
              style={{ 
                top: coords.top,
                bottom: coords.bottom,
                left: coords.left,
                transform: 'translateX(-50%)',
                boxShadow: '0 8px 16px -4px rgba(0, 0, 0, 0.5), 0 4px 8px -4px rgba(0, 0, 0, 0.3)',
                backdropFilter: 'blur(8px)'
              }}
            >
              {label}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
});

Tooltip.displayName = 'Tooltip';

export default memo(Tooltip);
