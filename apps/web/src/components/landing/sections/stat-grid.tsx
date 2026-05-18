import { cn } from '@/lib/ui/cn';

import type { AccentColor } from './accent-colors';
import { ACCENT_COLORS } from './accent-colors';
import { MotionDiv, quickTransition, subtleFade, VIEWPORT_ONCE } from './motion-variants';

export type StatItem = {
  label: string;
  source: string;
  value: string;
};

type StatGridProps = {
  accentColor: AccentColor;
  items: StatItem[];
};

/**
 * 3-column market stats grid with oversized gradient numbers.
 *
 * Each stat shows a large accent-colored gradient value, descriptive
 * label text, and an italic muted source citation.
 */
export function StatGrid({ accentColor, items }: StatGridProps) {
  const colors = ACCENT_COLORS[accentColor];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 md:gap-12">
      {items.map((item, i) => (
        <MotionDiv
          key={item.value}
          className="text-center"
          initial={subtleFade.hidden}
          transition={{ ...quickTransition, delay: i * 0.1 }}
          viewport={VIEWPORT_ONCE}
          whileInView={subtleFade.visible}
        >
          <p
            className={cn(
              'text-4xl sm:text-5xl lg:text-6xl font-bold mb-3 bg-gradient-to-b bg-clip-text text-transparent leading-none tracking-tight whitespace-nowrap',
              colors.gradientFrom,
              colors.gradientTo,
            )}
          >
            {item.value}
          </p>
          <p className="text-sm text-muted-foreground mb-1.5">{item.label}</p>
          <p className="text-xs italic text-muted-foreground/50">
            {item.source}
          </p>
        </MotionDiv>
      ))}
    </div>
  );
}
