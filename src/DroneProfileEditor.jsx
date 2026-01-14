import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: config.googleMapsApiKey
  })
  
  if (!isLoaded) {
    return <div className="mini-map-loading">{t('osd.loadingMap')}</div>
  }
  
  if (!latitude || !longitude) {
    return <div className="mini-map-no-data">{t('settings.noGpsCoords')}</div>
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
  ipAddress: '',
  frontCamera: null,
  rearCamera: null,
  // Legacy fields for backwards compatibility
  frontCameraUrl: '',
  rearCameraUrl: '',
  color: '#00ff88'
}

// Camera Scanner Modal Component
function CameraScannerModal({ droneId, droneIp, onSave, onClose }) {
  const { t } = useTranslation()
  const [isScanning, setIsScanning] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [scanError, setScanError] = useState(null)
  const [cameras, setCameras] = useState([])
  const [selectedFront, setSelectedFront] = useState(null)
  const [selectedRear, setSelectedRear] = useState(null)
  const [scanLog, setScanLog] = useState(null) // { command, stdout, stderr, status }
  const scanTerminalRef = useRef(null)
  
  // Auto-scroll terminal
  useEffect(() => {
    if (scanTerminalRef.current) {
      scanTerminalRef.current.scrollTop = scanTerminalRef.current.scrollHeight
    }
  }, [scanLog])
  
  const handleScan = async () => {
    if (!droneIp) {
      setScanError(t('cameraScanner.noIpError'))
      return
    }
    
    setIsScanning(true)
    setScanError(null)
    setCameras([])
    setSelectedFront(null)
    setSelectedRear(null)
    
    // Set initial scanning log
    setScanLog({
      command: `scan_cam.sh ${droneIp}`,
      stdout: '',
      stderr: '',
      status: 'running'
    })
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/scan-cameras/${droneIp}`)
      const data = await response.json()
      
      // Update log with response
      setScanLog({
        command: data.command || `scan_cam.sh ${droneIp}`,
        stdout: data.stdout || '',
        stderr: data.stderr || '',
        status: data.success ? 'success' : 'error',
        camerasFound: data.cameras?.length || 0
      })
      
      if (data.success && data.cameras && data.cameras.length > 0) {
        setCameras(data.cameras)
      } else {
        setScanError(data.error || t('cameraScanner.noCamerasFound'))
      }
    } catch (error) {
      console.error('Camera scan error:', error)
      setScanLog(prev => ({
        ...prev,
        status: 'error',
        stderr: error.message
      }))
      setScanError(error.message)
    } finally {
      setIsScanning(false)
    }
  }
  
  const handleAssignFront = (camera) => {
    // If already selected as rear, unselect it there
    if (selectedRear?.ip === camera.ip) {
      setSelectedRear(null)
    }
    setSelectedFront(camera)
  }
  
  const handleAssignRear = (camera) => {
    // If already selected as front, unselect it there
    if (selectedFront?.ip === camera.ip) {
      setSelectedFront(null)
    }
    setSelectedRear(camera)
  }
  
  const handleSaveAssignments = async () => {
    // Generate WebRTC WHEP URL: /webrtc/cam{serial_number}/whep
    // Uses nginx proxy to MediaMTX WebRTC endpoint on port 8889
    const generateWebrtcUrl = (camera) => {
      const serialNumber = camera.onvif?.serial_number || camera.ip.replace(/\./g, '')
      return `/webrtc/cam${serialNumber}/whep`
    }
    
    const frontCamera = selectedFront ? {
      ip: selectedFront.ip,
      webrtcUrl: generateWebrtcUrl(selectedFront),
      snapshotUrl: selectedFront.snapshot?.url || '',
      rtspUrl: `rtsp://${selectedFront.login}:${selectedFront.password}@${selectedFront.ip}:${selectedFront.rtsp?.port || 554}${selectedFront.rtsp?.path || '/stream0'}`,
      rtspPort: selectedFront.rtsp?.port || 554,
      rtspPath: selectedFront.rtsp?.path || '/stream0',
      login: selectedFront.login || '',
      password: selectedFront.password || '',
      serialNumber: selectedFront.onvif?.serial_number || '',
      model: selectedFront.onvif?.model || ''
    } : null
    
    const rearCamera = selectedRear ? {
      ip: selectedRear.ip,
      webrtcUrl: generateWebrtcUrl(selectedRear),
      snapshotUrl: selectedRear.snapshot?.url || '',
      rtspUrl: `rtsp://${selectedRear.login}:${selectedRear.password}@${selectedRear.ip}:${selectedRear.rtsp?.port || 554}${selectedRear.rtsp?.path || '/stream0'}`,
      rtspPort: selectedRear.rtsp?.port || 554,
      rtspPath: selectedRear.rtsp?.path || '/stream0',
      login: selectedRear.login || '',
      password: selectedRear.password || '',
      serialNumber: selectedRear.onvif?.serial_number || '',
      model: selectedRear.onvif?.model || ''
    } : null
    
    setIsSaving(true)
    
    // Initialize terminal log for save operation
    setScanLog({
      command: t('terminal.savingCameraSettings'),
      stdout: '[SAVE] Saving drone profile...\n',
      stderr: '',
      status: 'running'
    })
    
    try {
      // Step 1: Save profile
      await onSave(frontCamera, rearCamera)
      
      setScanLog(prev => ({
        ...prev,
        stdout: prev.stdout + '[SUCCESS] Profile saved\n\n[MMTX] Updating MediaMTX configuration...\n'
      }))
      
      // Step 2: Update MediaMTX config
      const mmtxResponse = await fetch(`${API_BASE_URL}/api/update-mediamtx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frontCamera, rearCamera })
      })
      
      const mmtxData = await mmtxResponse.json()
      
      setScanLog(prev => ({
        ...prev,
        stdout: prev.stdout + (mmtxData.stdout || '') + '\n',
        stderr: prev.stderr + (mmtxData.stderr || ''),
        status: mmtxData.success ? 'success' : 'error'
      }))
      
      if (mmtxData.success) {
        // Show success message - don't auto-close, let user see and close manually
        setScanLog(prev => ({
          ...prev,
          stdout: prev.stdout + '\n✓ MMTX CONFIG SAVED - You can now close this window\n',
          status: 'success'
        }))
      }
    } catch (error) {
      console.error('Save error:', error)
      setScanLog(prev => ({
        ...prev,
        stderr: prev.stderr + `[ERROR] ${error.message}\n`,
        status: 'error'
      }))
    } finally {
      setIsSaving(false)
    }
  }
  
  const getCameraAssignment = (camera) => {
    if (selectedFront?.ip === camera.ip) return 'front'
    if (selectedRear?.ip === camera.ip) return 'rear'
    return null
  }
  
  return (
    <div className="camera-scanner-modal">
      <div className="camera-scanner-header">
        <h3>{t('cameraScanner.title')}</h3>
        <span className="scanner-subtitle">{t('cameraScanner.subtitle', { id: droneId, ip: droneIp || t('cameraScanner.ipNotSet') })}</span>
      </div>
      
      {/* Terminal Output */}
      {scanLog && (
        <div className="camera-scanner-terminal">
          <div className="terminal-header">
            <span className="terminal-title"><span className="terminal-icon">&gt;_</span> {t('terminal.title')}</span>
          </div>
          <div className="terminal-body" ref={scanTerminalRef}>
            <div className={`terminal-entry scan ${scanLog.status}`}>
              <div className="terminal-command-line">
                <span className="prompt">$</span>
                <span className="command">{scanLog.command}</span>
                {scanLog.status === 'running' && <span className="running-indicator">◌</span>}
              </div>
              {scanLog.stdout && (
                <pre className="terminal-stdout">{scanLog.stdout}</pre>
              )}
              {scanLog.stderr && (
                <pre className="terminal-stderr">{scanLog.stderr}</pre>
              )}
              {scanLog.status === 'success' && scanLog.camerasFound !== undefined && (
                <div className="terminal-result success">
                  ✓ {t('cameraScanner.foundCameras', { count: scanLog.camerasFound })}
                </div>
              )}
              {scanLog.status === 'error' && (
                <div className="terminal-result error">
                  ✗ {t('cameraScanner.operationFailed')}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {scanError && (
        <div className="scan-error">
          ⚠ {scanError}
        </div>
      )}
      
      {/* Cameras Grid */}
      {cameras.length > 0 && (
        <div className="cameras-grid">
          {cameras.map((camera, index) => {
            const assignment = getCameraAssignment(camera)
            return (
              <div 
                key={camera.ip || index} 
                className={`camera-card ${assignment ? `assigned-${assignment}` : ''}`}
              >
                <div className="camera-snapshot">
                  {camera.snapshot?.url ? (
                    <img 
                      src={camera.snapshot.url} 
                      alt={`Camera ${camera.ip}`}
                      onError={(e) => {
                        e.target.style.display = 'none'
                        e.target.nextSibling.style.display = 'flex'
                      }}
                    />
                  ) : null}
                  <div className="snapshot-placeholder" style={{ display: camera.snapshot?.url ? 'none' : 'flex' }}>
                    {t('camera.noSnapshot')}
                  </div>
                </div>
                
                <div className="camera-info">
                  <div className="camera-ip">{camera.ip}</div>
                  {camera.onvif?.model && (
                    <div className="camera-model">{camera.onvif.manufacturer} {camera.onvif.model}</div>
                  )}
                </div>
                
                <div className="camera-assignment">
                  {assignment && (
                    <div className={`assignment-badge ${assignment}`}>
                      {assignment === 'front' ? t('camera.front') : t('camera.rear')}
                    </div>
                  )}
                </div>
                
                <div className="camera-buttons">
                  <button
                    className={`assign-btn front ${assignment === 'front' ? 'selected' : ''}`}
                    onClick={() => handleAssignFront(camera)}
                  >
                    {assignment === 'front' ? `✓ ${t('camera.front')}` : t('camera.setAsFront')}
                  </button>
                  <button
                    className={`assign-btn rear ${assignment === 'rear' ? 'selected' : ''}`}
                    onClick={() => handleAssignRear(camera)}
                  >
                    {assignment === 'rear' ? `✓ ${t('camera.rear')}` : t('camera.setAsRear')}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      
      {/* Scan Button - below cameras */}
      <div className="camera-scanner-actions">
        <button 
          className={`scan-btn ${isScanning ? 'scanning' : ''}`}
          onClick={handleScan}
          disabled={isScanning || !droneIp}
        >
          {isScanning ? (
            <>
              <span className="scan-spinner">◌</span>
              {t('cameraScanner.scanning')}
            </>
          ) : cameras.length > 0 ? (
            t('cameraScanner.rescan')
          ) : (
            t('cameraScanner.scanForCameras')
          )}
        </button>
      </div>
      
      <div className="camera-scanner-footer">
        <button className="cancel-btn" onClick={onClose} disabled={isSaving}>
          {t('common.close')}
        </button>
        <button 
          className="save-btn"
          onClick={handleSaveAssignments}
          disabled={isSaving || (!selectedFront && !selectedRear)}
        >
          {isSaving ? (
            <>
              <span className="spinner"></span>
              {t('cameraScanner.savingConfiguring')}
            </>
          ) : (
            t('cameraScanner.saveCameraSettings')
          )}
        </button>
      </div>
    </div>
  )
}

function ProfileForm({ droneId, profile, onSave, onCancel, onDelete }) {
  const { t } = useTranslation()
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
        <h3>{t('profile.title', { id: droneId })}</h3>
        {profile && (
          <button 
            type="button" 
            className="delete-btn"
            onClick={() => onDelete(droneId)}
          >
            ✕ {t('common.delete')}
          </button>
        )}
      </div>
      
      <div className="form-group">
        <label htmlFor={`name-${droneId}`}>{t('profile.droneName')}</label>
        <input
          id={`name-${droneId}`}
          name="name"
          type="text"
          value={formData.name}
          onChange={handleChange}
          placeholder={t('profile.droneNamePlaceholder', { id: droneId })}
        />
      </div>
      
      <div className="form-group">
        <label htmlFor={`ip-${droneId}`}>{t('profile.ipAddress')}</label>
        <input
          id={`ip-${droneId}`}
          name="ipAddress"
          type="text"
          value={formData.ipAddress || ''}
          onChange={handleChange}
          placeholder={t('profile.ipPlaceholder')}
        />
        <span className="form-hint">{t('profile.ipHint')}</span>
      </div>
      
      <div className="form-group">
        <label htmlFor={`frontCamera-${droneId}`}>{t('profile.frontCameraUrl')}</label>
        <input
          id={`frontCamera-${droneId}`}
          name="frontCameraUrl"
          type="text"
          value={formData.frontCameraUrl}
          onChange={handleChange}
          placeholder={t('profile.frontCameraPlaceholder')}
        />
        <span className="form-hint">{t('profile.frontCameraHint')}</span>
      </div>
      
      <div className="form-group">
        <label htmlFor={`rearCamera-${droneId}`}>{t('profile.rearCameraUrl')}</label>
        <input
          id={`rearCamera-${droneId}`}
          name="rearCameraUrl"
          type="text"
          value={formData.rearCameraUrl}
          onChange={handleChange}
          placeholder={t('profile.rearCameraPlaceholder')}
        />
        <span className="form-hint">{t('profile.rearCameraHint')}</span>
      </div>
      
      <div className="form-group">
        <label htmlFor={`color-${droneId}`}>{t('profile.accentColor')}</label>
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
          {t('common.cancel')}
        </button>
        <button type="submit" className="save-btn" disabled={saving}>
          {saving ? t('profile.saving') : t('profile.saveProfile')}
        </button>
      </div>
    </form>
  )
}

// MediaMTX Status Panel Component
function MediaMTXPanel({ profiles = {} }) {
  const { t } = useTranslation()
  const [status, setStatus] = useState(null)
  const [config, setConfig] = useState(null)
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [restarting, setRestarting] = useState(false)
  const logsRef = useRef(null)
  
  // Build a map of stream name -> drone usage info
  const getStreamDroneUsage = (streamName) => {
    const usage = []
    Object.entries(profiles).forEach(([droneId, profile]) => {
      // Check front camera
      if (profile.frontCamera?.webrtcUrl?.includes(streamName) || profile.frontCameraUrl?.includes(streamName)) {
        usage.push({ droneId, name: profile.name, camera: 'Front' })
      }
      // Check rear camera
      if (profile.rearCamera?.webrtcUrl?.includes(streamName) || profile.rearCameraUrl?.includes(streamName)) {
        usage.push({ droneId, name: profile.name, camera: 'Rear' })
      }
    })
    return usage
  }
  
  // Fetch status data
  const fetchStatus = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/mediamtx/status`)
      const data = await response.json()
      if (data.success) {
        setStatus(data)
        setError(null)
      } else {
        setError(data.error || 'Failed to fetch status')
      }
    } catch (err) {
      setError(err.message)
    }
  }
  
  // Fetch config
  const fetchConfig = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/mediamtx/config`)
      const data = await response.json()
      if (data.success) {
        setConfig(data)
      }
    } catch (err) {
      console.error('Config fetch error:', err)
    }
  }
  
  // Fetch logs
  const fetchLogs = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/mediamtx/logs?lines=50`)
      const data = await response.json()
      if (data.success) {
        setLogs(data.lines || [])
      }
    } catch (err) {
      console.error('Logs fetch error:', err)
    }
  }
  
  // Initial load
  useEffect(() => {
    const loadAll = async () => {
      setLoading(true)
      await Promise.all([fetchStatus(), fetchConfig(), fetchLogs()])
      setLoading(false)
    }
    loadAll()
    
    // Auto-refresh every 5 seconds
    const interval = setInterval(fetchStatus, 5000)
    return () => clearInterval(interval)
  }, [])
  
  // Auto-scroll logs
  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight
    }
  }, [logs])
  
  // Restart MediaMTX
  const handleRestart = async () => {
    if (restarting) return
    setRestarting(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/mediamtx/restart`, { method: 'POST' })
      const data = await response.json()
      if (data.success) {
        await fetchStatus()
        await fetchLogs()
      } else {
        setError(data.error || 'Restart failed')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setRestarting(false)
    }
  }
  
  // Format bytes
  const formatBytes = (bytes) => {
    if (!bytes) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }
  
  if (loading) {
    return (
      <div className="mediamtx-panel loading">
        <div className="loading-spinner"></div>
        <p>{t('mediamtx.loading')}</p>
      </div>
    )
  }
  
  return (
    <div className="mediamtx-panel">
      {/* Status Header */}
      <div className="mmtx-status-header">
        <div className="mmtx-status-indicator">
          <span className={`status-dot ${status?.status?.running ? 'running' : 'stopped'}`}></span>
          <span className="status-text">
            {status?.status?.running ? t('mediamtx.running') : t('mediamtx.stopped')}
            {status?.status?.pid && <span className="pid">{t('mediamtx.pid')}: {status.status.pid}</span>}
            {status?.status?.uptime && <span className="uptime">{t('mediamtx.uptime')}: {status.status.uptime}</span>}
          </span>
        </div>
        <button 
          className={`mmtx-restart-btn ${restarting ? 'restarting' : ''}`}
          onClick={handleRestart}
          disabled={restarting}
        >
          {restarting ? t('mediamtx.restarting') : t('mediamtx.restart')}
        </button>
      </div>
      
      {error && (
        <div className="mmtx-error">
          ⚠ {error}
        </div>
      )}
      
      {/* Stats Grid */}
      <div className="mmtx-stats-grid">
        <div className="stat-card">
          <span className="stat-value">{status?.stats?.totalPaths || 0}</span>
          <span className="stat-label">{t('mediamtx.configuredStreams')}</span>
        </div>
        <div className="stat-card">
          <span className="stat-value active">{status?.stats?.activePaths || 0}</span>
          <span className="stat-label">{t('mediamtx.activeStreams')}</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{status?.stats?.totalReaders || 0}</span>
          <span className="stat-label">{t('mediamtx.connectedViewers')}</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{status?.stats?.webrtcSessions || 0}</span>
          <span className="stat-label">{t('mediamtx.webrtcSessions')}</span>
        </div>
        <div className="stat-card bytes">
          <span className="stat-value">{formatBytes(status?.stats?.bytesReceived)}</span>
          <span className="stat-label">{t('mediamtx.dataReceived')}</span>
        </div>
        <div className="stat-card bytes">
          <span className="stat-value">{formatBytes(status?.stats?.bytesSent)}</span>
          <span className="stat-label">{t('mediamtx.dataSent')}</span>
        </div>
      </div>
      
      {/* Streams Table */}
      <div className="mmtx-streams-section">
        <h3>{t('mediamtx.cameraStreams')}</h3>
        {status?.paths?.length > 0 ? (
          <table className="mmtx-streams-table">
            <thead>
              <tr>
                <th>{t('mediamtx.streamName')}</th>
                <th>{t('mediamtx.status')}</th>
                <th>{t('mediamtx.usedBy')}</th>
                <th>{t('mediamtx.source')}</th>
                <th>{t('mediamtx.tracks')}</th>
                <th>{t('mediamtx.viewers')}</th>
                <th>{t('mediamtx.webrtcUrl')}</th>
              </tr>
            </thead>
            <tbody>
              {status.paths.map(path => {
                const droneUsage = getStreamDroneUsage(path.name)
                return (
                  <tr key={path.name} className={path.ready ? 'ready' : 'not-ready'}>
                    <td className="stream-name">{path.name}</td>
                    <td>
                      <span className={`stream-status ${path.ready ? 'active' : 'inactive'}`}>
                        {path.ready ? `● ${t('mediamtx.active')}` : `○ ${t('mediamtx.inactive')}`}
                      </span>
                    </td>
                    <td className="stream-usage">
                      {droneUsage.length > 0 ? (
                        droneUsage.map((u, i) => (
                          <span key={i} className="usage-badge">
                            {u.name && <span className="drone-name">{u.name}</span>}
                            <span className="drone-id">#{u.droneId}</span>
                            <span className={`camera-type ${u.camera.toLowerCase()}`}>{u.camera}</span>
                          </span>
                        ))
                      ) : (
                        <span className="not-assigned">{t('mediamtx.notAssigned')}</span>
                      )}
                    </td>
                    <td className="source-type">{path.sourceType}</td>
                    <td>{path.tracks}</td>
                    <td>{path.readers}</td>
                    <td className="webrtc-url">
                      <code>/webrtc/{path.name}/whep</code>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <p className="no-streams">{t('mediamtx.noStreams')}</p>
        )}
      </div>
      
      {/* Config Section */}
      <div className="mmtx-config-section">
        <div className="config-header">
          <h3>{t('mediamtx.configuration')}</h3>
          {config?.lastModified && (
            <span className="config-modified">
              {t('mediamtx.lastUpdated', { time: new Date(config.lastModified).toLocaleString() })}
            </span>
          )}
        </div>
        <pre className="config-preview">
          {config?.raw || t('mediamtx.noConfig')}
        </pre>
      </div>
      
      {/* Logs Section */}
      <div className="mmtx-logs-section">
        <div className="logs-header">
          <h3>{t('mediamtx.recentLogs')}</h3>
          <button className="refresh-logs-btn" onClick={fetchLogs}>
            {t('common.refresh')}
          </button>
        </div>
        <div className="logs-container" ref={logsRef}>
          {logs.length > 0 ? (
            logs.map((line, i) => (
              <div key={i} className={`log-line ${line.includes('ERR') ? 'error' : line.includes('WAR') ? 'warn' : ''}`}>
                {line}
              </div>
            ))
          ) : (
            <p className="no-logs">{t('mediamtx.noLogs')}</p>
          )}
        </div>
      </div>
    </div>
  )
}

function DroneProfileEditor() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [profiles, setProfiles] = useState({})
  const [droneIds, setDroneIds] = useState([])
  const [detectedDrones, setDetectedDrones] = useState([]) // Drones with telemetry but no profile
  const [loading, setLoading] = useState(true)
  const [editingDrone, setEditingDrone] = useState(null)
  const [showNewForm, setShowNewForm] = useState(false)
  
  // Tab state: 'connected' or 'discover'
  const [activeTab, setActiveTab] = useState('connected')
  
  // Discovery state
  const [discoveredDrones, setDiscoveredDrones] = useState([])
  const [isDiscovering, setIsDiscovering] = useState(false)
  const [discoverError, setDiscoverError] = useState(null)
  
  // Terminal logs - array of { type, command, stdout, stderr, error, timestamp, result }
  const [terminalLogs, setTerminalLogs] = useState([])
  const terminalRef = useRef(null)
  
  // Pairing state (keyed by drone IP)
  const [pairingStatus, setPairingStatus] = useState({}) // { ip: { status: 'pairing'|'checking'|'success'|'failed', message: '' } }
  
  // Check if any drone is currently pairing (to disable other pair buttons and discover)
  const isPairingAny = Object.values(pairingStatus).some(
    s => s.status === 'pairing' || s.status === 'checking'
  )
  
  // Confirm modal state
  const [confirmModal, setConfirmModal] = useState(null) // { title, message, onConfirm, onCancel }
  
  // Camera scanner modal state
  const [cameraScannerDrone, setCameraScannerDrone] = useState(null) // { droneId, droneIp }
  
  // MediaMTX status for tab indicator
  const [mmtxStatus, setMmtxStatus] = useState('unknown') // 'running' | 'stopped' | 'restarting' | 'unknown'
  
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
  
  // Poll MediaMTX status for tab indicator
  useEffect(() => {
    let isMounted = true
    
    const fetchMmtxStatus = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/mediamtx/status`)
        if (!response.ok) throw new Error('Failed to fetch')
        
        const data = await response.json()
        if (!isMounted) return
        
        if (data.success && data.status?.running) {
          setMmtxStatus('running')
        } else if (data.success) {
          setMmtxStatus('stopped')
        } else {
          setMmtxStatus('stopped')
        }
      } catch (error) {
        if (isMounted) setMmtxStatus('unknown')
      }
    }
    
    fetchMmtxStatus()
    const interval = setInterval(fetchMmtxStatus, 3000) // Poll every 3 seconds
    
    return () => {
      isMounted = false
      clearInterval(interval)
    }
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
        // Remove from detected drones if it was there
        setDetectedDrones(prev => prev.filter(d => String(d.droneId) !== String(droneId)))
      }
    } catch (error) {
      console.error('Failed to save profile:', error)
    }
  }
  
  // Handle camera settings save from scanner modal
  const handleSaveCameraSettings = async (frontCamera, rearCamera) => {
    if (!cameraScannerDrone) return
    
    const { droneId } = cameraScannerDrone
    const existingProfile = profiles[droneId] || {}
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/profiles/${droneId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...existingProfile,
          frontCamera,
          rearCamera,
          // Set WebRTC URL fields (format: /webrtc/cam{serial_number}/whep)
          frontCameraUrl: frontCamera?.webrtcUrl || existingProfile.frontCameraUrl || '',
          rearCameraUrl: rearCamera?.webrtcUrl || existingProfile.rearCameraUrl || ''
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setProfiles(prev => ({
          ...prev,
          [droneId]: data.profile
        }))
        setCameraScannerDrone(null)
      }
    } catch (error) {
      console.error('Failed to save camera settings:', error)
    }
  }
  
  const handleDeleteProfile = (droneId) => {
    setConfirmModal({
      title: t('profile.deleteProfile'),
      message: t('profile.deleteConfirm', { id: droneId }),
      onConfirm: async () => {
        setConfirmModal(null)
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
            // Refresh data to get updated detected drones list
            window.location.reload()
          }
        } catch (error) {
          console.error('Failed to delete profile:', error)
        }
      },
      onCancel: () => setConfirmModal(null)
    })
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
      [ip]: { status: 'pairing', message: t('pairing.initiating') }
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
          [ip]: { status: 'failed', message: t('pairing.commandFailed') }
        }))
        return
      }
      
      // Update status to checking
      setPairingStatus(prev => ({
        ...prev,
        [ip]: { status: 'checking', message: t('pairing.waitingTelemetry') }
      }))
      
      // Add waiting log
      addTerminalLog({
        type: 'info',
        message: t('pairing.waitingForTelemetry', { id: drone_id })
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
        // Success! Move drone to detected drones
        setPairingStatus(prev => ({
          ...prev,
          [ip]: { status: 'success', message: t('pairing.success') }
        }))
        
        // Create or update profile with IP address
        try {
          // First fetch the current profile to avoid stale closure issues
          const currentProfileRes = await fetch(`${API_BASE_URL}/api/profiles`)
          const currentProfileData = await currentProfileRes.json()
          const existingProfile = currentProfileData.success ? currentProfileData.profiles[drone_id] : null
          
          console.log('Saving profile with IP:', ip, 'for drone:', drone_id)
          
          const profileResponse = await fetch(`${API_BASE_URL}/api/profiles/${drone_id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...defaultProfile,
              ...existingProfile, // Keep existing profile data if any
              ipAddress: ip || '' // Ensure ip is defined
            })
          })
          
          const profileData = await profileResponse.json()
          
          if (profileData.success) {
            setProfiles(prev => ({
              ...prev,
              [drone_id]: profileData.profile
            }))
            // Also remove from detected drones since it now has a profile
            setDetectedDrones(prev => prev.filter(d => String(d.droneId) !== String(drone_id)))
          }
        } catch (profileError) {
          console.error('Failed to save profile with IP:', profileError)
          // Still add to detected drones if profile save failed
          setDetectedDrones(prev => [
            ...prev,
            {
              droneId: String(drone_id),
              latitude: null,
              longitude: null,
              lastSeen: new Date().toISOString()
            }
          ])
        }
        
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
        <span>{t('common.loading')}</span>
      </div>
    )
  }
  
  // Sort by array index (_index) to maintain consistent drone numbering
  const connectedDroneIds = Object.keys(profiles).sort((a, b) => {
    const indexA = profiles[a]?._index ?? 999
    const indexB = profiles[b]?._index ?? 999
    return indexA - indexB
  })
  
  return (
    <div className="profile-editor">
      <header className="editor-header">
        <div className="header-left">
          <Link to="/" className="back-btn">← {t('nav.backToDashboard')}</Link>
          <h1>{t('settings.title')}</h1>
        </div>
      </header>
      
      {/* Tab Navigation */}
      <nav className="tabs-nav">
        <button 
          className={`tab-btn ${activeTab === 'connected' ? 'active' : ''}`}
          onClick={() => setActiveTab('connected')}
        >
          {t('settings.connectedTab')} ({connectedDroneIds.length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'discover' ? 'active' : ''}`}
          onClick={() => setActiveTab('discover')}
        >
          {t('settings.discoverTab')}
          {isPairingAny && <span className="tab-badge pairing">●</span>}
        </button>
        <button 
          className={`tab-btn ${activeTab === 'cameras' ? 'active' : ''}`}
          onClick={() => setActiveTab('cameras')}
        >
          <span className={`mmtx-status-dot ${mmtxStatus}`} title={`MediaMTX: ${mmtxStatus}`}></span>
          {t('settings.camerasTab')}
        </button>
      </nav>
      
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
      
      {/* TAB: Connected Drones */}
      {activeTab === 'connected' && (
        <div className="tab-content">
          {/* Connected drone profiles */}
          <section className="profiles-section">
            <h2>{t('settings.connectedDrones')} ({connectedDroneIds.length})</h2>
            
            {connectedDroneIds.length === 0 ? (
              <div className="no-profiles">
                <p>{t('settings.noDronesYet')}</p>
              </div>
            ) : (
              <div className="profiles-grid">
                {connectedDroneIds.map(droneId => {
                  const profile = profiles[droneId]
                  // Drone number is array index + 1
                  const droneNumber = (profile?._index ?? 0) + 1
                  return (
                    <div
                      key={droneId}
                      className="profile-card"
                      style={{ '--accent-color': profile.color }}
                    >
                      <div className="profile-card-header">
                        <span className="profile-drone-number">#{droneNumber}</span>
                        {profile.name && <span className="profile-name">{profile.name}</span>}
                        <button 
                          className="edit-btn"
                          onClick={() => { setEditingDrone(droneId); setShowNewForm(true); }}
                        >
                          {t('common.edit')}
                        </button>
                      </div>
                      
                      <div className="profile-details">
                        <div className="detail-row">
                          <span className="detail-label">{t('profile.ipAddress')}:</span>
                          <span className="detail-value">
                            {profile.ipAddress || <em>{t('camera.notSet')}</em>}
                          </span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">{t('profile.droneId')}:</span>
                          <span className="detail-value drone-id-value">{droneId}</span>
                        </div>
                        <div className="detail-row camera-row">
                          <span className="detail-label">{t('profile.frontCamera')}:</span>
                          <span className="detail-value">
                            {profile.frontCamera?.ip || profile.frontCameraUrl ? (
                              <>
                                <span className="camera-status set">✓ {t('camera.set')}</span>
                                <button 
                                  className="set-camera-btn change"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setCameraScannerDrone({ droneId, droneIp: profile.ipAddress })
                                  }}
                                >
                                  {t('camera.change')}
                                </button>
                              </>
                            ) : (
                              <>
                                <span className="camera-status not-set">{t('camera.notSet')}</span>
                                <button 
                                  className="set-camera-btn"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setCameraScannerDrone({ droneId, droneIp: profile.ipAddress })
                                  }}
                                >
                                  {t('camera.set')}
                                </button>
                              </>
                            )}
                          </span>
                        </div>
                        <div className="detail-row camera-row">
                          <span className="detail-label">{t('profile.rearCamera')}:</span>
                          <span className="detail-value">
                            {profile.rearCamera?.ip || profile.rearCameraUrl ? (
                              <>
                                <span className="camera-status set">✓ {t('camera.set')}</span>
                                <button 
                                  className="set-camera-btn change"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setCameraScannerDrone({ droneId, droneIp: profile.ipAddress })
                                  }}
                                >
                                  {t('camera.change')}
                                </button>
                              </>
                            ) : (
                              <>
                                <span className="camera-status not-set">{t('camera.notSet')}</span>
                                <button 
                                  className="set-camera-btn"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setCameraScannerDrone({ droneId, droneIp: profile.ipAddress })
                                  }}
                                >
                                  {t('camera.set')}
                                </button>
                              </>
                            )}
                          </span>
                        </div>
                      </div>
                      
                      <div className="profile-actions">
                        <Link 
                          to={`/drone/${droneId}`} 
                          className="view-osd-btn"
                        >
                          {t('profile.open')}
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
          
          {/* Detected drones - telemetry but no profile */}
          {detectedDrones.length > 0 && (
            <section className="detected-section">
              <h2>{t('settings.detectedDrones')} ({detectedDrones.length})</h2>
              <p>{t('settings.telemetryActive')}</p>
              <div className="detected-drones-grid">
                {detectedDrones.map(drone => (
                  <div
                    key={drone.droneId}
                    className="detected-drone-card"
                    onClick={() => {
                      setEditingDrone(drone.droneId)
                      setShowNewForm(true)
                    }}
                  >
                    <div className="detected-drone-header">
                      <span className="drone-id-badge">ID: {drone.droneId}</span>
                      <span className="add-profile-hint">{t('settings.connectDrone')}</span>
                    </div>
                    <div className="detected-drone-map">
                      <DroneLocationMap 
                        latitude={drone.latitude} 
                        longitude={drone.longitude} 
                      />
                    </div>
                    <div className="detected-drone-info">
                      {drone.latitude && drone.longitude ? (
                        <span className="coords">
                          {drone.latitude.toFixed(5)}, {drone.longitude.toFixed(5)}
                        </span>
                      ) : (
                        <span className="no-coords">{t('settings.noGpsCoords')}</span>
                      )}
                      {drone.lastSeen && (
                        <span className="last-seen">
                          {t('settings.lastSeen', { time: new Date(drone.lastSeen).toLocaleString() })}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
      
      {/* TAB: Discover & Pair */}
      {activeTab === 'discover' && (
        <div className="tab-content">
          <section className="discover-section">
            <div className="discover-header">
              <div className="discover-title">
                <h2>{t('discover.title')}</h2>
                <p>{t('discover.subtitle')}</p>
              </div>
              <button 
                className={`discover-btn ${isDiscovering ? 'discovering' : ''} ${isPairingAny ? 'disabled-pairing' : ''}`}
                onClick={handleDiscover}
                disabled={isDiscovering || isPairingAny}
              >
                {isDiscovering ? (
                  <>
                    <span className="discover-spinner">◌</span>
                    {t('discover.scanning')}
                  </>
                ) : isPairingAny ? (
                  t('discover.pairingInProgress')
                ) : (
                  t('discover.discoverBtn')
                )}
              </button>
            </div>
            
            {discoverError && (
              <div className="discover-error">
                ⚠ {discoverError}
              </div>
            )}
            
            {/* Split layout: Discovered drones (left) + Terminal (right) */}
            {(discoveredDrones.length > 0 || terminalLogs.length > 0) && (
              <div className="discover-content-split">
                {/* Discovered Drones - Left side (60%) */}
                {discoveredDrones.length > 0 && (
                  <div className="discovered-drones-panel">
                    <div className="discovered-drones-grid">
                      {discoveredDrones.map(drone => {
                        const status = pairingStatus[drone.ip]
                        const isPairing = status?.status === 'pairing' || status?.status === 'checking'
                        const isSuccess = status?.status === 'success'
                        const isFailed = status?.status === 'failed'
                        // Disable if any other drone is pairing
                        const isDisabledByOther = isPairingAny && !isPairing
                        // Check if this drone already has telemetry
                        const alreadyHasTelemetry = droneIds.includes(String(drone.drone_id)) || 
                          detectedDrones.some(d => String(d.droneId) === String(drone.drone_id))
                        // Check if drone is already in profiles (connected)
                        const existingProfile = profiles[String(drone.drone_id)]
                        const isAlreadyConnected = !!existingProfile
                        const droneName = existingProfile?.name
                        // Show Re-pair if either has telemetry OR is already connected
                        const needsRepair = alreadyHasTelemetry || isAlreadyConnected
                        
                        const handlePairClick = () => {
                          if (needsRepair) {
                            setConfirmModal({
                              title: 'Re-pair Drone',
                              message: isAlreadyConnected 
                                ? `Drone "${droneName || drone.drone_id}" is already connected. Re-pairing may update network settings. Continue?`
                                : `Drone ${drone.drone_id} already has active telemetry. Are you sure you want to re-pair this drone?`,
                              onConfirm: () => {
                                setConfirmModal(null)
                                handlePair(drone)
                              },
                              onCancel: () => setConfirmModal(null)
                            })
                          } else {
                            handlePair(drone)
                          }
                        }
                        
                        return (
                          <div key={drone.ip} className={`discovered-drone-card ${status?.status || ''} ${needsRepair ? 'already-paired' : ''}`}>
                            <div className="discovered-drone-header">
                              <span className="drone-id-badge">{droneName && <span className="drone-name">{droneName}</span>} ID: {drone.drone_id}</span>
                              <span className="drone-method">{drone.method.toUpperCase()}</span>
                            </div>
                            
                            {needsRepair && !status && (
                              <div className="already-paired-notice">
                                ✓ {isAlreadyConnected ? 'Connected drone' : 'Already paired - telemetry active'}
                              </div>
                            )}
                            
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
                                className={`pair-btn ${isPairing ? 'pairing' : ''} ${isSuccess ? 'success' : ''} ${isDisabledByOther ? 'disabled-other' : ''} ${needsRepair && !isPairing && !isSuccess ? 're-pair' : ''}`}
                                onClick={handlePairClick}
                                disabled={isPairing || isSuccess || isDisabledByOther}
                              >
                                {isPairing ? 'Pairing...' : isSuccess ? 'Paired!' : isDisabledByOther ? 'Wait...' : needsRepair ? 'Re-pair' : 'Pair'}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                
                {/* Terminal Output - Right side (40%) */}
                {terminalLogs.length > 0 && (
                  <div className="terminal-output">
                    <div className="terminal-header">
                      <span className="terminal-title"><span className="terminal-icon">&gt;_</span> {t('terminal.title')}</span>
                      <button 
                        className="terminal-clear-btn"
                        onClick={() => setTerminalLogs([])}
                      >
                        {t('terminal.clear')}
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
                                <span className="result-success">✓ {t('discover.foundDrones', { count: log.dronesFound })}</span>
                              ) : log.error ? (
                                <span className="result-error">✕ {t('discover.discoveryFailed')}</span>
                              ) : (
                                <span className="result-empty">○ {t('discover.noDronesFound')}</span>
                              )}
                            </div>
                          )}
                          
                          {/* Result summary for pair */}
                          {log.type === 'pair' && log.status !== 'running' && (
                            <div className="terminal-result">
                              {log.result ? (
                                <span className="result-success">✓ {t('pairing.pairCommandSent', { id: log.droneId })}</span>
                              ) : (
                                <span className="result-error">✕ {t('pairing.commandFailed')}</span>
                              )}
                            </div>
                          )}
                          
                          {/* Telemetry check result */}
                          {log.type === 'telemetry-check' && (
                            <div className="terminal-result">
                              {log.hasTelemetry ? (
                                <span className="result-success">✓ {t('pairing.telemetryReceived', { id: log.droneId })}</span>
                              ) : (
                                <span className="result-error">✕ {t('pairing.noTelemetryReceived', { id: log.droneId })}</span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {!isDiscovering && discoveredDrones.length === 0 && terminalLogs.length === 0 && !discoverError && (
              <div className="discover-empty">
                <span className="empty-icon">◇</span>
                <span>{t('discover.emptyHint')}</span>
              </div>
            )}
          </section>
        </div>
      )}
      
      {/* Confirm Modal */}
      {confirmModal && (
        <div className="confirm-modal-overlay" onClick={confirmModal.onCancel}>
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-modal-header">
              <span className="confirm-modal-icon">⚠</span>
              <h3>{confirmModal.title}</h3>
            </div>
            <div className="confirm-modal-body">
              <p>{confirmModal.message}</p>
            </div>
            <div className="confirm-modal-actions">
              <button className="confirm-modal-btn cancel" onClick={confirmModal.onCancel}>
                {t('common.cancel')}
              </button>
              <button className="confirm-modal-btn confirm" onClick={confirmModal.onConfirm}>
                {t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* TAB: Cameras (MediaMTX) */}
      {activeTab === 'cameras' && (
        <div className="tab-content">
          <section className="cameras-section">
            <MediaMTXPanel profiles={profiles} />
          </section>
        </div>
      )}
      
      {/* Camera Scanner Modal */}
      {cameraScannerDrone && (
        <div className="modal-overlay" onClick={() => setCameraScannerDrone(null)}>
          <div className="modal-content camera-scanner-container" onClick={(e) => e.stopPropagation()}>
            <CameraScannerModal
              droneId={cameraScannerDrone.droneId}
              droneIp={cameraScannerDrone.droneIp}
              onSave={handleSaveCameraSettings}
              onClose={() => setCameraScannerDrone(null)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default DroneProfileEditor

