import {
  Action,
  ActionPanel,
  Form,
  showToast,
  Toast,
  useNavigation,
  Clipboard,
} from "@raycast/api";
import { useEffect, useState } from "react";
import { reviewCode } from "./api";
import { ResultView } from "./result-view";

export default function ReviewCodeCommand() {
  const { push } = useNavigation();
  const [isLoading, setIsLoading] = useState(false);
  const [clipboardCode, setClipboardCode] = useState("");

  useEffect(() => {
    async function loadClipboard() {
      const text = await Clipboard.readText();
      if (text && text.length > 10) {
        setClipboardCode(text);
      }
    }
    loadClipboard();
  }, []);

  async function handleSubmit(values: {
    code: string;
    focus: string;
    language: string;
    thinking_level: string;
  }) {
    if (!values.code.trim()) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Code is required",
      });
      return;
    }

    setIsLoading(true);
    const toast = await showToast({
      style: Toast.Style.Animated,
      title: "Reviewing code...",
      message: "Multiple models analyzing your code",
    });

    try {
      const focus = values.focus
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const result = await reviewCode({
        code: values.code.trim(),
        focus: focus.length > 0 ? focus : undefined,
        language: values.language || undefined,
        thinking_level: values.thinking_level || undefined,
      });

      toast.style = Toast.Style.Success;
      toast.title = "Review complete";
      toast.message = `${result.participants.length} reviewers`;

      push(
        <ResultView
          result={result}
          participantLabel="Reviewers"
          copyTitles={{ summary: "Copy Review Summary", full: "Copy Full Review" }}
        />,
      );
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = "Review failed";
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
          <Action.SubmitForm title="Review Code" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextArea
        id="code"
        title="Code"
        placeholder="Paste code to review..."
        defaultValue={clipboardCode}
        enableMarkdown
      />
      <Form.TextField
        id="focus"
        title="Focus Areas"
        placeholder="security, performance, readability (comma-separated)"
      />
      <Form.TextField
        id="language"
        title="Language"
        placeholder="Auto-detected if blank"
      />
      <Form.Separator />
      <Form.Dropdown
        id="thinking_level"
        title="Review Depth"
        defaultValue="medium"
      >
        <Form.Dropdown.Item value="low" title="Low — Quick scan" />
        <Form.Dropdown.Item value="medium" title="Medium — Balanced" />
        <Form.Dropdown.Item value="high" title="High — Thorough" />
      </Form.Dropdown>
    </Form>
  );
}
