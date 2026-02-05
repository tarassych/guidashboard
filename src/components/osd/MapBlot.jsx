/**
 * Map Blot Component
 * Google Maps with organic blot/splatter mask effect
 * Positioned at bottom-right for FPV OSD
 */
import { useState, useEffect, useRef, useMemo } from 'react'
import { GoogleMap, useJsApiLoader, Marker, Polyline } from '@react-google-maps/api'
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

export function MapBlot({ pathHistory = [], heading = 0, lat, lng }) {
  const [zoom, setZoom] = useState(17)
  const mapRef = useRef(null)
  
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: config.googleMapsApiKey,
    id: 'google-map-script'
  })
  
  const containerStyle = {
    width: '100%',
    height: '100%'
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
    heading: 0, // Always North-up
    tilt: 0
  }), [])
  
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
  
  useEffect(() => {
    if (mapRef.current && lat && lng) {
      mapRef.current.setCenter({ lat, lng })
    }
  }, [lat, lng])

  return (
    <div className="map-blot">
      <div className="map-blot-mask">
        <div className="map-blot-content">
          {loadError && (
            <div className="map-blot-error">Map Error</div>
          )}
          
          {!isLoaded && !loadError && (
            <div className="map-blot-loading">Loading...</div>
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
        </div>
      </div>
    </div>
  )
}

export default MapBlot
