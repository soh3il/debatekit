import {
  Action,
  ActionPanel,
  Detail,
} from "@raycast/api";
import { DEBATEKIT_APP_URL } from "@debatekit/integration-shared";
import type { DebateResult } from "./types";
import { formatDebateMarkdown } from "./utils";

/** Shared result detail view used by all DebateKit command screens */
export function ResultView({
  result,
  participantLabel = "Participants",
  copyTitles = { summary: "Copy Summary", full: "Copy Full Result" },
}: {
  result: DebateResult;
  participantLabel?: string;
  copyTitles?: { summary: string; full: string };
}) {
  const markdown = formatDebateMarkdown(result);

  return (
    <Detail
      markdown={markdown}
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label
            title="Duration"
            text={`${(result.metadata.duration_ms / 1000).toFixed(1)}s`}
          />
          <Detail.Metadata.Label title="Mode" text={result.metadata.mode} />
          <Detail.Metadata.Label
            title="Thinking Level"
            text={result.metadata.thinking_level}
          />
          <Detail.Metadata.Label
            title="Credits Used"
            text={String(result.metadata.total_credits_used)}
          />
          <Detail.Metadata.Label
            title={participantLabel}
            text={String(result.participants.length)}
          />
          <Detail.Metadata.Separator />
          <Detail.Metadata.Label title="Session ID" text={result.sessionId} />
          {result.threadSlug && (
            <Detail.Metadata.Link
              title="View Thread"
              target={`${DEBATEKIT_APP_URL}/public/chat/${result.threadSlug}`}
              text="Open in DebateKit"
            />
          )}
        </Detail.Metadata>
      }
      actions={
        <ActionPanel>
          <Action.CopyToClipboard
            title={copyTitles.summary}
            content={result.moderator.summary}
          />
          <Action.CopyToClipboard title={copyTitles.full} content={markdown} />
          {result.threadSlug && (
            <Action.OpenInBrowser
              title="Open in DebateKit"
              url={`${DEBATEKIT_APP_URL}/public/chat/${result.threadSlug}`}
            />
          )}
        </ActionPanel>
      }
    />
  );
}
