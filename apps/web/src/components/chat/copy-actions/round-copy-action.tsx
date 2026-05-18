import { CopyIconVariants } from '@debatekit/shared';
import type { UIMessage } from 'ai';
import { usePostHog } from 'posthog-js/react';
import { memo, useCallback, useMemo } from 'react';

import { CopyActionButton } from '@/components/chat/copy-actions/copy-action-button';
import { CHAT_UI_EVENTS } from '@/constants/analytics';
import { useCopyToClipboard } from '@/hooks/utils';
import { useTranslations } from '@/lib/i18n';
import { formatRoundAsMarkdown } from '@/lib/utils';
import type { ChatParticipant } from '@/services/api';

type RoundCopyActionProps = {
  messages: UIMessage[];
  participants: ChatParticipant[];
  roundNumber: number;
  threadTitle?: string;
  moderatorText?: string;
  className?: string;
};

function RoundCopyActionComponent({
  className,
  messages,
  moderatorText,
  participants,
  roundNumber,
  threadTitle,
}: RoundCopyActionProps) {
  const t = useTranslations();
  const posthog = usePostHog();

  const toastMessages = useMemo(() => ({
    errorDescription: t('chat.roundActions.copyErrorDescription'),
    errorTitle: t('chat.roundActions.copyError'),
    successDescription: t('chat.roundActions.copySuccessDescription'),
    successTitle: t('chat.roundActions.copySuccess'),
  }), [t]);

  const { copied, copy } = useCopyToClipboard({ messages: toastMessages });

  const handleCopy = useCallback(() => {
    const markdown = formatRoundAsMarkdown(messages, participants, roundNumber, {
      moderatorText,
      threadTitle,
    });
    copy(markdown);

    // Track round copied
    posthog.capture(CHAT_UI_EVENTS.ROUND_COPIED, {
      message_count: messages.length,
      participant_count: participants.length,
      round_number: roundNumber,
    });
  }, [copy, messages, participants, roundNumber, threadTitle, moderatorText, posthog]);

  return (
    <CopyActionButton
      copied={copied}
      onClick={handleCopy}
      tooltip={t('chat.roundActions.copyRound')}
      label={t('chat.roundActions.copyRound')}
      className={className}
      variant={CopyIconVariants.STACK}
    />
  );
}

export const RoundCopyAction = memo(
  RoundCopyActionComponent,
  (prevProps, nextProps) => (
    prevProps.roundNumber === nextProps.roundNumber
    && prevProps.messages.length === nextProps.messages.length
    && prevProps.threadTitle === nextProps.threadTitle
    && prevProps.moderatorText === nextProps.moderatorText
    && prevProps.className === nextProps.className
  ),
);

RoundCopyAction.displayName = 'RoundCopyAction';
