// Geometric Fox Logo - Original design (kept for reference)
function FoxyLogoOriginal({ className = '', size = 24 }) {
  return (
    <svg 
      className={`foxy-logo ${className}`}
      viewBox="0 0 100 120" 
      width={size} 
      height={size * 1.2}
      fill="none" 
      stroke="currentColor" 
      strokeWidth="5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Left ear - outer edge */}
      <path d="M 8 72 L 28 8" />
      {/* Left ear - inner edge to center */}
      <path d="M 28 8 L 50 45" />
      {/* Right ear - inner edge from center */}
      <path d="M 50 45 L 72 8" />
      {/* Right ear - outer edge */}
      <path d="M 72 8 L 92 72" />
      
      {/* Left ear inner diagonal */}
      <path d="M 28 8 L 38 52" />
      {/* Right ear inner diagonal */}
      <path d="M 72 8 L 62 52" />
      
      {/* Horizontal cross line */}
      <path d="M 38 52 L 62 52" />
      
      {/* Center nose line */}
      <path d="M 50 45 L 50 112" />
      
      {/* Left cheek - outer */}
      <path d="M 8 72 L 50 112" />
      {/* Right cheek - outer */}
      <path d="M 92 72 L 50 112" />
      
      {/* Left lower triangle */}
      <path d="M 8 72 L 38 52" />
      <path d="M 38 52 L 26 88" />
      <path d="M 26 88 L 8 72" />
      
      {/* Right lower triangle */}
      <path d="M 92 72 L 62 52" />
      <path d="M 62 52 L 74 88" />
      <path d="M 74 88 L 92 72" />
    </svg>
  )
}

// Alternative Geometric Fox Logo - based on new reference
function FoxyLogo({ className = '', size = 24 }) {
  return (
    <svg 
      className={`foxy-logo ${className}`}
      viewBox="0 0 100 100" 
      width={size} 
      height={size}
      fill="none" 
      stroke="currentColor" 
      strokeWidth="5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Left ear - from tip down to outer face */}
      <path d="M 18 5 L 5 45" />
      {/* Left ear - from tip to inner face */}
      <path d="M 18 5 L 35 40" />
      
      {/* Right ear - from tip down to outer face */}
      <path d="M 82 5 L 95 45" />
      {/* Right ear - from tip to inner face */}
      <path d="M 82 5 L 65 40" />
      
      {/* Horizontal brow line */}
      <path d="M 35 40 L 65 40" />
      
      {/* Left face - outer edge down to jaw */}
      <path d="M 5 45 L 20 75" />
      {/* Left jaw to chin */}
      <path d="M 20 75 L 50 95" />
      
      {/* Right face - outer edge down to jaw */}
      <path d="M 95 45 L 80 75" />
      {/* Right jaw to chin */}
      <path d="M 80 75 L 50 95" />
      
      {/* Left inner face line */}
      <path d="M 35 40 L 20 75" />
      
      {/* Right inner face line */}
      <path d="M 65 40 L 80 75" />
    </svg>
  )
}

export default FoxyLogo
export { FoxyLogoOriginal }
