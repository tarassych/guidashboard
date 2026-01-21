import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import './ShareInfoModal.css'

// TV/Monitor icon SVG
const MonitorIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
)

function ShareInfoModal({ isOpen, onClose, droneInfo }) {
  const { t } = useTranslation()
  const [copiedField, setCopiedField] = useState(null)

  if (!isOpen || !droneInfo) return null

  const {
    droneNumber,
    droneName,
    droneId,
    ipAddress,
    frontCameraUrl,
    frontCameraUrlHd,
    rearCameraUrl,
    // RTSP paths from profile
    frontCameraRtsp,
    frontCameraRtspHd,
    rearCameraRtsp,
  } = droneInfo

  const baseUrl = window.location.origin

  // Display name for heading
  const displayName = droneName || `Drone #${droneNumber}`

  const infoFields = [
    { key: 'id', label: t('share.droneId'), value: droneId || '—' },
    { key: 'ip', label: t('share.ipAddress'), value: ipAddress || '—' },
    { key: 'frontWebrtc', label: t('share.frontCameraWebrtc'), value: frontCameraUrl ? `${baseUrl}${frontCameraUrl}` : '—' },
    { key: 'frontWebrtcHd', label: t('share.frontCameraWebrtcHd'), value: frontCameraUrlHd ? `${baseUrl}${frontCameraUrlHd}` : '—', hidden: !frontCameraUrlHd },
    { key: 'frontRtsp', label: t('share.frontCameraRtsp'), value: frontCameraRtsp || '—' },
    { key: 'frontRtspHd', label: t('share.frontCameraRtspHd'), value: frontCameraRtspHd || '—', hidden: !frontCameraRtspHd },
    { key: 'rearWebrtc', label: t('share.rearCameraWebrtc'), value: rearCameraUrl ? `${baseUrl}${rearCameraUrl}` : '—' },
    { key: 'rearRtsp', label: t('share.rearCameraRtsp'), value: rearCameraRtsp || '—' },
  ].filter(f => !f.hidden)

  const copyToClipboard = async (text) => {
    // Try modern clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text)
        return true
      } catch (err) {
        console.warn('Clipboard API failed, trying fallback:', err)
      }
    }
    
    // Fallback: create temporary textarea
    try {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.left = '-9999px'
      textarea.style.top = '-9999px'
      document.body.appendChild(textarea)
      textarea.focus()
      textarea.select()
      const success = document.execCommand('copy')
      document.body.removeChild(textarea)
      return success
    } catch (err) {
      console.error('Fallback copy failed:', err)
      return false
    }
  }

  const handleFieldClick = async (key, value) => {
    if (value === '—') return
    const success = await copyToClipboard(value)
    if (success) {
      setCopiedField(key)
      setTimeout(() => setCopiedField(null), 1500)
    }
  }

  return (
    <div className="share-modal-overlay" onClick={onClose}>
      <div className="share-modal" onClick={e => e.stopPropagation()}>
        <div className="share-modal-header">
          <div className="share-modal-icon">
            <MonitorIcon />
          </div>
          <h2>{displayName}</h2>
          <button className="share-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="share-modal-content">
          {infoFields.map(field => (
            <div key={field.key} className="share-info-row">
              <span className="share-info-label">{field.label}</span>
              <div 
                className={`share-info-value-wrapper ${field.value === '—' ? 'empty' : 'copyable'}`}
                onClick={() => handleFieldClick(field.key, field.value)}
              >
                <input
                  type="text"
                  className="share-info-input"
                  value={field.value}
                  readOnly
                  onFocus={(e) => {
                    e.target.select()
                    handleFieldClick(field.key, field.value)
                  }}
                />
                {copiedField === field.key && (
                  <span className="copied-notice">{t('share.copied')}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Share Button Component for reuse
export function ShareButton({ onClick, variant = 'default' }) {
  const { t } = useTranslation()
  return (
    <button 
      className={`share-btn share-btn-${variant}`} 
      onClick={onClick}
      title={t('share.title')}
    >
      <MonitorIcon />
    </button>
  )
}

export default ShareInfoModal
