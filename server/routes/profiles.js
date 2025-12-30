/**
 * Drone profiles API routes
 * - GET /api/profiles - Get all profiles
 * - POST /api/profiles/:droneId - Create/update profile
 * - DELETE /api/profiles/:droneId - Delete profile
 */
import express from 'express';
import { loadProfiles, saveProfiles } from '../lib/profiles.js';

const router = express.Router();

/**
 * GET /api/profiles
 * Get all drone profiles
 */
router.get('/profiles', (req, res) => {
  const profiles = loadProfiles();
  res.json({
    success: true,
    profiles: profiles.drones
  });
});

/**
 * POST /api/profiles/:droneId
 * Create or update a drone profile
 */
router.post('/profiles/:droneId', (req, res) => {
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

/**
 * DELETE /api/profiles/:droneId
 * Delete a drone profile
 */
router.delete('/profiles/:droneId', (req, res) => {
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

export default router;

