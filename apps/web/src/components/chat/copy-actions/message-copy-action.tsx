import { usePostHog } from 'posthog-js/react';
import { memo, useCallback, useMemo } from 'react';

import { CopyActionButton } from '@/components/chat/copy-actions/copy-action-button';
import { CHAT_UI_EVENTS } from '@/constants/analytics';
import { useCopyToClipboard } from '@/hooks/utils';
import { useTranslations } from '@/lib/i18n';

type MessageCopyActionProps = {
  messageText: string;
  className?: string;
  tooltip?: string;
  label?: string;
  /** Optional participant model ID for tracking */
  modelId?: string;
  /** Optional round number for tracking */
  roundNumber?: number;
};

function MessageCopyActionComponent({
  className,
  label,
  messageText,
  modelId,
  roundNumber,
  tooltip,
}: MessageCopyActionProps) {
  const t = useTranslations();
  const posthog = usePostHog();

  const messages = useMemo(() => ({
    errorDescription: t('chat.messageActions.copyErrorDescription'),
    errorTitle: t('chat.messageActions.copyError'),
    successDescription: t('chat.messageActions.copySuccessDescription'),
    successTitle: t('chat.messageActions.copySuccess'),
  }), [t]);

  const { copied, copy } = useCopyToClipboard({ messages });

  const handleCopy = useCallback(() => {
    copy(messageText);

    // Track message copied
    posthog.capture(CHAT_UI_EVENTS.MESSAGE_COPIED, {
      message_length: messageText.length,
      model_id: modelId ?? null,
      round_number: roundNumber ?? null,
    });
  }, [copy, messageText, posthog, modelId, roundNumber]);

  return (
    <CopyActionButton
      copied={copied}
      onClick={handleCopy}
      tooltip={tooltip ?? t('chat.messageActions.copy')}
      label={label ?? t('chat.messageActions.copy')}
      className={className}
      variant="copy"
    />
  );
}

export const MessageCopyAction = memo(
  MessageCopyActionComponent,
  (prevProps, nextProps) => (
    prevProps.messageText === nextProps.messageText
    && prevProps.className === nextProps.className
    && prevProps.tooltip === nextProps.tooltip
    && prevProps.label === nextProps.label
    && prevProps.modelId === nextProps.modelId
    && prevProps.roundNumber === nextProps.roundNumber
  ),
);

MessageCopyAction.displayName = 'MessageCopyAction';
