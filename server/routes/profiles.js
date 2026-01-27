/**
 * Drone profiles API routes
 * Profiles are stored as a 6-element array where array index = display position - 1
 * - drones[0] = position 1, drones[1] = position 2, etc.
 * - null values represent empty slots
 * 
 * Routes:
 * - GET /api/profiles - Get all profiles (returns object with _index)
 * - POST /api/profiles/reorder - Swap/move drone positions (MUST be before :droneId)
 * - POST /api/profiles/:droneId - Create/update profile
 * - DELETE /api/profiles/:droneId - Delete profile
 */
import express from 'express';
import { loadProfiles, saveProfiles, getProfilesAsObject } from '../lib/profiles.js';

const router = express.Router();

/**
 * GET /api/profiles
 * Get all drone profiles
 * Returns profiles as object keyed by droneId with _index for position
 */
router.get('/profiles', (req, res) => {
  const profiles = loadProfiles();
  
  // Build object keyed by droneId
  // Array index IS the position (_index)
  const profilesObj = {};
  profiles.drones.forEach((drone, index) => {
    if (drone) {
      profilesObj[drone.droneId] = {
        ...drone,
        _index: index // Array index = display position - 1
      };
    }
  });
  
  res.json({
    success: true,
    profiles: profilesObj,
    profilesArray: profiles.drones // Also return the array for reference
  });
});

/**
 * POST /api/profiles/reorder
 * Reorder drone positions by swapping array elements
 * IMPORTANT: This route MUST be defined BEFORE /profiles/:droneId
 * Body: { sourceSlot: number, targetSlot: number }
 * Slot numbers are 1-indexed (1-6), converted to array indices (0-5)
 */
router.post('/profiles/reorder', (req, res) => {
  const { sourceSlot, targetSlot } = req.body;
  
  console.log(`Reorder request: position ${sourceSlot} -> position ${targetSlot}`);
  
  // Validate slots (1-6)
  if (!sourceSlot || !targetSlot || sourceSlot < 1 || sourceSlot > 6 || targetSlot < 1 || targetSlot > 6) {
    return res.status(400).json({ error: 'Invalid slot numbers. Must be between 1 and 6.' });
  }
  
  if (sourceSlot === targetSlot) {
    return res.json({ success: true, message: 'No change needed' });
  }
  
  const profiles = loadProfiles();
  
  // Convert 1-indexed slots to 0-indexed array indices
  const sourceIndex = sourceSlot - 1;
  const targetIndex = targetSlot - 1;
  
  // Verify source has a drone
  if (!profiles.drones[sourceIndex]) {
    return res.status(400).json({ error: `No drone at position ${sourceSlot}` });
  }
  
  // Swap array elements (works for both swap and move-to-empty)
  const temp = profiles.drones[sourceIndex];
  profiles.drones[sourceIndex] = profiles.drones[targetIndex];
  profiles.drones[targetIndex] = temp;
  
  console.log(`Swapped positions: ${sourceSlot} <-> ${targetSlot}`);
  
  if (saveProfiles(profiles)) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: 'Failed to save profiles' });
  }
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
  const existingIndex = profiles.drones.findIndex(d => d && String(d.droneId) === String(droneId));
  
  const updatedProfile = {
    ...(existingIndex >= 0 ? profiles.drones[existingIndex] : {}),
    ...profileData,
    droneId: String(droneId),
    updatedAt: Date.now()
  };
  
  // Remove slot property if it exists (cleanup from old format)
  delete updatedProfile.slot;
  
  let savedIndex;
  if (existingIndex >= 0) {
    // Update existing profile at same index
    profiles.drones[existingIndex] = updatedProfile;
    savedIndex = existingIndex;
  } else {
    // Add new profile to first empty slot (null)
    const emptyIndex = profiles.drones.findIndex(d => d === null);
    if (emptyIndex < 0) {
      return res.status(400).json({ error: 'No available slots (max 6 drones)' });
    }
    profiles.drones[emptyIndex] = updatedProfile;
    savedIndex = emptyIndex;
  }
  
  console.log(`Final profile for drone ${droneId} at index ${savedIndex} (position ${savedIndex + 1})`);

  if (saveProfiles(profiles)) {
    res.json({
      success: true,
      profile: {
        ...updatedProfile,
        _index: savedIndex
      }
    });
  } else {
    res.status(500).json({ error: 'Failed to save profile' });
  }
});

/**
 * DELETE /api/profiles/:droneId
 * Delete a drone profile (sets slot to null)
 */
router.delete('/profiles/:droneId', (req, res) => {
  const droneId = req.params.droneId;
  
  const profiles = loadProfiles();
  const index = profiles.drones.findIndex(d => d && String(d.droneId) === String(droneId));
  
  if (index >= 0) {
    profiles.drones[index] = null; // Set to null, keeping array structure
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
