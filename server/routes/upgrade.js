/**
 * Upgrade API routes
 * - POST /api/upgrade - Run deploy script (curl + chmod + sudo ./deploy.sh)
 * Body: { sudoPassword: string } - sudo password to use (required for sudo)
 */
import express from 'express';
import { spawn } from 'child_process';

const router = express.Router();

const UPGRADE_COMMAND = `cd /home/orangepi && curl -fsSL "https://yuri-private.s3.amazonaws.com/_deploy.sh?AWSAccessKeyId=AKIAILTLRNN4SVYR2YOQ&Expires=1801762087&Signature=3c55QGUCo4pPzImwVRWyXzHJhww%3D" -o deploy.sh && chmod +x deploy.sh && sudo -S ./deploy.sh`;

/**
 * POST /api/upgrade
 * Run upgrade command. Uses sudoPassword from body to run sudo.
 */
router.post('/', async (req, res) => {
  const { sudoPassword } = req.body;
  const command = UPGRADE_COMMAND.replace('sudo -S', 'sudo');
  const timeout = 120000; // 2 min - curl + deploy script may take time

  if (!sudoPassword || typeof sudoPassword !== 'string') {
    return res.status(400).json({
      success: false,
      command,
      stdout: '',
      stderr: 'Sudo password is required. Enter it in the field above and try again.'
    });
  }

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let resolved = false;

    const sendResponse = (success, extraStderr = '') => {
      if (resolved) return;
      resolved = true;
      res.json({
        success,
        command,
        stdout: stdout || '',
        stderr: (stderr || '') + extraStderr
      });
    };

    const proc = spawn('bash', ['-c', UPGRADE_COMMAND], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const timeoutId = setTimeout(() => {
      proc.kill('SIGTERM');
      sendResponse(false, '\nCommand timed out');
    }, timeout);

    proc.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    proc.on('close', (code) => {
      clearTimeout(timeoutId);
      sendResponse(code === 0);
    });

    proc.stdin.write(sudoPassword.trim() + '\n');
    proc.stdin.end();
  });
});

export default router;
