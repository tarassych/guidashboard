import { useState, useEffect, useRef } from 'react'
import './App.css'

// Utility functions for realistic drone movement
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const lerp = (start, end, t) => start + (end - start) * t
const degToRad = (deg) => (deg * Math.PI) / 180
const radToDeg = (rad) => (rad * 180) / Math.PI

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

        // Change target heading periodically (simulating waypoint navigation)
        let newTargetHeading = prev.targetHeading
        if (frame % 40 === 0) {
          newTargetHeading = (prev.targetHeading + (Math.random() > 0.5 ? 30 : -30) + 360) % 360
        }

        // Smoothly adjust heading towards target
        let headingDiff = newTargetHeading - prev.heading
        if (headingDiff > 180) headingDiff -= 360
        if (headingDiff < -180) headingDiff += 360
        const newHeading = (prev.heading + headingDiff * 0.1 + 360) % 360

        // Adjust speed based on turning (slow down when turning)
        const turnRate = Math.abs(headingDiff)
        let newTargetSpeed = prev.targetSpeed
        if (frame % 60 === 0) {
          newTargetSpeed = clamp(prev.targetSpeed + (Math.random() - 0.5) * 1, 0.5, 5)
        }
        const adjustedTargetSpeed = newTargetSpeed * (1 - turnRate / 360 * 0.5)
        const newSpeed = lerp(prev.speed, adjustedTargetSpeed, 0.1)

        // Calculate new position based on heading and speed
        const headingRad = degToRad(newHeading)
        const speedFactor = newSpeed * 0.00001 // Scale for lat/long movement
        const newLatitude = prev.latitude + Math.cos(headingRad) * speedFactor
        const newLongitude = prev.longitude + Math.sin(headingRad) * speedFactor

        // Simulate terrain elevation changes
        const elevationNoise = Math.sin(frame * 0.05) * 0.5 + Math.cos(frame * 0.03) * 0.3
        const newElevation = clamp(prev.elevation + elevationNoise, 100, 200)

        // Battery drain
        const newBattery = Math.max(0, prev.battery - 0.01 * (newSpeed / 2))

        // Signal fluctuation
        const newSignal = clamp(prev.signal + (Math.random() - 0.5) * 2, 70, 100)

        // Update path history (keep last 50 points)
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

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="logo">
          <span className="logo-icon">◈</span>
          <span>DRONE TELEMETRY</span>
          <span className="logo-version">ver 0.5</span>
        </div>
        <div className="status-bar">
          <StatusIndicator label="MODE" value={telemetry.mode} type="mode" />
          <StatusIndicator label="SIGNAL" value={`${telemetry.signal.toFixed(0)}%`} type="signal" />
          <StatusIndicator label="SAT" value={telemetry.satellites} type="satellites" />
        </div>
      </header>

      <main className="dashboard-main">
        <div className="cameras-section">
          <CameraPanel 
            streamUrl="http://192.168.88.15:8888/cam1/index.m3u8" 
            title="FRONT CAMERA"
            variant="main"
          />
          <div className="secondary-cameras">
            <CameraPanel 
              streamUrl="http://192.168.88.15:8888/cam2/index.m3u8" 
              title="BACK CAMERA"
              variant="secondary"
            />
            <CameraPanel 
              streamUrl="http://192.168.88.15:8888/cam3/index.m3u8" 
              title="THERMAL"
              variant="secondary"
            />
          </div>
        </div>

        <div className="panel-row">
          <CompassPanel heading={telemetry.heading} />
          <CoordinatesPanel 
            latitude={telemetry.latitude} 
            longitude={telemetry.longitude}
            elevation={telemetry.elevation}
          />
          <SpeedPanel speed={telemetry.speed} />
        </div>

        <div className="panel-row">
          <HeadingPanel heading={telemetry.heading} />
          <PathPanel pathHistory={telemetry.pathHistory} currentHeading={telemetry.heading} />
          <ElevationPanel elevation={telemetry.elevation} />
        </div>

        <div className="panel-row">
          <BatteryPanel battery={telemetry.battery} />
          <TelemetryTable telemetry={telemetry} />
        </div>
      </main>
    </div>
  )
}

// Status Indicator Component
function StatusIndicator({ label, value, type }) {
  return (
    <div className={`status-indicator status-${type}`}>
      <span className="status-label">{label}</span>
      <span className="status-value">{value}</span>
    </div>
  )
}

