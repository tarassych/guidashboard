import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import config from './config'
import CameraFeed from './components/CameraFeed'
import LanguageSwitcher from './components/LanguageSwitcher'
import ShareInfoModal, { ShareButton } from './components/ShareInfoModal'
import FoxyLogo from './components/FoxyLogo'
import './Dashboard.css'

const API_BASE_URL = config.apiUrl

// Remote Control Icon - shows active (green), inactive (grey), or disconnected (red) state
// Priority: disconnected (red) > active (green) > inactive (grey)
// Inactive state is clickable to activate control
function JoystickIcon({ isActive, elrsConnected, onActivateClick }) {
  const { t } = useTranslation()
  // Determine state: disconnected takes priority over active/inactive
  const state = !elrsConnected ? 'disconnected' : (isActive ? 'active' : 'inactive')
  const isClickable = state === 'inactive'
  
  const handleClick = (e) => {
    if (isClickable && onActivateClick) {
      e.stopPropagation()
      onActivateClick()
    }
  }
  
  return (
    <div 
      className={`joystick-icon ${state} ${isClickable ? 'clickable' : ''}`}
      onClick={handleClick}
      title={isClickable ? t('control.activate') : undefined}
    >
      <svg viewBox="0 0 50 50" className="joystick-svg">
        {/* Signal waves from antenna */}
        <path className="signal-wave wave-1" d="M 22 8 Q 25 5, 28 8" />
        <path className="signal-wave wave-2" d="M 19 5 Q 25 0, 31 5" />
        <path className="signal-wave wave-3" d="M 16 2 Q 25 -5, 34 2" />
        
        {/* Antenna */}
        <line x1="25" y1="14" x2="25" y2="8" className="antenna" />
        <circle cx="25" cy="7" r="1.5" className="antenna-tip" />
        
        {/* Controller body */}
        <rect x="12" y="14" width="26" height="18" rx="3" className="controller-body" />
        
        {/* Left joystick */}
        <circle cx="19" cy="23" r="4" className="joystick-base-small" />
        <circle cx="19" cy="23" r="2" className="joystick-stick-left" />
        
        {/* Right joystick */}
        <circle cx="31" cy="23" r="4" className="joystick-base-small" />
        <circle cx="31" cy="23" r="2" className="joystick-stick-right" />
        
        {/* Center indicator */}
        <rect x="23" y="17" width="4" height="2" rx="1" className="controller-indicator" />
      </svg>
      {isClickable && <span className="joystick-tooltip">{t('control.activate')}</span>}
    </div>
  )
}

// Mini drone preview card with live telemetry and camera feed
function DroneCard({ 
  droneId, 
  profile, 
  telemetry, 
  isActive, 
  elrsConnected,
  droneNumber, 
  onClick, 
  onShare,
  onActivateClick
}) {
  const { t } = useTranslation()
  const isOnline = telemetry?.connected
  // Use front camera for dashboard preview
  const previewCameraUrl = profile?.frontCameraUrl
  // Display name if available, otherwise fall back to generic label (no IP in title)
  const displayName = profile?.name || ''
  
  const handleShare = (e) => {
    e.stopPropagation() // Prevent card click
    onShare()
  }
  
  return (
    <div 
      className={`drone-card ${isOnline ? 'online' : 'offline'} ${isActive ? 'active-control' : 'inactive-control'}`}
      onClick={onClick}
    >
      {/* Title bar */}
      <div className="drone-card-header">
        <span className="drone-title">
          {displayName || `Drone #${droneNumber}`}
        </span>
        <ShareButton onClick={handleShare} variant="card" />
        <span className={`drone-status ${isOnline ? 'online' : 'offline'}`}>
          {isOnline ? `● ${t('common.online')}` : `○ ${t('common.offline')}`}
        </span>
      </div>
      
      {/* Video with OSD overlay */}
      <div className="drone-card-video">
        {previewCameraUrl ? (
          <CameraFeed streamUrl={previewCameraUrl} variant="thumbnail" />
        ) : (
          <div className="no-camera">
            <span className="camera-icon">◇</span>
            <span>{t('dashboard.noCamera')}</span>
          </div>
        )}
        
        {/* Big drone number indicator - left center */}
        <div className="drone-number-overlay">
          <span className="drone-number">#{droneNumber}</span>
        </div>
        
        {/* OSD Elements overlaid on video */}
        <div className="card-osd-overlay">
          {/* Top row - Battery & Mode */}
          <div className="osd-top">
            <span className={`osd-battery ${telemetry?.batt_v >= 35 ? 'good' : telemetry?.batt_v >= 30 ? 'warn' : 'crit'}`}>
              ⚡ {telemetry?.batt_v?.toFixed(1) || '--'}V
            </span>
            <span className="osd-mode">{telemetry?.md_str || '--'}</span>
          </div>
          
          {/* Bottom row - Speed & GPS */}
          <div className="osd-bottom">
            <span className="osd-speed">{telemetry?.speed?.toFixed(0) || '--'} {t('osd.speedUnit')}</span>
            <span className="osd-gps">◎ {telemetry?.satellites || '--'}</span>
          </div>
        </div>
        
        {/* Hover hint */}
        <div className="preview-overlay">
          <span className="preview-hint">▶ {t('dashboard.fullScreen')}</span>
        </div>
        
        {/* Joystick icon - shows active/inactive/disconnected state */}
        <JoystickIcon isActive={isActive} elrsConnected={elrsConnected} onActivateClick={onActivateClick} />
      </div>
    </div>
  )
}

