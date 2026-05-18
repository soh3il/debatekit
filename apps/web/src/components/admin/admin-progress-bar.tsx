/**
 * Admin Progress Bar
 *
 * Displays round progress with label and percentage.
 * Uses shadcn Progress component internally.
 * Used for automated jobs and potentially pipeline stages.
 */

import { Progress } from '@/components/ui/progress';
import { useTranslations } from '@/lib/i18n';

type AdminProgressBarProps = {
  current: number;
  label?: string;
  total: number;
};

function AdminProgressBar({ current, label, total }: AdminProgressBarProps) {
  const t = useTranslations();
  const progress = total > 0 ? (current / total) * 100 : 0;
  const percent = Math.round(progress);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label ?? t('admin.jobs.roundFallback', { current, total })}</span>
        <span>
          {percent}
          %
        </span>
      </div>
      <Progress
        value={progress}
        className="h-1.5"
        indicatorClassName="transition-all duration-500"
      />
    </div>
  );
}

export { AdminProgressBar };
