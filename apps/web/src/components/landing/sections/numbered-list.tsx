import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/ui/cn';

import type { AccentColor } from './accent-colors';
import { ACCENT_COLORS } from './accent-colors';
import { MotionDiv, quickTransition, subtleFade, VIEWPORT_ONCE } from './motion-variants';

export type NumberedItem = {
  description: string;
  icon: LucideIcon;
  number: string;
  title: string;
};

type NumberedListProps = {
  accentColor: AccentColor;
  items: NumberedItem[];
};

/**
 * Oversized-number list with icon and text to the right.
 *
 * Each item shows a large gradient number on the left, an icon + title
 * row, and description text. Used for "Why X Doesn't Work" and
 * "Strategic Advantages" sections.
 */
export function NumberedList({ accentColor, items }: NumberedListProps) {
  const colors = ACCENT_COLORS[accentColor];

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      {items.map((item, i) => (
        <MotionDiv
          key={item.number}
          className="flex items-start gap-6 sm:gap-8"
          initial={subtleFade.hidden}
          transition={{ ...quickTransition, delay: i * 0.1 }}
          viewport={VIEWPORT_ONCE}
          whileInView={subtleFade.visible}
        >
          <span
            className={cn(
              'text-5xl sm:text-6xl font-bold leading-none bg-gradient-to-b bg-clip-text text-transparent shrink-0 select-none font-mono',
              colors.numberFadeFrom,
              colors.numberFadeTo,
            )}
          >
            {item.number}
          </span>
          <div className="pt-1">
            <div className="flex items-center gap-2.5 mb-2">
              <item.icon className={cn('size-5', colors.iconTextMuted)} />
              <h3 className="text-lg font-semibold">{item.title}</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {item.description}
            </p>
          </div>
        </MotionDiv>
      ))}
    </div>
  );
}
