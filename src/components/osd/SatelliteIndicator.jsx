/**
 * Satellite Indicator Component
 * Displays GPS satellite count with signal quality
 */
import { useTranslation } from 'react-i18next'

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
