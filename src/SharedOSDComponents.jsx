/**
 * Shared OSD Components
 * Components shared between GroundDroneOSD and FlyingDroneOSD
 */
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ShareButton } from './components/ShareInfoModal'
import FoxyLogo from './components/FoxyLogo'
import { DRONE_TYPES } from './telemetrySchemas'

// Ground Drone Icon (for type indicator)
function GroundDroneIcon({ size = 24, active = false }) {
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
function FpvDroneIcon({ size = 24, active = false }) {
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

// Battery Indicator (Voltage-based)
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

/**
 * HUD Top Bar Component
 * Shared top bar with logo, status, and indicators
 * @param {Object} telemetry - Telemetry data
 * @param {boolean} isActive - Whether drone is actively controlled
 * @param {Function} onShareClick - Share button click handler
 * @param {boolean} showFailsafe - Whether to show failsafe indicator (default: true for ground, false for FPV)
 */
export function HudTopBar({ 
  telemetry, 
  isActive, 
  onShareClick, 
  showFailsafe = true 
}) {
  const { t } = useTranslation()
  
  // Get mode string - handle both ground drone (md_str) and FPV (mode) formats
  const modeStr = telemetry.md_str || telemetry.mode || 'OFFLINE'
  
  return (
    <div className="hud-top-bar">
      <div className="hud-logo">
        <Link to="/" className="back-to-dashboard" title={t('nav.backToDashboard')}>←</Link>
        <ShareButton onClick={onShareClick} />
        <FoxyLogo className="logo-icon" size={28} />
        <span className="logo-text">{t('dashboard.title')}</span>
      </div>
      
      <div className="hud-status-center">
        <span className={`status-mode ${modeStr.toLowerCase().replace(/\s+/g, '-')}`}>
          {modeStr}
        </span>
        {!telemetry.connected && <span className="status-offline">{t('common.offline')}</span>}
        {isActive && <span className="status-active">{t('common.active')}</span>}
      </div>

      <div className="hud-right-indicators">
        {showFailsafe && (
          <span className={`status-fs ${telemetry.fs > 0 ? 'active' : ''}`}>
            FAILSAFE:{telemetry.fs || 0}
          </span>
        )}
        <BatteryIndicator voltage={telemetry.batt_v || 0} />
      </div>
    </div>
  )
}

// HUD Compass
export function HudCompass({ heading, direction }) {
  const { t } = useTranslation()
  return (
    <div className="hud-compass">
      <div className="compass-outer">
        <div className="compass-ring" style={{ transform: `rotate(${-heading}deg)` }}>
          <span className="compass-n">{t('compass.n')}</span>
          <span className="compass-e">{t('compass.e')}</span>
          <span className="compass-s">{t('compass.s')}</span>
          <span className="compass-w">{t('compass.w')}</span>
        </div>
        <div className="compass-pointer">▲</div>
      </div>
      <div className="compass-readout">
        <span className="compass-deg">{heading.toFixed(0)}°</span>
        <span className="compass-dir">{direction}</span>
      </div>
    </div>
  )
}

// Satellite Indicator
export function SatelliteIndicator({ satellites }) {
  const { t } = useTranslation()
  
  const getQuality = () => {
    if (satellites >= 10) return 'excellent'
    if (satellites >= 6) return 'good'
    if (satellites >= 4) return 'weak'
    return 'poor'
  }

  const isLow = satellites <= 3

  return (
    <div className="hud-satellites">
      <div className="sat-label"><span className="sat-icon">◎</span> {t('osd.satellites')}</div>
      <div className="sat-info">
        <span className={`sat-count ${getQuality()} ${isLow ? 'critical' : ''}`}>{satellites}</span>
        <span className="sat-quality">{t(`satellites.${getQuality()}`)}</span>
      </div>
    </div>
  )
}

// Quality Switch (SD/HD toggle)
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

/**
 * HUD Left Panel Component
 * Contains compass, drone name with type icon, satellites, and quality switch
 * @param {Object} props
 * @param {number} props.heading - Current heading in degrees
 * @param {string} props.direction - Cardinal direction string (N, NE, E, etc.)
 * @param {string} props.droneName - Name of the drone
 * @param {string} props.droneType - Type of drone (foxy or generic_fpv)
 * @param {number} props.satellites - Number of GPS satellites
 * @param {boolean} props.hasHdStream - Whether HD stream is available
 * @param {boolean} props.hdMode - Whether HD mode is enabled
 * @param {Function} props.onHdToggle - HD toggle callback
 */
export function HudLeftPanel({
  heading,
  direction,
  droneName,
  droneType,
  satellites,
  hasHdStream,
  hdMode,
  onHdToggle
}) {
  return (
    <div className="hud-left-panel">
      <div className="hud-compass-row">
        <HudCompass heading={heading} direction={direction} />
        <span className="hud-drone-name">
          {droneType === DRONE_TYPES.GENERIC_FPV ? (
            <FpvDroneIcon size={20} active={true} />
          ) : (
            <GroundDroneIcon size={20} active={true} />
          )}
          {droneName.toUpperCase()}
        </span>
      </div>
      <SatelliteIndicator satellites={satellites} />
      {hasHdStream && (
        <QualitySwitch isHd={hdMode} onToggle={onHdToggle} />
      )}
    </div>
  )
}