// Empty slot placeholder for unfilled drone positions
function EmptySlot({ slotNumber }) {
  const { t } = useTranslation()
  return (
    <div className="drone-card empty-slot">
      <div className="drone-card-header">
        <span className="drone-title">{t('dashboard.emptySlot')}</span>
      </div>
      <div className="drone-card-video">
        <div className="empty-slot-content">
          <span className="empty-slot-number">#{slotNumber}</span>
          <span className="empty-slot-hint">{t('dashboard.noDroneAssigned')}</span>
        </div>
        <div className="drone-number-overlay">
          <span className="drone-number">#{slotNumber}</span>
        </div>
      </div>
    </div>
  )
}

// Detected drone alert - drones with telemetry but no profile
function DetectedDroneAlert({ detectedDrones, onAddProfile }) {
  const { t } = useTranslation()
  if (!detectedDrones || detectedDrones.length === 0) return null
  
  return (
    <div className="detected-drone-alert">
      <div className="alert-icon"><FoxyLogo size={28} /></div>
      <div className="alert-content">
        <span className="alert-title">{t('dashboard.detectedDrones', { count: detectedDrones.length })}</span>
        <div className="alert-drone-list">
          {detectedDrones.map(drone => (
            <span key={drone.droneId} className="alert-drone-id">#{drone.droneId}</span>
          ))}
        </div>
      </div>
      <button className="alert-action" onClick={onAddProfile}>
        {t('dashboard.configureProfiles')}
      </button>
    </div>
  )
}

