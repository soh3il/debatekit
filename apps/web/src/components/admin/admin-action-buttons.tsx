import type { ReactNode } from 'react';

import { Icons } from '@/components/icons';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/ui/cn';

// ---------------------------------------------------------------------------
// Base action button (click handler)
// ---------------------------------------------------------------------------

type AdminActionButtonProps = {
  className?: string;
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  onClick?: () => void;
};

function AdminActionButton({ className, disabled, icon, label, onClick }: AdminActionButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="glass"
          size="icon"
          className={cn('size-8', className)}
          disabled={disabled}
          onClick={onClick}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

// ---------------------------------------------------------------------------
// Link action button — uses buttonVariants directly on <a> to avoid the
// double-Slot bug (TooltipTrigger asChild → Button asChild breaks class merge)
// ---------------------------------------------------------------------------

type AdminActionLinkButtonProps = {
  className?: string;
  href: string;
  icon: ReactNode;
  label: string;
  target?: string;
};

function AdminActionLinkButton({ className, href, icon, label, target = '_self' }: AdminActionLinkButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <a
          href={href}
          target={target}
          rel={target === '_blank' ? 'noopener noreferrer' : undefined}
          className={cn(buttonVariants({ size: 'icon', variant: 'glass' }), 'size-8', className)}
        >
          {icon}
        </a>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

// ---------------------------------------------------------------------------
// Action button row wrapper (provides TooltipProvider)
// ---------------------------------------------------------------------------

function AdminActionRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center justify-end gap-1.5 border-t border-white/[0.06] pt-2 mt-1', className)}>
      <TooltipProvider delayDuration={300}>
        {children}
      </TooltipProvider>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Preset: Delete button
// ---------------------------------------------------------------------------

function AdminDeleteButton({ disabled, label, onClick }: { disabled?: boolean; label?: string; onClick: () => void }) {
  const t = useTranslations();
  const resolvedLabel = label ?? t('actions.delete');
  return (
    <AdminActionButton
      className="text-destructive hover:text-destructive"
      disabled={disabled}
      icon={disabled
        ? <Icons.loader className="size-3.5 animate-spin" />
        : <Icons.trash className="size-3.5" />}
      label={resolvedLabel}
      onClick={onClick}
    />
  );
}

// ---------------------------------------------------------------------------
// Preset: View details button
// ---------------------------------------------------------------------------

function AdminDetailsButton({ label, onClick }: { label?: string; onClick: () => void }) {
  const t = useTranslations();
  const resolvedLabel = label ?? t('admin.jobs.details');
  return (
    <AdminActionButton
      icon={<Icons.info className="size-3.5" />}
      label={resolvedLabel}
      onClick={onClick}
    />
  );
}

// ---------------------------------------------------------------------------
// Preset: View thread button (native <a> to avoid asChild glass bug)
// ---------------------------------------------------------------------------

function AdminViewThreadButton({ href, label }: { href: string; label?: string }) {
  const t = useTranslations();
  const resolvedLabel = label ?? t('admin.jobs.viewThread');
  return (
    <AdminActionLinkButton
      href={href}
      icon={<Icons.messageSquare className="size-3.5" />}
      label={resolvedLabel}
    />
  );
}

// ---------------------------------------------------------------------------
// Preset: External link button
// ---------------------------------------------------------------------------

function AdminExternalLinkButton({ href, label }: { href: string; label: string }) {
  return (
    <AdminActionLinkButton
      href={href}
      icon={<Icons.externalLink className="size-3.5" />}
      label={label}
      target="_blank"
    />
  );
}

// ---------------------------------------------------------------------------
// Preset: Cancel button (destructive icon action)
// ---------------------------------------------------------------------------

function AdminCancelButton({ disabled, label, onClick }: { disabled?: boolean; label?: string; onClick: () => void }) {
  const t = useTranslations();
  const resolvedLabel = label ?? t('actions.cancel');
  return (
    <AdminActionButton
      className="shrink-0 text-destructive hover:text-destructive"
      disabled={disabled}
      icon={<Icons.xCircle className="size-3.5" />}
      label={resolvedLabel}
      onClick={onClick}
    />
  );
}

export {
  AdminActionButton,
  AdminActionLinkButton,
  AdminActionRow,
  AdminCancelButton,
  AdminDeleteButton,
  AdminDetailsButton,
  AdminExternalLinkButton,
  AdminViewThreadButton,
};
