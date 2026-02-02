/**
 * Speedometer Component
 * Analog speedometer with digital odometer
 */
import { useTranslation } from 'react-i18next'

export function Speedometer({ speed, dist }) {
  const { t } = useTranslation()
  const speedKmh = speed
  const maxSpeed = 40
  const angle = Math.min((speedKmh / maxSpeed) * 240, 240) - 120

  const odoValue = Math.floor(dist || 0)
  const odoDigits = String(odoValue).padStart(5, '0').split('')

  const ticks = []
  for (let i = 0; i <= 40; i += 10) {
    const tickAngle = (i / maxSpeed) * 240 - 120
    const isMain = i % 20 === 0
    const radians = (tickAngle - 90) * (Math.PI / 180)
    const innerRadius = isMain ? 52 : 56
    const outerRadius = 62
    const x1 = 70 + innerRadius * Math.cos(radians)
    const y1 = 70 + innerRadius * Math.sin(radians)
    const x2 = 70 + outerRadius * Math.cos(radians)
    const y2 = 70 + outerRadius * Math.sin(radians)
    
    ticks.push(
      <g key={i}>
        <line 
          x1={x1} y1={y1} x2={x2} y2={y2} 
          stroke={i <= speedKmh ? "var(--theme-accent-primary)" : "var(--theme-text-muted)"} 
          strokeWidth={isMain ? 2 : 1}
        />
        {isMain && (
          <text 
            x={70 + 42 * Math.cos(radians)} 
            y={70 + 42 * Math.sin(radians)} 
            fill="var(--theme-text-secondary)" 
            fontSize="8" 
            textAnchor="middle" 
            dominantBaseline="middle"
          >
            {i}
          </text>
        )}
      </g>
    )
  }

  return (
    <div className="speedometer">
      <svg viewBox="0 0 140 100" className="speedo-svg">
        <path 
          d="M 14 70 A 56 56 0 0 1 126 70" 
          fill="none" 
          stroke="var(--theme-hud-border)" 
          strokeWidth="3"
        />
        {ticks}
        <g transform={`rotate(${angle}, 70, 70)`}>
          <polygon 
            points="70,25 67,70 70,75 73,70" 
            fill="var(--theme-status-danger)"
            filter="drop-shadow(0 0 3px var(--theme-status-danger))"
          />
        </g>
        <circle cx="70" cy="70" r="8" fill="var(--theme-bg-dark)" stroke="var(--theme-accent-primary)" strokeWidth="2"/>
      </svg>
      <div className="speedo-readout">
        <span className="speedo-value">{speedKmh.toFixed(0)}</span>
        <span className="speedo-unit">{t('osd.speedUnit')}</span>
      </div>
      <div className="odometer">
        <div className="odo-display">
          {odoDigits.map((digit, i) => (
            <div key={i} className="odo-digit">
              <span className="odo-num">{digit}</span>
            </div>
          ))}
        </div>
        <span className="odo-unit">{t('osd.distanceUnit')}</span>
      </div>
    </div>
  )
}
