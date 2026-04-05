import pty from 'node-pty';
import os from 'os';

console.log('✅ node-pty imported successfully');
console.log('💻 OS Platform:', os.platform());

try {
  if (os.platform() === 'win32') {
    const shell = 'powershell.exe';
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-color',
      cols: 80,
      rows: 24,
      cwd: process.cwd(),
      env: process.env
    });
    console.log('✅ PTY process spawned successfully:', shell);
    ptyProcess.kill();
  }
} catch (e) {
  console.error('❌ PTY failed:', e.message);
}
