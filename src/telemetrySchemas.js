/**
 * Telemetry Schemas
 * Defines telemetry data structure for different drone types
 */

// Drone type constants
export const DRONE_TYPES = {
  FOXY: 'foxy',
  GENERIC_FPV: 'generic_fpv'
}

// Full labels for forms and detailed displays
export const DRONE_TYPE_LABELS = {
  [DRONE_TYPES.FOXY]: 'Foxy',
  [DRONE_TYPES.GENERIC_FPV]: 'Generic FPV'
}

// Short labels for compact displays (dashboard overlays, etc.)
export const DRONE_TYPE_LABELS_SHORT = {
  [DRONE_TYPES.FOXY]: 'Foxy',
  [DRONE_TYPES.GENERIC_FPV]: 'FPV'
}

/**
 * Field definition structure:
 * - key: field name in telemetry data
 * - defaultValue: initial value
 * - type: data type (number, string, boolean, array)
 * - category: grouping (gps, battery, state, meta)
 * - unit: display unit (optional)
 * - format: formatting function name or precision (optional)
 * - label: i18n key for display label
 * - source: telemetry message type that provides this field (gps, batt, state)
 */

// Base fields shared across all drone types
const BASE_FIELDS = {
  // GPS data
  latitude: { 
    defaultValue: 0, 
    type: 'number', 
    category: 'gps', 
    unit: '°', 
    format: 6, 
    label: 'telemetry.lat',
    source: 'gps'
  },
  longitude: { 
    defaultValue: 0, 
    type: 'number', 
    category: 'gps', 
    unit: '°', 
    format: 6, 
    label: 'telemetry.lng',
    source: 'gps'
  },
  altitude: { 
    defaultValue: 0, 
    type: 'number', 
    category: 'gps', 
    unit: 'm', 
    format: 0, 
    label: 'telemetry.alt',
    source: 'gps'
  },
  heading: { 
    defaultValue: 0, 
    type: 'number', 
    category: 'gps', 
    unit: '°', 
    format: 0, 
    label: 'telemetry.hdg',
    source: 'gps'
  },
  groundspeed: { 
    defaultValue: 0, 
    type: 'number', 
    category: 'gps', 
    unit: '', 
    format: 1, 
    label: 'telemetry.gs',
    source: 'gps'
  },
  satellites: { 
    defaultValue: 0, 
    type: 'number', 
    category: 'gps', 
    unit: '', 
    format: 0, 
    label: 'telemetry.sat',
    source: 'gps'
  },
  
  // Battery data
  batt_v: { 
    defaultValue: 0, 
    type: 'number', 
    category: 'battery', 
    unit: 'V', 
    format: 1, 
    label: 'telemetry.bat',
    source: 'batt'
  },
  
  // Meta fields (not from telemetry messages, computed locally)
  timestamp: { 
    defaultValue: () => Date.now(), 
    type: 'number', 
    category: 'meta',
    source: 'local'
  },
  pathHistory: { 
    defaultValue: [], 
    type: 'array', 
    category: 'meta',
    source: 'local'
  },
  connected: { 
    defaultValue: false, 
    type: 'boolean', 
    category: 'meta',
    source: 'local'
  }
}

// Foxy (Ground Drone) specific fields
const FOXY_FIELDS = {
  ...BASE_FIELDS,
  
  // State data - Foxy specific
  speed: { 
    defaultValue: 0, 
    type: 'number', 
    category: 'state', 
    unit: 'km/h', 
    format: 1, 
    label: 'telemetry.spd',
    source: 'state'
  },
  dist: { 
    defaultValue: 0, 
    type: 'number', 
    category: 'state', 
    unit: 'm', 
    format: 0, 
    label: 'telemetry.dist',
    source: 'state'
  },
  power: { 
    defaultValue: 0, 
    type: 'number', 
    category: 'state', 
    unit: '%', 
    format: 0, 
    label: 'telemetry.power',
    source: 'state'
  },
  fs: { 
    defaultValue: 0, 
    type: 'number', 
    category: 'state', 
    unit: '', 
    format: 0, 
    label: 'telemetry.failsafe',
    source: 'state'
  },
  f1: { 
    defaultValue: false, 
    type: 'boolean', 
    category: 'state', 
    label: 'telemetry.fuse1',
    source: 'state'
  },
  f2: { 
    defaultValue: false, 
    type: 'boolean', 
    category: 'state', 
    label: 'telemetry.fuse2',
    source: 'state'
  },
  md: { 
    defaultValue: 0, 
    type: 'number', 
    category: 'state', 
    label: 'telemetry.modeCode',
    source: 'state'
  },
  md_str: { 
    defaultValue: 'OFFLINE', 
    type: 'string', 
    category: 'state', 
    label: 'telemetry.mode',
    source: 'state'
  },
  telemetry_time: { 
    defaultValue: 0, 
    type: 'number', 
    category: 'state', 
    unit: 's', 
    format: 'clock', 
    label: 'telemetry.time',
    source: 'state'
  }
}

