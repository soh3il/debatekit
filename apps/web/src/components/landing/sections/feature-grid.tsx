import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/ui/cn';

import type { AccentColor } from './accent-colors';
import { ACCENT_COLORS } from './accent-colors';
import { MotionDiv, quickTransition, subtleFade, VIEWPORT_ONCE } from './motion-variants';

export type FeatureItem = {
  badge?: string;
  description: string;
  icon: LucideIcon;
  title: string;
};

type FeatureGridProps = {
  accentColor: AccentColor;
  columns?: 2 | 3 | 4;
  items: readonly FeatureItem[];
};

const COLUMN_CLASSES = {
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-2 lg:grid-cols-4',
} as const;

/**
 * Reusable feature card grid with stagger animation.
 *
 * Each card shows an icon in a subtle accent-colored container,
 * title, description, and optional badge. Cards have hover effects
 * that subtly shift the border and background toward the accent color.
 */
export function FeatureGrid({
  accentColor,
  columns = 3,
  items,
}: FeatureGridProps) {
  const colors = ACCENT_COLORS[accentColor];

  return (
    <div className={cn('grid grid-cols-1 gap-5', COLUMN_CLASSES[columns])}>
      {items.map((item, i) => (
        <MotionDiv
          key={item.title}
          className={cn(
            'rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 transition-all duration-300',
            colors.cardHoverBorder,
            colors.cardHoverBg,
          )}
          initial={subtleFade.hidden}
          transition={{ ...quickTransition, delay: i * 0.1 }}
          viewport={VIEWPORT_ONCE}
          whileInView={subtleFade.visible}
        >
          <div
            className={cn(
              'flex items-center justify-center size-12 rounded-lg border mb-5',
              colors.glowBg,
              colors.badgeBorder,
            )}
          >
            <item.icon className={cn('size-6', colors.iconText)} />
          </div>
          <h3 className="text-lg font-semibold mb-3">{item.title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {item.description}
          </p>
          {item.badge && (
            <span className="inline-block mt-3 text-[10px] font-medium tracking-wider uppercase px-2.5 py-1 rounded-full bg-white/[0.04] text-muted-foreground border border-white/[0.06]">
              {item.badge}
            </span>
          )}
        </MotionDiv>
      ))}
    </div>
  );
}
