'use client';

import { useEffect, useRef, useState } from 'react';

interface UseIntersectionObserverOptions extends IntersectionObserverInit {
  freezeOnceVisible?: boolean;
}

/**
 * Custom hook to detect when an element enters the viewport
 * Used for triggering fade-in animations and other scroll-based effects
 *
 * @param options - IntersectionObserver options
 * @returns ref to attach to element and isVisible state
 *
 * @example
 * const { ref, isVisible } = useIntersectionObserver({ threshold: 0.1 });
 * return (
 *   <section ref={ref} className={isVisible ? 'animate-fade-in-up' : 'opacity-0'}>
 *     Content
 *   </section>
 * );
 */
export function useIntersectionObserver(
  options: UseIntersectionObserverOptions = {}
) {
  const { threshold = 0.1, root = null, rootMargin = '0%', freezeOnceVisible = true } = options;

  const ref = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // If already visible and frozen, don't observe
    if (freezeOnceVisible && isVisible) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isIntersecting = entry.isIntersecting;
        setIsVisible(isIntersecting);

        // Disconnect if visible and frozen
        if (isIntersecting && freezeOnceVisible) {
          observer.disconnect();
        }
      },
      { threshold, root, rootMargin }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [threshold, root, rootMargin, freezeOnceVisible, isVisible]);

  return { ref, isVisible };
}
