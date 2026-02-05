/**
 * HUD Left Panel Component
 * Contains compass (optional), drone name with type icon, satellites, and quality switch
 */
import { DRONE_TYPES } from '../../telemetrySchemas'
import { GroundDroneIcon, FpvDroneIcon } from './DroneTypeIcons'
import { HudCompass } from './HudCompass'
import { SatelliteIndicator } from './SatelliteIndicator'
import { QualitySwitch } from './QualitySwitch'

export function HudLeftPanel({
  heading,
  direction,
  droneName,
  droneType,
  satellites,
  hasHdStream,
  hdMode,
  onHdToggle,
  showCompass = true
}) {
  return (
    <div className="hud-left-panel">
      {showCompass ? (
        <>
          <div className="hud-compass-row">
            <HudCompass heading={heading} direction={direction} />
            <span className="hud-drone-name">
              {droneType === DRONE_TYPES.GENERIC_FPV ? (
                <FpvDroneIcon size={20} active={true} />
              ) : (
                <GroundDroneIcon size={20} active={true} />
              )}
              {droneName.toUpperCase()}
            </span>
          </div>
          <SatelliteIndicator satellites={satellites} />
          {hasHdStream && (
            <QualitySwitch isHd={hdMode} onToggle={onHdToggle} />
          )}
        </>
      ) : (
        /* Flying OSD - no compass, no satellites (satellites in top bar), quality switch in place of satellites */
        <div className="hud-info-row">
          {hasHdStream && (
            <QualitySwitch isHd={hdMode} onToggle={onHdToggle} />
          )}
          <span className="hud-drone-name">
            {droneType === DRONE_TYPES.GENERIC_FPV ? (
              <FpvDroneIcon size={20} active={true} />
            ) : (
              <GroundDroneIcon size={20} active={true} />
            )}
            {droneName.toUpperCase()}
          </span>
        </div>
      )}
    </div>
  )
}
