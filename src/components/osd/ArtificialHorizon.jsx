/**
 * Artificial Horizon (Attitude Indicator) Component
 * Classic aviation-style attitude indicator showing pitch and roll
 * Overlays the camera view with sky/ground indication
 */
import { useMemo } from 'react'

export function ArtificialHorizon({ pitch = 0, roll = 0 }) {
  // Invert pitch and roll to match telemetry direction
  const invertedPitch = pitch * -1
  const invertedRoll = roll * -1
  
  // Clamp pitch to reasonable range (-90 to +90)
  const clampedPitch = Math.max(-90, Math.min(90, invertedPitch))
  // Roll can be -180 to +180
  const clampedRoll = Math.max(-180, Math.min(180, invertedRoll))
  
  // Pitch scaling: 1vh per degree for screen-independent positioning
  const pitchVhPerDegree = 1
  
  // Generate pitch ladder marks
  const pitchMarks = useMemo(() => {
    const marks = []
    // Generate marks from -90 to +90 degrees
    for (let deg = -90; deg <= 90; deg += 5) {
      if (deg === 0) continue // Horizon line is separate
      
      const isMajor = deg % 10 === 0
      marks.push({
        degree: deg,
        isMajor,
        label: Math.abs(deg)
      })
    }
    return marks
  }, [])
  
  // Generate roll scale marks
  const rollMarks = useMemo(() => {
    // Standard bank angle marks: 0, 10, 20, 30, 45, 60 (and negative)
    const angles = [0, 10, 20, 30, 45, 60]
    const marks = []
    
    angles.forEach(angle => {
      if (angle === 0) {
        marks.push({ angle: 0, isMajor: true, label: '' })
      } else {
        marks.push({ angle: angle, isMajor: angle % 30 === 0, label: angle })
        marks.push({ angle: -angle, isMajor: angle % 30 === 0, label: angle })
      }
    })
    
    return marks
  }, [])

  // Use vh units for pitch offset to be screen-size independent
  const pitchOffsetVh = clampedPitch * 1 // 1vh per degree of pitch
  
  return (
    <div className="artificial-horizon">
      {/* Sky and Ground background - rotates with roll, translates with pitch */}
      <div 
        className="ah-background"
        style={{
          transform: `translate(-50%, -50%) rotate(${-clampedRoll}deg) translateY(${pitchOffsetVh}vh)`
        }}
      >
        {/* Sky */}
        <div className="ah-sky" />
        
        {/* Ground */}
        <div className="ah-ground" />
        
        {/* Horizon line */}
        <div className="ah-horizon-line" />
        
        {/* Pitch ladder */}
        <div className="ah-pitch-ladder">
          {pitchMarks.map(mark => {
            // Calculate screen position relative to center (in vh units)
            // mark.degree away from horizon, horizon is at pitchOffset from center
            const screenPosVh = mark.degree - clampedPitch
            
            // Calculate opacity: full opacity within ±15vh, fade to 0 at ±40vh
            const absPos = Math.abs(screenPosVh)
            const fadeStart = 15 // Start fading at 15vh from center
            const fadeEnd = 40   // Fully transparent at 40vh from center
            const opacity = absPos <= fadeStart 
              ? 1 
              : absPos >= fadeEnd 
                ? 0 
                : 1 - (absPos - fadeStart) / (fadeEnd - fadeStart)
            
            return (
              <div
                key={mark.degree}
                className={`ah-pitch-mark ${mark.isMajor ? 'major' : 'minor'}`}
                style={{
                  transform: `translate(-50%, ${-mark.degree * pitchVhPerDegree}vh)`,
                  opacity: opacity
                }}
              >
                {mark.isMajor && (
                  <>
                    <span className="ah-pitch-label left">{mark.label}</span>
                    <div className="ah-pitch-line" />
                    <span className="ah-pitch-label right">{mark.label}</span>
                  </>
                )}
                {!mark.isMajor && (
                  <div className="ah-pitch-line short" />
                )}
              </div>
            )
          })}
        </div>
      </div>
      
      {/* Fixed elements (don't rotate) */}
      
      {/* Roll scale arc at top */}
      <div className="ah-roll-scale">
        <svg viewBox="-100 -100 200 120" className="ah-roll-svg">
          {/* Roll arc - spans from -65° to +65° */}
          <path
            d={`M ${Math.cos((-65 - 90) * Math.PI / 180) * 85} ${Math.sin((-65 - 90) * Math.PI / 180) * 85} A 85 85 0 0 1 ${Math.cos((65 - 90) * Math.PI / 180) * 85} ${Math.sin((65 - 90) * Math.PI / 180) * 85}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="0.5"
            className="ah-roll-arc"
          />
          
          {/* Roll marks */}
          {rollMarks.map(mark => {
            const angleRad = (mark.angle - 90) * Math.PI / 180
            const innerRadius = mark.isMajor ? 78 : 81
            const outerRadius = 85
            const x1 = Math.cos(angleRad) * innerRadius
            const y1 = Math.sin(angleRad) * innerRadius
            const x2 = Math.cos(angleRad) * outerRadius
            const y2 = Math.sin(angleRad) * outerRadius
            const labelRadius = 72
            const labelX = Math.cos(angleRad) * labelRadius
            const labelY = Math.sin(angleRad) * labelRadius
            
            return (
              <g key={mark.angle}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="currentColor"
                  strokeWidth={mark.isMajor ? 0.8 : 0.5}
                  className="ah-roll-tick"
                />
                {mark.isMajor && mark.label && (
                  <text
                    x={labelX}
                    y={labelY}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="ah-roll-label"
                  >
                    {mark.label}
                  </text>
                )}
              </g>
            )
          })}
          
          {/* Zero reference triangle (top center, fixed) - outline only */}
          <polygon
            points="0,-85 -2,-82 2,-82"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.5"
            className="ah-zero-marker"
          />
        </svg>
        
        {/* Roll pointer (rotates with roll) - bottom tip touches arc */}
        <div 
          className="ah-roll-pointer-container"
          style={{ transform: `rotate(${-clampedRoll}deg)` }}
        >
          <svg viewBox="-100 -100 200 120" className="ah-roll-pointer-svg">
            <polygon
              points="0,-85 -2,-88 2,-88"
              fill="currentColor"
              className="ah-roll-pointer"
            />
          </svg>
        </div>
      </div>
      
      {/* Aircraft symbol (fixed center) */}
      <div className="ah-aircraft-symbol">
        <svg viewBox="0 0 120 30" className="ah-aircraft-svg">
          {/* Left wing */}
          <path
            d="M 0 15 L 45 15 L 50 20 L 50 15"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Right wing */}
          <path
            d="M 120 15 L 75 15 L 70 20 L 70 15"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Center dot */}
          <circle cx="60" cy="15" r="4" fill="currentColor" />
        </svg>
      </div>
      
    </div>
  )
}

export default ArtificialHorizon
