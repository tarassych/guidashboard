/**
 * MediaMTX configuration management
 * Handles paths.yml generation and mediamtx process control
 */
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { config } from '../config.js';

const execAsync = promisify(exec);

// MediaMTX paths
const pathsYmlPath = path.join(config.mediamtxPath, 'paths.yml');
const mediamtxBinary = path.join(config.mediamtxPath, 'mediamtx');
const rebuildScript = path.join(config.mediamtxPath, 'rebuild-config.sh');

/**
 * Load current paths.yml content
 * @returns {string} File content or empty string
 */
export function loadPathsYml() {
  try {
    if (fs.existsSync(pathsYmlPath)) {
      return fs.readFileSync(pathsYmlPath, 'utf-8');
    }
  } catch (error) {
    console.error('Failed to load paths.yml:', error.message);
  }
  return '';
}

/**
 * Parse paths.yml content into structured object
 * @param {string} content - YAML content
 * @returns {Object} Parsed paths configuration
 */
export function parsePathsYml(content) {
  const paths = {};
  const lines = content.split('\n');
  let currentPath = null;
  let currentConfig = {};
  
  for (const line of lines) {
    // Match path name (e.g., "  cam123:")
    const pathMatch = line.match(/^  (\S+):$/);
    if (pathMatch) {
      // Save previous path
      if (currentPath) {
        paths[currentPath] = currentConfig;
      }
      currentPath = pathMatch[1];
      currentConfig = {};
      continue;
    }
    
    // Match config property (e.g., "    source: rtsp://...")
    const propMatch = line.match(/^    (\w+):\s*(.*)$/);
    if (propMatch && currentPath) {
      currentConfig[propMatch[1]] = propMatch[2];
    }
  }
  
  // Save last path
  if (currentPath) {
    paths[currentPath] = currentConfig;
  }
  
  return paths;
}

/**
 * Generate paths.yml content from structured object
 * @param {Object} paths - Paths configuration
 * @returns {string} YAML content
 */
export function generatePathsYml(paths) {
  let content = '';
  
  for (const [pathName, pathConfig] of Object.entries(paths)) {
    content += `  ${pathName}:\n`;
    for (const [key, value] of Object.entries(pathConfig)) {
      content += `    ${key}: ${value}\n`;
    }
    content += '\n';
  }
  
  return content;
}

/**
 * Update a single camera config in paths.yml
 * @param {Object} camera - Camera configuration
 * @param {string} serialNumber - Camera serial number
 * @returns {Object} Result with success flag and logs
 */
export function updateCameraInPaths(camera, serialNumber) {
  const logs = [];
  
  if (!camera || !serialNumber) {
    logs.push('[SKIP] Missing camera or serialNumber');
    return { success: false, logs };
  }
  
  try {
    const currentContent = loadPathsYml();
    const paths = parsePathsYml(currentContent);
    
    const pathName = `cam${serialNumber}`;
    const rtspPort = camera.rtspPort || 554;
    const rtspPath = camera.rtspPath || '/stream0';
    const login = camera.login || 'admin';
    const password = camera.password || '';
    
    // Build RTSP URL (mask password in logs)
    const rtspUrl = `rtsp://${login}:${password}@${camera.ip}:${rtspPort}${rtspPath}`;
    const rtspUrlMasked = `rtsp://${login}:***@${camera.ip}:${rtspPort}${rtspPath}`;
    
    const isNew = !paths[pathName];
    paths[pathName] = {
      source: rtspUrl,
      sourceOnDemand: 'yes',
      sourceProtocol: 'tcp'
    };
    
    logs.push(`[${isNew ? 'ADD' : 'UPDATE'}] ${pathName}: ${rtspUrlMasked}`);
    
    const newContent = generatePathsYml(paths);
    fs.writeFileSync(pathsYmlPath, newContent);
    logs.push(`[WRITE] paths.yml updated`);
    
    return { success: true, logs };
  } catch (error) {
    logs.push(`[ERROR] ${error.message}`);
    console.error('Failed to update paths.yml:', error.message);
    return { success: false, logs };
  }
}

/**
 * Rebuild mediamtx.yml from base + paths
 * @returns {Promise<Object>} Result with stdout/stderr
 */
async function rebuildConfig() {
  const result = { stdout: '', stderr: '', success: true };
  
  if (!fs.existsSync(rebuildScript)) {
    result.stderr = `[WARNING] rebuild-config.sh not found at ${rebuildScript}\n`;
    result.success = false;
    return result;
  }
  
  try {
    const { stdout, stderr } = await execAsync(
      `cd ${config.mediamtxPath} && ./rebuild-config.sh`,
      { timeout: 10000 }
    );
    result.stdout = (stdout || '') + '[SUCCESS] MediaMTX config rebuilt\n';
    if (stderr) {
      result.stderr = stderr;
    }
  } catch (error) {
    result.stderr = `[ERROR] rebuild-config.sh failed: ${error.message}\n`;
    result.success = false;
  }
  
  return result;
}

