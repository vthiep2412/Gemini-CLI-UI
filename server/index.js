// Load environment variables from .env file
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

try {
  const envPath = path.join(__dirname, '../.env');
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...valueParts] = trimmedLine.split('=');
      if (key && valueParts.length > 0 && !process.env[key]) {
        process.env[key] = valueParts.join('=').trim();
      }
    }
  });
} catch (e) {
  console.log('No .env file found or error reading it:', e.message);
}

// console.log('PORT from env:', process.env.PORT);

import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import cors from 'cors';
import { promises as fsPromises } from 'fs';
import { execSync, exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);
import os from 'os';
import pty from 'node-pty';
import fetch from 'node-fetch';
import mime from 'mime-types';

import { getProjects, renameProject, deleteProject, addProjectManually, extractProjectDirectory, clearProjectDirectoryCache } from './projects.js';
import { spawnGemini, abortGeminiSession } from './gemini-cli.js';
import sessionManager from './sessionManager.js';
import gitRoutes from './routes/git.js';
import authRoutes from './routes/auth.js';
import mcpRoutes from './routes/mcp.js';
import { initializeDatabase } from './database/db.js';
import { validateApiKey, authenticateToken, authenticateWebSocket } from './middleware/auth.js';

// File system watcher for projects folder
let projectsWatcher = null;
// Cross-platform home dir (Bun-friendly) with safe fallbacks
const getHomeDir = () => {
  // Cross-platform, Bun-friendly home directory resolution
  if (typeof os !== 'undefined' && typeof os.homedir === 'function') {
    const d = os.homedir();
    if (typeof d === 'string' && d) return d;
  }
  return process.env.HOME || process.env.USERPROFILE || '';
};

