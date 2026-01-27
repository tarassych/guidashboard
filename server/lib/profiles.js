/**
 * Drone profiles management
 * 
 * IMPORTANT: There is only ONE drone-profiles.json file located at:
 *   server/drone-profiles.json (in repo)
 *   /home/orangepi/guidashboard/drone-profiles.json (when deployed)
 * 
 * Format: { "drones": [ drone | null, drone | null, ... ] } (6 elements max)
 * Array index = display position - 1 (drones[0] = position 1, drones[1] = position 2)
 * null represents an empty slot
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Single profiles file - located in server root directory
// When deployed: /home/orangepi/guidashboard/drone-profiles.json
const profilesPath = path.join(__dirname, '..', 'drone-profiles.json');

/**
 * Load drone profiles from file
 * @returns {Object} Profiles object with drones array (6 elements, nulls for empty slots)
 */
export function loadProfiles() {
  try {
    if (fs.existsSync(profilesPath)) {
      const data = fs.readFileSync(profilesPath, 'utf-8');
      const parsed = JSON.parse(data);
      
      // Handle migration from old object format to array format
      if (parsed.drones && !Array.isArray(parsed.drones)) {
        console.log('Migrating drone-profiles.json from object to array format...');
        const dronesObj = parsed.drones;
        const dronesArray = Object.values(dronesObj).sort((a, b) => {
          const idA = parseInt(a.droneId) || 0;
          const idB = parseInt(b.droneId) || 0;
          return idA - idB;
        });
        // Create 6-element array with nulls
        const fixedArray = [null, null, null, null, null, null];
        dronesArray.forEach((drone, i) => {
          if (i < 6) {
            delete drone.slot; // Remove old slot property
            fixedArray[i] = drone;
          }
        });
        const migrated = { drones: fixedArray };
        try {
          fs.writeFileSync(profilesPath, JSON.stringify(migrated, null, 2));
          console.log(`Migrated ${dronesArray.length} drones to index-based format`);
        } catch (e) {
          console.error('Failed to save migrated profiles:', e.message);
        }
        return migrated;
      }
      
      // Ensure drones is an array
      if (!Array.isArray(parsed.drones)) {
        parsed.drones = [null, null, null, null, null, null];
      }
      
      // Migrate from slot-based to index-based format
      let needsSave = false;
      const hasSlots = parsed.drones.some(d => d && d.slot !== undefined);
      
      if (hasSlots) {
        console.log('Migrating from slot-based to index-based format...');
        // Create new 6-element array based on slot values
        const fixedArray = [null, null, null, null, null, null];
        parsed.drones.forEach(drone => {
          if (drone && drone.slot >= 1 && drone.slot <= 6) {
            const index = drone.slot - 1;
            delete drone.slot; // Remove slot property
            fixedArray[index] = drone;
          }
        });
        parsed.drones = fixedArray;
        needsSave = true;
      }
      
      // Ensure array is exactly 6 elements
      while (parsed.drones.length < 6) {
        parsed.drones.push(null);
      }
      if (parsed.drones.length > 6) {
        parsed.drones = parsed.drones.slice(0, 6);
      }
      
      // Save if we migrated
      if (needsSave) {
        try {
          fs.writeFileSync(profilesPath, JSON.stringify(parsed, null, 2));
          console.log('Migrated profiles to index-based format');
        } catch (e) {
          console.error('Failed to save migration:', e.message);
        }
      }
      
      return parsed;
    }
  } catch (error) {
    console.error('Failed to load drone profiles:', error.message);
  }
  return { drones: [null, null, null, null, null, null] };
}

/**
 * Save drone profiles to file
 * @param {Object} profiles - Profiles object to save
 * @returns {boolean} true if save successful
 */
export function saveProfiles(profiles) {
  try {
    // Ensure drones is an array
    if (!Array.isArray(profiles.drones)) {
      profiles.drones = [];
    }
    fs.writeFileSync(profilesPath, JSON.stringify(profiles, null, 2));
    return true;
  } catch (error) {
    console.error('Failed to save drone profiles:', error.message);
    return false;
  }
}

/**
 * Get a single drone profile by droneId
 * @param {string} droneId - Drone ID
 * @returns {Object|null} Profile or null if not found
 */
export function getProfile(droneId) {
  const profiles = loadProfiles();
  return profiles.drones.find(d => d && String(d.droneId) === String(droneId)) || null;
}

/**
 * Get drone profile by array index
 * @param {number} index - Array index (0-based)
 * @returns {Object|null} Profile or null if not found
 */
export function getProfileByIndex(index) {
  const profiles = loadProfiles();
  return profiles.drones[index] || null;
}

/**
 * Save a single drone profile
 * Updates existing profile by droneId or adds to first empty slot
 * @param {string} droneId - Drone ID
 * @param {Object} profileData - Profile data to save
 * @returns {Object|null} Saved profile with _index, or null on error
 */
export function saveProfile(droneId, profileData) {
  const profiles = loadProfiles();
  
  // Find existing profile index
  const existingIndex = profiles.drones.findIndex(d => d && String(d.droneId) === String(droneId));
  
  const updatedProfile = {
    ...(existingIndex >= 0 ? profiles.drones[existingIndex] : {}),
    ...profileData,
    droneId: String(droneId),
    updatedAt: Date.now()
  };
  
  // Remove slot property if it exists (migration cleanup)
  delete updatedProfile.slot;
  
  let savedIndex;
  if (existingIndex >= 0) {
    // Update existing
    profiles.drones[existingIndex] = updatedProfile;
    savedIndex = existingIndex;
  } else {
    // Add to first empty slot
    const emptyIndex = profiles.drones.findIndex(d => d === null);
    if (emptyIndex >= 0) {
      profiles.drones[emptyIndex] = updatedProfile;
      savedIndex = emptyIndex;
    } else {
      // No empty slots
      return null;
    }
  }
  
  if (saveProfiles(profiles)) {
    return { ...updatedProfile, _index: savedIndex };
  }
  return null;
}

/**
 * Delete a drone profile
 * @param {string} droneId - Drone ID
 * @returns {boolean} true if deleted successfully
 */
export function deleteProfile(droneId) {
  const profiles = loadProfiles();
  const index = profiles.drones.findIndex(d => d && String(d.droneId) === String(droneId));
  
  if (index >= 0) {
    profiles.drones[index] = null; // Set to null instead of splicing
    return saveProfiles(profiles);
  }
  return false;
}

/**
 * Get all drone IDs from profiles
 * @returns {string[]} Array of drone IDs
 */
export function getAllDroneIds() {
  const profiles = loadProfiles();
  return profiles.drones.filter(d => d !== null).map(d => String(d.droneId));
}

/**
 * Convert profiles array to object keyed by droneId (for API compatibility)
 * @returns {Object} Object with droneId as keys
 */
export function getProfilesAsObject() {
  const profiles = loadProfiles();
  const obj = {};
  profiles.drones.forEach((drone, index) => {
    if (drone) {
      obj[drone.droneId] = {
        ...drone,
        _index: index // Include index for reference
      };
    }
  });
  return obj;
}
