import express from 'express';
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { promises as fs } from 'fs';
import { extractProjectDirectory } from '../projects.js';

const router = express.Router();
const execFileAsync = promisify(execFile);

// Helper function to get the actual project path from the encoded project name
async function getActualProjectPath(projectName) {
  try {
    return await extractProjectDirectory(projectName);
  } catch (error) {
    // console.error(`Error extracting project directory for ${projectName}:`, error);
    // Fallback to the old method
    return projectName.replace(/-/g, '/');
  }
}

// Helper function to validate git repository
async function validateGitRepository(projectPath) {
  try {
    // Check if directory exists
    await fs.access(projectPath);
  } catch {
    throw new Error(`Project path not found: ${projectPath}`);
  }

  try {
    // Use --show-toplevel to get the root of the git repository
    const { stdout: gitRoot } = await execFileAsync('git', ['rev-parse', '--show-toplevel'], { cwd: projectPath });
    const normalizedGitRoot = path.resolve(gitRoot.trim());
    const normalizedProjectPath = path.resolve(projectPath);
    
    // Ensure the git root matches our project path (prevent using parent git repos)
    if (normalizedGitRoot !== normalizedProjectPath) {
      throw new Error(`Project directory is not a git repository. This directory is inside a git repository at ${normalizedGitRoot}, but git operations should be run from the repository root.`);
    }
  } catch (error) {
    if (error.message.includes('Project directory is not a git repository')) {
      throw error;
    }
    throw new Error('Not a git repository. This directory does not contain a .git folder. Initialize a git repository with "git init" to use source control features.');
  }
}

// Get git status for a project
router.get('/status', async (req, res) => {
  const { project } = req.query;
  
  if (!project) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);
    // console.log('Git status for project:', project, '-> path:', projectPath);
    
    // Validate git repository
    await validateGitRepository(projectPath);

    // Get current branch
    const { stdout: branch } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: projectPath });
    const currentBranch = branch.trim();
    
    // Get porcelain status
    const { stdout: statusOutput } = await execFileAsync('git', ['status', '--porcelain', '-z', '-uall'], { cwd: projectPath });
    
    const files = [];
    
    const entries = statusOutput.split('\0');
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (!entry) continue;
      
      const status = entry.substring(0, 2);
      let file = entry.substring(3);

      // Handle renames and copies (R. or C.)
      if (status.startsWith('R') || status.startsWith('C')) {
        // file is the new name, the next entry is the old name which we should skip
        i++;
      }
      
      const X = status[0];
      const Y = status[1];

      files.push({
        path: file,
        status: status === '??' ? 'U' : status,
        isStaged: X !== ' ' && X !== '?',
        isUnstaged: Y !== ' ' && Y !== '?',
        isUntracked: status === '??',
        indexStatus: X,
        workTreeStatus: Y
      });
    }
    
    res.json({
      branch: branch.trim(),
      files,
      // Keep legacy fields for compatibility if needed, but 'files' is the new source of truth
      modified: files.filter(f => f.status.includes('M')).map(f => f.path),
      added: files.filter(f => f.status.includes('A')).map(f => f.path),
      deleted: files.filter(f => f.status.includes('D')).map(f => f.path),
      untracked: files.filter(f => f.isUntracked).map(f => f.path)
    });
  } catch (error) {
    // console.error('Git status error:', error);
    res.json({ 
      error: error.message.includes('not a git repository') || error.message.includes('Project directory is not a git repository') 
        ? error.message 
        : 'Git operation failed',
      details: error.message.includes('not a git repository') || error.message.includes('Project directory is not a git repository')
        ? error.message
        : `Failed to get git status: ${error.message}`
    });
  }
});

