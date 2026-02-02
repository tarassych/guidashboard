/**
 * Battery Indicator Component
 * Displays battery voltage with visual indicator
 */

export function BatteryIndicator({ voltage }) {
  const getClass = () => {
    if (voltage >= 37) return 'good'
    if (voltage >= 35) return 'warning'
    return 'critical'
  }

  const minV = 33
  const maxV = 42
  const fillPercent = Math.max(0, Math.min(100, ((voltage - minV) / (maxV - minV)) * 100))

  return (
    <div className={`battery-indicator ${getClass()}`}>
      <span className="battery-voltage">{voltage.toFixed(1)}V</span>
      <div className="battery-icon-mini">
        <div className="battery-fill-mini" style={{ width: `${fillPercent}%` }}></div>
      </div>
    </div>
  )
}
