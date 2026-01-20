/**
 * Shell script execution utilities
 */
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { config } from '../config.js';

const execAsync = promisify(exec);

/**
 * Execute a script and parse JSON output
 * @param {string} scriptName - Script filename
 * @param {string[]} args - Script arguments
 * @param {Object} options - Execution options
 * @returns {Promise<Object>} Result with parsed data
 */
export async function executeScript(scriptName, args = [], options = {}) {
  const scriptPath = path.join(config.scriptsPath, scriptName);
  const argsStr = args.join(' ');
  const command = `cd ${config.scriptsPath} && ./${scriptName} ${argsStr}`.trim();
  const timeout = options.timeout || 30000;
  
  // Check if script exists
  if (!fs.existsSync(scriptPath)) {
    return {
      success: false,
      error: `Script not found: ${scriptName}`,
      path: scriptPath,
      command: null,
      stdout: '',
      stderr: '',
      data: null
    };
  }
  
  try {
    const { stdout, stderr } = await execAsync(command, { timeout });
    
    // Try to parse JSON output
    let data = null;
    let parseError = null;
    
    if (options.parseJson !== false) {
      try {
        // Find JSON array or object in output
        const jsonArrayMatch = stdout.match(/\[[\s\S]*\]/);
        const jsonObjectMatch = stdout.match(/\{[\s\S]*\}/);
        
        if (jsonArrayMatch) {
          data = JSON.parse(jsonArrayMatch[0]);
        } else if (jsonObjectMatch) {
          data = JSON.parse(jsonObjectMatch[0]);
        } else if (stdout.trim() === '[]' || stdout.trim() === '') {
          data = [];
        } else {
          parseError = 'No JSON found in output';
        }
      } catch (e) {
        parseError = e.message;
      }
    }
    
    return {
      success: true,
      data,
      parseError,
      command,
      stdout: stdout || '',
      stderr: stderr || ''
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      code: error.code,
      command,
      stdout: error.stdout || '',
      stderr: error.stderr || '',
      data: null
    };
  }
}

/**
 * Run discover.sh to find drones on network
 * @returns {Promise<Object>} Result with drones array
 */
export async function discoverDrones() {
  const result = await executeScript('discover.sh', [], { timeout: 30000 });
  return {
    ...result,
    drones: Array.isArray(result.data) ? result.data : []
  };
}

/**
 * Run pair.sh to pair with a drone
 * @param {string} ip - Drone IP address
 * @param {string} droneId - Drone ID
 * @returns {Promise<Object>} Result with pairing status
 */
export async function pairDrone(ip, droneId) {
  // pair.sh can take up to 60+ seconds to complete
  const result = await executeScript('pair.sh', [ip, droneId], { timeout: 120000 });
  
  // Determine pairing result
  let pairResult = false;
  if (result.success) {
    if (result.data && typeof result.data.result === 'boolean') {
      pairResult = result.data.result;
    } else {
      // Command succeeded, assume pairing worked
      pairResult = true;
    }
  }
  
  return {
    ...result,
    result: pairResult
  };
}

/**
 * Run scan_cam.sh to scan for cameras
 * @param {string} ip - IP address to scan from
 * @returns {Promise<Object>} Result with cameras array
 */
export async function scanCameras(ip) {
  const result = await executeScript('scan_cam.sh', [ip], { timeout: 60000 });
  return {
    ...result,
    cameras: Array.isArray(result.data) ? result.data : []
  };
}



