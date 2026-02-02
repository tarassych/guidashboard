/**
 * Telemetry Strip Component
 * Collapsible bottom telemetry data display
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export function TelemetryStrip({ telemetry }) {
  const { t } = useTranslation()
  const [isCollapsed, setIsCollapsed] = useState(true)
  
  const formatClock = (timestamp) => {
    if (!timestamp) return '--:--:--'
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit'
    })
  }

  return (
    <div className={`telemetry-strip ${isCollapsed ? 'collapsed' : ''}`}>
      <button 
        className="telem-toggle"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        {isCollapsed ? `▲ ${t('osd.telemetry')}` : `▼ ${t('osd.telemetry')}`}
      </button>
      
      {!isCollapsed && (
        <div className="telem-content">
          <div className="telem-item">
            <span className="telem-label">{t('telemetry.lat')}</span>
            <span className="telem-value">{telemetry.latitude ? telemetry.latitude.toFixed(6) : '-.------'}°</span>
          </div>
          <div className="telem-item">
            <span className="telem-label">{t('telemetry.lng')}</span>
            <span className="telem-value">{telemetry.longitude ? telemetry.longitude.toFixed(6) : '-.------'}°</span>
          </div>
          <div className="telem-item">
            <span className="telem-label">{t('telemetry.alt')}</span>
            <span className="telem-value">{telemetry.altitude.toFixed(0)}m</span>
          </div>
          <div className="telem-item">
            <span className="telem-label">{t('telemetry.hdg')}</span>
            <span className="telem-value">{telemetry.heading.toFixed(0)}°</span>
          </div>
          <div className="telem-item">
            <span className="telem-label">{t('telemetry.gs')}</span>
            <span className="telem-value">{telemetry.groundspeed.toFixed(1)}</span>
          </div>
          <div className="telem-item">
            <span className="telem-label">{t('telemetry.spd')}</span>
            <span className="telem-value">{telemetry.speed.toFixed(1)}</span>
          </div>
          <div className="telem-item">
            <span className="telem-label">{t('telemetry.dist')}</span>
            <span className="telem-value">{telemetry.dist.toFixed(0)}m</span>
          </div>
          <div className="telem-item">
            <span className="telem-label">{t('telemetry.bat')}</span>
            <span className="telem-value">{telemetry.batt_v.toFixed(1)}V</span>
          </div>
          <div className="telem-item">
            <span className="telem-label">{t('telemetry.sat')}</span>
            <span className="telem-value">{telemetry.satellites}</span>
          </div>
          <div className="telem-item">
            <span className="telem-label">{t('telemetry.mode')}</span>
            <span className="telem-value">{telemetry.md_str}</span>
          </div>
          <div className="telem-item">
            <span className="telem-label">{t('telemetry.time')}</span>
            <span className="telem-value">{formatClock(telemetry.telemetry_time)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
