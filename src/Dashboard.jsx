import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import config from './config'
import CameraFeed from './components/CameraFeed'
import './Dashboard.css'

const API_BASE_URL = config.apiUrl

// Mini drone preview card with live telemetry and camera feed
function DroneCard({ droneId, profile, telemetry, onClick }) {
  const isOnline = telemetry?.connected
  // Use front camera for dashboard preview
  const previewCameraUrl = profile?.frontCameraUrl
  const droneName = profile?.name || `Drone ${droneId}`
  
  return (
    <div 
      className={`drone-card ${isOnline ? 'online' : 'offline'}`}
      onClick={onClick}
    >
      {/* Title bar */}
      <div className="drone-card-header">
        <span className="drone-title">#{droneId} {droneName}</span>
        <span className={`drone-status ${isOnline ? 'online' : 'offline'}`}>
          {isOnline ? '● ONLINE' : '○ OFFLINE'}
        </span>
      </div>
      
      {/* Video with OSD overlay */}
      <div className="drone-card-video">
        {previewCameraUrl ? (
          <CameraFeed streamUrl={previewCameraUrl} variant="thumbnail" />
        ) : (
          <div className="no-camera">
            <span className="camera-icon">◇</span>
            <span>No camera</span>
          </div>
        )}
        
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
            <span className="osd-speed">{telemetry?.speed?.toFixed(0) || '--'} km/h</span>
            <span className="osd-gps">◎ {telemetry?.satellites || '--'}</span>
          </div>
        </div>
        
        {/* Hover hint */}
        <div className="preview-overlay">
          <span className="preview-hint">▶ FULL SCREEN</span>
        </div>
      </div>
    </div>
  )
}

// Unknown drone alert - lists ALL unknown drone IDs
function UnknownDroneAlert({ unknownDrones, onAddProfile }) {
  if (!unknownDrones || unknownDrones.length === 0) return null
  
  return (
    <div className="unknown-drone-alert">
      <div className="alert-icon">⚠</div>
      <div className="alert-content">
        <span className="alert-title">Unknown Drones in Database ({unknownDrones.length})</span>
        <div className="alert-drone-list">
          {unknownDrones.map(drone => (
            <span key={drone.droneId} className="alert-drone-id">#{drone.droneId}</span>
          ))}
        </div>
      </div>
      <button className="alert-action" onClick={onAddProfile}>
        Configure Profiles →
      </button>
    </div>
  )
}

function Dashboard() {
  const navigate = useNavigate()
  const [profiles, setProfiles] = useState({})
  const [droneIds, setDroneIds] = useState([])
  const [unknownDrones, setUnknownDrones] = useState([])
  const [droneTelemetry, setDroneTelemetry] = useState({})
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
          setUnknownDrones(dronesData.unknownDrones)
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
            const updated = { ...currentState, connected: true, timestamp: Date.now() }
            
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
          setDroneTelemetry(prev => ({
            ...prev,
            [droneId]: { ...prev[droneId], connected: false }
          }))
        }
      }
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
  
  const handleDroneClick = useCallback((droneId) => {
    navigate(`/drone/${droneId}`)
  }, [navigate])
  
  // Combine configured and unknown drones for display (keep as strings)
  const allDroneIds = [...new Set([...Object.keys(profiles), ...droneIds.map(String)])]
  
  if (loading) {
    return (
      <div className="dashboard loading">
        <div className="loading-spinner">◌</div>
        <span>Loading drones...</span>
      </div>
    )
  }
  
  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-left">
          <span className="logo-icon">◈</span>
          <h1>RATERA DRONE CONTROL CENTER</h1>
        </div>
        <div className="header-right">
          <Link to="/profiles" className="header-btn">
            ⚙ Manage Profiles
          </Link>
        </div>
      </header>
      
      {unknownDrones.length > 0 && (
        <UnknownDroneAlert 
          unknownDrones={unknownDrones} 
          onAddProfile={() => navigate('/profiles')} 
        />
      )}
      
      <main className="dashboard-grid">
        {allDroneIds.length === 0 ? (
          <div className="no-drones">
            <span className="no-drones-icon">◇</span>
            <h2>No Drones Detected</h2>
            <p>No telemetry data found in the database.</p>
            <Link to="/profiles" className="add-drone-btn">+ Add Drone Profile</Link>
          </div>
        ) : (
          allDroneIds.map(droneId => (
            <DroneCard
              key={droneId}
              droneId={droneId}
              profile={profiles[droneId]}
              telemetry={droneTelemetry[droneId]}
              onClick={() => handleDroneClick(droneId)}
            />
          ))
        )}
      </main>
      
      <footer className="dashboard-footer">
        <span className="footer-text">
          {allDroneIds.length} drone{allDroneIds.length !== 1 ? 's' : ''} • 
          {Object.values(droneTelemetry).filter(t => t?.connected).length} online
        </span>
      </footer>
    </div>
  )
}

export default Dashboard

