/**
 * The simulated AETHER constellation.
 *
 * Element sets are plausible (LEO / MEO, real-world inclination bands, sane
 * eccentricities) but are *invented*. They do not correspond to any catalogue
 * object and no live tracking data is used anywhere in this application.
 */

import { INSERTION_OFFSET_MS, MISSION_EPOCH_MS } from "./constants";
import { createRng } from "./rng";
import type { GroundStation, MissionType, OrbitClass, Satellite } from "./types";

interface FleetBlueprint {
  id: string;
  name: string;
  catalogId: string;
  callsign: string;
  operator: string;
  missionType: MissionType;
  orbitClass: OrbitClass;
  bus: string;
  payload: string;
  launchDate: string;
  accent: string;
  altitudeKm: number;
  inclinationDeg: number;
  eccentricity: number;
  raanDeg: number;
  argPeriapsisDeg: number;
  meanAnomalyDeg: number;
}

const BLUEPRINT: FleetBlueprint[] = [
  {
    id: "AETHER-01",
    name: "HORIZON",
    catalogId: "99001-A",
    callsign: "AETHER ONE",
    operator: "AETHER Orbital",
    missionType: "crewed",
    orbitClass: "LEO",
    bus: "Pressurized crew module + truss",
    payload: "Crew habitation, life support, microgravity research",
    launchDate: "2024-03-11",
    accent: "#4FE3FF",
    altitudeKm: 418,
    inclinationDeg: 51.64,
    eccentricity: 0.0006,
    raanDeg: 247.3,
    argPeriapsisDeg: 120.5,
    meanAnomalyDeg: 35.2,
  },
  {
    id: "AETHER-02",
    name: "MERIDIAN",
    catalogId: "99002-B",
    callsign: "MERIDIAN",
    operator: "AETHER Orbital",
    missionType: "earth-observation",
    orbitClass: "LEO",
    bus: "3U CubeSat carrier",
    payload: "Multispectral imager, 0.8 m resolution",
    launchDate: "2025-06-02",
    accent: "#3DF5A6",
    altitudeKm: 553,
    inclinationDeg: 53.0,
    eccentricity: 0.0012,
    raanDeg: 61.8,
    argPeriapsisDeg: 88.4,
    meanAnomalyDeg: 214.7,
  },
  {
    id: "AETHER-03",
    name: "CASCADE",
    catalogId: "99003-A",
    callsign: "CASCADE",
    operator: "AETHER Orbital",
    missionType: "earth-observation",
    orbitClass: "LEO",
    bus: "6U CubeSat",
    payload: "Hyperspectral scanner, cloud climatology",
    launchDate: "2025-09-18",
    accent: "#3DF5A6",
    altitudeKm: 704,
    inclinationDeg: 98.2,
    eccentricity: 0.0011,
    raanDeg: 312.6,
    argPeriapsisDeg: 42.9,
    meanAnomalyDeg: 96.1,
  },
  {
    id: "AETHER-04",
    name: "VECTOR",
    catalogId: "99004-C",
    callsign: "VECTOR",
    operator: "Helios Aerospace",
    missionType: "science",
    orbitClass: "LEO",
    bus: "Prime-series microsat",
    payload: "Magnetometer, plasma analyser",
    launchDate: "2025-11-07",
    accent: "#9C8CFF",
    altitudeKm: 622,
    inclinationDeg: 97.8,
    eccentricity: 0.0009,
    raanDeg: 128.4,
    argPeriapsisDeg: 271.3,
    meanAnomalyDeg: 331.5,
  },
  {
    id: "AETHER-05",
    name: "AXIOM",
    catalogId: "99005-A",
    callsign: "AXIOM",
    operator: "AETHER Orbital",
    missionType: "comms",
    orbitClass: "LEO",
    bus: "Flat-panel v2.0",
    payload: "Ka-band low-latency downlink",
    launchDate: "2026-01-09",
    accent: "#7FB2FF",
    altitudeKm: 823,
    inclinationDeg: 45.1,
    eccentricity: 0.0015,
    raanDeg: 12.9,
    argPeriapsisDeg: 143.2,
    meanAnomalyDeg: 58.8,
  },
  {
    id: "AETHER-06",
    name: "NOVA",
    catalogId: "99006-B",
    callsign: "NOVA",
    operator: "AETHER Orbital",
    missionType: "earth-observation",
    orbitClass: "LEO",
    bus: "3U CubeSat carrier",
    payload: "SAR radar imager, all-weather",
    launchDate: "2025-04-22",
    accent: "#3DF5A6",
    altitudeKm: 1092,
    inclinationDeg: 87.9,
    eccentricity: 0.0013,
    raanDeg: 197.5,
    argPeriapsisDeg: 15.7,
    meanAnomalyDeg: 176.4,
  },
  {
    id: "AETHER-07",
    name: "PULSAR",
    catalogId: "99007-D",
    callsign: "PULSAR",
    operator: "Deep Sky Labs",
    missionType: "science",
    orbitClass: "LEO",
    bus: "Prime-series",
    payload: "Gamma-ray burst detector, 4.5 keV",
    launchDate: "2024-11-30",
    accent: "#9C8CFF",
    altitudeKm: 1188,
    inclinationDeg: 70.4,
    eccentricity: 0.0016,
    raanDeg: 344.2,
    argPeriapsisDeg: 201.1,
    meanAnomalyDeg: 243.9,
  },
  {
    id: "AETHER-08",
    name: "KESTREL",
    catalogId: "99008-A",
    callsign: "KESTREL",
    operator: "AETHER Orbital",
    missionType: "comms",
    orbitClass: "LEO",
    bus: "Flat-panel v2.0",
    payload: "Ka-band trunk + S-band backup",
    launchDate: "2026-02-14",
    accent: "#7FB2FF",
    altitudeKm: 588,
    inclinationDeg: 98.6,
    eccentricity: 0.001,
    raanDeg: 88.1,
    argPeriapsisDeg: 310.6,
    meanAnomalyDeg: 112.2,
  },
  {
    id: "AETHER-09",
    name: "TITAN",
    catalogId: "99009-C",
    callsign: "TITAN",
    operator: "AETHER Orbital",
    missionType: "navigation",
    orbitClass: "MEO",
    bus: "4.8 m x 2.4 m bus",
    payload: "Atomic clock, L1/L5 signal generator",
    launchDate: "2023-07-05",
    accent: "#FFB020",
    altitudeKm: 12790,
    inclinationDeg: 55.0,
    eccentricity: 0.0021,
    raanDeg: 220.7,
    argPeriapsisDeg: 76.8,
    meanAnomalyDeg: 17.6,
  },
  {
    id: "AETHER-10",
    name: "ORACLE",
    catalogId: "99010-C",
    callsign: "ORACLE",
    operator: "AETHER Orbital",
    missionType: "navigation",
    orbitClass: "MEO",
    bus: "5.1 m x 2.6 m bus",
    payload: "Dual atomic clock, integrity service",
    launchDate: "2022-12-19",
    accent: "#FFB020",
    altitudeKm: 19120,
    inclinationDeg: 63.4,
    eccentricity: 0.0018,
    raanDeg: 41.3,
    argPeriapsisDeg: 258.4,
    meanAnomalyDeg: 301.7,
  },
  {
    id: "AETHER-11",
    name: "SENTINEL",
    catalogId: "99011-B",
    callsign: "SENTINEL",
    operator: "AETHER Orbital",
    missionType: "science",
    orbitClass: "MEO",
    bus: "3U CubeSat carrier",
    payload: "Radiation monitor, space weather nowcast",
    launchDate: "2025-08-08",
    accent: "#9C8CFF",
    altitudeKm: 9610,
    inclinationDeg: 47.2,
    eccentricity: 0.0024,
    raanDeg: 155.9,
    argPeriapsisDeg: 19.4,
    meanAnomalyDeg: 139.1,
  },
  {
    id: "AETHER-12",
    name: "TERRA",
    catalogId: "99012-A",
    callsign: "TERRA",
    operator: "Terra Survey",
    missionType: "earth-observation",
    orbitClass: "LEO",
    bus: "Flat-panel v1.5",
    payload: "Cloud property radiometer",
    launchDate: "2026-03-01",
    accent: "#3DF5A6",
    altitudeKm: 476,
    inclinationDeg: 35.0,
    eccentricity: 0.0021,
    raanDeg: 265.4,
    argPeriapsisDeg: 332.6,
    meanAnomalyDeg: 71.8,
  },
];

