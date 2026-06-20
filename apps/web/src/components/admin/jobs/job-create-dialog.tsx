import { FieldTypes } from '@debatekit/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import {
  Form,
  RHFSwitch,
  RHFTextarea,
  RHFTextField,
} from '@/components/forms';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCreateJobMutation } from '@/hooks/mutations';
import { useTranslations } from '@/lib/i18n';
import { toastManager } from '@/lib/toast';

type JobCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function JobCreateDialog({ onOpenChange, open }: JobCreateDialogProps) {
  const t = useTranslations();
  const createMutation = useCreateJobMutation();

  const createJobFormSchema = z.object({
    autoPublish: z.boolean(),
    initialPrompt: z.string().min(10, t('admin.jobs.validation.promptMinLength')).max(2000),
    totalRounds: z.number().int().min(1).max(5),
  });

  type CreateJobFormValues = z.infer<typeof createJobFormSchema>;

  const form = useForm<CreateJobFormValues>({
    defaultValues: {
      autoPublish: false,
      initialPrompt: '',
      totalRounds: 3,
    },
    resolver: zodResolver(createJobFormSchema),
  });

  const onSubmit = (data: CreateJobFormValues) => {
    createMutation.mutate(
      { json: data },
      {
        onSuccess: (response) => {
          if (response.success) {
            toastManager.success(t('admin.jobs.created'));
            form.reset();
            onOpenChange(false);
          }
        },
      },
    );
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
            <Icons.sparkles className="size-5" />
            {t('admin.jobs.new.title')}
          </DialogTitle>
          <DialogDescription>
            {t('admin.jobs.new.description')}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <RHFTextarea
              name="initialPrompt"
              title={t('admin.jobs.new.promptLabel')}
              description={t('admin.jobs.new.promptHint')}
              placeholder={t('admin.jobs.new.promptPlaceholder')}
              rows={4}
            />

            <RHFTextField
              name="totalRounds"
              title={t('admin.jobs.new.roundsLabel')}
              description={t('admin.jobs.new.roundsHint')}
              fieldType={FieldTypes.NUMBER}
            />

            <RHFSwitch
              name="autoPublish"
              title={t('admin.jobs.new.autoPublishLabel')}
              description={t('admin.jobs.new.autoPublishHint')}
              className="flex items-center justify-between rounded-lg border p-3"
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
                disabled={createMutation.isPending}
                loading={createMutation.isPending}
                startIcon={<Icons.sparkles />}
              >
                {t('admin.jobs.new.submit')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
