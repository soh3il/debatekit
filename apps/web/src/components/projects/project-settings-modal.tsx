'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ComponentVariants, ConfirmationDialogVariants, DEFAULT_PROJECT_COLOR, DEFAULT_PROJECT_ICON, getFileTypeColorClass, UploadStatuses } from '@debatekit/shared';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

import { ChatInputDropzoneOverlay, FileTypeIcon } from '@/components/chat/chat-input-attachments';
import { ConfirmationDialog } from '@/components/chat/confirmation-dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/forms';
import { Icons } from '@/components/icons';
import { AttachmentDeleteDialog } from '@/components/projects/attachment-delete-dialog';
import { MemoryEntryCard } from '@/components/projects/memory-entry-card';
import { ProjectIconBadge, ProjectIconColorPicker } from '@/components/projects/project-icon-color-picker';
import { ProjectPendingFileItem } from '@/components/projects/project-pending-file-item';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { SmartImage } from '@/components/ui/smart-image';
import { Textarea } from '@/components/ui/textarea';
import { useAddAttachmentToProjectMutation, useDeleteProjectMemoryMutation, useRestoreMemoryMutation, useUpdateProjectMutation } from '@/hooks/mutations';
import { useDownloadUrlQuery, useProjectAttachmentsQuery } from '@/hooks/queries';
import { useChatAttachments, useDragDrop } from '@/hooks/utils';
import { projectMemoryQueryOptions } from '@/lib/data/keys/projects';
import { formatFileSize } from '@/lib/format';
import { useTranslations } from '@/lib/i18n';
import { toastManager } from '@/lib/toast';
import { cn } from '@/lib/ui/cn';
import { isAttachmentFromThread } from '@/lib/utils';
import { parseMemoryEntries, removeMemoryEntry } from '@/lib/utils/memory-parser';
import type { GetProjectResponse, ListProjectAttachmentsResponse } from '@/services/api';

import type { ProjectFormValues } from './project-form-constants';
import { getProjectFormDefaults, ProjectFormSchema } from './project-form-constants';

type ProjectSettingsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: NonNullable<GetProjectResponse['data']>;
  onDelete: () => void;
};

