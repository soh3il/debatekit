import { FieldTypes } from '@debatekit/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Form, RHFTextarea, RHFTextField } from '@/components/forms';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useUpdateAdminSettingsMutation } from '@/hooks/mutations';
import { useTriggerPipelineMutation } from '@/hooks/mutations/admin-pipeline-mutations';
import { useTranslations } from '@/lib/i18n';
import { toastManager } from '@/lib/toast';

// ---------------------------------------------------------------------------
// Form schema
// ---------------------------------------------------------------------------

const pipelineRunFormSchema = z.object({
  customTopics: z.string().optional(),
  maxTopics: z.number().int().min(1).max(20),
});

type PipelineRunFormValues = z.infer<typeof pipelineRunFormSchema>;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type PipelineRunDialogProps = {
  enableAutomation?: boolean;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PipelineRunDialog({ enableAutomation, onOpenChange, open }: PipelineRunDialogProps) {
  const t = useTranslations();
  const triggerMutation = useTriggerPipelineMutation();
  const settingsMutation = useUpdateAdminSettingsMutation();

  const form = useForm<PipelineRunFormValues>({
    defaultValues: {
      customTopics: '',
      maxTopics: 5,
    },
    resolver: zodResolver(pipelineRunFormSchema),
  });

  const onSubmit = (data: PipelineRunFormValues) => {
    const customTopics = data.customTopics
      ?.split('\n')
      .map(topic => topic.trim())
      .filter(topic => topic.length >= 2)
      ?? [];

    const triggerParams = {
      ...(customTopics.length > 0 ? { customTopics } : {}),
      maxTopics: data.maxTopics,
    };

    if (enableAutomation) {
      settingsMutation.mutate(
        { json: { continuous: true, pipelineEnabled: true } },
        {
          onError: () => {
            toastManager.error(t('admin.pipeline.enableAutomationError'));
          },
          onSuccess: () => {
            triggerMutation.mutate(triggerParams, {
              onError: () => {
                toastManager.error(t('admin.pipeline.triggerError'));
              },
              onSuccess: () => {
                toastManager.success(t('admin.pipeline.automationStarted'));
                form.reset();
                onOpenChange(false);
              },
            });
          },
        },
      );
    } else {
      triggerMutation.mutate(triggerParams, {
        onError: () => {
          toastManager.error(t('admin.settings.settingsError'));
        },
        onSuccess: () => {
          toastManager.success(t('admin.settings.pipelineTriggered'));
          form.reset();
          onOpenChange(false);
        },
      });
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      form.reset();
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icons.play className="size-5" />
            {enableAutomation
              ? t('admin.pipeline.startAutomation')
              : t('admin.pipeline.runPipeline')}
          </DialogTitle>
          <DialogDescription>
            {enableAutomation
              ? t('admin.pipeline.startAutomationDescription')
              : t('admin.pipeline.runPipelineDescription')}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <RHFTextField<PipelineRunFormValues>
              name="maxTopics"
              title={t('admin.pipeline.maxTopics')}
              description={t('admin.pipeline.maxTopicsHint')}
              fieldType={FieldTypes.NUMBER}
            />

            <RHFTextarea<PipelineRunFormValues>
              name="customTopics"
              title={t('admin.pipeline.customTopics')}
              placeholder={t('admin.pipeline.customTopicsPlaceholder')}
              description={t('admin.pipeline.customTopicsHint')}
              rows={4}
            />

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                {t('actions.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={triggerMutation.isPending || settingsMutation.isPending}
                loading={triggerMutation.isPending || settingsMutation.isPending}
                startIcon={<Icons.play />}
              >
                {enableAutomation
                  ? t('admin.pipeline.startAutomation')
                  : t('admin.pipeline.runPipeline')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
