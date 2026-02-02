/**
 * Ground Drone OSD (Foxy)
 * Full OSD layout for ground vehicles with fuse switches, rear mirror, speedometer, etc.
 * Extracted from App.jsx - contains all OSD-specific components for ground drones
 */
import { useState, useEffect, useRef, useMemo } from 'react'
import { GoogleMap, useJsApiLoader, Marker, Polyline } from '@react-google-maps/api'
import { useTranslation } from 'react-i18next'
import config from './config'
import CameraFeed from './components/CameraFeed'
import { HudTopBar, HudLeftPanel } from './SharedOSDComponents'

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

// Fuse Switch Indicator
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

// Speedometer with Odometer
function Speedometer({ speed, dist }) {
  const { t } = useTranslation()
  const speedKmh = speed
  const maxSpeed = 40
  const angle = Math.min((speedKmh / maxSpeed) * 240, 240) - 120

  const odoValue = Math.floor(dist || 0)
  const odoDigits = String(odoValue).padStart(5, '0').split('')

  const ticks = []
  for (let i = 0; i <= 40; i += 10) {
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
        <path 
          d="M 14 70 A 56 56 0 0 1 126 70" 
          fill="none" 
          stroke="var(--theme-hud-border)" 
          strokeWidth="3"
        />
        {ticks}
        <g transform={`rotate(${angle}, 70, 70)`}>
          <polygon 
            points="70,25 67,70 70,75 73,70" 
            fill="var(--theme-status-danger)"
            filter="drop-shadow(0 0 3px var(--theme-status-danger))"
          />
        </g>
        <circle cx="70" cy="70" r="8" fill="var(--theme-bg-dark)" stroke="var(--theme-accent-primary)" strokeWidth="2"/>
      </svg>
      <div className="speedo-readout">
        <span className="speedo-value">{speedKmh.toFixed(0)}</span>
        <span className="speedo-unit">{t('osd.speedUnit')}</span>
      </div>
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

// Power Indicator
function PowerIndicator({ power }) {
  const { t } = useTranslation()
  
  const getLabel = () => {
    if (power <= 0) return t('power.min')
    if (power === 1) return t('power.mid')
    return t('power.max')
  }

  return (
    <div className="power-indicator">
      <div className="power-label">{t('osd.power')}</div>
      <div className="power-bars">
        <div className={`power-bar ${power >= 0 ? 'active green' : ''}`} />
        <div className={`power-bar ${power >= 1 ? 'active green' : ''}`} />
        <div className={`power-bar ${power >= 2 ? 'active orange' : ''}`} />
      </div>
      <div className={`power-mode level-${Math.min(power, 2)}`}>{getLabel()}</div>
    </div>
  )
}

// Map Panel with Google Maps
function MapPanel({ pathHistory, heading, lat, lng, altitude }) {
  const { t } = useTranslation()
  const [zoom, setZoom] = useState(17)
  const mapRef = useRef(null)
  
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: config.googleMapsApiKey,
    id: 'google-map-script'
  })
  
  const containerStyle = {
    width: '100%',
    height: '100%',
    borderRadius: '4px'
  }
  
  const center = useMemo(() => ({
    lat: lat || 0,
    lng: lng || 0
  }), [lat, lng])
  
  const pathCoords = useMemo(() => 
    pathHistory.map(p => ({ lat: p.lat, lng: p.lng })),
    [pathHistory]
  )
  
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
    gestureHandling: 'none',
    heading: heading || 0,
    tilt: 0
  }), [heading])
  
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
  
  const polylineOptions = {
    strokeColor: '#00ff88',
    strokeOpacity: 0.8,
    strokeWeight: 3,
    geodesic: true
  }
  
  const zoomIn = () => setZoom(prev => Math.min(21, prev + 1))
  const zoomOut = () => setZoom(prev => Math.max(1, prev - 1))
  
  useEffect(() => {
    if (mapRef.current && lat && lng) {
      mapRef.current.setCenter({ lat, lng })
    }
  }, [lat, lng])
  
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
        <div className="map-zoom-controls">
          <button className="zoom-btn" onClick={zoomIn} disabled={zoom >= 21}>+</button>
          <span className="zoom-level">{getScaleText()}</span>
          <button className="zoom-btn" onClick={zoomOut} disabled={zoom <= 8}>−</button>
        </div>
        
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
            {pathCoords.length > 1 && (
              <Polyline path={pathCoords} options={polylineOptions} />
            )}
            
            {lat && lng && (
              <Marker
                position={center}
                icon={arrowIcon}
              />
            )}
          </GoogleMap>
        )}
        
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

