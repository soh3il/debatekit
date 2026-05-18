import { cellReveal, denseStagger, MotionDiv, quickTransition, VIEWPORT_ONCE } from './motion-variants';

type AnimatedCardGridProps<T> = {
  className?: string;
  items: readonly T[];
  keyExtractor: (item: T) => string;
  renderItem: (item: T, index: number) => React.ReactNode;
};

/**
 * Reusable animated grid with staggered cell reveal.
 * Wraps children in `denseStagger` container + `cellReveal` per item.
 *
 * Used for research stats, trust pillars, research papers, etc.
 */
export function AnimatedCardGrid<T>({
  className = 'grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4',
  items,
  keyExtractor,
  renderItem,
}: AnimatedCardGridProps<T>) {
  return (
    <MotionDiv
      className={className}
      initial={denseStagger.hidden}
      whileInView={denseStagger.visible}
      viewport={VIEWPORT_ONCE}
    >
      {items.map((item, i) => (
        <MotionDiv
          key={keyExtractor(item)}
          initial={cellReveal.hidden}
          whileInView={cellReveal.visible}
          viewport={VIEWPORT_ONCE}
          transition={{ ...quickTransition, delay: i * 0.04 }}
        >
          {renderItem(item, i)}
        </MotionDiv>
      ))}
    </MotionDiv>
  );
}
