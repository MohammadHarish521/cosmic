import { useMemo } from "react";

import { FLEET, SATELLITE_BY_ID } from "@/lib/fleet";
import { MISSION_EPOCH_MS } from "@/lib/constants";
import { propagate } from "@/lib/orbits";
import { computeTelemetry } from "@/lib/telemetry";
import { useMissionStore, useSimTime } from "@/state/mission-store";
import type { ActiveAlert, AlertSeverity, Satellite } from "@/lib/types";

/** Telemetry degradation multiplier for a given alert severity. */
export function severityFactor(severity: AlertSeverity | undefined): number {
  switch (severity) {
    case "critical":
      return 0.95;
    case "warning":
      return 0.62;
    case "caution":
      return 0.34;
    default:
      return 0;
  }
}

export interface SatelliteSnapshot {
  sat: Satellite;
  orbit: ReturnType<typeof propagate>;
  telemetry: ReturnType<typeof computeTelemetry>;
  alert?: ActiveAlert;
}

/** Full state + telemetry for one spacecraft at the current instant. */
export function useSatelliteSnapshot(satId: string | null): SatelliteSnapshot | null {
  const simTime = useSimTime();
  const { state } = useMissionStore();

  return useMemo(() => {
    if (!satId) return null;
    const sat = SATELLITE_BY_ID[satId];
    if (!sat) return null;
    const alert = state.alerts.find((a) => a.satelliteId === satId);
    const orbit = propagate(sat.element, simTime, { epochMs: MISSION_EPOCH_MS });
    const telemetry = computeTelemetry(sat, orbit, simTime, {
      alertFactor: severityFactor(alert?.severity),
      severity: alert?.severity,
    });
    return { sat, orbit, telemetry, alert };
  }, [satId, simTime, state.alerts]);
}

/** Lightweight per-spacecraft summaries for the roster list. */
export interface RosterEntry {
  sat: Satellite;
  altKm: number;
  lat: number;
  lon: number;
  speedKms: number;
  linkState: "locked" | "acquiring" | "lost";
  status: Satellite["status"];
  alertSeverity?: AlertSeverity;
}

export function useRoster(): RosterEntry[] {
  const simTime = useSimTime();
  const { state } = useMissionStore();

  return useMemo(() => {
    return FLEET.map((sat) => {
      const alert = state.alerts.find((a) => a.satelliteId === sat.id);
      const orbit = propagate(sat.element, simTime, { epochMs: MISSION_EPOCH_MS });
      const telemetry = computeTelemetry(sat, orbit, simTime, {
        alertFactor: severityFactor(alert?.severity),
        severity: alert?.severity,
      });
      let status: Satellite["status"] = "nominal";
      if (alert) {
        status =
          alert.severity === "critical"
            ? "critical"
            : alert.severity === "warning"
              ? "warning"
              : "degraded";
      } else if (telemetry.batteryPct < 40) {
        status = "degraded";
      } else if (telemetry.temperatureC > 26) {
        status = "degraded";
      }
      return {
        sat,
        altKm: orbit.altKm,
        lat: orbit.lat,
        lon: orbit.lon,
        speedKms: orbit.speedKms,
        linkState: telemetry.linkState,
        status,
        alertSeverity: alert?.severity,
      };
    });
  }, [simTime, state.alerts]);
}
