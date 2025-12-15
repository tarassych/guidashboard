import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { GoogleMap, useJsApiLoader, Marker, Polyline } from '@react-google-maps/api'
import './App.css'
import config from './config'
import { useTheme } from './hooks/useTheme'

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
  const [telemetry, setTelemetry] = useState(createInitialState)
  const [latestTelemetryData, setLatestTelemetryData] = useState(null)
  
  // Manual fuse overrides: null = use telemetry, true = manual armed
  const [fuseOverrides, setFuseOverrides] = useState({ f1: null, f2: null })
  
  // Get effective fuse states (override or telemetry)
  const f1Armed = fuseOverrides.f1 !== null ? fuseOverrides.f1 : telemetry.f1
  const f2Armed = fuseOverrides.f2 !== null ? fuseOverrides.f2 : telemetry.f2
  
  // Create effective telemetry data for theme switching (includes manual fuse overrides)
  // Use useMemo to ensure stable reference and proper change detection
  const effectiveTelemetryData = useMemo(() => ({
    ...(latestTelemetryData || {}),
    f1: f1Armed,
    f2: f2Armed
  }), [latestTelemetryData, f1Armed, f2Armed])
  
  // Theme management - reacts to effective telemetry data (with fuse overrides)
  const { currentTheme } = useTheme(effectiveTelemetryData)
  
  // Toggle fuse override (3-state: null -> true -> false -> null)
  // null = use telemetry, true = manual ON (armed), false = manual OFF (safe)
  const toggleFuseOverride = useCallback((fuse) => {
    setFuseOverrides(prev => {
      const current = prev[fuse]
      let next
      if (current === null) {
        next = true  // telemetry -> manual ON
      } else if (current === true) {
        next = false // manual ON -> manual OFF
      } else {
        next = null  // manual OFF -> back to telemetry
      }
      return { ...prev, [fuse]: next }
    })
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

  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  const directionIndex = Math.round(telemetry.heading / 45) % 8

  return (
    <div className="hud-container">
      {/* Full-screen Front Camera Background */}
      <div className="main-camera-bg">
        <CameraFeed streamUrl="/nginxhls/cam1/index.m3u8" />
      </div>

      {/* HUD Overlay */}
      <div className="hud-overlay">
        {/* Top Bar */}
        <div className="hud-top-bar">
          <div className="hud-logo">
            <span className="logo-icon">◈</span>
            <span className="logo-text">RATERA DRONE OSD</span>
            <span className="logo-version">v1.0</span>
          </div>
          
          <div className="hud-status-center">
            <span className={`status-mode ${telemetry.connected ? telemetry.md_str.toLowerCase().replace(/\s+/g, '-') : 'offline'}`}>
              {telemetry.connected ? telemetry.md_str : 'OFFLINE'}
            </span>
          </div>

          <div className="hud-right-indicators">
            <span className={`status-fs ${telemetry.fs > 0 ? 'active' : ''}`}>FS:{telemetry.fs}</span>
            <BatteryIndicator voltage={telemetry.batt_v} />
          </div>
        </div>

        {/* Fuse Switches & Rear View Mirror */}
        <div className="hud-mirror-section">
          <FuseSwitch 
            label="F1" 
            armed={f1Armed} 
            isManual={fuseOverrides.f1 !== null}
            onClick={() => toggleFuseOverride('f1')} 
          />
          <div className="rear-mirror">
            <div className="mirror-frame">
              <CameraFeed streamUrl="nginxhls/cam2/index.m3u8" variant="mirror" />
              <span className="mirror-label">REAR</span>
            </div>
          </div>
          <FuseSwitch 
            label="F2" 
            armed={f2Armed} 
            isManual={fuseOverrides.f2 !== null}
            onClick={() => toggleFuseOverride('f2')} 
          />
        </div>

        {/* Heading Tape or Warning Banner */}
        {(f1Armed && f2Armed) ? (
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
          <TelemetryLog onTelemetryUpdate={handleTelemetryUpdate} />
        </div>

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

// Fuse Switch Indicator
function FuseSwitch({ label, armed, isManual, onClick }) {
  const getTooltip = () => {
    if (!isManual) return 'Click to arm manually'
    if (armed) return 'Click to disarm manually'
    return 'Click to return to telemetry'
  }
  
  return (
    <div className={`fuse-switch ${armed ? 'armed' : 'safe'} ${isManual ? 'manual' : ''}`}>
      <div className="fuse-label">{label}</div>
      <div className="fuse-icon" onClick={onClick} title={getTooltip()}>
        <div className="fuse-body">
          <div className={`fuse-element ${armed ? 'active' : ''}`}></div>
        </div>
      </div>
      <div className="fuse-status">
        {armed ? 'ON' : 'OFF'}
        {isManual && <span className="manual-indicator">●</span>}
      </div>
    </div>
  )
}

// HUD Compass
function HudCompass({ heading, direction }) {
  return (
    <div className="hud-compass">
      <div className="compass-outer">
        <div className="compass-ring" style={{ transform: `rotate(${-heading}deg)` }}>
          <span className="compass-n">N</span>
          <span className="compass-e">E</span>
          <span className="compass-s">S</span>
          <span className="compass-w">W</span>
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
      <div className="sat-label"><span className="sat-icon">📡</span> SAT</div>
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
        <span className="sat-quality">{getQuality().toUpperCase()}</span>
      </div>
    </div>
  )
}

// Speedometer (km/h from wheel speed) with Odometer
function Speedometer({ speed, dist }) {
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
        <span className="speedo-unit">km/h</span>
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
        <span className="odo-unit">m</span>
      </div>
    </div>
  )
}

// Power Indicator (0, 1, 2 levels)
function PowerIndicator({ power }) {
  const levels = [0, 1, 2]
  const labels = ['OFF', 'ECO', 'MAX']
  
  return (
    <div className="power-indicator">
      <div className="power-label">PWR</div>
      <div className="power-bars">
        {levels.map(level => (
          <div 
            key={level} 
            className={`power-bar ${power >= level ? 'active' : ''} level-${level}`}
          />
        ))}
      </div>
      <div className={`power-mode level-${power}`}>{labels[power] || 'OFF'}</div>
    </div>
  )
}

// Map Panel with Google Maps satellite view
function MapPanel({ pathHistory, heading, lat, lng, altitude }) {
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
        <span className="map-title">MAP</span>
        <span className="map-alt">ALT: {altitude.toFixed(0)}m</span>
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
            <span>Map Error</span>
            <small>Check API Key</small>
          </div>
        )}
        
        {!isLoaded && !loadError && (
          <div className="map-loading">
            <span>Loading Map...</span>
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
        
        {/* HUD Overlay on map */}
        <div className="map-hud-overlay">
          <span className="map-compass-n">N</span>
        </div>
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
          <span className="warning-text">WARNING</span>
          <span className="warning-icon">⚠</span>
        </div>
        <div className="warning-subtext">ARMED</div>
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
    <div className="telemetry-strip">
      <div className="telem-item">
        <span className="telem-label">LAT</span>
        <span className="telem-value">{telemetry.latitude ? telemetry.latitude.toFixed(6) : '-.------'}°</span>
      </div>
      <div className="telem-item">
        <span className="telem-label">LNG</span>
        <span className="telem-value">{telemetry.longitude ? telemetry.longitude.toFixed(6) : '-.------'}°</span>
      </div>
      <div className="telem-item">
        <span className="telem-label">ALT</span>
        <span className="telem-value">{telemetry.altitude.toFixed(0)}m</span>
      </div>
      <div className="telem-item">
        <span className="telem-label">HDG</span>
        <span className="telem-value">{telemetry.heading.toFixed(0)}°</span>
      </div>
      <div className="telem-item">
        <span className="telem-label">GS</span>
        <span className="telem-value">{telemetry.groundspeed.toFixed(1)}</span>
      </div>
      <div className="telem-item">
        <span className="telem-label">SPD</span>
        <span className="telem-value">{telemetry.speed.toFixed(1)}</span>
      </div>
      <div className="telem-item">
        <span className="telem-label">DIST</span>
        <span className="telem-value">{telemetry.dist.toFixed(0)}m</span>
      </div>
      <div className="telem-item">
        <span className="telem-label">BAT</span>
        <span className="telem-value">{telemetry.batt_v.toFixed(1)}V</span>
      </div>
      <div className="telem-item">
        <span className="telem-label">SAT</span>
        <span className="telem-value">{telemetry.satellites}</span>
      </div>
      <div className="telem-item">
        <span className="telem-label">MODE</span>
        <span className="telem-value">{telemetry.md_str}</span>
      </div>
      <div className="telem-item">
        <span className="telem-label">TIME</span>
        <span className="telem-value">{formatClock(telemetry.telemetry_time)}</span>
      </div>
    </div>
  )
}

// Telemetry Log Component - Real-time database telemetry
function TelemetryLog({ onTelemetryUpdate }) {
  const [records, setRecords] = useState([])
  const [connectionStatus, setConnectionStatus] = useState('connecting')
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

  useEffect(() => {
    let isMounted = true
    let pollInterval = null
    let controller = new AbortController()

    const fetchTelemetry = async () => {
      // Abort previous request if still pending
      controller.abort()
      controller = new AbortController()
      
      try {
        const url = `${API_BASE_URL}/api/telemetry?lastId=${lastIdRef.current}&limit=20`
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
  }, [onTelemetryUpdate])

  return (
    <div className="telemetry-log">
      <div className="tlog-header">
        <span className="tlog-title">TELEMETRY LOG</span>
        <span className={`tlog-status ${connectionStatus}`}>
          {connectionStatus === 'connected' ? '● LIVE' : connectionStatus === 'connecting' ? '○ ...' : '○ OFF'}
        </span>
      </div>
      <div className="tlog-console">
        {records.length === 0 ? (
          <div className="tlog-empty">Waiting...</div>
        ) : (
          records.map(record => (
            <div key={record.id} className="tlog-entry">
              <span className="tlog-time">{formatTimestamp(record.timestamp)}</span>
              <span className="tlog-data">{formatTelemetryData(record.data)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// Camera Feed Component
function CameraFeed({ streamUrl, variant = "main" }) {
  const videoRef = useRef(null)
  const hlsRef = useRef(null)
  const retryTimeoutRef = useRef(null)
  const [status, setStatus] = useState('connecting')
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    let isMounted = true

    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
    }

    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }

    setStatus('connecting')

    const scheduleRetry = (delay = 3000) => {
      retryTimeoutRef.current = setTimeout(() => {
        setRetryKey(prev => prev + 1)
      }, delay)
    }

    import('hls.js').then(({ default: Hls }) => {
      if (!isMounted) return

      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 90,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          manifestLoadingTimeOut: 15000,
          manifestLoadingMaxRetry: 4,
          manifestLoadingRetryDelay: 1000,
          levelLoadingTimeOut: 15000,
          levelLoadingMaxRetry: 4,
          levelLoadingRetryDelay: 1000,
          fragLoadingTimeOut: 20000,
          fragLoadingMaxRetry: 6,
          fragLoadingRetryDelay: 1000,
        })
        
        hlsRef.current = hls
        hls.loadSource(streamUrl)
        hls.attachMedia(video)

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setStatus('playing')
          video.play().catch(() => setStatus('paused'))
        })

        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                setStatus('reconnecting')
                hls.startLoad()
                retryTimeoutRef.current = setTimeout(() => {
                  if (hlsRef.current) {
                    hlsRef.current.destroy()
                    hlsRef.current = null
                  }
                  scheduleRetry(2000)
                }, 5000)
                break
              case Hls.ErrorTypes.MEDIA_ERROR:
                setStatus('reconnecting')
                hls.recoverMediaError()
                break
              default:
                hls.destroy()
                hlsRef.current = null
                setStatus('error')
                scheduleRetry(3000)
                break
            }
          }
        })

        video.onplaying = () => {
          setStatus('playing')
        }

      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = streamUrl
        video.addEventListener('loadedmetadata', () => {
          setStatus('playing')
          video.play().catch(() => setStatus('paused'))
        })
        video.addEventListener('error', () => {
          setStatus('error')
          scheduleRetry(3000)
        })
      } else {
        setStatus('error')
      }
    }).catch(() => {
      if (isMounted) setStatus('error')
    })

    return () => {
      isMounted = false
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current)
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
    }
  }, [streamUrl, retryKey])

  return (
    <div className={`camera-feed camera-${variant}`}>
      <video
        ref={videoRef}
        className="camera-video"
        autoPlay
        muted
        playsInline
      />
      {status !== 'playing' && (
        <div className="camera-status-overlay">
          {status === 'connecting' && <span className="status-text">◌ CONNECTING</span>}
          {status === 'reconnecting' && <span className="status-text">↻ RECONNECTING</span>}
          {status === 'error' && <span className="status-text error">✕ NO SIGNAL</span>}
        </div>
      )}
    </div>
  )
}

export default App
