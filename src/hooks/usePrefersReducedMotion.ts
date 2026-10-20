"use client";

import { useEffect, useState } from "react";

/**
 * Motion preference. Returns true when the user has asked the OS to reduce
 * motion — the console uses this to disable camera drift, pulsing and
 * decorative animation while keeping the simulation fully usable.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    setReduced(mql.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return reduced;
}
