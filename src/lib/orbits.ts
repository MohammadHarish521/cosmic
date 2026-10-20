/**
 * Two-body orbital mechanics.
 *
 * Frames used throughout AETHER:
 *  - ECI  : inertial equatorial frame. X toward the vernal equinox,
 *           Y toward 90°E, Z toward the north pole. Right handed.
 *  - Render: the frame used by three.js. Y is the polar axis, X points at the
 *           prime-meridian direction of the map and Z completes the set.
 *           Render = (eci.x, eci.z, eci.y).
 */

import { EARTH_RADIUS_KM, MU } from "./constants";
import type { OrbitalElements, OrbitState, Vec3 } from "./types";

export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;

export function wrap360(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

export function wrap180(deg: number): number {
  const v = wrap360(deg);
  return v > 180 ? v - 360 : v;
}

function rotZ(v: Vec3, a: number): Vec3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c, z: v.z };
}

function rotX(v: Vec3, a: number): Vec3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: v.x, y: v.y * c - v.z * s, z: v.y * s + v.z * c };
}

/** ECI from the perifocal frame. */
export function perifocalToEci(
  pqw: Vec3,
  inclinationDeg: number,
  raanDeg: number,
  argPeriapsisDeg: number
): Vec3 {
  let v = rotZ(pqw, argPeriapsisDeg * DEG);
  v = rotX(v, inclinationDeg * DEG);
  v = rotZ(v, raanDeg * DEG);
  return v;
}

/** Solve Kepler's equation M = E - e sin E for the eccentric anomaly. */
export function solveKepler(meanAnomalyRad: number, eccentricity: number): number {
  const e = eccentricity;
  let M = meanAnomalyRad % (2 * Math.PI);
  if (M > Math.PI) M -= 2 * Math.PI;
  if (M < -Math.PI) M += 2 * Math.PI;
  let E = e < 0.8 ? M : Math.PI * Math.sign(M || 1);
  for (let i = 0; i < 24; i++) {
    const f = E - e * Math.sin(E) - M;
    const fp = 1 - e * Math.cos(E);
    const d = f / fp;
    E -= d;
    if (Math.abs(d) < 1e-11) break;
  }
  return E;
}

/** Orbital period in seconds. */
export function orbitalPeriodSec(semiMajorAxisKm: number): number {
  return 2 * Math.PI * Math.sqrt(Math.pow(semiMajorAxisKm, 3) / MU);
}

/**
 * Greenwich Mean Sidereal Time in degrees for a given instant.
 * Standard IAU 1982 series (truncated) — accurate to well under an arcminute.
 */
export function gmstDeg(tMs: number): number {
  const jd = tMs / 86400000 + 2440587.5;
  const d = jd - 2451545.0;
  const T = d / 36525;
  let theta =
    280.46061837 +
    360.98564736629 * d +
    0.000387933 * T * T -
    (T * T * T) / 38710000;
  return wrap360(theta);
}

/**
 * Unit vector toward the Sun in the ECI frame (low-precision ephemeris).
 * Accurate to roughly 0.01°, which is far beyond what the globe needs.
 */
export function sunDirectionEci(tMs: number): Vec3 {
  const jd = tMs / 86400000 + 2440587.5;
  const n = jd - 2451545.0;
  const meanLong = wrap360(280.46 + 0.9856474 * n);
  const meanAnom = wrap360(357.528 + 0.9856003 * n) * DEG;
  const eclipticLon =
    (meanLong + 1.915 * Math.sin(meanAnom) + 0.02 * Math.sin(2 * meanAnom)) * DEG;
  const obliquity = (23.439 - 0.0000004 * n) * DEG;
  return {
    x: Math.cos(eclipticLon),
    y: Math.cos(obliquity) * Math.sin(eclipticLon),
    z: Math.sin(obliquity) * Math.sin(eclipticLon),
  };
}

/** Convert an ECI vector into the render frame. */
export function eciToRender(v: Vec3): Vec3 {
  return { x: v.x, y: v.z, z: v.y };
}

export interface PropagateOptions {
  /** Reference epoch used to define the earth-fixed longitude origin. */
  epochMs: number;
}

/**
 * Propagate a Keplerian element set to an instant and resolve the full
 * orbital state (position, velocity, sub-point, altitude).
 */
