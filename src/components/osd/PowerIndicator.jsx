/**
 * Power Indicator Component
 * Displays power level with visual bars
 */
import { useTranslation } from 'react-i18next'

export function PowerIndicator({ power }) {
  const { t } = useTranslation()
  
  const getLabel = () => {
    if (power <= 0) return t('power.min')
    if (power === 1) return t('power.mid')
    return t('power.max')
  }

  return (
    <div className="power-indicator">
      <div className="power-label">{t('osd.power')}</div>
      <div className="power-bars">
        <div className={`power-bar ${power >= 0 ? 'active green' : ''}`} />
        <div className={`power-bar ${power >= 1 ? 'active green' : ''}`} />
        <div className={`power-bar ${power >= 2 ? 'active orange' : ''}`} />
      </div>
      <div className={`power-mode level-${Math.min(power, 2)}`}>{getLabel()}</div>
    </div>
  )
}
