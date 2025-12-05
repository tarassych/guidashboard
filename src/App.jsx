import { useState, useEffect, useRef } from 'react'
import './App.css'

// Utility functions for realistic drone movement
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const lerp = (start, end, t) => start + (end - start) * t
const degToRad = (deg) => (deg * Math.PI) / 180

// Initial drone state
const createInitialState = () => ({
  latitude: 47.6062,
  longitude: -122.3321,
  elevation: 125.5,
  heading: 45,
  speed: 0,
  targetSpeed: 2.5,
  battery: 87,
  signal: 95,
  satellites: 12,
  mode: 'AUTO',
  pathHistory: [],
  targetHeading: 45,
  accelerating: true,
  timestamp: Date.now(),
})

function App() {
  const [telemetry, setTelemetry] = useState(createInitialState)
  const frameRef = useRef(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setTelemetry((prev) => {
        frameRef.current += 1
        const frame = frameRef.current

        let newTargetHeading = prev.targetHeading
        if (frame % 40 === 0) {
          newTargetHeading = (prev.targetHeading + (Math.random() > 0.5 ? 30 : -30) + 360) % 360
        }

        let headingDiff = newTargetHeading - prev.heading
        if (headingDiff > 180) headingDiff -= 360
        if (headingDiff < -180) headingDiff += 360
        const newHeading = (prev.heading + headingDiff * 0.1 + 360) % 360

        const turnRate = Math.abs(headingDiff)
        let newTargetSpeed = prev.targetSpeed
        if (frame % 60 === 0) {
          newTargetSpeed = clamp(prev.targetSpeed + (Math.random() - 0.5) * 1, 0.5, 5)
        }
        const adjustedTargetSpeed = newTargetSpeed * (1 - turnRate / 360 * 0.5)
        const newSpeed = lerp(prev.speed, adjustedTargetSpeed, 0.1)

        const headingRad = degToRad(newHeading)
        const speedFactor = newSpeed * 0.00001
        const newLatitude = prev.latitude + Math.cos(headingRad) * speedFactor
        const newLongitude = prev.longitude + Math.sin(headingRad) * speedFactor

        const elevationNoise = Math.sin(frame * 0.05) * 0.5 + Math.cos(frame * 0.03) * 0.3
        const newElevation = clamp(prev.elevation + elevationNoise, 100, 200)

        const newBattery = Math.max(0, prev.battery - 0.01 * (newSpeed / 2))
        const newSignal = clamp(prev.signal + (Math.random() - 0.5) * 2, 70, 100)

        const newPathHistory = [
          ...prev.pathHistory.slice(-49),
          { lat: newLatitude, lng: newLongitude }
        ]

        return {
          ...prev,
          latitude: newLatitude,
          longitude: newLongitude,
          elevation: newElevation,
          heading: newHeading,
          speed: newSpeed,
          targetSpeed: newTargetSpeed,
          targetHeading: newTargetHeading,
          battery: newBattery,
          signal: newSignal,
          satellites: clamp(Math.floor(prev.satellites + (Math.random() - 0.5)), 8, 14),
          pathHistory: newPathHistory,
          timestamp: Date.now(),
        }
      })
    }, 500)

    return () => clearInterval(interval)
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
            <span className="logo-text">DRONE HUD</span>
            <span className="logo-version">v0.5</span>
          </div>
          
          <div className="hud-status-center">
            <span className={`status-mode ${telemetry.mode.toLowerCase()}`}>{telemetry.mode}</span>
            <span className="status-divider">│</span>
            <span className="status-signal">◢◣ {telemetry.signal.toFixed(0)}%</span>
            <span className="status-divider">│</span>
            <span className="status-sat">⬡ {telemetry.satellites}</span>
          </div>

          <div className="hud-battery">
            <BatteryIndicator battery={telemetry.battery} />
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

        {/* Left Panel - Compass & Altitude */}
        <div className="hud-left-panel">
          <HudCompass heading={telemetry.heading} direction={directions[directionIndex]} />
          <HudAltitude elevation={telemetry.elevation} />
        </div>

        {/* Right Panel - Speedometer */}
        <div className="hud-right-panel">
          <Speedometer speed={telemetry.speed} />
        </div>

        {/* Minimap */}
        <div className="hud-minimap-container">
          <Minimap 
            pathHistory={telemetry.pathHistory} 
            heading={telemetry.heading}
            lat={telemetry.latitude}
            lng={telemetry.longitude}
          />
        </div>

        {/* Center Crosshair */}
        <div className="hud-crosshair">
          <div className="crosshair-h"></div>
          <div className="crosshair-v"></div>
          <div className="crosshair-center">◇</div>
        </div>

        {/* Bottom Telemetry Strip */}
        <div className="hud-bottom-strip">
          <TelemetryStrip telemetry={telemetry} />
        </div>
      </div>
    </div>
  )
}