function Dashboard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [profiles, setProfiles] = useState({})
  const [droneIds, setDroneIds] = useState([])
  const [detectedDrones, setDetectedDrones] = useState([])
  const [droneTelemetry, setDroneTelemetry] = useState({})
  const [activeDrones, setActiveDrones] = useState({}) // Track which drones are actively controlled
  const [elrsConnected, setElrsConnected] = useState(true) // ELRS connection status
  const [loading, setLoading] = useState(true)
  const lastIdsRef = useRef({}) // Track last ID per drone
  
  // Share modal state
  const [shareModalDrone, setShareModalDrone] = useState(null) // { droneId, profile, droneNumber }
  
  // Activation modal state
  const [activateModalDrone, setActivateModalDrone] = useState(null) // droneId to activate
  const [activatePasskey, setActivatePasskey] = useState('')
  const [activateError, setActivateError] = useState(null)
  const [activateLoading, setActivateLoading] = useState(false)
  const [activating, setActivating] = useState(false) // Progress bar phase
  
  // Handle activation password submit
  const handleActivateSubmit = async (e) => {
    e.preventDefault()
    
    if (!activatePasskey.trim()) {
      setActivateError(t('auth.passkeyRequired'))
      return
    }
    
    setActivateLoading(true)
    setActivateError(null)
    
    try {
      // Step 1: Verify password
      const response = await fetch(`${API_BASE_URL}/api/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passkey: activatePasskey.trim() })
      })
      
      const data = await response.json()
      
      if (data.success) {
        console.log('[ACTIVATE] Password valid for drone:', activateModalDrone)
        setActivateLoading(false)
        setActivating(true) // Start progress bar phase
        
        // Step 2: Call activate endpoint to write droneId to /dev/shm/active
        try {
          await fetch(`${API_BASE_URL}/api/drones/activate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ droneId: activateModalDrone })
          })
        } catch (err) {
          console.error('Activate endpoint error:', err)
        }
        
        // Step 3: Wait for telemetry (min 1s, max 3s)
        const startTime = Date.now()
        const MIN_WAIT = 1000
        const MAX_WAIT = 5000
        const droneToActivate = activateModalDrone
        
        const checkActive = () => {
          return new Promise((resolve) => {
            const checkInterval = setInterval(async () => {
              const elapsed = Date.now() - startTime
              
              // Check if drone is now active
              const isNowActive = activeDrones[droneToActivate]?.active === true
              
              if (elapsed >= MIN_WAIT && isNowActive) {
                // Telemetry received and min time passed
                clearInterval(checkInterval)
                resolve(true)
              } else if (elapsed >= MAX_WAIT) {
                // Max time reached
                clearInterval(checkInterval)
                resolve(false)
              }
            }, 200) // Check every 200ms
          })
        }
        
        await checkActive()
        
        // Close modal and reset state
        setActivating(false)
        setActivateModalDrone(null)
        setActivatePasskey('')
        setActivateError(null)
      } else {
        setActivateError(t('auth.invalidPasskey'))
        setActivateLoading(false)
      }
    } catch (error) {
      console.error('Activation auth error:', error)
      setActivateError(t('auth.authError'))
      setActivateLoading(false)
    }
  }
  
  // Close activation modal (only if not in activating phase)
  const handleActivateModalClose = () => {
    if (activating) return // Don't close during activation
    setActivateModalDrone(null)
    setActivatePasskey('')
    setActivateError(null)
  }
  
  // Fetch profiles and drone list
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [profilesRes, dronesRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/profiles`),
          fetch(`${API_BASE_URL}/api/drones`)
        ])
        
        const profilesData = await profilesRes.json()
        const dronesData = await dronesRes.json()
        
        if (profilesData.success) {
          setProfiles(profilesData.profiles)
        }
        
        if (dronesData.success) {
          setDroneIds(dronesData.droneIds)
          setDetectedDrones(dronesData.detectedDrones || [])
        }
        
        setLoading(false)
      } catch (error) {
        console.error('Failed to fetch data:', error)
        setLoading(false)
      }
    }
    
    fetchData()
  }, [])
  
  // Poll telemetry for each drone
  useEffect(() => {
    if (droneIds.length === 0) return
    
    // Online timeout: 1 minute (60000ms) - drone is offline if no data received in this time
    const ONLINE_TIMEOUT_MS = 60000
    
    const controllers = {}
    let isMounted = true
    
    const fetchDroneTelemetry = async (droneId) => {
      if (controllers[droneId]) controllers[droneId].abort()
      controllers[droneId] = new AbortController()
      
      try {
        const lastId = lastIdsRef.current[droneId] || 0
        const url = `${API_BASE_URL}/api/telemetry?droneId=${droneId}&lastId=${lastId}&limit=10`
        const response = await fetch(url, { signal: controllers[droneId].signal })
        
        if (!response.ok) throw new Error('Failed to fetch')
        
        const data = await response.json()
        
        if (!isMounted) return
        
        if (data.success && data.records.length > 0) {
          lastIdsRef.current[droneId] = data.latestId
          
          // Process all records to build merged state
          setDroneTelemetry(prev => {
            const currentState = prev[droneId] || { connected: false }
            const updated = { ...currentState, connected: true, lastDataTime: Date.now() }
            
            // Process oldest to newest
            data.records.slice().reverse().forEach(record => {
              const recordData = record.data
              
              if (recordData.type === 'gps') {
                updated.latitude = recordData.latitude ?? updated.latitude
                updated.longitude = recordData.longitude ?? updated.longitude
                updated.groundspeed = recordData.groundspeed ?? updated.groundspeed
                updated.satellites = recordData.satellites ?? updated.satellites
              }
              
              if (recordData.type === 'batt') {
                updated.batt_v = recordData.batt_v ?? updated.batt_v
              }
              
              if (recordData.type === 'state') {
                updated.speed = recordData.speed ?? updated.speed
                updated.md_str = recordData.md_str ?? updated.md_str
              }
            })
            
            return { ...prev, [droneId]: updated }
          })
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          // On error, check if we should mark offline based on last data time
          setDroneTelemetry(prev => {
            const current = prev[droneId] || {}
            const lastData = current.lastDataTime || 0
            const isStale = Date.now() - lastData > ONLINE_TIMEOUT_MS
            return {
              ...prev,
              [droneId]: { ...current, connected: !isStale }
            }
          })
        }
      }
      
      // Also check for stale data (no new data in 1 minute = offline)
      setDroneTelemetry(prev => {
        const current = prev[droneId] || {}
        if (current.lastDataTime && Date.now() - current.lastDataTime > ONLINE_TIMEOUT_MS) {
          return { ...prev, [droneId]: { ...current, connected: false } }
        }
        return prev
      })
    }
    
    // Initial fetch for all drones
    droneIds.forEach(droneId => fetchDroneTelemetry(droneId))
    
    // Poll every 1000ms
    const interval = setInterval(() => {
      droneIds.forEach(droneId => fetchDroneTelemetry(droneId))
    }, 1000)
    
    return () => {
      isMounted = false
      Object.values(controllers).forEach(c => c.abort())
      clearInterval(interval)
    }
  }, [droneIds])
  
  // Poll active drone status
  useEffect(() => {
    let isMounted = true
    let controller = new AbortController()
    
    const fetchActiveStatus = async () => {
      controller.abort()
      controller = new AbortController()
      
      try {
        const response = await fetch(`${API_BASE_URL}/api/drones/active`, { signal: controller.signal })
        if (!response.ok) throw new Error('Failed to fetch')
        
        const data = await response.json()
        if (!isMounted) return
        
        if (data.success) {
          setActiveDrones(data.activeDrones)
        }
      } catch (error) {
        // Silently ignore errors for active status
      }
    }
    
    fetchActiveStatus()
    const interval = setInterval(fetchActiveStatus, 1000) // Poll every 1 second
    
    return () => {
      isMounted = false
      controller.abort()
      clearInterval(interval)
    }
  }, [])
  
  // Poll ELRS connection status every 3 seconds
  useEffect(() => {
    let isMounted = true
    let controller = new AbortController()
    
    const fetchElrsStatus = async () => {
      controller.abort()
      controller = new AbortController()
      
      try {
        const response = await fetch(`${API_BASE_URL}/api/elrs/status`, { signal: controller.signal })
        if (!response.ok) throw new Error('Failed to fetch')
        
        const data = await response.json()
        if (!isMounted) return
        
        setElrsConnected(data.connected)
      } catch (error) {
        if (error.name !== 'AbortError') {
          // On error, assume disconnected
          setElrsConnected(false)
        }
      }
    }
    
    fetchElrsStatus()
    const interval = setInterval(fetchElrsStatus, 3000) // Poll every 3 seconds
    
    return () => {
      isMounted = false
      controller.abort()
      clearInterval(interval)
    }
  }, [])
  
  const handleDroneClick = useCallback((droneId) => {
    navigate(`/drone/${droneId}`)
  }, [navigate])
  
  // Only show drones with profiles (connected drones)
  const connectedDroneIds = Object.keys(profiles)
  
  if (loading) {
    return (
      <div className="dashboard loading">
        <div className="loading-spinner">◌</div>
        <span>{t('dashboard.loadingDrones')}</span>
      </div>
    )
  }
  
  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-left">
          <FoxyLogo className="logo-icon" size={32} />
          <h1>{t('dashboard.title')}</h1>
        </div>
        <div className="header-right">
          <Link to="/settings" className="header-btn">
            ⚙ {t('nav.settings')}
          </Link>
          <LanguageSwitcher />
        </div>
      </header>
      
      {detectedDrones.length > 0 && (
        <DetectedDroneAlert 
          detectedDrones={detectedDrones} 
          onAddProfile={() => navigate('/settings')} 
        />
      )}
      
      <main className="dashboard-grid">
        {/* Always render exactly 6 slots */}
        {[1, 2, 3, 4, 5, 6].map(slotNumber => {
          // Find drone at this slot position (by _index)
          const droneEntry = Object.entries(profiles).find(
            ([, profile]) => (profile?._index ?? -1) + 1 === slotNumber
          )
          
          if (droneEntry) {
            const [droneId, profile] = droneEntry
            return (
              <DroneCard
                key={slotNumber}
                droneId={droneId}
                profile={profile}
                telemetry={droneTelemetry[droneId]}
                isActive={activeDrones[droneId]?.active === true}
                elrsConnected={elrsConnected}
                droneNumber={slotNumber}
                onClick={() => handleDroneClick(droneId)}
                onShare={() => setShareModalDrone({ droneId, profile, droneNumber: slotNumber })}
                onActivateClick={() => setActivateModalDrone(droneId)}
              />
            )
          }
          
          // Empty slot
          return (
            <EmptySlot 
              key={slotNumber} 
              slotNumber={slotNumber}
            />
          )
        })}
      </main>
      
      <footer className="dashboard-footer">
        <span className="footer-version">{t('osd.version')}</span>
        <span className="footer-text">
          {t('dashboard.dronesCount', { count: connectedDroneIds.length })} • 
          {t('dashboard.onlineCount', { count: Object.values(droneTelemetry).filter(tel => tel?.connected).length })}
        </span>
      </footer>
      
      {/* Share Info Modal */}
      {shareModalDrone && (
        <ShareInfoModal
          isOpen={true}
          onClose={() => setShareModalDrone(null)}
          droneInfo={{
            droneNumber: shareModalDrone.droneNumber,
            droneName: shareModalDrone.profile?.name,
            droneId: shareModalDrone.droneId,
            ipAddress: shareModalDrone.profile?.ipAddress,
            frontCameraUrl: shareModalDrone.profile?.frontCameraUrl,
            frontCameraUrlHd: shareModalDrone.profile?.frontCameraUrlHd,
            rearCameraUrl: shareModalDrone.profile?.rearCameraUrl,
            frontCameraRtsp: shareModalDrone.profile?.frontCamera?.rtspUrl,
            frontCameraRtspHd: shareModalDrone.profile?.frontCamera?.rtspPathHd ? 
              shareModalDrone.profile.frontCamera.rtspUrl?.replace(shareModalDrone.profile.frontCamera.rtspPath, shareModalDrone.profile.frontCamera.rtspPathHd) : null,
            rearCameraRtsp: shareModalDrone.profile?.rearCamera?.rtspUrl,
          }}
        />
      )}
      
      {/* Activation Password Modal */}
      {activateModalDrone && (
        <div className="modal-overlay activate-modal-overlay" onClick={handleActivateModalClose}>
          <div className="activate-modal" onClick={(e) => e.stopPropagation()}>
            {!activating ? (
              <>
                <div className="activate-modal-icon">🎮</div>
                <h2>{t('control.activateTitle')}</h2>
                <p className="activate-modal-subtitle">{t('control.activateSubtitle')}</p>
                
                <form className="activate-form" onSubmit={handleActivateSubmit}>
                  <div className="activate-input-group">
                    <input
                      type="password"
                      className="activate-input"
                      placeholder={t('auth.passkeyPlaceholder')}
                      value={activatePasskey}
                      onChange={(e) => setActivatePasskey(e.target.value)}
                      disabled={activateLoading}
                      autoFocus
                    />
                  </div>
                  
                  {activateError && (
                    <div className="activate-error">{activateError}</div>
                  )}
                  
                  <div className="activate-buttons">
                    <button 
                      type="button" 
                      className="activate-cancel-btn"
                      onClick={handleActivateModalClose}
                      disabled={activateLoading}
                    >
                      {t('common.cancel')}
                    </button>
                    <button 
                      type="submit" 
                      className={`activate-submit-btn ${activateLoading ? 'loading' : ''}`}
                      disabled={activateLoading || !activatePasskey.trim()}
                    >
                      {activateLoading ? t('auth.verifying') : t('control.activate')}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="activate-progress">
                <div className="activate-modal-icon">🎮</div>
                <h2>{t('control.activating')}</h2>
                <p className="activate-modal-subtitle">{t('control.waitingTelemetry')}</p>
                <div className="activate-progress-bar">
                  <div className="activate-progress-fill"></div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard

