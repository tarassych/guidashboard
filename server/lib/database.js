/**
 * Database connection management
 */
import Database from 'better-sqlite3';
import { config } from '../config.js';

let db = null;

/**
 * Connect to the SQLite database
 * @returns {boolean} true if connection successful
 */
export function connectDatabase() {
  try {
    // Open database with timeout for busy connections
    db = new Database(config.dbPath, { timeout: 5000 });
    
    // Enable WAL mode for better concurrent access (allows reads while writing)
    db.pragma('journal_mode = WAL');
    
    // Set busy timeout to wait for locks instead of failing immediately
    db.pragma('busy_timeout = 5000');
    
    console.log(`Connected to database: ${config.dbPath} (WAL mode)`);
    return true;
  } catch (error) {
    console.error(`Failed to connect to database: ${error.message}`);
    return false;
  }
}

/**
 * Get the database instance, connecting if needed
 * @returns {Database|null} Database instance or null if connection fails
 */
export function getDb() {
  if (!db) {
    if (!connectDatabase()) {
      return null;
    }
  }
  return db;
}

/**
 * Close the database connection
 */
export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
    console.log('Database connection closed');
  }
}

/**
 * Check if database is connected
 * @returns {boolean}
 */
export function isConnected() {
  return db !== null;
}



