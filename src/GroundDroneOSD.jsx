/**
 * Ground Drone OSD (Foxy / UGV)
 * Full OSD layout for ground vehicles with speedometer, etc.
 * For Foxy: includes fuse switches, rear mirror, armed warning.
 * For UGV: fuse switches, rear mirror, and armed styling are hidden.
 */
import { useTranslation } from 'react-i18next'
import { DRONE_TYPES } from './telemetrySchemas'
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
  const isUgv = droneType === DRONE_TYPES.UGV
  
  return (
    <>
      {/* Full-screen Front Camera Background */}
      <div className="main-camera-bg">
        <CameraFeed streamUrl={mainCameraUrl} />
      </div>

      {/* HUD Overlay - ugv modifier hides mirror section and repositions heading tape */}
      <div className={`hud-overlay ${isUgv ? 'hud-overlay--ugv' : ''}`}>
        {/* Top Bar */}
        <HudTopBar
          telemetry={telemetry}
          isActive={isActive}
          onShareClick={onShareClick}
          showFailsafe={true}
        />

        {/* Fuse Switches & Rear View Mirror - hidden for UGV */}
        {!isUgv && (
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
        )}

        {/* Heading Tape or Warning Banner - UGV always shows heading tape (no armed warning) */}
        {(!isUgv && telemetry.f1 && telemetry.f2) ? (
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
