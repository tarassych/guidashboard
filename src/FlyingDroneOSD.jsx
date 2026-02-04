/**
 * Flying Drone OSD (Generic FPV)
 * OSD layout for FPV quadcopters
 */
import { useTranslation } from 'react-i18next'
import CameraFeed from './components/CameraFeed'
import {
  HudTopBar,
  HudLeftPanel,
  TelemetryStrip,
  MapPanel,
  ControlIcon,
  AirspeedTape,
  AltitudeTape,
  ArtificialHorizon,
  SlipSkidIndicator,
  HeadingCompassArc
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
      
      {/* Artificial Horizon Overlay - covers camera view */}
      <ArtificialHorizon 
        pitch={telemetry.pitch || 0} 
        roll={telemetry.roll || 0} 
      />

      {/* HUD Overlay - FPV specific */}
      <div className="hud-overlay flying-drone-osd">
        {/* Top Bar - shared component, no failsafe for FPV, show flight mode instead */}
        <HudTopBar
          telemetry={telemetry}
          isActive={isActive}
          onShareClick={onShareClick}
          showFailsafe={false}
          showFlightMode={true}
          showStatusMode={false}
        />
        
        {/* Left Panel - Drone Name & Satellites & Quality (no compass for FPV) */}
        <HudLeftPanel
          heading={telemetry.heading}
          direction={directions[directionIndex]}
          droneName={droneName}
          droneType={droneType}
          satellites={telemetry.satellites}
          hasHdStream={hasHdStream}
          hdMode={hdMode}
          onHdToggle={onHdToggle}
          showCompass={false}
        />
        
        {/* Airspeed Tape - Garmin G1000 style (left side) */}
        <AirspeedTape speed={telemetry.groundspeed || 0} unit="KM/H" />
        
        {/* Altitude Tape - Garmin G1000 style (right side) */}
        <AltitudeTape altitude={telemetry.altitude || 0} unit="M" />
        
        {/* Slip-Skid Indicator (Turn Coordinator) - bottom arc with yaw ball */}
        <SlipSkidIndicator yaw={telemetry.yaw || 0} />
        
        {/* Heading Compass Arc - bottom of screen */}
        <HeadingCompassArc heading={telemetry.heading || 0} />
        
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