// Battery Indicator (Mobile Phone Style)
function BatteryIndicator({ battery }) {
  const getClass = () => {
    if (battery > 50) return 'good'
    if (battery > 20) return 'warning'
    return 'critical'
  }

  return (
    <div className={`battery-indicator ${getClass()}`}>
      <span className="battery-percent">{battery.toFixed(0)}%</span>
      <div className="battery-icon-mini">
        <div className="battery-fill-mini" style={{ width: `${battery}%` }}></div>
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

// HUD Altitude
function HudAltitude({ elevation }) {
  const minElev = 100
  const maxElev = 200
  const percentage = ((elevation - minElev) / (maxElev - minElev)) * 100

  return (
    <div className="hud-altitude">
      <div className="alt-label">ALT</div>
      <div className="alt-bar">
        <div className="alt-fill" style={{ height: `${percentage}%` }}></div>
        <div className="alt-marks">
          <span>200</span>
          <span>150</span>
          <span>100</span>
        </div>
      </div>
      <div className="alt-value">{elevation.toFixed(0)}<span>m</span></div>
    </div>
  )
}

// Speedometer (Car Style - km/h)
function Speedometer({ speed }) {
  // Convert m/s to km/h
  const speedKmh = speed * 3.6
  const maxSpeed = 25 // max km/h
  const angle = (speedKmh / maxSpeed) * 240 - 120 // -120 to +120 degrees

  const ticks = []
  for (let i = 0; i <= 25; i += 5) {
    const tickAngle = (i / maxSpeed) * 240 - 120
    const isMain = i % 10 === 0
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
          stroke={i <= speedKmh ? "var(--accent-primary)" : "var(--text-muted)"} 
          strokeWidth={isMain ? 2 : 1}
        />
        {isMain && (
          <text 
            x={70 + 42 * Math.cos(radians)} 
            y={70 + 42 * Math.sin(radians)} 
            fill="var(--text-secondary)" 
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
          stroke="var(--hud-border)" 
          strokeWidth="3"
        />
        {/* Ticks */}
        {ticks}
        {/* Needle */}
        <g transform={`rotate(${angle}, 70, 70)`}>
          <polygon 
            points="70,25 67,70 70,75 73,70" 
            fill="var(--accent-danger)"
            filter="drop-shadow(0 0 3px var(--accent-danger))"
          />
        </g>
        {/* Center cap */}
        <circle cx="70" cy="70" r="8" fill="var(--bg-dark)" stroke="var(--accent-primary)" strokeWidth="2"/>
      </svg>
      <div className="speedo-readout">
        <span className="speedo-value">{speedKmh.toFixed(0)}</span>
        <span className="speedo-unit">km/h</span>
      </div>
    </div>
  )
}

// Minimap with moving arrow
function Minimap({ pathHistory, heading, lat, lng }) {
  const mapSize = 150
  const scale = 300000 // Scale for lat/lng to pixels
  
  // Generate path points relative to current position
  const getPoints = () => {
    if (pathHistory.length < 2) return []
    const current = pathHistory[pathHistory.length - 1]
    return pathHistory.map(p => ({
      x: mapSize/2 + (p.lng - current.lng) * scale,
      y: mapSize/2 - (p.lat - current.lat) * scale
    }))
  }

  const points = getPoints()
  const pathD = points.length > 1 
    ? points.reduce((acc, p, i) => acc + (i === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`), '')
    : ''

  // Simulated map grid
  const gridLines = []
  for (let i = 0; i <= 6; i++) {
    const pos = (i / 6) * mapSize
    gridLines.push(
      <line key={`h${i}`} x1="0" y1={pos} x2={mapSize} y2={pos} stroke="var(--hud-border)" strokeWidth="0.5" opacity="0.3" />,
      <line key={`v${i}`} x1={pos} y1="0" x2={pos} y2={mapSize} stroke="var(--hud-border)" strokeWidth="0.5" opacity="0.3" />
    )
  }

  return (
    <div className="minimap">
      <div className="minimap-header">
        <span className="minimap-title">MAP</span>
        <span className="minimap-coords">{lat.toFixed(4)}°, {lng.toFixed(4)}°</span>
      </div>
      <svg viewBox={`0 0 ${mapSize} ${mapSize}`} className="minimap-svg">
        {/* Grid */}
        {gridLines}
        
        {/* Simulated roads/terrain */}
        <rect x="60" y="0" width="30" height={mapSize} fill="rgba(0,255,136,0.05)" />
        <rect x="0" y="65" width={mapSize} height="20" fill="rgba(0,255,136,0.05)" />
        
        {/* Path trail */}
        {pathD && (
          <path 
            d={pathD} 
            fill="none" 
            stroke="url(#trailGradient)" 
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        
        {/* Gradient definition */}
        <defs>
          <linearGradient id="trailGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.1" />
            <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity="1" />
          </linearGradient>
        </defs>
        
        {/* Arrow indicator at center */}
        <g transform={`translate(${mapSize/2}, ${mapSize/2}) rotate(${heading})`}>
          <polygon 
            points="0,-12 -8,8 0,4 8,8" 
            fill="var(--accent-primary)"
            filter="drop-shadow(0 0 4px var(--glow))"
          />
        </g>
        
        {/* Center pulse ring */}
        <circle 
          cx={mapSize/2} 
          cy={mapSize/2} 
          r="18" 
          fill="none" 
          stroke="var(--accent-primary)" 
          strokeWidth="1"
          opacity="0.4"
          className="pulse-ring"
        />
      </svg>
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

// Telemetry Strip
function TelemetryStrip({ telemetry }) {
  return (
    <div className="telemetry-strip">
      <div className="telem-item">
        <span className="telem-label">LAT</span>
        <span className="telem-value">{telemetry.latitude.toFixed(6)}°</span>
      </div>
      <div className="telem-item">
        <span className="telem-label">LNG</span>
        <span className="telem-value">{telemetry.longitude.toFixed(6)}°</span>
      </div>
      <div className="telem-item">
        <span className="telem-label">ALT</span>
        <span className="telem-value">{telemetry.elevation.toFixed(1)}m</span>
      </div>
      <div className="telem-item">
        <span className="telem-label">HDG</span>
        <span className="telem-value">{telemetry.heading.toFixed(0)}°</span>
      </div>
      <div className="telem-item">
        <span className="telem-label">SPD</span>
        <span className="telem-value">{telemetry.speed.toFixed(2)}m/s</span>
      </div>
      <div className="telem-item">
        <span className="telem-label">BAT</span>
        <span className="telem-value">{telemetry.battery.toFixed(0)}%</span>
      </div>
      <div className="telem-item">
        <span className="telem-label">SIG</span>
        <span className="telem-value">{telemetry.signal.toFixed(0)}%</span>
      </div>
      <div className="telem-item">
        <span className="telem-label">SAT</span>
        <span className="telem-value">{telemetry.satellites}</span>
      </div>
      <div className="telem-item">
        <span className="telem-label">MODE</span>
        <span className="telem-value">{telemetry.mode}</span>
      </div>
      <div className="telem-item">
        <span className="telem-label">TIME</span>
        <span className="telem-value">{new Date(telemetry.timestamp).toLocaleTimeString()}</span>
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
