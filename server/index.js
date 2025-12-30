import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import { config } from './config.js';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// CORS configuration
app.use(cors({
  origin: config.corsOrigin
}));

app.use(express.json());

// Database connection
let db = null;

function connectDatabase() {
  try {
    // WAL mode requires write access even for reading (for -wal and -shm files)
    db = new Database(config.dbPath);
    console.log(`Connected to database: ${config.dbPath}`);
    return true;
  } catch (error) {
    console.error(`Failed to connect to database: ${error.message}`);
    return false;
  }
}

// Drone profiles file path
const profilesPath = path.join(__dirname, 'drone-profiles.json');

// Load drone profiles from file
function loadProfiles() {
  try {
    if (fs.existsSync(profilesPath)) {
      const data = fs.readFileSync(profilesPath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Failed to load drone profiles:', error.message);
  }
  return { drones: {} };
}

// Save drone profiles to file
function saveProfiles(profiles) {
  try {
    fs.writeFileSync(profilesPath, JSON.stringify(profiles, null, 2));
    return true;
  } catch (error) {
    console.error('Failed to save drone profiles:', error.message);
    return false;
  }
}

// MediaMTX paths.yml management
const pathsYmlPath = path.join(config.mediamtxPath, 'paths.yml');

// Load current paths.yml content
function loadPathsYml() {
  try {
    if (fs.existsSync(pathsYmlPath)) {
      return fs.readFileSync(pathsYmlPath, 'utf-8');
    }
  } catch (error) {
    console.error('Failed to load paths.yml:', error.message);
  }
  return '';
}

// Parse paths.yml into a structured object
function parsePathsYml(content) {
  const paths = {};
  const lines = content.split('\n');
  let currentPath = null;
  let currentConfig = {};
  
  for (const line of lines) {
    // Match path name (e.g., "  cam123:")
    const pathMatch = line.match(/^  (\S+):$/);
    if (pathMatch) {
      // Save previous path
      if (currentPath) {
        paths[currentPath] = currentConfig;
      }
      currentPath = pathMatch[1];
      currentConfig = {};
      continue;
    }
    
    // Match config property (e.g., "    source: rtsp://...")
    const propMatch = line.match(/^    (\w+):\s*(.*)$/);
    if (propMatch && currentPath) {
      currentConfig[propMatch[1]] = propMatch[2];
    }
  }
  
  // Save last path
  if (currentPath) {
    paths[currentPath] = currentConfig;
  }
  
  return paths;
}

// Generate paths.yml content from structured object
function generatePathsYml(paths) {
  let content = '';
  
  for (const [pathName, config] of Object.entries(paths)) {
    content += `  ${pathName}:\n`;
    for (const [key, value] of Object.entries(config)) {
      content += `    ${key}: ${value}\n`;
    }
    content += '\n';
  }
  
  return content;
}

// Update camera config in paths.yml (returns log messages)
function updateCameraInPaths(camera, serialNumber) {
  const logs = [];
  
  if (!camera || !serialNumber) {
    logs.push('[SKIP] Missing camera or serialNumber');
    return { success: false, logs };
  }
  
  try {
    const currentContent = loadPathsYml();
    const paths = parsePathsYml(currentContent);
    
    const pathName = `cam${serialNumber}`;
    const rtspPort = camera.rtspPort || 554;
    const rtspPath = camera.rtspPath || '/stream0';
    const login = camera.login || 'admin';
    const password = camera.password || '';
    
    // Build RTSP URL (mask password in logs)
    const rtspUrl = `rtsp://${login}:${password}@${camera.ip}:${rtspPort}${rtspPath}`;
    const rtspUrlMasked = `rtsp://${login}:***@${camera.ip}:${rtspPort}${rtspPath}`;
    
    const isNew = !paths[pathName];
    paths[pathName] = {
      source: rtspUrl,
      sourceOnDemand: 'yes',
      sourceProtocol: 'tcp'
    };
    
    logs.push(`[${isNew ? 'ADD' : 'UPDATE'}] ${pathName}: ${rtspUrlMasked}`);
    
    const newContent = generatePathsYml(paths);
    fs.writeFileSync(pathsYmlPath, newContent);
    logs.push(`[WRITE] paths.yml updated`);
    
    return { success: true, logs };
  } catch (error) {
    logs.push(`[ERROR] ${error.message}`);
    console.error('Failed to update paths.yml:', error.message);
    return { success: false, logs };
  }
}

// Update all cameras from a profile in paths.yml (async, returns terminal output)
async function updateProfileCamerasInPathsAsync(profile) {
  const output = {
    commands: [],
    stdout: '',
    stderr: '',
    success: true
  };
  
  // Update front camera
  if (profile.frontCamera && profile.frontCamera.serialNumber) {
    output.commands.push(`Updating front camera: cam${profile.frontCamera.serialNumber}`);
    const result = updateCameraInPaths(profile.frontCamera, profile.frontCamera.serialNumber);
    output.stdout += result.logs.join('\n') + '\n';
    if (!result.success) output.success = false;
  }
  
  // Update rear camera
  if (profile.rearCamera && profile.rearCamera.serialNumber) {
    output.commands.push(`Updating rear camera: cam${profile.rearCamera.serialNumber}`);
    const result = updateCameraInPaths(profile.rearCamera, profile.rearCamera.serialNumber);
    output.stdout += result.logs.join('\n') + '\n';
    if (!result.success) output.success = false;
  }
  
  // Rebuild mediamtx.yml
  const rebuildScript = path.join(config.mediamtxPath, 'rebuild-config.sh');
  if (fs.existsSync(rebuildScript)) {
    output.commands.push(`Running: ./rebuild-config.sh`);
    output.stdout += '\n[REBUILD] Running rebuild-config.sh...\n';
    
    try {
      const { stdout, stderr } = await execAsync(
        `cd ${config.mediamtxPath} && ./rebuild-config.sh`,
        { timeout: 10000 }
      );
      output.stdout += stdout || '';
      if (stderr) {
        output.stderr += stderr;
      }
      output.stdout += '[SUCCESS] MediaMTX config rebuilt\n';
    } catch (error) {
      output.stderr += `[ERROR] rebuild-config.sh failed: ${error.message}\n`;
      output.success = false;
    }
  } else {
    output.stderr += `[WARNING] rebuild-config.sh not found at ${rebuildScript}\n`;
  }
  
  // Check MediaMTX status and restart/reload
  output.stdout += '\n[MMTX] Checking MediaMTX status...\n';
  const mediamtxBinary = path.join(config.mediamtxPath, 'mediamtx');
  
  try {
    // Check if mediamtx is running
    const { stdout: psOut } = await execAsync(
      `pgrep -f "${mediamtxBinary}" || echo ""`,
      { timeout: 5000 }
    );
    const mediamtxPid = psOut.trim().split('\n')[0];
    
    if (mediamtxPid) {
      output.stdout += `[STATUS] MediaMTX running (PID: ${mediamtxPid})\n`;
      
      // Send SIGHUP to reload config without restart
      output.stdout += '[RELOAD] Sending SIGHUP to reload config...\n';
      try {
        await execAsync(`kill -HUP ${mediamtxPid}`, { timeout: 5000 });
        output.stdout += '[SUCCESS] Config reload signal sent\n';
      } catch (reloadErr) {
        output.stderr += `[WARNING] Could not reload: ${reloadErr.message}\n`;
        
        // Try restart instead
        output.stdout += '[RESTART] Attempting full restart...\n';
        try {
          await execAsync(`kill ${mediamtxPid}`, { timeout: 5000 });
          await new Promise(r => setTimeout(r, 1000));
          await execAsync(
            `cd ${config.mediamtxPath} && nohup ./mediamtx > /dev/null 2>&1 &`,
            { timeout: 5000 }
          );
          output.stdout += '[SUCCESS] MediaMTX restarted\n';
        } catch (restartErr) {
          output.stderr += `[ERROR] Restart failed: ${restartErr.message}\n`;
        }
      }
    } else {
      output.stdout += '[STATUS] MediaMTX not running\n';
      output.stdout += '[START] Starting MediaMTX...\n';
      
      try {
        await execAsync(
          `cd ${config.mediamtxPath} && nohup ./mediamtx > /dev/null 2>&1 &`,
          { timeout: 5000 }
        );
        await new Promise(r => setTimeout(r, 1000));
        
        // Verify it started
        const { stdout: verifyOut } = await execAsync(
          `pgrep -f "${mediamtxBinary}" || echo ""`,
          { timeout: 5000 }
        );
        if (verifyOut.trim()) {
          output.stdout += `[SUCCESS] MediaMTX started (PID: ${verifyOut.trim().split('\n')[0]})\n`;
        } else {
          output.stderr += '[WARNING] MediaMTX may not have started properly\n';
        }
      } catch (startErr) {
        output.stderr += `[ERROR] Failed to start MediaMTX: ${startErr.message}\n`;
      }
    }
  } catch (error) {
    output.stderr += `[ERROR] Status check failed: ${error.message}\n`;
  }
  
  return output;
}

// Get recently active drones from database (GPS telemetry within last 10 minutes)
app.get('/api/drones', (req, res) => {
  if (!db) {
    if (!connectDatabase()) {
      return res.status(500).json({ error: 'Database not connected' });
    }
  }

  try {
    // Calculate cutoff time (10 minutes ago) as Unix milliseconds
    // Database stores timestamps as Unix milliseconds (e.g., 1767017842866)
    const ACTIVE_THRESHOLD_MINUTES = 10;
    const cutoffTime = Date.now() - ACTIVE_THRESHOLD_MINUTES * 60 * 1000;
    
    // Load profiles to check which drones are configured
    const profiles = loadProfiles();
    const configuredIds = Object.keys(profiles.drones);
    
    // Single optimized query: Get recent drone IDs with their latest GPS data
    // Uses json_extract for exact type matching (types: gps, batt, state)
    // INDEXED BY forces SQLite to use timestamp index (otherwise it picks wrong index)
    const recentDronesStmt = db.prepare(`
      SELECT 
        t.drone_id,
        t.data,
        t.timestamp
      FROM telemetry t
      INNER JOIN (
        SELECT drone_id, MAX(ID) as max_id
        FROM telemetry INDEXED BY idx_telemetry_timestamp
        WHERE timestamp >= ?
          AND json_extract(data, '$.type') = 'gps'
        GROUP BY drone_id
      ) latest ON t.ID = latest.max_id
      ORDER BY t.drone_id ASC
    `);
    const recentRows = recentDronesStmt.all(cutoffTime);
    
    // All recently active drone IDs (for reference)
    const droneIds = recentRows.map(r => r.drone_id);
    
    // Build detected drones list (not in profiles) with GPS coordinates
    const detectedDrones = recentRows
      .filter(row => !configuredIds.includes(String(row.drone_id)))
      .map(row => {
        let latitude = null;
        let longitude = null;
        
        try {
          const gpsData = JSON.parse(row.data);
          latitude = gpsData.latitude;
          longitude = gpsData.longitude;
        } catch (e) {
          // ignore parse errors
        }
        
        return {
          droneId: String(row.drone_id),
          latitude,
          longitude,
          lastSeen: row.timestamp
        };
      });

    res.json({
      success: true,
      droneIds,
      configuredDrones: configuredIds,
      detectedDrones,
      activeThresholdMinutes: ACTIVE_THRESHOLD_MINUTES,
      count: droneIds.length
    });
  } catch (error) {
    console.error('Query error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get drone profiles
app.get('/api/profiles', (req, res) => {
  const profiles = loadProfiles();
  res.json({
    success: true,
    profiles: profiles.drones
  });
});

// Create or update a drone profile
app.post('/api/profiles/:droneId', (req, res) => {
  const droneId = req.params.droneId;
  const profileData = req.body;
  
  console.log(`Saving profile for drone ${droneId}:`, JSON.stringify(profileData));
  
  if (!droneId || droneId.trim() === '') {
    return res.status(400).json({ error: 'Invalid drone ID' });
  }

  const profiles = loadProfiles();
  profiles.drones[droneId] = {
    ...profiles.drones[droneId],
    ...profileData,
    droneId,
    updatedAt: Date.now()
  };
  
  console.log(`Final profile for drone ${droneId}:`, JSON.stringify(profiles.drones[droneId]));

  if (saveProfiles(profiles)) {
    res.json({
      success: true,
      profile: profiles.drones[droneId]
    });
  } else {
    res.status(500).json({ error: 'Failed to save profile' });
  }
});

// Delete a drone profile
app.delete('/api/profiles/:droneId', (req, res) => {
  const droneId = req.params.droneId;
  
  const profiles = loadProfiles();
  if (profiles.drones[droneId]) {
    delete profiles.drones[droneId];
    if (saveProfiles(profiles)) {
      res.json({ success: true });
    } else {
      res.status(500).json({ error: 'Failed to save profiles' });
    }
  } else {
    res.status(404).json({ error: 'Profile not found' });
  }
});

// Get telemetry records newer than the specified ID
// If no lastId provided, returns the latest 100 records
// Optionally filter by droneId
app.get('/api/telemetry', (req, res) => {
  if (!db) {
    if (!connectDatabase()) {
      return res.status(500).json({ error: 'Database not connected' });
    }
  }

  try {
    const lastId = parseInt(req.query.lastId) || 0;
    const limit = parseInt(req.query.limit) || 100;
    const droneId = req.query.droneId || null;

    let rows;
    if (droneId !== null) {
      // Filter by drone ID
      if (lastId > 0) {
        const stmt = db.prepare(`
          SELECT ID, drone_id, timestamp, data 
          FROM telemetry 
          WHERE ID > ? AND drone_id = ?
          ORDER BY ID DESC 
          LIMIT ?
        `);
        rows = stmt.all(lastId, droneId, limit);
      } else {
        const stmt = db.prepare(`
          SELECT ID, drone_id, timestamp, data 
          FROM telemetry 
          WHERE drone_id = ?
          ORDER BY ID DESC 
          LIMIT ?
        `);
        rows = stmt.all(droneId, limit);
      }
    } else {
      // Fetch all drones (original behavior)
      if (lastId > 0) {
        const stmt = db.prepare(`
          SELECT ID, drone_id, timestamp, data 
          FROM telemetry 
          WHERE ID > ? 
          ORDER BY ID DESC 
          LIMIT ?
        `);
        rows = stmt.all(lastId, limit);
      } else {
        const stmt = db.prepare(`
          SELECT ID, drone_id, timestamp, data 
          FROM telemetry 
          ORDER BY ID DESC 
          LIMIT ?
        `);
        rows = stmt.all(limit);
      }
    }

    // Parse JSON data field and format records
    const records = rows.map(row => {
      let parsedData = {};
      try {
        parsedData = JSON.parse(row.data);
      } catch (e) {
        parsedData = { raw: row.data };
      }

      return {
        id: row.ID,
        droneId: row.drone_id,
        timestamp: row.timestamp,
        data: parsedData
      };
    });

    res.json({
      success: true,
      records,
      count: records.length,
      latestId: records.length > 0 ? records[0].id : lastId
    });

  } catch (error) {
    console.error('Query error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Discover drones on the network
app.get('/api/discover', async (req, res) => {
  const scriptPath = path.join(config.scriptsPath, 'discover.sh');
  const command = `cd ${config.scriptsPath} && ./discover.sh`;
  
  // Check if script exists
  if (!fs.existsSync(scriptPath)) {
    return res.status(404).json({ 
      success: false,
      error: 'Discover script not found',
      path: scriptPath,
      command: null,
      stdout: '',
      stderr: ''
    });
  }
  
  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout: 30000 // 30 second timeout
    });
    
    // Try to parse JSON output from discover.sh
    let drones = [];
    let parseError = null;
    
    try {
      // Find JSON array in output (in case there's other text before/after)
      const jsonMatch = stdout.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        drones = JSON.parse(jsonMatch[0]);
      } else if (stdout.trim() === '[]' || stdout.trim() === '') {
        drones = [];
      } else {
        parseError = 'No JSON array found in output';
      }
    } catch (e) {
      parseError = e.message;
    }
    
    res.json({
      success: true,
      drones,
      parseError,
      command,
      stdout: stdout || '',
      stderr: stderr || ''
    });
  } catch (error) {
    console.error('Discover error:', error.message);
    res.json({ 
      success: false,
      drones: [],
      error: error.message,
      code: error.code,
      command,
      stdout: error.stdout || '',
      stderr: error.stderr || ''
    });
  }
});

// Scan for cameras on a drone's network
app.get('/api/scan-cameras/:ip', async (req, res) => {
  const { ip } = req.params;
  
  if (!ip) {
    return res.status(400).json({ error: 'IP address is required' });
  }
  
  const scriptPath = path.join(config.scriptsPath, 'scan_cam.sh');
  const command = `cd ${config.scriptsPath} && ./scan_cam.sh ${ip}`;
  
  // Check if script exists
  if (!fs.existsSync(scriptPath)) {
    return res.status(404).json({ 
      success: false,
      error: 'Camera scan script not found',
      path: scriptPath,
      command: null,
      stdout: '',
      stderr: ''
    });
  }
  
  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout: 60000 // 60 second timeout for camera scan
    });
    
    // Try to parse JSON output from scan_cam.sh
    let cameras = [];
    let parseError = null;
    
    try {
      // Find JSON array in output (in case there's other text before/after)
      const jsonMatch = stdout.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        cameras = JSON.parse(jsonMatch[0]);
      } else if (stdout.trim() === '[]' || stdout.trim() === '') {
        cameras = [];
      } else {
        parseError = 'No JSON array found in output';
      }
    } catch (e) {
      parseError = e.message;
    }
    
    res.json({
      success: true,
      cameras,
      parseError,
      command,
      stdout: stdout || '',
      stderr: stderr || ''
    });
  } catch (error) {
    console.error('Camera scan error:', error.message);
    res.json({ 
      success: false,
      cameras: [],
      error: error.message,
      code: error.code,
      command,
      stdout: error.stdout || '',
      stderr: error.stderr || ''
    });
  }
});

// Pair with a drone
app.post('/api/pair', async (req, res) => {
  const { ip, droneId } = req.body;
  
  if (!ip || !droneId) {
    return res.status(400).json({ error: 'IP and droneId are required' });
  }
  
  const scriptPath = path.join(config.scriptsPath, 'pair.sh');
  const command = `./pair.sh ${ip} ${droneId}`;
  
  // Check if script exists
  if (!fs.existsSync(scriptPath)) {
    return res.status(404).json({ 
      success: false,
      error: 'Pair script not found',
      path: scriptPath,
      command,
      stdout: '',
      stderr: ''
    });
  }
  
  try {
    const { stdout, stderr } = await execAsync(
      `cd ${config.scriptsPath} && ${command}`,
      { timeout: 30000 }
    );
    
    // Try to parse JSON output from pair.sh
    let result = { result: false };
    let parseError = null;
    
    try {
      const jsonMatch = stdout.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        // If output is not JSON but command succeeded, assume success
        result = { result: true };
      }
    } catch (e) {
      parseError = e.message;
      // Command succeeded but couldn't parse, assume success
      result = { result: true };
    }
    
    res.json({
      success: true,
      result: result.result,
      command,
      stdout: stdout || '',
      stderr: stderr || '',
      parseError
    });
  } catch (error) {
    console.error('Pair error:', error.message);
    res.json({ 
      success: false,
      result: false,
      error: error.message,
      code: error.code,
      command,
      stdout: error.stdout || '',
      stderr: error.stderr || ''
    });
  }
});

// Check if drone has telemetry in database
app.get('/api/drone/:droneId/has-telemetry', (req, res) => {
  const { droneId } = req.params;
  
  if (!db) {
    if (!connectDatabase()) {
      return res.status(500).json({ error: 'Database not connected' });
    }
  }
  
  try {
    const stmt = db.prepare(`
      SELECT COUNT(*) as count 
      FROM telemetry 
      WHERE drone_id = ?
      LIMIT 1
    `);
    const row = stmt.get(droneId);
    
    res.json({
      success: true,
      hasTelemetry: row.count > 0,
      droneId
    });
  } catch (error) {
    console.error('Query error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Update MediaMTX config for cameras
app.post('/api/update-mediamtx', async (req, res) => {
  const { frontCamera, rearCamera } = req.body;
  
  if (!frontCamera && !rearCamera) {
    return res.status(400).json({ 
      success: false, 
      error: 'At least one camera is required',
      stdout: '',
      stderr: ''
    });
  }
  
  try {
    const profile = { frontCamera, rearCamera };
    const result = await updateProfileCamerasInPathsAsync(profile);
    
    res.json({
      success: result.success,
      commands: result.commands,
      stdout: result.stdout,
      stderr: result.stderr
    });
  } catch (error) {
    console.error('MediaMTX update error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      stdout: '',
      stderr: error.message
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    dbConnected: db !== null,
    dbPath: config.dbPath,
    scriptsPath: config.scriptsPath,
    mediamtxPath: config.mediamtxPath
  });
});

// Start server
app.listen(config.port, () => {
  console.log(`Telemetry server running on port ${config.port}`);
  connectDatabase();
});

// Graceful shutdown
process.on('SIGINT', () => {
  if (db) {
    db.close();
    console.log('Database connection closed');
  }
  process.exit(0);
});