export const FLEET: Satellite[] = BLUEPRINT.map((b) => {
  const rng = createRng(`aether:${b.id}`);
  // Small deterministic jitter keeps the element sets from looking templated.
  const jitter = (amount: number) => (rng.next() - 0.5) * amount;
  return {
    id: b.id,
    name: b.name,
    catalogId: b.catalogId,
    callsign: b.callsign,
    operator: b.operator,
    missionType: b.missionType,
    orbitClass: b.orbitClass,
    status: "nominal",
    bus: b.bus,
    payload: b.payload,
    launchDate: b.launchDate,
    accent: b.accent,
    element: {
      semiMajorAxisKm: 6371.0088 + b.altitudeKm,
      eccentricity: Math.max(0.0001, b.eccentricity + jitter(0.0004)),
      inclinationDeg: b.inclinationDeg + jitter(0.35),
      raanDeg: b.raanDeg + jitter(1.4),
      argPeriapsisDeg: b.argPeriapsisDeg + jitter(1.8),
      meanAnomalyDeg: b.meanAnomalyDeg + jitter(3.2),
      epochMs: MISSION_EPOCH_MS + INSERTION_OFFSET_MS,
    },
  };
});

export const SATELLITE_BY_ID: Record<string, Satellite> = Object.fromEntries(
  FLEET.map((s) => [s.id, s])
);

export const MISSION_TYPES: { id: MissionType; label: string }[] = [
  { id: "earth-observation", label: "Earth Observation" },
  { id: "navigation", label: "Navigation" },
  { id: "comms", label: "Communications" },
  { id: "science", label: "Science" },
  { id: "crewed", label: "Crewed" },
];

export const GROUND_STATIONS: GroundStation[] = [
  { id: "GS-KOU", name: "Kourou", code: "GS-01", lat: 5.24, lon: -52.8, health: 0.98 },
  { id: "GS-SVA", name: "Svalbard", code: "GS-02", lat: 78.23, lon: 15.39, health: 0.94 },
  { id: "GS-GLD", name: "Goldstone", code: "GS-03", lat: 35.42, lon: -116.89, health: 0.91 },
  { id: "GS-MAD", name: "Madrid", code: "GS-04", lat: 40.43, lon: -4.15, health: 0.96 },
  { id: "GS-CBR", name: "Canberra", code: "GS-05", lat: -35.4, lon: 148.99, health: 0.89 },
  { id: "GS-MCM", name: "McMurdo", code: "GS-06", lat: -77.85, lon: 166.67, health: 0.87 },
];
