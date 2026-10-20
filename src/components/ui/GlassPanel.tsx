"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface GlassPanelProps {
  children: ReactNode;
  className?: string;
  /** Adds the quiet corner ticks. */
  corners?: boolean;
  as?: "div" | "section" | "aside";
}

export function GlassPanel({
  children,
  className,
  corners = false,
  as: Tag = "section",
}: GlassPanelProps) {
  return (
    <Tag className={cn("glass relative overflow-hidden", corners && "corners", className)}>
      {children}
    </Tag>
  );
}

interface PanelHeaderProps {
  title: string;
  meta?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function PanelHeader({ title, meta, action, className }: PanelHeaderProps) {
  return (
    <header
      className={cn(
        "flex items-center justify-between gap-3 border-b border-white/[0.055] px-3.5 py-2.5",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="h-3 w-[2px] rounded-full bg-cyan/70" aria-hidden />
        <h2 className="label-sm truncate text-txt/85">{title}</h2>
        {meta ? <span className="label-xs truncate">{meta}</span> : null}
      </div>
      {action}
    </header>
  );
}

interface StatProps {
  label: string;
  value: ReactNode;
  unit?: string;
  tone?: "default" | "cyan" | "amber" | "red" | "green";
  className?: string;
  hint?: string;
}

const TONE: Record<NonNullable<StatProps["tone"]>, string> = {
  default: "text-txt",
  cyan: "text-cyan glow-cyan",
  amber: "text-amber glow-amber",
  red: "text-red",
  green: "text-green",
};

export function Stat({
  label,
  value,
  unit,
  tone = "default",
  className,
  hint,
}: StatProps) {
  return (
    <div className={cn("min-w-0", className)} title={hint}>
      <div className="label-xs truncate">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span
          className={cn(
            "tabular truncate font-mono text-[15px] leading-none font-medium",
            TONE[tone]
          )}
        >
          {value}
        </span>
        {unit ? <span className="font-mono text-[10px] text-faint">{unit}</span> : null}
      </div>
    </div>
  );
}

interface StatusDotProps {
  status: SatelliteStatusLike;
  pulse?: boolean;
  className?: string;
}

type SatelliteStatusLike = "nominal" | "degraded" | "warning" | "critical" | "offline";

const STATUS_COLOR: Record<SatelliteStatusLike, string> = {
  nominal: "bg-green",
  degraded: "bg-amber",
  warning: "bg-amber",
  critical: "bg-red",
  offline: "bg-faint",
};

export function StatusDot({ status, pulse = false, className }: StatusDotProps) {
  return (
    <span
      className={cn(
        "relative inline-block h-1.5 w-1.5 shrink-0 rounded-full",
        STATUS_COLOR[status],
        className
      )}
    >
      {pulse && (
        <span
          className={cn(
            "absolute inset-0 animate-ping rounded-full opacity-70",
            STATUS_COLOR[status]
          )}
        />
      )}
    </span>
  );
}

export function statusColor(status: SatelliteStatusLike): string {
  return STATUS_COLOR[status];
}
