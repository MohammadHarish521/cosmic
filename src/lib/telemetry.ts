/**
 * Telemetry synthesis.
 *
 * Values are derived from the simulated orbital state plus deterministic
 * noise, so every readout on the dashboard is reproducible and internally
 * consistent (e.g. the link is only "locked" when a ground station is
 * geometrically in view).
 */

import { EARTH_RADIUS_KM, KM_TO_UNITS, MISSION_EPOCH_MS } from "./constants";
import { GROUND_STATIONS } from "./fleet";
import { DEG, RAD, eciToRender, latLonToRender, propagate, sunDirectionEci } from "./orbits";
import { fbm1D, noise1D } from "./rng";
import type { GroundStation, LinkState, OrbitState, Satellite, Telemetry } from "./types";

export interface PassInfo {
  station: GroundStation;
  /** Angular separation between sub-satellite point and station, degrees. */
  separationDeg: number;
  /** Max separation for a geometric horizon contact, degrees. */
  horizonDeg: number;
  /** Elevation of the satellite above the station horizon, degrees. */
  elevationDeg: number;
  durationSec: number;
}

/** Render-frame unit vector toward the Sun. */
export function sunRenderDirection(tMs: number) {
  return eciToRender(sunDirectionEci(tMs));
}

/** Angular separation between two geocentric points, degrees. */
export function angularSeparation(
  latA: number,
  lonA: number,
  latB: number,
  lonB: number
): number {
  const a = latLonToRender(latA, lonA);
  const b = latLonToRender(latB, lonB);
  const dot = a.x * b.x + a.y * b.y + a.z * b.z;
  return Math.acos(Math.max(-1, Math.min(1, dot))) * RAD;
}

/** Maximum central angle at which a satellite is above a station horizon. */
export function horizonSeparationDeg(radiusKm: number): number {
  return Math.acos(Math.max(-1, Math.min(1, EARTH_RADIUS_KM / radiusKm))) * RAD;
}

/** Find the ground station currently in view, if any. */
export function findPass(state: OrbitState): PassInfo | null {
  const horizon = horizonSeparationDeg(state.radiusKm);
  let best: PassInfo | null = null;

  for (const station of GROUND_STATIONS) {
    const sep = angularSeparation(state.lat, state.lon, station.lat, station.lon);
    if (sep <= horizon) {
      const cosTheta = Math.cos(sep * DEG);
      const sinTheta = Math.sin(sep * DEG);
      // Elevation above the station horizon. θ is the geocentric angle
      // between the station and the sub-satellite point:
      //   ε = atan2(cos θ − R/r, sin θ)
      // Overhead is +90°, the geometric horizon is 0°.
      const elevation =
        Math.atan2(cosTheta - EARTH_RADIUS_KM / state.radiusKm, sinTheta) * RAD;
      const durationSec = (2 * horizon * DEG * state.periodSec) / (2 * Math.PI);
      const candidate: PassInfo = {
        station,
        separationDeg: sep,
        horizonDeg: horizon,
        elevationDeg: elevation,
        durationSec,
      };
      if (!best || candidate.elevationDeg > best.elevationDeg) best = candidate;
    }
  }
  return best;
}

/** True when the satellite is in the Earth's shadow. */
export function isEclipsed(state: OrbitState, sunDir: { x: number; y: number; z: number }) {
  const r = Math.hypot(state.render.x, state.render.y, state.render.z);
  const ux = state.render.x / r;
  const uy = state.render.y / r;
  const uz = state.render.z / r;
  const cosTheta = ux * sunDir.x + uy * sunDir.y + uz * sunDir.z;
  // Umbra threshold: Earth's angular radius as seen from the satellite.
  const earthAngularRadius = Math.asin(EARTH_RADIUS_KM / state.radiusKm);
  const sunAngularRadius = 0.00465;
  return Math.acos(Math.max(-1, Math.min(1, cosTheta))) < earthAngularRadius - sunAngularRadius;
}

export interface TelemetryOptions {
  /** Multiplier applied to link degradation, 0..1. */
  alertFactor?: number;
  /** Current alert severity for the satellite. */
  severity?: "info" | "caution" | "warning" | "critical";
}

const MISSION_ACTIVE_WINDOW = { start: 285_000, end: 3.5 * 3600_000 };

