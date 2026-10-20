"use client";

import { useProgress } from "@react-three/drei";
import { AnimatePresence, motion } from "framer-motion";

/**
 * Texture acquisition progress for the orbital scene.
 * Rendered outside the WebGL canvas as a DOM overlay.
 */
export function GlobeLoader() {
  const { active, progress, item } = useProgress();

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="absolute inset-0 z-30 grid place-items-center bg-[#05070B]/90 backdrop-blur-sm"
        >
          <div className="w-[260px]">
            <div className="label-xs mb-2 text-center">Acquiring orbital data</div>
            <div className="h-[2px] w-full overflow-hidden rounded-full bg-white/[0.08]">
              <motion.div
                className="h-full bg-cyan"
                animate={{ width: `${Math.max(4, progress)}%` }}
                transition={{ duration: 0.2 }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between font-mono text-[9px] tracking-[0.1em] text-faint">
              <span className="max-w-[180px] truncate uppercase">{item ?? "initialising"}</span>
              <span className="tabular">{Math.round(progress)}%</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
