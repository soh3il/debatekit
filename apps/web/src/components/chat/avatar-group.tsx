import type { AvatarSize } from '@debatekit/shared';
import { AvatarSizeMetadata, AvatarSizes } from '@debatekit/shared';
import { memo, useMemo } from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { ModelReference, ParticipantConfig } from '@/lib/schemas';
import { cn } from '@/lib/ui/cn';
import { getProviderIcon } from '@/lib/utils';

type AvatarGroupProps = {
  participants: ParticipantConfig[];
  allModels: ModelReference[];
  maxVisible?: number;
  size?: AvatarSize;
  className?: string;
  showCount?: boolean;
  overlap?: boolean;
  showOverflow?: boolean;
  /** For critical above-fold avatars */
  priority?: boolean;
};

function AvatarGroupComponent({
  allModels,
  className,
  maxVisible = 3,
  overlap = true,
  participants,
  priority = false,
  showCount = true,
  showOverflow = false,
  size = AvatarSizes.SM,
}: AvatarGroupProps) {
  const sizeMetadata = AvatarSizeMetadata[size];
  const visibleParticipants = participants.slice(0, maxVisible);
  const totalCount = participants.length;
  const hasOverflow = totalCount > maxVisible;

  // O(1) model lookup Map - built once per allModels change
  const modelMap = useMemo(() => {
    const map = new Map<string, ModelReference>();
    for (const m of allModels) {
      map.set(m.id, m);
    }
    return map;
  }, [allModels]);

  return (
    <div className={cn('flex items-center', className)}>
      {visibleParticipants.map((participant, index) => {
        const model = modelMap.get(participant.modelId);
        if (!model) {
          return null;
        }

        const marginLeft = index === 0 ? '0px' : overlap ? `${sizeMetadata.overlapOffset}px` : `${sizeMetadata.gapSize}px`;

        return (
          <div
            key={participant.id}
            className="relative"
            style={{
              marginLeft,
              zIndex: overlap ? index + 1 : undefined,
            }}
          >
            <Avatar
              className={cn(
                sizeMetadata.container,
                'relative bg-card',
                overlap && 'border-2 border-card',
              )}
            >
              <AvatarImage
                src={getProviderIcon(model.provider)}
                alt={`${model.name} provider icon`}
                className="object-contain p-0.5 relative z-10"
                priority={priority}
              />
              <AvatarFallback className={cn(sizeMetadata.text, 'bg-card font-semibold relative z-10')}>
                {model.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
        );
      })}
      {showOverflow && hasOverflow && (
        <div
          className="relative"
          style={{
            marginLeft: overlap ? `${sizeMetadata.overlapOffset}px` : `${sizeMetadata.gapSize}px`,
            zIndex: overlap ? visibleParticipants.length + 1 : undefined,
          }}
        >
          <div
            className={cn(
              sizeMetadata.container,
              'flex items-center justify-center rounded-full bg-card text-muted-foreground',
              overlap && 'border-2 border-card',
            )}
          >
            <span className={cn(sizeMetadata.text, 'font-medium leading-none -translate-y-[2px]')}>…</span>
          </div>
        </div>
      )}
      {showCount && (
        <div
          className={cn(
            sizeMetadata.container,
            'flex items-center justify-center rounded-full bg-white text-black font-bold border-2 border-card',
            sizeMetadata.gapSize === 8 ? 'ml-2' : 'ml-3',
          )}
        >
          <span className={cn(sizeMetadata.text, 'tabular-nums')}>
            {totalCount}
          </span>
        </div>
      )}
    </div>
  );
}

export const AvatarGroup = memo(AvatarGroupComponent);
