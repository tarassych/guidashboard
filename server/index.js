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

// Get all unique drone IDs from database (detected via GPS telemetry)
app.get('/api/drones', (req, res) => {
  if (!db) {
    if (!connectDatabase()) {
      return res.status(500).json({ error: 'Database not connected' });
    }
  }

  try {
    // Calculate cutoff time (10 minutes ago) as ISO string
    const ACTIVE_THRESHOLD_MINUTES = 10;
    const cutoffTime = new Date(Date.now() - ACTIVE_THRESHOLD_MINUTES * 60 * 1000).toISOString();
    
    // Get ALL drones that have any GPS telemetry records (for droneIds list)
    const allDronesStmt = db.prepare(`
      SELECT DISTINCT drone_id 
      FROM telemetry 
      WHERE data LIKE '%"type":%"gps"%'
      ORDER BY drone_id ASC
    `);
    const allRows = allDronesStmt.all();
    const droneIds = allRows.map(r => r.drone_id);
    
    // Load profiles to check which drones are configured
    const profiles = loadProfiles();
    const configuredIds = Object.keys(profiles.drones);
    
    // Get drones with RECENT activity (within last 10 minutes) that are not in profiles
    // These are the "detected" drones - actively sending telemetry but not yet configured
    const recentDronesStmt = db.prepare(`
      SELECT DISTINCT drone_id 
      FROM telemetry 
      WHERE data LIKE '%"type":%"gps"%'
        AND timestamp >= ?
      ORDER BY drone_id ASC
    `);
    const recentRows = recentDronesStmt.all(cutoffTime);
    const recentDroneIds = recentRows.map(r => r.drone_id);
    
    // Filter to only those without profiles
    const detectedDroneIds = recentDroneIds.filter(id => !configuredIds.includes(String(id)));
    
    // Get latest GPS coordinates for each detected drone
    const detectedDrones = detectedDroneIds.map(droneId => {
      const gpsStmt = db.prepare(`
        SELECT data, timestamp 
        FROM telemetry 
        WHERE drone_id = ? AND data LIKE '%"type":%"gps"%'
        ORDER BY ID DESC 
        LIMIT 1
      `);
      const gpsRow = gpsStmt.get(droneId);
      
      let latitude = null;
      let longitude = null;
      let timestamp = null;
      
      if (gpsRow) {
        try {
          const gpsData = JSON.parse(gpsRow.data);
          latitude = gpsData.latitude;
          longitude = gpsData.longitude;
          timestamp = gpsRow.timestamp;
        } catch (e) {
          // ignore parse errors
        }
      }
      
      return {
        droneId: String(droneId),
        latitude,
        longitude,
        lastSeen: timestamp
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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    dbConnected: db !== null,
    dbPath: config.dbPath,
    scriptsPath: config.scriptsPath
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



