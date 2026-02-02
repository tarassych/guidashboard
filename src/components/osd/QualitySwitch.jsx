/**
 * Quality Switch Component
 * SD/HD video quality toggle
 */

export function QualitySwitch({ isHd, onToggle }) {
  return (
    <div className="quality-switch" onClick={onToggle}>
      <span className={`quality-option ${!isHd ? 'active' : ''}`}>SD</span>
      <div className={`quality-toggle ${isHd ? 'hd' : 'sd'}`}>
        <div className="quality-thumb" />
      </div>
      <span className={`quality-option ${isHd ? 'active' : ''}`}>HD</span>
    </div>
  )
}
