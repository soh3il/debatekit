import { useInView, useMotionValue, useSpring } from 'motion/react';
import type { ComponentProps } from 'react';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { cn } from '@/lib/ui/cn';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

type NumberTickerProps = {
  value: number;
  startValue?: number;
  direction?: 'up' | 'down';
  delay?: number;
  decimalPlaces?: number;
} & ComponentProps<'span'>;

export function NumberTicker({
  value,
  startValue = 0,
  direction = 'up',
  delay = 0,
  className,
  decimalPlaces = 0,
  ...props
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null);
  // Start at final value to prevent flash. Reset to startValue only for below-fold elements.
  const [initialValue] = useState(() => value);
  const motionValue = useMotionValue(initialValue);
  const springValue = useSpring(motionValue, {
    damping: 60,
    stiffness: 100,
  });
  const isInView = useInView(ref, { once: true, margin: '0px' });
  const hasTriggered = useRef(false);

  // After hydration, check if element is below fold and reset for animation
  useIsomorphicLayoutEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }

    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      // Above fold — keep showing final value, no animation
      return;
    }

    // Below fold — reset to start value for count-up animation
    motionValue.jump(direction === 'down' ? value : startValue);
  }, []);

  useEffect(() => {
    if (!isInView || hasTriggered.current) {
      return;
    }
    hasTriggered.current = true;

    const timer = setTimeout(() => {
      motionValue.set(direction === 'down' ? startValue : value);
    }, delay * 1000);
    return () => clearTimeout(timer);
  }, [motionValue, isInView, delay, value, direction, startValue]);

  useEffect(
    () =>
      springValue.on('change', (latest) => {
        if (ref.current) {
          ref.current.textContent = Intl.NumberFormat('en-US', {
            minimumFractionDigits: decimalPlaces,
            maximumFractionDigits: decimalPlaces,
          }).format(Number(latest.toFixed(decimalPlaces)));
        }
      }),
    [springValue, decimalPlaces],
  );

  // Render final value in HTML (SSR-safe, no flash)
  const formatted = Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  }).format(value);

  return (
    <span
      ref={ref}
      data-slot="number-ticker"
      className={cn('inline-block tracking-wider tabular-nums', className)}
      {...props}
    >
      {formatted}
    </span>
  );
}
