import { useRef, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import './CameraFeed.css'

// Camera Feed Component - WebRTC player with auto-reconnect via WHEP
function CameraFeed({ streamUrl, variant = "main" }) {
  const { t } = useTranslation()
  const videoRef = useRef(null)
  const pcRef = useRef(null)
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

    // Cleanup previous connection
    if (pcRef.current) {
      pcRef.current.close()
      pcRef.current = null
    }

    setStatus('connecting')

    const scheduleRetry = (delay = 3000) => {
      retryTimeoutRef.current = setTimeout(() => {
        if (isMounted) setRetryKey(prev => prev + 1)
      }, delay)
    }

    const startWebRTC = async () => {
      try {
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        })
        pcRef.current = pc

        pc.ontrack = (event) => {
          if (isMounted) {
            video.srcObject = event.streams[0]
            setStatus('playing')
          }
        }

        pc.oniceconnectionstatechange = () => {
          if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
            if (isMounted) {
              setStatus('reconnecting')
              scheduleRetry(2000)
            }
          }
        }

        // Add transceivers for receiving video/audio
        pc.addTransceiver('video', { direction: 'recvonly' })
        pc.addTransceiver('audio', { direction: 'recvonly' })

        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)

        // Wait for ICE gathering to complete
        await new Promise((resolve) => {
          if (pc.iceGatheringState === 'complete') {
            resolve()
          } else {
            const checkState = () => {
              if (pc.iceGatheringState === 'complete') {
                pc.removeEventListener('icegatheringstatechange', checkState)
                resolve()
              }
            }
            pc.addEventListener('icegatheringstatechange', checkState)
            // Timeout fallback
            setTimeout(resolve, 2000)
          }
        })

        // Send offer to MediaMTX WHEP endpoint
        const response = await fetch(streamUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/sdp' },
          body: pc.localDescription.sdp
        })

        if (!response.ok) throw new Error('WHEP request failed')

        const answerSdp = await response.text()
        await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp })

      } catch (error) {
        console.error('WebRTC error:', error)
        if (isMounted) {
          setStatus('error')
          scheduleRetry(3000)
        }
      }
    }

    startWebRTC()

    return () => {
      isMounted = false
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current)
      if (pcRef.current) {
        pcRef.current.close()
        pcRef.current = null
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
          {status === 'connecting' && <span className="status-text">◌ {t('camera.connecting')}</span>}
          {status === 'reconnecting' && <span className="status-text">↻ {t('camera.reconnecting')}</span>}
          {status === 'error' && <span className="status-text error">✕ {t('camera.noSignal')}</span>}
        </div>
      )}
    </div>
  )
}

export default CameraFeed
