"use client";

import { useEffect, useRef, useState } from "react";

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

function reducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  return !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Counts a number up to `target` on mount and on subsequent target changes.
 *
 * Starts at 0 on the server AND the client so hydration matches (starting at
 * `target` on the server and 0 in the browser was a hydration error). Under
 * reduced motion the first animation frame jumps straight to `target`. The
 * animation runs only via `requestAnimationFrame`, so setState never fires
 * synchronously in the effect body.
 */
export function useCountUp(target: number, duration = 800): number {
  const [value, setValue] = useState<number>(0);
  const fromRef = useRef<number>(0);

  useEffect(() => {
    if (!Number.isFinite(target)) return;
    if (target === fromRef.current) return;

    const from = fromRef.current;
    const effectiveDuration = reducedMotion() ? 0 : duration;
    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const t = effectiveDuration === 0 ? 1 : Math.min(1, (now - start) / effectiveDuration);
      const eased = easeOutCubic(t);
      const next = from + (target - from) * eased;
      setValue(next);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}
