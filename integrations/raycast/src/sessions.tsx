import { Action, ActionPanel, Color, Detail, Icon, List } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { ConsultResponseSchema } from "@debatekit/integration-shared";
import { getSession, listSessions } from "./api";
import type { SessionSummary } from "./types";
import {
  formatDebateMarkdown,
  relativeTime,
  toolNameLabel,
  truncate,
} from "./utils";

function SessionDetailView({ session }: { session: SessionSummary }) {
  const { data, isLoading } = useCachedPromise(
    async (id: string) => getSession(id),
    [session.id],
  );

  let markdown = `# ${toolNameLabel(session.toolName)}\n\n**Prompt:** ${session.prompt}`;

  if (data?.resultJson) {
    const parseResult = ConsultResponseSchema.safeParse(
      (() => { try { return JSON.parse(data.resultJson); } catch { return undefined; } })(),
    );
    if (parseResult.success) {
      markdown = formatDebateMarkdown({ ...parseResult.data, sessionId: parseResult.data.sessionId || session.id });
    } else {
      markdown += "\n\n*Could not parse session result.*";
    }
  }

  return (
    <Detail
      isLoading={isLoading}
      markdown={markdown}
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label
            title="Tool"
            text={toolNameLabel(session.toolName)}
          />
          <Detail.Metadata.Label
            title="Created"
            text={new Date(session.createdAt).toLocaleString()}
          />
          <Detail.Metadata.Label title="Session ID" text={session.id} />
        </Detail.Metadata>
      }
      actions={
        <ActionPanel>
          <Action.CopyToClipboard
            title="Copy Session Id"
            content={session.id}
          />
          <Action.CopyToClipboard
            title="Copy Prompt"
            content={session.prompt}
          />
        </ActionPanel>
      }
    />
  );
}

function toolIcon(toolName: string): { source: Icon; tintColor: Color } {
  switch (toolName) {
    case "consult_council":
      return { source: Icon.SpeechBubbleActive, tintColor: Color.Blue };
    case "review_code":
      return { source: Icon.Code, tintColor: Color.Green };
    case "debug_issue":
      return { source: Icon.Bug, tintColor: Color.Red };
    case "design_architecture":
      return { source: Icon.Building, tintColor: Color.Purple };
    case "plan_implementation":
      return { source: Icon.Clipboard, tintColor: Color.Orange };
    case "assess_tradeoffs":
      return { source: Icon.BarChart, tintColor: Color.Yellow };
    default:
      return { source: Icon.Circle, tintColor: Color.SecondaryText };
  }
}

export default function SessionsCommand() {
  const { data, isLoading, revalidate } = useCachedPromise(
    async () => {
      const response = await listSessions({ limit: 50 });
      return response.sessions;
    },
    [],
    { keepPreviousData: true },
  );

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Filter sessions...">
      <List.EmptyView
        title="No sessions found"
        description="Run a DebateKit command to create your first session."
      />
      {data?.map((session) => {
        const icon = toolIcon(session.toolName);
        return (
          <List.Item
            key={session.id}
            title={truncate(session.prompt, 80)}
            subtitle={toolNameLabel(session.toolName)}
            accessories={[{ text: relativeTime(session.createdAt) }]}
            icon={icon}
            actions={
              <ActionPanel>
                <Action.Push
                  title="View Session"
                  icon={Icon.Eye}
                  target={<SessionDetailView session={session} />}
                />
                <Action.CopyToClipboard
                  title="Copy Session Id"
                  content={session.id}
                />
                <Action.CopyToClipboard
                  title="Copy Prompt"
                  content={session.prompt}
                />
                <Action
                  title="Refresh"
                  icon={Icon.ArrowClockwise}
                  onAction={revalidate}
                  shortcut={{ modifiers: ["cmd"], key: "r" }}
                />
              </ActionPanel>
            }
          />
        );
      })}
    </List>
  );
}
