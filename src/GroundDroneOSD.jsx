/**
 * Ground Drone OSD (Foxy)
 * Full OSD layout for ground vehicles with fuse switches, rear mirror, speedometer, etc.
 */
import { useTranslation } from 'react-i18next'
import CameraFeed from './components/CameraFeed'
import {
  HudTopBar,
  HudLeftPanel,
  FuseSwitch,
  Speedometer,
  PowerIndicator,
  MapPanel,
  HeadingTape,
  WarningBanner,
  TelemetryStrip,
  ControlIcon,
  Crosshair
} from './components/osd'

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
        <Crosshair />

        {/* Control Icon */}
        <ControlIcon
          isActive={isActive}
          elrsConnected={elrsConnected}
          onClick={onControlClick}
        />

        {/* Bottom Telemetry Strip */}
        <div className="hud-bottom-strip">
          <TelemetryStrip telemetry={telemetry} droneType={droneType} />
        </div>
      </div>
    </>
  )
}
