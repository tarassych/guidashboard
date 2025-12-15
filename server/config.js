// Server Configuration
// Edit these values for your environment

export const config = {
  // Path to SQLite telemetry database
  dbPath: process.env.TELEMETRY_DB_PATH || '/home/orangepi/code/telemetry.db',
  
  // Server port
  port: process.env.SERVER_PORT || 3001,
  
  // CORS origin (frontend URL)
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173'
};



