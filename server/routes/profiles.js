/**
 * Drone profiles API routes
 * Profiles are stored as an array where array index determines drone display number
 * - GET /api/profiles - Get all profiles (returns array with index info)
 * - POST /api/profiles/:droneId - Create/update profile
 * - DELETE /api/profiles/:droneId - Delete profile
 */
import express from 'express';
import { loadProfiles, saveProfiles, getProfilesAsObject } from '../lib/profiles.js';

const router = express.Router();

/**
 * GET /api/profiles
 * Get all drone profiles
 * Returns profiles as both array (with index) and object (for backward compatibility)
 */
router.get('/profiles', (req, res) => {
  const profiles = loadProfiles();
  
  // Build object keyed by droneId for backward compatibility
  // Also include _index for frontend to know the display number
  const profilesObj = {};
  profiles.drones.forEach((drone, index) => {
    profilesObj[drone.droneId] = {
      ...drone,
      _index: index // index 0 = #1, index 1 = #2, etc.
    };
  });
  
  res.json({
    success: true,
    profiles: profilesObj,
    profilesArray: profiles.drones // Also return the array for new code
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
  
  // Find existing profile by droneId
  const existingIndex = profiles.drones.findIndex(d => String(d.droneId) === String(droneId));
  
  const updatedProfile = {
    ...(existingIndex >= 0 ? profiles.drones[existingIndex] : {}),
    ...profileData,
    droneId: String(droneId),
    updatedAt: Date.now()
  };
  
  let newIndex;
  if (existingIndex >= 0) {
    // Update existing profile at same index
    profiles.drones[existingIndex] = updatedProfile;
    newIndex = existingIndex;
  } else {
    // Add new profile to end of array
    newIndex = profiles.drones.length;
    profiles.drones.push(updatedProfile);
  }
  
  console.log(`Final profile for drone ${droneId} at index ${newIndex}:`, JSON.stringify(updatedProfile));

  if (saveProfiles(profiles)) {
    res.json({
      success: true,
      profile: {
        ...updatedProfile,
        _index: newIndex
      }
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
  const index = profiles.drones.findIndex(d => String(d.droneId) === String(droneId));
  
  if (index >= 0) {
    profiles.drones.splice(index, 1);
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
