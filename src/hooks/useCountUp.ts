'use client';

import { useEffect, useState, useRef } from 'react';

interface UseCountUpOptions {
  duration?: number;
  startOnView?: boolean;
}

/**
 * Custom hook to animate number counting from 0 to target value
 * Optionally triggers when element enters viewport
 *
 * @param end - Target number to count up to
 * @param options - Configuration options
 * @returns ref to attach to element and current count value
 *
 * @example
 * const { ref, count } = useCountUp(7000, { duration: 2000 });
 * return (
 *   <div ref={ref}>
 *     <span className="text-brand-accent">{count}+</span>
 *   </div>
 * );
 */
export function useCountUp<T extends HTMLElement = HTMLDivElement>(
  end: number,
  options: UseCountUpOptions = {}
) {
  const { duration = 2000, startOnView = true } = options;
  const [count, setCount] = useState(0);
  const ref = useRef<T>(null);
  const [isVisible, setIsVisible] = useState(!startOnView);
  const [hasStarted, setHasStarted] = useState(false);

  // Intersection Observer for start on view
  useEffect(() => {
    if (!startOnView) return;

    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [startOnView]);

  useEffect(() => {
    // Don't start if we're waiting for visibility
    if (startOnView && !isVisible) return;

    // Don't restart if already completed
    if (hasStarted) return;

    setHasStarted(true);

    let startTime: number | null = null;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);

      // Easing function (easeOutQuart)
      const easeOut = 1 - Math.pow(1 - progress, 4);
      setCount(Math.ceil(easeOut * end));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [end, duration, isVisible, startOnView, hasStarted]);

  return { ref, count };
}
