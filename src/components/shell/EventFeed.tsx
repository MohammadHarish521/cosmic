"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, RadioTower, ShieldAlert, Zap } from "lucide-react";

import { GlassPanel, PanelHeader } from "@/components/ui/GlassPanel";
import { formatMET } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMissionStore, useSimTime } from "@/state/mission-store";
import type { AlertSeverity, MissionEvent } from "@/lib/types";

const SEVERITY_TONE: Record<AlertSeverity, string> = {
  info: "bg-cyan/60",
  caution: "bg-amber/70",
  warning: "bg-amber",
  critical: "bg-red",
};

const SEVERITY_TEXT: Record<AlertSeverity, string> = {
  info: "text-muted",
  caution: "text-amber/90",
  warning: "text-amber",
  critical: "text-red",
};

export function EventFeed() {
  const { events, state, dispatch } = useMissionStore();
  const simTime = useSimTime();

  const visible = useMemo(
    () =>
      events
        .filter((e) => e.createdAt > 0 || e.tMs <= simTime + 1000)
        .slice(0, 40),
    [events, simTime]
  );

  const [busy, setBusy] = useState(false);

  const injectFault = () => {
    const satId = state.selectedId ?? "AETHER-01";
    const id = `alert-${satId}-${Math.floor(simTime)}`;
    const alert = {
      id,
      satelliteId: satId,
      title: "Uplink margin lost — link degradation",
      detail:
        "Downlink lock dropped below threshold on the active ground station. Flight rule F-207 has commanded a high-gain configuration; the transponder is reacquiring.",
      severity: "critical" as const,
      startedAtSimMs: simTime,
      durationSimMs: 60_000,
      acknowledged: false,
    };
    dispatch({ type: "TRIGGER_ALERT", alert });
    dispatch({
      type: "ADD_EVENT",
      event: {
        id: `${id}-evt`,
        tMs: simTime,
        createdAt: Date.now(),
        category: "alert",
        title: "FAULT INJECTED · Communications degradation",
        detail: alert.detail,
        satelliteId: satId,
        severity: "critical",
        source: "OPS",
      },
    });
    setBusy(true);
    window.setTimeout(() => setBusy(false), 1200);
  };

  return (
    <GlassPanel className="flex min-h-[220px] flex-1 flex-col">
      <PanelHeader
        title="Mission Event Feed"
        meta={`${visible.length}`}
        action={
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={injectFault}
              className={cn(
                "flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[9px] tracking-[0.12em] uppercase transition-colors",
                busy
                  ? "border-amber/40 bg-amber/15 text-amber"
                  : "border-amber/25 bg-amber/[0.06] text-amber/85 hover:bg-amber/12"
              )}
              title="Inject a simulated communications fault on the focused spacecraft"
            >
              <Zap size={10} />
              Inject fault
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: "SET_EVENT_FEED", open: true })}
              aria-label="Expand event feed"
              className="grid h-6 w-6 place-items-center rounded-md border border-white/[0.07] text-muted transition-colors hover:text-txt"
            >
              <ArrowUpRight size={12} />
            </button>
          </div>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        {visible.length === 0 && (
          <div className="px-3.5 py-5 text-[11px] text-faint">
            No events recorded yet — scrub the timeline forward to advance the
            mission log.
          </div>
        )}
        {visible.map((event) => (
          <EventRow key={event.id + event.createdAt} event={event} />
        ))}
      </div>
    </GlassPanel>
  );
}

