import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import Switch from './ui/Switch';
import { X, Plus, Settings, Shield, Check, Moon, Sun, Server, Edit3, Trash2, Play, Globe, Terminal, Zap, Volume2, Lock, Unlock, HelpCircle, ChevronDown } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

// --- Stable Helper Components (Defined Outside to preserve exit animations) ---

const ModernSelect = ({ id, value, onChange, options, placeholder = "Select...", className = "", dropdownClassName = "", dropdownRef, isOpen, setIsOpen }) => (
  <div className={`relative ${className}`} ref={dropdownRef}>
    <button 
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setIsOpen(!isOpen);
      }}
      className="w-full flex items-center justify-between gap-2 bg-muted/60 hover:bg-muted/80 border border-border/80 rounded-xl px-4 py-2.5 text-sm font-medium transition-all hover:border-blue-500/50 text-foreground shadow-sm"
    >
      <span className="truncate">{options.find(o => o.value === value)?.label || placeholder}</span>
      <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
    </button>
    
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key={`ms-${id}`}
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className={`absolute mt-2 max-h-64 overflow-y-auto scrollbar-none bg-background/95 backdrop-blur-2xl border border-border/80 rounded-2xl shadow-2xl z-100 py-2 overflow-hidden ${dropdownClassName || 'left-0 right-0'}`}
        >
          {options.map(option => (
            <button
              key={option.value}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full text-left px-4 py-3 text-sm transition-all flex flex-col gap-1 ${
                value === option.value 
                  ? 'bg-blue-600/40 text-white font-semibold shadow-xl shadow-blue-500/10 backdrop-blur-sm' 
                  : 'hover:bg-blue-500/10 text-foreground/80 hover:text-blue-600 dark:hover:text-blue-400'
              }`}
            >
              <span className={value === option.value ? "font-bold" : "font-medium"}>{option.label}</span>
              {option.description && (
                <span className={`text-xs font-normal leading-tight ${
                  value === option.value ? "text-white/90" : "opacity-70"
                }`}>
                  {option.description}
                </span>
              )}
            </button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

const ToolQuickAdd = ({ id, isOpen, setIsOpen, dropdownRef, tools, currentTools, onSelect, colorClass = "green" }) => (
  <div className="relative" ref={dropdownRef}>
    <button 
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setIsOpen(!isOpen);
      }}
      className={`flex items-center gap-1.5 bg-muted/60 hover:bg-muted/80 border border-border/60 rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-tighter cursor-pointer outline-none transition-all hover:border-${colorClass}-500/50 text-foreground shadow-sm`}
    >
      Quick Add
      <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
    </button>
    
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key={`tqa-${id}`}
          initial={{ opacity: 0, y: 8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.95 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="absolute right-0 mt-2 w-48 max-h-56 overflow-y-auto scrollbar-none bg-background/95 backdrop-blur-xl border border-border/80 rounded-xl shadow-2xl z-100 py-1.5 overflow-hidden"
        >
          {tools.filter(t => !currentTools.includes(t)).length > 0 ? (
            tools.filter(t => !currentTools.includes(t)).map(tool => (
              <button
                key={tool}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(tool);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-2 text-xs hover:bg-${colorClass}-500/10 hover:text-${colorClass}-500 transition-colors flex items-center gap-2`}
              >
                <div className={`w-1.5 h-1.5 rounded-full bg-${colorClass}-500/50`} />
                {tool}
              </button>
            ))
          ) : (
            <div className="px-4 py-2 text-[10px] text-muted-foreground italic text-center">All tools added</div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

function ToolsSettings({ isOpen, onClose }) {
  // Appearance state - initialized from ThemeContext but manually applied on save
  const { isDarkMode, toggleDarkMode } = useTheme();
  const [bufferedIsDarkMode, setBufferedIsDarkMode] = useState(isDarkMode);

  const [allowedTools, setAllowedTools] = useState([]);
  const [disallowedTools, setDisallowedTools] = useState([]);
  const [newAllowedTool, setNewAllowedTool] = useState('');
  const [newDisallowedTool, setNewDisallowedTool] = useState('');
  const [skipPermissions, setSkipPermissions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [projectSortOrder, setProjectSortOrder] = useState('name');

  // MCP server management state
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [mcpServers, setMcpServers] = useState([]); // setter used in commented fetchMcpServers implementation
  const [showMcpForm, setShowMcpForm] = useState(false);
  const [editingMcpServer, setEditingMcpServer] = useState(null);
  const [mcpFormData, setMcpFormData] = useState({
    name: '',
    type: 'stdio',
    scope: 'user', // Always use user scope
    config: {
      command: '',
      args: [],
      env: {},
      url: '',
      headers: {},
      timeout: 30000
    }
  });
  const [mcpLoading, setMcpLoading] = useState(false);
  const [mcpTestResults, setMcpTestResults] = useState({});
  const [, setMcpConfigTestResult] = useState(null);
  const [, setMcpConfigTesting] = useState(false);
  const [, setMcpConfigTested] = useState(false);
  const [mcpServerTools, setMcpServerTools] = useState({});
  const [mcpToolsLoading, setMcpToolsLoading] = useState({});
  const [activeTab, setActiveTab] = useState('general');
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
  const [enableNotificationSound, setEnableNotificationSound] = useState(false);
  const [notificationSoundType, setNotificationSoundType] = useState('chime');
  const [showAllowedDropdown, setShowAllowedDropdown] = useState(false);
  const [showDisallowedDropdown, setShowDisallowedDropdown] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showSoundDropdown, setShowSoundDropdown] = useState(false);
  const allowedDropdownRef = useRef(null);
  const disallowedDropdownRef = useRef(null);
  const modelDropdownRef = useRef(null);
  const sortDropdownRef = useRef(null);
  const soundDropdownRef = useRef(null);
  
  // Mobile detection
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Section Refs for mobile scrolling
  const generalRef = useRef(null);
  const toolsRef = useRef(null);
  const mcpRef = useRef(null);
  const appearanceRef = useRef(null);

  const sectionRefs = {
    general: generalRef,
    tools: toolsRef,
    mcp: mcpRef,
    appearance: appearanceRef
  };

  const scrollToSection = (id) => {
    setActiveTab(id);
    if (isMobile && sectionRefs[id]?.current) {
      sectionRefs[id].current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Intersection Observer for mobile scrolling to update active tab
  useEffect(() => {
    if (!isMobile || !isOpen) return;

    const observerOptions = {
      root: null,
      rootMargin: '-100px 0px -50% 0px',
      threshold: 0
    };

    const handleIntersection = (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = Object.keys(sectionRefs).find(
            (key) => sectionRefs[key].current === entry.target
          );
          if (id) setActiveTab(id);
        }
      });
    };

    const observer = new IntersectionObserver(handleIntersection, observerOptions);
    Object.values(sectionRefs).forEach((ref) => {
      if (ref.current) observer.observe(ref.current);
    });

    return () => observer.disconnect();
  }, [isMobile, isOpen]);

  // Close dropdowns on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event) => {
      if (allowedDropdownRef.current && !allowedDropdownRef.current.contains(event.target)) {
        setShowAllowedDropdown(false);
      }
      if (disallowedDropdownRef.current && !disallowedDropdownRef.current.contains(event.target)) {
        setShowDisallowedDropdown(false);
      }
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target)) {
        setShowModelDropdown(false);
      }
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target)) {
        setShowSortDropdown(false);
      }
      if (soundDropdownRef.current && !soundDropdownRef.current.contains(event.target)) {
        setShowSoundDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Common tool patterns
  const commonTools = [
    'Bash',
    'Bash(git log:*)',
    'Bash(git diff:*)',
    'Bash(git status:*)',
    'Bash(npm test:*)',
    'Bash(ls:*)',
    'Bash(cat:*)',
    'Write',
    'write_file',
    'Read',
    'Edit',
    'Glob',
    'Grep',
    'MultiEdit',
    'Task',
    'TodoWrite',
    'TodoRead',
    'WebFetch',
    'WebSearch',
    'Create',
    'Delete'
  ];
  
  // Available Gemini models (tested and verified)
  const availableModels = [
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', description: 'Fast and efficient latest model (Recommended)' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', description: 'Most advanced model (Note: May have quota limits)' }
  ];

  const availableSorts = [
    { value: 'name', label: 'Alphabetical', description: 'Sort projects by name' },
    { value: 'date', label: 'Recent Activity', description: 'Most recent projects first' }
  ];

  const availableSounds = [
    { value: 'chime', label: 'Chime', description: 'Classic two-tone notification' },
    { value: 'ping', label: 'Ping', description: 'Short high-pitched alert' },
    { value: 'pulse', label: 'Pulse', description: 'Soft pulsing heartbeat' },
    { value: 'tech', label: 'Digital', description: 'Quick tech-style blip' },
    { value: 'calm', label: 'Calm', description: 'Gentle fading melody' }
  ];

  // MCP API functions
  const fetchMcpServers = async () => {
    // MCP endpoints are not implemented yet - skip these calls
    // Add try catch later.
    return;
    /*
      const token = localStorage.getItem('auth-token');
      
      // First try to get servers using Gemini CLI
      const cliResponse = await fetch('/api/mcp/cli/list', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (cliResponse.ok) {
        const cliData = await cliResponse.json();
        if (cliData.success && cliData.servers) {
          // Convert CLI format to our format
          const servers = cliData.servers.map(server => ({
            id: server.name,
            name: server.name,
            type: server.type,
            scope: 'user',
            config: {
              command: server.command || '',
              args: server.args || [],
              env: server.env || {},
              url: server.url || '',
              headers: server.headers || {},
              timeout: 30000
            },
            created: new Date().toISOString(),
            updated: new Date().toISOString()
          }));
          setMcpServers(servers);
          return;
        }
      }
      
      // Fallback to direct config reading
      const response = await fetch('/api/mcp/servers?scope=user', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setMcpServers(data.servers || []);
      } else {
        // console.error('Failed to fetch MCP servers');
      }
    } catch (error) {
      // console.error('Error fetching MCP servers:', error);
    }
  };

  const saveMcpServer = async (serverData) => {
    try {
      const token = localStorage.getItem('auth-token');
      
      if (editingMcpServer) {
        // For editing, remove old server and add new one
        await deleteMcpServer(editingMcpServer.id, 'user');
      }
      
      // Use Gemini CLI to add the server
      const response = await fetch('/api/mcp/cli/add', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: serverData.name,
          type: serverData.type,
          command: serverData.config?.command,
          args: serverData.config?.args || [],
          url: serverData.config?.url,
          headers: serverData.config?.headers || {},
          env: serverData.config?.env || {}
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          await fetchMcpServers(); // Refresh the list
          return true;
        } else {
          throw new Error(result.error || 'Failed to save server via Gemini CLI');
        }
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save server');
      }
    } catch (error) {
      // console.error('Error saving MCP server:', error);
      throw error;
    }
  };

  const deleteMcpServer = async (serverId, scope = 'user') => {
    try {
      const token = localStorage.getItem('auth-token');
      
      // Use Gemini CLI to remove the server
      const response = await fetch(`/api/mcp/cli/remove/${serverId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          await fetchMcpServers(); // Refresh the list
          return true;
        } else {
          throw new Error(result.error || 'Failed to delete server via Gemini CLI');
        }
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete server');
      }
    } catch (error) {
      // console.error('Error deleting MCP server:', error);
      throw error;
    }
  };

  const testMcpServer = async (serverId, scope = 'user') => {
    try {
      const token = localStorage.getItem('auth-token');
      const response = await fetch(`/api/mcp/servers/${serverId}/test?scope=${scope}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.testResult;
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to test server');
      }
    } catch (error) {
      // console.error('Error testing MCP server:', error);
      throw error;
    }
  };

  const testMcpConfiguration = async (formData) => {
    try {
      const token = localStorage.getItem('auth-token');
      const response = await fetch('/api/mcp/servers/test', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.testResult;
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to test configuration');
      }
    } catch (error) {
      // console.error('Error testing MCP configuration:', error);
      throw error;
    }
  };

  const discoverMcpTools = async (serverId, scope = 'user') => {
    try {
      const token = localStorage.getItem('auth-token');
      const response = await fetch(`/api/mcp/servers/${serverId}/tools?scope=${scope}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.toolsResult;
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to discover tools');
      } */
  };

  useEffect(() => {
    if (isOpen) {
      loadSettings();
      setSaveStatus(null);
      // Synchronize buffered theme state
      setBufferedIsDarkMode(isDarkMode);
    }
  }, [isOpen]);

  const loadSettings = async () => {
    try {
      // Load from localStorage
      const savedSettings = localStorage.getItem('gemini-tools-settings');
      
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        setAllowedTools(settings.allowedTools || []);
        setDisallowedTools(settings.disallowedTools || []);
        setSkipPermissions(settings.skipPermissions || false);
        setProjectSortOrder(settings.projectSortOrder || 'name');
        setSelectedModel(settings.selectedModel || 'gemini-2.5-flash');
        setEnableNotificationSound(settings.enableNotificationSound || false);
        setNotificationSoundType(settings.notificationSoundType || 'chime');
      } else {
        // Set defaults
        setAllowedTools([]);
        setDisallowedTools([]);
        setSkipPermissions(false);
        setProjectSortOrder('name');
      }

      // Load MCP servers from API
      await fetchMcpServers();
    } catch (error) {
      console.error('Error loading tool settings:', error);
      // Set defaults on error
      setAllowedTools([]);
      setDisallowedTools([]);
      setSkipPermissions(false);
      setProjectSortOrder('name');
    }
  };

  const saveSettings = () => {
    setIsSaving(true);
    setSaveStatus(null);
    
    try {
      // Apply theme choice if changed
      if (bufferedIsDarkMode !== isDarkMode) {
        toggleDarkMode();
      }

      const settings = {
        allowedTools,
        disallowedTools,
        skipPermissions,
        projectSortOrder,
        selectedModel,
        enableNotificationSound,
        notificationSoundType,
        lastUpdated: new Date().toISOString()
      };
      
      // Save to localStorage
      localStorage.setItem('gemini-tools-settings', JSON.stringify(settings));
      
      // Trigger storage event for current window
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'gemini-tools-settings',
        newValue: JSON.stringify(settings),
        oldValue: localStorage.getItem('gemini-tools-settings'),
        storageArea: localStorage,
        url: window.location.href
      }));
      
      setSaveStatus('success');
      
      setTimeout(() => {
        onClose();
      }, 800);
    } catch (error) {
      console.error('Error saving tool settings:', error);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const autoSaveNotifications = (soundEnabled, soundType) => {
    try {
      const savedSettings = localStorage.getItem('gemini-tools-settings');
      let currentSettings = savedSettings ? JSON.parse(savedSettings) : {};
      
      const updatedSettings = {
        ...currentSettings,
        enableNotificationSound: soundEnabled,
        notificationSoundType: soundType,
        lastUpdated: new Date().toISOString()
      };
      
      localStorage.setItem('gemini-tools-settings', JSON.stringify(updatedSettings));
      
      // Trigger storage event so the rest of the app picks it up immediately
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'gemini-tools-settings',
        newValue: JSON.stringify(updatedSettings)
      }));
    } catch {
      // Silently fail for auto-save
    }
  };

  const addAllowedTool = (tool) => {
    if (tool && !allowedTools.includes(tool)) {
      setAllowedTools([...allowedTools, tool]);
      setNewAllowedTool('');
    }
  };

  const removeAllowedTool = (tool) => {
    setAllowedTools(allowedTools.filter(t => t !== tool));
  };

  const addDisallowedTool = (tool) => {
    if (tool && !disallowedTools.includes(tool)) {
      setDisallowedTools([...disallowedTools, tool]);
      setNewDisallowedTool('');
    }
  };

  const removeDisallowedTool = (tool) => {
    setDisallowedTools(disallowedTools.filter(t => t !== tool));
  };
  // MCP form handling functions
  const resetMcpForm = () => {
    setMcpFormData({
      name: '',
      type: 'stdio',
      scope: 'user', // Always use user scope
      config: {
        command: '',
        args: [],
        env: {},
        url: '',
        headers: {},
        timeout: 30000
      }
    });
    setEditingMcpServer(null);
    setShowMcpForm(false);
    setMcpConfigTestResult(null);
    setMcpConfigTested(false);
    setMcpConfigTesting(false);
  };

  const openMcpForm = (server = null) => {
    if (server) {
      setEditingMcpServer(server);
      setMcpFormData({
        name: server.name,
        type: server.type,
        scope: server.scope,
        config: { ...server.config }
      });
    } else {
      resetMcpForm();
    }
    setShowMcpForm(true);
  };

  const handleMcpSubmit = async (e) => {
    e.preventDefault();
    
    setMcpLoading(true);
    
    try {
      // eslint-disable-next-line no-undef
      await saveMcpServer(mcpFormData);
      resetMcpForm();
      setSaveStatus('success');
    } catch (error) {
      alert(`Error: ${error.message}`);
      setSaveStatus('error');
    } finally {
      setMcpLoading(false);
    }
  };

  const handleMcpDelete = async (serverId, scope) => {
    if (confirm('Are you sure you want to delete this MCP server?')) {
      try {
        // eslint-disable-next-line no-undef
        await deleteMcpServer(serverId, scope);
        setSaveStatus('success');
      } catch (error) {
        alert(`Error: ${error.message}`);
        setSaveStatus('error');
      }
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleMcpTest = async (serverId, scope) => {
    try {
      setMcpTestResults({ ...mcpTestResults, [serverId]: { loading: true } });
      // eslint-disable-next-line no-undef
      const result = await testMcpServer(serverId, scope);
      setMcpTestResults({ ...mcpTestResults, [serverId]: result });
    } catch (error) {
      setMcpTestResults({ 
        ...mcpTestResults, 
        [serverId]: { 
          success: false, 
          message: error.message,
          details: []
        } 
      });
    }
  };
  
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleMcpToolsDiscovery = async (serverId, scope) => {
    try {
      setMcpToolsLoading({ ...mcpToolsLoading, [serverId]: true });
      // eslint-disable-next-line no-undef
      const result = await discoverMcpTools(serverId, scope);
      setMcpServerTools({ ...mcpServerTools, [serverId]: result });
    } catch {
      setMcpServerTools({ 
        ...mcpServerTools, 
        [serverId]: { 
          success: false, 
          tools: [], 
          resources: [], 
          prompts: [] 
        } 
      });
    } finally {
      setMcpToolsLoading({ ...mcpToolsLoading, [serverId]: false });
    }
  };

  const updateMcpConfig = (key, value) => {
    setMcpFormData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        [key]: value
      }
    }));
    // Reset test status when configuration changes
    setMcpConfigTestResult(null);
    setMcpConfigTested(false);
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleTestConfiguration = async () => {
    setMcpConfigTesting(true);
    try {
      // eslint-disable-next-line no-undef
      const result = await testMcpConfiguration(mcpFormData);
      setMcpConfigTestResult(result);
      setMcpConfigTested(true);
    } catch (error) {
      setMcpConfigTestResult({
        success: false,
        message: error.message,
        details: []
      });
      setMcpConfigTested(true);
    } finally {
      setMcpConfigTesting(false);
    }
  };

  const getTransportIcon = (type) => {
    switch (type) {
      case 'stdio': return <Terminal className="w-4 h-4" />;
      case 'sse': return <Zap className="w-4 h-4" />;
      case 'http': return <Globe className="w-4 h-4" />;
      default: return <Server className="w-4 h-4" />;
    }
  };

  const renderGeneralContent = () => (
    <div className="space-y-8">
      <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 flex items-center justify-between hover:bg-orange-500/15 transition-all shadow-sm">
          <div>
            <div className="text-sm font-medium text-orange-600 dark:text-orange-400">YOLO Mode</div>
            <div className="text-xs text-orange-600/70 dark:text-orange-400/70 mt-0.5">Auto-approve all tool calls (High Risk)</div>
          </div>
          <Switch
            checked={skipPermissions}
            onChange={setSkipPermissions}
            className={skipPermissions ? "bg-orange-600!" : ""}
            thumbContent={<Zap className={`w-2.5 h-2.5 transition-colors ${skipPermissions ? 'text-orange-600' : 'text-gray-400'}`} />}
          />
        </div>
    </div>
  );

  const renderAppearanceContent = () => (
    <div className="space-y-8 text-left">
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-foreground">
          <Moon className="w-4 h-4 text-purple-500" />
          <h3 className="text-sm font-bold uppercase tracking-wider">Visuals</h3>
        </div>
        <div className="bg-muted/60 border border-border/80 rounded-xl p-4 flex items-center justify-between hover:bg-muted/70 transition-all shadow-sm">
          <div>
            <div className="text-sm font-medium text-foreground">Dark Mode</div>
            <div className="text-xs text-muted-foreground mt-0.5">Toggle interface theme</div>
          </div>
          <Switch
            checked={bufferedIsDarkMode}
            onChange={setBufferedIsDarkMode}
            thumbContent={bufferedIsDarkMode ? <Moon className="w-2.5 h-2.5 text-blue-600" /> : <Sun className="w-2.5 h-2.5 text-yellow-500" />}
          />
        </div>

        <div className="bg-muted/60 border border-border/80 rounded-xl p-4 flex items-center justify-between hover:bg-muted/70 transition-all shadow-sm">
          <div>
            <div className="text-sm font-medium text-foreground">Project Sorting</div>
            <div className="text-xs text-muted-foreground mt-0.5">Order of items in sidebar</div>
          </div>
          <ModernSelect
            id="sort-select"
            value={projectSortOrder}
            onChange={setProjectSortOrder}
            options={availableSorts}
            placeholder="Sort Order"
            className="w-44"
            isOpen={showSortDropdown}
            setIsOpen={setShowSortDropdown}
            dropdownRef={sortDropdownRef}
          />
        </div>
      </div>
    </div>
  );

  const renderToolsContent = () => (
    <div className="space-y-8 text-left">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-foreground">
            <Unlock className="w-4 h-4 text-green-500" />
            <h3 className="text-sm font-bold uppercase tracking-wider">Allowed Tools</h3>
          </div>
          <ToolQuickAdd 
            id="allowed-tools"
            isOpen={showAllowedDropdown}
            setIsOpen={setShowAllowedDropdown}
            dropdownRef={allowedDropdownRef}
            tools={commonTools}
            currentTools={allowedTools}
            onSelect={addAllowedTool}
            colorClass="green"
          />
        </div>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={newAllowedTool}
              onChange={(e) => setNewAllowedTool(e.target.value)}
              placeholder='e.g., "Bash", "Write"'
              className="h-10 bg-muted/50 border-border/50 focus:bg-background rounded-xl transition-all"
              onKeyPress={(e) => e.key === 'Enter' && addAllowedTool(newAllowedTool)}
            />
            <Button size="sm" onClick={() => addAllowedTool(newAllowedTool)} disabled={!newAllowedTool} className="rounded-xl h-10 w-10 p-0 shadow-lg shadow-blue-500/10">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 p-4 rounded-2xl bg-muted/60 border border-border/80 min-h-15 shadow-inner">
            {allowedTools.map(tool => (
              <Badge key={tool} variant="secondary" className="pl-3 pr-1 py-1.5 gap-1 border border-green-500/30 bg-green-500/20 dark:bg-green-500/30 text-green-800 dark:text-green-200 rounded-full shadow-sm hover:scale-105 transition-transform cursor-default">
                {tool}
                <button onClick={() => removeAllowedTool(tool)} className="p-0.5 hover:bg-green-500/30 rounded-full transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
            {allowedTools.length === 0 && <p className="text-xs text-muted-foreground italic flex items-center justify-center w-full">No tools auto-allowed</p>}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-foreground">
            <Lock className="w-4 h-4 text-red-500" />
            <h3 className="text-sm font-bold uppercase tracking-wider">Disallowed Tools</h3>
          </div>
          <ToolQuickAdd 
            id="blocked-tools"
            isOpen={showDisallowedDropdown}
            setIsOpen={setShowDisallowedDropdown}
            dropdownRef={disallowedDropdownRef}
            tools={commonTools}
            currentTools={disallowedTools}
            onSelect={addDisallowedTool}
            colorClass="red"
          />
        </div>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={newDisallowedTool}
              onChange={(e) => setNewDisallowedTool(e.target.value)}
              placeholder='e.g., "Bash(rm:*)"'
              className="h-10 bg-muted/50 border-border/50 focus:bg-background rounded-xl transition-all"
              onKeyPress={(e) => e.key === 'Enter' && addDisallowedTool(newDisallowedTool)}
            />
            <Button size="sm" onClick={() => addDisallowedTool(newDisallowedTool)} disabled={!newDisallowedTool} className="rounded-xl h-10 w-10 p-0 variant-outline border border-red-500/30 hover:bg-red-500/10">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 p-4 rounded-2xl bg-muted/60 border border-border/80 min-h-15 shadow-inner">
            {disallowedTools.map(tool => (
              <Badge key={tool} variant="secondary" className="pl-3 pr-1 py-1.5 gap-1 border border-red-500/30 bg-red-500/20 dark:bg-red-500/30 text-red-800 dark:text-red-200 rounded-full shadow-sm hover:scale-105 transition-transform cursor-default">
                {tool}
                <button onClick={() => removeDisallowedTool(tool)} className="p-0.5 hover:bg-red-500/30 rounded-full transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
            {disallowedTools.length === 0 && <p className="text-xs text-muted-foreground italic flex items-center justify-center w-full">No tools auto-blocked</p>}
          </div>
        </div>
      </div>

      <div className="p-6 bg-blue-500/15 border border-blue-500/30 rounded-2xl space-y-3 text-left shadow-sm">
        <h4 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-tight flex items-center gap-2">
          <HelpCircle className="w-4 h-4" /> Tool Pattern Help
        </h4>
        <div className="text-xs text-muted-foreground leading-relaxed">
          Use patterns like <code className="text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-md border border-blue-500/20">Bash(git log:*)</code> to allow specific commands without full YOLO mode.
        </div>
      </div>
    </div>
  );

  const renderMcpContent = () => (
    <div className="space-y-8 text-left">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-foreground">
          <Server className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-bold uppercase tracking-wider">MCP Servers</h3>
        </div>
        <Button size="sm" onClick={() => openMcpForm()} className="rounded-lg h-8 px-3 text-xs">
          Add Server
        </Button>
      </div>

      <AnimatePresence mode="wait">
        {showMcpForm ? (
          <motion.form
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onSubmit={handleMcpSubmit}
            className="bg-muted/30 border border-border/50 rounded-2xl p-6 space-y-6"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold">Server Name</label>
                <Input
                  value={mcpFormData.name}
                  onChange={(e) => setMcpFormData({ ...mcpFormData, name: e.target.value })}
                  className="h-9 bg-background border-border/50"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold">Transport</label>
                <select
                  value={mcpFormData.type}
                  onChange={(e) => setMcpFormData({ ...mcpFormData, type: e.target.value })}
                  className="w-full h-9 px-2 bg-background border border-border/50 rounded-lg text-sm"
                >
                  <option value="stdio">stdio (Local)</option>
                  <option value="sse">sse (Remote)</option>
                </select>
              </div>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-bold">
                {mcpFormData.type === 'stdio' ? 'Command' : 'Endpoint URL'}
              </label>
              <Input
                value={mcpFormData.type === 'stdio' ? mcpFormData.config.command : mcpFormData.config.url}
                onChange={(e) => updateMcpConfig(mcpFormData.type === 'stdio' ? 'command' : 'url', e.target.value)}
                className="h-9 bg-background border-border/50"
                placeholder={mcpFormData.type === 'stdio' ? 'e.g., node, python' : 'https://...'}
                required
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={mcpLoading} className="flex-1 h-10 rounded-xl">
                {mcpLoading ? 'Saving...' : editingMcpServer ? 'Update' : 'Add Server'}
              </Button>
              <Button type="button" variant="ghost" onClick={resetMcpForm} className="h-10 rounded-xl">
                Cancel
              </Button>
            </div>
          </motion.form>
        ) : (
          <motion.div initial={{ opacity: 1 }} className="space-y-3">
            {mcpServers.length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed border-border/10 rounded-2xl">
                <Server className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No MCP servers configured</p>
              </div>
            ) : (
              mcpServers.map(server => (
                <div key={server.id} className="bg-muted/60 border border-border/80 rounded-xl p-4 flex items-center justify-between hover:bg-muted/70 shadow-sm transition-all group">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-background border border-border/50 rounded-lg group-hover:border-blue-500/30">
                      {getTransportIcon(server.type)}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{server.name}</div>
                      <div className="text-[10px] text-muted-foreground uppercase">{server.type}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button onClick={() => openMcpForm(server)} className="p-1.5 hover:bg-muted rounded-md"><Edit3 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleMcpDelete(server.id, server.scope)} className="p-1.5 hover:bg-red-500/10 text-red-500 rounded-md"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  const tabItems = [
    { id: 'general', label: 'General', icon: <Settings className="w-4 h-4" /> },
    { id: 'tools', label: 'Tools', icon: <Shield className="w-4 h-4" /> },
    { id: 'mcp', label: 'MCP Servers', icon: <Server className="w-4 h-4" /> },
    { id: 'appearance', label: 'Appearance', icon: <Moon className="w-4 h-4" /> },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-0 sm:p-6 md:p-10 pointer-events-none">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
          />

          {/* Modal Container */}
          <motion.div
            initial={isMobile ? { y: '100%', opacity: 1 } : { scale: 0.9, opacity: 0, y: 20 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={isMobile ? { y: '100%', opacity: 1 } : { scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300, mass: 0.8 }}
            className={`relative bg-background/80 dark:bg-[#0c0f1a]/90 backdrop-blur-3xl border border-white/5 shadow-[0_0_80px_rgba(37,99,235,0.15)] flex flex-col md:flex-row overflow-hidden pointer-events-auto ${
              isMobile ? 'w-full h-full max-w-none max-h-none rounded-none border-none' : 'rounded-2xl w-full max-w-4xl h-full max-h-175'
            }`}
          >
            {/* Sidebar Navigation - Hidden on Mobile */}
            <div className="hidden md:flex w-56 border-r border-border/50 bg-background/40 shrink-0 flex-col">
              <div className="p-6">
                <h2 className="text-xl font-bold bg-clip-text text-transparent bg-linear-to-r from-blue-600 to-cyan-500 dark:from-blue-400 dark:to-cyan-400">
                  Settings
                </h2>
              </div>
              <nav className="px-3 pb-6 space-y-1">
                {tabItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                      activeTab === item.id
                        ? 'bg-blue-600/10 text-blue-600 dark:text-blue-400'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    }`}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Mobile Horizontal Icon Navigation */}
            {isMobile && (
              <div className="z-50 bg-background/95 backdrop-blur-2xl border-b border-border/10 px-4 py-3 flex items-center justify-between shrink-0">
                <h2 className="text-lg font-bold bg-clip-text text-transparent bg-linear-to-r from-blue-600 to-cyan-500 dark:from-blue-400 dark:to-cyan-400">
                  Settings
                </h2>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-full border border-border/50">
                    {tabItems.map((item) => {
                      const isActive = activeTab === item.id;
                      return (
                        <motion.button
                          key={item.id}
                          layout
                          onClick={() => scrollToSection(item.id)}
                          className={`relative flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 ${
                            isActive ? 'text-white' : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {isActive && (
                            <motion.div
                              layoutId="active-pill-settings"
                              className="absolute inset-0 bg-blue-600 rounded-full -z-10 shadow-lg shadow-blue-500/20"
                              transition={{ type: "spring", stiffness: 400, damping: 30 }}
                            />
                          )}
                          <span className={isActive ? 'text-white' : ''}>{item.icon}</span>
                          <AnimatePresence mode="wait">
                            {isActive && (
                              <motion.span
                                initial={{ width: 0, opacity: 0 }}
                                animate={{ width: "auto", opacity: 1 }}
                                exit={{ width: 0, opacity: 0 }}
                                className="overflow-hidden whitespace-nowrap"
                              >
                                {item.label}
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </motion.button>
                      );
                    })}
                  </div>
                  <button 
                    onClick={onClose}
                    className="p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground"
                    aria-label="Close settings"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            {/* Content Area */}
            <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
              <ScrollArea className="flex-1 h-full">
                <div className="p-6">
                  {isMobile ? (
                    <div className="space-y-16 pb-24">
                      <section ref={generalRef} className="scroll-mt-24">
                        {renderGeneralContent()}
                      </section>
                      <section ref={toolsRef} className="scroll-mt-24">
                        {renderToolsContent()}
                      </section>
                      <section ref={mcpRef} className="scroll-mt-24">
                        {renderMcpContent()}
                      </section>
                      <section ref={appearanceRef} className="scroll-mt-24">
                        {renderAppearanceContent()}
                      </section>
                    </div>
                  ) : (
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.2 }}
                      >
                        {activeTab === 'general' && renderGeneralContent()}
                        {activeTab === 'tools' && renderToolsContent()}
                        {activeTab === 'mcp' && renderMcpContent()}
                        {activeTab === 'appearance' && renderAppearanceContent()}
                      </motion.div>
                    </AnimatePresence>
                  )}
                </div>
              </ScrollArea>

              {/* Footer Actions */}
              <div className={`p-4 bg-muted/20 border-t border-border/50 flex ${isMobile ? 'flex-col gap-4 items-center justify-center' : 'items-center justify-between'}`}>
                {!isMobile && (
                  <div className="flex items-center gap-2">
                    <AnimatePresence>
                      {saveStatus === 'success' && (
                        <motion.div
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0 }}
                          className="text-xs font-medium text-green-500 flex items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" /> Settings saved successfully
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
                <div className={`flex items-center ${isMobile ? 'w-full gap-3 justify-center' : 'gap-2'}`}>
                  <Button
                    variant="ghost"
                    size={isMobile ? "lg" : "sm"}
                    onClick={onClose}
                    className={`${isMobile ? 'flex-1 max-w-37.5' : ''} rounded-xl h-10 px-4 text-sm font-medium hover:bg-muted`}
                  >
                    Cancel
                  </Button>
                  <Button
                    size={isMobile ? "lg" : "sm"}
                    onClick={saveSettings}
                    disabled={isSaving}
                    className={`${isMobile ? 'flex-2 max-w-50' : ''} rounded-xl h-10 px-8 text-sm font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-all`}
                  >
                    {isSaving ? 'Applying...' : 'Save Changes'}
                  </Button>
                </div>
              </div>
            </div>

            {/* Close Button Overlay */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-full transition-all md:hidden pointer-events-auto"
            >
              <X className="w-5 h-5" />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default ToolsSettings;

