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
 * Get the current active status for all drones
 * Returns which drones have active=1 in their most recent telemetry
 */
router.get('/drones/active', (req, res) => {
  const db = getDb();
  if (!db) {
    return res.status(500).json({ error: 'Database not connected' });
  }

  try {
    // Get the most recent active status for each drone
    // Using a subquery to get the latest record per drone
    const stmt = db.prepare(`
      SELECT t1.drone_id, t1.active, t1.timestamp
      FROM telemetry t1
      INNER JOIN (
        SELECT drone_id, MAX(ID) as max_id
        FROM telemetry
        GROUP BY drone_id
      ) t2 ON t1.drone_id = t2.drone_id AND t1.ID = t2.max_id
    `);
    const rows = stmt.all();

    const activeDrones = {};
    rows.forEach(row => {
      activeDrones[row.drone_id] = {
        active: row.active === 1,
        lastUpdate: row.timestamp
      };
    });

    res.json({
      success: true,
      activeDrones
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