/**
 * Check MediaMTX process status and restart/reload as needed
 * @returns {Promise<Object>} Result with stdout/stderr
 */
async function manageMediamtxProcess() {
  const result = { stdout: '', stderr: '', success: true };
  
  result.stdout += '[MMTX] Checking MediaMTX status...\n';
  
  try {
    // Check if mediamtx is running (use pidof for exact binary match)
    const { stdout: psOut } = await execAsync(
      `pidof ${mediamtxBinary} 2>/dev/null || echo ""`,
      { timeout: 5000 }
    );
    const mediamtxPid = psOut.trim().split(' ')[0];
    
    if (mediamtxPid) {
      result.stdout += `[STATUS] MediaMTX running (PID: ${mediamtxPid})\n`;
      
      // Send SIGHUP to reload config without restart
      result.stdout += '[RELOAD] Sending SIGHUP to reload config...\n';
      try {
        await execAsync(`kill -HUP ${mediamtxPid}`, { timeout: 5000 });
        result.stdout += '[SUCCESS] Config reload signal sent\n';
      } catch (reloadErr) {
        result.stderr += `[WARNING] Could not reload: ${reloadErr.message}\n`;
        
        // Try restart instead
        result.stdout += '[RESTART] Attempting full restart...\n';
        try {
          await execAsync(`kill ${mediamtxPid}`, { timeout: 5000 });
          await new Promise(r => setTimeout(r, 1000));
          await execAsync(
            `cd ${config.mediamtxPath} && nohup ./mediamtx > /dev/null 2>&1 &`,
            { timeout: 5000 }
          );
          result.stdout += '[SUCCESS] MediaMTX restarted\n';
        } catch (restartErr) {
          result.stderr += `[ERROR] Restart failed: ${restartErr.message}\n`;
          result.success = false;
        }
      }
    } else {
      result.stdout += '[STATUS] MediaMTX not running\n';
      result.stdout += '[START] Starting MediaMTX...\n';
      
      try {
        await execAsync(
          `cd ${config.mediamtxPath} && nohup ./mediamtx > /dev/null 2>&1 &`,
          { timeout: 5000 }
        );
        await new Promise(r => setTimeout(r, 1000));
        
        // Verify it started
        const { stdout: verifyOut } = await execAsync(
          `pidof ${mediamtxBinary} 2>/dev/null || echo ""`,
          { timeout: 5000 }
        );
        if (verifyOut.trim()) {
          result.stdout += `[SUCCESS] MediaMTX started (PID: ${verifyOut.trim().split(' ')[0]})\n`;
        } else {
          result.stderr += '[WARNING] MediaMTX may not have started properly\n';
        }
      } catch (startErr) {
        result.stderr += `[ERROR] Failed to start MediaMTX: ${startErr.message}\n`;
        result.success = false;
      }
    }
  } catch (error) {
    result.stderr += `[ERROR] Status check failed: ${error.message}\n`;
    result.success = false;
  }
  
  return result;
}

/**
 * Update cameras in paths.yml, rebuild config, and manage mediamtx process
 * @param {Object} profile - Profile with frontCamera and rearCamera
 * @returns {Promise<Object>} Combined result with commands, stdout, stderr
 */
export async function updateProfileCamerasAsync(profile) {
  const output = {
    commands: [],
    stdout: '',
    stderr: '',
    success: true
  };
  
  // Update front camera
  if (profile.frontCamera && profile.frontCamera.serialNumber) {
    output.commands.push(`Updating front camera: cam${profile.frontCamera.serialNumber}`);
    const result = updateCameraInPaths(profile.frontCamera, profile.frontCamera.serialNumber);
    output.stdout += result.logs.join('\n') + '\n';
    if (!result.success) output.success = false;
  }
  
  // Update rear camera
  if (profile.rearCamera && profile.rearCamera.serialNumber) {
    output.commands.push(`Updating rear camera: cam${profile.rearCamera.serialNumber}`);
    const result = updateCameraInPaths(profile.rearCamera, profile.rearCamera.serialNumber);
    output.stdout += result.logs.join('\n') + '\n';
    if (!result.success) output.success = false;
  }
  
  // Rebuild mediamtx.yml
  output.commands.push(`Running: ./rebuild-config.sh`);
  output.stdout += '\n[REBUILD] Running rebuild-config.sh...\n';
  const rebuildResult = await rebuildConfig();
  output.stdout += rebuildResult.stdout;
  output.stderr += rebuildResult.stderr;
  if (!rebuildResult.success) output.success = false;
  
  // Manage mediamtx process
  output.stdout += '\n';
  const processResult = await manageMediamtxProcess();
  output.stdout += processResult.stdout;
  output.stderr += processResult.stderr;
  if (!processResult.success) output.success = false;
  
  return output;
}

