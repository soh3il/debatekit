import type { ChatMode } from '@debatekit/shared';
import { AvatarSizes, ComponentSizes, ComponentVariants } from '@debatekit/shared';
import { memo, useCallback } from 'react';

import { AvatarGroup } from '@/components/chat/avatar-group';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { getChatModeById } from '@/lib/config/chat-modes';
import type { AllDataSourceId } from '@/lib/config/model-presets';
import { ALL_DATA_SOURCE_IDS, COMING_SOON_DATA_SOURCE_IDS } from '@/lib/config/model-presets';
import { MIN_PARTICIPANTS_REQUIRED } from '@/lib/config/participant-limits';
import { useTranslations } from '@/lib/i18n';
import type { ParticipantConfig } from '@/lib/schemas';
import { cn } from '@/lib/ui/cn';
import type { Model } from '@/services/api';

type ChatInputToolbarMenuProps = {
  selectedParticipants: ParticipantConfig[];
  allModels: Model[];
  onOpenModelModal: () => void;
  selectedMode: ChatMode;
  onOpenModeModal: () => void;
  enableWebSearch: boolean;
  onWebSearchToggle?: (enabled: boolean) => void;
  dataSources?: { id: string; config?: Record<string, string> }[];
  onDataSourceToggle?: (sourceId: string, enabled: boolean) => void;
  onAttachmentClick?: () => void;
  attachmentCount?: number;
  enableAttachments?: boolean;
  isListening?: boolean;
  onToggleSpeech?: () => void;
  isSpeechSupported?: boolean;
  disabled?: boolean;
  isModelsLoading?: boolean;
  autoMode?: boolean;
};

const DATA_SOURCE_DESCRIPTION_KEYS: Record<AllDataSourceId, string> = {
  'clinical-trials': 'chat.dataSources.clinicalTrialsDescription',
  'crunchbase': 'chat.dataSources.crunchbaseDescription',
  'finnhub': 'chat.dataSources.finnhubDescription',
  'fred': 'chat.dataSources.fredDescription',
  'pitchbook': 'chat.dataSources.pitchbookDescription',
  'sec-edgar': 'chat.dataSources.secEdgarDescription',
  'sp-capital-iq': 'chat.dataSources.spCapitalIqDescription',
};

const DATA_SOURCE_LABEL_KEYS: Record<AllDataSourceId, string> = {
  'clinical-trials': 'chat.dataSources.clinicalTrials',
  'crunchbase': 'chat.dataSources.crunchbase',
  'finnhub': 'chat.dataSources.finnhub',
  'fred': 'chat.dataSources.fred',
  'pitchbook': 'chat.dataSources.pitchbook',
  'sec-edgar': 'chat.dataSources.secEdgar',
  'sp-capital-iq': 'chat.dataSources.spCapitalIq',
};

const ACTIVE_SOURCE_IDS = ALL_DATA_SOURCE_IDS.filter(id => !COMING_SOON_DATA_SOURCE_IDS.has(id));
const COMING_SOON_SOURCE_IDS = ALL_DATA_SOURCE_IDS.filter(id => COMING_SOON_DATA_SOURCE_IDS.has(id));

