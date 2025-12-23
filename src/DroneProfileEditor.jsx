import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api'
import config from './config'
import './DroneProfileEditor.css'

const API_BASE_URL = config.apiUrl

// Dark map style for mini maps
const miniMapStyles = [
  { elementType: "geometry", stylers: [{ color: "#1a1a1a" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a1a1a" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#4a5a6a" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2a2a2a" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0a1520" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
]

// Mini map component for showing drone position
function DroneLocationMap({ latitude, longitude }) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: config.googleMapsApiKey
  })
  
  if (!isLoaded) {
    return <div className="mini-map-loading">Loading map...</div>
  }
  
  if (!latitude || !longitude) {
    return <div className="mini-map-no-data">No GPS data</div>
  }
  
  return (
    <GoogleMap
      mapContainerClassName="mini-map"
      center={{ lat: latitude, lng: longitude }}
      zoom={14}
      options={{
        styles: miniMapStyles,
        disableDefaultUI: true,
        zoomControl: false,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      }}
    >
      <Marker
        position={{ lat: latitude, lng: longitude }}
        icon={{
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#ffaa00',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2,
        }}
      />
    </GoogleMap>
  )
}

// Default profile template
const defaultProfile = {
  name: '',
  frontCameraUrl: '',
  rearCameraUrl: '',
  color: '#00ff88'
}

function ProfileForm({ droneId, profile, onSave, onCancel, onDelete }) {
  const [formData, setFormData] = useState({
    ...defaultProfile,
    ...profile
  })
  const [saving, setSaving] = useState(false)
  
  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave(droneId, formData)
    } finally {
      setSaving(false)
    }
  }
  
  return (
    <form className="profile-form" onSubmit={handleSubmit}>
      <div className="form-header">
        <h3>Drone #{droneId} Profile</h3>
        {profile && (
          <button 
            type="button" 
            className="delete-btn"
            onClick={() => onDelete(droneId)}
          >
            ✕ Delete
          </button>
        )}
      </div>
      
      <div className="form-group">
        <label htmlFor={`name-${droneId}`}>Drone Name</label>
        <input
          id={`name-${droneId}`}
          name="name"
          type="text"
          value={formData.name}
          onChange={handleChange}
          placeholder={`Drone ${droneId}`}
        />
      </div>
      
      <div className="form-group">
        <label htmlFor={`frontCamera-${droneId}`}>Front Camera URL (HLS)</label>
        <input
          id={`frontCamera-${droneId}`}
          name="frontCameraUrl"
          type="text"
          value={formData.frontCameraUrl}
          onChange={handleChange}
          placeholder="http://192.168.88.15:8888/cam1/index.m3u8"
        />
        <span className="form-hint">HLS stream URL for main camera view</span>
      </div>
      
      <div className="form-group">
        <label htmlFor={`rearCamera-${droneId}`}>Rear Camera URL (HLS)</label>
        <input
          id={`rearCamera-${droneId}`}
          name="rearCameraUrl"
          type="text"
          value={formData.rearCameraUrl}
          onChange={handleChange}
          placeholder="http://192.168.88.15:8888/cam2/index.m3u8"
        />
        <span className="form-hint">HLS stream URL for rear view mirror</span>
      </div>
      
      <div className="form-group">
        <label htmlFor={`color-${droneId}`}>Accent Color</label>
        <div className="color-input-row">
          <input
            id={`color-${droneId}`}
            name="color"
            type="color"
            value={formData.color}
            onChange={handleChange}
          />
          <input
            type="text"
            value={formData.color}
            onChange={handleChange}
            name="color"
            className="color-text"
          />
        </div>
      </div>
      
      <div className="form-actions">
        <button type="button" className="cancel-btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="save-btn" disabled={saving}>
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </div>
    </form>
  )
}