export function ProjectSettingsModal({
  onDelete,
  onOpenChange,
  open,
  project,
}: ProjectSettingsModalProps) {
  const t = useTranslations();
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachmentToDelete, setAttachmentToDelete] = useState<{ id: string; filename: string } | null>(null);
  const [memoryEntryToDelete, setMemoryEntryToDelete] = useState<number | null>(null);

  const updateMutation = useUpdateProjectMutation();
  const addToProjectMutation = useAddAttachmentToProjectMutation();

  // Attachments
  const { data: attachmentsData, isFetching: isAttachmentsFetching } = useProjectAttachmentsQuery(project.id);

  const attachments = useMemo(() => {
    if (!attachmentsData?.pages) {
      return [];
    }
    return attachmentsData.pages.flatMap(page =>
      page.success && page.data?.items ? page.data.items : [],
    );
  }, [attachmentsData]);

  // Memory
  const { data: memoryData, isLoading: isMemoryLoading } = useQuery(projectMemoryQueryOptions(project.id));
  const memoryContent = memoryData?.success ? memoryData.data?.content : null;

  const deleteMemoryMutation = useDeleteProjectMemoryMutation(project.id);

  const restoreMemoryMutation = useRestoreMemoryMutation(project.id);
  const isMemoryDeleting = deleteMemoryMutation.isPending || restoreMemoryMutation.isPending;

  const memoryEntries = useMemo(
    () => memoryContent ? parseMemoryEntries(memoryContent) : [],
    [memoryContent],
  );

  const handleConfirmDeleteEntry = useCallback(() => {
    if (memoryEntryToDelete === null || !memoryContent) {
      return;
    }
    const updated = removeMemoryEntry(memoryContent, memoryEntryToDelete);
    if (updated === null) {
      deleteMemoryMutation.mutate(undefined, {
        onError: () => {
          toastManager.error(t('projects.memoryRemoveError'));
        },
        onSettled: () => setMemoryEntryToDelete(null),
        onSuccess: () => {
          toastManager.success(t('projects.memoryRemoved'));
        },
      });
    } else {
      restoreMemoryMutation.mutate(updated, {
        onError: () => {
          toastManager.error(t('projects.memoryRemoveError'));
        },
        onSettled: () => setMemoryEntryToDelete(null),
        onSuccess: () => {
          toastManager.success(t('projects.memoryRemoved'));
        },
      });
    }
  }, [memoryEntryToDelete, memoryContent, deleteMemoryMutation, restoreMemoryMutation, t]);

  const {
    addFiles,
    attachments: pendingAttachments,
    cancelUpload,
    isUploading,
    removeAttachment: removePendingAttachment,
  } = useChatAttachments();

  // Track which upload IDs we've already added to project
  const addedUploadIdsRef = useRef<Set<string>>(new Set());

  // Set of upload IDs already in the project (from server)
  const existingUploadIds = useMemo(
    () => new Set(attachments.map(a => a.upload.id)),
    [attachments],
  );

  // When uploads complete, add them to the project
  // Don't remove pending attachment here - visiblePendingAttachments filters it out
  // once it appears in the fetched attachments list, preventing flash
  // Also check existingUploadIds to prevent re-adding if ref was cleared (e.g., project reference change)
  useEffect(() => {
    for (const attachment of pendingAttachments) {
      if (
        attachment.status === UploadStatuses.COMPLETED
        && attachment.uploadId
        && !addedUploadIdsRef.current.has(attachment.uploadId)
        && !existingUploadIds.has(attachment.uploadId)
      ) {
        addedUploadIdsRef.current.add(attachment.uploadId);
        addToProjectMutation.mutate({
          json: { uploadId: attachment.uploadId },
          param: { id: project.id },
        });
      }
    }
  }, [pendingAttachments, project.id, addToProjectMutation, existingUploadIds]);

  const visiblePendingAttachments = useMemo(
    () => pendingAttachments.filter(
      pa => !pa.uploadId || !existingUploadIds.has(pa.uploadId),
    ),
    [pendingAttachments, existingUploadIds],
  );

  const { dragHandlers, isDragging } = useDragDrop(addFiles);

  const form = useForm<ProjectFormValues>({
    defaultValues: getProjectFormDefaults(project),
    mode: 'onChange',
    resolver: zodResolver(ProjectFormSchema),
  });

  const {
    formState: { isSubmitting, isValid },
    handleSubmit,
    reset,
    setValue,
    watch,
  } = form;

  const currentIcon = watch('icon');
  const currentColor = watch('color');
  const currentName = watch('name');
  const currentInstructions = watch('customInstructions');

  // Reset form when modal opens - only depend on `open` to prevent race conditions
  // where ref gets cleared while uploads are in progress
  const projectIdRef = useRef(project.id);
  projectIdRef.current = project.id;

  useEffect(() => {
    if (open) {
      reset(getProjectFormDefaults(project));
      addedUploadIdsRef.current = new Set();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only reset on open change, not project reference changes
  }, [open, reset]);

  const onSubmit = useCallback(
    async (values: ProjectFormValues) => {
      try {
        await updateMutation.mutateAsync({
          json: {
            color: values.color,
            customInstructions: values.customInstructions?.trim() || undefined,
            icon: values.icon,
            name: values.name.trim(),
          },
          param: { id: project.id },
        });
        onOpenChange(false);
      } catch {
        // Error handled by mutation
      }
    },
    [project.id, updateMutation, onOpenChange],
  );

  const handleClose = useCallback(() => {
    if (updateMutation.isPending) {
      return;
    }
    onOpenChange(false);
  }, [updateMutation.isPending, onOpenChange]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) {
      addFiles(files);
    }
    e.target.value = '';
  }, [addFiles]);

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const isPending = updateMutation.isPending || isSubmitting;

  // Manual dirty check - react-hook-form's isDirty can be unreliable with setValue
  const originalIcon = project.icon ?? DEFAULT_PROJECT_ICON;
  const originalColor = project.color ?? DEFAULT_PROJECT_COLOR;
  const hasChanges
    = currentName !== project.name
      || currentIcon !== originalIcon
      || currentColor !== originalColor
      || (currentInstructions ?? '') !== (project.customInstructions ?? '');

  const canSubmit = isValid && hasChanges && !isPending;

  const hasFiles = attachments.length > 0 || visiblePendingAttachments.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[520px] h-[85vh] max-h-[700px]" {...dragHandlers}>
        <ChatInputDropzoneOverlay isDragging={isDragging} />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileInputChange}
        />

        <DialogHeader>
          <DialogTitle>{t('projects.projectSettings')}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
            <DialogBody className="py-0">
              <ScrollArea className="h-full -mr-4 sm:-mr-6">
                <div className="space-y-6 pr-4 sm:pr-6 py-4">
                  {/* Project name */}
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('projects.name')}</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Popover open={isIconPickerOpen} onOpenChange={setIsIconPickerOpen}>
                              <PopoverTrigger asChild>
                                <button
                                  type="button"
                                  className="absolute left-1.5 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-accent/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                                >
                                  <ProjectIconBadge
                                    icon={currentIcon}
                                    color={currentColor}
                                    size="md"
                                  />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent
                                side="bottom"
                                align="start"
                                className="w-[280px] p-4"
                                sideOffset={8}
                              >
                                <ProjectIconColorPicker
                                  icon={currentIcon}
                                  color={currentColor}
                                  onIconChange={icon => setValue('icon', icon, { shouldDirty: true, shouldValidate: true })}
                                  onColorChange={color => setValue('color', color, { shouldDirty: true, shouldValidate: true })}
                                />
                              </PopoverContent>
                            </Popover>
                            <Input
                              {...field}
                              placeholder={t('projects.namePlaceholder')}
                              className="pl-11"
                              disabled={isPending}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Instructions */}
                  <FormField
                    control={form.control}
                    name="customInstructions"
                    render={({ field }) => (
                      <FormItem>
                        <div className="space-y-1">
                          <FormLabel>{t('projects.instructionsLabel')}</FormLabel>
                          <p className="text-sm text-muted-foreground">
                            {t('projects.customInstructionsHint')}
                          </p>
                        </div>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder={t('projects.instructionsPlaceholder')}
                            rows={3}
                            disabled={isPending}
                            className="resize-y min-h-[80px]"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Files */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{t('projects.files')}</span>
                      <Button
                        type="button"
                        variant={ComponentVariants.OUTLINE}
                        size="sm"
                        onClick={handleUploadClick}
                        disabled={isUploading}
                        startIcon={isUploading
                          ? <Icons.loader className="size-4 animate-spin" />
                          : <Icons.plus className="size-4" />}
                      >
                        {t('actions.add')}
                      </Button>
                    </div>

                    <div className="min-h-[100px]">
                      {!hasFiles && !isAttachmentsFetching
                        ? (
                            <button
                              type="button"
                              className="w-full text-center py-6 border border-dashed border-border/50 rounded-xl cursor-pointer hover:bg-muted/30 transition-colors"
                              onClick={handleUploadClick}
                            >
                              <Icons.upload className="size-5 mx-auto text-muted-foreground/60" />
                              <p className="mt-2 text-sm text-muted-foreground px-4">
                                {t('projects.filesEmptyHint', { projectName: project.name })}
                              </p>
                            </button>
                          )
                        : (
                            <div className="space-y-2">
                              {visiblePendingAttachments.map(attachment => (
                                <ProjectPendingFileItem
                                  key={attachment.id}
                                  attachment={attachment}
                                  onCancel={() => {
                                    cancelUpload(attachment.id);
                                    removePendingAttachment(attachment.id);
                                  }}
                                  onRemove={() => removePendingAttachment(attachment.id)}
                                />
                              ))}
                              {attachments.map(attachment => (
                                <SettingsFileItem
                                  key={attachment.id}
                                  projectId={project.id}
                                  attachment={attachment}
                                  onDelete={() => setAttachmentToDelete({
                                    filename: attachment.upload.filename,
                                    id: attachment.id,
                                  })}
                                />
                              ))}
                            </div>
                          )}
                    </div>
                  </div>

                  {/* Memory */}
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm font-medium">{t('projects.memories')}</span>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t('projects.memoriesAutoGenerated')}
                      </p>
                    </div>

                    <div className="min-h-[80px]">
                      {isMemoryLoading
                        ? (
                            <Skeleton className="h-16 w-full rounded-lg" />
                          )
                        : memoryEntries.length === 0
                          ? (
                              <div className="text-center py-6 border border-dashed border-border/50 rounded-xl">
                                <p className="text-sm text-muted-foreground">
                                  {t('projects.memoriesDescription')}
                                </p>
                              </div>
                            )
                          : (
                              <div className="space-y-2 max-h-64 overflow-y-auto">
                                {memoryEntries.map(entry => (
                                  <MemoryEntryCard
                                    key={entry.id}
                                    section={entry.section}
                                    text={entry.text}
                                    isDeleting={memoryEntryToDelete === entry.id && isMemoryDeleting}
                                    onDelete={() => setMemoryEntryToDelete(entry.id)}
                                  />
                                ))}
                              </div>
                            )}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </DialogBody>

            <DialogFooter justify="between">
              <Button
                type="button"
                variant={ComponentVariants.OUTLINE}
                size="sm"
                className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50"
                onClick={onDelete}
              >
                {t('projects.delete')}
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClose}
                  disabled={isPending}
                >
                  {t('actions.cancel')}
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  loading={isPending}
                  disabled={!canSubmit}
                >
                  {t('actions.save')}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>

      <ConfirmationDialog
        open={memoryEntryToDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setMemoryEntryToDelete(null);
          }
        }}
        title={t('projects.removeMemory')}
        description={t('projects.removeMemoryConfirm')}
        icon={<Icons.trash className="size-5 text-destructive" />}
        confirmText={t('actions.delete')}
        confirmingText={t('actions.deleting')}
        cancelText={t('actions.cancel')}
        isLoading={isMemoryDeleting}
        variant={ConfirmationDialogVariants.DESTRUCTIVE}
        onConfirm={handleConfirmDeleteEntry}
      />

      <AttachmentDeleteDialog
        open={!!attachmentToDelete}
        onOpenChange={(open) => {
          if (!open) {
            setAttachmentToDelete(null);
          }
        }}
        projectId={project.id}
        attachment={attachmentToDelete}
      />
    </Dialog>
  );
}

