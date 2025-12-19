import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import config from './config'
import './DroneProfileEditor.css'

const API_BASE_URL = config.apiUrl

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
  const [unknownDrones, setUnknownDrones] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingDrone, setEditingDrone] = useState(null)
  const [newDroneId, setNewDroneId] = useState('')
  const [showNewForm, setShowNewForm] = useState(false)
  
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
        setNewDroneId('')
        // Remove from unknown drones if it was there
        setUnknownDrones(prev => prev.filter(id => id !== droneId))
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
        // Add back to unknown if in DB
        if (droneIds.map(String).includes(String(droneId))) {
          setUnknownDrones(prev => [...prev, droneId])
        }
      }
    } catch (error) {
      console.error('Failed to delete profile:', error)
    }
  }
  
  const handleAddNewDrone = () => {
    const id = newDroneId.trim()
    if (!id) {
      alert('Please enter a valid drone ID')
      return
    }
    if (profiles[id]) {
      alert(`Drone #${id} already has a profile`)
      return
    }
    setEditingDrone(id)
    setShowNewForm(true)
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
      
      {/* Unknown drones section */}
      {unknownDrones.length > 0 && (
        <section className="unknown-section">
          <h2>⚠ Unknown Drones in Database</h2>
          <p>These drone IDs have telemetry data but no profile configured.</p>
          <div className="unknown-list">
            {unknownDrones.map(id => (
              <button
                key={id}
                className="unknown-drone-btn"
                onClick={() => {
                  setEditingDrone(id)
                  setShowNewForm(true)
                }}
              >
                <span className="drone-id">#{id}</span>
                <span className="add-text">+ Add Profile</span>
              </button>
            ))}
          </div>
        </section>
      )}
      
      {/* Add new drone */}
      <section className="add-section">
        <h2>Add New Drone Profile</h2>
        <div className="add-form">
          <input
            type="text"
            placeholder="Drone ID (e.g. 1604695971)"
            value={newDroneId}
            onChange={(e) => setNewDroneId(e.target.value)}
          />
          <button onClick={handleAddNewDrone}>+ Add Profile</button>
        </div>
      </section>
      
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

