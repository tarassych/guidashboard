/**
 * Camera-related API routes
 * - GET /api/scan-cameras/:ip - Scan for cameras
 * - POST /api/update-mediamtx - Update MediaMTX config
 */
import express from 'express';
import { scanCameras } from '../lib/scripts.js';
import { updateProfileCamerasAsync } from '../lib/mediamtx.js';

const router = express.Router();

/**
 * GET /api/scan-cameras/:ip
 * Scan for cameras on a drone's network using scan_cam.sh
 */
router.get('/scan-cameras/:ip', async (req, res) => {
  const { ip } = req.params;
  
  if (!ip) {
    return res.status(400).json({ error: 'IP address is required' });
  }
  
  const result = await scanCameras(ip);
  
  res.json({
    success: result.success,
    cameras: result.cameras,
    parseError: result.parseError,
    command: result.command,
    stdout: result.stdout,
    stderr: result.stderr
  });
});

/**
 * POST /api/update-mediamtx
 * Update MediaMTX config for cameras
 * Body: { frontCamera: Object, rearCamera: Object }
 */
router.post('/update-mediamtx', async (req, res) => {
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
    const result = await updateProfileCamerasAsync(profile);
    
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

export default router;


