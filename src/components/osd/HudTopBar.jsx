/**
 * HUD Top Bar Component
 * Shared top bar with logo, status, and indicators
 */
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ShareButton } from '../ShareInfoModal'
import FoxyLogo from '../FoxyLogo'
import { BatteryIndicator } from './BatteryIndicator'

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
