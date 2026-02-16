/**
 * Drone discovery and pairing API routes
 * - GET /api/discover - Discover drones on network
 * - POST /api/pair - Pair with a drone
 */
import express from 'express';
import { discoverDrones, pairDrone, runDroneConf } from '../lib/scripts.js';

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
  
  // Check ip exists and droneId is defined (0 is valid for unknown drone)
  if (!ip || droneId === undefined || droneId === null || droneId === '') {
    return res.status(400).json({ error: 'IP and droneId are required' });
  }
  
  const result = await pairDrone(ip, droneId);
  
  res.json({
    success: result.success,
    result: result.result,
    pairData: result.data || null,
    command: result.command,
    stdout: result.stdout,
    stderr: result.stderr,
    parseError: result.parseError
  });
});

/**
 * POST /api/drone-conf
 * Run drone_conf.sh to apply IP and CRSF speed changes
 * Body: { oldIp: string, newIp: string, newCrsfSpeed: number|null, newCrsf2Speed: number|null }
 */
router.post('/drone-conf', async (req, res) => {
  const { oldIp, newIp, newCrsfSpeed, newCrsf2Speed } = req.body;
  
  const result = await runDroneConf(oldIp, newIp, newCrsfSpeed, newCrsf2Speed);
  
  let errorMessage = result.scriptError || result.error;
  if (!errorMessage && result.result === false && result.stdout) {
    try {
      const jsonMatch = result.stdout.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed && typeof parsed.error === 'string') {
          errorMessage = parsed.error;
        }
      }
    } catch (e) { /* ignore */ }
  }
  
  res.json({
    success: result.success,
    result: result.result,
    errorMessage,
    command: result.command,
    stdout: result.stdout,
    stderr: result.stderr,
    parseError: result.parseError
  });
});

export default router;



