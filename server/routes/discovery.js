/**
 * Drone discovery and pairing API routes
 * - GET /api/discover - Discover drones on network
 * - POST /api/pair - Pair with a drone
 */
import express from 'express';
import { discoverDrones, pairDrone } from '../lib/scripts.js';

const router = express.Router();

/**
 * GET /api/discover
 * Discover drones on the network using discover.sh
 */
router.get('/discover', async (req, res) => {
  const result = await discoverDrones();
  
  if (result.success) {
    res.json({
      success: true,
      drones: result.drones,
      parseError: result.parseError,
      command: result.command,
      stdout: result.stdout,
      stderr: result.stderr
    });
  } else {
    res.json({
      success: false,
      drones: [],
      error: result.error,
      code: result.code,
      command: result.command,
      stdout: result.stdout,
      stderr: result.stderr
    });
  }
});

/**
 * POST /api/pair
 * Pair with a drone using pair.sh
 * Body: { ip: string, droneId: string }
 */
router.post('/pair', async (req, res) => {
  const { ip, droneId } = req.body;
  
  if (!ip || !droneId) {
    return res.status(400).json({ error: 'IP and droneId are required' });
  }
  
  const result = await pairDrone(ip, droneId);
  
  res.json({
    success: result.success,
    result: result.result,
    command: result.command,
    stdout: result.stdout,
    stderr: result.stderr,
    parseError: result.parseError
  });
});

export default router;

