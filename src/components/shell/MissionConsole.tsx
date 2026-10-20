"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Gauge,
  ListTree,
  Pause,
  Play,
  RadioTower,
  Rocket,
  X,
} from "lucide-react";

import { BottomTimeline } from "@/components/shell/BottomTimeline";
import { EventFeedDrawer } from "@/components/shell/EventFeed";
import { GlobeLoader } from "@/components/shell/GlobeLoader";
import { LaunchOverlay } from "@/components/shell/LaunchOverlay";
import { LeftRail } from "@/components/shell/LeftRail";
import { RightRail } from "@/components/shell/RightRail";
import { StageHUD } from "@/components/shell/StageHUD";
import { TopBar } from "@/components/shell/TopBar";
import { GlobeCanvas } from "@/components/globe/GlobeCanvas";
import { useIsCompact } from "@/hooks/useMediaQuery";
import { TIME_SCALES, type TimeScale } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useMissionStore, useEnterLaunchMode, useEnterOrbitMode } from "@/state/mission-store";

type Sheet = "roster" | "telemetry" | null;

export function MissionConsole() {
  const { state, dispatch } = useMissionStore();
  const compact = useIsCompact();
  const [sheet, setSheet] = useState<Sheet>(null);
  const enterLaunch = useEnterLaunchMode();
  const enterOrbit = useEnterOrbitMode();

  // Close any open sheet when the layout returns to the desktop arrangement.
  useEffect(() => {
    if (!compact) setSheet(null);
  }, [compact]);

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-void">
      {/* Ambient backdrop */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="grid-lines absolute inset-0 opacity-70" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 80% at 50% 0%, rgba(31,96,130,0.16) 0%, rgba(5,7,11,0) 62%)",
          }}
        />
      </div>

      <TopBar />

      <div className="relative z-10 flex min-h-0 flex-1 gap-2.5 p-2.5">
        {/* LEFT RAIL */}
        <div
          className={cn(
            "hidden min-h-0 w-[312px] shrink-0 xl:block",
            compact && "hidden"
          )}
        >
          <LeftRail />
        </div>

        {/* CENTER STAGE */}
        <main className="relative min-h-0 min-w-0 flex-1 overflow-hidden rounded-[14px] border border-white/[0.06] bg-[#05070B]">
          <div className="absolute inset-0">
            <GlobeCanvas />
          </div>
          <GlobeLoader />
          <StageHUD />
          <LaunchOverlay />
          <div className="pointer-events-none absolute inset-0 rounded-[14px] shadow-[inset_0_0_120px_rgba(0,0,0,0.75)]" />
        </main>

        {/* RIGHT RAIL */}
        <div className="hidden min-h-0 w-[356px] shrink-0 lg:block">
          <RightRail />
        </div>
      </div>

      {/* TIMELINE */}
      <div className="relative z-10 px-2.5 pb-2.5">
        <BottomTimeline />
      </div>

      {/* MOBILE / COMPACT DOCK */}
      {compact && (
        <div className="relative z-20 flex items-center gap-2 border-t border-white/[0.055] bg-[#070A0F]/95 px-3 py-2 backdrop-blur-xl">
          <button
            type="button"
            onClick={() => dispatch({ type: "TOGGLE_RUNNING" })}
            aria-label={state.running ? "Pause simulation" : "Resume simulation"}
            className={cn(
              "grid h-9 w-9 shrink-0 place-items-center rounded-full border transition-colors",
              state.running
                ? "border-cyan/40 bg-cyan/15 text-cyan"
                : "border-white/[0.1] text-txt"
            )}
          >
            {state.running ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
          </button>

          <div className="flex items-center gap-1 rounded-lg border border-white/[0.06] bg-black/30 p-0.5">
            {TIME_SCALES.map((s: TimeScale) => (
              <button
                key={s}
                type="button"
                onClick={() => dispatch({ type: "SET_SPEED", speed: s })}
                className={cn(
                  "rounded-[5px] px-1.5 py-[3px] font-mono text-[9px] tracking-[0.08em] transition-colors",
                  state.speed === s ? "bg-cyan/12 text-cyan" : "text-faint"
                )}
              >
                {s}×
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <DockButton
              active={sheet === "roster"}
              icon={<ListTree size={15} />}
              label="Roster"
              onClick={() => setSheet(sheet === "roster" ? null : "roster")}
            />
            <DockButton
              active={sheet === "telemetry"}
              icon={<Gauge size={15} />}
              label="Telemetry"
              onClick={() => setSheet(sheet === "telemetry" ? null : "telemetry")}
            />
            <DockButton
              active={state.eventFeedOpen}
              icon={<RadioTower size={15} />}
              label="Events"
              onClick={() =>
                dispatch({ type: "SET_EVENT_FEED", open: !state.eventFeedOpen })
              }
            />
            <DockButton
              active={state.appMode === "launch"}
              icon={<Rocket size={15} />}
              label="Launch"
              onClick={() => {
                if (state.appMode === "launch") enterOrbit();
                else enterLaunch();
              }}
            />
          </div>
        </div>
      )}

      {/* SHEETS */}
      <AnimatePresence>
        {sheet && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 flex items-end bg-black/60 backdrop-blur-sm"
            onClick={() => setSheet(null)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="glass-raised max-h-[78vh] w-full overflow-hidden rounded-t-2xl border-t border-white/[0.09]"
            >
              <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
                <span className="font-mono text-[11px] tracking-[0.16em] text-muted uppercase">
                  {sheet === "roster" ? "Spacecraft roster" : "Telemetry"}
                </span>
                <button
                  type="button"
                  onClick={() => setSheet(null)}
                  aria-label="Close panel"
                  className="grid h-7 w-7 place-items-center rounded-md border border-white/[0.08] text-muted"
                >
                  <X size={13} />
                </button>
              </div>
              <div className="max-h-[calc(78vh-49px)] overflow-y-auto p-3">
                {sheet === "roster" ? <LeftRail /> : <RightRail />}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <EventFeedDrawer />
    </div>
  );
}

function DockButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex flex-col items-center gap-0.5 rounded-lg border px-2.5 py-1.5 transition-colors",
        active
          ? "border-cyan/35 bg-cyan/10 text-cyan"
          : "border-white/[0.07] bg-white/[0.02] text-muted"
      )}
    >
      {icon}
      <span className="font-mono text-[8px] tracking-[0.1em] uppercase">{label}</span>
    </button>
  );
}
