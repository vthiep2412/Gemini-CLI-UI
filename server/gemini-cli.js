import { spawn } from 'child_process';
import fs from 'fs';
const fsPromises = fs.promises;
import path from 'path';
import os from 'os';
import sessionManager from './sessionManager.js';
import GeminiResponseHandler from './gemini-response-handler.js';

let activeGeminiProcesses = new Map(); // Track active processes by session ID

async function spawnGemini(command, options = {}, ws) {
  const { sessionId, cwd, toolsSettings, images } = options;
  let capturedSessionId = sessionId; // Track session ID throughout the process
  let sessionCreatedSent = false; // Track if we've already sent session-created event
  let fullResponse = ''; // Accumulate the full response

  // Use tools settings passed from frontend, or defaults
  const settings = toolsSettings || {
    allowedTools: [],
    disallowedTools: [],
    skipPermissions: false
  };

  // Build Gemini CLI command - start with print/resume flags first
  const args = [];

  // Add prompt flag with command if we have a command
  if (command && command.trim()) {
    // If we have a sessionId, include conversation history
    if (sessionId) {
      const context = sessionManager.buildConversationContext(sessionId);
      if (context) {
        // Combine context with current command
        const fullPrompt = context + command;
        args.push('--prompt', fullPrompt);
      } else {
        args.push('--prompt', command);
      }
    } else {
      args.push('--prompt', command);
    }
  }

  // Use cwd (actual project directory) instead of projectPath (Gemini's metadata directory)
  // Clean the path by removing any non-printable characters
  const cleanPath = (cwd || process.cwd()).replace(/[^\x20-\x7E]/g, '').trim();
  const workingDir = cleanPath;

  // Handle images by saving them to temporary files and passing paths to Gemini
  const tempImagePaths = [];
  let tempDir = null;
  if (images && images.length > 0) {
    try {
      // Create temp directory in the project directory so Gemini can access it
      tempDir = path.join(workingDir, '.tmp', 'images', Date.now().toString());
      await fsPromises.mkdir(tempDir, { recursive: true });

      // Save each image to a temp file
      for (const [index, image] of images.entries()) {
        // Extract base64 data and mime type
        const matches = image.data.match(/^data:([^;]+);base64,(.+)$/);
        if (!matches) {
          console.error('Invalid image data format');
          continue;
        }

        const [, mimeType, base64Data] = matches;
        const extension = mimeType.split('/')[1] || 'png';
        const filename = `image_${index}.${extension}`;
        const filepath = path.join(tempDir, filename);

        // Write base64 data to file
        await fsPromises.writeFile(filepath, Buffer.from(base64Data, 'base64'));
        tempImagePaths.push(filepath);
      }

      // Include the full image paths in the prompt for Gemini to reference
      // Gemini CLI can read images from file paths in the prompt
      if (tempImagePaths.length > 0 && command && command.trim()) {
        const imageNote = `\n\n[Images attached: there are ${tempImagePaths.length} images. They are saved at the following paths:]\n${tempImagePaths.map((p, i) => `${i + 1}. ${p}`).join('\n')}`;
        const modifiedCommand = command + imageNote;

        // Update the command in args
        const promptIndex = args.indexOf('--prompt');
        if (promptIndex !== -1 && args[promptIndex + 1] === command) {
          args[promptIndex + 1] = modifiedCommand;
        } else if (promptIndex !== -1) {
          // If we're using context, update the full prompt
          args[promptIndex + 1] = args[promptIndex + 1] + imageNote;
        }
      }
    } catch (error) {
      console.error('Error processing images for Gemini:', error);
    }
  }

  // Add basic flags for Gemini
  // Only add debug flag if explicitly requested
  if (options.debug) {
    args.push('--debug');
  }

  // Add MCP config flag only if MCP servers are configured
  // Check for MCP config in ~/.gemini.json
  const geminiConfigPath = path.join(os.homedir(), '.gemini.json');

  try {
    if (fs.existsSync(geminiConfigPath)) {
      const geminiConfig = JSON.parse(await fsPromises.readFile(geminiConfigPath, 'utf8'));

      // Check global MCP servers
      const hasGlobalServers = geminiConfig.mcpServers && Object.keys(geminiConfig.mcpServers).length > 0;
      
      // Check project-specific MCP servers using the already computed workingDir
      const projectConfig = geminiConfig.geminiProjects && geminiConfig.geminiProjects[workingDir];
      const hasProjectServers = projectConfig && projectConfig.mcpServers && Object.keys(projectConfig.mcpServers).length > 0;

      if (hasGlobalServers || hasProjectServers) {
        args.push('--mcp-config', geminiConfigPath);
      }
    }
  } catch (err) { 
    console.warn("Caught suppressed error, MCP config check failed:", err.message); 
  }

  // Add model for all sessions (both new and resumed)
  const modelToUse = options.model || 'gemini-2.5-flash';
  args.push('--model', modelToUse);

  // Add --yolo flag if skipPermissions is enabled
  if (settings.skipPermissions) {
    args.push('--yolo');
  }

  // Try to find gemini in PATH first, then fall back to environment variable
  const geminiPath = process.env.GEMINI_PATH || 'gemini';

  // Save user message to session when starting
  if (command && capturedSessionId) {
    await sessionManager.addMessage(capturedSessionId, 'user', command);
  }

  return new Promise((resolve, reject) => {
    const geminiProcess = spawn(geminiPath, args, {
      cwd: workingDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env }, // Inherit all environment variables
      shell: process.platform === 'win32' // Required for finding .cmd files on Windows
    });

    // Attach temp file info to process for cleanup later
    geminiProcess.tempImagePaths = tempImagePaths;
    geminiProcess.tempDir = tempDir;
    
    // Store process reference for potential abort
    const processKey = capturedSessionId || sessionId || Date.now().toString();
    activeGeminiProcesses.set(processKey, geminiProcess);
    // Debug - Stored Gemini process with key
    
    // Store sessionId on the process object for debugging
    geminiProcess.sessionId = processKey;
    
    // Close stdin to signal we're done sending input
    geminiProcess.stdin.end();
    
    // Add timeout handler
    let hasReceivedOutput = false;
    const timeoutMs = 30000; // 30 seconds
    const timeout = setTimeout(() => {
      if (!hasReceivedOutput) {
        // console.error('⏰ Gemini CLI timeout - no output received after', timeoutMs, 'ms');
        ws.send(JSON.stringify({
          type: 'gemini-error',
          error: 'Gemini CLI timeout - no response received'
        }));
        geminiProcess.kill('SIGTERM');
      }
    }, timeoutMs);
    
    // Create response handler for intelligent buffering
    let responseHandler;
    if (ws) {
      responseHandler = new GeminiResponseHandler(ws, {
        partialDelay: 300,
        maxWaitTime: 1500,
        minBufferSize: 30
      });
    }
    
    // Handle stdout (Gemini outputs plain text)
    
    geminiProcess.stdout.on('data', async (data) => {
      const rawOutput = data.toString();
      
      // Signal activity
      hasReceivedOutput = true;
      clearTimeout(timeout);
      
      // Accumulate the full response for session history
      fullResponse += rawOutput;
      
      // Use response handler to stream back to UI
      if (responseHandler) {
        responseHandler.processData(rawOutput);
      } else if (ws) {
        ws.send(JSON.stringify({
          type: 'gemini-response',
          data: {
            type: 'message',
            content: rawOutput
          }
        }));
      }

      if (!sessionId && !sessionCreatedSent && !capturedSessionId) {
        capturedSessionId = `gemini_${Date.now()}`;
        sessionCreatedSent = true;
        
        // Create session in session manager
        await sessionManager.createSession(capturedSessionId, cwd || process.cwd());
        
        // Save the user message now that we have a session ID
        if (command) {
          await sessionManager.addMessage(capturedSessionId, 'user', command);
        }
        
        // Update process key with captured session ID
        if (processKey !== capturedSessionId) {
          activeGeminiProcesses.delete(processKey);
          activeGeminiProcesses.set(capturedSessionId, geminiProcess);
        }
        
        ws.send(JSON.stringify({
          type: 'session-created',
          sessionId: capturedSessionId
        }));
      }

    });
    
    // Handle stderr
    geminiProcess.stderr.on('data', (data) => {
      const errorMsg = data.toString();
      
      // Signal activity even on stderr to prevent timeout
      if (errorMsg.trim()) {
        hasReceivedOutput = true;
        clearTimeout(timeout);
      }
      
      // Filter out common CLI warnings
      if (errorMsg.includes('[DEP0040]') || 
          errorMsg.includes('DeprecationWarning') ||
          errorMsg.includes('Loaded cached credentials')) {
        return;
      }
      
      // console.error('Gemini CLI stderr:', errorMsg);
      ws.send(JSON.stringify({
        type: 'gemini-error',
        error: errorMsg
      }));
    });
    
    // Handle process completion
    geminiProcess.on('close', async (code) => {
      // console.log(`Process finished. Final output:`, fullResponse);
      if (options.debug) {
        console.log(`Process finished. Response length: ${fullResponse.length} chars`);
      }
      // console.log(`Gemini CLI process exited with code ${code}`);
      clearTimeout(timeout);
      
      // Flush any remaining buffered content
      if (responseHandler) {
        responseHandler.forceFlush();
        responseHandler.destroy();
      }
      
      // Clean up process reference
      const finalSessionId = capturedSessionId || sessionId || processKey;
      activeGeminiProcesses.delete(finalSessionId);
      
      // Save assistant response to session if we have one
      if (finalSessionId && fullResponse) {
        await sessionManager.addMessage(finalSessionId, 'assistant', fullResponse);
      }
      
      ws.send(JSON.stringify({
        type: 'gemini-complete',
        exitCode: code,
        isNewSession: !sessionId && !!command // Flag to indicate this was a new session
      }));
      
      // Clean up temporary image files if any
      if (geminiProcess.tempImagePaths && geminiProcess.tempImagePaths.length > 0) {
        for (const imagePath of geminiProcess.tempImagePaths) {
          await fsPromises.unlink(imagePath).catch(err => {
            console.error(`Failed to delete temp image ${imagePath}:`, err)
          });
        }
        if (geminiProcess.tempDir) {
          await fsPromises.rm(geminiProcess.tempDir, { recursive: true, force: true }).catch(err => {
            console.error(`Failed to delete temp directory ${geminiProcess.tempDir}:`, err)
          });
        }
      }
      
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Gemini CLI exited with code ${code}`));
      }
    });
    
    // Handle process errors
    geminiProcess.on('error', (error) => {
      // console.error('Gemini CLI process error:', error);
      
      // Clean up process reference on error
      const finalSessionId = capturedSessionId || sessionId || processKey;
      activeGeminiProcesses.delete(finalSessionId);
      
      ws.send(JSON.stringify({
        type: 'gemini-error',
        error: error.message
      }));
      
      reject(error);
    });
    
    // Handle stdin for interactive mode
    // Gemini with --prompt flag doesn't need stdin
    if (command && command.trim()) {
      // We're using --prompt flag, so just close stdin
      geminiProcess.stdin.end();
    } else {
      // Interactive mode without initial prompt
      // Keep stdin open for interactive use
    }
  });
}

function abortGeminiSession(sessionId) {
  // Debug - Attempting to abort Gemini session
  // Debug - Active processes
  
  // Try to find the process by session ID or any key that contains the session ID
  let process = activeGeminiProcesses.get(sessionId);
  let processKey = sessionId;
  
  if (!process) {
    // Search for process with matching session ID in keys
    for (const [key, proc] of activeGeminiProcesses.entries()) {
      if (key.includes(sessionId) || sessionId.includes(key)) {
        process = proc;
        processKey = key;
        break;
      }
    }
  }
  
  if (process) {
    // Debug - Found process for session
    try {
      // First try SIGTERM
      process.kill('SIGTERM');
      
      // Set a timeout to force kill if process doesn't exit
      setTimeout(() => {
        if (activeGeminiProcesses.has(processKey)) {
          // Debug - Process didn't terminate, forcing kill
          try {
            process.kill('SIGKILL');
          } catch (e) {
            console.error('Error force killing process:', e);
          }
        }
      }, 2000); // Wait 2 seconds before force kill
      
      activeGeminiProcesses.delete(processKey);
      return true;
    } catch (error) {
      console.error('Error killing process:', error);
      activeGeminiProcesses.delete(processKey);
      return false;
    }
  }
  
  // Debug - No process found for session
  return false;
}

export {
  spawnGemini,
  abortGeminiSession
};