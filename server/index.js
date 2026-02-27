/**
 * GUIDashboard Server
 * Main entry point - Express app setup and server startup
 */
import express from 'express';
import cors from 'cors';
import { config } from './config.js';

// Database
import { connectDatabase, closeDatabase, isConnected } from './lib/database.js';

// Package version for health/upgrade display
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8'));

// Route modules
import dronesRouter from './routes/drones.js';
import profilesRouter from './routes/profiles.js';
import telemetryRouter from './routes/telemetry.js';
import discoveryRouter from './routes/discovery.js';
import camerasRouter from './routes/cameras.js';
import mediamtxRouter from './routes/mediamtx.js';
import authRouter from './routes/auth.js';
import upgradeRouter from './routes/upgrade.js';

// Initialize Express app
const app = express();

// CORS configuration
app.use(cors({
  origin: config.corsOrigin
}));

// JSON body parser
app.use(express.json());

// Mount API routes
app.use('/api', dronesRouter);
app.use('/api', profilesRouter);
app.use('/api', telemetryRouter);
app.use('/api', discoveryRouter);
app.use('/api', camerasRouter);
app.use('/api', mediamtxRouter);
app.use('/api/auth', authRouter);
app.use('/api/upgrade', upgradeRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: pkg.version,
    dbConnected: isConnected(),
    dbPath: config.dbPath,
    scriptsPath: config.scriptsPath,
    mediamtxPath: config.mediamtxPath
  });
});

// Start server
app.listen(config.port, () => {
  console.log(`Telemetry server running on port ${config.port}`);
  connectDatabase();
});

// Graceful shutdown
process.on('SIGINT', () => {
  closeDatabase();
  process.exit(0);
});
