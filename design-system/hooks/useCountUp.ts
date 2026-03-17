'use client';

import { useState, useEffect, useRef } from 'react';
import { useIntersection } from './useIntersection';

interface UseCountUpOptions {
  end: number;
  duration?: number;
  start?: number;
  decimals?: number;
}

interface UseCountUpReturn<T extends HTMLElement> {
  ref: ReturnType<typeof useIntersection<T>>['ref'];
  value: string;
}

function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export function useCountUp<T extends HTMLElement = HTMLDivElement>(
  options: UseCountUpOptions
): UseCountUpReturn<T> {
  const { end, duration = 1000, start = 0, decimals = 0 } = options;
  const [currentValue, setCurrentValue] = useState(start);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const { ref, isInView } = useIntersection<T>({ threshold: 0.1, triggerOnce: true });

  useEffect(() => {
    if (!isInView) return;

    startTimeRef.current = null;

    const animate = (timestamp: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutExpo(progress);
      const value = start + (end - start) * easedProgress;

      setCurrentValue(value);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [isInView, end, duration, start]);

  const formatted = currentValue.toFixed(decimals);

  return { ref, value: formatted };
}