// Shell Detection & Management
const detectShells = async () => {
  const shells = [];
  const isWindows = os.platform() === 'win32';
  
  if (isWindows) {
    const commonPaths = [
      { name: 'PowerShell 7', path: 'C:\\Program Files\\PowerShell\\7\\pwsh.exe', id: 'ps7' },
      { name: 'PowerShell 5', path: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe', id: 'ps5' },
      { name: 'WSL', path: 'C:\\Windows\\System32\\wsl.exe', id: 'wsl' },
      { name: 'Git Bash', path: 'C:\\Program Files\\Git\\bin\\bash.exe', id: 'gitbash' },
      { name: 'Command Prompt', path: 'C:\\Windows\\System32\\cmd.exe', id: 'cmd' }
    ];

    for (const shell of commonPaths) {
      try {
        // Try specific path first
        try {
          await fsPromises.access(shell.path);
          shells.push(shell);
          continue;
        } catch (err) { console.warn('Caught suppressed error:', err.message); }
        
        // Check if in PATH
        const shellExeName = {
          ps7: 'pwsh',
          ps5: 'powershell',
          gitbash: 'bash',
          wsl: 'wsl',
          cmd: 'cmd'
        }[shell.id] || shell.id;
        
        try {
          const cmd = `where.exe ${shellExeName}`;
          // Use async exec to prevent blocking the event loop (Task 10)
          const { stdout } = await execAsync(cmd);
          const foundPaths = stdout.split('\r\n').map(p => p.trim()).filter(Boolean);
          if (foundPaths.length > 0) {
            shells.push({ ...shell, path: foundPaths[0] });
          }
        } catch (e) {
          // If where.exe fails, we just continue (it means shell isn't in PATH)
          console.warn(`Could not find shell ${shell.name}:`, e.message);
        }
      } catch (e) {
        console.warn(`Could not find shell ${shell.name}:`, e.message);
      }
    }
  } else {
    // Unix fallback
    const unixShells = [
      { name: 'Bash', path: '/bin/bash', id: 'bash' },
      { name: 'Zsh', path: '/bin/zsh', id: 'zsh' },
      { name: 'Sh', path: '/bin/sh', id: 'sh' }
    ];
    for (const shell of unixShells) {
      try {
        await fsPromises.access(shell.path);
        shells.push(shell);
      } catch (err) { console.warn('Caught suppressed error:', err.message); }
    }
  }
  
  // Sort by priority: ps7 > ps5 > wsl > gitbash > cmd
  const priority = ['ps7', 'ps5', 'wsl', 'gitbash', 'cmd', 'bash', 'zsh', 'sh'];
  const result = shells.sort((a, b) => priority.indexOf(a.id) - priority.indexOf(b.id));
  
  console.log('🐚 Detected shells:', result.map(s => s.name).join(', ') || 'None');
  return result;
};

// Check if a process (by PID) is idle (no child processes)
const isProcessIdle = async (pid) => {
  if (!pid || typeof pid !== 'number' || !Number.isInteger(pid) || pid <= 0) return true;
  try {
    const isWindows = os.platform() === 'win32';
    if (isWindows) {
      // 1. Check for standard Windows child processes first
      const psCommand = `powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"ParentProcessId = ${pid}\\" | Select-Object -ExpandProperty ProcessId"`;
      try {
        const { stdout } = await execAsync(psCommand, { timeout: 2000 });
        const lines = stdout.trim().split(/\s+/).filter(line => line.trim() && !isNaN(parseInt(line)));
        if (lines.length > 0) return false;
      } catch (err) { console.warn('Caught suppressed error:', err.message); }

      // 2. Specialized check for WSL if no Windows children found
      try {
        // Get process name to verify if it's WSL (lighter check)
        const { stdout: nameOutput } = await execAsync(`powershell.exe -NoProfile -Command "(Get-Process -Id ${pid}).ProcessName"`, { timeout: 1500 });
        
        if (nameOutput.trim().toLowerCase() === 'wsl') {
          // Inside WSL, check if any non-standard processes are running
          const wslCheckCmd = 'wsl.exe -e sh -c "ps -A -o comm= | grep -vE \'(^sh$|^bash$|^zsh$|^ps$|^init$|^wslhost$|^plan9$|^rc$|^sleep$)\' | wc -l"';
          const { stdout: wslOutput } = await execAsync(wslCheckCmd, { timeout: 2000 });
          const activeCount = parseInt(wslOutput.trim());
          return isNaN(activeCount) || activeCount === 0;
        }
      } catch (wslErr) {
        console.warn("Caught suppressed error:", wslErr.message);
      }
      
      return true;
    } else {
      // Unix/Linux/macOS implementation
      const { stdout } = await execAsync(`pgrep -P ${pid}`, { timeout: 1500 });
      return stdout.trim() === '';
    }
  } catch (e) {
    console.warn("Caught suppressed error:", e.message);
    return true; // Assume idle if error or timeout
  }
};

// Compute Gemini projects path safely (watch path)
// Honor an explicit override from .env via GEMINI_PROJECTS_PATH if defined
const geminiProjectsPath = (() => {
  const envOverride = process.env.GEMINI_PROJECTS_PATH;
  if (typeof envOverride === 'string' && envOverride.trim()) {
    return envOverride.trim();
  }
  const home = getHomeDir();
  return home ? path.join(home, '.gemini', 'projects') : path.join(process.cwd(), '.gemini', 'projects');
})();
const connectedClients = new Set();

// Setup file system watcher for Gemini projects folder using chokidar
async function setupProjectsWatcher() {
  const chokidar = (await import('chokidar')).default;
  // Use the module-scoped geminiProjectsPath (which honors GEMINI_PROJECTS_PATH override)
  const watchPath = geminiProjectsPath;
  
  // If the watcher path doesn't exist, log a warning and skip startup gracefully
  let pathExists = true;
  try {
    await fsPromises.access(watchPath);
  } catch {
    pathExists = false;
  }
  if (!pathExists) {
    console.warn(`[GeminiWatcher] Watch path not found: ${watchPath}. Gemini CLI may not be installed or hasn't been run yet. Skipping watcher startup.`);
    return;
  }
  
  if (projectsWatcher) {
    projectsWatcher.close();
  }
  
  try {
    // Initialize chokidar watcher with optimized settings
    projectsWatcher = chokidar.watch(watchPath, {
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/*.tmp',
        '**/*.swp',
        '**/.DS_Store'
      ],
      persistent: true,
      ignoreInitial: true, // Don't fire events for existing files on startup
      followSymlinks: false,
      depth: 10, // Reasonable depth limit
      awaitWriteFinish: {
        stabilityThreshold: 100, // Wait 100ms for file to stabilize
        pollInterval: 50
      }
    });
    
    // Debounce function to prevent excessive notifications
    let debounceTimer;
    const debouncedUpdate = async (eventType, filePath) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        try {
          
          // Clear project directory cache when files change
          clearProjectDirectoryCache();
          
          // Get updated projects list
          const updatedProjects = await getProjects();
          
          // Notify all connected clients about the project changes
          const updateMessage = JSON.stringify({
            type: 'projects_updated',
            projects: updatedProjects,
            timestamp: new Date().toISOString(),
            changeType: eventType,
            changedFile: path.relative(watchPath, filePath)
          });
          
          connectedClients.forEach(client => {
            if (client.readyState === client.OPEN) {
              client.send(updateMessage);
            }
          });
          
        } catch (error) {
          console.error('Error handling project changes:', error);
        }
      }, 300); // 300ms debounce (slightly faster than before)
    };
    
    // Set up event listeners
    projectsWatcher
      .on('add', (filePath) => debouncedUpdate('add', filePath))
      .on('change', (filePath) => debouncedUpdate('change', filePath))
      .on('unlink', (filePath) => debouncedUpdate('unlink', filePath))
      .on('addDir', (dirPath) => debouncedUpdate('addDir', dirPath))
      .on('unlinkDir', (dirPath) => debouncedUpdate('unlinkDir', dirPath))
      .on('error', (error) => {
        console.error('Chokidar watcher error:', error);
      })
      .on('ready', () => {
      });
    
  } catch (error) {
    console.error('Failed to setup projects watcher:', error);
  }
}

// ─── Git folder watcher — broadcasts GIT_STATUS_CHANGED on real changes ───────
// Map of projectPath → Promise<Watcher | null> (avoids duplicate initialization races)
const gitWatchers = new Map();

/**
 * Initializes a file system watcher for a project's .git directory.
 * Uses a Promise-based reservation to ensure only one watcher exists per path.
 */
