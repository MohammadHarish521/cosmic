/**
 * AETHER — Core domain types.
 *
 * NOTE ON DATA: every value produced by this application is *simulated*.
 * The orbital elements are plausible but not tied to any real catalogue entry,
 * and the telemetry is synthesised from a deterministic model. Nothing here
 * represents live tracking of an actual spacecraft.
 */

export type OrbitClass = "LEO" | "MEO" | "GEO";

export type SatStatus = "nominal" | "degraded" | "warning" | "critical" | "offline";

export type MissionType =
  | "earth-observation"
  | "navigation"
  | "comms"
  | "science"
  | "crewed";

export type LinkState = "locked" | "acquiring" | "lost";

export type AlertSeverity = "info" | "caution" | "warning" | "critical";

export type CameraMode = "overview" | "tracking" | "launch";

export type AppMode = "orbit" | "launch";

export type TimelinePhaseId =
  | "countdown"
  | "liftoff"
  | "maxq"
  | "meco"
  | "stagesep"
  | "fairing"
  | "insertion"
  | "deploy"
  | "checkout"
  | "nominal";

/** Classical Keplerian element set, valid from `epochMs`. */
export interface OrbitalElements {
  /** Semi-major axis, km. */
  semiMajorAxisKm: number;
  /** Eccentricity, dimensionless. */
  eccentricity: number;
  /** Inclination, degrees. */
  inclinationDeg: number;
  /** Right ascension of the ascending node, degrees. */
  raanDeg: number;
  /** Argument of periapsis, degrees. */
  argPeriapsisDeg: number;
  /** Mean anomaly at epoch, degrees. */
  meanAnomalyDeg: number;
  /** Epoch of the element set, ms since Unix epoch. */
  epochMs: number;
}

export interface Satellite {
  id: string;
  name: string;
  catalogId: string;
  callsign: string;
  operator: string;
  missionType: MissionType;
  orbitClass: OrbitClass;
  status: SatStatus;
  bus: string;
  payload: string;
  launchDate: string;
  element: OrbitalElements;
  /** Tag used by the on-globe legend. */
  accent: string;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** A fully resolved orbital state at a given simulation instant. */
export interface OrbitState {
  /** Position in the inertial (equatorial, Z-north) frame, km. */
  eci: Vec3;
  /** Position in the render frame (Y-north), km. */
  render: Vec3;
  /** Sub-satellite latitude, degrees. */
  lat: number;
  /** Sub-satellite longitude, degrees (earth-fixed). */
  lon: number;
  /** Altitude above mean sea level, km. */
  altKm: number;
  /** Instantaneous orbital speed, km/s. */
  speedKms: number;
  /** Orbital radius, km. */
  radiusKm: number;
  /** Orbital period, seconds. */
  periodSec: number;
  /** True anomaly, degrees. */
  trueAnomalyDeg: number;
  /** Mean anomaly, degrees. */
  meanAnomalyDeg: number;
  /** True anomaly of the ascending node used for ground tracks. */
  nodalAngleDeg: number;
}

export interface Telemetry {
  altitudeKm: number;
  velocityKms: number;
  groundSpeedKms: number;
  signalDbm: number;
  linkState: LinkState;
  batteryPct: number;
  busVoltage: number;
  temperatureC: number;
  radiationDose: number;
  dataRateMbps: number;
  downlinkMbps: number;
  attitudeErrorDeg: number;
  fuelPct: number;
  eclipse: boolean;
  sunlight: boolean;
}

export interface MissionEvent {
  id: string;
  /** Simulation instant the event belongs to, ms. */
  tMs: number;
  /** Wall-clock creation time for ordering of live events. */
  createdAt: number;
  category: "nominal" | "link" | "alert" | "recovery" | "launch" | "system";
  title: string;
  detail: string;
  satelliteId?: string;
  severity: AlertSeverity;
  source: string;
}

export interface ActiveAlert {
  id: string;
  satelliteId: string;
  title: string;
  detail: string;
  severity: AlertSeverity;
  startedAtSimMs: number;
  /** Duration of the fault in simulation milliseconds. */
  durationSimMs: number;
  acknowledged: boolean;
}

export interface GroundStation {
  id: string;
  name: string;
  code: string;
  lat: number;
  lon: number;
  /** Station health 0..1. */
  health: number;
}

export interface TimelinePhase {
  id: TimelinePhaseId;
  label: string;
  shortLabel: string;
  /** Offset from mission epoch, ms. */
  startOffsetMs: number;
  endOffsetMs: number;
  description: string;
}

export interface ChartSample {
  t: number;
  value: number;
}
