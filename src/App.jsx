import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { GoogleMap, useJsApiLoader, Marker, Polyline } from '@react-google-maps/api'
import { useTranslation } from 'react-i18next'
import './App.css'
import config from './config'
import { useTheme } from './hooks/useTheme'
import CameraFeed from './components/CameraFeed'

// API Configuration from config
const API_BASE_URL = config.apiUrl

// Google Maps dark style for HUD aesthetic
const mapStyles = [
  { elementType: "geometry", stylers: [{ color: "#1a1a1a" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a1a1a" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#4a5a6a" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2a2a2a" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#5a6a7a" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0a1520" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#3a5a7a" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#1a2a1a" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#1a2a1a" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#1a1a1a" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
]

// Initial telemetry state (from real data)
const createInitialState = () => ({
  // GPS data
  latitude: 0,
  longitude: 0,
  altitude: 0,
  heading: 0,
  groundspeed: 0,
  satellites: 0,
  // Battery data
  batt_v: 0,
  // State data
  speed: 0,
  dist: 0,
  power: 0,
  fs: 0,
  f1: false,
  f2: false,
  md: 0,
  md_str: 'OFFLINE',
  telemetry_time: 0,
  // Meta
  timestamp: Date.now(),
  pathHistory: [],
  connected: false,
})

function App() {
  const { t } = useTranslation()
  
  // Get drone ID from URL params (can be numeric string like "1604695971")
  const { droneId: droneIdParam } = useParams()
  const droneId = droneIdParam || '1'
  
  // Drone profile state
  const [droneProfile, setDroneProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)
  
  // Fetch drone profile
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/profiles`)
        const data = await response.json()
        if (data.success && data.profiles[droneId]) {
          setDroneProfile(data.profiles[droneId])
        }
      } catch (error) {
        console.error('Failed to fetch drone profile:', error)
      } finally {
        setProfileLoading(false)
      }
    }
    fetchProfile()
  }, [droneId])
  
  const [telemetry, setTelemetry] = useState(createInitialState)
  const [latestTelemetryData, setLatestTelemetryData] = useState(null)
  const [isActive, setIsActive] = useState(false) // Whether this drone is actively controlled
  
  // Theme management - reacts to telemetry data
  const { currentTheme } = useTheme(latestTelemetryData)
  
  // Poll active status for this drone
  // Active control is EXCLUSIVE: only one drone can be active at a time
  // Backend enforces 10-second timeout and exclusive active logic
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
        
        if (data.success && data.activeDrones) {
          // Only this drone gets active=true if it's the currently active one
          setIsActive(data.activeDrones[droneId]?.active === true)
        }
      } catch (error) {
        // Silently ignore
      }
    }
    
    fetchActiveStatus()
    const interval = setInterval(fetchActiveStatus, 300) // Fast polling for responsive active status
    
    return () => {
      isMounted = false
      controller.abort()
      clearInterval(interval)
    }
  }, [droneId])
  
  // Check for stale telemetry data - mark offline if no data in 1 minute
  useEffect(() => {
    const ONLINE_TIMEOUT_MS = 60000 // 1 minute
    
    const checkStale = () => {
      setTelemetry(prev => {
        if (prev.connected && prev.timestamp && Date.now() - prev.timestamp > ONLINE_TIMEOUT_MS) {
          return { ...prev, connected: false }
        }
        return prev
      })
    }
    
    // Check every 5 seconds
    const interval = setInterval(checkStale, 5000)
    return () => clearInterval(interval)
  }, [])

  // Handle telemetry updates from TelemetryLog
  const handleTelemetryUpdate = useCallback((data) => {
    setLatestTelemetryData(data)
    
    setTelemetry(prev => {
      const updated = { ...prev, connected: true, timestamp: Date.now() }
      
      // Merge GPS data
      if (data.type === 'gps') {
        updated.latitude = data.latitude ?? prev.latitude
        updated.longitude = data.longitude ?? prev.longitude
        updated.altitude = data.altitude ?? prev.altitude
        updated.heading = data.heading ?? prev.heading
        updated.groundspeed = data.groundspeed ?? prev.groundspeed
        updated.satellites = data.satellites ?? prev.satellites
        
        // Update path history
        if (data.latitude && data.longitude) {
          updated.pathHistory = [
            ...prev.pathHistory.slice(-49),
            { lat: data.latitude, lng: data.longitude }
          ]
        }
      }
      
      // Merge Battery data
      if (data.type === 'batt') {
        updated.batt_v = data.batt_v ?? prev.batt_v
      }
      
      // Merge State data
      if (data.type === 'state') {
        updated.speed = data.speed ?? prev.speed
        updated.dist = data.dist ?? prev.dist
        updated.power = data.power ?? prev.power
        updated.fs = data.fs ?? prev.fs
        updated.f1 = data.f1 ?? prev.f1
        updated.f2 = data.f2 ?? prev.f2
        updated.md = data.md ?? prev.md
        updated.md_str = data.md_str ?? prev.md_str
        updated.telemetry_time = data.telemetry_time ?? prev.telemetry_time
      }
      
      return updated
    })
  }, [])

  const directions = [
    t('compass.n'), t('compass.ne'), t('compass.e'), t('compass.se'),
    t('compass.s'), t('compass.sw'), t('compass.w'), t('compass.nw')
  ]
  const directionIndex = Math.round(telemetry.heading / 45) % 8

  // Get camera URLs from profile or use defaults
  const frontCameraUrl = droneProfile?.frontCameraUrl || '/nginxhls/cam1/index.m3u8'
  const rearCameraUrl = droneProfile?.rearCameraUrl || '/nginxhls/cam2/index.m3u8'
  // Drone number is array index + 1
  const droneNumber = (droneProfile?._index ?? 0) + 1
  const droneName = droneProfile?.name || `Drone #${droneNumber}`

  return (
    <div className="hud-container">
      {/* Full-screen Front Camera Background */}
      <div className="main-camera-bg">
        <CameraFeed streamUrl={frontCameraUrl} />
      </div>

      {/* HUD Overlay */}
      <div className="hud-overlay">
        {/* Top Bar */}
        <div className="hud-top-bar">
          <div className="hud-logo">
            <Link to="/" className="back-to-dashboard" title={t('nav.backToDashboard')}>←</Link>
            <span className="logo-icon">◈</span>
            <span className="logo-text">{t('osd.title', { name: droneName.toUpperCase() })}</span>
            <span className="logo-version">{t('osd.version')}</span>
          </div>
          
          <div className="hud-status-center">
            <span className={`status-mode ${telemetry.connected ? telemetry.md_str.toLowerCase().replace(/\s+/g, '-') : 'offline'}`}>
              {telemetry.connected ? telemetry.md_str : t('common.offline')}
            </span>
            {isActive && <span className="status-active">{t('common.active')}</span>}
          </div>

          <div className="hud-right-indicators">
            <span className={`status-fs ${telemetry.fs > 0 ? 'active' : ''}`}>FS:{telemetry.fs}</span>
            <BatteryIndicator voltage={telemetry.batt_v} />
          </div>
        </div>

        {/* Fuse Switches & Rear View Mirror */}
        <div className="hud-mirror-section">
          <FuseSwitch label="F1" armed={telemetry.f1} />
          <div className="rear-mirror">
            <div className="mirror-frame">
              <CameraFeed streamUrl={rearCameraUrl} variant="mirror" />
              <span className="mirror-label">{t('osd.rear')}</span>
            </div>
          </div>
          <FuseSwitch label="F2" armed={telemetry.f2} />
        </div>

        {/* Heading Tape or Warning Banner */}
        {(telemetry.f1 && telemetry.f2) ? (
          <div className="hud-warning-banner">
            <WarningBanner />
          </div>
        ) : (
          <div className="hud-heading-tape">
            <HeadingTape heading={telemetry.heading} />
          </div>
        )}

        {/* Left Panel - Compass & Satellites */}
        <div className="hud-left-panel">
          <HudCompass heading={telemetry.heading} direction={directions[directionIndex]} />
          <SatelliteIndicator satellites={telemetry.satellites} />
        </div>

        {/* Right Panel - Speedometer & Power */}
        <div className="hud-right-panel">
          <Speedometer speed={telemetry.speed} dist={telemetry.dist} />
          <PowerIndicator power={telemetry.power} />
        </div>

        {/* Map with integrated Altimeter */}
        <div className="hud-minimap-container">
          <MapPanel 
            pathHistory={telemetry.pathHistory} 
            heading={telemetry.heading}
            lat={telemetry.latitude}
            lng={telemetry.longitude}
            altitude={telemetry.altitude}
          />
        </div>

        {/* Center Crosshair */}
        <div className="hud-crosshair">
          <div className="crosshair-h"></div>
          <div className="crosshair-v"></div>
          <div className="crosshair-center">◇</div>
        </div>

        {/* Telemetry Log */}
        <div className="hud-telemetry-log-container">
          <TelemetryLog droneId={droneId} onTelemetryUpdate={handleTelemetryUpdate} />
        </div>

        {/* Active Control Icon - above telemetry strip */}
        {isActive && (
          <div className="hud-active-control-icon">
            <svg viewBox="0 0 50 50" className="active-control-svg">
              {/* Signal waves */}
              <path className="signal-wave wave-1" d="M 22 8 Q 25 5, 28 8" />
              <path className="signal-wave wave-2" d="M 19 5 Q 25 0, 31 5" />
              <path className="signal-wave wave-3" d="M 16 2 Q 25 -5, 34 2" />
              {/* Antenna */}
              <line x1="25" y1="14" x2="25" y2="8" className="antenna" />
              <circle cx="25" cy="7" r="1.5" className="antenna-tip" />
              {/* Controller */}
              <rect x="12" y="14" width="26" height="18" rx="3" className="controller-body" />
              {/* Joysticks */}
              <circle cx="19" cy="23" r="4" className="joystick-base-small" />
              <circle cx="19" cy="23" r="2" className="joystick-stick-left" />
              <circle cx="31" cy="23" r="4" className="joystick-base-small" />
              <circle cx="31" cy="23" r="2" className="joystick-stick-right" />
              {/* Indicator */}
              <rect x="23" y="17" width="4" height="2" rx="1" className="controller-indicator" />
            </svg>
          </div>
        )}

        {/* Bottom Telemetry Strip */}
        <div className="hud-bottom-strip">
          <TelemetryStrip telemetry={telemetry} />
        </div>
      </div>
    </div>
  )
}

// Battery Indicator (Voltage-based)
function BatteryIndicator({ voltage }) {
  // Voltage thresholds: 37+ = good, 35+ = warning, <35 = critical
  const getClass = () => {
    if (voltage >= 37) return 'good'
    if (voltage >= 35) return 'warning'
    return 'critical'
  }

  // Fill percentage based on voltage (33V empty, 42V full)
  const minV = 33
  const maxV = 42
  const fillPercent = Math.max(0, Math.min(100, ((voltage - minV) / (maxV - minV)) * 100))

  return (
    <div className={`battery-indicator ${getClass()}`}>
      <span className="battery-voltage">{voltage.toFixed(1)}V</span>
      <div className="battery-icon-mini">
        <div className="battery-fill-mini" style={{ width: `${fillPercent}%` }}></div>
      </div>
    </div>
  )
}

// Fuse Switch Indicator (read-only, driven by telemetry)
function FuseSwitch({ label, armed }) {
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

// HUD Compass
function HudCompass({ heading, direction }) {
  const { t } = useTranslation()
  return (
    <div className="hud-compass">
      <div className="compass-outer">
        <div className="compass-ring" style={{ transform: `rotate(${-heading}deg)` }}>
          <span className="compass-n">{t('compass.n')}</span>
          <span className="compass-e">{t('compass.e')}</span>
          <span className="compass-s">{t('compass.s')}</span>
          <span className="compass-w">{t('compass.w')}</span>
        </div>
        <div className="compass-pointer">▲</div>
      </div>
      <div className="compass-readout">
        <span className="compass-deg">{heading.toFixed(0)}°</span>
        <span className="compass-dir">{direction}</span>
      </div>
    </div>
  )
}

// Satellite Indicator (replaces Altitude)
function SatelliteIndicator({ satellites }) {
  const { t } = useTranslation()
  const maxSatellites = 16
  const satArray = Array.from({ length: maxSatellites }, (_, i) => i < satellites)
  
  // Determine signal quality
  const getQuality = () => {
    if (satellites >= 10) return 'excellent'
    if (satellites >= 6) return 'good'
    if (satellites >= 4) return 'weak'
    return 'poor'
  }

  return (
    <div className="hud-satellites">
      <div className="sat-label"><span className="sat-icon">◎</span> {t('osd.sat')}</div>
      <div className="sat-grid">
        {satArray.map((active, i) => (
          <div 
            key={i} 
            className={`sat-dot ${active ? 'active' : ''}`}
            style={{ 
              animationDelay: active ? `${i * 50}ms` : undefined 
            }}
          />
        ))}
      </div>
      <div className="sat-info">
        <span className={`sat-count ${getQuality()}`}>{satellites}</span>
        <span className="sat-quality">{t(`satellites.${getQuality()}`)}</span>
      </div>
    </div>
  )
}

// Speedometer (km/h from wheel speed) with Odometer
function Speedometer({ speed, dist }) {
  const { t } = useTranslation()
  const speedKmh = speed
  const maxSpeed = 60 // max km/h for display
  const angle = Math.min((speedKmh / maxSpeed) * 240, 240) - 120 // -120 to +120 degrees

  // Odometer: format distance in meters to 5-digit display
  const odoValue = Math.floor(dist || 0)
  const odoDigits = String(odoValue).padStart(5, '0').split('')

  const ticks = []
  for (let i = 0; i <= 60; i += 10) {
    const tickAngle = (i / maxSpeed) * 240 - 120
    const isMain = i % 20 === 0
    const radians = (tickAngle - 90) * (Math.PI / 180)
    const innerRadius = isMain ? 52 : 56
    const outerRadius = 62
    const x1 = 70 + innerRadius * Math.cos(radians)
    const y1 = 70 + innerRadius * Math.sin(radians)
    const x2 = 70 + outerRadius * Math.cos(radians)
    const y2 = 70 + outerRadius * Math.sin(radians)
    
    ticks.push(
      <g key={i}>
        <line 
          x1={x1} y1={y1} x2={x2} y2={y2} 
          stroke={i <= speedKmh ? "var(--theme-accent-primary)" : "var(--theme-text-muted)"} 
          strokeWidth={isMain ? 2 : 1}
        />
        {isMain && (
          <text 
            x={70 + 42 * Math.cos(radians)} 
            y={70 + 42 * Math.sin(radians)} 
            fill="var(--theme-text-secondary)" 
            fontSize="8" 
            textAnchor="middle" 
            dominantBaseline="middle"
          >
            {i}
          </text>
        )}
      </g>
    )
  }

  return (
    <div className="speedometer">
      <svg viewBox="0 0 140 100" className="speedo-svg">
        {/* Background arc */}
        <path 
          d="M 14 70 A 56 56 0 0 1 126 70" 
          fill="none" 
          stroke="var(--theme-hud-border)" 
          strokeWidth="3"
        />
        {/* Ticks */}
        {ticks}
        {/* Needle */}
        <g transform={`rotate(${angle}, 70, 70)`}>
          <polygon 
            points="70,25 67,70 70,75 73,70" 
            fill="var(--theme-status-danger)"
            filter="drop-shadow(0 0 3px var(--theme-status-danger))"
          />
        </g>
        {/* Center cap */}
        <circle cx="70" cy="70" r="8" fill="var(--theme-bg-dark)" stroke="var(--theme-accent-primary)" strokeWidth="2"/>
      </svg>
      <div className="speedo-readout">
        <span className="speedo-value">{speedKmh.toFixed(0)}</span>
        <span className="speedo-unit">{t('osd.speedUnit')}</span>
      </div>
      {/* Odometer */}
      <div className="odometer">
        <div className="odo-display">
          {odoDigits.map((digit, i) => (
            <div key={i} className="odo-digit">
              <span className="odo-num">{digit}</span>
            </div>
          ))}
        </div>
        <span className="odo-unit">{t('osd.distanceUnit')}</span>
      </div>
    </div>
  )
}

// Power Indicator (0, 1, 2 levels)
function PowerIndicator({ power }) {
  const { t } = useTranslation()
  const levels = [0, 1, 2]
  const labels = [t('power.off'), t('power.eco'), t('power.max')]

  return (
    <div className="power-indicator">
      <div className="power-label">{t('osd.pwr')}</div>
      <div className="power-bars">
        {levels.map(level => (
          <div 
            key={level} 
            className={`power-bar ${power >= level ? 'active' : ''} level-${level}`}
          />
        ))}
      </div>
      <div className={`power-mode level-${power}`}>{labels[power] || t('power.off')}</div>
    </div>
  )
}

// Map Panel with Google Maps satellite view
function MapPanel({ pathHistory, heading, lat, lng, altitude }) {
  const { t } = useTranslation()
  const [zoom, setZoom] = useState(17) // Google Maps zoom level (1-21)
  const mapRef = useRef(null)
  
  // Load Google Maps
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: config.googleMapsApiKey,
    id: 'google-map-script'
  })
  
  // Map container style
  const containerStyle = {
    width: '100%',
    height: '100%',
    borderRadius: '4px'
  }
  
  // Center position
  const center = useMemo(() => ({
    lat: lat || 0,
    lng: lng || 0
  }), [lat, lng])
  
  // Path for polyline
  const pathCoords = useMemo(() => 
    pathHistory.map(p => ({ lat: p.lat, lng: p.lng })),
    [pathHistory]
  )
  
  // Map options
  const options = useMemo(() => ({
    mapTypeId: 'satellite',
    styles: mapStyles,
    disableDefaultUI: true,
    zoomControl: false,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    rotateControl: false,
    scaleControl: false,
    clickableIcons: false,
    gestureHandling: 'none', // Disable user interaction
    heading: heading || 0,
    tilt: 0
  }), [heading])
  
  // Custom arrow icon for marker
  const arrowIcon = useMemo(() => ({
    path: 'M 0,-20 L -12,12 L 0,4 L 12,12 Z',
    fillColor: '#00ff88',
    fillOpacity: 1,
    strokeColor: '#000',
    strokeWeight: 2,
    scale: 1,
    rotation: heading || 0,
    anchor: { x: 0, y: 0 }
  }), [heading])
  
  // Polyline options
  const polylineOptions = {
    strokeColor: '#00ff88',
    strokeOpacity: 0.8,
    strokeWeight: 3,
    geodesic: true
  }
  
  const zoomIn = () => setZoom(prev => Math.min(21, prev + 1))
  const zoomOut = () => setZoom(prev => Math.max(1, prev - 1))
  
  // Keep map centered on drone position (instant, no animation)
  useEffect(() => {
    if (mapRef.current && lat && lng) {
      mapRef.current.setCenter({ lat, lng })
    }
  }, [lat, lng])
  
  // Calculate scale based on zoom
  const getScaleText = () => {
    const scales = {
      21: '5m', 20: '10m', 19: '20m', 18: '50m', 17: '100m',
      16: '200m', 15: '500m', 14: '1km', 13: '2km', 12: '5km',
      11: '10km', 10: '20km', 9: '50km', 8: '100km'
    }
    return scales[zoom] || `${zoom}`
  }

  return (
    <div className="map-panel">
      <div className="map-header">
        <span className="map-title">{t('osd.map')}</span>
        <span className="map-alt">{t('osd.altitude')}: {altitude.toFixed(0)}m</span>
        <span className="map-coords">
          {lat ? lat.toFixed(6) : '-.------'}°, {lng ? lng.toFixed(6) : '-.------'}°
        </span>
      </div>
      
      <div className="map-body">
        {/* Zoom Controls */}
        <div className="map-zoom-controls">
          <button className="zoom-btn" onClick={zoomIn} disabled={zoom >= 21}>+</button>
          <span className="zoom-level">{getScaleText()}</span>
          <button className="zoom-btn" onClick={zoomOut} disabled={zoom <= 8}>−</button>
        </div>
        
        {/* Google Map */}
        {loadError && (
          <div className="map-error">
            <span>{t('osd.mapError')}</span>
            <small>{t('osd.checkApiKey')}</small>
          </div>
        )}
        
        {!isLoaded && !loadError && (
          <div className="map-loading">
            <span>{t('osd.loadingMap')}</span>
          </div>
        )}
        
        {isLoaded && !loadError && (
          <GoogleMap
            mapContainerStyle={containerStyle}
            center={center}
            zoom={zoom}
            options={options}
            onLoad={map => { mapRef.current = map }}
          >
            {/* Path trail */}
            {pathCoords.length > 1 && (
              <Polyline path={pathCoords} options={polylineOptions} />
            )}
            
            {/* Position marker with arrow */}
            {lat && lng && (
              <Marker
                position={center}
                icon={arrowIcon}
              />
            )}
          </GoogleMap>
        )}
        
        {/* Theme color overlay on map */}
        <div className="map-theme-overlay"></div>
      </div>
    </div>
  )
}

// Heading Tape
function HeadingTape({ heading }) {
  const ticks = []
  for (let i = -6; i <= 6; i++) {
    const deg = Math.round((heading + i * 10) / 10) * 10
    const normalizedDeg = ((deg % 360) + 360) % 360
    const offset = (deg - heading) * 4
    const isMain = normalizedDeg % 30 === 0
    ticks.push(
      <div 
        key={i} 
        className={`htape-tick ${isMain ? 'main' : ''}`}
        style={{ left: `calc(50% + ${offset}px)` }}
      >
        {isMain && <span className="htape-label">{normalizedDeg}</span>}
        <div className="htape-mark"></div>
      </div>
    )
  }

  return (
    <div className="heading-tape">
      <div className="htape-container">
        {ticks}
      </div>
      <div className="htape-indicator">▼</div>
      <div className="htape-value">{heading.toFixed(0)}°</div>
    </div>
  )
}

// Warning Banner - shown when both fuses are armed
function WarningBanner() {
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

// Telemetry Strip - now using real telemetry data
function TelemetryStrip({ telemetry }) {
  const { t } = useTranslation()
  const [isCollapsed, setIsCollapsed] = useState(true) // Default collapsed
  
  // Format telemetry_time as clock
  const formatClock = (timestamp) => {
    if (!timestamp) return '--:--:--'
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit'
    })
  }

  return (
    <div className={`telemetry-strip ${isCollapsed ? 'collapsed' : ''}`}>
      <button 
        className="telem-toggle"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        {isCollapsed ? `▲ ${t('osd.telemetry')}` : `▼ ${t('osd.telemetry')}`}
      </button>
      
      {!isCollapsed && (
        <div className="telem-content">
          <div className="telem-item">
            <span className="telem-label">{t('telemetry.lat')}</span>
            <span className="telem-value">{telemetry.latitude ? telemetry.latitude.toFixed(6) : '-.------'}°</span>
          </div>
          <div className="telem-item">
            <span className="telem-label">{t('telemetry.lng')}</span>
            <span className="telem-value">{telemetry.longitude ? telemetry.longitude.toFixed(6) : '-.------'}°</span>
          </div>
          <div className="telem-item">
            <span className="telem-label">{t('telemetry.alt')}</span>
            <span className="telem-value">{telemetry.altitude.toFixed(0)}m</span>
          </div>
          <div className="telem-item">
            <span className="telem-label">{t('telemetry.hdg')}</span>
            <span className="telem-value">{telemetry.heading.toFixed(0)}°</span>
          </div>
          <div className="telem-item">
            <span className="telem-label">{t('telemetry.gs')}</span>
            <span className="telem-value">{telemetry.groundspeed.toFixed(1)}</span>
          </div>
          <div className="telem-item">
            <span className="telem-label">{t('telemetry.spd')}</span>
            <span className="telem-value">{telemetry.speed.toFixed(1)}</span>
          </div>
          <div className="telem-item">
            <span className="telem-label">{t('telemetry.dist')}</span>
            <span className="telem-value">{telemetry.dist.toFixed(0)}m</span>
          </div>
          <div className="telem-item">
            <span className="telem-label">{t('telemetry.bat')}</span>
            <span className="telem-value">{telemetry.batt_v.toFixed(1)}V</span>
          </div>
          <div className="telem-item">
            <span className="telem-label">{t('telemetry.sat')}</span>
            <span className="telem-value">{telemetry.satellites}</span>
          </div>
          <div className="telem-item">
            <span className="telem-label">{t('telemetry.mode')}</span>
            <span className="telem-value">{telemetry.md_str}</span>
          </div>
          <div className="telem-item">
            <span className="telem-label">{t('telemetry.time')}</span>
            <span className="telem-value">{formatClock(telemetry.telemetry_time)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// Animated Cardiogram Component
function AnimatedCardiogram({ heartbeats }) {
  const canvasRef = useRef(null)
  const animationRef = useRef(null)
  const offsetRef = useRef(0)
  
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    const width = canvas.width
    const height = canvas.height
    const centerY = height / 2
    const scrollSpeed = 0.5 // pixels per frame
    
    const animate = () => {
      offsetRef.current += scrollSpeed
      
      // Clear canvas
      ctx.clearRect(0, 0, width, height)
      
      // Draw baseline
      ctx.strokeStyle = 'rgba(0, 255, 136, 0.3)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, centerY)
      ctx.lineTo(width, centerY)
      ctx.stroke()
      
      // Draw heartbeats
      const now = Date.now()
      heartbeats.forEach(hb => {
        const age = now - hb.time
        const maxAge = 5000 // 5 seconds to cross the screen
        if (age > maxAge) return
        
        // Position: starts at right (width), moves to left (0)
        const progress = age / maxAge
        const x = width * (1 - progress)
        
        // Amplitude decreases as it moves left
        const amplitude = (1 - progress * 0.8) * 15
        
        // Draw heartbeat spike
        ctx.strokeStyle = `rgba(0, 255, 136, ${1 - progress * 0.7})`
        ctx.lineWidth = 2
        ctx.beginPath()
        
        // ECG-like waveform
        const spikeWidth = 25
        ctx.moveTo(x - spikeWidth, centerY)
        ctx.lineTo(x - spikeWidth + 5, centerY)
        ctx.lineTo(x - spikeWidth + 8, centerY - amplitude * 0.3)
        ctx.lineTo(x - spikeWidth + 11, centerY + amplitude * 0.5)
        ctx.lineTo(x - spikeWidth + 14, centerY - amplitude)
        ctx.lineTo(x - spikeWidth + 17, centerY + amplitude * 0.8)
        ctx.lineTo(x - spikeWidth + 20, centerY)
        ctx.lineTo(x, centerY)
        ctx.stroke()
      })
      
      animationRef.current = requestAnimationFrame(animate)
    }
    
    animate()
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [heartbeats])
  
  return (
    <canvas 
      ref={canvasRef} 
      className="tlog-cardiogram-canvas"
      width={200}
      height={40}
    />
  )
}

// Telemetry Log Component - Real-time database telemetry
function TelemetryLog({ droneId, onTelemetryUpdate }) {
  const { t } = useTranslation()
  const [records, setRecords] = useState([])
  const [connectionStatus, setConnectionStatus] = useState('connecting')
  const [isCollapsed, setIsCollapsed] = useState(true) // Default collapsed
  const [heartbeats, setHeartbeats] = useState([]) // Track heartbeat events with timestamps
  const lastIdRef = useRef(0)

  const formatTimestamp = useCallback((timestamp) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit'
    })
  }, [])

  const formatTelemetryData = useCallback((data) => {
    const fields = []
    const type = data.type || '?'
    
    // Add type indicator (no icons)
    fields.push(`[${type.toUpperCase()}]`)
    
    // GPS type fields
    if (type === 'gps') {
      if (data.latitude !== undefined) fields.push(`LAT:${data.latitude.toFixed(5)}`)
      if (data.longitude !== undefined) fields.push(`LNG:${data.longitude.toFixed(5)}`)
      if (data.groundspeed !== undefined) fields.push(`GS:${data.groundspeed}`)
      if (data.heading !== undefined) fields.push(`HDG:${data.heading.toFixed(0)}°`)
      if (data.altitude !== undefined) fields.push(`ALT:${data.altitude}`)
      if (data.satellites !== undefined) fields.push(`SAT:${data.satellites}`)
    }
    
    // Battery type fields
    if (type === 'batt') {
      if (data.batt_v !== undefined) fields.push(`${data.batt_v}V`)
    }
    
    // State type fields
    if (type === 'state') {
      if (data.md_str !== undefined) fields.push(data.md_str)
      if (data.speed !== undefined) fields.push(`SPD:${data.speed}`)
      if (data.dist !== undefined) fields.push(`DST:${data.dist}`)
      if (data.power !== undefined) fields.push(`PWR:${data.power}`)
    }
    
    return fields.join(' ')
  }, [])

  // Add a new heartbeat event
  const triggerHeartbeat = useCallback(() => {
    const now = Date.now()
    setHeartbeats(prev => {
      // Keep only heartbeats from last 5 seconds
      const recent = prev.filter(hb => now - hb.time < 5000)
      return [...recent, { time: now, id: now }]
    })
  }, [])

  useEffect(() => {
    let isMounted = true
    let pollInterval = null
    let controller = new AbortController()

    const fetchTelemetry = async () => {
      // Abort previous request if still pending
      controller.abort()
      controller = new AbortController()
      
      try {
        const droneFilter = droneId ? `&droneId=${droneId}` : ''
        const url = `${API_BASE_URL}/api/telemetry?lastId=${lastIdRef.current}&limit=20${droneFilter}`
        const response = await fetch(url, { signal: controller.signal })
        
        if (!response.ok) throw new Error('Failed to fetch')

        const data = await response.json()
        
        if (!isMounted) return

        if (data.success) {
          setConnectionStatus('connected')
          
          if (data.records.length > 0) {
            // Update lastId ref first
            lastIdRef.current = data.latestId
            
            // Stack behavior: new on top, limit to 20
            setRecords(prev => [...data.records, ...prev].slice(0, 20))
            
            // Trigger heartbeat animation when new data arrives
            triggerHeartbeat()
            
            // Process ALL records (oldest to newest) so each type updates its fields
            // This ensures batt, gps, and state records all get merged into app state
            if (onTelemetryUpdate) {
              // Reverse to process oldest first, newest last (most recent wins)
              const recordsToProcess = data.records.slice().reverse()
              recordsToProcess.forEach(record => {
                onTelemetryUpdate(record.data)
              })
            }
          }
        }
      } catch (error) {
        if (error.name !== 'AbortError' && isMounted) {
          setConnectionStatus('disconnected')
        }
      }
    }

    fetchTelemetry()
    pollInterval = setInterval(fetchTelemetry, 300)

    return () => {
      isMounted = false
      controller.abort()
      if (pollInterval) clearInterval(pollInterval)
    }
  }, [droneId, onTelemetryUpdate, triggerHeartbeat])

  return (
    <div className={`telemetry-log ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="tlog-header" onClick={() => setIsCollapsed(!isCollapsed)}>
        <span className="tlog-title">{isCollapsed ? '▶' : '▼'} {t('osd.telemetryLog')}</span>
        <span className={`tlog-status ${connectionStatus}`}>
          {connectionStatus === 'connected' ? `● ${t('osd.live')}` : connectionStatus === 'connecting' ? `○ ${t('osd.connecting')}` : `○ ${t('common.off')}`}
        </span>
      </div>
      
      {isCollapsed ? (
        <div className="tlog-heartbeat-container">
          <AnimatedCardiogram heartbeats={heartbeats} />
        </div>
      ) : (
        <div className="tlog-console">
          {records.length === 0 ? (
            <div className="tlog-empty">{t('osd.waiting')}</div>
          ) : (
            records.map(record => (
              <div key={record.id} className="tlog-entry">
                <span className="tlog-time">{formatTimestamp(record.timestamp)}</span>
                <span className="tlog-data">{formatTelemetryData(record.data)}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default App
