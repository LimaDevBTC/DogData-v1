'use client';

import { useRef, useState, useEffect, useCallback, type RefObject } from 'react';

interface UseIntersectionOptions {
  threshold?: number;
  triggerOnce?: boolean;
  rootMargin?: string;
}

interface UseIntersectionReturn<T extends HTMLElement> {
  ref: RefObject<T | null>;
  isInView: boolean;
}

export function useIntersection<T extends HTMLElement = HTMLDivElement>(
  options: UseIntersectionOptions = {}
): UseIntersectionReturn<T> {
  const { threshold = 0.1, triggerOnce = true, rootMargin = '0px' } = options;
  const ref = useRef<T | null>(null);
  const [isInView, setIsInView] = useState(false);
  const hasTriggered = useRef(false);

  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[], observer: IntersectionObserver) => {
      const [entry] = entries;
      if (!entry) return;

      if (entry.isIntersecting) {
        setIsInView(true);
        if (triggerOnce) {
          hasTriggered.current = true;
          observer.disconnect();
        }
      } else if (!triggerOnce) {
        setIsInView(false);
      }
    },
    [triggerOnce]
  );

  useEffect(() => {
    const element = ref.current;
    if (!element || hasTriggered.current) return;

    const observer = new IntersectionObserver(handleIntersect, {
      threshold,
      rootMargin,
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [threshold, rootMargin, handleIntersect]);

  return { ref, isInView };
}
