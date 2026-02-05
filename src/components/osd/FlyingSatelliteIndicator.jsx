/**
 * Flying Satellite Indicator Component
 * Displays satellite count with visual indicator for FPV OSD
 * Color coding: Red (0-3), Orange (4-5), Green (6+)
 */

export function FlyingSatelliteIndicator({ satellites = 0 }) {
  const getClass = () => {
    if (satellites >= 6) return 'good'
    if (satellites >= 4) return 'warning'
    return 'critical'
  }

  return (
    <div className={`satellite-indicator ${getClass()}`}>
      <svg 
        className="satellite-icon" 
        viewBox="0 0 24 24" 
        width="18" 
        height="18"
        fill="currentColor"
      >
        {/* Satellite body */}
        <rect x="9" y="9" width="6" height="6" rx="1" />
        {/* Solar panels */}
        <rect x="1" y="10.5" width="7" height="3" rx="0.5" />
        <rect x="16" y="10.5" width="7" height="3" rx="0.5" />
        {/* Panel lines */}
        <line x1="3" y1="10.5" x2="3" y2="13.5" stroke="currentColor" strokeWidth="0.5" opacity="0.5" />
        <line x1="5" y1="10.5" x2="5" y2="13.5" stroke="currentColor" strokeWidth="0.5" opacity="0.5" />
        <line x1="19" y1="10.5" x2="19" y2="13.5" stroke="currentColor" strokeWidth="0.5" opacity="0.5" />
        <line x1="21" y1="10.5" x2="21" y2="13.5" stroke="currentColor" strokeWidth="0.5" opacity="0.5" />
        {/* Antenna */}
        <line x1="12" y1="9" x2="12" y2="5" stroke="currentColor" strokeWidth="1" />
        <circle cx="12" cy="4" r="1.5" />
      </svg>
      <span className="satellite-count">{satellites}</span>
    </div>
  )
}

export default FlyingSatelliteIndicator