// Generic FPV specific fields
// Telemetry sources: gps, att (attitude), mode
// Based on actual telemetry records:
//   {'latitude', 'longitude', 'groundspeed', 'heading', 'altitude', 'satellites', 'type': 'gps'}
//   {'type': 'att', 'pitch', 'yaw', 'roll'}
//   {'type': 'mode', 'mode'}
const GENERIC_FPV_FIELDS = {
  ...BASE_FIELDS,
  
  // Attitude data - from 'att' type telemetry
  pitch: { 
    defaultValue: 0, 
    type: 'number', 
    category: 'attitude', 
    unit: '°', 
    format: 1, 
    label: 'telemetry.pitch',
    source: 'att'
  },
  roll: { 
    defaultValue: 0, 
    type: 'number', 
    category: 'attitude', 
    unit: '°', 
    format: 1, 
    label: 'telemetry.roll',
    source: 'att'
  },
  yaw: { 
    defaultValue: 0, 
    type: 'number', 
    category: 'attitude', 
    unit: '°', 
    format: 1, 
    label: 'telemetry.yaw',
    source: 'att'
  },
  
  // Flight mode - from 'mode' type telemetry
  mode: { 
    defaultValue: 'OFFLINE', 
    type: 'string', 
    category: 'mode', 
    label: 'telemetry.flightMode',
    source: 'mode'
  },
  
  // Compatibility: md_str maps to mode for UI components
  md_str: { 
    defaultValue: 'OFFLINE', 
    type: 'string', 
    category: 'mode', 
    label: 'telemetry.mode',
    source: 'mode',
    mapFrom: 'mode'
  }
}

// Schema registry
export const TELEMETRY_SCHEMAS = {
  [DRONE_TYPES.FOXY]: FOXY_FIELDS,
  [DRONE_TYPES.GENERIC_FPV]: GENERIC_FPV_FIELDS
}

/**
 * Get schema for a drone type
 * @param {string} droneType - Drone type (foxy, generic_fpv)
 * @returns {Object} Field definitions for the drone type
 */
export function getSchema(droneType) {
  return TELEMETRY_SCHEMAS[droneType] || TELEMETRY_SCHEMAS[DRONE_TYPES.FOXY]
}

/**
 * Create initial telemetry state from schema
 * @param {string} droneType - Drone type
 * @returns {Object} Initial state object with default values
 */
export function createInitialState(droneType = DRONE_TYPES.FOXY) {
  const schema = getSchema(droneType)
  const state = {}
  
  for (const [key, field] of Object.entries(schema)) {
    if (typeof field.defaultValue === 'function') {
      state[key] = field.defaultValue()
    } else if (Array.isArray(field.defaultValue)) {
      state[key] = [...field.defaultValue]
    } else {
      state[key] = field.defaultValue
    }
  }
  
  return state
}

/**
 * Get fields by category
 * @param {string} droneType - Drone type
 * @param {string} category - Category (gps, battery, state, meta)
 * @returns {Object} Filtered field definitions
 */
export function getFieldsByCategory(droneType, category) {
  const schema = getSchema(droneType)
  const filtered = {}
  
  for (const [key, field] of Object.entries(schema)) {
    if (field.category === category && !field.hidden) {
      filtered[key] = field
    }
  }
  
  return filtered
}

/**
 * Get fields by source (telemetry message type)
 * @param {string} droneType - Drone type
 * @param {string} source - Source type (gps, batt, state, local)
 * @returns {string[]} Array of field keys from that source
 */
export function getFieldsBySource(droneType, source) {
  const schema = getSchema(droneType)
  const fields = []
  
  for (const [key, field] of Object.entries(schema)) {
    if (field.source === source) {
      fields.push(key)
    }
  }
  
  return fields
}

/**
 * Format a telemetry value for display
 * @param {*} value - The value to format
 * @param {Object} fieldDef - Field definition from schema
 * @returns {string} Formatted string
 */
