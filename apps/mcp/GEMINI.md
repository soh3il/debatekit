# DebateKit Extension

DebateKit runs collaborative AI brainstorming sessions — multi-model debates where several AI participants discuss your problem and a moderator synthesizes their perspectives.

## Tools

### Brainstorming (streaming)

- **consult** — General brainstorming and open-ended exploration. Use for broad questions, ideation, or when no specialized mode fits.
- **architect** — System design and tech stack decisions. Use for architecture reviews, infrastructure planning, and technology selection.
- **review_code** — Code review for security, performance, and best practices. Paste code or describe what to review.
- **debug** — Bug investigation and root cause analysis. Describe symptoms, error messages, or unexpected behavior.
- **plan_implementation** — Feature planning and task breakdown. Use to decompose features into actionable steps.
- **assess_tradeoffs** — Option comparison and decision making. Present alternatives and get structured analysis.

### Account & Session Management

- **check_usage** — Check credit balance and rate limit info.
- **list_models** — List available AI models.
- **list_sessions** — List prior debate sessions.
- **get_session** — Retrieve full context from a previous session.
- **get_thread_link** — Generate a shareable URL for a thread.
- **set_thread_visibility** — Make a thread public or private.
- **get_logs** — Request diagnostic logs for troubleshooting.

## Usage Tips

- Brainstorming tools stream responses. Each session produces multiple participant perspectives followed by a moderator synthesis.
- Use `list_models` to see which AI models are available before starting a session.
- Use `get_session` to resume context from a previous debate.
- Check your credits with `check_usage` if you hit rate limits.
