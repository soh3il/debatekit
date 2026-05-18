import {
  Action,
  ActionPanel,
  Form,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { useState } from "react";
import { assessTradeoffs } from "./api";
import { ResultView } from "./result-view";

export default function AssessTradeoffsCommand() {
  const { push } = useNavigation();
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(values: {
    decision: string;
    options: string;
    priorities: string;
    thinking_level: string;
  }) {
    if (!values.decision.trim()) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Decision description is required",
      });
      return;
    }

    const options = values.options
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (options.length < 2) {
      await showToast({
        style: Toast.Style.Failure,
        title: "At least 2 options required (comma-separated)",
      });
      return;
    }

    setIsLoading(true);
    const toast = await showToast({
      style: Toast.Style.Animated,
      title: "Assessing tradeoffs...",
      message: "Multiple models analyzing options",
    });

    try {
      const priorities = values.priorities
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const result = await assessTradeoffs({
        decision: values.decision.trim(),
        options,
        priorities: priorities.length > 0 ? priorities : undefined,
        thinking_level: values.thinking_level || undefined,
      });

      toast.style = Toast.Style.Success;
      toast.title = "Assessment complete";
      toast.message = `${result.participants.length} analysts`;

      push(
        <ResultView
          result={result}
          participantLabel="Analysts"
          copyTitles={{ summary: "Copy Assessment Summary", full: "Copy Full Assessment" }}
        />,
      );
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = "Assessment failed";
      toast.message = error instanceof Error ? error.message : "Unknown error";
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Assess Tradeoffs" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextArea
        id="decision"
        title="Decision"
        placeholder="Describe the decision you need to make..."
        enableMarkdown
      />
      <Form.TextField
        id="options"
        title="Options"
        placeholder="Option A, Option B, Option C (comma-separated)"
      />
      <Form.TextField
        id="priorities"
        title="Priorities"
        placeholder="performance, dx, cost (comma-separated)"
      />
      <Form.Separator />
      <Form.Dropdown
        id="thinking_level"
        title="Analysis Depth"
        defaultValue="medium"
      >
        <Form.Dropdown.Item value="low" title="Low -- Quick comparison" />
        <Form.Dropdown.Item value="medium" title="Medium -- Balanced" />
        <Form.Dropdown.Item value="high" title="High -- Deep analysis" />
      </Form.Dropdown>
    </Form>
  );
}
