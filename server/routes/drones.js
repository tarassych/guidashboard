/**
 * Drone-related API routes
 * - GET /api/drones - Get active drones
 * - GET /api/drone/:droneId/has-telemetry - Check if drone has telemetry
 * - GET /api/elrs/status - Check ELRS connection status
 */
import express from 'express';
import fs from 'fs';
import { getDb } from '../lib/database.js';
import { loadProfiles, getAllDroneIds } from '../lib/profiles.js';

const ELRS_FILE_PATH = '/dev/shm/elrs';
const ELRS_FRESHNESS_MS = 5000; // File must be updated within 5 seconds

const router = express.Router();

/**
 * GET /api/drones
 * Get recently active drones from database (battery telemetry within last 1 minute)
 */
router.get('/drones', (req, res) => {
  const db = getDb();
  if (!db) {
    return res.status(500).json({ error: 'Database not connected' });
  }

  try {
    // Calculate cutoff time (1 minute ago) as Unix milliseconds
    // Database stores timestamps as Unix milliseconds (e.g., 1767017842866)
    const ACTIVE_THRESHOLD_MINUTES = 1;
    const cutoffTime = Date.now() - ACTIVE_THRESHOLD_MINUTES * 60 * 1000;
    
    // Load profiles to check which drones are configured
    // getAllDroneIds returns array of droneId strings
    const configuredIds = getAllDroneIds();
    
    // Single optimized query: Get recent drone IDs with their latest battery data
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
          AND json_extract(data, '$.type') = 'batt'
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

/**
 * GET /api/drone/:droneId/has-telemetry
 * Check if drone has any telemetry in database
 */
router.get('/drone/:droneId/has-telemetry', (req, res) => {
  const { droneId } = req.params;
  
  const db = getDb();
  if (!db) {
    return res.status(500).json({ error: 'Database not connected' });
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

/**
 * POST /api/drones/activate
 * Write droneId to /dev/shm/active file to activate control
 * Body: { droneId: string }
 */
router.post('/drones/activate', (req, res) => {
  const { droneId } = req.body
  
  if (!droneId) {
    return res.status(400).json({ 
      success: false, 
      error: 'droneId is required' 
    })
  }
  
  try {
    const ACTIVE_FILE_PATH = '/dev/shm/active'
    fs.writeFileSync(ACTIVE_FILE_PATH, String(droneId), 'utf8')
    
    console.log(`[ACTIVATE] Wrote droneId ${droneId} to ${ACTIVE_FILE_PATH}`)
    
    res.json({
      success: true,
      droneId,
      message: `Drone ${droneId} activation signal sent`
    })
  } catch (error) {
    console.error('Failed to write active file:', error.message)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * GET /api/elrs/status
 * Check if ELRS is connected (file exists and is fresh)
 * Returns: { connected: boolean, fileExists: boolean, fileAge: number|null }
 */
router.get('/elrs/status', (req, res) => {
  try {
    // Check if file exists
    if (!fs.existsSync(ELRS_FILE_PATH)) {
      return res.json({
        connected: false,
        fileExists: false,
        fileAge: null
      });
    }
    
    // Get file stats to check modification time
    const stats = fs.statSync(ELRS_FILE_PATH);
    const fileAge = Date.now() - stats.mtimeMs;
    const isConnected = fileAge <= ELRS_FRESHNESS_MS;
    
    res.json({
      connected: isConnected,
      fileExists: true,
      fileAge: Math.round(fileAge)
    });
  } catch (error) {
    console.error('ELRS status check error:', error.message);
    res.json({
      connected: false,
      fileExists: false,
      fileAge: null,
      error: error.message
    });
  }
});

export default router;
