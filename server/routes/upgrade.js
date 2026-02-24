/**
 * Upgrade API routes
 * - POST /api/upgrade - Run upgrade via wrapper (sudo /usr/local/bin/run-upgrade)
 * Uses passwordless sudo via sudoers. Run tools/setup-upgrade-wrapper.sh on Orange Pi once.
 */
import express from 'express';
import { spawn } from 'child_process';

const router = express.Router();

const UPGRADE_COMMAND = 'sudo /usr/local/bin/run-upgrade';
const timeout = 120000; // 2 min - curl + deploy script may take time

/**
 * POST /api/upgrade
 * Run upgrade via wrapper. No password required if setup-upgrade-wrapper.sh was run.
 */
router.post('/', async (req, res) => {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let resolved = false;

    const sendResponse = (success, extraStderr = '') => {
      if (resolved) return;
      resolved = true;
      res.json({
        success,
        command: UPGRADE_COMMAND,
        stdout: stdout || '',
        stderr: (stderr || '') + extraStderr
      });
    };

    const proc = spawn('sudo', ['/usr/local/bin/run-upgrade'], {
      stdio: ['ignore', 'pipe', 'pipe']
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

    proc.on('error', (err) => {
      sendResponse(false, '\n' + (err.message || 'Failed to start upgrade'));
    });
  });
});

export default router;
