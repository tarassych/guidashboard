import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';

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
    db = new Database(config.dbPath, { readonly: true });
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

// Get all unique drone IDs from database
app.get('/api/drones', (req, res) => {
  if (!db) {
    if (!connectDatabase()) {
      return res.status(500).json({ error: 'Database not connected' });
    }
  }

  try {
    const stmt = db.prepare(`
      SELECT DISTINCT drone_id 
      FROM telemetry 
      ORDER BY drone_id ASC
    `);
    const rows = stmt.all();
    const droneIds = rows.map(r => r.drone_id);
    
    // Load profiles to check which drones are configured
    const profiles = loadProfiles();
    const configuredIds = Object.keys(profiles.drones).map(id => parseInt(id));
    
    // Find unknown drones (in DB but not in profiles)
    const unknownDrones = droneIds.filter(id => !configuredIds.includes(id));

    res.json({
      success: true,
      droneIds,
      configuredDrones: configuredIds,
      unknownDrones,
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
  const droneId = parseInt(req.params.droneId);
  const profileData = req.body;
  
  if (isNaN(droneId)) {
    return res.status(400).json({ error: 'Invalid drone ID' });
  }

  const profiles = loadProfiles();
  profiles.drones[droneId] = {
    ...profiles.drones[droneId],
    ...profileData,
    droneId,
    updatedAt: Date.now()
  };

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
  const droneId = parseInt(req.params.droneId);
  
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
    const droneId = req.query.droneId ? parseInt(req.query.droneId) : null;

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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    dbConnected: db !== null,
    dbPath: config.dbPath
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



