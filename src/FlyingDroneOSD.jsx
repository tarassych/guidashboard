/**
 * Flying Drone OSD (Generic FPV)
 * OSD layout for FPV quadcopters
 */
import { useTranslation } from 'react-i18next'
import CameraFeed from './components/CameraFeed'
import {
  HudTopBar,
  HudLeftPanel,
  Crosshair,
  TelemetryStrip,
  MapPanel,
  ControlIcon
} from './components/osd'

/**
 * Flying Drone OSD Component
 * OSD layout for FPV drones - uses shared components
 */
export default function FlyingDroneOSD({
  telemetry,
  droneName,
  droneType,
  isActive,
  elrsConnected,
  hdMode,
  onHdToggle,
  mainCameraUrl,
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

      {/* HUD Overlay - FPV specific */}
      <div className="hud-overlay flying-drone-osd">
        {/* Top Bar - shared component, no failsafe for FPV */}
        <HudTopBar
          telemetry={telemetry}
          isActive={isActive}
          onShareClick={onShareClick}
          showFailsafe={false}
        />
        
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
        <Crosshair />
        
        {/* Control Icon */}
        <ControlIcon
          isActive={isActive}
          elrsConnected={elrsConnected}
          onClick={onControlClick}
        />
        
        {/* Bottom Telemetry Strip - uses FPV schema for fields */}
        <div className="hud-bottom-strip">
          <TelemetryStrip telemetry={telemetry} droneType={droneType} />
        </div>
      </div>
    </>
  )
}
