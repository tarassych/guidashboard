import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import config from './config'
import CameraFeed from './components/CameraFeed'
import LanguageSwitcher from './components/LanguageSwitcher'
import './Dashboard.css'

const API_BASE_URL = config.apiUrl

// Animated Remote Control Icon for active drone
function JoystickIcon() {
  return (
    <div className="joystick-icon">
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
    </div>
  )
}

// Mini drone preview card with live telemetry and camera feed
function DroneCard({ droneId, profile, telemetry, isActive, droneNumber, onClick }) {
  const { t } = useTranslation()
  const isOnline = telemetry?.connected
  // Use front camera for dashboard preview
  const previewCameraUrl = profile?.frontCameraUrl
  // Display name if available, otherwise fall back to generic label (no IP in title)
  const displayName = profile?.name || ''
  
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
        
        {/* Joystick icon for active drone */}
        {isActive && <JoystickIcon />}
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
      <div className="alert-icon">◈</div>
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
  const [loading, setLoading] = useState(true)
  const lastIdsRef = useRef({}) // Track last ID per drone
  
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
    
    // Poll every 500ms
    const interval = setInterval(() => {
      droneIds.forEach(droneId => fetchDroneTelemetry(droneId))
    }, 500)
    
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
    const interval = setInterval(fetchActiveStatus, 300) // Poll frequently for responsive UI
    
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
          <span className="logo-icon">◈</span>
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
                droneNumber={slotNumber}
                onClick={() => handleDroneClick(droneId)}
              />
            )
          }
          
          // Empty slot
          return <EmptySlot key={slotNumber} slotNumber={slotNumber} />
        })}
      </main>
      
      <footer className="dashboard-footer">
        <span className="footer-text">
          {t('dashboard.dronesCount', { count: connectedDroneIds.length })} • 
          {t('dashboard.onlineCount', { count: Object.values(droneTelemetry).filter(tel => tel?.connected).length })}
        </span>
      </footer>
    </div>
  )
}

export default Dashboard

