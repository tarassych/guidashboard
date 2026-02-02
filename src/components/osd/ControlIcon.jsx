/**
 * Control Icon Component
 * Joystick/controller icon with connection and active states
 */
import { useTranslation } from 'react-i18next'

export function ControlIcon({ isActive, elrsConnected, onClick }) {
  const { t } = useTranslation()
  
  const className = `hud-active-control-icon ${!elrsConnected ? 'disconnected' : (isActive ? 'active' : 'inactive')} ${elrsConnected && !isActive ? 'clickable' : ''}`
  
  return (
    <div 
      className={className}
      onClick={onClick}
      title={elrsConnected && !isActive ? t('control.activate') : undefined}
    >
      <svg viewBox="0 0 50 50" className="active-control-svg">
        <path className="signal-wave wave-1" d="M 22 8 Q 25 5, 28 8" />
        <path className="signal-wave wave-2" d="M 19 5 Q 25 0, 31 5" />
        <path className="signal-wave wave-3" d="M 16 2 Q 25 -5, 34 2" />
        <line x1="25" y1="14" x2="25" y2="8" className="antenna" />
        <circle cx="25" cy="7" r="1.5" className="antenna-tip" />
        <rect x="12" y="14" width="26" height="18" rx="3" className="controller-body" />
        <circle cx="19" cy="23" r="4" className="joystick-base-small" />
        <circle cx="19" cy="23" r="2" className="joystick-stick-left" />
        <circle cx="31" cy="23" r="4" className="joystick-base-small" />
        <circle cx="31" cy="23" r="2" className="joystick-stick-right" />
        <rect x="23" y="17" width="4" height="2" rx="1" className="controller-indicator" />
      </svg>
      {elrsConnected && !isActive && <span className="control-tooltip">{t('control.activate')}</span>}
    </div>
  )
}
