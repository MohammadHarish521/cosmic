"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowUpRight,
  Radio,
  Satellite as SatelliteIcon,
  ShieldAlert,
} from "lucide-react";

import { GlassPanel, PanelHeader, Stat, StatusDot } from "@/components/ui/GlassPanel";
import { useSatelliteSnapshot } from "@/hooks/useSatelliteSnapshot";
import { useTelemetrySeries } from "@/hooks/useTelemetryHistory";
import { formatLatLon, formatMET, titleCase } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMissionStore, useSimTime } from "@/state/mission-store";
import { EventFeed } from "./EventFeed";

export function RightRail() {
  const { state } = useMissionStore();
  const snapshot = useSatelliteSnapshot(state.selectedId);
  const series = useTelemetrySeries(state.selectedId);

  if (!snapshot) {
    return (
      <aside className="flex h-full min-h-0 flex-col gap-2.5">
        <GlassPanel className="flex-1">
          <PanelHeader title="Telemetry" />
          <div className="px-3.5 py-6 text-[11px] text-faint">
            No spacecraft selected. Pick one from the roster to stream telemetry.
          </div>
        </GlassPanel>
      </aside>
    );
  }

  const { sat, orbit, telemetry, alert } = snapshot;
  const altDomain = altitudeDomain(series.altitude);
  const linkTone =
    telemetry.linkState === "locked"
      ? "green"
      : telemetry.linkState === "acquiring"
        ? "amber"
        : "red";

  return (
    <aside className="flex h-full min-h-0 flex-col gap-2.5 overflow-y-auto pr-0.5">
      {/* Identity */}
      <GlassPanel className="shrink-0" corners>
        <div className="flex items-start justify-between gap-3 p-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <SatelliteIcon size={14} className="shrink-0 text-cyan" />
              <h2 className="truncate text-[15px] font-semibold tracking-[0.08em] text-txt">
                {sat.name}
              </h2>
              <StatusDot status={alert ? "critical" : "nominal"} pulse={!!alert} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[9.5px] tracking-[0.09em] text-faint">
              <span>{sat.id}</span>
              <span className="text-white/15">|</span>
              <span>{titleCase(sat.missionType)}</span>
              <span className="text-white/15">|</span>
              <span>{sat.orbitClass}</span>
              <span className="text-white/15">|</span>
              <span>{sat.catalogId}</span>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="label-xs">Link</div>
            <div
              className={cn(
                "font-mono text-[11px] tracking-[0.1em] uppercase",
                linkTone === "green" && "text-green",
                linkTone === "amber" && "text-amber",
                linkTone === "red" && "text-red"
              )}
            >
              {telemetry.linkState}
            </div>
          </div>
        </div>

        <AnimatePresence>
          {alert && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden border-t border-amber/20 bg-amber/[0.07]"
            >
              <div className="flex items-start gap-2 px-3 py-2.5">
                <ShieldAlert size={14} className="mt-px shrink-0 text-amber" />
                <div className="min-w-0">
                  <div className="text-[11.5px] font-medium text-amber">
                    {alert.title}
                  </div>
                  <p className="mt-0.5 text-[10.5px] leading-relaxed text-amber/70">
                    {alert.detail}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassPanel>

      {/* Primary telemetry tiles */}
      <GlassPanel className="shrink-0">
        <PanelHeader title="Telemetry" meta="live" />
        <div className="grid grid-cols-3 gap-px bg-white/[0.035]">
          <Tile label="Altitude" value={orbit.altKm.toFixed(1)} unit="km" tone="cyan" />
          <Tile
            label="Velocity"
            value={orbit.speedKms.toFixed(3)}
            unit="km/s"
            tone="cyan"
          />
          <Tile
            label="Signal"
            value={telemetry.signalDbm.toFixed(1)}
            unit="dBm"
            tone={
              telemetry.signalDbm > -70
                ? "green"
                : telemetry.signalDbm > -95
                  ? "amber"
                  : "red"
            }
          />
          <Tile
            label="Battery"
            value={telemetry.batteryPct.toFixed(1)}
            unit="%"
            tone={telemetry.batteryPct < 40 ? "amber" : "default"}
          />
          <Tile
            label="Temp"
            value={telemetry.temperatureC.toFixed(1)}
            unit="°C"
            tone={telemetry.temperatureC > 26 ? "amber" : "default"}
          />
          <Tile
            label="Dose"
            value={telemetry.radiationDose.toFixed(3)}
            unit="mSv/d"
          />
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-3 border-t border-white/[0.045] p-3">
          <Stat label="Sub-satellite point" value={formatLatLon(orbit.lat, orbit.lon)} />
          <Stat
            label="Ground speed"
            value={telemetry.groundSpeedKms.toFixed(3)}
            unit="km/s"
          />
          <Stat
            label="Attitude error"
            value={telemetry.attitudeErrorDeg.toFixed(3)}
            unit="°"
          />
          <Stat
            label="Sunlit"
            value={telemetry.sunlight ? "YES" : "ECLIPSE"}
            tone={telemetry.sunlight ? "green" : "amber"}
          />
        </div>
      </GlassPanel>

      {/* Altitude chart */}
      <GlassPanel className="shrink-0">
        <PanelHeader
          title="Orbital Profile"
          meta={`${series.altitude.length} samples`}
        />
        <div className="h-[118px] w-full px-1 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series.altitude} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="altFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4FE3FF" stopOpacity={0.32} />
                  <stop offset="100%" stopColor="#4FE3FF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(126,184,214,0.08)" vertical={false} />
              <XAxis dataKey="t" hide />
              <YAxis
                domain={altDomain}
                tick={{ fill: "#4B5A6B", fontSize: 8, fontFamily: "monospace" }}
                axisLine={false}
                tickLine={false}
                width={34}
                tickFormatter={(v: number) => v.toFixed(0)}
              />
              <Tooltip content={<ChartTooltip unit="km" />} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#4FE3FF"
                strokeWidth={1.4}
                fill="url(#altFill)"
                isAnimationActive={false}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </GlassPanel>

      {/* Signal chart */}
      <GlassPanel className="shrink-0">
        <PanelHeader title="Link Quality" meta={`${telemetry.signalDbm.toFixed(1)} dBm`} />
        <div className="h-[104px] w-full px-1 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series.signal} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="rgba(126,184,214,0.08)" vertical={false} />
              <XAxis dataKey="t" hide />
              <YAxis
                domain={[-115, -40]}
                ticks={[-110, -90, -70, -50]}
                tick={{ fill: "#4B5A6B", fontSize: 8, fontFamily: "monospace" }}
                axisLine={false}
                tickLine={false}
                width={34}
              />
              <ReferenceLine
                y={-95}
                stroke="rgba(255,176,32,0.35)"
                strokeDasharray="3 3"
              />
              <Tooltip content={<ChartTooltip unit="dBm" />} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#3DF5A6"
                strokeWidth={1.4}
                isAnimationActive={false}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </GlassPanel>

      {/* Communications */}
      <CommsPanel />

      {/* Events */}
      <EventFeed />
    </aside>
  );
}

function Tile({
  label,
  value,
  unit,
  tone = "default",
}: {
  label: string;
  value: string;
  unit: string;
  tone?: "default" | "cyan" | "amber" | "red" | "green";
}) {
  const toneClass =
    tone === "cyan"
      ? "text-cyan"
      : tone === "amber"
        ? "text-amber"
        : tone === "red"
          ? "text-red"
          : tone === "green"
            ? "text-green"
            : "text-txt";

  return (
    <div className="bg-[#080c12]/60 px-3 py-2.5">
      <div className="label-xs truncate">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className={cn("tabular font-mono text-[14px] leading-none", toneClass)}>
          {value}
        </span>
        <span className="font-mono text-[9px] text-faint">{unit}</span>
      </div>
    </div>
  );
}

function altitudeDomain(samples: { value: number }[]): [number, number] {
  if (samples.length === 0) return [0, 100];
  let min = Infinity;
  let max = -Infinity;
  for (const sample of samples) {
    if (sample.value < min) min = sample.value;
    if (sample.value > max) max = sample.value;
  }
  const pad = Math.max(12, (max - min) * 0.65);
  return [min - pad, max + pad];
}

function ChartTooltip({ active, payload, label, unit }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-white/10 bg-[#0a0e14]/95 px-2 py-1 backdrop-blur">
      <div className="font-mono text-[9px] tracking-[0.08em] text-faint">
        {formatMET(label as number)}
      </div>
      <div className="tabular font-mono text-[11px] text-cyan">
        {(payload[0].value as number).toFixed(2)} {unit}
      </div>
    </div>
  );
}

function CommsPanel() {
  const { state } = useMissionStore();
  const snapshot = useSatelliteSnapshot(state.selectedId);
  if (!snapshot) return null;
  const t = snapshot.telemetry;
  const pass = t.pass;

  return (
    <GlassPanel className="shrink-0">
      <PanelHeader
        title="Communications"
        action={
          <span
            className={cn(
              "font-mono text-[9.5px] tracking-[0.1em] uppercase",
              t.linkState === "locked"
                ? "text-green"
                : t.linkState === "acquiring"
                  ? "text-amber"
                  : "text-faint"
            )}
          >
            {t.linkState}
          </span>
        }
      />
      <div className="grid grid-cols-2 gap-x-3 gap-y-3 p-3">
        <Stat
          label="Station"
          value={pass ? pass.station.code : "—"}
          hint={pass ? pass.station.name : "No station in view"}
        />
        <Stat
          label="Elevation"
          value={pass ? pass.elevationDeg.toFixed(1) : "—"}
          unit="°"
          tone={pass ? "green" : "default"}
        />
        <Stat
          label="Downlink"
          value={t.downlinkMbps.toFixed(1)}
          unit="Mbps"
        />
        <Stat
          label="Payload rate"
          value={t.dataRateMbps.toFixed(0)}
          unit="Mbps"
        />
      </div>
      <div className="flex items-center gap-2 border-t border-white/[0.045] px-3 py-2">
        <Radio size={11} className="text-faint" />
        <span className="font-mono text-[9.5px] tracking-[0.06em] text-faint">
          {pass
            ? `PASS · ${pass.station.name.toUpperCase()} · ${pass.durationSec.toFixed(0)}s WINDOW`
            : "NEXT ACQUISITION PENDING"}
        </span>
      </div>
    </GlassPanel>
  );
}
