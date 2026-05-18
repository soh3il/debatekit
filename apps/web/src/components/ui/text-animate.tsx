import type { Variants } from 'motion/react';
import type { ComponentProps } from 'react';
import {
  createElement,
  memo,
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react';

import { cn } from '@/lib/ui/cn';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

type AnimationType = 'text' | 'word' | 'character' | 'line';

type TextAnimateProps = {
  children: string;
  className?: string;
  segmentClassName?: string;
  delay?: number;
  duration?: number;
  as?: keyof HTMLElementTagNameMap;
  by?: AnimationType;
  startOnView?: boolean;
  once?: boolean;
  animation?: string;
  accessible?: boolean;
  variants?: Variants;
} & Omit<ComponentProps<'p'>, 'children'>;

function TextAnimateBase({
  children,
  className,
  segmentClassName,
  as: Component = 'p',
  by = 'word',
  accessible = true,
  delay = 0,
  // Consumed but ignored — kept for call-site compat
  duration: _duration,
  startOnView: _startOnView,
  once: _once,
  animation: _animation,
  variants: _variants,
  ...props
}: TextAnimateProps) {
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
    el.style.transform = 'translateY(8px)';

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          const d = delay > 0 ? ` ${delay}s` : '';
          el.style.transition = `opacity 0.4s ease-out${d}, transform 0.4s ease-out${d}`;
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

  let segments: string[] = [];
  switch (by) {
    case 'word':
      segments = children.split(/(\s+)/);
      break;
    case 'character':
      segments = children.split('');
      break;
    case 'line':
      segments = children.split('\n');
      break;
    case 'text':
    default:
      segments = [children];
      break;
  }

  return createElement(
    Component,
    {
      'ref': ref,
      'data-slot': 'text-animate',
      'className': cn('whitespace-pre-wrap', className),
      'aria-label': accessible ? children : undefined,
      ...props,
    },
    accessible && createElement('span', { className: 'sr-only' }, children),
    ...segments.map((segment, i) =>
      createElement(
        'span',
        {
          'key': `${by}-${segment}-${i}`,
          'className': cn(
            by === 'line' ? 'block' : 'inline-block whitespace-pre',
            segmentClassName,
          ),
          'aria-hidden': accessible ? true : undefined,
        },
        segment,
      ),
    ),
  );
}

export const TextAnimate = memo(TextAnimateBase);
TextAnimate.displayName = 'TextAnimate';
