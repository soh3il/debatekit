/**
 * Message Component Types
 *
 * TYPE PATTERN EXCEPTION: These types use the `&` intersection pattern to extend
 * React HTML attributes, which is the standard TypeScript React pattern.
 *
 * This is an acceptable exception to the "no inline type extensions" rule because:
 * 1. These are pure compile-time types (no runtime validation needed)
 * 2. Props are validated by React's component system, not external data
 * 3. This pattern is idiomatic React TypeScript (see shadcn/ui, Radix UI)
 * 4. Zod validation for React props adds unnecessary runtime overhead
 * 5. Consistent with other UI components in this codebase (avatar.tsx, card.tsx)
 *
 * For data objects from APIs or external sources, use Zod schemas instead.
 */

import type { UIMessage } from 'ai';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import type { ComponentProps, HTMLAttributes } from 'react';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import { cn } from '@/lib/ui/cn';

/** Message container props - extends div attributes with role indicator */
export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: UIMessage['role'];
};

export function Message({ className, from: _from, ...props }: MessageProps) {
  return (
    <div
      className={cn(
        'group flex w-full items-end gap-2',
        className,
      )}
      {...props}
    />
  );
}

const messageContentVariants = cva(
  'is-user:dark w-full flex flex-col gap-2 text-sm',
  {
    defaultVariants: {
      variant: 'contained',
    },
    variants: {
      variant: {
        contained: [
          'max-w-[80%] px-4 py-3',
          'group-[.is-user]:text-foreground',
          'group-[.is-assistant]:text-foreground',
        ],
        flat: [
          'group-[.is-user]:max-w-[80%] group-[.is-user]:text-foreground',
          'group-[.is-assistant]:flex-1 group-[.is-assistant]:min-w-0 group-[.is-assistant]:w-full group-[.is-assistant]:text-foreground',
        ],
      },
    },
  },
);

/** Message content props - extends div attributes with CVA variants */
export type MessageContentProps = HTMLAttributes<HTMLDivElement>
  & VariantProps<typeof messageContentVariants>;

export function MessageContent({
  children,
  className,
  variant,
  ...props
}: MessageContentProps) {
  return (
    <div
      className={cn(messageContentVariants({ className, variant }))}
      {...props}
    >
      {children}
    </div>
  );
}

/** Message avatar props - extends Avatar component props with required src */
export type MessageAvatarProps = ComponentProps<typeof Avatar> & {
  src: string;
  name?: string;
};

export function MessageAvatar({
  className,
  name,
  src,
  ...props
}: MessageAvatarProps) {
  return (
    <Avatar className={cn('size-8', className)} {...props}>
      <AvatarImage alt={name ? `${name} avatar` : 'User avatar'} className="mt-0 mb-0" src={src} />
      <AvatarFallback>{name?.slice(0, 2) || 'ME'}</AvatarFallback>
    </Avatar>
  );
}
