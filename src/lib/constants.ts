/**
 * Mission-wide constants. Single source of truth for the simulation clock,
 * physical constants and the mission timeline.
 */

/** Render scale: 1 scene unit == 1000 km. */
export const KM_TO_UNITS = 1 / 1000;

export const EARTH_RADIUS_KM = 6371.0088;
export const EARTH_RADIUS_UNITS = EARTH_RADIUS_KM * KM_TO_UNITS;
export const MU = 398600.4418; // km^3 / s^2
export const EARTH_SIDEREAL_DAY_SEC = 86164.0905;

/**
 * Mission epoch — the instant of liftoff (T+00:00:00).
 * Fixed so the entire simulation is reproducible.
 */
export const MISSION_EPOCH_MS = Date.UTC(2026, 0, 14, 6, 12, 0);

/** Seconds of simulated time per real second at 1x. */
export const TIME_SCALES = [1, 5, 20] as const;
export type TimeScale = (typeof TIME_SCALES)[number];

/** Length of the scrubable mission window, in simulated milliseconds. */
export const MISSION_WINDOW_MS = 4 * 60 * 60 * 1000; // 4 hours
export const MISSION_START_MS = MISSION_EPOCH_MS - 10 * 60 * 1000; // T-10:00
export const MISSION_END_MS = MISSION_START_MS + MISSION_WINDOW_MS;

/** Orbit insertion (SECO + coast complete) offset from liftoff. */
export const INSERTION_OFFSET_MS = 285 * 1000; // T+00:04:45

/** Ground sample colour tokens, mirrored in globals.css. */
export const COLORS = {
  cyan: "#4FE3FF",
  cyanDeep: "#1E7F9B",
  amber: "#FFB020",
  amberDeep: "#8A5B12",
  red: "#FF5F56",
  green: "#3DF5A6",
  violet: "#9C8CFF",
  ink: "#05070B",
} as const;

/** Mission-wide "simulated data" disclosure. */
export const SIMULATION_DISCLOSURE =
  "Simulated telemetry — deterministic model, not live tracking.";
