import {
  Action,
  ActionPanel,
  Form,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { useState } from "react";
import { consult } from "./api";
import { ResultView } from "./result-view";

export default function ConsultCommand() {
  const { push } = useNavigation();
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(values: {
    prompt: string;
    context: string;
    thinking_level: string;
    mode: string;
  }) {
    if (!values.prompt.trim()) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Prompt is required",
      });
      return;
    }

    setIsLoading(true);
    const toast = await showToast({
      style: Toast.Style.Animated,
      title: "Consulting the council...",
      message: "This may take 30-60 seconds",
    });

    try {
      const result = await consult({
        prompt: values.prompt.trim(),
        context: values.context?.trim() || undefined,
        thinking_level: values.thinking_level || undefined,
        mode: values.mode || undefined,
      });

      toast.style = Toast.Style.Success;
      toast.title = "Council has spoken";
      toast.message = `${result.participants.length} participants, ${(result.metadata.duration_ms / 1000).toFixed(1)}s`;

      push(<ResultView result={result} />);
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = "Consultation failed";
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
          <Action.SubmitForm title="Consult Council" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextArea
        id="prompt"
        title="Prompt"
        placeholder="What should the AI council discuss?"
        enableMarkdown
      />
      <Form.TextArea
        id="context"
        title="Context"
        placeholder="Additional background context (code, docs, requirements)..."
        enableMarkdown
      />
      <Form.Separator />
      <Form.Dropdown
        id="thinking_level"
        title="Thinking Level"
        defaultValue="medium"
      >
        <Form.Dropdown.Item value="low" title="Low — Fast & cheap" />
        <Form.Dropdown.Item value="medium" title="Medium — Balanced" />
        <Form.Dropdown.Item value="high" title="High — Maximum reasoning" />
      </Form.Dropdown>
      <Form.Dropdown id="mode" title="Mode" defaultValue="">
        <Form.Dropdown.Item value="" title="Auto (AI picks)" />
        <Form.Dropdown.Item value="analyzing" title="Analyzing — Research" />
        <Form.Dropdown.Item
          value="brainstorming"
          title="Brainstorming — Ideas"
        />
        <Form.Dropdown.Item value="debating" title="Debating — Tradeoffs" />
        <Form.Dropdown.Item value="solving" title="Solving — Action plans" />
      </Form.Dropdown>
    </Form>
  );
}
