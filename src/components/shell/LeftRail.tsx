"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Crosshair,
  Filter,
  Orbit,
  Rocket,
  Search,
  Signal,
  X,
} from "lucide-react";

import { GlassPanel, PanelHeader, Stat, StatusDot } from "@/components/ui/GlassPanel";
import { useRoster, useSatelliteSnapshot } from "@/hooks/useSatelliteSnapshot";
import { formatDuration, formatLatLon, titleCase } from "@/lib/format";
import { MISSION_TYPES } from "@/lib/fleet";
import { revsSinceEpoch } from "@/lib/orbits";
import type { MissionType, SatStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useMissionStore, useEnterLaunchMode } from "@/state/mission-store";

const STATUS_OPTIONS: { value: SatStatus | "all"; label: string }[] = [
  { value: "all", label: "ALL" },
  { value: "nominal", label: "NOMINAL" },
  { value: "degraded", label: "DEGRADED" },
  { value: "warning", label: "WARNING" },
  { value: "critical", label: "CRITICAL" },
];

export function LeftRail() {
  const { state, dispatch } = useMissionStore();
  const roster = useRoster();
  const [showFilters, setShowFilters] = useState(false);
  const enterLaunch = useEnterLaunchMode();

  const filtered = useMemo(() => {
    const query = state.search.trim().toLowerCase();
    return roster.filter((entry) => {
      if (query) {
        const haystack = `${entry.sat.name} ${entry.sat.id} ${entry.sat.callsign} ${entry.sat.operator}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (state.typeFilter !== "all" && entry.sat.missionType !== state.typeFilter) {
        return false;
      }
      if (state.statusFilter !== "all") {
        if (state.statusFilter === "nominal" && entry.status !== "nominal") return false;
        if (state.statusFilter === "degraded" && entry.status !== "degraded") return false;
        if (state.statusFilter === "warning" && entry.status !== "warning") return false;
        if (state.statusFilter === "critical" && entry.status !== "critical") return false;
      }
      return true;
    });
  }, [roster, state.search, state.typeFilter, state.statusFilter]);

  const activeFilterCount =
    (state.typeFilter !== "all" ? 1 : 0) + (state.statusFilter !== "all" ? 1 : 0);

  return (
    <aside className="flex h-full min-h-0 flex-col gap-2.5 overflow-y-auto pr-0.5">
      {/* ---------------- Mission navigation ---------------- */}
      <GlassPanel className="shrink-0">
        <PanelHeader title="Mission Navigation" meta="AETHER-7" />
        <div className="grid grid-cols-1 gap-1 p-2">
          <NavButton
            active={state.appMode === "orbit"}
            icon={<Orbit size={13} />}
            label="Orbital Operations"
            hint="Constellation tracking"
            onClick={() => {
              dispatch({ type: "SET_APP_MODE", mode: "orbit" });
              dispatch({ type: "SET_CAMERA_MODE", mode: "overview" });
            }}
          />
          <NavButton
            active={state.appMode === "launch"}
            icon={<Rocket size={13} />}
            label="Launch Sequence"
            hint="T-00:00:30 countdown"
            onClick={enterLaunch}
          />
          <NavButton
            active={false}
            icon={<Signal size={13} />}
            label="Ground Network"
            hint="6 tracking stations"
            onClick={() => {
              dispatch({ type: "SET_CAMERA_MODE", mode: "overview" });
            }}
          />
        </div>
      </GlassPanel>

      {/* ---------------- Spacecraft roster ---------------- */}
      <GlassPanel className="shrink-0">
        <PanelHeader
          title="Spacecraft"
          meta={`${filtered.length}/${roster.length}`}
          action={
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowFilters((v) => !v)}
                aria-label="Toggle filters"
                className={cn(
                  "relative grid h-6 w-6 place-items-center rounded-md border transition-colors",
                  showFilters || activeFilterCount > 0
                    ? "border-cyan/30 bg-cyan/10 text-cyan"
                    : "border-white/[0.07] text-muted hover:text-txt"
                )}
              >
                <Filter size={12} />
                {activeFilterCount > 0 && (
                  <span className="absolute -right-1 -top-1 grid h-3.5 w-3.5 place-items-center rounded-full bg-cyan text-[8px] font-bold text-[#04121a]">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
          }
        />

        {/* Search */}
        <div className="relative border-b border-white/[0.045] p-2">
          <Search
            size={13}
            className="pointer-events-none absolute left-4.5 top-1/2 -translate-y-1/2 text-faint"
          />
          <input
            value={state.search}
            onChange={(e) => dispatch({ type: "SET_SEARCH", value: e.target.value })}
            placeholder="Search spacecraft…"
            aria-label="Search spacecraft"
            className="w-full rounded-lg border border-white/[0.06] bg-black/30 py-1.5 pr-7 pl-7 font-mono text-[11px] text-txt placeholder:text-faint focus:border-cyan/35 focus:outline-none"
          />
          {state.search && (
            <button
              type="button"
              onClick={() => dispatch({ type: "SET_SEARCH", value: "" })}
              aria-label="Clear search"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-faint hover:text-txt"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Filters */}
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-b border-white/[0.045]"
          >
            <div className="px-2.5 py-2">
              <div className="label-xs mb-1.5">Mission Type</div>
              <div className="flex flex-wrap gap-1">
                <FilterChip
                  active={state.typeFilter === "all"}
                  onClick={() => dispatch({ type: "SET_TYPE_FILTER", value: "all" })}
                >
                  All
                </FilterChip>
                {MISSION_TYPES.map((t) => (
                  <FilterChip
                    key={t.id}
                    active={state.typeFilter === t.id}
                    onClick={() =>
                      dispatch({
                        type: "SET_TYPE_FILTER",
                        value: state.typeFilter === t.id ? "all" : (t.id as MissionType),
                      })
                    }
                  >
                    {t.label.split(" ")[0]}
                  </FilterChip>
                ))}
              </div>
              <div className="label-xs mt-2.5 mb-1.5">Status</div>
              <div className="flex flex-wrap gap-1">
                {STATUS_OPTIONS.map((s) => (
                  <FilterChip
                    key={s.value}
                    active={state.statusFilter === s.value}
                    onClick={() =>
                      dispatch({
                        type: "SET_STATUS_FILTER",
                        value:
                          state.statusFilter === s.value ? "all" : s.value,
                      })
                    }
                  >
                    {s.label}
                  </FilterChip>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* List */}
        <div className="max-h-[318px] overflow-y-auto">
          {filtered.length === 0 && (
            <div className="px-3 py-6 text-center text-[11px] text-faint">
              No spacecraft match the current filters.
            </div>
          )}
          {filtered.map((entry) => {
            const selected = entry.sat.id === state.selectedId;
            return (
              <button
                key={entry.sat.id}
                type="button"
                onClick={() => {
                  dispatch({ type: "SELECT", id: entry.sat.id });
                  if (state.cameraMode !== "launch") {
                    dispatch({ type: "SET_CAMERA_MODE", mode: "tracking" });
                  }
                }}
                className={cn(
                  "group relative flex w-full items-center gap-2.5 border-b border-white/[0.03] px-3 py-2 text-left transition-colors",
                  selected ? "bg-cyan/[0.07]" : "hover:bg-white/[0.03]"
                )}
              >
                {selected && (
                  <motion.span
                    layoutId="roster-active"
                    className="absolute top-0 bottom-0 left-0 w-[2px] bg-cyan"
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  />
                )}
                <StatusDot status={entry.status} pulse={entry.status !== "nominal"} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className={cn(
                        "truncate text-[12.5px] font-medium tracking-[0.04em]",
                        selected ? "text-cyan" : "text-txt/90"
                      )}
                    >
                      {entry.sat.name}
                    </span>
                    <span className="tabular shrink-0 font-mono text-[9.5px] text-faint">
                      {entry.altKm.toFixed(0)} km
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-[9.5px] tracking-[0.08em] text-faint">
                      {entry.sat.id}
                    </span>
                    <span
                      className={cn(
                        "font-mono text-[9px] tracking-[0.1em]",
                        entry.linkState === "locked"
                          ? "text-green/80"
                          : entry.linkState === "acquiring"
                            ? "text-amber/80"
                            : "text-faint"
                      )}
                    >
                      {entry.linkState === "locked"
                        ? "LOCKED"
                        : entry.linkState === "acquiring"
                          ? "ACQ"
                          : "NO LINK"}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </GlassPanel>

      {/* ---------------- Orbital parameters ---------------- */}
      <OrbitalParameters />

      {/* ---------------- Health ---------------- */}
      <HealthPanel />
    </aside>
  );
}

function NavButton({
  active,
  icon,
  label,
  hint,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
        active ? "bg-cyan/[0.09]" : "hover:bg-white/[0.035]"
      )}
    >
      <span
        className={cn(
          "grid h-6 w-6 shrink-0 place-items-center rounded-md border transition-colors",
          active
            ? "border-cyan/35 bg-cyan/10 text-cyan"
            : "border-white/[0.07] text-muted group-hover:text-txt"
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-[12px] font-medium",
            active ? "text-cyan" : "text-txt/85"
          )}
        >
          {label}
        </span>
        <span className="block truncate font-mono text-[9px] tracking-[0.06em] text-faint">
          {hint}
        </span>
      </span>
      {active && (
        <span className="h-1.5 w-1.5 rounded-full bg-cyan shadow-[0_0_8px_#4FE3FF]" />
      )}
    </button>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border px-1.5 py-[3px] font-mono text-[9px] tracking-[0.09em] uppercase transition-colors",
        active
          ? "border-cyan/35 bg-cyan/12 text-cyan"
          : "border-white/[0.06] text-faint hover:border-white/15 hover:text-muted"
      )}
    >
      {children}
    </button>
  );
}

function OrbitalParameters() {
  const { state } = useMissionStore();
  const snapshot = useSatelliteSnapshot(state.selectedId);

  if (!snapshot) {
    return (
      <GlassPanel>
        <PanelHeader title="Orbital Parameters" />
        <div className="px-3.5 py-4 text-[11px] text-faint">
          Select a spacecraft to resolve its element set.
        </div>
      </GlassPanel>
    );
  }

  const { sat, orbit } = snapshot;
  const period = orbit.periodSec;
  const revs = revsSinceEpoch(sat.element, state.simTimeMs);

  return (
    <GlassPanel className="shrink-0">
      <PanelHeader
        title="Orbital Parameters"
        meta={`${sat.orbitClass} · ${titleCase(sat.missionType)}`}
      />
      <div className="grid grid-cols-2 gap-x-3 gap-y-3 p-3">
        <Stat label="Inclination" value={sat.element.inclinationDeg.toFixed(2)} unit="°" />
        <Stat label="RAAN" value={sat.element.raanDeg.toFixed(2)} unit="°" />
        <Stat label="Eccentricity" value={sat.element.eccentricity.toFixed(5)} />
        <Stat label="Period" value={formatDuration(period)} />
        <Stat label="Sub-point" value={formatLatLon(orbit.lat, orbit.lon)} />
        <Stat
          label="Revs (epoch)"
          value={revs.toFixed(2)}
          tone="cyan"
        />
      </div>
      <div className="border-t border-white/[0.045] px-3.5 py-2.5">
        <div className="flex items-center gap-1.5">
          <Crosshair size={11} className="text-faint" />
          <span className="font-mono text-[9.5px] tracking-[0.06em] text-faint">
            {sat.callsign} · {sat.operator}
          </span>
        </div>
        <p className="mt-1.5 text-[10.5px] leading-relaxed text-muted/80">
          {sat.payload}
        </p>
      </div>
    </GlassPanel>
  );
}

function HealthPanel() {
  const { state } = useMissionStore();
  const snapshot = useSatelliteSnapshot(state.selectedId);
  if (!snapshot) return null;
  const t = snapshot.telemetry;

  const gauges = [
    { label: "Power", value: t.batteryPct, unit: "%", max: 100, color: "#4FE3FF" },
    {
      label: "Bus V",
      value: t.busVoltage,
      unit: "V",
      min: 24,
      max: 32,
      color: "#3DF5A6",
    },
    {
      label: "Thermal",
      value: t.temperatureC,
      unit: "°C",
      min: -25,
      max: 45,
      color: t.temperatureC > 26 ? "#FFB020" : "#7FB2FF",
    },
    {
      label: "Propellant",
      value: t.fuelPct,
      unit: "%",
      max: 100,
      color: "#9C8CFF",
    },
  ];

  return (
    <GlassPanel className="shrink-0">
      <PanelHeader title="Spacecraft Health" meta={snapshot.sat.name} />
      <div className="space-y-2.5 p-3">
        {gauges.map((g) => {
          const min = g.min ?? 0;
          const max = g.max ?? 100;
          const pct = Math.max(0, Math.min(100, ((g.value - min) / (max - min)) * 100));
          return (
            <div key={g.label}>
              <div className="mb-1 flex items-baseline justify-between">
                <span className="label-xs">{g.label}</span>
                <span className="tabular font-mono text-[10px] text-txt/85">
                  {g.value.toFixed(1)}
                  <span className="text-faint">{g.unit}</span>
                </span>
              </div>
              <div className="h-[3px] w-full overflow-hidden rounded-full bg-white/[0.07]">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: g.color }}
                  initial={false}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </GlassPanel>
  );
}
