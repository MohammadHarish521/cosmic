"use client";

import { useEffect, useRef, useState } from "react";

import { useSatelliteSnapshot } from "@/hooks/useSatelliteSnapshot";
import { SATELLITE_BY_ID } from "@/lib/fleet";
import { MISSION_EPOCH_MS } from "@/lib/constants";
import { propagate } from "@/lib/orbits";
import { computeTelemetry } from "@/lib/telemetry";
import { useSimTime } from "@/state/mission-store";
import type { ChartSample } from "@/lib/types";

const WINDOW = 72;
const SAMPLE_INTERVAL_MS = 380;

export interface TelemetrySeries {
  altitude: ChartSample[];
  signal: ChartSample[];
  battery: ChartSample[];
  temperature: ChartSample[];
  velocity: ChartSample[];
}

const EMPTY: TelemetrySeries = {
  altitude: [],
  signal: [],
  battery: [],
  temperature: [],
  velocity: [],
};

/** Simulated step between seeded samples, so the plot is full on first paint. */
const SEED_STEP_MS = 12_000;

function seedSeries(satId: string, simTime: number): TelemetrySeries {
  const sat = SATELLITE_BY_ID[satId];
  if (!sat) return EMPTY;

  const altitude: ChartSample[] = [];
  const signal: ChartSample[] = [];
  const battery: ChartSample[] = [];
  const temperature: ChartSample[] = [];
  const velocity: ChartSample[] = [];

  for (let i = WINDOW - 1; i >= 0; i--) {
    const t = simTime - i * SEED_STEP_MS;
    const orbit = propagate(sat.element, t, { epochMs: MISSION_EPOCH_MS });
    const telemetry = computeTelemetry(sat, orbit, t);
    altitude.push({ t, value: orbit.altKm });
    signal.push({ t, value: telemetry.signalDbm });
    battery.push({ t, value: telemetry.batteryPct });
    temperature.push({ t, value: telemetry.temperatureC });
    velocity.push({ t, value: orbit.speedKms });
  }

  return { altitude, signal, battery, temperature, velocity };
}

/**
 * Rolling telemetry history for the focused spacecraft.
 *
 * Samples are captured at a fixed real-time cadence so the charts animate
 * smoothly, but every sample is stamped with the *simulated* instant it was
 * taken at — the plot therefore stays locked to the mission clock.
 */
export function useTelemetrySeries(satId: string | null): TelemetrySeries {
  const simTime = useSimTime();
  const snapshot = useSatelliteSnapshot(satId);
  const [series, setSeries] = useState<TelemetrySeries>(() =>
    satId ? seedSeries(satId, simTime) : EMPTY
  );
  const lastSample = useRef(0);
  const lastSat = useRef<string | null>(satId);

  useEffect(() => {
    if (lastSat.current !== satId) {
      lastSat.current = satId;
      lastSample.current = 0;
      setSeries(satId ? seedSeries(satId, simTime) : EMPTY);
    }
  }, [satId, simTime]);

  useEffect(() => {
    if (!snapshot) return;
    const now = performance.now();
    if (now - lastSample.current < SAMPLE_INTERVAL_MS) return;
    lastSample.current = now;

    const t = snapshot.telemetry;
    const push = (list: ChartSample[], value: number): ChartSample[] => {
      const next = [...list, { t: simTime, value }];
      return next.length > WINDOW ? next.slice(next.length - WINDOW) : next;
    };

    setSeries((prev) => ({
      altitude: push(prev.altitude, snapshot.orbit.altKm),
      signal: push(prev.signal, t.signalDbm),
      battery: push(prev.battery, t.batteryPct),
      temperature: push(prev.temperature, t.temperatureC),
      velocity: push(prev.velocity, snapshot.orbit.speedKms),
    }));
  }, [snapshot, simTime]);

  return series;
}
