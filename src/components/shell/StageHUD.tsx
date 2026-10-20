"use client";

import { useMemo } from "react";

import { formatLatLon, formatMET } from "@/lib/format";
import { FLEET } from "@/lib/fleet";
import { gmstDeg, propagate, sunDirectionEci } from "@/lib/orbits";
import { MISSION_EPOCH_MS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useMissionStore, useSimTime } from "@/state/mission-store";

/**
 * Minimal heads-up framing around the globe: a few instrument readouts
 * anchored to the corners of the stage.
 */
export function StageHUD() {
  const { state } = useMissionStore();
  const simTime = useSimTime();

  const readout = useMemo(() => {
    if (!state.selectedId) return null;
    const sat = state.selectedId;
    const snap = satelliteById(sat);
    if (!snap) return null;
    const orbit = propagate(snap.element, simTime, { epochMs: MISSION_EPOCH_MS });
    const sun = sunDirectionEci(simTime);
    const gmst = gmstDeg(simTime);
    return { orbit, sat: snap, sun, gmst };
  }, [state.selectedId, simTime]);

  const modeLabel =
    state.cameraMode === "overview"
      ? "GLOBAL VIEW"
      : state.cameraMode === "tracking"
        ? "SATELLITE TRACK"
        : "LAUNCH ASCENT";

  return (
    <div className="pointer-events-none absolute inset-0 z-10 select-none">
      {/* Top left */}
      <div className="absolute top-3 left-3 flex items-center gap-2">
        <span className="flex items-center gap-1.5 rounded-md border border-white/[0.07] bg-black/40 px-2 py-1 backdrop-blur-sm">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan shadow-[0_0_8px_#4FE3FF]" />
          <span className="font-mono text-[9.5px] tracking-[0.16em] text-muted uppercase">
            {modeLabel}
          </span>
        </span>
        {state.selectedId && (
          <span className="hidden rounded-md border border-white/[0.06] bg-black/40 px-2 py-1 font-mono text-[9.5px] tracking-[0.12em] text-faint uppercase backdrop-blur-sm sm:inline">
            TGT {state.selectedId}
          </span>
        )}
      </div>

      {/* Top right */}
      <div className="absolute top-3 right-3 hidden text-right sm:block">
        <div className="font-mono text-[9.5px] tracking-[0.14em] text-faint uppercase">
          GMST {readout ? readout.gmst.toFixed(2) : "--"}°
        </div>
        <div className="mt-0.5 font-mono text-[9.5px] tracking-[0.14em] text-faint uppercase">
          SUN {readout ? (readout.sun.x > 0 ? "EAST" : "WEST") : "--"}
        </div>
      </div>

      {/* Bottom left */}
      {readout && (
        <div className="absolute bottom-3 left-3">
          <div className="font-mono text-[9.5px] tracking-[0.14em] text-faint uppercase">
            SUB-POINT
          </div>
          <div className="tabular mt-0.5 font-mono text-[11px] text-cyan/90">
            {formatLatLon(readout.orbit.lat, readout.orbit.lon)}
          </div>
          <div className="tabular mt-0.5 font-mono text-[10px] text-muted">
            ALT {readout.orbit.altKm.toFixed(1)} km · {readout.orbit.speedKms.toFixed(3)} km/s
          </div>
        </div>
      )}

      {/* Bottom right */}
      <div className="absolute right-3 bottom-3 text-right">
        <div className="font-mono text-[9.5px] tracking-[0.14em] text-faint uppercase">
          {formatMET(simTime)}
        </div>
        <div
          className={cn(
            "mt-0.5 font-mono text-[9px] tracking-[0.14em] uppercase",
            state.running ? "text-green/70" : "text-amber/70"
          )}
        >
          {state.running ? `SIM RUNNING ${state.speed}×` : "SIM PAUSED"}
        </div>
      </div>
    </div>
  );
}

function satelliteById(id: string) {
  return FLEET.find((s) => s.id === id);
}
