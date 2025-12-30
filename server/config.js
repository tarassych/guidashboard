// Server Configuration
// Edit these values for your environment

export const config = {
  // Path to SQLite telemetry database
  dbPath: process.env.TELEMETRY_DB_PATH || '/home/orangepi/code/telemetry.db',
  
  // Path to drone scripts folder (discover.sh, pair.sh)
  scriptsPath: process.env.SCRIPTS_PATH || '/home/orangepi/code',
  
  // Path to mediamtx config folder
  mediamtxPath: process.env.MEDIAMTX_PATH || '/home/orangepi/mmtx',
  
  // Server port
  port: process.env.SERVER_PORT || 3001,
  
  // CORS origin (frontend URL)
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173'
};





