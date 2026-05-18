import {
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

type BlurFadeProps = {
  children: React.ReactNode;
  className?: string;
  /** @deprecated Kept for API compat -- no longer used */
  variant?: { hidden?: { opacity?: number; y?: number; filter?: string }; visible?: { opacity?: number; y?: number; filter?: string } };
  duration?: number;
  delay?: number;
  offset?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  inView?: boolean;
  inViewMargin?: string;
  blur?: string;
};

export function BlurFade({
  children,
  className,
  delay = 0,
  // Kept for API compat
  inView: _inView,
  variant: _variant,
  duration: _duration,
  offset: _offset,
  direction: _direction,
  inViewMargin: _inViewMargin,
  blur: _blur,
}: BlurFadeProps) {
  const ref = useRef<HTMLDivElement>(null);

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
    el.style.transform = 'translateY(6px)';
    el.style.filter = 'blur(4px)';

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          const d = delay > 0 ? ` ${delay}s` : '';
          el.style.transition = `opacity 0.5s ease-out${d}, transform 0.5s ease-out${d}, filter 0.5s ease-out${d}`;
          el.style.opacity = '1';
          el.style.transform = 'translateY(0)';
          el.style.filter = 'none';
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} data-slot="blur-fade" className={className}>
      {children}
    </div>
  );
}
