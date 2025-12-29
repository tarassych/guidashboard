import { useRef, useState, useEffect } from 'react'
import './CameraFeed.css'

// Camera Feed Component - HLS video player with auto-reconnect
function CameraFeed({ streamUrl, variant = "main" }) {
  const videoRef = useRef(null)
  const hlsRef = useRef(null)
  const retryTimeoutRef = useRef(null)
  const [status, setStatus] = useState('connecting')
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !streamUrl) return

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

export default CameraFeed