function watchGitFolder(projectPath, projectName) {
  // If a watcher task is already pending or completed for this path, just return it
  if (gitWatchers.has(projectPath)) return gitWatchers.get(projectPath);

  // Reserve the slot with an initialization promise
  const watcherPromise = (async () => {
    let gitDir;
    try {
      gitDir = path.join(projectPath, '.git');
      await fsPromises.access(gitDir);
    } catch {
      // Not a git repo or no access: remove from map and return null
      gitWatchers.delete(projectPath);
      return null;
    }

    try {
      const chokidar = (await import('chokidar')).default;
      const watcher = chokidar.watch(gitDir, {
        ignoreInitial: true,
        persistent: true,
        depth: 2,
        ignored: [
          /\/objects\//,
          /\/lfs\//,
          /\.lock$/,
          /\/pack-/
        ]
      });

      let gitDebounce;
      const broadcast = () => {
        clearTimeout(gitDebounce);
        gitDebounce = setTimeout(() => {
          const msg = JSON.stringify({ type: 'GIT_STATUS_CHANGED', project: projectName });
          connectedClients.forEach(client => {
            if (client.readyState === client.OPEN) client.send(msg);
          });
        }, 400); // 400ms debounce
      };

      watcher.on('all', broadcast).on('error', (err) => {
        console.debug(`[GitWatcher] Error for ${projectPath}:`, err.message);
      });

      // Cleanup on close
      const originalClose = watcher.close.bind(watcher);
      watcher.close = async () => {
        gitWatchers.delete(projectPath);
        return originalClose();
      };

      return watcher;
    } catch (err) {
      gitWatchers.delete(projectPath);
      console.debug(`[GitWatcher] Failed to setup chokidar for ${projectPath}:`, err);
      return null;
    }
  })();

  gitWatchers.set(projectPath, watcherPromise);
  return watcherPromise;
}

async function unwatchGitFolder(projectPath) {
  const watcherPromise = gitWatchers.get(projectPath);
  if (watcherPromise) {
    const watcher = await watcherPromise;
    if (watcher) await watcher.close();
  }
}

const app = express();
const server = http.createServer(app);

// Single WebSocket server that handles both paths
const wss = new WebSocketServer({ 
  server,
  verifyClient: (info) => {
    // console.log('WebSocket connection attempt to:', info.req.url);
    
    // Extract token from query parameters or headers
    const url = new URL(info.req.url, 'http://localhost');
    const token = url.searchParams.get('token') || 
                  info.req.headers.authorization?.split(' ')[1];
    
    // Verify token
    const user = authenticateWebSocket(token);
    if (!user) {
      // console.log('❌ WebSocket authentication failed');
      return false;
    }
    
    // Store user info in the request for later use
    info.req.user = user;
    // console.log('✅ WebSocket authenticated for user:', user.username);
    return true;
  }
});

app.use(cors());
app.use(express.json());

// Optional API key validation (if configured)
app.use('/api', validateApiKey);

// Authentication routes (public)
app.use('/api/auth', authRoutes);

// Git API Routes (protected)
app.locals.watchGitFolder = watchGitFolder;
app.locals.unwatchGitFolder = unwatchGitFolder;
app.use('/api/git', authenticateToken, gitRoutes);

// MCP API Routes (protected)
app.use('/api/mcp', authenticateToken, mcpRoutes);

// Static files served after API routes
app.use(express.static(path.join(__dirname, '../dist')));

// API Routes (protected)
app.get('/api/config', authenticateToken, (req, res) => {
  const host = req.headers.host || `${req.hostname}:${PORT}`;
  const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'wss' : 'ws';
  
  // console.log('Config API called - Returning host:', host, 'Protocol:', protocol);
  
  res.json({
    serverPort: PORT,
    wsUrl: `${protocol}://${host}`
  });
});

