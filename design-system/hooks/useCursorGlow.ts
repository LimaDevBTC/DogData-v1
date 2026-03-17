'use client';

import { useRef, useEffect, useCallback } from 'react';

interface UseCursorGlowOptions {
  color?: string;
  radius?: number;
}

export function useCursorGlow<T extends HTMLElement = HTMLDivElement>(
  options: UseCursorGlowOptions = {}
): React.RefObject<T | null> {
  const {
    color = 'rgba(247, 147, 26, 0.04)',
    radius = 600,
  } = options;

  const ref = useRef<T | null>(null);
  const rafRef = useRef<number | null>(null);
  const mousePos = useRef({ x: 0, y: 0 });

  const updatePosition = useCallback(() => {
    const element = ref.current;
    if (!element) return;

    const rect = element.getBoundingClientRect();
    const x = mousePos.current.x - rect.left;
    const y = mousePos.current.y - rect.top;

    element.style.setProperty('--cursor-x', `${x}px`);
    element.style.setProperty('--cursor-y', `${y}px`);
    element.style.setProperty('--cursor-glow-color', color);
    element.style.setProperty('--cursor-glow-radius', `${radius}px`);

    rafRef.current = null;
  }, [color, radius]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY };

      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(updatePosition);
      }
    };

    document.addEventListener('mousemove', handleMouseMove, { passive: true });

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [updatePosition]);

  return ref;
}
