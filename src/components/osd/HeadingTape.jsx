/**
 * Heading Tape Component
 * Horizontal heading indicator tape
 */

export function HeadingTape({ heading }) {
  const ticks = []
  for (let i = -6; i <= 6; i++) {
    const deg = Math.round((heading + i * 10) / 10) * 10
    const normalizedDeg = ((deg % 360) + 360) % 360
    const offset = (deg - heading) * 4
    const isMain = normalizedDeg % 30 === 0
    ticks.push(
      <div 
        key={i} 
        className={`htape-tick ${isMain ? 'main' : ''}`}
        style={{ left: `calc(50% + ${offset}px)` }}
      >
        {isMain && <span className="htape-label">{normalizedDeg}</span>}
        <div className="htape-mark"></div>
      </div>
    )
  }

  return (
    <div className="heading-tape">
      <div className="htape-container">
        {ticks}
      </div>
      <div className="htape-indicator">▼</div>
      <div className="htape-value">{heading.toFixed(0)}°</div>
    </div>
  )
}
