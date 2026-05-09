import { useEffect, useRef, useState } from 'react';

export function useCountUp(target: number, durationMs = 150): number {
  const [value, setValue] = useState(target);
  const startTsRef = useRef<number | null>(null);
  const startValueRef = useRef(target);
  const rafRef = useRef<number | null>(null);

  const valueRef = useRef(target);
  valueRef.current = value;

  useEffect(() => {
    if (target === valueRef.current) return;
    startTsRef.current = null;
    startValueRef.current = valueRef.current;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);

    function step(now: number) {
      if (startTsRef.current === null) startTsRef.current = now;
      const elapsed = now - startTsRef.current;
      const t = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = startValueRef.current + (target - startValueRef.current) * eased;
      setValue(next);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        rafRef.current = null;
      }
    }

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, durationMs]);

  return value;
}
