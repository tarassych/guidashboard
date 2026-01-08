/**
 * Drone profiles management
 * 
 * IMPORTANT: There is only ONE drone-profiles.json file located at:
 *   server/drone-profiles.json (in repo)
 *   /home/orangepi/guidashboard/drone-profiles.json (when deployed)
 * 
 * Format: { "drones": [ { droneId, name, ... }, ... ] }
 * Array index + 1 = drone display number (drones[0] = #1, drones[1] = #2)
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
 * @returns {Object} Profiles object with drones array
 */
export function loadProfiles() {
  try {
    if (fs.existsSync(profilesPath)) {
      const data = fs.readFileSync(profilesPath, 'utf-8');
      const parsed = JSON.parse(data);
      
      // Handle migration from old object format to array format
      if (parsed.drones && !Array.isArray(parsed.drones)) {
        console.log('Migrating drone-profiles.json from object to array format...');
        // Convert object to array (sorted by droneId)
        const dronesObj = parsed.drones;
        const dronesArray = Object.values(dronesObj).sort((a, b) => {
          const idA = parseInt(a.droneId) || 0;
          const idB = parseInt(b.droneId) || 0;
          return idA - idB;
        });
        const migrated = { drones: dronesArray };
        // Save the migrated format back to disk
        try {
          fs.writeFileSync(profilesPath, JSON.stringify(migrated, null, 2));
          console.log(`Migrated ${dronesArray.length} drones to array format`);
        } catch (e) {
          console.error('Failed to save migrated profiles:', e.message);
        }
        return migrated;
      }
      
      // Ensure drones is an array
      if (!Array.isArray(parsed.drones)) {
        parsed.drones = [];
      }
      
      return parsed;
    }
  } catch (error) {
    console.error('Failed to load drone profiles:', error.message);
  }
  return { drones: [] };
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
  return profiles.drones.find(d => String(d.droneId) === String(droneId)) || null;
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
 * Updates existing profile by droneId or adds new one
 * @param {string} droneId - Drone ID
 * @param {Object} profileData - Profile data to save
 * @returns {Object|null} Saved profile or null on error
 */
export function saveProfile(droneId, profileData) {
  const profiles = loadProfiles();
  
  // Find existing profile index
  const existingIndex = profiles.drones.findIndex(d => String(d.droneId) === String(droneId));
  
  const updatedProfile = {
    ...(existingIndex >= 0 ? profiles.drones[existingIndex] : {}),
    ...profileData,
    droneId: String(droneId),
    updatedAt: Date.now()
  };
  
  if (existingIndex >= 0) {
    // Update existing
    profiles.drones[existingIndex] = updatedProfile;
  } else {
    // Add new profile
    profiles.drones.push(updatedProfile);
  }
  
  if (saveProfiles(profiles)) {
    return updatedProfile;
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
  const index = profiles.drones.findIndex(d => String(d.droneId) === String(droneId));
  
  if (index >= 0) {
    profiles.drones.splice(index, 1);
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
  return profiles.drones.map(d => String(d.droneId));
}

/**
 * Convert profiles array to object keyed by droneId (for API compatibility)
 * @returns {Object} Object with droneId as keys
 */
export function getProfilesAsObject() {
  const profiles = loadProfiles();
  const obj = {};
  profiles.drones.forEach((drone, index) => {
    obj[drone.droneId] = {
      ...drone,
      _index: index // Include index for reference
    };
  });
  return obj;
}
