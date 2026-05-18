import {
  Action,
  ActionPanel,
  Form,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { useState } from "react";
import { debugIssue } from "./api";
import { ResultView } from "./result-view";

export default function DebugCommand() {
  const { push } = useNavigation();
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(values: {
    problem: string;
    error: string;
    code: string;
    expected_behavior: string;
    thinking_level: string;
  }) {
    if (!values.problem.trim()) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Problem description is required",
      });
      return;
    }

    setIsLoading(true);
    const toast = await showToast({
      style: Toast.Style.Animated,
      title: "Debugging...",
      message: "Multiple models analyzing the issue",
    });

    try {
      const result = await debugIssue({
        problem: values.problem.trim(),
        error: values.error?.trim() || undefined,
        code: values.code?.trim() || undefined,
        expected_behavior: values.expected_behavior?.trim() || undefined,
        thinking_level: values.thinking_level || undefined,
      });

      toast.style = Toast.Style.Success;
      toast.title = "Debug analysis complete";
      toast.message = `${result.participants.length} analysts`;

      push(
        <ResultView
          result={result}
          participantLabel="Analysts"
          copyTitles={{ summary: "Copy Debug Summary", full: "Copy Full Analysis" }}
        />,
      );
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = "Debug failed";
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
          <Action.SubmitForm title="Debug Issue" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextArea
        id="problem"
        title="Problem"
        placeholder="Describe the bug, failure, or unexpected behavior..."
        enableMarkdown
      />
      <Form.TextArea
        id="error"
        title="Error Message"
        placeholder="Error message, stack trace, or unexpected output..."
        enableMarkdown
      />
      <Form.TextArea
        id="code"
        title="Code"
        placeholder="The relevant code where the bug occurs..."
        enableMarkdown
      />
      <Form.TextArea
        id="expected_behavior"
        title="Expected Behavior"
        placeholder="What should happen vs what actually happens..."
      />
      <Form.Separator />
      <Form.Dropdown
        id="thinking_level"
        title="Analysis Depth"
        defaultValue="medium"
      >
        <Form.Dropdown.Item value="low" title="Low — Quick scan" />
        <Form.Dropdown.Item value="medium" title="Medium — Balanced" />
        <Form.Dropdown.Item value="high" title="High — Deep analysis" />
      </Form.Dropdown>
    </Form>
  );
}
