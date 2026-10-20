/**
 * Mission event generation.
 *
 * Scheduled events are derived from the same orbital geometry as the globe,
 * so a ground-station pass appears in the feed at exactly the moment the
 * satellite enters the station's horizon cone.
 */

import { MISSION_EPOCH_MS, MISSION_END_MS, MISSION_START_MS } from "./constants";
import { FLEET, GROUND_STATIONS } from "./fleet";
import { DEG, RAD, propagate } from "./orbits";
import { angularSeparation, horizonSeparationDeg } from "./telemetry";
import { createRng, hashString } from "./rng";
import type { MissionEvent, Satellite } from "./types";

let eventCounter = 0;

function makeEvent(e: Omit<MissionEvent, "id" | "createdAt">): MissionEvent {
  eventCounter += 1;
  return {
    ...e,
    id: `evt-${hashString(`${e.title}-${e.tMs}-${eventCounter}`).toString(36)}`,
    createdAt: 0,
  };
}

/**
 * Detect ground-station passes for a satellite across the mission window.
 * Sampling at 20 s resolution is ample for the pass durations involved.
 */
export function detectPasses(sat: Satellite): { start: number; end: number; station: string }[] {
  const horizon = horizonSeparationDeg(sat.element.semiMajorAxisKm);
  const step = 20_000;
  const passes: { start: number; end: number; station: string }[] = [];

  let inPass = false;
  let passStart = 0;
  let passStation = "";

  for (let t = MISSION_START_MS; t <= MISSION_END_MS; t += step) {
    const s = propagate(sat.element, t, { epochMs: MISSION_EPOCH_MS });
    let sep = Infinity;
    let station = "";
    for (const gs of GROUND_STATIONS) {
      const d = angularSeparation(s.lat, s.lon, gs.lat, gs.lon);
      if (d < sep) {
        sep = d;
        station = gs.id;
      }
    }
    const visible = sep <= horizon;
    if (visible && !inPass) {
      inPass = true;
      passStart = t;
      passStation = station;
    } else if (!visible && inPass) {
      inPass = false;
      passes.push({ start: passStart, end: t, station: passStation });
    }
  }
  if (inPass) passes.push({ start: passStart, end: MISSION_END_MS, station: passStation });
  return passes;
}

const SYSTEM_EVENTS: { at: number; title: string; detail: string; severity: MissionEvent["severity"] }[] = [
  {
    at: -600_000,
    title: "Terminal count initiated",
    detail: "Flight computer terminal count sequence started at Kourou — GS-01.",
    severity: "info",
  },
  {
    at: -420_000,
    title: "Propellant load complete",
    detail: "All tanks pressurised and stable. Strongback retracted.",
    severity: "info",
  },
  {
    at: -12_000,
    title: "Ignition sequence start",
    detail: "TEA-TEB ignition, engine health checks green.",
    severity: "info",
  },
  {
    at: 0,
    title: "Liftoff",
    detail: "Vehicle has cleared the tower. Throttle bucket. Tower cleared.",
    severity: "info",
  },
  {
    at: 45_000,
    title: "Maximum dynamic pressure",
    detail: "Max-Q reached — vehicle throttled down, structural load peak.",
    severity: "caution",
  },
  {
    at: 80_000,
    title: "Main engine cutoff",
    detail: "First stage MECO. Vehicle coasting on the pitch programme.",
    severity: "info",
  },
  {
    at: 110_000,
    title: "Stage separation confirmed",
    detail: "First stage separated, second stage ignition nominal.",
    severity: "info",
  },
  {
    at: 135_000,
    title: "Fairing separation",
    detail: "Payload fairing jettisoned, stack in vacuum.",
    severity: "info",
  },
  {
    at: 165_000,
    title: "Second engine cutoff",
    detail: "SECO confirmed. Beginning orbital coast, 42° inclination targeted.",
    severity: "info",
  },
  {
    at: 285_000,
    title: "Orbit insertion confirmed",
    detail: "Injection accuracy +0.4 km radial, −0.9 km along-track. Orbit verified.",
    severity: "info",
  },
  {
    at: 315_000,
    title: "Separation confirmed",
    detail: "Payload separation from the launch vehicle — 12 spacecraft deployed.",
    severity: "info",
  },
  {
    at: 420_000,
    title: "Solar array deployed",
    detail: "All arrays deployed and sun-tracking nominal.",
    severity: "info",
  },
  {
    at: 600_000,
    title: "First ground contact",
    detail: "First acquisition of GS-01 Kourou. Telemetry and telecommand confirmed.",
    severity: "info",
  },
];

/** Build the deterministic schedule of mission events for the whole window. */
export function buildMissionEvents(): MissionEvent[] {
  const events: MissionEvent[] = [];
  eventCounter = 0;

  for (const s of SYSTEM_EVENTS) {
    events.push(
      makeEvent({
        tMs: MISSION_EPOCH_MS + s.at,
        category: s.at < 0 ? "system" : "launch",
        title: s.title,
        detail: s.detail,
        severity: s.severity,
        source: "FLIGHT",
      })
    );
  }

  for (const sat of FLEET) {
    const rng = createRng(`events:${sat.id}`);
    const passes = detectPasses(sat);
    for (const pass of passes) {
      const gs = GROUND_STATIONS.find((g) => g.id === pass.station);
      if (!gs) continue;
      events.push(
        makeEvent({
          tMs: pass.start,
          category: "link",
          title: `AOS ${gs.code} ${gs.name}`,
          detail: `${sat.callsign} acquired ${gs.name}. Elevation ${(rng.range(6, 42)).toFixed(1)}° rising.`,
          satelliteId: sat.id,
          severity: "info",
          source: gs.code,
        })
      );
      events.push(
        makeEvent({
          tMs: pass.end,
          category: "link",
          title: `LOS ${gs.code} ${gs.name}`,
          detail: `${sat.callsign} signal degraded below lock threshold at ${gs.name}.`,
          satelliteId: sat.id,
          severity: "info",
          source: gs.code,
        })
      );
    }

    // A few routine subsystem events per spacecraft.
    const eventCount = 5;
    for (let i = 0; i < eventCount; i++) {
      const t = MISSION_START_MS + rng.range(0.12, 0.98) * (MISSION_END_MS - MISSION_START_MS);
      const kind = rng.int(0, 4);
      const templates = [
        {
          title: "Payload data dump complete",
          detail: `${sat.callsign} downlinked a science block to the mission cloud.`,
          severity: "info" as const,
        },
        {
          title: "Attitude hold confirmed",
          detail: `${sat.callsign} three-axis hold verified after momentum dump.`,
          severity: "info" as const,
        },
        {
          title: "Thermal cycle nominal",
          detail: `${sat.callsign} radiator temperature stable inside qualification band.`,
          severity: "info" as const,
        },
        {
          title: "Watch item logged",
          detail: `${sat.callsign} battery depth-of-discharge above prediction — logged for review.`,
          severity: "caution" as const,
        },
        {
          title: "Ephemeris update received",
          detail: `${sat.callsign} orbit solution refreshed from the mission centre.`,
          severity: "info" as const,
        },
      ];
      const tpl = templates[kind];
      events.push(
        makeEvent({
          tMs: Math.round(t),
          category: "system",
          title: tpl.title,
          detail: tpl.detail,
          satelliteId: sat.id,
          severity: tpl.severity,
          source: sat.id,
        })
      );
    }
  }

  events.sort((a, b) => a.tMs - b.tMs);
  return events;
}
