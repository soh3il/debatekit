import { CopyIconVariants } from '@debatekit/shared';
import type { UIMessage } from 'ai';
import { usePostHog } from 'posthog-js/react';
import { memo, useCallback, useMemo } from 'react';

import { CopyActionButton } from '@/components/chat/copy-actions/copy-action-button';
import { CHAT_UI_EVENTS } from '@/constants/analytics';
import { useCopyToClipboard } from '@/hooks/utils';
import { useTranslations } from '@/lib/i18n';
import { formatThreadAsMarkdown } from '@/lib/utils';
import type { ChatParticipant } from '@/services/api';

type ThreadSummaryCopyActionProps = {
  messages: UIMessage[];
  participants: ChatParticipant[];
  threadTitle?: string;
  className?: string;
};

function ThreadSummaryCopyActionComponent({
  className,
  messages,
  participants,
  threadTitle,
}: ThreadSummaryCopyActionProps) {
  const t = useTranslations();
  const posthog = usePostHog();

  const toastMessages = useMemo(() => ({
    errorDescription: t('chat.roundActions.copyErrorDescription'),
    errorTitle: t('chat.roundActions.copyError'),
    successDescription: t('chat.roundActions.copyThreadSuccessDescription'),
    successTitle: t('chat.roundActions.copyThreadSuccess'),
  }), [t]);

  const { copied, copy } = useCopyToClipboard({ messages: toastMessages });

  const handleCopy = useCallback(() => {
    const markdown = formatThreadAsMarkdown(messages, participants, threadTitle);
    copy(markdown);

    // Track thread summary copied
    posthog.capture(CHAT_UI_EVENTS.THREAD_SUMMARY_COPIED, {
      message_count: messages.length,
      participant_count: participants.length,
    });
  }, [copy, messages, participants, threadTitle, posthog]);

  return (
    <CopyActionButton
      copied={copied}
      onClick={handleCopy}
      tooltip={t('chat.roundActions.copyThread')}
      label={t('chat.roundActions.copyThread')}
      className={className}
      variant={CopyIconVariants.STACK}
    />
  );
}

export const ThreadSummaryCopyAction = memo(
  ThreadSummaryCopyActionComponent,
  (prevProps, nextProps) => (
    prevProps.messages.length === nextProps.messages.length
    && prevProps.participants === nextProps.participants
    && prevProps.threadTitle === nextProps.threadTitle
    && prevProps.className === nextProps.className
  ),
);

ThreadSummaryCopyAction.displayName = 'ThreadSummaryCopyAction';
