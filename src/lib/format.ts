/** Formatting helpers shared across the console. */

import { MISSION_EPOCH_MS } from "./constants";

function pad(n: number, len = 2): string {
  return Math.floor(Math.abs(n)).toString().padStart(len, "0");
}

/** MET style relative time, e.g. `T+00:04:45` or `T-00:10:00`. */
export function formatMET(tMs: number): string {
  const offset = tMs - MISSION_EPOCH_MS;
  const sign = offset < 0 ? "-" : "+";
  const total = Math.abs(offset) / 1000;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  return `T${sign}${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** Countdown style, e.g. `00:04:45`. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** Wall-clock UTC time from the simulated instant. */
export function formatUtc(tMs: number): string {
  const d = new Date(tMs);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

export function formatDate(tMs: number): string {
  const d = new Date(tMs);
  const months = [
    "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
    "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
  ];
  return `${pad(d.getUTCDate())} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function formatLatLon(lat: number, lon: number): string {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(2)}°${ns} ${Math.abs(lon).toFixed(2)}°${ew}`;
}

export function formatKm(km: number, digits = 1): string {
  if (Math.abs(km) >= 10000) return `${(km / 1000).toFixed(2)}k km`;
  return `${km.toFixed(digits)} km`;
}

export function formatNumber(value: number, digits = 1): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatDbm(dbm: number): string {
  return `${dbm.toFixed(1)}`;
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${pad(m)}:${pad(s)}`;
}

export function formatRelative(thenMs: number, nowMs: number): string {
  const diff = Math.max(0, nowMs - thenMs);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function titleCase(value: string): string {
  return value
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
