import type { LogoSize, LogoVariant } from '@debatekit/shared';
import { LogoSizeMetadata, LogoSizes, LogoVariants } from '@debatekit/shared';

import { LazyPersona } from '@/components/ai-elements/lazy-persona';
import { cn } from '@/lib/ui/cn';

type Props = {
  size?: LogoSize;
  variant?: LogoVariant;
  className?: string;
};

function Logo(props: Props) {
  const { className, size = LogoSizes.SM, variant = LogoVariants.ICON } = props;

  const metadata = LogoSizeMetadata[size];
  const dim = variant === LogoVariants.ICON
    ? metadata.width
    : metadata.widthFull;

  return (
    <div className={cn(className)} style={{ height: dim, width: dim }}>
      <LazyPersona
        className="size-full"
        state="idle"
      />
    </div>
  );
}

export { Logo };
