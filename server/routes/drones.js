/**
 * Drone-related API routes
 * - GET /api/drones - Get active drones
 * - GET /api/drone/:droneId/has-telemetry - Check if drone has telemetry
 */
import express from 'express';
import { getDb } from '../lib/database.js';
import { loadProfiles } from '../lib/profiles.js';

const router = express.Router();

/**
 * GET /api/drones
 * Get recently active drones from database (GPS telemetry within last 10 minutes)
 */
router.get('/drones', (req, res) => {
  const db = getDb();
  if (!db) {
    return res.status(500).json({ error: 'Database not connected' });
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

export default router;