// Compass Panel Component
function CompassPanel({ heading }) {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  const directionIndex = Math.round(heading / 45) % 8
  
  return (
    <div className="panel compass-panel">
      <h3 className="panel-title">COMPASS</h3>
      <div className="compass">
        <div className="compass-ring">
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => (
            <span 
              key={deg} 
              className="compass-mark"
              style={{ transform: `rotate(${deg}deg) translateY(-70px)` }}
            >
              {directions[i]}
            </span>
          ))}
        </div>
        <div 
          className="compass-needle"
          style={{ transform: `rotate(${heading}deg)` }}
        >
          <div className="needle-north">▲</div>
          <div className="needle-south">▼</div>
        </div>
        <div className="compass-center">
          <span className="heading-value">{heading.toFixed(0)}°</span>
          <span className="heading-direction">{directions[directionIndex]}</span>
        </div>
      </div>
    </div>
  )
}

// Coordinates Panel Component
function CoordinatesPanel({ latitude, longitude, elevation }) {
  const formatCoord = (value, isLat) => {
    const dir = isLat ? (value >= 0 ? 'N' : 'S') : (value >= 0 ? 'E' : 'W')
    const abs = Math.abs(value)
    const deg = Math.floor(abs)
    const min = ((abs - deg) * 60).toFixed(4)
    return `${deg}° ${min}' ${dir}`
  }

  return (
    <div className="panel coordinates-panel">
      <h3 className="panel-title">POSITION</h3>
      <div className="coordinates">
        <div className="coord-row">
          <span className="coord-label">LAT</span>
          <span className="coord-value">{formatCoord(latitude, true)}</span>
        </div>
        <div className="coord-row">
          <span className="coord-label">LNG</span>
          <span className="coord-value">{formatCoord(longitude, false)}</span>
        </div>
        <div className="coord-row elevation-row">
          <span className="coord-label">ALT</span>
          <span className="coord-value">{elevation.toFixed(1)} m</span>
        </div>
        <div className="coord-decimal">
          <span>{latitude.toFixed(6)}, {longitude.toFixed(6)}</span>
        </div>
      </div>
    </div>
  )
}

// Speed Panel Component
function SpeedPanel({ speed }) {
  const maxSpeed = 6
  const percentage = (speed / maxSpeed) * 100
  const segments = 12

  return (
    <div className="panel speed-panel">
      <h3 className="panel-title">SPEED</h3>
      <div className="speed-gauge">
        <div className="speed-arc">
          {Array.from({ length: segments }).map((_, i) => {
            const segmentPercent = ((i + 1) / segments) * 100
            const isActive = percentage >= segmentPercent - (100 / segments)
            return (
              <div 
                key={i}
                className={`speed-segment ${isActive ? 'active' : ''}`}
                style={{ 
                  transform: `rotate(${-90 + (i * 180 / segments)}deg)`,
                  opacity: isActive ? 1 : 0.2
                }}
              />
            )
          })}
        </div>
        <div className="speed-value">
          <span className="speed-number">{speed.toFixed(1)}</span>
          <span className="speed-unit">m/s</span>
        </div>
        <div className="speed-labels">
          <span>0</span>
          <span>{maxSpeed}</span>
        </div>
      </div>
    </div>
  )
}

// Heading Panel Component
function HeadingPanel({ heading }) {
  return (
    <div className="panel heading-panel">
      <h3 className="panel-title">HEADING</h3>
      <div className="heading-tape">
        <div 
          className="heading-scale"
          style={{ transform: `translateX(${-heading * 3}px)` }}
        >
          {Array.from({ length: 72 }).map((_, i) => {
            const deg = i * 5
            const isMain = deg % 30 === 0
            return (
              <div key={i} className={`heading-tick ${isMain ? 'main' : ''}`}>
                {isMain && <span className="heading-tick-label">{deg}°</span>}
              </div>
            )
          })}
        </div>
        <div className="heading-indicator">▼</div>
      </div>
    </div>
  )
}

