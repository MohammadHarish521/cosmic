"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { SegmentedControl } from "@/components/ui/Controls";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  MISSION_END_MS,
  MISSION_EPOCH_MS,
  MISSION_START_MS,
  TIME_SCALES,
  type TimeScale,
} from "@/lib/constants";
import { formatMET } from "@/lib/format";
import {
  LAUNCH_PHASE_IDS,
  MISSION_PHASES,
  fractionToTime,
  phaseAt,
  timeToFraction,
} from "@/lib/timeline";
import { clamp, cn } from "@/lib/utils";
import { useMissionStore, useSeek, useSimTime } from "@/state/mission-store";

const WINDOW = MISSION_END_MS - MISSION_START_MS;

export function BottomTimeline() {
  const { state, dispatch } = useMissionStore();
  const simTime = useSimTime();
  const seek = useSeek();
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const compact = useMediaQuery("(max-width: 639px)");

  const progress = timeToFraction(simTime);
  const phase = phaseAt(simTime);

  const seekFromEvent = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const fraction = clamp((clientX - rect.left) / rect.width, 0, 1);
      seek(fractionToTime(fraction));
    },
    [seek]
  );

  const onPointerDown = (e: React.PointerEvent) => {
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    seekFromEvent(e.clientX);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    seekFromEvent(e.clientX);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    setDragging(false);
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  const jumpPhase = useCallback(
    (direction: -1 | 1) => {
      const current = phaseAt(simTime);
      const index = MISSION_PHASES.findIndex((p) => p.id === current.id);
      const nextIndex = clamp(index + direction, 0, MISSION_PHASES.length - 1);
      const next = MISSION_PHASES[nextIndex];
      seek(MISSION_EPOCH_MS + next.startOffsetMs + 1000);
    },
    [seek, simTime]
  );

  const markers = useMemo(() => {
    const minGap = compact ? 0.1 : 0.035;
    let lastLabel = -1;
    return MISSION_PHASES.map((p) => {
      const start = timeToFraction(MISSION_EPOCH_MS + p.startOffsetMs);
      // Suppress labels that would collide with the previous one.
      const showLabel = start - lastLabel > minGap;
      if (showLabel) lastLabel = start;
      return {
        id: p.id,
        label: p.shortLabel,
        title: p.label,
        launch: LAUNCH_PHASE_IDS.includes(p.id),
        start,
        end: timeToFraction(MISSION_EPOCH_MS + p.endOffsetMs),
        showLabel,
      };
    });
  }, [compact]);

  return (
    <GlassPanel className="shrink-0" >
      <div className="flex flex-col gap-2 p-2.5 lg:flex-row lg:items-center lg:gap-4">
        {/* Transport */}
        <div className={cn("items-center gap-2", compact ? "hidden" : "flex")}>
          <button
            type="button"
            onClick={() => jumpPhase(-1)}
            aria-label="Previous phase"
            className="grid h-8 w-8 place-items-center rounded-lg border border-white/[0.07] bg-white/[0.02] text-muted transition-colors hover:text-txt"
          >
            <SkipBack size={13} />
          </button>

          <button
            type="button"
            onClick={() => dispatch({ type: "TOGGLE_RUNNING" })}
            aria-label={state.running ? "Pause simulation" : "Resume simulation"}
            className={cn(
              "grid h-9 w-9 place-items-center rounded-full border transition-all",
              state.running
                ? "border-cyan/40 bg-cyan/15 text-cyan shadow-[0_0_18px_-4px_rgba(79,227,255,0.6)]"
                : "border-white/[0.1] bg-white/[0.04] text-txt hover:border-cyan/30 hover:text-cyan"
            )}
          >
            {state.running ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
          </button>

          <button
            type="button"
            onClick={() => jumpPhase(1)}
            aria-label="Next phase"
            className="grid h-8 w-8 place-items-center rounded-lg border border-white/[0.07] bg-white/[0.02] text-muted transition-colors hover:text-txt"
          >
            <SkipForward size={13} />
          </button>

          <SegmentedControl
            ariaLabel="Simulation speed"
            size="sm"
            value={String(state.speed)}
            onChange={(value) =>
              dispatch({ type: "SET_SPEED", speed: Number(value) as TimeScale })
            }
            options={TIME_SCALES.map((s) => ({
              value: String(s),
              label: `${s}×`,
              title: `${s} times real time`,
            }))}
          />
        </div>

        {/* Track */}
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="font-mono text-[9.5px] tracking-[0.12em] text-faint uppercase">
              Mission Timeline
            </span>
            <span className="tabular font-mono text-[11px] tracking-[0.06em] text-cyan">
              {formatMET(simTime)}
            </span>
          </div>

          <div
            ref={trackRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            role="slider"
            tabIndex={0}
            aria-label="Mission timeline"
            aria-valuemin={MISSION_START_MS}
            aria-valuemax={MISSION_END_MS}
            aria-valuenow={simTime}
            aria-valuetext={formatMET(simTime)}
            onKeyDown={(e) => {
              const step = e.shiftKey ? 60_000 : 10_000;
              if (e.key === "ArrowLeft") {
                e.preventDefault();
                seek(simTime - step);
              }
              if (e.key === "ArrowRight") {
                e.preventDefault();
                seek(simTime + step);
              }
            }}
            className="group relative h-7 cursor-pointer touch-none select-none"
          >
            {/* Rail */}
            <div className="absolute top-1/2 right-0 left-0 h-[3px] -translate-y-1/2 overflow-hidden rounded-full bg-white/[0.07]">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-cyan/35 via-cyan/70 to-cyan"
                style={{ width: `${progress * 100}%` }}
                transition={{ duration: dragging ? 0 : 0.06, ease: "linear" }}
              />
            </div>

            {/* Phase segments */}
            {markers.map((marker) => (
              <div
                key={marker.id}
                title={`${marker.title} — ${marker.label}`}
                className="absolute top-1/2 h-3 w-[2px] -translate-y-1/2 rounded-full"
                style={{
                  left: `${marker.start * 100}%`,
                  backgroundColor: marker.launch
                    ? "rgba(255,176,32,0.65)"
                    : "rgba(126,184,214,0.3)",
                }}
              />
            ))}

            {/* Playhead */}
            <div
              className="pointer-events-none absolute top-0 bottom-0 w-[2px] -translate-x-1/2"
              style={{ left: `${progress * 100}%` }}
            >
              <div className="absolute top-0 bottom-0 w-[2px] bg-cyan shadow-[0_0_12px_rgba(79,227,255,0.85)]" />
              <div className="absolute -top-px left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-cyan" />
              <div className="absolute -bottom-px left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-cyan" />
            </div>
          </div>

          {/* Phase labels */}
          <div className="relative mt-0.5 h-3.5">
            {markers.map((marker) =>
              marker.showLabel ? (
                <span
                  key={marker.id}
                  className={cn(
                    "absolute top-0 font-mono text-[8px] tracking-[0.1em] whitespace-nowrap",
                    marker.launch ? "text-amber/70" : "text-faint/80"
                  )}
                  style={{
                    left: `${marker.start * 100}%`,
                    transform: "translateX(-1%)",
                  }}
                >
                  {marker.label}
                </span>
              ) : null
            )}
          </div>
        </div>

        {/* Phase readout */}
        <div className="hidden min-w-[210px] shrink-0 lg:block">
          <div className="label-xs">Current phase</div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan shadow-[0_0_8px_#4FE3FF]" />
            <span className="text-[12px] font-medium text-txt">{phase.label}</span>
          </div>
          <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-faint">
            {phase.description}
          </p>
        </div>
      </div>
    </GlassPanel>
  );
}
