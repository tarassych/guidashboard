/**
 * Telemetry API routes
 * - GET /api/telemetry - Get telemetry records
 * - GET /api/drones/active - Get active drone status
 */
import express from 'express';
import { getDb } from '../lib/database.js';

const router = express.Router();

/**
 * GET /api/drones/active
 * Get the current active control status for all drones
 * 
 * EXCLUSIVE ACTIVE CONTROL: Only ONE drone can be active at a time.
 * The drone with the most recent active=1 telemetry (within 10 seconds) wins.
 * All other drones are marked as inactive.
 * 
 * Active timeout: 10 seconds (if no active telemetry in 10s, drone loses active status)
 */
router.get('/drones/active', (req, res) => {
  const db = getDb();
  if (!db) {
    return res.status(500).json({ error: 'Database not connected' });
  }

  try {
    const ACTIVE_TIMEOUT_MS = 10000; // 10 seconds for active control timeout
    const cutoffTime = Date.now() - ACTIVE_TIMEOUT_MS;
    
    // Find the most recent telemetry record with active=1 within the timeout window
    // This ensures only ONE drone can be marked as active (the most recent one)
    const activeStmt = db.prepare(`
      SELECT drone_id, timestamp
      FROM telemetry
      WHERE active = 1 AND timestamp > ?
      ORDER BY timestamp DESC
      LIMIT 1
    `);
    const activeRow = activeStmt.get(cutoffTime);
    
    // Get all drones that have recent telemetry (for reference)
    const allDronesStmt = db.prepare(`
      SELECT drone_id, MAX(timestamp) as lastUpdate
      FROM telemetry
      WHERE ID IN (
        SELECT MAX(ID) FROM (
          SELECT ID, drone_id FROM telemetry ORDER BY ID DESC LIMIT 1000
        ) GROUP BY drone_id
      )
      GROUP BY drone_id
    `);
    const allDrones = allDronesStmt.all();
    
    // Build response: only the most recent active drone gets active=true
    const activeDrones = {};
    const currentlyActiveDroneId = activeRow ? activeRow.drone_id : null;
    
    allDrones.forEach(row => {
      activeDrones[row.drone_id] = {
        active: row.drone_id === currentlyActiveDroneId,
        lastUpdate: row.lastUpdate
      };
    });

    res.json({
      success: true,
      activeDrones,
      currentlyActive: currentlyActiveDroneId // Which drone currently has joystick control
    });

  } catch (error) {
    console.error('Query error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/telemetry
 * Get telemetry records newer than the specified ID
 * Query params:
 * - lastId: Return records newer than this ID
 * - limit: Max records to return (default 100)
 * - droneId: Filter by specific drone
 */
router.get('/telemetry', (req, res) => {
  const db = getDb();
  if (!db) {
    return res.status(500).json({ error: 'Database not connected' });
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

export default router;