// Warning Banner
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

// Telemetry Strip
function TelemetryStrip({ telemetry }) {
  const { t } = useTranslation()
  const [isCollapsed, setIsCollapsed] = useState(true)
  
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

/**
 * Ground Drone OSD Component
 * Main OSD layout for Foxy ground vehicles
 */
export default function GroundDroneOSD({
  telemetry,
  droneName,
  droneType,
  isActive,
  elrsConnected,
  hdMode,
  onHdToggle,
  mainCameraUrl,
  rearCameraUrl,
  hasHdStream,
  onShareClick,
  onControlClick,
  directions,
  directionIndex
}) {
  const { t } = useTranslation()
  
  return (
    <>
      {/* Full-screen Front Camera Background */}
      <div className="main-camera-bg">
        <CameraFeed streamUrl={mainCameraUrl} />
      </div>

      {/* HUD Overlay */}
      <div className="hud-overlay">
        {/* Top Bar */}
        <HudTopBar
          telemetry={telemetry}
          isActive={isActive}
          onShareClick={onShareClick}
          showFailsafe={true}
        />

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

        {/* Left Panel - Compass & Drone Name & Satellites & Quality */}
        <HudLeftPanel
          heading={telemetry.heading}
          direction={directions[directionIndex]}
          droneName={droneName}
          droneType={droneType}
          satellites={telemetry.satellites}
          hasHdStream={hasHdStream}
          hdMode={hdMode}
          onHdToggle={onHdToggle}
        />

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

        {/* Control Icon */}
        <div 
          className={`hud-active-control-icon ${!elrsConnected ? 'disconnected' : (isActive ? 'active' : 'inactive')} ${elrsConnected && !isActive ? 'clickable' : ''}`}
          onClick={onControlClick}
          title={elrsConnected && !isActive ? t('control.activate') : undefined}
        >
          <svg viewBox="0 0 50 50" className="active-control-svg">
            <path className="signal-wave wave-1" d="M 22 8 Q 25 5, 28 8" />
            <path className="signal-wave wave-2" d="M 19 5 Q 25 0, 31 5" />
            <path className="signal-wave wave-3" d="M 16 2 Q 25 -5, 34 2" />
            <line x1="25" y1="14" x2="25" y2="8" className="antenna" />
            <circle cx="25" cy="7" r="1.5" className="antenna-tip" />
            <rect x="12" y="14" width="26" height="18" rx="3" className="controller-body" />
            <circle cx="19" cy="23" r="4" className="joystick-base-small" />
            <circle cx="19" cy="23" r="2" className="joystick-stick-left" />
            <circle cx="31" cy="23" r="4" className="joystick-base-small" />
            <circle cx="31" cy="23" r="2" className="joystick-stick-right" />
            <rect x="23" y="17" width="4" height="2" rx="1" className="controller-indicator" />
          </svg>
          {elrsConnected && !isActive && <span className="control-tooltip">{t('control.activate')}</span>}
        </div>

        {/* Bottom Telemetry Strip */}
        <div className="hud-bottom-strip">
          <TelemetryStrip telemetry={telemetry} />
        </div>
      </div>
    </>
  )
}
