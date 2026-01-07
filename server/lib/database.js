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
    // WAL mode requires write access even for reading (for -wal and -shm files)
    db = new Database(config.dbPath);
    console.log(`Connected to database: ${config.dbPath}`);
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


