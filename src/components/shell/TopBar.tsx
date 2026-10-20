"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Eye, Orbit, Rocket, Satellite as SatelliteIcon } from "lucide-react";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { SegmentedControl } from "@/components/ui/Controls";
import { formatDate, formatMET, formatUtc } from "@/lib/format";
import { phaseAt } from "@/lib/timeline";
import { cn } from "@/lib/utils";
import { useMissionStore, useEnterLaunchMode, useEnterOrbitMode, useSimTime } from "@/state/mission-store";

export function TopBar() {
  const { state, dispatch } = useMissionStore();
  const simTime = useSimTime();
  const enterLaunch = useEnterLaunchMode();
  const enterOrbit = useEnterOrbitMode();
  const [layersOpen, setLayersOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!layersOpen) return;
    const onDown = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setLayersOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [layersOpen]);

  const layerToggles = [
    { key: "showOrbits" as const, label: "Orbital paths" },
    { key: "showTrails" as const, label: "Motion trails" },
    { key: "showSatellites" as const, label: "Spacecraft" },
    { key: "showLabels" as const, label: "Labels" },
    { key: "showAtmosphere" as const, label: "Atmosphere" },
    { key: "showGrid" as const, label: "Graticule" },
    { key: "showStars" as const, label: "Starfield" },
  ];

  const activeAlerts = state.alerts.length;
  const phase = phaseAt(simTime);

  return (
    <header className="relative z-30 flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.055] bg-[#070A0F]/80 px-3 backdrop-blur-xl sm:px-4">
      {/* Brand */}
      <div className="flex items-center gap-2.5">
        <BrandMark />
        <div className="leading-none">
          <div className="text-[15px] font-semibold tracking-[0.34em] text-txt">
            AETHER
          </div>
          <div className="label-xs mt-[3px] hidden sm:block">
            Orbital Operations Network
          </div>
        </div>
      </div>

      <div className="mx-1 hidden h-6 w-px bg-white/[0.08] sm:block" />

      <div className="hidden items-center gap-2 sm:flex">
        <span className="rounded border border-amber/25 bg-amber/[0.07] px-1.5 py-[3px] font-mono text-[9px] tracking-[0.16em] text-amber">
          SIMULATED
        </span>
        <span className="font-mono text-[10px] tracking-[0.08em] text-faint">
          AETHER-7 · KOUROU
        </span>
      </div>

      {/* Clock */}
      <div className="ml-auto flex items-center gap-3 lg:ml-6">
        <div className="hidden items-baseline gap-2.5 md:flex">
          <span className="label-xs">MET</span>
          <span className="tabular font-mono text-[13px] tracking-[0.06em] text-cyan glow-cyan">
            {formatMET(simTime)}
          </span>
          <span className="label-xs">UTC</span>
          <span className="tabular font-mono text-[11px] text-muted">
            {formatUtc(simTime)}
          </span>
          <span className="label-xs hidden 2xl:inline">{formatDate(simTime)}</span>
        </div>

        <div className="hidden items-center gap-1.5 rounded-md border border-white/[0.07] bg-white/[0.02] px-2 py-1 lg:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan/70" />
          <span className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
            {phase.shortLabel}
          </span>
        </div>

        {/* Mode switch */}
        <SegmentedControl
          ariaLabel="Console mode"
          value={state.appMode}
          onChange={(mode) => {
            if (mode === "launch") enterLaunch();
            else enterOrbit();
          }}
          options={[
            { value: "orbit", label: "Orbit", title: "Constellation operations" },
            { value: "launch", label: "Launch", title: "Cinematic launch sequence" },
          ]}
        />

        {/* Layer toggles */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setLayersOpen((v) => !v)}
            aria-expanded={layersOpen}
            aria-label="Scene layers"
            className={cn(
              "grid h-8 w-8 place-items-center rounded-lg border transition-colors",
              layersOpen
                ? "border-cyan/30 bg-cyan/10 text-cyan"
                : "border-white/[0.07] bg-white/[0.02] text-muted hover:text-txt"
            )}
          >
            <Eye size={14} />
          </button>

          <AnimatePresence>
            {layersOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                className="glass-raised absolute right-0 top-10 w-52 p-2.5"
              >
                <div className="label-xs mb-2 px-1">Scene Layers</div>
                <div className="space-y-0.5">
                  {layerToggles.map((layer) => {
                    const active = state[layer.key];
                    return (
                      <button
                        key={layer.key}
                        type="button"
                        onClick={() =>
                          dispatch({ type: "TOGGLE_LAYER", layer: layer.key })
                        }
                        className="flex w-full items-center justify-between rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-white/5"
                      >
                        <span className="text-[11.5px] text-muted">
                          {layer.label}
                        </span>
                        <span
                          className={cn(
                            "relative h-3.5 w-6 rounded-full transition-colors",
                            active ? "bg-cyan/70" : "bg-white/12"
                          )}
                        >
                          <span
                            className={cn(
                              "absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white transition-all",
                              active ? "left-3" : "left-0.5"
                            )}
                          />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Alert indicator */}
        <div
          className={cn(
            "flex h-8 items-center gap-1.5 rounded-lg border px-2.5 transition-colors",
            activeAlerts > 0
              ? "border-amber/40 bg-amber/10 text-amber"
              : "border-white/[0.07] bg-white/[0.02] text-muted"
          )}
          title={activeAlerts > 0 ? "Active alert" : "No active alerts"}
        >
          {activeAlerts > 0 ? (
            <AlertTriangle size={13} className="animate-pulse" />
          ) : (
            <SatelliteIcon size={13} />
          )}
          <span className="tabular font-mono text-[10px] tracking-[0.1em]">
            {activeAlerts > 0 ? activeAlerts : "NOMINAL"}
          </span>
        </div>
      </div>
    </header>
  );
}

function BrandMark() {
  return (
    <div className="relative grid h-8 w-8 place-items-center">
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
        <defs>
          <linearGradient id="aether-mark" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7FF0FF" />
            <stop offset="100%" stopColor="#1E7F9B" />
          </linearGradient>
        </defs>
        <circle
          cx="16"
          cy="16"
          r="5.5"
          fill="none"
          stroke="url(#aether-mark)"
          strokeWidth="1.3"
        />
        <ellipse
          cx="16"
          cy="16"
          rx="13"
          ry="5"
          fill="none"
          stroke="url(#aether-mark)"
          strokeWidth="1.1"
          transform="rotate(-24 16 16)"
          opacity="0.85"
        />
        <ellipse
          cx="16"
          cy="16"
          rx="13"
          ry="5"
          fill="none"
          stroke="url(#aether-mark)"
          strokeWidth="0.8"
          transform="rotate(38 16 16)"
          opacity="0.45"
        />
        <circle cx="26.4" cy="11.4" r="1.7" fill="#4FE3FF" />
      </svg>
    </div>
  );
}
