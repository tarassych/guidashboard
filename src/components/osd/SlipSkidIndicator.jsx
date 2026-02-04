/**
 * Slip-Skid Indicator (Turn Coordinator) Component
 * Shows yaw coordination with a ball in curved tube
 * Ball centered = coordinated flight
 * Ball left = too much yaw to right (slip)
 * Ball right = too much yaw to left (skid)
 */

export function SlipSkidIndicator({ yaw = 0 }) {
  // Yaw range: -180 to +180 degrees maps to ball position on arc
  // Left end of arc = minimum yaw (-180), right end = maximum yaw (+180)
  const clampedYaw = Math.max(-180, Math.min(180, yaw))
  
  // Quarter circle arc spans from 135° to 45° (45° on each side of bottom center at 90°)
  // Map yaw -180 to +180 to arc position 135° to 45°
  // yaw -180 -> 135° (left), yaw 0 -> 90° (center), yaw +180 -> 45° (right)
  const ballAngle = 90 - (clampedYaw / 180) * 45
  
  // Calculate ball position on the arc
  const arcRadius = 85
  const angleRad = ballAngle * Math.PI / 180
  const ballX = Math.cos(angleRad) * arcRadius
  const ballY = Math.sin(angleRad) * arcRadius
  
  // Calculate arc endpoints (quarter circle: 45° on each side of bottom)
  // Start at 135° (bottom-left), end at 45° (bottom-right)
  const startAngle = 135 * Math.PI / 180
  const endAngle = 45 * Math.PI / 180
  const startX = Math.cos(startAngle) * arcRadius
  const startY = Math.sin(startAngle) * arcRadius
  const endX = Math.cos(endAngle) * arcRadius
  const endY = Math.sin(endAngle) * arcRadius

  return (
    <div className="slip-skid-indicator">
      <svg viewBox="-100 -20 200 120" className="slip-skid-svg">
        {/* Curved tube arc (quarter circle at bottom) */}
        <path
          d={`M ${startX} ${startY} A ${arcRadius} ${arcRadius} 0 0 0 ${endX} ${endY}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="0.5"
          className="slip-skid-arc"
        />
        
        {/* Center reference marks (two small lines indicating center) */}
        <line
          x1="-8"
          y1="85"
          x2="-8"
          y2="80"
          stroke="currentColor"
          strokeWidth="0.5"
          className="slip-skid-center-mark"
        />
        <line
          x1="8"
          y1="85"
          x2="8"
          y2="80"
          stroke="currentColor"
          strokeWidth="0.5"
          className="slip-skid-center-mark"
        />
        
        {/* Ball indicator */}
        <circle
          cx={ballX}
          cy={ballY}
          r="2.5"
          fill="currentColor"
          className="slip-skid-ball"
        />
      </svg>
    </div>
  )
}

export default SlipSkidIndicator
