/**
 * Map Panel Component
 * Google Maps integration with path history and drone marker
 */
import { useState, useEffect, useRef, useMemo } from 'react'
import { GoogleMap, useJsApiLoader, Marker, Polyline } from '@react-google-maps/api'
import { useTranslation } from 'react-i18next'
import config from '../../config'

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

export function MapPanel({ pathHistory, heading, lat, lng, altitude }) {
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
