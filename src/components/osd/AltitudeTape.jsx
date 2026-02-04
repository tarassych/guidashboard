/**
 * Altitude Tape Component
 * Garmin G1000-style vertical altitude indicator
 * Shows current altitude with scrolling tape, rolling digits, and trend vector
 */
import { useState, useEffect, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

export function AltitudeTape({ altitude = 0, unit = 'm' }) {
  const { t } = useTranslation()
  // Track altitude history for trend calculation (vertical speed prediction)
  const altitudeHistoryRef = useRef([])
  const [trend, setTrend] = useState(0) // Predicted altitude change in 6 seconds
  
  // Configuration
  const TAPE_HEIGHT = 630 // Match airspeed tape height
  const PIXELS_PER_UNIT = 0.6 // Pixels per meter (scaled for altitude range)
  const VISIBLE_RANGE = Math.floor(TAPE_HEIGHT / PIXELS_PER_UNIT) // ~1050m visible
  const CENTER_OFFSET = TAPE_HEIGHT / 2 // Center point
  
  // Calculate trend vector (altitude prediction in 6 seconds based on vertical speed)
  useEffect(() => {
    const now = Date.now()
    
    // Add current altitude to history
    altitudeHistoryRef.current.push({ altitude, time: now })
    
    // Keep only last 2 seconds of history
    altitudeHistoryRef.current = altitudeHistoryRef.current.filter(
      entry => now - entry.time < 2000
    )
    
    // Calculate vertical speed if we have enough data
    if (altitudeHistoryRef.current.length >= 2) {
      const oldest = altitudeHistoryRef.current[0]
      const newest = altitudeHistoryRef.current[altitudeHistoryRef.current.length - 1]
      const timeDelta = (newest.time - oldest.time) / 1000 // seconds
      
      if (timeDelta > 0.1) {
        const altDelta = newest.altitude - oldest.altitude
        const verticalSpeed = altDelta / timeDelta // m per second
        
        // Predict altitude change in 6 seconds
        const predictedChange = verticalSpeed * 6
        // Clamp to reasonable range (-300 to +300 m)
        setTrend(Math.max(-300, Math.min(300, predictedChange)))
      }
    }
  }, [altitude])
  
  // Round altitude for display and mark calculations
  const displayAlt = Math.max(0, Math.round(altitude))
  
  // Generate tape marks
  const tapeMarks = useMemo(() => {
    const marks = []
    const startAlt = displayAlt - Math.floor(VISIBLE_RANGE / 2) - 100
    const endAlt = displayAlt + Math.floor(VISIBLE_RANGE / 2) + 100
    
    // Generate marks at 20m intervals
    const startRounded = Math.floor(startAlt / 20) * 20
    
    for (let a = startRounded; a <= endAlt; a += 20) {
      if (a < 0) continue // No negative altitudes
      
      const isMajor = a % 500 === 0 // Label every 500m
      const isMedium = a % 100 === 0 && !isMajor // Medium tick every 100m
      
      marks.push({
        altitude: a,
        isMajor,
        isMedium,
        isMinor: !isMajor && !isMedium
      })
    }
    
    return marks
  }, [Math.floor(displayAlt / 100)]) // Recalculate when passing 100m boundaries
  
  // Calculate tape offset for smooth scrolling (fractional meter within display)
  const tapeOffset = (altitude - displayAlt) * PIXELS_PER_UNIT
  const thousands = Math.floor(displayAlt / 1000)
  const hundreds = Math.floor((displayAlt % 1000) / 100)
  const tens = Math.floor((displayAlt % 100) / 10)
  const ones = displayAlt % 10
  
  // Trend arrow height (pixels)
  const trendHeight = Math.abs(trend) * PIXELS_PER_UNIT * 0.3 // Scale for visual
  const trendDirection = trend > 0 ? 'up' : trend < 0 ? 'down' : 'none'
  
  return (
    <div className="altitude-tape">
      {/* Title label */}
      <div className="tape-label">{t('osd.altitude')}</div>
      
      {/* Tape container with overflow hidden */}
      <div className="altitude-tape-container">
        {/* Background */}
        <div className="altitude-tape-bg" />
        
        {/* Scrolling tape */}
        <div 
          className="altitude-tape-scroll"
          style={{ 
            transform: `translateY(${tapeOffset}px)` 
          }}
        >
          {tapeMarks.map(mark => {
            const offsetFromCenter = (displayAlt - mark.altitude) * PIXELS_PER_UNIT
            const yPos = CENTER_OFFSET + offsetFromCenter
            
            return (
              <div
                key={mark.altitude}
                className={`altitude-mark ${mark.isMajor ? 'major' : ''} ${mark.isMedium ? 'medium' : ''} ${mark.isMinor ? 'minor' : ''}`}
                style={{ top: `${yPos}px` }}
              >
                <div className="mark-line" />
                {mark.isMajor && (
                  <span className="mark-label">{mark.altitude}</span>
                )}
              </div>
            )
          })}
        </div>
        
        {/* Trend vector arrow */}
        {Math.abs(trend) > 5 && (
          <div 
            className={`altitude-trend ${trendDirection}`}
            style={{ 
              height: `${Math.min(trendHeight, 100)}px`
            }}
          >
            <div className="trend-arrow" />
          </div>
        )}
        
        {/* Fixed center reference box with digits */}
        <div className="altitude-reference-box">
          <div className="altitude-digits">
            <span className="digit thousands">{thousands}</span>
            <span className="digit hundreds">{hundreds}</span>
            <span className="digit tens">{tens}</span>
            <span className="digit ones">{ones}</span>
          </div>
        </div>
        
        {/* Top and bottom fade masks */}
        <div className="altitude-mask top" />
        <div className="altitude-mask bottom" />
      </div>
      
      {/* Unit label */}
      <div className="altitude-unit">{unit}</div>
    </div>
  )
}