export function propagate(
  el: OrbitalElements,
  tMs: number,
  opts: PropagateOptions
): OrbitState {
  const dtSec = (tMs - el.epochMs) / 1000;
  const n = Math.sqrt(MU / Math.pow(el.semiMajorAxisKm, 3)); // rad/s
  const M0 = el.meanAnomalyDeg * DEG;
  const M = M0 + n * dtSec;
  const E = solveKepler(M, el.eccentricity);

  const cosE = Math.cos(E);
  const sinE = Math.sin(E);
  const e = el.eccentricity;
  const a = el.semiMajorAxisKm;
  const b = a * Math.sqrt(1 - e * e);

  // Perifocal position and velocity.
  const rPqw = { x: a * (cosE - e), y: b * sinE, z: 0 };
  const sqrtMuOverA = Math.sqrt(MU / a);
  const vPqw = {
    x: (-sqrtMuOverA / a) * sinE * a,
    y: (sqrtMuOverA / b) * b * cosE,
    z: 0,
  };
  vPqw.x = -sqrtMuOverA * sinE;
  vPqw.y = sqrtMuOverA * Math.sqrt(1 - e * e) * cosE;

  const eci = perifocalToEci(rPqw, el.inclinationDeg, el.raanDeg, el.argPeriapsisDeg);
  const vel = perifocalToEci(vPqw, el.inclinationDeg, el.raanDeg, el.argPeriapsisDeg);

  const radiusKm = Math.hypot(eci.x, eci.y, eci.z);
  const speedKms = Math.hypot(vel.x, vel.y, vel.z);

  const render = eciToRender(eci);
  const lat = Math.asin(eci.z / radiusKm) * RAD;

  // Earth-fixed longitude: render-frame azimuth minus the sidereal rotation.
  const theta = gmstDeg(tMs) - gmstDeg(opts.epochMs);
  const azimuth = Math.atan2(render.z, render.x) * RAD;
  const lon = wrap180(azimuth - theta);

  const trueAnomaly = Math.atan2(
    Math.sqrt(1 - e * e) * sinE,
    cosE - e
  );

  return {
    eci,
    render,
    lat,
    lon,
    altKm: radiusKm - EARTH_RADIUS_KM,
    speedKms,
    radiusKm,
    periodSec: orbitalPeriodSec(a),
    trueAnomalyDeg: wrap360(trueAnomaly * RAD),
    meanAnomalyDeg: wrap360(M * RAD),
    nodalAngleDeg: wrap360(trueAnomaly * RAD),
  };
}

/**
 * Sample a full revolution of the orbit as render-frame points.
 *
 * The ellipse is inertially fixed, so this is computed once per satellite.
 * The sweep is parameterised by true anomaly, which lets the renderer index
 * straight into the buffer using the live orbital state.
 */
export function sampleOrbit(
  el: OrbitalElements,
  segments = 256,
  scale = 1 / 1000
): Float32Array {
  const out = new Float32Array((segments + 1) * 3);
  const a = el.semiMajorAxisKm;
  const e = el.eccentricity;
  const p = a * (1 - e * e);
  for (let i = 0; i <= segments; i++) {
    const nu = (i / segments) * Math.PI * 2;
    const r = p / (1 + e * Math.cos(nu));
    const pqw = { x: r * Math.cos(nu), y: r * Math.sin(nu), z: 0 };
    const eci = perifocalToEci(
      pqw,
      el.inclinationDeg,
      el.raanDeg,
      el.argPeriapsisDeg
    );
    const r3 = eciToRender(eci);
    out[i * 3] = r3.x * scale;
    out[i * 3 + 1] = r3.y * scale;
    out[i * 3 + 2] = r3.z * scale;
  }
  return out;
}

/**
 * Sample the sub-satellite ground track over one revolution.
 * Returns [lat, lon] pairs in degrees.
 */
export function sampleGroundTrack(
  el: OrbitalElements,
  epochMs: number,
  segments = 180
): Float32Array {
  const out = new Float32Array((segments + 1) * 2);
  const periodMs = orbitalPeriodSec(el.semiMajorAxisKm) * 1000;
  for (let i = 0; i <= segments; i++) {
    const t = epochMs + (i / segments) * periodMs;
    const s = propagate(el, t, { epochMs });
    out[i * 2] = s.lat;
    out[i * 2 + 1] = s.lon;
  }
  return out;
}

/** Convert latitude/longitude (degrees) to a render-frame unit vector. */
export function latLonToRender(latDeg: number, lonDeg: number): Vec3 {
  const lat = latDeg * DEG;
  const lon = lonDeg * DEG;
  return {
    x: Math.cos(lat) * Math.cos(lon),
    y: Math.sin(lat),
    z: Math.cos(lat) * Math.sin(lon),
  };
}

/** Number of revolutions completed since epoch (fractional). */
export function revsSinceEpoch(el: OrbitalElements, tMs: number): number {
  const periodMs = orbitalPeriodSec(el.semiMajorAxisKm) * 1000;
  return (tMs - el.epochMs) / periodMs;
}
