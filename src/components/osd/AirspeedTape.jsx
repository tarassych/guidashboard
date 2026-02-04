/**
 * Airspeed Tape Component
 * Garmin G1000-style vertical airspeed indicator
 * Shows current speed with scrolling tape and trend vector
 */
import { useState, useEffect, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

export function AirspeedTape({ speed = 0, unit = 'km/h' }) {
  const { t } = useTranslation()
  // Track speed history for trend calculation
  const speedHistoryRef = useRef([])
  const [trend, setTrend] = useState(0) // Predicted speed change in 6 seconds
  
  // Configuration
  const TAPE_HEIGHT = 630 // Total visible height in pixels
  const PIXELS_PER_UNIT = 6 // Pixels per km/h (scaled up)
  const VISIBLE_RANGE = Math.floor(TAPE_HEIGHT / PIXELS_PER_UNIT) // ~105 km/h visible
  const CENTER_OFFSET = TAPE_HEIGHT / 2 // Center point
  
  // Calculate trend vector (speed prediction in 6 seconds)
  useEffect(() => {
    const now = Date.now()
    
    // Add current speed to history
    speedHistoryRef.current.push({ speed, time: now })
    
    // Keep only last 2 seconds of history
    speedHistoryRef.current = speedHistoryRef.current.filter(
      entry => now - entry.time < 2000
    )
    
    // Calculate acceleration if we have enough data
    if (speedHistoryRef.current.length >= 2) {
      const oldest = speedHistoryRef.current[0]
      const newest = speedHistoryRef.current[speedHistoryRef.current.length - 1]
      const timeDelta = (newest.time - oldest.time) / 1000 // seconds
      
      if (timeDelta > 0.1) {
        const speedDelta = newest.speed - oldest.speed
        const acceleration = speedDelta / timeDelta // km/h per second
        
        // Predict speed change in 6 seconds
        const predictedChange = acceleration * 6
        // Clamp to reasonable range (-30 to +30 km/h)
        setTrend(Math.max(-30, Math.min(30, predictedChange)))
      }
    }
  }, [speed])
  
  // Generate tape marks
  const tapeMarks = useMemo(() => {
    const marks = []
    const centerSpeed = Math.round(speed)
    const startSpeed = centerSpeed - Math.floor(VISIBLE_RANGE / 2) - 10
    const endSpeed = centerSpeed + Math.floor(VISIBLE_RANGE / 2) + 10
    
    for (let s = startSpeed; s <= endSpeed; s++) {
      if (s < 0) continue // No negative speeds
      
      const isMajor = s % 10 === 0
      const isMedium = s % 5 === 0
      
      marks.push({
        speed: s,
        isMajor,
        isMedium: isMedium && !isMajor,
        isMinor: !isMajor && !isMedium
      })
    }
    
    return marks
  }, [Math.floor(speed / 10)]) // Recalculate when passing 10 km/h boundaries
  
  // Calculate tape offset for smooth scrolling
  const tapeOffset = (speed % 1) * PIXELS_PER_UNIT
  
  // Round speed for display
  const displaySpeed = Math.round(speed)
  
  // Trend arrow height (pixels)
  const trendHeight = Math.abs(trend) * PIXELS_PER_UNIT * 0.5 // Scale down for visual
  const trendDirection = trend > 0 ? 'up' : trend < 0 ? 'down' : 'none'
  
  return (
    <div className="airspeed-tape">
      {/* Title label */}
      <div className="tape-label">{t('osd.speed')}</div>
      
      {/* Tape container with overflow hidden */}
      <div className="airspeed-tape-container">
        {/* Background gradient for sky/ground effect */}
        <div className="airspeed-tape-bg" />
        
        {/* Scrolling tape */}
        <div 
          className="airspeed-tape-scroll"
          style={{ 
            transform: `translateY(${tapeOffset}px)` 
          }}
        >
          {tapeMarks.map(mark => {
            const offsetFromCenter = (displaySpeed - mark.speed) * PIXELS_PER_UNIT
            const yPos = CENTER_OFFSET + offsetFromCenter
            
            return (
              <div
                key={mark.speed}
                className={`airspeed-mark ${mark.isMajor ? 'major' : ''} ${mark.isMedium ? 'medium' : ''} ${mark.isMinor ? 'minor' : ''}`}
                style={{ top: `${yPos}px` }}
              >
                <div className="mark-line" />
                {mark.isMajor && (
                  <span className="mark-label">{mark.speed}</span>
                )}
              </div>
            )
          })}
        </div>
        
        {/* Trend vector arrow */}
        {Math.abs(trend) > 0.5 && (
          <div 
            className={`airspeed-trend ${trendDirection}`}
            style={{ 
              height: `${Math.min(trendHeight, 80)}px`
            }}
          >
            <div className="trend-arrow" />
          </div>
        )}
        
        {/* Fixed center reference box */}
        <div className="airspeed-reference-box">
          <span className="airspeed-value">{displaySpeed}</span>
        </div>
        
        {/* Top and bottom fade masks */}
        <div className="airspeed-mask top" />
        <div className="airspeed-mask bottom" />
      </div>
      
      {/* Unit label */}
      <div className="airspeed-unit">{unit}</div>
    </div>
  )
}
