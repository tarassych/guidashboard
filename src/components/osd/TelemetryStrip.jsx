/**
 * Telemetry Strip Component
 * Collapsible bottom telemetry data display
 * Uses telemetry schema to display fields based on drone type
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DRONE_TYPES, getDisplayFields, formatValueWithUnit } from '../../telemetrySchemas'

export function TelemetryStrip({ telemetry, droneType = DRONE_TYPES.FOXY }) {
  const { t } = useTranslation()
  const [isCollapsed, setIsCollapsed] = useState(true)
  
  // Get display fields based on drone type from schema
  const displayFields = getDisplayFields(droneType)
  
  // Format value based on field definition
  const formatFieldValue = (fieldKey, fieldDef) => {
    const value = telemetry[fieldKey]
    
    // Special handling for clock format (telemetry_time)
    if (fieldDef.format === 'clock' && value) {
      const date = new Date(value)
      return date.toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit'
      })
    }
    
    // Special handling for coordinates (show more precision)
    if (fieldKey === 'latitude' || fieldKey === 'longitude') {
      return value ? `${value.toFixed(6)}°` : '-.------°'
    }
    
    // Use schema formatter
    return formatValueWithUnit(value, fieldDef)
  }

  return (
    <div className={`telemetry-strip ${isCollapsed ? 'collapsed' : ''}`}>
      <button 
        className="telem-toggle"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        {isCollapsed ? `▲ ${t('osd.telemetry')}` : `▼ ${t('osd.telemetry')}`}
      </button>
      
      {!isCollapsed && (
        <div className="telem-content">
          {displayFields.map(field => (
            <div key={field.key} className="telem-item">
              <span className="telem-label">{t(field.label)}</span>
              <span className="telem-value">{formatFieldValue(field.key, field)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
