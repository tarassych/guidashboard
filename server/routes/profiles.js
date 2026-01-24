/**
 * Drone profiles API routes
 * Profiles are stored as an array where array index determines drone display number
 * - GET /api/profiles - Get all profiles (returns array with index info)
 * - POST /api/profiles/reorder - Reorder/swap drone slots (MUST be before :droneId)
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
  // Use slot property for position (slot 1 = _index 0, slot 2 = _index 1, etc.)
  const profilesObj = {};
  profiles.drones.forEach((drone) => {
    profilesObj[drone.droneId] = {
      ...drone,
      _index: (drone.slot || 1) - 1 // Convert slot (1-6) to _index (0-5)
    };
  });
  
  res.json({
    success: true,
    profiles: profilesObj,
    profilesArray: profiles.drones // Also return the array for new code
  });
});

/**
 * POST /api/profiles/reorder
 * Reorder drone slots by swapping or moving positions
 * IMPORTANT: This route MUST be defined BEFORE /profiles/:droneId
 * Body: { sourceSlot: number, targetSlot: number }
 * Slot numbers are 1-indexed (1-6)
 * Each drone has a 'slot' property that determines its display position
 */
router.post('/profiles/reorder', (req, res) => {
  const { sourceSlot, targetSlot } = req.body;
  
  console.log(`Reorder request: slot ${sourceSlot} -> slot ${targetSlot}`);
  
  // Validate slots (1-6)
  if (!sourceSlot || !targetSlot || sourceSlot < 1 || sourceSlot > 6 || targetSlot < 1 || targetSlot > 6) {
    return res.status(400).json({ error: 'Invalid slot numbers. Must be between 1 and 6.' });
  }
  
  if (sourceSlot === targetSlot) {
    return res.json({ success: true, message: 'No change needed' });
  }
  
  const profiles = loadProfiles();
  
  // Find drone at source slot (by slot property)
  const sourceDroneIndex = profiles.drones.findIndex(d => d.slot === sourceSlot);
  if (sourceDroneIndex < 0) {
    return res.status(400).json({ error: `No drone at source slot ${sourceSlot}` });
  }
  
  // Find drone at target slot (by slot property) - may not exist
  const targetDroneIndex = profiles.drones.findIndex(d => d.slot === targetSlot);
  
  if (targetDroneIndex >= 0) {
    // Swap: both slots have drones, exchange their slot values
    profiles.drones[sourceDroneIndex].slot = targetSlot;
    profiles.drones[targetDroneIndex].slot = sourceSlot;
    console.log(`Swapped drones: slot ${sourceSlot} <-> slot ${targetSlot}`);
  } else {
    // Move: target slot is empty, just update source drone's slot
    profiles.drones[sourceDroneIndex].slot = targetSlot;
    console.log(`Moved drone from slot ${sourceSlot} to slot ${targetSlot}`);
  }
  
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
  const existingIndex = profiles.drones.findIndex(d => String(d.droneId) === String(droneId));
  
  const updatedProfile = {
    ...(existingIndex >= 0 ? profiles.drones[existingIndex] : {}),
    ...profileData,
    droneId: String(droneId),
    updatedAt: Date.now()
  };
  
  if (existingIndex >= 0) {
    // Update existing profile, keep existing slot
    profiles.drones[existingIndex] = updatedProfile;
  } else {
    // Add new profile - assign first available slot (1-6)
    const usedSlots = new Set(profiles.drones.map(d => d.slot).filter(s => s));
    for (let s = 1; s <= 6; s++) {
      if (!usedSlots.has(s)) {
        updatedProfile.slot = s;
        break;
      }
    }
    if (!updatedProfile.slot) {
      return res.status(400).json({ error: 'No available slots (max 6 drones)' });
    }
    profiles.drones.push(updatedProfile);
  }
  
  console.log(`Final profile for drone ${droneId} at slot ${updatedProfile.slot}:`, JSON.stringify(updatedProfile));

  if (saveProfiles(profiles)) {
    res.json({
      success: true,
      profile: {
        ...updatedProfile,
        _index: (updatedProfile.slot || 1) - 1
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
