import { useState, useEffect, useRef, useCallback } from 'react'
import './App.css'
import config from './config'
import { useTheme } from './hooks/useTheme'

// API Configuration from config
const API_BASE_URL = config.apiUrl

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
  // Meta
  timestamp: Date.now(),
  pathHistory: [],
  connected: false,
})

function App() {
  const [telemetry, setTelemetry] = useState(createInitialState)
  const [latestTelemetryData, setLatestTelemetryData] = useState(null)
  
  // Theme management - reacts to telemetry data changes
  const { currentTheme } = useTheme(latestTelemetryData)

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
        <CameraFeed streamUrl="http://192.168.88.15:8888/cam1/index.m3u8?username=admin&password=123456" />
      </div>

      {/* HUD Overlay */}
      <div className="hud-overlay">
        {/* Top Bar */}
        <div className="hud-top-bar">
          <div className="hud-logo">
            <span className="logo-icon">◈</span>
            <span className="logo-text">RATERA DRONE OSD</span>
            <span className="logo-version">v0.8</span>
          </div>
          
          <div className="hud-status-center">
            <span className={`status-mode ${telemetry.md_str.toLowerCase().replace(/\s+/g, '-')}`}>{telemetry.md_str}</span>
            <span className="status-divider">│</span>
            <span className="status-fs">FS:{telemetry.fs}</span>
            <span className="status-divider">│</span>
            <span className={`status-flag ${telemetry.f1 ? 'active' : ''}`}>F1</span>
            <span className={`status-flag ${telemetry.f2 ? 'active' : ''}`}>F2</span>
          </div>

          <div className="hud-battery">
            <BatteryIndicator voltage={telemetry.batt_v} />
          </div>
        </div>

        {/* Rear View Mirror */}
        <div className="rear-mirror">
          <div className="mirror-frame">
            <CameraFeed streamUrl="http://192.168.88.15:8888/cam2/index.m3u8?username=admin&password=123456" variant="mirror" />
            <span className="mirror-label">REAR</span>
          </div>
        </div>

        {/* Heading Tape - Top Center */}
        <div className="hud-heading-tape">
          <HeadingTape heading={telemetry.heading} />
        </div>

        {/* Left Panel - Compass & Satellites */}
        <div className="hud-left-panel">
          <HudCompass heading={telemetry.heading} direction={directions[directionIndex]} />
          <SatelliteIndicator satellites={telemetry.satellites} />
        </div>

        {/* Right Panel - Speedometer */}
        <div className="hud-right-panel">
          <Speedometer speed={telemetry.groundspeed} />
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
  // Assuming 3S LiPo: 9V min (3.0V/cell), 12.6V max (4.2V/cell)
  // Adjust these values based on your battery configuration
  const minVoltage = 9.0
  const maxVoltage = 12.6
  const percentage = Math.max(0, Math.min(100, ((voltage - minVoltage) / (maxVoltage - minVoltage)) * 100))
  
  const getClass = () => {
    if (percentage > 50) return 'good'
    if (percentage > 20) return 'warning'
    return 'critical'
  }

  return (
    <div className={`battery-indicator ${getClass()}`}>
      <span className="battery-voltage">{voltage.toFixed(1)}V</span>
      <div className="battery-icon-mini">
        <div className="battery-fill-mini" style={{ width: `${percentage}%` }}></div>
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
      <div className="sat-label">SAT</div>
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

// Speedometer (km/h from groundspeed)
function Speedometer({ speed }) {
  // groundspeed is already in km/h from GPS
  const speedKmh = speed
  const maxSpeed = 60 // max km/h for display
  const angle = Math.min((speedKmh / maxSpeed) * 240, 240) - 120 // -120 to +120 degrees

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
    </div>
  )
}

// Map Panel with simulated satellite view and integrated Altimeter
function MapPanel({ pathHistory, heading, lat, lng, altitude }) {
  const mapSize = 300 // 2x bigger
  const scale = 300000
  
  // Generate path points relative to current position
  const getPoints = () => {
    if (pathHistory.length < 2 || !lat || !lng) return []
    return pathHistory.map(p => ({
      x: mapSize/2 + (p.lng - lng) * scale,
      y: mapSize/2 - (p.lat - lat) * scale
    }))
  }

  const points = getPoints()
  const pathD = points.length > 1 
    ? points.reduce((acc, p, i) => acc + (i === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`), '')
    : ''

  // Generate terrain pattern based on coordinates
  const terrainPatterns = []
  const gridSize = 30
  for (let i = 0; i < mapSize / gridSize; i++) {
    for (let j = 0; j < mapSize / gridSize; j++) {
      const noise = Math.sin((lat || 0) * 1000 + i * 0.5) * Math.cos((lng || 0) * 1000 + j * 0.3)
      const brightness = 0.15 + (noise + 1) * 0.1
      terrainPatterns.push(
        <rect
          key={`${i}-${j}`}
          x={i * gridSize}
          y={j * gridSize}
          width={gridSize}
          height={gridSize}
          fill={`rgba(var(--theme-accent-primary-rgb), ${brightness})`}
        />
      )
    }
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
        {/* SVG Map with terrain simulation */}
        <svg viewBox={`0 0 ${mapSize} ${mapSize}`} className="map-svg-full">
          {/* Dark background */}
          <rect x="0" y="0" width={mapSize} height={mapSize} fill="rgba(0,0,0,0.8)" />
          
          {/* Simulated terrain pattern */}
          {terrainPatterns}
          
          {/* Grid overlay */}
          {Array.from({ length: 11 }, (_, i) => {
            const pos = (i / 10) * mapSize
            return (
              <g key={`grid-${i}`}>
                <line x1="0" y1={pos} x2={mapSize} y2={pos} stroke="var(--theme-accent-primary)" strokeWidth="0.5" opacity="0.2" />
                <line x1={pos} y1="0" x2={pos} y2={mapSize} stroke="var(--theme-accent-primary)" strokeWidth="0.5" opacity="0.2" />
              </g>
            )
          })}
          
          {/* Simulated roads */}
          <rect x={mapSize * 0.4} y="0" width={mapSize * 0.06} height={mapSize} fill="rgba(var(--theme-accent-primary-rgb), 0.08)" />
          <rect x="0" y={mapSize * 0.45} width={mapSize} height={mapSize * 0.04} fill="rgba(var(--theme-accent-primary-rgb), 0.08)" />
          
          {/* Path trail */}
          {pathD && (
            <path 
              d={pathD} 
              fill="none" 
              stroke="url(#trailGradientMap)" 
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          
          {/* Gradient definition */}
          <defs>
            <linearGradient id="trailGradientMap" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="var(--theme-accent-primary)" stopOpacity="0.2" />
              <stop offset="100%" stopColor="var(--theme-accent-primary)" stopOpacity="1" />
            </linearGradient>
          </defs>
          
          {/* Arrow indicator at center */}
          <g transform={`translate(${mapSize/2}, ${mapSize/2}) rotate(${heading})`}>
            <polygon 
              points="0,-16 -10,10 0,5 10,10" 
              fill="var(--theme-accent-primary)"
              stroke="var(--theme-bg-dark)"
              strokeWidth="2"
              filter="drop-shadow(0 0 6px var(--theme-accent-primary-glow))"
            />
          </g>
          
          {/* Center pulse ring */}
          <circle 
            cx={mapSize/2} 
            cy={mapSize/2} 
            r="24" 
            fill="none" 
            stroke="var(--theme-accent-primary)" 
            strokeWidth="2"
            opacity="0.5"
            className="pulse-ring"
          />
          
          {/* Compass directions on map */}
          <text x={mapSize/2} y="15" fill="var(--theme-accent-primary)" fontSize="10" textAnchor="middle" opacity="0.6">N</text>
          <text x={mapSize/2} y={mapSize - 6} fill="var(--theme-text-muted)" fontSize="10" textAnchor="middle" opacity="0.4">S</text>
          <text x="8" y={mapSize/2 + 4} fill="var(--theme-text-muted)" fontSize="10" opacity="0.4">W</text>
          <text x={mapSize - 8} y={mapSize/2 + 4} fill="var(--theme-text-muted)" fontSize="10" textAnchor="end" opacity="0.4">E</text>
        </svg>
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

// Telemetry Strip - now using real telemetry data
function TelemetryStrip({ telemetry }) {
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
        <span className="telem-value">{telemetry.groundspeed.toFixed(1)}km/h</span>
      </div>
      <div className="telem-item">
        <span className="telem-label">DIST</span>
        <span className="telem-value">{telemetry.dist.toFixed(0)}m</span>
      </div>
      <div className="telem-item">
        <span className="telem-label">PWR</span>
        <span className="telem-value">{telemetry.power}</span>
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
            
            // Notify parent - only the latest record to reduce overhead
            const latestRecord = data.records[0]
            if (latestRecord && onTelemetryUpdate) {
              onTelemetryUpdate(latestRecord.data)
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
