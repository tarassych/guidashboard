/**
 * Warning Banner Component
 * Displayed when both fuses are armed
 */
import { useTranslation } from 'react-i18next'

export function WarningBanner() {
  const { t } = useTranslation()
  return (
    <div className="warning-banner">
      <div className="warning-chevrons left">
        <span>◀</span>
        <span>◀</span>
        <span>◀</span>
      </div>
      <div className="warning-center">
        <div className="warning-frame">
          <span className="warning-icon">⚠</span>
          <span className="warning-text">{t('osd.warning')}</span>
          <span className="warning-icon">⚠</span>
        </div>
        <div className="warning-subtext">{t('osd.armed')}</div>
      </div>
      <div className="warning-chevrons right">
        <span>▶</span>
        <span>▶</span>
        <span>▶</span>
      </div>
    </div>
  )
}
