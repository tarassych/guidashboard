import { useState, useEffect, useRef } from 'react'
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
  
  // Terminal logs - array of { type, command, stdout, stderr, error, timestamp, result }
  const [terminalLogs, setTerminalLogs] = useState([])
  const terminalRef = useRef(null)
  
  // Pairing state (keyed by drone IP)
  const [pairingStatus, setPairingStatus] = useState({}) // { ip: { status: 'pairing'|'checking'|'success'|'failed', message: '' } }
  
  // Auto-scroll terminal to bottom when logs change
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [terminalLogs])
  
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
  
  // Add a log entry to terminal
  const addTerminalLog = (log) => {
    setTerminalLogs(prev => [...prev, { ...log, timestamp: Date.now() }])
  }
  
  // Discover drones on network
  const handleDiscover = async () => {
    setIsDiscovering(true)
    setDiscoverError(null)
    setDiscoveredDrones([])
    
    // Add "running" log
    addTerminalLog({
      type: 'discover',
      status: 'running',
      command: 'discover.sh'
    })
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/discover`)
      const data = await response.json()
      
      // Add result log
      addTerminalLog({
        type: 'discover',
        status: data.success ? 'success' : 'error',
        command: data.command || 'discover.sh',
        stdout: data.stdout || '',
        stderr: data.stderr || '',
        parseError: data.parseError || null,
        error: data.error || null,
        dronesFound: (data.drones || []).length
      })
      
      if (data.success || data.drones) {
        const drones = data.drones || []
        setDiscoveredDrones(drones)
        
        if (!data.success) {
          setDiscoverError(data.error || 'Discovery completed with errors')
        }
      } else {
        setDiscoverError(data.error || 'Discovery failed')
      }
    } catch (error) {
      console.error('Failed to discover:', error)
      setDiscoverError(error.message)
      addTerminalLog({
        type: 'discover',
        status: 'error',
        command: 'discover.sh',
        error: error.message
      })
    } finally {
      setIsDiscovering(false)
    }
  }
  
  // Pair with a discovered drone
  const handlePair = async (drone) => {
    const { ip, drone_id } = drone
    const pairCommand = `pair.sh ${ip} ${drone_id}`
    
    // Set pairing status
    setPairingStatus(prev => ({
      ...prev,
      [ip]: { status: 'pairing', message: 'Initiating pairing...' }
    }))
    
    // Add "running" log
    addTerminalLog({
      type: 'pair',
      status: 'running',
      command: pairCommand,
      droneId: drone_id,
      ip
    })
    
    try {
      // Call pair API
      const pairResponse = await fetch(`${API_BASE_URL}/api/pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip, droneId: drone_id })
      })
      
      const pairData = await pairResponse.json()
      
      // Add pair result log
      addTerminalLog({
        type: 'pair',
        status: pairData.success ? 'success' : 'error',
        command: pairData.command || pairCommand,
        stdout: pairData.stdout || '',
        stderr: pairData.stderr || '',
        error: pairData.error || null,
        result: pairData.result,
        droneId: drone_id,
        ip
      })
      
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
      
      // Add waiting log
      addTerminalLog({
        type: 'info',
        message: `Waiting 10 seconds for telemetry from drone ${drone_id}...`
      })
      
      // Wait at least 10 seconds, then check for telemetry
      await new Promise(resolve => setTimeout(resolve, 10000))
      
      // Check if telemetry appeared
      const telemetryResponse = await fetch(`${API_BASE_URL}/api/drone/${drone_id}/has-telemetry`)
      const telemetryData = await telemetryResponse.json()
      
      // Add telemetry check result log
      addTerminalLog({
        type: 'telemetry-check',
        status: telemetryData.hasTelemetry ? 'success' : 'failed',
        droneId: drone_id,
        hasTelemetry: telemetryData.hasTelemetry
      })
      
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
      addTerminalLog({
        type: 'pair',
        status: 'error',
        command: pairCommand,
        error: error.message,
        droneId: drone_id,
        ip
      })
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
        
        {/* Terminal Output Display */}
        {terminalLogs.length > 0 && (
          <div className="terminal-output">
            <div className="terminal-header">
              <span className="terminal-title">📟 Terminal Output</span>
              <button 
                className="terminal-clear-btn"
                onClick={() => setTerminalLogs([])}
              >
                Clear
              </button>
            </div>
            <div className="terminal-body" ref={terminalRef}>
              {terminalLogs.map((log, idx) => (
                <div key={idx} className={`terminal-entry ${log.type} ${log.status}`}>
                  {/* Command line */}
                  {log.command && (
                    <div className="terminal-command-line">
                      <span className="prompt">$</span>
                      <span className="command">{log.command}</span>
                      {log.status === 'running' && <span className="discover-spinner">◌</span>}
                    </div>
                  )}
                  
                  {/* Info message */}
                  {log.type === 'info' && (
                    <div className="terminal-info">{log.message}</div>
                  )}
                  
                  {/* Stdout */}
                  {log.stdout && (
                    <div className="terminal-section">
                      <pre className="terminal-content">{log.stdout}</pre>
                    </div>
                  )}
                  
                  {/* Stderr */}
                  {log.stderr && (
                    <div className="terminal-section stderr">
                      <div className="terminal-label">stderr:</div>
                      <pre className="terminal-content">{log.stderr}</pre>
                    </div>
                  )}
                  
                  {/* Parse Error */}
                  {log.parseError && (
                    <div className="terminal-section warning">
                      <div className="terminal-label">⚠ Parse Warning:</div>
                      <pre className="terminal-content">{log.parseError}</pre>
                    </div>
                  )}
                  
                  {/* Error */}
                  {log.error && (
                    <div className="terminal-section error">
                      <div className="terminal-label">✕ Error:</div>
                      <pre className="terminal-content">{log.error}</pre>
                    </div>
                  )}
                  
                  {/* Result summary for discover */}
                  {log.type === 'discover' && log.status !== 'running' && (
                    <div className="terminal-result">
                      {log.dronesFound > 0 ? (
                        <span className="result-success">✓ Found {log.dronesFound} drone(s) on network</span>
                      ) : log.error ? (
                        <span className="result-error">✕ Discovery failed</span>
                      ) : (
                        <span className="result-empty">○ No drones found on network</span>
                      )}
                    </div>
                  )}
                  
                  {/* Result summary for pair */}
                  {log.type === 'pair' && log.status !== 'running' && (
                    <div className="terminal-result">
                      {log.result ? (
                        <span className="result-success">✓ Pair command sent to drone {log.droneId}</span>
                      ) : (
                        <span className="result-error">✕ Pairing failed for drone {log.droneId}</span>
                      )}
                    </div>
                  )}
                  
                  {/* Telemetry check result */}
                  {log.type === 'telemetry-check' && (
                    <div className="terminal-result">
                      {log.hasTelemetry ? (
                        <span className="result-success">✓ Telemetry received from drone {log.droneId} - Paired successfully!</span>
                      ) : (
                        <span className="result-error">✕ No telemetry from drone {log.droneId} - Try pairing again</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        
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