// Path Panel Component
function PathPanel({ pathHistory, currentHeading }) {
  const scale = 150000
  
  if (pathHistory.length < 2) {
    return (
      <div className="panel path-panel">
        <h3 className="panel-title">PATH</h3>
        <div className="path-display">
          <span className="path-waiting">Acquiring path data...</span>
        </div>
      </div>
    )
  }

  const center = pathHistory[pathHistory.length - 1]
  const points = pathHistory.map(p => ({
    x: (p.lng - center.lng) * scale + 100,
    y: -(p.lat - center.lat) * scale + 80
  }))

  const pathD = points.reduce((acc, p, i) => {
    return acc + (i === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`)
  }, '')

  return (
    <div className="panel path-panel">
      <h3 className="panel-title">PATH TRAIL</h3>
      <div className="path-display">
        <svg viewBox="0 0 200 160" className="path-svg">
          <defs>
            <linearGradient id="pathGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#00ff88" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#00ff88" stopOpacity="1" />
            </linearGradient>
          </defs>
          <path 
            d={pathD} 
            fill="none" 
            stroke="url(#pathGradient)" 
            strokeWidth="2"
            strokeLinecap="round"
          />
          <g transform={`translate(${points[points.length - 1].x}, ${points[points.length - 1].y}) rotate(${currentHeading})`}>
            <polygon 
              points="0,-8 -5,5 5,5" 
              fill="#00ff88"
              className="drone-marker"
            />
          </g>
        </svg>
        <div className="path-info">
          <span>Trail: {pathHistory.length} points</span>
        </div>
      </div>
    </div>
  )
}

// Elevation Panel Component
function ElevationPanel({ elevation }) {
  const minElev = 100
  const maxElev = 200
  const percentage = ((elevation - minElev) / (maxElev - minElev)) * 100

  return (
    <div className="panel elevation-panel">
      <h3 className="panel-title">ELEVATION</h3>
      <div className="elevation-display">
        <div className="elevation-bar">
          <div 
            className="elevation-fill"
            style={{ height: `${percentage}%` }}
          />
          <div className="elevation-marks">
            {[200, 175, 150, 125, 100].map(mark => (
              <div key={mark} className="elevation-mark">
                <span>{mark}m</span>
              </div>
            ))}
          </div>
        </div>
        <div className="elevation-value">
          <span className="elev-number">{elevation.toFixed(1)}</span>
          <span className="elev-unit">m</span>
        </div>
      </div>
    </div>
  )
}

// Battery Panel Component
function BatteryPanel({ battery }) {
  const getStatusClass = () => {
    if (battery > 50) return 'good'
    if (battery > 20) return 'warning'
    return 'critical'
  }

  return (
    <div className="panel battery-panel">
      <h3 className="panel-title">BATTERY</h3>
      <div className="battery-display">
        <div className="battery-icon">
          <div className="battery-cap" />
          <div className="battery-body">
            <div 
              className={`battery-level ${getStatusClass()}`}
              style={{ width: `${battery}%` }}
            />
          </div>
        </div>
        <div className="battery-info">
          <span className={`battery-percentage ${getStatusClass()}`}>
            {battery.toFixed(0)}%
          </span>
          <span className="battery-estimate">
            ~{Math.floor(battery * 0.4)} min remaining
          </span>
        </div>
      </div>
    </div>
  )
}

// Telemetry Table Component
function TelemetryTable({ telemetry }) {
  const data = [
    { label: 'Latitude', value: telemetry.latitude.toFixed(6) + '°' },
    { label: 'Longitude', value: telemetry.longitude.toFixed(6) + '°' },
    { label: 'Elevation', value: telemetry.elevation.toFixed(2) + ' m' },
    { label: 'Heading', value: telemetry.heading.toFixed(1) + '°' },
    { label: 'Speed', value: telemetry.speed.toFixed(2) + ' m/s' },
    { label: 'Battery', value: telemetry.battery.toFixed(1) + '%' },
    { label: 'Signal', value: telemetry.signal.toFixed(0) + '%' },
    { label: 'Satellites', value: telemetry.satellites },
    { label: 'Mode', value: telemetry.mode },
    { label: 'Timestamp', value: new Date(telemetry.timestamp).toLocaleTimeString() },
  ]

  return (
    <div className="panel telemetry-table-panel">
      <h3 className="panel-title">RAW TELEMETRY</h3>
      <div className="telemetry-table">
        {data.map(({ label, value }) => (
          <div key={label} className="telemetry-row">
            <span className="telemetry-label">{label}</span>
            <span className="telemetry-value">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Camera Panel Component
function CameraPanel({ streamUrl, title = "CAMERA VIEW", variant = "main" }) {
  const videoRef = useRef(null)
  const hlsRef = useRef(null)
  const retryTimeoutRef = useRef(null)
  const [status, setStatus] = useState('connecting')
  const [error, setError] = useState(null)
  const [retryKey, setRetryKey] = useState(0)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    let isMounted = true

    // Clear any pending retry
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
    }

    // Cleanup previous instance
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }

    setStatus('connecting')
    setError(null)

    const scheduleRetry = (delay = 3000) => {
      retryTimeoutRef.current = setTimeout(() => {
        setRetryCount(prev => prev + 1)
        setRetryKey(prev => prev + 1)
      }, delay)
    }

    // Dynamic import of hls.js
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
          setError(null)
          setRetryCount(0)
          video.play().catch(() => {
            setStatus('paused')
          })
        })

        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                // Try to recover from network error
                setStatus('reconnecting')
                setError('Connection lost - reconnecting...')
                hls.startLoad()
                // If startLoad doesn't work, schedule full reconnect
                retryTimeoutRef.current = setTimeout(() => {
                  if (hlsRef.current) {
                    hlsRef.current.destroy()
                    hlsRef.current = null
                  }
                  scheduleRetry(2000)
                }, 5000)
                break
              case Hls.ErrorTypes.MEDIA_ERROR:
                // Try to recover from media error
                setStatus('reconnecting')
                setError('Media error - recovering...')
                hls.recoverMediaError()
                break
              default:
                hls.destroy()
                hlsRef.current = null
                setStatus('error')
                setError('Stream error - retrying...')
                scheduleRetry(3000)
                break
            }
          }
        })

        // Handle video element errors
        video.onerror = () => {
          setStatus('reconnecting')
          setError('Video error - reconnecting...')
          scheduleRetry(3000)
        }

        // Handle stalled playback
        video.onstalled = () => {
          setError('Buffering...')
        }

        video.onwaiting = () => {
          setError('Buffering...')
        }

        video.onplaying = () => {
          setStatus('playing')
          setError(null)
        }

      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari)
        video.src = streamUrl
        video.addEventListener('loadedmetadata', () => {
          setStatus('playing')
          setRetryCount(0)
          video.play().catch(() => setStatus('paused'))
        })
        video.addEventListener('error', () => {
          setStatus('reconnecting')
          setError('Connection lost - reconnecting...')
          scheduleRetry(3000)
        })
      } else {
        setStatus('error')
        setError('HLS not supported')
      }
    }).catch(() => {
      if (isMounted) {
        setStatus('error')
        setError('Failed to load video player')
      }
    })

    return () => {
      isMounted = false
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
      }
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
    }
  }, [streamUrl, retryKey])

  const handleReconnect = () => {
    setRetryCount(0)
    setRetryKey(prev => prev + 1)
  }

  const getStatusIndicator = () => {
    switch (status) {
      case 'connecting':
        return <span className="camera-status connecting">● CONNECTING</span>
      case 'reconnecting':
        return <span className="camera-status connecting">● RECONNECTING</span>
      case 'playing':
        return <span className="camera-status live">● LIVE</span>
      case 'paused':
        return <span className="camera-status paused">● PAUSED</span>
      case 'error':
        return <span className="camera-status error">● NO SIGNAL</span>
      default:
        return null
    }
  }

  return (
    <div className={`panel camera-panel camera-${variant}`}>
      <h3 className="panel-title">
        {title}
        {getStatusIndicator()}
      </h3>
      <div className="camera-container">
        <video
          ref={videoRef}
          className="camera-video"
          autoPlay
          muted
          playsInline
        />
        {(status === 'connecting' || status === 'reconnecting') && (
          <div className="camera-overlay">
            <div className="camera-loader">
              <div className="loader-ring"></div>
              <span>{status === 'reconnecting' ? 'Reconnecting...' : 'Connecting...'}</span>
              {retryCount > 0 && <span className="retry-count">Attempt {retryCount + 1}</span>}
            </div>
          </div>
        )}
        {status === 'error' && (
          <div className="camera-overlay">
            <div className="camera-error">
              <div className="no-signal-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 1l22 22M9 9a3 3 0 014.24 4.24M5.64 5.64A9 9 0 0118.36 18.36M2.05 2.05A13.5 13.5 0 0021.95 21.95" />
                </svg>
              </div>
              <span className="no-signal-text">NO SIGNAL</span>
              {variant === 'main' && <span className="no-signal-detail">{error}</span>}
              <button className="reconnect-btn" onClick={handleReconnect}>
                ↻ RECONNECT
              </button>
            </div>
          </div>
        )}
        <div className="camera-hud">
          <div className="hud-corner top-left"></div>
          <div className="hud-corner top-right"></div>
          <div className="hud-corner bottom-left"></div>
          <div className="hud-corner bottom-right"></div>
          {variant === 'main' && <div className="hud-crosshair"></div>}
        </div>
      </div>
    </div>
  )
}

export default App