type ProjectAttachment = NonNullable<ListProjectAttachmentsResponse['data']>['items'][number];

function SettingsFileItem({
  attachment,
  onDelete,
  projectId: _projectId,
}: {
  projectId: string;
  attachment: ProjectAttachment;
  onDelete: () => void;
}) {
  const t = useTranslations();
  const { ragMetadata, upload } = attachment;
  const isImage = upload.mimeType?.startsWith('image/');
  const isFromThread = isAttachmentFromThread(ragMetadata);

  const { data: downloadUrlResult, isLoading: isLoadingUrl } = useDownloadUrlQuery(upload.id, true);
  const downloadUrl = downloadUrlResult?.success ? downloadUrlResult.data.url : null;

  return (
    <div className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/40 border border-border/40">
      <div
        className={cn(
          'size-8 rounded-md flex items-center justify-center shrink-0 overflow-hidden',
          !isImage && getFileTypeColorClass(upload.mimeType),
        )}
      >
        {isLoadingUrl
          ? (
              <Icons.loader className="size-3 text-muted-foreground animate-spin" />
            )
          : isImage && downloadUrl
            ? (
                <SmartImage
                  src={downloadUrl}
                  alt={upload.filename}
                  fill
                  sizes="32px"
                  unoptimized
                  containerClassName="size-full"
                  fallback={(
                    <div className={cn('size-full flex items-center justify-center', getFileTypeColorClass(upload.mimeType))}>
                      <FileTypeIcon mimeType={upload.mimeType} className="size-3" />
                    </div>
                  )}
                />
              )
            : (
                <FileTypeIcon mimeType={upload.mimeType} className="size-3" />
              )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{upload.filename}</p>
        <p className="text-xs text-muted-foreground">
          {formatFileSize(upload.fileSize)}
          {isFromThread && (
            <span className="ml-2 text-muted-foreground/70">
              •
              {' '}
              {t('projects.fromThread')}
            </span>
          )}
        </p>
      </div>

      <button
        type="button"
        onClick={isFromThread ? undefined : onDelete}
        disabled={isFromThread}
        className={cn(
          'p-1.5 rounded-md text-muted-foreground transition-colors',
          isFromThread
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:bg-destructive/10 hover:text-destructive',
        )}
        title={isFromThread ? t('projects.fromThreadCannotRemove') : t('actions.remove')}
      >
        <Icons.trash className="size-4" />
      </button>
    </div>
  );
}

export type { ProjectSettingsModalProps };
