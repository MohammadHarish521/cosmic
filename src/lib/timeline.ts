/**
 * Mission timeline definition.
 *
 * The timeline is the single authority on simulated time: the clock, the
 * globe, the telemetry readouts, the charts and the event feed all read from
 * the same instant, so scrubbing the timeline moves the entire console.
 */

import {
  INSERTION_OFFSET_MS,
  MISSION_END_MS,
  MISSION_EPOCH_MS,
  MISSION_START_MS,
} from "./constants";
import type { TimelinePhase, TimelinePhaseId } from "./types";

const S = 1000;
const M = 60 * S;
const H = 60 * M;

export const MISSION_PHASES: TimelinePhase[] = [
  {
    id: "countdown",
    label: "Terminal Count",
    shortLabel: "COUNT",
    startOffsetMs: -10 * M,
    endOffsetMs: 0,
    description: "Automated terminal count sequence. Propellant load complete, flight computers armed.",
  },
  {
    id: "liftoff",
    label: "Liftoff",
    shortLabel: "LIFT",
    startOffsetMs: 0,
    endOffsetMs: 45 * S,
    description: "Main engine ignition, vehicle clears the tower. Throttle bucket engaged.",
  },
  {
    id: "maxq",
    label: "Max-Q",
    shortLabel: "MAXQ",
    startOffsetMs: 45 * S,
    endOffsetMs: 80 * S,
    description: "Maximum dynamic pressure. Structural loads peak, throttled to reduce them.",
  },
  {
    id: "meco",
    label: "Main Engine Cutoff",
    shortLabel: "MECO",
    startOffsetMs: 80 * S,
    endOffsetMs: 110 * S,
    description: "First stage main engine cutoff. Stage separation commanded.",
  },
  {
    id: "stagesep",
    label: "Stage Separation",
    shortLabel: "SEP",
    startOffsetMs: 110 * S,
    endOffsetMs: 135 * S,
    description: "First stage discarded, second stage ignition and 90° pitch programme.",
  },
  {
    id: "fairing",
    label: "Fairing Separation",
    shortLabel: "FRNG",
    startOffsetMs: 135 * S,
    endOffsetMs: 165 * S,
    description: "Payload fairing jettisoned. Combined stack exposed to the vacuum.",
  },
  {
    id: "insertion",
    label: "Orbit Insertion",
    shortLabel: "ORB",
    startOffsetMs: 165 * S,
    endOffsetMs: INSERTION_OFFSET_MS,
    description: "Second engine cutoff, orbital coast, attitude acquisition and orbit verification.",
  },
  {
    id: "deploy",
    label: "Separation & Deploy",
    shortLabel: "DEPL",
    startOffsetMs: INSERTION_OFFSET_MS,
    endOffsetMs: INSERTION_OFFSET_MS + 5 * M,
    description: "Payload separation confirmed, solar array and antenna deployment sequence.",
  },
  {
    id: "checkout",
    label: "Commissioning",
    shortLabel: "COMM",
    startOffsetMs: INSERTION_OFFSET_MS + 5 * M,
    endOffsetMs: INSERTION_OFFSET_MS + 30 * M,
    description: "First-light payload calibration, first ground contact, orbit trim burn.",
  },
  {
    id: "nominal",
    label: "Nominal Operations",
    shortLabel: "OPS",
    startOffsetMs: INSERTION_OFFSET_MS + 30 * M,
    endOffsetMs: 4 * H,
    description: "Constellation in steady-state. Routine passes, dumps and maintenance.",
  },
];
export const LAUNCH_PHASE_IDS: TimelinePhaseId[] = [
  "countdown",
  "liftoff",
  "maxq",
  "meco",
  "stagesep",
  "fairing",
  "insertion",
];

export function phaseAt(tMs: number): TimelinePhase {
  const offset = tMs - MISSION_EPOCH_MS;
  for (const phase of MISSION_PHASES) {
    if (offset >= phase.startOffsetMs && offset < phase.endOffsetMs) return phase;
  }
  if (offset < MISSION_PHASES[0].startOffsetMs) return MISSION_PHASES[0];
  return MISSION_PHASES[MISSION_PHASES.length - 1];
}

export function isLaunchSegment(tMs: number): boolean {
  return tMs < MISSION_EPOCH_MS + INSERTION_OFFSET_MS;
}

/**
 * The launch segment occupies a small fraction of real mission time but is
 * the most information-dense part of the timeline, so the scrubber uses a
 * piecewise-linear scale that gives the ascent a third of the track.
 */
export const LAUNCH_SEGMENT_END_MS = MISSION_EPOCH_MS + INSERTION_OFFSET_MS;

const TIMELINE_BREAKPOINTS: { t: number; f: number }[] = [
  { t: MISSION_START_MS, f: 0 },
  { t: MISSION_EPOCH_MS, f: 0.14 },
  { t: LAUNCH_SEGMENT_END_MS, f: 0.42 },
  { t: LAUNCH_SEGMENT_END_MS + 5 * M, f: 0.52 },
  { t: LAUNCH_SEGMENT_END_MS + 30 * M, f: 0.7 },
  { t: MISSION_END_MS, f: 1 },
];

/** Map a mission instant to a 0..1 position on the timeline track. */
export function timeToFraction(tMs: number): number {
  const clamped = Math.min(MISSION_END_MS, Math.max(MISSION_START_MS, tMs));
  for (let i = 0; i < TIMELINE_BREAKPOINTS.length - 1; i++) {
    const a = TIMELINE_BREAKPOINTS[i];
    const b = TIMELINE_BREAKPOINTS[i + 1];
    if (clamped <= b.t) {
      const span = b.t - a.t;
      const local = span === 0 ? 0 : (clamped - a.t) / span;
      return a.f + local * (b.f - a.f);
    }
  }
  return 1;
}

/** Map a 0..1 timeline position back to a mission instant. */
export function fractionToTime(fraction: number): number {
  const clamped = Math.min(1, Math.max(0, fraction));
  for (let i = 0; i < TIMELINE_BREAKPOINTS.length - 1; i++) {
    const a = TIMELINE_BREAKPOINTS[i];
    const b = TIMELINE_BREAKPOINTS[i + 1];
    if (clamped <= b.f) {
      const span = b.f - a.f;
      const local = span === 0 ? 0 : (clamped - a.f) / span;
      return a.t + local * (b.t - a.t);
    }
  }
  return MISSION_END_MS;
}