function DroneProfileEditor() {
  const navigate = useNavigate()
  const [profiles, setProfiles] = useState({})
  const [droneIds, setDroneIds] = useState([])
  const [unknownDrones, setUnknownDrones] = useState([]) // Now contains objects with GPS data
  const [loading, setLoading] = useState(true)
  const [editingDrone, setEditingDrone] = useState(null)
  const [showNewForm, setShowNewForm] = useState(false)
  
  // Discovery state
  const [discoveredDrones, setDiscoveredDrones] = useState([])
  const [isDiscovering, setIsDiscovering] = useState(false)
  const [discoverError, setDiscoverError] = useState(null)
  
  // Pairing state (keyed by drone IP)
  const [pairingStatus, setPairingStatus] = useState({}) // { ip: { status: 'pairing'|'checking'|'success'|'failed', message: '' } }
  
  // Fetch data
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
  
  const handleSaveProfile = async (droneId, profileData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/profiles/${droneId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData)
      })
      
      const data = await response.json()
      
      if (data.success) {
        setProfiles(prev => ({
          ...prev,
          [droneId]: data.profile
        }))
        setEditingDrone(null)
        setShowNewForm(false)
        // Remove from unknown drones if it was there (unknownDrones is now array of objects)
        setUnknownDrones(prev => prev.filter(d => String(d.droneId) !== String(droneId)))
      }
    } catch (error) {
      console.error('Failed to save profile:', error)
    }
  }
  
  const handleDeleteProfile = async (droneId) => {
    if (!confirm(`Delete profile for Drone #${droneId}?`)) return
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/profiles/${droneId}`, {
        method: 'DELETE'
      })
      
      const data = await response.json()
      
      if (data.success) {
        setProfiles(prev => {
          const updated = { ...prev }
          delete updated[droneId]
          return updated
        })
        setEditingDrone(null)
        setShowNewForm(false)
        // Refresh data to get updated unknown drones list
        window.location.reload()
      }
    } catch (error) {
      console.error('Failed to delete profile:', error)
    }
  }
  
  // Discover drones on network
  const handleDiscover = async () => {
    setIsDiscovering(true)
    setDiscoverError(null)
    setDiscoveredDrones([])
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/discover`)
      const data = await response.json()
      
      if (data.success) {
        // Filter out drones that already have telemetry (are in unknownDrones)
        const unknownIds = unknownDrones.map(d => String(d.droneId))
        const configuredIds = Object.keys(profiles)
        const newDrones = data.drones.filter(d => 
          !unknownIds.includes(String(d.drone_id)) && 
          !configuredIds.includes(String(d.drone_id))
        )
        setDiscoveredDrones(newDrones)
      } else {
        setDiscoverError(data.error || 'Discovery failed')
      }
    } catch (error) {
      console.error('Failed to discover:', error)
      setDiscoverError(error.message)
    } finally {
      setIsDiscovering(false)
    }
  }
  
  // Pair with a discovered drone
  const handlePair = async (drone) => {
    const { ip, drone_id } = drone
    
    // Set pairing status
    setPairingStatus(prev => ({
      ...prev,
      [ip]: { status: 'pairing', message: 'Initiating pairing...' }
    }))
    
    try {
      // Call pair API
      const pairResponse = await fetch(`${API_BASE_URL}/api/pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip, droneId: drone_id })
      })
      
      const pairData = await pairResponse.json()
      
      if (!pairData.success || !pairData.result) {
        setPairingStatus(prev => ({
          ...prev,
          [ip]: { status: 'failed', message: 'Pairing command failed' }
        }))
        return
      }
      
      // Update status to checking
      setPairingStatus(prev => ({
        ...prev,
        [ip]: { status: 'checking', message: 'Waiting for telemetry...' }
      }))
      
      // Wait at least 10 seconds, then check for telemetry
      await new Promise(resolve => setTimeout(resolve, 10000))
      
      // Check if telemetry appeared
      const telemetryResponse = await fetch(`${API_BASE_URL}/api/drone/${drone_id}/has-telemetry`)
      const telemetryData = await telemetryResponse.json()
      
      if (telemetryData.success && telemetryData.hasTelemetry) {
        // Success! Move drone to unknown drones
        setPairingStatus(prev => ({
          ...prev,
          [ip]: { status: 'success', message: 'Drone paired successfully!' }
        }))
        
        // Add to unknown drones list (it now has telemetry)
        setUnknownDrones(prev => [
          ...prev,
          {
            droneId: String(drone_id),
            latitude: null,
            longitude: null,
            lastSeen: new Date().toISOString()
          }
        ])
        
        // Remove from discovered drones
        setDiscoveredDrones(prev => prev.filter(d => d.ip !== ip))
        
        // Clear success status after a moment
        setTimeout(() => {
          setPairingStatus(prev => {
            const updated = { ...prev }
            delete updated[ip]
            return updated
          })
        }, 3000)
      } else {
        // No telemetry found
        setPairingStatus(prev => ({
          ...prev,
          [ip]: { status: 'failed', message: 'No telemetry received. Try again.' }
        }))
      }
    } catch (error) {
      console.error('Pairing error:', error)
      setPairingStatus(prev => ({
        ...prev,
        [ip]: { status: 'failed', message: error.message }
      }))
    }
  }
  
  if (loading) {
    return (
      <div className="profile-editor loading">
        <div className="loading-spinner">◌</div>
        <span>Loading profiles...</span>
      </div>
    )
  }
  
  const configuredDroneIds = Object.keys(profiles).sort((a, b) => String(a).localeCompare(String(b)))
  
  return (
    <div className="profile-editor">
      <header className="editor-header">
        <div className="header-left">
          <Link to="/" className="back-btn">← Back to Dashboard</Link>
          <h1>Drone Profile Manager</h1>
        </div>
      </header>
      
      {/* Discover Drones Section */}
      <section className="discover-section">
        <div className="discover-header">
          <div className="discover-title">
            <h2>🔍 Discover Drones</h2>
            <p>Scan the network for new drones to pair</p>
          </div>
          <button 
            className={`discover-btn ${isDiscovering ? 'discovering' : ''}`}
            onClick={handleDiscover}
            disabled={isDiscovering}
          >
            {isDiscovering ? (
              <>
                <span className="discover-spinner">◌</span>
                Scanning...
              </>
            ) : (
              'Discover Drones'
            )}
          </button>
        </div>
        
        {discoverError && (
          <div className="discover-error">
            ⚠ {discoverError}
          </div>
        )}
        
        {discoveredDrones.length > 0 && (
          <div className="discovered-drones-grid">
            {discoveredDrones.map(drone => {
              const status = pairingStatus[drone.ip]
              const isPairing = status?.status === 'pairing' || status?.status === 'checking'
              const isSuccess = status?.status === 'success'
              const isFailed = status?.status === 'failed'
              
              return (
                <div key={drone.ip} className={`discovered-drone-card ${status?.status || ''}`}>
                  <div className="discovered-drone-header">
                    <span className="drone-id-badge">ID: {drone.drone_id}</span>
                    <span className="drone-method">{drone.method.toUpperCase()}</span>
                  </div>
                  
                  <div className="discovered-drone-details">
                    <div className="detail-row">
                      <span className="detail-label">IP:</span>
                      <span className="detail-value">{drone.ip}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">MAC:</span>
                      <span className="detail-value">{drone.mac}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Target:</span>
                      <span className="detail-value">{drone.target_ip}</span>
                    </div>
                  </div>
                  
                  {status?.message && (
                    <div className={`pairing-message ${status.status}`}>
                      {isPairing && <span className="pairing-spinner">◌</span>}
                      {isSuccess && <span className="success-icon">✓</span>}
                      {isFailed && <span className="failed-icon">✕</span>}
                      {status.message}
                    </div>
                  )}
                  
                  <div className="discovered-drone-actions">
                    <button
                      className={`pair-btn ${isPairing ? 'pairing' : ''} ${isSuccess ? 'success' : ''}`}
                      onClick={() => handlePair(drone)}
                      disabled={isPairing || isSuccess}
                    >
                      {isPairing ? 'Pairing...' : isSuccess ? 'Paired!' : 'Pair'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        
        {!isDiscovering && discoveredDrones.length === 0 && !discoverError && (
          <div className="discover-empty">
            <span className="empty-icon">📡</span>
            <span>Click "Discover Drones" to scan for available drones on the network</span>
          </div>
        )}
      </section>
      
      {/* Unknown drones section - with maps */}
      {unknownDrones.length > 0 && (
        <section className="unknown-section">
          <h2>⚠ Unknown Drones Detected ({unknownDrones.length})</h2>
          <p>These drones have GPS telemetry data but no profile configured. Click to add a profile.</p>
          <div className="unknown-drones-grid">
            {unknownDrones.map(drone => (
              <div
                key={drone.droneId}
                className="unknown-drone-card"
                onClick={() => {
                  setEditingDrone(drone.droneId)
                  setShowNewForm(true)
                }}
              >
                <div className="unknown-drone-header">
                  <span className="drone-id-badge">ID: {drone.droneId}</span>
                  <span className="add-profile-hint">+ Add Profile</span>
                </div>
                <div className="unknown-drone-map">
                  <DroneLocationMap 
                    latitude={drone.latitude} 
                    longitude={drone.longitude} 
                  />
                </div>
                <div className="unknown-drone-info">
                  {drone.latitude && drone.longitude ? (
                    <span className="coords">
                      {drone.latitude.toFixed(5)}, {drone.longitude.toFixed(5)}
                    </span>
                  ) : (
                    <span className="no-coords">No GPS coordinates</span>
                  )}
                  {drone.lastSeen && (
                    <span className="last-seen">
                      Last seen: {new Date(drone.lastSeen).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      
      {/* New/Edit form modal */}
      {(editingDrone !== null && showNewForm) && (
        <div className="modal-overlay" onClick={() => { setShowNewForm(false); setEditingDrone(null); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <ProfileForm
              droneId={editingDrone}
              profile={profiles[editingDrone]}
              onSave={handleSaveProfile}
              onCancel={() => { setShowNewForm(false); setEditingDrone(null); }}
              onDelete={handleDeleteProfile}
            />
          </div>
        </div>
      )}
      
      {/* Existing profiles */}
      <section className="profiles-section">
        <h2>Configured Drones ({configuredDroneIds.length})</h2>
        
        {configuredDroneIds.length === 0 ? (
          <div className="no-profiles">
            <p>No drone profiles configured yet.</p>
          </div>
        ) : (
          <div className="profiles-grid">
            {configuredDroneIds.map(droneId => {
              const profile = profiles[droneId]
              return (
                <div
                  key={droneId}
                  className="profile-card"
                  style={{ '--accent-color': profile.color }}
                >
                  <div className="profile-card-header">
                    <span className="profile-id">#{droneId}</span>
                    <span className="profile-name">{profile.name || `Drone ${droneId}`}</span>
                    <button 
                      className="edit-btn"
                      onClick={() => { setEditingDrone(droneId); setShowNewForm(true); }}
                    >
                      Edit
                    </button>
                  </div>
                  
                  <div className="profile-details">
                    <div className="detail-row">
                      <span className="detail-label">Front Camera:</span>
                      <span className="detail-value">
                        {profile.frontCameraUrl || <em>Not set</em>}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Rear Camera:</span>
                      <span className="detail-value">
                        {profile.rearCameraUrl || <em>Not set</em>}
                      </span>
                    </div>
                  </div>
                  
                  <div className="profile-actions">
                    <Link 
                      to={`/drone/${droneId}`} 
                      className="view-osd-btn"
                    >
                      Open →
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

export default DroneProfileEditor

