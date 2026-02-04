/**
 * Heading Compass Arc Component
 * Garmin G1000-style curved compass arc for Flying OSD
 * Shows aircraft magnetic heading with rotating scale and fixed index
 */
import { useMemo } from 'react'

export function HeadingCompassArc({ heading = 0 }) {
  // Normalize heading to 0-360
  const normalizedHeading = ((heading % 360) + 360) % 360
  
  // Arc configuration
  const arcRadius = 400 // Radius of the arc (2x bigger)
  const arcSpan = 90 // Total degrees of arc visible (±45° from center)
  
  // Calculate shortest angle difference (handles 359→0 wrap)
  const shortestAngle = (angle) => {
    return ((angle + 540) % 360) - 180
  }
  
  // Generate tick marks and labels positioned along the arc
  const tickMarks = useMemo(() => {
    const marks = []
    const halfSpan = arcSpan / 2 + 5 // Extra buffer
    
    // Generate marks for all 360 degrees
    for (let deg = 0; deg < 360; deg++) {
      const delta = shortestAngle(deg - normalizedHeading)
      
      // Only include marks within visible arc range
      if (Math.abs(delta) <= halfSpan) {
        // Convert delta to angle on the arc (center is at top, -90°)
        // delta negative = left side, delta positive = right side
        const arcAngle = -90 + delta // Angle in degrees on SVG coordinate system
        const arcAngleRad = arcAngle * Math.PI / 180
        
        // Determine tick type
        const isMajor = deg % 10 === 0
        const isMedium = deg % 5 === 0 && !isMajor
        
        // Get label for major ticks
        let label = null
        if (isMajor) {
          if (deg === 0) label = 'N'
          else if (deg === 90) label = 'E'
          else if (deg === 180) label = 'S'
          else if (deg === 270) label = 'W'
          else label = Math.floor(deg / 10).toString()
        }
        
        // Calculate positions on arc
        const outerX = Math.cos(arcAngleRad) * arcRadius
        const outerY = Math.sin(arcAngleRad) * arcRadius
        
        const tickLength = isMajor ? 24 : isMedium ? 16 : 8
        const innerX = Math.cos(arcAngleRad) * (arcRadius - tickLength)
        const innerY = Math.sin(arcAngleRad) * (arcRadius - tickLength)
        
        const labelRadius = arcRadius - 44
        const labelX = Math.cos(arcAngleRad) * labelRadius
        const labelY = Math.sin(arcAngleRad) * labelRadius
        
        marks.push({
          deg,
          arcAngle,
          outerX, outerY,
          innerX, innerY,
          labelX, labelY,
          isMajor,
          isMedium,
          label
        })
      }
    }
    
    return marks
  }, [normalizedHeading])
  
  // Format heading display (3 digits with leading zeros)
  const headingDisplay = Math.round(normalizedHeading).toString().padStart(3, '0')
  
  // Arc path endpoints
  const startAngle = (-90 - arcSpan/2) * Math.PI / 180
  const endAngle = (-90 + arcSpan/2) * Math.PI / 180
  const startX = Math.cos(startAngle) * arcRadius
  const startY = Math.sin(startAngle) * arcRadius
  const endX = Math.cos(endAngle) * arcRadius
  const endY = Math.sin(endAngle) * arcRadius

  return (
    <div className="heading-compass-arc">
      <svg 
        viewBox="-440 -440 880 280" 
        className="hca-svg"
        preserveAspectRatio="xMidYMax meet"
      >
        {/* Arc line */}
        <path
          d={`M ${startX} ${startY} A ${arcRadius} ${arcRadius} 0 0 1 ${endX} ${endY}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="0.5"
          className="hca-arc-line"
        />
        
        {/* Tick marks along the arc */}
        {tickMarks.map((mark, idx) => {
          const strokeWidth = mark.isMajor ? 1 : mark.isMedium ? 0.7 : 0.4
          
          return (
            <g key={`${mark.deg}-${idx}`}>
              {/* Tick line */}
              <line
                x1={mark.outerX}
                y1={mark.outerY}
                x2={mark.innerX}
                y2={mark.innerY}
                stroke="currentColor"
                strokeWidth={strokeWidth}
                className={`hca-tick ${mark.isMajor ? 'major' : mark.isMedium ? 'medium' : 'minor'}`}
              />
              
              {/* Label for major ticks */}
              {mark.label && (
                <text
                  x={mark.labelX}
                  y={mark.labelY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className={`hca-label ${mark.label.length === 1 && isNaN(mark.label) ? 'cardinal' : ''}`}
                >
                  {mark.label}
                </text>
              )}
            </g>
          )
        })}
        
        {/* Fixed lubber line (triangle pointer at top center) */}
        <polygon
          points="0,-410 -6,-396 6,-396"
          fill="currentColor"
          className="hca-lubber-triangle"
        />
        
        {/* Heading value display */}
        <text
          x="0"
          y="-320"
          textAnchor="middle"
          dominantBaseline="middle"
          className="hca-heading-number"
        >
          {headingDisplay}°
        </text>
        <text
          x="40"
          y="-320"
          textAnchor="start"
          dominantBaseline="middle"
          className="hca-heading-label"
        >
          MAG
        </text>
      </svg>
    </div>
  )
}

export default HeadingCompassArc