// Get diff for a specific file
router.get('/diff', async (req, res) => {
  const { project, file } = req.query;
  
  if (!project || !file) {
    return res.status(400).json({ error: 'Project name and file path are required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);
    
    // Validate git repository
    await validateGitRepository(projectPath);
    
    // Check if file is untracked
    const { stdout: statusOutput } = await execFileAsync('git', ['status', '--porcelain', file], { cwd: projectPath });
    const isUntracked = statusOutput.startsWith('??');
    
    let diff;
    if (isUntracked) {
      // For untracked files, show the entire file content as additions
      const fileContent = await fs.readFile(path.join(projectPath, file), 'utf-8');
      const lines = fileContent.split('\n');
      diff = `--- /dev/null\n+++ b/${file}\n@@ -0,0 +1,${lines.length} @@\n` + 
             lines.map(line => `+${line}`).join('\n');
    } else {
      // Get diff for tracked files
      const { stdout } = await execFileAsync('git', ['diff', 'HEAD', '--', file], { cwd: projectPath });
      diff = stdout || '';
      
      // If no unstaged changes, check for staged changes
      if (!diff) {
        const { stdout: stagedDiff } = await execFileAsync('git', ['diff', '--cached', '--', file], { cwd: projectPath });
        diff = stagedDiff;
      }
    }
    
    res.json({ diff });
  } catch (error) {
    // console.error('Git diff error:', error);
    res.json({ error: error.message });
  }
});

// Commit changes
router.post('/commit', async (req, res) => {
  const { project, message, files } = req.body;
  
  if (!project || !message) {
    return res.status(400).json({ error: 'Project name and commit message are required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);
    
    // Validate git repository
    await validateGitRepository(projectPath);
    
    // Stage explicitly requested files, if any are provided
    if (files && Array.isArray(files) && files.length > 0) {
      for (const file of files) {
        const resolvedPath = path.resolve(projectPath, file);
        if (!resolvedPath.startsWith(path.resolve(projectPath) + path.sep)) {
          return res.status(400).json({ error: `Invalid file path: ${file}` });
        }
        await execFileAsync('git', ['add', '--', file], { cwd: projectPath });
      }
    }
    
    // Check if there are any staged changes to commit
    try {
      await execFileAsync('git', ['diff', '--cached', '--quiet'], { cwd: projectPath });
      // If success (exit code 0), no changes are staged
      return res.status(400).json({ error: 'No staged changes to commit' });
    } catch (e) {
      // Exit code 1 means there are staged changes, which is what we want
    }
    
    // Commit with message
    const { stdout } = await execFileAsync('git', ['commit', '-m', message], { cwd: projectPath });
    
    res.json({ success: true, output: stdout });
  } catch (error) {
    // console.error('Git commit error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get list of branches
router.get('/branches', async (req, res) => {
  const { project } = req.query;
  
  if (!project) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);
    // console.log('Git branches for project:', project, '-> path:', projectPath);
    
    // Validate git repository
    await validateGitRepository(projectPath);
    
    // Get all branches
    const { stdout } = await execFileAsync('git', ['branch', '-a'], { cwd: projectPath });
    
    // Parse branches
    const branches = stdout
      .split('\n')
      .map(branch => branch.trim())
      .filter(branch => branch && !branch.includes('->')) // Remove empty lines and HEAD pointer
      .map(branch => {
        // Remove asterisk from current branch
        if (branch.startsWith('* ')) {
          return branch.substring(2);
        }
        // Remove remotes/ prefix
        if (branch.startsWith('remotes/origin/')) {
          return branch.substring(15);
        }
        return branch;
      })
      .filter((branch, index, self) => self.indexOf(branch) === index); // Remove duplicates
    
    res.json({ branches });
  } catch (error) {
    // console.error('Git branches error:', error);
    res.json({ error: error.message });
  }
});

// Checkout branch
router.post('/checkout', async (req, res) => {
  const { project, branch } = req.body;
  
  if (!project || !branch) {
    return res.status(400).json({ error: 'Project name and branch are required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);
    
    // Checkout the branch
    const { stdout } = await execFileAsync('git', ['checkout', branch], { cwd: projectPath });

    
    res.json({ success: true, output: stdout });
  } catch (error) {
    // console.error('Git checkout error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new branch
router.post('/create-branch', async (req, res) => {
  const { project, branch } = req.body;
  
  if (!project || !branch) {
    return res.status(400).json({ error: 'Project name and branch name are required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);
    
    // Create and checkout new branch
    const { stdout } = await execFileAsync('git', ['checkout', '-b', branch], { cwd: projectPath });
    
    res.json({ success: true, output: stdout });
  } catch (error) {
    // console.error('Git create branch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get recent commits
router.get('/commits', async (req, res) => {
  const { project, limit = 10 } = req.query;
  
  if (!project) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  // Sanitize and validate limit to prevent shell injection and bound response size
  const requestedLimit = parseInt(limit, 10);
  const MAX_COMMIT_LIMIT = 500;
  const sanitizedLimit = isNaN(requestedLimit) || requestedLimit <= 0 
    ? 10 
    : Math.min(requestedLimit, MAX_COMMIT_LIMIT);

  try {
    const projectPath = await getActualProjectPath(project);
    
    // Get commit log with stats
    const { stdout } = await execFileAsync(
      'git',
      ['log', '--pretty=format:%H|%an|%ae|%ad|%s', '--date=relative', '--stat', '-n', sanitizedLimit.toString()],
      { cwd: projectPath }
    );
    
    const commits = stdout
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        const [hash, author, email, date, ...messageParts] = line.split('|');
        return {
          hash,
          author,
          email,
          date,
          message: messageParts.join('|')
        };
      });
    
    // Get stats for each commit
    for (const commit of commits) {
      try {
        const { stdout: stats } = await execFileAsync(
          'git',
          ['show', '--stat', '--format=', commit.hash],
          { cwd: projectPath }
        );
        commit.stats = stats.trim().split('\n').pop(); // Get the summary line
      } catch (error) {
        commit.stats = '';
      }
    }
    
    res.json({ commits });
  } catch (error) {
    // console.error('Git commits error:', error);
    res.json({ error: error.message });
  }
});

// Get diff for a specific commit
router.get('/commit-diff', async (req, res) => {
  const { project, commit } = req.query;
  
  if (!project || !commit) {
    return res.status(400).json({ error: 'Project name and commit hash are required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);
    
    // Get diff for the commit (using -m and --first-parent to handle merge commits properly)
    const { stdout } = await execFileAsync(
      'git',
      ['show', '--patch', '-m', '--first-parent', '--format=%b', commit],
      { cwd: projectPath }
    );
    
    res.json({ diff: stdout });
  } catch (error) {
    // console.error('Git commit diff error:', error);
    res.json({ error: error.message });
  }
});

// Generate commit message based on staged changes
router.post('/generate-commit-message', async (req, res) => {
  const { project, files } = req.body;
  
  if (!project || !files || files.length === 0) {
    return res.status(400).json({ error: 'Project name and files are required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);
    const geminiPathString = (process.env.GEMINI_PATH || 'gemini').trim().replace(/^"|"$/g, '');
    const instruction = "Write a deep context commit message in the format of conventional commits using the provided git diff payload. Return ONLY the commit message without Markdown or preambles:";
    
    // Path Traversal Validation: Ensure all files are within the project directory
    const validatedFiles = [];
    const normalizedProjPath = path.resolve(projectPath);
    for (const f of files) {
      const resolvedPath = path.resolve(normalizedProjPath, f);
      // Skip if path escapes project root or if it's a lockfile (consistency with existing speed filter)
      if (resolvedPath.startsWith(normalizedProjPath + path.sep) && !f.match(/(package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$/i)) {
        validatedFiles.push(f);
      }
    }

    if (validatedFiles.length === 0) {
      return res.status(400).json({ error: 'At least one eligible file is required (lockfiles are excluded and paths must be valid)' });
    }

    let stdout = '';
    let geminiStderr = '';
    let gitStderr = '';

    // Secure spawn: remove shell:true and pass arguments in an array to prevent injection
    const gitProcess = spawn('git', ['diff', '--', ...validatedFiles], { cwd: projectPath });
    const geminiProcess = spawn(geminiPathString, ['-m', 'gemini-2.5-flash-lite', '-p', '"'+instruction+'"'], { cwd: projectPath });

    gitProcess.stdout.pipe(geminiProcess.stdin);
    
    geminiProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    geminiProcess.stderr.on('data', (data) => {
      geminiStderr += data.toString();
    });

    gitProcess.stderr.on('data', (data) => {
      gitStderr += data.toString();
    });

    await new Promise((resolve, reject) => {
      gitProcess.on('error', (err) => {
        reject(new Error(`Failed to start git: ${err.message}`));
      });

      gitProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Git diff failed with code ${code}: ${gitStderr.trim()}`));
        }
      });

      geminiProcess.on('error', (err) => {
        reject(new Error(`Failed to start AI generator: ${err.message}`));
      });

      geminiProcess.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(geminiStderr.trim() || `Gemini process exited with code ${code}`));
      });
    });

    console.log(`[Git API stdout]: ${stdout.trim()}`);
    if (stderr) console.error(`[Git API stderr]: ${stderr}`);

    // Strip out CLI credential caching notifications so they don't pollute the commit
    const message = stdout.replace(/^Loaded cached credentials\.\s*/mi, '').trim();
    
    res.json({ message });
  } catch (error) {
    // console.error('Generate commit message error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get remote status (ahead/behind commits with smart remote detection)
router.get('/remote-status', async (req, res) => {
  const { project } = req.query;
  
  if (!project) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);
    await validateGitRepository(projectPath);

    // Get current branch
    const { stdout: currentBranch } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: projectPath });
    const branch = currentBranch.trim();

    // Check if there's a remote tracking branch (smart detection)
    let trackingBranch;
    let remoteName;
    try {
      const { stdout } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', `${branch}@{upstream}`], { cwd: projectPath });
      trackingBranch = stdout.trim();
      remoteName = trackingBranch.split('/')[0]; // Extract remote name (e.g., "origin/main" -> "origin")
    } catch (error) {
      // No upstream branch configured
      return res.json({ 
        hasRemote: false, 
        branch,
        message: 'No remote tracking branch configured'
      });
    }

    // Get ahead/behind counts
    const { stdout: countOutput } = await execFileAsync(
      'git',
      ['rev-list', '--count', '--left-right', `${trackingBranch}...HEAD`],
      { cwd: projectPath }
    );
    
    const [behind, ahead] = countOutput.trim().split('\t').map(Number);

    res.json({
      hasRemote: true,
      branch,
      remoteBranch: trackingBranch,
      remoteName,
      ahead: ahead || 0,
      behind: behind || 0,
      isUpToDate: ahead === 0 && behind === 0
    });
  } catch (error) {
    // console.error('Git remote status error:', error);
    res.json({ error: error.message });
  }
});

// Fetch from remote (using smart remote detection)
router.post('/fetch', async (req, res) => {
  const { project } = req.body;
  
  if (!project) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);
    await validateGitRepository(projectPath);

    // Get current branch and its upstream remote
    const { stdout: currentBranch } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: projectPath });
    const branch = currentBranch.trim();

    let remoteName = 'origin'; // fallback
    try {
      const { stdout } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', `${branch}@{upstream}`], { cwd: projectPath });
      remoteName = stdout.trim().split('/')[0]; // Extract remote name
    } catch (error) {
      // No upstream, try to fetch from origin anyway
      // console.log('No upstream configured, using origin as fallback');
    }

    const { stdout } = await execFileAsync('git', ['fetch', remoteName], { cwd: projectPath });
    
    res.json({ success: true, output: stdout || 'Fetch completed successfully', remoteName });
  } catch (error) {
    // console.error('Git fetch error:', error);
    res.status(500).json({ 
      error: 'Fetch failed', 
      details: error.message.includes('Could not resolve hostname') 
        ? 'Unable to connect to remote repository. Check your internet connection.'
        : error.message.includes('fatal: \'origin\' does not appear to be a git repository')
        ? 'No remote repository configured. Add a remote with: git remote add origin <url>'
        : error.message
    });
  }
});

// Pull from remote (fetch + merge using smart remote detection)
router.post('/pull', async (req, res) => {
  const { project } = req.body;
  
  if (!project) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);
    await validateGitRepository(projectPath);

    // Get current branch and its upstream remote
    const { stdout: currentBranch } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: projectPath });
    const branch = currentBranch.trim();

    let remoteName = 'origin'; // fallback
    let remoteBranch = branch; // fallback
    try {
      const { stdout } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', `${branch}@{upstream}`], { cwd: projectPath });
      const tracking = stdout.trim();
      remoteName = tracking.split('/')[0]; // Extract remote name
      remoteBranch = tracking.split('/').slice(1).join('/'); // Extract branch name
    } catch (error) {
      // No upstream, use fallback
      // console.log('No upstream configured, using origin/branch as fallback');
    }

    const { stdout } = await execFileAsync('git', ['pull', remoteName, remoteBranch], { cwd: projectPath });
    
    res.json({ 
      success: true, 
      output: stdout || 'Pull completed successfully', 
      remoteName,
      remoteBranch
    });
  } catch (error) {
    // console.error('Git pull error:', error);
    
    // Enhanced error handling for common pull scenarios
    let errorMessage = 'Pull failed';
    let details = error.message;
    
    if (error.message.includes('CONFLICT')) {
      errorMessage = 'Merge conflicts detected';
      details = 'Pull created merge conflicts. Please resolve conflicts manually in the editor, then commit the changes.';
    } else if (error.message.includes('Please commit your changes or stash them')) {
      errorMessage = 'Uncommitted changes detected';  
      details = 'Please commit or stash your local changes before pulling.';
    } else if (error.message.includes('Could not resolve hostname')) {
      errorMessage = 'Network error';
      details = 'Unable to connect to remote repository. Check your internet connection.';
    } else if (error.message.includes('fatal: \'origin\' does not appear to be a git repository')) {
      errorMessage = 'Remote not configured';
      details = 'No remote repository configured. Add a remote with: git remote add origin <url>';
    } else if (error.message.includes('diverged')) {
      errorMessage = 'Branches have diverged';
      details = 'Your local branch and remote branch have diverged. Consider fetching first to review changes.';
    }
    
    res.status(500).json({ 
      error: errorMessage, 
      details: details
    });
  }
});

// Push commits to remote repository
router.post('/push', async (req, res) => {
  const { project } = req.body;
  
  if (!project) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);
    await validateGitRepository(projectPath);

    // Get current branch and its upstream remote
    const { stdout: currentBranch } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: projectPath });
    const branch = currentBranch.trim();

    let remoteName = 'origin'; // fallback
    let remoteBranch = branch; // fallback
    try {
      const { stdout } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', `${branch}@{upstream}`], { cwd: projectPath });
      const tracking = stdout.trim();
      remoteName = tracking.split('/')[0]; // Extract remote name
      remoteBranch = tracking.split('/').slice(1).join('/'); // Extract branch name
    } catch (error) {
      // No upstream, use fallback
      // console.log('No upstream configured, using origin/branch as fallback');
    }

    const { stdout } = await execFileAsync('git', ['push', remoteName, remoteBranch], { cwd: projectPath });
    
    res.json({ 
      success: true, 
      output: stdout || 'Push completed successfully', 
      remoteName,
      remoteBranch
    });
  } catch (error) {
    // console.error('Git push error:', error);
    
    // Enhanced error handling for common push scenarios
    let errorMessage = 'Push failed';
    let details = error.message;
    
    if (error.message.includes('rejected')) {
      errorMessage = 'Push rejected';
      details = 'The remote has newer commits. Pull first to merge changes before pushing.';
    } else if (error.message.includes('non-fast-forward')) {
      errorMessage = 'Non-fast-forward push';
      details = 'Your branch is behind the remote. Pull the latest changes first.';
    } else if (error.message.includes('Could not resolve hostname')) {
      errorMessage = 'Network error';
      details = 'Unable to connect to remote repository. Check your internet connection.';
    } else if (error.message.includes('fatal: \'origin\' does not appear to be a git repository')) {
      errorMessage = 'Remote not configured';
      details = 'No remote repository configured. Add a remote with: git remote add origin <url>';
    } else if (error.message.includes('Permission denied')) {
      errorMessage = 'Authentication failed';
      details = 'Permission denied. Check your credentials or SSH keys.';
    } else if (error.message.includes('no upstream branch')) {
      errorMessage = 'No upstream branch';
      details = 'No upstream branch configured. Use: git push --set-upstream origin <branch>';
    }
    
    res.status(500).json({ 
      error: errorMessage, 
      details: details
    });
  }
});

// Discard changes for a specific file
router.post('/discard', async (req, res) => {
  const { project, file } = req.body;
  
  if (!project || !file) {
    return res.status(400).json({ error: 'Project name and file path are required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);
    await validateGitRepository(projectPath);

    // Check file status to determine correct discard command
    const { stdout: statusOutput } = await execFileAsync('git', ['status', '--porcelain', file], { cwd: projectPath });
    
    if (!statusOutput.trim()) {
      return res.status(400).json({ error: 'No changes to discard for this file' });
    }

    const status = statusOutput.substring(0, 2);
    
    // Validate file path doesn't escape project directory
    const resolvedPath = path.resolve(projectPath, file);
    if (!resolvedPath.startsWith(path.resolve(projectPath) + path.sep)) {
      return res.status(400).json({ error: 'Invalid file path' });
    }

    if (status === '??') {
      // Untracked file - delete it
      await fs.unlink(resolvedPath);
    } else if (status.includes('M') || status.includes('D')) {
      // Modified or deleted file - restore from HEAD
      await execFileAsync('git', ['restore', file], { cwd: projectPath });
    } else if (status.includes('A')) {
      // Added file - unstage it
      await execFileAsync('git', ['reset', 'HEAD', file], { cwd: projectPath });
    }
    
    res.json({ success: true, message: `Changes discarded for ${file}` });
  } catch (error) {
    // console.error('Git discard error:', error);
    res.status(500).json({ error: error.message });
  }
});


// ─── NEW: Git Commit Graph ────────────────────────────────────────────────────
// Returns structured DAG data for the graph visualizer.
// Supports skip+limit for infinite-scroll pagination.
router.get('/graph', async (req, res) => {
  const { project, limit = 200, skip = 0 } = req.query;

  if (!project) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);
    await validateGitRepository(projectPath);

    const limitNum = Math.min(parseInt(limit, 10) || 200, 500);
    const skipNum = parseInt(skip, 10) || 0;

    // Get commit log with parent hashes and decorations
    const format = '%H%x00%P%x00%an%x00%ae%x00%ad%x00%s%x00%D';
    const { stdout } = await execFileAsync(
      'git',
      ['log', '--topo-order', `--pretty=format:${format}`, '--date=iso', `--skip=${skipNum}`, '-n', limitNum.toString()],
      { cwd: projectPath }
    );

    const commits = stdout
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        const parts = line.split('\x00');
        const hash = parts[0] || '';
        const parents = parts[1] ? parts[1].trim().split(' ').filter(Boolean) : [];
        const author = parts[2] || '';
        const email = parts[3] || '';
        const date = parts[4] || '';
        const message = parts[5] || '';        
        const refString = parts[6] || '';

        // Parse refs: "HEAD -> main, origin/main, tag: v1.0"
        const refs = refString
          .split(',')
          .map(r => r.trim())
          .filter(Boolean)
          .map(r => {
            if (r.startsWith('HEAD -> ')) return { type: 'HEAD', name: r.slice(8) };
            if (r === 'HEAD') return { type: 'HEAD_DETACHED', name: 'HEAD' };
            if (r.startsWith('tag: ')) return { type: 'tag', name: r.slice(5) };
            if (r.startsWith('origin/')) return { type: 'remote', name: r };
            return { type: 'branch', name: r };
          });

        return { hash, parents, author, email, date, message, refs };
      });

    // Get total commit count for the frontend to know when to stop scrolling
    let total = 0;
    try {
      const { stdout: countOut } = await execFileAsync('git', ['rev-list', '--count', 'HEAD'], { cwd: projectPath });
      total = parseInt(countOut.trim(), 10) || 0;
    } catch (_) { /* ignore */ }

    res.json({ commits, total, limit: limitNum, skip: skipNum });
  } catch (error) {
    res.json({ error: error.message });
  }
});

// ─── NEW: Stage individual file(s) ───────────────────────────────────────────
router.post('/stage', async (req, res) => {
  const { project, files } = req.body; // files: string[] or 'all'

  if (!project) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);
    await validateGitRepository(projectPath);

    if (files === 'all' || !files) {
      await execFileAsync('git', ['add', '-A'], { cwd: projectPath });
    } else {
      for (const file of files) {
        const resolvedPath = path.resolve(projectPath, file);
        if (!resolvedPath.startsWith(path.resolve(projectPath) + path.sep)) {
          return res.status(400).json({ error: `Invalid file path: ${file}` });
        }
        await execFileAsync('git', ['add', '--', file], { cwd: projectPath });
      }
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── NEW: Unstage individual file(s) ─────────────────────────────────────────
router.post('/unstage', async (req, res) => {
  const { project, files } = req.body; // files: string[] or 'all'

  if (!project) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);
    await validateGitRepository(projectPath);

    if (files === 'all' || !files) {
      await execFileAsync('git', ['restore', '--staged', '.'], { cwd: projectPath });
    } else {
      for (const file of files) {
        const resolvedPath = path.resolve(projectPath, file);
        if (!resolvedPath.startsWith(path.resolve(projectPath) + path.sep)) {
          return res.status(400).json({ error: `Invalid file path: ${file}` });
        }
        await execFileAsync('git', ['restore', '--staged', '--', file], { cwd: projectPath });
      }
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
