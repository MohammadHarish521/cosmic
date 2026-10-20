"use client";

import { useEffect, useState } from "react";

/** True when the media query matches. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

/** Convenience wrappers. */
export function useIsMobile() {
  return useMediaQuery("(max-width: 899px)");
}

export function useIsCompact() {
  return useMediaQuery("(max-width: 1279px)");
}
