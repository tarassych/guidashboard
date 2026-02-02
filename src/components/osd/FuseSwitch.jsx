/**
 * Fuse Switch Indicator Component
 * Displays fuse arm/disarm status
 */
import { useTranslation } from 'react-i18next'

export function FuseSwitch({ label, armed }) {
  const { t } = useTranslation()
  return (
    <div className={`fuse-switch ${armed ? 'armed' : 'safe'}`}>
      <div className="fuse-label">{label}</div>
      <div className="fuse-icon">
        <div className="fuse-body">
          <div className={`fuse-element ${armed ? 'active' : ''}`}></div>
        </div>
      </div>
      <div className="fuse-status">{armed ? t('common.on') : t('common.off')}</div>
    </div>
  )
}
