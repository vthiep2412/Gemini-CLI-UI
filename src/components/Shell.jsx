import React, { useEffect, useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { ClipboardAddon } from '@xterm/addon-clipboard';
import { WebglAddon } from '@xterm/addon-webgl';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import '@xterm/xterm/css/xterm.css';
import { Terminal as TerminalIcon, ChevronRight, Box, AlertCircle, Trash2, RotateCcw, ChevronDown, Monitor } from 'lucide-react';

// CSS to remove xterm focus outline
const xtermStyles = `
  .xterm .xterm-screen {
    outline: none !important;
  }
  .xterm:focus .xterm-screen {
    outline: none !important;
  }
  .xterm-screen:focus {
    outline: none !important;
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.type = 'text/css';
  styleSheet.innerText = xtermStyles;
  document.head.appendChild(styleSheet);
}

// Terminal Theme Helper
const getTerminalTheme = (dark) => ({
  background: dark ? '#030711' : '#ffffff',
  foreground: dark ? '#f8fafc' : '#0f172a',
  cursor: dark ? '#3b82f6' : '#2563eb',
  selectionBackground: dark ? 'rgba(59, 130, 246, 0.3)' : 'rgba(37, 99, 235, 0.2)',
  black: '#000000',
  red: '#ef4444',
  green: '#22c55e',
  yellow: '#eab308',
  blue: '#3b82f6',
  magenta: '#a855f7',
  cyan: '#06b6d4',
  white: dark ? '#f8fafc' : '#0f172a',
  brightBlack: '#64748b',
  brightRed: '#f87171',
  brightGreen: '#4ade80',
  brightYellow: '#facc15',
  brightBlue: '#60a5fa',
  brightMagenta: '#c084fc',
  brightCyan: '#22d3ee',
  brightWhite: '#ffffff',
});

// Global store for shell sessions to persist across tab switches
const shellSessions = new Map();

function Shell({ selectedProject, selectedSession, isActive }) {
  const terminalRef = useRef(null);
  const terminal = useRef(null);
  const fitAddon = useRef(null);
  const ws = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [shouldAutoConnect, setShouldAutoConnect] = useState(false);
  
  // Shell selection state
  const [availableShells, setAvailableShells] = useState([]);
  const [selectedShell, setSelectedShell] = useState(() => {
    return localStorage.getItem('preferred-shell') || '';
  });
  const [currentPid, setCurrentPid] = useState(null);
  const currentPidRef = useRef(null);
  const [showShellMenu, setShowShellMenu] = useState(false);

  // Sync refs with state
  useEffect(() => {
    currentPidRef.current = currentPid;
  }, [currentPid]);

  const selectedShellRef = useRef(selectedShell);
  useEffect(() => {
    selectedShellRef.current = selectedShell;
  }, [selectedShell]);

  const [lastSessionId, setLastSessionId] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Ref for click-outside handler (Task 13)
  const menuRef = useRef(null);
  
  // Performance Optimization Refs
  const disposables = useRef([]);
  const resizeObserverRef = useRef(null);
  const mutationObserverRef = useRef(null);
  const timeoutsRef = useRef({});

  // Helper to clear specific timeout
  const clearShellTimeout = (key) => {
    if (timeoutsRef.current[key]) {
      clearTimeout(timeoutsRef.current[key]);
      delete timeoutsRef.current[key];
    }
  };

  // Helper to clear all disposables
  const clearDisposables = () => {
    disposables.current.forEach(d => {
      if (d && typeof d.dispose === 'function') {
        try { d.dispose(); } catch (e) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('Dispose error:', e);
          }
        }
      }
    });
    disposables.current = [];
  };

  // Disconnect from shell function
  const disconnectFromShell = useCallback(() => {
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
    
    // Clear terminal content completely
    if (terminal.current) {
      terminal.current.clear();
      terminal.current.write('\x1b[2J\x1b[H'); // Clear screen and move cursor to home
    }
    
    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  // WebSocket connection function (called manually)
  const connectWebSocket = useCallback(async () => {
    if (isConnecting || isConnected) return;
    
    try {
      // Get authentication token
      const token = localStorage.getItem('auth-token');
      if (!token) {
        console.error('No authentication token found for Shell WebSocket connection');
        return;
      }
      
      // Fetch server configuration to get the correct WebSocket URL
      let wsBaseUrl;
      try {
        const configResponse = await fetch('/api/config', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const config = await configResponse.json();
        wsBaseUrl = config.wsUrl;
        
        // If the config returns localhost but we're not on localhost, use current host but with API server port
        if (wsBaseUrl.includes('localhost') && !window.location.hostname.includes('localhost')) {
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          // For development, API server is typically on port 4008 when Vite is on 4009
          const apiPort = window.location.port === '4009' ? '4008' : window.location.port;
          wsBaseUrl = `${protocol}//${window.location.hostname}:${apiPort}`;
        }
      } catch (error) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // For development, API server is typically on port 4008 when Vite is on 4009
        const apiPort = window.location.port === '4009' ? '4008' : window.location.port;
        wsBaseUrl = `${protocol}//${window.location.hostname}:${apiPort}`;
      }
      
      // Include token in WebSocket URL as query parameter
      const wsUrl = `${wsBaseUrl}/shell?token=${encodeURIComponent(token)}`;
      console.log('Connecting to WebSocket:', wsUrl.replace(/token=.*/, 'token=[REDACTED]'));
      
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        console.log('WebSocket connected successfully');
        setIsConnected(true);
        setIsConnecting(false);
        
        // Send init message immediately when connected
        const currentSessionId = selectedSession?.id || selectedSession?.sessionId;
        
        const initPayload = {
          type: 'init',
          projectPath: selectedProject.fullPath || selectedProject.path,
          sessionId: currentSessionId,
          hasSession: !!currentSessionId,
          shellType: selectedShell ? 'custom' : 'standard',
          shellPath: selectedShell,
          cols: terminal.current?.cols || 80,
          rows: terminal.current?.rows || 24
        };
        
        ws.current.send(JSON.stringify(initPayload));
        
        // Task 15: Send terminal size after a small delay, tracked in timeoutsRef for cleanup
        clearShellTimeout('onopen-resize');
        timeoutsRef.current['onopen-resize'] = setTimeout(() => {
          if (terminal.current && ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({
              type: 'resize',
              cols: terminal.current.cols,
              rows: terminal.current.rows
            }));
          }
          delete timeoutsRef.current['onopen-resize'];
        }, 300);
      };

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'output') {
            terminal.current?.write(data.data);
          } else if (data.type === 'pid') {
            setCurrentPid(data.pid);
            currentPidRef.current = data.pid;
          } else if (data.type === 'url_open') {
            window.open(data.url, '_blank');
          }
        } catch (error) {
          terminal.current?.write(event.data);
        }
      };

      ws.current.onclose = (event) => {
        console.log('WebSocket closed:', { code: event.code, reason: event.reason });
        setIsConnected(false);
        setIsConnecting(false);
        
        // Task 15: Clear any pending resize timers
        clearShellTimeout('onopen-resize');
        
        if (terminal.current) {
          // If the connection closed unexpectedly (not code 1000), show an error but don't clear everything
          if (event.code !== 1000) {
            terminal.current.write(`\r\n\x1b[1;31mConnection closed: ${event.reason || 'Server disconnected (code: ' + event.code + ')'}\x1b[0m\r\n`);
          } else {
            // Normal close: clear terminal
            terminal.current.clear();
            terminal.current.write('\x1b[2J\x1b[H');
          }
        }
        
        // Don't auto-reconnect anymore - user must manually connect
      };

      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
        setIsConnecting(false);
        
        // Task 15: Clear any pending resize timers
        clearShellTimeout('onopen-resize');
        if (terminal.current) {
          terminal.current.write('\r\n\x1b[1;31mConnection error. Please check console for details.\x1b[0m\r\n');
        }
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      setIsConnected(false);
      setIsConnecting(false);
      if (terminal.current) {
        terminal.current.write(`\x1b[1;31mFailed to connect: ${error.message}\x1b[0m\r\n`);
      }
    }
  }, [isConnecting, isConnected, selectedSession, selectedProject, selectedShell]);

  // Click-outside handler for shell menu (Task 13)
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowShellMenu(false);
      }
    };

    if (showShellMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showShellMenu]);

  // Connect to shell function
  const connectToShell = useCallback((projectPath) => {
    console.log('Connect to shell clicked');
    
    // Check auth token first
    const token = localStorage.getItem('auth-token');
    if (!token) {
      console.error('No auth token found');
      if (terminal.current) {
        terminal.current.write('\x1b[1;31mAuthentication required. Please log in first.\x1b[0m\r\n');
      }
      return;
    }
    
    if (!isInitialized || isConnected || isConnecting) {
      console.log('Cannot connect:', { isInitialized, isConnected, isConnecting });
      return;
    }
    
    // Toast notification if switching to WSL
    const isWsl = selectedShell?.toLowerCase().includes('wsl') || 
                  availableShells.find(s => s.path === selectedShell)?.id === 'wsl';
    
    if (isWsl) {
      toast.info('Initializing WSL Session', {
        description: 'Please wait... WSL may take 1-2 seconds to wake up and start the shell environment.',
        icon: <Box className="w-4 h-4 text-orange-400" />,
        duration: 4000
      });
    }
    
    setIsConnecting(true);
    
    // Start the WebSocket connection
    connectWebSocket();
  }, [isInitialized, isConnected, isConnecting, availableShells, selectedShell, connectWebSocket]);

  // Safe disconnect with status check
  const handleDisconnect = useCallback(async () => {
    if (isConnected && currentPid) {
      const busyCheckToast = toast.loading('Checking shell status...');
      try {
        const token = localStorage.getItem('auth-token');
        const response = await fetch(`/api/shell/${currentPid}/idle`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        toast.dismiss(busyCheckToast);

        if (response.ok) {
          const { isIdle } = await response.json();
          if (!isIdle) {
            const confirmDisconnect = window.confirm('Current terminal session is busy. Are you sure you want to disconnect?');
            if (!confirmDisconnect) return;
          }
        }
      } catch (e) {
        console.warn('Error checking idle status during disconnect:', e);
        toast.dismiss(busyCheckToast);
      }
    }
    disconnectFromShell();
  }, [isConnected, currentPid, disconnectFromShell]);

  // Restart shell function
  const restartShell = useCallback(async () => {
    if (isRestarting) return;
    
    // Check if current shell is busy before restarting
    if (isConnected && currentPid) {
      const busyCheckToast = toast.loading('Checking shell status...');
      try {
        const token = localStorage.getItem('auth-token');
        const response = await fetch(`/api/shell/${currentPid}/idle`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        toast.dismiss(busyCheckToast);

        if (response.ok) {
          const { isIdle } = await response.json();
          if (!isIdle) {
            const confirmRestart = window.confirm('Current terminal session is busy. Are you sure you want to kill it and restart?');
            if (!confirmRestart) return;
          }
        }
      } catch (e) {
        console.warn('Error checking idle status:', e);
        toast.dismiss(busyCheckToast);
      }
    }

    setIsRestarting(true);
    
    // Disconnect and clear session
    disconnectFromShell();
    
    // Clear all cached sessions for this project to ensure a fresh start
    if (selectedProject?.name) {
      const allKeys = Array.from(shellSessions.keys());
      allKeys.forEach(key => {
        if (key === 'project-' + selectedProject.name || key.startsWith('project-' + selectedProject.name + '-')) {
          shellSessions.delete(key);
        }
      });
    }
    
    // Clear and dispose existing terminal
    if (terminal.current) {
      terminal.current.dispose();
      terminal.current = null;
      fitAddon.current = null;
    }
    
    // Reset initialization state to trigger fresh start
    setIsInitialized(false);
    
    // Set flag to auto-connect after re-initialization
    setShouldAutoConnect(true);
    
    // Small delay to allow cleanup then trigger re-init
    // Small delay to allow cleanup then trigger re-init
    clearShellTimeout('restart-delay');
    timeoutsRef.current['restart-delay'] = setTimeout(() => {
      setIsRestarting(false);
      delete timeoutsRef.current['restart-delay'];
    }, 300);
  }, [isRestarting, isConnected, currentPid, disconnectFromShell, selectedSession, selectedProject]);


  // Auto-connect after restart re-initialization
  useEffect(() => {
    if (isInitialized && shouldAutoConnect && !isConnected && !isConnecting) {
      // Small delay just to be safe with the terminal instance
      const timer = setTimeout(() => {
        setShouldAutoConnect(false);
        connectToShell();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isInitialized, shouldAutoConnect, isConnected, isConnecting, connectToShell]);

  // Watch for session changes and restart shell
  useEffect(() => {
    const currentSessionId = selectedSession?.id || null;
    
    // Disconnect when session changes (user will need to manually reconnect)
    if (lastSessionId !== null && lastSessionId !== currentSessionId && isInitialized) {
      disconnectFromShell();
      
      const allKeys = Array.from(shellSessions.keys());
      allKeys.forEach(key => {
        if (key === 'project-' + selectedProject.name || key.startsWith('project-' + selectedProject.name + '-')) {
          shellSessions.delete(key);
        }
      });
    }
    
    setLastSessionId(currentSessionId);
  }, [selectedSession?.id, isInitialized]);

  // Fetch available shells (Task 14)
  useEffect(() => {
    const controller = new AbortController();
    
    const fetchShells = async () => {
      if (!isActive) return;
      
      try {
        const token = localStorage.getItem('auth-token');
        const response = await fetch('/api/shells', {
          headers: { 'Authorization': `Bearer ${token}` },
          signal: controller.signal
        });
        
        if (response.ok) {
          const shells = await response.json();
          // console.log('🐚 Frontend detected shells:', shells);
          setAvailableShells(shells);
          
          if (!selectedShell && shells.length > 0) {
            setSelectedShell(shells[0].path);
            localStorage.setItem('preferred-shell', shells[0].path);
          }
        } else {
          const error = await response.text();
          console.error('❌ Failed to fetch shells:', error);
        }
      } catch (error) {
        if (error.name === 'AbortError') return;
        console.error('❌ Error fetching shells:', error);
      }
    };

    fetchShells();
    
    return () => {
      controller.abort();
    };
  }, [isActive, selectedProject?.id]);

  // Initialize terminal when component mounts
  useEffect(() => {
    if (!terminalRef.current || !selectedProject || isRestarting) {
      return;
    }

    // Theme helper
    const isDark = document.documentElement.classList.contains('dark');

    // Handle existing sessions correctly
    const sessionKey = selectedSession?.id || `project-${selectedProject.name}`;
    const existingSession = shellSessions.get(sessionKey);
    
    if (existingSession && existingSession.terminal) {
      terminal.current = existingSession.terminal;
      fitAddon.current = existingSession.fitAddon;
      ws.current = existingSession.ws;
      setIsConnected(existingSession.isConnected);
      
      // Close any zombie WebSocket if it's not actually open
      if (ws.current && ws.current.readyState !== WebSocket.OPEN && ws.current.readyState !== WebSocket.CONNECTING) {
        ws.current = null;
        setIsConnected(false);
      }
    } else {
      // Initialize new terminal with robust settings
      terminal.current = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: "'Cascadia Code', 'JetBrains Mono', 'Fira Code', 'Menlo', 'Monaco', 'Courier New', monospace",
        allowProposedApi: true,
        allowTransparency: true,
        convertEol: true,
        scrollback: 10000,
        theme: getTerminalTheme(isDark),
        // Use a safe default size
        cols: 80,
        rows: 24
      });

      fitAddon.current = new FitAddon();
      const clipboardAddon = new ClipboardAddon();
      const webglAddon = new WebglAddon();
      
      terminal.current.loadAddon(fitAddon.current);
      terminal.current.loadAddon(clipboardAddon);
      
      try {
        terminal.current.loadAddon(webglAddon);
      } catch (error) {}
    }
    
    if (terminalRef.current && !terminal.current.element) {
      terminalRef.current.innerHTML = '';
      terminal.current.open(terminalRef.current);
    }

    // Clean up any old listeners before adding new ones
    clearDisposables();

    // Handle terminal input - capture disposable
    const onDataDisposable = terminal.current.onData((data) => {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({
          type: 'input',
          data: data
        }));
      }
    });
    disposables.current.push(onDataDisposable);

    // Add keyboard shortcuts for copy/paste
    const keyHandlerDisposable = terminal.current.attachCustomKeyEventHandler((event) => {
      // Ctrl+C or Cmd+C for copy (when text is selected)
      if ((event.ctrlKey || event.metaKey) && event.key === 'c' && terminal.current.hasSelection()) {
        document.execCommand('copy');
        return false;
      }
      
      // Ctrl+V or Cmd+V for paste
      if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
        navigator.clipboard.readText().then(text => {
          if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({
              type: 'input',
              data: text
            }));
          }
        }).catch(err => {
          // Failed to read clipboard
        });
        return false;
      }
      
      return true;
    });
    disposables.current.push(keyHandlerDisposable);

    // Ensure terminal takes full space and notify backend of size
    clearShellTimeout('initial-fit');
    timeoutsRef.current['initial-fit'] = setTimeout(() => {
      if (fitAddon.current && terminal.current?.element) {
        fitAddon.current.fit();
        // Send terminal size to backend after fitting
        if (terminal.current && ws.current && ws.current.readyState === WebSocket.OPEN) {
          ws.current.send(JSON.stringify({
            type: 'resize',
            cols: terminal.current.cols,
            rows: terminal.current.rows
          }));
        }
      }
    }, 150);

    // Add resize observer with throttling
    if (resizeObserverRef.current) resizeObserverRef.current.disconnect();
    
    resizeObserverRef.current = new ResizeObserver(() => {
      if (fitAddon.current && terminal.current?.element) {
        clearShellTimeout('resize');
        timeoutsRef.current['resize'] = setTimeout(() => {
          if (fitAddon.current && terminal.current?.element) {
            fitAddon.current.fit();
            if (ws.current && ws.current.readyState === WebSocket.OPEN) {
              ws.current.send(JSON.stringify({
                type: 'resize',
                cols: terminal.current.cols,
                rows: terminal.current.rows
              }));
            }
          }
        }, 100);
      }
    });

    if (terminalRef.current) {
      resizeObserverRef.current.observe(terminalRef.current);
    }

    // Set initialization complete
    setIsInitialized(true);

    return () => {
      if (resizeObserverRef.current) resizeObserverRef.current.disconnect();
      clearDisposables();
      for (const key in timeoutsRef.current) clearShellTimeout(key);
      
      // Store session for reuse
      if (terminal.current && selectedProject && !isRestarting) {
        const sessionKey = selectedSession?.id || `project-${selectedProject.name}`;
        try {
          shellSessions.set(sessionKey, {
            terminal: terminal.current,
            fitAddon: fitAddon.current,
            ws: ws.current,
            isConnected: isConnected
          });
        } catch (error) {
          console.error('Error saving shell session:', error);
        }
      }
    };
  }, [terminalRef.current, selectedProject, selectedSession, isRestarting]);

  // Fit terminal when tab becomes active
  useEffect(() => {
    if (!isActive || !isInitialized) return;

    // Monitor theme changes to update terminal colors
    const applyTheme = () => {
      if (!terminal.current) return;
      const dark = document.documentElement.classList.contains('dark');
      terminal.current.options.theme = getTerminalTheme(dark);
    };

    applyTheme();

    if (mutationObserverRef.current) mutationObserverRef.current.disconnect();
    
    mutationObserverRef.current = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          applyTheme();
        }
      });
    });

    mutationObserverRef.current.observe(document.documentElement, { attributes: true });

    // Fit terminal when tab becomes active and notify backend
    clearShellTimeout('active-fit');
    timeoutsRef.current['active-fit'] = setTimeout(() => {
      if (fitAddon.current && terminal.current?.element) {
        fitAddon.current.fit();
        // Send terminal size to backend after tab activation
        if (terminal.current && ws.current && ws.current.readyState === WebSocket.OPEN) {
          ws.current.send(JSON.stringify({
            type: 'resize',
            cols: terminal.current.cols,
            rows: terminal.current.rows
          }));
        }
      }
    }, 150);

    return () => {
      if (mutationObserverRef.current) mutationObserverRef.current.disconnect();
      clearShellTimeout('active-fit');
    };
  }, [isActive, isInitialized]);



  const handleShellChange = useCallback(async (newPath) => {
    if (newPath === selectedShell) return;

    // Check if current shell is idle if connected
    if (isConnected && currentPid) {
      const busyCheckToast = toast.loading('Verifying current shell status...');
      try {
        const token = localStorage.getItem('auth-token');
        const response = await fetch(`/api/shell/${currentPid}/idle`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        toast.dismiss(busyCheckToast);

        if (response.ok) {
          const { isIdle } = await response.json();
          if (!isIdle) {
            const confirmKill = window.confirm('Current terminal session is busy with an active process. Are you sure you want to kill it and switch shells?');
            if (!confirmKill) return;
          }
        }
      } catch (e) {
        console.warn('Error checking idle status:', e);
        toast.dismiss(busyCheckToast);
      }
    }

    setSelectedShell(newPath);
    selectedShellRef.current = newPath; // Update ref immediately
    localStorage.setItem('preferred-shell', newPath);
    setShowShellMenu(false);

    if (isConnected) {
      // Kill current and start new
      disconnectFromShell();
      // We need a small delay for the disconnect to clean up
      clearShellTimeout('shell-switch');
      timeoutsRef.current['shell-switch'] = setTimeout(() => {
        // Guard against stale execution using the Ref
        if (selectedShellRef.current !== newPath) return;
        connectToShell();
      }, 300);
    }
  }, [selectedShell, isConnected, currentPid, disconnectFromShell, connectToShell]);


  const getShellIcon = (id) => {
    if (id?.includes('ps')) return <ChevronRight className="w-4 h-4 text-blue-400" />;
    if (id?.includes('wsl')) return <Box className="w-4 h-4 text-orange-400" />;
    if (id?.includes('bash')) return <Monitor className="w-4 h-4 text-green-400" />;
    return <TerminalIcon className="w-4 h-4 text-gray-400" />;
  };

  const currentShellData = availableShells.find(s => s.path === selectedShell) || availableShells[0];

  if (!selectedProject) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold mb-2">Select a Project</h3>
          <p>Choose a project to open an interactive shell in that directory</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background w-full">
      {/* Header */}
      <div className="flex-shrink-0 bg-muted/30 border-b border-border px-4 py-[0.7rem]">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            

            {!selectedSession && (
              <span className="text-sm text-muted-foreground">(New Session)</span>
            )}
            {!isInitialized && (
              <span className="text-sm text-yellow-500/80">(Initializing...)</span>
            )}
            {isRestarting && (
              <span className="text-sm text-primary animate-pulse">(Restarting...)</span>
            )}
            {/* Shell Selector Dropdown */}
            {availableShells.length > 0 && (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setShowShellMenu(!showShellMenu)}
                  className="flex items-center gap-2 px-2 py-1 rounded-md bg-muted/50 hover:bg-muted border border-border transition-colors group"
                >
                  {getShellIcon(currentShellData?.id)}
                  <span className="text-sm font-medium text-foreground truncate max-w-[120px]">
                    {currentShellData?.name || 'Standard Shell'}
                  </span>
                  <motion.div
                    animate={{ rotate: showShellMenu ? -180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center justify-center text-muted-foreground"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </motion.div>
                </button>

                <AnimatePresence>
                  {showShellMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      transition={{ duration: 0.15, ease: "easeOut" }}
                      className="absolute top-full left-0 mt-1 w-48 bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden"
                    >
                      <div className="py-1">
                        {availableShells.map((shell) => (
                          <button
                            key={shell.path}
                            onClick={() => handleShellChange(shell.path)}
                            className={cn(
                              "w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left hover:bg-accent transition-colors",
                              selectedShell === shell.path ? 'bg-accent/50 text-foreground' : 'text-muted-foreground'
                            )}
                          >
                            {getShellIcon(shell.id)}
                            <span className="flex-1 truncate">{shell.name}</span>
                            {selectedShell === shell.path && (
                              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                            )}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}     
          </div>
          <div className="flex items-center space-x-3 gap-2">
            {isConnected && (
              <button
                onClick={handleDisconnect}
                className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 flex items-center space-x-1"
                title="Disconnect from shell"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>Disconnect</span>
              </button>
            )}
            
            <button
              onClick={restartShell}
              disabled={isRestarting || (!isConnected && !terminal.current)}
              className="text-sm text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed flex items-center space-x-1 my-1"
              title="Restart Shell"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Restart</span>
            </button>
          </div>
        </div>
      </div>

      {/* Terminal Container */}
      <div className="flex-1 min-h-0 relative bg-background overflow-hidden p-3 pt-0">
        <div ref={terminalRef} className="h-full w-full focus:outline-none" />
        
        {/* Loading state */}
        {!isInitialized && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/90 backdrop-blur-sm z-10">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <div className="text-foreground font-medium">Initializing Terminal...</div>
            </div>
          </div>
        )}
        
        {/* Connect button when not connected */}
        {isInitialized && !isConnected && !isConnecting && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-md z-10 p-4 transition-all duration-500">
            <div className="text-center max-w-sm w-full animate-in fade-in zoom-in duration-300">
               <div className="mb-6 relative inline-block">
                <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full animate-pulse" />
                <div className="relative w-16 h-16 mx-auto bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20">
                  <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <button
                onClick={connectToShell}
                className="group relative px-8 py-3.5 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all shadow-lg hover:shadow-primary/25 flex items-center justify-center space-x-3 text-lg font-semibold w-full"
                title="Connect to shell"
              >
                <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Start Shell</span>
              </button>
              <p className="text-muted-foreground text-sm mt-4 px-2 font-medium">
                {selectedSession ? 
                  `Resume shell session for: ${(selectedSession.summary || 'Session').slice(0, 40)}...` : 
                  `Interactive shell in ${selectedProject.displayName}`
                }
              </p>
            </div>
          </div>
        )}
        
        {/* Connecting state */}
        {isConnecting && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-90 p-4">
            <div className="text-center max-w-sm w-full">
              <div className="flex items-center justify-center space-x-3 text-yellow-400">
                <div className="w-6 h-6 animate-spin rounded-full border-2 border-yellow-400 border-t-transparent"></div>
                <span className="text-base font-medium">Connecting to shell...</span>
              </div>
              <p className="text-gray-400 text-sm mt-3 px-2">
                Starting Gemini CLI in {selectedProject.displayName}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Shell;