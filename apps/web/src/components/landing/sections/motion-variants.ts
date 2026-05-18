/**
 * Landing page scroll-reveal system.
 *
 * Uses plain HTML elements + direct DOM style manipulation + IntersectionObserver.
 * Zero hydration mismatch: server renders visible content, JS hides below-fold
 * elements via el.style (in useLayoutEffect, before paint) and reveals on scroll.
 *
 * Key insight: useLayoutEffect sets opacity/transform WITHOUT transition property
 * (instant hide), then IntersectionObserver adds transition + final values
 * (smooth reveal). No React state changes, no className batching issues.
 */

import type { HTMLMotionProps } from 'motion/react';
import { createElement, useEffect, useLayoutEffect, useRef } from 'react';

// Use useLayoutEffect on client (runs before paint), useEffect on server (noop)
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

// =============================================================================
// SSR-SAFE ELEMENT WRAPPERS (direct DOM styles, no React state)
// =============================================================================

function createSSRMotion<Tag extends 'div' | 'span' | 'p' | 'blockquote'>(tag: Tag) {
  function SSRSafe(props: HTMLMotionProps<Tag>) {
    // Extract stagger delay from motion transition prop
    const transitionObj = props.transition;
    let delay = 0;
    if (typeof transitionObj === 'object' && transitionObj !== null && 'delay' in transitionObj) {
      const rawDelay = transitionObj.delay;
      delay = typeof rawDelay === 'number' ? rawDelay : 0;
    }

    const ref = useRef<HTMLElement>(null);

    useIsomorphicLayoutEffect(() => {
      const el = ref.current;
      if (!el) {
        return;
      }

      const rect = el.getBoundingClientRect();
      const aboveFold = rect.top < window.innerHeight && rect.bottom > 0;

      if (aboveFold) {
        // Above fold — content already visible from SSR, skip to prevent flash
        return;
      }

      // Below fold — hide before paint, reveal on scroll
      el.style.opacity = '0';
      el.style.transform = 'translateY(16px)';

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) {
            const d = delay > 0 ? ` ${delay}s` : '';
            el.style.transition = `opacity 0.5s ease-out${d}, transform 0.5s ease-out${d}`;
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
            observer.disconnect();
          }
        },
        { threshold: 0.1 },
      );
      observer.observe(el);
      return () => observer.disconnect();
    }, []);

    // Build clean HTML props (strip motion-specific ones)
    // Destructure known motion props away, pass the rest to createElement
    const {
      animate: _a,
      exit: _e,
      initial: _i,
      onAnimationComplete: _oac,
      onAnimationStart: _oas,
      onBeforeLayoutMeasure: _oblm,
      onLayoutAnimationComplete: _olac,
      onLayoutAnimationStart: _olas,
      onUpdate: _ou,
      transition: _t,
      variants: _v,
      whileHover: _wh,
      whileInView: _wiv,
      whileTap: _wt,
      ...htmlProps
    } = props;

    return createElement(tag, { ...htmlProps, ref });
  }

  SSRSafe.displayName = `SSRMotion(${tag})`;
  return SSRSafe;
}

/** SSR-safe div with scroll-reveal animation */
export const MotionDiv = createSSRMotion('div');
/** SSR-safe span with scroll-reveal animation */
export const MotionSpan = createSSRMotion('span');
/** SSR-safe p with scroll-reveal animation */
export const MotionP = createSSRMotion('p');
/** SSR-safe blockquote with scroll-reveal animation */
export const MotionBlockquote = createSSRMotion('blockquote');

// =============================================================================
// VARIANT CONSTANTS (kept for API compatibility with existing imports)
// =============================================================================

/** Subtle fade-up — 8px travel, fast */
export const subtleFade = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
} as const;

/** Quick transition — 300ms with smooth easing */
export const quickTransition = {
  duration: 0.3,
  ease: [0.25, 0.1, 0.25, 1],
} as const;

/** Stagger children container */
export const staggerContainer = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
    },
  },
} as const;

/** Cell reveal — for bento grid cells */
export const cellReveal = {
  hidden: { opacity: 0, y: 4 },
  visible: { opacity: 1, y: 0 },
} as const;

/** Dense stagger — faster stagger for compact grids */
export const denseStagger = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.04,
    },
  },
} as const;

/** Default viewport trigger */
export const VIEWPORT_ONCE = { once: true } as const;
