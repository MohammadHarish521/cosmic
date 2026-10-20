"use client";

import { useId, useMemo } from "react";

import { cn } from "@/lib/utils";

interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
  strokeWidth?: number;
  fill?: boolean;
  className?: string;
  /** Fixed value range; when omitted the series auto-scales. */
  domain?: [number, number];
}

/**
 * Ultra-light SVG sparkline. Used for the small inline gauges where a full
 * charting library would be overkill.
 */
export function Sparkline({
  data,
  color = "#4FE3FF",
  height = 34,
  strokeWidth = 1.25,
  fill = true,
  className,
  domain,
}: SparklineProps) {
  const gradientId = useId();

  const { path, area } = useMemo(() => {
    if (data.length < 2) return { path: "", area: "" };
    let min = domain ? domain[0] : Math.min(...data);
    let max = domain ? domain[1] : Math.max(...data);
    if (max - min < 1e-6) {
      max += 1;
      min -= 1;
    }
    const w = 100;
    const h = 100;
    const step = w / (data.length - 1);
    const points = data.map((v, i) => {
      const x = i * step;
      const y = h - ((v - min) / (max - min)) * h;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });
    const d = `M${points.join("L")}`;
    return { path: d, area: `${d}L100,100L0,100Z` };
  }, [data, domain]);

  if (!path) {
    return (
      <div
        className={cn("flex items-center text-[10px] text-faint", className)}
        style={{ height }}
      >
        acquiring…
      </div>
    );
  }

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={cn("w-full overflow-visible", className)}
      style={{ height }}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#${gradientId})`} />}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
