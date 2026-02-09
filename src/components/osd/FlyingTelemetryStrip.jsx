/**
 * Flying Telemetry Strip Component
 * Bottom strip with telemetry data and telemetry log integration for FPV drones
 * Collapsed: heartbeat left, status right
 * Expanded: telem-content + tlog-console
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { DRONE_TYPES, getDisplayFields, formatValueWithUnit } from '../../telemetrySchemas'

// Animated Cardiogram Component (copied from App.jsx TelemetryLog)
function AnimatedCardiogram({ heartbeats }) {
  const canvasRef = useRef(null)
  const animationRef = useRef(null)
  const offsetRef = useRef(0)
  
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    const width = canvas.width
    const height = canvas.height
    const centerY = height / 2
    const scrollSpeed = 0.5 // pixels per frame
    
    const animate = () => {
      offsetRef.current += scrollSpeed
      
      // Clear canvas
      ctx.clearRect(0, 0, width, height)
      
      // Draw baseline
      ctx.strokeStyle = 'rgba(0, 255, 136, 0.3)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, centerY)
      ctx.lineTo(width, centerY)
      ctx.stroke()
      
      // Draw heartbeats
      const now = Date.now()
      heartbeats.forEach(hb => {
        const age = now - hb.time
        const maxAge = 5000 // 5 seconds to cross the screen
        if (age > maxAge) return
        
        // Position: starts at right (width), moves to left (0)
        const progress = age / maxAge
        const x = width * (1 - progress)
        
        // Amplitude decreases as it moves left
        const amplitude = (1 - progress * 0.8) * 15
        
        // Draw heartbeat spike
        ctx.strokeStyle = `rgba(0, 255, 136, ${1 - progress * 0.7})`
        ctx.lineWidth = 2
        ctx.beginPath()
        
        // ECG-like waveform
        const spikeWidth = 25
        ctx.moveTo(x - spikeWidth, centerY)
        ctx.lineTo(x - spikeWidth + 5, centerY)
        ctx.lineTo(x - spikeWidth + 8, centerY - amplitude * 0.3)
        ctx.lineTo(x - spikeWidth + 11, centerY + amplitude * 0.5)
        ctx.lineTo(x - spikeWidth + 14, centerY - amplitude)
        ctx.lineTo(x - spikeWidth + 17, centerY + amplitude * 0.8)
        ctx.lineTo(x - spikeWidth + 20, centerY)
        ctx.lineTo(x, centerY)
        ctx.stroke()
      })
      
      animationRef.current = requestAnimationFrame(animate)
    }
    
    animate()
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [heartbeats])
  
  return (
    <canvas 
      ref={canvasRef} 
      className="flying-tlog-cardiogram-canvas"
      width={200}
      height={40}
    />
  )
}

export function FlyingTelemetryStrip({ 
  telemetry, 
  droneType = DRONE_TYPES.GENERIC_FPV,
  tlogState = { records: [], connectionStatus: 'connecting', heartbeats: [] },
  mapVisible = true,
  osdVisible = true,
  onMapToggle,
  onOsdToggle
}) {
  const { t } = useTranslation()
  const [isCollapsed, setIsCollapsed] = useState(true)
  
  const { records, connectionStatus, heartbeats } = tlogState
  
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

  // Format timestamp for console
  const formatTimestamp = useCallback((timestamp) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit'
    })
  }, [])

  // Format telemetry data for console display
  const formatTelemetryData = useCallback((data) => {
    const fields = []
    const type = data.type || '?'
    
    fields.push(`[${type.toUpperCase()}]`)
    
    if (type === 'gps') {
      if (data.latitude !== undefined) fields.push(`LAT:${data.latitude.toFixed(5)}`)
      if (data.longitude !== undefined) fields.push(`LNG:${data.longitude.toFixed(5)}`)
      if (data.groundspeed !== undefined) fields.push(`GS:${data.groundspeed}`)
      if (data.heading !== undefined) fields.push(`HDG:${data.heading.toFixed(0)}°`)
      if (data.altitude !== undefined) fields.push(`ALT:${data.altitude}`)
      if (data.satellites !== undefined) fields.push(`SAT:${data.satellites}`)
    }
    
    if (type === 'batt') {
      if (data.batt_v !== undefined) fields.push(`${data.batt_v}V`)
    }
    
    if (type === 'att') {
      if (data.pitch !== undefined) fields.push(`P:${data.pitch.toFixed(1)}°`)
      if (data.roll !== undefined) fields.push(`R:${data.roll.toFixed(1)}°`)
      if (data.yaw !== undefined) fields.push(`Y:${data.yaw.toFixed(1)}°`)
    }
    
    if (type === 'mode') {
      if (data.mode !== undefined) fields.push(data.mode)
    }
    
    return fields.join(' ')
  }, [])

  return (
    <div className={`telemetry-strip ${isCollapsed ? 'collapsed' : ''}`}>
      {/* Collapsed: heartbeat+status left, button center, switches right */}
      {isCollapsed && (
        <>
          <div className="flying-tstrip-left">
            <div className="flying-tstrip-heartbeat">
              <AnimatedCardiogram heartbeats={heartbeats} />
            </div>
            <span className={`flying-tlog-status ${connectionStatus}`}>
              {connectionStatus === 'connected' ? `● ${t('osd.live')}` : connectionStatus === 'connecting' ? `○ ${t('osd.connecting')}` : `○ ${t('common.off')}`}
            </span>
          </div>
          <button 
            className="telem-toggle flying-telem-toggle"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            ▲ {t('osd.telemetry')}
          </button>
          <div className="flying-tstrip-right">
            <button 
              className={`flying-osd-switch ${osdVisible ? 'on' : 'off'}`}
              onClick={onOsdToggle}
            >
              <span className="switch-label">OSD</span>
              <span className="switch-indicator"></span>
            </button>
            <button 
              className={`flying-osd-switch ${mapVisible ? 'on' : 'off'}`}
              onClick={onMapToggle}
            >
              <span className="switch-label">MAP</span>
              <span className="switch-indicator"></span>
            </button>
          </div>
        </>
      )}
      
      {/* Expanded: log first, then telem-content row with toggle on right */}
      {!isCollapsed && (
        <>
          {/* Telemetry log console - full width at top */}
          <div className="flying-tlog-console">
            {records.length === 0 ? (
              <div className="flying-tlog-empty">{t('osd.waiting')}</div>
            ) : (
              records.map(record => (
                <div key={record.id} className="flying-tlog-entry">
                  <span className="flying-tlog-time">{formatTimestamp(record.timestamp)}</span>
                  <span className="flying-tlog-data">{formatTelemetryData(record.data)}</span>
                </div>
              ))
            )}
          </div>
          
          {/* Telemetry content row with toggle on right */}
          <div className="flying-telem-row">
            <div className="telem-content">
              {displayFields.map(field => (
                <div key={field.key} className="telem-item">
                  <span className="telem-label">{t(field.label)}</span>
                  <span className="telem-value">{formatFieldValue(field.key, field)}</span>
                </div>
              ))}
            </div>
            
            <button 
              className="telem-toggle flying-telem-toggle"
              onClick={() => setIsCollapsed(!isCollapsed)}
            >
              ▼ {t('osd.telemetry')}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default FlyingTelemetryStrip
