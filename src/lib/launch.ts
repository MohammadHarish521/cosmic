/**
 * Cinematic launch sequence model.
 *
 * The vehicle is flown inside the orbital plane of the target orbit: the
 * ground track sweeps from the launch site while the radius grows, which
 * produces a physically plausible ascent arc rather than an arbitrary path.
 */

import { EARTH_RADIUS_KM, INSERTION_OFFSET_MS, KM_TO_UNITS, MISSION_EPOCH_MS } from "./constants";
import { DEG, RAD, latLonToRender } from "./orbits";
import type { Vec3 } from "./types";

/** Launch complex — Kourou, French Guiana. */
export const LAUNCH_SITE = { lat: 5.24, lon: -52.8, code: "ELA-3" };

/** Target orbit inclination for the mission stack. */
export const TARGET_INCLINATION_DEG = 51.64;

export const LAUNCH_END_MS = MISSION_EPOCH_MS + INSERTION_OFFSET_MS;
export const LAUNCH_START_MS = MISSION_EPOCH_MS - 10 * 60 * 1000;

function normalize(v: Vec3): Vec3 {
  const l = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

const siteVec = latLonToRender(LAUNCH_SITE.lat, LAUNCH_SITE.lon);

/**
 * Normal of the target orbital plane chosen so the plane contains the launch
 * site and the vehicle departs on an easterly heading.
 */
function orbitalNormal(): Vec3 {
  const inc = TARGET_INCLINATION_DEG * DEG;
  const p = siteVec;
  const A = Math.sin(inc) * p.x;
  const B = Math.sin(inc) * p.y;
  const C = -Math.cos(inc) * p.z;
  const R = Math.hypot(A, B);
  const phi = Math.atan2(B, A);
  const cosArg = Math.max(-1, Math.min(1, C / (R || 1)));
  const psi = Math.acos(cosArg);
  for (const om of [phi + psi, phi - psi]) {
    const n = normalize({
      x: Math.sin(inc) * Math.cos(om),
      y: Math.sin(inc) * Math.sin(om),
      z: Math.cos(inc),
    });
    // East component of the in-plane tangent at the launch site.
    const tangent = normalize(cross(n, p));
    const east = normalize(cross({ x: 0, y: 1, z: 0 }, p));
    if (tangent.x * east.x + tangent.y * east.y + tangent.z * east.z > 0) return n;
  }
  return normalize({
    x: Math.sin(inc) * Math.cos(phi + psi),
    y: Math.sin(inc) * Math.sin(phi + psi),
    z: Math.cos(inc),
  });
}

const NORMAL = orbitalNormal();
const TANGENT = normalize(cross(NORMAL, siteVec));

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Altitude profile in km. */
export function launchAltitudeKm(tSinceLiftoffSec: number): number {
  if (tSinceLiftoffSec <= 0) return 0;
  const key: [number, number][] = [
    [0, 0],
    [15, 2.2],
    [45, 12],
    [80, 48],
    [110, 96],
    [135, 141],
    [165, 176],
    [210, 268],
    [255, 361],
    [285, 418],
  ];
  return interpolateKeyframes(key, tSinceLiftoffSec);
}

/** Velocity profile in km/s. */
export function launchVelocityKms(tSinceLiftoffSec: number): number {
  if (tSinceLiftoffSec <= 0) return 0;
  const key: [number, number][] = [
    [0, 0],
    [45, 0.42],
    [80, 1.35],
    [110, 2.35],
    [135, 3.15],
    [165, 4.35],
    [210, 5.8],
    [255, 7.05],
    [285, 7.67],
  ];
  return interpolateKeyframes(key, tSinceLiftoffSec);
}

function interpolateKeyframes(key: [number, number][], x: number): number {
  if (x <= key[0][0]) return key[0][1];
  const last = key[key.length - 1];
  if (x >= last[0]) return last[1];
  for (let i = 0; i < key.length - 1; i++) {
    const [x0, y0] = key[i];
    const [x1, y1] = key[i + 1];
    if (x >= x0 && x <= x1) {
      const t = (x - x0) / (x1 - x0);
      return y0 + (y1 - y0) * (t * t * (3 - 2 * t));
    }
  }
  return last[1];
}

export interface LaunchState {
  /** Vehicle position in render units. */
  position: Vec3;
  /** Unit vector along the vehicle's velocity. */
  heading: Vec3;
  altitudeKm: number;
  velocityKms: number;
  /** 0 → 1 across the whole flight. */
  progress: number;
  /** Throttle / engine intensity 0..1. */
  throttle: number;
  /** True while the countdown clock is running. */
  counting: boolean;
  /** Seconds until liftoff. */
  secondsToLiftoff: number;
  /** Payload deployment progress 0..1 (after insertion). */
  deployProgress: number;
  launched: boolean;
}

/** Resolve the full launch vehicle state at a simulation instant. */
export function launchStateAt(tMs: number): LaunchState {
  const t = (tMs - MISSION_EPOCH_MS) / 1000; // seconds since liftoff
  const counting = t < 0;

  if (counting) {
    const alt = 0;
    return {
      position: {
        x: siteVec.x * EARTH_RADIUS_KM * KM_TO_UNITS,
        y: siteVec.y * EARTH_RADIUS_KM * KM_TO_UNITS,
        z: siteVec.z * EARTH_RADIUS_KM * KM_TO_UNITS,
      },
      heading: { x: siteVec.x, y: siteVec.y, z: siteVec.z },
      altitudeKm: alt,
      velocityKms: 0,
      progress: 0,
      throttle: 0,
      counting: true,
      secondsToLiftoff: -t,
      deployProgress: 0,
      launched: false,
    };
  }

  const altitudeKm = launchAltitudeKm(t);
  const velocityKms = launchVelocityKms(t);

  // Downrange angle swept inside the orbital plane.
  const u = 21.5 * DEG * Math.pow(Math.min(1, t / 285), 1.42);  const dir = {
    x: siteVec.x * Math.cos(u) + TANGENT.x * Math.sin(u),
    y: siteVec.y * Math.cos(u) + TANGENT.y * Math.sin(u),
    z: siteVec.z * Math.cos(u) + TANGENT.z * Math.sin(u),
  };

  const radiusKm = EARTH_RADIUS_KM + altitudeKm;
  const position = {
    x: dir.x * radiusKm * KM_TO_UNITS,
    y: dir.y * radiusKm * KM_TO_UNITS,
    z: dir.z * radiusKm * KM_TO_UNITS,
  };

  // Heading: blend from the local vertical into the orbital tangent as the
  // vehicle pitches over.
  const pitch = smoothstep(12, 70, t);
  const radial = dir;
  const tangent = {
    x: -siteVec.x * Math.sin(u) + TANGENT.x * Math.cos(u),
    y: -siteVec.y * Math.sin(u) + TANGENT.y * Math.cos(u),
    z: -siteVec.z * Math.sin(u) + TANGENT.z * Math.cos(u),
  };
  const heading = normalize({
    x: radial.x * (1 - pitch) + tangent.x * pitch,
    y: radial.y * (1 - pitch) + tangent.y * pitch,
    z: radial.z * (1 - pitch) + tangent.z * pitch,
  });

  // Engine throttle profile: ignition spike, bucket down through max-Q.
  let throttle = 1;
  if (t < 8) throttle = smoothstep(0, 6, t);
  else if (t < 50) throttle = 1 - smoothstep(30, 50, t) * 0.32;
  else if (t < 80) throttle = 0.68 + smoothstep(50, 80, t) * 0.2;
  else if (t < 110) throttle = smoothstep(80, 88, t);
  else if (t < 112) throttle = 1 - smoothstep(110, 112, t);
  else if (t < 167) throttle = smoothstep(112, 120, t) * 0.92;
  else if (t < 169) throttle = 0.92 - smoothstep(167, 169, t) * 0.9;
  else throttle = 0;

  const deployProgress = Math.max(0, Math.min(1, (t - 285) / 120));

  return {
    position,
    heading,
    altitudeKm,
    velocityKms,
    progress: Math.min(1, t / 285),
    throttle: Math.max(0, throttle),
    counting: false,
    secondsToLiftoff: 0,
    deployProgress,
    launched: true,
  };
}

/** Sample the full ascent trajectory for the ground track ribbon. */
export function sampleAscentPath(samples = 220): Float32Array {
  const out = new Float32Array(samples * 3);
  for (let i = 0; i < samples; i++) {
    const t = (i / (samples - 1)) * 285;
    const s = launchStateAt(MISSION_EPOCH_MS + t * 1000);
    out[i * 3] = s.position.x;
    out[i * 3 + 1] = s.position.y;
    out[i * 3 + 2] = s.position.z;
  }
  return out;
}

/** Human readable countdown label. */
export function countdownLabel(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m.toString().padStart(2, "0")}:${rem.toString().padStart(2, "0")}`;
}

export const LAUNCH_INCLINATION_DEG = TARGET_INCLINATION_DEG * RAD;
