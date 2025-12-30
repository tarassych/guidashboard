/**
 * MediaMTX monitoring API routes
 * - GET /api/mediamtx/status - Get MediaMTX process status
 * - GET /api/mediamtx/paths - Get all configured paths/streams
 * - GET /api/mediamtx/config - Get current config info
 * - GET /api/mediamtx/logs - Get recent log output
 */
import express from 'express';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { config } from '../config.js';

const execAsync = promisify(exec);
const router = express.Router();

const MEDIAMTX_API = 'http://localhost:9997';
const mediamtxBinary = path.join(config.mediamtxPath, 'mediamtx');
const mediamtxLog = path.join(config.mediamtxPath, 'mediamtx.log');
const pathsYmlPath = path.join(config.mediamtxPath, 'paths.yml');

/**
 * Helper to fetch from MediaMTX API
 */
async function fetchMediamtxApi(endpoint) {
  try {
    const response = await fetch(`${MEDIAMTX_API}${endpoint}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * GET /api/mediamtx/status
 * Get MediaMTX process status and overview
 */
router.get('/mediamtx/status', async (req, res) => {
  try {
    // Check if process is running
    let pid = null;
    let uptime = null;
    try {
      const { stdout } = await execAsync(`pidof ${mediamtxBinary} 2>/dev/null || echo ""`);
      pid = stdout.trim() || null;
      
      if (pid) {
        // Get process uptime
        const { stdout: psOut } = await execAsync(`ps -o etime= -p ${pid} 2>/dev/null || echo ""`);
        uptime = psOut.trim() || null;
      }
    } catch {
      // Process not running
    }
    
    // Get paths from API
    const pathsData = await fetchMediamtxApi('/v3/paths/list');
    
    // Get HLS muxers (active streams)
    const hlsData = await fetchMediamtxApi('/v3/hlsmuxers/list');
    
    // Get RTSP connections
    const rtspData = await fetchMediamtxApi('/v3/rtspconns/list');
    
    // Calculate stats
    const paths = pathsData.items || [];
    const activePaths = paths.filter(p => p.ready);
    const totalBytesReceived = paths.reduce((sum, p) => sum + (p.bytesReceived || 0), 0);
    const totalBytesSent = paths.reduce((sum, p) => sum + (p.bytesSent || 0), 0);
    const totalReaders = paths.reduce((sum, p) => sum + (p.readers?.length || 0), 0);
    
    res.json({
      success: true,
      status: {
        running: !!pid,
        pid,
        uptime,
        apiAvailable: !pathsData.error
      },
      stats: {
        totalPaths: paths.length,
        activePaths: activePaths.length,
        totalReaders,
        bytesReceived: totalBytesReceived,
        bytesSent: totalBytesSent,
        hlsMuxers: hlsData.items?.length || 0,
        rtspConnections: rtspData.items?.length || 0
      },
      paths: paths.map(p => ({
        name: p.name,
        ready: p.ready,
        readyTime: p.readyTime,
        sourceType: p.source?.type || 'unknown',
        tracks: p.tracks?.length || 0,
        readers: p.readers?.length || 0,
        bytesReceived: p.bytesReceived || 0,
        bytesSent: p.bytesSent || 0
      }))
    });
  } catch (error) {
    console.error('MediaMTX status error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/mediamtx/paths
 * Get detailed path information
 */
router.get('/mediamtx/paths', async (req, res) => {
  const pathsData = await fetchMediamtxApi('/v3/paths/list');
  
  if (pathsData.error) {
    return res.json({ success: false, error: pathsData.error, paths: [] });
  }
  
  res.json({
    success: true,
    itemCount: pathsData.itemCount || 0,
    paths: pathsData.items || []
  });
});

/**
 * GET /api/mediamtx/config
 * Get current paths.yml configuration
 */
router.get('/mediamtx/config', async (req, res) => {
  try {
    let pathsYml = '';
    if (fs.existsSync(pathsYmlPath)) {
      pathsYml = fs.readFileSync(pathsYmlPath, 'utf-8');
    }
    
    // Parse paths from yml
    const paths = [];
    const lines = pathsYml.split('\n');
    let currentPath = null;
    let currentConfig = {};
    
    for (const line of lines) {
      const pathMatch = line.match(/^  (\S+):$/);
      if (pathMatch) {
        if (currentPath) {
          paths.push({ name: currentPath, ...currentConfig });
        }
        currentPath = pathMatch[1];
        currentConfig = {};
        continue;
      }
      
      const propMatch = line.match(/^    (\w+):\s*(.*)$/);
      if (propMatch && currentPath) {
        currentConfig[propMatch[1]] = propMatch[2];
      }
    }
    if (currentPath) {
      paths.push({ name: currentPath, ...currentConfig });
    }
    
    res.json({
      success: true,
      configPath: pathsYmlPath,
      raw: pathsYml,
      paths
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/mediamtx/logs
 * Get recent log output
 */
router.get('/mediamtx/logs', async (req, res) => {
  const lines = parseInt(req.query.lines) || 100;
  
  try {
    let logs = '';
    
    // Try to read from log file
    if (fs.existsSync(mediamtxLog)) {
      const { stdout } = await execAsync(`tail -${lines} ${mediamtxLog} 2>/dev/null || echo ""`);
      logs = stdout;
    }
    
    // If no log file, try to get from journalctl (if running as service)
    if (!logs) {
      try {
        const { stdout } = await execAsync(`journalctl -u mediamtx -n ${lines} --no-pager 2>/dev/null || echo ""`);
        logs = stdout;
      } catch {
        // Not a systemd service
      }
    }
    
    res.json({
      success: true,
      logPath: mediamtxLog,
      lines: logs.split('\n').filter(l => l.trim())
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, lines: [] });
  }
});

/**
 * POST /api/mediamtx/restart
 * Restart MediaMTX process
 */
router.post('/mediamtx/restart', async (req, res) => {
  try {
    // Kill existing process
    try {
      const { stdout } = await execAsync(`pidof ${mediamtxBinary} 2>/dev/null || echo ""`);
      const pid = stdout.trim();
      if (pid) {
        await execAsync(`kill ${pid}`);
        await new Promise(r => setTimeout(r, 1000));
      }
    } catch {
      // Process wasn't running
    }
    
    // Start new process
    await execAsync(
      `cd ${config.mediamtxPath} && setsid ./mediamtx > ${mediamtxLog} 2>&1 &`,
      { shell: '/bin/bash' }
    );
    
    await new Promise(r => setTimeout(r, 2000));
    
    // Verify it started
    const { stdout: verifyOut } = await execAsync(
      `pidof ${mediamtxBinary} 2>/dev/null || echo ""`
    );
    
    const newPid = verifyOut.trim();
    
    res.json({
      success: !!newPid,
      pid: newPid || null,
      message: newPid ? 'MediaMTX restarted successfully' : 'Failed to start MediaMTX'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;

