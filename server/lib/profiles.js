/**
 * Drone profiles management
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Profiles file path (relative to server directory)
const profilesPath = path.join(__dirname, '..', 'drone-profiles.json');

/**
 * Load drone profiles from file
 * @returns {Object} Profiles object with drones map
 */
export function loadProfiles() {
  try {
    if (fs.existsSync(profilesPath)) {
      const data = fs.readFileSync(profilesPath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Failed to load drone profiles:', error.message);
  }
  return { drones: {} };
}

/**
 * Save drone profiles to file
 * @param {Object} profiles - Profiles object to save
 * @returns {boolean} true if save successful
 */
export function saveProfiles(profiles) {
  try {
    fs.writeFileSync(profilesPath, JSON.stringify(profiles, null, 2));
    return true;
  } catch (error) {
    console.error('Failed to save drone profiles:', error.message);
    return false;
  }
}

/**
 * Get a single drone profile
 * @param {string} droneId - Drone ID
 * @returns {Object|null} Profile or null if not found
 */
export function getProfile(droneId) {
  const profiles = loadProfiles();
  return profiles.drones[droneId] || null;
}

/**
 * Save a single drone profile
 * @param {string} droneId - Drone ID
 * @param {Object} profileData - Profile data to save
 * @returns {Object|null} Saved profile or null on error
 */
export function saveProfile(droneId, profileData) {
  const profiles = loadProfiles();
  profiles.drones[droneId] = {
    ...profiles.drones[droneId],
    ...profileData,
    droneId,
    updatedAt: Date.now()
  };
  
  if (saveProfiles(profiles)) {
    return profiles.drones[droneId];
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
  if (profiles.drones[droneId]) {
    delete profiles.drones[droneId];
    return saveProfiles(profiles);
  }
  return false;
}