export function EventRow({
  event,
  onSelect,
}: {
  event: MissionEvent;
  onSelect?: (e: MissionEvent) => void;
}) {
  const isAlert = event.severity === "critical" || event.severity === "warning";

  return (
    <button
      type="button"
      onClick={() => onSelect?.(event)}
      className="group flex w-full items-start gap-2.5 border-b border-white/[0.03] px-3 py-2 text-left transition-colors hover:bg-white/[0.03]"
    >
      <span className="relative mt-[5px] flex h-1.5 w-1.5 shrink-0">
        <span className={cn("h-1.5 w-1.5 rounded-full", SEVERITY_TONE[event.severity])} />
        {isAlert && (
          <span
            className={cn(
              "absolute inset-0 animate-ping rounded-full opacity-60",
              SEVERITY_TONE[event.severity]
            )}
          />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span
            className={cn(
              "truncate text-[11.5px] font-medium",
              SEVERITY_TEXT[event.severity]
            )}
          >
            {event.title}
          </span>
          <span className="tabular shrink-0 font-mono text-[9px] text-faint">
            {formatMET(event.tMs)}
          </span>
        </span>
        <span className="mt-0.5 line-clamp-1 block text-[10.5px] leading-relaxed text-faint">
          {event.detail}
        </span>
      </span>
      <span className="mt-[3px] shrink-0 font-mono text-[8.5px] tracking-[0.08em] text-faint/70">
        {event.source}
      </span>
    </button>
  );
}

export function EventFeedDrawer() {
  const { events, state, dispatch } = useMissionStore();
  const simTime = useSimTime();
  const [filter, setFilter] = useState<"all" | "alert" | "link" | "launch" | "system">("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events
      .filter((e) => (filter === "all" ? true : e.category === filter))
      .filter((e) =>
        q ? `${e.title} ${e.detail} ${e.source}`.toLowerCase().includes(q) : true
      );
  }, [events, filter, query]);

  const selected = filtered.find((e) => e.id === selectedId) ?? null;

  return (
    <AnimatePresence>
      {state.eventFeedOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex justify-end bg-black/65 backdrop-blur-sm"
          onClick={() => dispatch({ type: "SET_EVENT_FEED", open: false })}
        >
          <motion.div
            initial={{ x: 40, opacity: 0.6 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0.6 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="glass-raised flex h-full w-full max-w-[min(920px,100%)] flex-col border-l border-white/[0.08] rounded-none sm:rounded-l-2xl"
          >
            <header className="flex items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <RadioTower size={15} className="text-cyan" />
                <h2 className="text-[14px] font-semibold tracking-[0.12em] text-txt">
                  MISSION EVENT LOG
                </h2>
                <span className="font-mono text-[10px] text-faint">
                  {filtered.length} records
                </span>
              </div>
              <button
                type="button"
                onClick={() => dispatch({ type: "SET_EVENT_FEED", open: false })}
                className="rounded-md border border-white/[0.08] px-2.5 py-1 font-mono text-[10px] tracking-[0.1em] text-muted uppercase transition-colors hover:text-txt"
              >
                Close
              </button>
            </header>

            <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.05] px-5 py-3">
              {(["all", "alert", "link", "launch", "system"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={cn(
                    "rounded-md border px-2 py-[3px] font-mono text-[9.5px] tracking-[0.12em] uppercase transition-colors",
                    filter === f
                      ? "border-cyan/35 bg-cyan/12 text-cyan"
                      : "border-white/[0.06] text-faint hover:text-muted"
                  )}
                >
                  {f}
                </button>
              ))}
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter events…"
                aria-label="Filter events"
                className="ml-auto w-52 rounded-lg border border-white/[0.06] bg-black/30 px-2.5 py-1.5 font-mono text-[11px] text-txt placeholder:text-faint focus:border-cyan/35 focus:outline-none"
              />
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[1fr_300px]">
              <div className="min-h-0 overflow-y-auto border-r border-white/[0.05]">
                {filtered.map((event) => (
                  <button
                    key={event.id + event.createdAt}
                    type="button"
                    onClick={() => setSelectedId(event.id)}
                    className={cn(
                      "flex w-full items-start gap-3 border-b border-white/[0.03] px-4 py-2.5 text-left transition-colors",
                      selectedId === event.id
                        ? "bg-cyan/[0.07]"
                        : "hover:bg-white/[0.03]"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full",
                        SEVERITY_TONE[event.severity]
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span
                          className={cn(
                            "truncate text-[12px] font-medium",
                            SEVERITY_TEXT[event.severity]
                          )}
                        >
                          {event.title}
                        </span>
                        <span className="tabular shrink-0 font-mono text-[9.5px] text-faint">
                          {formatMET(event.tMs)}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-[10.5px] text-faint">
                        {event.detail}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-[9px] tracking-[0.08em] text-faint/70">
                      {event.source}
                    </span>
                  </button>
                ))}
              </div>

              <aside className="min-h-0 overflow-y-auto p-4">
                {selected ? (
                  <div className="space-y-4">
                    <div>
                      <div className="label-xs mb-1.5 flex items-center gap-1.5">
                        <ShieldAlert size={11} />
                        Record detail
                      </div>
                      <h3 className="text-[13.5px] leading-snug font-medium text-txt">
                        {selected.title}
                      </h3>
                      <p className="mt-2 text-[11.5px] leading-relaxed text-muted">
                        {selected.detail}
                      </p>
                    </div>
                    <dl className="grid grid-cols-2 gap-3">
                      <div>
                        <dt className="label-xs">Mission time</dt>
                        <dd className="tabular mt-0.5 font-mono text-[11px] text-cyan">
                          {formatMET(selected.tMs)}
                        </dd>
                      </div>
                      <div>
                        <dt className="label-xs">Source</dt>
                        <dd className="mt-0.5 font-mono text-[11px] text-txt/85">
                          {selected.source}
                        </dd>
                      </div>
                      <div>
                        <dt className="label-xs">Category</dt>
                        <dd className="mt-0.5 font-mono text-[11px] text-txt/85">
                          {selected.category}
                        </dd>
                      </div>
                      <div>
                        <dt className="label-xs">Severity</dt>
                        <dd
                          className={cn(
                            "mt-0.5 font-mono text-[11px] uppercase",
                            SEVERITY_TEXT[selected.severity]
                          )}
                        >
                          {selected.severity}
                        </dd>
                      </div>
                    </dl>
                    <button
                      type="button"
                      onClick={() => {
                        dispatch({
                          type: "SET_TIME",
                          t: Math.min(
                            selected.tMs,
                            Date.now() + 4 * 60 * 60 * 1000 - 600000
                          ),
                        });
                        dispatch({ type: "SET_EVENT_FEED", open: false });
                      }}
                      className="w-full rounded-lg border border-cyan/30 bg-cyan/10 py-2 font-mono text-[10px] tracking-[0.12em] text-cyan uppercase transition-colors hover:bg-cyan/18"
                    >
                      Jump to event time
                    </button>
                  </div>
                ) : (
                  <div className="text-[11px] leading-relaxed text-faint">
                    Select a record to inspect its full detail, source and
                    timeline position.
                  </div>
                )}
              </aside>
            </div>

            <footer className="border-t border-white/[0.05] px-5 py-2.5 font-mono text-[9.5px] tracking-[0.08em] text-faint">
              CONSOLE CLOCK {formatMET(simTime)} · {events.length} TOTAL RECORDS ·{" "}
              SIMULATED FEED
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
