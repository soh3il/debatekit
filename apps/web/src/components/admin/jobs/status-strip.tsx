import { ADMIN_SETTINGS_LIMITS, FieldTypes } from '@debatekit/shared';
import { useState } from 'react';

import { DEFAULT_STEP_COLOR, STEP_COLORS } from '@/components/admin/admin-flow';
import { PromptTextareaWithTemplates } from '@/components/admin/jobs/prompt-textarea-with-templates';
import {
  RHFSwitch,
  RHFTextField,
} from '@/components/forms';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/ui';
import type { AdminSettingsFormValues } from '@/services/api/admin/settings';

// ---------------------------------------------------------------------------
// PipelineStageChip
// ---------------------------------------------------------------------------

function PipelineStageChip({ active, detail, label, step }: {
  active: boolean;
  detail: string;
  label: string;
  step: number;
}) {
  const colors = STEP_COLORS[step] ?? DEFAULT_STEP_COLOR;
  return (
    <div className={cn(
      'flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs border transition-colors',
      active
        ? `${colors.bg} ${colors.text} ${colors.border}`
        : 'border-white/[0.06] text-muted-foreground',
    )}
    >
      <span className={cn('font-semibold', active && colors.text)}>
        {step}
        .
        {' '}
        {label}
      </span>
      {detail && (
        <span className={cn('text-[11px]', active ? 'opacity-80' : 'opacity-60')}>
          {detail}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PromptSection (collapsible group)
// ---------------------------------------------------------------------------

function PromptSection({ children, count, defaultOpen = false, title }: {
  children: React.ReactNode;
  count?: number;
  defaultOpen?: boolean;
  title: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="pt-1">
      <CollapsibleTrigger className="flex w-full items-center gap-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
        <Icons.chevronRight className={cn('size-3 transition-transform', open && 'rotate-90')} />
        {title}
        {count !== undefined && (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground/70">
            {count}
          </span>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-3 pt-2">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ---------------------------------------------------------------------------
// StatusStrip
// ---------------------------------------------------------------------------

export type StatusStripProps = {
  discoverDetail: string;
  generateActive: boolean;
  generateDetail: string;
  hasActiveRuns: boolean;
  isDirty: boolean;
  isSaving: boolean;
  isStopping: boolean;
  onRunNow: () => void;
  onStop: () => void;
  pipelineEnabled: boolean;
  publishActive: boolean;
  publishDetail: string;
  scheduleText: string;
  settings: boolean;
  settingsLoading: boolean;
};

export function StatusStrip({
  discoverDetail,
  generateActive,
  generateDetail,
  hasActiveRuns,
  isDirty,
  isSaving,
  isStopping,
  onRunNow,
  onStop,
  pipelineEnabled,
  publishActive,
  publishDetail,
  scheduleText,
  settings,
  settingsLoading,
}: StatusStripProps) {
  const t = useTranslations();
  const isRunning = hasActiveRuns || generateActive;
  return (
    <div className={cn(
      'rounded-xl border border-white/[0.08] px-4 py-3.5 space-y-3',
    )}
    >
      {/* Row 1: Pipeline stage indicators */}
      <ScrollArea orientation="horizontal" className="-mx-1 px-1">
        <div className="flex items-center gap-2 w-max">
          <PipelineStageChip
            step={1}
            label={t('admin.jobs.stages.discover')}
            detail={discoverDetail}
            active={hasActiveRuns}
          />
          <Icons.chevronRight className="size-3 text-muted-foreground/30 shrink-0" />
          <PipelineStageChip
            step={2}
            label={t('admin.jobs.stages.generate')}
            detail={generateDetail}
            active={generateActive}
          />
          <Icons.chevronRight className="size-3 text-muted-foreground/30 shrink-0" />
          <PipelineStageChip
            step={3}
            label={t('admin.jobs.stages.publish')}
            detail={publishDetail}
            active={publishActive}
          />
        </div>
      </ScrollArea>

      {/* Row 2: Status line + single action button */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {isRunning
            ? (
                <span className="relative flex size-2 shrink-0">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-primary" />
                </span>
              )
            : (
                <span className={cn(
                  'inline-flex size-2 rounded-full shrink-0',
                  pipelineEnabled ? 'bg-green-500' : 'bg-muted-foreground/40',
                )}
                />
              )}
          <span>{scheduleText}</span>
        </div>
        <div className="shrink-0">
          {hasActiveRuns
            ? (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={onStop}
                  disabled={isStopping}
                  startIcon={isStopping ? <Icons.loader className="animate-spin" /> : <Icons.square />}
                >
                  {isStopping ? t('admin.jobs.stopping') : t('admin.jobs.stopAll')}
                </Button>
              )
            : (
                <Button
                  variant="glass"
                  size="sm"
                  onClick={onRunNow}
                  disabled={settingsLoading}
                  startIcon={<Icons.play className="size-3.5" />}
                >
                  {t('admin.jobs.runNow')}
                </Button>
              )}
        </div>
      </div>

      {/* Row 3: Pipeline settings */}
      {settings && (
        <div className={cn(
          'space-y-3 pt-2 border-t border-white/[0.06]',
          hasActiveRuns && 'opacity-40 pointer-events-none',
        )}
        >
          {/* Toggles row */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
            <RHFSwitch<AdminSettingsFormValues>
              name="pipelineEnabled"
              title={t('admin.jobs.autoRunPipeline')}
              disabled={hasActiveRuns}
              className="rounded-none border-0 p-0 gap-2"
            />
            <RHFSwitch<AdminSettingsFormValues>
              name="autoTweetEnabled"
              title={t('admin.jobs.autoPostToX')}
              disabled={hasActiveRuns}
              className="rounded-none border-0 p-0 gap-2"
            />
          </div>

          {/* Number inputs row */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <RHFTextField<AdminSettingsFormValues>
              name="dailyJobLimit"
              title={t('admin.settings.dailyJobLimit')}
              description={t('admin.settings.dailyJobLimitHint')}
              disabled={hasActiveRuns}
              fieldType={FieldTypes.NUMBER}
              inputClassName="h-9"
            />
            <RHFTextField<AdminSettingsFormValues>
              name="dailyTweetLimit"
              title={t('admin.settings.dailyTweetLimit')}
              description={t('admin.settings.dailyTweetLimitHint')}
              disabled={hasActiveRuns}
              fieldType={FieldTypes.NUMBER}
              inputClassName="h-9"
            />
            <RHFTextField<AdminSettingsFormValues>
              name="viralScoreThreshold"
              title={t('admin.settings.viralScoreThreshold')}
              description={t('admin.settings.viralScoreThresholdHint')}
              disabled={hasActiveRuns}
              fieldType={FieldTypes.NUMBER}
              inputClassName="h-9"
            />
            <RHFTextField<AdminSettingsFormValues>
              name="defaultRoundCount"
              title={t('admin.settings.defaultRoundCount')}
              description={t('admin.settings.defaultRoundCountHint')}
              disabled={hasActiveRuns}
              fieldType={FieldTypes.NUMBER}
              inputClassName="h-9"
            />
          </div>

          {/* Prompt sections */}
          <PromptSection title={t('admin.settings.promptSectionDiscovery')} count={5} defaultOpen>
            <PromptTextareaWithTemplates<AdminSettingsFormValues>
              name="systemPrompt"
              title={t('admin.settings.systemPrompt')}
              description={t('admin.settings.systemPromptHint')}
              placeholder={t('admin.settings.systemPromptPlaceholder')}
              disabled={hasActiveRuns}
              maxLength={ADMIN_SETTINGS_LIMITS.SYSTEM_PROMPT_MAX}
              rows={10}
              target="systemPrompt"
            />
            <PromptTextareaWithTemplates<AdminSettingsFormValues>
              name="topicGuidance"
              title={t('admin.settings.topicGuidance')}
              description={t('admin.settings.topicGuidanceHint')}
              placeholder={t('admin.settings.topicGuidancePlaceholder')}
              disabled={hasActiveRuns}
              maxLength={ADMIN_SETTINGS_LIMITS.TOPIC_GUIDANCE_MAX}
              rows={10}
              target="topicGuidance"
            />
            <PromptTextareaWithTemplates<AdminSettingsFormValues>
              name="keywordGenerationPrompt"
              title={t('admin.settings.keywordGenerationPrompt')}
              description={t('admin.settings.keywordGenerationPromptHint')}
              placeholder={t('admin.settings.keywordGenerationPromptPlaceholder')}
              disabled={hasActiveRuns}
              maxLength={ADMIN_SETTINGS_LIMITS.PIPELINE_PROMPT_MAX}
              rows={10}
            />
            <PromptTextareaWithTemplates<AdminSettingsFormValues>
              name="trendExtractionPrompt"
              title={t('admin.settings.trendExtractionPrompt')}
              description={t('admin.settings.trendExtractionPromptHint')}
              placeholder={t('admin.settings.trendExtractionPromptPlaceholder')}
              disabled={hasActiveRuns}
              maxLength={ADMIN_SETTINGS_LIMITS.PIPELINE_PROMPT_MAX}
              rows={10}
            />
            <PromptTextareaWithTemplates<AdminSettingsFormValues>
              name="viralScoringPrompt"
              title={t('admin.settings.viralScoringPrompt')}
              description={t('admin.settings.viralScoringPromptHint')}
              placeholder={t('admin.settings.viralScoringPromptPlaceholder')}
              disabled={hasActiveRuns}
              maxLength={ADMIN_SETTINGS_LIMITS.PIPELINE_PROMPT_MAX}
              rows={10}
            />
          </PromptSection>

          <PromptSection title={t('admin.settings.promptSectionGeneration')} count={3}>
            <PromptTextareaWithTemplates<AdminSettingsFormValues>
              name="roundPromptGeneration"
              title={t('admin.settings.roundPromptGeneration')}
              description={t('admin.settings.roundPromptGenerationHint')}
              placeholder={t('admin.settings.roundPromptGenerationPlaceholder')}
              disabled={hasActiveRuns}
              maxLength={ADMIN_SETTINGS_LIMITS.PIPELINE_PROMPT_MAX}
              rows={10}
            />
            <PromptTextareaWithTemplates<AdminSettingsFormValues>
              name="modelSelectionPrompt"
              title={t('admin.settings.modelSelectionPrompt')}
              description={t('admin.settings.modelSelectionPromptHint')}
              placeholder={t('admin.settings.modelSelectionPromptPlaceholder')}
              disabled={hasActiveRuns}
              maxLength={ADMIN_SETTINGS_LIMITS.PIPELINE_PROMPT_MAX}
              rows={10}
            />
            <PromptTextareaWithTemplates<AdminSettingsFormValues>
              name="participantBehaviorPrompt"
              title={t('admin.settings.participantBehaviorPrompt')}
              description={t('admin.settings.participantBehaviorPromptHint')}
              placeholder={t('admin.settings.participantBehaviorPromptPlaceholder')}
              disabled={hasActiveRuns}
              maxLength={ADMIN_SETTINGS_LIMITS.PIPELINE_PROMPT_MAX}
              rows={10}
            />
          </PromptSection>

          <PromptSection title={t('admin.settings.promptSectionTweet')} count={2}>
            <PromptTextareaWithTemplates<AdminSettingsFormValues>
              name="tweetSystemPrompt"
              title={t('admin.settings.tweetSystemPrompt')}
              description={t('admin.settings.tweetSystemPromptHint')}
              placeholder={t('admin.settings.tweetSystemPromptPlaceholder')}
              disabled={hasActiveRuns}
              maxLength={ADMIN_SETTINGS_LIMITS.TWEET_SYSTEM_PROMPT_MAX}
              rows={10}
              target="tweetSystemPrompt"
            />
            <PromptTextareaWithTemplates<AdminSettingsFormValues>
              name="tweetSkillsPrompt"
              title={t('admin.settings.tweetSkillsPrompt')}
              description={t('admin.settings.tweetSkillsPromptHint')}
              placeholder={t('admin.settings.tweetSkillsPromptPlaceholder')}
              disabled={hasActiveRuns}
              maxLength={ADMIN_SETTINGS_LIMITS.TWEET_SKILLS_PROMPT_MAX}
              rows={10}
            />
          </PromptSection>

          {hasActiveRuns && (
            <p className="text-[11px] text-muted-foreground/60 flex items-center gap-1">
              <Icons.lock className="size-3" />
              {t('admin.jobs.settingsLockedWhileRunning')}
            </p>
          )}

          <div className="flex justify-end pt-1">
            <Button
              type="submit"
              variant="glass"
              size="sm"
              disabled={!isDirty || isSaving || hasActiveRuns}
              startIcon={isSaving ? <Icons.loader className="animate-spin" /> : <Icons.check />}
            >
              {isSaving ? t('admin.jobs.saving') : t('admin.jobs.saveSettings')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
