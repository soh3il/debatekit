import {
  Action,
  ActionPanel,
  Form,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { useState } from "react";
import { planImplementation } from "./api";
import { ResultView } from "./result-view";

export default function PlanImplementationCommand() {
  const { push } = useNavigation();
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(values: {
    feature: string;
    codebase_context: string;
    constraints: string;
    thinking_level: string;
  }) {
    if (!values.feature.trim()) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Feature description is required",
      });
      return;
    }

    setIsLoading(true);
    const toast = await showToast({
      style: Toast.Style.Animated,
      title: "Planning...",
      message: "Multiple models creating implementation plan",
    });

    try {
      const constraints = values.constraints
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const result = await planImplementation({
        feature: values.feature.trim(),
        codebase_context: values.codebase_context?.trim() || undefined,
        constraints: constraints.length > 0 ? constraints : undefined,
        thinking_level: values.thinking_level || undefined,
      });

      toast.style = Toast.Style.Success;
      toast.title = "Plan complete";
      toast.message = `${result.participants.length} planners`;

      push(
        <ResultView
          result={result}
          participantLabel="Planners"
          copyTitles={{ summary: "Copy Plan Summary", full: "Copy Full Plan" }}
        />,
      );
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = "Planning failed";
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
          <Action.SubmitForm
            title="Plan Implementation"
            onSubmit={handleSubmit}
          />
        </ActionPanel>
      }
    >
      <Form.TextArea
        id="feature"
        title="Feature"
        placeholder="Describe the feature or project to plan..."
        enableMarkdown
      />
      <Form.TextArea
        id="codebase_context"
        title="Codebase Context"
        placeholder="Relevant context about the existing codebase..."
        enableMarkdown
      />
      <Form.TextField
        id="constraints"
        title="Constraints"
        placeholder="time, budget, tech stack (comma-separated)"
      />
      <Form.Separator />
      <Form.Dropdown
        id="thinking_level"
        title="Planning Depth"
        defaultValue="medium"
      >
        <Form.Dropdown.Item value="low" title="Low -- Quick outline" />
        <Form.Dropdown.Item value="medium" title="Medium -- Balanced" />
        <Form.Dropdown.Item value="high" title="High -- Detailed plan" />
      </Form.Dropdown>
    </Form>
  );
}
