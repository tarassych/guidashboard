/**
 * Upgrade API routes (Option 3: systemd service)
 * - POST /api/upgrade - Start upgrade via systemctl (returns immediately)
 * - GET /api/upgrade/status - Poll for running state and output
 * Upgrade runs in systemd, survives API restart. Output in /tmp/upgrade.log
 */
import express from 'express';
import { spawn } from 'child_process';
import { readFile } from 'fs/promises';

const router = express.Router();

const UPGRADE_SERVICE = 'guidashboard-upgrade';
const UPGRADE_LOG = '/tmp/upgrade.log';
const MAX_LOG_BYTES = 100000; // ~100KB tail

/**
 * POST /api/upgrade
 * Start upgrade service. Returns immediately. Frontend polls GET /status for output.
 */
router.post('/', async (req, res) => {
  return new Promise((resolve) => {
    const proc = spawn('sudo', ['systemctl', 'start', UPGRADE_SERVICE], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        res.json({ success: true, message: 'Upgrade started' });
      } else {
        res.json({
          success: false,
          message: 'Failed to start upgrade',
          stderr: stderr || `Exit code ${code}`
        });
      }
      resolve();
    });

    proc.on('error', (err) => {
      res.json({
        success: false,
        message: err.message || 'Failed to start upgrade'
      });
      resolve();
    });
  });
});

/**
 * GET /api/upgrade/status
 * Returns { running, output, exitCode?, success? } for polling.
 */
router.get('/status', async (req, res) => {
  try {
    const [running, exitCode] = await Promise.all([
      isServiceActive(UPGRADE_SERVICE),
      getServiceExitCode(UPGRADE_SERVICE)
    ]);

    let output = '';
    try {
      const buf = await readFile(UPGRADE_LOG, { encoding: 'utf8', flag: 'r' });
      output = buf.length > MAX_LOG_BYTES ? buf.slice(-MAX_LOG_BYTES) : buf;
    } catch {
      output = '';
    }

    const success = !running && exitCode !== null ? exitCode === 0 : undefined;

    res.json({
      running,
      output,
      exitCode: exitCode ?? undefined,
      success
    });
  } catch (err) {
    res.status(500).json({
      running: false,
      output: '',
      error: err.message
    });
  }
});

function isServiceActive(name) {
  return new Promise((resolve) => {
    const proc = spawn('systemctl', ['is-active', name], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let out = '';
    proc.stdout.on('data', (c) => { out += c.toString(); });
    proc.on('close', (code) => {
      const s = out.trim();
      resolve(s === 'active' || s === 'activating');
    });
  });
}

function getServiceExitCode(name) {
  return new Promise((resolve) => {
    const proc = spawn('systemctl', ['show', name, '--property=ExecMainStatus', '--value'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let out = '';
    proc.stdout.on('data', (c) => { out += c.toString(); });
    proc.on('close', () => {
      const val = out.trim();
      if (val === '' || val === 'null') resolve(null);
      else resolve(parseInt(val, 10));
    });
  });
}

export default router;