app.get('/api/projects', authenticateToken, async (req, res) => {
  try {
    const projects = await getProjects();
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/shells', authenticateToken, async (req, res) => {
  try {
    const shells = await detectShells();
    res.json(shells);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check if shell is idle (Task 9)
app.get('/api/shell/:pid/idle', authenticateToken, async (req, res) => {
  const pid = parseInt(req.params.pid);
  
  if (isNaN(pid) || pid <= 0) {
    return res.status(400).json({ error: 'Invalid PID requested', isIdle: true });
  }

  try {
    const isIdle = await isProcessIdle(pid);
    res.json({ isIdle });
  } catch (error) {
    console.error(`[Error] Failed to check idle status for PID ${pid}:`, error);
    // On error, we default to idle: true to avoid blocking user flow, but log the failure
    res.status(500).json({ isIdle: true, error: 'Internal status check failure' });
  }
});

app.get('/api/projects/:projectName/sessions', authenticateToken, async (req, res) => {
  try {
    // Extract the actual project directory path
    const projectPath = await extractProjectDirectory(req.params.projectName);
    
    // Get sessions from sessionManager
    const sessions = sessionManager.getProjectSessions(projectPath);
    
    // Apply pagination
    const { limit = 5, offset = 0 } = req.query;
    const paginatedSessions = sessions.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
    
    res.json({
      sessions: paginatedSessions,
      total: sessions.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get messages for a specific session
app.get('/api/projects/:projectName/sessions/:sessionId/messages', authenticateToken, async (req, res) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { sessionId, projectName: _projectName /* intentionally unused on purpose */ } = req.params;
    const messages = sessionManager.getSessionMessages(sessionId);
    res.json({ messages });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rename project endpoint
app.put('/api/projects/:projectName/rename', authenticateToken, async (req, res) => {
  try {
    const { displayName } = req.body;
    await renameProject(req.params.projectName, displayName);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rename session summary endpoint
app.put('/api/projects/:projectName/sessions/:sessionId/summary', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { summary } = req.body;
    
    if (!summary || !summary.trim()) {
      return res.status(400).json({ error: 'Summary is required' });
    }
    
    const success = await sessionManager.updateSessionSummary(sessionId, summary);
    res.json({ success });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete project endpoint (only if empty)
app.delete('/api/projects/:projectName', authenticateToken, async (req, res) => {
  try {
    const { projectName } = req.params;
    
    // Attempt to unwatch the git folder before deletion to prevent file handle issues on Windows
    try {
      const projectPath = await extractProjectDirectory(projectName);
      await unwatchGitFolder(projectPath);
    } catch (unwatchErr) {
      console.debug(`[WatcherCleanup] Failed to unwatch ${projectName}:`, unwatchErr);
    }

    await deleteProject(projectName);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Security helper: Check if a file path is safely contained within the project directory
async function isPathInsideProject(projectName, filePath) {
  let actualPath;
  try {
    actualPath = await extractProjectDirectory(projectName);
    const realProject = await fsPromises.realpath(actualPath);
    const realFile = await fsPromises.realpath(filePath);
    const rel = path.relative(realProject, realFile);
    return !rel.startsWith('..') && !path.isAbsolute(rel);
  } catch {
    return false; // Fail safely on invalid project names, nonexistent files, or realpath errors
  }
}

// Create project endpoint
app.post('/api/projects/create', authenticateToken, async (req, res) => {
  try {
    const { path: projectPath } = req.body;
    
    if (!projectPath || !projectPath.trim()) {
      return res.status(400).json({ error: 'Project path is required' });
    }
    
    const project = await addProjectManually(projectPath.trim());
    res.json({ success: true, project });
  } catch (error) {
    // console.error('Error creating project:', error);
    res.status(500).json({ error: error.message });
  }
});

// Read file content endpoint
app.get('/api/projects/:projectName/file', authenticateToken, async (req, res) => {
  try {
    const { projectName } = req.params;
    const { filePath } = req.query;
    
    // console.log('📄 File read request:', projectName, filePath);
    
    // Using fsPromises from import
    
    // Security check - ensure the path is safe and absolute
    if (!filePath || !path.isAbsolute(filePath)) {
      return res.status(400).json({ error: 'Invalid file path' });
    }

    // Security check - prevent path traversal
    if (!(await isPathInsideProject(projectName, filePath))) {
      return res.status(403).json({ error: 'Path traversal detected' });
    }
    
    const content = await fsPromises.readFile(filePath, 'utf8');
    res.json({ content, path: filePath });
  } catch (error) {
    // console.error('Error reading file:', error);
    if (error.code === 'ENOENT') {
      res.status(404).json({ error: 'File not found' });
    } else if (error.code === 'EACCES') {
      res.status(403).json({ error: 'Permission denied' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Serve binary file content endpoint (for images, etc.)
app.get('/api/projects/:projectName/files/content', authenticateToken, async (req, res) => {
  try {
    const { projectName } = req.params;
    const { path: filePath } = req.query;
    
    // console.log('🖼️ Binary file serve request:', projectName, filePath);
    
    // Using fs from import
    // Using mime from import
    
    // Security check - ensure the path is safe and absolute
    if (!filePath || !path.isAbsolute(filePath)) {
      return res.status(400).json({ error: 'Invalid file path' });
    }

    // Security check - prevent path traversal
    if (!(await isPathInsideProject(projectName, filePath))) {
      return res.status(403).json({ error: 'Path traversal detected' });
    }
    
    // Check if file exists
    try {
      await fsPromises.access(filePath);
    } catch {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Get file extension and set appropriate content type
    const mimeType = mime.lookup(filePath) || 'application/octet-stream';
    res.setHeader('Content-Type', mimeType);
    
    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
    fileStream.on('error', (streamErr) => {
      console.error('Error streaming file:', streamErr.message);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error reading file' });
      }
    });
    
  } catch (error) {
    console.error('Error serving binary file:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

// Save file content endpoint
app.put('/api/projects/:projectName/file', authenticateToken, async (req, res) => {
  try {
    const { projectName } = req.params;
    const { filePath, content } = req.body;
    
    // console.log('💾 File save request:', projectName, filePath);
    
    // Using fsPromises from import
    
    // Security check - ensure the path is safe and absolute
    if (!filePath || !path.isAbsolute(filePath)) {
      return res.status(400).json({ error: 'Invalid file path' });
    }

    // Security check - prevent path traversal
    if (!(await isPathInsideProject(projectName, filePath))) {
      return res.status(403).json({ error: 'Path traversal detected' });
    }
    
    if (content === undefined) {
      return res.status(400).json({ error: 'Content is required' });
    }
    
    // Create backup of original file
    try {
      const backupPath = filePath + '.backup.' + Date.now();
      await fsPromises.copyFile(filePath, backupPath);
      // console.log('📋 Created backup:', backupPath);
    } catch (backupError) {
      console.warn('Could not create backup:', backupError.message);
    }
    
    // Write the new content
    await fsPromises.writeFile(filePath, content, 'utf8');
    
    res.json({ 
      success: true, 
      path: filePath,
      message: 'File saved successfully' 
    });
  } catch (error) {
    // console.error('Error saving file:', error);
    if (error.code === 'ENOENT') {
      res.status(404).json({ error: 'File or directory not found' });
    } else if (error.code === 'EACCES') {
      res.status(403).json({ error: 'Permission denied' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Rename file/directory endpoint
app.put('/api/projects/:projectName/file/rename', authenticateToken, async (req, res) => {
  try {
    const { projectName } = req.params;
    const { oldPath, newPath } = req.body;
    
    if (!oldPath || !newPath) {
      return res.status(400).json({ error: 'Both oldPath and newPath are required' });
    }

    if (!path.isAbsolute(oldPath) || !path.isAbsolute(newPath)) {
      return res.status(400).json({ error: 'Paths must be absolute' });
    }

    const isOldPathSafe = await isPathInsideProject(projectName, oldPath);
    const newPathParent = path.dirname(newPath);
    const isNewPathSafe = await isPathInsideProject(projectName, newPathParent);

    if (!isOldPathSafe || !isNewPathSafe) {
      return res.status(403).json({ error: 'Path traversal detected or invalid destination' });
    }

    await fsPromises.rename(oldPath, newPath);
    res.json({ success: true, oldPath, newPath });
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.status(404).json({ error: 'Source file or directory not found' });
    } else if (error.code === 'EACCES' || error.code === 'EPERM') {
      res.status(403).json({ error: 'Permission denied' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Delete file/directory endpoint
app.delete('/api/projects/:projectName/file', authenticateToken, async (req, res) => {
  try {
    const { projectName } = req.params;
    const { filePath } = req.query;

    if (!filePath || !path.isAbsolute(filePath)) {
      return res.status(400).json({ error: 'Invalid file path' });
    }

    if (!(await isPathInsideProject(projectName, filePath))) {
      return res.status(403).json({ error: 'Path traversal detected' });
    }

    const stats = await fsPromises.stat(filePath);
    if (stats.isDirectory()) {
      await fsPromises.rm(filePath, { recursive: true, force: true });
    } else {
      await fsPromises.unlink(filePath);
    }

    res.json({ success: true, message: 'Deleted successfully' });
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.status(404).json({ error: 'File or directory not found' });
    } else if (error.code === 'EACCES' || error.code === 'EPERM') {
      res.status(403).json({ error: 'Permission denied' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

app.get('/api/projects/:projectName/files', authenticateToken, async (req, res) => {
  try {
    
    // Using fsPromises from import
    
    // Use extractProjectDirectory to get the actual project path
    let actualPath;
    try {
      actualPath = await extractProjectDirectory(req.params.projectName);
    } catch (error) {
      console.error('Error extracting project directory:', error);
      // Fallback to simple dash replacement
      actualPath = req.params.projectName.replace(/-/g, '/');
    }
    
    // Check if path exists
    try {
      await fsPromises.access(actualPath);
    } catch {
      return res.status(404).json({ error: `Project path not found: ${actualPath}` });
    }
    
    const files = await getFileTree(actualPath, 3, 0, true);
    res.json(files);
  } catch (error) {
    // console.error('❌ File tree error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// WebSocket connection handler that routes based on URL path
wss.on('connection', (ws, request) => {
  const url = request.url;
  // console.log('🔗 Client connected to:', url);
  
  // Parse URL to get pathname without query parameters
  const urlObj = new URL(url, 'http://localhost');
  const pathname = urlObj.pathname;
  
  if (pathname === '/shell') {
    handleShellConnection(ws);
  } else if (pathname === '/ws') {
    handleChatConnection(ws);
  } else {
    // console.log('❌ Unknown WebSocket path:', pathname);
    ws.close();
  }
});

// Handle chat WebSocket connections
function handleChatConnection(ws) {
  // console.log('💬 Chat WebSocket connected');
  
  // Add to connected clients for project updates
  connectedClients.add(ws);
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'gemini-command') {
        // console.log('💬 User message:', data.command || '[Continue/Resume]');
        // console.log('📁 Project:', data.options?.projectPath || 'Unknown');
        // console.log('🔄 Session:', data.options?.sessionId ? 'Resume' : 'New');
        await spawnGemini(data.command, data.options, ws);
      } else if (data.type === 'abort-session') {
        // console.log('🛑 Abort session request:', data.sessionId);
        const success = abortGeminiSession(data.sessionId);
        ws.send(JSON.stringify({
          type: 'session-aborted',
          sessionId: data.sessionId,
          success
        }));
      }
    } catch (error) {
      // console.error('❌ Chat WebSocket error:', error.message);
      ws.send(JSON.stringify({
        type: 'error',
        error: error.message
      }));
    }
  });
  
  ws.on('close', () => {
    // console.log('🔌 Chat client disconnected');
    // Remove from connected clients
    connectedClients.delete(ws);
  });
}

// Handle shell WebSocket connections
function handleShellConnection(ws) {
  // console.log('🐚 Shell client connected');
  let shellProcess = null;
  
  // Send immediate validation that server received the connection
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify({
      type: 'output',
      data: '\r\n\x1b[1;32m[SERVER] WebSocket established, waiting for init...\x1b[0m\r\n'
    }));
  }
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'init') {
        // Initialize shell with project path and session info
        const projectPath = data.projectPath || process.cwd();
        const sessionId = data.sessionId;
        const hasSession = data.hasSession;
        const shellType = data.shellType || 'standard';
        const clientShellPath = data.shellPath; // Specific shell path from UI
        
        // Use appropriate shell for the platform
        const isWindows = os.platform() === 'win32';
        
        // Validate client-provided shell path against detected system shells for security
        let finalShell = isWindows ? 'powershell.exe' : 'bash';
        if (clientShellPath) {
          try {
            const detectedShells = await detectShells();
            const matchingShell = detectedShells.find(s => {
              if (isWindows) {
                // On Windows, handle case-insensitivity and potential normalization differences
                return s.path.toLowerCase() === clientShellPath.toLowerCase() || 
                       path.resolve(s.path).toLowerCase() === path.resolve(clientShellPath).toLowerCase();
              }
              return s.path === clientShellPath;
            });
            
            if (matchingShell) {
              finalShell = matchingShell.path;
            } else {
              // If not found in detected shells, reject it and use safe default
              console.warn(`[Security] Unrecognized shell path requested: ${clientShellPath}. Reverting to default: ${finalShell}`);
            }
          } catch (err) {
            console.error('Error validating shell path:', err);
          }
        }
        
        const shell = finalShell;
        
        // First send a welcome message 
        ws.send(JSON.stringify({
          type: 'output',
          data: `\r\n\x1b[1;36m[SERVER] Spawning ${shell}...\x1b[0m\r\n\x1b[2mDirectory: ${projectPath}\x1b[0m\r\n\r\n`
        }));
        
        // Resolve project path to ensure compatibility across OS
        let normalizedProjectPath = path.resolve(projectPath);
        try {
          // path.resolve already returns a normalized absolute path
          // Verify directory exists
          await fsPromises.access(normalizedProjectPath);
        } catch {
          normalizedProjectPath = process.cwd();
          ws.send(JSON.stringify({
           type: 'output',
           data: `\x1b[33m[WARNING] Requested path not accessible, using ${normalizedProjectPath}\x1b[0m\r\n`
         }));
        }
        
        try {
          // Kill any existing shell process for this connection before starting a new one
          if (shellProcess) {
            try {
              if (isWindows) {
                execSync(`taskkill /f /t /pid ${shellProcess.pid}`, { stdio: 'ignore' });
              } else {
                shellProcess.kill();
              }
            } catch (e) {console.warn("Caught suppressed error:", e.message);}
          }
          
          let shellArgs = [];
          if (shellType === 'gemini' || (hasSession && !shellType)) {
            // Get gemini command from environment or use default
            const geminiPath = process.env.GEMINI_PATH || 'gemini';
            
            // Validate sessionId to prevent command injection (alphanumeric, hyphens, underscores only)
            const safeSessionId = sessionId && /^[a-zA-Z0-9_-]+$/.test(sessionId) 
              ? sessionId 
              : null;
            
            // Build the command
            let geminiCommand = geminiPath;
            if (hasSession && safeSessionId) {
              geminiCommand = `${geminiPath} --resume ${safeSessionId} || ${geminiPath}`;
            }
            
            shellArgs = isWindows ? ['-Command', geminiCommand] : ['-c', geminiCommand];
          }

          // Start shell using PTY for proper terminal emulation
          shellProcess = pty.spawn(shell, shellArgs, {
            name: 'xterm-256color',
            cols: data.cols || 80,
            rows: data.rows || 24,
            cwd: normalizedProjectPath,
            env: { 
              ...process.env,
              TERM: 'xterm-256color',
              BROWSER: 'echo "OPEN_URL:"'
            }
          });
          
          // Send PID back to client
          ws.send(JSON.stringify({
            type: 'pid',
            pid: shellProcess.pid
          }));

          // Handle data output
          shellProcess.onData((data) => {
            if (ws.readyState === ws.OPEN) {
              let outputData = data;
              
              // Check for various URL opening patterns
              /* eslint-disable no-control-regex */
              const patterns = [
                /(?:xdg-open|open|start)\s+(https?:\/\/[^\s\x1b\x07]+)/g,
                /OPEN_URL:\s*(https?:\/\/[^\s\x1b\x07]+)/g,
                /Opening\s+(https?:\/\/[^\s\x1b\x07]+)/gi,
                /Visit:\s*(https?:\/\/[^\s\x1b\x07]+)/gi,
                /View at:\s*(https?:\/\/[^\s\x1b\x07]+)/gi,
                /Browse to:\s*(https?:\/\/[^\s\x1b\x07]+)/gi
              ];
              /* eslint-enable no-control-regex */
              
              patterns.forEach(pattern => {
                let match;
                while ((match = pattern.exec(data)) !== null) {
                  const url = match[1];
                  ws.send(JSON.stringify({
                    type: 'url_open',
                    url: url
                  }));
                  
                  if (pattern.source.includes('OPEN_URL')) {
                    outputData = outputData.replace(match[0], `🌐 Opening in browser: ${url}`);
                  }
                }
              });
              
              ws.send(JSON.stringify({
                type: 'output',
                data: outputData
              }));
            }
          });
          
          // Handle process exit
          shellProcess.onExit((exitCode) => {
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({
                type: 'output',
                data: `\r\n\x1b[33mProcess exited with code ${exitCode.exitCode}${exitCode.signal ? ` (${exitCode.signal})` : ''}\x1b[0m\r\n`
              }));
            }
            shellProcess = null;
          });
          
        } catch (spawnError) {
          ws.send(JSON.stringify({
            type: 'output',
            data: `\r\n\x1b[31mError: ${spawnError.message}\x1b[0m\r\n`
          }));
        }
        
      } else if (data.type === 'input') {
        if (shellProcess && shellProcess.write) {
          try {
            shellProcess.write(data.data);
          } catch (e) {console.warn("Caught suppressed error:", e.message);}
        }
      } else if (data.type === 'resize') {
        if (shellProcess && shellProcess.resize) {
          shellProcess.resize(data.cols, data.rows);
        }
      }
    } catch (error) {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({
          type: 'output',
          data: `\r\n\x1b[31mError: ${error.message}\x1b[0m\r\n`
        }));
      }
    }
  });
  
  ws.on('close', () => {
    // console.log('🔌 Shell client disconnected');
    if (shellProcess && shellProcess.kill) {
      try {
        if (os.platform() === 'win32') {
          // Use taskkill for reliable cleanup on Windows to catch sub-processes
          execSync(`taskkill /f /t /pid ${shellProcess.pid}`, { stdio: 'ignore' });
        } else {
          shellProcess.kill();
        }
      } catch (e) {console.warn("Caught suppressed error:", e.message);}
      shellProcess = null;
    }
  });
  
  ws.on('error', (error) => {
    console.error('Shell WebSocket error:', error);
  });
}
// Audio transcription endpoint
app.post('/api/transcribe', authenticateToken, async (req, res) => {
  try {
    const multer = (await import('multer')).default;
    const upload = multer({ storage: multer.memoryStorage() });
    
    // Handle multipart form data
    upload.single('audio')(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: 'Failed to process audio file' });
      }
      
      if (!req.file) {
        return res.status(400).json({ error: 'No audio file provided' });
      }
      
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'OpenAI API key not configured. Please set OPENAI_API_KEY in server environment.' });
      }
      
      try {
        // Create form data for OpenAI
        const FormData = (await import('form-data')).default;
        const formData = new FormData();
        formData.append('file', req.file.buffer, {
          filename: req.file.originalname,
          contentType: req.file.mimetype
        });
        formData.append('model', 'whisper-1');
        formData.append('response_format', 'json');
        formData.append('language', 'en');
        
        // Make request to OpenAI
        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            ...formData.getHeaders()
          },
          body: formData
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error?.message || `Whisper API error: ${response.status}`);
        }
        
        const data = await response.json();
        let transcribedText = data.text || '';
        
        // Check if enhancement mode is enabled
        const mode = req.body.mode || 'default';
        
        // If no transcribed text, return empty
        if (!transcribedText) {
          return res.json({ text: '' });
        }
        
        // If default mode, return transcribed text without enhancement
        if (mode === 'default') {
          return res.json({ text: transcribedText });
        }
        
        // Handle different enhancement modes
        try {
          const OpenAI = (await import('openai')).default;
          const openai = new OpenAI({ apiKey });
          
          let prompt, systemMessage, temperature = 0.7, maxTokens = 800;
          
          switch (mode) {
            case 'prompt':
              systemMessage = 'You are an expert prompt engineer who creates clear, detailed, and effective prompts.';
              prompt = `You are an expert prompt engineer. Transform the following rough instruction into a clear, detailed, and context-aware AI prompt.

Your enhanced prompt should:
1. Be specific and unambiguous
2. Include relevant context and constraints
3. Specify the desired output format
4. Use clear, actionable language
5. Include examples where helpful
6. Consider edge cases and potential ambiguities

Transform this rough instruction into a well-crafted prompt:
"${transcribedText}"

Enhanced prompt:`;
              break;
              
            case 'vibe':
            case 'instructions':
            case 'architect':
              systemMessage = 'You are a helpful assistant that formats ideas into clear, actionable instructions for AI agents.';
              temperature = 0.5; // Lower temperature for more controlled output
              prompt = `Transform the following idea into clear, well-structured instructions that an AI agent can easily understand and execute.

IMPORTANT RULES:
- Format as clear, step-by-step instructions
- Add reasonable implementation details based on common patterns
- Only include details directly related to what was asked
- Do NOT add features or functionality not mentioned
- Keep the original intent and scope intact
- Use clear, actionable language an agent can follow

Transform this idea into agent-friendly instructions:
"${transcribedText}"

Agent instructions:`;
              break;
              
            default:
              // No enhancement needed
              break;
          }
          
          // Only make GPT call if we have a prompt
          if (prompt) {
            const completion = await openai.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: systemMessage },
                { role: 'user', content: prompt }
              ],
              temperature: temperature,
              max_tokens: maxTokens
            });
            
            transcribedText = completion.choices[0].message.content || transcribedText;
          }
          
        } catch (gptError) {
          console.error('GPT processing error:', gptError);
          // Fall back to original transcription if GPT fails
        }
        
        res.json({ text: transcribedText });
        
      } catch (error) {
        // console.error('Transcription error:', error);
        res.status(500).json({ error: error.message });
      }
    });
  } catch (error) {
    console.error('Endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Image upload endpoint
app.post('/api/projects/:projectName/upload-images', authenticateToken, async (req, res) => {
  try {
    const multer = (await import('multer')).default;
    const path = (await import('path')).default;
    const fs = (await import('fs')).promises;
    const os = (await import('os')).default;
    
    // Configure multer for image uploads
    const storage = multer.diskStorage({
      destination: async (req, file, cb) => {
        const uploadDir = path.join(os.tmpdir(), 'gemini-ui-uploads', String(req.user.id));
        await fs.mkdir(uploadDir, { recursive: true });
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, uniqueSuffix + '-' + sanitizedName);
      }
    });
    
    const fileFilter = (req, file, cb) => {
      const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only JPEG, PNG, GIF, WebP, and SVG are allowed.'));
      }
    };
    
    const upload = multer({
      storage,
      fileFilter,
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
        files: 5
      }
    });
    
    // Handle multipart form data
    upload.array('images', 5)(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No image files provided' });
      }
      
      try {
        // Process uploaded images
        const processedImages = await Promise.all(
          req.files.map(async (file) => {
            // Read file and convert to base64
            const buffer = await fs.readFile(file.path);
            const base64 = buffer.toString('base64');
            const mimeType = file.mimetype;
            
            // Clean up temp file immediately
            await fs.unlink(file.path);
            
            return {
              name: file.originalname,
              data: `data:${mimeType};base64,${base64}`,
              size: file.size,
              mimeType: mimeType
            };
          })
        );
        
        res.json({ images: processedImages });
      } catch (processingError) {
        console.error('Error processing images:', processingError.message);
        // Clean up any remaining files
        await Promise.all(req.files.map(f => fs.unlink(f.path).catch(() => {})));
        res.status(500).json({ error: 'Failed to process images' });
      }
    });
  } catch (error) {
    console.error('Error in image upload endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Helper function to convert permissions to rwx format
function permToRwx(perm) {
  const r = perm & 4 ? 'r' : '-';
  const w = perm & 2 ? 'w' : '-';
  const x = perm & 1 ? 'x' : '-';
  return r + w + x;
}

async function getFileTree(dirPath, maxDepth = 3, currentDepth = 0, showHidden = true) {
  // Using fsPromises from import
  const items = [];
  
  try {
    const entries = await fsPromises.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      // Debug: log all entries including hidden files
   
      
      // Skip only heavy build directories
      if (entry.name === 'node_modules' || 
          entry.name === 'dist' || 
          entry.name === 'build') continue;
      
      const itemPath = path.join(dirPath, entry.name);
      const item = {
        name: entry.name,
        path: itemPath,
        type: entry.isDirectory() ? 'directory' : 'file'
      };
      
      // Get file stats for additional metadata
      try {
        const stats = await fsPromises.stat(itemPath);
        item.size = stats.size;
        item.modified = stats.mtime.toISOString();
        
        // Convert permissions to rwx format
        const mode = stats.mode;
        const ownerPerm = (mode >> 6) & 7;
        const groupPerm = (mode >> 3) & 7;
        const otherPerm = mode & 7;
        item.permissions = ((mode >> 6) & 7).toString() + ((mode >> 3) & 7).toString() + (mode & 7).toString();
        item.permissionsRwx = permToRwx(ownerPerm) + permToRwx(groupPerm) + permToRwx(otherPerm);
      } catch {
        // If stat fails, provide default values
        item.size = 0;
        item.modified = null;
        item.permissions = '000';
        item.permissionsRwx = '---------';
      }
      
      if (entry.isDirectory() && currentDepth < maxDepth) {
        // Recursively get subdirectories but limit depth
        try {
          // Check if we can access the directory before trying to read it
          await fsPromises.access(item.path, fs.constants.R_OK);
          item.children = await getFileTree(item.path, maxDepth, currentDepth + 1, showHidden);
        } catch {
          // Silently skip directories we can't access (permission denied, etc.)
          item.children = [];
        }
      }
      
      items.push(item);
    }
  } catch (error) {
    // Only log non-permission errors to avoid spam
    if (error.code !== 'EACCES' && error.code !== 'EPERM') {
      // console.error('Error reading directory:', error);
    }
  }
  
  return items.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

const PORT = process.env.PORT || 4008;

// Initialize database and start server
async function startServer() {
  try {
    // Initialize authentication database
    await initializeDatabase();
    // console.log('✅ Database initialization skipped (testing)');
    
    server.listen(PORT, '0.0.0.0', async () => {
      // console.log(`Gemini CLI UI server running on http://0.0.0.0:${PORT}`);
      
      // Start watching the projects folder for changes
      await setupProjectsWatcher(); // Re-enabled with better-sqlite3
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown handler
async function handleShutdown(signal) {
  console.log(`\x1b[33m\n[Shutdown] Received ${signal}, closing watchers...\x1b[0m`);
  
  // Stop accepting new connections
  wss.close();
  
  // Close all git watchers (awaiting any pending starts)
  const watcherPromises = [];
  for (const [projectPath, watcherPromise] of gitWatchers.entries()) {
    watcherPromises.push((async () => {
      try {
        const watcher = await watcherPromise;
        if (watcher && typeof watcher.close === 'function') {
          await watcher.close();
        }
      } catch (e) {
        console.debug(`[Shutdown] Error closing watcher for ${projectPath}:`, e.message);
      }
    })());
  }
  await Promise.allSettled(watcherPromises);
  gitWatchers.clear();
  
  // Close the projects watcher
  if (projectsWatcher) {
    await projectsWatcher.close();
  }
  
  // Close HTTP server and wait for existing connections
  let shutdownTimer;
  const timeoutPromise = new Promise((resolve) => {
    shutdownTimer = setTimeout(resolve, 5000); // 5s timeout
  });
  
  const closePromise = new Promise((resolve, reject) => {
    server.close((err) => {
      clearTimeout(shutdownTimer);
      if (err) { reject(err); }
      else { resolve(); }
    });
  }).catch((err) => console.log('\x1b[33m[Shutdown] Server close ignored error:\x1b[0m', err.message));

  await Promise.race([closePromise, timeoutPromise]);
  
  console.log('\x1b[32m[Shutdown] All watchers closed. Exiting.\x1b[0m');
  process.exit(0);
}

process.on('SIGINT', () => handleShutdown('SIGINT').catch(console.error));
process.on('SIGTERM', () => handleShutdown('SIGTERM').catch(console.error));

startServer();
