/**
 * Pipeline Review Dialog
 *
 * Allows an admin to review discovered topics for a pipeline run
 * in `awaiting_review` status. Topics can be selected, edited,
 * and submitted to create automated debates.
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { FormControl, FormField, FormItem, FormMessage } from '@/components/forms';
import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { useAdminPipelineRunDetailQuery } from '@/hooks/queries';
import { invalidationPatterns } from '@/lib/data/cache';
import { useTranslations } from '@/lib/i18n';
import { toastManager } from '@/lib/toast';
import { cn } from '@/lib/ui';
import type { PipelineRun } from '@/services/api/admin/pipeline';
import { submitPipelineReviewService } from '@/services/api/admin/pipeline';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const ReviewTopicSchema = z.object({
  platform: z.string(),
  prompt: z.string().min(10, 'Prompt must be at least 10 characters'),
  reasoning: z.string(),
  relevanceScore: z.number(),
  selected: z.boolean(),
  suggestedRounds: z.number().int().min(1).max(10),
  topic: z.string(),
});

const ReviewFormSchema = z.object({
  topics: z.array(ReviewTopicSchema),
});

type ReviewFormValues = z.infer<typeof ReviewFormSchema>;

// ---------------------------------------------------------------------------
// Platform helpers (reused from trend-suggestion-card)
// ---------------------------------------------------------------------------

const PLATFORM_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  instagram: Icons.instagram,
  reddit: Icons.reddit,
  twitter: Icons.twitter,
};

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'bg-pink-500/10 text-pink-600',
  reddit: 'bg-orange-500/10 text-orange-600',
  twitter: 'bg-blue-400/10 text-blue-500',
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type PipelineReviewDialogProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  run: PipelineRun | null;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PipelineReviewDialog({ onOpenChange, open, run }: PipelineReviewDialogProps) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch full detail (includes discoveredTopics) when dialog is open
  const { data: detailData, isPending: isLoadingDetail } = useAdminPipelineRunDetailQuery(
    open && run ? run.id : null,
  );

  const detail = detailData && 'success' in detailData && detailData.success ? detailData.data : null;
  const discoveredTopics = detail?.discoveredTopics ?? [];

  const form = useForm<ReviewFormValues>({
    resolver: zodResolver(ReviewFormSchema),
    values: {
      topics: discoveredTopics.map(topic => ({
        platform: topic.platform ?? 'custom',
        prompt: topic.prompt ?? '',
        reasoning: topic.reasoning ?? '',
        relevanceScore: topic.relevanceScore ?? 0,
        selected: true,
        suggestedRounds: topic.suggestedRounds ?? 3,
        topic: topic.topic ?? '',
      })),
    },
  });

  const topics = form.watch('topics');
  const selectedCount = topics?.filter(t => t.selected).length ?? 0;

  const handleSubmit = async (values: ReviewFormValues) => {
    if (!run) {
      return;
    }

    const selectedTopics = values.topics.filter(t => t.selected);
    if (selectedTopics.length === 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await submitPipelineReviewService(
        run.id,
        selectedTopics.map(t => ({
          platform: t.platform,
          prompt: t.prompt,
          reasoning: t.reasoning,
          relevanceScore: t.relevanceScore,
          suggestedRounds: t.suggestedRounds,
          topic: t.topic,
        })),
      );

      if (response && 'success' in response && response.success) {
        toastManager.success(t('admin.pipeline.reviewSuccess', { count: selectedTopics.length }));
        // Invalidate pipeline and jobs queries
        for (const key of invalidationPatterns.adminPipeline) {
          queryClient.invalidateQueries({ queryKey: key });
        }
        for (const key of invalidationPatterns.adminJobs) {
          queryClient.invalidateQueries({ queryKey: key });
        }
        onOpenChange(false);
      } else {
        toastManager.error(t('admin.pipeline.reviewError'));
      }
    } catch {
      toastManager.error(t('admin.pipeline.reviewError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icons.search className="size-5" />
            {t('admin.pipeline.reviewTopics')}
          </DialogTitle>
          <DialogDescription>
            {t('admin.pipeline.reviewDescription')}
          </DialogDescription>
        </DialogHeader>

        {/* Loading state */}
        {isLoadingDetail && (
          <div className="flex items-center justify-center py-12">
            <Icons.loader className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Empty state */}
        {!isLoadingDetail && discoveredTopics.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {t('admin.pipeline.noTopicsFound')}
          </div>
        )}

        {/* Form */}
        {!isLoadingDetail && discoveredTopics.length > 0 && (
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col flex-1 min-h-0">
            <ScrollArea className="flex-1 -mx-6 px-6" style={{ maxHeight: 'calc(85vh - 220px)' }}>
              <div className="space-y-3 py-2">
                {topics?.map((topic, index) => {
                  const PlatformIcon = PLATFORM_ICONS[topic.platform] ?? Icons.globe;
                  const platformColor = PLATFORM_COLORS[topic.platform] ?? 'bg-muted text-muted-foreground';
                  const relevanceColor = topic.relevanceScore >= 80
                    ? 'text-emerald-500'
                    : topic.relevanceScore >= 50
                      ? 'text-amber-500'
                      : 'text-muted-foreground';

                  return (
                    <div
                      key={`topic-${index}`}
                      className={cn(
                        'rounded-lg border p-4 space-y-3 transition-colors',
                        topic.selected
                          ? 'border-primary/30 bg-primary/5'
                          : 'border-border opacity-50',
                      )}
                    >
                      {/* Header: checkbox + topic title + platform + score */}
                      <div className="flex items-start gap-3">
                        <FormField
                          control={form.control}
                          name={`topics.${index}.selected`}
                          render={({ field }) => (
                            <FormItem className="pt-0.5">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  disabled={isSubmitting}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="secondary" className={cn(platformColor, 'capitalize text-[10px]')}>
                              <PlatformIcon className="size-3 mr-1" />
                              {topic.platform === 'twitter' ? 'X' : topic.platform}
                            </Badge>
                            <span className={cn('text-xs font-medium tabular-nums', relevanceColor)}>
                              {topic.relevanceScore}
                              %
                            </span>
                          </div>
                          <p className="font-medium text-sm">{topic.topic}</p>
                        </div>
                      </div>

                      {/* Editable prompt + rounds (only when selected) */}
                      {topic.selected && (
                        <>
                          <FormField
                            control={form.control}
                            name={`topics.${index}.prompt`}
                            render={({ field }) => (
                              <FormItem>
                                <Label className="text-xs text-muted-foreground">
                                  {t('admin.pipeline.reviewPrompt')}
                                </Label>
                                <FormControl>
                                  <Textarea
                                    {...field}
                                    className="min-h-16 resize-none text-sm"
                                    disabled={isSubmitting}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`topics.${index}.suggestedRounds`}
                            render={({ field }) => (
                              <FormItem className="flex items-center gap-3">
                                <Label className="text-xs text-muted-foreground whitespace-nowrap">
                                  {t('admin.pipeline.reviewRounds')}
                                </Label>
                                <FormControl>
                                  <Input
                                    type="number"
                                    min={1}
                                    max={10}
                                    value={field.value}
                                    onChange={(e) => {
                                      const val = Math.min(10, Math.max(1, Number.parseInt(e.target.value, 10) || 1));
                                      field.onChange(val);
                                    }}
                                    className="w-16 h-8 text-sm"
                                    disabled={isSubmitting}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            {/* Footer: selected count + submit */}
            <div className="flex items-center justify-between gap-3 pt-4 border-t border-white/[0.06] mt-4">
              <span className="text-xs text-muted-foreground">
                {t('admin.pipeline.reviewSelected', { count: selectedCount })}
              </span>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                >
                  {t('actions.cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || selectedCount === 0}
                  loading={isSubmitting}
                  startIcon={<Icons.sparkles />}
                >
                  {isSubmitting
                    ? t('admin.pipeline.reviewSubmitting')
                    : t('admin.pipeline.reviewSubmit', { count: selectedCount })}
                </Button>
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
