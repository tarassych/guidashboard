/**
 * Drone Type Icons
 * SVG icons for different drone types (Ground/FPV)
 */

// Ground Drone Icon (for type indicator)
export function GroundDroneIcon({ size = 24, active = false }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 64 64" 
      fill="none"
      className={`drone-type-icon ground ${active ? 'active' : ''}`}
    >
      <rect x="8" y="28" width="48" height="20" rx="4" fill="currentColor" opacity="0.3"/>
      <rect x="8" y="28" width="48" height="20" rx="4" stroke="currentColor" strokeWidth="2"/>
      <rect x="4" y="44" width="12" height="8" rx="2" fill="currentColor" opacity="0.5"/>
      <rect x="48" y="44" width="12" height="8" rx="2" fill="currentColor" opacity="0.5"/>
      <circle cx="10" cy="52" r="6" fill="currentColor" opacity="0.7"/>
      <circle cx="54" cy="52" r="6" fill="currentColor" opacity="0.7"/>
      <rect x="24" y="20" width="16" height="12" rx="2" fill="currentColor" opacity="0.4"/>
      <circle cx="32" cy="26" r="4" fill="currentColor"/>
      <line x1="16" y1="36" x2="48" y2="36" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

// FPV Drone Icon (for type indicator)
export function FpvDroneIcon({ size = 24, active = false }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 64 64" 
      fill="none"
      className={`drone-type-icon fpv ${active ? 'active' : ''}`}
    >
      <ellipse cx="32" cy="32" rx="8" ry="6" fill="currentColor" opacity="0.4"/>
      <ellipse cx="32" cy="32" rx="8" ry="6" stroke="currentColor" strokeWidth="2"/>
      <line x1="24" y1="28" x2="12" y2="16" stroke="currentColor" strokeWidth="2"/>
      <line x1="40" y1="28" x2="52" y2="16" stroke="currentColor" strokeWidth="2"/>
      <line x1="24" y1="36" x2="12" y2="48" stroke="currentColor" strokeWidth="2"/>
      <line x1="40" y1="36" x2="52" y2="48" stroke="currentColor" strokeWidth="2"/>
      <circle cx="12" cy="16" r="8" fill="currentColor" opacity="0.3"/>
      <circle cx="52" cy="16" r="8" fill="currentColor" opacity="0.3"/>
      <circle cx="12" cy="48" r="8" fill="currentColor" opacity="0.3"/>
      <circle cx="52" cy="48" r="8" fill="currentColor" opacity="0.3"/>
      <circle cx="12" cy="16" r="8" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="52" cy="16" r="8" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="12" cy="48" r="8" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="52" cy="48" r="8" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="32" cy="30" r="3" fill="currentColor"/>
    </svg>
  )
}