export function formatValue(value, fieldDef) {
  if (value === null || value === undefined) {
    return '--'
  }
  
  if (fieldDef.type === 'boolean') {
    return value ? 'ON' : 'OFF'
  }
  
  if (fieldDef.type === 'number') {
    if (fieldDef.format === 'clock') {
      // Format as HH:MM:SS
      const totalSeconds = Math.floor(value)
      const hours = Math.floor(totalSeconds / 3600)
      const minutes = Math.floor((totalSeconds % 3600) / 60)
      const seconds = totalSeconds % 60
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    }
    
    if (typeof fieldDef.format === 'number') {
      return value.toFixed(fieldDef.format)
    }
    
    return String(value)
  }
  
  return String(value)
}

/**
 * Get display string with unit
 * @param {*} value - The value
 * @param {Object} fieldDef - Field definition
 * @returns {string} Formatted value with unit
 */
export function formatValueWithUnit(value, fieldDef) {
  const formatted = formatValue(value, fieldDef)
  if (fieldDef.unit && formatted !== '--') {
    return `${formatted}${fieldDef.unit}`
  }
  return formatted
}

/**
 * Update telemetry state from a record based on schema
 * @param {Object} currentState - Current telemetry state
 * @param {Object} recordData - New telemetry record data
 * @param {string} droneType - Drone type
 * @returns {Object} Updated state
 */
export function updateTelemetryFromRecord(currentState, recordData, droneType = DRONE_TYPES.FOXY) {
  const schema = getSchema(droneType)
  const updated = { ...currentState }
  
  // Determine the source type from record
  const sourceType = recordData.type // 'gps', 'batt', 'state', 'att', 'mode'
  
  if (!sourceType) {
    return updated
  }
  
  // Get fields that come from this source
  const sourceFields = getFieldsBySource(droneType, sourceType)
  
  // Update matching fields
  for (const fieldKey of sourceFields) {
    const fieldDef = schema[fieldKey]
    
    // Check if this field maps from another field
    if (fieldDef?.mapFrom) {
      // Get value from the mapped field
      if (recordData[fieldDef.mapFrom] !== undefined) {
        updated[fieldKey] = recordData[fieldDef.mapFrom]
      }
    } else if (recordData[fieldKey] !== undefined) {
      // Direct field mapping
      updated[fieldKey] = recordData[fieldKey]
    }
  }
  
  return updated
}

/**
 * Get visible fields for telemetry display panel
 * @param {string} droneType - Drone type
 * @returns {Array} Array of {key, field} objects for display
 */
// Display order per drone type
const DISPLAY_ORDER = {
  [DRONE_TYPES.FOXY]: [
    'latitude', 'longitude', 'altitude', 'heading', 
    'groundspeed', 'speed', 'dist', 'batt_v', 
    'satellites', 'md_str', 'telemetry_time'
  ],
  [DRONE_TYPES.GENERIC_FPV]: [
    'latitude', 'longitude', 'altitude', 'heading',
    'groundspeed', 'batt_v', 'satellites',
    'pitch', 'roll', 'yaw', 'mode'
  ]
}

export function getDisplayFields(droneType) {
  const schema = getSchema(droneType)
  const fields = []
  
  // Get display order for this drone type (fallback to Foxy)
  const displayOrder = DISPLAY_ORDER[droneType] || DISPLAY_ORDER[DRONE_TYPES.FOXY]
  
  for (const key of displayOrder) {
    const field = schema[key]
    if (field && !field.hidden) {
      fields.push({ key, ...field })
    }
  }
  
  return fields
}

/**
 * Check if a field exists for a drone type
 * @param {string} droneType - Drone type
 * @param {string} fieldKey - Field key to check
 * @returns {boolean} True if field exists and is not hidden
 */
export function hasField(droneType, fieldKey) {
  const schema = getSchema(droneType)
  const field = schema[fieldKey]
  return field && !field.hidden
}

// Battery thresholds by drone type
export const BATTERY_THRESHOLDS = {
  [DRONE_TYPES.FOXY]: {
    good: 35,
    warn: 30,
    unit: 'V',
    cells: 3 // 3S LiPo typical for ground vehicles
  },
  [DRONE_TYPES.GENERIC_FPV]: {
    good: 14.8, // 4S at ~3.7V per cell
    warn: 14.0, // 4S at ~3.5V per cell
    unit: 'V',
    cells: 4 // 4S LiPo typical for FPV
  }
}

/**
 * Get battery status for a drone type
 * @param {number} voltage - Battery voltage
 * @param {string} droneType - Drone type
 * @returns {string} 'good', 'warn', or 'crit'
 */
export function getBatteryStatus(voltage, droneType = DRONE_TYPES.FOXY) {
  const thresholds = BATTERY_THRESHOLDS[droneType] || BATTERY_THRESHOLDS[DRONE_TYPES.FOXY]
  
  if (voltage >= thresholds.good) return 'good'
  if (voltage >= thresholds.warn) return 'warn'
  return 'crit'
}