/** Build the full telemetry packet for a satellite at a given instant. */
export function computeTelemetry(
  sat: Satellite,
  state: OrbitState,
  tMs: number,
  opts: TelemetryOptions = {}
): Telemetry & { pass: PassInfo | null } {
  const sunDir = sunRenderDirection(tMs);
  const eclipse = isEclipsed(state, sunDir);
  const pass = findPass(state);
  const tSec = tMs / 1000;
  const seed = sat.id;

  const alertFactor = opts.alertFactor ?? 0;
  const severity = opts.severity ?? "info";

  // ---- Link ------------------------------------------------------------
  let linkState: LinkState = "lost";
  let signalDbm: number;
  if (pass) {
    // Acquisition ramp near the horizon, full lock at high elevation.
    const quality = Math.max(
      0,
      Math.min(1, (pass.elevationDeg + 1.5) / 24)
    );
    linkState = quality > 0.18 ? "locked" : "acquiring";
    signalDbm = -88 + 40 * quality + noise1D(`${seed}:link`, tSec) * 1.6;
  } else {
    linkState = "lost";
    signalDbm = -108 + noise1D(`${seed}:link`, tSec) * 2.4;
  }

  if (alertFactor > 0) {
    signalDbm -= alertFactor * 46 * (0.6 + 0.4 * Math.sin(tSec * 0.9 + 1.3));
    if (alertFactor > 0.55 && linkState === "locked") linkState = "acquiring";
    if (alertFactor > 0.85) linkState = "lost";
  }

  // ---- Power -----------------------------------------------------------
  const cycle = ((tMs % (state.periodSec * 2000)) / (state.periodSec * 2000));
  const chargeWave = 0.5 - 0.5 * Math.cos(cycle * Math.PI * 2);
  let batteryPct = 82 + chargeWave * 16 - (eclipse ? 6 : 0);
  batteryPct -= alertFactor * 9;
  batteryPct += fbm1D(`${seed}:batt`, tSec * 0.08, 2) * 1.6;
  batteryPct = Math.max(12, Math.min(99.6, batteryPct));

  const busVoltage = 27.4 + (batteryPct - 78) * 0.021 + noise1D(`${seed}:v`, tSec) * 0.22;

  // ---- Thermal ---------------------------------------------------------
  const thermalTarget = eclipse ? -8.5 : 21.5;
  const thermalSwing = Math.sin(tSec * 0.35 + sat.element.raanDeg) * 3.4;
  let temperatureC = thermalTarget + thermalSwing + fbm1D(`${seed}:temp`, tSec * 0.12, 3) * 4.2;
  if (severity === "critical") temperatureC += 6.5;
  else if (severity === "warning") temperatureC += 3.2;

  // ---- Radiation --------------------------------------------------------
  // The South Atlantic Anomaly produces a pronounced dose bump near the equator.
  const saa = Math.exp(-Math.pow((state.lat + 22) / 17, 2));
  const polar = Math.abs(state.lat) > 60 ? 1.35 : 1;
  let radiationDose =
    (0.021 + saa * 0.085 * polar + (sat.orbitClass === "MEO" ? 0.028 : 0)) *
    (1 + 0.25 * Math.sin(tSec * 0.07));
  radiationDose *= 1 + alertFactor * 0.6;

  // ---- Data ------------------------------------------------------------
  const missionOffsetMs = tMs - MISSION_EPOCH_MS;
  const payloadActive =
    missionOffsetMs > MISSION_ACTIVE_WINDOW.start &&
    missionOffsetMs < MISSION_ACTIVE_WINDOW.end;
  const activityCycle = 0.5 + 0.5 * Math.sin(tSec * 0.045 + sat.element.meanAnomalyDeg * 0.01);
  const dataRateMbps = payloadActive
    ? 38 + activityCycle * 520 + noise1D(`${seed}:data`, tSec) * 22
    : 0;

  const downlinkMbps = pass
    ? Math.max(0, (signalDbm + 110) * 3.1 * (pass.elevationDeg > 0 ? 1 : 0))
    : 0;

  // ---- Attitude & propellant -------------------------------------------
  const attitudeErrorDeg = Math.abs(
    0.11 + fbm1D(`${seed}:att`, tSec * 0.05, 3) * 0.28 + alertFactor * 0.5
  );
  const hoursSinceEpoch = (tMs - sat.element.epochMs) / 3600000;
  const fuelPct = Math.max(
    34,
    97 - hoursSinceEpoch * (sat.missionType === "crewed" ? 0.62 : 0.18) -
      (sat.orbitClass === "MEO" ? 0.3 : 0)
  );

  // Ground speed is the projection of the inertial velocity onto the surface.
  const groundSpeedKms = state.speedKms * 0.92;

  return {
    altitudeKm: state.altKm,
    velocityKms: state.speedKms,
    groundSpeedKms,
    signalDbm,
    linkState,
    batteryPct,
    busVoltage,
    temperatureC,
    radiationDose,
    dataRateMbps,
    downlinkMbps,
    attitudeErrorDeg,
    fuelPct,
    eclipse,
    sunlight: !eclipse,
    pass,
  };
}

/** Convert kilometres to render units. */
export function kmToUnits(km: number): number {
  return km * KM_TO_UNITS;
}

/** Convenience: propagate + telemetry in one call. */
export function snapshot(
  sat: Satellite,
  tMs: number,
  opts: TelemetryOptions = {}
): { state: OrbitState; telemetry: ReturnType<typeof computeTelemetry> } {
  const state = propagate(sat.element, tMs, { epochMs: MISSION_EPOCH_MS });
  return { state, telemetry: computeTelemetry(sat, state, tMs, opts) };
}
