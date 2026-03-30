import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import Switch from './ui/Switch';
import { X, Plus, Settings, Shield, AlertTriangle, Moon, Sun, Server, Edit3, Trash2, Play, Globe, Terminal, Zap, Volume2, Lock, Unlock, HelpCircle, ChevronDown } from 'lucide-react';
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
          className={`absolute mt-2 max-h-64 overflow-y-auto scrollbar-none bg-background/95 backdrop-blur-2xl border border-border/80 rounded-2xl shadow-2xl z-[100] py-2 overflow-hidden ${dropdownClassName || 'left-0 right-0'}`}
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
          className="absolute right-0 mt-2 w-48 max-h-56 overflow-y-auto scrollbar-none bg-background/95 backdrop-blur-xl border border-border/80 rounded-xl shadow-2xl z-[100] py-1.5 overflow-hidden"
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
  const { isDarkMode, toggleDarkMode } = useTheme();
  const [allowedTools, setAllowedTools] = useState([]);
  const [disallowedTools, setDisallowedTools] = useState([]);
  const [newAllowedTool, setNewAllowedTool] = useState('');
  const [newDisallowedTool, setNewDisallowedTool] = useState('');
  const [skipPermissions, setSkipPermissions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [projectSortOrder, setProjectSortOrder] = useState('name');

  // MCP server management state
  const [mcpServers, setMcpServers] = useState([]);
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
  const [mcpConfigTestResult, setMcpConfigTestResult] = useState(null);
  const [mcpConfigTesting, setMcpConfigTesting] = useState(false);
  const [mcpConfigTested, setMcpConfigTested] = useState(false);
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
    try {
      // MCP endpoints are not implemented yet - skip these calls
      return;
      
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
      }
    } catch (error) {
      // console.error('Error discovering MCP tools:', error);
      throw error;
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadSettings();
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
      // console.error('Error loading tool settings:', error);
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
      }, 1000);
    } catch (error) {
      // console.error('Error saving tool settings:', error);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
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
        await deleteMcpServer(serverId, scope);
        setSaveStatus('success');
      } catch (error) {
        alert(`Error: ${error.message}`);
        setSaveStatus('error');
      }
    }
  };

  const handleMcpTest = async (serverId, scope) => {
    try {
      setMcpTestResults({ ...mcpTestResults, [serverId]: { loading: true } });
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

  const handleMcpToolsDiscovery = async (serverId, scope) => {
    try {
      setMcpToolsLoading({ ...mcpToolsLoading, [serverId]: true });
      const result = await discoverMcpTools(serverId, scope);
      setMcpServerTools({ ...mcpServerTools, [serverId]: result });
    } catch (error) {
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

  const handleTestConfiguration = async () => {
    setMcpConfigTesting(true);
    try {
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

  const tabItems = [
    { id: 'general', label: 'General', icon: <Settings className="w-4 h-4" /> },
    { id: 'tools', label: 'Tools', icon: <Shield className="w-4 h-4" /> },
    { id: 'mcp', label: 'MCP Servers', icon: <Server className="w-4 h-4" /> },
    { id: 'appearance', label: 'Appearance', icon: <Moon className="w-4 h-4" /> },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 md:p-10 pointer-events-none">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm pointer-events-auto"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative bg-background/80 dark:bg-card/70 backdrop-blur-xl border border-white/10 shadow-[0_0_50px_rgba(255,255,255,0.08)] rounded-2xl w-full max-w-4xl h-full max-h-[600px] flex flex-col md:flex-row overflow-hidden pointer-events-auto"
          >
            {/* Sidebar Navigation */}
            <div className="w-full md:w-56 border-b md:border-b-0 md:border-r border-border/50 bg-background/40 flex-shrink-0">
              <div className="p-6">
                <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-cyan-500 dark:from-blue-400 dark:to-cyan-400">
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

            {/* Content Area */}
            <div className="flex-1 flex flex-col min-w-0">
              <ScrollArea className="flex-1">
                <div className="p-6 space-y-8">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeTab}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-8"
                    >
                      {/* General Tab */}
                      {activeTab === 'general' && (
                        <div className="space-y-8">
                          {/* Model Selection */}
                          <div className="space-y-4">
                            <div className="flex items-center gap-2 text-foreground">
                              <Zap className="w-4 h-4 text-cyan-500" />
                              <h3 className="text-sm font-bold uppercase tracking-wider">Gemini Model</h3>
                            </div>
                            <div className="bg-muted/60 border border-border/80 rounded-xl p-4 space-y-4 transition-all hover:bg-muted/70 text-left shadow-sm">
                              <ModernSelect
                                id="model-select"
                                value={selectedModel}
                                onChange={setSelectedModel}
                                options={availableModels}
                                placeholder="Select Model"
                                isOpen={showModelDropdown}
                                setIsOpen={setShowModelDropdown}
                                dropdownRef={modelDropdownRef}
                              />
                              <p className="text-xs text-muted-foreground leading-relaxed">
                                {availableModels.find(m => m.value === selectedModel)?.description}
                              </p>
                            </div>
                          </div>

                          {/* Behavior Settings */}
                          <div className="space-y-4">
                            <div className="flex items-center gap-2 text-foreground">
                              <Volume2 className="w-4 h-4 text-blue-500" />
                              <h3 className="text-sm font-bold uppercase tracking-wider">Notifications</h3>
                            </div>
                            <div className="bg-muted/60 border border-border/80 rounded-xl p-4 flex items-center justify-between hover:bg-muted/70 transition-all text-left shadow-sm">
                              <div>
                                <div className="text-sm font-medium">Notification Sound</div>
                                <div className="text-xs text-muted-foreground mt-0.5">Play sound when Gemini responds</div>
                              </div>
                              <div className="flex items-center gap-3">
                                {enableNotificationSound && (
                                  <>
                                    <div className="w-32 sm:w-40">
                                      <ModernSelect
                                        id="sound-select"
                                        value={notificationSoundType}
                                        onChange={(val) => {
                                          setNotificationSoundType(val);
                                          // Test the sound immediately when selected if enabled
                                          import('../utils/notificationSound').then(({ playNotificationSound }) => {
                                            // Temporarily update localStorage so playNotificationSound reads the new type
                                            const settings = JSON.parse(localStorage.getItem('gemini-tools-settings') || '{}');
                                            localStorage.setItem('gemini-tools-settings', JSON.stringify({
                                              ...settings,
                                              notificationSoundType: val,
                                              enableNotificationSound: true
                                            }));
                                            playNotificationSound();
                                          });
                                        }}
                                        options={availableSounds}
                                        placeholder="Sound"
                                        isOpen={showSoundDropdown}
                                        setIsOpen={setShowSoundDropdown}
                                        dropdownRef={soundDropdownRef}
                                        className="scale-90 origin-right"
                                        dropdownClassName="right-0 w-48 sm:w-64"
                                      />
                                    </div>
                                    <button
                                      onClick={async () => {
                                        const { playNotificationSound } = await import('../utils/notificationSound');
                                        // Ensure localStorage is sync'd for the test button
                                        const settings = JSON.parse(localStorage.getItem('gemini-tools-settings') || '{}');
                                        localStorage.setItem('gemini-tools-settings', JSON.stringify({
                                          ...settings,
                                          notificationSoundType: notificationSoundType,
                                          enableNotificationSound: true
                                        }));
                                        playNotificationSound();
                                      }}
                                      className="p-2 text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors"
                                    >
                                      <Play className="w-5 h-5" />
                                    </button>
                                  </>
                                )}
                                <Switch
                                  checked={enableNotificationSound}
                                  onChange={setEnableNotificationSound}
                                  thumbContent={<Volume2 className={`w-2.5 h-2.5 transition-colors ${enableNotificationSound ? 'text-blue-600' : 'text-gray-400'}`} />}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Permission Settings */}
                          <div className="space-y-4">
                            <div className="flex items-center gap-2 text-foreground">
                              <Shield className="w-4 h-4 text-orange-500" />
                              <h3 className="text-sm font-bold uppercase tracking-wider">Permissions</h3>
                            </div>
                            <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 flex items-center justify-between hover:bg-orange-500/15 transition-all text-left shadow-sm">
                              <div>
                                <div className="text-sm font-medium text-orange-600 dark:text-orange-400">YOLO Mode</div>
                                <div className="text-xs text-orange-600/70 dark:text-orange-400/70 mt-0.5">Auto-approve all tool calls (High Risk)</div>
                              </div>
                              <Switch
                                checked={skipPermissions}
                                onChange={setSkipPermissions}
                                className={skipPermissions ? "!bg-orange-600" : ""}
                                thumbContent={<Zap className={`w-2.5 h-2.5 transition-colors ${skipPermissions ? 'text-orange-600' : 'text-gray-400'}`} />}
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Appearance Tab */}
                      {activeTab === 'appearance' && (
                        <div className="space-y-8">
                          <div className="space-y-4">
                            <div className="flex items-center gap-2 text-foreground">
                              <Moon className="w-4 h-4 text-purple-500" />
                              <h3 className="text-sm font-bold uppercase tracking-wider">Visuals</h3>
                            </div>
                            <div className="bg-muted/60 border border-border/80 rounded-xl p-4 flex items-center justify-between hover:bg-muted/70 transition-all text-left shadow-sm">
                              <div>
                                <div className="text-sm font-medium">Dark Mode</div>
                                <div className="text-xs text-muted-foreground mt-0.5">Toggle interface theme</div>
                              </div>
                              <Switch
                                checked={isDarkMode}
                                onChange={toggleDarkMode}
                                thumbContent={isDarkMode ? <Moon className="w-2.5 h-2.5 text-blue-600" /> : <Sun className="w-2.5 h-2.5 text-yellow-500" />}
                              />
                            </div>

                            <div className="bg-muted/60 border border-border/80 rounded-xl p-4 flex items-center justify-between hover:bg-muted/70 transition-all text-left shadow-sm">
                              <div>
                                <div className="text-sm font-medium">Project Sorting</div>
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
                      )}

                      {/* Tools Tab */}
                      {activeTab === 'tools' && (
                        <div className="space-y-8">


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
                              <div className="flex flex-wrap gap-2 p-4 rounded-2xl bg-muted/60 border border-border/80 min-h-[60px] shadow-inner">
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
                              <div className="flex flex-wrap gap-2 p-4 rounded-2xl bg-muted/60 border border-border/80 min-h-[60px] shadow-inner">
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
                      )}

                      {/* MCP Tab */}
                      {activeTab === 'mcp' && (
                        <div className="space-y-8">
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
                                className="bg-muted/30 border border-border/50 rounded-2xl p-6 space-y-6 text-left"
                              >
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-foreground/90">Server Name</label>
                                    <Input
                                      value={mcpFormData.name}
                                      onChange={(e) => setMcpFormData({ ...mcpFormData, name: e.target.value })}
                                      className="h-9 border-border/50 bg-background"
                                      required
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-foreground/90">Transport</label>
                                    <select
                                      value={mcpFormData.type}
                                      onChange={(e) => setMcpFormData({ ...mcpFormData, type: e.target.value })}
                                      className="w-full h-9 px-2 bg-background border border-border/50 rounded-lg text-sm outline-none"
                                    >
                                      <option value="stdio">stdio (Local)</option>
                                      <option value="sse">sse (Remote)</option>
                                    </select>
                                  </div>
                                </div>
                                
                                <div className="space-y-1.5">
                                  <label className="text-xs font-bold text-foreground/90">
                                    {mcpFormData.type === 'stdio' ? 'Command' : 'Endpoint URL'}
                                  </label>
                                  <Input
                                    value={mcpFormData.type === 'stdio' ? mcpFormData.config.command : mcpFormData.config.url}
                                    onChange={(e) => updateMcpConfig(mcpFormData.type === 'stdio' ? 'command' : 'url', e.target.value)}
                                    className="h-9 border-border/50 bg-background"
                                    placeholder={mcpFormData.type === 'stdio' ? 'e.g., node, python, etc.' : 'https://...'}
                                    required
                                  />
                                </div>

                                <div className="flex items-center gap-3 pt-2">
                                  <Button type="submit" disabled={mcpLoading} className="flex-1 rounded-xl h-10 shadow-lg shadow-blue-500/20">
                                    {mcpLoading ? 'Saving...' : editingMcpServer ? 'Update' : 'Add Server'}
                                  </Button>
                                  <Button type="button" variant="ghost" onClick={resetMcpForm} className="rounded-xl h-10 border border-border/50">
                                    Cancel
                                  </Button>
                                </div>
                              </motion.form>
                            ) : (
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="space-y-3"
                              >
                                {mcpServers.length === 0 ? (
                                  <div className="text-center py-10 border-2 border-dashed border-border/10 rounded-2xl">
                                    <Server className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                                    <p className="text-sm text-muted-foreground">No MCP servers configured</p>
                                  </div>
                                ) : (
                                  mcpServers.map(server => (
                                    <div key={server.id} className="bg-muted/60 border border-border/80 rounded-xl p-4 flex items-center justify-between hover:bg-muted/70 transition-all text-left group shadow-sm">
                                      <div className="flex items-center gap-3">
                                        <div className="p-2 bg-background border border-border/50 rounded-lg group-hover:bg-blue-600/10 group-hover:border-blue-500/30 transition-colors">
                                          {getTransportIcon(server.type)}
                                        </div>
                                        <div>
                                          <div className="text-sm font-medium">{server.name}</div>
                                          <div className="text-[10px] text-muted-foreground uppercase tracking-widest">{server.type}</div>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => openMcpForm(server)} className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-md transition-all">
                                          <Edit3 className="w-3.5 h-3.5" />
                                        </button>
                                        <button onClick={() => handleMcpDelete(server.id, server.scope)} className="p-1.5 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 rounded-md transition-all">
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </ScrollArea>

              {/* Footer Actions */}
              <div className="p-4 bg-muted/20 border-t border-border/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AnimatePresence>
                    {saveStatus === 'success' && (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        className="text-xs font-medium text-green-500 flex items-center gap-1"
                      >
                        <Shield className="w-3 h-3" /> Settings auto-applied
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClose}
                    className="rounded-xl h-9 px-4 text-xs font-medium hover:bg-muted"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={saveSettings}
                    disabled={isSaving}
                    className="rounded-xl h-9 px-6 text-xs font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
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

