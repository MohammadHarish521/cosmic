"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Rocket } from "lucide-react";

import { countdownLabel, launchStateAt } from "@/lib/launch";
import { formatMET } from "@/lib/format";
import { phaseAt } from "@/lib/timeline";
import { useMissionStore, useSimTime } from "@/state/mission-store";

/**
 * Cinematic launch overlay.
 *
 * Counts down the terminal sequence, then reports ascent telemetry while
 * the flight phase advances. Rendered above the globe, never blocking it.
 */
export function LaunchOverlay() {
  const { state } = useMissionStore();
  const simTime = useSimTime();

  const launch = launchStateAt(simTime);
  const phase = phaseAt(simTime);
  const active = state.appMode === "launch";

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="pointer-events-none absolute inset-0 z-10"
        >
          {/* Letterbox */}
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "7%" }}
            exit={{ height: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/85 to-transparent"
          />
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "7%" }}
            exit={{ height: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent"
          />

          {/* Countdown */}
          {launch.counting && (
            <>
              {/* Scrim keeps the countdown legible over any terrain. */}
              <div className="absolute inset-0 bg-[radial-gradient(58%_46%_at_50%_48%,rgba(4,6,10,0.86)_0%,rgba(4,6,10,0.45)_45%,rgba(4,6,10,0)_100%)]" />
              <div className="absolute inset-0 grid place-items-center">
                <div className="relative text-center">
                  <div className="label-xs mb-3 tracking-[0.42em] text-amber">
                    Terminal Count · Kourou ELA-3
                  </div>
                  <motion.div
                    key={Math.floor(launch.secondsToLiftoff)}
                    initial={{ opacity: 0, scale: 1.06 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    className="tabular font-mono text-[clamp(3rem,9vw,6.5rem)] leading-none font-light tracking-[0.04em] text-txt [text-shadow:0_0_38px_rgba(4,6,10,0.9),0_0_18px_rgba(79,227,255,0.45)]"
                  >
                    {countdownLabel(launch.secondsToLiftoff)}
                  </motion.div>
                  <div className="mt-4 flex items-center justify-center gap-2 font-mono text-[10px] tracking-[0.26em] text-muted uppercase">
                    <Rocket size={12} className="text-cyan" />
                    AETHER-7 · Liftoff in T-minus
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Ascent telemetry */}
          {!launch.counting && (
            <div className="absolute inset-x-0 bottom-[10%] flex justify-center">
              <div className="glass-raised flex items-stretch divide-x divide-white/[0.07] overflow-hidden">
                <Metric label="PHASE" value={phase.label} />
                <Metric
                  label="ALT"
                  value={launch.altitudeKm.toFixed(1)}
                  unit="km"
                />
                <Metric
                  label="VEL"
                  value={launch.velocityKms.toFixed(3)}
                  unit="km/s"
                />
                <Metric
                  label="THR"
                  value={(launch.throttle * 100).toFixed(0)}
                  unit="%"
                />
                <Metric label="MET" value={formatMET(simTime)} />
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Metric({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="px-4 py-2.5 text-center">
      <div className="label-xs">{label}</div>
      <div className="tabular mt-0.5 font-mono text-[13px] text-txt">
        {value}
        {unit ? <span className="ml-0.5 text-[9px] text-faint">{unit}</span> : null}
      </div>
    </div>
  );
}