export const ChatInputToolbarMenu = memo(({
  allModels,
  attachmentCount = 0,
  autoMode = false,
  dataSources,
  disabled = false,
  enableAttachments = true,
  enableWebSearch,
  isListening = false,
  isModelsLoading = false,
  isSpeechSupported = false,
  onAttachmentClick,
  onDataSourceToggle,
  onOpenModelModal,
  onOpenModeModal,
  onToggleSpeech,
  onWebSearchToggle,
  selectedMode,
  selectedParticipants,
}: ChatInputToolbarMenuProps) => {
  const t = useTranslations();

  const currentMode = getChatModeById(selectedMode);
  const ModeIcon = currentMode?.icon;
  const hasNoModelsSelected = !autoMode && selectedParticipants.length < MIN_PARTICIPANTS_REQUIRED;

  const handleAttachClick = useCallback(() => {
    onAttachmentClick?.();
  }, [onAttachmentClick]);

  return (
    <>
      <TooltipProvider delayDuration={800}>
        <div className="hidden md:flex items-center gap-2">
          {!autoMode && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={ComponentVariants.OUTLINE}
                    disabled={disabled}
                    onClick={onOpenModelModal}
                    className={cn(
                      'h-10 sm:h-9 gap-1.5 text-xs px-3 hover:bg-white/15',
                      hasNoModelsSelected && 'border-destructive text-destructive hover:bg-destructive/20',
                    )}
                    startIcon={hasNoModelsSelected ? <Icons.alertCircle /> : undefined}
                  >
                    <span>{t('chat.models.models')}</span>
                    {!hasNoModelsSelected && (
                      <AvatarGroup
                        participants={selectedParticipants}
                        allModels={allModels}
                        size={AvatarSizes.SM}
                        maxVisible={5}
                        showCount={false}
                        showOverflow
                      />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs">{t('chat.toolbar.tooltips.models')}</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={ComponentVariants.OUTLINE}
                    disabled={disabled}
                    onClick={onOpenModeModal}
                    className="h-10 sm:h-9 gap-1.5 text-xs px-3 hover:bg-white/15"
                    startIcon={ModeIcon ? <ModeIcon /> : undefined}
                  >
                    <span>{currentMode?.label || t('chat.modes.mode')}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs">{t('chat.toolbar.tooltips.mode')}</p>
                </TooltipContent>
              </Tooltip>
            </>
          )}

          {onAttachmentClick && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant={ComponentVariants.OUTLINE}
                  size={ComponentSizes.ICON}
                  disabled={disabled || !enableAttachments}
                  onClick={handleAttachClick}
                  className={cn(
                    'size-10 sm:size-9 hover:bg-white/15',
                    attachmentCount > 0 && 'border-primary/50 bg-primary/10 text-primary hover:bg-primary/20',
                  )}
                >
                  <Icons.paperclip className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs">
                  {enableAttachments
                    ? t('chat.toolbar.tooltips.attach')
                    : t('chat.toolbar.tooltips.attachDisabled')}
                </p>
              </TooltipContent>
            </Tooltip>
          )}

          {!autoMode && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={ComponentVariants.OUTLINE}
                    size={ComponentSizes.ICON}
                    disabled={disabled}
                    onClick={() => onWebSearchToggle?.(!enableWebSearch)}
                    aria-label={enableWebSearch ? t('chat.toolbar.tooltips.webSearchEnabled') : t('chat.toolbar.tooltips.webSearch')}
                    aria-pressed={enableWebSearch}
                    data-testid="web-search-toggle"
                    className={cn(
                      'size-10 sm:size-9 transition-colors hover:bg-white/15',
                      enableWebSearch
                        ? 'border-blue-500/40 bg-blue-500/20 text-blue-300 hover:bg-blue-500/25'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <Icons.globe className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs">
                    {enableWebSearch
                      ? t('chat.toolbar.tooltips.webSearchEnabled')
                      : t('chat.toolbar.tooltips.webSearch')}
                  </p>
                </TooltipContent>
              </Tooltip>

              {onDataSourceToggle && (
                <Popover>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant={ComponentVariants.OUTLINE}
                          size={ComponentSizes.ICON}
                          disabled={disabled}
                          aria-label={t('chat.dataSources.toggle')}
                          data-testid="data-sources-toggle"
                          className={cn(
                            'size-10 sm:size-9 transition-colors hover:bg-white/15',
                            dataSources && dataSources.length > 0
                              ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/25'
                              : 'text-muted-foreground hover:text-foreground',
                          )}
                        >
                          <Icons.database className="size-4" />
                        </Button>
                      </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p className="text-xs">{t('chat.dataSources.toggle')}</p>
                    </TooltipContent>
                  </Tooltip>
                  <PopoverContent align="start" className="w-80 p-2 max-h-[70vh] overflow-y-auto" sideOffset={8}>
                    <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                      {t('chat.dataSources.title')}
                    </p>
                    <div className="space-y-0.5">
                      {ACTIVE_SOURCE_IDS.map((sourceId) => {
                        const isActive = dataSources?.some(ds => ds.id === sourceId) ?? false;
                        return (
                          <button
                            key={sourceId}
                            type="button"
                            onClick={() => onDataSourceToggle(sourceId, !isActive)}
                            className={cn(
                              'w-full flex items-center gap-3 px-2 py-2 rounded-lg transition-colors',
                              'hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                              isActive && 'bg-emerald-500/10',
                            )}
                          >
                            <Icons.database className={cn(
                              'size-4 shrink-0',
                              isActive ? 'text-emerald-400' : 'text-muted-foreground',
                            )}
                            />
                            <div className="flex flex-col flex-1 text-left min-w-0">
                              <span className={cn(
                                'text-sm font-medium',
                                isActive ? 'text-emerald-200' : 'text-foreground',
                              )}
                              >
                                {t(DATA_SOURCE_LABEL_KEYS[sourceId])}
                              </span>
                              <span className="text-xs text-muted-foreground truncate">
                                {t(DATA_SOURCE_DESCRIPTION_KEYS[sourceId])}
                              </span>
                            </div>
                            <div className={cn(
                              'size-2 rounded-full shrink-0',
                              isActive ? 'bg-emerald-400' : 'bg-muted-foreground/30',
                            )}
                            />
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-2 pt-2 border-t border-white/5">
                      <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                        {t('chat.dataSources.comingSoon')}
                      </p>
                      <div className="space-y-0.5">
                        {COMING_SOON_SOURCE_IDS.map(sourceId => (
                          <div
                            key={sourceId}
                            className="w-full flex items-center gap-3 px-2 py-2 rounded-lg opacity-50 cursor-default"
                          >
                            <Icons.database className="size-4 shrink-0 text-muted-foreground" />
                            <div className="flex flex-col flex-1 text-left min-w-0">
                              <span className="text-sm font-medium text-foreground">
                                {t(DATA_SOURCE_LABEL_KEYS[sourceId])}
                              </span>
                              <span className="text-xs text-muted-foreground truncate">
                                {t(DATA_SOURCE_DESCRIPTION_KEYS[sourceId])}
                              </span>
                            </div>
                            <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                              {t('chat.dataSources.comingSoon')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </>
          )}
        </div>
      </TooltipProvider>

      <div className="flex md:hidden items-center gap-1.5">
        {autoMode
          ? (
              onAttachmentClick && (
                <Button
                  type="button"
                  variant={ComponentVariants.GLASS}
                  size={ComponentSizes.ICON}
                  disabled={disabled || !enableAttachments}
                  onClick={handleAttachClick}
                  className={cn(
                    'size-10',
                    attachmentCount > 0 && 'border-primary/50 bg-primary/10 text-primary',
                  )}
                  aria-label={t('chat.input.attachFiles')}
                >
                  <Icons.paperclip className="size-4" />
                </Button>
              )
            )
          : (
              <>
                <Button
                  type="button"
                  variant={ComponentVariants.GLASS}
                  size={ComponentSizes.SM}
                  disabled={disabled}
                  onClick={onOpenModelModal}
                  className={cn(
                    'h-10 px-2.5 gap-1',
                    hasNoModelsSelected && !isModelsLoading && 'border-destructive/50 bg-destructive/10',
                  )}
                  loading={isModelsLoading}
                  startIcon={hasNoModelsSelected && !isModelsLoading ? <Icons.alertCircle className="text-destructive" /> : undefined}
                >
                  {!isModelsLoading && !hasNoModelsSelected && (
                    <AvatarGroup
                      participants={selectedParticipants}
                      allModels={allModels}
                      size={AvatarSizes.SM}
                      maxVisible={3}
                      showCount={false}
                      showOverflow
                    />
                  )}
                </Button>

                {onAttachmentClick && (
                  <Button
                    type="button"
                    variant={ComponentVariants.GLASS}
                    size={ComponentSizes.ICON}
                    disabled={disabled || !enableAttachments}
                    onClick={handleAttachClick}
                    className={cn(
                      'size-10',
                      attachmentCount > 0 && 'border-primary/50 bg-primary/10 text-primary',
                    )}
                    aria-label={t('chat.input.attachFiles')}
                  >
                    <Icons.paperclip className="size-4" />
                  </Button>
                )}

                <Drawer>
                  <DrawerTrigger asChild>
                    <Button
                      type="button"
                      variant={ComponentVariants.GLASS}
                      size={ComponentSizes.ICON}
                      disabled={disabled}
                      className="size-10"
                      aria-label={t('accessibility.moreOptions')}
                    >
                      <Icons.moreHorizontal className="size-4" />
                    </Button>
                  </DrawerTrigger>
                  <DrawerContent glass>
                    <DrawerHeader className="pb-4">
                      <DrawerTitle className="text-base font-semibold text-foreground">
                        {t('chat.toolbar.options')}
                      </DrawerTitle>
                    </DrawerHeader>

                    <div className="px-5 pb-5 space-y-3">
                      <button
                        type="button"
                        onClick={onOpenModeModal}
                        className="w-full flex items-center gap-4 p-4 min-h-14 rounded-2xl bg-white/5 hover:bg-white/[0.07] active:bg-black/20 transition-colors touch-feedback focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <div className="flex items-center justify-center size-10 rounded-full bg-purple-500/10">
                          {ModeIcon && <ModeIcon className="size-5 text-purple-400" />}
                        </div>
                        <div className="flex flex-col flex-1 text-left">
                          <span className="text-sm font-medium text-foreground">
                            {t('chat.modes.mode')}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {currentMode?.label}
                          </span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => onWebSearchToggle?.(!enableWebSearch)}
                        className={cn(
                          'w-full flex items-center gap-4 p-4 min-h-14 rounded-2xl transition-colors touch-feedback',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          enableWebSearch
                            ? 'bg-blue-500/20 hover:bg-blue-500/25 active:bg-blue-500/30'
                            : 'bg-white/5 hover:bg-white/[0.07] active:bg-black/20',
                        )}
                      >
                        <div className={cn(
                          'flex items-center justify-center size-10 rounded-full transition-colors',
                          enableWebSearch ? 'bg-blue-500/20' : 'bg-blue-500/10',
                        )}
                        >
                          <Icons.globe className={cn(
                            'size-5 transition-colors',
                            enableWebSearch ? 'text-blue-300' : 'text-blue-400',
                          )}
                          />
                        </div>
                        <span className={cn(
                          'text-sm font-medium flex-1 text-left transition-colors',
                          enableWebSearch ? 'text-blue-100' : 'text-foreground',
                        )}
                        >
                          {t('chat.webSearch.toggle')}
                        </span>
                        {enableWebSearch && (
                          <div className="size-2 rounded-full bg-blue-400" />
                        )}
                      </button>

                      {onDataSourceToggle && ACTIVE_SOURCE_IDS.map((sourceId) => {
                        const isActive = dataSources?.some(ds => ds.id === sourceId) ?? false;
                        return (
                          <button
                            key={sourceId}
                            type="button"
                            onClick={() => onDataSourceToggle(sourceId, !isActive)}
                            className={cn(
                              'w-full flex items-center gap-4 p-4 min-h-14 rounded-2xl transition-colors touch-feedback',
                              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                              isActive
                                ? 'bg-emerald-500/20 hover:bg-emerald-500/25 active:bg-emerald-500/30'
                                : 'bg-white/5 hover:bg-white/[0.07] active:bg-black/20',
                            )}
                          >
                            <div className={cn(
                              'flex items-center justify-center size-10 rounded-full transition-colors',
                              isActive ? 'bg-emerald-500/20' : 'bg-emerald-500/10',
                            )}
                            >
                              <Icons.database className={cn(
                                'size-5 transition-colors',
                                isActive ? 'text-emerald-300' : 'text-emerald-400',
                              )}
                              />
                            </div>
                            <span className={cn(
                              'text-sm font-medium flex-1 text-left transition-colors',
                              isActive ? 'text-emerald-100' : 'text-foreground',
                            )}
                            >
                              {t(DATA_SOURCE_LABEL_KEYS[sourceId])}
                            </span>
                            {isActive && (
                              <div className="size-2 rounded-full bg-emerald-400" />
                            )}
                          </button>
                        );
                      })}

                      {onDataSourceToggle && (
                        <>
                          <p className="px-4 pt-3 pb-1 text-xs font-medium text-muted-foreground">
                            {t('chat.dataSources.comingSoon')}
                          </p>
                          {COMING_SOON_SOURCE_IDS.map(sourceId => (
                            <div
                              key={sourceId}
                              className="w-full flex items-center gap-4 p-4 min-h-14 rounded-2xl bg-white/5 opacity-50 cursor-default"
                            >
                              <div className="flex items-center justify-center size-10 rounded-full bg-emerald-500/10">
                                <Icons.database className="size-5 text-muted-foreground" />
                              </div>
                              <span className="text-sm font-medium flex-1 text-left text-foreground">
                                {t(DATA_SOURCE_LABEL_KEYS[sourceId])}
                              </span>
                              <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                                {t('chat.dataSources.comingSoon')}
                              </span>
                            </div>
                          ))}
                        </>
                      )}

                      {onToggleSpeech && (
                        <button
                          type="button"
                          onClick={onToggleSpeech}
                          disabled={!isSpeechSupported}
                          className={cn(
                            'w-full flex items-center gap-4 p-4 min-h-14 rounded-2xl transition-colors touch-feedback',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            !isSpeechSupported && 'opacity-50 cursor-not-allowed',
                            isListening
                              ? 'bg-red-500/20 hover:bg-red-500/25 active:bg-red-500/30'
                              : 'bg-white/5 hover:bg-white/[0.07] active:bg-black/20',
                          )}
                        >
                          <div className={cn(
                            'flex items-center justify-center size-10 rounded-full',
                            isListening ? 'bg-red-500/20' : 'bg-green-500/10',
                          )}
                          >
                            {isListening
                              ? <Icons.stopCircle className="size-5 text-red-400" />
                              : <Icons.mic className="size-5 text-green-400" />}
                          </div>
                          <span className={cn(
                            'text-sm font-medium flex-1 text-left transition-colors',
                            isListening ? 'text-red-100' : 'text-foreground',
                          )}
                          >
                            {isListening ? t('chat.input.stopRecording') : t('chat.input.voiceInput')}
                          </span>
                          {isListening && (
                            <div className="size-2 rounded-full bg-red-500 animate-pulse" />
                          )}
                        </button>
                      )}
                    </div>
                  </DrawerContent>
                </Drawer>
              </>
            )}
      </div>
    </>
  );
});

ChatInputToolbarMenu.displayName = 'ChatInputToolbarMenu';
