import { MotionDiv, quickTransition, subtleFade, VIEWPORT_ONCE } from './motion-variants';

type SectionHeaderProps = {
  description?: string | string[];
  heading: string;
  headingHighlight?: string;
  headingSuffix?: string;
  label?: string;
};

/**
 * Premium minimal section header.
 *
 * Left-aligned. Sans-serif label with uppercase tracking,
 * bold heading with green-400 highlight span, and gray-400 description.
 * Description accepts a string or array of paragraphs.
 */
export function SectionHeader({
  description,
  heading,
  headingHighlight,
  headingSuffix,
  label,
}: SectionHeaderProps) {
  const paragraphs = description
    ? Array.isArray(description)
      ? description
      : [description]
    : [];

  return (
    <MotionDiv
      className="text-left mb-8 sm:mb-10"
      initial={subtleFade.hidden}
      transition={quickTransition}
      viewport={VIEWPORT_ONCE}
      whileInView={subtleFade.visible}
    >
      {label && (
        <div className="font-medium text-xs uppercase tracking-[0.15em] text-gray-500 mb-6">
          {label}
        </div>
      )}
      <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-[-0.03em] leading-[1.1] mb-4 sm:mb-5 text-white">
        {heading}
        {headingHighlight && (
          <>
            {' '}
            <span className="text-green-400">{headingHighlight}</span>
          </>
        )}
        {headingSuffix && <>{headingSuffix}</>}
      </h2>
      {paragraphs.map((p, i) => (
        <p key={i} className="text-base sm:text-lg text-gray-400 max-w-2xl leading-relaxed mt-2 sm:mt-3 first:mt-0">
          {p}
        </p>
      ))}
    </MotionDiv>
  );
}
